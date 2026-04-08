import UserCertification from '../../domain/entities/UserCertification.js';

export class UserCertificationRepository {
  async listByUserId(userId) { throw new Error('listByUserId() not implemented'); }
  async create(cert) { throw new Error('create() not implemented'); }
  async delete(id) { throw new Error('delete() not implemented'); }
}

export class UserCertificationRepositoryImpl extends UserCertificationRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async listByUserId(userId) {
    const rows = await this.adapter.listByUserId(userId);
    return rows.map(r => new UserCertification(r));
  }

  async create(cert) {
    const record = cert && cert.toRecord ? cert.toRecord() : cert;
    const created = await this.adapter.create(record);
    return created ? new UserCertification(created) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
