import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const mailFrom = process.env.MAIL_FROM || 'Occu-Med Lab Supplies <no-reply@example.com>';

export async function sendPlainEmail({ to, subject, text }) {
  if (!resend || !to) {
    console.log('Email skipped:', subject);
    return { skipped: true };
  }

  return resend.emails.send({
    from: mailFrom,
    to,
    subject,
    text
  });
}
