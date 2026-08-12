/**
 * Task Manager — Google Apps Script + Fonnte
 *
 * Storage: "Tasks", "People", and "Schedule" sheets in the bound Google Sheet.
 * Reminders: sent via the Fonnte WhatsApp API (https://fonnte.com).
 *
 * Identity: there's no Google login gate — on first visit each person picks
 * their name from the People roster (remembered on that device). Every
 * server action that matters re-checks the caller's position server-side,
 * so a spoofed personId can't bypass permissions on its own:
 *   - Schedule + shift types: Showroom Manager OR Partner (requireManager()).
 *   - Team roster (add/edit/delete people, reset PINs): Showroom Manager
 *     ONLY (requireTeamAdmin()) — Partner can edit the schedule but not
 *     the org roster.
 * On top of that, a Manager or Partner can set a PIN on their own identity
 * ("Secure with a PIN" in the header) — once set, picking that identity
 * requires the PIN, so a Product Consultant can no longer just tap a
 * manager's name to "become" them. PINs are stored in plain text in the
 * People sheet (same trust boundary as the Sheet itself), so this is a real
 * access-control step up from "anyone can pick anyone," not a
 * cryptographically hardened login.
 *
 * Script Properties (Project Settings → Script Properties):
 *   FONNTE_TOKEN      - your Fonnte device token (required to send WhatsApp reminders)
 *   REMINDER_TARGETS  - comma-separated list of WhatsApp numbers and/or group
 *                       IDs that get the daily task summary, e.g.
 *                       "628123456789,120363012345678901@g.us"
 *                       (find a group's ID in the Fonnte dashboard's device
 *                       group list, or from an inbound webhook payload).
 *   SCHEDULE_TARGETS  - optional; same format as REMINDER_TARGETS, for where
 *                       the daily showroom schedule post goes. Falls back to
 *                       REMINDER_TARGETS if not set.
 *   WEBHOOK_SECRET    - required for reply-to-complete (see below): an
 *                       arbitrary string only you know, appended as
 *                       ?token=... to the webhook URL you give Fonnte.
 *   GROQ_API_KEY      - optional, enables natural-language replies (see
 *                       below). Get one at console.groq.com — this script
 *                       never creates or manages that account for you.
 *
 * Reply-to-complete: every reminder line carries a short [CODE] tag (the
 * task's ID, shortened). Fonnte is configured (in its dashboard) to POST
 * incoming WhatsApp messages to this web app's URL; doPost() reads the
 * message and completes the matching task exactly like clicking "Done" in
 * the web app — the rest of the message becomes the completion report, and
 * an attached photo (optional) is saved to a Drive folder and linked on the
 * task. Two ways a message gets matched to a task:
 *   1. Starts with the exact [CODE] — free, instant, no AI involved
 *      (regex match in handleIncomingWhatsAppMessage()).
 *   2. Anything else, natural language, ONLY if GROQ_API_KEY is set —
 *      interpretReplyWithAI() sends the message plus the list of
 *      currently-open tasks to Groq (openai/gpt-oss-20b) and asks it to
 *      pick which task (if any) is being reported done. This means every
 *      non-code message sent in the group triggers an API call while this
 *      is configured — accepted cost of "reply however you want" instead
 *      of requiring the code. If the model isn't confident the message is
 *      about one of the listed tasks, nothing happens (no reply, no
 *      action) — ordinary chat is meant to pass through silently.
 * See README for the Fonnte-side webhook setup and the deployment-access
 * tradeoff this requires (the app must accept POSTs from Fonnte's servers,
 * so "Anyone" access — WEBHOOK_SECRET is what keeps that from being a
 * fully open endpoint).
 */

const TASKS_SHEET_NAME = 'Tasks';
const PEOPLE_SHEET_NAME = 'People';
const SCHEDULE_SHEET_NAME = 'Schedule';
const SHIFT_TYPES_SHEET_NAME = 'ShiftTypes';
const FONNTE_API_URL = 'https://api.fonnte.com/send';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Small/cheap/fast — this only needs to pick a task from a short list and lightly clean up a sentence, not reason deeply. */
const GROQ_MODEL = 'openai/gpt-oss-20b';

