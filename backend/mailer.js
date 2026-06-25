import nodemailer from 'nodemailer';

const mailFrom = process.env.MAIL_FROM || process.env.SMTP_USER || '';
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || smtpPort === 465;
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';

const canSendMail = Boolean(mailFrom && smtpHost && smtpUser && smtpPass);

const transporter = canSendMail
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

export async function sendPlainEmail({ to, subject, text }) {
  if (!transporter || !to) {
    console.log('Email skipped:', subject);
    return { skipped: true };
  }

  return transporter.sendMail({
    from: mailFrom,
    to,
    subject,
    text,
  });
}
