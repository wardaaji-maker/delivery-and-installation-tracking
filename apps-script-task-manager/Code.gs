/**
 * Task Manager — Google Apps Script + Fonnte
 *
 * Storage: a "Tasks" sheet and a "People" sheet in the bound Google Sheet.
 * Reminders: sent via the Fonnte WhatsApp API (https://fonnte.com).
 *
 * Script Properties (Project Settings → Script Properties):
 *   FONNTE_TOKEN      - your Fonnte device token (required to send WhatsApp reminders)
 *   REMINDER_TARGETS  - comma-separated list of WhatsApp numbers and/or group
 *                       IDs that get the daily summary, e.g.
 *                       "628123456789,120363012345678901@g.us"
 *                       (find a group's ID in the Fonnte dashboard's device
 *                       group list, or from an inbound webhook payload).
 */

const TASKS_SHEET_NAME = 'Tasks';
const PEOPLE_SHEET_NAME = 'People';
const FONNTE_API_URL = 'https://api.fonnte.com/send';

const TASKS_HEADERS = [
  'ID', 'Title', 'Description', 'Priority', 'Category', 'Weekday',
  'DayOfMonth', 'DueDate', 'Position', 'AssigneeName', 'Active',
  'Status', 'LastCompletedDate', 'CreatedAt',
];
const PEOPLE_HEADERS = ['ID', 'Position', 'Name', 'Phone', 'Active', 'CreatedAt'];

const POSITIONS = ['Showroom Manager', 'Showroom Manager Partner', 'Product Consultant'];
const CATEGORIES = ['Daily Routine', 'Weekly', 'Monthly', 'One-time'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const PRIORITY_EMOJI = { High: '🔴', Medium: '🟡', Low: '🟢' };

function getTasksSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(TASKS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TASKS_SHEET_NAME);
    sheet.appendRow(TASKS_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getPeopleSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PEOPLE_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PEOPLE_SHEET_NAME);
    sheet.appendRow(PEOPLE_HEADERS);
    sheet.setFrozenRows(1);
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
  return { positions: POSITIONS, categories: CATEGORIES, weekdays: WEEKDAYS };
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
    }));
}

/** `person` = {position, name, phone} */
function addPerson(person) {
  if (!person || !person.name || !person.position) throw new Error('Name and position are required');
  const sheet = getPeopleSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([id, person.position, person.name, person.phone || '', true, new Date()]);
  return id;
}

/** `patch` = {name?, phone?, active?} */
function updatePerson(id, patch) {
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  if (patch.name !== undefined) sheet.getRange(row, 3).setValue(patch.name);
  if (patch.phone !== undefined) sheet.getRange(row, 4).setValue(patch.phone);
  if (patch.active !== undefined) sheet.getRange(row, 5).setValue(patch.active);
  return true;
}

function deletePerson(id) {
  const sheet = getPeopleSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
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
    }));
}

/**
 * Creates a task. `task` = {title, description, priority, category, weekday,
 * dayOfMonth, dueDate, position, assigneeName}. Which of weekday/dayOfMonth/
 * dueDate is used depends on category (Weekly/Monthly/One-time); Daily
 * Routine uses none of them.
 */
function addTask(task) {
  if (!task || !task.title) throw new Error('Title is required');
  if (CATEGORIES.indexOf(task.category) === -1) throw new Error('Invalid category');
  const sheet = getTasksSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    task.title,
    task.description || '',
    task.priority || 'Medium',
    task.category,
    task.category === 'Weekly' ? (task.weekday || '') : '',
    task.category === 'Monthly' ? (task.dayOfMonth || '') : '',
    task.category === 'One-time' ? (task.dueDate || '') : '',
    task.position || '',
    task.assigneeName || 'All',
    true,
    'Pending',
    '',
    new Date(),
  ]);
  return id;
}

/** For One-time tasks: Pending / In Progress / Done. */
function updateTaskStatus(id, status) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 12).setValue(status);
  return true;
}

/** For recurring tasks (Daily Routine/Weekly/Monthly): marks today's occurrence done. */
function markOccurrenceDone(id) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 13).setValue(new Date());
  return true;
}

