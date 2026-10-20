# CLAUDE.md

Internal Next.js app for tracking creator retainer collaborations. Read `docs/PRODUCT_SPEC.md` before adding features: it records the decisions (own database as source of truth, payments are recorded not sent, everyone is admin).

## Layout
- `prisma/schema.prisma`: data model (Brand, Creator, Retainer, Video, Payment, User). Money is whole USD (`Int`) on brands/retainers and `Float` on payments.
- `src/lib/domain.ts`: all business rules (budget math, payment split, pace, "Waiting on you" queue). Pure functions with tests in `domain.test.ts`. Put new rules here, not in pages.
- `src/lib/parse.ts`: cleaning messy text (handles, money, pasted video lines).
- `src/app/actions.ts`: every mutation as a server action, validated with zod, each starting with `requireSession()`.
- `src/app/(app)/…`: server-rendered pages. Plain HTML forms posting to server actions; client components only where needed (`nav`, `login-form`, `confirm-button`).
- `scripts/import-sheet.ts`: one-off importer for the old Google Sheets tracker.

## Rules
- Keep it simple: no new dependencies or services unless the spec asks for them.
- Never commit real tracker data (`*.xlsx`, `*.csv`); it holds creator contact and payout details.
- After changing the schema: `npx prisma migrate dev --name <change>` and commit the migration.
- Before pushing: `npm run typecheck && npm test && npm run build`.
