import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import db from '../../infrastructure/knexConfig.js';
import { rememberFeedResponse } from '../../utils/feedCache.js';
import MysqlPostRepository from '../../infrastructure/repositories/mysqlPostRepository.js';

const feedLogger = logger.child('FEED_CONTROLLER');

const firstDefined = (...values) => values.find(value => typeof value !== 'undefined' && value !== null && value !== '');

const nestedQueryValue = (query, group, key) => {
  if (!query) return undefined;
  if (query[group] && typeof query[group] === 'object') return query[group][key];
  return query[`${group}[${key}]`];
};

const timestamp = (item, field) => {
  const value = item && (item[field] || item[field.replace('_', '')] || item.created_at || item.createdAt);
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const sortableValue = (item, field) => {
  if (field === 'title') return String((item && item.title) || '').toLowerCase();
  if (field === 'updated_at') return timestamp(item, 'updated_at');
  if (field === 'score') return Number((item && item.score) || 0);
  if (field === 'comment_count') return Number((item && item.comment_count) || 0);
  return timestamp(item, 'created_at');
};

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const boolValue = (value) => value === true || value === 1 || value === '1';

const splitSkills = (value) => String(value || '')
  .split('||')
  .map((item) => item.trim())
  .filter(Boolean)
  .slice(0, 3);

const studentAuthorSelects = (ownerColumn) => [
  db.raw(`(SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.courseOfStudy')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.courseName')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.course_name')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.course'))) FROM pages sp WHERE sp.owner_id = ${ownerColumn} AND sp.page_type = 'student' AND COALESCE(sp.moderation_status, 'approved') <> 'deleted' ORDER BY sp.created_at ASC LIMIT 1) as author_course_name`),
  db.raw(`(SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.university')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.institution')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.institutionName')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.institution_name')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.school'))) FROM pages sp WHERE sp.owner_id = ${ownerColumn} AND sp.page_type = 'student' AND COALESCE(sp.moderation_status, 'approved') <> 'deleted' ORDER BY sp.created_at ASC LIMIT 1) as author_institution`),
  db.raw(`COALESCE(
    NULLIF(CONCAT_WS(' at ',
      NULLIF((SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.courseOfStudy')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.courseName'))) FROM pages sp WHERE sp.owner_id = ${ownerColumn} AND sp.page_type = 'student' AND COALESCE(sp.moderation_status, 'approved') <> 'deleted' ORDER BY sp.created_at ASC LIMIT 1), ''),
      NULLIF((SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.university')), JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.institution'))) FROM pages sp WHERE sp.owner_id = ${ownerColumn} AND sp.page_type = 'student' AND COALESCE(sp.moderation_status, 'approved') <> 'deleted' ORDER BY sp.created_at ASC LIMIT 1), '')
    ), ''),
    NULLIF(up.display_title, ''),
    NULLIF(CONCAT_WS(' at ', NULLIF(up.current_job_title, ''), NULLIF(up.current_workspace, '')), '')
  ) as author_display_title`)
];

const authorStudentFields = (row) => ({
  courseName: row.author_course_name || null,
  course_name: row.author_course_name || null,
  institution: row.author_institution || null,
  institutionName: row.author_institution || null,
  institution_name: row.author_institution || null,
  displayTitle: row.author_display_title || row.author_current_job_title || null,
  display_title: row.author_display_title || row.author_current_job_title || null
});

const mapMedia = (value) => parseJsonArray(value).map((item) => ({
  id: item.id || null,
  type: item.type || item.media_type || item.kind || null,
  url: item.url || null,
  thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || null,
  displayOrder: Number(item.displayOrder ?? item.display_order ?? 0)
}));

const compactSkills = (value) => {
  if (!Array.isArray(value)) return splitSkills(value);
  return value
    .map((item) => typeof item === 'string' ? item : item && (item.skill || item.name))
    .filter(Boolean)
    .slice(0, 3);
};

const compactCommunity = (row) => {
  const community = row.community || null;
  const id = community ? community.id : row.community_id;
  if (!id) return null;
  const visibility = community
    ? (community.default_post_visibility || community.defaultPostVisibility)
    : row.community_default_post_visibility;
  const joined = community
    ? firstDefined(community.is_joined, community.isJoined, community.is_following, community.isFollowing)
    : row.community_is_joined;
  const membersCount = community
    ? firstDefined(community.members_count, community.membersCount, 0)
    : row.community_members_count;
  return {
    id,
    name: community ? community.name || null : row.community_name || null,
    default_post_visibility: visibility || null,
    is_private: visibility === 'community' ? 1 : 0,
    isPrivate: visibility === 'community',
    members_count: Number(membersCount || 0),
    membersCount: Number(membersCount || 0),
    is_joined: boolValue(joined),
    isJoined: boolValue(joined),
    is_following: boolValue(joined),
    isFollowing: boolValue(joined)
  };
};

const compactPost = (row) => ({
  type: 'post',
  id: row.id,
  parent: row.parent || null,
  title: row.title,
  content: row.content,
  createdAt: row.created_at || row.createdAt,
  updatedAt: row.updated_at || row.updatedAt,
  score: Number(row.score || 0),
  commentsCount: Number(firstDefined(row.comments_count, row.comment_count, row.commentsCount, 0)),
  author: {
    id: row.user ? row.user.id : row.user_id,
    name: row.user ? row.user.name || null : row.author_name || null,
    username: row.user ? row.user.username || null : row.author_username || null,
    avatar: row.user ? (row.user.avatar || row.user.avatarUrl || null) : row.author_avatar || null,
    currentJobTitle: row.user ? firstDefined(row.user.currentJobTitle, row.user.current_job_title, null) : row.author_current_job_title || null,
    current_job_title: row.user ? firstDefined(row.user.current_job_title, row.user.currentJobTitle, null) : row.author_current_job_title || null,
    ...(row.user ? {
      courseName: firstDefined(row.user.courseName, row.user.course_name) || null,
      course_name: firstDefined(row.user.course_name, row.user.courseName) || null,
      institution: firstDefined(row.user.institution, row.user.institutionName, row.user.institution_name) || null,
      institutionName: firstDefined(row.user.institutionName, row.user.institution_name, row.user.institution) || null,
      institution_name: firstDefined(row.user.institution_name, row.user.institutionName, row.user.institution) || null,
      displayTitle: firstDefined(row.user.displayTitle, row.user.display_title, row.user.currentJobTitle, row.user.current_job_title, null),
      display_title: firstDefined(row.user.display_title, row.user.displayTitle, row.user.current_job_title, row.user.currentJobTitle, null)
    } : authorStudentFields(row)),
    skills: compactSkills(row.user ? row.user.skills : row.author_skills)
  },
  page: row.page || (row.page_id ? { id: row.page_id, name: row.page_name || null, avatar: row.page_avatar || null } : null),
  community: compactCommunity(row),
  media: row.media_path ? mapMedia(row.media_path) : mapMedia(row.media),
  is_follow: boolValue(firstDefined(row.is_follow, row.isFollow, row.is_following)),
  isFollow: boolValue(firstDefined(row.isFollow, row.is_follow, row.is_following)),
  is_followed: boolValue(firstDefined(row.is_followed, row.isFollowed, row.is_following)),
  isFollowed: boolValue(firstDefined(row.isFollowed, row.is_followed, row.is_following)),
  is_liked: boolValue(firstDefined(row.is_liked, row.isLiked, row.is_scored)),
  isLiked: boolValue(firstDefined(row.isLiked, row.is_liked, row.is_scored)),
  is_saved: boolValue(row.is_saved),
  isSaved: boolValue(row.is_saved),
  viewerState: {
    isFollowing: boolValue(firstDefined(row.is_follow, row.isFollow, row.is_following)),
    isScored: boolValue(firstDefined(row.is_liked, row.isLiked, row.is_scored)),
    isSaved: boolValue(row.is_saved)
  }
});

const compactQuestion = (row) => ({
  type: 'question',
  id: row.id,
  title: row.title,
  content: row.body || row.content,
  createdAt: row.created_at || row.createdAt,
  updatedAt: row.updated_at || row.updatedAt,
  score: Number(row.score || 0),
  answersCount: Number(firstDefined(row.answers_count, row.answersCount, row.totalAnswers, 0)),
  author: {
    id: row.user ? row.user.id : row.user_id,
    name: row.user ? row.user.name || null : row.author_name || null,
    username: row.user ? row.user.username || null : row.author_username || null,
    avatar: row.user ? (row.user.avatar || row.user.avatarUrl || null) : row.author_avatar || null,
    currentJobTitle: row.user ? firstDefined(row.user.currentJobTitle, row.user.current_job_title, null) : row.author_current_job_title || null,
    current_job_title: row.user ? firstDefined(row.user.current_job_title, row.user.currentJobTitle, null) : row.author_current_job_title || null,
    ...(row.user ? {
      courseName: firstDefined(row.user.courseName, row.user.course_name) || null,
      course_name: firstDefined(row.user.course_name, row.user.courseName) || null,
      institution: firstDefined(row.user.institution, row.user.institutionName, row.user.institution_name) || null,
      institutionName: firstDefined(row.user.institutionName, row.user.institution_name, row.user.institution) || null,
      institution_name: firstDefined(row.user.institution_name, row.user.institutionName, row.user.institution) || null,
      displayTitle: firstDefined(row.user.displayTitle, row.user.display_title, row.user.currentJobTitle, row.user.current_job_title, null),
      display_title: firstDefined(row.user.display_title, row.user.displayTitle, row.user.current_job_title, row.user.currentJobTitle, null)
    } : authorStudentFields(row)),
    skills: compactSkills(row.user ? row.user.skills : row.author_skills)
  },
  page: null,
  community: compactCommunity(row),
  media: [],
  is_follow: boolValue(firstDefined(row.is_follow, row.isFollow, row.is_following)),
  isFollow: boolValue(firstDefined(row.isFollow, row.is_follow, row.is_following)),
  is_followed: boolValue(firstDefined(row.is_followed, row.isFollowed, row.is_following)),
  isFollowed: boolValue(firstDefined(row.isFollowed, row.is_followed, row.is_following)),
  is_saved: boolValue(row.is_saved),
  isSaved: boolValue(row.is_saved),
  is_liked: boolValue(firstDefined(row.is_liked, row.isLiked, row.is_scored)),
  isLiked: boolValue(firstDefined(row.isLiked, row.is_liked, row.is_scored)),
  viewerState: {
    isFollowing: boolValue(firstDefined(row.is_follow, row.isFollow, row.is_following)),
    isScored: boolValue(firstDefined(row.is_liked, row.isLiked, row.is_scored)),
    isSaved: boolValue(row.is_saved)
  }
});

const applyCompactSearch = (query, alias, term, fields) => {
  if (!term) return;
  const like = `%${term}%`;
  query.andWhere((builder) => {
    for (const field of fields) builder.orWhere(`${alias}.${field}`, 'like', like);
  });
};

async function listCompactPosts({ actorId, limit, communityId = null, communitySlug = null, publicOnly = true, search = null } = {}) {
  const q = db('posts as p')
    .leftJoin('users as u', 'u.id', 'p.user_id')
    .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
    .leftJoin('communities as c', 'c.id', 'p.community_id')
    .leftJoin('pages as pg', 'pg.id', 'p.page_id')
    .select(
      'p.id',
      'p.user_id',
      'p.community_id',
      'p.page_id',
      'p.title',
      'p.content',
      'p.created_at',
      'p.updated_at',
      db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as author_name'),
      'up.username as author_username',
      'up.avatar as author_avatar',
      'up.current_job_title as author_current_job_title',
      ...studentAuthorSelects('p.user_id'),
      'c.name as community_name',
      'c.default_post_visibility as community_default_post_visibility',
      db.raw('(SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = p.community_id) as community_members_count'),
      'pg.name as page_name',
      'pg.avatar as page_avatar',
      db.raw(`IFNULL((
        SELECT GROUP_CONCAT(us.skill ORDER BY us.created_at DESC SEPARATOR '||')
        FROM user_skills us
        WHERE us.user_id = p.user_id
      ), '') as author_skills`),
      db.raw("(SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND COALESCE(cm.moderation_status, 'approved') NOT IN ('suspended','deleted')) as comments_count"),
      db.raw('(SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as score'),
      db.raw(`IFNULL((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pm.id, 'type', pm.media_type, 'url', pm.url, 'thumbnailUrl', pm.thumbnail_url, 'displayOrder', pm.display_order))
        FROM post_media pm
        WHERE pm.post_id = p.id
      ), JSON_ARRAY()) as media`)
    )
    .whereNotIn('p.moderation_status', ['suspended', 'deleted'])
    .limit(limit);

  if (communityId) q.where('p.community_id', communityId);
  else if (communitySlug) q.where('c.slug', communitySlug);
  else if (publicOnly) q.where('p.visibility', 'public');
  applyCompactSearch(q, 'p', search, ['title', 'content']);
  q.orderBy('p.created_at', 'desc');

  if (actorId) {
    q.select(
      db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id) as is_following', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_reactions pr2 WHERE pr2.user_id = ? AND pr2.post_id = p.id) as is_scored', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_saves ps WHERE ps.user_id = ? AND ps.post_id = p.id) as is_saved', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM community_members cmv WHERE cmv.user_id = ? AND cmv.community_id = p.community_id) as community_is_joined', [actorId])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_scored'), db.raw('false as is_saved'), db.raw('false as community_is_joined'));
  }

  return q;
}

