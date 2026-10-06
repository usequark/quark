import { prisma } from "./client.js";

/**
 * Safe select for user queries - excludes sensitive fields (password).
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

export { USER_SAFE_SELECT };

// User queries
export const user = {
	findById: (id) => {
		return prisma.user.findUnique({
			where: { id },
			select: USER_SAFE_SELECT,
		});
	},

	/**
	 * findByEmail returns ALL fields including password.
	 * Only use for internal auth - never expose the result directly to clients.
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
	count: () => {
		return prisma.user.count();
	},
};

// Job queries
export const job = {
	findAll: (options = {}) => {
		const { skip = 0, take = 50, where = {} } = options;
		return prisma.job.findMany({
			skip,
			take,
			where,
			orderBy: { createdAt: "desc" },
		});
	},

	findById: (id) => {
		return prisma.job.findUnique({ where: { id } });
	},

	upsert: (id, data) => {
		return prisma.job.upsert({
			where: { id },
			create: { id, ...data },
			update: data,
		});
	},
};

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
	/**
	 * Deletes a File row and reports whether this call was the one that removed
	 * it.
	 *
	 * `delete()` throws P2025 when the row is already gone, which is the normal
	 * outcome of two concurrent DELETEs of the same file and is not an error
	 * worth surfacing. This returns `{ count }` instead so the caller can tell
	 * "I deleted it" from "someone beat me to it" and skip the destructive
	 * follow-up (removing the storage object) in the second case.
	 *
	 * A count of 1 means the caller owns the cleanup. Any incoming relation
	 * added later still surfaces here as a P2003 foreign-key error, before the
	 * storage object has been touched.
	 */
	deleteIfPresent: (id) => {
		return prisma.file.deleteMany({ where: { id } });
	},
	deleteMany: (ids) => {
		return prisma.file.deleteMany({ where: { id: { in: ids } } });
	},
	count: (where = {}) => {
		return prisma.file.count({ where });
	},
};
