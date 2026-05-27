# Knut Counter

An AI usage cost tracking and optimization tool. Track spending across multiple AI providers, benchmark models, and get intelligent recommendations for the best model based on cost, quality, and budget constraints.

## Features

- **Unified Dashboard** — Monthly spend tracking, projected costs, token usage aggregation, and per-provider sparkline charts across all connected AI providers.
- **Model Recommendations** — Task-based model suggestions with a quality-vs-cost slider. Returns cheapest, best quality, and best balance picks using benchmark-weighted scoring.
- **Models Table** — Top 100 models ranked by weekly usage with dual benchmark sources (Artificial Analysis and BenchLM), sortable by cost, intelligence, coding ability, and speed.
- **Multi-Provider Support** — 43+ AI providers via API key, manual tracking, or CSV/JSON import. Includes connectors for OpenAI, Anthropic, Google Gemini, OpenRouter, xAI, DeepSeek, and more.
- **Alerts** — Budget threshold alerts (50/75/90/100%), stale sync detection, unusual spend warnings, and missing pricing data notifications.
- **Currency Conversion** — Real-time USD exchange rates with 50+ supported currencies.
- **Credential Security** — AES-256-GCM encrypted API key storage. Keys are never returned in API responses.
- **Data Export** — Full account data export as JSON.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native 0.79, React 19, Expo SDK 53, expo-router |
| Web | react-native-web, Metro bundler, PWA support |
| Backend | Vercel Serverless Functions (`@vercel/node`) |
| Auth | Supabase Auth (email/password, JWT bearer tokens) |
| Database | PostgreSQL (Supabase), Drizzle ORM 0.43 |
| State | Zustand 5 |
| Monorepo | pnpm 11 workspaces, Turborepo 2.5 |
| Language | TypeScript 5.8 (strict mode, ES2022) |
| Build | Expo CLI, Vercel deployments |

### External Data Sources

| Source | Purpose |
|--------|---------|
| OpenRouter API | Model pricing, weekly usage, credit balance |
| Artificial Analysis API | Intelligence/coding/math benchmarks, pricing |
| LiteLLM (GitHub JSON) | Pricing catalogue |
| models.dev API | Pricing catalogue |
| BenchLM API | Leaderboard benchmarks |
| Open Exchange Rates / Frankfurter | Currency conversion |

## Project Structure

```
├── apps/mobile/           # Expo/React Native app (web + mobile)
│   ├── app/               # File-based routes (expo-router)
│   ├── components/        # App-specific components
│   ├── hooks/             # React hooks (auth, data fetching)
│   └── lib/               # API client, Supabase init, utilities
├── api/                   # Vercel serverless API routes
│   ├── account/           # User profile, settings, export
│   ├── alerts/            # Alert evaluation and management
│   ├── dashboard/         # Dashboard data aggregation
│   ├── models/            # Popular models + pricing refresh
│   ├── provider-accounts/ # Provider CRUD + credential management
│   ├── providers/         # Registry listing + data sync
│   ├── recommend/         # Model recommendation engine
│   └── import/            # CSV/JSON/generation import
├── packages/
│   ├── db/                # Drizzle schema, queries, migrations, encryption
│   ├── pricing/           # Multi-source pricing fetch + normalization
│   ├── providers/         # Provider connectors + registry YAML
│   ├── shared/            # Types, formatters, currencies, mock data
│   └── ui/                # Shared React Native UI components
├── docs/                  # Setup guides
└── screenshots/           # App screenshots
```

## Installation

### Prerequisites

- **Node.js** >= 18
- **pnpm** 11.x (`corepack enable && corepack prepare pnpm@11.1.3 --activate`)
- A **Supabase** project (free tier works)

### 1. Clone and Install

```sh
git clone https://github.com/your-org/knut-counter.git
cd knut-counter
pnpm install
```

### 2. Supabase Setup

Create a Supabase project and enable email/password authentication. Collect:

- Project URL
- Anon public key
- Service role key
- Pooled Postgres connection string

### 3. Environment Variables

```sh
cp .env.example .env
```

Fill in all values:

