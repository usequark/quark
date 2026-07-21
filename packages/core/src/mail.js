/**
 * Builds the dev mail SMTP URL from individual MAIL_* environment variables.
 * Used only for local development (Mailpit). Production email uses SMTP_HOST/SMTP_PORT
 * configured in email.js.
 *
 * @returns {string} SMTP URL (e.g. "smtp://localhost:1025")
 */
function getDevMailUrl() {
	const host = process.env.MAIL_HOST || "localhost";
	const port = process.env.MAIL_SMTP_PORT || "1025";

	return `smtp://${host}:${port}`;
}

/**
 * Builds mail Web UI URL from individual environment variables.
 * Useful for displaying the Mailpit URL in logs or configuration.
 *
 * @returns {string} Mail UI URL (e.g. "http://localhost:8025")
 */
function getDevMailUiUrl() {
	const host = process.env.MAIL_HOST || "localhost";
	const port = process.env.MAIL_UI_PORT || "8025";

	return `http://${host}:${port}`;
}

/**
 * Gets dev mail SMTP configuration for the Nodemailer transport.
 * Reads from MAIL_HOST and MAIL_SMTP_PORT environment variables.
 *
 * @returns {{ host: string, port: number, url: string }}
 */
export const getDevMailConfig = () => {
	const host = process.env.MAIL_HOST || "localhost";
	const port = process.env.MAIL_SMTP_PORT || "1025";

	return {
		host,
		port: parseInt(port, 10),
		url: getDevMailUrl(),
	};
};

// Backwards-compatible aliases (deprecated - use getDevMailConfig, getDevMailUrl, getDevMailUiUrl)
export const getMailSmtpConfig = getDevMailConfig;
export const getMailSmtpUrl = getDevMailUrl;
export const getMailUiUrl = getDevMailUiUrl;

export { getDevMailUiUrl, getDevMailUrl };
