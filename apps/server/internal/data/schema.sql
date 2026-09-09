CREATE TABLE IF NOT EXISTS users (
 id text PRIMARY KEY,
 email text NOT NULL UNIQUE,
 password_hash text NOT NULL,
 nickname text NOT NULL,
 avatar bytea,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
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
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_user ON challenges(user_id);
CREATE TABLE IF NOT EXISTS auth_limits (
 key text PRIMARY KEY,
 count integer NOT NULL,
 expires_at timestamptz NOT NULL
);

-- Defaults controlled by configuration are supplied explicitly by the application.
ALTER TABLE sessions ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE challenges ALTER COLUMN expires_at DROP DEFAULT;
ALTER TABLE users ALTER COLUMN nickname DROP DEFAULT;

CREATE TABLE IF NOT EXISTS conversations (
 id uuid PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL,
 state jsonb NOT NULL,
 UNIQUE(user_id, purpose)
);
CREATE TABLE IF NOT EXISTS student_memories (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 content text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
