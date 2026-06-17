import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import User from '../../domain/entities/User.js';
import UserProfile from '../../domain/entities/UserProfile.js';
import UserSkill from '../../domain/entities/UserSkill.js';
import UserPortfolio from '../../domain/entities/UserPortfolio.js';
import Follower from '../../domain/entities/Follower.js';
import UserOauthAccount from '../../domain/entities/UserOauthAccount.js';
import UserLoginHistory from '../../domain/entities/UserLoginHistory.js';

const toBool = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
};

const profileSettingsShape = (settingsRow = null) => {
  const settings = settingsRow && settingsRow.settings ? settingsRow.settings : {};
  const privacy = settingsRow && settingsRow.privacy ? settingsRow.privacy : {};
  const notifications = settings.notifications || settings.notificationPreferences || {};
  return {
    id: settingsRow && settingsRow.id || null,
    user_id: settingsRow && settingsRow.user_id || null,
    feature_and_announcement: toBool(settings.feature_and_announcement ?? settings.featureAndAnnouncement ?? notifications.featureAndAnnouncement, true),
    featureAndAnnouncement: toBool(settings.feature_and_announcement ?? settings.featureAndAnnouncement ?? notifications.featureAndAnnouncement, true),
    mails: toBool(settings.mails ?? notifications.mails, true),
    tips_and_reminders: toBool(settings.tips_and_reminders ?? settings.tipsAndReminders ?? notifications.tipsAndReminders, true),
    tipsAndReminders: toBool(settings.tips_and_reminders ?? settings.tipsAndReminders ?? notifications.tipsAndReminders, true),
    inbox: toBool(settings.inbox ?? notifications.inbox, true),
    research: toBool(settings.research ?? notifications.research, false),
    recommended: toBool(settings.recommended ?? notifications.recommended, true),
    alerts: toBool(settings.alerts ?? notifications.alerts, true),
    profile: toBool(settings.profile ?? notifications.profile, true),
    privacy,
    created_at: settingsRow && settingsRow.created_at || null,
    updated_at: settingsRow && settingsRow.updated_at || null
  };
};

const humanDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

export default class UserUseCase {
  constructor({ userRepository, profileRepository, skillRepository, portfolioRepository, followerRepository, oauthRepository, loginHistoryRepository, certificationRepository = null, educationRepository = null, experienceRepository = null, settingsRepository = null }) {
    this.userRepository = userRepository;
    this.profileRepository = profileRepository;
    this.skillRepository = skillRepository;
    this.portfolioRepository = portfolioRepository;
    this.followerRepository = followerRepository;
    this.oauthRepository = oauthRepository;
    this.loginHistoryRepository = loginHistoryRepository;
    this.certificationRepository = certificationRepository;
    this.educationRepository = educationRepository;
    this.experienceRepository = experienceRepository;
    this.settingsRepository = settingsRepository;
  }

  async getUser(id) {
    return this.userRepository.findById(id);
  }

  async getUserWithActivity(id) {
    if (this.userRepository && typeof this.userRepository.findWithActivity === 'function') {
      return this.userRepository.findWithActivity(id);
    }
    return null;
  }

  async listUsersWithActivity({ limit = 20, offset = 0 } = {}) {
    const safeLimit = Math.min(Math.max(parseInt(limit || 20, 10), 1), 100);
    const safeOffset = Math.max(parseInt(offset || 0, 10), 0);
    const [users, total] = await Promise.all([
      this.userRepository.listWithActivity({ limit: safeLimit, offset: safeOffset }),
      this.userRepository.countAll()
    ]);
    return { users, total, limit: safeLimit, offset: safeOffset };
  }

  async createUser({ email, password, role = 'user' }) {
    if (!email || !User.isValidEmail(email)) 
      throw new Error('invalid_email_format');
    const existing = await this.userRepository.findByEmail(email);
    if (existing) 
      throw new Error('email_taken');
    // Hash the plaintext password before storing
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = new User({ id: uuidv4(), email, password: hashedPassword, role, createdAt: new Date() });
    return this.userRepository.create(user);
  }

  async getProfile(userId) {
    return this.profileRepository.findByUserId(userId);
  }

