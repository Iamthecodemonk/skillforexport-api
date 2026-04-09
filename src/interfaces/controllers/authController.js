import logger from '../../utils/logger.js';
import jwt from 'jsonwebtoken';

const authLogger = logger.child('AUTH_CONTROLLER');

export function makeAuthController({ useCase }) {
  return {
    RegisterUserWithEmailPassword: async (req, reply) => {
      try {
        const { email, password, fullName } = req.body;
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!password) validationErrors.password = ['password is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: validationErrors
            }
          });
        }
        const result = await useCase.InitiateRegistration({ email, password, fullName });
        authLogger.info('InitiateRegistration result', result);
        return reply.code(200).send({
          success: true,
          data: { otpId: result.otpId, message: result.message }
        });
      } catch (err) {
        authLogger.error('RegisterUserWithEmailPassword error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email must be a valid email address'] }
            }
          });
        }
        if (err.message === 'email_taken') {
          return reply.code(409).send({
            success: false,
            error: {
              code: 'email_already_exists',
              message: 'Email already registered'
            }
          });
        }
        return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    },

    CompleteRegistration: async (req, reply) => {
      try {
        const { email, password, otpCode } = req.body || {};
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!otpCode) validationErrors.otpCode = ['otpCode is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: validationErrors
            }
          });
        }

        // password is optional here because a temporary hashed password may be stored with the OTP
        const { user, token } = await useCase.CompleteRegistration({ email, otpCode, password });
        const decoded = jwt.decode(token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        // expose authenticated subject on request for downstream handlers in same request lifecycle
        try {
          req.user = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        } catch (e) {
          req.user = user || null;
        }
        return reply.code(201).send({
          success: true,
          data: { accessToken: token, tokenType: 'Bearer', expiresIn }
        });
      } catch (err) {
        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('CompleteRegistration invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send({
            success: false,
            error: {
              code: 'invalid_or_expired_otp',
              message: 'OTP is invalid or expired'
            }
          });
        }
        authLogger.error('CompleteRegistration error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email must be a valid email address'] }
            }
          });
        }
        if (err.message === 'invalid_or_expired_otp') {
          // already handled above - defensive fallback just in case sha
          return reply.code(401).send({
            success: false,
            error: {
              code: 'invalid_or_expired_otp',
              message: 'OTP is invalid or expired'
            }
          });
        }
        return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    },

    LoginUserWithEmailPassword: async (req, reply) => {
      try {
        const { email, password } = req.body;
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!password) validationErrors.password = ['password is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: validationErrors
            }
          });
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
        return reply.code(200).send({
          success: true,
          data: { accessToken: token, tokenType: 'Bearer', expiresIn }
        });
      } catch (err) {
        // Domain validation: invalid email format
        if (err.message === 'invalid_email_format') return reply.code(422).send({
          success: false,
          error: {
            code: 'validation_failed',
            message: 'Validation failed',
            details: { email: ['email must be a valid email address'] }
          }
        });

        // Authentication failure: log at WARN level and return structured 401
        if (err.message === 'invalid_credentials') {
          authLogger.warn('Login failed: invalid credentials', { email: req.body && req.body.email });
          return reply.code(401).send({
            success: false,
            error: {
              code: 'invalid_credentials',
              message: 'Invalid email or password'
            }
          });
        }

        // Unexpected errors: log details server-side but do not expose internals to users
        authLogger.error('LoginUserWithEmailPassword error', { message: err.message, stack: err.stack });
        return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    },

    RequestOtp: async (req, reply) => {
      try {
        const { email, purpose } = req.body;
        if (!email) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email is required'] }
            }
          });
        }

        const res = await useCase.RequestOtp({ email, purpose });
        return reply.code(200).send({
          success: true,
          data: { otpId: res.otpId }
        });
      } catch (err) {
        authLogger.error('RequestOtp error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email must be a valid email address'] }
            }
          });
        }

        // For password reset requests, do not reveal whether the email exists.
        // Return a generic success message so callers cannot enumerate accounts.
        const reqPurpose = (req.body && req.body.purpose) || undefined;
        if (err.message === 'user_not_found' && reqPurpose === 'password_reset') {
          return reply.code(200).send({
            success: true,
            data: { message: 'If an account with that email exists, a reset token will be sent.' }
          });
        }

        if (err.message === 'user_not_found') {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'user_not_found',
              message: 'User not found'
            }
          });
        }

        return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    },

    VerifyOtp: async (req, reply) => {
      try {
        // Normalize inputs to avoid whitespace/case mismatches and accept common aliases
        const rawEmail = req.body && req.body.email;
        const rawOtp = req.body && req.body.otpCode;
        const rawPurpose = req.body && req.body.purpose;

        const email = rawEmail ? String(rawEmail).trim().toLowerCase() : rawEmail;
        const otpCode = rawOtp ? String(rawOtp).trim() : rawOtp;
        let purpose = rawPurpose ? String(rawPurpose).trim().toLowerCase() : undefined;
        if (purpose === 'code') purpose = 'registration';

        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!otpCode) validationErrors.otpCode = ['otpCode is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: validationErrors
            }
          });
        }

        const { user, token } = await useCase.VerifyOtp({ email, otpCode, purpose });
        const decoded = jwt.decode(token) || {};
        const now = Math.floor(Date.now() / 1000);
        const expiresIn = decoded.exp ? Math.max(0, decoded.exp - now) : 0;
        try {
          req.user = (user && typeof user.toPlainObject === 'function') ? user.toPlainObject() : (user || null);
        } catch (e) {
          req.user = user || null;
        }
        return reply.code(200).send({
          success: true,
          data: { accessToken: token, tokenType: 'Bearer', expiresIn }
        });
      } catch (err) {
        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('VerifyOtp invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send({
            success: false,
            error: {
              code: 'invalid_or_expired_otp',
              message: 'OTP is invalid or expired'
            }
          });
        }
        authLogger.error('VerifyOtp error', { message: err.message, stack: err.stack });
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email must be a valid email address'] }
            }
          });
        }
        return reply.code(500).send({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred'
          }
        });
      }
    },

    ResetPassword: async (req, reply) => {
      try {
        const { email, otpCode, newPassword } = req.body || {};
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
        if (!otpCode) validationErrors.otpCode = ['otpCode is required'];
        if (!newPassword) validationErrors.newPassword = ['newPassword is required'];

        if (Object.keys(validationErrors).length > 0) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: validationErrors
            }
          });
        }

        const user = await useCase.ResetPassword({ email, otpCode, newPassword });
        return reply.code(200).send({
          success: true,
          data: { id: user.id }
        });
      } catch (err) {
        authLogger.error('ResetPassword error', { message: err.message, stack: err.stack });
        // Domain-level validation
        if (err.message === 'invalid_email_format') {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { email: ['email must be a valid email address'] }
            }
          });
        }

        if (err.message === 'invalid_or_expired_otp') {
          authLogger.warn('ResetPassword invalid or expired OTP', { email: req.body && req.body.email });
          return reply.code(401).send({
            success: false,
            error: {
              code: 'invalid_or_expired_otp',
              message: 'OTP is invalid or expired'
            }
          });
        }

        // Known domain error: user not found
        if (err.message === 'user_not_found') {
          return reply.code(404).send({
            success: false,
            error: {
              code: 'user_not_found',
              message: 'User not found'
            }
          });
        }

        // Map common infrastructure errors to user-friendly messages without leaking internals
        const msg = String(err.message || '').toLowerCase();
        if (err.code === 'ECONNREFUSED' || msg.includes('ecconnrefused')
          || msg.includes('connect') || msg.includes('connection')) {
          return reply.code(503).send({
            success: false,
            error: {
              code: 'service_unavailable',
              message: 'Service temporarily unavailable. Please try again later.'
            }
          });
        }

        // Fallback: do not expose raw DB or stack details to clients
        return reply.code(500).send({
          success: false,
          error: {
            code: 'reset_failed',
            message: 'Unable to reset password. Please try again later.'
          }
        });
      }
    },

    TokenSignIn: async (req, reply) => {
      try {
        const { idToken } = req.body;
        if (!idToken) {
          return reply.code(422).send({
            success: false,
            error: {
              code: 'validation_failed',
              message: 'Validation failed',
              details: { idToken: ['idToken is required'] }
            }
          });
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
        return reply.code(200).send({
          success: true,
          data: { accessToken: result.token, tokenType: 'Bearer', expiresIn }
        });
      } catch (err) {
        authLogger.error('TokenSignIn error', { message: err.message, stack: err.stack });
        return reply.code(401).send({
          success: false,
          error: {
            code: 'invalid_token',
            message: 'Invalid or expired token'
          }
        });
      }
    }
  };
}