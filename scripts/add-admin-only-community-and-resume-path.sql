-- Fix job application resume storage and add admin-only communities.
-- Run after taking a database backup.

ALTER TABLE job_applications
  MODIFY COLUMN resume_media_id VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL;

SET @has_community_only_admin := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'only_admin'
);

SET @add_community_only_admin_sql := IF(
  @has_community_only_admin = 0,
  'ALTER TABLE communities ADD COLUMN only_admin TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''communities.only_admin already exists'' AS message'
);

PREPARE add_community_only_admin_stmt FROM @add_community_only_admin_sql;
EXECUTE add_community_only_admin_stmt;
DEALLOCATE PREPARE add_community_only_admin_stmt;

UPDATE communities
SET only_admin = 0
WHERE only_admin IS NULL;

SET @has_community_only_admin_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_only_admin'
);

SET @add_community_only_admin_index_sql := IF(
  @has_community_only_admin_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_only_admin (only_admin)',
  'SELECT ''communities.idx_communities_only_admin already exists'' AS message'
);

PREPARE add_community_only_admin_index_stmt FROM @add_community_only_admin_index_sql;
EXECUTE add_community_only_admin_index_stmt;
DEALLOCATE PREPARE add_community_only_admin_index_stmt;