export async function getCompactPostItem({ postId, actorId = null } = {}) {
  if (!postId) return null;
  const q = db('posts as p')
    .leftJoin('users as u', 'u.id', 'p.user_id')
    .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
    .leftJoin('communities as c', 'c.id', 'p.community_id')
    .leftJoin('pages as pg', 'pg.id', 'p.page_id')
    .select(
      'p.id',
      'p.user_id',
      'p.community_id',
      'p.page_id',
      'p.parent_post_id',
      'p.title',
      'p.content',
      'p.created_at',
      'p.updated_at',
      db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as author_name'),
      'up.username as author_username',
      'up.avatar as author_avatar',
      'up.current_job_title as author_current_job_title',
      ...studentAuthorSelects('p.user_id'),
      'c.name as community_name',
      'c.default_post_visibility as community_default_post_visibility',
      db.raw('(SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = p.community_id) as community_members_count'),
      'pg.name as page_name',
      'pg.avatar as page_avatar',
      db.raw(`IFNULL((
        SELECT GROUP_CONCAT(us.skill ORDER BY us.created_at DESC SEPARATOR '||')
        FROM user_skills us
        WHERE us.user_id = p.user_id
      ), '') as author_skills`),
      db.raw("(SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND COALESCE(cm.moderation_status, 'approved') NOT IN ('suspended','deleted')) as comments_count"),
      db.raw('(SELECT COUNT(*) FROM post_reactions pr WHERE pr.post_id = p.id) as score'),
      db.raw(`IFNULL((
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pm.id, 'type', pm.media_type, 'url', pm.url, 'thumbnailUrl', pm.thumbnail_url, 'displayOrder', pm.display_order))
        FROM post_media pm
        WHERE pm.post_id = p.id
      ), JSON_ARRAY()) as media`)
    )
    .where('p.id', postId)
    .whereNotIn('p.moderation_status', ['suspended', 'deleted']);

  if (actorId) {
    q.select(
      db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id) as is_following', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_reactions pr2 WHERE pr2.user_id = ? AND pr2.post_id = p.id) as is_scored', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_saves ps WHERE ps.user_id = ? AND ps.post_id = p.id) as is_saved', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM community_members cmv WHERE cmv.user_id = ? AND cmv.community_id = p.community_id) as community_is_joined', [actorId])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_scored'), db.raw('false as is_saved'), db.raw('false as community_is_joined'));
  }

  const row = await q.first();
  if (row && row.parent_post_id) {
    row.parent = await new MysqlPostRepository().findById(row.parent_post_id, { userId: actorId });
  }
  return row ? compactPost(row) : null;
}

