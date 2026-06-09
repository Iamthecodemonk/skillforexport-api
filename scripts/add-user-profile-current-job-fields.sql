ALTER TABLE user_profiles
  ADD COLUMN current_job_title VARCHAR(255)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL
    AFTER github,
  ADD COLUMN current_workspace VARCHAR(255)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    NULL
    AFTER current_job_title;
