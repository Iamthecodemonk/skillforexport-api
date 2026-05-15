import db from '../knexConfig.js';
import { v4 as uuidv4 } from 'uuid';

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

function parseDurationDays(duration) {
  if (typeof duration === 'number') return duration;
  const match = String(duration || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

export default class MysqlAdvertRepository {
  now() {
    return new Date();
  }

  mapLocation(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  mapSite(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  advertSelect() {
    return db('adverts as a')
      .leftJoin('advert_locations as l', 'l.id', 'a.location_id')
      .leftJoin('advert_sites as s', 's.id', 'a.site_id')
      .select(
        'a.*',
        db.raw('l.name as location_name'),
        db.raw('l.status as location_status'),
        db.raw('s.name as site_name'),
        db.raw('s.status as site_status')
      );
  }

  mapAdvert(row) {
    if (!row) return null;
    const expiresAt = row.expires_at || null;
    const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    return {
      id: row.id,
      locationId: row.location_id,
      location: row.location_id ? { id: row.location_id, name: row.location_name, status: row.location_status } : null,
      siteId: row.site_id,
      site: row.site_id ? { id: row.site_id, name: row.site_name, status: row.site_status } : null,
      duration: row.duration,
      durationDays: row.duration_days === null ? null : Number(row.duration_days),
      imageUrl: row.image_url,
      imageMediaId: row.image_media_id,
      linkUrl: row.link_url,
      ownerName: row.owner_name,
      ownerPhone: row.owner_phone,
      ownerEmail: row.owner_email,
      approvedBy: row.approved_by,
      textAbove: row.text_above,
      textBelow: row.text_below,
      status: row.status,
      startsAt: row.starts_at,
      expiresAt,
      isExpired,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  applyOptionFilters(query, filters = {}) {
    if (filters.status) query.where('status', filters.status);
    if (Array.isArray(filters.statuses) && filters.statuses.length > 0) query.whereIn('status', filters.statuses);
    if (filters.q) query.where('name', 'like', `%${filters.q}%`);
  }

  async listLocations({ limit = 20, offset = 0, sort = 'latest', ...filters } = {}) {
    const query = db('advert_locations');
    this.applyOptionFilters(query, filters);
    if (sort === 'oldest') query.orderBy('created_at', 'asc');
    else query.orderBy('created_at', 'desc');
    const rows = await query.limit(limit).offset(offset);
    return rows.map(row => this.mapLocation(row));
  }

  async countLocations(filters = {}) {
    const query = db('advert_locations').count({ cnt: 'id' });
    this.applyOptionFilters(query, filters);
    const row = await query.first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async createLocation(input = {}) {
    const id = input.id || uuidv4();
    const now = this.now();
    await db('advert_locations').insert({
      id,
      name: input.name,
      description: input.description || null,
      status: input.status || 'active',
      created_at: now,
      updated_at: now
    });
    return this.mapLocation(await db('advert_locations').where({ id }).first());
  }

  async updateLocation(id, updates = {}) {
    const payload = {};
    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'status'].includes(key)) payload[key] = value;
    }
    payload.updated_at = this.now();
    await db('advert_locations').where({ id }).update(payload);
    return this.mapLocation(await db('advert_locations').where({ id }).first());
  }

  async listSites({ limit = 20, offset = 0, sort = 'latest', ...filters } = {}) {
    const query = db('advert_sites');
    this.applyOptionFilters(query, filters);
    if (sort === 'oldest') query.orderBy('created_at', 'asc');
    else query.orderBy('created_at', 'desc');
    const rows = await query.limit(limit).offset(offset);
    return rows.map(row => this.mapSite(row));
  }

  async countSites(filters = {}) {
    const query = db('advert_sites').count({ cnt: 'id' });
    this.applyOptionFilters(query, filters);
    const row = await query.first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async createSite(input = {}) {
    const id = input.id || uuidv4();
    const now = this.now();
    await db('advert_sites').insert({
      id,
      name: input.name,
      description: input.description || null,
      status: input.status || 'active',
      created_at: now,
      updated_at: now
    });
    return this.mapSite(await db('advert_sites').where({ id }).first());
  }

  async updateSite(id, updates = {}) {
    const payload = {};
    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'status'].includes(key)) payload[key] = value;
    }
    payload.updated_at = this.now();
    await db('advert_sites').where({ id }).update(payload);
    return this.mapSite(await db('advert_sites').where({ id }).first());
  }

  applyAdvertFilters(query, filters = {}) {
    if (filters.status) query.where('a.status', filters.status);
    if (Array.isArray(filters.statuses) && filters.statuses.length > 0) query.whereIn('a.status', filters.statuses);
    if (filters.locationId) query.where('a.location_id', filters.locationId);
    if (filters.siteId) query.where('a.site_id', filters.siteId);
    if (filters.excludeExpired) {
      query.andWhere((b) => b.whereNull('a.expires_at').orWhere('a.expires_at', '>=', this.now()));
      query.where('l.status', 'active').where('s.status', 'active');
    }
    if (filters.q) {
      const like = `%${filters.q}%`;
      query.andWhere((b) => b
        .where('a.owner_name', 'like', like)
        .orWhere('a.owner_email', 'like', like)
        .orWhere('a.owner_phone', 'like', like)
        .orWhere('a.link_url', 'like', like)
        .orWhere('l.name', 'like', like)
        .orWhere('s.name', 'like', like));
    }
  }

  async listAdverts({ limit = 20, offset = 0, sort = 'latest', ...filters } = {}) {
    const query = this.advertSelect();
    this.applyAdvertFilters(query, filters);
    if (sort === 'oldest') query.orderBy('a.created_at', 'asc');
    else if (sort === 'expiring_soon') query.orderBy('a.expires_at', 'asc');
    else query.orderBy('a.created_at', 'desc');
    const rows = await query.limit(limit).offset(offset);
    return rows.map(row => this.mapAdvert(row));
  }

  async countAdverts(filters = {}) {
    const query = db('adverts as a')
      .leftJoin('advert_locations as l', 'l.id', 'a.location_id')
      .leftJoin('advert_sites as s', 's.id', 'a.site_id')
      .count({ cnt: 'a.id' });
    this.applyAdvertFilters(query, filters);
    const row = await query.first();
    return parseInt((row && (row.cnt || Object.values(row)[0])) || 0, 10);
  }

  async findAdvert(id) {
    return this.mapAdvert(await this.advertSelect().where('a.id', id).first());
  }

  async createAdvert(input = {}) {
    const id = input.id || uuidv4();
    const now = this.now();
    const durationDays = input.durationDays || parseDurationDays(input.duration);
    const startsAt = toDate(input.startsAt) || now;
    const expiresAt = toDate(input.expiresAt) || (durationDays ? addDays(startsAt, durationDays) : null);
    await db('adverts').insert({
      id,
      location_id: input.locationId,
      site_id: input.siteId,
      duration: input.duration,
      duration_days: durationDays,
      image_url: input.imageUrl || input.mediaPath || null,
      image_media_id: input.imageMediaId || null,
      link_url: input.linkUrl || null,
      owner_name: input.ownerName || null,
      owner_phone: input.ownerPhone || input.ownerContact || null,
      owner_email: input.ownerEmail || null,
      approved_by: input.approvedBy || null,
      text_above: input.textAbove || null,
      text_below: input.textBelow || null,
      status: input.status || 'pending_review',
      starts_at: startsAt,
      expires_at: expiresAt,
      created_by_user_id: input.createdByUserId || null,
      created_at: now,
      updated_at: now
    });
    return this.findAdvert(id);
  }

  async updateAdvert(id, updates = {}) {
    const payload = {};
    const map = {
      locationId: 'location_id',
      siteId: 'site_id',
      durationDays: 'duration_days',
      imageUrl: 'image_url',
      mediaPath: 'image_url',
      imageMediaId: 'image_media_id',
      linkUrl: 'link_url',
      ownerName: 'owner_name',
      ownerPhone: 'owner_phone',
      ownerContact: 'owner_phone',
      ownerEmail: 'owner_email',
      approvedBy: 'approved_by',
      textAbove: 'text_above',
      textBelow: 'text_below',
      startsAt: 'starts_at',
      expiresAt: 'expires_at'
    };
    for (const [key, value] of Object.entries(updates || {})) {
      if (map[key]) payload[map[key]] = value;
      else if (['duration', 'status'].includes(key)) payload[key] = value;
    }
    if (updates.duration && !payload.duration_days) payload.duration_days = parseDurationDays(updates.duration);
    if ((updates.duration || updates.durationDays || updates.startsAt) && !updates.expiresAt) {
      const existing = await this.findAdvert(id);
      const startsAt = toDate(payload.starts_at) || toDate(existing && existing.startsAt) || this.now();
      const durationDays = payload.duration_days || parseDurationDays(payload.duration || (existing && existing.duration));
      if (durationDays) payload.expires_at = addDays(startsAt, durationDays);
    }
    payload.updated_at = this.now();
    await db('adverts').where({ id }).update(payload);
    return this.findAdvert(id);
  }
}
