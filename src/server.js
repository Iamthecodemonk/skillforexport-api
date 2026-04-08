// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import Fastify from 'fastify';
import config from './config/index.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import registerRoutes from './interfaces/routes/index.js';
import { makeHealthController } from './interfaces/controllers/healthController.js';
import { Queue, Worker } from 'bullmq';
import { MysqlUserRepository } from './infrastructure/repositories/index.js';
import { UserRepositoryImpl } from './domain/repositories/userRepository.js';
import { MysqlUserProfileRepository, MysqlUserAssetRepository, MysqlUserSkillRepository, MysqlUserPortfolioRepository, MysqlFollowerRepository, MysqlUserOauthRepository, MysqlUserLoginHistoryRepository, MysqlUserCertificationRepository, MysqlUserEducationRepository, MysqlUserExperienceRepository } from './infrastructure/repositories/index.js';
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
import AuthUseCase from './application/use-cases/authUseCase.js';
import { makeAuthController } from './interfaces/controllers/authController.js';
import { makeOauthController } from './interfaces/controllers/oauthController.js';
import UserUseCase from './application/use-cases/userUseCase.js';
import { createEmailQueue, createEmailWorker } from './infrastructure/queue/emailQueue.js';
import { createMediaQueue, createMediaWorker } from './infrastructure/queue/mediaQueue.js';
import { makeMediaController } from './interfaces/controllers/mediaController.js';
import fastifyMultipart from '@fastify/multipart';
import { verifyEmailConfig } from './utils/emailService.js';
import logger from './utils/logger.js';
import cloudinary from './utils/cloudinary.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const serverLogger = logger.child('SERVER');
const queueLogger = logger.child('EMAIL_QUEUE');
const smtpLogger = logger.child('SMTP');
const concurrency = parseInt('2', 10);

export default async function startServer() {
  const app = Fastify({
    logger: true,
    ajv: {
      customOptions: {
        // Allow OpenAPI example/unknown keywords in route schemas
        strict: false
      }
    }
  });
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

  // Global error handler to log all errors
  app.setErrorHandler((error, request, reply) => {
    serverLogger.error('Unhandled error', {
      message: error.message,
      stack: error.stack,
      method: request.method,
      url: request.url
    });
    app.log.error(error);
    reply.code(500).send({ error: 'internal_error', message: error.message });
  });

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
    const authUseCase = new AuthUseCase({ userRepository: userRepo, profileRepository: profileRepo, emailQueue: emailQueue, jwtSecret: process.env.JWT_SECRET, jwtExpiresIn: process.env.JWT_EXPIRES_IN });
    authController = makeAuthController({ useCase: authUseCase });
    // oauth controller (Google)
    const oauthController = makeOauthController({ useCase: authUseCase });
    Object.assign(authController, oauthController);
  } catch (e) {
    app.log.warn('Auth modules not fully configured', e && e.message);
  }

  // register app routes
  const controllers = { ...healthController };
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
    const certRepo = new UserCertificationRepositoryImpl({ adapter: certAdapter });
    const eduRepo = new UserEducationRepositoryImpl({ adapter: eduAdapter });
    const expRepo = new UserExperienceRepositoryImpl({ adapter: expAdapter });

    userAdapter = userAdapter || new MysqlUserRepository();
    userRepo = userRepo || new UserRepositoryImpl({ adapter: userAdapter });

    // Start media worker now that profileRepo exists (so worker can update profiles)
    try {
      // instantiate asset adapter for worker and controllers
      const assetAdapter = new MysqlUserAssetRepository();

      if (mediaQueue && !mediaWorker && redisConnection) {
        mediaWorker = createMediaWorker(redisConnection, { cloudinary, profileRepository: profileRepo, assetAdapter, concurrency });
      }

      // media controller (signature + multipart upload) - create after adapters exist
      const mediaController = makeMediaController({ cloudinary, mediaQueue, assetAdapter });
      Object.assign(controllers, mediaController);
    } catch (mwErr) {
      serverLogger.warn('Media worker or controller initialization failed', mwErr && mwErr.message);
    }

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
        experienceRepository: expRepo
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
        experienceRepository: expRepo
      });
      Object.assign(controllers, userController);
    } catch (err) {
      serverLogger.warn('User use-case wiring failed, falling back to repo-based controller', err && err.message);
      const userController = makeUserController({
        userRepository: userRepo,
        profileRepository: profileRepo,
        skillRepository: skillRepo,
        portfolioRepository: portfolioRepo,
        followerRepository: followerRepo,
        oauthRepository: oauthRepo,
        loginHistoryRepository: loginHistoryRepo
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
              error: { code: 'unauthorized', message: 'Authorization header required' }
            });

          const parts = String(authHeader).split(' ');
          if (parts.length !== 2 || parts[0] !== 'Bearer')
            return reply.code(401).send({
              success: false,
              error: { code: 'unauthorized', message: 'Invalid authorization header' }
            });

          const token = parts[1];
          const payload = jwt.verify(token, process.env.JWT_SECRET);
          const userId = payload && (payload.sub || payload.userId || payload.id);
          if (!userId)
            return reply.code(401).send({
              success: false,
              error: { code: 'unauthorized', message: 'Token missing subject' }
            });

          await loginHistoryRepo.create({
            id: uuidv4(),
            user_id: userId,
            login_method: 'logout',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'] || null,
            login_at: new Date()
          });

          return reply.code(200).send({ success: true });
        } catch (err) {
          if (err && (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError')) {
            serverLogger.warn('Logout invalid token', { message: err.message });
            return reply.code(401).send({
              success: false,
              error: { code: 'invalid_token', message: 'Token invalid or expired' }
            });
          }
          serverLogger.error('Logout handler error', { message: err.message, stack: err.stack });
          return reply.code(500).send({
            success: false,
            error: { code: 'internal_error', message: 'An unexpected error occurred' }
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
          url: 'http://localhost:3011',
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

  serverLogger.debug('Registering API routes...');
  await registerRoutes(app, { controllers });
  serverLogger.debug('API routes registered');

  // Email queue already initialized above
  // start
  const port = config.port || 3000;
  await app.listen({ port, host: '0.0.0.0' });
  serverLogger.info(`Server started successfully`, {
    port,
    apiUrl: `http://localhost:${port}`,
    swaggerDocs: `http://localhost:${port}/documentation`,
    openApiJson: `http://localhost:${port}/documentation/json`
  });
  return app;
}
