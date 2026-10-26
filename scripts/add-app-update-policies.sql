-- Run against the application database before deploying app-update routes.
CREATE TABLE IF NOT EXISTS app_update_policies (
  platform ENUM('android', 'ios') NOT NULL PRIMARY KEY,
  latest_version VARCHAR(32) NOT NULL,
  min_supported_version VARCHAR(32) NOT NULL,
  store_url VARCHAR(2048) NOT NULL,
  release_notes TEXT NULL,
  released_at DATETIME NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  updated_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
