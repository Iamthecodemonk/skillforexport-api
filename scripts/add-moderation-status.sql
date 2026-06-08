-- Adds soft moderation status for content types that do not already have a status column.
-- Run this before deploying the moderation-code changes.

ALTER TABLE posts
  ADD COLUMN moderation_status ENUM('pending','approved','suspended','deleted')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'approved'
    AFTER visibility,
  ADD INDEX idx_posts_moderation_status (moderation_status);

ALTER TABLE comments
  ADD COLUMN moderation_status ENUM('pending','approved','suspended','deleted')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'approved'
    AFTER content,
  ADD INDEX idx_comments_moderation_status (moderation_status);

ALTER TABLE questions
  ADD COLUMN moderation_status ENUM('pending','approved','suspended','deleted')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'approved'
    AFTER visibility,
  ADD INDEX idx_questions_moderation_status (moderation_status);

ALTER TABLE answers
  ADD COLUMN moderation_status ENUM('pending','approved','suspended','deleted')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'approved'
    AFTER content,
  ADD INDEX idx_answers_moderation_status (moderation_status);

ALTER TABLE pages
  ADD COLUMN moderation_status ENUM('pending','approved','suspended','deleted')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL DEFAULT 'approved'
    AFTER is_approved,
  ADD INDEX idx_pages_moderation_status (moderation_status);
