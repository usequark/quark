import HealthIndicator from "./_components/HealthIndicator.js";
import HomeThemeToggle from "./_components/HomeThemeToggle.js";
import QuarkAnimation from "./_components/QuarkAnimation.js";
import SyncedPanels from "./_components/SyncedPanels.js";

const PANELS = [
	{
		title: "Need a landing page?",
		description:
			"Build a high-converting landing page with a hero section, social proof, and lead capture",
		prompt: `You are a senior full-stack engineer building a production-ready landing page for a local business using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod validation, Biome linting). The app runs on Railway with PostgreSQL and Redis. ESM only, no TypeScript, no console.log in app code — use createLogger from @techstream/quark-core. No throw new Error — use AppError/ValidationError. All Server Actions must validate with Zod. Every Prisma model needs createdAt and updatedAt. Import UI from @techstream/quark-ui, never deep-import.

Goal: Build an SEO-optimised landing page for a local business (e.g., plumber, restaurant, salon).

Ask the user: What is the business name and type? What services do they offer? Do they have testimonials or reviews? What is the primary call-to-action (book, call, quote request)? Do they have a logo or brand colours?

Build: Hero section with business name and tagline, services list, testimonials carousel, contact form with server-side Zod validation, SEO metadata (title, description, OG tags), responsive layout. Add a ContactInquiry Prisma model for form submissions with status tracking.

Patterns to follow: Use AppError/ValidationError for error handling, prisma from @__QUARK_SCOPE__/db, validateBody with Zod, withCsrfProtection on POST routes.`,
	},
	{
		title: "Want a dashboard?",
		description:
			"Create an interactive analytics portal with live charts, auth, and customizable metrics",
		prompt: `You are a senior full-stack engineer building a management dashboard using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for background jobs. ESM only, no TypeScript. Use createLogger from @techstream/quark-core for logging, AppError/ValidationError for errors. All Server Actions validate with Zod. Import UI from @techstream/quark-ui.

Goal: Build an SEO performance dashboard where users can track site metrics, keyword rankings, and crawl health.

Ask the user: What metrics matter most (traffic, rankings, backlinks, crawl errors)? How many sites should the user manage? Do they need weekly email reports? What auth provider (GitHub, Google, email/password)?

Build: Auth via NextAuth with role-based access, dashboard page with metric cards (total sites, avg rank, crawl errors), site detail page with analytics charts, keyword ranking table with sorting, crawl error list with status badges, weekly report generation via BullMQ job. Add Site, KeywordRank, CrawlError, and Report Prisma models.

Patterns to follow: Use requireAuth() for protected routes, prisma queries with safe selects, Server Actions for mutations, BullMQ job queue for report generation.`,
	},
	{
		title: "Building a SaaS?",
		description:
			"Ship a multi-tenant SaaS foundation with subscription billing, team seats, and background jobs",
		prompt: `You are a senior full-stack engineer building a multi-tenant SaaS application using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod required on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a SaaS platform with user auth, team workspaces, Stripe subscription billing, and background job processing.

Ask the user: What is the SaaS about (what problem does it solve)? What pricing tiers do they want? How many team seats per tier? Do they need a free trial? What background jobs are needed (reports, notifications, data sync)?

Build: NextAuth with GitHub + email providers, Workspace and WorkspaceMember Prisma models with roles (admin/editor/viewer), Stripe checkout + webhook handling for subscriptions, team invite flow, dashboard with workspace-scoped data, BullMQ worker for background jobs. Add Subscription and Invoice models.

Patterns to follow: Use Workspace-scoped queries (filter by workspaceId), requireRole('admin') for admin actions, safe selects for user data, Stripe webhook signature verification, job queue with retries.`,
	},
	{
		title: "Running a store?",
		description:
			"Launch an e-commerce store with a searchable catalog, shopping cart, and Stripe checkout",
		prompt: `You are a senior full-stack engineer building an e-commerce storefront using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a product catalog with shopping cart, Stripe checkout, and order management.

Ask the user: What kind of products (physical, digital, subscriptions)? Do they need inventory tracking? What payment methods beyond Stripe (PayPal)? Do they need shipping calculation? How should order confirmation work (email via BullMQ job)?

Build: Product and Category Prisma models with images, shopping cart, Stripe checkout session creation, webhook handler for payment confirmation, Order and OrderItem models with status workflow (PENDING → CONFIRMED → SHIPPED → DELIVERED), order history page, admin product management. Add a BullMQ job for order confirmation emails.

Patterns to follow: Use Decimal for prices, cascade deletes for owned relationships, withCsrfProtection on POST routes, validateBody with Zod schemas for product/order creation.`,
	},
	{
		title: "Publishing content?",
		description:
			"Start a modern blog engine with MDX posts, category tags, instant search, and RSS",
		prompt: `You are a senior full-stack engineer building a content platform using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a blog with MDX support, tag filtering, syntax highlighting, and an RSS feed.

Ask the user: Who is the author? What categories/tags should exist? Do they need a drafts workflow (draft → published)? Should posts support code snippets (what languages)? Do they need an admin editor or is a CMS-style admin sufficient?

Build: Post and Tag Prisma models with many-to-many relation, MDX rendering with syntax highlighting, tag-based filtering pages, RSS feed route handler (/api/rss), sitemap generation, admin post editor with draft preview, SEO metadata per post.

Patterns to follow: Use Post model with published Boolean, include author relation with safe select, paginate with skip/take, tag queries via relation filters.`,
	},
	{
		title: "Need a booking system?",
		description:
			"Set up automated scheduling with calendar sync, client availability, and event reminders",
		prompt: `You are a senior full-stack engineer building a booking system using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for notifications. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build an appointment booking system with service listings, calendar availability, and email notifications.

Ask the user: What services are offered (haircut, consultation, repair)? What are the business hours? How far in advance can users book? Do they need staff/provider assignment? Should reminders be sent (24h before via BullMQ)?

Build: Service, Booking, Availability, and Staff Prisma models, calendar view showing available time slots, booking creation with conflict detection, email confirmation via BullMQ job, reminder notifications, admin calendar view with booking management, cancellation/rescheduling flow.

Patterns to follow: Use DateTime fields for scheduling, unique constraints to prevent double-booking, Server Actions for booking mutations, BullMQ for async email delivery.`,
	},
	{
		title: "Building a portfolio?",
		description:
			"Showcase your work with a developer portfolio, project highlights, and a contact form",
		prompt: `You are a senior full-stack engineer building a developer portfolio using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a personal developer portfolio with project showcase, case study pages, and a contact form.

Ask the user: What is the developer's name and tagline? What projects should be featured (give 3-5 examples with descriptions, tech stacks, and links)? Do they need a blog section? What social links (GitHub, LinkedIn, Twitter)? Should the theme toggle between dark and light?

Build: Project and Skill Prisma models, home page with hero + featured projects grid, individual project pages with description, tech stack badges, and live/repo links, about page with skills and experience, contact form with Zod validation, dark/light theme toggle (use ThemeProvider from @techstream/quark-ui), responsive design.

Patterns to follow: Use Card components from @techstream/quark-ui, Badge for tech stack, contact form with ContactInquiry model, SEO metadata per page.`,
	},
	{
		title: "Need an admin panel?",
		description:
			"Manage your app with an internal admin portal featuring CRUD workflows, roles, and audit logs",
		prompt: `You are a senior full-stack engineer building an admin panel using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build an internal admin dashboard with role-based access, data tables, and audit logging.

Ask the user: What models need admin CRUD (products, orders, users, content)? What roles exist (super-admin, admin, editor)? What actions should be audit-logged? Do they need bulk actions (delete, export)? Should the admin have a dashboard with metric cards?

Build: Role-based auth with requireRole() middleware, auto-generated CRUD pages for each model, data tables with sorting/filtering/pagination, bulk actions with confirmation dialogs, AuditLog Prisma model tracking all mutations, admin dashboard with metric cards, custom sidebar with model links.

Patterns to follow: Use adminConfig.modelOverrides for model customization, replace individual model pages for custom UI, add AuditLog model with createdAt index, use requireRole('admin') on all admin Server Actions.`,
	},
	{
		title: "Building a real-time app?",
		description:
			"Go live with real-time collaboration using WebSockets, presence indicators, and state sync",
		prompt: `You are a senior full-stack engineer building a real-time collaborative app using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis (for pub/sub and presence), BullMQ for background processing. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a real-time collaborative application with live updates, user presence, and persistent state.

Ask the user: What are users collaborating on (documents, whiteboards, tasks, spreadsheets)? How many concurrent users per room? Do they need cursor/presence indicators? Should changes persist to the database? Do they need conflict resolution?

Build: Room and Document Prisma models, WebSocket server (use ws or Socket.io with Redis pub/sub for multi-instance), user presence tracking via Redis, live cursor/selection indicators, operational transform or CRDT for conflict resolution, persistent state saved to PostgreSQL via BullMQ debounced writes, room creation/joining flow, user avatars with presence status.

Patterns to follow: Use Redis for real-time pub/sub, BullMQ for debounced persistence, Prisma for durable state, WebSocket auth verification against NextAuth session, presence TTL with Redis EXPIRE.`,
	},
	{
		title: "Integrating AI features?",
		description:
			"Add AI capabilities with streaming responses, prompt templates, vector search, and token tracking",
		prompt: `You are a senior full-stack engineer building AI-powered features using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for background processing. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Add AI capabilities to an existing Quark application — streaming chat, prompt management, vector search, and usage tracking.

Ask the user: Which LLM provider (OpenAI, Anthropic, local model)? What is the primary use case (chat, content generation, search)? Do they need prompt templates management? Should conversations be persisted? Do they need token usage tracking and budget alerts?

Build: Conversation and Message Prisma models for chat history, streaming response handler using Server-Sent Events, PromptTemplate model for reusable prompts with versioning, vector embedding storage with pgvector for semantic search, token usage tracking model with daily aggregation via BullMQ, rate limiting per user. Add a settings page for API key management.

Patterns to follow: Use Server-Sent Events for streaming, Prisma for conversation persistence, pgvector extension for vector search, BullMQ for async embedding generation and usage aggregation, safe selects to never expose API keys.`,
	},
	{
		title: "Building a community?",
		description:
			"Launch a discussion forum with user profiles, nested comments, upvoting, and moderation",
		prompt: `You are a senior full-stack engineer building a community platform using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for background jobs. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a discussion forum with user-generated content, threading, voting, and moderation tools.

Ask the user: What is the community about? Do they need categories or tags for topics? Should posts support rich text or Markdown? Do they need user reputation/karma? What moderation tools are needed (flag, ban, review queue)?

Build: Post, Comment (with parentComment for nesting), Vote, and Category Prisma models, user profiles with avatar and bio, topic listing with sorting (new, top, hot), nested comment threads, upvote/downvote system with optimistic UI, moderation queue with flag/review actions, admin moderation dashboard. Add BullMQ jobs for email notifications on replies.

Patterns to follow: Use nested set or parent relation for comment threading, optimistic locking for votes, requireAuth() for mutations, AuditLog for moderation actions, safe user selects excluding sensitive fields.`,
	},
	{
		title: "Creating an API?",
		description:
			"Build a scalable REST or GraphQL API with rate limiting, OpenAPI docs, and secure auth",
		prompt: `You are a senior full-stack engineer building an API layer using Quark (Next.js 16, App Router, Route Handlers, Prisma, Zod, Biome). Stack: PostgreSQL, Redis for rate limiting and caching. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all API routes. Import UI from @techstream/quark-ui where needed.

Goal: Build a well-documented, secure API with authentication, rate limiting, and OpenAPI specification.

Ask the user: REST or GraphQL? Which resources/endpoints are needed? What auth method (API keys, OAuth2, JWT)? What are the rate limits per tier? Do they need webhook support for third-party integrations?

Build: API key management model with scopes and expiry, rate limiting middleware using Redis (sliding window), OpenAPI/Swagger documentation route, Zod-validated request/response schemas for every endpoint, CORS configuration, request logging with correlation IDs, webhook delivery model with retry logic via BullMQ. Add an API playground page for testing.

Patterns to follow: Use Next.js Route Handlers for REST endpoints, Redis INCR with TTL for rate limits, Zod schemas as single source of truth for validation and docs, withCsrfProtection on state-changing routes, BullMQ for async webhook delivery with exponential backoff.`,
	},
	{
		title: "Need a marketplace?",
		description:
			"Connect buyers and sellers with vendor onboarding, split payments, and search filters",
		prompt: `You are a senior full-stack engineer building a marketplace platform using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for background jobs. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a two-sided marketplace connecting buyers and sellers with vendor management and payment splitting.

Ask the user: What is being sold (physical goods, digital products, services)? What is the commission structure? Do vendors need onboarding verification? What search and filter capabilities are needed? How should dispute resolution work?

Build: Vendor, Listing, Order, and Payout Prisma models, vendor onboarding flow with profile verification, product listing with images and search (full-text with PostgreSQL tsvector), shopping cart and checkout with Stripe Connect for split payments, order management with buyer/seller views, review and rating system, vendor payout scheduling via BullMQ, admin moderation dashboard.

Patterns to follow: Use Stripe Connect for marketplace payments, full-text search with PostgreSQL tsvector, Prisma transactions for order creation with inventory deduction, BullMQ for async payout processing, role-based access with vendor/admin/buyer roles.`,
	},
	{
		title: "Building a mobile app?",
		description:
			"Kickstart a cross-platform mobile app with native navigation, offline storage, and push alerts",
		prompt: `You are a senior full-stack engineer building a mobile app backend and web companion using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL, Redis, BullMQ for background jobs. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build the backend API and data layer for a cross-platform mobile app, with a responsive web companion.

Ask the user: What platform (React Native, Flutter, or web PWA)? What are the core features? Do they need offline sync? What push notification service (Firebase, Expo)? Do they need file/image upload with storage?

Build: Device and PushToken Prisma models for push notification management, REST API layer for mobile consumption with JWT auth, file upload endpoint with S3-compatible storage (Railway bucket), offline sync strategy with last-write-wins or conflict detection, push notification delivery via BullMQ job, responsive web companion using the same Prisma models and Server Actions. Add device registration endpoint for push token management.

Patterns to follow: Use JWT for mobile auth (separate from NextAuth web session), S3-compatible object storage for file uploads, BullMQ for async push notification delivery, Prisma for all data persistence, API route handlers alongside Server Actions for mobile consumption.`,
	},
	{
		title: "Setting up docs?",
		description:
			"Publish developer documentation with full-text search, code blocks, and version switching",
		prompt: `You are a senior full-stack engineer building a documentation site using Quark (Next.js 16, App Router, Server Actions, Prisma, Tailwind via @techstream/quark-ui, Zod, Biome). Stack: PostgreSQL for search indexing. ESM only, no TypeScript. Use AppError/ValidationError from @techstream/quark-core/errors, createLogger for logging. Zod on all Server Actions. Import UI from @techstream/quark-ui.

Goal: Build a developer documentation site with search, code examples, and version management.

Ask the user: What is being documented (API, framework, product)? How many versions need to be supported? Do they need a changelog? Should code blocks support multiple languages? Do they need interactive examples (runnable code)?

Build: DocPage and DocVersion Prisma models with parent/child nesting, MDX rendering with syntax highlighting and callout blocks, full-text search using PostgreSQL tsvector with ranking, version switching (v1, v2, latest), sidebar navigation auto-generated from document hierarchy, changelog page with entries linked to versions, copy-to-clipboard on code blocks, dark/light theme toggle.

Patterns to follow: Use PostgreSQL tsvector for full-text search with GIN index, MDX for content authoring, Prisma for document hierarchy and versioning, static generation where possible for performance, SEO metadata per documentation page.`,
	},
];

export default function Home() {
	return (
		<main className="quark-home-main min-h-screen flex flex-col items-center justify-center">
			<QuarkAnimation />

			<div className="quark-home-footer flex flex-col items-center gap-6 pt-8 pb-8">
				<SyncedPanels panels={PANELS} />

				<nav className="flex items-center gap-2">
					<a
						href="https://github.com/Bobnoddle/quark"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						github
					</a>
					<span className="quark-home-sep">·</span>
					<a
						href="https://www.npmjs.com/package/@techstream/quark-create-app"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						npm
					</a>
					<span className="quark-home-sep">·</span>
					<a
						href="https://quark.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="quark-home-link"
					>
						quark
					</a>
					<span className="quark-home-sep">·</span>
					<HomeThemeToggle />
				</nav>

				<HealthIndicator />
			</div>
		</main>
	);
}
