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

## Identity — how the app knows who you are, and PINs

There's no Google account login. On first visit, an overlay asks you to
pick your name from the Team roster; that choice is remembered on that
device (via `localStorage`) until you tap **Switch user**.

Two independent layers back this up, because "just pick any name" is
exploitable on its own — a Product Consultant could otherwise pick
"Showroom Manager" and edit the schedule or the team:

1. **Server-side position checks, at two different levels.** `Code.gs`
   looks up the caller's position *fresh from the `People` sheet* on
   every relevant call, regardless of what the browser sends:
   - Editing the schedule or managing shift types: `requireManager()` —
     Showroom Manager **or** Partner.
   - Managing the Team roster (add/edit/delete people, reset PINs):
     `requireTeamAdmin()` — Showroom Manager **only**. A Partner can run
     the schedule day-to-day but can't touch who's in the org or reset
     someone's PIN.
   This alone stops any of those actions from being silently allowed to
   the wrong position, but by itself it doesn't stop someone from
   picking a manager's *name* in the first place.
2. **PINs on Manager/Partner identities close that gap.** From the header
   bar, a Manager or Partner can tap **🔒 Secure with a PIN** to set one
   on their own picked identity. Once set, picking that name (in the
   identity overlay, or via **Switch user**) requires the PIN — verified
   server-side (`verifyPin`), which never sends the actual PIN value to
   the browser. A Product Consultant with no PIN still can't be told the
   Manager's PIN, so they can no longer just tap the name to "become" the
   manager. If a PIN is forgotten, the Showroom Manager can clear it from
   the Team tab ("Reset PIN").

**Team roster management is Showroom-Manager-only** — narrower than
schedule access — with one bootstrap exception: while no active Showroom
Manager exists yet (a brand-new Sheet), Team stays open to anyone so the
very first Manager can be created — this is `isTeamBootstrapping()` in
`Code.gs`. The moment one active Showroom Manager exists, that exception
closes and only that position can add, edit, or remove people (or reset
PINs) from then on.

