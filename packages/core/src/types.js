/**
 * @usequark/quark-core - Type Definitions
 * TypeScript types and JSDoc type definitions for better IDE support
 */

/**
 * @typedef {Object} Session
 * @property {Object} user
 * @property {string} user.id - User ID
 * @property {string} user.email - User email
 * @property {string} [user.name] - User name
 * @property {string} [user.image] - User image URL
 * @property {number} expires - Session expiration timestamp
 */

/**
 * @typedef {Object} AuthConfig
 * @property {string} [secret] - NextAuth secret
 * @property {Array} providers - NextAuth providers
 * @property {Object} session - Session configuration
 * @property {Object} callbacks - NextAuth callbacks
 * @property {string} session.strategy - Session strategy (jwt or database)
 * @property {number} session.maxAge - Max session age in seconds
 * @property {number} session.updateAge - Session update age in seconds
 */

/**
 * @typedef {Object} QueueConfig
 * @property {Object} redis - Redis connection config
 * @property {string} redis.host - Redis host
 * @property {number} redis.port - Redis port
 * @property {number} redis.db - Redis database number
 * @property {Object} defaultJobOptions - Default options for all jobs
 * @property {number} defaultJobOptions.attempts - Max retry attempts
 * @property {Object} defaultJobOptions.backoff - Backoff strategy
 */

/**
 * @typedef {Object} JobData
 * @property {string} id - Unique job identifier
 * @property {string} queueName - Name of the queue
 * @property {Object} data - Job payload data
 * @property {string} [state] - Job state (waiting, active, completed, failed)
 * @property {number} [progress] - Job progress percentage (0-100)
 * @property {number} [attempts] - Number of attempts made
 */

/**
 * @typedef {Object} AppErrorJSON
 * @property {string} name - Error type name
 * @property {string} message - Error message
 * @property {string} code - Machine-readable error code
 * @property {number} statusCode - HTTP status code
 * @property {string} timestamp - ISO timestamp when error occurred
 */

/**
 * @typedef {Object} DbClientOptions
 * @property {string} [datasourceUrl] - Prisma datasource URL
 * @property {boolean} [errorFormat] - Error format for Prisma
 * @property {Object} [middleware] - Prisma middleware functions
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} healthy - Overall system health
 * @property {Object} checks - Individual component health checks
 * @property {boolean} checks.database - Database connectivity
 * @property {boolean} checks.redis - Redis connectivity
 * @property {string} timestamp - Health check timestamp
 */

// Export as module exports for JavaScript usage
export {};
