CREATE TABLE IF NOT EXISTS auth_sessions (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  token_hash CHAR(64) NOT NULL,
  previous_token_hash CHAR(64) NULL,
  token_version INT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_auth_sessions_token_hash (token_hash),
  UNIQUE KEY uq_auth_sessions_previous_hash (previous_token_hash),
  KEY idx_auth_sessions_user (user_id),
  KEY idx_auth_sessions_expiry (expires_at)
);
