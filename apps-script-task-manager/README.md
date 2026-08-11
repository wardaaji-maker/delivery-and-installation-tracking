# Task Manager (Google Apps Script + Fonnte)

A standalone daily task manager with priorities and WhatsApp reminders,
built the same way as your CRM: a Google Sheet as the database, Apps
Script as the backend/web app, and [Fonnte](https://fonnte.com) to send
WhatsApp messages. This is independent of the TrackFlow app in the rest
of this repo — these files just live here so the source is version
controlled.

Auto-detecting tasks from email/other platforms is **not** included yet
— this first version is manual task entry only. The code is structured
so that piece can be added later (e.g. a Gmail trigger calling `addTask`).

## What it does

- Create tasks with a title, description, priority (High/Medium/Low),
  due date, and an optional assignee (name + WhatsApp number).
- Web app UI lists tasks sorted by priority/due date, with filters by
  status and priority, and **in-app** badges for Overdue / Due today /
  Upcoming.
- Mark tasks In Progress / Done, or delete them.
- A daily time-based trigger (`sendDailyReminders`) sends a **WhatsApp**
  reminder via Fonnte to each task's assignee for anything due today or
  overdue, plus a summary message to `REMINDER_TARGETS` — your number,
  a WhatsApp group, or both.

## Setup

1. Create a new Google Sheet (or reuse one) — this will hold the `Tasks`
   sheet, created automatically the first time the script runs.
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
   `sendDailyReminders` to run every day at 07:00 (script timezone,
   set to `Asia/Jakarta` in `appsscript.json` — change if needed).
6. **Deploy → New deployment → Web app**. Set "Execute as: Me" and
   "Who has access" to your preference, then deploy. Open the resulting
   URL — that's your task manager.

## Notes

- Phone numbers are passed straight to Fonnte's `target` field — use
  whatever format your Fonnte account expects (usually `62...` with no
  leading `0` or `+`).
- If `FONNTE_TOKEN` is missing, task creation/status updates still work;
  only WhatsApp sending will throw (caught and logged during the daily
  run, so one failed message won't block the rest).
- To change the reminder time, edit `.atHour(7)` in `createDailyTrigger`
  in `Code.gs`, then re-run `createDailyTrigger` to replace the trigger.
- To test group delivery before waiting for the daily trigger, select
  `sendDailyReminders` in the editor's function dropdown and click **Run**
  — it sends immediately using whatever's in `REMINDER_TARGETS` and at
  least one non-Done task with a due date today or earlier.
