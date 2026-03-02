# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (Next.js on port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint with Next.js core web vitals preset
- `npx prisma generate` — Regenerate Prisma client (also runs automatically on `npm install` via postinstall hook)
- `npx prisma db push` — Push schema changes to database
- No test framework is configured

## Architecture

This is a **coach-athlete management platform** built with Next.js 16 (App Router), Prisma, Supabase, and Clerk auth. Two user roles share the same app: **coaches** access `/dashboard/*` and **athletes** access `/athlete/[id]/*`.

### Role Separation

Authentication uses Clerk. Role is determined by email comparison against `NEXT_PUBLIC_ADMIN_EMAIL` / `ADMIN_EMAIL` env vars — the matching user gets coach access, everyone else is an athlete. This is checked in `src/app/dashboard/layout.tsx`.

### Data Layer

- **Prisma** is the ORM (`prisma/schema.prisma`). Singleton client in `src/lib/prisma.ts`.
- **Supabase** is used for PostgreSQL hosting (with pgBouncer pooling), file storage, and Realtime subscriptions. Client in `src/lib/supabase.ts`.
- `src/lib/storage.js` is a data-access layer with helper functions for athletes, programs, and logs.
- Complex data (weekly programming, exercise sets, readiness scores) is stored as JSON columns in Prisma models.

### Key Domain Models (prisma/schema.prisma)

Athlete → Program → Log (workout sessions). Athlete also has Reports, Readiness check-ins, and Messages. Programs store their week/session structure as JSON in the `weeks` field. Session IDs follow the format `programId_wX_dY` (week X, day Y).

### API Routes (`src/app/api/`)

RESTful routes under `/api/athletes`, `/api/programs`, `/api/logs`, `/api/messages`, `/api/exercises`, `/api/reports`, `/api/readiness`, `/api/assignments`. Programs support import via `/api/programs/import`.

### Major Components

- `src/components/program-builder/ProgramBuilder.tsx` — Complex program creation/editing (largest component)
- `src/components/athlete/ScheduleView.tsx` — Athlete workout schedule and logging
- `src/components/chat/ChatInterface.tsx` — Real-time messaging between coach and athlete
- `src/components/chat/CoachInbox.tsx` — Coach message inbox view
- `src/components/dashboard/AthleteCharts.tsx` — Performance analytics visualizations (Recharts)

### Analytics & Calculations

- `src/lib/analytics-engine.js` — Variation impact analysis, advanced reporting
- `src/lib/stress-index.js` — E1RM calculations, volume/intensity stress index
- `src/lib/exercise-db.js` — Exercise taxonomy and categorization database

### Rendering & UI Patterns

- Hybrid server/client components: server components fetch data, client components handle interactivity
- Dynamic imports for heavy components (e.g., StressMatrix)
- Tailwind CSS v4 with glass-morphism design, dark mode with cyan/blue accents, CSS custom properties for theming
- Media handling: iOS MOV files are preserved with original extension/MIME type; Supabase Storage for uploads

### Environment Variables

Required: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_ADMIN_EMAIL`, `ADMIN_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
