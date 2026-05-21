import { buildPaginatedResponse, parsePagination } from '../paginationResponse.js';
import { sendError } from '../errorResponse.js';
import logger from '../../utils/logger.js';

const notificationLogger = logger.child('NOTIFICATION_CONTROLLER');

const actorId = (req) => req.user && req.user.id;

export function makeNotificationController({ repository }) {
  if (!repository) throw new Error('notification_repository_required');

  return {
    listNotifications: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        const { page, perPage, limit, offset } = parsePagination(req.query || {}, 20);
        const data = await repository.list(userId, { limit, offset });
        const total = await repository.count(userId);
        return reply.send(buildPaginatedResponse(req, { data, page, perPage, total }));
      } catch (err) {
        notificationLogger.error('listNotifications failed', { message: err.message, stack: err.stack });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    unreadNotificationCount: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send({ count: await repository.unreadCount(userId) });
      } catch (err) {
        notificationLogger.error('unreadNotificationCount failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    markNotificationRead: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.markRead(userId, req.params.id));
      } catch (err) {
        notificationLogger.error('markNotificationRead failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    markNotificationsRead: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        const body = req.body || {};
        const ids = body.ids || body.notificationIds || [];
        return reply.send({ data: await repository.markManyRead(userId, ids) });
      } catch (err) {
        notificationLogger.error('markNotificationsRead failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    markAllNotificationsRead: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.markAllRead(userId));
      } catch (err) {
        notificationLogger.error('markAllNotificationsRead failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    deleteNotification: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.delete(userId, req.params.id));
      } catch (err) {
        notificationLogger.error('deleteNotification failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    clearNotifications: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.clear(userId));
      } catch (err) {
        notificationLogger.error('clearNotifications failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    getNotificationPreferences: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.getPreferences(userId));
      } catch (err) {
        notificationLogger.error('getNotificationPreferences failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    updateNotificationPreferences: async (req, reply) => {
      try {
        const userId = actorId(req);
        if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');
        return reply.send(await repository.updatePreferences(userId, req.body || {}));
      } catch (err) {
        notificationLogger.error('updateNotificationPreferences failed', { message: err.message });
        return sendError(reply, 500, 'internal_error', 'Internal server error');
      }
    },

    streamNotifications: async (req, reply) => {
      const userId = actorId(req);
      if (!userId) return sendError(reply, 401, 'unauthorized', 'Unauthorized');

      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      const send = (event, payload) => {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      send('ready', { unreadCount: await repository.unreadCount(userId) });
      const unsubscribe = repository.subscribe(userId, (payload) => send('notification', payload));
      const heartbeat = setInterval(() => send('heartbeat', { at: new Date().toISOString() }), 25000);

      req.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    }
  };
}
