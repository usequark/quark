import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { AppError } from "@techstream/quark-core/errors";
import {
	countRecords,
	createRecord,
	deleteRecord,
	findById,
	findMany,
	updateRecord,
} from "./query.js";

/**
 * Build a mock Prisma client with a single model delegate.
 * @param {string} delegateKey - lowerCamelCase key (e.g. "user", "auditLog")
 * @param {Partial<Record<string, ReturnType<typeof mock.fn>>>} [overrides]
 */
function createMockPrisma(delegateKey, overrides = {}) {
	const delegate = {
		findMany: mock.fn(async () => []),
		findUnique: mock.fn(async () => null),
		create: mock.fn(async ({ data }) => ({ id: "new-id", ...data })),
		update: mock.fn(async ({ data }) => ({ id: "upd-id", ...data })),
		delete: mock.fn(async () => ({ id: "del-id" })),
		count: mock.fn(async () => 0),
		...overrides,
	};
	return { prisma: { [delegateKey]: delegate }, delegate };
}

describe("query - getDelegate / unknown model", () => {
	it("throws AppError when model delegate is missing", async () => {
		const prisma = {};
		await assert.rejects(
			() => findMany(prisma, "NonExistent"),
			(err) => {
				assert.ok(err instanceof AppError);
				assert.equal(err.code, "UNKNOWN_MODEL");
				assert.equal(err.statusCode, 500);
				assert.match(err.message, /Unknown Prisma model: "NonExistent"/);
				return true;
			},
		);
	});

	it("throws AppError when delegate exists but is not a Prisma model", async () => {
		const prisma = { user: { notADelegate: true } };
		await assert.rejects(
			() => findMany(prisma, "User"),
			(err) => {
				assert.ok(err instanceof AppError);
				assert.equal(err.code, "UNKNOWN_MODEL");
				return true;
			},
		);
	});

	it("resolves multi-word model names to lowerCamelCase delegates", async () => {
		const { prisma, delegate } = createMockPrisma("auditLog", {
			findMany: mock.fn(async () => [{ id: "1" }]),
			count: mock.fn(async () => 1),
		});
		const result = await findMany(prisma, "AuditLog");
		assert.equal(delegate.findMany.mock.calls.length, 1);
		assert.equal(result.total, 1);
		assert.deepEqual(result.records, [{ id: "1" }]);
	});
});

describe("query - findMany", () => {
	it("calls findMany + count with default skip/take/orderBy", async () => {
		const records = [{ id: "a" }, { id: "b" }];
		const { prisma, delegate } = createMockPrisma("user", {
			findMany: mock.fn(async () => records),
			count: mock.fn(async () => 42),
		});

		const result = await findMany(prisma, "User");

		assert.deepEqual(result, {
			records,
			total: 42,
			skip: 0,
			take: 25,
		});
		assert.equal(delegate.findMany.mock.calls.length, 1);
		assert.deepEqual(delegate.findMany.mock.calls[0].arguments[0], {
			skip: 0,
			take: 25,
			orderBy: { createdAt: "desc" },
		});
		assert.equal(delegate.count.mock.calls.length, 1);
		assert.equal(delegate.count.mock.calls[0].arguments[0], undefined);
	});

	it("forwards custom skip, take, orderBy, and where", async () => {
		const where = { role: "admin" };
		const orderBy = { email: "asc" };
		const { prisma, delegate } = createMockPrisma("user", {
			findMany: mock.fn(async () => []),
			count: mock.fn(async () => 0),
		});

		await findMany(prisma, "User", {
			skip: 10,
			take: 5,
			orderBy,
			where,
		});

		assert.deepEqual(delegate.findMany.mock.calls[0].arguments[0], {
			skip: 10,
			take: 5,
			orderBy,
			where,
		});
		assert.deepEqual(delegate.count.mock.calls[0].arguments[0], { where });
	});

	it("omits where from findMany args when not provided", async () => {
		const { prisma, delegate } = createMockPrisma("user");
		await findMany(prisma, "User", { skip: 0, take: 10 });
		const args = delegate.findMany.mock.calls[0].arguments[0];
		assert.equal("where" in args, false);
	});
});

describe("query - findById", () => {
	it("calls findUnique with dynamic where on the @id field", async () => {
		const record = { id: "user-1", email: "a@b.com" };
		const { prisma, delegate } = createMockPrisma("user", {
			findUnique: mock.fn(async () => record),
		});

		const result = await findById(prisma, "User", "user-1");

		assert.equal(result, record);
		assert.deepEqual(delegate.findUnique.mock.calls[0].arguments[0], {
			where: { id: "user-1" },
		});
	});

	it("returns null when record does not exist", async () => {
		const { prisma } = createMockPrisma("user", {
			findUnique: mock.fn(async () => null),
		});
		const result = await findById(prisma, "User", "missing");
		assert.equal(result, null);
	});

	it("falls back to id where-key for composite-key models without @id", async () => {
		// VerificationToken has @@unique([identifier, token]) but no single @id
		const { prisma, delegate } = createMockPrisma("verificationToken", {
			findUnique: mock.fn(async () => null),
		});

		await findById(prisma, "VerificationToken", "tok-1");

		assert.deepEqual(delegate.findUnique.mock.calls[0].arguments[0], {
			where: { id: "tok-1" },
		});
	});

	it("falls back to id where-key when model is unknown to schema but has a delegate", async () => {
		const { prisma, delegate } = createMockPrisma("customThing", {
			findUnique: mock.fn(async () => ({ id: "x" })),
		});

		await findById(prisma, "CustomThing", "x");

		assert.deepEqual(delegate.findUnique.mock.calls[0].arguments[0], {
			where: { id: "x" },
		});
	});
});

