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

export async function sendInvitationEmail(
  email: string,
  organisationName: string,
  role: string,
  inviteId: number,
  inviterName?: string
): Promise<boolean> {
  console.log('[sendInvitationEmail] Function called with:', { email, organisationName, role, inviteId, inviterName });
  
  const emailEnabled = await isEmailEnabled();
  console.log('[sendInvitationEmail] Email enabled check:', emailEnabled);
  console.log('[sendInvitationEmail] RESEND_ENABLED:', process.env.RESEND_ENABLED);
  console.log('[sendInvitationEmail] RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
  console.log('[sendInvitationEmail] RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL);
  
  if (!emailEnabled) {
    console.warn('[sendInvitationEmail] Email is not enabled. RESEND_ENABLED is not set to "true" or RESEND_API_KEY is missing.');
    return false;
  }

  const client = getResendClient();
  if (!client) {
    console.warn('[sendInvitationEmail] Resend client could not be initialized. Check RESEND_API_KEY configuration.');
    return false;
  }
  
  console.log('[sendInvitationEmail] Resend client initialized successfully');

  const signUpUrl = `${baseUrl}/sign-up?inviteId=${inviteId}`;
  const signInUrl = `${baseUrl}/sign-in?inviteId=${inviteId}`;
  const inviterText = inviterName ? ` by ${inviterName}` : '';

  console.log('Sending invitation email:', {
    to: email,
    from: resendFromEmail,
    organisationName,
    role,
    inviteId,
    baseUrl
  });

  try {
    const result = await client.emails.send({
      from: resendFromEmail,
      to: email,
      subject: `You've been invited to join ${organisationName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f9fafb; padding: 30px; border-radius: 8px;">
              <h1 style="color: #ea580c; margin-top: 0;">You've been invited!</h1>
              <p>You've been invited${inviterText} to join <strong>${organisationName}</strong> as a <strong>${role}</strong>.</p>
              <p>To accept this invitation, please choose one of the options below:</p>
              
              <div style="margin: 30px 0;">
                <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #ea580c;">
                  <h3 style="margin-top: 0; color: #333;">New to our platform?</h3>
                  <p style="margin-bottom: 15px;">Create a new account to join the team:</p>
                  <div style="text-align: center;">
                    <a href="${signUpUrl}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Create Account</a>
                  </div>
                </div>
                
                <div style="background-color: white; padding: 20px; border-radius: 6px; border-left: 4px solid #ea580c;">
                  <h3 style="margin-top: 0; color: #333;">Already have an account?</h3>
                  <p style="margin-bottom: 15px;">Sign in to accept the invitation:</p>
                  <div style="text-align: center;">
                    <a href="${signInUrl}" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Sign In</a>
                  </div>
                </div>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 30px;">If the buttons don't work, you can copy and paste these links into your browser:</p>
              <p style="color: #666; font-size: 12px; word-break: break-all; margin: 5px 0;">Create account: ${signUpUrl}</p>
              <p style="color: #666; font-size: 12px; word-break: break-all; margin: 5px 0;">Sign in: ${signInUrl}</p>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log('Resend API response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('Resend API error:', JSON.stringify(result.error, null, 2));
      console.error('Error details:', {
        message: result.error.message,
        name: result.error.name,
        statusCode: (result.error as any).statusCode,
        response: (result.error as any).response
      });
      return false;
    }

    if (result.data) {
      console.log('Email sent successfully! Email ID:', result.data.id);
      return true;
    }

    // If no error and no data, something unexpected happened
    console.warn('Resend returned no error and no data. Response:', result);
    return false;
  } catch (error) {
    console.error('Exception sending invitation email:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
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