async function listCompactQuestions({ actorId, limit, communityId = null, communitySlug = null, publicOnly = true, search = null } = {}) {
  const q = db('questions as q')
    .leftJoin('users as u', 'u.id', 'q.user_id')
    .leftJoin('user_profiles as up', 'up.user_id', 'u.id')
    .leftJoin('communities as c', 'c.id', 'q.community_id')
    .select(
      'q.id',
      'q.user_id',
      'q.community_id',
      'q.title',
      'q.body',
      'q.created_at',
      'q.updated_at',
      db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as author_name'),
      'up.username as author_username',
      'up.avatar as author_avatar',
      'up.current_job_title as author_current_job_title',
      ...studentAuthorSelects('q.user_id'),
      'c.name as community_name',
      'c.default_post_visibility as community_default_post_visibility',
      db.raw('(SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = q.community_id) as community_members_count'),
      db.raw(`IFNULL((
        SELECT GROUP_CONCAT(us.skill ORDER BY us.created_at DESC SEPARATOR '||')
        FROM user_skills us
        WHERE us.user_id = q.user_id
      ), '') as author_skills`),
      db.raw("(SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND COALESCE(a.moderation_status, 'approved') NOT IN ('suspended','deleted')) as answers_count"),
      db.raw('(SELECT COUNT(*) FROM question_reactions qr WHERE qr.question_id = q.id) as score')
    )
    .whereNotIn('q.moderation_status', ['suspended', 'deleted'])
    .limit(limit);

  if (communityId) q.where('q.community_id', communityId);
  else if (communitySlug) q.where('c.slug', communitySlug);
  else if (publicOnly) q.whereIn('q.visibility', ['public', 'community_public']);
  applyCompactSearch(q, 'q', search, ['title', 'body']);
  q.orderBy('q.created_at', 'desc');

  if (actorId) {
    q.select(
      db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = q.user_id) as is_following', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM question_reactions qr2 WHERE qr2.user_id = ? AND qr2.question_id = q.id) as is_scored', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM saved_items si WHERE si.user_id = ? AND si.target_id = q.id AND si.target_type = ?) as is_saved', [actorId, 'question']),
      db.raw('EXISTS(SELECT 1 FROM community_members cmv WHERE cmv.user_id = ? AND cmv.community_id = q.community_id) as community_is_joined', [actorId])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_scored'), db.raw('false as is_saved'), db.raw('false as community_is_joined'));
  }

  return q;
}

