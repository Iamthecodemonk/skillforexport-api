import Answer from '../entities/Answer.js';
export class AnswerRepository {
  async create(answer) {
    throw new Error('create() not implemented');
  }
  async findById(id) {
    throw new Error('findById() not implemented');
  }
  async listByQuestion(questionId, { limit, offset } = {}) {
    throw new Error('listByQuestion() not implemented');
  }
  async delete(id) {
    throw new Error('delete() not implemented');
  }
}

export class AnswerRepositoryImpl extends AnswerRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async create(answer) {
    const record = answer && answer.toRecord ? answer.toRecord() : answer;
    const created = await this.adapter.create(record);
    return created ? new Answer(created) : null;
  }

  async findById(id) {
    const row = await this.adapter.findById(id);
    return row ? new Answer(row) : null;
  }

  async listByQuestion(questionId, { limit = 50, offset = 0 } = {}) {
    const rows = await this.adapter.listByQuestion(questionId, { limit, offset });
    return (rows || []).map(r => new Answer(r));
  }

  async delete(id) {
    return this.adapter.delete(id);
  }
}