  async getFullProfile(userId) {
    // If adapter supports an optimized single-query fetch, use it
    if (this.userRepository && typeof this.userRepository.findFullProfileById === 'function') {
      const row = await this.userRepository.findFullProfileById(userId);
      if (!row) return null;
      // Some DB drivers may return JSON columns as strings; attempt to parse
      const parse = (v) => {
        if (v === null || typeof v === 'undefined') return null;
        if (typeof v === 'string') {
          try { return JSON.parse(v); } catch (e) { return v; }
        }
        return v;
      };
      const profile = parse(row.profile);
      const counts = await this.getUserStats(userId);
      const rawSettings = this.settingsRepository && typeof this.settingsRepository.get === 'function'
        ? await this.settingsRepository.get(userId)
        : null;
      const setting = profileSettingsShape(rawSettings);
      const privacy = rawSettings && rawSettings.privacy ? rawSettings.privacy : {};
      const name = (profile && (profile.displayName || profile.username)) || row.email || null;
      const skills = parse(row.skills) || [];
      const portfolios = parse(row.portfolios) || [];
      const certifications = parse(row.certifications) || [];
      const education = parse(row.education) || [];
      const experiences = parse(row.experiences) || [];
      const followers = parse(row.followers) || [];
      const oauthAccounts = parse(row.oauth_accounts) || [];
      const createdAt = row.user_created_at;
      const rawAlertSettings = rawSettings && rawSettings.settings && typeof rawSettings.settings.alerts === 'object'
        ? rawSettings.settings.alerts
        : {};
      const alerts = {
        contest_alert: rawAlertSettings.contest_alert ?? false,
        sales_alert: rawAlertSettings.sales_alert ?? false,
        scholarship_types: Array.isArray(rawAlertSettings.scholarship_types) ? rawAlertSettings.scholarship_types : [],
        job_experience: rawAlertSettings.job_experience ?? null,
        job_tags: Array.isArray(rawAlertSettings.job_tags) ? rawAlertSettings.job_tags : [],
        job_types: Array.isArray(rawAlertSettings.job_types) ? rawAlertSettings.job_types : []
      };
      return {
        id: row.user_id,
        uuid: row.user_id,
        name,
        email: row.email,
        is_admin: row.role === 'admin',
        profile_image: profile && (profile.avatar || profile.profile_image || profile.profileImage) || null,
        location: profile && profile.location || null,
        bio: profile && profile.bio || null,
        current_job_title: profile && (profile.current_job_title || profile.currentJobTitle) || null,
        current_workspace: profile && (profile.current_workspace || profile.currentWorkspace) || null,
        notification_email: rawSettings && rawSettings.notification_email || null,
        counts,
        followers,
        following: { users: [], pages: [], totals: 0 },
        skills,
        educations: education,
        education,
        experiences,
        activeExperiences: experiences.filter((item) => item && (item.is_current === 1 || item.is_current === true || item.isCurrent === true)),
        certifications,
        projects: portfolios,
        portfolios,
        communities: [],
        setting,
        settings: setting,
        privacy,
        scores: { total: 0, byCommunity: [] },
        alerts,
        created_at: createdAt,
        created_at_human: humanDate(createdAt),
        referral_code: row.referral_code || null,
        user: { id: row.user_id, name, email: row.email, role: row.role, created_at: row.user_created_at },
        profile,
        oauthAccounts
      };
    }

    /*
    // Fallback to existing parallel repository calls
    // (Commented out for now — can be re-enabled later if adapter fast-path unavailable)
    const promises = [];
    promises.push(this.userRepository.findById(userId));
    promises.push(this.profileRepository.findByUserId(userId));
    promises.push(this.skillRepository ? this.skillRepository.listByUserId(userId) : Promise.resolve([]));
    promises.push(this.portfolioRepository ? this.portfolioRepository.listByUserId(userId) : Promise.resolve([]));
    promises.push(this.certificationRepository ? this.certificationRepository.listByUserId(userId) : Promise.resolve([]));
    promises.push(this.educationRepository ? this.educationRepository.listByUserId(userId) : Promise.resolve([]));
    promises.push(this.experienceRepository ? this.experienceRepository.listByUserId(userId) : Promise.resolve([]));
    promises.push(this.followerRepository ? this.followerRepository.listFollowers(userId) : Promise.resolve([]));
    promises.push(this.oauthRepository ? this.oauthRepository.listByUserId(userId) : Promise.resolve([]));

    const [user, profile, skills, portfolios, certifications, education, experiences, followers, oauths] = await Promise.all(promises);

    if (!user) return null;

    const toPlain = (v) => {
      if (!v) return v;
      if (Array.isArray(v)) return v.map(x => (x && typeof x.toPlainObject === 'function') ? x.toPlainObject() : x);
      return (v && typeof v.toPlainObject === 'function') ? v.toPlainObject() : v;
    };

    return {
      user: toPlain(user),
      profile: toPlain(profile),
      skills: toPlain(skills),
      portfolios: toPlain(portfolios),
      certifications: toPlain(certifications),
      education: toPlain(education),
      experiences: toPlain(experiences),
      followers: toPlain(followers),
      oauthAccounts: toPlain(oauths)
    };
    */
  }

