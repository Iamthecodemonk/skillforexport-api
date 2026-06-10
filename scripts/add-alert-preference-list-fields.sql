SET @has_sales_alert := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'alert_preferences'
    AND COLUMN_NAME = 'sales_alert'
);

SET @add_sales_alert_sql := IF(
  @has_sales_alert = 0,
  'ALTER TABLE alert_preferences ADD COLUMN sales_alert TINYINT(1) DEFAULT 0 AFTER sponsorship_alert',
  'SELECT ''alert_preferences.sales_alert already exists'' AS message'
);

PREPARE add_sales_alert_stmt FROM @add_sales_alert_sql;
EXECUTE add_sales_alert_stmt;
DEALLOCATE PREPARE add_sales_alert_stmt;

SET @has_scholarship_types := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'alert_preferences'
    AND COLUMN_NAME = 'scholarship_types'
);

SET @add_scholarship_types_sql := IF(
  @has_scholarship_types = 0,
  'ALTER TABLE alert_preferences ADD COLUMN scholarship_types JSON NULL AFTER scholarship_type',
  'SELECT ''alert_preferences.scholarship_types already exists'' AS message'
);

PREPARE add_scholarship_types_stmt FROM @add_scholarship_types_sql;
EXECUTE add_scholarship_types_stmt;
DEALLOCATE PREPARE add_scholarship_types_stmt;

SET @has_employment_types := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'alert_preferences'
    AND COLUMN_NAME = 'employment_types'
);

SET @add_employment_types_sql := IF(
  @has_employment_types = 0,
  'ALTER TABLE alert_preferences ADD COLUMN employment_types JSON NULL AFTER job_search_tags',
  'SELECT ''alert_preferences.employment_types already exists'' AS message'
);

PREPARE add_employment_types_stmt FROM @add_employment_types_sql;
EXECUTE add_employment_types_stmt;
DEALLOCATE PREPARE add_employment_types_stmt;

SET @has_experience_levels := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'alert_preferences'
    AND COLUMN_NAME = 'experience_levels'
);

SET @add_experience_levels_sql := IF(
  @has_experience_levels = 0,
  'ALTER TABLE alert_preferences ADD COLUMN experience_levels JSON NULL AFTER employment_types',
  'SELECT ''alert_preferences.experience_levels already exists'' AS message'
);

PREPARE add_experience_levels_stmt FROM @add_experience_levels_sql;
EXECUTE add_experience_levels_stmt;
DEALLOCATE PREPARE add_experience_levels_stmt;

UPDATE alert_preferences
SET scholarship_types = JSON_ARRAY(scholarship_type)
WHERE scholarship_type IS NOT NULL
  AND scholarship_type <> ''
  AND scholarship_types IS NULL;
