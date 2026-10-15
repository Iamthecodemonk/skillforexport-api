import logger from '../../utils/logger.js';

const auditLogger = logger.child('POST_AUDIT_CONTROLLER');
const itemTypes = new Set(['post', 'question']);

export function makePostAuditController({ repository, userRepository, notificationRepository = null }) {
  const run = (superAdminOnly, action) => async (req, reply) => {
    try {
      if (!req.user) return reply.code(401).send({ success: false, error: { code: 'unauthorized' } });
      if (req.user.role !== 'admin' || (superAdminOnly && !await userRepository.isSuperAdmin(req.user.id))) {
        return reply.code(403).send({ success: false, error: { code: 'forbidden' } });
      }
      return await action(req, reply);
    } catch (err) {
      const status = {
        item_not_found: 404, unit_not_found: 404, assignment_not_found: 404,
        assignment_already_checked: 409, assignment_already_reported: 409,
        reviewed_assignment_cannot_be_removed: 409
      }[err.message];
      if (status) return reply.code(status).send({ success: false, error: { code: err.message } });
      if (err.code === 'ER_DUP_ENTRY') return reply.code(409).send({ success: false, error: { code: 'duplicate_unit_name' } });
      auditLogger.error('post audit request failed', { message: err.message, stack: err.stack });
      return reply.code(500).send({ success: false, error: { code: 'internal_error' } });
    }
  };

  const validUnit = async (id) => {
    if (!await repository.findUnit(id)) throw new Error('unit_not_found');
  };

  return {
    listAuditUnits: run(false, async (req, reply) => reply.send({ success: true, data: await repository.listUnits() })),
    createAuditUnit: run(true, async (req, reply) => {
      const { name, sortOrder = 0 } = req.body;
      if (!name.trim()) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
      const unit = await repository.createUnit(name.trim(), sortOrder);
      return reply.code(201).send({ success: true, data: unit });
    }),
    updateAuditUnit: run(true, async (req, reply) => {
      const patch = { ...req.body };
      if (patch.name !== undefined) {
        patch.name = patch.name.trim();
        if (!patch.name) return reply.code(422).send({ success: false, error: { code: 'validation_failed' } });
      }
      const unit = await repository.updateUnit(req.params.id, patch);
      if (!unit) throw new Error('unit_not_found');
      return reply.send({ success: true, data: unit });
    }),
    updateAuditSettings: run(true, async (req, reply) => {
      const settings = await repository.updateSettings(req.body.copiesPerItem);
      return reply.send({ success: true, data: settings });
    }),
    dispatchAuditItems: run(true, async (req, reply) => reply.send({ success: true,
      data: await repository.dispatch(req.body?.limit || 100) })),
    assignAuditItem: run(true, async (req, reply) => {
      const { type, id } = req.params;
      if (!itemTypes.has(type)) return reply.code(422).send({ success: false, error: { code: 'invalid_item_type' } });
      const { unitIds, replace = false } = req.body;
      const assignments = await repository.assignItem(type, id, [...new Set(unitIds)], replace);
      return reply.send({ success: true, data: { assignments } });
    }),
    listAuditItems: run(false, async (req, reply) => {
      const { id } = req.params;
      await validUnit(id);
      await repository.dispatch(50);
      const checked = req.query.status === 'checked';
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.per_page || 20);
      return reply.send({ success: true, data: await repository.listItems(id, checked, page, perPage) });
    }),
    reportAuditItem: run(false, async (req, reply) => {
      const { id, assignmentId } = req.params;
      const report = await repository.report(id, assignmentId, req.user.id, req.body.reason.trim(), req.body.details);
      if (notificationRepository) {
        try {
          const owner = await repository.findItemOwner(report.itemType, report.itemId);
          if (owner?.user_id) await notificationRepository.create({
            userId: owner.user_id, actorUserId: null, type: 'content_flagged',
            title: `${report.itemType} flagged`,
            body: `Your ${report.itemType} was flagged for review.`,
            target: { type: report.itemType, id: report.itemId, title: owner.title || null,
              url: `/${report.itemType}s/${report.itemId}` },
            metadata: { targetType: report.itemType, targetId: report.itemId, anonymous: true }
          });
        } catch (err) {
          auditLogger.warn('audit report notification failed', { message: err.message });
        }
      }
      return reply.code(201).send({ success: true, data: report });
    }),
    checkpointAuditUnit: run(false, async (req, reply) => {
      const { id } = req.params;
      await validUnit(id);
      const result = await repository.checkpoint(id, req.user.id, req.body?.throughAssignmentId || null);
      return reply.send({ success: true, data: result });
    })
  };
}
