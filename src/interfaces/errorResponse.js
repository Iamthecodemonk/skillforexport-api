export function formatError(code, message, extras) {
  const err = { code: code || 'internal_error' };
  if (message) err.message = message;
  if (extras && typeof extras === 'object') Object.assign(err, extras);
  return err;
}

export function sendError(reply, httpStatus = 500, code = 'internal_error', message = null, extras = null) {
  return reply.code(httpStatus).send({ success: false, error: formatError(code, message, extras) });
}
