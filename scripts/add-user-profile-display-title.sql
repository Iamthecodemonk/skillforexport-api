SET @has_display_title := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_profiles'
    AND COLUMN_NAME = 'display_title'
);

SET @add_display_title_sql := IF(
  @has_display_title = 0,
  'ALTER TABLE user_profiles ADD COLUMN display_title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER display_name',
  'SELECT ''user_profiles.display_title already exists'' AS message'
);

PREPARE add_display_title_stmt FROM @add_display_title_sql;
EXECUTE add_display_title_stmt;
DEALLOCATE PREPARE add_display_title_stmt;
