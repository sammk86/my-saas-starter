'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession, isStripeEnabled } from './stripe';
import { withOrganisation } from '@/lib/auth/middleware';

export const checkoutAction = withOrganisation(async (formData, organisation) => {
  if (!isStripeEnabled()) {
    redirect('/contact?message=pricing');
  }

  const priceId = formData.get('priceId') as string;
  await createCheckoutSession({ organisation: organisation, priceId });
});

export const customerPortalAction = withOrganisation(async (_, organisation) => {
  if (!isStripeEnabled()) {
    redirect('/contact?message=subscription');
  }

  const portalSession = await createCustomerPortalSession(organisation);
  redirect(portalSession.url);
});
