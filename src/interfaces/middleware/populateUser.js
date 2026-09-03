import jwt from 'jsonwebtoken';
import logger from '../../utils/logger.js';

const log = logger.child('AUTH:populateUser');

export default function makePopulateUser({ userRepository, jwtSecret }) {
  return async function populateUser(req, reply) {
    try {
      const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
      const headerToken = (() => {
        if (!authHeader) return null;
        const value = String(authHeader).trim();
        const parts = value.split(/\s+/);
        if (parts.length === 2 && ['bearer', 'token'].includes(String(parts[0]).toLowerCase())) return parts[1];
        if (parts.length === 1 && value.split('.').length === 3) return value;
        return null;
      })();
      const token = headerToken
        || (req.headers && (req.headers['x-access-token'] || req.headers['x-api-token']))
        || (req.query && (req.query.api_token || req.query.access_token || req.query.token));
      if (!token) return;
      let payload = null;
      try {
        payload = jwt.verify(token, jwtSecret);
      } catch (e) {
        log.debug('Invalid JWT token', { message: e && e.message });
        // invalid token - do not attach user
        return;
      }

      const userId = payload && (payload.sub || payload.userId || payload.id);
      if (!userId) {
        req.user = payload;
        return;
      }

      try {
        if (userRepository && typeof userRepository.findById === 'function') {
          const user = await userRepository.findById(userId);
          if (user) {
            const tokenVersionFromToken = payload.tv || payload.tokenVersion || 0;
            const userTokenVersion = user.token_version || user.tokenVersion || 0;
            if (typeof userTokenVersion === 'undefined' || tokenVersionFromToken === userTokenVersion) {
              req.user = user;
            }
            // mismatch => treat as revoked
          }
        } else {
          req.user = payload;
        }
      } catch (e) {
        log.warn('User lookup failed in populateUser', { message: e && e.message, stack: e && e.stack });
        // ignore - do not block request on auth lookup failures
      }
    } catch (err) {
      log.error('Unexpected error in populateUser middleware', { message: err && err.message, stack: err && err.stack });
      // swallow errors in auth hook to avoid breaking all requests
    }
  };
}