const TASKS_HEADERS = [
  'ID', 'Title', 'Description', 'Priority', 'Category', 'Weekday',
  'DayOfMonth', 'DueDate', 'Position', 'AssigneeName', 'Active',
  'Status', 'LastCompletedDate', 'CreatedAt', 'CompletedBy', 'CompletionNote',
];
const PEOPLE_HEADERS = ['ID', 'Position', 'Name', 'Phone', 'Active', 'CreatedAt', 'Pin'];
const SCHEDULE_HEADERS = ['ID', 'Date', 'StaffName', 'ShiftNote', 'CreatedBy', 'CreatedAt'];
const SHIFT_TYPE_HEADERS = ['ID', 'Code', 'Label', 'Color', 'Active', 'CreatedAt'];
/** Seeded once, the first time the ShiftTypes sheet is created — matches the roster you already share to WhatsApp. */
const DEFAULT_SHIFT_TYPES = [
  ['P', 'Pagi', '#c8e6c9'],
  ['S', 'Siang', '#bbdefb'],
  ['M', 'Malam', '#f8bbd0'],
  ['OFF', 'Off', '#ffcdd2'],
  ['CUTI', 'Cuti', '#ffe0b2'],
];

const POSITIONS = ['Showroom Manager', 'Showroom Manager Partner', 'Product Consultant'];
const MANAGER_POSITIONS = ['Showroom Manager', 'Showroom Manager Partner'];
/** Team roster management is narrower than schedule access — Manager only, not Partner. */
const TEAM_ADMIN_POSITIONS = ['Showroom Manager'];
const CATEGORIES = ['Daily Routine', 'Weekly', 'Monthly', 'One-time'];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PRIORITY_ORDER = { Urgent: -1, High: 0, Medium: 1, Low: 2 };
const PRIORITY_EMOJI = { Urgent: '🚨', High: '🔴', Medium: '🟡', Low: '🟢' };

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureHeaderRow(sheet, headers);
  return sheet;
}

/**
 * Makes sure `sheet`'s row 1 is actually the header row, self-healing if
 * it's missing — e.g. a sheet that already existed (created outside this
 * script, or from before some column was added) never got headers written,
 * so real data ended up in row 1 and getTasks()/getPeople()/getSchedule()
 * silently treated it as the header and skipped it.
 */
function ensureHeaderRow(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }
  if (sheet.getRange(1, 1).getValue() !== headers[0]) {
    sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function getTasksSheet() { return getOrCreateSheet(TASKS_SHEET_NAME, TASKS_HEADERS); }
function getPeopleSheet() { return getOrCreateSheet(PEOPLE_SHEET_NAME, PEOPLE_HEADERS); }
function getScheduleSheet() { return getOrCreateSheet(SCHEDULE_SHEET_NAME, SCHEDULE_HEADERS); }

/** Unlike the other sheets, this one seeds default rows — but only the very first time it's created. */
function getShiftTypesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHIFT_TYPES_SHEET_NAME);
  const isNew = !sheet;
  if (isNew) sheet = ss.insertSheet(SHIFT_TYPES_SHEET_NAME);
  ensureHeaderRow(sheet, SHIFT_TYPE_HEADERS);
  if (isNew) {
    DEFAULT_SHIFT_TYPES.forEach(([code, label, color]) => {
      sheet.appendRow([Utilities.getUuid(), code, label, color, true, new Date()]);
    });
  }
  return sheet;
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Task Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Static lookup data the UI needs to build forms/dropdowns. */
function getConfig() {
  return {
    positions: POSITIONS,
    managerPositions: MANAGER_POSITIONS,
    teamAdminPositions: TEAM_ADMIN_POSITIONS,
    categories: CATEGORIES,
    priorities: PRIORITIES,
    weekdays: WEEKDAYS,
  };
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** Never exposes the actual Pin value to the client — only whether one is set (hasPin). */
function getPeople() {
  const sheet = getPeopleSheet();
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      position: row[1],
      name: row[2],
      phone: row[3],
      active: row[4] !== false,
      hasPin: !!row[6],
    }));
}

