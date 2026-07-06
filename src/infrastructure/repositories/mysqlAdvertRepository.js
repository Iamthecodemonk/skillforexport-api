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

const addHours = (date, hours) => {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
};

function parseDurationDays(duration) {
  if (typeof duration === 'number') return duration;
  const match = String(duration || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function parseDurationHours(duration) {
  if (typeof duration === 'number') return duration;
  const text = String(duration || '').toLowerCase();
  const match = text.match(/\d+/);
  if (!match) return null;
  const value = parseInt(match[0], 10);
  if (text.includes('hour') || text.includes('hr')) return value;
  return null;
}

export default class MysqlAdvertRepository {
  async hasColumn(table, column) {
    this._columns = this._columns || {};
    const key = `${table}.${column}`;
    if (typeof this._columns[key] !== 'undefined') return this._columns[key];
    this._columns[key] = await db.schema.hasColumn(table, column);
    return this._columns[key];
  }

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
    const sizeLabel = row.size_label || row.name;
    return {
      id: row.id,
      name: row.name || sizeLabel,
      sizeLabel,
      size_label: sizeLabel,
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
      pageLocationId: row.location_id,
      page_location_id: row.location_id,
      location: row.location_id ? { id: row.location_id, name: row.location_name, status: row.location_status } : null,
      siteId: row.site_id,
      adSizeId: row.site_id,
      ad_size_id: row.site_id,
      site: row.site_id ? { id: row.site_id, name: row.site_name, sizeLabel: row.site_size_label || row.site_name, size_label: row.site_size_label || row.site_name, status: row.site_status } : null,
      adSize: row.site_id ? { id: row.site_id, sizeLabel: row.site_size_label || row.site_name, size_label: row.site_size_label || row.site_name, status: row.site_status } : null,
      ad_size: row.site_id ? { id: row.site_id, size_label: row.site_size_label || row.site_name, status: row.site_status } : null,
      duration: row.duration,
      durationDays: row.duration_days === null ? null : Number(row.duration_days),
      duration_hours: row.duration_hours === null || typeof row.duration_hours === 'undefined' ? null : Number(row.duration_hours),
      durationHours: row.duration_hours === null || typeof row.duration_hours === 'undefined' ? null : Number(row.duration_hours),
      imageUrl: row.image_url,
      imagePath: row.image_url,
      image_path: row.image_url,
      imageMediaId: row.image_media_id,
      linkUrl: row.link_url,
      ownerName: row.owner_name,
      adOwner: row.owner_name,
      ad_owner: row.owner_name,
      ownerPhone: row.owner_phone,
      contactPhone: row.owner_phone,
      contact_phone: row.owner_phone,
      ownerEmail: row.owner_email,
      approvedBy: row.approved_by,
      textAbove: row.text_above,
      textBelow: row.text_below,
      adText: row.text_below || row.text_above,
      ad_text: row.text_below || row.text_above,
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
    const sizeLabel = input.sizeLabel || input.size_label || input.name;
    const payload = {
      id,
      name: input.name || sizeLabel,
      description: input.description || null,
      status: input.status || 'active',
      created_at: now,
      updated_at: now
    };
    if (await this.hasColumn('advert_sites', 'size_label')) payload.size_label = sizeLabel;
    await db('advert_sites').insert(payload);
    return this.mapSite(await db('advert_sites').where({ id }).first());
  }

  async updateSite(id, updates = {}) {
    const payload = {};
    for (const [key, value] of Object.entries(updates)) {
      if (['name', 'description', 'status'].includes(key)) payload[key] = value;
      if (['sizeLabel', 'size_label'].includes(key)) {
        payload.name = value;
        if (await this.hasColumn('advert_sites', 'size_label')) payload.size_label = value;
      }
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
    const durationHours = input.durationHours || input.duration_hours || parseDurationHours(input.duration);
    const durationDays = input.durationDays || input.duration_days || (!durationHours ? parseDurationDays(input.duration) : null);
    const startsAt = toDate(input.startsAt) || now;
    const expiresAt = toDate(input.expiresAt) || (durationHours ? addHours(startsAt, durationHours) : (durationDays ? addDays(startsAt, durationDays) : null));
    const payload = {
      id,
      location_id: input.locationId || input.pageLocationId || input.page_location_id,
      site_id: input.siteId || input.adSizeId || input.ad_size_id,
      duration: input.duration || (durationHours ? `${durationHours} hours` : null),
      duration_days: durationDays,
      image_url: input.imageUrl || input.mediaPath || input.imagePath || input.image_path || null,
      image_media_id: input.imageMediaId || null,
      link_url: input.linkUrl || null,
      owner_name: input.ownerName || input.adOwner || input.ad_owner || null,
      owner_phone: input.ownerPhone || input.ownerContact || input.contactPhone || input.contact_phone || null,
      owner_email: input.ownerEmail || null,
      approved_by: input.approvedBy || null,
      text_above: input.textAbove || null,
      text_below: input.textBelow || input.adText || input.ad_text || null,
      status: input.status || 'pending_review',
      starts_at: startsAt,
      expires_at: expiresAt,
      created_by_user_id: input.createdByUserId || null,
      created_at: now,
      updated_at: now
    };
    if (await this.hasColumn('adverts', 'duration_hours')) payload.duration_hours = durationHours;
    await db('adverts').insert(payload);
    return this.findAdvert(id);
  }

  async updateAdvert(id, updates = {}) {
    const payload = {};
    const map = {
      locationId: 'location_id',
      pageLocationId: 'location_id',
      page_location_id: 'location_id',
      siteId: 'site_id',
      adSizeId: 'site_id',
      ad_size_id: 'site_id',
      durationDays: 'duration_days',
      duration_days: 'duration_days',
      imageUrl: 'image_url',
      mediaPath: 'image_url',
      imagePath: 'image_url',
      image_path: 'image_url',
      imageMediaId: 'image_media_id',
      linkUrl: 'link_url',
      ownerName: 'owner_name',
      adOwner: 'owner_name',
      ad_owner: 'owner_name',
      ownerPhone: 'owner_phone',
      ownerContact: 'owner_phone',
      contactPhone: 'owner_phone',
      contact_phone: 'owner_phone',
      ownerEmail: 'owner_email',
      approvedBy: 'approved_by',
      textAbove: 'text_above',
      textBelow: 'text_below',
      adText: 'text_below',
      ad_text: 'text_below',
      startsAt: 'starts_at',
      expiresAt: 'expires_at'
    };
    for (const [key, value] of Object.entries(updates || {})) {
      if (map[key]) payload[map[key]] = value;
      else if (['duration', 'status'].includes(key)) payload[key] = value;
      else if (['durationHours', 'duration_hours'].includes(key) && await this.hasColumn('adverts', 'duration_hours')) payload.duration_hours = value;
    }
    const nextDurationHours = updates.durationHours || updates.duration_hours || parseDurationHours(updates.duration);
    if (nextDurationHours && await this.hasColumn('adverts', 'duration_hours')) payload.duration_hours = nextDurationHours;
    if (updates.duration && !payload.duration_days) payload.duration_days = parseDurationDays(updates.duration);
    if ((updates.duration || updates.durationDays || updates.duration_hours || updates.durationHours || updates.startsAt) && !updates.expiresAt) {
      const existing = await this.findAdvert(id);
      const startsAt = toDate(payload.starts_at) || toDate(existing && existing.startsAt) || this.now();
      const durationHours = nextDurationHours || (existing && existing.durationHours);
      const durationDays = payload.duration_days || parseDurationDays(payload.duration || (existing && existing.duration));
      if (durationHours) payload.expires_at = addHours(startsAt, durationHours);
      else if (durationDays) payload.expires_at = addDays(startsAt, durationDays);
    }
    payload.updated_at = this.now();
    await db('adverts').where({ id }).update(payload);
    return this.findAdvert(id);
  }
}