describe("query - createRecord", () => {
	it("calls create with the provided data", async () => {
		const data = { email: "new@example.com", name: "New" };
		const created = { id: "c1", ...data };
		const { prisma, delegate } = createMockPrisma("user", {
			create: mock.fn(async () => created),
		});

		const result = await createRecord(prisma, "User", data);

		assert.equal(result, created);
		assert.deepEqual(delegate.create.mock.calls[0].arguments[0], { data });
	});
});

describe("query - updateRecord", () => {
	it("calls update with dynamic where on the @id field and data", async () => {
		const data = { name: "Updated" };
		const updated = { id: "u1", ...data };
		const { prisma, delegate } = createMockPrisma("user", {
			update: mock.fn(async () => updated),
		});

		const result = await updateRecord(prisma, "User", "u1", data);

		assert.equal(result, updated);
		assert.deepEqual(delegate.update.mock.calls[0].arguments[0], {
			where: { id: "u1" },
			data,
		});
	});

	it("uses id where-key fallback for composite-key models", async () => {
		const { prisma, delegate } = createMockPrisma("verificationToken", {
			update: mock.fn(async () => ({ id: "t1" })),
		});

		await updateRecord(prisma, "VerificationToken", "t1", { token: "x" });

		assert.deepEqual(delegate.update.mock.calls[0].arguments[0], {
			where: { id: "t1" },
			data: { token: "x" },
		});
	});
});

describe("query - deleteRecord", () => {
	it("calls delete with dynamic where on the @id field", async () => {
		const deleted = { id: "d1" };
		const { prisma, delegate } = createMockPrisma("user", {
			delete: mock.fn(async () => deleted),
		});

		const result = await deleteRecord(prisma, "User", "d1");

		assert.equal(result, deleted);
		assert.deepEqual(delegate.delete.mock.calls[0].arguments[0], {
			where: { id: "d1" },
		});
	});

	it("uses id where-key fallback for composite-key models", async () => {
		const { prisma, delegate } = createMockPrisma("verificationToken", {
			delete: mock.fn(async () => ({ id: "t1" })),
		});

		await deleteRecord(prisma, "VerificationToken", "t1");

		assert.deepEqual(delegate.delete.mock.calls[0].arguments[0], {
			where: { id: "t1" },
		});
	});
});

describe("query - countRecords", () => {
	it("calls count with no arguments and returns the total", async () => {
		const { prisma, delegate } = createMockPrisma("user", {
			count: mock.fn(async () => 99),
		});

		const result = await countRecords(prisma, "User");

		assert.equal(result, 99);
		assert.equal(delegate.count.mock.calls.length, 1);
		assert.equal(delegate.count.mock.calls[0].arguments.length, 0);
	});

	it("throws AppError for unknown model", async () => {
		await assert.rejects(
			() => countRecords({}, "Ghost"),
			(err) => {
				assert.ok(err instanceof AppError);
				assert.equal(err.code, "UNKNOWN_MODEL");
				return true;
			},
		);
	});
});

describe("query - dynamic where clause construction", () => {
	it("findById / updateRecord / deleteRecord all build where via computed id field name", async () => {
		const { prisma, delegate } = createMockPrisma("job", {
			findUnique: mock.fn(async () => ({ id: "j1" })),
			update: mock.fn(async () => ({ id: "j1" })),
			delete: mock.fn(async () => ({ id: "j1" })),
		});

		await findById(prisma, "Job", "j1");
		await updateRecord(prisma, "Job", "j1", { status: "DONE" });
		await deleteRecord(prisma, "Job", "j1");

		const findWhere = delegate.findUnique.mock.calls[0].arguments[0].where;
		const updateWhere = delegate.update.mock.calls[0].arguments[0].where;
		const deleteWhere = delegate.delete.mock.calls[0].arguments[0].where;

		// Dynamic key (not a hardcoded string literal path) — resolved id field is "id"
		assert.deepEqual(findWhere, { id: "j1" });
		assert.deepEqual(updateWhere, { id: "j1" });
		assert.deepEqual(deleteWhere, { id: "j1" });

		// Ensure the where object is built with a single computed key
		assert.deepEqual(Object.keys(findWhere), ["id"]);
		assert.deepEqual(Object.keys(updateWhere), ["id"]);
		assert.deepEqual(Object.keys(deleteWhere), ["id"]);
	});
});
