'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  organisations,
  organisationMembers,
  activityLogs,
  type NewUser,
  type NewOrganisation,
  type NewOrganisationMember,
  type NewActivityLog,
  ActivityType,
  invitations
} from '@/lib/db/schema';
import { hashPassword } from '@/lib/auth/session';
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut, auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser, getUserWithOrganisation } from '@/lib/db/queries';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';

async function logActivity(
  organisationId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (organisationId === null || organisationId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    organisationId,
    userId,
    action: type,
    ipAddress: ipAddress || ''
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
  inviteId: z.string().optional()
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  // Verify credentials first
  const userWithOrganisation = await db
    .select({
      user: users,
      organisation: organisations
    })
    .from(users)
    .leftJoin(organisationMembers, eq(users.id, organisationMembers.userId))
    .leftJoin(organisations, eq(organisationMembers.organisationId, organisations.id))
    .where(eq(users.email, email))
    .limit(1);

  if (userWithOrganisation.length === 0) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  const { user: foundUser, organisation: foundOrganisation } = userWithOrganisation[0];

  // Import comparePasswords dynamically
  const { comparePasswords } = await import('@/lib/auth/session');
  const isPasswordValid = await comparePasswords(password, foundUser.passwordHash);

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password
    };
  }

  // Sign in with NextAuth
  // Note: In NextAuth v5, signIn from server actions may need special handling
  try {
    const result = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/dashboard',
    });

    if (result?.error) {
      console.error('NextAuth sign in error:', result.error);
      return {
        error: 'Invalid email or password. Please try again.',
        email,
        password
      };
    }

    // If result.url exists, it means NextAuth wants to redirect
    // But since we set redirect: false, this shouldn't happen
    if (result?.url && result.url !== '/dashboard') {
      console.warn('Unexpected redirect URL:', result.url);
    }
  } catch (error: any) {
    console.error('Sign in error:', error);
    // If it's a CallbackRouteError, the credentials might still be valid
    // but NextAuth had an issue. Let's check if we can proceed anyway.
    if (error?.type === 'CallbackRouteError' || error?.cause?.type === 'CallbackRouteError') {
      console.warn('CallbackRouteError occurred, but credentials were valid. Proceeding...');
      // The user is authenticated, we can proceed
    } else {
      return {
        error: 'Invalid email or password. Please try again.',
        email,
        password
      };
    }
  }

  // Log activity
  await logActivity(foundOrganisation?.id, foundUser.id, ActivityType.SIGN_IN);

  // Handle invitation acceptance if inviteId is provided
  if (inviteId) {
    // Validate invitation exists, is pending, and email matches
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (invitation) {
      // Check if user is already a member of this organisation
      const existingMember = await db
        .select()
        .from(organisationMembers)
        .where(
          and(
            eq(organisationMembers.userId, foundUser.id),
            eq(organisationMembers.organisationId, invitation.organisationId)
          )
        )
        .limit(1);

      if (existingMember.length === 0) {
        // Add user to organisation with specified role
        await db.insert(organisationMembers).values({
          userId: foundUser.id,
          organisationId: invitation.organisationId,
          role: invitation.role
        });

        // Update invitation status to 'accepted'
        await db
          .update(invitations)
          .set({ status: 'accepted' })
          .where(eq(invitations.id, invitation.id));

        // Log activity
        await logActivity(
          invitation.organisationId,
          foundUser.id,
          ActivityType.ACCEPT_INVITATION
        );
      }
    }
  }

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const user = await getUser();
    if (user) {
      const userWithOrganisation = await db
        .select({
          organisation: organisations
        })
        .from(organisationMembers)
        .leftJoin(organisations, eq(organisationMembers.organisationId, organisations.id))
        .where(eq(organisationMembers.userId, user.id))
        .limit(1);
      const organisation = userWithOrganisation[0]?.organisation || null;
      const priceId = formData.get('priceId') as string;
      return createCheckoutSession({ organisation, priceId });
    }
  }

  // Check if user is confirmed and redirect accordingly
  const user = await getUser();
  if (user && !user.isConfirmed) {
    redirect('/confirmation');
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  inviteId: z.string().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, inviteId } = data;

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  const passwordHash = await hashPassword(password);

  const newUser: NewUser = {
    email,
    passwordHash,
    role: 'owner', // Default role, will be overridden if there's an invitation
    isConfirmed: false // New users require admin confirmation
  };

  const [createdUser] = await db.insert(users).values(newUser).returning();

  if (!createdUser) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password
    };
  }

  let organisationId: number;
  let userRole: string;
  let createdOrganisation: typeof organisations.$inferSelect | null = null;

  if (inviteId) {
    // Check if there's a valid invitation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (invitation) {
      organisationId = invitation.organisationId;
      userRole = invitation.role;

      await db
        .update(invitations)
        .set({ status: 'accepted' })
        .where(eq(invitations.id, invitation.id));

      await logActivity(organisationId, createdUser.id, ActivityType.ACCEPT_INVITATION);

      [createdOrganisation] = await db
        .select()
        .from(organisations)
        .where(eq(organisations.id, organisationId))
        .limit(1);
    } else {
      return { error: 'Invalid or expired invitation.', email, password };
    }
  } else {
    // Create a new organisation if there's no invitation
    const newOrganisation: NewOrganisation = {
      name: `${email}'s Organisation`
    };

    [createdOrganisation] = await db.insert(organisations).values(newOrganisation).returning();

    if (!createdOrganisation) {
      return {
        error: 'Failed to create organisation. Please try again.',
        email,
        password
      };
    }

    organisationId = createdOrganisation.id;
    userRole = 'owner';

    await logActivity(organisationId, createdUser.id, ActivityType.CREATE_ORGANISATION);
  }

  const newOrganisationMember: NewOrganisationMember = {
    userId: createdUser.id,
    organisationId: organisationId,
    role: userRole
  };

  await Promise.all([
    db.insert(organisationMembers).values(newOrganisationMember),
    logActivity(organisationId, createdUser.id, ActivityType.SIGN_UP)
  ]);

  // Send activation email if enabled
  const { isEmailEnabled, generateActivationToken, sendActivationEmail } = await import('@/lib/email/resend');
  if (await isEmailEnabled()) {
    try {
      const activationToken = await generateActivationToken(createdUser.id, createdUser.email);
      await sendActivationEmail(createdUser.email, activationToken);
    } catch (error) {
      console.error('Error sending activation email:', error);
      // Continue even if email fails
    }
  }

  // Sign in the user with NextAuth
  try {
    const signInResult = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (signInResult?.error) {
      console.error('Sign in error after signup:', signInResult.error);
      // Continue anyway since user is created
    }
  } catch (error) {
    console.error('Sign in error after signup:', error);
    // Continue anyway since user is created
  }

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    return createCheckoutSession({ organisation: createdOrganisation, priceId });
  }

  // Redirect to confirmation page since user is not confirmed
  redirect('/confirmation');
});

