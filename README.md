# Military Parade State Management System

Internal Next.js + Convex app for managing parade-state records against a read-only Google Sheets personnel source.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Convex
- Convex + Better Auth

## Local setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` into `.env.local` and fill in your local values:

   ```env
   CONVEX_DEPLOYMENT=
   NEXT_PUBLIC_CONVEX_URL=
   NEXT_PUBLIC_CONVEX_SITE_URL=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   GOOGLE_SHEETS_API_KEY=
   GOOGLE_SHEETS_SPREADSHEET_ID=1bu2hgyqID8XNuH7iCzR5dtb1JRzzl5KsclODcqrUogU
   GOOGLE_SHEETS_RANGE=Personnel!A:D
   ```

3. Set required Convex deployment env vars:

   - `SITE_URL=http://localhost:3000`
   - `BETTER_AUTH_SECRET=<generated secret>`

4. Run the app:

   ```bash
   pnpm dev
   ```

   This starts both the Next.js frontend and `convex dev`.

## First admin bootstrap

1. Sign up through `/sign-up`.
2. Open the Convex dashboard.
3. Edit the new `appUsers` row manually:
   - set `role` to `admin`
   - set `approvalStatus` to `approved`
4. Sign in again and use `/admin/users` for all later approvals.

## Behavior notes

- Personnel is fetched only from the public Google Sheet through `GET /api/personnel`.
- The app never creates, edits, or deletes personnel rows.
- Parade-state records store personnel details as immutable snapshots.
- Overlapping active records are allowed and grouped in the current-state view.

## Commands

- `pnpm dev` starts Next.js and Convex together.
- `pnpm lint` runs ESLint.
- `pnpm typecheck` runs TypeScript type checking.
