-- E1 only. Apply manually to an authorized database; never during next build.
BEGIN;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  role text NOT NULL CHECK (role IN ('administrador', 'supervisor')),
  active boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (email = lower(btrim(email)))
);

CREATE TABLE sessions (
  token_hash char(64) PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

COMMIT;
