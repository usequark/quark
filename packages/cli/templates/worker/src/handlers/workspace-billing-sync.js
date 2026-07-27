/**
 * Workspace Billing Sync Handler
 * Fetches workspace-level billing data from Railway API and stores it
 * in the WorkspaceBilling model for environment-level cost tracking.
 */

import { AppError } from "@techstream/quark-core/errors";
import { prisma } from "@techstream/quark-db";
import { fetchWorkspaceBilling } from "../lib/railway.js";

/**
 * Sync workspace billing data.
 * Stores/updates the workspace billing record with current usage, plan, etc.
 *
 * Job data: { workspaceId: string }
 */
export async function handleWorkspaceBillingSync(bullJob, logger) {
	if (!process.env.RAILWAY_API_TOKEN) {
		logger.info(
			"RAILWAY_API_TOKEN not configured — skipping workspace billing sync",
		);
		return { skipped: true, reason: "RAILWAY_API_TOKEN not configured" };
	}

	const { workspaceId } = bullJob.data;

	if (!workspaceId) {
		throw new AppError(
			"workspaceId is required for SYNC_WORKSPACE_BILLING",
			400,
			"WORKSPACE_ID_REQUIRED",
		);
	}

	logger.info("Syncing workspace billing", { workspaceId });

	const billing = await fetchWorkspaceBilling(workspaceId);

	if (!billing) {
		logger.warn("No billing data returned — skipping", { workspaceId });
		return { skipped: true };
	}

	logger.info("Workspace billing data fetched", {
		workspaceId,
		currentUsage: billing.currentUsage,
		plan: billing.plan,
		state: billing.state,
		billingPeriod: `${billing.billingPeriodStart} → ${billing.billingPeriodEnd}`,
	});

	// Upsert workspace billing record
	await prisma.workspaceBilling.upsert({
		where: { workspaceId },
		create: {
			workspaceId: billing.workspaceId,
			workspaceName: billing.workspaceName,
			plan: billing.plan,
			currentUsage: billing.currentUsage,
			creditBalance: billing.creditBalance,
			appliedCredits: billing.appliedCredits,
			billingPeriodStart: billing.billingPeriodStart
				? new Date(billing.billingPeriodStart)
				: null,
			billingPeriodEnd: billing.billingPeriodEnd
				? new Date(billing.billingPeriodEnd)
				: null,
			state: billing.state,
			isTrialing: billing.isTrialing,
			isUsageSubscriber: billing.isUsageSubscriber,
			syncedAt: new Date(),
		},
		update: {
			workspaceName: billing.workspaceName,
			plan: billing.plan,
			currentUsage: billing.currentUsage,
			creditBalance: billing.creditBalance,
			appliedCredits: billing.appliedCredits,
			billingPeriodStart: billing.billingPeriodStart
				? new Date(billing.billingPeriodStart)
				: null,
			billingPeriodEnd: billing.billingPeriodEnd
				? new Date(billing.billingPeriodEnd)
				: null,
			state: billing.state,
			isTrialing: billing.isTrialing,
			isUsageSubscriber: billing.isUsageSubscriber,
			syncedAt: new Date(),
		},
	});

	logger.info("Workspace billing stored", {
		workspaceId,
		amount: billing.currentUsage,
	});

	return {
		synced: true,
		billing,
	};
}
