'use server';

import { z } from 'zod';
import { validatedAction } from '@/lib/auth/middleware';
import { sendContactEmail, isEmailEnabled } from '@/lib/email/resend';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required').max(200),
  message: z.string().min(1, 'Message is required').max(5000),
});

export const submitContact = validatedAction(
  contactSchema,
  async (data) => {
    if (!(await isEmailEnabled())) {
      return {
        error: 'Email service is not enabled. Please contact support through other means.',
      };
    }

    const { name, email, subject, message } = data;

    const success = await sendContactEmail(name, email, subject, message);

    if (!success) {
      return {
        error: 'Failed to send message. Please try again later.',
        name,
        email,
        subject,
        message,
      };
    }

    return {
      success: 'Your message has been sent successfully! We will get back to you soon.',
    };
  }
);

