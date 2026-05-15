const ADVERT_STATUSES = ['pending_review', 'approved', 'active', 'expired', 'suspended', 'deleted'];
const OPTION_STATUSES = ['active', 'suspended', 'deleted'];

const ACTIVE_ADVERT_STATUSES = ['approved', 'active'];

export default class AdvertUseCase {
  constructor({ repository }) {
    this.repository = repository;
  }

  assertAdmin(actor) {
    if (!actor || !actor.id) throw new Error('unauthorized');
    if (actor.role !== 'admin') throw new Error('forbidden');
  }

  async listAdverts(params = {}) {
    return this.repository.listAdverts(params);
  }

  async countAdverts(params = {}) {
    return this.repository.countAdverts(params);
  }

  async listPublicAdverts(params = {}) {
    return this.repository.listAdverts({ ...params, statuses: ACTIVE_ADVERT_STATUSES, excludeExpired: true });
  }

  async countPublicAdverts(params = {}) {
    return this.repository.countAdverts({ ...params, statuses: ACTIVE_ADVERT_STATUSES, excludeExpired: true });
  }

  async getAdvert(id, publicOnly = false) {
    const advert = await this.repository.findAdvert(id);
    if (!advert) throw new Error('advert_not_found');
    if (publicOnly && (!ACTIVE_ADVERT_STATUSES.includes(advert.status) || advert.isExpired)) {
      throw new Error('advert_not_found');
    }
    return advert;
  }

  async createAdvert(actor, body = {}) {
    this.assertAdmin(actor);
    if (!body.locationId || !body.siteId || !body.duration) throw new Error('validation_error');
    return this.repository.createAdvert({ ...body, createdByUserId: actor.id, status: body.status || 'pending_review' });
  }

  async updateAdvert(actor, id, body = {}) {
    this.assertAdmin(actor);
    const advert = await this.getAdvert(id);
    return this.repository.updateAdvert(advert.id, body);
  }

  async updateAdvertStatus(actor, id, status) {
    this.assertAdmin(actor);
    if (!ADVERT_STATUSES.includes(status)) throw new Error('validation_error');
    const advert = await this.getAdvert(id);
    return this.repository.updateAdvert(advert.id, { status });
  }

  async listLocations(params = {}) {
    return this.repository.listLocations(params);
  }

  async countLocations(params = {}) {
    return this.repository.countLocations(params);
  }

  async createLocation(actor, body = {}) {
    this.assertAdmin(actor);
    if (!body.name) throw new Error('validation_error');
    return this.repository.createLocation(body);
  }

  async updateLocation(actor, id, body = {}) {
    this.assertAdmin(actor);
    return this.repository.updateLocation(id, body);
  }

  async updateLocationStatus(actor, id, status) {
    this.assertAdmin(actor);
    if (!OPTION_STATUSES.includes(status)) throw new Error('validation_error');
    return this.repository.updateLocation(id, { status });
  }

  async listSites(params = {}) {
    return this.repository.listSites(params);
  }

  async countSites(params = {}) {
    return this.repository.countSites(params);
  }

  async createSite(actor, body = {}) {
    this.assertAdmin(actor);
    if (!body.name) throw new Error('validation_error');
    return this.repository.createSite(body);
  }

  async updateSite(actor, id, body = {}) {
    this.assertAdmin(actor);
    return this.repository.updateSite(id, body);
  }

  async updateSiteStatus(actor, id, status) {
    this.assertAdmin(actor);
    if (!OPTION_STATUSES.includes(status)) throw new Error('validation_error');
    return this.repository.updateSite(id, { status });
  }
}
