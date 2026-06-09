// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import Fastify from 'fastify';
import config from './config/index.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';
import registerRoutes from './interfaces/routes/index.js';
import { makeHealthController } from './interfaces/controllers/healthController.js';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { MysqlUserRepository } from './infrastructure/repositories/index.js';
import { UserRepositoryImpl } from './domain/repositories/userRepository.js';
import { MysqlUserProfileRepository, MysqlUserAssetRepository, MysqlUserSkillRepository, MysqlUserPortfolioRepository, MysqlFollowerRepository, MysqlUserOauthRepository, MysqlUserLoginHistoryRepository, MysqlUserCertificationRepository, MysqlUserEducationRepository, MysqlUserExperienceRepository, MysqlUserSettingsRepository, MysqlLegalDocumentRepository } from './infrastructure/repositories/index.js';
import { UserProfileRepositoryImpl } from './domain/repositories/userProfileRepository.js';
import { UserSkillRepositoryImpl } from './domain/repositories/userSkillRepository.js';
import { UserPortfolioRepositoryImpl } from './domain/repositories/userPortfolioRepository.js';
import { FollowerRepositoryImpl } from './domain/repositories/followerRepository.js';
import { UserOauthRepositoryImpl } from './domain/repositories/userOauthRepository.js';
import { UserLoginHistoryRepositoryImpl } from './domain/repositories/userLoginHistoryRepository.js';
import { UserCertificationRepositoryImpl } from './domain/repositories/userCertificationRepository.js';
import { UserEducationRepositoryImpl } from './domain/repositories/userEducationRepository.js';
import { UserExperienceRepositoryImpl } from './domain/repositories/userExperienceRepository.js';
import { makeUserController } from './interfaces/controllers/userController.js';
import { makePostController } from './interfaces/controllers/postController.js';
import PostUseCase from './application/use-cases/postUseCase.js';
import PageUseCase from './application/use-cases/pageUseCase.js';
import MysqlPostRepository from './infrastructure/repositories/mysqlPostRepository.js';
import { PostRepositoryImpl } from './domain/repositories/postRepository.js';
import MysqlPostMediaRepository from './infrastructure/repositories/mysqlPostMediaRepository.js';
import MysqlPageRepository from './infrastructure/repositories/mysqlPageRepository.js';
import { PageRepositoryImpl } from './domain/repositories/pageRepository.js';
import MysqlPageCategoryRepository from './infrastructure/repositories/mysqlPageCategoryRepository.js';
import { PageCategoryRepositoryImpl } from './domain/repositories/pageCategoryRepository.js';
import MysqlPageFollowerRepository from './infrastructure/repositories/mysqlPageFollowerRepository.js';
import { PageFollowerRepositoryImpl } from './domain/repositories/pageFollowerRepository.js';
import { makePageController } from './interfaces/controllers/pageController.js';
import MysqlCommunityCategoryRepository from './infrastructure/repositories/mysqlCommunityCategoryRepository.js';
import MysqlCommunityRepository from './infrastructure/repositories/mysqlCommunityRepository.js';
import MysqlCommunityMemberRepository from './infrastructure/repositories/mysqlCommunityMemberRepository.js';
import { CommunityRepositoryImpl } from './domain/repositories/communityRepository.js';
import { CommunityCategoryRepositoryImpl } from './domain/repositories/communityCategoryRepository.js';
import { CommunityMemberRepositoryImpl } from './domain/repositories/communityMemberRepository.js';
import CommunityUseCase from './application/use-cases/communityUseCase.js';
import { makeCommunityController } from './interfaces/controllers/communityController.js';
import { makePostMediaController } from './interfaces/controllers/postController.js';
import PostMediaUseCase from './application/use-cases/postMediaUseCase.js';
import AuthUseCase from './application/use-cases/authUseCase.js';
import MysqlPasswordResetRepository from './infrastructure/repositories/mysqlPasswordResetRepository.js';
import { makeAuthController } from './interfaces/controllers/authController.js';
import { makeOauthController } from './interfaces/controllers/oauthController.js';
import UserUseCase from './application/use-cases/userUseCase.js';
import { createEmailQueue, createEmailWorker } from './infrastructure/queue/emailQueue.js';
import { createMediaQueue, createMediaWorker } from './infrastructure/queue/mediaQueue.js';
import { makeMediaController } from './interfaces/controllers/mediaController.js';
import { createRateLimiters, createRedisClient } from './utils/rateLimiter.js';
import RedisManager from './utils/redisManager.js';
import fastifyMultipart from '@fastify/multipart';
import { verifyEmailConfig } from './utils/emailService.js';
import logger from './utils/logger.js';
import cloudinary from './utils/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import authRequired from './interfaces/middleware/authRequired.js';
import makePopulateUser from './interfaces/middleware/populateUser.js';
import errorHandler from './interfaces/middleware/errorHandler.js';

