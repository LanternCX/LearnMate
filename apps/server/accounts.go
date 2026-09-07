package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	"image/png"
	"io"
	"log"
	"math/big"
	"net"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/argon2"
)

//go:embed schema.sql
var schemaSQL string

func migrate(ctx context.Context, db *pgxpool.Pool) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(16916001)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, schemaSQL); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type accounts struct {
	db     *pgxpool.Pool
	send   func(to, purpose, code string) error
	secure bool
	origin string
}
type failure struct {
	status  int
	message string
}

func (e failure) Error() string { return e.message }
func bad(message string) error  { return failure{400, message} }

var unauthorized = failure{401, "登录已失效，请重新登录。"}
var invalidCode = failure{400, "验证码无效或已过期，请重新获取。"}

type user struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	password string
}
type input struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	CurrentPassword string `json:"currentPassword"`
	Flow            string `json:"flow"`
	Code            string `json:"code"`
	NewCode         string `json:"newCode"`
	Nickname        string `json:"nickname"`
	Avatar          string `json:"avatar"`
	Confirm         bool   `json:"confirm"`
}

func randomToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func digest(s string) string { b := sha256.Sum256([]byte(s)); return hex.EncodeToString(b[:]) }
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
func validatePassword(s string) error {
	if utf8.RuneCountInString(s) < 12 || len(s) > 256 {
		return bad("密码需至少 12 个字符，且不超过 256 字节。")
	}
	return nil
}
func normalizeEmail(s string) (string, error) {
	s = strings.ToLower(strings.TrimSpace(s))
	a, err := mail.ParseAddress(s)
	if err != nil || a.Address != s || len(s) > 254 || !strings.Contains(s, ".") {
		return "", bad("请输入有效的邮箱地址。")
	}
	return s, nil
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func respondError(w http.ResponseWriter, err error) {
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23505" {
		err = failure{409, "该邮箱无法使用，请换一个邮箱。"}
	}
	var e failure
	if !errors.As(err, &e) {
		log.Printf("account operation failed: %T", err)
		e = failure{500, "服务暂时不可用，请稍后重试。"}
	}
	if e.status == 429 {
		w.Header().Set("Retry-After", "60")
	}
	writeJSON(w, e.status, map[string]string{"error": e.message})
}

func (a *accounts) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "ok\n")
	})
	for _, route := range []string{"POST /auth/register/start", "POST /auth/register/complete", "POST /auth/login", "GET /me", "POST /auth/reset/start", "POST /auth/reset/complete", "POST /auth/logout", "POST /auth/logout-all", "PUT /me/password", "PATCH /me", "PUT /me/avatar", "POST /me/email/start", "POST /me/email/complete", "DELETE /me"} {
		parts := strings.SplitN(route, " ", 2)
		mux.HandleFunc(parts[0]+" /api"+parts[1], a.serve)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
			defer cancel()
			r = r.WithContext(ctx)
			if r.Method != "GET" {
				origin := r.Header.Get("Origin")
				scheme := "http"
				if a.secure {
					scheme = "https"
				}
				allowed := a.origin
				if allowed == "" {
					allowed = scheme + "://" + r.Host
				}
				if r.Header.Get("X-Zhiya-Request") != "1" || (origin != "" && origin != allowed) || r.Header.Get("Sec-Fetch-Site") == "cross-site" {
					respondError(w, failure{403, "请求来源无效。"})
					return
				}
				if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
					respondError(w, failure{415, "请使用 JSON 提交。"})
					return
				}
			}
			if strings.HasPrefix(r.URL.Path, "/api/auth/") || r.Method != "GET" {
				ip, _, _ := net.SplitHostPort(r.RemoteAddr)
				if err := a.limit(r.Context(), "ip:"+ip, 60); err != nil {
					respondError(w, err)
					return
				}
			}
		}
		mux.ServeHTTP(w, r)
	})
}
func (a *accounts) limit(ctx context.Context, key string, max int) error {
	var count int
	err := a.db.QueryRow(ctx, `INSERT INTO auth_limits(key,count,expires_at) VALUES($1,1,now()+interval '1 minute')
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_limits.expires_at<=now() THEN 1 ELSE auth_limits.count+1 END,
 expires_at=CASE WHEN auth_limits.expires_at<=now() THEN now()+interval '1 minute' ELSE auth_limits.expires_at END RETURNING count`, digest(key)).Scan(&count)
	if err != nil {
		return err
	}
	if count > max {
		return failure{429, "操作太频繁，请稍后重试。"}
	}
	return nil
}
func (a *accounts) cookie(w http.ResponseWriter, token string) {
	c := &http.Cookie{Name: "zhiya_session", Value: token, Path: "/", HttpOnly: true, Secure: a.secure, SameSite: http.SameSiteStrictMode, MaxAge: 30 * 24 * 60 * 60}
	if token == "" {
		c.MaxAge = -1
	}
	http.SetCookie(w, c)
}
func (a *accounts) current(ctx context.Context, tx pgx.Tx, r *http.Request) (user, error) {
	var u user
	var avatar []byte
	cookie, err := r.Cookie("zhiya_session")
	if err != nil {
		return u, unauthorized
	}
	err = tx.QueryRow(ctx, `SELECT u.id,u.email,u.nickname,u.password_hash,u.avatar FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() FOR UPDATE OF u`, digest(cookie.Value)).Scan(&u.ID, &u.Email, &u.Nickname, &u.password, &avatar)
	if errors.Is(err, pgx.ErrNoRows) {
		return u, unauthorized
	}
	if err != nil {
		return u, err
	}
	var valid bool
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at>now())", digest(cookie.Value)).Scan(&valid)
	if err != nil {
		return u, err
	}
	if !valid {
		return u, unauthorized
	}
	if expected := r.Header.Get("X-Zhiya-User"); expected != "" && expected != u.ID {
		return u, unauthorized
	}
	if len(avatar) > 0 {
		u.Avatar = "data:image/png;base64," + base64.StdEncoding.EncodeToString(avatar)
	}
	return u, nil
}

