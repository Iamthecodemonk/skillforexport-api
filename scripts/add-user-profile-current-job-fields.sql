SET @has_current_job_title := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_profiles'
    AND COLUMN_NAME = 'current_job_title'
);

SET @add_current_job_title_sql := IF(
  @has_current_job_title = 0,
  'ALTER TABLE user_profiles ADD COLUMN current_job_title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER github',
  'SELECT ''user_profiles.current_job_title already exists'' AS message'
);

PREPARE add_current_job_title_stmt FROM @add_current_job_title_sql;
EXECUTE add_current_job_title_stmt;
DEALLOCATE PREPARE add_current_job_title_stmt;

SET @has_current_workspace := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_profiles'
    AND COLUMN_NAME = 'current_workspace'
);

SET @add_current_workspace_sql := IF(
  @has_current_workspace = 0,
  'ALTER TABLE user_profiles ADD COLUMN current_workspace VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER current_job_title',
  'SELECT ''user_profiles.current_workspace already exists'' AS message'
);

PREPARE add_current_workspace_stmt FROM @add_current_workspace_sql;
EXECUTE add_current_workspace_stmt;
DEALLOCATE PREPARE add_current_workspace_stmt;
