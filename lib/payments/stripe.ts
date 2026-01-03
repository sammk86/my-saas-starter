import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Organisation } from '@/lib/db/schema';
import {
  getOrganisationByStripeCustomerId,
  getUser,
  updateOrganisationSubscription
} from '@/lib/db/queries';

const stripeEnabled = process.env.STRIPE_ENABLED === 'true';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripeClient: Stripe | null = null;

export function isStripeEnabled(): boolean {
  return stripeEnabled && !!stripeSecretKey;
}

function getStripeClient(): Stripe {
  if (!isStripeEnabled()) {
    throw new Error('Stripe is not enabled. Please set STRIPE_ENABLED=true and STRIPE_SECRET_KEY in your environment variables.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey!, {
      apiVersion: '2025-04-30.basil'
    });
  }

  return stripeClient;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripeClient()[prop as keyof Stripe];
  }
});

export async function createCheckoutSession({
  organisation,
  priceId
}: {
  organisation: Organisation | null;
  priceId: string;
}) {
  if (!isStripeEnabled()) {
    redirect('/contact?message=pricing');
  }

  const user = await getUser();

  if (!organisation || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const session = await getStripeClient().checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: organisation.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(organisation: Organisation) {
  if (!isStripeEnabled()) {
    redirect('/contact?message=subscription');
  }

  if (!organisation.stripeCustomerId || !organisation.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await getStripeClient().billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await getStripeClient().products.retrieve(organisation.stripeProductId);
    if (!product.active) {
      throw new Error("Organisation's product is not active in Stripe");
    }

    const prices = await getStripeClient().prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the organisation's product");
    }

    configuration = await getStripeClient().billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return getStripeClient().billingPortal.sessions.create({
    customer: organisation.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  if (!isStripeEnabled()) {
    console.warn('Stripe webhook received but Stripe is disabled');
    return;
  }

  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const organisation = await getOrganisationByStripeCustomerId(customerId);

  if (!organisation) {
    console.error('Organisation not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    await updateOrganisationSubscription(organisation.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      subscriptionStatus: status
    });
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateOrganisationSubscription(organisation.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });
  }
}

export async function getStripePrices() {
  if (!isStripeEnabled()) {
    return [];
  }

  const prices = await getStripeClient().prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  if (!isStripeEnabled()) {
    return [];
  }

  const products = await getStripeClient().products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}