func (a *accounts) serve(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in input
	if r.Method != "GET" {
		r.Body = http.MaxBytesReader(w, r.Body, 3*1024*1024)
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&in); err != nil {
			respondError(w, bad("提交内容无效或过大。"))
			return
		}
		var extra any
		if decoder.Decode(&extra) != io.EOF {
			respondError(w, bad("提交内容无效。"))
			return
		}
		if len(in.Password) > 256 || len(in.CurrentPassword) > 256 {
			respondError(w, bad("密码过长。"))
			return
		}
	}
	path := strings.TrimPrefix(r.URL.Path, "/api")
	if path == "/auth/login" || strings.HasSuffix(path, "/start") {
		email, err := normalizeEmail(in.Email)
		if err != nil {
			respondError(w, err)
			return
		}
		limit, key := 5, "mail:"+email
		if path == "/auth/login" {
			limit, key = 10, "login:"+email
		}
		if err = a.limit(ctx, key, limit); err != nil {
			respondError(w, err)
			return
		}
		if path == "/me/email/start" {
			if c, err := r.Cookie("zhiya_session"); err == nil {
				if err = a.limit(ctx, "email-change:"+c.Value, 5); err != nil {
					respondError(w, err)
					return
				}
			}
		}
	}
	tx, err := a.db.Begin(ctx)
	if err != nil {
		respondError(w, err)
		return
	}
	defer tx.Rollback(ctx)
	if path == "/auth/register/complete" || path == "/auth/reset/complete" || path == "/me/password" || path == "/me/email/complete" || (path == "/me" && r.Method == "DELETE") {
		// ponytail: serialize identity changes; use ordered per-email locks if contention matters.
		if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(16916002)"); err != nil {
			respondError(w, err)
			return
		}
	}
	result, session, err := a.action(ctx, tx, r, in)
	if err != nil {
		respondError(w, err)
		return
	}
	if err = tx.Commit(ctx); err != nil {
		respondError(w, err)
		return
	}
	if session != nil {
		a.cookie(w, *session)
	}
	writeJSON(w, 200, result)
}

type challenge struct {
	ID, Purpose, Email, NewEmail, UserID, Hash, NewHash string
	Attempts                                            int
}

