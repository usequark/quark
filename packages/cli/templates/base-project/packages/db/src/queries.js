import { prisma } from "./client.js";

// User queries
export const user = {
	findById: (id) => {
		return prisma.user.findUnique({
			where: { id },
			include: { posts: true },
		});
	},
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
			include: { posts: true },
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.user.create({
			data,
		});
	},
	update: (id, data) => {
		return prisma.user.update({
			where: { id },
			data,
		});
	},
	delete: (id) => {
		return prisma.user.delete({
			where: { id },
		});
	},
};

// Post queries
export const post = {
	findById: (id) => {
		return prisma.post.findUnique({
			where: { id },
			include: { author: true },
		});
	},
	findAll: (options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.post.findMany({
			skip,
			take,
			include: { author: true },
			orderBy: { createdAt: "desc" },
		});
	},
	findPublished: (options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.post.findMany({
			where: { published: true },
			skip,
			take,
			include: { author: true },
			orderBy: { createdAt: "desc" },
		});
	},
	findByAuthor: (authorId, options = {}) => {
		const { skip = 0, take = 10 } = options;
		return prisma.post.findMany({
			where: { authorId },
			skip,
			take,
			include: { author: true },
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.post.create({
			data,
			include: { author: true },
		});
	},
	update: (id, data) => {
		return prisma.post.update({
			where: { id },
			data,
			include: { author: true },
		});
	},
	delete: (id) => {
		return prisma.post.delete({
			where: { id },
		});
	},
};

// Job queries
export const job = {
	findById: (id) => {
		return prisma.job.findUnique({
			where: { id },
		});
	},
	findAll: (options = {}) => {
		const { skip = 0, take = 20 } = options;
		return prisma.job.findMany({
			skip,
			take,
			orderBy: { createdAt: "desc" },
		});
	},
	findPending: () => {
		return prisma.job.findMany({
			where: {
				status: "PENDING",
				runAt: { lte: new Date() },
			},
			orderBy: { runAt: "asc" },
		});
	},
	findByQueue: (queue, options = {}) => {
		const { skip = 0, take = 20 } = options;
		return prisma.job.findMany({
			where: { queue },
			skip,
			take,
			orderBy: { createdAt: "desc" },
		});
	},
	create: (data) => {
		return prisma.job.create({
			data: {
				queue: data.queue,
				name: data.name,
				data: data.data || {},
				status: "PENDING",
				...data,
			},
		});
	},
	update: (id, data) => {
		return prisma.job.update({
			where: { id },
			data,
		});
	},
	delete: (id) => {
		return prisma.job.delete({
			where: { id },
		});
	},
	markInProgress: (id) => {
		return prisma.job.update({
			where: { id },
			data: {
				status: "IN_PROGRESS",
				startedAt: new Date(),
				attempts: { increment: 1 },
			},
		});
	},
	markCompleted: (id) => {
		return prisma.job.update({
			where: { id },
			data: {
				status: "COMPLETED",
				completedAt: new Date(),
			},
		});
	},
	markFailed: (id, error) => {
		return prisma.job.update({
			where: { id },
			data: {
				status: "FAILED",
				error,
			},
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
			include: { user: true },
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
			include: { user: true },
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
