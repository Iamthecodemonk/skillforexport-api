import logger from '../../utils/logger.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const authLogger = logger.child('AUTH_CONTROLLER');

function buildValidationResponse(validationErrors) {
  const firstKey = Object.keys(validationErrors || {})[0];
  const firstMessage = firstKey && Array.isArray(validationErrors[firstKey]) && validationErrors[firstKey].length
    ? validationErrors[firstKey][0]
    : 'Validation failed';

  return {
    success: false,
    message: firstMessage,
    data: {
      errors: validationErrors
    }
  };
}

function buildErrorResponse(message, data = null) {
  return {
    success: false,
    message,
    data
  };
}

function buildSuccessResponse({ message = null, data, token }) {
  const response = { success: true };
  if (message !== null) response.message = message;
  if (typeof token !== 'undefined') response.token = token;
  if (typeof data !== 'undefined') response.data = data;
  return response;
}

export function makeAuthController({ useCase }) {
  return {
    RequestRegistrationOtp: async (req, reply) => {
      try {
        const { email } = req.body || {};
        const validationErrors = {};

        if (!email) validationErrors.email = ['email is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }

        const result = await useCase.RequestRegistrationOtp({ email });

        return reply.code(200).send(buildSuccessResponse({
          message: 'OTP sent to your email',
          data: result.email
        }));
      } catch (err) {
        authLogger.error('RequestRegistrationOtp error', { message: err.message, stack: err.stack });

        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        if (err.message === 'email_taken') {
          return reply.code(409).send(buildErrorResponse('Email already registered'));
        }

        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    ResendRegistrationOtp: async (req, reply) => {
      try {
        const { email } = req.body || {};
        const validationErrors = {};

        if (!email) validationErrors.email = ['email is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }

        const result = await useCase.ResendRegistrationOtp({ email });

        return reply.code(200).send(buildSuccessResponse({
          message: 'OTP sent to your email',
          data: result.email
        }));
      } catch (err) {
        authLogger.error('ResendRegistrationOtp error', { message: err.message, stack: err.stack });

        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        if (err.message === 'email_taken') {
          return reply.code(409).send(buildErrorResponse('Email already registered'));
        }

        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    RegisterUserWithEmailPassword: async (req, reply) => {
      try {
        const { email, password, fullName } = req.body;
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!password) validationErrors.password = ['password is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }
        const result = await useCase.InitiateRegistration({ email, password, fullName });
        authLogger.info('InitiateRegistration result', result);
        return reply.code(200).send(buildSuccessResponse({
          message: result.message,
          data: { otpId: result.otpId }
        }));
      } catch (err) {
        authLogger.error('RegisterUserWithEmailPassword error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }
        if (err.message === 'email_taken') {
          return reply.code(409).send(buildErrorResponse('Email already registered'));
        }
        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    CompleteRegistration: async (req, reply) => {
      try {
        const { email, name, ref_code: refCode, otpCode, password } = req.body || {};
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!name) validationErrors.name = ['name is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }

        // password is optional here because a temporary hashed password may be stored with the OTP
        const { user, token } = await useCase.CompleteRegistration({
          email,
          name,
          refCode,
          otpCode,
          password
        });
        const decoded = jwt.decode(token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        // expose authenticated subject on request for downstream handlers in same request lifecycle
        try {
          req.user = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        } catch (e) {
          req.user = user || null;
        }
        // Record login history (controllers have request context)
        if (useCase && useCase.loginHistoryRepository && typeof useCase.loginHistoryRepository.create === 'function') {
          await useCase.loginHistoryRepository.create({
            id: uuidv4(),
            user_id: user.id,
            login_method: 'email_password',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || null,
            login_at: new Date()
          });
        }
        if (!token) authLogger.warn('CompleteRegistration produced no token', { user: user && user.id });
        const userObj = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        if (userObj) userObj.api_token = token || null;
        return reply.code(201).send(buildSuccessResponse({
          data: userObj,
          token
        }));
      } catch (err) {
        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('CompleteRegistration invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send(buildErrorResponse('Invalid OTP code. Please check and try again.'));
        }
        authLogger.error('CompleteRegistration error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }
        if (err.message === 'invalid_or_expired_otp') {
          return reply.code(401).send(buildErrorResponse('Invalid OTP code. Please check and try again.'));
        }
        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    LoginUserWithEmailPassword: async (req, reply) => {
      try {
        const { email, password } = req.body;
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!password) validationErrors.password = ['password is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }

        const { user, token } = await useCase.LoginWithEmailPassword({ email, password });
        const decoded = jwt.decode(token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        try {
          req.user = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        } catch (e) {
          req.user = user || null;
        }
        // Record login history (controllers have request context)
        if (useCase && useCase.loginHistoryRepository && typeof useCase.loginHistoryRepository.create === 'function') {
          await useCase.loginHistoryRepository.create({
            id: uuidv4(),
            user_id: user.id,
            login_method: 'email_password',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || null,
            login_at: new Date()
          });
        }
        if (!token) authLogger.warn('LoginUserWithEmailPassword produced no token', { email });
        const userObj = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        if (userObj) userObj.api_token = token || null;
        return reply.code(200).send(buildSuccessResponse({
          data: userObj,
          token
        }));
      } catch (err) {
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        if (err.message === 'invalid_credentials') {
          authLogger.warn('Login failed: invalid credentials', { email: req.body && req.body.email });
          return reply.code(401).send({ message: 'Invalid credentials' });
        }

        authLogger.error('LoginUserWithEmailPassword error', { message: err.message, stack: err.stack });
        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    RequestOtp: async (req, reply) => {
      try {
        const { email, purpose } = req.body;
        if (!email) {
          return reply.code(422).send(buildValidationResponse({ email: ['email is required'] }));
        }

        const res = await useCase.RequestOtp({ email, purpose });
        if (purpose === 'password_reset') {
          return reply.code(200).send(buildSuccessResponse({
            message: 'We have sent a 6-digit OTP to your email address. It will expire in 120 minutes.'
          }));
        }

        return reply.code(200).send(buildSuccessResponse({
          message: 'OTP sent successfully',
          data: res.sessionToken || res.otpId || null
        }));
      } catch (err) {
        authLogger.error('RequestOtp error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        // For password reset requests, do not reveal whether the email exists.
        // Return a generic success message so callers cannot enumerate accounts.
        const reqPurpose = (req.body && req.body.purpose) || undefined;
        if (err.message === 'user_not_found' && reqPurpose === 'password_reset') {
          return reply.code(200).send(buildSuccessResponse({
            message: 'We have sent a 6-digit OTP to your email address. It will expire in 120 minutes.'
          }));
        }

        if (err.message === 'user_not_found') {
          return reply.code(404).send(buildErrorResponse('User not found'));
        }

        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    VerifyOtp: async (req, reply) => {
      try {
        const rawEmail = req.body && req.body.email;
        const rawOtp = req.body && req.body.otpCode;

        const email = rawEmail ? String(rawEmail).trim().toLowerCase() : rawEmail;
        const otpCode = rawOtp ? String(rawOtp).trim() : rawOtp;

        const validationErrors = {};
        if (!email) 
          validationErrors.email = ['email is required'];
        if (!otpCode) 
          validationErrors.otpCode = ['otpCode is required'];

        if (Object.keys(validationErrors).length > 0) {
          const normalizedValidationErrors = { ...validationErrors };
          if (normalizedValidationErrors.otpCode) {
            normalizedValidationErrors.otp = normalizedValidationErrors.otpCode;
            delete normalizedValidationErrors.otpCode;
          }
          return reply.code(422).send(buildValidationResponse(normalizedValidationErrors));
        }

        const result = await useCase.VerifyRegistrationOtp({ email, otpCode });

        return reply.code(200).send(buildSuccessResponse({
          message: 'Email verified successfully',
          data: result.email
        }));
      } catch (err) {
        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('VerifyOtp invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send(buildErrorResponse('Invalid OTP code. Please check and try again.'));
        }
        authLogger.error('VerifyOtp error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }
        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    SetRegistrationPassword: async (req, reply) => {
      try {
        const { email, password } = req.body || {};
        const validationErrors = {};

        if (!email) validationErrors.email = ['email is required'];
        if (!password) validationErrors.password = ['password is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send(buildValidationResponse(validationErrors));
        }

        const result = await useCase.SetRegistrationPassword({ email, password });

        return reply.code(200).send(buildSuccessResponse({
          message: 'Password set successfully',
          data: result.email
        }));
      } catch (err) {
        authLogger.error('SetRegistrationPassword error', { message: err.message, stack: err.stack });

        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        if (err.message === 'registration_not_verified') {
          return reply.code(400).send(buildErrorResponse('Email not verified. Please verify your email first.'));
        }

        if (err.message === 'password_required') {
          return reply.code(422).send(buildValidationResponse({ password: ['password is required'] }));
        }

        return reply.code(500).send(buildErrorResponse('An unexpected error occurred'));
      }
    },

    ResetPassword: async (req, reply) => {
      try {
        const {
          email,
          otpCode,
          newPassword,
          password_confirmation: passwordConfirmation
        } = req.body || {};
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!otpCode) validationErrors.otpCode = ['otpCode is required'];
        if (!newPassword) validationErrors.newPassword = ['newPassword is required'];
        if (!passwordConfirmation) validationErrors.password_confirmation = ['password_confirmation is required'];
        if (newPassword && passwordConfirmation && newPassword !== passwordConfirmation) {
          validationErrors.password_confirmation = ['password confirmation does not match'];
        }

        if (Object.keys(validationErrors).length > 0) {
          const normalizedValidationErrors = { ...validationErrors };
          if (normalizedValidationErrors.otpCode) {
            normalizedValidationErrors.otp = normalizedValidationErrors.otpCode;
            delete normalizedValidationErrors.otpCode;
          }
          if (normalizedValidationErrors.newPassword) {
            normalizedValidationErrors.password = normalizedValidationErrors.newPassword;
            delete normalizedValidationErrors.newPassword;
          }
          return reply.code(422).send(buildValidationResponse(normalizedValidationErrors));
        }

        await useCase.ResetPassword({ email, otpCode, newPassword });
        return reply.code(200).send(buildSuccessResponse({
          message: 'Your password has been reset successfully!'
        }));
      } catch (err) {
        authLogger.error('ResetPassword error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send(buildValidationResponse({ email: ['email must be a valid email address'] }));
        }

        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('ResetPassword invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send(buildErrorResponse('Invalid OTP code. Please check and try again.'));
        }

        if (err.message === 'user_not_found') {
          return reply.code(404).send(buildErrorResponse('User not found'));
        }

        const msg = String(err.message || '').toLowerCase();
        if (err.code === 'ECONNREFUSED' || msg.includes('ecconnrefused')
          || msg.includes('connect') || msg.includes('connection')) {
          return reply.code(503).send(buildErrorResponse('Service temporarily unavailable. Please try again later.'));
        }

        return reply.code(500).send(buildErrorResponse('Unable to reset password. Please try again later.'));
      }
    },

    TokenSignIn: async (req, reply) => {
      try {
        const { idToken } = req.body;
        if (!idToken) {
          return reply.code(422).send(buildValidationResponse({ idToken: ['idToken is required'] }));
        }

        const result = await useCase.LoginWithGoogle({ profile: { idToken } });
        const decoded = jwt.decode(result.token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        try {
          req.user = (result.user && typeof result.user.toPlainObject === 'function') ? result.user.toPlainObject() : (result.user || null);
        } catch (e) {
          req.user = result.user || null;
        }
        // Record login history (controllers have request context)
        if (useCase && useCase.loginHistoryRepository && typeof useCase.loginHistoryRepository.create === 'function') {
          await useCase.loginHistoryRepository.create({
            id: uuidv4(),
            user_id: result.user.id,
            login_method: 'google_oauth',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || null,
            login_at: new Date()
          });
        }
        const userObj = (result.user && typeof result.user.toPlainObject === 'function') ? result.user.toPlainObject() : (result.user || null);
        if (userObj) userObj.api_token = result.token || null;
        return reply.code(200).send(buildSuccessResponse({
          message: 'Login successful',
          data: userObj,
          token: result.token
        }));
      } catch (err) {
        authLogger.error('TokenSignIn error', { message: err.message, stack: err.stack });
        return reply.code(401).send(buildErrorResponse('Invalid or expired token'));
      }
    },

    RefreshToken: async (req, reply) => {
      try {
        const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
        if (!auth) 
          return reply.code(401).send(buildErrorResponse('Authorization header missing'));
        const token = String(auth).split(' ')[1];
        if (!token) 
          return reply.code(401).send(buildErrorResponse('Malformed Authorization header'));
        let payload;
        try {
          payload = jwt.verify(token, useCase.jwtSecret || process.env.JWT_SECRET);
        } catch (e) {
          return reply.code(401).send(buildErrorResponse('Token invalid or expired'));
        }
        const newToken = jwt.sign({ sub: payload.sub, email: payload.email, tv: payload.tv || 0 }, useCase.jwtSecret || process.env.JWT_SECRET, { expiresIn: useCase.jwtExpiresIn || '7d' });
        const user = await useCase.userRepository.findById(payload.sub);
        const userObj = user && typeof user.toPlainObject === 'function' ? user.toPlainObject() : (user || null);
        if (userObj) userObj.api_token = newToken;
        return reply.code(200).send(buildSuccessResponse({
          message: 'Token refreshed successfully',
          token: newToken,
          data: userObj || { api_token: newToken }
        }));
      } catch (err) {
        authLogger.error('RefreshToken error', { message: err.message, stack: err.stack });
        return reply.code(500).send(buildErrorResponse('Unable to refresh token'));
      }
    },

    ChangePassword: async (req, reply) => {
      try {
        const userCtx = req.user;
        if (!userCtx || !userCtx.id) 
          return reply.code(401).send(buildErrorResponse('Authentication required'));
        const { current_password, password, password_confirmation } = req.body || {};
        const validationErrors = {};
        if (!current_password) 
          validationErrors.current_password = ['current_password is required'];
        if (!password) 
          validationErrors.password = ['password is required'];
        if (password !== password_confirmation) 
          validationErrors.password_confirmation = ['password confirmation does not match'];
        if (Object.keys(validationErrors).length) 
          return reply.code(422).send(buildValidationResponse(validationErrors));
        const user = await useCase.userRepository.findById(userCtx.id);
        if (!user) 
          return reply.code(404).send(buildErrorResponse('User not found'));
        const ok = await bcrypt.compare(current_password, user.password);
        if (!ok) 
          return reply.code(401).send(buildErrorResponse('Current password is incorrect'));
        const hashed = await bcrypt.hash(password, 10);
        await useCase.userRepository.updatePassword(user.id, hashed);
        return reply.code(200).send(buildSuccessResponse({
          message: 'Password updated successfully',
          data: []
        }));
      } catch (err) {
        authLogger.error('ChangePassword error', { message: err.message, stack: err.stack });
        return reply.code(500).send(buildErrorResponse('Unable to change password'));
      }
    },

    ChangeEmail: async (req, reply) => {
      try {
        const userCtx = req.user;
        if (!userCtx || !userCtx.id) return reply.code(401).send(buildErrorResponse('Authentication required'));
        const { new_email } = req.body || {};
        if (!new_email) return reply.code(422).send(buildValidationResponse({ new_email: ['new_email is required'] }));
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otp = {
          id: uuidv4(),
          userId: userCtx.id,
          email: new_email,
          otpCode,
          purpose: 'email_change',
          isUsed: false,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          createdAt: new Date()
        };
        if (!useCase.userRepository || typeof useCase.userRepository.createOtp !== 'function') {
          return reply.code(501).send(buildErrorResponse('Email change flow not configured'));
        }
        await useCase.userRepository.createOtp(otp);
        if (useCase.emailQueue) {
          try {
            await useCase.emailQueue.add('email_change', { to: new_email, otpCode }, { attempts: 1, removeOnComplete: true });
          } catch (qerr) {
            authLogger.warn('Failed to queue change-email notification', { message: qerr.message });
          }
        }
        return reply.code(200).send(buildSuccessResponse({
          message: 'Email change requested. Please verify.',
          data: { email: new_email }
        }));
      } catch (err) {
        authLogger.error('ChangeEmail error', { message: err.message, stack: err.stack });
        return reply.code(500).send(buildErrorResponse('Unable to request email change'));
      }
    }
  };
}