func (a *accounts) start(ctx context.Context, tx pgx.Tx, purpose, email, newEmail, userID string) (string, error) {
	id := randomToken()
	n, err := rand.Int(rand.Reader, big.NewInt(100000000))
	if err != nil {
		return "", err
	}
	code := fmt.Sprintf("%08d", n)
	newCode := ""
	if newEmail != "" {
		n, err = rand.Int(rand.Reader, big.NewInt(100000000))
		if err != nil {
			return "", err
		}
		newCode = fmt.Sprintf("%08d", n)
	}
	_, err = tx.Exec(ctx, "INSERT INTO challenges(id,purpose,email,new_email,user_id,code_hash,new_code_hash) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7)", id, purpose, email, newEmail, userID, digest(id+code), digest(id+newCode))
	if err != nil {
		return "", err
	}
	if err = a.send(email, purpose, code); err != nil {
		return "", failure{503, "邮件发送失败，请稍后重新获取。"}
	}
	if newEmail != "" {
		if err = a.send(newEmail, "email-new", newCode); err != nil {
			return "", failure{503, "邮件发送失败，请稍后重新获取。"}
		}
	}
	return id, nil
}
func verify(ctx context.Context, tx pgx.Tx, in input, purpose, owner string) (challenge, error) {
	var c challenge
	var valid bool
	err := tx.QueryRow(ctx, "SELECT id,purpose,email,new_email,COALESCE(user_id,''),code_hash,new_code_hash,attempts,expires_at>now() FROM challenges WHERE id=$1 FOR UPDATE", in.Flow).Scan(&c.ID, &c.Purpose, &c.Email, &c.NewEmail, &c.UserID, &c.Hash, &c.NewHash, &c.Attempts, &valid)
	if errors.Is(err, pgx.ErrNoRows) {
		return c, invalidCode
	}
	if err != nil {
		return c, err
	}
	if !valid || c.Purpose != purpose || c.UserID != owner || c.Attempts >= 5 {
		return c, invalidCode
	}
	if digest(c.ID+in.Code) != c.Hash || (purpose == "email" && digest(c.ID+in.NewCode) != c.NewHash) {
		if _, err = tx.Exec(ctx, "UPDATE challenges SET attempts=attempts+1 WHERE id=$1", c.ID); err != nil {
			return c, err
		}
		// Persist failed attempts even though the requested account change is rejected.
		if err = tx.Commit(ctx); err != nil {
			return c, err
		}
		return c, invalidCode
	}
	_, err = tx.Exec(ctx, "DELETE FROM challenges WHERE id=$1", c.ID)
	return c, err
}

