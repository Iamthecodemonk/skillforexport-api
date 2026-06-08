-- Normalize generic_reports string columns so report filtering does not fail with
-- "Illegal mix of collations" when MySQL compares target_id/target_type values.

ALTER TABLE generic_reports
  CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE generic_reports
  MODIFY target_id VARCHAR(191)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL;

ALTER TABLE generic_reports
  MODIFY target_type ENUM('post','question','answer','comment','page','job')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NOT NULL;

ALTER TABLE generic_reports
  MODIFY reason VARCHAR(255)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL;

ALTER TABLE generic_reports
  MODIFY details TEXT
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL;