  async getUserStats(userId) {
    const pages = await this.userRepository.countPages(userId);
    const communities = await this.userRepository.countCommunities(userId);
    const posts = await this.userRepository.countPosts(userId);
    const questions = typeof this.userRepository.countQuestions === 'function' ? await this.userRepository.countQuestions(userId) : 0;
    const comments = await this.userRepository.countComments(userId);
    const answers = typeof this.userRepository.countAnswers === 'function' ? await this.userRepository.countAnswers(userId) : 0;
    return {
      pages: parseInt(pages || 0, 10),
      communities: parseInt(communities || 0, 10),
      posts: parseInt(posts || 0, 10),
      questions: parseInt(questions || 0, 10),
      comments: parseInt(comments || 0, 10),
      answers: parseInt(answers || 0, 10)
    };
  }

  async createProfile(userId, data) {
    // Ensure the user exists before creating a profile (prevent FK errors)
    const user = await this.userRepository.findById(userId);
    if (!user) 
      throw new Error('user_not_found');

    // here umm i am preventing duplicate profiles for the same user
    const existing = await this.profileRepository.findByUserId(userId);
    if (existing) 
      throw new Error('profile_already_exists');

    // If username provided, ensure it's unique across profiles
    if (data && data.username) {
      const byName = await this.profileRepository.findByUsername(data.username);
      if (byName) throw new Error('username_taken');
    }

    const profile = new UserProfile({ id: uuidv4(), user_id: userId, username: data.username, displayName: data.displayName || data.name, bio: data.bio, location: data.location, avatar: data.avatar, banner: data.banner, website: data.website, linkedin: data.linkedin, github: data.github, currentJobTitle: data.currentJobTitle || data.current_job_title, currentWorkspace: data.currentWorkspace || data.current_workspace, created_at: new Date() });
    return this.profileRepository.create(profile);
  }

