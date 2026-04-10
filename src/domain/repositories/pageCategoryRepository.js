// Repository interface for page categories
export class PageCategoryRepository {
  constructor() {}
  async findById(id) {
    throw new Error('findById() not implemented');
  }
}

export class PageCategoryRepositoryImpl extends PageCategoryRepository {
  constructor({ adapter }) {
    super();
    if (!adapter) throw new Error('adapter is required');
    this.adapter = adapter;
  }

  async findById(id) {
    return this.adapter.findById(id);
  }
}
