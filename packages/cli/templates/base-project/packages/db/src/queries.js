import { prisma } from "./client.js";

/**
 * Safe select for user queries — excludes sensitive fields (password).
 * Use this on any query whose result is returned to the client.
 */
const USER_SAFE_SELECT = {
	id: true,
	email: true,
	emailVerified: true,
	name: true,
	image: true,
	role: true,
	createdAt: true,
	updatedAt: true,
};

// User queries
export const user = {
	findById: (id) => {
		return prisma.user.findUnique({
			where: { id },
			select: USER_SAFE_SELECT,
		});
	},
	findByIdWithPosts: (id) => {
		return prisma.user.findUnique({
			where: { id },
			select: { ...USER_SAFE_SELECT, posts: true },
		});
	},
	/**
	 * findByEmail returns ALL fields including password.
	 * Only use for internal auth — never expose the result directly to clients.
	 */
	findByEmail: (email) => {
		return prisma.user.findUnique({
			where: { email },
		});
	},
	findAll: (options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.user.findMany({
			skip,
			take,
			select: USER_SAFE_SELECT,
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.user.create({
			data,
			select: USER_SAFE_SELECT,
		});
	},
	update: (id, data) => {
		return prisma.user.update({
			where: { id },
			data,
			select: USER_SAFE_SELECT,
		});
	},
	delete: (id) => {
		return prisma.user.delete({
			where: { id },
		});
	},
};

/**
 * Safe author include — returns author without sensitive fields.
 */
const AUTHOR_SAFE_INCLUDE = { author: { select: USER_SAFE_SELECT } };

// Post queries
export const post = {
	findById: (id) => {
		return prisma.post.findUnique({
			where: { id },
			include: AUTHOR_SAFE_INCLUDE,
		});
	},
	findAll: (options = {}) => {
		const { skip = 0, take = 10, where, orderBy } = options;
		return prisma.post.findMany({
			where,
			skip,
			take,
			include: AUTHOR_SAFE_INCLUDE,
			orderBy: orderBy || { createdAt: "desc" },
		});
	},
	findPublished: (options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.post.findMany({
			where: { published: true },
			skip,
			take,
			include: AUTHOR_SAFE_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	},
	findByAuthor: (authorId, options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.post.findMany({
			where: { authorId },
			skip,
			take,
			include: AUTHOR_SAFE_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.post.create({
			data,
			include: AUTHOR_SAFE_INCLUDE,
		});
	},
	update: (id, data) => {
		return prisma.post.update({
			where: { id },
			data,
			include: AUTHOR_SAFE_INCLUDE,
		});
	},
	delete: (id) => {
		return prisma.post.delete({
			where: { id },
		});
	},
};

// Note: Job tracking is handled by BullMQ's built-in Redis persistence.
// The Prisma Job model is retained in the schema for optional audit/reporting
// but these query helpers have been removed to avoid confusion with BullMQ.
// If you need database-backed job auditing, re-add job queries here and wire
// the worker to write status updates to the Job table.

// Account queries (NextAuth)
export const account = {
	findById: (id) => {
		return prisma.account.findUnique({
			where: { id },
		});
	},
	findByUserIdAndProvider: (userId, provider) => {
		return prisma.account.findFirst({
			where: { userId, provider },
		});
	},
	findByUser: (userId) => {
		return prisma.account.findMany({
			where: { userId },
		});
	},
	create: (data) => {
		return prisma.account.create({
			data,
		});
	},
	delete: (id) => {
		return prisma.account.delete({
			where: { id },
		});
	},
};

// Session queries (NextAuth)
export const session = {
	findByToken: (sessionToken) => {
		return prisma.session.findUnique({
			where: { sessionToken },
			include: { user: { select: USER_SAFE_SELECT } },
		});
	},
	findByUserId: (userId) => {
		return prisma.session.findMany({
			where: { userId },
		});
	},
	create: (data) => {
		return prisma.session.create({
			data,
			include: { user: { select: USER_SAFE_SELECT } },
		});
	},
	update: (sessionToken, data) => {
		return prisma.session.update({
			where: { sessionToken },
			data,
		});
	},
	delete: (sessionToken) => {
		return prisma.session.delete({
			where: { sessionToken },
		});
	},
	deleteByUserId: (userId) => {
		return prisma.session.deleteMany({
			where: { userId },
		});
	},
};

// Verification Token queries (NextAuth)
export const verificationToken = {
	findByToken: (token) => {
		return prisma.verificationToken.findUnique({
			where: { token },
		});
	},
	findByIdentifierAndToken: (identifier, token) => {
		return prisma.verificationToken.findUnique({
			where: { identifier_token: { identifier, token } },
		});
	},
	create: (data) => {
		return prisma.verificationToken.create({
			data,
		});
	},
	delete: (identifier, token) => {
		return prisma.verificationToken.deleteMany({
			where: { identifier, token },
		});
	},
	deleteExpired: () => {
		return prisma.verificationToken.deleteMany({
			where: { expires: { lt: new Date() } },
		});
	},
};

// File queries
export const file = {
	create: (data) => {
		return prisma.file.create({ data });
	},
	findById: (id) => {
		return prisma.file.findUnique({
			where: { id },
			include: {
				uploadedBy: { select: { id: true, email: true, name: true } },
			},
		});
	},
	findByStorageKey: (storageKey) => {
		return prisma.file.findUnique({ where: { storageKey } });
	},
	findByUploader: (uploadedById, options = {}) => {
		const { skip = 0, take = 50 } = options;
		return prisma.file.findMany({
			where: { uploadedById },
			skip,
			take,
			orderBy: { createdAt: "desc" },
		});
	},
	findOrphaned: (options = {}) => {
		const { take = 100 } = options;
		return prisma.file.findMany({
			where: { uploadedById: null },
			take,
			orderBy: { createdAt: "asc" },
		});
	},
	findOlderThan: (date, options = {}) => {
		const { take = 100 } = options;
		return prisma.file.findMany({
			where: {
				uploadedById: null,
				createdAt: { lt: date },
			},
			take,
			orderBy: { createdAt: "asc" },
		});
	},
	delete: (id) => {
		return prisma.file.delete({ where: { id } });
	},
	deleteMany: (ids) => {
		return prisma.file.deleteMany({ where: { id: { in: ids } } });
	},
	count: (where = {}) => {
		return prisma.file.count({ where });
	},
};

// AuditLog queries
export const auditLog = {
	findAll: (options = {}) => {
		const { skip = 0, take = 50 } = options;
		return prisma.auditLog.findMany({
			skip,
			take,
			include: { user: { select: { id: true, email: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
	},
	findByUserId: (userId, options = {}) => {
		const { skip = 0, take = 50 } = options;
		return prisma.auditLog.findMany({
			where: { userId },
			skip,
			take,
			include: { user: { select: { id: true, email: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
	},
	findByEntity: (entity, options = {}) => {
		const { skip = 0, take = 50 } = options;
		return prisma.auditLog.findMany({
			where: { entity },
			skip,
			take,
			include: { user: { select: { id: true, email: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
	},
	findByAction: (action, options = {}) => {
		const { skip = 0, take = 50 } = options;
		return prisma.auditLog.findMany({
			where: { action },
			skip,
			take,
			include: { user: { select: { id: true, email: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.auditLog.create({
			data,
			include: { user: { select: { id: true, email: true, name: true } } },
		});
	},
};
