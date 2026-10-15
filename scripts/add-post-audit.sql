-- Run against the application database before deploying post-audit routes.
CREATE TABLE IF NOT EXISTS post_audit_units (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_post_audit_units_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_audit_settings (
  id TINYINT NOT NULL PRIMARY KEY,
  copies_per_item INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO post_audit_settings (id, copies_per_item, updated_at)
VALUES (1, 1, NOW()) ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS post_audit_assignments (
  id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  unit_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  item_type ENUM('post','question') NOT NULL,
  item_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  source_created_at DATETIME(6) NOT NULL,
  assigned_at DATETIME NOT NULL,
  checked_at DATETIME NULL,
  checked_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  report_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  UNIQUE KEY uk_post_audit_unit_item (unit_id, item_type, item_id),
  KEY idx_post_audit_pending (unit_id, checked_at, source_created_at, item_id),
  KEY idx_post_audit_item (item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_audit_cursors (
  item_type ENUM('post','question') NOT NULL PRIMARY KEY,
  last_created_at DATETIME(6) NULL,
  last_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO post_audit_cursors (item_type) VALUES ('post'), ('question')
ON DUPLICATE KEY UPDATE item_type = VALUES(item_type);

CREATE TABLE IF NOT EXISTS post_audit_overrides (
  item_type ENUM('post','question') NOT NULL,
  item_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (item_type, item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
