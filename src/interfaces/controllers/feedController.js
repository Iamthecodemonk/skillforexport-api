import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import db from '../../infrastructure/knexConfig.js';

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

const mapMedia = (value) => parseJsonArray(value).map((item) => ({
  id: item.id || null,
  type: item.type || item.media_type || item.kind || null,
  url: item.url || null,
  thumbnailUrl: item.thumbnailUrl || item.thumbnail_url || null,
  displayOrder: Number(item.displayOrder ?? item.display_order ?? 0)
}));

const compactPost = (row) => ({
  type: 'post',
  id: row.id,
  title: row.title,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  score: Number(row.score || 0),
  commentsCount: Number(row.comments_count || 0),
  author: {
    id: row.user_id,
    name: row.author_name || null,
    username: row.author_username || null,
    avatar: row.author_avatar || null,
    skills: splitSkills(row.author_skills)
  },
  page: row.page_id ? {
    id: row.page_id,
    name: row.page_name || null,
    avatar: row.page_avatar || null
  } : null,
  community: row.community_id ? {
    id: row.community_id,
    name: row.community_name || null
  } : null,
  media: mapMedia(row.media),
  is_liked: boolValue(row.is_scored),
  isLiked: boolValue(row.is_scored),
  is_saved: boolValue(row.is_saved),
  isSaved: boolValue(row.is_saved),
  viewerState: {
    isFollowing: boolValue(row.is_following),
    isScored: boolValue(row.is_scored),
    isSaved: boolValue(row.is_saved)
  }
});

const compactQuestion = (row) => ({
  type: 'question',
  id: row.id,
  title: row.title,
  content: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  score: 0,
  answersCount: Number(row.answers_count || 0),
  author: {
    id: row.user_id,
    name: row.author_name || null,
    username: row.author_username || null,
    avatar: row.author_avatar || null,
    skills: splitSkills(row.author_skills)
  },
  page: null,
  community: row.community_id ? {
    id: row.community_id,
    name: row.community_name || null
  } : null,
  media: [],
  viewerState: {
    isFollowing: boolValue(row.is_following),
    isScored: false,
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

async function listCompactPosts({ actorId, limit, communityId = null, publicOnly = true, search = null } = {}) {
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
      'c.name as community_name',
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
  else if (publicOnly) q.where('p.visibility', 'public');
  applyCompactSearch(q, 'p', search, ['title', 'content']);
  q.orderBy('p.created_at', 'desc');

  if (actorId) {
    q.select(
      db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = p.user_id) as is_following', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_reactions pr2 WHERE pr2.user_id = ? AND pr2.post_id = p.id) as is_scored', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM post_saves ps WHERE ps.user_id = ? AND ps.post_id = p.id) as is_saved', [actorId])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_scored'), db.raw('false as is_saved'));
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
      'p.title',
      'p.content',
      'p.created_at',
      'p.updated_at',
      db.raw('COALESCE(NULLIF(up.display_name, \'\'), NULLIF(up.username, \'\'), u.email) as author_name'),
      'up.username as author_username',
      'up.avatar as author_avatar',
      'c.name as community_name',
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
      db.raw('EXISTS(SELECT 1 FROM post_saves ps WHERE ps.user_id = ? AND ps.post_id = p.id) as is_saved', [actorId])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_scored'), db.raw('false as is_saved'));
  }

  const row = await q.first();
  return row ? compactPost(row) : null;
}

async function listCompactQuestions({ actorId, limit, communityId = null, publicOnly = true, search = null } = {}) {
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
      'c.name as community_name',
      db.raw(`IFNULL((
        SELECT GROUP_CONCAT(us.skill ORDER BY us.created_at DESC SEPARATOR '||')
        FROM user_skills us
        WHERE us.user_id = q.user_id
      ), '') as author_skills`),
      db.raw("(SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id AND COALESCE(a.moderation_status, 'approved') NOT IN ('suspended','deleted')) as answers_count")
    )
    .whereNotIn('q.moderation_status', ['suspended', 'deleted'])
    .limit(limit);

  if (communityId) q.where('q.community_id', communityId);
  else if (publicOnly) q.whereIn('q.visibility', ['public', 'community_public']);
  applyCompactSearch(q, 'q', search, ['title', 'body']);
  q.orderBy('q.created_at', 'desc');

  if (actorId) {
    q.select(
      db.raw('EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = ? AND f.following_id = q.user_id) as is_following', [actorId]),
      db.raw('EXISTS(SELECT 1 FROM saved_items si WHERE si.user_id = ? AND si.target_id = q.id AND si.target_type = ?) as is_saved', [actorId, 'question'])
    );
  } else {
    q.select(db.raw('false as is_following'), db.raw('false as is_saved'));
  }

  return q;
}

