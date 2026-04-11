const { v4: uuidv4 } = require('uuid');

exports.seed = async function(knex) {
  // Useful for local dev: inserts a small set of deterministic records.
  const trx = await knex.transaction();
  try {
    await trx.raw('SET FOREIGN_KEY_CHECKS=0');

    // Fixed IDs (match earlier SQL-style seeds)
    const communityCat1 = '11111111-1111-1111-1111-111111111111';
    const communityCat2 = '22222222-2222-2222-2222-222222222222';
    const jobCat1 = '33333333-3333-3333-3333-333333333333';
    const jobCat2 = '44444444-4444-4444-4444-444444444444';
    const pageCat1 = '55555555-5555-5555-5555-555555555555';
    const pageCat2 = '66666666-6666-6666-6666-666666666666';

    const aliceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const bobId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const adminId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    // Profiles use fresh UUIDs to ensure valid 36-char ids
    const aliceProfileId = uuidv4();
    const bobProfileId = uuidv4();

    const communityId = 'd1111111-1111-1111-1111-111111111111';
    const pageId = 'pg-11111111-1111-1111-1111-111111111111';
    const postId = 'post-1111-1111-1111-111111111111';
    const pmId = 'pm-1111-1111-1111-111111111111';
    const assetId = 'asset-1111-1111-1111-111111111111';
    const jobId = 'job-1111-1111-1111-111111111111';
    const followerId = 'f-1111-1111-1111-111111111111';
    const userSkillId = 'us-1111-1111-1111-111111111111';

    // Insert categories
    await trx('community_categories').insert([
      { id: communityCat1, name: 'General' },
      { id: communityCat2, name: 'Development' }
    ]);

    await trx('job_categories').insert([
      { id: jobCat1, name: 'Engineering' },
      { id: jobCat2, name: 'Design' }
    ]);

    await trx('page_categories').insert([
      { id: pageCat1, name: 'Company', slug: 'company', description: 'Company pages', icon: 'building', is_active: 1 },
      { id: pageCat2, name: 'Project', slug: 'project', description: 'Project pages', icon: 'folder', is_active: 1 }
    ]);

    // Users
    await trx('users').insert([
      { id: aliceId, email: 'alice@example.test', password: 'password123', role: 'user', created_at: knex.fn.now(), updated_at: knex.fn.now() },
      { id: bobId, email: 'bob@example.test', password: 'password123', role: 'user', created_at: knex.fn.now(), updated_at: knex.fn.now() },
      { id: adminId, email: 'admin@example.test', password: 'adminpass', role: 'admin', created_at: knex.fn.now(), updated_at: knex.fn.now() }
    ]);

    // User profiles
    await trx('user_profiles').insert([
      { id: aliceProfileId, user_id: aliceId, username: 'alice', bio: 'I build stuff', location: 'City A', created_at: knex.fn.now(), updated_at: knex.fn.now() },
      { id: bobProfileId, user_id: bobId, username: 'bob', bio: 'Designer', location: 'City B', created_at: knex.fn.now(), updated_at: knex.fn.now() }
    ]);

    // Communities and members
    await trx('communities').insert([
      { id: communityId, category_id: communityCat1, name: 'General Dev', description: 'A community for all devs', is_active: 1, created_at: knex.fn.now() }
    ]);

    await trx('community_members').insert([
      { id: uuidv4(), user_id: aliceId, community_id: communityId, role: 'admin' },
      { id: uuidv4(), user_id: bobId, community_id: communityId, role: 'member' }
    ]);

    // Pages
    await trx('pages').insert([
      { id: pageId, owner_id: aliceId, category_id: pageCat1, name: 'Acme Inc', slug: 'acme-inc', description: 'Company page for Acme', created_at: knex.fn.now(), updated_at: knex.fn.now() }
    ]);

    // Posts & media
    await trx('posts').insert([
      { id: postId, user_id: aliceId, community_id: communityId, content: 'Hello world from Alice', title: 'First post', created_at: knex.fn.now() }
    ]);

    await trx('post_media').insert([
      { id: pmId, post_id: postId, media_type: 'image', url: 'https://example.test/sample.jpg', thumbnail_url: 'https://example.test/sample.jpg', display_order: 0, created_at: knex.fn.now() }
    ]);

    // User assets
    await trx('user_assets').insert([
      { id: assetId, user_id: aliceId, kind: 'avatar', provider: 'cloudinary', provider_public_id: 'public_1', url: 'https://res.cloudinary.com/demo/avatar1.jpg', mime_type: 'image/jpeg', size_bytes: 102400, created_at: knex.fn.now() }
    ]);

    // Jobs
    await trx('jobs').insert([
      { id: jobId, employer_id: bobId, category_id: jobCat1, title: 'Frontend Engineer', description: 'Build amazing UI', created_at: knex.fn.now() }
    ]);

    // Followers
    await trx('followers').insert([
      { id: followerId, follower_id: bobId, following_id: aliceId, created_at: knex.fn.now() }
    ]);

    // User skills
    await trx('user_skills').insert([
      { id: userSkillId, user_id: aliceId, skill: 'JavaScript', level: 'expert' }
    ]);

    // Simple items for items table
    await trx('items').insert([
      { name: 'Sample Item 1' },
      { name: 'Sample Item 2' }
    ]);

    await trx.raw('SET FOREIGN_KEY_CHECKS=1');
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
};
