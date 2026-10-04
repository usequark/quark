/**
 * @usequark/quark-core - Stripe Integration
 *
 * Thin wrappers around the Stripe SDK for client creation and webhook
 * verification. Stripe is an optional peer dependency — install it in the
 * app that uses payment features.
 *
 * Usage:
 *   import { createStripeClient, getStripeWebhookEvent } from "@usequark/quark-core/stripe";
 *
 *   const stripe = await createStripeClient();
 *   const session = await stripe.checkout.sessions.create({ ... });
 *
 *   const event = await getStripeWebhookEvent(body, signature);
 */

function isMissingPackageError(error, packageName) {
	const message = error?.message ?? "";
	return (
		error?.code === "ERR_MODULE_NOT_FOUND" ||
		error?.code === "MODULE_NOT_FOUND" ||
		message.includes(`Cannot find package '${packageName}'`) ||
		message.includes(`Cannot find module '${packageName}'`)
	);
}

async function importStripePackage() {
	try {
		return await import("stripe");
	} catch (error) {
		if (isMissingPackageError(error, "stripe")) {
			throw new Error(
				'Stripe support requires installing "stripe" in the app that uses @usequark/quark-core/stripe.',
			);
		}
		throw error;
	}
}

/**
 * Creates a Stripe client instance.
 * Reads STRIPE_SECRET_KEY from environment variables.
 *
 * @param {object} [options] - Additional Stripe SDK options
 * @returns {import("stripe").Stripe} Stripe client instance
 * @throws {Error} If STRIPE_SECRET_KEY is not set or stripe package is not installed
 */
export async function createStripeClient(options = {}) {
	const { default: Stripe } = await importStripePackage();

	const secretKey = options.secretKey || process.env.STRIPE_SECRET_KEY;
	if (!secretKey) {
		throw new Error(
			"STRIPE_SECRET_KEY is required. Set it in your environment or pass { secretKey } to createStripeClient().",
		);
	}

	return new Stripe(secretKey, {
		apiVersion: "2025-08-27.basil",
		...options,
	});
}

/**
 * Verifies a Stripe webhook signature and returns the parsed event.
 *
 * Reads STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET from environment variables.
 *
 * @param {string | Buffer} body - Raw request body
 * @param {string | null} signature - Value of the stripe-signature header
 * @returns {Promise<import("stripe").Stripe.Event>} Verified Stripe event
 * @throws {Error} If signature is invalid, or required env vars are not set
 */
export async function getStripeWebhookEvent(body, signature) {
	const stripe = await createStripeClient();

	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
	if (!webhookSecret) {
		throw new Error(
			"STRIPE_WEBHOOK_SECRET is required for webhook signature verification.",
		);
	}

	if (!signature) {
		throw new Error("Missing stripe-signature header");
	}

	return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}
