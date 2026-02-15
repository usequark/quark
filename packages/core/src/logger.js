/**
 * @techstream/quark-core - Logger Module
 * Lightweight structured logger with zero external dependencies
 */

/** @enum {number} */
const LOG_LEVELS = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
	fatal: 50,
};

const LEVEL_NAMES = /** @type {const} */ ({
	10: "debug",
	20: "info",
	30: "warn",
	40: "error",
	50: "fatal",
});

/** @type {Record<string, string>} */
const LEVEL_COLORS = {
	debug: "\x1b[36m", // cyan
	info: "\x1b[32m", // green
	warn: "\x1b[33m", // yellow
	error: "\x1b[31m", // red
	fatal: "\x1b[35m", // magenta
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * Resolves the minimum log level from options and environment
 * @param {string} [optionLevel] - Level from options
 * @returns {number}
 */
const resolveLevel = (optionLevel) => {
	const level =
		optionLevel || process.env.LOG_LEVEL || (isProduction() ? "info" : "debug");
	return LOG_LEVELS[level] ?? LOG_LEVELS.info;
};

/**
 * Formats a log entry for dev (colorized, human-readable)
 * @param {object} entry - The log entry
 * @returns {string}
 */
const formatDev = (entry) => {
	const { timestamp, level, name, msg, ...rest } = entry;
	const color = LEVEL_COLORS[level] || "";
	const time = timestamp.slice(11, 23); // HH:mm:ss.SSS
	const contextStr =
		Object.keys(rest).length > 0
			? ` ${DIM}${JSON.stringify(rest)}${RESET}`
			: "";
	return `${DIM}${time}${RESET} ${color}${level.toUpperCase().padEnd(5)}${RESET} ${DIM}[${name}]${RESET} ${msg}${contextStr}`;
};

/**
 * Formats a log entry for production (single-line JSON)
 * @param {object} entry - The log entry
 * @returns {string}
 */
const formatProd = (entry) => {
	return JSON.stringify(entry);
};

/**
 * Returns the console method for a given level
 * @param {string} level - The log level name
 * @returns {Function}
 */
const getTransport = (level) => {
	if (level === "error" || level === "fatal") return console.error;
	if (level === "warn") return console.warn;
	return console.log;
};

/**
 * @typedef {Object} LoggerOptions
 * @property {string} [name] - Logger name (e.g. "web", "worker", "db")
 * @property {string} [level] - Minimum log level (default: "info" in production, "debug" in dev)
 * @property {Object} [context] - Default context merged into every log entry
 */

/**
 * @typedef {Object} Logger
 * @property {(msg: string, data?: Object) => void} debug - Log at debug level
 * @property {(msg: string, data?: Object) => void} info - Log at info level
 * @property {(msg: string, data?: Object) => void} warn - Log at warn level
 * @property {(msg: string, data?: Object) => void} error - Log at error level
 * @property {(msg: string, data?: Object) => void} fatal - Log at fatal level
 * @property {(context: Object) => Logger} child - Create a child logger with merged context
 */

/**
 * Creates a structured logger instance
 * @param {LoggerOptions} [options] - Logger configuration
 * @returns {Logger}
 */
export const createLogger = (options = {}) => {
	const {
		name = "app",
		level: optionLevel,
		context: defaultContext = {},
	} = options;
	const minLevel = resolveLevel(optionLevel);
	const format = isProduction() ? formatProd : formatDev;

	/**
	 * Writes a log entry if the level is at or above the minimum
	 * @param {string} levelName - The level name
	 * @param {string} msg - The log message
	 * @param {Object} [data] - Additional data
	 */
	const write = (levelName, msg, data = {}) => {
		const numeric = LOG_LEVELS[levelName];
		if (numeric < minLevel) return;

		const entry = {
			timestamp: new Date().toISOString(),
			level: levelName,
			name,
			msg,
			...defaultContext,
			...data,
		};

		const transport = getTransport(levelName);
		transport(format(entry));
	};

	return {
		debug: (msg, data) => write("debug", msg, data),
		info: (msg, data) => write("info", msg, data),
		warn: (msg, data) => write("warn", msg, data),
		error: (msg, data) => write("error", msg, data),
		fatal: (msg, data) => write("fatal", msg, data),

		/**
		 * Creates a child logger with merged context
		 * @param {Object} childContext - Additional context for the child logger
		 * @returns {Logger}
		 */
		child: (childContext = {}) => {
			return createLogger({
				name,
				level: LEVEL_NAMES[minLevel],
				context: { ...defaultContext, ...childContext },
			});
		},
	};
};

/**
 * Creates a request logger middleware helper.
 * Returns a function that accepts a request object and produces
 * a child logger enriched with request-specific fields.
 * @param {Logger} parentLogger - The parent logger instance
 * @returns {(request: { method?: string, url?: string, headers?: Object }) => Logger}
 */
export const requestLogger = (parentLogger) => {
	return (request) => {
		const requestId = request.headers?.["x-request-id"] || crypto.randomUUID();
		const method = request.method || "UNKNOWN";
		const path = request.url
			? new URL(request.url, "http://localhost").pathname
			: "/";

		const child = parentLogger.child({ requestId, method, path });
		child.info("request started");
		return child;
	};
};

/** Default logger instance */
export const logger = createLogger({ name: "quark" });
