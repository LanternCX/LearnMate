package data

import (
	"context"
	_ "embed"
	"errors"

	"github.com/LanternCX/zhiya/apps/server/internal/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound       = errors.New("record not found")
	ErrInvalidSession = errors.New("登录已失效，请重新登录。")
	ErrInvalidCode    = errors.New("验证码无效或已过期，请重新获取。")
	ErrEmailInUse     = errors.New("该邮箱无法使用，请换一个邮箱。")
	ErrRateLimited    = errors.New("操作太频繁，请稍后重试。")
)

type ValidationError string

func (e ValidationError) Error() string { return string(e) }

type database interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

type Models struct {
	Users  UserModel
	Tokens TokenModel
	pool   *pgxpool.Pool
}

func NewModels(pool *pgxpool.Pool, policy config.Account) Models {
	return Models{Users: UserModel{db: pool}, Tokens: TokenModel{db: pool, policy: policy}, pool: pool}
}

type TransactionMode bool

const (
	StandardTransaction TransactionMode = false
	IdentityTransaction TransactionMode = true
)

// Transaction supplies models bound to one transaction; callbacks must not start nested transactions.
// Identity changes acquire the shared advisory lock before any user or challenge row locks.
func (m Models) Transaction(ctx context.Context, mode TransactionMode, action func(Models) error) error {
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if mode == IdentityTransaction {
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(16916002)"); err != nil {
			return err
		}
	}
	err = action(Models{Users: UserModel{db: tx}, Tokens: TokenModel{db: tx, policy: m.Tokens.policy}})
	var failedAttempt failedVerificationAttempt
	if errors.As(err, &failedAttempt) {
		// A rejected code must still consume an attempt. Verify before making other changes.
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return databaseError(commitErr)
		}
		return ErrInvalidCode
	}
	if err != nil {
		return databaseError(err)
	}
	return databaseError(tx.Commit(ctx))
}

func databaseError(err error) error {
	var pgerr *pgconn.PgError
	if errors.As(err, &pgerr) && pgerr.Code == "23505" {
		return ErrEmailInUse
	}
	return err
}

//go:embed schema.sql
var schemaSQL string

func (m Models) Initialize(ctx context.Context) error {
	tx, err := m.pool.Begin(ctx)
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
