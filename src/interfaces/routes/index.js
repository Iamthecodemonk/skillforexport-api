import schemas from '../docs/schemas.js';
import logger from '../../utils/logger.js';
import { sendError } from '../errorResponse.js';
import 'dotenv/config';

const routesLogger = logger.child('ROUTES');

export default async function registerRoutes(fastify, deps) {
  routesLogger.info('Registering routes', { controllers: Object.keys(deps.controllers) });

  // Default fallback handler for missing controllers
  const fallback = async (req, reply) => {
    return sendError(reply, 501, 'handler_not_implemented', 'Handler not implemented');
  };

  // Helper to get handler or fallback
  const handler = (name) => deps.controllers[name] || fallback;

  // ========== Root ==========
  fastify.get('/', {
    schema: {
      operationId: 'getRoot',
      description: 'API root endpoint'
    }
  }, async (req, reply) => {
    return reply.send({ message: 'Fastify Clean Architecture API' });
  });

  // ========== Health ==========
  fastify.get('/health', {
    schema: {
      operationId: 'getHealth',
      tags: ['Health'],
      description: 'Check API health status',
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string' } }
        }
      }
    }
  }, handler('health'));

  // Items feature removed

  // Legacy `/auth/*` routes removed — unified API endpoints live under the single API surface
  // Examples: /register/send-otp, /register/verify-otp, /register/complete, /login, /forgot-password, /reset-password

  // ========== Google OAuth ==========
  fastify.get('/auth/google', {
    schema: {
      operationId: 'googleRedirect',
      tags: ['Auth'],
      description: 'Redirect to Google OAuth consent screen'
    }
  }, handler('GoogleRedirect'));

  fastify.get('/auth/google/callback', {
    schema: {
      operationId: 'googleCallback',
      tags: ['Auth'],
      description: 'Google OAuth callback handler'
    }
  }, handler('GoogleCallback'));

  fastify.post(
    '/auth/google/token',
    {
      schema: {
        operationId: 'googleTokenSignIn',
        tags: ['Auth'],
        description: 'Exchange a Google ID token for an application auth token.',
        body: schemas.TokenSignInBody,
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.GenericErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        idToken: req.body && (req.body.id_token || req.body.idToken)
      });

      return handler('TokenSignIn')(req, reply);
    }
  );

  // ======= Unified API auth endpoints (single flow used by web and mobile)
  // Register the common API endpoints under `/api/*` and call existing controllers directly.
  const authPre = deps && deps.authRequired ? deps.authRequired : undefined;

  fastify.post(
    '/register/send-otp',
    {
      schema: {
        operationId: 'sendRegistrationOtp',
        tags: ['Auth'],
        description: 'Start registration by sending an OTP to the supplied email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('RequestRegistrationOtp')
  );

  fastify.post(
    '/register/verify-otp',
    {
      schema: {
        operationId: 'verifyRegistrationOtp',
        tags: ['Auth'],
        description: 'Verify the OTP code sent during registration before completing account creation.',
        body: schemas.VerifyOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        otpCode: req.body && (req.body.otp || req.body.otpCode)
      });

      return handler('VerifyOtp')(req, reply);
    }
  );

  fastify.post(
    '/register/resend-otp',
    {
      schema: {
        operationId: 'resendRegistrationOtp',
        tags: ['Auth'],
        description: 'Resend the registration OTP to the provided email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('ResendRegistrationOtp')
  );

  fastify.post(
    '/register/set-password',
    {
      schema: {
        operationId: 'setRegistrationPassword',
        tags: ['Auth'],
        description: 'Set the password during the registration flow after email ownership has been verified.',
        body: schemas.RegisterSetPasswordBody,
        response: {
          200: schemas.EmptyObjectSuccessResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('SetRegistrationPassword')
  );

  fastify.post(
    '/register/complete',
    {
      schema: {
        operationId: 'completeRegistration',
        tags: ['Auth'],
        description: 'Complete the registration flow and return the created user with an API token.',
        body: schemas.RegisterCompleteBody,
        response: {
          201: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('CompleteRegistration')
  );

  fastify.post(
    '/login',
    {
      schema: {
        operationId: 'loginWithEmailPassword',
        tags: ['Auth'],
        description: 'Authenticate with email and password and return the authenticated user plus API token.',
        body: schemas.LoginBody,
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.MessageOnlyErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    handler('LoginUserWithEmailPassword')
  );

  fastify.post(
    '/forgot-password',
    {
      schema: {
        operationId: 'requestPasswordReset',
        tags: ['Auth'],
        description: 'Request a password reset token or OTP for the supplied email address.',
        body: schemas.RequestOtpBody,
        response: {
          200: schemas.ApiStringResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, { purpose: 'password_reset' });

      return handler('RequestOtp')(req, reply);
    }
  );

  fastify.post(
    '/reset-password',
    {
      schema: {
        operationId: 'resetPassword',
        tags: ['Auth'],
        description: 'Reset a user password with a reset token or OTP previously issued by the platform.',
        body: schemas.ResetPasswordBody,
        response: {
          200: schemas.SimpleSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      req.body = Object.assign({}, req.body, {
        otpCode: req.body && (req.body.otp || req.body.token || req.body.otpCode),
        newPassword: req.body && (req.body.password || req.body.newPassword)
      });

      return handler('ResetPassword')(req, reply);
    }
  );

  fastify.post(
    '/logout',
    {
      preHandler: authPre,
      schema: {
        operationId: 'logoutUser',
        tags: ['Auth'],
        description: 'Invalidate the current authenticated session or token.',
        response: {
          200: schemas.SimpleSuccessResponse,
          401: schemas.AuthErrorResponse
        }
      }
    },
    handler('Logout')
  );

  fastify.post(
    '/refresh-token',
    {
      preHandler: authPre,
      schema: {
        operationId: 'refreshAuthToken',
        tags: ['Auth'],
        description: 'Refresh the current authentication token and return a new token payload.',
        response: {
          200: schemas.AuthSuccessResponse,
          401: schemas.AuthErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.RefreshToken) {
        return sendError(reply, 501, 'not_implemented', 'Refresh token endpoint is not implemented on server');
      }

      return handler('RefreshToken')(req, reply);
    }
  );

  // Auth-required endpoints for changing password/email
  fastify.put(
    '/user/change-password',
    {
      preHandler: authPre,
      schema: {
        operationId: 'changeUserPassword',
        tags: ['Auth'],
        description: 'Change the password for the currently authenticated user.',
        body: schemas.ChangePasswordBody,
        response: {
          200: schemas.EmptyArraySuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.ChangePassword) {
        return sendError(reply, 501, 'not_implemented', 'Change password not implemented');
      }

      req.body = Object.assign({}, req.body, {
        oldPassword: req.body && (req.body.current_password || req.body.oldPassword),
        newPassword: req.body && (req.body.password || req.body.newPassword)
      });

      return handler('ChangePassword')(req, reply);
    }
  );

  fastify.put(
    '/user/change-email',
    {
      preHandler: authPre,
      schema: {
        operationId: 'changeUserEmail',
        tags: ['Auth'],
        description: 'Change the email address for the currently authenticated user.',
        body: schemas.ChangeEmailBody,
        response: {
          200: schemas.EmailObjectSuccessResponse,
          401: schemas.AuthErrorResponse,
          422: schemas.ValidationErrorResponse
        }
      }
    },
    async (req, reply) => {
      if (!deps.controllers || !deps.controllers.ChangeEmail) {
        return sendError(reply, 501, 'not_implemented', 'Change email not implemented');
      }

      req.body = Object.assign({}, req.body, {
        newEmail: req.body && (req.body.new_email || req.body.newEmail)
      });

      return handler('ChangeEmail')(req, reply);
    }
  );

  // ========== Users ==========
  fastify.get('/users/:id', {
    schema: {
      operationId: 'getUser',
      tags: ['Users'],
      description: 'Get a user record by id.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                username: { type: ['string', 'null'] },
                role: { type: ['string', 'null'] }
              }
            }
          },
          example: { success: true, data: { id: 'user-uuid', email: 'user@example.com', username: 'janedoe', role: 'user' } }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getUser'));

  fastify.post('/users', {
    schema: {
      operationId: 'createUser',
      tags: ['Users'],
      description: 'Create a user',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] }
        },
        example: { email: 'user@example.com', password: 'P@ssw0rd', role: 'user' }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' } } }
          }
        },
        422: { type: 'object' },
        409: { type: 'object' }
      }
    }
  }, handler('createUser'));

  fastify.get('/users/:id/profile', {
    schema: {
      operationId: 'getUserProfile',
      tags: ['Users'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: schemas.FullProfileResponse
          }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getUserProfile'));
  // Authenticated endpoint to return the full assembled profile for the current user
  fastify.get('/user/profile/me', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'getMyProfile',
      tags: ['Users'],
      description: 'Get complete profile for the authenticated user (profile, skills, portfolios, certs, education, experiences, followers, oauth accounts)',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: schemas.FullProfileResponse
          }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('getMyProfile'));

  fastify.get('/user/stats/me', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'getMyStats',
      tags: ['Users'],
      description: 'Get simple counts for the authenticated user: pages, communities, posts, comments',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { pages: { type: 'number' }, communities: { type: 'number' }, posts: { type: 'number' }, comments: { type: 'number' } } } } },
        401: { type: 'object' }
      }
    }
  }, handler('getMyStats'));

  fastify.post('/users/:id/profile', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createUserProfile',
      tags: ['Users'],
      // Embed example into the route body so Swagger UI shows the sample submission payload
      body: Object.assign({}, schemas.UserProfileBody, { example: schemas.UserProfileBody.example }),
      response: {
        201: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            }, data: schemas.UserProfileResponse
          }
        },
        409: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            error: {
              type: 'object',
              properties:
              {
                code: {
                  type: 'string'
                },
                message: {
                  type: 'string'
                }
              }
            }
          }
        },
        422: { type: 'object' }
      }
    }
  }, handler('createProfile'));
  fastify.post('/users/:id/profile/avatar', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserAvatar',
      tags: ['Users'],
      description: 'Upload a profile avatar by URL; validation and Cloudinary upload happen in background. If avatar already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { avatar: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing avatar' }
      ],
      // Support both application/json { imageUrl } and multipart/form-data { file }
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' }
              },
              required: ['file']
            }
          },
          'application/json': { schema: schemas.AvatarUploadBody }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatar'));
  fastify.post('/users/:id/profile/banner', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserBanner',
      tags: ['Users'],
      description: 'Upload a profile banner by URL or multipart file; validation and Cloudinary upload happen in background. If banner already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { banner: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing banner' }
      ],
      // Support both application/json { imageUrl } and multipart/form-data { file }
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: {
                file: { type: 'string', format: 'binary' }
              },
              required: ['file']
            }
          },
          'application/json': { schema: schemas.AvatarUploadBody }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadBanner'));

  // Direct signed upload support
  fastify.get('/media/signature', {
    schema: {
      operationId: 'getCloudinarySignature',
      tags: ['Media'],
      description: 'Get Cloudinary upload signature and credentials for direct client upload',
      response: { 200: schemas.CloudinarySignatureResponse }
    }
  }, handler('getCloudinarySignature'));

  fastify.post('/media/register', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'registerMedia',
      tags: ['Media'],
      description: 'Register a direct client upload (Cloudinary public id) so the server can validate, create an asset record and enqueue processing. Recommended flow: upload media first (or perform direct client upload), then call this endpoint with the provider public id. Server-side validation performed: allowed MIME types (image/jpeg,image/png,image/webp), max file size (enforced by the media worker, see MAX_POST_IMAGE_BYTES env), and optional checks per `kind` (e.g., avatar/banner uniqueness). The endpoint returns a job id — poll `GET /media/jobs/:id` for processing status and detailed per-asset errors (e.g., file_too_large, unsupported_media_type). If you intend to attach media to a post, wait until job status is `completed` and asset record has a `url` before creating the post.',
      body: schemas.MediaRegisterBody,
      response: {
        202: schemas.JobAcceptedResponse,
        409: { type: 'object' },
        422: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object', properties: { assetId: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } } } }
              }
            }
          }
        }
      }
    }
  }, handler('registerMedia'));

  fastify.get('/media/jobs/:id', {
    schema: {
      operationId: 'getMediaJobStatus',
      tags: ['Media'],
      description: 'Get status for a media processing job',
      response: {
        200: schemas.MediaJobStatusResponse,
        404: { type: 'object' },
        503: { type: 'object' }
      }
    }
  }, handler('getJobStatus'));

  // Multipart upload endpoint
  fastify.post('/users/:id/profile/avatar-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadUserAvatarFile',
      tags: ['Media', 'Users'],
      description: 'Upload avatar file (multipart) - server accepts file and enqueues background validation and Cloudinary upload. Use kind=banner to upload a banner. If image already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { avatar: null } or { banner: null }.',
      parameters: [
        { name: 'kind', in: 'query', schema: { type: 'string' }, description: 'Optional kind (avatar, banner, post_image, document) to control validation and folder' },
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing avatar' }
      ],
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: {
        202: schemas.JobAcceptedResponse,
        422: { type: 'object' },
        409: schemas.GenericErrorResponse,
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatarFile'));

  fastify.get('/users/:id/skills', {
    schema: {
      operationId: 'listUserSkills',
      tags: ['Users'],
      description: 'List the skills attached to a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Skill } },
          example: { success: true, data: [schemas.Skill.example] }
        }
      }
    }
  }, handler('listUserSkills'));

  fastify.post('/users/:id/skills', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserSkill',
      tags: ['Users'],
      description: 'Add a skill entry to the user profile.',
      body: {
        type: 'object',
        required: ['skill'],
        properties: { skill: { type: 'string' }, level: { type: 'string' } },
        example: { skill: 'JavaScript', level: 'advanced' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Skill },
          example: { success: true, data: schemas.Skill.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addUserSkill'));

  fastify.delete('/users/:id/skills/:skillId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: {
        operationId:
          'deleteUserSkill',
        tags: ['Users'],
        description: 'Delete a specific skill from the user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    }, handler('deleteSkill'));

  fastify.get('/users/:id/portfolios', {
    schema: {
      operationId: 'listUserPortfolios',
      tags: ['Users'],
      description: 'List portfolio links or projects attached to a user profile.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: schemas.Portfolio }
          },
          example: { success: true, data: [schemas.Portfolio.example] }
        }
      }
    }
  }, handler('listUserPortfolios'));
  fastify.post('/users/:id/portfolios', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserPortfolio',
      tags: ['Users'],
      description: 'Create a portfolio entry for the user profile.',
      body: {
        type: 'object',
        required: ['title'],
        properties: { title: { type: 'string' }, description: { type: 'string' }, link: { type: 'string' } },
        example: { title: 'Personal Website', description: 'Portfolio site', link: 'https://janedoe.dev' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Portfolio },
          example: { success: true, data: schemas.Portfolio.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addUserPortfolio'));
  fastify.delete(
    '/users/:id/portfolios/:portfolioId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteUserPortfolio',
        tags: ['Users'],
        description: 'Delete a portfolio entry from the user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    },
    handler('deletePortfolio')
  );

  fastify.post('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'followUser',
      tags: ['Users'],
      description: 'Follow another user. The authenticated user becomes the follower.',
      body: {
        type: 'object',
        properties: { followerId: { type: 'string' } },
        example: { followerId: 'uuid-or-id' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Follower },
          example: { success: true, data: schemas.Follower.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('followUser'));

  fastify.delete('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowUser',
      tags: ['Users'],
      description: 'Unfollow a user. The response may indicate when the user was not being followed.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: ['string', 'null'] },
                followerId: { type: ['string', 'null'] },
                followingId: { type: ['string', 'null'] },
                createdAt: { type: ['string', 'null'] },
                message: { type: ['string', 'null'] }
              }
            }
          },
          example: { success: true, data: { id: 'follow-uuid', followerId: 'user-uuid-2', followingId: 'user-uuid', createdAt: '2026-04-20T09:00:00Z', message: 'unfollowed' } }
        }
      }
    }
  }, handler('unfollowUser'));

  fastify.get('/users/:id/followers', {
    schema: {
      operationId: 'listFollowers',
      tags: ['Users'],
      description: 'List followers for a user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Follower } },
          example: { success: true, data: [schemas.Follower.example] }
        }
      }
    }
  }, handler('listFollowers'));

  fastify.get('/users/:id/login-history', {
    schema: {
      operationId: 'listLoginHistory',
      tags: ['Users'],
      description: 'List recent login history entries for a user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.UserLoginHistory } },
          example: { success: true, data: [schemas.UserLoginHistory.example] }
        }
      }
    }
  }, handler('listLoginHistory'));

  // Community categories
  fastify.post('/community-categories', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createCommunityCategory',
      tags: ['Communities'],
      description: 'Create a community category used to organize communities.',
      body: schemas.CommunityCategoryCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityCategoryResponse },
          example: { success: true, data: schemas.CommunityCategoryResponse.example }
        },
        409: schemas.GenericErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createCategory'));

  // Public: list all community categories
  fastify.get('/community-categories', {
    schema: {
      operationId: 'listCommunityCategories',
      tags: ['Communities'],
      description: 'List all community categories',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.CommunityCategoryResponse } }
        }
      }
    }
  }, handler('listCategories'));

  fastify.put('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateCommunityCategory',
      tags: ['Communities'],
      description: 'Update a community category by id.',
      body: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, example: { name: 'Sports', description: 'Groups for sports fans' } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityCategoryResponse },
          example: { success: true, data: schemas.CommunityCategoryResponse.example }
        },
        404: schemas.GenericErrorResponse,
        409: schemas.GenericErrorResponse
      }
    }
  }, handler('updateCategory'));

  fastify.delete('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCommunityCategory',
      tags: ['Communities'],
      description: 'Delete a community category.',
      response: { 200: schemas.IdSuccessResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deleteCategory'));

  // Communities
  fastify.post('/communities', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createCommunity',
      tags: ['Communities'],
      description: 'Create a community. The authenticated user becomes the owner.',
      body: schemas.CommunityCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createCommunity'));

  // Public: list communities (supports pagination and filtering)
  fastify.get('/communities', {
    schema: {
      operationId: 'listCommunities',
      tags: ['Communities'],
      description: 'List communities. Supports query params: page, per_page, q (search), categoryId, limit, offset.',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'number' } },
        { name: 'per_page', in: 'query', schema: { type: 'number' } },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search term for name or description' },
        { name: 'categoryId', in: 'query', schema: { type: 'string' } },
        { name: 'limit', in: 'query', schema: { type: 'number' } },
        { name: 'offset', in: 'query', schema: { type: 'number' } }
      ],
      response: {
        200: schemas.PostPaginatedResponse
      }
    }
  }, handler('listCommunities'));

  fastify.get('/communities/:id', {
    schema: {
      operationId: 'getCommunity',
      tags: ['Communities'],
      description: 'Get a community by id.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('getCommunity'));

  fastify.put('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateCommunity',
      tags: ['Communities'],
      description: 'Update community settings. Only the owner or an admin may perform this action.',
      body: schemas.CommunityUpdateBody,
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityResponse },
          example: { success: true, data: schemas.CommunityResponse.example }
        },
        401: schemas.AuthErrorResponse,
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updateCommunity'));

  fastify.delete('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCommunity',
      tags: ['Communities'],
      description: 'Delete a community. Only the owner or an admin may perform this action.',
      response: { 200: schemas.IdSuccessResponse, 401: schemas.AuthErrorResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deleteCommunity'));

  fastify.post('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'joinCommunity',
      tags: ['Communities'],
      description: 'Join a community as the authenticated user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommunityMemberResponse },
          example: { success: true, data: schemas.CommunityMemberResponse.example }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('joinCommunity'));

  fastify.delete('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'leaveCommunity',
      tags: ['Communities'],
      description: 'Leave a community as the authenticated user.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { removed: { type: 'boolean' } } } },
          example: { success: true, data: { removed: true } }
        },
        401: schemas.AuthErrorResponse,
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('leaveCommunity'));

  fastify.get('/communities/:id/members', {
    schema: {
      operationId: 'listCommunityMembers',
      tags: ['Communities'],
      description: 'List members in a community.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.CommunityMemberResponse } },
          example: { success: true, data: [schemas.CommunityMemberResponse.example] }
        }
      }
    }
  }, handler('listMembers'));

  fastify.post('/users/:id/oauth-accounts', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createOauthAccount',
      tags: ['Users'],
      description: 'Link an OAuth account to a user.',
      body: {
        type: 'object',
        required: ['provider', 'providerId'],
        properties: { provider: { type: 'string' }, providerId: { type: 'string' }, accessToken: { type: 'string' } },
        example: { provider: 'google', providerId: 'google-12345', accessToken: 'ya29.a0Af...' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.OAuthAccount },
          example: { success: true, data: schemas.OAuthAccount.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createOauthAccount'));

  // ========== User Certifications ==========
  fastify.get('/users/:id/certifications', {
    schema: {
      operationId: 'listCertifications',
      tags: ['Users'],
      description: 'List certification entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: schemas.Certification }
          },
          example: { success: true, data: [schemas.Certification.example] }
        }
      }
    }
  }, handler('listCertifications'));

  fastify.post('/users/:id/certifications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addCertification',
      tags: ['Users'],
      description: 'Add a certification to a user profile.',
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, issuer: { type: 'string' }, issueDate: { type: 'string' } },
        example: { name: 'Certified Kubernetes Administrator', issuer: 'CNCF', issueDate: '2021-08-01' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Certification },
          example: { success: true, data: schemas.Certification.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addCertification'));

  fastify.delete('/users/:id/certifications/:certId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCertification',
      tags: ['Users'],
      description: 'Delete a certification from a user profile.',
      response: { 200: schemas.IdSuccessResponse }
    }
  }, handler('deleteCertification'));

  // ========== User Education ==========
  fastify.get('/users/:id/education', {
    schema: {
      operationId: 'listEducation',
      tags: ['Users'],
      description: 'List education entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Education } },
          example: { success: true, data: [schemas.Education.example] }
        }
      }
    }
  }, handler('listEducation'));

  fastify.post('/users/:id/education', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addEducation',
      tags: ['Users'],
      description: 'Add an education entry to a user profile.',
      body: {
        type: 'object',
        required: ['school'],
        properties: { school: { type: 'string' }, degree: { type: 'string' }, field: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } },
        example: { school: 'University', degree: 'BSc Computer Science', field: 'Computer Science', startDate: '2015-09-01', endDate: '2019-06-01' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Education },
          example: { success: true, data: schemas.Education.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addEducation'));

  fastify.delete('/users/:id/education/:eduId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteEducation', tags: ['Users'], description: 'Delete an education entry from a user profile.', response: { 200: schemas.IdSuccessResponse } }
  }, handler('deleteEducation'));

  // ========== User Experiences ==========
  fastify.get('/users/:id/experiences', {
    schema: {
      operationId: 'listExperiences',
      tags: ['Users'],
      description: 'List work experience entries for a user profile.',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.Experience } },
          example: { success: true, data: [schemas.Experience.example] }
        }
      }
    }
  }, handler('listExperiences'));

  fastify.post('/users/:id/experiences', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addExperience',
      tags: ['Users'],
      description: 'Add a work experience entry to a user profile.',
      body: {
        type: 'object',
        required: ['company', 'title'],
        properties: { company: { type: 'string' }, title: { type: 'string' }, employmentType: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, isCurrent: { type: 'boolean' }, description: { type: 'string' } },
        example: { company: 'Acme Corp', title: 'Senior Engineer', employmentType: 'full-time', startDate: '2020-01-01', endDate: '2022-12-31', isCurrent: false, description: 'Worked on X' }
      },
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.Experience },
          example: { success: true, data: schemas.Experience.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('addExperience'));

  fastify.delete(
    '/users/:id/experiences/:expId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteExperience',
        tags: ['Users'],
        description: 'Delete a work experience entry from a user profile.',
        response: { 200: schemas.IdSuccessResponse }
      }
    },
    handler('deleteExperience')
  );

  // ========== Posts ==========
  fastify.post('/posts', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createPost',
      tags: ['Posts'],
      description: 'Create a new post. Provide `title` and `content` in body. Optional `communityId`. Upload media first (use /media/register or media endpoints), wait until media job(s) are processed, then include their `mediaAssetIds` here — the server will validate that each asset is processed and has a URL before creating the post.',
      body: schemas.PostCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PostResponse }
        },
        422: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'array', items: { type: 'object', properties: { assetId: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } } } }
              }
            }
          }
        }
      }
    }
  }, handler('createPost'));

  fastify.get('/posts', {
    schema: {
      operationId: 'listPosts',
      tags: ['Posts'],
      description: 'List posts (feed). Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }, { name: 'lastCreatedAt', in: 'query', schema: { type: 'string', description: 'Use for keyset pagination: ISO timestamp of last item from previous page' } }, { name: 'lastId', in: 'query', schema: { type: 'string', description: 'Use with `lastCreatedAt` for keyset pagination: last item id from previous page' } }],
      response: { 200: schemas.PostPaginatedResponse }
    }
  }, handler('listPosts'));

  fastify.get('/posts/:id', {
    schema: {
      operationId: 'getPost',
      tags: ['Posts'],
      description: 'Get a single post by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostResponse } }, 404: { type: 'object' } }
    }
  }, handler('getPost'));

  fastify.put('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'updatePost',
      tags: ['Posts'],
      description: 'Update a post. Provide `userId` and `content` in body.',
      body: { type: 'object', properties: { userId: { type: 'string' }, content: { type: 'string' } }, example: { userId: 'user-uuid', content: 'Updated post content' } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PostResponse },
          example: { success: true, data: schemas.PostResponse.example }
        },
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updatePost'));

  fastify.delete('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'deletePost',
      tags: ['Posts'],
      description: 'Delete a post. Provide `userId` in body to verify ownership.',
      body: { type: 'object', properties: { userId: { type: 'string' } } },
      response: { 200: schemas.EmptyArraySuccessResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deletePost'));

  // Post media endpoints
  fastify.post('/posts/:id/media', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.mediaFile, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'attachPostMedia',
      tags: ['Posts', 'Media'],
      description: 'Attach media to a post by URL (server enqueues background validation/upload).',
      body: schemas.PostMediaAttachBody,
      response: { 202: schemas.JobAcceptedResponse, 422: { type: 'object' }, 503: { type: 'object' } }
    }
  }, handler('attachMediaByUrl'));

  // ========== Comments ==========
  fastify.post('/posts/:id/comments', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.comments, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createComment',
      tags: ['Posts', 'Comments'],
      description: 'Create a comment on a post',
      body: schemas.CommentCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.CommentResponse },
          example: { success: true, data: schemas.CommentResponse.example }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('createComment'));

  fastify.get('/posts/:id/comments', {
    schema: {
      operationId: 'listComments',
      tags: ['Posts', 'Comments'],
      description: 'List comments for a post. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.CommentPaginatedResponse }
    }
  }, handler('listComments'));

  // ========== Reactions ==========
  fastify.post('/posts/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.reactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'togglePostReaction',
      tags: ['Posts', 'Reactions'],
      description: 'Toggle reaction on a post (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('togglePostReaction'));

  // Save and report endpoints for posts
  fastify.post('/posts/:id/save', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'toggleSave',
      tags: ['Posts', 'Interactions'],
      description: 'Toggle save for a post (save/unsave).',
      body: schemas.PostSaveBody,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                postId: { type: 'string' },
                userId: { type: 'string' },
                saved: { type: 'boolean' }
              }
            }
          },
          example: { success: true, data: { postId: 'post-uuid', userId: 'user-uuid', saved: true } }
        },
        422: schemas.GenericErrorResponse
      }
    }
  }, handler('toggleSave'));

  fastify.post('/posts/:id/report', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'reportPost',
      tags: ['Posts', 'Moderation'],
      description: 'Report a post for moderation.',
      body: schemas.PostReportBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostReportResponse } }, 422: { type: 'object' } }
    }
  }, handler('reportPost'));

  fastify.post('/comments/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.reactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'toggleCommentReaction',
      tags: ['Comments', 'Reactions'],
      description: 'Toggle reaction on a comment (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('toggleCommentReaction'));

  fastify.get('/posts/:id/media', {
    schema: {
      operationId: 'listPostMedia',
      tags: ['Posts', 'Media'],
      description: 'List media attached to a post',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.PostMediaResponse } } } }
    }
  }, handler('listPostMedia'));

  fastify.delete('/posts/media/:id', {
    schema: {
      operationId: 'deletePostMedia',
      tags: ['Posts', 'Media'],
      description: 'Delete a post media item by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } } }
    }
  }, handler('deletePostMedia'));

  // ========== Questions & Answers ==========
  fastify.post('/questions', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createQuestion',
      tags: ['Questions'],
      description: 'Create a new question. Authenticated user becomes the author. Optionally attach the question to a community. Returns the created question.',
      body: schemas.QuestionCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.QuestionResponse },
          example: { success: true, data: schemas.QuestionResponse.example }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('createQuestion'));

  fastify.get('/questions', {
    schema: {
      operationId: 'listQuestions',
      tags: ['Questions'],
      description: 'List questions. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'perPage', in: 'query', schema: { type: 'number' } }, { name: 'communityId', in: 'query', schema: { type: 'string' } }],
      response: { 200: schemas.QuestionPaginatedResponse }
    }
  }, handler('listQuestions'));

  fastify.get('/questions/:id', {
    schema: {
      operationId: 'getQuestion',
      tags: ['Questions'],
      description: 'Get a single question by id. Set `includeAnswers=true` to include answers in the response.',
      parameters: [{ name: 'includeAnswers', in: 'query', schema: { type: 'boolean' } }],
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.QuestionResponse },
          example: { success: true, data: schemas.QuestionResponse.example }
        },
        404: { type: 'object' }
      }
    }
  }, handler('getQuestion'));

  fastify.post('/questions/:questionId/answers', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.comments, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createAnswer',
      tags: ['Questions', 'Answers'],
      description: 'Create an answer for a question. Authenticated user becomes the author.',
      body: schemas.AnswerCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.AnswerResponse },
          example: { success: true, data: schemas.AnswerResponse.example }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('createAnswer'));

  fastify.get('/questions/:questionId/answers', {
    schema: {
      operationId: 'listAnswers',
      tags: ['Questions', 'Answers'],
      description: 'List answers for a question. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.AnswerPaginatedResponse }
    }
  }, handler('listAnswers'));

  // ========== Pages ==========
  fastify.post('/pages', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.createPost, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'createPage',
      tags: ['Pages'],
      description: 'Create a new page. Authenticated user becomes the owner.',
      body: schemas.PageCreateBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 422: { type: 'object' } }
    }
  }, handler('createPage'));

  fastify.get('/pages', {
    schema: {
      operationId: 'listPages',
      tags: ['Pages'],
      description: 'List pages. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse }
    }
  }, handler('listPages'));

  fastify.get('/pages/:id', {
    schema: {
      operationId: 'getPage',
      tags: ['Pages'],
      description: 'Get a page by id',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 404: { type: 'object' } }
    }
  }, handler('getPage'));

  // pages by category id
  fastify.get('/page-categories/:id/pages', {
    schema: {
      operationId: 'listPagesByCategoryId',
      tags: ['Pages', 'Categories'],
      description: 'List pages under a category id. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse }
    }
  }, handler('listPagesByCategoryId'));

  // pages by category name
  fastify.get('/page-categories/name/:name/pages', {
    schema: {
      operationId: 'listPagesByCategoryName',
      tags: ['Pages', 'Categories'],
      description: 'List pages under a category name. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PagePaginatedResponse, 404: { type: 'object' } }
    }
  }, handler('listPagesByCategoryName'));

  // get category details (include total pages)
  fastify.get('/page-categories/:id', {
    schema: {
      operationId: 'getPageCategory',
      tags: ['Pages', 'Categories'],
      description: 'Get page category details (includes total pages count)',
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse },
          example: { success: true, data: schemas.PageCategoryResponse.example }
        },
        404: schemas.GenericErrorResponse
      }
    }
  }, async (req, reply) => {
    try {
      return handler('getPageCategory')(req, reply);
    } catch (e) {
      return sendError(reply, 500, 'internal_error', 'Internal server error');
    }
  });

  // Admin-only: create a page category
  fastify.post('/page-categories', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createPageCategory',
      tags: ['Categories'],
      description: 'Create a new page category (admin only).',
      // Embed example so Swagger UI shows a ready-to-use sample payload for admins
      body: Object.assign({}, schemas.PageCategoryCreateBody, { example: schemas.PageCategoryCreateBody.example }),
      response: {
        201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse } },
        401: { type: 'object' },
        403: { type: 'object' },
        409: schemas.GenericErrorResponse,
        422: {
          type: 'object',
          examples: [
            { summary: 'Invalid slug format', value: { success: false, error: { code: 'invalid_slug_format', message: 'Slug must match ^[a-z0-9-]+$' } } },
            { summary: 'Name too short', value: { success: false, error: { code: 'name_too_short', message: 'Name must be at least the minimum length' } } },
            { summary: 'Invalid validation rules', value: { success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object with valid fields' } } }
          ]
        }
      }
    }
  }, handler('createPageCategory'));

  fastify.put('/page-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updatePageCategory',
      tags: ['Categories'],
      description: 'Update an existing page category (admin only).',
      body: Object.assign({}, schemas.PageCategoryCreateBody, { example: schemas.PageCategoryCreateBody.example }),
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageCategoryResponse } },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' },
        409: schemas.GenericErrorResponse,
        422: {
          type: 'object',
          examples: [
            { summary: 'Invalid slug format', value: { success: false, error: { code: 'invalid_slug_format', message: 'Slug must match ^[a-z0-9-]+$' } } },
            { summary: 'Name too short', value: { success: false, error: { code: 'name_too_short', message: 'Name must be at least the minimum length' } } },
            { summary: 'Invalid validation rules', value: { success: false, error: { code: 'invalid_validation_rules', message: 'validation_rules must be an object with valid fields' } } }
          ]
        }
      }
    }
  }, handler('updatePageCategory'));

  fastify.delete('/page-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deletePageCategory',
      tags: ['Categories'],
      description: 'Delete a page category (admin only). Pages that reference this category will be unassigned (category set to null) before deletion to avoid FK errors.',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' }
      }
    }
  }, handler('deletePageCategory'));

  fastify.put('/pages/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updatePage',
      tags: ['Pages'],
      description: 'Update a page. Only the page owner may update.',
      body: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, metadata: { type: 'object' } }, example: { name: 'My Updated Page', slug: 'my-updated-page', description: 'Updated page description', metadata: { theme: 'business' } } },
      response: {
        200: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PageResponse },
          example: { success: true, data: schemas.PageResponse.example }
        },
        403: schemas.GenericErrorResponse,
        404: schemas.GenericErrorResponse
      }
    }
  }, handler('updatePage'));

  // Page avatar (multipart) upload
  fastify.post('/pages/:id/avatar-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadPageAvatarFile',
      tags: ['Media', 'Pages'],
      description: 'Upload a page avatar file (multipart). Enqueues background job and returns jobId.',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: {
        202:
        {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            data: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string'
                }
              }
            }
          },
          examples: [
            {
              summary: 'Job queued',
              value: {
                success: true,
                data: {
                  jobId: 'job_abc123'
                }
              }
            }
          ]
        },
        422: {
          type: 'object'
        },
        503: {
          type: 'object'
        }
      }
    }
  }, handler('uploadPageAvatarFile'));

  // Page cover/banner (multipart) upload
  fastify.post('/pages/:id/cover-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadPageCoverFile',
      tags: ['Media', 'Pages'],
      description: 'Upload a page cover/banner file (multipart). Enqueues background job and returns jobId.',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              properties: { file: { type: 'string', format: 'binary' } },
              required: ['file']
            }
          }
        }
      },
      response: { 202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } }, examples: [{ summary: 'Job queued', value: { success: true, data: { jobId: 'job_def456' } } }] }, 422: { type: 'object' }, 503: { type: 'object' } }
    }
  }, handler('uploadPageCoverFile'));

  fastify.delete('/pages/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deletePage',
      tags: ['Pages'],
      description: 'Delete a page. Only the page owner may delete.',
      response: { 200: schemas.IdSuccessResponse, 403: schemas.GenericErrorResponse, 404: schemas.GenericErrorResponse }
    }
  }, handler('deletePage'));

  fastify.post('/pages/:id/approve', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'approvePage',
      tags: ['Pages', 'Moderation'],
      description: 'Approve a page (admin only).',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('approvePage'));

  fastify.post('/pages/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'followPage',
      tags: ['Pages'],
      description: 'Follow a page',
      body: {
        type: 'object',
        description: 'Empty body accepted; request requires Authorization header. Server ignores body and uses the authenticated user from the Authorization token.',
        properties: {},
        example: { "note": "No body required. Include Authorization: Bearer <token>" }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Followed successfully.', data: { following: true } }
        },
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Followed successfully.', data: { following: true } }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('followPage'));

  fastify.delete('/pages/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowPage',
      tags: ['Pages'],
      description: 'Unfollow a page',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', properties: { following: { type: 'boolean' } } }
          },
          example: { success: true, message: 'Unfollowed successfully.', data: { following: false } }
        },
        401: schemas.AuthErrorResponse
      }
    }
  }, handler('unfollowPage'));

  fastify.get('/pages/:id/followers', {
    schema: {
      operationId: 'listPageFollowers',
      tags: ['Pages'],
      description: 'List followers for a page. Returns a paginator payload at the root.',
      parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }, { name: 'per_page', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: schemas.PageFollowerPaginatedResponse }
    }
  }, handler('listPageFollowers'));

  routesLogger.info('Routes registered');
}