function getPersonById(id) {
  return getPeople().find((p) => p.id === id) || null;
}

/** Throws unless `personId` belongs to an active Showroom Manager / Partner. Used for schedule + shift types. */
function requireManager(personId) {
  const person = getPersonById(personId);
  if (!person || !person.active || MANAGER_POSITIONS.indexOf(person.position) === -1) {
    throw new Error('Only a Showroom Manager or Showroom Manager Partner can do that.');
  }
  return person;
}

/** True until at least one active Showroom Manager exists — lets the very first one be created without a chicken-and-egg lockout. */
function isTeamBootstrapping() {
  return getPeople().every((p) => TEAM_ADMIN_POSITIONS.indexOf(p.position) === -1 || !p.active);
}

/** Throws unless `personId` belongs to an active Showroom Manager. Team roster is narrower than schedule access — Partner is not enough. */
function requireTeamAdmin(personId) {
  const person = getPersonById(personId);
  if (!person || !person.active || TEAM_ADMIN_POSITIONS.indexOf(person.position) === -1) {
    throw new Error('Only a Showroom Manager can manage the Team.');
  }
  return person;
}

/** Same as requireTeamAdmin(), but allows anyone through while no Showroom Manager exists yet. */
function requireTeamAdminOrBootstrap(personId) {
  if (isTeamBootstrapping()) return null;
  return requireTeamAdmin(personId);
}

/** `person` = {position, name, phone}. Showroom Manager only, except during initial bootstrap. */
function addPerson(requesterId, person) {
  requireTeamAdminOrBootstrap(requesterId);
  if (!person || !person.name || !person.position) throw new Error('Name and position are required');
  const sheet = getPeopleSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([id, person.position, person.name, person.phone || '', true, new Date(), '']);
  return id;
}

/** `patch` = {name?, phone?, active?}. Showroom Manager only, except during initial bootstrap. */
function updatePerson(requesterId, id, patch) {
  requireTeamAdminOrBootstrap(requesterId);
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  if (patch.name !== undefined) sheet.getRange(row, 3).setValue(patch.name);
  if (patch.phone !== undefined) sheet.getRange(row, 4).setValue(patch.phone);
  if (patch.active !== undefined) sheet.getRange(row, 5).setValue(patch.active);
  return true;
}

function deletePerson(requesterId, id) {
  requireTeamAdminOrBootstrap(requesterId);
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

/** Self-service: a picked identity sets/changes its own PIN (blank clears it). Not gated on Manager — anyone may secure their own name. */
function setPersonPin(personId, pin) {
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, personId);
  if (row === -1) return false;
  sheet.getRange(row, 7).setValue(pin ? String(pin) : '');
  return true;
}

/** Lets a Showroom Manager clear someone else's forgotten PIN — same gate as the rest of Team. */
function resetPersonPin(requesterId, targetId) {
  requireTeamAdminOrBootstrap(requesterId);
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, targetId);
  if (row === -1) return false;
  sheet.getRange(row, 7).setValue('');
  return true;
}

/** No PIN set yet -> anyone may pick that identity (matches hasPin=false client-side). */
function verifyPin(personId, pin) {
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, personId);
  if (row === -1) return false;
  const stored = sheet.getRange(row, 7).getValue();
  if (!stored) return true;
  return String(stored) === String(pin || '');
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** Returns all tasks as plain objects, for the web app UI. */
function getTasks() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      title: row[1],
      description: row[2],
      priority: row[3],
      category: row[4],
      weekday: row[5],
      dayOfMonth: row[6],
      dueDate: row[7] ? Utilities.formatDate(new Date(row[7]), tz, 'yyyy-MM-dd') : '',
      position: row[8],
      assigneeName: row[9],
      active: row[10] !== false,
      status: row[11],
      lastCompletedDate: row[12] ? Utilities.formatDate(new Date(row[12]), tz, 'yyyy-MM-dd') : '',
      createdAt: row[13] ? Utilities.formatDate(new Date(row[13]), tz, 'yyyy-MM-dd HH:mm') : '',
      completedBy: row[14],
      completionNote: row[15],
    }));
}

