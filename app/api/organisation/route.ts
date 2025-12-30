import { getOrganisationForUser } from '@/lib/db/queries';

export async function GET() {
  const organisation = await getOrganisationForUser();
  return Response.json(organisation);
}

