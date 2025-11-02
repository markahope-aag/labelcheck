import { Resend } from 'resend';
import { logger } from './logger';

export const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'LabelCheck <noreply@app.labelcheck.io>',
      to: [to],
      subject,
      html,
    });

    if (error) {
      logger.error('Resend API error', { error, to, subject });
      throw new Error(`Failed to send email: ${error.message}`);
    }

    logger.debug('Email sent successfully', { to, subject, emailId: data?.id });
    return data;
  } catch (error) {
    logger.error('Email sending failed', { error, to, subject });
    throw error;
  }
}