This is still not cryptographically hardened — PINs are stored in plain
text in the `People` sheet (same trust boundary as the Sheet itself: if
someone has edit access to the underlying Sheet, they can already see or
change anything). If you need real hardened auth (e.g. staff sharing one
tablet and you don't trust the PIN-sharing honor system either), that
would mean real Google account login instead — a bigger change (different
deployment access settings, a company Google account per person) not
included here. Task completions ("done" reports) still use whichever
identity is picked purely for attribution — there's no permission check
on who can complete a task.

## What it does

- **Team roster** (Team tab, Showroom-Manager-only — see Identity below) —
  three fixed positions, top to bottom: Showroom Manager → Showroom
  Manager Partner → Product Consultant. Add, rename, re-phone,
  deactivate, or delete specific people under each position at any
  time — no code changes needed.
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
- **Schedule tab** — a weekly grid (Mon–Sun) matching the shift-roster
  format shops usually share to WhatsApp: staff as rows, days as
  columns, each cell a color-coded shift code. Prev/Next buttons move
  between weeks. Only Showroom Manager/Partner identities can edit
  cells; Product Consultants see it read-only with a hint to ask a
  manager. A daily trigger posts each day's roster to your WhatsApp
  group before operations start.
- **Shift types** (bottom of the Schedule tab, Manager/Partner-only) —
  the codes selectable in each schedule cell. Seeded with `P` Pagi,
  `S` Siang, `M` Malam, `OFF`, `CUTI` (matching a typical shared
  roster), but you can rename, recolor, deactivate, delete, or add your
  own codes before using them — nothing is hardcoded. A cell holding a
  code that's since been deleted just renders as an unstyled custom
  value ("Other…") rather than breaking.
- A daily time-based trigger (`runDailyAutomation`, default **08:00**,
  before operations start) sends a single category-grouped WhatsApp
  summary of everything due today to `REMINDER_TARGETS`, plus today's
  schedule to `SCHEDULE_TARGETS`. **All WhatsApp sends go to
  `REMINDER_TARGETS`/`SCHEDULE_TARGETS` only** — nothing is ever DMed to
  an individual's private number, including the immediate ping an
  Urgent task sends on creation. Point those properties at your group
  (or a comma-separated mix of numbers/groups) to control exactly who
  sees reminders.
- **Reply-to-complete** (optional, needs the webhook setup below) —
  every reminder line ends with a short `[CODE]` tag. Anyone replies
  in the WhatsApp group with `CODE what I did` (e.g.
  `8F3A21 closed the shop, swept floor`) and the matching task is
  marked done, with everything after the code saved as that task's
  completion report — same as typing it into the web app's "Done"
  prompt, just from WhatsApp. A photo in the same message is optional;
  if present, it's saved to a Google Drive folder ("Task Manager
  Photos") and linked in the report. The group gets a confirmation
  (`✅ <name> marked "<task>" done`) either way.

## Setup

1. Create a new Google Sheet (or reuse one) — this will hold the
   `Tasks`, `People`, `Schedule`, and `ShiftTypes` sheets, created
   automatically the first time the script runs (`ShiftTypes` is also
   seeded with the default P/S/M/OFF/CUTI codes on that first run only).
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
   - `WEBHOOK_SECRET` (only if you want reply-to-complete — step 7) — any
     string you make up, e.g. a random 20-character password.
5. In the Apps Script editor, select the `createDailyTrigger` function
   in the toolbar dropdown and click **Run** once — this schedules
   `runDailyAutomation` to run every day at 08:00 (script timezone, set
   to `Asia/Jakarta` in `appsscript.json` — change if needed).
6. **Deploy → New deployment → Web app**. Set "Execute as: Me". For
   "Who has access": if you're skipping reply-to-complete, pick whatever
   you like; if you're setting it up (step 7), it **must** be "Anyone" —
   Fonnte's servers aren't a Google account and can't complete a sign-in
   redirect, so anything narrower silently fails the webhook. Deploy and
   open the resulting URL — that's your task manager.
7. **Optional — reply-to-complete.** Requires `WEBHOOK_SECRET` (step 4)
   and "Anyone" access (step 6):
   1. Take your deployed web app URL and append
      `?token=<your WEBHOOK_SECRET>` to it.
   2. In your Fonnte device dashboard, find the incoming-message webhook
      setting and paste that full URL in.
   3. Send a test message (with `8F3A21 test note` as the text, or any
      real task's code from a reminder you've already received) in the
      group. Check **Apps Script → Executions** in the editor — it logs
      the raw payload Fonnte sent (`Incoming WhatsApp webhook: ...`).
   4. **This is the part that needs your verification**: Fonnte's exact
      field names for "who sent this" and "attached photo URL" aren't
      guaranteed by this code — `extractSenderPhone()` and
      `extractImageUrl()` in `Code.gs` check a few likely field names
      (`member`/`sender_phone`/`phone`/`sender`, and
      `url`/`file`/`media`/`image`) as a best guess. If step 3's logged
      payload doesn't match — the confirmation message says "Someone"
      instead of a name, or a photo doesn't get saved — open the logged
      JSON, find the real field name, and add it to the relevant
      `extractX()` function.
8. Open the **Team** tab first and add your people under each position
   — the identity picker, New Task Assignee dropdown, and Schedule tab
   all read from that roster.

## Notes

- The `Phone` field in Team is contact info only — it's not currently
  used for sending anything (see "All WhatsApp sends go to
  REMINDER_TARGETS/SCHEDULE_TARGETS only" above). Whatever numbers/group
  IDs you put in `REMINDER_TARGETS`/`SCHEDULE_TARGETS` are passed
  straight to Fonnte's `target` field — use whatever format your Fonnte
  account expects (usually `62...` with no leading `0` or `+`).
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
  `CompletionNote`), the `People` sheet gains a trailing `Pin` column,
  and the daily trigger function was renamed from `sendDailyReminders`
  to `runDailyAutomation` — re-run `createDailyTrigger` after updating
  the code so the old trigger gets replaced instead of left dangling.
- **Header self-healing**: every sheet access now checks that row 1
  actually matches the expected header (cell A1 equal to `ID`) and
  inserts a proper header row before existing data if it's missing — no
  data is lost, rows just shift down by one. This fixes the case where a
  sheet already existed (e.g. you created the tab yourself, or it
  predates a column that got added later) and never got headers
  written, which made the first real row of data get silently treated
  as "the header" and skipped by the web app. If a task you created
  isn't showing up, reload the web app once — it repairs itself on the
  next sheet read.
- PINs are plain text in the `People` sheet's `Pin` column — see
  "Identity" above for what that trust boundary does and doesn't cover.
- Reply-to-complete's `[CODE]` is the task's ID, shortened to its last 6
  hex characters — stable for that task's lifetime (not re-issued daily),
  so an old reminder's code still works days later. If the sender's
  phone number doesn't match anyone active in Team, the task still
  completes — the report is just prefixed `(from <number>)` instead of
  being attributed to a name.
- `doPost()` requires the `?token=...` query param to exactly match
  `WEBHOOK_SECRET`; anything else (including no `WEBHOOK_SECRET` set at
  all) gets silently ignored rather than erroring, so a stray POST from
  elsewhere on the internet can't do anything even though the
  deployment is publicly reachable.
- The web app being deployed as "Anyone" (needed for the webhook) means
  its URL alone lets anyone view the task manager UI — there's no login
  wall on `doGet`. This was already loosely true given the PIN-based
  identity model (see "Identity" above); reply-to-complete just also
  requires it to be true for unauthenticated *requests*, not just page
  views.
