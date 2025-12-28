import { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { comparePasswords } from './session';

export const authConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          // Lazy load database connection (only called during sign-in, not in middleware)
          // This avoids Edge Runtime issues since authorize is only called in Node.js runtime
          const { db } = await import('@/lib/db/drizzle');
          const { users } = await import('@/lib/db/schema');
          const { eq, and, isNull } = await import('drizzle-orm');

          const userResults = await db
            .select()
            .from(users)
            .where(
              and(
                eq(users.email, credentials.email as string),
                isNull(users.deletedAt)
              )
            )
            .limit(1);

          if (userResults.length === 0) {
            return null;
          }

          const user = userResults[0];

          const isPasswordValid = await comparePasswords(
            credentials.password as string,
            user.passwordHash
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            isConfirmed: user.isConfirmed,
          };
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isConfirmed = (user as any).isConfirmed;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isConfirmed = token.isConfirmed as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
    error: '/sign-in',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

