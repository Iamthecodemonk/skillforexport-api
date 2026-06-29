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

SET @has_default_visibility := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'default_post_visibility'
);

SET @sql := IF(
  @has_default_visibility = 0,
  'ALTER TABLE communities ADD COLUMN default_post_visibility VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER parent_community_id',
  'SELECT ''communities.default_post_visibility already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_is_private := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'is_private'
);

SET @sql := IF(
  @has_is_private = 0,
  'ALTER TABLE communities ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0 AFTER default_post_visibility',
  'SELECT ''communities.is_private already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_members_only := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'members_only_posting'
);

SET @sql := IF(
  @has_members_only = 0,
  'ALTER TABLE communities ADD COLUMN members_only_posting TINYINT(1) NOT NULL DEFAULT 0 AFTER is_private',
  'SELECT ''communities.members_only_posting already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_only_admin := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'only_admin'
);

SET @sql := IF(
  @has_only_admin = 0,
  'ALTER TABLE communities ADD COLUMN only_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER members_only_posting',
  'SELECT ''communities.only_admin already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE communities
SET community_type = 'regular'
WHERE community_type IS NULL;

UPDATE communities
SET is_private = CASE
  WHEN default_post_visibility = 'community' THEN 1
  ELSE COALESCE(is_private, 0)
END;

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

SET @has_is_private_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_is_private'
);

SET @sql := IF(
  @has_is_private_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_is_private (is_private)',
  'SELECT ''idx_communities_is_private already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_only_admin_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_only_admin'
);

SET @sql := IF(
  @has_only_admin_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_only_admin (only_admin)',
  'SELECT ''idx_communities_only_admin already exists'' AS message'
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
