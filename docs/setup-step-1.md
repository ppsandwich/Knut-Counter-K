# Step 1: Auth And Database Setup

Knut Counter uses Supabase Auth for user sessions and Supabase Postgres for app data. The app never connects directly to Postgres. The mobile/web client signs in with Supabase, then sends the Supabase access token to Vercel serverless API routes as a bearer token.

## 1. Create Supabase Project

Create a Supabase project and enable email/password auth.

Copy these values:

- Project URL
- Anon public key
- Service role key
- Postgres connection string

Use the Supabase pooled connection string for Vercel if available.

## 2. Create Local Env

Create `.env` from `.env.example`:

```sh
cp .env.example .env
```

Fill:

```sh
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"

SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
DATABASE_URL="postgresql://..."
CREDENTIAL_ENCRYPTION_KEY="generate-a-long-random-secret"
```

Generate a local encryption key with:

```sh
openssl rand -base64 32
```

## 3. Create Tables

Generate a migration:

```sh
pnpm db:generate
```

Apply migrations:

```sh
pnpm db:migrate
```

For early development only, `pnpm db:push` is also available.

## 4. Seed Providers

```sh
pnpm db:seed:providers
```

This loads `packages/providers/registry/provider_registry.yml` into `provider_registry`, which is required before provider accounts can be created.

## 5. Local Runtime

For auth-only UI work:

```sh
pnpm web
```

For account settings and provider saves, the Expo app needs the Vercel API routes running too. Use `EXPO_PUBLIC_API_BASE_URL` to point the app at your local or deployed API origin.

## 6. Vercel Env Vars

Set these in Vercel:

```sh
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
CREDENTIAL_ENCRYPTION_KEY
```

Set these for the Expo web build:

```sh
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_API_BASE_URL
```

## 7. Optional Cron Jobs

The default deploy is Hobby-plan friendly and does not include Vercel Cron.

When cron is available, add these jobs in Vercel or restore them in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/pricing/refresh", "schedule": "0 3 * * *" },
    { "path": "/api/providers/sync", "schedule": "0 * * * *" },
    { "path": "/api/alerts/evaluate", "schedule": "*/30 * * * *" }
  ]
}
```

## 8. Smoke Test

1. Open `/settings`.
2. Open Account.
3. Create an account or sign in.
4. Save account settings.
5. Go to Providers, Add, save a manual provider.
6. Save an API-key provider and confirm the key is not returned in the API response.
