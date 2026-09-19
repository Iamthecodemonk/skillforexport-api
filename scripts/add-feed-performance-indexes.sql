SET @schema_name := DATABASE();

SET @has_posts_created_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_created_at'
);
SET @sql := IF(@has_posts_created_at = 0, 'ALTER TABLE posts ADD INDEX idx_posts_created_at (created_at)', 'SELECT ''idx_posts_created_at exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_post_media_post_order := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'post_media' AND INDEX_NAME = 'idx_post_media_post_order'
);
SET @sql := IF(@has_post_media_post_order = 0, 'ALTER TABLE post_media ADD INDEX idx_post_media_post_order (post_id, display_order)', 'SELECT ''idx_post_media_post_order exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_user_skills_user_created := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'user_skills' AND INDEX_NAME = 'idx_user_skills_user_created'
);
SET @sql := IF(@has_user_skills_user_created = 0, 'ALTER TABLE user_skills ADD INDEX idx_user_skills_user_created (user_id, created_at)', 'SELECT ''idx_user_skills_user_created exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_saved_items_viewer_target := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'saved_items' AND INDEX_NAME = 'idx_saved_items_viewer_target'
);
SET @sql := IF(@has_saved_items_viewer_target = 0, 'ALTER TABLE saved_items ADD INDEX idx_saved_items_viewer_target (user_id, target_type, target_id)', 'SELECT ''idx_saved_items_viewer_target exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_generic_reports_viewer_target := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'generic_reports' AND INDEX_NAME = 'idx_generic_reports_viewer_target'
);
SET @sql := IF(@has_generic_reports_viewer_target = 0, 'ALTER TABLE generic_reports ADD INDEX idx_generic_reports_viewer_target (user_id, target_type, target_id)', 'SELECT ''idx_generic_reports_viewer_target exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_pages_student_owner := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'pages' AND INDEX_NAME = 'idx_pages_student_owner'
);
SET @sql := IF(@has_pages_student_owner = 0, 'ALTER TABLE pages ADD INDEX idx_pages_student_owner (page_type, owner_id, moderation_status)', 'SELECT ''idx_pages_student_owner exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_posts_user_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_user_id'
);
SET @sql := IF(@has_posts_user_id = 0, 'ALTER TABLE posts ADD INDEX idx_posts_user_id (user_id)', 'SELECT ''idx_posts_user_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_posts_community_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_community_id'
);
SET @sql := IF(@has_posts_community_id = 0, 'ALTER TABLE posts ADD INDEX idx_posts_community_id (community_id)', 'SELECT ''idx_posts_community_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_posts_page_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_page_id'
);
SET @sql := IF(@has_posts_page_id = 0, 'ALTER TABLE posts ADD INDEX idx_posts_page_id (page_id)', 'SELECT ''idx_posts_page_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_posts_feed := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'posts' AND INDEX_NAME = 'idx_posts_feed_visibility_created'
);
SET @sql := IF(@has_posts_feed = 0, 'ALTER TABLE posts ADD INDEX idx_posts_feed_visibility_created (visibility, moderation_status, created_at)', 'SELECT ''idx_posts_feed_visibility_created exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_questions_created_at := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_created_at'
);
SET @sql := IF(@has_questions_created_at = 0, 'ALTER TABLE questions ADD INDEX idx_questions_created_at (created_at)', 'SELECT ''idx_questions_created_at exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_questions_user_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_user_id'
);
SET @sql := IF(@has_questions_user_id = 0, 'ALTER TABLE questions ADD INDEX idx_questions_user_id (user_id)', 'SELECT ''idx_questions_user_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_questions_community_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_community_id'
);
SET @sql := IF(@has_questions_community_id = 0, 'ALTER TABLE questions ADD INDEX idx_questions_community_id (community_id)', 'SELECT ''idx_questions_community_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_questions_feed := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_feed_visibility_created'
);
SET @sql := IF(@has_questions_feed = 0, 'ALTER TABLE questions ADD INDEX idx_questions_feed_visibility_created (visibility, moderation_status, created_at)', 'SELECT ''idx_questions_feed_visibility_created exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_post_reactions_post_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'post_reactions' AND INDEX_NAME = 'idx_post_reactions_post_id'
);
SET @sql := IF(@has_post_reactions_post_id = 0, 'ALTER TABLE post_reactions ADD INDEX idx_post_reactions_post_id (post_id)', 'SELECT ''idx_post_reactions_post_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_post_reactions_user_post := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'post_reactions' AND INDEX_NAME = 'idx_post_reactions_user_post'
);
SET @sql := IF(@has_post_reactions_user_post = 0, 'ALTER TABLE post_reactions ADD INDEX idx_post_reactions_user_post (user_id, post_id)', 'SELECT ''idx_post_reactions_user_post exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_comments_post_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'comments' AND INDEX_NAME = 'idx_comments_post_id'
);
SET @sql := IF(@has_comments_post_id = 0, 'ALTER TABLE comments ADD INDEX idx_comments_post_id (post_id)', 'SELECT ''idx_comments_post_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_answers_question_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'answers' AND INDEX_NAME = 'idx_answers_question_id'
);
SET @sql := IF(@has_answers_question_id = 0, 'ALTER TABLE answers ADD INDEX idx_answers_question_id (question_id)', 'SELECT ''idx_answers_question_id exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_post_saves_user_post := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'post_saves' AND INDEX_NAME = 'idx_post_saves_user_post'
);
SET @sql := IF(@has_post_saves_user_post = 0, 'ALTER TABLE post_saves ADD INDEX idx_post_saves_user_post (user_id, post_id)', 'SELECT ''idx_post_saves_user_post exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_followers_follower_following := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @schema_name AND TABLE_NAME = 'followers' AND INDEX_NAME = 'idx_followers_follower_following'
);
SET @sql := IF(@has_followers_follower_following = 0, 'ALTER TABLE followers ADD INDEX idx_followers_follower_following (follower_id, following_id)', 'SELECT ''idx_followers_follower_following exists'' AS message');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