async function countCompactPosts({ communityId = null, communitySlug = null, publicOnly = true, search = null } = {}) {
  const q = db('posts as p')
    .leftJoin('communities as c', 'c.id', 'p.community_id')
    .count({ cnt: 'p.id' })
    .whereNotIn('p.moderation_status', ['suspended', 'deleted']);
  if (communityId) q.where('p.community_id', communityId);
  else if (communitySlug) q.where('c.slug', communitySlug);
  else if (publicOnly) q.where('p.visibility', 'public');
  applyCompactSearch(q, 'p', search, ['title', 'content']);
  const row = await q.first();
  return Number((row && (row.cnt || Object.values(row)[0])) || 0);
}

async function countCompactQuestions({ communityId = null, communitySlug = null, publicOnly = true, search = null } = {}) {
  const q = db('questions as q')
    .leftJoin('communities as c', 'c.id', 'q.community_id')
    .count({ cnt: 'q.id' })
    .whereNotIn('q.moderation_status', ['suspended', 'deleted']);
  if (communityId) q.where('q.community_id', communityId);
  else if (communitySlug) q.where('c.slug', communitySlug);
  else if (publicOnly) q.whereIn('q.visibility', ['public', 'community_public']);
  applyCompactSearch(q, 'q', search, ['title', 'body']);
  const row = await q.first();
  return Number((row && (row.cnt || Object.values(row)[0])) || 0);
}

