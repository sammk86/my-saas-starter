import { desc, and, eq, isNull } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, organisationMembers, organisations, users, invitations } from './schema';
import { auth } from '@/lib/auth';

export async function getUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const userId = parseInt(session.user.id as string, 10);
  if (isNaN(userId)) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getOrganisationByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(organisations)
    .where(eq(organisations.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateOrganisationSubscription(
  organisationId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(organisations)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(organisations.id, organisationId));
}

export async function getUserWithOrganisation(userId: number) {
  const result = await db
    .select({
      user: users,
      organisationId: organisationMembers.organisationId
    })
    .from(users)
    .leftJoin(organisationMembers, eq(users.id, organisationMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getOrganisationForUser() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.organisationMembers.findFirst({
    where: eq(organisationMembers.userId, user.id),
    with: {
      organisation: {
        with: {
          organisationMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          invitations: {
            where: eq(invitations.status, 'pending'),
            columns: {
              id: true,
              email: true,
              role: true,
              invitedAt: true,
              status: true
            }
          }
        }
      }
    }
  });

  return result?.organisation || null;
}

export async function getUserOrganisationRole() {
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.organisationMembers.findFirst({
    where: eq(organisationMembers.userId, user.id),
    columns: {
      role: true
    }
  });

  return result?.role || null;
}
