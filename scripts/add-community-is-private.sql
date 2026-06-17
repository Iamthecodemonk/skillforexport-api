-- Adds an explicit privacy flag for communities.
-- is_private = 1 means posts default to staying inside the community.

SET @has_community_is_private := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND COLUMN_NAME = 'is_private'
);

SET @add_community_is_private_sql := IF(
  @has_community_is_private = 0,
  'ALTER TABLE communities ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT ''communities.is_private already exists'' AS message'
);

PREPARE add_community_is_private_stmt FROM @add_community_is_private_sql;
EXECUTE add_community_is_private_stmt;
DEALLOCATE PREPARE add_community_is_private_stmt;

UPDATE communities
SET is_private = CASE
  WHEN default_post_visibility = 'community' THEN 1
  ELSE 0
END;

SET @has_community_is_private_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'communities'
    AND INDEX_NAME = 'idx_communities_is_private'
);

SET @add_community_is_private_index_sql := IF(
  @has_community_is_private_index = 0,
  'ALTER TABLE communities ADD INDEX idx_communities_is_private (is_private)',
  'SELECT ''communities.idx_communities_is_private already exists'' AS message'
);

PREPARE add_community_is_private_index_stmt FROM @add_community_is_private_index_sql;
EXECUTE add_community_is_private_index_stmt;
DEALLOCATE PREPARE add_community_is_private_index_stmt;
