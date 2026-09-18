-- Speeds up student page lookup during registration/onboarding.

SET @has_pages_owner_type_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pages'
    AND INDEX_NAME = 'idx_pages_owner_page_type'
);

SET @sql := IF(
  @has_pages_owner_type_index = 0,
  'ALTER TABLE pages ADD INDEX idx_pages_owner_page_type (owner_id, page_type)',
  'SELECT ''idx_pages_owner_page_type already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