export async function signOut() {
  const user = await getUser();
  if (user) {
    const userWithOrganisation = await getUserWithOrganisation(user.id);
    await logActivity(userWithOrganisation?.organisationId, user.id, ActivityType.SIGN_OUT);
  }
  await nextAuthSignOut({ redirectTo: '/sign-in' });
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.'
      };
    }

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);
    const userWithOrganisation = await getUserWithOrganisation(user.id);

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithOrganisation?.organisationId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

    return {
      success: 'Password updated successfully.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        password,
        error: 'Incorrect password. Account deletion failed.'
      };
    }

    const userWithOrganisation = await getUserWithOrganisation(user.id);

    await logActivity(
      userWithOrganisation?.organisationId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')` // Ensure email uniqueness
      })
      .where(eq(users.id, user.id));

    if (userWithOrganisation?.organisationId) {
      await db
        .delete(organisationMembers)
        .where(
          and(
            eq(organisationMembers.userId, user.id),
            eq(organisationMembers.organisationId, userWithOrganisation.organisationId)
          )
        );
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;
    const userWithOrganisation = await getUserWithOrganisation(user.id);

    await Promise.all([
      db.update(users).set({ name, email }).where(eq(users.id, user.id)),
      logActivity(userWithOrganisation?.organisationId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    return { name, success: 'Account updated successfully.' };
  }
);

const removeOrganisationMemberSchema = z.object({
  memberId: z.number()
});

export const removeOrganisationMember = validatedActionWithUser(
  removeOrganisationMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithOrganisation = await getUserWithOrganisation(user.id);

    if (!userWithOrganisation?.organisationId) {
      return { error: 'User is not part of an organisation' };
    }

    await db
      .delete(organisationMembers)
      .where(
        and(
          eq(organisationMembers.id, memberId),
          eq(organisationMembers.organisationId, userWithOrganisation.organisationId)
        )
      );

    await logActivity(
      userWithOrganisation.organisationId,
      user.id,
      ActivityType.REMOVE_ORGANISATION_MEMBER
    );

    return { success: 'Organisation member removed successfully' };
  }
);

const cancelInvitationSchema = z.object({
  invitationId: z.string().transform((val) => parseInt(val, 10))
});

export const cancelInvitation = validatedActionWithUser(
  cancelInvitationSchema,
  async (data, _, user) => {
    const { invitationId } = data;
    const userWithOrganisation = await getUserWithOrganisation(user.id);

    if (!userWithOrganisation?.organisationId) {
      return { error: 'User is not part of an organisation' };
    }

    // Verify the invitation belongs to the user's organisation
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, invitationId),
          eq(invitations.organisationId, userWithOrganisation.organisationId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (!invitation) {
      return { error: 'Invitation not found or already processed' };
    }

    // Delete the invitation
    await db
      .delete(invitations)
      .where(eq(invitations.id, invitationId));

    await logActivity(
      userWithOrganisation.organisationId,
      user.id,
      ActivityType.REMOVE_ORGANISATION_MEMBER
    );

    return { success: 'Invitation cancelled successfully' };
  }
);

const acceptInvitationSchema = z.object({
  inviteId: z.string()
});

export const acceptInvitation = validatedActionWithUser(
  acceptInvitationSchema,
  async (data, _, user) => {
    const { inviteId } = data;

    // Validate invitation exists, is pending, and email matches current user
    const [invitation] = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.id, parseInt(inviteId)),
          eq(invitations.email, user.email),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (!invitation) {
      return { error: 'Invalid or expired invitation.' };
    }

    // Check if user is already a member of this organisation
    const existingMember = await db
      .select()
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, user.id),
          eq(organisationMembers.organisationId, invitation.organisationId)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'You are already a member of this organisation.' };
    }

    // Add user to organisation with specified role
    await db.insert(organisationMembers).values({
      userId: user.id,
      organisationId: invitation.organisationId,
      role: invitation.role
    });

    // Update invitation status to 'accepted'
    await db
      .update(invitations)
      .set({ status: 'accepted' })
      .where(eq(invitations.id, invitation.id));

    // Log activity
    await logActivity(
      invitation.organisationId,
      user.id,
      ActivityType.ACCEPT_INVITATION
    );

    return { success: 'Invitation accepted successfully' };
  }
);

const inviteOrganisationMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner'])
});

export const inviteOrganisationMember = validatedActionWithUser(
  inviteOrganisationMemberSchema,
  async (data, _, user) => {
    const { email, role } = data;
    const userWithOrganisation = await getUserWithOrganisation(user.id);

    if (!userWithOrganisation?.organisationId) {
      return { error: 'User is not part of an organisation' };
    }

    const existingMember = await db
      .select()
      .from(users)
      .leftJoin(organisationMembers, eq(users.id, organisationMembers.userId))
      .where(
        and(eq(users.email, email), eq(organisationMembers.organisationId, userWithOrganisation.organisationId))
      )
      .limit(1);

    if (existingMember.length > 0) {
      return { error: 'User is already a member of this organisation' };
    }

    // Check if there's an existing invitation
    const existingInvitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.email, email),
          eq(invitations.organisationId, userWithOrganisation.organisationId),
          eq(invitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvitation.length > 0) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Create a new invitation
    const [createdInvitation] = await db.insert(invitations).values({
      organisationId: userWithOrganisation.organisationId,
      email,
      role,
      invitedBy: user.id,
      status: 'pending'
    }).returning();

    if (!createdInvitation) {
      return { error: 'Failed to create invitation. Please try again.' };
    }

    await logActivity(
      userWithOrganisation.organisationId,
      user.id,
      ActivityType.INVITE_ORGANISATION_MEMBER
    );

    // Fetch organisation name for email
    const [organisation] = await db
      .select()
      .from(organisations)
      .where(eq(organisations.id, userWithOrganisation.organisationId))
      .limit(1);

    // Send invitation email
    let emailSent = false;
    let emailError: string | null = null;
    
    try {
      const { sendInvitationEmail, isEmailEnabled } = await import('@/lib/email/resend');
      const emailEnabled = await isEmailEnabled();
      
      console.log('Email enabled check:', emailEnabled);
      console.log('RESEND_ENABLED:', process.env.RESEND_ENABLED);
      console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
      
      if (emailEnabled) {
        console.log('Attempting to send invitation email to:', email);
        emailSent = await sendInvitationEmail(
          email,
          organisation?.name || 'the organisation',
          role,
          createdInvitation.id,
          user.name || undefined
        );
        
        console.log('Email send result:', emailSent);
        
        if (!emailSent) {
          emailError = 'Email sending failed. Please verify RESEND_API_KEY and RESEND_ENABLED settings.';
          console.error('Failed to send invitation email. Check Resend configuration.');
        }
      } else {
        emailError = 'Email is not enabled. Set RESEND_ENABLED=true and configure RESEND_API_KEY in your environment variables.';
        console.warn('Email is not enabled. Invitation created but no email sent.');
        console.warn('Current env vars - RESEND_ENABLED:', process.env.RESEND_ENABLED, 'RESEND_API_KEY:', process.env.RESEND_API_KEY ? 'Set' : 'Not set');
      }
    } catch (error) {
      emailError = `Email error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('Error sending invitation email:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
    }

    // Always return success since invitation was created, but include email status
    if (emailSent) {
      return { success: 'Invitation sent successfully' };
    } else {
      return { 
        success: `Invitation created successfully. ${emailError || 'Email could not be sent.'}`
      };
    }
  }
);

const updateOrganisationNameSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters')
});

export const updateOrganisationName = validatedActionWithUser(
  updateOrganisationNameSchema,
  async (data, _, user) => {
    const { name } = data;

    // Check that the user is an organization owner
    if (user.role !== 'owner') {
      return { error: 'Only organisation owners can update the organisation name' };
    }

    const userWithOrganisation = await getUserWithOrganisation(user.id);

    if (!userWithOrganisation?.organisationId) {
      return { error: 'User is not part of an organisation' };
    }

    // Update the organisation name
    await db
      .update(organisations)
      .set({
        name,
        updatedAt: new Date()
      })
      .where(eq(organisations.id, userWithOrganisation.organisationId));

    await logActivity(
      userWithOrganisation.organisationId,
      user.id,
      ActivityType.UPDATE_ACCOUNT
    );

    return { success: 'Organisation name updated successfully', name };
  }
);
