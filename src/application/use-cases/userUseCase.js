import { v4 as uuidv4 } from 'uuid';
import User from '../../domain/entities/User.js';
import UserProfile from '../../domain/entities/UserProfile.js';
import UserSkill from '../../domain/entities/UserSkill.js';
import UserPortfolio from '../../domain/entities/UserPortfolio.js';
import Follower from '../../domain/entities/Follower.js';
import UserOauthAccount from '../../domain/entities/UserOauthAccount.js';
import UserLoginHistory from '../../domain/entities/UserLoginHistory.js';

export default class UserUseCase {
  constructor({ userRepository, profileRepository, skillRepository, portfolioRepository, followerRepository, oauthRepository, loginHistoryRepository, certificationRepository = null, educationRepository = null, experienceRepository = null }) {
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
  }

  async getUser(id) {
    return this.userRepository.findById(id);
  }

  async createUser({ email, password, role = 'user' }) {
    if (!email || !User.isValidEmail(email)) 
      throw new Error('invalid_email_format');
    const existing = await this.userRepository.findByEmail(email);
    if (existing) 
      throw new Error('email_taken');
    const user = new User({ id: uuidv4(), email, password, role, createdAt: new Date() });
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
      return {
        user: { id: row.user_id, email: row.email, role: row.role, created_at: row.user_created_at },
        profile: parse(row.profile),
        skills: parse(row.skills) || [],
        portfolios: parse(row.portfolios) || [],
        certifications: parse(row.certifications) || [],
        education: parse(row.education) || [],
        experiences: parse(row.experiences) || [],
        followers: parse(row.followers) || [],
        oauthAccounts: parse(row.oauth_accounts) || []
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
    // Returns counts: pages, communities, posts, comments
    const pages = await this.userRepository.countPages(userId);
    const communities = await this.userRepository.countCommunities(userId);
    const posts = await this.userRepository.countPosts(userId);
    const comments = await this.userRepository.countComments(userId);
    return {
      pages: parseInt(pages || 0, 10),
      communities: parseInt(communities || 0, 10),
      posts: parseInt(posts || 0, 10),
      comments: parseInt(comments || 0, 10)
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

    const profile = new UserProfile({ id: data.id || uuidv4(), user_id: userId, username: data.username, bio: data.bio, location: data.location, avatar: data.avatar, banner: data.banner, website: data.website, linkedin: data.linkedin, github: data.github, created_at: new Date() });
    return this.profileRepository.create(profile);
  }

  async updateProfile(userId, patch) {
    const existing = await this.profileRepository.findByUserId(userId);
    if (!existing) throw new Error('profile_not_found');
    return this.profileRepository.update(existing.id, patch);
  }

  async listSkills(userId) {
    return this.skillRepository.listByUserId(userId);
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

  async addPortfolio(userId, { title, description, link }) {
    const entry = new UserPortfolio({ id: uuidv4(), user_id: userId, title, description, link });
    return this.portfolioRepository.create(entry);
  }

  async deletePortfolio(userId, portfolioId) {
    return this.portfolioRepository.delete(portfolioId);
  }

  async followUser(userId, followerId) {
    const entry = new Follower({ id: uuidv4(), follower_id: followerId, following_id: userId, created_at: new Date() });
    return this.followerRepository.create(entry);
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
