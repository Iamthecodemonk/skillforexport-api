import Question from '../entities/Question.js';
export class QuestionRepository {
  async create(question) {
    throw new Error('create() not implemented');
  }
  async findById(id) {
    throw new Error('findById() not implemented');
  }
  async list({ limit, offset } = {}) {
    throw new Error('list() not implemented');
  }
  async update(id, patch) {
    throw new Error('update() not implemented');
  }
  async delete(id) {
    throw new Error('delete() not implemented');
  }
}

export class QuestionRepositoryImpl extends QuestionRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) 
        throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async create(question) {
    const record = question && question.toRecord ? question.toRecord() : question;
    const created = await this.adapter.create(record);
    return created ? new Question(created) : null;
  }

  async findById(id) {
    const row = await this.adapter.findById(id);
    return row ? new Question(row) : null;
  }

  async list(options = {}) {
    const rows = await this.adapter.list(options);
    return (rows || []).map(r => new Question(r));
  }

  async countAll(options = {}) {
    return typeof this.adapter.countAll === 'function' ? this.adapter.countAll(options) : 0;
  }

  async update(id, patch) {
    const updated = await this.adapter.update(id, patch);
    return updated ? new Question(updated) : null;
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
