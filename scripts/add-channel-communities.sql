-- Adds special content channels/topics on top of existing communities.
-- Normal communities remain community_type='regular'.

SET @has_slug := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'slug'
);

SET @sql := IF(
  @has_slug = 0,
  'ALTER TABLE communities ADD COLUMN slug VARCHAR(160) NULL AFTER name',
  'SELECT ''communities.slug already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_type := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'community_type'
);

SET @sql := IF(
  @has_type = 0,
  'ALTER TABLE communities ADD COLUMN community_type ENUM(''regular'',''channel'',''topic'') NOT NULL DEFAULT ''regular'' AFTER slug',
  'SELECT ''communities.community_type already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_parent := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'parent_community_id'
);

SET @sql := IF(
  @has_parent = 0,
  'ALTER TABLE communities ADD COLUMN parent_community_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER community_type',
  'SELECT ''communities.parent_community_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE communities
SET community_type = 'regular'
WHERE community_type IS NULL;

SET @has_slug_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_slug'
);

SET @sql := IF(
  @has_slug_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_slug (slug)',
  'SELECT ''idx_communities_slug already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_type_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_type_parent'
);

SET @sql := IF(
  @has_type_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_type_parent (community_type, parent_community_id)',
  'SELECT ''idx_communities_type_parent already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_slug_unique := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'uk_communities_type_parent_slug'
);

SET @sql := IF(
  @has_slug_unique = 0,
  'ALTER TABLE communities ADD UNIQUE KEY uk_communities_type_parent_slug (community_type, parent_community_id, slug)',
  'SELECT ''uk_communities_type_parent_slug already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