/**
 * Creates a task. `task` = {title, description, priority, category, weekday,
 * dayOfMonth, dueDate, position, assigneeName}. `weekday` (Weekly) and
 * `dayOfMonth` (Monthly) may be arrays for multi-day recurrence, e.g.
 * weekday: ["Monday", "Friday"]. Daily Routine uses none of these.
 * Urgent-priority tasks get an immediate WhatsApp ping on top of the daily run.
 */
function addTask(task) {
  if (!task || !task.title) throw new Error('Title is required');
  if (CATEGORIES.indexOf(task.category) === -1) throw new Error('Invalid category');
  const sheet = getTasksSheet();
  const id = Utilities.getUuid();
  const priority = PRIORITIES.indexOf(task.priority) === -1 ? 'Medium' : task.priority;
  const weekday = Array.isArray(task.weekday) ? task.weekday.join(',') : (task.weekday || '');
  const dayOfMonth = Array.isArray(task.dayOfMonth) ? task.dayOfMonth.join(',') : (task.dayOfMonth || '');
  sheet.appendRow([
    id,
    task.title,
    task.description || '',
    priority,
    task.category,
    task.category === 'Weekly' ? weekday : '',
    task.category === 'Monthly' ? dayOfMonth : '',
    task.category === 'One-time' ? (task.dueDate || '') : '',
    task.position || '',
    task.assigneeName || 'All',
    true,
    'Pending',
    '',
    new Date(),
    '',
    '',
  ]);
  if (priority === 'Urgent') {
    try {
      notifyUrgentTaskNow(id);
    } catch (err) {
      Logger.log('Urgent notification failed for task %s: %s', id, err);
    }
  }
  return id;
}

/** Generic status setter — used for the one-time "Start" (In Progress) action. */
function updateTaskStatus(id, status) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 12).setValue(status);
  return true;
}

/**
 * Marks a task's current occurrence done and records who did it — the
 * "update the report" step every assignee is expected to do once a task is
 * finished. Works for both one-time tasks (sets Status=Done) and recurring
 * ones (stamps LastCompletedDate, which auto-resets the next scheduled day).
 */
function completeTask(id, personId, note) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  const category = sheet.getRange(row, 5).getValue();
  const person = getPersonById(personId);
  if (category === 'One-time') sheet.getRange(row, 12).setValue('Done');
  sheet.getRange(row, 13).setValue(new Date());
  sheet.getRange(row, 15).setValue(person ? person.name : '');
  sheet.getRange(row, 16).setValue(note || '');
  return true;
}

/** Reopens a task: clears its completion (and, for one-time tasks, resets Status to Pending). */
function reopenTask(id) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  const category = sheet.getRange(row, 5).getValue();
  if (category === 'One-time') sheet.getRange(row, 12).setValue('Pending');
  sheet.getRange(row, 13).setValue('');
  sheet.getRange(row, 15).setValue('');
  sheet.getRange(row, 16).setValue('');
  return true;
}

/** Pauses/resumes a recurring task without deleting it. */
function setTaskActive(id, active) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 11).setValue(active);
  return true;
}

function deleteTask(id) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

// ---------------------------------------------------------------------------
// Showroom schedule (Manager / Partner only to edit)
// ---------------------------------------------------------------------------

/** Entries with Date in [startDate, endDate], inclusive, both "yyyy-MM-dd". */
function getSchedule(startDate, endDate) {
  const sheet = getScheduleSheet();
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      date: row[1] ? Utilities.formatDate(new Date(row[1]), tz, 'yyyy-MM-dd') : '',
      staffName: row[2],
      shiftNote: row[3],
      createdBy: row[4],
    }))
    .filter((entry) => entry.date >= startDate && entry.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.staffName.localeCompare(b.staffName));
}

