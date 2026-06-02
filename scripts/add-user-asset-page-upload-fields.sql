-- Adds first-class page/personal media upload fields.
-- Safe to run more than once on MySQL.

SET @has_user_assets_page_id := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_assets'
    AND COLUMN_NAME = 'page_id'
);

SET @add_user_assets_page_id_sql := IF(
  @has_user_assets_page_id = 0,
  'ALTER TABLE user_assets ADD COLUMN page_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER user_id',
  'SELECT ''user_assets.page_id already exists'' AS message'
);

PREPARE add_user_assets_page_id_stmt FROM @add_user_assets_page_id_sql;
EXECUTE add_user_assets_page_id_stmt;
DEALLOCATE PREPARE add_user_assets_page_id_stmt;

SET @has_user_assets_title := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_assets'
    AND COLUMN_NAME = 'title'
);

SET @add_user_assets_title_sql := IF(
  @has_user_assets_title = 0,
  'ALTER TABLE user_assets ADD COLUMN title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER page_id',
  'SELECT ''user_assets.title already exists'' AS message'
);

PREPARE add_user_assets_title_stmt FROM @add_user_assets_title_sql;
EXECUTE add_user_assets_title_stmt;
DEALLOCATE PREPARE add_user_assets_title_stmt;

SET @has_user_assets_page_idx := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_assets'
    AND INDEX_NAME = 'idx_user_assets_page_id'
);

SET @add_user_assets_page_idx_sql := IF(
  @has_user_assets_page_idx = 0,
  'ALTER TABLE user_assets ADD INDEX idx_user_assets_page_id (page_id)',
  'SELECT ''idx_user_assets_page_id already exists'' AS message'
);

PREPARE add_user_assets_page_idx_stmt FROM @add_user_assets_page_idx_sql;
EXECUTE add_user_assets_page_idx_stmt;
DEALLOCATE PREPARE add_user_assets_page_idx_stmt;

SET @has_user_assets_page_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_assets'
    AND CONSTRAINT_NAME = 'user_assets_ibfk_2'
);

SET @add_user_assets_page_fk_sql := IF(
  @has_user_assets_page_fk = 0,
  'ALTER TABLE user_assets ADD CONSTRAINT user_assets_ibfk_2 FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE',
  'SELECT ''user_assets_ibfk_2 already exists'' AS message'
);

PREPARE add_user_assets_page_fk_stmt FROM @add_user_assets_page_fk_sql;
EXECUTE add_user_assets_page_fk_stmt;
DEALLOCATE PREPARE add_user_assets_page_fk_stmt;
