import { AppUpdateUseCase } from '../../application/use-cases/appUpdateUseCase.js';

const invalid = new Set(['invalid_platform', 'invalid_version', 'invalid_version_range',
  'invalid_store_url', 'invalid_release_notes', 'release_date_required', 'invalid_release_date']);

export function makeAppUpdateController({ repository, userRepository }) {
  const useCase = new AppUpdateUseCase(repository);
  const fail = (reply, error) => {
    if (invalid.has(error.message)) return reply.code(422).send({ success: false, error: { code: error.message } });
    if (error.message === 'update_policy_unavailable') {
      return reply.code(404).send({ success: false, error: { code: error.message } });
    }
    return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
  };
  const admin = (action) => async (req, reply) => {
    if (!req.user) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
    try {
      if (req.user.role !== 'admin' || !await userRepository.isSuperAdmin(req.user.id)) {
        return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
      }
      return reply.send({ success: true, data: await action(req) });
    } catch (error) { return fail(reply, error); }
  };
  return {
    checkAppUpdate: async (req, reply) => {
      try {
        return reply.send({ success: true, data: await useCase.check(req.query.platform, req.query.current_version) });
      } catch (error) { return fail(reply, error); }
    },
    listAppUpdatePolicies: admin(() => useCase.list()),
    saveAppUpdatePolicy: admin((req) => useCase.save(req.params.platform, req.body, req.user.id))
  };
}
