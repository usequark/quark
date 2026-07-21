#!/usr/bin/env node

/**
 * Quark Database MCP Server
 *
 * Exposes database tools via the Model Context Protocol.
 * Connectes to PostgreSQL via DATABASE_URL environment variable.
 *
 * Tools:
 *  - getUsers           - List users with optional role filter
 *  - getCompanies       - List CRM companies
 *  - getContacts        - List CRM contacts, optionally filtered by company
 *  - getDeals           - List CRM deals, optionally filtered by stage
 *  - getPages           - List CMS pages with optional status filter
 *  - getMediaAssets     - List media assets, optionally filtered by mime type
 *  - getAuditLogs       - List audit log entries, optionally filtered by action
 *  - getFiles           - List uploaded files
 *  - getJobs            - List background jobs with optional status filter
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import postgres from "postgres";
import { z } from "zod";

// ── Database Connection ─────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("FATAL: DATABASE_URL environment variable is required.");
	process.exit(1);
}

const sql = postgres(DATABASE_URL, {
	max: 4,
	idle_timeout: 20,
	connect_timeout: 10,
});

// ── Schemas ─────────────────────────────────────────────────────────

const PaginationSchema = z.object({
	limit: z.number().int().min(1).max(100).optional().default(50),
	offset: z.number().int().min(0).optional().default(0),
});

const UsersFilterSchema = PaginationSchema.extend({
	role: z.enum(["admin", "client_admin", "editor", "viewer"]).optional(),
});

const CompaniesFilterSchema = PaginationSchema.extend({
	search: z.string().max(200).optional(),
});

const ContactsFilterSchema = PaginationSchema.extend({
	companyId: z.string().optional(),
	search: z.string().max(200).optional(),
});

const DealsFilterSchema = PaginationSchema.extend({
	stage: z.string().optional(),
	companyId: z.string().optional(),
	contactId: z.string().optional(),
});

const PagesFilterSchema = PaginationSchema.extend({
	status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

const MediaAssetsFilterSchema = PaginationSchema.extend({
	mimeType: z.string().optional(),
	uploadedById: z.string().optional(),
});

const AuditLogsFilterSchema = PaginationSchema.extend({
	action: z.string().optional(),
	entity: z.string().optional(),
	userId: z.string().optional(),
});

const JobsFilterSchema = PaginationSchema.extend({
	status: z
		.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"])
		.optional(),
	queue: z.string().optional(),
});

// ── Server Setup ────────────────────────────────────────────────────

const server = new Server(
	{ name: "quark-db-mcp", version: "1.0.0" },
	{
		capabilities: {
			tools: {},
		},
	},
);

// ── Tool Definitions ────────────────────────────────────────────────

server.setRequestHandler("tools/list", async () => {
	return {
		tools: [
			{
				name: "getUsers",
				description: "List users in the system, optionally filtered by role",
				inputSchema: {
					type: "object",
					properties: {
						role: {
							type: "string",
							enum: ["admin", "client_admin", "editor", "viewer"],
							description: "Filter by user role",
						},
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getCompanies",
				description:
					"List CRM companies (businesses/organizations), optionally search by name",
				inputSchema: {
					type: "object",
					properties: {
						search: { type: "string", description: "Search by company name" },
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getContacts",
				description: "List CRM contacts, optionally filtered by company",
				inputSchema: {
					type: "object",
					properties: {
						companyId: { type: "string", description: "Filter by company ID" },
						search: { type: "string", description: "Search by name or email" },
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getDeals",
				description:
					"List CRM deals, optionally filtered by stage, company, or contact",
				inputSchema: {
					type: "object",
					properties: {
						stage: {
							type: "string",
							description:
								"Filter by pipeline stage (e.g. LEAD, QUALIFIED, PROPOSAL, CLOSED_WON, CLOSED_LOST)",
						},
						companyId: { type: "string", description: "Filter by company ID" },
						contactId: { type: "string", description: "Filter by contact ID" },
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getPages",
				description: "List CMS pages, optionally filtered by status",
				inputSchema: {
					type: "object",
					properties: {
						status: {
							type: "string",
							enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
							description: "Filter by content status",
						},
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getMediaAssets",
				description:
					"List media assets (uploaded images/files), optionally filtered by mime type",
				inputSchema: {
					type: "object",
					properties: {
						mimeType: {
							type: "string",
							description:
								"Filter by MIME type (e.g. image/png, application/pdf)",
						},
						uploadedById: {
							type: "string",
							description: "Filter by uploader user ID",
						},
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getAuditLogs",
				description:
					"List audit log entries, optionally filtered by action, entity, or user",
				inputSchema: {
					type: "object",
					properties: {
						action: {
							type: "string",
							description: "Filter by action (e.g. CREATE, UPDATE, DELETE)",
						},
						entity: {
							type: "string",
							description: "Filter by entity type (e.g. User, Page, Deal)",
						},
						userId: {
							type: "string",
							description: "Filter by user ID who performed the action",
						},
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getFiles",
				description: "List uploaded files with metadata",
				inputSchema: {
					type: "object",
					properties: {
						mimeType: { type: "string", description: "Filter by MIME type" },
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
			{
				name: "getJobs",
				description:
					"List background jobs, optionally filtered by status or queue",
				inputSchema: {
					type: "object",
					properties: {
						status: {
							type: "string",
							enum: [
								"PENDING",
								"IN_PROGRESS",
								"COMPLETED",
								"FAILED",
								"CANCELLED",
							],
							description: "Filter by job status",
						},
						queue: { type: "string", description: "Filter by queue name" },
						limit: {
							type: "number",
							description: "Max results (1-100)",
							default: 50,
						},
						offset: {
							type: "number",
							description: "Pagination offset",
							default: 0,
						},
					},
				},
			},
		],
	};
});

// ── Tool Handlers ───────────────────────────────────────────────────

server.setRequestHandler("tools/call", async (request) => {
	const { name, arguments: args } = request.params;

	try {
		switch (name) {
			case "getUsers": {
				const { role, limit, offset } = UsersFilterSchema.parse(args || {});
				let query = sql`SELECT id, email, name, role, image, "createdAt", "updatedAt" FROM "User"`;
				if (role) {
					query = sql`${query} WHERE role = ${role}`;
				}
				query = sql`${query} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getCompanies": {
				const { search, limit, offset } = CompaniesFilterSchema.parse(
					args || {},
				);
				if (search) {
					const rows = await sql`
            SELECT id, name, website, industry, size, notes, "createdAt", "updatedAt"
            FROM "Company"
            WHERE name ILIKE ${`%${search}%`}
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
					return {
						content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
					};
				}
				const rows = await sql`
          SELECT id, name, website, industry, size, notes, "createdAt", "updatedAt"
          FROM "Company"
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getContacts": {
				const { companyId, search, limit, offset } = ContactsFilterSchema.parse(
					args || {},
				);
				let query = sql`
          SELECT c.id, c."firstName", c."lastName", c.email, c.phone, c.position, c.notes,
                 c."companyId", co.name AS "companyName",
                 c."createdAt", c."updatedAt"
          FROM "Contact" c
          LEFT JOIN "Company" co ON co.id = c."companyId"
        `;
				const conditions = [];
				if (companyId) conditions.push(sql`c."companyId" = ${companyId}`);
				if (search) {
					conditions.push(
						sql`(c."firstName" ILIKE ${`%${search}%`} OR c."lastName" ILIKE ${`%${search}%`} OR c.email ILIKE ${`%${search}%`})`,
					);
				}
				if (conditions.length > 0) {
					query = sql`${query} WHERE ${sql.join(conditions, " AND ")}`;
				}
				query = sql`${query} ORDER BY c."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getDeals": {
				const { stage, companyId, contactId, limit, offset } =
					DealsFilterSchema.parse(args || {});
				let query = sql`
          SELECT d.id, d.title, d.value, d.stage, d.probability, d."expectedCloseDate",
                 d.notes, d."contactId", d."companyId",
                 co.name AS "companyName",
                 c."firstName" AS "contactFirstName", c."lastName" AS "contactLastName",
                 d."createdAt", d."updatedAt"
          FROM "Deal" d
          LEFT JOIN "Company" co ON co.id = d."companyId"
          LEFT JOIN "Contact" c ON c.id = d."contactId"
        `;
				const conditions = [];
				if (stage) conditions.push(sql`d.stage = ${stage}`);
				if (companyId) conditions.push(sql`d."companyId" = ${companyId}`);
				if (contactId) conditions.push(sql`d."contactId" = ${contactId}`);
				if (conditions.length > 0) {
					query = sql`${query} WHERE ${sql.join(conditions, " AND ")}`;
				}
				query = sql`${query} ORDER BY d."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getPages": {
				const { status, limit, offset } = PagesFilterSchema.parse(args || {});
				let query = sql`
          SELECT p.id, p.title, p.slug, p.excerpt, p.layout, p.status,
                 p."publishedAt", p."authorId", u.name AS "authorName",
                 p."createdAt", p."updatedAt"
          FROM "Page" p
          LEFT JOIN "User" u ON u.id = p."authorId"
        `;
				if (status) {
					query = sql`${query} WHERE p.status = ${status}`;
				}
				query = sql`${query} ORDER BY p."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getMediaAssets": {
				const { mimeType, uploadedById, limit, offset } =
					MediaAssetsFilterSchema.parse(args || {});
				let query = sql`
          SELECT ma.id, ma.filename, ma."storageKey", ma."mimeType", ma.size,
                 ma.width, ma.height, ma.alt,
                 ma."uploadedById", u.name AS "uploaderName",
                 ma."createdAt", ma."updatedAt"
          FROM "MediaAsset" ma
          LEFT JOIN "User" u ON u.id = ma."uploadedById"
        `;
				const conditions = [];
				if (mimeType)
					conditions.push(sql`ma."mimeType" ILIKE ${`${mimeType}%`}`);
				if (uploadedById)
					conditions.push(sql`ma."uploadedById" = ${uploadedById}`);
				if (conditions.length > 0) {
					query = sql`${query} WHERE ${sql.join(conditions, " AND ")}`;
				}
				query = sql`${query} ORDER BY ma."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getAuditLogs": {
				const { action, entity, userId, limit, offset } =
					AuditLogsFilterSchema.parse(args || {});
				let query = sql`
          SELECT al.id, al."userId", u.name AS "userName", al.action, al.entity,
                 al."entityId", al.changes, al.metadata, al."createdAt"
          FROM "AuditLog" al
          LEFT JOIN "User" u ON u.id = al."userId"
        `;
				const conditions = [];
				if (action) conditions.push(sql`al.action = ${action}`);
				if (entity) conditions.push(sql`al.entity = ${entity}`);
				if (userId) conditions.push(sql`al."userId" = ${userId}`);
				if (conditions.length > 0) {
					query = sql`${query} WHERE ${sql.join(conditions, " AND ")}`;
				}
				query = sql`${query} ORDER BY al."createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getFiles": {
				const { mimeType, limit, offset } = PaginationSchema.extend({
					mimeType: z.string().optional(),
				}).parse(args || {});
				if (mimeType) {
					const rows = await sql`
            SELECT id, filename, "originalName", "mimeType", size, "storageKey",
                   "storageProvider", "uploadedById", "createdAt", "updatedAt"
            FROM "File"
            WHERE "mimeType" ILIKE ${`${mimeType}%`}
            ORDER BY "createdAt" DESC
            LIMIT ${limit} OFFSET ${offset}
          `;
					return {
						content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
					};
				}
				const rows = await sql`
          SELECT id, filename, "originalName", "mimeType", size, "storageKey",
                 "storageProvider", "uploadedById", "createdAt", "updatedAt"
          FROM "File"
          ORDER BY "createdAt" DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			case "getJobs": {
				const { status, queue, limit, offset } = JobsFilterSchema.parse(
					args || {},
				);
				let query = sql`
          SELECT id, queue, name, status, error, attempts, "maxRetries",
                 "runAt", "startedAt", "completedAt", "createdAt", "updatedAt"
          FROM "Job"
        `;
				const conditions = [];
				if (status) conditions.push(sql`status = ${status}`);
				if (queue) conditions.push(sql`queue = ${queue}`);
				if (conditions.length > 0) {
					query = sql`${query} WHERE ${sql.join(conditions, " AND ")}`;
				}
				query = sql`${query} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
				const rows = await query;
				return {
					content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
				};
			}

			default:
				throw new Error(`Unknown tool: ${name}`);
		}
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				content: [{ type: "text", text: `Validation error: ${error.message}` }],
				isError: true,
			};
		}
		throw error;
	}
});

// ── Start Server ────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Quark DB MCP server running on stdio");
