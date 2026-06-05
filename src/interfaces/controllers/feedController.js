import logger from '../../utils/logger.js';
import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';

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

export function makeFeedController({ postUseCase = null, questionUseCase = null }) {
  if (!postUseCase || !questionUseCase) {
    feedLogger.error('makeFeedController requires postUseCase and questionUseCase');
    throw new Error('useCase_required');
  }

  return {
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
          questionUseCase.listQuestions({ limit: fetchLimit, offset: 0, communityId, publicOnly, search, sortField, sortDirection }),
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