/** `entry` = {date, staffName, shiftNote}. Manager/Partner only. */
function addScheduleEntry(personId, entry) {
  const person = requireManager(personId);
  if (!entry || !entry.date || !entry.staffName) throw new Error('Date and staff name are required');
  const sheet = getScheduleSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([id, entry.date, entry.staffName, entry.shiftNote || '', person.name, new Date()]);
  return id;
}

/** `patch` = {date?, staffName?, shiftNote?}. Manager/Partner only. */
function updateScheduleEntry(personId, id, patch) {
  requireManager(personId);
  const sheet = getScheduleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  if (patch.date !== undefined) sheet.getRange(row, 2).setValue(patch.date);
  if (patch.staffName !== undefined) sheet.getRange(row, 3).setValue(patch.staffName);
  if (patch.shiftNote !== undefined) sheet.getRange(row, 4).setValue(patch.shiftNote);
  return true;
}

function deleteScheduleEntry(personId, id) {
  requireManager(personId);
  const sheet = getScheduleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

// ---------------------------------------------------------------------------
// Shift types (Manager / Partner only) — the codes selectable in the
// Schedule grid, e.g. P/Pagi, S/Siang. Seeded with defaults, fully editable.
// ---------------------------------------------------------------------------

function getShiftTypes() {
  const sheet = getShiftTypesSheet();
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      code: row[1],
      label: row[2],
      color: row[3],
      active: row[4] !== false,
    }));
}

/** `type` = {code, label, color}. Manager/Partner only. */
function addShiftType(personId, type) {
  requireManager(personId);
  if (!type || !type.code) throw new Error('Code is required');
  const code = String(type.code).trim().toUpperCase();
  if (!code) throw new Error('Code is required');
  if (getShiftTypes().some((t) => t.code === code)) throw new Error('That shift code already exists');
  const sheet = getShiftTypesSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([id, code, type.label || code, type.color || '#e0e0e0', true, new Date()]);
  return id;
}

/** `patch` = {code?, label?, color?, active?}. Manager/Partner only. */
function updateShiftType(personId, id, patch) {
  requireManager(personId);
  const sheet = getShiftTypesSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  if (patch.code !== undefined) sheet.getRange(row, 2).setValue(String(patch.code).trim().toUpperCase());
  if (patch.label !== undefined) sheet.getRange(row, 3).setValue(patch.label);
  if (patch.color !== undefined) sheet.getRange(row, 4).setValue(patch.color);
  if (patch.active !== undefined) sheet.getRange(row, 5).setValue(patch.active);
  return true;
}

