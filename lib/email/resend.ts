'use server';

import { Resend } from 'resend';
import { SignJWT } from 'jose';

const resendApiKey = process.env.RESEND_API_KEY;
const resendEnabled = process.env.RESEND_ENABLED === 'true';
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
const contactEmail = process.env.CONTACT_EMAIL || 'contact@example.com';
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendEnabled || !resendApiKey) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }

  return resendClient;
}

export async function isEmailEnabled(): Promise<boolean> {
  return resendEnabled && !!resendApiKey;
}

export async function generateActivationToken(userId: number, email: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'fallback-secret');
  
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secret);

  return token;
}

export async function verifyActivationToken(token: string): Promise<{ userId: number; email: string } | null> {
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'fallback-secret');
    const { jwtVerify } = await import('jose');
    
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.userId && payload.email) {
      return {
        userId: payload.userId as number,
        email: payload.email as string,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function sendActivationEmail(email: string, activationToken: string): Promise<boolean> {
  if (!(await isEmailEnabled())) {
    return false;
  }

  const client = getResendClient();
  if (!client) {
    return false;
  }

  const activationUrl = `${baseUrl}/api/auth/activate?token=${activationToken}`;

  try {
    const { error } = await client.emails.send({
      from: resendFromEmail,
      to: email,
      subject: 'Activate your account',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
              <h1 style="color: #ea580c; margin-top: 0;">Welcome!</h1>
              <p>Thank you for signing up. Please click the button below to activate your account:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${activationUrl}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Activate Account</a>
              </div>
              <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #666; font-size: 12px; word-break: break-all;">${activationUrl}</p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't create an account, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending activation email:', error);
    return false;
  }
}

export async function sendContactEmail(
  name: string,
  fromEmail: string,
  subject: string,
  message: string
): Promise<boolean> {
  if (!(await isEmailEnabled())) {
    return false;
  }

  const client = getResendClient();
  if (!client) {
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from: resendFromEmail,
      to: contactEmail,
      replyTo: fromEmail,
      subject: `Contact Form: ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
              <h2 style="color: #ea580c; margin-top: 0;">New Contact Form Submission</h2>
              <p><strong>From:</strong> ${name} (${fromEmail})</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <div style="background-color: white; padding: 20px; border-radius: 4px; margin-top: 20px;">
                <p style="white-space: pre-wrap; margin: 0;">${message}</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending contact email:', error);
    return false;
  }
}

