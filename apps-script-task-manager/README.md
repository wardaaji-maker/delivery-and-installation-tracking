# Task Manager (Google Apps Script + Fonnte)

A daily task manager with priorities, a team roster, a showroom
schedule, and WhatsApp reminders, built the same way as your CRM: a
Google Sheet as the database, Apps Script as the backend/web app, and
[Fonnte](https://fonnte.com) to send WhatsApp messages. This is
independent of the TrackFlow app in the rest of this repo — these files
just live here so the source is version controlled.

Auto-detecting tasks from email/other platforms is **not** included yet
— this is manual task entry only. The code is structured so that piece
can be added later (e.g. a Gmail trigger calling `addTask`).

## Identity — how the app knows who you are

There's no Google account login. On first visit, an overlay asks you to
pick your name from the Team roster; that choice is remembered on that
device (via `localStorage`) until you tap **Switch user**. This is a
convenience, not a security boundary — anyone at the device could pick a
different name. What actually matters (editing the showroom schedule) is
re-checked **server-side**: every schedule-editing call sends your
picked identity, and `Code.gs` looks up that person's position fresh
from the `People` sheet and rejects the call if they're not a Showroom
Manager or Partner, regardless of what the browser claims. Task
completions ("done" reports) use the same picked identity purely for
attribution — there's no permission check on who can complete a task.

If you need this to be tamper-proof (e.g. staff sharing one tablet and
you don't trust everyone to pick their own name honestly), that would
require real Google account login instead — a bigger change (different
deployment access settings, a company Google account per person) not
included here.

## What it does

- **Team roster** (Team tab) — three fixed positions, top to bottom:
  Showroom Manager → Showroom Manager Partner → Product Consultant.
  Add, rename, re-phone, deactivate, or delete specific people under
  each position at any time — no code changes needed.
- **Task categories by timeline** (New Task tab):
  - **Daily Routine** — recurs every day, no due date needed.
  - **Weekly** — recurs on one or more chosen weekdays (e.g. Monday +
    Friday).
  - **Monthly** — recurs on one chosen day-of-month.
  - **One-time** — a single due date, for regular ad-hoc tasks.
  - **Priority** includes **Urgent**, which — on top of the normal daily
    reminder — sends an immediate WhatsApp ping the moment the task is
    created.
- Every task is assigned to a **Position**, and either a specific
  **Assignee** in that position or **All** (broadcasts to everyone
  active in that position).
- **Dashboard tab** — stat tiles (due today / overdue / urgent+high
  pending), filter chips by category, filters by position/priority, and
  a task list with in-app badges (Overdue / Due today / Done today /
  Not today / Paused). Recurring tasks can be marked done for today
  (resets automatically the next day) or paused without deleting them.
  Completing a task prompts for a short **report** (what you did),
  recorded against your picked identity and shown on the task card.
- **Schedule tab** — a rolling 7-day showroom duty roster (who's on,
  optional shift note per person per day). Only Showroom Manager/Partner
  identities can add, edit, or delete entries; Product Consultants see
  it read-only with a hint to ask a manager. A daily trigger posts each
  day's roster to your WhatsApp group before operations start.
- A daily time-based trigger (`runDailyAutomation`, default **08:00**,
  before operations start) sends a WhatsApp reminder via Fonnte to each
  due task's resolved recipient(s), a category-grouped summary to
  `REMINDER_TARGETS`, and today's schedule to `SCHEDULE_TARGETS`.

## Setup

1. Create a new Google Sheet (or reuse one) — this will hold the
   `Tasks`, `People`, and `Schedule` sheets, created automatically the
   first time the script runs.
2. **Extensions → Apps Script**. Delete the default `Code.gs` boilerplate.
3. Create three files matching the ones in this folder and paste their
   contents in:
   - `Code.gs`
   - `Index.html` (File → New → HTML file, name it `Index`)
   - `appsscript.json` — open via **Project Settings → Show
     "appsscript.json"**, then paste its contents into the manifest editor.
4. **Project Settings → Script Properties**, add:
   - `FONNTE_TOKEN` — your Fonnte device token (same one your CRM uses).
   - `REMINDER_TARGETS` — where the daily task summary goes: a
     comma-separated list of WhatsApp numbers and/or group IDs, e.g.
     `628123456789,120363012345678901@g.us`. To find a group's ID, either
     check the group list in your Fonnte device dashboard, or send any
     message in the group and read the `sender`/`group` field of the
     inbound webhook payload if you have one configured — Fonnte accepts
     that same ID back as a `target`.
   - `SCHEDULE_TARGETS` (optional) — same format, for where the daily
     showroom schedule post goes if it should be different from
     `REMINDER_TARGETS` (e.g. a dedicated group). Falls back to
     `REMINDER_TARGETS` if not set.
5. In the Apps Script editor, select the `createDailyTrigger` function
   in the toolbar dropdown and click **Run** once — this schedules
   `runDailyAutomation` to run every day at 08:00 (script timezone, set
   to `Asia/Jakarta` in `appsscript.json` — change if needed).
6. **Deploy → New deployment → Web app**. Set "Execute as: Me" and
   "Who has access" to your preference, then deploy. Open the resulting
   URL — that's your task manager.
7. Open the **Team** tab first and add your people under each position
   — the identity picker, New Task Assignee dropdown, and Schedule tab
   all read from that roster.

## Notes

- Phone numbers are passed straight to Fonnte's `target` field — use
  whatever format your Fonnte account expects (usually `62...` with no
  leading `0` or `+`).
- If `FONNTE_TOKEN` is missing, task/team/schedule CRUD still works;
  only WhatsApp sending will throw (caught and logged during the daily
  run, so one failed message won't block the rest).
- "Done today" on a recurring task only clears the *current* occurrence
  — there's no separate history log, so `LastCompletedDate`,
  `CompletedBy`, and `CompletionNote` in the `Tasks` sheet just hold the
  most recent completion.
- To change the reminder time, edit `.atHour(8)` in `createDailyTrigger`
  in `Code.gs`, then re-run `createDailyTrigger` to replace the trigger.
- To test reminders (including group delivery) before waiting for the
  trigger, select `runDailyAutomation` in the editor's function dropdown
  and click **Run** — it sends immediately for anything currently due
  and today's schedule.
- If you'd previously deployed an earlier version of this script: the
  `Tasks` sheet gains two new trailing columns (`CompletedBy`,
  `CompletionNote`) and the daily trigger function was renamed from
  `sendDailyReminders` to `runDailyAutomation` — re-run
  `createDailyTrigger` after updating the code so the old trigger gets
  replaced instead of left dangling.
