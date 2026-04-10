// Re-exports for repository implementations
export { default as MysqlUserRepository } from './mysqlUserRepository.js';
// Item repositories removed
export { default as MysqlUserProfileRepository } from './mysqlUserProfileRepository.js';
export { default as MysqlUserAssetRepository } from './mysqlUserAssetRepository.js';
export { default as MysqlUserSkillRepository } from './mysqlUserSkillRepository.js';
export { default as MysqlUserPortfolioRepository } from './mysqlUserPortfolioRepository.js';
export { default as MysqlFollowerRepository } from './mysqlFollowerRepository.js';
export { default as MysqlUserOauthRepository } from './mysqlUserOauthRepository.js';
export { default as MysqlUserLoginHistoryRepository } from './mysqlUserLoginHistoryRepository.js';
export { default as MysqlUserCertificationRepository } from './mysqlUserCertificationRepository.js';
export { default as MysqlUserEducationRepository } from './mysqlUserEducationRepository.js';
export { default as MysqlUserExperienceRepository } from './mysqlUserExperienceRepository.js';
export { default as MysqlCommentRepository } from './mysqlCommentRepository.js';
export { default as MysqlPostReactionRepository } from './mysqlPostReactionRepository.js';
export { default as MysqlCommentReactionRepository } from './mysqlCommentReactionRepository.js';
export { default as MysqlPostSaveRepository } from './mysqlPostSaveRepository.js';
export { default as MysqlPostReportRepository } from './mysqlPostReportRepository.js';

export { default as MysqlPageRepository } from './mysqlPageRepository.js';
export { default as MysqlPageCategoryRepository } from './mysqlPageCategoryRepository.js';
export { default as MysqlPageFollowerRepository } from './mysqlPageFollowerRepository.js';

// Legacy aliases for backwards compatibility (deprecated)
// Legacy aliases removed for Items
export { default as PrismaUserRepository } from './mysqlUserRepository.js';
