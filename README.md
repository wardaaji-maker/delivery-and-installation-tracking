# TrackFlow — Delivery & Installation Tracking

Next.js 16 + Supabase app for tracking delivery/installation projects, with separate
admin and driver experiences.

## What's built

- **Multilevel auth** — `/signup` lets a user register as **Admin** or **Driver**; `/login` signs in and routes each role to its own area. Route guards live in `src/app/admin/layout.tsx`, `src/app/driver/layout.tsx`, and `src/proxy.ts`.
- **Admin: projects** — create a project (name, due date, description, status) at `/admin/projects/new`.
- **Admin: bulk location import** — upload a `.csv`/`.xlsx` on a project page to bulk-create locations (columns: `label, address, lat, lng, receiver_name, receiver_phone, notes`, header names are case-insensitive with common aliases).
- **Admin: driver assignment** — per-location driver dropdown on the project page.
- **Driver: my locations** — `/driver/locations` shows only locations assigned to the signed-in driver.
- **Driver: live route map** — `/driver/map` (Leaflet + OpenStreetMap) shows assigned pins and streams the driver's live GPS position into `driver_positions`.
- **Driver: photo report submission** — `/driver/locations/[id]` lets a driver upload multiple photos + notes; this uploads to Supabase Storage and marks the location complete.
- **Gallery** — `/admin/gallery` (all reports, filterable by project) and `/driver/gallery` (own reports).
- **Admin dashboard** — `/admin/dashboard` shows stats and a live map of all drivers + locations (updates in real time via Supabase Realtime).
- **WhatsApp click-to-chat** — every location with a receiver phone number gets a `wa.me` button (driver ⇄ receiver).

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project (you'll need a free account — sign up yourself, this isn't something I can do for you).
2. In the Supabase dashboard, open **SQL Editor** → **New query**, paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.
3. Repeat for [`supabase/migrations/0002_storage.sql`](supabase/migrations/0002_storage.sql) — this creates the public `photo-reports` storage bucket and its policies.
4. Go to **Project Settings → API** and copy the **Project URL** and **anon public** key.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the two values from step 1.4:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Sign up**, and create your first account with role **Admin**. Create a second account with role **Driver** to test the driver side (use a different browser/incognito window, or sign out first).

> Note: by default Supabase requires email confirmation for new sign-ups. For quick local testing, go to **Authentication → Providers → Email** in the Supabase dashboard and disable "Confirm email", or confirm the account manually from **Authentication → Users**.

## 4. Deploy to Vercel

1. Push this project to a GitHub repo (ask me to do this if you'd like — I'll need your go-ahead to create/push to a repo).
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo (you'll need your own Vercel account).
3. Add the two environment variables from step 2 in the Vercel project settings.
4. Deploy. Vercel will build with `next build` automatically.

Alternatively, from your machine with the [Vercel CLI](https://vercel.com/docs/cli) installed and logged in:

```bash
npx vercel
```

## Notes & assumptions

- `whatsappLink()` in `src/lib/utils.ts` defaults local numbers starting with `0` to the `62` (Indonesia) country code before building the `wa.me` link — adjust if your drivers/receivers are elsewhere.
- Live tracking writes a new row to `driver_positions` at most every ~15 seconds while a driver has `/driver/map` open (not a background service — the browser tab must stay open).
- The bulk import preview only shows the first 50 rows but imports all parsed rows.
- RLS policies restrict drivers to their own assigned locations/reports/positions; admins can see everything. Re-check `supabase/migrations/0001_init.sql` before relying on this in production.
