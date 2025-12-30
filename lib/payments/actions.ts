'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withOrganisation } from '@/lib/auth/middleware';

export const checkoutAction = withOrganisation(async (formData, organisation) => {
  const priceId = formData.get('priceId') as string;
  await createCheckoutSession({ organisation: organisation, priceId });
});

export const customerPortalAction = withOrganisation(async (_, organisation) => {
  const portalSession = await createCustomerPortalSession(organisation);
  redirect(portalSession.url);
});
