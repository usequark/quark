/**
 * @techstream/quark-core - Email Templates
 *
 * Reusable HTML email templates with plain-text fallbacks.
 * Each template function returns { subject, html, text }.
 */

/**
 * Escape HTML entities to prevent XSS in user-provided values
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Shared outer layout for all emails
 * @param {string} body - Inner HTML content
 * @returns {string}
 */
function layout(body) {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:8px;border:1px solid #e4e4e7;padding:32px">
        <tr><td>${body}</td></tr>
      </table>
      <p style="color:#a1a1aa;font-size:12px;margin-top:24px">
        You received this email because an account was created with this address.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Welcome email - sent after user registration
 *
 * @param {{ name?: string, appName?: string, loginUrl?: string }} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function welcomeEmail(data = {}) {
	const name = data.name ? escapeHtml(data.name) : "there";
	const appName = data.appName || "Quark";
	const loginUrl = data.loginUrl || "";

	const buttonHtml = loginUrl
		? `<p style="text-align:center;margin:24px 0">
        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-weight:500">
          Sign in to ${escapeHtml(appName)}
        </a>
      </p>`
		: "";

	const html = layout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Welcome, ${name}!</h1>
    <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px">
      Your account has been created successfully. You can now sign in and start using ${escapeHtml(appName)}.
    </p>
    ${buttonHtml}
    <p style="color:#71717a;font-size:14px;margin:0">
      If you didn't create this account, you can safely ignore this email.
    </p>
  `);

	const text = [
		`Welcome, ${data.name || "there"}!`,
		"",
		`Your account has been created successfully. You can now sign in and start using ${appName}.`,
		...(loginUrl ? ["", `Sign in: ${loginUrl}`] : []),
		"",
		"If you didn't create this account, you can safely ignore this email.",
	].join("\n");

	return { subject: `Welcome to ${appName}!`, html, text };
}

/**
 * Password reset email - sent when user requests a reset
 *
 * @param {{ name?: string, resetUrl: string, appName?: string, expiresIn?: string }} data
 * @returns {{ subject: string, html: string, text: string }}
 */
export function passwordResetEmail(data) {
	if (!data?.resetUrl) {
		throw new Error("resetUrl is required for password reset email");
	}

	const name = data.name ? escapeHtml(data.name) : "there";
	const appName = data.appName || "Quark";
	const expiresIn = data.expiresIn || "1 hour";

	const html = layout(`
    <h1 style="margin:0 0 16px;font-size:24px;color:#18181b">Reset your password</h1>
    <p style="color:#3f3f46;line-height:1.6;margin:0 0 16px">
      Hi ${name}, we received a request to reset your ${escapeHtml(appName)} password.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(data.resetUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-weight:500">
        Reset password
      </a>
    </p>
    <p style="color:#71717a;font-size:14px;margin:0 0 8px">
      This link will expire in ${escapeHtml(expiresIn)}.
    </p>
    <p style="color:#71717a;font-size:14px;margin:0">
      If you didn't request this, you can safely ignore this email. Your password will not be changed.
    </p>
  `);

	const text = [
		`Reset your password`,
		"",
		`Hi ${data.name || "there"}, we received a request to reset your ${appName} password.`,
		"",
		`Reset your password: ${data.resetUrl}`,
		"",
		`This link will expire in ${expiresIn}.`,
		"",
		"If you didn't request this, you can safely ignore this email. Your password will not be changed.",
	].join("\n");

	return { subject: `Reset your ${appName} password`, html, text };
}