import CommentUseCase from './application/use-cases/commentUseCase.js';
import ReactionUseCase from './application/use-cases/reactionUseCase.js';
import { makeCommentController } from './interfaces/controllers/commentController.js';
import { makeReactionController } from './interfaces/controllers/reactionController.js';
import MysqlCommentRepository from './infrastructure/repositories/mysqlCommentRepository.js';
import MysqlPostReactionRepository from './infrastructure/repositories/mysqlPostReactionRepository.js';
import MysqlCommentReactionRepository from './infrastructure/repositories/mysqlCommentReactionRepository.js';
import MysqlPostSaveRepository from './infrastructure/repositories/mysqlPostSaveRepository.js';
import MysqlPostReportRepository from './infrastructure/repositories/mysqlPostReportRepository.js';
import MysqlCommentReportRepository from './infrastructure/repositories/mysqlCommentReportRepository.js';
import PostInteractionUseCase from './application/use-cases/postInteractionUseCase.js';
import { makePostInteractionController } from './interfaces/controllers/postInteractionController.js';
import MysqlQuestionRepository from './infrastructure/repositories/mysqlQuestionRepository.js';
import MysqlAnswerRepository from './infrastructure/repositories/mysqlAnswerRepository.js';
import QuestionUseCase from './application/use-cases/questionUseCase.js';
import { makeQuestionController } from './interfaces/controllers/questionController.js';
import { makeFeedController } from './interfaces/controllers/feedController.js';
import { QuestionRepositoryImpl } from './domain/repositories/questionRepository.js';
import { AnswerRepositoryImpl } from './domain/repositories/answerRepository.js';
import MysqlJobsFreelancersRepository from './infrastructure/repositories/mysqlJobsFreelancersRepository.js';
import JobsFreelancersUseCase from './application/use-cases/jobsFreelancersUseCase.js';
import { makeJobsFreelancersController } from './interfaces/controllers/jobsFreelancersController.js';
import MysqlAdvertRepository from './infrastructure/repositories/mysqlAdvertRepository.js';
import AdvertUseCase from './application/use-cases/advertUseCase.js';
import { makeAdvertController } from './interfaces/controllers/advertController.js';
import { makeCompatController } from './interfaces/controllers/compatController.js';
import MysqlNotificationRepository from './infrastructure/repositories/mysqlNotificationRepository.js';
import { makeNotificationController } from './interfaces/controllers/notificationController.js';
import LegalDocumentUseCase from './application/use-cases/legalDocumentUseCase.js';
import { makeLegalDocumentController } from './interfaces/controllers/legalDocumentController.js';

const serverLogger = logger.child('SERVER');
const queueLogger = logger.child('EMAIL_QUEUE');
const smtpLogger = logger.child('SMTP');
const concurrency = parseInt('2', 10);
const isProd = process.env.NODE_ENV === 'production';

const defaultCorsOrigins = [
  'https://skills4export.com',
  'https://www.skills4export.com',
  'https://admin.skills4export.com',
  'https://api.skills4export.com',
  'http://localhost:5173',
  'http://admin.skills4export.com',
  'https://trial.skills4export.com'
];

function isAllowedCorsOrigin(origin, allowedOrigins) {
  if (!origin) return true;

  const normalizedOrigin = String(origin).trim().replace(/\/$/, '');
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  try {
    const { protocol, hostname } = new URL(normalizedOrigin);
    const isSkills4ExportHost = hostname === 'skills4export.com' || hostname.endsWith('.skills4export.com');
    return protocol === 'https:' && isSkills4ExportHost;
  } catch (e) {
    return false;
  }
}

function parseCorsOrigins() {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGINS
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return [...new Set([...configuredOrigins, ...defaultCorsOrigins])];
}

