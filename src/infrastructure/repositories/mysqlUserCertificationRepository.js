import db from '../knexConfig.js';
import UserCertification from '../../domain/entities/UserCertification.js';

export default class MysqlUserCertificationRepository {
  constructor() {}

  async listByUserId(userId) {
    const rows = await db('user_certifications').where({ user_id: userId }).orderBy('issue_date', 'desc');
    return rows.map(r => new UserCertification({ id: r.id, userId: r.user_id, name: r.name, issuer: r.issuer, issueDate: r.issue_date, createdAt: r.created_at }));
  }

  async create(cert) {
    const record = cert.toRecord ? cert.toRecord() : cert;
    await db('user_certifications').insert(record);
    return cert;
  }

  async delete(id) {
    await db('user_certifications').where({ id }).del();
    return true;
  }
}
