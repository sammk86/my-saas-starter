# Next.js SaaS Starter

This is a starter template for building a SaaS application using **Next.js** with support for authentication, Stripe integration for payments, and a dashboard for logged-in users.

**Demo: [https://next-saas-start.vercel.app/](https://next-saas-start.vercel.app/)**

## Features

- Marketing landing page (`/`) with animated Terminal element
- Pricing page (`/pricing`) which connects to Stripe Checkout
- Dashboard pages with CRUD operations on users/teams
- Basic RBAC with Owner and Member roles
- Subscription management with Stripe Customer Portal
- Email/password authentication with NextAuth.js (Auth.js)
- Account confirmation system with admin approval workflow
- Global middleware to protect logged-in routes
- Local middleware to protect Server Actions or validate Zod schemas
- Activity logging system for any user events

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Authentication**: [NextAuth.js v5](https://next-auth.js.org/) (Auth.js)
- **Payments**: [Stripe](https://stripe.com/)
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

```bash
git clone https://github.com/nextjs/saas-starter
cd saas-starter
pnpm install
```

## Running Locally

### Install Stripe CLI

First, install the Stripe CLI. On macOS with Homebrew:

```bash
brew install stripe/stripe-cli/stripe
```

For other platforms, see the [Stripe CLI installation guide](https://docs.stripe.com/stripe-cli).

Then log in to your Stripe account:

```bash
stripe login
```

Use the included setup script to create your `.env` file:

```bash
pnpm db:setup
```

Run the database migrations and seed the database with a default user and team:

```bash
pnpm db:migrate
pnpm db:seed
```

This will create the following user and team:

- User: `test@test.com`
- Password: `admin123`
- Status: Confirmed (can access dashboard immediately)

You can also create new users through the `/sign-up` route. New users will require admin confirmation before they can access the dashboard portal.

Finally, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

You can listen for Stripe webhooks locally through their CLI to handle subscription change events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Authentication & Account Confirmation

This starter uses NextAuth.js v5 (Auth.js) for authentication with a credentials provider. The authentication system includes:

- **Email/Password Authentication**: Users can sign up and sign in with email and password
- **Account Confirmation**: New users are created with `isConfirmed: false` and must be approved by an admin before accessing the dashboard
- **Protected Routes**: Middleware automatically redirects unconfirmed users to the confirmation page
- **Admin Approval**: Team owners can confirm users via the `/api/admin/confirm-user` endpoint

### User Flow

1. **Sign Up**: New users create an account and are redirected to `/confirmation`
2. **Pending Confirmation**: Users see a message that their account is awaiting admin approval
3. **Admin Confirmation**: A team owner calls the admin API to set `isConfirmed: true`
4. **Access Granted**: Once confirmed, users can access all dashboard features

### Confirming Users (Admin)

To confirm a user programmatically, make a POST request to `/api/admin/confirm-user`:

```bash
curl -X POST http://localhost:3000/api/admin/confirm-user \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

Note: Only authenticated users with the `owner` role can confirm other users.

## Testing Payments

To test Stripe payments, use the following test card details:

- Card Number: `4242 4242 4242 4242`
- Expiration: Any future date
- CVC: Any 3-digit number

## Going to Production

When you're ready to deploy your SaaS application to production, follow these steps:

### Set up a production Stripe webhook

1. Go to the Stripe Dashboard and create a new webhook for your production environment.
2. Set the endpoint URL to your production API route (e.g., `https://yourdomain.com/api/stripe/webhook`).
3. Select the events you want to listen for (e.g., `checkout.session.completed`, `customer.subscription.updated`).

### Deploy to Vercel

1. Push your code to a GitHub repository.
2. Connect your repository to [Vercel](https://vercel.com/) and deploy it.
3. Follow the Vercel deployment process, which will guide you through setting up your project.

### Add environment variables

In your Vercel project settings (or during deployment), add all the necessary environment variables. Make sure to update the values for the production environment, including:

1. `BASE_URL`: Set this to your production domain.
2. `STRIPE_SECRET_KEY`: Use your Stripe secret key for the production environment.
3. `STRIPE_WEBHOOK_SECRET`: Use the webhook secret from the production webhook you created in step 1.
4. `POSTGRES_URL`: Set this to your production database URL.
5. `AUTH_SECRET`: Set this to a random string. `openssl rand -base64 32` will generate one.

## Other Templates

While this template is intentionally minimal and to be used as a learning resource, there are other paid versions in the community which are more full-featured:

- https://achromatic.dev
- https://shipfa.st
- https://makerkit.dev
- https://zerotoshipped.com
- https://turbostarter.dev
