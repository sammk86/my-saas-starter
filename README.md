# Next.js SaaS Starter

This is a starter template for building a SaaS application using **Next.js** with support for authentication, Stripe integration for payments, and a dashboard for logged-in users.

**Demo: [https://next-saas-start.vercel.app/](https://next-saas-start.vercel.app/)**

## Features

- Marketing landing page (`/`) with animated Terminal element
- Pricing page (`/pricing`) with Stripe Checkout integration (optional via feature flag)
- Settings page with tabs for General, Organisation, Activity, and Security
- Basic RBAC with Owner and Member roles
- Subscription management with Stripe Customer Portal (optional via feature flag)
- Email/password authentication with NextAuth.js (Auth.js)
- Account confirmation system with admin approval workflow
- Email activation via Resend (optional via feature flag) - users receive activation emails on signup
- Contact form with email notifications
- Global middleware to protect logged-in routes
- Local middleware to protect Server Actions or validate Zod schemas
- Activity logging system for any user events
- Feature flags for Stripe and Resend to enable/disable services

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Authentication**: [NextAuth.js v5](https://next-auth.js.org/) (Auth.js)
- **Payments**: [Stripe](https://stripe.com/) (optional via feature flag)
- **Email**: [Resend](https://resend.com/) (optional via feature flag)
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

Run the database migrations and seed the database with a default user and organisation:

```bash
pnpm db:migrate
pnpm db:seed
```

This will create the following user and organisation:

- User: `test@test.com`
- Password: `admin123`
- Status: Confirmed (can access dashboard immediately)

You can also create new users through the `/sign-up` route. New users will require admin confirmation before they can access the dashboard portal (unless email activation is enabled - see Email Setup section below).

Finally, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

You can listen for Stripe webhooks locally through their CLI to handle subscription change events:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Feature Flags

This starter includes feature flags to enable/disable Stripe and Resend services. This allows the application to operate without these services when disabled.

### Stripe Feature Flag (`STRIPE_ENABLED`)

When `STRIPE_ENABLED=false` (default):
- Stripe checkout is disabled
- Plus plan users see a "Contact Us" message instead of checkout button
- Customer portal access is blocked
- Pricing page gracefully handles missing Stripe data

When `STRIPE_ENABLED=true`:
- Full Stripe integration is enabled
- Users can subscribe via Stripe Checkout
- Customer portal is available for subscription management

### Resend Feature Flag (`RESEND_ENABLED`)

When `RESEND_ENABLED=false` (default):
- Activation emails are not sent
- Confirmation page shows "awaiting admin approval" message
- Admins must confirm users via `/api/admin/confirm-user` endpoint or database

When `RESEND_ENABLED=true`:
- Activation emails are sent to new users
- Users can activate their account via email link
- Contact form emails are enabled

## Email Setup (Resend) - Optional

This starter includes optional email functionality powered by [Resend](https://resend.com/). Email features are **disabled by default** and must be explicitly enabled via the `RESEND_ENABLED` feature flag.

### Features

- **Email Activation**: Send activation emails to new users on signup
- **Contact Form**: Contact page (`/contact`) that sends emails to a configured address

### Setup Instructions

1. **Get a Resend API Key**:
   - Sign up at [resend.com](https://resend.com/)
   - Go to [API Keys](https://resend.com/api-keys) and create a new API key
   - Copy your API key (starts with `re_`)

2. **Verify Your Domain** (for production):
   - In Resend dashboard, add and verify your domain
   - This is required for sending emails from your domain
   - For development, you can use Resend's test domain

3. **Configure Environment Variables**:
   Add these to your `.env` file:
   ```env
   RESEND_API_KEY=re_xxxxx
   RESEND_ENABLED=true
   RESEND_FROM_EMAIL=noreply@yourdomain.com
   CONTACT_EMAIL=contact@yourdomain.com
   ```

   - `RESEND_API_KEY`: Your Resend API key
   - `RESEND_ENABLED`: Set to `true` to enable email features (default: `false`)
   - `RESEND_FROM_EMAIL`: Email address to send from (must be verified in Resend)
   - `CONTACT_EMAIL`: Email address to receive contact form submissions

4. **Run Setup Script** (optional):
   The setup script (`pnpm db:setup`) will prompt you to configure Resend during setup.

### Email Activation Flow

When `RESEND_ENABLED=true`:

1. **Sign Up**: User creates an account
2. **Activation Email Sent**: User receives an email with an activation link
3. **Click Activation Link**: User clicks the link in the email
4. **Account Activated**: `isConfirmed` is set to `true` automatically
5. **Sign In**: User can now sign in and access the dashboard

**Note**: Email activation works independently from admin approval. You can use either method, or both:
- **Email Activation**: User clicks link in email → `isConfirmed: true`
- **Admin Approval**: Admin sets `isConfirmed: true` via database or API

### Contact Form

The contact form is available at `/contact` and allows users to send messages. When submitted:
- Email is sent to the address configured in `CONTACT_EMAIL`
- The email includes the sender's name, email, subject, and message
- Replies can be sent directly to the sender's email address

## Authentication & Account Confirmation

This starter uses NextAuth.js v5 (Auth.js) for authentication with a credentials provider. The authentication system includes:

- **Email/Password Authentication**: Users can sign up and sign in with email and password
- **Account Confirmation**: New users are created with `isConfirmed: false` and must be confirmed before accessing the dashboard
- **Protected Routes**: Middleware automatically redirects unconfirmed users to the confirmation page
- **Email Activation** (optional): Users can activate their account via email link (see Email Setup above)
- **Admin Approval**: Organisation owners can confirm users via the `/api/admin/confirm-user` endpoint or directly in the database

### User Flow

1. **Sign Up**: New users create an account and are redirected to `/confirmation`
2. **Confirmation**:
   - If email activation is enabled: User receives email and clicks activation link
   - If email activation is disabled: User sees message about admin approval
3. **Account Activated**: User's `isConfirmed` is set to `true` (via email link or admin)
4. **Access Granted**: Once confirmed, users can access all dashboard features

### Confirming Users (Admin)

To confirm a user programmatically, make a POST request to `/api/admin/confirm-user`:

```bash
curl -X POST http://localhost:3000/api/admin/confirm-user \
  -H "Content-Type: application/json" \
  -d '{"userId": 1}'
```

Note: Only authenticated users with the `owner` role can confirm other users.

Alternatively, you can update the `isConfirmed` field directly in the database.

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

**Required**:
1. `BASE_URL`: Set this to your production domain.
2. `POSTGRES_URL`: Set this to your production database URL.
3. `AUTH_SECRET`: Set this to a random string. `openssl rand -base64 32` will generate one.

**Stripe (Optional - controlled by feature flag)**:
4. `STRIPE_ENABLED`: Set to `true` to enable Stripe payment processing
5. `STRIPE_SECRET_KEY`: Use your Stripe secret key for the production environment (required if `STRIPE_ENABLED=true`)
6. `STRIPE_WEBHOOK_SECRET`: Use the webhook secret from the production webhook you created in step 1 (required if `STRIPE_ENABLED=true`)

**Email/Resend (Optional - controlled by feature flag)**:
7. `RESEND_ENABLED`: Set to `true` to enable email features
8. `RESEND_API_KEY`: Your Resend API key (required if `RESEND_ENABLED=true`)
9. `RESEND_FROM_EMAIL`: Verified email address to send from (required if `RESEND_ENABLED=true`)
10. `CONTACT_EMAIL`: Email address to receive contact form submissions (required if `RESEND_ENABLED=true`)

**Note**: See the `.env.example` file for a complete list of all environment variables.

## Other Templates

While this template is intentionally minimal and to be used as a learning resource, there are other paid versions in the community which are more full-featured:

- https://achromatic.dev
- https://shipfa.st
- https://makerkit.dev
- https://zerotoshipped.com
- https://turbostarter.dev
