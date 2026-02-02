const SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send";
const FROM_EMAIL = "Newsvendor Game <notifications@newsvendor.app>";
const REPLY_TO_EMAIL = "admin@edutool.org";
const ADMIN_EMAIL = "siemsene@gmail.com";

function wrapHtmlBody(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Newsvendor Game</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333333; background-color: #f9f9f9;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 24px 32px; background-color: #2563eb;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">Newsvendor Game</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f5f5f5; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #666666;">
                This is an automated message from Newsvendor Game.
              </p>
              <p style="margin: 0; font-size: 12px; color: #666666;">
                Questions? Contact us at <a href="mailto:${REPLY_TO_EMAIL}" style="color: #2563eb;">${REPLY_TO_EMAIL}</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #999999;">
                Newsvendor Game - Educational Supply Chain Simulation<br>
                <a href="https://newsvendor.app" style="color: #999999;">https://newsvendor.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "$1\n\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "$1")
    .replace(/<em>(.*?)<\/em>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.SMTP2GO_API_KEY;
  if (!apiKey) {
    console.warn("SMTP2GO_API_KEY not set, skipping email");
    return;
  }

  const wrappedHtml = wrapHtmlBody(html);
  const plainText = htmlToPlainText(html);

  const response = await fetch(SMTP2GO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      to: [to],
      sender: FROM_EMAIL,
      subject,
      html_body: wrappedHtml,
      text_body: plainText,
      custom_headers: [
        {
          header: "Reply-To",
          value: REPLY_TO_EMAIL,
        },
        {
          header: "X-Mailer",
          value: "Newsvendor Game Notification System",
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMTP2GO API error: ${response.status} ${text}`);
  }
}

export async function sendAdminNewApplicationNotification(
  instructorName: string,
  instructorEmail: string,
  affiliation: string
): Promise<void> {
  await sendEmail(
    ADMIN_EMAIL,
    "New Instructor Application - Newsvendor Game",
    `
      <h2>New Instructor Application</h2>
      <p>A new instructor has applied for access to the Newsvendor Game.</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(instructorName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(instructorEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Affiliation</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(affiliation)}</td>
        </tr>
      </table>
      <p>Please log in to the admin dashboard to review this application.</p>
    `
  );
}

export async function sendInstructorApprovalEmail(
  email: string,
  name: string
): Promise<void> {
  await sendEmail(
    email,
    "Your Instructor Account Has Been Approved - Newsvendor Game",
    `
      <h2>Welcome to the Newsvendor Game!</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your instructor account has been approved. You can now log in and start creating sessions for your students.</p>
      <p><a href="https://newsvendor.app/instructor/login">Log in to your account</a></p>
      <p>If you have any questions, feel free to reply to this email.</p>
    `
  );
}

export async function sendInstructorRejectionEmail(
  email: string,
  name: string,
  reason?: string
): Promise<void> {
  await sendEmail(
    email,
    "Instructor Application Update - Newsvendor Game",
    `
      <h2>Instructor Application Update</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>We've reviewed your instructor application for the Newsvendor Game.</p>
      <p>Unfortunately, we are unable to approve your application at this time.</p>
      ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
      <p>If you believe this is an error or have additional information to provide, please reply to this email.</p>
    `
  );
}

export async function sendInstructorRevocationEmail(
  email: string,
  name: string,
  reason?: string
): Promise<void> {
  await sendEmail(
    email,
    "Instructor Access Revoked - Newsvendor Game",
    `
      <h2>Instructor Access Revoked</h2>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your instructor access to the Newsvendor Game has been revoked.</p>
      ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
      <p>All your active sessions have been ended. If you believe this is an error, please reply to this email.</p>
    `
  );
}

export async function sendAdminPendingApprovalsSummary(
  pendingCount: number,
  pendingInstructors: Array<{ name: string; email: string; affiliation: string }>
): Promise<void> {
  const instructorRows = pendingInstructors
    .map(
      (i) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(i.name)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(i.email)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(i.affiliation)}</td>
        </tr>
      `
    )
    .join("");

  await sendEmail(
    ADMIN_EMAIL,
    `${pendingCount} Instructor Application${pendingCount === 1 ? "" : "s"} Pending - Newsvendor Game`,
    `
      <h2>Pending Instructor Applications</h2>
      <p>You have <strong>${pendingCount}</strong> instructor application${pendingCount === 1 ? "" : "s"} awaiting your review.</p>
      <table style="border-collapse: collapse; margin: 16px 0; width: 100%;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Name</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Email</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Affiliation</th>
          </tr>
        </thead>
        <tbody>
          ${instructorRows}
        </tbody>
      </table>
      <p><a href="https://newsvendor.app/admin">Go to Admin Dashboard</a></p>
    `
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
