import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const itemTable = { post: 'posts', question: 'questions' };

export default class MysqlPostAuditRepository {
  async findUnit(id) {
    return db('post_audit_units').where({ id }).first();
  }

  async findItemOwner(type, itemId) {
    return db(itemTable[type]).where({ id: itemId }).first('user_id', 'title');
  }

  async listUnits() {
    const [units, counts, settings] = await Promise.all([
      db('post_audit_units').orderBy('sort_order').orderBy('created_at'),
      db('post_audit_assignments').select('unit_id').count({ total: 'id' })
        .sum({ checked: db.raw('CASE WHEN checked_at IS NOT NULL THEN 1 ELSE 0 END') }).groupBy('unit_id'),
      this.getSettings()
    ]);
    const byUnit = new Map(counts.map((row) => [row.unit_id, row]));
    return { settings, units: units.map((unit) => {
      const count = byUnit.get(unit.id);
      const total = Number(count?.total || 0);
      const checked = Number(count?.checked || 0);
      return { ...unit, is_active: Boolean(unit.is_active), total, pending: total - checked, checked };
    }) };
  }

  async getSettings() {
    const row = await db('post_audit_settings').where({ id: 1 }).first();
    return { copiesPerItem: Number(row?.copies_per_item || 1) };
  }

  async updateSettings(copiesPerItem) {
    await db('post_audit_settings').where({ id: 1 }).update({ copies_per_item: copiesPerItem, updated_at: new Date() });
    return this.getSettings();
  }

  async createUnit(name, sortOrder = 0) {
    const id = uuidv4();
    const now = new Date();
    await db('post_audit_units').insert({ id, name, sort_order: sortOrder, is_active: 1, created_at: now, updated_at: now });
    return db('post_audit_units').where({ id }).first();
  }

