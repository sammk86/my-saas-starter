import { getUserOrganisationRole } from '@/lib/db/queries';

export async function GET() {
  const role = await getUserOrganisationRole();
  return Response.json({ role });
}