export default async function startServer() {
  const app = Fastify({
    logger: isProd ? false : true,
    // logger:false,
    ajv: {
      customOptions: {
        // Allow OpenAPI example/unknown keywords in route schemas
        strict: false
      }
    }
  });
  // Add a tolerant JSON parser only for follow/unfollow routes to avoid global behavior changes.
  //i did this because i was having issues normal follow and unfollow routes dont real require a json body sha
  try {
    app.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
      // If body empty, only accept silently for follow/unfollow endpoints
      if (!body || body.length === 0) {
        try {
          const rawUrl = (req && req.raw && req.raw.Qurl) ? req.raw.url.split('?')[0] : '';
          // Match /pages/:id/follow and /users/:id/follow paths
          const followPathRegex = /^\/(?:pages|users)\/[0-9a-fA-F-]+\/follow$/;
          if (followPathRegex.test(rawUrl)) {
            return done(null, {});
          }
        } catch (e) {
          // fall through to default error behavior
        }
        const err = new Error("Body cannot be empty when content-type is set to 'application/json'");
        err.statusCode = 400;
        return done(err);
      }
      try {
        const parsed = JSON.parse(body);
        done(null, parsed);
      } catch (err) {
        // let Fastify handle invalid JSON as usual
        err.statusCode = 400;
        done(err);
      }
    });
  } catch (e) {
    serverLogger.warn('Could not add tolerant JSON parser', { message: e && e.message });
  }
  // i had to do this ooo the code wasnt seeing my api key from cloundinary
  //even when it was added from .env config 
  try {
    if (cloudinary && typeof cloudinary.configure === 'function') {
      cloudinary.configure();
    }
  } catch (err) {
    serverLogger.warn('Cloudinary configure failed', { message: err.message });
  }

  // NOTE: auth wiring has a single outer try/catch below that handles non-fatal sub-operation errors

  // Register global error handler from interfaces/middleware
  app.setErrorHandler(errorHandler(serverLogger));

  // create infrastructure & use-cases (simple manual DI)
  // Items feature removed

  // Setup Redis + email queue BEFORE auth (auth needs emailQueue)
  let emailQueue = null;
  let emailWorker = null;
  let mediaQueue = null;
  let mediaWorker = null;
  let redisConnection = null;
  let queueInitError = null;
  const deploymentEnv = process.env.DEPLOYMENT_ENV;
  const redisHostDefault = deploymentEnv === 'docker' ? 'redis' : 'localhost';
  const redisHost = process.env.REDIS_HOST;
  const redisPort = parseInt(process.env.REDIS_PORT);
  let redisClientForLimits = null;

  if (redisHost) {
    try {
      const connectionOptions = {
        connection: {
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
        }
      };

      emailQueue = createEmailQueue(connectionOptions.connection);
      emailWorker = createEmailWorker(connectionOptions.connection);
      mediaQueue = createMediaQueue(connectionOptions.connection);
      redisConnection = connectionOptions.connection;

      // Monitor queue connection state
      emailQueue.on('error', (err) => {
        queueLogger.error('Queue conninstection failed', { error: err.message });
        queueInitError = err;
      });

      emailQueue.on('connection', () => {
        queueLogger.info(`Connected to Redis at ${redisHost}:${redisPort}`);
        queueInitError = null;
      });

      queueLogger.info('Email queue initialized', { redis: `${redisHost}:${redisPort}` });
    } catch (err) {
      queueInitError = err;
      queueLogger.error('Failed to initialize email queue', { error: err.message });
      serverLogger.warn('Continuing without email queue - emails will NOT be sent');
    }
  } else {
    queueLogger.warn('Redis not configured - email queue disabled');
  }

  // Create a persistent ioredis client for rate limiters (connection pooling)
  try {
    if (redisHost) {
      redisClientForLimits = createRedisClient({ host: redisHost, port: redisPort });
      serverLogger.info('Rate limiter Redis client created');
      // expose redis client to request handlers for caching/invalidation
      if (!app.hasDecorator || !app.hasDecorator('redisClient')) {
        app.decorate('redisClient', redisClientForLimits);
      }
      // also expose an OO RedisManager wrapper for global Redis operations
      try {
        const redisManager = new RedisManager({ client: redisClientForLimits });
        if (!app.hasDecorator || !app.hasDecorator('redisManager')) {
          app.decorate('redisManager', redisManager);
        }
        serverLogger.info('RedisManager decorated on app');
      } catch (rmErr) {
        serverLogger.warn('Failed to create RedisManager', { message: rmErr && rmErr.message });
      }
    }
  } catch (e) {
    serverLogger.warn('Failed to create rate limiter Redis client', { message: e.message });
  }

  // Configure Redis eviction policy and maxmemory at startup when possible
  try {
    const maxMemory = process.env.REDIS_MAXMEMORY;
    const desiredPolicy = 'noeviction';
    const envPolicy = process.env.REDIS_MAXMEMORY_POLICY;
    const client = redisClientForLimits;
    if (client && typeof client.config === 'function') {
      await client.config('SET', 'maxmemory', maxMemory);
      // Enforce noeviction to avoid unexpected key evictions.
      await client.config('SET', 'maxmemory-policy', desiredPolicy);
      if (envPolicy && envPolicy !== desiredPolicy) {
        serverLogger.warn('Overriding REDIS_MAXMEMORY_POLICY to noeviction', { envPolicy });
      }
      serverLogger.info('Redis eviction configured', { maxMemory, maxMemoryPolicy: desiredPolicy });
    } else {
      serverLogger.info('Redis client unavailable for CONFIG SET; skipping eviction config');
    }
  } catch (e) {
    serverLogger.warn('Failed to set Redis eviction config', { message: e && e.message });
  }

  // Verify SMTP configuration
  smtpLogger.info('Checking email configuration...');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    smtpLogger.error('Email credentials missing - emails WILL NOT be sent', { missingFields: ['SMTP_USER', 'SMTP_PASS'] });
  } else {
    const smtpOk = await verifyEmailConfig();
    if (!smtpOk) {
      smtpLogger.warn('Email configuration verification failed - emails may not send');
    }
  }

  // Create health controller with queue status info and cloudinary health
  const healthController = makeHealthController({ emailQueue, emailWorker, queueInitError, cloudinary });

  // Register multipart plugin for file uploads (requires @fastify/multipart installed)
  try {
    await app.register(fastifyMultipart, { limits: { fileSize: parseInt(process.env.MAX_AVATAR_BYTES || '5242880', 10) } });
  } catch (err) {
    serverLogger.warn('Multipart plugin registration failed - file uploads will be disabled', { message: err.message });
  }

  // auth setup
  let authController = null;
  let authUseCase = null;
  let profileAdapter = null;
  let profileRepo = null;
  let userAdapter = null;
  let userRepo = null;
  try {
    // Prepare user and profile repos early so auth can create profiles from registration data
    profileAdapter = new MysqlUserProfileRepository();
    profileRepo = new UserProfileRepositoryImpl({ adapter: profileAdapter });

    userAdapter = new MysqlUserRepository();
    userRepo = new UserRepositoryImpl({ adapter: userAdapter });

    // Run OTP cleanup on startup to remove stale/used registration OTPs
    const cleanupHours = parseInt(process.env.OTP_CLEANUP_HOURS || '24', 10);
    const removed = await userRepo.deleteExpiredOtps(cleanupHours);
    serverLogger.info('Expired OTP cleanup completed', { removed });
    const authEducationAdapter = new MysqlUserEducationRepository();
    const authExperienceAdapter = new MysqlUserExperienceRepository();
    const authEducationRepo = new UserEducationRepositoryImpl({ adapter: authEducationAdapter });
    const authExperienceRepo = new UserExperienceRepositoryImpl({ adapter: authExperienceAdapter });
    const userSettingsRepo = new MysqlUserSettingsRepository();
    const passwordResetAdapter = new MysqlPasswordResetRepository();
    authUseCase = new AuthUseCase({ userRepository: userRepo, profileRepository: profileRepo, educationRepository: authEducationRepo, experienceRepository: authExperienceRepo, settingsRepository: userSettingsRepo, emailQueue: emailQueue, jwtSecret: process.env.JWT_SECRET, jwtExpiresIn: process.env.JWT_EXPIRES_IN, passwordResetRepository: passwordResetAdapter });
    authController = makeAuthController({ useCase: authUseCase });
    // oauth controller (Google)
    const oauthController = makeOauthController({ useCase: authUseCase });
    Object.assign(authController, oauthController);
  } catch (e) {
    // Log full error stack to help debug auth wiring failures in production
    serverLogger.error('Auth modules not fully configured', { error: e && (e.stack || e.message) });
  }

  // register app routes
  const controllers = { ...healthController, ...makeCompatController() };
  let notificationRepository = null;
  try {
    notificationRepository = new MysqlNotificationRepository();
    Object.assign(controllers, makeNotificationController({ repository: notificationRepository }));
  } catch (notificationErr) {
    serverLogger.warn('Notifications wiring failed', { message: notificationErr && notificationErr.message });
  }
  try {
    const legalDocumentRepository = new MysqlLegalDocumentRepository();
    const legalDocumentUseCase = new LegalDocumentUseCase({ repository: legalDocumentRepository });
    Object.assign(controllers, makeLegalDocumentController({ useCase: legalDocumentUseCase }));
  } catch (legalErr) {
    serverLogger.warn('Legal documents wiring failed', { message: legalErr && legalErr.message });
  }
  try {
    const jobsFreelancersRepository = new MysqlJobsFreelancersRepository();
    const jobsFreelancersUseCase = new JobsFreelancersUseCase({ repository: jobsFreelancersRepository, notificationRepository });
    Object.assign(controllers, makeJobsFreelancersController({ useCase: jobsFreelancersUseCase, notificationRepository }));
  } catch (jobsErr) {
    serverLogger.warn('Jobs/Freelancers wiring failed', { message: jobsErr && jobsErr.message });
  }
  try {
    const advertRepository = new MysqlAdvertRepository();
    const advertAssetRepository = new MysqlUserAssetRepository();
    const advertUseCase = new AdvertUseCase({ repository: advertRepository, assetRepository: advertAssetRepository });
    Object.assign(controllers, makeAdvertController({ useCase: advertUseCase }));
  } catch (advertErr) {
    serverLogger.warn('Advert wiring failed', { message: advertErr && advertErr.message });
  }
  // create rate limiters if Redis client available
  let rateLimiters = null;
  try {
    if (redisClientForLimits) {
      rateLimiters = createRateLimiters(redisClientForLimits, { userRepository: userRepo });
      serverLogger.info('Rate limiters initialized');
    }
  } catch (e) {
    serverLogger.warn('Rate limiter initialization failed', { message: e.message });
  }
  // expose queues from server instance for controllers to use (e.g., mediaQueue)
  app.decorate('mediaQueue', mediaQueue);
  // profileRepository is decorated after initialization below
  let loginHistoryRepo = null;
  // user controllers & repositories
  try {
    // Instantiate adapters (create only if auth wiring didn't already)
    profileAdapter = profileAdapter || new MysqlUserProfileRepository();
    const skillAdapter = new MysqlUserSkillRepository();
    const portfolioAdapter = new MysqlUserPortfolioRepository();
    const followerAdapter = new MysqlFollowerRepository();
    const oauthAdapter = new MysqlUserOauthRepository();
    const loginHistoryAdapter = new MysqlUserLoginHistoryRepository();
    const certAdapter = new MysqlUserCertificationRepository();
    const eduAdapter = new MysqlUserEducationRepository();
    const expAdapter = new MysqlUserExperienceRepository();

    // Create repository wrappers (domain implementations)
    profileRepo = profileRepo || new UserProfileRepositoryImpl({ adapter: profileAdapter });
    if (!app.hasDecorator || !app.hasDecorator('profileRepository')) {
      app.decorate('profileRepository', profileRepo);
    }
    const skillRepo = new UserSkillRepositoryImpl({ adapter: skillAdapter });
    const portfolioRepo = new UserPortfolioRepositoryImpl({ adapter: portfolioAdapter });
    const followerRepo = new FollowerRepositoryImpl({ adapter: followerAdapter });
    const oauthRepo = new UserOauthRepositoryImpl({ adapter: oauthAdapter });
    loginHistoryRepo = loginHistoryRepo || new UserLoginHistoryRepositoryImpl({ adapter: loginHistoryAdapter });
    // If auth use-case exists, attach login history repo so it can record logins
    try {
      if (typeof authUseCase !== 'undefined' && authUseCase && loginHistoryRepo) {
        authUseCase.loginHistoryRepository = loginHistoryRepo;
      }
    } catch (attachErr) {
      serverLogger.warn('Could not attach loginHistoryRepo to authUseCase', attachErr && attachErr.message);
    }
    const certRepo = new UserCertificationRepositoryImpl({ adapter: certAdapter });
    const eduRepo = new UserEducationRepositoryImpl({ adapter: eduAdapter });
    const expRepo = new UserExperienceRepositoryImpl({ adapter: expAdapter });

    userAdapter = userAdapter || new MysqlUserRepository();
    userRepo = userRepo || new UserRepositoryImpl({ adapter: userAdapter });

    // media worker and controller initialization was moved to after pages wiring

    // Create application-level use-case and pass to controller
    try {
      const userUseCase = new UserUseCase({
        userRepository: userRepo,
        profileRepository: profileRepo,
        skillRepository: skillRepo,
        portfolioRepository: portfolioRepo,
        followerRepository: followerRepo,
        oauthRepository: oauthRepo,
        loginHistoryRepository: loginHistoryRepo,
        certificationRepository: certRepo,
        educationRepository: eduRepo,
        experienceRepository: expRepo,
        settingsRepository: userSettingsRepo
      });
      const userController = makeUserController({
        useCase: userUseCase,
        userRepository: userRepo,
        profileRepository: profileRepo,
        skillRepository: skillRepo,
        portfolioRepository: portfolioRepo,
        followerRepository: followerRepo,
        oauthRepository: oauthRepo,
        loginHistoryRepository: loginHistoryRepo,
        certificationRepository: certRepo,
        educationRepository: eduRepo,
        experienceRepository: expRepo,
        notificationRepository
      });
      Object.assign(controllers, userController);
      // Posts wiring
      try {
        const postAdapter = new MysqlPostRepository();
        const postRepo = new PostRepositoryImpl({ adapter: postAdapter });
        // expose post adapter for controllers that need adapter-level methods (e.g., listByPage)
        if (!app.hasDecorator || !app.hasDecorator('postAdapter')) {
          app.decorate('postAdapter', postAdapter);
        }
        const postUseCase = new PostUseCase({ postRepository: postRepo, notificationRepository });
        const postController = makePostController({ useCase: postUseCase });
        Object.assign(controllers, postController);
        // Post interactions wiring (save/report)
        try {
          const postSaveAdapter = new MysqlPostSaveRepository();
          const postReportAdapter = new MysqlPostReportRepository();
          const commentReportAdapter = new MysqlCommentReportRepository();
          const postInteractionUseCase = new PostInteractionUseCase({ postSaveRepository: postSaveAdapter, postReportRepository: postReportAdapter, commentReportRepository: commentReportAdapter });
          const postInteractionController = makePostInteractionController({ useCase: postInteractionUseCase });
          Object.assign(controllers, postInteractionController);
        } catch (piErr) {
          serverLogger.warn('Post interaction wiring failed', piErr && piErr.message);
        }
        // Comments wiring
        try {
          const commentAdapter = new MysqlCommentRepository();
          const commentUseCase = new CommentUseCase({ commentRepository: commentAdapter });
          const commentController = makeCommentController({ useCase: commentUseCase, notificationRepository, postRepository: postAdapter });
          Object.assign(controllers, commentController);
        } catch (cErr) {
          serverLogger.warn('Comments wiring failed', cErr && cErr.message);
        }
        // Reactions wiring
        try {
          const postReactionAdapter = new MysqlPostReactionRepository();
          const commentReactionAdapter = new MysqlCommentReactionRepository();
          const reactionUseCase = new ReactionUseCase({ postReactionRepository: postReactionAdapter, commentReactionRepository: commentReactionAdapter });
          const reactionController = makeReactionController({ useCase: reactionUseCase, notificationRepository, postRepository: postAdapter, commentRepository: commentAdapter });
          Object.assign(controllers, reactionController);
        } catch (rErr) {
          serverLogger.warn('Reactions wiring failed', rErr && rErr.message);
        }
        // post media use-case and controller (no direct repo injection into controllers)
        try {
          const postMediaAdapter = new MysqlPostMediaRepository();
          postUseCase.postMediaRepository = postMediaAdapter;
          const postMediaUseCase = new PostMediaUseCase({ postMediaRepository: postMediaAdapter, mediaQueue });
          const postMediaController = makePostMediaController({ useCase: postMediaUseCase });
          Object.assign(controllers, postMediaController);
        } catch (pmErr) {
          serverLogger.warn('Post media wiring failed', pmErr && pmErr.message);
        }
        // Pages wiring
        try {
          const pageAdapter = new MysqlPageRepository();
          const pageRepo = new PageRepositoryImpl({ adapter: pageAdapter });
          const pageCategoryAdapter = new MysqlPageCategoryRepository();
          const pageCategoryRepo = new PageCategoryRepositoryImpl({ adapter: pageCategoryAdapter });
          const pageUseCase = new PageUseCase({ pageRepository: pageRepo });
          // attach optional category repository for max_pages_per_user checks
          pageUseCase.pageCategoryRepository = pageCategoryRepo;
          // attach page repository to post use-case so posts can update page counters
          try {
            if (typeof postUseCase !== 'undefined' && postUseCase && typeof postUseCase === 'object') {
              postUseCase.pageRepository = pageRepo;
            }
          } catch (attachErr) {
            serverLogger.warn('Could not attach pageRepo to postUseCase', attachErr && attachErr.message);
          }
          const pageFollowerAdapter = new MysqlPageFollowerRepository();
          const pageFollowerRepo = new PageFollowerRepositoryImpl({ adapter: pageFollowerAdapter });
          const pageController = makePageController({
            useCase: pageUseCase,
            followersRepository: pageFollowerRepo,
            userRepository: userRepo,
            profileRepository: profileRepo,
            skillRepository: skillRepo
          });
          Object.assign(controllers, pageController);
          // Communities wiring
          try {
            const communityCategoryAdapter = new MysqlCommunityCategoryRepository();
            const communityCategoryRepo = new CommunityCategoryRepositoryImpl({ adapter: communityCategoryAdapter });
            const communityAdapter = new MysqlCommunityRepository();
            const communityRepo = new CommunityRepositoryImpl({ adapter: communityAdapter });
            const communityMemberAdapter = new MysqlCommunityMemberRepository();
            const communityMemberRepo = new CommunityMemberRepositoryImpl({ adapter: communityMemberAdapter });
            const communityUseCase = new CommunityUseCase({ communityRepository: communityRepo, communityCategoryRepository: communityCategoryRepo, communityMemberRepository: communityMemberRepo });
            const communityController = makeCommunityController({ useCase: communityUseCase });
            Object.assign(controllers, communityController);
            // Attach community repos to postUseCase if available so posts can validate membership
            try {
              if (typeof postUseCase !== 'undefined' && postUseCase) {
                postUseCase.communityRepository = communityRepo;
                postUseCase.communityMemberRepository = communityMemberRepo;
              }
            } catch (attachErr) {
              serverLogger.warn('Could not attach community repos to postUseCase', attachErr && attachErr.message);
            }
          } catch (cErr) {
            serverLogger.warn('Communities wiring failed', cErr && cErr.message);
          }
          // Initialize media worker and controller now that pageRepo exists
          try {
            const assetAdapter = new MysqlUserAssetRepository();
            const postMediaAdapter = new MysqlPostMediaRepository();
            if (mediaQueue && !mediaWorker && redisConnection) {
              mediaWorker = createMediaWorker(redisConnection, { cloudinary, profileRepository: profileRepo, assetAdapter, postMediaAdapter, pageRepository: pageRepo, redisClient: redisClientForLimits, concurrency });
            }
            // Attach asset adapter to postUseCase so posts can validate asset readiness
            try {
              if (typeof postUseCase !== 'undefined' && postUseCase && assetAdapter) {
                postUseCase.assetRepository = assetAdapter;
                postUseCase.postMediaRepository = postMediaAdapter;
              }
            } catch (attachErr) {
              serverLogger.warn('Could not attach assetAdapter to postUseCase', attachErr && attachErr.message);
            }
            const mediaController = makeMediaController({ cloudinary, mediaQueue, assetAdapter });
            Object.assign(controllers, mediaController);
            // Questions & Answers wiring
            try {
              const questionAdapter = new MysqlQuestionRepository();
              const answerAdapter = new MysqlAnswerRepository();
              const questionRepo = new QuestionRepositoryImpl({ adapter: questionAdapter });
              const answerRepo = new AnswerRepositoryImpl({ adapter: answerAdapter });
              const questionUseCase = new QuestionUseCase({ questionRepository: questionRepo, answerRepository: answerRepo });
              const questionController = makeQuestionController({ useCase: questionUseCase, notificationRepository });
              Object.assign(controllers, questionController);
              const feedController = makeFeedController({ postUseCase, questionUseCase });
              Object.assign(controllers, feedController);
            } catch (qErr) {
              serverLogger.warn('Questions wiring failed', qErr && qErr.message);
            }
          } catch (mwErr) {
            serverLogger.warn('Media worker/controller init after pages failed', mwErr && mwErr.message);
          }
        } catch (pErr) {
          serverLogger.warn('Pages wiring failed', pErr && pErr.message);
        }
      } catch (postErr) {
        serverLogger.warn('Posts module wiring failed', postErr && postErr.message);
      }
    } catch (err) {
      serverLogger.warn('User use-case wiring failed, falling back to repo-based controller', err && err.message);
      const userController = makeUserController({
        userRepository: userRepo,
        profileRepository: profileRepo,
        skillRepository: skillRepo,
        portfolioRepository: portfolioRepo,
        followerRepository: followerRepo,
        oauthRepository: oauthRepo,
        loginHistoryRepository: loginHistoryRepo,
        notificationRepository
      });
      Object.assign(controllers, userController);
    }
  } catch (err) {
    serverLogger.warn('User controllers not fully configured', err && err.message);
  }
  if (authController)
    Object.assign(controllers, authController);
  // Attach logout handler to record logout events in login history
  try {
    if (typeof loginHistoryRepo !== 'undefined' && loginHistoryRepo) {
      controllers.Logout = async (req, reply) => {
        try {
          const authHeader = req.headers && (req.headers.authorization || req.headers.Authorization);
          if (!authHeader)
            return reply.code(401).send({
              success: false,
              message: 'Authorization header required',
              data: null
            });

          const parts = String(authHeader).split(' ');
          if (parts.length !== 2 || parts[0] !== 'Bearer')
            return reply.code(401).send({
              success: false,
              message: 'Invalid authorization header',
              data: null
            });

          const token = parts[1];
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          const userId = payload && (payload.sub || payload.userId || payload.id);
          if (!userId)
            return reply.code(401).send({
              success: false,
              message: 'Token missing subject',
              data: null
            });

          await loginHistoryRepo.create({
            id: uuidv4(),
            user_id: userId,
            login_method: 'logout',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || null,
            login_at: new Date()
          });

          // Revoke existing tokens by bumping user's token_version
          try {
            if (userRepo && typeof userRepo.incrementTokenVersion === 'function') {
              await userRepo.incrementTokenVersion(userId);
            }
          } catch (revErr) {
            serverLogger.warn('Failed to increment token version on logout', { message: revErr.message });
          }

          return reply.code(200).send({ success: true, message: 'Logged out successfully' });
        } catch (err) {
          if (err && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
            serverLogger.warn('Logout invalid token', { message: err.message });
            return reply.code(401).send({
              success: false,
              message: 'Token invalid or expired',
              data: null
            });
          }
          serverLogger.error('Logout handler error', { message: err.message, stack: err.stack });
          return reply.code(500).send({
            success: false,
            message: 'An unexpected error occurred',
            data: null
          });
        }
      };
    }
  } catch (attachErr) {
    serverLogger.warn('Could not attach logout handler', attachErr && attachErr.message);
  }
  // Register Swagger before routes so it collects schemas as routes are added
  try {
    serverLogger.debug('Registering Swagger plugin...');
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'SkillForExport API',
          version: '0.1.0',
          description: 'API documentation for SkillForExport backend'
        },
        servers: [{
          url: 'http://skills4export.org',
          description: 'Development server'
        }]
      },
      exposeRoute: true,
      routePrefix: '/documentation/json'
    });
    serverLogger.debug('Swagger plugin registered');

    serverLogger.debug('Registering Swagger UI plugin...');
    await app.register(fastifySwaggerUi, {
      routePrefix: '/documentation',
      swagger: { url: '/documentation/json' },
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      }
    });
    serverLogger.debug('Swagger UI plugin registered');
  } catch (err) {
    app.log.warn('Swagger registration failed', err && err.message);
  }
  // Populate `req.user` using centralized middleware
  // Register CORS to handle preflight OPTIONS and allow cross-origin requests
  try {
    const corsOrigins = parseCorsOrigins();
    await app.register(fastifyCors, {
      origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin, corsOrigins)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
      credentials: true,
      maxAge: 86400
    });
    serverLogger.info('CORS plugin registered', { origins: corsOrigins });
  } catch (err) {
    serverLogger.warn('CORS registration failed', { message: err && err.message });
  }

  app.addHook('preHandler', makePopulateUser({ userRepository: userRepo, jwtSecret: process.env.JWT_SECRET }));

  // authRequired is provided from interfaces/middleware/authRequired.js

  serverLogger.debug('Registering API routes...');
  // Mount application routes under /api so endpoints become /api/<route>
  await app.register(async function (instance, opts) {
    await registerRoutes(instance, { controllers, rateLimiters, authRequired });
  }, { prefix: '/api' });
  serverLogger.debug('API routes registered under /api');

  // No separate /mobile mount — unified API flow under /api

  // Email queue already initialized above
  // start
  const port = config.port || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  serverLogger.info(`Server started successfully`, {
    port,
    apiUrl: `http://skills4export.org:${port}`,
    swaggerDocs: `http://skills4export.org:${port}/documentation`,
    openApiJson: `http://skills4export.org:${port}/documentation/json`
  });
  return app;
}
