-- Speeds up community membership state checks for lists, feeds, posts, and questions.

SET @has_community_member_lookup_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'community_members'
    AND INDEX_NAME = 'idx_community_members_user_community'
);

SET @sql := IF(
  @has_community_member_lookup_index = 0,
  'ALTER TABLE community_members ADD INDEX idx_community_members_user_community (user_id, community_id)',
  'SELECT ''idx_community_members_user_community already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