  async updateUnit(id, patch) {
    const current = await db('post_audit_units').where({ id }).first();
    if (!current) return null;
    const changes = { updated_at: new Date() };
    if (patch.name !== undefined) changes.name = patch.name;
    if (patch.sortOrder !== undefined) changes.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) changes.is_active = patch.isActive ? 1 : 0;
    await db('post_audit_units').where({ id }).update(changes);
    return db('post_audit_units').where({ id }).first();
  }

  async dispatch(limit = 100) {
    return db.transaction(async (trx) => {
      const units = await trx('post_audit_units').where({ is_active: 1 }).orderBy('sort_order').orderBy('id').select('id');
      if (!units.length) return { post: 0, question: 0, assignments: 0 };
      const { copiesPerItem } = await this.getSettings();
      const copies = Math.min(copiesPerItem, units.length);
      const result = { post: 0, question: 0, assignments: 0 };
      for (const [type, table] of Object.entries(itemTable)) {
        const cursor = await trx('post_audit_cursors').where({ item_type: type }).forUpdate()
          .select('*', trx.raw("DATE_FORMAT(last_created_at, '%Y-%m-%d %H:%i:%s.%f') AS last_ts")).first();
        const query = trx(table).select('id', trx.raw("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS source_ts"))
          .orderBy('created_at').orderBy('id').limit(limit);
        if (cursor?.last_ts) {
          query.where((q) => q.where('created_at', '>', cursor.last_ts)
            .orWhere((tie) => tie.where('created_at', cursor.last_ts).where('id', '>', cursor.last_id)));
        }
        const rows = await query;
        if (!rows.length) continue;
        const overrides = await trx('post_audit_overrides').where({ item_type: type })
          .whereIn('item_id', rows.map((row) => row.id)).select('item_id');
        const overriddenIds = new Set(overrides.map((row) => row.item_id));
        const now = new Date();
        const assignments = [];
        for (const row of rows) {
          if (overriddenIds.has(row.id)) continue;
          const start = parseInt(row.id.replace(/-/g, '').slice(0, 8), 16) % units.length;
          for (let index = 0; index < copies; index++) {
            assignments.push({ id: uuidv4(), unit_id: units[(start + index) % units.length].id,
              item_type: type, item_id: row.id, source_created_at: row.source_ts, assigned_at: now });
          }
        }
        if (assignments.length) {
          await trx('post_audit_assignments').insert(assignments).onConflict(['unit_id', 'item_type', 'item_id']).ignore();
        }
        const last = rows[rows.length - 1];
        await trx('post_audit_cursors').where({ item_type: type }).update({ last_created_at: last.source_ts, last_id: last.id });
        result[type] = rows.length;
        result.assignments += assignments.length;
      }
      return result;
    });
  }

  async assignItem(type, itemId, unitIds, replace = false) {
    return db.transaction(async (trx) => {
      await trx('post_audit_cursors').where({ item_type: type }).forUpdate().first();
      const item = await trx(itemTable[type]).where({ id: itemId })
        .select('id', trx.raw("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s.%f') AS source_ts")).first();
      if (!item) throw new Error('item_not_found');
      const units = await trx('post_audit_units').whereIn('id', unitIds).where({ is_active: 1 }).select('id');
      if (units.length !== unitIds.length) throw new Error('unit_not_found');
      if (replace) {
        const reviewedOutside = await trx('post_audit_assignments')
          .where({ item_type: type, item_id: itemId }).whereNotIn('unit_id', unitIds)
          .where((q) => q.whereNotNull('checked_at').orWhereNotNull('report_id')).first('id');
        if (reviewedOutside) throw new Error('reviewed_assignment_cannot_be_removed');
        await trx('post_audit_assignments').where({ item_type: type, item_id: itemId }).whereNotIn('unit_id', unitIds).del();
        await trx('post_audit_overrides').insert({ item_type: type, item_id: itemId, updated_at: new Date() })
          .onConflict(['item_type', 'item_id']).merge({ updated_at: new Date() });
      }
      await trx('post_audit_assignments').insert(units.map((unit) => ({ id: uuidv4(), unit_id: unit.id,
        item_type: type, item_id: itemId, source_created_at: item.source_ts, assigned_at: new Date() })))
        .onConflict(['unit_id', 'item_type', 'item_id']).ignore();
      return trx('post_audit_assignments').where({ item_type: type, item_id: itemId }).orderBy('assigned_at');
    });
  }

  async listItems(unitId, checked, page, perPage) {
    const base = db('post_audit_assignments').where({ unit_id: unitId });
    if (checked) base.whereNotNull('checked_at');
    else base.whereNull('checked_at');
    const [{ total }, rows] = await Promise.all([
      base.clone().count({ total: 'id' }).first(),
      base.clone().orderBy('source_created_at', 'desc').orderBy('item_id', 'desc')
        .limit(perPage).offset((page - 1) * perPage)
    ]);
    const posts = rows.filter((row) => row.item_type === 'post').map((row) => row.item_id);
    const questions = rows.filter((row) => row.item_type === 'question').map((row) => row.item_id);
    const [postRows, questionRows] = await Promise.all([
      posts.length ? db('posts').whereIn('id', posts).select('id', 'user_id', 'title', 'content', 'visibility', 'moderation_status') : [],
      questions.length ? db('questions').whereIn('id', questions).select('id', 'user_id', 'title', 'body', 'visibility', 'moderation_status') : []
    ]);
    const items = new Map([
      ...postRows.map((row) => [`post:${row.id}`, row]),
      ...questionRows.map((row) => [`question:${row.id}`, row])
    ]);
    const userIds = [...new Set([
      ...[...items.values()].map((row) => row.user_id),
      ...rows.map((row) => row.checked_by)
    ].filter(Boolean))];
    const reportIds = rows.map((row) => row.report_id).filter(Boolean);
    const [users, profiles, reports] = await Promise.all([
      userIds.length ? db('users').whereIn('id', userIds).select('id', 'email') : [],
      userIds.length ? db('user_profiles').whereIn('user_id', userIds).select('user_id', 'display_name') : [],
      reportIds.length ? db('generic_reports').whereIn('id', reportIds).select('id', 'reason', 'details', 'created_at') : []
    ]);
    const names = new Map(profiles.map((row) => [row.user_id, row.display_name]));
    const byUser = new Map(users.map((row) => [row.id, { ...row, name: names.get(row.id) || null }]));
    const byReport = new Map(reports.map((row) => [row.id, row]));
    const count = Number(total || 0);
    return { current_page: page, per_page: perPage, total: count, last_page: Math.max(1, Math.ceil(count / perPage)),
      data: rows.map((row) => {
        const item = items.get(`${row.item_type}:${row.item_id}`) || null;
        return { ...row, item, author: byUser.get(item?.user_id) || null,
          auditor: byUser.get(row.checked_by) || null, report: byReport.get(row.report_id) || null };
      }) };
  }

  async report(unitId, assignmentId, actorId, reason, details) {
    return db.transaction(async (trx) => {
      const assignment = await trx('post_audit_assignments').where({ id: assignmentId, unit_id: unitId }).forUpdate().first();
      if (!assignment) throw new Error('assignment_not_found');
      if (assignment.checked_at) throw new Error('assignment_already_checked');
      if (assignment.report_id) throw new Error('assignment_already_reported');
      const reportId = uuidv4();
      await trx('generic_reports').insert({ id: reportId, user_id: actorId, target_id: assignment.item_id,
        target_type: assignment.item_type, reason, details: details || null, created_at: new Date() });
      await trx('post_audit_assignments').where({ id: assignmentId }).update({ report_id: reportId });
      return { assignmentId, reportId, itemType: assignment.item_type, itemId: assignment.item_id };
    });
  }

  async checkpoint(unitId, actorId, throughAssignmentId = null) {
    return db.transaction(async (trx) => {
      const pending = trx('post_audit_assignments').where({ unit_id: unitId }).whereNull('checked_at');
      if (throughAssignmentId) {
        const through = await trx('post_audit_assignments')
          .where({ id: throughAssignmentId, unit_id: unitId }).whereNull('checked_at')
          .select('id', 'item_id', trx.raw("DATE_FORMAT(source_created_at, '%Y-%m-%d %H:%i:%s.%f') AS source_ts")).first();
        if (!through) throw new Error('assignment_not_found');
        pending.where((q) => q.where('source_created_at', '>', through.source_ts)
          .orWhere((tie) => tie.where('source_created_at', through.source_ts).where('item_id', '>=', through.item_id)));
      }
      const count = await pending.update({ checked_at: new Date(), checked_by: actorId });
      return { unitId, checkedCount: count, throughAssignmentId };
    });
  }
}
