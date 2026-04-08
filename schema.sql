CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  email_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User OTPs table
CREATE TABLE IF NOT EXISTS user_otps (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  purpose ENUM('login', 'email_verification', 'password_reset', 'two_factor', 'registration') DEFAULT 'login',
  is_used BOOLEAN DEFAULT FALSE,
  temp_password_hash VARCHAR(255) NULL,
  temp_profile_full_name VARCHAR(255) NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_expires_at (expires_at),
  INDEX idx_otp_code (otp_code),
  INDEX idx_user_unused (user_id, purpose, is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  post_id CHAR(36),
  user_id CHAR(36),
  content TEXT,
  created_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Community Categories table
CREATE TABLE IF NOT EXISTS community_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Communities table
CREATE TABLE IF NOT EXISTS communities (
  id CHAR(36) NOT NULL PRIMARY KEY,
  category_id CHAR(36),
  name VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NULL,
  FOREIGN KEY (category_id) REFERENCES community_categories(id) ON DELETE SET NULL,
  INDEX idx_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Community Members table
CREATE TABLE IF NOT EXISTS community_members (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  community_id CHAR(36),
  role ENUM('member', 'admin'),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL,
  INDEX idx_community_id (community_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Followers table
CREATE TABLE IF NOT EXISTS followers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  follower_id CHAR(36),
  following_id CHAR(36),
  created_at TIMESTAMP NULL,
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_follower_id (follower_id),
  INDEX idx_following_id (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job Categories table
CREATE TABLE IF NOT EXISTS job_categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  employer_id CHAR(36),
  category_id CHAR(36),
  title VARCHAR(255),
  description TEXT,
  salary_min DECIMAL(15, 2),
  salary_max DECIMAL(15, 2),
  location VARCHAR(255),
  type ENUM('full-time', 'part-time', 'remote'),
  created_at TIMESTAMP NULL,
  FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES job_categories(id) ON DELETE SET NULL,
  INDEX idx_category_id (category_id),
  INDEX idx_employer_id (employer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Job Applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  job_id CHAR(36),
  user_id CHAR(36),
  resume VARCHAR(255),
  status ENUM('pending', 'accepted', 'rejected'),
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_job_id (job_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gigs table
CREATE TABLE IF NOT EXISTS gigs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  title VARCHAR(255),
  description TEXT,
  price DECIMAL(15, 2),
  delivery_time INT,
  created_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gig Orders table
CREATE TABLE IF NOT EXISTS gig_orders (
  id CHAR(36) NOT NULL PRIMARY KEY,
  gig_id CHAR(36),
  buyer_id CHAR(36),
  status ENUM('pending', 'in_progress', 'completed', 'cancelled'),
  FOREIGN KEY (gig_id) REFERENCES gigs(id) ON DELETE SET NULL,
  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_buyer_id (buyer_id),
  INDEX idx_gig_id (gig_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gig Reviews table
CREATE TABLE IF NOT EXISTS gig_reviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  order_id CHAR(36),
  rating INT,
  comment TEXT,
  FOREIGN KEY (order_id) REFERENCES gig_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  type VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  community_id CHAR(36),
  content TEXT,
  created_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL,
  INDEX idx_community_id (community_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  post_id CHAR(36),
  type ENUM('like', 'love', 'clap'),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_post_id (post_id),
  UNIQUE KEY uk_user_post (user_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Certifications table
CREATE TABLE IF NOT EXISTS user_certifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  name VARCHAR(255),
  issuer VARCHAR(255),
  issue_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Education table
CREATE TABLE IF NOT EXISTS user_education (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  school VARCHAR(255),
  degree VARCHAR(255),
  field VARCHAR(255),
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Experiences table
CREATE TABLE IF NOT EXISTS user_experiences (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  company VARCHAR(255),
  title VARCHAR(255),
  employment_type VARCHAR(100),
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Login History table
CREATE TABLE IF NOT EXISTS user_login_history (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  login_method ENUM('email_password', 'google_oauth', 'otp') NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_login (user_id, login_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User OAuth Accounts table
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(255),
  avatar_url VARCHAR(500),
  raw_data JSON,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_provider_provider_id (provider, provider_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Portfolios table
CREATE TABLE IF NOT EXISTS user_portfolios (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  title VARCHAR(255),
  description TEXT,
  link VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  full_name VARCHAR(255),
  username VARCHAR(255) UNIQUE,
  bio TEXT,
  location VARCHAR(255),
  avatar VARCHAR(255),
  banner VARCHAR(255),
  website VARCHAR(255),
  linkedin VARCHAR(255),
  github VARCHAR(255),
  created_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Assets table (stores uploaded files, avatars, documents, etc.)
CREATE TABLE IF NOT EXISTS user_assets (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  kind ENUM('avatar','image','video','document','other') DEFAULT 'other',
  provider VARCHAR(50) DEFAULT 'cloudinary',
  provider_public_id VARCHAR(255),
  url VARCHAR(1024),
  mime_type VARCHAR(255),
  size_bytes BIGINT,
  metadata JSON,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_assets_user_id (user_id),
  INDEX idx_provider_public_id (provider_public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Skills table
CREATE TABLE IF NOT EXISTS user_skills (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36),
  skill VARCHAR(255),
  level ENUM('beginner', 'intermediate', 'expert'),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
