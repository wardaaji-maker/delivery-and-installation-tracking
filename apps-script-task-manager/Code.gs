/**
 * Task Manager — Google Apps Script + Fonnte
 *
 * Storage: a "Tasks" sheet in the bound Google Sheet.
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

const SHEET_NAME = 'Tasks';
const FONNTE_API_URL = 'https://api.fonnte.com/send';
const HEADERS = [
  'ID', 'Title', 'Description', 'Priority', 'DueDate', 'Status',
  'AssigneeName', 'AssigneePhone', 'CreatedAt', 'LastReminderAt',
];
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const PRIORITY_EMOJI = { High: '🔴', Medium: '🟡', Low: '🟢' };

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
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

/** Returns all tasks as plain objects, for the web app UI. */
function getTasks() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return data.slice(1)
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      title: row[1],
      description: row[2],
      priority: row[3],
      dueDate: row[4] ? Utilities.formatDate(new Date(row[4]), tz, 'yyyy-MM-dd') : '',
      status: row[5],
      assigneeName: row[6],
      assigneePhone: row[7],
      createdAt: row[8] ? Utilities.formatDate(new Date(row[8]), tz, 'yyyy-MM-dd HH:mm') : '',
    }));
}

/** Creates a task. `task` = {title, description, priority, dueDate, assigneeName, assigneePhone} */
function addTask(task) {
  if (!task || !task.title) throw new Error('Title is required');
  const sheet = getSheet();
  const id = Utilities.getUuid();
  sheet.appendRow([
    id,
    task.title,
    task.description || '',
    task.priority || 'Medium',
    task.dueDate || '',
    'Pending',
    task.assigneeName || '',
    task.assigneePhone || '',
    new Date(),
    '',
  ]);
  return id;
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1;
  }
  return -1;
}

function updateTaskStatus(id, status) {
  const sheet = getSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.getRange(row, 6).setValue(status);
  return true;
}

function deleteTask(id) {
  const sheet = getSheet();
  const row = findRowById(sheet, id);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

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

/**
 * Sends a WhatsApp reminder (via Fonnte) for every task that is due today or
 * overdue and not yet Done — one message per assignee, plus a summary sent
 * to everything in REMINDER_TARGETS (your number, a group, or both). Meant
 * to run on a daily time-based trigger.
 */
function sendDailyReminders() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const reminderTargets = PropertiesService.getScriptProperties().getProperty('REMINDER_TARGETS');

  const due = [];
  for (let i = 1; i < data.length; i++) {
    const [id, title, , priority, dueDate, status, assigneeName, assigneePhone] = data[i];
    if (!id || status === 'Done' || !dueDate) continue;
    const dueStr = Utilities.formatDate(new Date(dueDate), tz, 'yyyy-MM-dd');
    if (dueStr > today) continue;
    due.push({
      row: i + 1, id, title, priority: priority || 'Medium',
      dueDate: dueStr, assigneeName, assigneePhone,
      overdue: dueStr < today,
    });
  }

  due.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));

  due.forEach((task) => {
    if (task.assigneePhone) {
      const label = task.overdue ? 'OVERDUE' : 'DUE TODAY';
      const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
      const message = `${emoji} [${label}] ${task.title}\nPriority: ${task.priority}\nDue: ${task.dueDate}`;
      try {
        sendFonnteMessage(task.assigneePhone, message);
      } catch (err) {
        Logger.log('Reminder failed for task %s: %s', task.id, err);
      }
    }
    sheet.getRange(task.row, 10).setValue(new Date());
  });

  if (reminderTargets && due.length > 0) {
    const lines = due.map((task) => {
      const emoji = PRIORITY_EMOJI[task.priority] || '⚪';
      const label = task.overdue ? 'Overdue' : 'Due today';
      return `${emoji} ${task.title} — ${task.priority} — ${label} (${task.dueDate})`;
    });
    const summary = `📋 Daily Task Summary — ${due.length} task(s) need attention:\n\n${lines.join('\n')}`;
    try {
      sendFonnteMessage(reminderTargets, summary);
    } catch (err) {
      Logger.log('Daily summary failed: %s', err);
    }
  }
}

/** Run once (from the Apps Script editor) to schedule the 07:00 daily reminder. */
function createDailyTrigger() {
  deleteDailyTriggers();
  ScriptApp.newTrigger('sendDailyReminders').timeBased().everyDays(1).atHour(7).create();
}

function deleteDailyTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'sendDailyReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}
