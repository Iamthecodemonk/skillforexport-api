export default async function authRequired(req, reply) {
  if (!req.user) {
    return reply.code(401).send({ success: false, error: { code: 'unauthorized', message: 'Authentication required' } });
  }
}
