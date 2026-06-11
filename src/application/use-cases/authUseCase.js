import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import User from '../../domain/entities/User.js';
import UserProfile from '../../domain/entities/UserProfile.js';
import UserEducation from '../../domain/entities/UserEducation.js';
import UserExperience from '../../domain/entities/UserExperience.js';
import logger from '../../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();
const authLogger = logger.child('AUTH_USECASE');

export default class AuthUseCase {
  constructor({ userRepository, profileRepository = null, educationRepository = null, experienceRepository = null, settingsRepository = null, emailQueue, jwtSecret, jwtExpiresIn, passwordResetRepository = null }) {
    this.userRepository = userRepository;
    this.profileRepository = profileRepository;
    this.educationRepository = educationRepository;
    this.experienceRepository = experienceRepository;
    this.settingsRepository = settingsRepository;
    this.emailQueue = emailQueue;
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'secret';
    this.jwtExpiresIn = jwtExpiresIn || '7d';
    this.passwordResetRepository = passwordResetRepository;
  }

  async RegisterWithEmailPassword({ email, password, refCode = null }) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) 
        throw new Error('email_taken');
    const hashed = await bcrypt.hash(password, 10);
    try {
      const referredByUserId = await this.findReferralOwnerId(refCode);
      const referralCode = this.generateReferralCode();
      const user = new User({ id: uuidv4(), email, password: hashed, referralCode, referredByUserId, createdAt: new Date() });
      return this.userRepository.create(user);
    } catch (err) {
      if (err.message === 'invalid_email_format')
        throw new Error('invalid_email_format');
      throw err;
    }
  }

  generateReferralCode() {
    return `S4E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  toPlain(value) {
    return value && typeof value.toPlainObject === 'function' ? value.toPlainObject() : value;
  }

  normalizeOnboarding(onboarding = {}) {
    return onboarding && typeof onboarding === 'object' && !Array.isArray(onboarding) ? onboarding : {};
  }

  yearToDate(year) {
    if (!year) return null;
    const parsed = parseInt(String(year), 10);
    if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 2200) return null;
    return new Date(`${parsed}-01-01T00:00:00.000Z`);
  }

  async ensureProfile({ userId, name, onboarding = {} }) {
    if (!this.profileRepository || typeof this.profileRepository.findByUserId !== 'function') return null;
    const locationParts = [onboarding.state, onboarding.country].filter(Boolean);
    const location = locationParts.length ? locationParts.join(', ') : null;
    const patch = {
      displayName: name || null
    };
    if (location) patch.location = location;
    if (onboarding.jobTitle && !patch.bio) patch.bio = onboarding.jobTitle;

    const existing = await this.profileRepository.findByUserId(userId);
    if (existing) {
      const updatePatch = {};
      if (patch.displayName) updatePatch.displayName = patch.displayName;
      if (patch.location) updatePatch.location = patch.location;
      if (patch.bio && !(existing.bio)) updatePatch.bio = patch.bio;
      if (Object.keys(updatePatch).length === 0) return existing;
      return this.profileRepository.update(existing.id, updatePatch);
    }

    return this.profileRepository.create(new UserProfile({
      id: uuidv4(),
      user_id: userId,
      displayName: patch.displayName,
      bio: patch.bio || null,
      location: patch.location || null,
      created_at: new Date()
    }));
  }

  async ensureEducation({ userId, onboarding = {} }) {
    if (!this.educationRepository || typeof this.educationRepository.create !== 'function') return [];
    if (String(onboarding.accountType || '').toLowerCase() !== 'student') {
      return typeof this.educationRepository.listByUserId === 'function' ? this.educationRepository.listByUserId(userId) : [];
    }
    if (!onboarding.university && !onboarding.courseOfStudy && !onboarding.yearStarted) {
      return typeof this.educationRepository.listByUserId === 'function' ? this.educationRepository.listByUserId(userId) : [];
    }
    const existing = typeof this.educationRepository.listByUserId === 'function'
      ? await this.educationRepository.listByUserId(userId)
      : [];
    const duplicate = (existing || []).some((item) => {
      const row = this.toPlain(item) || {};
      return row.school === onboarding.university && row.field === onboarding.courseOfStudy;
    });
    if (!duplicate) {
      await this.educationRepository.create(new UserEducation({
        id: uuidv4(),
        userId,
        school: onboarding.university || null,
        field: onboarding.courseOfStudy || null,
        startDate: this.yearToDate(onboarding.yearStarted)
      }));
    }
    return typeof this.educationRepository.listByUserId === 'function' ? this.educationRepository.listByUserId(userId) : [];
  }

  async ensureExperience({ userId, onboarding = {} }) {
    if (!this.experienceRepository || typeof this.experienceRepository.create !== 'function') return [];
    const accountType = String(onboarding.accountType || 'default').toLowerCase();
    if (accountType === 'student') {
      return typeof this.experienceRepository.listByUserId === 'function' ? this.experienceRepository.listByUserId(userId) : [];
    }
    if (!onboarding.jobTitle && !onboarding.workplace) {
      return typeof this.experienceRepository.listByUserId === 'function' ? this.experienceRepository.listByUserId(userId) : [];
    }
    const existing = typeof this.experienceRepository.listByUserId === 'function'
      ? await this.experienceRepository.listByUserId(userId)
      : [];
    const duplicate = (existing || []).some((item) => {
      const row = this.toPlain(item) || {};
      return row.title === onboarding.jobTitle && row.company === onboarding.workplace;
    });
    if (!duplicate) {
      await this.experienceRepository.create(new UserExperience({
        id: uuidv4(),
        userId,
        company: onboarding.workplace || null,
        title: onboarding.jobTitle || null,
        employmentType: 'full-time',
        isCurrent: true
      }));
    }
    return typeof this.experienceRepository.listByUserId === 'function' ? this.experienceRepository.listByUserId(userId) : [];
  }

  async saveOnboardingSettings({ userId, onboarding = {} }) {
    if (!this.settingsRepository || typeof this.settingsRepository.mergeSettings !== 'function') return null;
    const acceptedTerms = onboarding.acceptedTerms === true || onboarding.accepted_terms === true;
    const nowIso = new Date().toISOString();
    return this.settingsRepository.mergeSettings(userId, {
      onboarding: {
        accountType: onboarding.accountType || 'default',
        is16OrAbove: onboarding.is16OrAbove === true || onboarding.is_16_or_above === true,
        acceptedTerms,
        acceptedTermsAt: acceptedTerms ? (onboarding.acceptedTermsAt || nowIso) : null,
        state: onboarding.state || null,
        country: onboarding.country || null,
        onboardingCompleted: true,
        completedAt: nowIso
      }
    });
  }

  async applyOnboarding({ user, name, onboarding = {} }) {
    const userObj = this.toPlain(user);
    const userId = userObj && userObj.id;
    if (!userId) return { user, profile: null, education: [], experiences: [], settings: null, onboardingCompleted: false };
    const normalizedOnboarding = this.normalizeOnboarding(onboarding);
    const [profile, education, experiences, settings] = await Promise.all([
      this.ensureProfile({ userId, name, onboarding: normalizedOnboarding }),
      this.ensureEducation({ userId, onboarding: normalizedOnboarding }),
      this.ensureExperience({ userId, onboarding: normalizedOnboarding }),
      this.saveOnboardingSettings({ userId, onboarding: normalizedOnboarding })
    ]);
    return {
      user,
      profile: this.toPlain(profile),
      education: (education || []).map((item) => this.toPlain(item)),
      experiences: (experiences || []).map((item) => this.toPlain(item)),
      settings,
      onboardingCompleted: true
    };
  }

  async findReferralOwnerId(refCode) {
    if (!refCode || !this.userRepository || typeof this.userRepository.findByReferralCode !== 'function') return null;
    const referrer = await this.userRepository.findByReferralCode(refCode).catch(() => null);
    return referrer ? referrer.id : null;
  }

  async InitiateRegistration({ email, password, fullName }) {
    // Validate email format at domain layer
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }
    
    // Check if email already exists
    const existing = await this.userRepository.findByEmail(email);
    if (existing) 
        throw new Error('email_taken');
    
    // Generate OTP for registration and store a bcrypt-hashed temporary password
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = {
      id: uuidv4(),
      userId: null, // No user yet, this is registration
      email,
      otpCode,
      purpose: 'registration',
      isUsed: false,
      tempPasswordHash: hashedPassword,
      tempProfileFullName: fullName || null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      createdAt: new Date(),
    };
    await this.userRepository.createOtp(otp);
    
    // Queue OTP email for async processing
    if (this.emailQueue) {
      try {
        await this.emailQueue.add('otp', {
          type: 'otp',
          to: email,
          otpCode,
          expiresInMinutes: 10
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true
        });
        authLogger.info('OTP email queued for sending', { email });
      } catch (queueErr) {
        authLogger.warn('Failed to queue OTP email', { error: queueErr.message });
        // Continue - email queuing is optional
      }
    }
    
    return { otpId: otp.id, message: 'OTP sent to email. Please verify to complete registration.' };
  }

  async RequestRegistrationOtp({ email }) {
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('email_taken');
    }

    await this.userRepository.deleteOtpsByEmailPurpose(email, 'registration');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const placeholderPassword = await bcrypt.hash(uuidv4(), 10);
    const otp = {
      id: uuidv4(),
      userId: null,
      email,
      otpCode,
      purpose: 'registration',
      isUsed: false,
      tempPasswordHash: placeholderPassword,
      tempProfileFullName: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
    };

    await this.userRepository.createOtp(otp);

    if (this.emailQueue) {
      try {
        await this.emailQueue.add('otp', {
          type: 'otp',
          to: email,
          otpCode,
          expiresInMinutes: 10
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true
        });
        authLogger.info('Registration OTP email queued', { email });
      } catch (queueErr) {
        authLogger.warn('Failed to queue registration OTP email', { error: queueErr.message });
      }
    }

    return { email, otpId: otp.id };
  }

  async ResendRegistrationOtp({ email }) {
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    const existing = await this.userRepository.findByEmail(email);
    if (existing && existing.password) {
      throw new Error('email_taken');
    }

    await this.userRepository.deleteOtpsByEmailPurpose(email, 'registration');

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const placeholderPassword = await bcrypt.hash(uuidv4(), 10);
    const otp = {
      id: uuidv4(),
      userId: existing && existing.id ? existing.id : null,
      email,
      otpCode,
      purpose: 'registration',
      isUsed: false,
      tempPasswordHash: placeholderPassword,
      tempProfileFullName: null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      createdAt: new Date(),
    };

    await this.userRepository.createOtp(otp);

    if (this.emailQueue) {
      try {
        await this.emailQueue.add('otp', {
          type: 'otp',
          to: email,
          otpCode,
          expiresInMinutes: 10
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true
        });
        authLogger.info('Registration OTP resent', { email });
      } catch (queueErr) {
        authLogger.warn('Failed to queue resent registration OTP email', { error: queueErr.message });
      }
    }

    return { email, otpId: otp.id };
  }

  async VerifyRegistrationOtp({ email, otpCode }) {
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    const entry = await this.userRepository.findValidOtp(email, otpCode, 'registration');
    if (!entry) {
      throw new Error('invalid_or_expired_otp');
    }

    await this.userRepository.markOtpVerified(entry.id);

    return { email };
  }

  async SetRegistrationPassword({ email, password }) {
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    if (!password) {
      throw new Error('password_required');
    }

    const entry = await this.userRepository.findLatestOtpByEmailPurpose(email, 'registration');
    if (!entry || entry.is_used || !entry.used_at || new Date(entry.expires_at) <= new Date()) {
      throw new Error('registration_not_verified');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.userRepository.updateOtpTempPassword(entry.id, hashedPassword);

    return { email };
  }

  async CompleteRegistration({ email, name, refCode, otpCode, password, onboarding = {} }) {
    // Validate email format at domain layer
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      const token = jwt.sign({ sub: existingUser.id, email: existingUser.email, tv: (existingUser.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
      const onboardingResult = await this.applyOnboarding({ user: existingUser, name, onboarding });
      return { ...onboardingResult, token };
    }

    let entry = null;

    if (otpCode) {
      entry = await this.userRepository.findValidOtp(email, otpCode, 'registration');
    } else {
      entry = await this.userRepository.findLatestOtpByEmailPurpose(email, 'registration');
      if (entry && (entry.is_used || !entry.used_at || new Date(entry.expires_at) <= new Date())) {
        entry = null;
      }
    }

    if (!entry) {
      throw new Error('invalid_or_expired_otp');
    }

    // Use stored temporary hashed password if present; otherwise use provided password
    const storedHash = entry.temp_password_hash || entry.tempPasswordHash || entry.password_hash || entry.passwordHash;
    const tempFullName = entry.temp_profile_full_name || entry.tempProfileFullName || null;
    const hashed = storedHash || (password ? await bcrypt.hash(password, 10) : null);

    if (!hashed) {
      throw new Error('password_required');
    }

    try {
      const referredByUserId = await this.findReferralOwnerId(refCode);
      const referralCode = this.generateReferralCode();
      const user = new User({ id: uuidv4(), email, password: hashed, referralCode, referredByUserId, createdAt: new Date() });
      const createdUser = await this.userRepository.create(user);
      // Delete the OTP row so temporary data can't be accessed (errors handled by outer catch)
      await this.userRepository.deleteOtp(entry.id);
      // Generate token (include token version for revocation)
      const token = jwt.sign({ sub: createdUser.id, email: createdUser.email, tv: (createdUser.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
      const onboardingResult = await this.applyOnboarding({ user: createdUser, name: name || tempFullName, onboarding });
      return { ...onboardingResult, token };
    } catch (err) {
      if (err.message === 'invalid_email_format')
        throw new Error('invalid_email_format');
      throw err;
    }
  }

  async LoginWithEmailPassword({ email, password }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) 
        throw new Error('invalid_credentials');
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) 
        throw new Error('invalid_credentials');
    const token = jwt.sign({ sub: user.id, email: user.email, tv: (user.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    return { user, token };
  }

  async RequestOtp({ email, purpose = 'login', ttlMinutes = 10 }) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) 
        throw new Error('user_not_found');

    // Special handling for password reset: generate a secure token, store only its hash
    if (purpose === 'password_reset') {
      if (!this.passwordResetRepository) {
        throw new Error('password_reset_not_configured');
      }
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const reset = {
        id: uuidv4(),
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
        createdAt: new Date(),
      };
      await this.passwordResetRepository.create({ id: reset.id, userId: reset.userId, tokenHash: reset.tokenHash, expiresAt: reset.expiresAt });

      if (this.emailQueue) {
        try {
          // const frontendUrl = process.env.APP_URL;
          const frontendUrl = 'https://skills4export.com';
          const resetLink = `${frontendUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
          const expiresInHours = Math.max(1, Math.ceil(ttlMinutes / 60));
          await this.emailQueue.add('password_reset', {
            type: 'passwordReset',
            to: email,
            resetLink,
            expiresInHours
          }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true
          });
          authLogger.info('Password reset email queued', { email, frontend: frontendUrl });
          // For security, do not return raw token in responses when queued
          return { otpId: reset.id };
        } catch (queueErr) {
          authLogger.warn('Failed to queue password reset email', { error: queueErr.message });
          // Avoid returning the raw token even on queue failure in production; return sanitized response
          return { otpId: reset.id, warning: 'Email queuing failed' };
        }
      }

      // No email queue configured — still avoid returning raw token by default
      return { otpId: reset.id };
    }

    // Default / login-style OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otp = {
      id: uuidv4(),
      userId: user.id,
      email,
      otpCode,
      purpose,
      isUsed: false,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      createdAt: new Date(),
    };
    await this.userRepository.createOtp(otp);

    if (this.emailQueue) {
      try {
        await this.emailQueue.add('otp', {
          type: 'otp',
          to: email,
          otpCode,
          expiresInMinutes: ttlMinutes
        }, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true
        });
        authLogger.info('OTP email queued for sending', { email });
        return { otpId: otp.id, jobId: otp.id };
      } catch (queueErr) {
        authLogger.warn('Failed to queue OTP email', { error: queueErr.message });
        return { otpId: otp.id, otpCode, warning: 'Email queuing failed' };
      }
    }
    return { otpId: otp.id, otpCode };
  }

  async VerifyOtp({ email, otpCode, purpose = 'login' }) {
    const entry = await this.userRepository.findValidOtp(email, otpCode, purpose);
    if (!entry) 
        throw new Error('invalid_or_expired_otp');
    // Ensure the OTP row includes a linked user id (login OTPs must be tied to a user)
    // const userId = entry.userId || entry.user_id;
    // if (!userId) {
    //   authLogger.warn('VerifyOtp found OTP without linked user id', { entryId: entry.id, email, purpose });
    //   throw new Error('invalid_or_expired_otp');
    // }
    await this.userRepository.markOtpUsed(entry.id);
    const user = await this.userRepository.findById(entry.user_id);
    if (!user) 
        throw new Error('user_not_found');
    const token = jwt.sign({ sub: user.id, email: user.email, tv: (user.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    return { user, token };
  }

  async ResetPassword({ email, otpCode, newPassword }) {
    // Validate email format
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }

    // First try password_resets repository if available (token-based resets)
    if (this.passwordResetRepository) {
      const tokenHash = crypto.createHash('sha256').update(String(otpCode)).digest('hex');
      const entry = await this.passwordResetRepository.findValidByHash(tokenHash);
      if (!entry) {
        throw new Error('invalid_or_expired_otp');
      }
      const userId = entry.user_id || entry.userId;
      if (!userId) throw new Error('invalid_or_expired_otp');
      const user = await this.userRepository.findById(userId);
      if (!user) throw new Error('user_not_found');
      const hashed = await bcrypt.hash(newPassword, 10);
      await this.passwordResetRepository.markUsed(entry.id);
      await this.userRepository.updatePassword(user.id, hashed);
      return user;
    }

    // Fallback: legacy OTP table behaviour
    const entry = await this.userRepository.findValidOtp(email, otpCode, 'password_reset');
    if (!entry) throw new Error('invalid_or_expired_otp');
    const userId = entry.user_id || entry.userId;
    if (!userId) throw new Error('invalid_or_expired_otp');
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error('user_not_found');
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepository.markOtpUsed(entry.id);
    await this.userRepository.updatePassword(user.id, hashed);
    return user;
  }

  async LoginWithGoogle({ profile }) {
    // profile: { email, name, googleId }
    if (!profile || !profile.email) throw new Error('invalid_profile');
    let user = await this.userRepository.findByEmail(profile.email);
    if (!user) {
      const newUser = new User({ id: uuidv4(), email: profile.email, password: null, createdAt: new Date() });
      user = await this.userRepository.create(newUser);
    }
    const token = jwt.sign({ sub: user.id, email: user.email, tv: (user.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });

    return { user, token };
  }
}
