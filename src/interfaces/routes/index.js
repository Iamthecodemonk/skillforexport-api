import schemas from '../docs/schemas.js';
import logger from '../../utils/logger.js';
import 'dotenv/config';

const routesLogger = logger.child('ROUTES');

export default async function registerRoutes(fastify, deps) {
  routesLogger.info('Registering routes', { controllers: Object.keys(deps.controllers) });

  // Default fallback handler for missing controllers
  const fallback = async (req, reply) => {
    return reply.code(501).send({
      error: 'handler_not_implemented'
    });
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
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: { token: { type: 'string' }, user: { type: 'object' } }
            }
          }
        }, 
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
            error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } }
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
      response: { 
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: { token: { type: 'string' }, user: { type: 'object' } }
            }
          }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
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
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', properties: { token: { type: 'string' }, user: { type: 'object' } } }
          }
        },
        401: { type: 'object' },
        422: { type: 'object' }
      }
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
      body: { type: 'object', required: ['email','password'], properties: { email: { type: 'string' }, password: { type: 'string' } }, example: { email: 'user@example.com', password: 'P@ssw0rd' } },
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
    schema: 
    { operationId: 'getUserProfile', 
      tags: ['Users'] 
      ,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
        404: { type: 'object' }
      }
    } 
  }, handler('getUserProfile'));
  fastify.post('/users/:id/profile', {
    schema: {
      operationId: 'createUserProfile',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          bio: { type: 'string' },
          location: { type: 'string' },
          avatar: { type: 'string' },
          banner: { type: 'string' },
          website: { type: 'string' },
          linkedin: { type: 'string' },
          github: { type: 'string' }
        },
        example: { username: 'janedoe', bio: 'Full-stack dev', location: 'Remote', website: 'https://janedoe.dev' }
      },
      response: {
        201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
        422: { type: 'object' }
      }
    }
  }, handler('createProfile'));
  fastify.post('/users/:id/profile/avatar', {
    schema: {
      operationId: 'uploadUserAvatar',
      tags: ['Users'],
      description: 'Upload a profile avatar by URL; validation and Cloudinary upload happen in background. If avatar already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { avatar: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing avatar' }
      ],
      body: {
        type: 'object',
        required: ['imageUrl'],
        properties: { imageUrl: { type: 'string' } },
        example: { imageUrl: 'https://example.com/photo.jpg' }
      },
      response: {
        202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } },
        422: { type: 'object' },
        409: { type: 'object' },
        503: { type: 'object' }
      }
    }
  }, handler('uploadAvatar'));
  fastify.post('/users/:id/profile/banner', {
    schema: {
      operationId: 'uploadUserBanner',
      tags: ['Users'],
      description: 'Upload a profile banner by URL; validation and Cloudinary upload happen in background. If banner already exists, pass ?replace=true or clear it first using PUT /users/:id/profile with { banner: null }.',
      parameters: [
        { name: 'replace', in: 'query', schema: { type: 'boolean' }, description: 'When true, replace existing banner' }
      ],
      body: {
        type: 'object',
        required: ['imageUrl'],
        properties: { imageUrl: { type: 'string' } },
        example: { imageUrl: 'https://example.com/banner.jpg' }
      },
      response: {
        202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { jobId: { type: 'string' } } } } },
        422: { type: 'object' },
        409: { type: 'object' },
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
    schema: {
      operationId: 'registerMedia',
      tags: ['Media'],
      description: 'Register a direct client upload by Cloudinary public id so server can validate and create asset record. If kind=avatar|banner and image already exists, pass replace=true or clear it first using PUT /users/:id/profile with { avatar: null } or { banner: null }.',
      body: {
        type: 'object',
        required: ['publicId','userId'],
        properties: { publicId: { type: 'string' }, userId: { type: 'string' }, kind: { type: 'string' }, replace: { type: 'boolean' } },
        example: { publicId: 'avatars/abcd1234', userId: 'user-uuid', kind: 'avatar' }
      },
      response: { 202: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 409: { type: 'object' } }
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
                failedReason: { type: ['string','null'] },
                friendlyMessage: { type: ['string','null'] },
                returnvalue: { type: ['object','null'] },
                data: { type: ['object','null'] }
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
    schema: { 
      operationId: 'updateUserProfile', tags: ['Users'],
      description: 'Update profile fields. You can clear avatar or banner by sending null values.',
      body: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          bio: { type: 'string' },
          location: { type: 'string' },
          avatar: { type: ['string','null'] },
          banner: { type: ['string','null'] },
          website: { type: 'string' },
          linkedin: { type: 'string' },
          github: { type: 'string' }
        },
        example: { bio: 'Full-stack dev', location: 'Remote', website: 'https://janedoe.dev' }
      }
      ,
      response: { 
        200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } },
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
    { schema: { 
      operationId: 
      'deleteUserSkill', 
      tags: ['Users'] 
      , response: { 204: { type: 'null' } }
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
  fastify.delete('/users/:id/portfolios/:portfolioId', { schema: { operationId: 'deleteUserPortfolio', tags: ['Users'], response: { 204: { type: 'null' } } } }, handler('deletePortfolio'));

  fastify.post('/users/:id/follow', {
    schema: {
      operationId: 'followUser',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['followerId'],
        properties: { followerId: { type: 'string' } },
        example: { followerId: 'uuid-or-id' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('followUser'));

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

  fastify.post('/users/:id/oauth-accounts', {
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
    schema: {
      operationId: 'deleteCertification',
      tags: ['Users'],
      response: { 204: { type: 'null' } }
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
    schema: { operationId: 'deleteEducation', tags: ['Users'], response: { 204: { type: 'null' } } }
  }, handler('deleteEducation'));

  // ========== User Experiences ==========
  fastify.get('/users/:id/experiences', {
    schema: { operationId: 'listExperiences', tags: ['Users'], response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: { type: 'object' } } } } } }
  }, handler('listExperiences'));

  fastify.post('/users/:id/experiences', {
    schema: {
      operationId: 'addExperience',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['company','title'],
        properties: { company: { type: 'string' }, title: { type: 'string' }, employmentType: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' }, isCurrent: { type: 'boolean' }, description: { type: 'string' } },
        example: { company: 'Acme Corp', title: 'Senior Engineer', employmentType: 'full-time', startDate: '2020-01-01', endDate: '2022-12-31', isCurrent: false, description: 'Worked on X' }
      },
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('addExperience'));

  fastify.delete('/users/:id/experiences/:expId', { schema: { operationId: 'deleteExperience', tags: ['Users'], response: { 204: { type: 'null' } } } }, handler('deleteExperience'));

  // ========== Posts ==========
  fastify.post('/posts', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.createPost : undefined,
    schema: {
      operationId: 'createPost',
      tags: ['Posts'],
      description: 'Create a new post. Provide `userId` and `content` in body. Optional `communityId`.',
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
      parameters: [ { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } } ],
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
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.interactions : undefined,
    schema: {
      operationId: 'updatePost',
      tags: ['Posts'],
      description: 'Update a post. Provide `userId` and `content` in body.',
      body: { type: 'object', required: ['userId','content'], properties: { userId: { type: 'string' }, content: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('updatePost'));

  fastify.delete('/posts/:id', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.interactions : undefined,
    schema: {
      operationId: 'deletePost',
      tags: ['Posts'],
      description: 'Delete a post. Provide `userId` in body to verify ownership.',
      body: { type: 'object', required: ['userId'], properties: { userId: { type: 'string' } } },
      response: { 204: { type: 'null' }, 403: { type: 'object' }, 404: { type: 'object' } }
    }
  }, handler('deletePost'));

  // Post media endpoints
  fastify.post('/posts/:id/media', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.mediaFile : undefined,
    schema: {
      operationId: 'attachPostMedia',
      tags: ['Posts','Media'],
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
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.comments : undefined,
    schema: {
      operationId: 'createComment',
      tags: ['Posts','Comments'],
      description: 'Create a comment on a post',
      body: schemas.CommentCreateBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.CommentResponse } }, 422: { type: 'object' } }
    }
  }, handler('createComment'));

  fastify.get('/posts/:id/comments', {
    schema: {
      operationId: 'listComments',
      tags: ['Posts','Comments'],
      description: 'List comments for a post',
      parameters: [ { name: 'limit', in: 'query', schema: { type: 'number' } }, { name: 'offset', in: 'query', schema: { type: 'number' } } ],
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.CommentListResponse } } }
    }
  }, handler('listComments'));

  // ========== Reactions ==========
  fastify.post('/posts/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.reactions : undefined,
    schema: {
      operationId: 'togglePostReaction',
      tags: ['Posts','Reactions'],
      description: 'Toggle reaction on a post (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('togglePostReaction'));

  // Save and report endpoints for posts
  fastify.post('/posts/:id/save', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.interactions : undefined,
    schema: {
      operationId: 'toggleSave',
      tags: ['Posts','Interactions'],
      description: 'Toggle save for a post (save/unsave).',
      body: schemas.PostSaveBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object' } } }, 422: { type: 'object' } }
    }
  }, handler('toggleSave'));

  fastify.post('/posts/:id/report', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.interactions : undefined,
    schema: {
      operationId: 'reportPost',
      tags: ['Posts','Moderation'],
      description: 'Report a post for moderation.',
      body: schemas.PostReportBody,
      response: { 201: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.PostReportResponse } }, 422: { type: 'object' } }
    }
  }, handler('reportPost'));

  fastify.post('/comments/:id/reactions', {
    preHandler: deps && deps.rateLimiters ? deps.rateLimiters.reactions : undefined,
    schema: {
      operationId: 'toggleCommentReaction',
      tags: ['Comments','Reactions'],
      description: 'Toggle reaction on a comment (one reaction per user). Omitting `type` defaults to `like`.',
      body: schemas.ReactionBody,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: schemas.ReactionToggleResponse } }, 422: { type: 'object' } }
    }
  }, handler('toggleCommentReaction'));

  fastify.get('/posts/:id/media', {
    schema: {
      operationId: 'listPostMedia',
      tags: ['Posts','Media'],
      description: 'List media attached to a post',
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'array', items: schemas.PostMediaResponse } } } }
    }
  }, handler('listPostMedia'));

  fastify.delete('/posts/media/:id', {
    schema: {
      operationId: 'deletePostMedia',
      tags: ['Posts','Media'],
      description: 'Delete a post media item by id',
      response: { 204: { type: 'null' } }
    }
  }, handler('deletePostMedia'));

  routesLogger.info('Routes registered');
}

