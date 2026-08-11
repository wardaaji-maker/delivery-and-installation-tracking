# Task Manager (Google Apps Script + Fonnte)

A daily task manager with priorities, a team roster, and WhatsApp
reminders, built the same way as your CRM: a Google Sheet as the
database, Apps Script as the backend/web app, and
[Fonnte](https://fonnte.com) to send WhatsApp messages. This is
independent of the TrackFlow app in the rest of this repo — these files
just live here so the source is version controlled.

Auto-detecting tasks from email/other platforms is **not** included yet
— this is manual task entry only. The code is structured so that piece
can be added later (e.g. a Gmail trigger calling `addTask`).

## What it does

- **Team roster** (Team tab) — three fixed positions, top to bottom:
  Showroom Manager → Showroom Manager Partner → Product Consultant.
  Add, rename, re-phone, deactivate, or delete specific people under
  each position at any time — no code changes needed.
- **Task categories by timeline** (New Task tab):
  - **Daily Routine** — recurs every day, no due date needed.
  - **Weekly** — recurs on one chosen weekday.
  - **Monthly** — recurs on one chosen day-of-month.
  - **One-time** — a single due date, same as before.
- Every task is assigned to a **Position**, and either a specific
  **Assignee** in that position or **All** (broadcasts to everyone
  active in that position).
- **Dashboard tab** — stat tiles (due today / overdue / high-priority
  pending), filter chips by category, filters by position/priority, and
  a task list with in-app badges (Overdue / Due today / Done today /
  Not today / Paused). Recurring tasks can be marked done for today
  (resets automatically the next day) or paused without deleting them.
- A daily time-based trigger (`sendDailyReminders`, default **08:00**,
  before operations start) sends a **WhatsApp** reminder via Fonnte to
  each due task's resolved recipient(s), plus a summary — grouped by
  category — to `REMINDER_TARGETS` (your number, a WhatsApp group, or
  both).

## Setup

1. Create a new Google Sheet (or reuse one) — this will hold the `Tasks`
   and `People` sheets, created automatically the first time the script
   runs.
2. **Extensions → Apps Script**. Delete the default `Code.gs` boilerplate.
3. Create three files matching the ones in this folder and paste their
   contents in:
   - `Code.gs`
   - `Index.html` (File → New → HTML file, name it `Index`)
   - `appsscript.json` — open via **Project Settings → Show
     "appsscript.json"**, then paste its contents into the manifest editor.
4. **Project Settings → Script Properties**, add:
   - `FONNTE_TOKEN` — your Fonnte device token (same one your CRM uses).
   - `REMINDER_TARGETS` — where the daily summary goes: a comma-separated
     list of WhatsApp numbers and/or group IDs, e.g.
     `628123456789,120363012345678901@g.us`. To find a group's ID, either
     check the group list in your Fonnte device dashboard, or send any
     message in the group and read the `sender`/`group` field of the
     inbound webhook payload if you have one configured — Fonnte accepts
     that same ID back as a `target`.
5. In the Apps Script editor, select the `createDailyTrigger` function
   in the toolbar dropdown and click **Run** once — this schedules
   `sendDailyReminders` to run every day at 08:00 (script timezone,
   set to `Asia/Jakarta` in `appsscript.json` — change if needed).
6. **Deploy → New deployment → Web app**. Set "Execute as: Me" and
   "Who has access" to your preference, then deploy. Open the resulting
   URL — that's your task manager.
7. Open the **Team** tab first and add your people under each position
   before creating tasks — the New Task form's Assignee dropdown is
   populated from that roster.

## Notes

- Phone numbers are passed straight to Fonnte's `target` field — use
  whatever format your Fonnte account expects (usually `62...` with no
  leading `0` or `+`).
- If `FONNTE_TOKEN` is missing, task/team CRUD still works; only
  WhatsApp sending will throw (caught and logged during the daily run,
  so one failed message won't block the rest).
- "Done today" on a recurring task only clears the *current* occurrence
  — there's no separate history log, so `LastCompletedDate` in the
  `Tasks` sheet just holds the most recent completion date.
- To change the reminder time, edit `.atHour(8)` in `createDailyTrigger`
  in `Code.gs`, then re-run `createDailyTrigger` to replace the trigger.
- To test reminders (including group delivery) before waiting for the
  trigger, select `sendDailyReminders` in the editor's function dropdown
  and click **Run** — it sends immediately for anything currently due.
