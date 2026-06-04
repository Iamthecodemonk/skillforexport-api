CREATE TABLE IF NOT EXISTS legal_documents (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  content_type ENUM('html', 'markdown', 'plain_text') DEFAULT 'html',
  version VARCHAR(50) DEFAULT '1.0',
  status ENUM('draft', 'published', 'archived') DEFAULT 'published',
  effective_date DATE DEFAULT NULL,
  published_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_legal_documents_status (status),
  KEY idx_legal_documents_slug_status (slug, status)
);

INSERT INTO legal_documents (
  id,
  slug,
  title,
  content,
  content_type,
  version,
  status,
  effective_date,
  published_at,
  created_at,
  updated_at
) VALUES
  (UUID(), 'privacy-policy', 'Privacy Policy', '<p>Privacy policy content goes here.</p>', 'html', '1.0', 'published', CURDATE(), NOW(), NOW(), NOW()),
  (UUID(), 'cookie-policy', 'Cookie Policy', '<p>Cookie policy content goes here.</p>', 'html', '1.0', 'published', CURDATE(), NOW(), NOW(), NOW()),
  (UUID(), 'community-regulations', 'Community Regulations', '<p>Community regulations content goes here.</p>', 'html', '1.0', 'published', CURDATE(), NOW(), NOW(), NOW()),
  (UUID(), 'terms-of-service', 'Terms of Service', '<p>Terms of service content goes here.</p>', 'html', '1.0', 'published', CURDATE(), NOW(), NOW(), NOW())
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  updated_at = NOW();
