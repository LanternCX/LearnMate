package data

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"net/mail"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/argon2"
)

// Product constraints change with the application, not with the deployment.
const (
	PasswordMinCharacters = 8
	PasswordMaxBytes      = 256
	NicknameMaxCharacters = 40
	DefaultNickname       = "学习者"
	AvatarMaxBytes        = 2 * 1024 * 1024
	AvatarMaxDimension    = 2048
)

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	password string
}

// AccountRules exposes only input constraints that clients need to render forms.
func AccountRules() map[string]int {
	return map[string]int{
		"password_min_characters":  PasswordMinCharacters,
		"password_max_bytes":       PasswordMaxBytes,
		"nickname_max_characters":  NicknameMaxCharacters,
		"avatar_max_bytes":         AvatarMaxBytes,
		"avatar_max_dimension":     AvatarMaxDimension,
		"verification_code_digits": verificationCodeDigits,
		"verification_ttl_seconds": int(VerificationTTL.Seconds()),
	}
}

type UserModel struct {
	db database
}

func (u User) PasswordMatches(password string) bool { return passwordMatches(password, u.password) }
func (m UserModel) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := m.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", email).Scan(&exists)
	return exists, err
}
func (m UserModel) GetByEmail(ctx context.Context, email string) (User, error) {
	var u User
	err := m.db.QueryRow(ctx, "SELECT id,email,password_hash FROM users WHERE email=$1 FOR UPDATE", email).Scan(&u.ID, &u.Email, &u.password)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrNotFound
	}
	return u, err
}
func (m UserModel) Authenticate(ctx context.Context, email, password string) (User, error) {
	u, err := m.GetByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		passwordHash(password)
		return u, ErrNotFound
	}
	if err != nil {
		return u, err
	}
	if !u.PasswordMatches(password) {
		return u, ErrNotFound
	}
	return u, nil
}
func (m UserModel) GetByChallenge(ctx context.Context, flow string) (string, error) {
	var id string
	err := m.db.QueryRow(ctx, "SELECT u.id FROM users u JOIN challenges c ON c.user_id=u.id WHERE c.id=$1 FOR UPDATE OF u", flow).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidCode
	}
	return id, err
}
func (m UserModel) Insert(ctx context.Context, email, password string) error {
	tag, err := m.db.Exec(ctx, "INSERT INTO users(id,email,password_hash,nickname) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING", randomToken(), email, passwordHash(password), DefaultNickname)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return ErrInvalidCode
	}
	return nil
}
func (m UserModel) UpdatePassword(ctx context.Context, id, password string) error {
	_, err := m.db.Exec(ctx, "UPDATE users SET password_hash=$1 WHERE id=$2", passwordHash(password), id)
	return err
}
func (m UserModel) UpdateEmail(ctx context.Context, id, email string) error {
	_, err := m.db.Exec(ctx, "UPDATE users SET email=$1 WHERE id=$2", email, id)
	return err
}
func (m UserModel) UpdateNickname(ctx context.Context, id, name string) error {
	name = strings.TrimSpace(name)
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > NicknameMaxCharacters {
		return ValidationError(fmt.Sprintf("昵称需为 1–%d 个字符", NicknameMaxCharacters))
	}
	_, err := m.db.Exec(ctx, "UPDATE users SET nickname=$1 WHERE id=$2", name, id)
	return err
}
func (m UserModel) UpdateAvatar(ctx context.Context, id, value string) error {
	avatar, err := m.validatedAvatar(value)
	if err != nil {
		return err
	}
	_, err = m.db.Exec(ctx, "UPDATE users SET avatar=$1 WHERE id=$2", avatar, id)
	return err
}
func (m UserModel) Delete(ctx context.Context, id string) error {
	_, err := m.db.Exec(ctx, "DELETE FROM users WHERE id=$1", id)
	return err
}
func (m UserModel) GetBySession(ctx context.Context, token, expected string) (User, error) {
	var u User
	var avatar []byte
	err := m.db.QueryRow(ctx, `SELECT u.id,u.email,u.nickname,u.password_hash,u.avatar FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() FOR UPDATE OF u`, digest(token)).Scan(&u.ID, &u.Email, &u.Nickname, &u.password, &avatar)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, ErrInvalidSession
	}
	if err != nil {
		return u, err
	}
	var valid bool
	// Recheck after acquiring the user lock: another transaction may have revoked the session while we waited.
	err = m.db.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now())", digest(token)).Scan(&valid)
	if err != nil {
		return u, err
	}
	if !valid {
		return u, ErrInvalidSession
	}
	if expected != "" && expected != u.ID {
		return u, ErrInvalidSession
	}
	if len(avatar) > 0 {
		u.Avatar = "data:image/png;base64," + base64.StdEncoding.EncodeToString(avatar)
	}
	return u, nil
}

func passwordHash(password string) string {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		panic(err)
	}
	hash := argon2.IDKey([]byte(password), salt, 2, 19*1024, 1, 32)
	return "argon2id$19m2t1p$" + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(hash)
}
func passwordMatches(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "argon2id" || parts[1] != "19m2t1p" {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, 2, 19*1024, 1, 32)
	return subtle.ConstantTimeCompare(actual, expected) == 1
}
func (m UserModel) ValidatePassword(s string) error {
	if utf8.RuneCountInString(s) < PasswordMinCharacters {
		return ValidationError(fmt.Sprintf("密码至少需要 %d 个字符", PasswordMinCharacters))
	}
	if len(s) > PasswordMaxBytes {
		return ValidationError("密码太长，请缩短后重试")
	}
	return nil
}
func NormalizeEmail(s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s || len(s) > 254 || !strings.Contains(s, ".") {
		return "", ValidationError("请输入有效的邮箱地址")
	}
	return s, nil
}

func (m UserModel) validatedAvatar(value string) ([]byte, error) {
	if value == "" {
		return nil, nil
	}
	fail := ValidationError(fmt.Sprintf("头像仅支持 %g MB 以内、边长不超过 %d 像素的 PNG 或 JPEG 图片", float64(AvatarMaxBytes)/(1024*1024), AvatarMaxDimension))
	parts := strings.SplitN(value, ",", 2)
	if len(parts) != 2 || (parts[0] != "data:image/png;base64" && parts[0] != "data:image/jpeg;base64") {
		return nil, fail
	}
	raw, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil || len(raw) > AvatarMaxBytes {
		return nil, fail
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "png" && format != "jpeg") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > AvatarMaxDimension || cfg.Height > AvatarMaxDimension {
		return nil, fail
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return nil, fail
	}
	var out bytes.Buffer
	if err = png.Encode(&out, img); err != nil {
		return nil, fail
	}
	if out.Len() > AvatarMaxBytes {
		return nil, fail
	}
	return out.Bytes(), nil
}