function deleteShiftType(personId, id) {
  requireManager(personId);
  const sheet = getShiftTypesSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

/**
 * Sends a WhatsApp message via Fonnte. `target` is a single phone number,
 * a single group ID, or a comma-separated mix of both — Fonnte fans a
 * comma-separated target out to every recipient in one call.
 */
function sendFonnteMessage(target, message) {
  const token = PropertiesService.getScriptProperties().getProperty('FONNTE_TOKEN');
  if (!token) throw new Error('FONNTE_TOKEN is not set in Script Properties');
  if (!target) throw new Error('No target (phone/group) given');
  const response = UrlFetchApp.fetch(FONNTE_API_URL, {
    method: 'post',
    headers: { Authorization: token },
    payload: { target: String(target), message: message },
    muteHttpExceptions: true,
  });
  return response.getContentText();
}

/** Short, stable per-task tag used in reminder messages and matched back against replies (see doPost()). */
function refCode(id) {
  return String(id).replace(/-/g, '').slice(-6).toUpperCase();
}

function isScheduledToday(task, today, todayWeekday, todayDayOfMonth) {
  if (task.category === 'Daily Routine') return true;
  if (task.category === 'Weekly') {
    return String(task.weekday || '').split(',').map((s) => s.trim()).indexOf(todayWeekday) !== -1;
  }
  if (task.category === 'Monthly') {
    return String(task.dayOfMonth || '').split(',').map((s) => s.trim()).indexOf(String(todayDayOfMonth)) !== -1;
  }
  if (task.category === 'One-time') return !!task.dueDate && task.dueDate <= today;
  return false;
}

/** Whether GROQ_API_KEY is configured — i.e. natural-language replies (no code required) work, not just the exact-code shortcut. */
function aiReplyEnabled() {
  return !!PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
}

function replyInstructions(codeExample) {
  return aiReplyEnabled()
    ? `Reply here in your own words to mark it done (e.g. "sudah beres, tutup toko") — a photo is optional. You can also just type "${codeExample} what you did" if you prefer.`
    : `Reply here with "${codeExample} what you did" to mark it done — a photo is optional.`;
}

/** Sends an immediate WhatsApp ping to REMINDER_TARGETS right now (used for Urgent tasks on creation) — group only, never a private number. */
function notifyUrgentTaskNow(taskId) {
  const task = getTasks().find((t) => t.id === taskId);
  if (!task) return;
  const targets = PropertiesService.getScriptProperties().getProperty('REMINDER_TARGETS');
  if (!targets) return;
  const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
  const message = `${emoji} [URGENT] ${task.title} [${refCode(task.id)}]\nPriority: ${task.priority}\nAssigned: ${task.position} (${task.assigneeName})` +
    (task.description ? `\n${task.description}` : '') +
    `\n\n${replyInstructions(refCode(task.id))}`;
  sendFonnteMessage(targets, message);
}

/**
 * Sends a single category-grouped WhatsApp summary to REMINDER_TARGETS for
 * every active task scheduled today and not yet done — group only, never a
 * private number. Meant to run on a daily time-based trigger (default
 * 08:00, before operations start).
 */
function sendDailyReminders() {
  const tasks = getTasks().filter((t) => t.active);
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const todayWeekday = Utilities.formatDate(now, tz, 'EEEE');
  const todayDayOfMonth = Utilities.formatDate(now, tz, 'd');
  const reminderTargets = PropertiesService.getScriptProperties().getProperty('REMINDER_TARGETS');

  const due = tasks.filter((task) => {
    if (!isScheduledToday(task, today, todayWeekday, todayDayOfMonth)) return false;
    if (task.category === 'One-time') return task.status !== 'Done';
    return task.lastCompletedDate !== today;
  });

  due.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));

  if (reminderTargets && due.length > 0) {
    const byCategory = {};
    due.forEach((task) => {
      if (!byCategory[task.category]) byCategory[task.category] = [];
      byCategory[task.category].push(task);
    });
    const sections = CATEGORIES.filter((cat) => byCategory[cat]).map((cat) => {
      const lines = byCategory[cat].map((task) => {
        const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
        return `${emoji} ${task.title} — ${task.priority} — ${task.position} (${task.assigneeName}) [${refCode(task.id)}]`;
      });
      return `*${cat}*\n${lines.join('\n')}`;
    });
    const howTo = aiReplyEnabled()
      ? 'Reply in your own words to mark a task done (e.g. "sudah beres, tutup toko") — a photo is optional. You can also just type its code + what you did.'
      : 'Reply with a task\'s code + what you did to mark it done, e.g. "8F3A21 closed the shop, swept floor" — a photo is optional.';
    const summary = `📋 Daily Task Summary — ${due.length} task(s) need attention:\n\n${sections.join('\n\n')}\n\n${howTo}`;
    try {
      sendFonnteMessage(reminderTargets, summary);
    } catch (err) {
      Logger.log('Daily summary failed: %s', err);
    }
  }
}

/** Posts today's showroom schedule to SCHEDULE_TARGETS (falls back to REMINDER_TARGETS). Skips silently if nothing's scheduled today. */
function postDailySchedule() {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const entries = getSchedule(today, today);
  if (entries.length === 0) return;

  const props = PropertiesService.getScriptProperties();
  const targets = props.getProperty('SCHEDULE_TARGETS') || props.getProperty('REMINDER_TARGETS');
  if (!targets) return;

  const lines = entries.map((e) => `• ${e.staffName}` + (e.shiftNote ? ` — ${e.shiftNote}` : ''));
  const message = `🗓️ Today's Showroom Schedule (${today}):\n\n${lines.join('\n')}`;
  try {
    sendFonnteMessage(targets, message);
  } catch (err) {
    Logger.log('Schedule post failed: %s', err);
  }
}