```sh
# Client-side (EXPO_PUBLIC_ prefixed vars are embedded in the web/mobile bundle)
EXPO_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
EXPO_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"

# Server-side (used by Vercel API routes)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
DATABASE_URL="postgresql://user:pass@host:5432/db?pgbouncer=true"
CREDENTIAL_ENCRYPTION_KEY="generate-with-openssl-rand-base64-32"
PRICING_REFRESH_SECRET="optional-random-secret"
ARTIFICIAL_ANALYSIS_API_KEY="optional-aa-api-key"
```

Generate the encryption key:

```sh
openssl rand -base64 32
```

### 4. Database Migrations

```sh
pnpm db:generate    # Generate Drizzle migration files
pnpm db:migrate     # Apply migrations to Supabase Postgres
```

For early development, `pnpm db:push` pushes schema directly without migration files.

### 5. Seed Provider Registry

```sh
pnpm db:seed:providers
```

Loads 43+ AI providers from `packages/providers/registry/provider_registry.yml` into the `provider_registry` table. Required before creating provider accounts.

### 6. Start Development

```sh
pnpm web            # Start Expo web server
pnpm dev            # Start Expo dev server (mobile + web)
```

Set `EXPO_PUBLIC_API_BASE_URL` to your deployed API origin for full functionality (account settings, provider saves, data sync).

## Configuration

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (client-side) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client-side) |
| `EXPO_PUBLIC_API_BASE_URL` | Yes | API origin for client HTTP calls |
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for JWT validation |
| `DATABASE_URL` | Yes | PostgreSQL connection string (use pooled) |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | AES-256-GCM key for encrypting API credentials |
| `PRICING_REFRESH_SECRET` | No | Shared secret to protect pricing refresh endpoint |
| `ARTIFICIAL_ANALYSIS_API_KEY` | No | AA API key for model benchmarks and pricing |

### NPM Scripts

| Script | Description |
|--------|-------------|
| `pnpm web` | Start Expo web dev server |
| `pnpm dev` | Start Expo dev server (all platforms) |
| `pnpm build` | Export Expo web build for Vercel |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate` | Apply migrations to database |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:seed:providers` | Seed provider registry from YAML |

### Workspace Aliases

| Alias | Package |
|-------|---------|
| `@knut/db` | `packages/db` |
| `@knut/pricing` | `packages/pricing` |
| `@knut/providers` | `packages/providers` |
| `@knut/shared` | `packages/shared` |
| `@knut/ui` | `packages/ui` |

## Deployment

### Vercel

1. Connect the repo to Vercel.
2. Set all environment variables from the table above in Vercel project settings.
3. The build command is `pnpm build` (exports the Expo web build).
4. `vercel.json` handles SPA routing, cache headers, and API rewrites.

### Optional Cron Jobs

On Vercel Pro, enable these cron jobs for automated data collection:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `0 3 * * *` (daily 3am) | `/api/pricing/refresh` | Refresh pricing from all sources |
| `0 * * * *` (hourly) | `/api/providers/sync` | Sync usage data from connected providers |
| `*/30 * * * *` (every 30 min) | `/api/alerts/evaluate` | Evaluate and fire budget/stale alerts |

## Database Schema

The database uses 8 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `users` | User profiles, timezone, currency preference, monthly budget |
| `provider_registry` | Master list of 43+ AI providers and their capabilities |
| `provider_accounts` | Per-user connected providers with encrypted API keys |
| `usage_records` | Individual usage events with tokens, cost, model, and confidence |
| `usage_caps` | Credit balance and usage cap tracking per provider |
| `pricing_snapshots` | Historical pricing from multiple sources with confidence scores |
| `model_benchmark_snapshots` | Intelligence, coding, math, and speed benchmarks |
| `alerts` | Budget, stale sync, and anomaly alerts with read/snooze state |
| `import_jobs` | CSV/JSON import job tracking |

## Security

- API keys are encrypted at rest using AES-256-GCM with a scrypt-derived key.
- Authenticated requests validate the Supabase JWT via the service role key server-side.
- API responses never include raw credentials — only a `hasCredentials: boolean` flag.
- All API routes are scoped to the authenticated user's `user_id`.

## License

Private — not yet licensed for public distribution.
