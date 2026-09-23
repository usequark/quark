/**
 * @techstream/quark-core - Core Barrel (Lightweight Utilities)
 *
 * A smaller entry-point that exposes only the modules with zero or
 * minimal transitive dependencies: errors, logger, validation, utils,
 * pagination, csrf, rate-limiter, file-validation, and db.
 *
 * Downstream projects that only need these utilities can import from
 * "@techstream/quark-core/core" to avoid pulling in heavier modules
 * like email, storage, queue, or metrics.
 */

// CSRF — depends on node:crypto + errors
export * from "./csrf.js";
// Database utilities — depends on the optional `pg` peer (loaded lazily by
// pingDatabase); createPrismaClient takes the app's Prisma client class.
export * from "./db.js";
// Errors — zero external deps
export * from "./errors.js";
// File validation — zero external deps
export * from "./file-validation.js";
// Logger — zero external deps
export * from "./logger.js";
// Pagination — depends on zod + errors
export * from "./pagination.js";

// Rate limiter — zero external deps (Redis optional at runtime)
export * from "./rate-limiter.js";
// Utilities — zero external deps
export * from "./utils.js";
// Validation — depends on zod
export * from "./validation.js";
