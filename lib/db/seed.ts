import 'dotenv/config';
import { db } from './drizzle';
import { users, organisations, organisationMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

async function createStripeProducts() {
  try {
    // Lazy import stripe after env vars are loaded
    const { isStripeEnabled, getStripeClient } = await import('../payments/stripe');

    if (!isStripeEnabled()) {
      console.log('Skipping Stripe products creation: Stripe is not enabled (STRIPE_ENABLED is not true or STRIPE_SECRET_KEY not set)');
      return;
    }

    console.log('Creating Stripe products and prices...');

    const baseProduct = await getStripeClient().products.create({
      name: 'Base',
      description: 'Base subscription plan',
    });

    await getStripeClient().prices.create({
      product: baseProduct.id,
      unit_amount: 800, // $8 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 7,
      },
    });

    const plusProduct = await getStripeClient().products.create({
      name: 'Plus',
      description: 'Plus subscription plan',
    });

    await getStripeClient().prices.create({
      product: plusProduct.id,
      unit_amount: 1200, // $12 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 7,
      },
    });

    console.log('Stripe products and prices created successfully.');
  } catch (error) {
    console.warn('Failed to create Stripe products:', error instanceof Error ? error.message : 'Unknown error');
    console.warn('Continuing seed process without Stripe products...');
  }
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';

  // Check if user already exists
  let existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user;
  if (existingUser.length > 0) {
    user = existingUser[0];
    console.log('User already exists, using existing user.');
  } else {
    const passwordHash = await hashPassword(password);
    [user] = await db
      .insert(users)
      .values([
        {
          email: email,
          passwordHash: passwordHash,
          role: "owner",
          isConfirmed: true, // Set to true for test user
        },
      ])
      .returning();
    console.log('Initial user created.');
  }

  // Check if user is already part of an organisation
  const existingMember = await db
    .select()
    .from(organisationMembers)
    .where(eq(organisationMembers.userId, user.id))
    .limit(1);

  if (existingMember.length === 0) {
    // Check if organisation already exists
    let existingOrg = await db
      .select()
      .from(organisations)
      .where(eq(organisations.name, 'Test Organisation'))
      .limit(1);

    let organisation;
    if (existingOrg.length > 0) {
      organisation = existingOrg[0];
      console.log('Organisation already exists, using existing organisation.');
    } else {
      [organisation] = await db
        .insert(organisations)
        .values({
          name: 'Test Organisation',
        })
        .returning();
      console.log('Test organisation created.');
    }

    await db.insert(organisationMembers).values({
      organisationId: organisation.id,
      userId: user.id,
      role: 'owner',
    });
    console.log('User added to organisation.');
  } else {
    console.log('User is already part of an organisation.');
  }

  await createStripeProducts();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
