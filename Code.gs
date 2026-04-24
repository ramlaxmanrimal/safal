// ══════════════════════════════════════════════════════════════
// सफल (SAFAL) — Google Apps Script Backend
// Service Accountability & File Action Log
// Developed by: Ramlaxman Innovations — for Nepal Government
// License: MIT
// ══════════════════════════════════════════════════════════════

// ── CONFIG ────────────────────────────────────────────────────
var SHEET_ID       = 'YOUR_GOOGLE_SHEET_ID_HERE'; // Replace with your Sheet ID
var SHEET_FILES    = 'files';
var SHEET_USERS    = 'users';
var SHEET_SETTINGS = 'settings';

// ── SERVE HTML ────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('सफल — Service Accountability & File Action Log')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ── HELPERS ───────────────────────────────────────────────────
function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

function generateId() {
  return Utilities.getUuid();
}

function hashPassword(pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    pw, Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function today() {
  return Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd');
}

function daysBetween(from, to) {
  var msPerDay = 86400000;
  return Math.floor((new Date(to) - new Date(from)) / msPerDay);
}

function getColor(days, settings) {
  if (days <= settings.green_threshold)  return 'green';
  if (days <= settings.yellow_threshold) return 'yellow';
  if (days <= settings.orange_threshold) return 'orange';
  return 'red';
}

// ── AUTH ──────────────────────────────────────────────────────
function login(username, password) {
  try {
    var sheet = getSheet(SHEET_USERS);
    var data  = sheet.getDataRange().getValues();
    var hashed = hashPassword(password);
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === username && data[i][1] === hashed) {
        return {
          success: true,
          user: { username: data[i][0], fullName: data[i][2], role: data[i][3] }
        };
      }
    }
    return { success: false, message: 'प्रयोगकर्ता नाम वा पासवर्ड गलत छ' };
  } catch(e) {
    return { success: false, message: 'सर्भरमा त्रुटि भयो: ' + e.message };
  }
}

