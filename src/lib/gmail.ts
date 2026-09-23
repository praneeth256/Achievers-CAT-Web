/**
 * Gmail API utility for sending transactional emails via OAuth2.
 *
 * Required environment variables (server-side only, no NEXT_PUBLIC_ prefix):
 *   GMAIL_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
 *   GMAIL_CLIENT_SECRET   — OAuth2 client secret
 *   GMAIL_REFRESH_TOKEN   — Long-lived refresh token from one-time consent flow
 *   GMAIL_SENDER_EMAIL    — The Gmail address that will appear as the sender
 */

import { google } from "googleapis";

function buildOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground" // redirect URI used during token generation
  );
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return client;
}

/**
 * Encode a plain string to RFC 2047 base64url for MIME headers.
 * This keeps display names with non-ASCII chars safe.
 */
function encodeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`;
}

/**
 * Build a raw RFC 2822 email message encoded in base64url.
 */
function buildRawMessage({
  to,
  subject,
  htmlBody,
  fromName = "ACHIEVERS CAT",
}: {
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
}): string {
  const from = `${encodeHeader(fromName)} <${process.env.GMAIL_SENDER_EMAIL}>`;
  const boundary = `boundary_${Date.now().toString(36)}`;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    Buffer.from(htmlBody).toString("base64"),
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  // Gmail API expects the raw message as base64url (no padding issues)
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  fromName?: string;
}

/**
 * Send a single email via the Gmail API.
 * Throws if the send fails (caller is responsible for error handling).
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const auth = buildOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: buildRawMessage(options),
    },
  });
}

/**
 * Build the standard daily-reminder email HTML for a student.
 */
export function buildDailyReminderEmail({
  displayName,
  date,
  appUrl = "https://achievers-cat-web.vercel.app",
}: {
  displayName: string;
  date: string; // "YYYY-MM-DD"
  appUrl?: string;
}): string {
  const firstName = displayName.split(" ")[0] || "Student";
  const [year, month, day] = date.split("-");
  const dateLabel = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your ACHIEVERS CAT Daily Target</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d6c3e 0%,#2e8b57 100%);padding:28px 32px 24px;">
            <p style="margin:0;color:#a8f5c6;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Achievers CAT</p>
            <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">🎯 Your Daily Target is Waiting</h1>
            <p style="margin:6px 0 0;color:#c8f0d8;font-size:13px;">${dateLabel}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#222;">Hi <strong>${firstName}</strong>,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
              Your <strong>Quant, VARC and DILR</strong> daily targets for today are ready.
              Each section takes about 15 minutes — stay consistent and your CAT score will reflect it.
            </p>

            <!-- Stats row -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr>
                <td width="33%" align="center" style="padding:12px 8px;background:#f0faf4;border-radius:10px;">
                  <p style="margin:0;font-size:18px;">📐</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#1d6c3e;">Quant</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#666;">5 questions</p>
                </td>
                <td width="4%"></td>
                <td width="33%" align="center" style="padding:12px 8px;background:#f0faf4;border-radius:10px;">
                  <p style="margin:0;font-size:18px;">📖</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#1d6c3e;">VARC</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#666;">4–5 questions</p>
                </td>
                <td width="4%"></td>
                <td width="33%" align="center" style="padding:12px 8px;background:#f0faf4;border-radius:10px;">
                  <p style="margin:0;font-size:18px;">🔢</p>
                  <p style="margin:4px 0 0;font-size:12px;font-weight:700;color:#1d6c3e;">DILR</p>
                  <p style="margin:2px 0 0;font-size:11px;color:#666;">4 questions</p>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
              <tr>
                <td style="background:#1d6c3e;border-radius:50px;text-align:center;">
                  <a href="${appUrl}/daily"
                     style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                    Start Today's Target →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#888;text-align:center;line-height:1.6;">
              ⏱️ Just 45 minutes a day keeps your CAT prep on track.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;line-height:1.6;">
              You're receiving this because you're enrolled in Achievers CAT.<br/>
              <a href="${appUrl}/profile" style="color:#aaa;">Manage email preferences</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
