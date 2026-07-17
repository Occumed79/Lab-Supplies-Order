import nodemailer from 'nodemailer';

const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || '';
const resendApiKey = process.env.RESEND_API_KEY || '';
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';

const canSendWithResend = Boolean(mailFrom && resendApiKey);
const canSendWithSmtp = Boolean(mailFrom && smtpHost && smtpUser && smtpPass);

const transporter = canSendWithSmtp
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

async function sendWithResend({ to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: mailFrom, to: [to], subject, text }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${detail}`);
  }

  return response.json();
}

export async function sendPlainEmail({ to, subject, text }) {
  if (!to) return { skipped: true };

  if (canSendWithResend) {
    return sendWithResend({ to, subject, text });
  }

  if (transporter) {
    return transporter.sendMail({
      from: mailFrom,
      to,
      subject,
      text,
    });
  }

  console.log('Email skipped:', subject);
  return { skipped: true };
}
