import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import User from '../../domain/entities/User.js';
import logger from '../../utils/logger.js';

const authLogger = logger.child('AUTH_USECASE');

export default class AuthUseCase {
  constructor({ userRepository, profileRepository = null, emailQueue, jwtSecret, jwtExpiresIn, passwordResetRepository = null }) {
    this.userRepository = userRepository;
    this.profileRepository = profileRepository;
    this.emailQueue = emailQueue;
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'secret';
    this.jwtExpiresIn = jwtExpiresIn || '7d';
    this.passwordResetRepository = passwordResetRepository;
  }

  async RegisterWithEmailPassword({ email, password }) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) 
        throw new Error('email_taken');
    const hashed = await bcrypt.hash(password, 10);
    try {
      const user = new User({ id: uuidv4(), email, password: hashed, createdAt: new Date() });
      return this.userRepository.create(user);
    } catch (err) {
      if (err.message === 'invalid_email_format')
        throw new Error('invalid_email_format');
      throw err;
    }
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

  async CompleteRegistration({ email, otpCode, password }) {
    // Validate email format at domain layer
    if (!email || !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }
    
    // Find valid OTP for registration
    const entry = await this.userRepository.findValidOtp(email, otpCode, 'registration');
    if (!entry) 
        throw new Error('invalid_or_expired_otp');
    
    // Use stored temporary hashed password if present; otherwise use provided password
    const storedHash = entry.temp_password_hash || entry.tempPasswordHash || entry.password_hash || entry.passwordHash;
    const tempFullName = entry.temp_profile_full_name || entry.tempProfileFullName || null;
    const hashed = storedHash ? storedHash : await bcrypt.hash(password, 10);
    try {
      const user = new User({ id: uuidv4(), email, password: hashed, createdAt: new Date() });
      const createdUser = await this.userRepository.create(user);
      // Delete the OTP row so temporary data can't be accessed (errors handled by outer catch)
      await this.userRepository.deleteOtp(entry.id);
      // Generate token (include token version for revocation)
      const token = jwt.sign({ sub: createdUser.id, email: createdUser.email, tv: (createdUser.tokenVersion || 0) }, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
      return { user: createdUser, token };
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
          const appUrl = process.env.APP_URL || 'http://localhost:3011';
          const resetLink = `${appUrl.replace(/\/$/, '')}/auth/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
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
          authLogger.info('Password reset email queued', { email });
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