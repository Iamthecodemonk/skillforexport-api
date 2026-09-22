import db from '../../infrastructure/knexConfig.js';
import logger from '../../utils/logger.js';
import { sendError } from '../errorResponse.js';

const shareMetadataLogger = logger.child('SHARE_METADATA_CONTROLLER');

const TYPE_ALIASES = {
  posts: 'post',
  questions: 'question',
  jobs: 'job',
  freelance: 'freelance-job',
  freelancer: 'freelance-job',
  freelance_jobs: 'freelance-job',
  'freelance-jobs': 'freelance-job',
  pages: 'page',
  communities: 'community',
  users: 'user',
  profile: 'user',
  profiles: 'user'
};

const cleanText = (value, maxLength = 220) => {
  const text = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}...` : text;
};

const appBaseUrl = () => String(
  process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || process.env.WEB_URL || 'https://skills4export.com'
).replace(/\/$/, '');

const normalizeType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  return TYPE_ALIASES[type] || type;
};

const publicPath = (type, item) => {
  const key = item.slug || item.id;
  const paths = {
    post: `/posts/${key}`,
    question: `/questions/${key}`,
    job: `/jobs/${key}`,
    'freelance-job': `/freelance-jobs/${key}`,
    page: `/pages/${key}`,
    community: `/communities/${key}`,
    user: `/users/${key}`
  };
  return paths[type];
};

async function findShareable(type, id) {
  if (type === 'post') {
    return db('posts as p')
      .leftJoin('post_media as pm', function () {
        this.on('pm.post_id', '=', 'p.id').andOn('pm.display_order', '=', db.raw('?', [0]));
      })
      .leftJoin('user_profiles as up', 'up.user_id', 'p.user_id')
      .where('p.id', id)
      .where('p.visibility', 'public')
      .whereRaw("COALESCE(p.moderation_status, 'approved') NOT IN ('suspended', 'deleted')")
      .select('p.id', 'p.title', 'p.content as description', 'pm.url as image', 'up.display_name as author_name')
      .first();
  }
  if (type === 'question') {
    return db('questions as q')
      .leftJoin('user_profiles as up', 'up.user_id', 'q.user_id')
      .where('q.id', id)
      .whereIn('q.visibility', ['public', 'community_public'])
      .whereRaw("COALESCE(q.moderation_status, 'approved') NOT IN ('suspended', 'deleted')")
      .select('q.id', 'q.title', 'q.body as description', 'up.avatar as image', 'up.display_name as author_name')
      .first();
  }
  if (type === 'job') {
    return db('jobs').where((builder) => builder.where('id', id).orWhere('slug', id))
      .whereIn('status', ['live', 'approved', 'active'])
      .select('id', 'slug', 'title', 'description', 'company_name as author_name').first();
  }
  if (type === 'freelance-job') {
    return db('freelance_jobs').where((builder) => builder.where('id', id).orWhere('slug', id))
      .whereIn('status', ['live', 'approved', 'active'])
      .select('id', 'slug', 'title', 'description', 'company_name as author_name').first();
  }
  if (type === 'page') {
    return db('pages').where((builder) => builder.where('id', id).orWhere('slug', id))
      .where('is_active', 1)
      .select('id', 'slug', 'name as title', 'description', db.raw('COALESCE(cover_image, avatar) as image')).first();
  }
  if (type === 'community') {
    return db('communities').where((builder) => builder.where('id', id).orWhere('slug', id))
      .where('is_active', 1)
      .select('id', 'slug', 'name as title', 'description').first();
  }
  if (type === 'user') {
    return db('users as u').leftJoin('user_profiles as up', 'up.user_id', 'u.id')
      .where('u.id', id)
      .select('u.id', db.raw("COALESCE(NULLIF(up.display_name, ''), NULLIF(up.username, ''), 'Skills4Export member') as title"), 'up.bio as description', 'up.avatar as image')
      .first();
  }
  return null;
}

export function makeShareMetadataController() {
  return {
    getShareMetadata: async (req, reply) => {
      try {
        const type = normalizeType(req.params.type);
        const supported = ['post', 'question', 'job', 'freelance-job', 'page', 'community', 'user'];
        if (!supported.includes(type)) return sendError(reply, 422, 'unsupported_share_type', 'Unsupported share type');

        const item = await findShareable(type, req.params.id);
        if (!item) return sendError(reply, 404, 'shareable_not_found', 'Shared content was not found or is not public');

        const url = `${appBaseUrl()}${publicPath(type, item)}`;
        const title = cleanText(item.title || 'Skills4Export', 120);
        const description = cleanText(item.description || `View ${title} on Skills4Export`);
        const image = item.image || null;
        return reply.send({
          success: true,
          message: 'Share metadata fetched successfully',
          data: {
            type,
            id: item.id,
            title,
            description,
            image,
            url,
            canonicalUrl: url,
            authorName: item.author_name || null,
            siteName: 'Skills4Export',
            openGraph: { title, description, image, url, type: type === 'user' ? 'profile' : 'article', siteName: 'Skills4Export' },
            twitter: { card: image ? 'summary_large_image' : 'summary', title, description, image }
          }
        });
      } catch (err) {
        shareMetadataLogger.error('getShareMetadata failed', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    }
  };
}