function changePassword(username, oldPw, newPw) {
  try {
    var sheet = getSheet(SHEET_USERS);
    var data  = sheet.getDataRange().getValues();
    var oldHash = hashPassword(oldPw);
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === username && data[i][1] === oldHash) {
        sheet.getRange(i + 1, 2).setValue(hashPassword(newPw));
        return { success: true };
      }
    }
    return { success: false, message: 'हालको पासवर्ड गलत छ' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── SETTINGS ──────────────────────────────────────────────────
function getSettings() {
  try {
    var sheet = getSheet(SHEET_SETTINGS);
    var data  = sheet.getDataRange().getValues();
    return {
      green_threshold:  parseInt(data[1][0]) || 7,
      yellow_threshold: parseInt(data[1][1]) || 12,
      orange_threshold: parseInt(data[1][2]) || 15
    };
  } catch(e) {
    return { green_threshold: 7, yellow_threshold: 12, orange_threshold: 15 };
  }
}

function updateSettings(green, yellow, orange) {
  try {
    var sheet = getSheet(SHEET_SETTINGS);
    sheet.getRange(2, 1, 1, 3).setValues([[green, yellow, orange]]);
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── FILES ─────────────────────────────────────────────────────
/**
 * Get active files for a given role, paginated.
 * Columns: id, appNumber, subject, receiveDate, currentLevel,
 *           totalDays, levelDays, color, completedDate, remarks
 */
function getFiles(role, page, pageSize) {
  try {
    var settings = getSettings();
    var sheet = getSheet(SHEET_FILES);
    var data  = sheet.getDataRange().getValues();
    var todayStr = today();

    // Level map: which level can see which files
    var levelMap = { 'नायब सुब्बा': 1, 'शाखा अधिकृत': 2, 'निर्देशक': 3, 'admin': 0 };
    var userLevel = levelMap[role] || 0;

    var filtered = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // skip empty rows
      var completedDate = row[8] ? String(row[8]) : '';
      if (completedDate) continue; // skip completed files

      var currentLevel = parseInt(row[4]) || 1;
      // Admin sees all; others see only their level
      if (role !== 'admin' && currentLevel !== userLevel) continue;

      var receiveDate = row[3] ? String(row[3]).slice(0,10) : todayStr;
      var totalDays   = daysBetween(receiveDate, todayStr);
      var color       = getColor(totalDays, settings);

      filtered.push({
        id:           String(row[0]),
        appNumber:    String(row[1]),
        subject:      String(row[2]),
        receiveDate:  receiveDate,
        currentLevel: currentLevel,
        totalDays:    totalDays,
        levelDays:    parseInt(row[6]) || totalDays,
        color:        color,
        remarks:      String(row[9] || '')
      });
    }

    // Sort: red → orange → yellow → green, then by days desc
    var order = { red: 0, orange: 1, yellow: 2, green: 3 };
    filtered.sort(function(a, b) {
      return order[a.color] - order[b.color] || b.totalDays - a.totalDays;
    });

    var total      = filtered.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var start      = (page - 1) * pageSize;
    var files      = filtered.slice(start, start + pageSize);

    return { files: files, total: total, page: page, totalPages: totalPages, settings: settings };
  } catch(e) {
    return { error: e.message };
  }
}

function addFile(appNumber, subject, receiveDate, remarks) {
  try {
    var lock = LockService.getScriptLock();
    lock.tryLock(5000);
    var sheet = getSheet(SHEET_FILES);
    var id = generateId();
    sheet.appendRow([id, appNumber, subject, receiveDate, 1, 0, 0, 'green', '', remarks || '']);
    lock.releaseLock();
    return { success: true, id: id };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function forwardFile(fileId, role) {
  try {
    var lock = LockService.getScriptLock();
    lock.tryLock(5000);
    var sheet = getSheet(SHEET_FILES);
    var data  = sheet.getDataRange().getValues();
    var todayStr = today();
    var settings = getSettings();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(fileId)) {
        var currentLevel = parseInt(data[i][4]) || 1;
        var nextLevel    = currentLevel + 1;
        var receiveDate  = String(data[i][3]).slice(0,10);
        var totalDays    = daysBetween(receiveDate, todayStr);
        var color        = getColor(totalDays, settings);
        var completedDate = nextLevel > 3 ? todayStr : '';

        sheet.getRange(i + 1, 5).setValue(nextLevel);       // currentLevel
        sheet.getRange(i + 1, 6).setValue(totalDays);        // totalDays
        sheet.getRange(i + 1, 7).setValue(0);                // levelDays reset
        sheet.getRange(i + 1, 8).setValue(color);            // color
        if (completedDate) sheet.getRange(i + 1, 9).setValue(completedDate);

        lock.releaseLock();
        return { success: true };
      }
    }
    lock.releaseLock();
    return { success: false, message: 'फाइल भेटिएन' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

/**
 * Get completed files for admin/निर्देशक, paginated.
 */
function getCompletedFiles(page, pageSize) {
  try {
    var sheet = getSheet(SHEET_FILES);
    var data  = sheet.getDataRange().getValues();
    var completed = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      var completedDate = row[8] ? String(row[8]).slice(0,10) : '';
      if (!completedDate) continue;

      completed.push({
        id:            String(row[0]),
        appNumber:     String(row[1]),
        subject:       String(row[2]),
        receiveDate:   String(row[3]).slice(0,10),
        completedDate: completedDate,
        totalDays:     parseInt(row[5]) || 0,
        remarks:       String(row[9] || '')
      });
    }

    completed.sort(function(a, b) {
      return b.completedDate.localeCompare(a.completedDate);
    });

    var total      = completed.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize));
    var start      = (page - 1) * pageSize;
    return { files: completed.slice(start, start + pageSize), total: total, page: page, totalPages: totalPages };
  } catch(e) {
    return { error: e.message };
  }
}

// ══════════════════════════════════════════════════════════════
// GOOGLE SHEET SETUP GUIDE
// ══════════════════════════════════════════════════════════════
//
// Sheet: "users"
// Row 1 (header): username | password | fullName | role
// Row 2+: admin | <sha256_of_password> | Administrator | admin
//
// Sheet: "files"
// Row 1 (header): id | appNumber | subject | receiveDate |
//                 currentLevel | totalDays | levelDays | color |
//                 completedDate | remarks
//
// Sheet: "settings"
// Row 1 (header): green_threshold | yellow_threshold | orange_threshold
// Row 2:          7               | 12               | 15
//
// To hash a password for the users sheet, run this in GAS:
//   Logger.log(hashPassword('yourpassword'))
// ══════════════════════════════════════════════════════════════
