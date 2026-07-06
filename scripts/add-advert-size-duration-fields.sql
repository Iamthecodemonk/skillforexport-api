-- Adds advert size/hour fields while keeping existing advert_sites/adverts compatibility.

SET @has_advert_site_size_label := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'advert_sites'
    AND COLUMN_NAME = 'size_label'
);

SET @sql := IF(
  @has_advert_site_size_label = 0,
  'ALTER TABLE advert_sites ADD COLUMN size_label VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER name',
  'SELECT ''advert_sites.size_label already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE advert_sites
SET size_label = name
WHERE size_label IS NULL OR size_label = '';

SET @has_advert_duration_hours := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'adverts'
    AND COLUMN_NAME = 'duration_hours'
);

SET @sql := IF(
  @has_advert_duration_hours = 0,
  'ALTER TABLE adverts ADD COLUMN duration_hours INT NULL AFTER duration_days',
  'SELECT ''adverts.duration_hours already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE adverts
SET duration_hours = duration_days * 24
WHERE duration_hours IS NULL
  AND duration_days IS NOT NULL;

SET @has_advert_sites_size_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'advert_sites'
    AND INDEX_NAME = 'idx_advert_sites_size_status'
);

SET @sql := IF(
  @has_advert_sites_size_index = 0,
  'ALTER TABLE advert_sites ADD INDEX idx_advert_sites_size_status (size_label, status)',
  'SELECT ''idx_advert_sites_size_status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
