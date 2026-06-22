-- Remove duplicate user follow rows and prevent them from being recreated.
-- Keeps the oldest row for each follower/following pair.

DELETE f1
FROM followers f1
JOIN followers f2
  ON f1.follower_id = f2.follower_id
 AND f1.following_id = f2.following_id
 AND (
   COALESCE(f1.created_at, '9999-12-31 23:59:59') > COALESCE(f2.created_at, '9999-12-31 23:59:59')
   OR (
     COALESCE(f1.created_at, '9999-12-31 23:59:59') = COALESCE(f2.created_at, '9999-12-31 23:59:59')
     AND f1.id > f2.id
   )
 )
WHERE f1.follower_id IS NOT NULL
  AND f1.following_id IS NOT NULL;

SET @has_follow_unique := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'followers'
    AND INDEX_NAME = 'uk_followers_pair'
);

SET @add_follow_unique_sql := IF(
  @has_follow_unique = 0,
  'ALTER TABLE followers ADD UNIQUE KEY uk_followers_pair (follower_id, following_id)',
  'SELECT ''followers.uk_followers_pair already exists'' AS message'
);

PREPARE add_follow_unique_stmt FROM @add_follow_unique_sql;
EXECUTE add_follow_unique_stmt;
DEALLOCATE PREPARE add_follow_unique_stmt;
