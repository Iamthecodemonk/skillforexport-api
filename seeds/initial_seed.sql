-- seeds/initial_seed.sql
-- Sample seed data for local testing

SET FOREIGN_KEY_CHECKS=0;

-- community categories
INSERT INTO community_categories (id, name) VALUES
('11111111-1111-1111-1111-111111111111', 'General'),
('22222222-2222-2222-2222-222222222222', 'Development');

-- job categories
INSERT INTO job_categories (id, name) VALUES
('33333333-3333-3333-3333-333333333333', 'Engineering'),
('44444444-4444-4444-4444-444444444444', 'Design');

-- page categories
INSERT INTO page_categories (id, name, slug, description, icon, is_active) VALUES
('55555555-5555-5555-5555-555555555555', 'Company', 'company', 'Company pages', 'building', 1),
('66666666-6666-6666-6666-666666666666', 'Project', 'project', 'Project pages', 'folder', 1);

-- users
INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice@example.test', 'password123', 'user', NOW(), NOW()),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob@example.test', 'password123', 'user', NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin@example.test', 'adminpass', 'admin', NOW(), NOW());

-- user_profiles
INSERT INTO user_profiles (id, user_id, username, bio, location, created_at, updated_at) VALUES
('p-aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alice', 'I build stuff', 'City A', NOW(), NOW()),
('p-bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bob', 'Designer', 'City B', NOW(), NOW());

-- communities
INSERT INTO communities (id, category_id, name, description, is_active, created_at) VALUES
('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'General Dev', 'A community for all devs', 1, NOW());

-- community_members
INSERT INTO community_members (id, user_id, community_id, role) VALUES
('cm-aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d1111111-1111-1111-1111-111111111111','admin'),
('cm-bbbbbbbb-0000-0000-0000-000000000002','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','d1111111-1111-1111-1111-111111111111','member');

-- pages
INSERT INTO pages (id, owner_id, category_id, name, slug, description, created_at, updated_at) VALUES
('pg-11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','55555555-5555-5555-5555-555555555555','Acme Inc','acme-inc','Company page for Acme',NOW(),NOW());

-- posts
INSERT INTO posts (id, user_id, community_id, content, title, created_at) VALUES
('post-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','d1111111-1111-1111-1111-111111111111','Hello world from Alice','First post',NOW());

-- post_media
INSERT INTO post_media (id, post_id, media_type, url, thumbnail_url, display_order, created_at) VALUES
('pm-1111-1111-1111-111111111111','post-1111-1111-1111-111111111111','image','https://example.test/sample.jpg','https://example.test/sample.jpg',0,NOW());

-- user_assets
INSERT INTO user_assets (id, user_id, kind, provider, provider_public_id, url, mime_type, size_bytes, created_at) VALUES
('asset-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','avatar','cloudinary','public_1','https://res.cloudinary.com/demo/avatar1.jpg','image/jpeg',102400,NOW());

-- jobs
INSERT INTO jobs (id, employer_id, category_id, title, description, created_at) VALUES
('job-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','33333333-3333-3333-3333-333333333333','Frontend Engineer','Build amazing UI',NOW());

-- followers
INSERT INTO followers (id, follower_id, following_id, created_at) VALUES
('f-1111-1111-1111-111111111111','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',NOW());

-- user_skills
INSERT INTO user_skills (id, user_id, skill, level) VALUES
('us-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','JavaScript','expert');

-- simple items table (for testing)
INSERT INTO items (name) VALUES ('Sample Item 1'), ('Sample Item 2');

SET FOREIGN_KEY_CHECKS=1;

-- End of seed
