import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { verifyActivationToken } from '@/lib/email/resend';
import { redirect } from 'next/navigation';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    redirect('/sign-in?error=invalid_token');
  }

  const tokenData = await verifyActivationToken(token);

  if (!tokenData) {
    redirect('/sign-in?error=invalid_token');
  }

  const { userId, email } = tokenData;

  // Verify the user exists and email matches
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.email !== email) {
    redirect('/sign-in?error=invalid_token');
  }

  // If already confirmed, redirect to sign-in with success message
  if (user.isConfirmed) {
    redirect('/sign-in?activated=true');
  }

  // Activate the user
  await db
    .update(users)
    .set({ isConfirmed: true })
    .where(eq(users.id, userId));

  redirect('/sign-in?activated=true');
}