/** Runs everything the daily trigger is responsible for. One failure doesn't block the other. */
function runDailyAutomation() {
  try {
    sendDailyReminders();
  } catch (err) {
    Logger.log('sendDailyReminders failed: %s', err);
  }
  try {
    postDailySchedule();
  } catch (err) {
    Logger.log('postDailySchedule failed: %s', err);
  }
}

/** Run once (from the Apps Script editor) to schedule the 08:00 daily run. */
function createDailyTrigger() {
  deleteDailyTriggers();
  ScriptApp.newTrigger('runDailyAutomation').timeBased().everyDays(1).atHour(8).create();
}

function deleteDailyTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'runDailyAutomation') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// ---------------------------------------------------------------------------
// Reply-to-complete: Fonnte POSTs incoming WhatsApp messages here. A message
// starting with a task's [CODE] (see refCode()) completes that task, using
// the rest of the message as the completion report and any attached photo
// as optional proof. See the file header for the Fonnte-side setup this
// needs, and the README for the full walkthrough + a caveat: Fonnte's exact
// webhook field names are matched best-effort below (see EXTRA-field
// fallbacks) — check the Apps Script "Executions" log against a real
// incoming message and adjust extractX() below if a field isn't found.
// ---------------------------------------------------------------------------

function doPost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    const providedToken = e && e.parameter && e.parameter.token;
    if (!secret || providedToken !== secret) {
      return ContentService.createTextOutput('ignored').setMimeType(ContentService.MimeType.TEXT);
    }
    const body = parseIncomingPayload(e);
    Logger.log('Incoming WhatsApp webhook: %s', JSON.stringify(body));
    if (body) handleIncomingWhatsAppMessage(body);
  } catch (err) {
    Logger.log('doPost error: %s', err);
  }
  return ContentService.createTextOutput('ok').setMimeType(ContentService.MimeType.TEXT);
}

function parseIncomingPayload(e) {
  if (!e) return null;
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // Not JSON — fall through to form/query params below.
    }
  }
  if (e.parameter && Object.keys(e.parameter).length > 0) return e.parameter;
  return null;
}

/** Fonnte's field name for the message body — adjust here if logging shows a different one. */
function extractMessageText(body) {
  return body.message || body.text || body.pesan || '';
}

/** Fonnte's field name for the actual sender's number (in a group, distinct from the group ID) — adjust here if needed. */
function extractSenderPhone(body) {
  return body.member || body.sender_phone || body.phone || body.sender || '';
}

/** Fonnte's field name for an attached image's downloadable URL — adjust here if needed. */
function extractImageUrl(body) {
  const url = body.url || body.file || body.media || body.image || '';
  return url && /^https?:\/\//.test(url) ? url : '';
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.indexOf('0') === 0) return '62' + digits.slice(1);
  return digits;
}

function findPersonByPhone(phone) {
  const target = normalizePhone(phone);
  if (!target) return null;
  return getPeople().find((p) => normalizePhone(p.phone) === target) || null;
}

/** Active tasks not yet completed for their current occurrence — the candidate pool a reply (typed code or AI-matched) can resolve to. */
function getOpenTasksForMatching() {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return getTasks().filter((t) => {
    if (!t.active) return false;
    if (t.category === 'One-time') return t.status !== 'Done';
    return t.lastCompletedDate !== today;
  });
}

/**
 * Asks Groq to decide whether `text` is reporting completion of one of
 * `candidates`, and if so which one + a cleaned-up note. Returns
 * {code, note} or null (not confident / not about a task / API error).
 * The returned code is always re-validated against `candidates` — the
 * model can't complete a task that isn't actually in the list it was
 * given, even if it hallucinates a code.
 */
