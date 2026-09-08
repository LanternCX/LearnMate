CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY,
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 nickname text NOT NULL DEFAULT '学习者',
 avatar bytea,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS challenges (
 id text PRIMARY KEY,
 purpose text NOT NULL,
 email text NOT NULL,
 new_email text NOT NULL DEFAULT '',
 user_id text REFERENCES users(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 new_code_hash text NOT NULL DEFAULT '',
 attempts integer NOT NULL DEFAULT 0,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);
CREATE INDEX IF NOT EXISTS challenges_user ON challenges(user_id);
CREATE TABLE IF NOT EXISTS auth_limits (
 key text PRIMARY KEY,
 count integer NOT NULL,
 expires_at timestamptz NOT NULL
);