const compactSortValue = (item, mode) => {
  if (mode === 'popular') return Number(item.score || item.commentsCount || item.answersCount || 0);
  return new Date(item.createdAt || 0).getTime() || 0;
};

export function makeFeedController({ postUseCase = null, questionUseCase = null }) {
  if (!postUseCase || !questionUseCase) {
    feedLogger.error('makeFeedController requires postUseCase and questionUseCase');
    throw new Error('useCase_required');
  }

  return {
    listCompactFeed: async (req, reply) => {
      try {
        const { page, perPage, limit, offset } = parsePagination(req.query, 10);
        const query = req.query || {};
        const actorId = req.user && req.user.id;
        const mode = String(query.mode || 'latest').toLowerCase() === 'popular' ? 'popular' : 'latest';
        const communityId = firstDefined(
          query.communityId,
          query.community_id,
          nestedQueryValue(query, 'filters', 'community_id'),
          nestedQueryValue(query, 'filters', 'communityId')
        ) || null;
        const communitySlug = firstDefined(
          query.communitySlug,
          query.community_slug,
          nestedQueryValue(query, 'filters', 'community_slug'),
          nestedQueryValue(query, 'filters', 'communitySlug')
        ) || null;
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const publicOnly = !(communityId || communitySlug);
        const fetchLimit = Math.min(Math.max(limit + offset, limit * 3), 100);
        const communityScope = communityId || communitySlug || 'public';
        const response = await rememberFeedResponse(req, {
          namespace: 'compact',
          identity: { actorId: actorId || 'guest', mode, communityScope, search, page, perPage }
        }, async () => {
          const [postRows, questionRows] = await Promise.all([
            postUseCase.ListPosts({ limit: fetchLimit, offset: 0, userId: actorId || null, communityId, communitySlug, publicOnly, search, sortField: mode === 'popular' ? 'score' : 'created_at', sortDirection: 'desc', includeTotal: true }),
            questionUseCase.listQuestions({ limit: fetchLimit, offset: 0, communityId, communitySlug, publicOnly, search, sortField: 'created_at', sortDirection: 'desc', actorId: actorId || null, includeTotal: true })
          ]);
          const data = [...(postRows || []).map(compactPost), ...(questionRows || []).map(compactQuestion)]
            .sort((a, b) => {
              const diff = compactSortValue(b, mode) - compactSortValue(a, mode);
              if (diff !== 0) return diff;
              return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
            })
            .slice(offset, offset + limit);
          return buildPaginatedResponse(req, {
            data,
            page,
            perPage,
            total: Number(postRows && postRows.total || 0) + Number(questionRows && questionRows.total || 0)
          });
        });

        return reply.send(response);
      } catch (err) {
        feedLogger.error('listCompactFeed error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    },

    listFeeds: async (req, reply) => {
      try {
        const { page, perPage, limit, offset } = parsePagination(req.query, 20);
        const query = req.query || {};
        const actorId = req.user && req.user.id;
        const communityId = firstDefined(
          query.communityId,
          query.community_id,
          nestedQueryValue(query, 'filters', 'community_id'),
          nestedQueryValue(query, 'filters', 'communityId')
        ) || null;
        const communitySlug = firstDefined(
          query.communitySlug,
          query.community_slug,
          nestedQueryValue(query, 'filters', 'community_slug'),
          nestedQueryValue(query, 'filters', 'communitySlug')
        ) || null;
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const sortField = firstDefined(query.sortField, query.sort_field, nestedQueryValue(query, 'sort', 'field')) || 'created_at';
        const sortDirection = String(firstDefined(query.sortDirection, query.sort_direction, nestedQueryValue(query, 'sort', 'direction')) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const publicOnly = !(communityId || communitySlug);
        const fetchLimit = limit + offset;

        const response = await rememberFeedResponse(req, {
          namespace: 'full',
          identity: { actorId: actorId || 'guest', communityId, communitySlug, search, sortField, sortDirection, page, perPage }
        }, async () => {
          const [posts, questions] = await Promise.all([
            postUseCase.ListPosts({ limit: fetchLimit, offset: 0, userId: actorId || null, communityId, communitySlug, publicOnly, search, sortField, sortDirection, includeTotal: true }),
            questionUseCase.listQuestions({ limit: fetchLimit, offset: 0, communityId, communitySlug, publicOnly, search, sortField, sortDirection, actorId: actorId || null, includeTotal: true })
          ]);
          const direction = sortDirection === 'asc' ? 1 : -1;
          const data = [...(posts || []), ...(questions || [])]
            .sort((a, b) => {
              const av = sortableValue(a, sortField);
              const bv = sortableValue(b, sortField);
              if (av < bv) return -1 * direction;
              if (av > bv) return 1 * direction;
              return String(a.id || '').localeCompare(String(b.id || '')) * direction;
            })
            .slice(offset, offset + limit);
          return buildPaginatedResponse(req, {
            data,
            page,
            perPage,
            total: Number(posts && posts.total || 0) + Number(questions && questions.total || 0)
          });
        });
        return reply.send(response);
      } catch (err) {
        feedLogger.error('listFeeds error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
