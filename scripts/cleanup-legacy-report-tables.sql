-- Optional cleanup after moving admin moderation reports to generic_reports.
-- Run this only if you do not want old/test legacy reports to remain in the DB.

TRUNCATE TABLE post_reports;
TRUNCATE TABLE comment_reports;
