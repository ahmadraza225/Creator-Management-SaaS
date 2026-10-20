# Creator Retainers

Internal tool for the content strategy team to track every retainer collaboration: brand budgets, creator pipeline, delivered videos and Spark codes, and the upfront/final payments clients send to creators.

It replaces the "Creators" tab and the per-brand tabs of the Google Sheets tracker. See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) for what it does and why.

## Screens

| Screen | What it answers |
|---|---|
| **Waiting on you** | What is blocked on us right now (contracts to send, payout details to collect, samples to ship, creators behind on videos, final payments due, missing Spark codes) |
| **Brands & budgets** | Per brand, per month: budget, allocated, paid, remaining, usage, videos delivered vs owed |
| **Retainers** | Every creator deal across brands, filterable by brand and stage |
| **Retainer page** | One creator × one brand: stage, payments, videos + Spark codes, deal terms |
| **Creators** | Every creator, their payout details and all their deals |
| **Payments** | All upfront/final/bonus payments, quick status updates, CSV export |

## Run it locally

Needs Node 20+ and a Postgres database.

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:migrate            # creates the tables
npm run db:seed               # creates the admin login (add `-- --demo` for made-up sample data)
npm run dev                   # http://localhost:3000
```

## Import the old Google Sheet

1. In Google Sheets: File → Download → Microsoft Excel (.xlsx).
2. Preview first (nothing is saved):
   ```bash
   npm run import:sheet -- ~/Downloads/tracker.xlsx --dry-run
   ```
3. Read the "Check these" list it prints, fix anything you want in the sheet, then run it without `--dry-run`.

The importer recognises tabs by their headers (brands tab, creators tab, one tab per brand with "Video link"). It never reads any other tab, including credentials. Running it twice does not create duplicates. **Do not commit the .xlsx**: it contains creator contact and payout details (`.gitignore` blocks `*.xlsx` and `*.csv`).

## Deploy (about 15 minutes)

1. Create a free Postgres database on [Neon](https://neon.tech) or [Supabase](https://supabase.com) and copy its connection string.
2. Import this repo on [Vercel](https://vercel.com). Set environment variables `DATABASE_URL` and `AUTH_SECRET` (`openssl rand -base64 32`).
3. Set the build command to `prisma migrate deploy && npm run build`.
4. From your laptop, with `.env` pointing at the hosted database: `npm run db:seed`, then `npm run import:sheet -- tracker.xlsx`.

## Checks before every change

```bash
npm run typecheck && npm test && npm run build
```

## Tech

Next.js 15 (App Router, server actions) · TypeScript · Prisma + Postgres · Tailwind CSS · Vitest. No external services required.
