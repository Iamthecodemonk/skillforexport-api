-- Adds typed page support for business/student pages.
-- Safe to run more than once on MySQL.

SET @has_page_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pages'
    AND COLUMN_NAME = 'page_type'
);

SET @add_page_type_sql := IF(
  @has_page_type = 0,
  'ALTER TABLE pages ADD COLUMN page_type ENUM(''business'',''student'') DEFAULT ''business'' AFTER category_id',
  'SELECT ''pages.page_type already exists'' AS message'
);

PREPARE add_page_type_stmt FROM @add_page_type_sql;
EXECUTE add_page_type_stmt;
DEALLOCATE PREPARE add_page_type_stmt;

SET @has_page_type_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pages'
    AND INDEX_NAME = 'idx_page_type'
);

SET @add_page_type_index_sql := IF(
  @has_page_type_index = 0,
  'ALTER TABLE pages ADD INDEX idx_page_type (page_type)',
  'SELECT ''pages.idx_page_type already exists'' AS message'
);

PREPARE add_page_type_index_stmt FROM @add_page_type_index_sql;
EXECUTE add_page_type_index_stmt;
DEALLOCATE PREPARE add_page_type_index_stmt;
