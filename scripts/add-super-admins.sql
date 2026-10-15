-- Run once before using /api/admin/users. Replace the email below with an existing admin.
CREATE TABLE IF NOT EXISTS super_admins (
  user_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
  granted_by CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @first_super_admin_email = 'superadmin@skillsforexport.com';
INSERT INTO super_admins (user_id, granted_by)
SELECT id, NULL FROM users
WHERE BINARY email = BINARY @first_super_admin_email AND role = 'admin'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

SELECT u.id, u.email, u.role
FROM users u JOIN super_admins sa ON BINARY sa.user_id = BINARY u.id
WHERE BINARY u.email = BINARY @first_super_admin_email;