async function countCompactPosts({ communityId = null, publicOnly = true, search = null } = {}) {
  const q = db('posts as p').count({ cnt: 'p.id' }).whereNotIn('p.moderation_status', ['suspended', 'deleted']);
  if (communityId) q.where('p.community_id', communityId);
  else if (publicOnly) q.where('p.visibility', 'public');
  applyCompactSearch(q, 'p', search, ['title', 'content']);
  const row = await q.first();
  return Number((row && (row.cnt || Object.values(row)[0])) || 0);
}

async function countCompactQuestions({ communityId = null, publicOnly = true, search = null } = {}) {
  const q = db('questions as q').count({ cnt: 'q.id' }).whereNotIn('q.moderation_status', ['suspended', 'deleted']);
  if (communityId) q.where('q.community_id', communityId);
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
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const publicOnly = !communityId;
        const fetchLimit = Math.min(Math.max(limit + offset, limit * 3), 100);
        const redis = req.server && (req.server.redisManager || req.server.redisClient);
        const cacheKey = `feed:compact:${actorId || 'guest'}:${mode}:${communityId || 'public'}:${search || ''}:${page}:${perPage}`;

        if (redis && typeof redis.getJson === 'function') {
          const cached = await redis.getJson(cacheKey);
          if (cached) return reply.send(cached);
        } else if (redis && typeof redis.get === 'function') {
          const cached = await redis.get(cacheKey);
          if (cached) {
            try { return reply.send(JSON.parse(cached)); } catch (_) { /* ignore invalid cache */ }
          }
        }

        const [postRows, questionRows, postTotal, questionTotal] = await Promise.all([
          listCompactPosts({ actorId, limit: fetchLimit, communityId, publicOnly, search }),
          listCompactQuestions({ actorId, limit: fetchLimit, communityId, publicOnly, search }),
          countCompactPosts({ communityId, publicOnly, search }),
          countCompactQuestions({ communityId, publicOnly, search })
        ]);

        const data = [
          ...(postRows || []).map(compactPost),
          ...(questionRows || []).map(compactQuestion)
        ]
          .sort((a, b) => {
            const diff = compactSortValue(b, mode) - compactSortValue(a, mode);
            if (diff !== 0) return diff;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          })
          .slice(offset, offset + limit);

        const response = buildPaginatedResponse(req, {
          data,
          page,
          perPage,
          total: Number(postTotal || 0) + Number(questionTotal || 0)
        });

        if (redis && typeof redis.setJson === 'function') {
          await redis.setJson(cacheKey, response, { EX: 20 });
        } else if (redis && typeof redis.set === 'function') {
          await redis.set(cacheKey, JSON.stringify(response), 'EX', 20);
        }

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
        const search = firstDefined(query.q, query.search, nestedQueryValue(query, 'filters', 'search')) || null;
        const sortField = firstDefined(query.sortField, query.sort_field, nestedQueryValue(query, 'sort', 'field')) || 'created_at';
        const sortDirection = String(firstDefined(query.sortDirection, query.sort_direction, nestedQueryValue(query, 'sort', 'direction')) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
        const publicOnly = !communityId;
        const fetchLimit = limit + offset;

        const [posts, questions, postTotal, questionTotal] = await Promise.all([
          postUseCase.ListPosts({ limit: fetchLimit, offset: 0, userId: actorId || null, communityId, publicOnly, search, sortField, sortDirection }),
          questionUseCase.listQuestions({ limit: fetchLimit, offset: 0, communityId, publicOnly, search, sortField, sortDirection, actorId: actorId || null }),
          postUseCase.postRepository && typeof postUseCase.postRepository.countAll === 'function'
            ? postUseCase.postRepository.countAll({ communityId, publicOnly, search })
            : Promise.resolve(0),
          questionUseCase.questionRepository && typeof questionUseCase.questionRepository.countAll === 'function'
            ? questionUseCase.questionRepository.countAll({ communityId, publicOnly, search })
            : Promise.resolve(0)
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

        return reply.send(buildPaginatedResponse(req, {
          data,
          page,
          perPage,
          total: Number(postTotal || 0) + Number(questionTotal || 0)
        }));
      } catch (err) {
        feedLogger.error('listFeeds error', { message: err.message, stack: err.stack });
        return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
      }
    }
  };
}
