/**
 * Builds MAIL_SMTP_URL from individual environment variables if not explicitly provided.
 * Allows configuration via individual MAIL_* vars instead of a single MAIL_SMTP_URL.
 */
function getMailSmtpUrl() {
	if (process.env.MAIL_SMTP_URL) {
		return process.env.MAIL_SMTP_URL;
	}

	const host = process.env.MAIL_HOST || "localhost";
	const port = process.env.MAIL_SMTP_PORT || "1025";

	return `smtp://${host}:${port}`;
}

/**
 * Builds mail Web UI URL from individual environment variables.
 * Useful for displaying the URL in logs or configuration.
 */
function getMailUiUrl() {
	const host = process.env.MAIL_HOST || "localhost";
	const port = process.env.MAIL_UI_PORT || "8025";

	return `http://${host}:${port}`;
}

/**
 * Gets mail SMTP configuration for email clients.
 */
export const getMailSmtpConfig = () => {
	const url = getMailSmtpUrl();
	const match = url.match(/smtp:\/\/([^:]+):(\d+)/);
	const host = match ? match[1] : process.env.MAIL_HOST || "localhost";
	const port = match ? match[2] : process.env.MAIL_SMTP_PORT || "1025";

	return {
		host,
		port: parseInt(port, 10),
		url,
	};
};

export { getMailSmtpUrl, getMailUiUrl };
