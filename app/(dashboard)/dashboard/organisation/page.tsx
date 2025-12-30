import { redirect } from 'next/navigation';
import { getUser, getUserOrganisationRole } from '@/lib/db/queries';
import OrganisationPageClient from './organisation-page-client';

export default async function OrganisationPage() {
  const user = await getUser();
  
  if (!user) {
    redirect('/sign-in');
  }

  const organisationRole = await getUserOrganisationRole();
  
  if (organisationRole !== 'owner') {
    redirect('/dashboard');
  }

  return <OrganisationPageClient />;
}

