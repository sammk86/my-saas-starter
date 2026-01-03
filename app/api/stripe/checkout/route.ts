import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, organisations, organisationMembers } from '@/lib/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { isStripeEnabled, getStripeClient } from '@/lib/payments/stripe';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  if (!isStripeEnabled()) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const session = await getStripeClient().checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription'],
    });

    if (!session.customer || typeof session.customer === 'string') {
      throw new Error('Invalid customer data from Stripe.');
    }

    const customerId = session.customer.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    if (!subscriptionId) {
      throw new Error('No subscription found for this session.');
    }

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });

    const plan = subscription.items.data[0]?.price;

    if (!plan) {
      throw new Error('No plan found for this subscription.');
    }

    const productId = (plan.product as Stripe.Product).id;

    if (!productId) {
      throw new Error('No product ID found for this subscription.');
    }

    const userId = session.client_reference_id;
    if (!userId) {
      throw new Error("No user ID found in session's client_reference_id.");
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found in database.');
    }

    const userOrganisation = await db
      .select({
        organisationId: organisationMembers.organisationId,
      })
      .from(organisationMembers)
      .where(eq(organisationMembers.userId, user[0].id))
      .limit(1);

    if (userOrganisation.length === 0) {
      throw new Error('User is not associated with any organisation.');
    }

    await db
      .update(organisations)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeProductId: productId,
        planName: (plan.product as Stripe.Product).name,
        subscriptionStatus: subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(organisations.id, userOrganisation[0].organisationId));

    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
