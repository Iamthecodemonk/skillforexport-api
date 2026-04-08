import logger from '../../utils/logger.js';

const authLogger = logger.child('AUTH_CONTROLLER');

export function makeAuthController({ useCase }) {
  return {
    RegisterUserWithEmailPassword: async (req, reply) => {
      try {
        const { email, password, fullName } = req.body ;
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
        return reply.code(201).send({
          success: true,
          data: { token, user: user.toPlainObject() }
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
        const { email, password } = req.body ;
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
        return reply.code(200).send({
          success: true,
          data: { token, user: user.toPlainObject() }
        });
      } catch (err) {
        authLogger.error('LoginUserWithEmailPassword error', { message: err.message, stack: err.stack });
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
        return reply.code(401).send({
          success: false,
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password'
          }
        });
      }
    },

    RequestOtp: async (req, reply) => {
      try {
        const { email, purpose } = req.body ;
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
        return reply.code(200).send({
          success: true,
          data: { token, user: user.toPlainObject() }
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
        const { email, newPassword } = req.body ;
        const validationErrors = {};
        if (!email) validationErrors.email = ['email is required'];
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

        const user = await useCase.ResetPassword({ email, newPassword });
        return reply.code(200).send({
          success: true,
          data: { id: user.id }
        });
      } catch (err) {
        authLogger.error('ResetPassword error', { message: err.message, stack: err.stack });
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

    TokenSignIn: async (req, reply) => {
      try {
        const { idToken } = req.body ;
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
        return reply.code(200).send({
          success: true,
          data: { token: result.token, user: result.user.toPlainObject() }
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