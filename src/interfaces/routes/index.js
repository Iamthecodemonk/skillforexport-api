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

  // ========== Auth ==========
  fastify.post('/auth/register', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.guests : undefined,
    schema: {
      operationId: 'registerUser',
      tags: ['Auth'],
      description: 'Register a new user with email and password - sends OTP to email',
      body: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: { email: { type: 'string' }, password: { type: 'string' }, fullName: { type: 'string' } },
        example: { email: 'user@example.com', password: 'P@ssw0rd', fullName: 'Jane Doe' }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: { otpId: { type: 'string' }, message: { type: 'string' } }
            }
          }
        },
        400: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('RegisterUserWithEmailPassword'));

  fastify.post('/auth/verify-registration', {
    schema: {
      operationId: 'completeRegistration',
      tags: ['Auth'],
      description: 'Complete registration by verifying OTP and creating user account',
      body: {
        type: 'object',
        required: ['email', 'otpCode'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
          otpCode: { type: 'string' }
        },
        example: { email: 'user@example.com', otpCode: '123456' }
      },
      response: {
        201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.AuthTokenResponse } },
        401: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('CompleteRegistration'));

  fastify.post('/auth/login', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.guests : undefined,
    schema: {
      operationId: 'loginUser',
      tags: ['Auth'],
      description: 'Login with email and password',
      body: schemas.LoginBody,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: { accessToken: { type: 'string' }, tokenType: { type: 'string' }, expiresIn: { type: 'number' } }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
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
          },
          examples: [
            {
              summary: 'Invalid credentials',
              value: { success: false, error: { code: 'invalid_credentials', message: 'Invalid email or password' } }
            }
          ]
        },
        422: { type: 'object' }
      }
    }
  }, handler('LoginUserWithEmailPassword'));

  fastify.post('/auth/request-otp', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.guests : undefined,
    schema: {
      operationId: 'requestOtp',
      tags: ['Auth'],
      description: 'Request an OTP for email verification',
      body: schemas.RequestOtpBody,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { otpId: { type: 'string' } } }
          }
        },
        400: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('RequestOtp'));

  fastify.post('/auth/verify-otp', {
    schema: {
      operationId: 'verifyOtp',
      tags: ['Auth'],
      description: 'Verify OTP and get access token',
      body: schemas.VerifyOtpBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.AuthTokenResponse } }, 401: { type: 'object' }, 422: { type: 'object' } }
    }
  }, handler('VerifyOtp'));

  fastify.post('/auth/reset-password', {
    schema: {
      operationId: 'resetPassword',
      tags: ['Auth'],
      description: 'Reset password with OTP verification',
      body: schemas.ResetPasswordBody,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { id: { type: 'string' } } }
          },
          examples: [
            {
              summary: 'Password reset successful',
              value: { success: true, data: { id: 'user-uuid' } }
            }
          ]
        },
        400: { type: 'object' },
        422: { type: 'object' }
      }
    }
  }, handler('ResetPassword'));

  fastify.post('/auth/logout', {
    schema: {
      operationId: 'logout',
      tags: ['Auth'],
      description: 'Logout current session (provide Bearer token in Authorization header)',
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        401: { type: 'object' }
      }
    }
  }, handler('Logout'));

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

  fastify.post('/auth/google/token', {
    schema: {
      operationId: 'googleTokenSignIn',
      tags: ['Auth'],
      description: 'Sign in with Google ID token',
      body: {
        type: 'object',
        required: ['idToken'],
        properties: { idToken: { type: 'string' } },
        example: { idToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...' }
      },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.AuthTokenResponse } }, 401: { type: 'object' }, 422: { type: 'object' } }
    }
  }, handler('TokenSignIn'));

  // ========== Users ==========
  fastify.get('/users/:id', {
    schema: {
      operationId: 'getUser',
      tags: ['Users'],
      description: 'Get user by id'
      ,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
        404: { type: 'object' }
      }
    }
  }, handler('getUser'));

  fastify.post('/users', {
    schema: {
      operationId: 'createUser',
      tags: ['Users'],
      description: 'Create a user',
      body: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } }, example: { email: 'user@example.com', password: 'P@ssw0rd' } },
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
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.UserProfileResponse } },
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
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.FullProfileResponse } },
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
        202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } },
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
        202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } },
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
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } } }
    }
  }, handler('getCloudinarySignature'));

  fastify.post('/media/register', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'registerMedia',
      tags: ['Media'],
      description: 'Register a direct client upload by Cloudinary public id so server can validate and create asset record. If kind=avatar|banner and image already exists, pass replace=true or clear it first using PUT /users/:id/profile with { avatar: null } or { banner: null }.',
      body: schemas.MediaRegisterBody,
      response: { 202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } }, examples: [ { summary: 'Registered (profile update queued)', value: { success: true, data: { jobId: 'job_12345' } } }, { summary: 'Register page asset', value: { success: true, data: { jobId: 'job_67890' } } } ] }, 409: { type: 'object' } }
    }
  }, handler('registerMedia'));

  fastify.get('/media/jobs/:id', {
    schema: {
      operationId: 'getMediaJobStatus',
      tags: ['Media'],
      description: 'Get status for a media processing job',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                state: { type: 'string' },
                attemptsMade: { type: 'number' },
                failedReason: { type: ['string', 'null'] },
                friendlyMessage: { type: ['string', 'null'] },
                returnvalue: { type: ['object', 'null'] },
                data: { type: ['object', 'null'] }
              }
            }
          }
          ,
          example: {
            success: true,
            data: {
              id: 'job_abc123',
              name: 'avatar-file',
              state: 'failed',
              attemptsMade: 3,
              failedReason: 'invalid_file_type',
              friendlyMessage: 'Only JPG, PNG or WEBP images are allowed.',
              returnvalue: null,
              data: { userId: 'user-uuid' }
            }
          }
        },
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
              properties: {
                file: { type: 'string', format: 'binary' }
              },
              required: ['file']
            }
          }
        }
      },
      response: {
        202: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { jobId: { type: 'string' } }, example: { jobId: 'job_abc123' } }
          }
        },
        422: { type: 'object' },
        409: { type: 'object' },
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatarFile'));
  fastify.put('/users/:id/profile', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'updateUserProfile', tags: ['Users'],
      description: 'Update profile fields. You can clear avatar or banner by sending null values.',
      body: schemas.UserProfileBody,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.UserProfileResponse } },
        404: { type: 'object' }
      }
    }
  }, handler('updateUserProfile'));

  fastify.get('/users/:id/skills', {
    schema: {
      operationId: 'listUserSkills', tags: ['Users']
      , response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } }
    }
  }, handler('listUserSkills'));

  fastify.post('/users/:id/skills', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserSkill',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['skill'],
        properties: { skill: { type: 'string' }, level: { type: 'string' } },
        example: { skill: 'JavaScript', level: 'advanced' }
      }
    }
  }, handler('addUserSkill'));

  fastify.delete('/users/:id/skills/:skillId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined, schema: {
        operationId:
          'deleteUserSkill',
        tags: ['Users']
        , response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } } }
      }
    }, handler('deleteSkill'));

  fastify.get('/users/:id/portfolios', {
    schema: {
      operationId: 'listUserPortfolios',
      tags: ['Users'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, handler('listUserPortfolios'));
  fastify.post('/users/:id/portfolios', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addUserPortfolio',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['title'],
        properties: { title: { type: 'string' }, description: { type: 'string' }, link: { type: 'string' } },
        example: { title: 'Personal Website', description: 'Portfolio site', link: 'https://janedoe.dev' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('addUserPortfolio'));
  fastify.delete(
    '/users/:id/portfolios/:portfolioId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteUserPortfolio',
        tags: ['Users'],
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } }
          }
        }
      }
    },
    handler('deletePortfolio')
  );

  fastify.post('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'followUser',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: { followerId: { type: 'string' } },
        example: { followerId: 'uuid-or-id' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('followUser'));

  fastify.delete('/users/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowUser',
      tags: ['Users'],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } } }
    }
  }, handler('unfollowUser'));

  fastify.get('/users/:id/followers', {
    schema: {
      operationId: 'listFollowers',
      tags: ['Users']
      , response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } }
    }
  }, handler('listFollowers'));

  fastify.get('/users/:id/login-history', {
    schema: {
      operationId: 'listLoginHistory',
      tags: ['Users']
      , response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } }
    }
  }, handler('listLoginHistory'));

  // Community categories
  fastify.post('/community-categories', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createCommunityCategory',
      tags: ['Communities'],
      body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, example: { name: 'Sports' } },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } } }
    }
  }, handler('createCategory'));

  fastify.put('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateCommunityCategory', tags: ['Communities'], body: { type: 'object', properties: { name: { type: 'string' } } }, response: { 200: { type: 'object' } } }
  }, handler('updateCategory'));

  fastify.delete('/community-categories/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteCommunityCategory', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('deleteCategory'));

  // Communities
  fastify.post('/communities', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'createCommunity', tags: ['Communities'], body: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' }, categoryId: { type: 'string' } }, example: { name: 'Local Chess Club', description: 'We play chess', categoryId: null } }, response: { 201: { type: 'object' } } }
  }, handler('createCommunity'));

  fastify.get('/communities/:id', {
    schema: { operationId: 'getCommunity', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('getCommunity'));

  fastify.put('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'updateCommunity', tags: ['Communities'], body: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, defaultPostVisibility: { type: 'string', enum: ['public','connections','community'] }, is_active: { type: 'number' } } }, response: { 200: { type: 'object' } } }
  }, handler('updateCommunity'));

  fastify.delete('/communities/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteCommunity', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('deleteCommunity'));

  fastify.post('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'joinCommunity', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('joinCommunity'));

  fastify.delete('/communities/:id/join', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'leaveCommunity', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('leaveCommunity'));

  fastify.get('/communities/:id/members', {
    schema: { operationId: 'listCommunityMembers', tags: ['Communities'], response: { 200: { type: 'object' } } }
  }, handler('listMembers'));

  fastify.post('/users/:id/oauth-accounts', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'createOauthAccount',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['provider', 'providerId'],
        properties: { provider: { type: 'string' }, providerId: { type: 'string' }, accessToken: { type: 'string' } },
        example: { provider: 'google', providerId: 'google-12345', accessToken: 'ya29.a0Af...' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('createOauthAccount'));

  // ========== User Certifications ==========
  fastify.get('/users/:id/certifications', {
    schema: {
      operationId: 'listCertifications',
      tags: ['Users'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { type: 'object' } }
          }
        }
      }
    }
  }, handler('listCertifications'));

  fastify.post('/users/:id/certifications', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addCertification',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, issuer: { type: 'string' }, issueDate: { type: 'string' } },
        example: { name: 'Certified Kubernetes Administrator', issuer: 'CNCF', issueDate: '2021-08-01' }
      },
      response: {
        201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
        422: { type: 'object' }
      }
    }
  }, handler('addCertification'));

  fastify.delete('/users/:id/certifications/:certId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deleteCertification',
      tags: ['Users'],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } } }
    }
  }, handler('deleteCertification'));

  // ========== User Education ==========
  fastify.get('/users/:id/education', {
    schema: {
      operationId: 'listEducation',
      tags: ['Users'],
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } }
      }
    }
  }, handler('listEducation'));

  fastify.post('/users/:id/education', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addEducation',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['school'],
        properties: { school: { type: 'string' }, degree: { type: 'string' }, field: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } },
        example: { school: 'University', degree: 'BSc Computer Science', field: 'Computer Science', startDate: '2015-09-01', endDate: '2019-06-01' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('addEducation'));

  fastify.delete('/users/:id/education/:eduId', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: { operationId: 'deleteEducation', tags: ['Users'], response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } } } }
  }, handler('deleteEducation'));

  // ========== User Experiences ==========
  fastify.get('/users/:id/experiences', {
    schema: { operationId: 'listExperiences', tags: ['Users'], response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } } }
  }, handler('listExperiences'));

  fastify.post('/users/:id/experiences', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'addExperience',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['company', 'title'],
        properties: { company: { type: 'string' }, title: { type: 'string' }, employmentType: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, isCurrent: { type: 'boolean' }, description: { type: 'string' } },
        example: { company: 'Acme Corp', title: 'Senior Engineer', employmentType: 'full-time', startDate: '2020-01-01', endDate: '2022-12-31', isCurrent: false, description: 'Worked on X' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('addExperience'));

  fastify.delete(
    '/users/:id/experiences/:expId',
    {
      preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
      schema: {
        operationId: 'deleteExperience',
        tags: ['Users'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', properties: { id: { type: 'string' } } }
            }
          }
        }
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
      description: 'Create a new post. Provide `title` and `content` in body. Optional `communityId`. Server will use authenticated user when available; `userId` in body is a fallback.',
      body: schemas.PostCreateBody,
      response: {
        201: {
          type: 'object',
          properties: { success: { type: 'boolean' }, data: schemas.PostResponse }
        },
        422: { type: 'object' }
      }
    }
  }, handler('createPost'));

  fastify.get('/posts', {
    schema: {
      operationId: 'listPosts',
      tags: ['Posts'],
      description: 'List posts (feed). Supports `limit` and `offset` query params.',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }, { name: 'lastCreatedAt', in: 'query', schema: { type: 'string', description: 'Use for keyset pagination: ISO timestamp of last item from previous page' } }, { name: 'lastId', in: 'query', schema: { type: 'string', description: 'Use with `lastCreatedAt` for keyset pagination: last item id from previous page' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostListResponse } } }
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
      body: { type: 'object', properties: { userId: { type: 'string' }, content: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('updatePost'));

  fastify.delete('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? [deps.rateLimiters.interactions, deps.authRequired] : (deps && deps.authRequired ? deps.authRequired : undefined),
    schema: {
      operationId: 'deletePost',
      tags: ['Posts'],
      description: 'Delete a post. Provide `userId` in body to verify ownership.',
      body: { type: 'object', properties: { userId: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } }, 403: { type: 'object' }, 404: { type: 'object' } }
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
      response: {
        202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } },
        422: { type: 'object' },
        503: { type: 'object' }
      }
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
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.CommentResponse } }, 422: { type: 'object' } }
    }
  }, handler('createComment'));

  fastify.get('/posts/:id/comments', {
    schema: {
      operationId: 'listComments',
      tags: ['Posts', 'Comments'],
      description: 'List comments for a post',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.CommentListResponse } } }
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
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
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
      description: 'List pages',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageListResponse } } }
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
      description: 'List pages under a category id',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageListResponse } } }
    }
  }, handler('listPagesByCategoryId'));

  // pages by category name
  fastify.get('/page-categories/name/:name/pages', {
    schema: {
      operationId: 'listPagesByCategoryName',
      tags: ['Pages', 'Categories'],
      description: 'List pages under a category name',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageListResponse } }, 404: { type: 'object' } }
    }
  }, handler('listPagesByCategoryName'));

  // get category details (include total pages)
  fastify.get('/page-categories/:id', {
    schema: {
      operationId: 'getPageCategory',
      tags: ['Pages', 'Categories'],
      description: 'Get page category details (includes total pages count)',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 404: { type: 'object' } }
    }
  }, async (req, reply) => {
    try {
      const { id } = req.params;
      const categoryRepo = req.server && req.server.profileRepository ? null : null; // placeholder
      // prefer pageCategoryRepository from controllers' use case if available
      const handlers = req.server && req.server.routes && req.server.routes; // no-op
      // Delegate to controller handler if present
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
      body: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, metadata: { type: 'object' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PageResponse } }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('updatePage'));

  // Page avatar (multipart) upload
  fastify.post('/pages/:id/avatar-file', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'uploadPageAvatarFile',
      tags: ['Media','Pages'],
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
      response: { 202: 
        { type: 'object', 
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
      tags: ['Media','Pages'],
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
      response: { 202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } }, examples: [ { summary: 'Job queued', value: { success: true, data: { jobId: 'job_def456' } } } ] }, 422: { type: 'object' }, 503: { type: 'object' } }
    }
  }, handler('uploadPageCoverFile'));

  fastify.delete('/pages/:id', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'deletePage',
      tags: ['Pages'],
      description: 'Delete a page. Only the page owner may delete.',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } }, 403: { type: 'object' }, 404: { type: 'object' } }
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
      body: { type: 'object', description: 'Empty body accepted; request requires Authorization header. Server ignores body and uses the authenticated user from the Authorization token.', properties: {}, example: { "note": "No body required. Include Authorization: Bearer <token>" } },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 401: { type: 'object' } }
    }
  }, handler('followPage'));

  fastify.delete('/pages/:id/follow', {
    preHandler: deps && deps.authRequired ? deps.authRequired : undefined,
    schema: {
      operationId: 'unfollowPage',
      tags: ['Pages'],
      description: 'Unfollow a page',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { id: { type: 'string' } } } } }, 401: { type: 'object' } }
    }
  }, handler('unfollowPage'));

  fastify.get('/pages/:id/followers', {
    schema: {
      operationId: 'listPageFollowers',
      tags: ['Pages'],
      description: 'List followers for a page',
      parameters: [{ name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } }],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } }
    }
  }, handler('listPageFollowers'));

  routesLogger.info('Routes registered');
}