  async updateProfile(userId, patch) {
    const existing = await this.profileRepository.findByUserId(userId);
    if (!existing) throw new Error('profile_not_found');
    const normalizedPatch = { ...(patch || {}) };
    if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'displayName')) normalizedPatch.display_name = normalizedPatch.displayName;
    if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'currentJobTitle')) normalizedPatch.current_job_title = normalizedPatch.currentJobTitle;
    if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'currentWorkspace')) normalizedPatch.current_workspace = normalizedPatch.currentWorkspace;
    delete normalizedPatch.displayName;
    delete normalizedPatch.currentJobTitle;
    delete normalizedPatch.currentWorkspace;
    return this.profileRepository.update(existing.id, normalizedPatch);
  }

  async updateUserDisplayName(userId, actor, patch = {}) {
    if (!userId) throw new Error('user_required');
    const actorId = actor && actor.id;
    const actorRole = actor && actor.role;
    if (!actorId) throw new Error('unauthorized');
    if (actorId !== userId && actorRole !== 'admin') throw new Error('forbidden');

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('user_not_found');
    const { name = null, displayName = null, ...profileFields } = patch || {};
    const nextName = String(displayName || name || '').trim();
    const hasProfileFields = Object.keys(profileFields || {}).some((key) => typeof profileFields[key] !== 'undefined');
    if (!nextName && !hasProfileFields) throw new Error('name_required');

    let profile = await this.profileRepository.findByUserId(userId);
    const profilePatch = { ...profileFields };
    if (nextName) profilePatch.displayName = nextName;
    if (!profile) {
      profile = await this.profileRepository.create(new UserProfile({ id: uuidv4(), user_id: userId, ...profilePatch, created_at: new Date() }));
    } else {
      profile = await this.profileRepository.update(profile.id, profilePatch);
    }

    const plainProfile = profile && typeof profile.toPlainObject === 'function' ? profile.toPlainObject() : profile;
    const resolvedName = nextName || (plainProfile && (plainProfile.displayName || plainProfile.display_name || plainProfile.username)) || user.email;
    return {
      user: {
        id: user.id,
        name: resolvedName,
        email: user.email
      },
      profile: plainProfile
    };
  }

  async getPublicProfile(userId) {
    if (!userId) throw new Error('user_required');
    if (this.userRepository && typeof this.userRepository.findPublicProfileById === 'function') {
      return this.userRepository.findPublicProfileById(userId);
    }
    const user = await this.getUserWithActivity(userId);
    if (!user) return null;
    return {
      id: user.id,
      name: user.profile && user.profile.displayName ? user.profile.displayName : null,
      username: user.profile && user.profile.username ? user.profile.username : null,
      avatar: user.profile && user.profile.avatar ? user.profile.avatar : null,
      bio: user.profile && user.profile.bio ? user.profile.bio : null,
      location: user.profile && user.profile.location ? user.profile.location : null,
      skills: user.skills || [],
      education: user.education || [],
      experiences: user.experiences || [],
      portfolios: user.portfolios || [],
      posts: user.latest && user.latest.post ? [user.latest.post] : [],
      scoreTotals: { posts: 0, comments: 0, total: 0 },
      followerCount: user.stats ? user.stats.totalFollowers || user.stats.followers || 0 : 0
    };
  }

  async listSkills(userId) {
    const direct = this.skillRepository && typeof this.skillRepository.listByUserId === 'function'
      ? await this.skillRepository.listByUserId(userId)
      : [];
    if (direct && direct.length > 0) return direct;

    const full = await this.getFullProfile(userId);
    const rawSkills = full && Array.isArray(full.skills) ? full.skills : [];
    return rawSkills.map((item, index) => {
      if (item && typeof item.toPlainObject === 'function') return item;
      if (item && typeof item === 'object') {
        return new UserSkill({
          id: item.id || `profile-skill-${index}`,
          user_id: item.user_id || item.userId || userId,
          skill: item.skill || item.name || item.title || item.value || null,
          level: item.level || null
        });
      }
      return new UserSkill({ id: `profile-skill-${index}`, user_id: userId, skill: String(item), level: null });
    }).filter((item) => item && item.skill);
  }

  async addSkill(userId, { skill, level }) {
    const entry = new UserSkill({ id: uuidv4(), user_id: userId, skill, level });
    return this.skillRepository.create(entry);
  }

  async deleteSkill(userId, skillId) {
    // adapters are responsible for verifying ownership if necessary
    return this.skillRepository.delete(skillId);
  }

  async listPortfolios(userId) {
    return this.portfolioRepository.listByUserId(userId);
  }

  async addPortfolio(userId, { title, description, link, pictures = [] }) {
    const entry = new UserPortfolio({ id: uuidv4(), user_id: userId, title, description, link, pictures });
    return this.portfolioRepository.create(entry);
  }

  async deletePortfolio(userId, portfolioId) {
    return this.portfolioRepository.delete(portfolioId);
  }

  async followUser(userId, followerId) {
    const entry = new Follower({ id: uuidv4(), follower_id: followerId, following_id: userId, created_at: new Date() });
    return this.followerRepository.create(entry);
  }

  async unfollowUser(userId, followerId) {
    // Attempt to delete the follower relation; adapter returns deleted row or null
    return this.followerRepository.deleteByFollowerAndFollowing(followerId, userId);
  }

  async listFollowers(userId) {
    return this.followerRepository.listFollowers(userId);
  }

  async listLoginHistory(userId) {
    return this.loginHistoryRepository.listByUserId(userId);
  }

  async createOauthAccount(userId, { provider, providerId, providerEmail, avatarUrl, rawData }) {
    const entry = new UserOauthAccount({ id: uuidv4(), user_id: userId, provider, provider_id: providerId, provider_email: providerEmail, avatar_url: avatarUrl, raw_data: rawData, created_at: new Date(), updated_at: new Date() });
    return this.oauthRepository.create(entry);
  }

  // Certifications
  async listCertifications(userId) {
    return this.certificationRepository.listByUserId(userId);
  }

  async addCertification(userId, { name, issuer, issueDate }) {
    const entry = { id: uuidv4(), user_id: userId, name, issuer, issue_date: issueDate };
    
    return this.certificationRepository.create(entry);
  }

  async deleteCertification(userId, certId) {
    return this.certificationRepository.delete(certId);
  }

  // Education
  async listEducation(userId) {
    return this.educationRepository.listByUserId(userId);
  }

  async addEducation(userId, { school, degree, field, startDate, endDate }) {
    const entry = { id: uuidv4(), user_id: userId, school, degree, field, start_date: startDate, end_date: endDate };
    return this.educationRepository.create(entry);
  }

  async deleteEducation(userId, eduId) {
    return this.educationRepository.delete(eduId);
  }

  // Experiences
  async listExperiences(userId) {
    return this.experienceRepository.listByUserId(userId);
  }

  async addExperience(userId, { company, title, employmentType, startDate, endDate, isCurrent, description }) {
    const entry = { id: uuidv4(), user_id: userId, company, title, employment_type: employmentType, start_date: startDate, end_date: endDate, is_current: isCurrent, description };
    return this.experienceRepository.create(entry);
  }

  async deleteExperience(userId, expId) {
    return this.experienceRepository.delete(expId);
  }
}