/** Clears today's completion so the recurring task shows as pending again. */
function reopenOccurrence(id) {
  const sheet = getTasksSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 13).setValue('');
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

/** Phone numbers to notify for a task: the named person, or everyone active in its Position if AssigneeName is "All". */
function resolveRecipients(task, peopleByPosition) {
  const roster = peopleByPosition[task.position] || [];
  if (task.assigneeName && task.assigneeName !== 'All') {
    const person = roster.find((p) => p.name === task.assigneeName);
    return person && person.active && person.phone ? [person.phone] : [];
  }
  return roster.filter((p) => p.active && p.phone).map((p) => p.phone);
}

function isScheduledToday(task, today, todayWeekday, todayDayOfMonth) {
  if (task.category === 'Daily Routine') return true;
  if (task.category === 'Weekly') return task.weekday === todayWeekday;
  if (task.category === 'Monthly') return String(task.dayOfMonth) === String(todayDayOfMonth);
  if (task.category === 'One-time') return !!task.dueDate && task.dueDate <= today;
  return false;
}

/**
 * Sends WhatsApp reminders (via Fonnte) for every active task scheduled for
 * today and not yet done — one message per resolved recipient, plus a
 * category-grouped summary to REMINDER_TARGETS. Meant to run on a daily
 * time-based trigger (default 08:00, before operations start).
 */
function sendDailyReminders() {
  const tasks = getTasks().filter((t) => t.active);
  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  const todayWeekday = Utilities.formatDate(now, tz, 'EEEE');
  const todayDayOfMonth = Utilities.formatDate(now, tz, 'd');
  const reminderTargets = PropertiesService.getScriptProperties().getProperty('REMINDER_TARGETS');

  const people = getPeople();
  const peopleByPosition = {};
  people.forEach((p) => {
    if (!peopleByPosition[p.position]) peopleByPosition[p.position] = [];
    peopleByPosition[p.position].push(p);
  });

  const due = tasks.filter((task) => {
    if (!isScheduledToday(task, today, todayWeekday, todayDayOfMonth)) return false;
    if (task.category === 'One-time') return task.status !== 'Done';
    return task.lastCompletedDate !== today;
  });

  due.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));

  due.forEach((task) => {
    const recipients = resolveRecipients(task, peopleByPosition);
    if (recipients.length === 0) return;
    const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
    const overdue = task.category === 'One-time' && task.dueDate < today;
    const label = overdue ? 'OVERDUE' : task.category === 'One-time' ? 'DUE TODAY' : task.category.toUpperCase();
    const message = `${emoji} [${label}] ${task.title}\nPriority: ${task.priority}\nAssigned: ${task.assigneeName}`;
    try {
      sendFonnteMessage(recipients.join(','), message);
    } catch (err) {
      Logger.log('Reminder failed for task %s: %s', task.id, err);
    }
  });

  if (reminderTargets && due.length > 0) {
    const byCategory = {};
    due.forEach((task) => {
      if (!byCategory[task.category]) byCategory[task.category] = [];
      byCategory[task.category].push(task);
    });
    const sections = CATEGORIES.filter((cat) => byCategory[cat]).map((cat) => {
      const lines = byCategory[cat].map((task) => {
        const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
        return `${emoji} ${task.title} — ${task.priority} — ${task.position} (${task.assigneeName})`;
      });
      return `*${cat}*\n${lines.join('\n')}`;
    });
    const summary = `📋 Daily Task Summary — ${due.length} task(s) need attention:\n\n${sections.join('\n\n')}`;
    try {
      sendFonnteMessage(reminderTargets, summary);
    } catch (err) {
      Logger.log('Daily summary failed: %s', err);
    }
  }
}

/** Run once (from the Apps Script editor) to schedule the 08:00 daily reminder. */
function createDailyTrigger() {
  deleteDailyTriggers();
  ScriptApp.newTrigger('sendDailyReminders').timeBased().everyDays(1).atHour(8).create();
}

function deleteDailyTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'sendDailyReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
