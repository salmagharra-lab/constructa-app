# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

CONSTRUCTA is an MVP for construction sites: geofenced attendance (check-in/out), daily tasks by
building / floor / unit / room, training videos, and closing a task with a mandatory photo (no
manager approval). Managers get a live dashboard (who is on site, hours, progress per area, photo
gallery) and can correct attendance.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS 4, next-intl, Supabase (Postgres + RLS,
Auth, Storage, Realtime). UI languages: Hebrew, Arabic (RTL) and Thai (LTR).

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # also type-checks
npx tsc --noEmit
```

Run `npm run lint` and `npm run build` before every commit. There is no test suite yet.

## Environment

- Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Without them the app shows a setup screen.
- **Never commit `.env.local` or any key.** Never put the Supabase `service_role` key in the code;
  the app only uses the anon key and relies on RLS.
- The database schema is in `supabase/migrations/0001_init.sql` (run it in the Supabase SQL editor).

## Structure

```
app/worker/                     worker mobile screens (check-in, today's tasks, task + photo)
app/manager/                    manager screens; projects/[id]/{setup,tasks,attendance}
app/manager/actions.ts          manager Server Actions (all writes from manager forms)
app/actions.ts                  shared actions (language, sign out)
components/                     UI components (worker/, manager/)
lib/supabase/                   browser + server clients, env
lib/time.ts                     site-timezone helpers (APP_TIMEZONE, default Asia/Jerusalem)
lib/locations.ts                location tree helpers
messages/{he,ar,th}.json        translations
supabase/migrations/            schema, RLS policies, RPCs, storage bucket
middleware.ts                   session refresh + redirect to /login
```

## Conventions

- **Security lives in the database.** Every table has RLS. Rules that must not be bypassed
  (radius check, photo required, attendance edits by managers only) are enforced in SQL RPCs
  (`check_in`, `check_out`, `complete_task`, `add_member_by_email`), not only in the UI.
  Schema changes go in a **new** migration file (`0002_...sql`); don't edit `0001_init.sql`
  once it has been applied.
- **Translations:** every user-facing string goes through next-intl. When adding a key, add it to
  all three files in `messages/` (he, ar, th) with the same structure.
- **RTL:** use logical Tailwind classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`), not `ml-`/`mr-`/`left-`/`right-`.
- **Dates:** "today" is computed in the site timezone via `lib/time.ts`, never with the server's
  local time.
- **Worker UI:** big touch targets (min 48px, primary actions use `btn-huge`), minimal text,
  icons and colors for status. Shared styles are Tailwind `@utility` classes in `app/globals.css`
  (`card`, `input`, `btn-primary`, ...).
- Server Components fetch data with `lib/supabase/server.ts`; client components use
  `lib/supabase/client.ts`. Next 15: `params` and `searchParams` are Promises.

## Git workflow

- Branches: `main` (stable) and `dev` (ongoing work). Work on `dev` or a feature branch from it;
  merge into `main` only when lint and build pass.
- Don't push, force-push, or change repository settings without asking the user first.
- Keep commits focused; don't refactor or delete existing code that isn't part of the task.

## Out of scope for the MVP

Chat / auto-translation, notifications, a video CMS (videos are plain links), full offline sync.