func (a *accounts) action(ctx context.Context, tx pgx.Tx, r *http.Request, in input) (any, *string, error) {
	path := strings.TrimPrefix(r.URL.Path, "/api")
	ok := map[string]bool{"ok": true}
	if path == "/auth/reset/start" {
		email, err := normalizeEmail(in.Email)
		if err != nil {
			return nil, nil, err
		}
		var id string
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email=$1 FOR UPDATE", email).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return map[string]string{"flow": randomToken()}, nil, nil
		}
		if err != nil {
			return nil, nil, err
		}
		flow, err := a.start(ctx, tx, "reset", email, "", id)
		return map[string]string{"flow": flow}, nil, err
	}
	if path == "/auth/reset/complete" {
		if err := validatePassword(in.Password); err != nil {
			return nil, nil, err
		}
		var id string
		err := tx.QueryRow(ctx, "SELECT u.id FROM users u JOIN challenges c ON c.user_id=u.id WHERE c.id=$1 FOR UPDATE OF u", in.Flow).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, invalidCode
		}
		if err != nil {
			return nil, nil, err
		}
		c, err := verify(ctx, tx, in, "reset", id)
		if err != nil {
			return nil, nil, err
		}
		if _, err = tx.Exec(ctx, "UPDATE users SET password_hash=$1 WHERE id=$2", passwordHash(in.Password), id); err != nil {
			return nil, nil, err
		}
		err = revoke(ctx, tx, id, c.Email)
		empty := ""
		return ok, &empty, err
	}
	if path == "/auth/register/start" {
		email, err := normalizeEmail(in.Email)
		if err != nil {
			return nil, nil, err
		}
		var exists bool
		if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", email).Scan(&exists); err != nil {
			return nil, nil, err
		}
		if exists {
			return map[string]string{"flow": randomToken()}, nil, nil
		}
		flow, err := a.start(ctx, tx, "register", email, "", "")
		return map[string]string{"flow": flow}, nil, err
	}
	if path == "/auth/register/complete" {
		if err := validatePassword(in.Password); err != nil {
			return nil, nil, err
		}
		c, err := verify(ctx, tx, in, "register", "")
		if err != nil {
			return nil, nil, err
		}
		tag, err := tx.Exec(ctx, "INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING", randomToken(), c.Email, passwordHash(in.Password))
		if err != nil {
			return nil, nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, nil, invalidCode
		}
		_, err = tx.Exec(ctx, "DELETE FROM challenges WHERE email=$1 AND purpose='register'", c.Email)
		return ok, nil, err
	}
	if path == "/auth/login" {
		email, err := normalizeEmail(in.Email)
		if err != nil {
			return nil, nil, unauthorized
		}
		if len(in.Password) > 256 {
			return nil, nil, unauthorized
		}
		var id, hash string
		err = tx.QueryRow(ctx, "SELECT id,password_hash FROM users WHERE email=$1 FOR UPDATE", email).Scan(&id, &hash)
		if errors.Is(err, pgx.ErrNoRows) {
			passwordHash(in.Password)
			return nil, nil, failure{401, "邮箱或密码不正确。"}
		}
		if err != nil {
			return nil, nil, err
		}
		if !passwordMatches(in.Password, hash) {
			return nil, nil, failure{401, "邮箱或密码不正确。"}
		}
		token := randomToken()
		_, err = tx.Exec(ctx, "INSERT INTO sessions(token_hash,user_id) VALUES($1,$2)", digest(token), id)
		return ok, &token, err
	}
	u, err := a.current(ctx, tx, r)
	if err != nil {
		return nil, nil, err
	}
	if path == "/me" && r.Method == "GET" {
		return u, nil, nil
	}
	if path == "/me" && r.Method == "PATCH" {
		name := strings.TrimSpace(in.Nickname)
		if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 40 {
			return nil, nil, bad("昵称需为 1–40 个字符。")
		}
		_, err = tx.Exec(ctx, "UPDATE users SET nickname=$1 WHERE id=$2", name, u.ID)
		return ok, nil, err
	}
	if path == "/me/avatar" {
		avatar, err := validatedAvatar(in.Avatar)
		if err != nil {
			return nil, nil, err
		}
		_, err = tx.Exec(ctx, "UPDATE users SET avatar=$1 WHERE id=$2", avatar, u.ID)
		return ok, nil, err
	}
	if path == "/me/email/start" {
		email, err := normalizeEmail(in.Email)
		if err != nil {
			return nil, nil, err
		}
		if email == u.Email {
			return nil, nil, bad("请输入不同的新邮箱。")
		}
		var exists bool
		if err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)", email).Scan(&exists); err != nil {
			return nil, nil, err
		}
		if exists {
			return nil, nil, bad("该邮箱无法使用，请换一个邮箱。")
		}
		flow, err := a.start(ctx, tx, "email", u.Email, email, u.ID)
		return map[string]string{"flow": flow}, nil, err
	}
	if path == "/me/email/complete" {
		c, err := verify(ctx, tx, in, "email", u.ID)
		if err != nil {
			return nil, nil, err
		}
		if c.Email != u.Email {
			return nil, nil, invalidCode
		}
		if _, err = tx.Exec(ctx, "UPDATE users SET email=$1 WHERE id=$2", c.NewEmail, u.ID); err != nil {
			return nil, nil, err
		}
		_, err = tx.Exec(ctx, "DELETE FROM challenges WHERE user_id=$1 OR email=$2 OR email=$3 OR new_email=$2 OR new_email=$3", u.ID, u.Email, c.NewEmail)
		return ok, nil, err
	}
	if path == "/me" && r.Method == "DELETE" {
		if !in.Confirm {
			return nil, nil, bad("请确认永久删除账号及关联个人数据。")
		}
		if !passwordMatches(in.CurrentPassword, u.password) {
			return nil, nil, bad("当前密码不正确。")
		}
		if err = revoke(ctx, tx, u.ID, u.Email); err != nil {
			return nil, nil, err
		}
		_, err = tx.Exec(ctx, "DELETE FROM users WHERE id=$1", u.ID)
		empty := ""
		return ok, &empty, err
	}
	if path == "/auth/logout" {
		c, _ := r.Cookie("zhiya_session")
		_, err = tx.Exec(ctx, "DELETE FROM sessions WHERE token_hash=$1", digest(c.Value))
		empty := ""
		return ok, &empty, err
	}
	if path == "/auth/logout-all" {
		_, err = tx.Exec(ctx, "DELETE FROM sessions WHERE user_id=$1", u.ID)
		empty := ""
		return ok, &empty, err
	}
	if path == "/me/password" {
		if err = validatePassword(in.Password); err != nil {
			return nil, nil, err
		}
		if !passwordMatches(in.CurrentPassword, u.password) {
			return nil, nil, bad("当前密码不正确。")
		}
		if _, err = tx.Exec(ctx, "UPDATE users SET password_hash=$1 WHERE id=$2", passwordHash(in.Password), u.ID); err != nil {
			return nil, nil, err
		}
		err = revoke(ctx, tx, u.ID, u.Email)
		empty := ""
		return ok, &empty, err
	}
	return nil, nil, failure{404, "未找到该操作。"}
}

func revoke(ctx context.Context, tx pgx.Tx, id, email string) error {
	if _, err := tx.Exec(ctx, "DELETE FROM sessions WHERE user_id=$1", id); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, "DELETE FROM challenges WHERE user_id=$1 OR email=$2 OR new_email=$2", id, email)
	return err
}

func validatedAvatar(value string) ([]byte, error) {
	if value == "" {
		return nil, nil
	}
	fail := bad("头像仅支持 2 MB 以内、边长不超过 2048 像素的 PNG 或 JPEG 图片。")
	parts := strings.SplitN(value, ",", 2)
	if len(parts) != 2 || (parts[0] != "data:image/png;base64" && parts[0] != "data:image/jpeg;base64") {
		return nil, fail
	}
	raw, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil || len(raw) > 2*1024*1024 {
		return nil, fail
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "png" && format != "jpeg") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 2048 || cfg.Height > 2048 {
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
	if out.Len() > 2*1024*1024 {
		return nil, fail
	}
	return out.Bytes(), nil
}