function interpretReplyWithAI(text, candidates, apiKey) {
  const list = candidates
    .map((t) => `${refCode(t.id)} | ${t.title} | ${t.category} | ${t.position} (${t.assigneeName})`)
    .join('\n');
  const systemPrompt =
    'You read one WhatsApp group message for a shop\'s task manager and decide whether it reports finishing one ' +
    'of these open tasks (CODE | Title | Category | Position (Assignee)):\n' + list + '\n\n' +
    'Reply with strict JSON only, no other text, matching exactly this shape: ' +
    '{"matched": true or false, "code": "<one of the CODEs above, or null>", "note": "<short clean summary of what they said they did, in the same language they used, or null>"}. ' +
    'Only set matched:true if the message clearly reports completing ONE specific task from the list above. ' +
    'Casual chat, questions, greetings, or messages unrelated to these tasks must get matched:false.';

  const response = UrlFetchApp.fetch(GROQ_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
    }),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    Logger.log('Groq API error %s: %s', response.getResponseCode(), response.getContentText());
    return null;
  }
  const data = JSON.parse(response.getContentText());
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    Logger.log('Groq returned non-JSON content: %s', content);
    return null;
  }
  if (!parsed.matched || !parsed.code) return null;

  const code = String(parsed.code).toUpperCase();
  if (candidates.every((t) => refCode(t.id) !== code)) return null; // hallucination guard
  return { code: code, note: parsed.note ? String(parsed.note).trim() : '' };
}

function handleIncomingWhatsAppMessage(body) {
  const text = String(extractMessageText(body) || '').trim();
  if (!text) return;

  const reminderTargets = PropertiesService.getScriptProperties().getProperty('REMINDER_TARGETS');
  const codeMatch = text.match(/^([0-9A-Fa-f]{6})\b\s*([\s\S]*)$/);

  let code, note;
  if (codeMatch) {
    code = codeMatch[1].toUpperCase();
    note = (codeMatch[2] || '').trim();
  } else {
    const groqApiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
    if (!groqApiKey) return; // No code, no AI configured — ordinary chat, ignore silently.
    const candidates = getOpenTasksForMatching();
    if (candidates.length === 0) return;
    let guess;
    try {
      guess = interpretReplyWithAI(text, candidates, groqApiKey);
    } catch (err) {
      Logger.log('interpretReplyWithAI failed: %s', err);
      return;
    }
    if (!guess) return; // Not confidently about a task — stay silent, don't spam ordinary chat.
    code = guess.code;
    note = guess.note;
  }

  const task = getTasks().find((t) => refCode(t.id) === code);
  if (!task) {
    if (codeMatch && reminderTargets) sendFonnteMessage(reminderTargets, `⚠️ No task found for code ${code}.`);
    return;
  }

  const senderPhone = extractSenderPhone(body);
  const person = findPersonByPhone(senderPhone);
  const who = person ? person.name : (senderPhone || 'Someone');
  const attributedNote = person ? note : `(from ${senderPhone || 'unknown number'}) ${note}`.trim();

  const imageUrl = extractImageUrl(body);
  let photoLine = '';
  if (imageUrl) {
    try {
      const fileUrl = saveIncomingTaskPhoto(imageUrl, task.title);
      photoLine = `\n📷 ${fileUrl}`;
    } catch (err) {
      Logger.log('Saving incoming photo failed: %s', err);
    }
  }

  completeTask(task.id, person ? person.id : '', (attributedNote + photoLine).trim());

  if (reminderTargets) {
    const lines = [`✅ ${who} marked "${task.title}" done.`];
    if (note) lines.push(`📝 ${note}`);
    if (imageUrl) lines.push(photoLine ? '📷 Photo saved.' : '📷 Photo received but could not be saved — check it manually.');
    sendFonnteMessage(reminderTargets, lines.join('\n'));
  }
}

function saveIncomingTaskPhoto(url, taskTitle) {
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const blob = response.getBlob();
  const folder = getTaskPhotosFolder();
  const file = folder.createFile(blob).setName(taskTitle + ' — ' + new Date().toISOString());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getTaskPhotosFolder() {
  const name = 'Task Manager Photos';
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
