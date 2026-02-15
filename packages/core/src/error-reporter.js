/**
 * @techstream/quark-core - Error Reporter Module
 * Adapter/hook system for pluggable error reporting
 */

import { normalizeError } from "./errors.js";
import { logger } from "./logger.js";

const MAX_BREADCRUMBS = 50;

/**
 * @typedef {Object} ErrorAdapter
 * @property {string} name - Unique adapter identifier
 * @property {(error: Error, context: Object) => void} report - Called when an error is reported
 * @property {(message: string, level: string, context: Object) => void} [captureMessage] - For non-error events
 * @property {(user: Object) => void} [setUser] - Sets user context
 * @property {(message: string, category: string, data: Object) => void} [addBreadcrumb] - Adds a breadcrumb
 */

/**
 * @typedef {Object} Breadcrumb
 * @property {string} message - Breadcrumb message
 * @property {string} category - Breadcrumb category
 * @property {Object} data - Associated data
 * @property {string} timestamp - ISO timestamp
 */

/**
 * Built-in adapter that logs errors via the Quark logger.
 * @type {ErrorAdapter}
 */
export const consoleAdapter = {
	name: "console",

	report(error, context) {
		const appError = normalizeError(error);
		logger.error(appError.message, {
			error: appError.toJSON(),
			context,
			stack: error.stack,
		});
	},

	captureMessage(message, level = "info", context = {}) {
		const logFn = logger[level] || logger.info;
		logFn.call(logger, message, context);
	},

	setUser(_user) {
		// Console adapter does not persist user context
	},

	addBreadcrumb(_message, _category, _data) {
		// Console adapter does not store breadcrumbs
	},
};

/**
 * Error reporter with adapter registration.
 * Distributes error reports to all registered adapters.
 */
export class ErrorReporter {
	/** @type {ErrorAdapter[]} */
	#adapters = [];

	/** @type {Breadcrumb[]} */
	#breadcrumbs = [];

	/** @type {Object|null} */
	#user = null;

	constructor() {
		this.#adapters = [consoleAdapter];
		this.#breadcrumbs = [];
		this.#user = null;
	}

	/**
	 * Register an adapter
	 * @param {ErrorAdapter} adapter - The adapter to register
	 * @returns {void}
	 */
	use(adapter) {
		if (
			!adapter ||
			typeof adapter.name !== "string" ||
			typeof adapter.report !== "function"
		) {
			throw new Error(
				"Adapter must have a name (string) and a report (function)",
			);
		}
		this.#adapters.push(adapter);
	}

	/**
	 * Report an error to all registered adapters
	 * @param {Error} error - The error to report
	 * @param {Object} [context={}] - Additional context
	 * @returns {void}
	 */
	report(error, context = {}) {
		const enrichedContext = {
			...context,
			...(this.#user ? { user: this.#user } : {}),
			breadcrumbs: [...this.#breadcrumbs],
		};

		for (const adapter of this.#adapters) {
			try {
				adapter.report(error, enrichedContext);
			} catch (_adapterError) {
				// Swallow adapter errors to avoid cascading failures
			}
		}
	}

	/**
	 * Capture a non-error message event
	 * @param {string} message - The message to capture
	 * @param {string} [level="info"] - Log level
	 * @param {Object} [context={}] - Additional context
	 * @returns {void}
	 */
	captureMessage(message, level = "info", context = {}) {
		const enrichedContext = {
			...context,
			...(this.#user ? { user: this.#user } : {}),
		};

		for (const adapter of this.#adapters) {
			try {
				if (typeof adapter.captureMessage === "function") {
					adapter.captureMessage(message, level, enrichedContext);
				}
			} catch (_adapterError) {
				// Swallow adapter errors
			}
		}
	}

	/**
	 * Set user context for subsequent reports
	 * @param {Object} user - User information
	 * @returns {void}
	 */
	setUser(user) {
		this.#user = user;

		for (const adapter of this.#adapters) {
			try {
				if (typeof adapter.setUser === "function") {
					adapter.setUser(user);
				}
			} catch (_adapterError) {
				// Swallow adapter errors
			}
		}
	}

	/**
	 * Add a breadcrumb to the trail (circular buffer, max 50)
	 * @param {string} message - Breadcrumb message
	 * @param {string} [category="default"] - Breadcrumb category
	 * @param {Object} [data={}] - Associated data
	 * @returns {void}
	 */
	addBreadcrumb(message, category = "default", data = {}) {
		/** @type {Breadcrumb} */
		const breadcrumb = {
			message,
			category,
			data,
			timestamp: new Date().toISOString(),
		};

		if (this.#breadcrumbs.length >= MAX_BREADCRUMBS) {
			this.#breadcrumbs.shift();
		}
		this.#breadcrumbs.push(breadcrumb);

		for (const adapter of this.#adapters) {
			try {
				if (typeof adapter.addBreadcrumb === "function") {
					adapter.addBreadcrumb(message, category, data);
				}
			} catch (_adapterError) {
				// Swallow adapter errors
			}
		}
	}

	/**
	 * Returns the list of registered adapters (for inspection/testing)
	 * @returns {ErrorAdapter[]}
	 */
	get adapters() {
		return [...this.#adapters];
	}

	/**
	 * Returns the current breadcrumbs (for inspection/testing)
	 * @returns {Breadcrumb[]}
	 */
	get breadcrumbs() {
		return [...this.#breadcrumbs];
	}
}

/**
 * Creates a Sentry adapter factory (stub/example).
 * Downstream projects can use this as a template to integrate Sentry.
 *
 * @param {Object} _options - Sentry configuration options
 * @returns {ErrorAdapter} A Sentry adapter (stubbed)
 *
 * @example
 * ```js
 * import * as Sentry from "@sentry/node";
 * import { errorReporter, createSentryAdapter } from "@techstream/quark-core";
 *
 * Sentry.init({ dsn: "https://example@sentry.io/123" });
 * errorReporter.use(createSentryAdapter({ Sentry }));
 * ```
 */
export const createSentryAdapter = (_options = {}) => {
	return {
		name: "sentry",

		report(_error, _context) {
			// Example Sentry integration:
			// const { Sentry } = options;
			// Sentry.withScope((scope) => {
			//   if (context.user) scope.setUser(context.user);
			//   if (context.breadcrumbs) {
			//     for (const b of context.breadcrumbs) {
			//       Sentry.addBreadcrumb({ message: b.message, category: b.category, data: b.data });
			//     }
			//   }
			//   scope.setExtras(context);
			//   Sentry.captureException(error);
			// });
		},

		captureMessage(_message, _level, _context) {
			// Example:
			// const { Sentry } = options;
			// Sentry.captureMessage(message, level);
		},

		setUser(_user) {
			// Example:
			// const { Sentry } = options;
			// Sentry.setUser(user);
		},

		addBreadcrumb(_message, _category, _data) {
			// Example:
			// const { Sentry } = options;
			// Sentry.addBreadcrumb({ message, category, data });
		},
	};
};

/** Global singleton error reporter instance */
export const errorReporter = new ErrorReporter();
