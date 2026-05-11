// ============================================================
// सफल - Backend v4.0 — Reporting, Cache, Delayed Files, Share
// ============================================================

var FILES_SHEET     = 'Files';
var SETTINGS_SHEET  = 'Settings';
var USERS_SHEET     = 'Users';
var HIERARCHY_SHEET = 'Hierarchy';
var SUBJECTS_SHEET  = 'Subjects';
var COMPLETED_SHEET = 'Completed_Archive';  // NEW: auto-sync sheet for completed files
var CACHE_DURATION  = 120; // seconds

// ── Web App entry point ──────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('सफल — Service Accountability & File Action Log')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ── STEP 1: Run this once to initialize ─────────────────────
function initializeSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var fs = ss.getSheetByName(FILES_SHEET);
  if (!fs) {
    fs = ss.insertSheet(FILES_SHEET);
    fs.appendRow([
      'ID','Application Number','Subject','Receive Date',
      'Current Level','Status','Remarks','Added By','Added At',
      'L1 Start','L1 End','L1 Days','L1 User',
      'L2 Start','L2 End','L2 Days','L2 User',
      'L3 Start','L3 End','L3 Days','L3 User',
      'L4 Start','L4 End','L4 Days','L4 User',
      'Delay Reason','Expected Date','On Hold'  // col 28: On Hold flag
    ]);
    fs.setFrozenRows(1);
  } else {
    var lastCol = fs.getLastColumn();
    if (lastCol < 27) {
      fs.getRange(1, 26).setValue('Delay Reason');
      fs.getRange(1, 27).setValue('Expected Date');
    }
    if (lastCol < 28) {
      fs.getRange(1, 28).setValue('On Hold');
    }
  }

  // Completed Archive sheet
  _ensureCompletedSheet(ss);

  var st = ss.getSheetByName(SETTINGS_SHEET);
  if (!st) {
    st = ss.insertSheet(SETTINGS_SHEET);
    st.appendRow(['Key','Value']);
    st.appendRow(['green_threshold',  7]);
    st.appendRow(['yellow_threshold', 12]);
    st.appendRow(['orange_threshold', 15]);
  }

  var hs = ss.getSheetByName(HIERARCHY_SHEET);
  if (!hs) {
    hs = ss.insertSheet(HIERARCHY_SHEET);
    hs.appendRow(['Level','Role Name','Active']);
    hs.appendRow([1, 'नायब सुब्बा', 'TRUE']);
    hs.appendRow([2, 'शाखा अधिकृत', 'TRUE']);
    hs.appendRow([3, 'निर्देशक', 'TRUE']);
  }

  var subjs = ss.getSheetByName(SUBJECTS_SHEET);
  if (!subjs) {
    subjs = ss.insertSheet(SUBJECTS_SHEET);
    subjs.appendRow(['Subject Name', 'Active', 'Order']);
    subjs.appendRow(['अन्तर महसुल तथा अन्तरराज्य किनारा बारे', 'TRUE', 1]);
    subjs.appendRow(['प्रतिलिपि अधिकार', 'TRUE', 2]);
    subjs.appendRow(['राजस्व छानबिन', 'TRUE', 3]);
    subjs.appendRow(['सेवा सम्बन्धि', 'TRUE', 4]);
    subjs.appendRow(['प्रशासन', 'TRUE', 5]);
    subjs.appendRow(['बजेट तथा योजना', 'TRUE', 6]);
    subjs.appendRow(['अन्य', 'TRUE', 7]);
  }

  var us = ss.getSheetByName(USERS_SHEET);
  if (!us) {
    us = ss.insertSheet(USERS_SHEET);
  }
  us.clearContents();
  us.appendRow(['Username','Password','Role','Full Name','Active','Hierarchy Level','Email']);

  var h1 = _hash('subba123');
  var h2 = _hash('shakha123');
  var h3 = _hash('nirdeshak123');
  var h4 = _hash('admin123');

  // Level 1 — can add multiple नायब सुब्बा (1A, 1B, 1C...)
  us.appendRow(['subba1',    h1, 'नायब सुब्बा',  'नायब सुब्बा (क)',  'TRUE', 1, '']);
  us.appendRow(['subba2',    h1, 'नायब सुब्बा',  'नायब सुब्बा (ख)',  'TRUE', 1, '']);
  // Level 2 — can add multiple शाखा अधिकृत (2A, 2B...)
  us.appendRow(['shakha1',   h2, 'शाखा अधिकृत', 'शाखा अधिकृत (क)', 'TRUE', 2, '']);
  us.appendRow(['shakha2',   h2, 'शाखा अधिकृत', 'शाखा अधिकृत (ख)', 'TRUE', 2, '']);
  // Level 3 — निर्देशक
  us.appendRow(['nirdeshak', h3, 'निर्देशक',     'निर्देशक',         'TRUE', 3, '']);
  us.appendRow(['admin',     h4, 'admin',        'Administrator',    'TRUE', 0, '']);

  Logger.log('=== SETUP COMPLETE v4.1 — Multi-user per level ===');
  Logger.log('subba1 / subba123  (Level 1-A)');
  Logger.log('subba2 / subba123  (Level 1-B)');
  Logger.log('shakha1 / shakha123 (Level 2-A)');
  Logger.log('shakha2 / shakha123 (Level 2-B)');
  Logger.log('nirdeshak / nirdeshak123 (Level 3)');
  Logger.log('admin / admin123');
}

// ── Completed Archive Sheet ───────────────────────────────────
function _ensureCompletedSheet(ss) {
  var cs = ss.getSheetByName(COMPLETED_SHEET);
  if (!cs) {
    cs = ss.insertSheet(COMPLETED_SHEET);
    cs.appendRow([
      'ID','Application Number','Subject','Receive Date','Completed Date',
      'Total Days','Delay Reason','Expected Date',
      'L1 Days','L2 Days','L3 Days','L4 Days',
      'Added By','Synced At'
    ]);
    cs.setFrozenRows(1);
  }
  return cs;
}

// ── Sync completed file to archive sheet ────────────────────
function _syncToCompletedSheet(fileRow, hier) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cs = _ensureCompletedSheet(ss);

    // Check if already synced
    var lastRow = cs.getLastRow();
    if (lastRow > 1) {
      var existingIds = cs.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < existingIds.length; i++) {
        if (parseInt(existingIds[i][0]) === parseInt(fileRow[0])) return; // already synced
      }
    }

    var completedDate = '';
    var levelDays = [0,0,0,0];
    hier.forEach(function(h) {
      var off = 9 + (h.level - 1) * 4;
      if (fileRow[off+1]) completedDate = _fmt(fileRow[off+1]);
      levelDays[h.level - 1] = (fileRow[off+2] !== '' && fileRow[off+2] != null) ? Number(fileRow[off+2]) : 0;
    });

    var totalDays = 0;
    for (var i = 0; i < 4; i++) totalDays += levelDays[i];

    var receiveDate = fileRow[3] ? new Date(fileRow[3]) : null;
    if (!completedDate && receiveDate) {
      totalDays = _dateDiff(receiveDate, new Date());
    }

    cs.appendRow([
      fileRow[0], fileRow[1], fileRow[2],
      _fmt(fileRow[3]), completedDate,
      totalDays,
      fileRow[25] || '', fileRow[26] || '',
      levelDays[0], levelDays[1], levelDays[2], levelDays[3],
      fileRow[7], _today()
    ]);
  } catch(e) {
    Logger.log('Sync error: ' + e.message);
  }
}

// ── Hash ─────────────────────────────────────────────────────
function _hash(pw) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pw, Utilities.Charset.UTF_8)
  );
}

// ── Date helpers ─────────────────────────────────────────────
function _dateDiff(a, b) {
  var da = new Date(a); da.setHours(0,0,0,0);
  var db = new Date(b); db.setHours(0,0,0,0);
  return Math.max(0, Math.floor((db - da) / 86400000));
}

function _fmt(d) {
  if (!d || d === '') return '';
  try {
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return Utilities.formatDate(dt, 'Asia/Kathmandu', 'yyyy-MM-dd');
  } catch(e) {
    return String(d).slice(0,10);
  }
}

function _today() {
  return Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd');
}

// ── Cache helpers ────────────────────────────────────────────
function _cacheGet(key) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get(key);
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

function _cacheSet(key, data) {
  try {
    var cache = CacheService.getScriptCache();
    var str = JSON.stringify(data);
    if (str.length < 100000) { // 100KB limit per entry
      cache.put(key, str, CACHE_DURATION);
    }
  } catch(e) {}
}

function _cacheInvalidate() {
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll(['active_files_0','active_files_1','active_files_2','active_files_3',
                     'completed_files','user_report','settings','hierarchy','subjects']);
  } catch(e) {}
}

// ── Login ────────────────────────────────────────────────────
function login(username, password) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    if (!sheet) return { success: false, message: 'Users sheet नभेटिएको।' };
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'कुनै प्रयोगकर्ता छैन।' };
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    var hash = _hash(String(password));
    for (var i = 1; i < data.length; i++) {
      var uname  = String(data[i][0] || '').trim();
      var stored = String(data[i][1] || '').trim();
      var role   = String(data[i][2] || '').trim();
      var full   = String(data[i][3] || '').trim();
      var active = String(data[i][4] || '').trim().toUpperCase();
      var hlevel = parseInt(data[i][5]) || 0;
      if (uname === String(username).trim() && stored === hash && active === 'TRUE') {
        return { success: true, user: { username: uname, role: role, fullName: full, hierarchyLevel: hlevel } };
      }
    }
    return { success: false, message: 'प्रयोगकर्ता नाम वा पासवर्ड गलत छ।' };
  } catch(err) {
    return { success: false, message: 'Server Error: ' + err.message };
  }
}

// ── Get all active users at a specific hierarchy level ────────
function getUsersAtLevel(level) {
  try {
    var users = getAllUsers();
    return users.filter(function(u) {
      return u.hierarchyLevel === parseInt(level) && u.active && u.username !== 'admin';
    }).map(function(u) {
      return { username: u.username, fullName: u.fullName, role: u.role, hierarchyLevel: u.hierarchyLevel };
    });
  } catch(e) {
    return [];
  }
}

// ── Get users at next level for a given file ─────────────────
function getNextLevelUsers(fileId) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { users: [], nextLevel: -1, nextLevelName: '' };
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 5).getValues();
    var hier = getHierarchy();
    var currentLevel = 1;
    for (var i = 1; i < data.length; i++) {
      if (parseInt(data[i][0]) === parseInt(fileId)) {
        currentLevel = parseInt(data[i][4]) || 1;
        break;
      }
    }
    var activeHier = hier.filter(function(h) { return h.active; }).sort(function(a, b) { return a.level - b.level; });
    var nextLevel = -1, nextLevelName = 'सम्पन्न';
    for (var i = 0; i < activeHier.length; i++) {
      if (activeHier[i].level === currentLevel && i + 1 < activeHier.length) {
        nextLevel = activeHier[i+1].level;
        nextLevelName = activeHier[i+1].roleName;
        break;
      }
    }
    if (nextLevel === -1) return { users: [], nextLevel: -1, nextLevelName: 'सम्पन्न' };
    return { users: getUsersAtLevel(nextLevel), nextLevel: nextLevel, nextLevelName: nextLevelName };
  } catch(e) {
    return { users: [], nextLevel: -1, nextLevelName: 'सम्पन्न', error: e.message };
  }
}

// ── Compatibility wrappers ───────────────────────────────────
function getFiles(role, hierarchyLevel, username, page, pageSize) {
  var level = (role === 'admin') ? 0 : parseInt(hierarchyLevel) || 0;
  var uname = (role === 'admin') ? '' : (username || '');
  var result = getActiveFiles(page, pageSize, level, uname);
  if (result.files) {
    result.files.forEach(function(f) {
      f.color = f.colorClass || 'green';
    });
  }
  result.settings = getSettings();
  return result;
}

function getCompletedFiles(page, pageSize) {
  try {
    var cacheKey = 'completed_files_' + page + '_' + pageSize;
    var cached = _cacheGet(cacheKey);
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    var hier  = getHierarchy();
    if (!sheet) return { files:[], total:0, page:1, totalPages:1, hierarchy:hier };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { files:[], total:0, page:1, totalPages:1, hierarchy:hier };

    var data  = sheet.getRange(1, 1, lastRow, 28).getValues();
    var files = [];

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0] || String(r[5]) !== 'Completed') continue;

      var levelSummary = [];
      var completedDate = '';
      hier.forEach(function(h) {
        var off  = 9 + (h.level - 1) * 4;
        var days = (r[off+2] !== '' && r[off+2] != null) ? Number(r[off+2]) : 0;
        levelSummary.push({ level: h.level, days: days });
        if (r[off+1]) completedDate = _fmt(r[off+1]);
      });

      var totalDays = 0;
      levelSummary.forEach(function(ls){ totalDays += ls.days; });

      files.push({
        id:            parseInt(r[0]),
        appNumber:     String(r[1] || ''),
        subject:       String(r[2] || ''),
        receiveDate:   _fmt(r[3]),
        completedDate: completedDate,
        totalDays:     totalDays,
        delayReason:   String(r[25] || ''),
        expectedDate:  _fmt(r[26]),
        levelSummary:  levelSummary
      });
    }

    files.sort(function(a,b){ return b.id - a.id; });

    var total = files.length;
    var start = (page - 1) * pageSize;
    var result = {
      files:      files.slice(start, start + pageSize),
      total:      total,
      page:       page,
      totalPages: Math.ceil(total / pageSize) || 1,
      hierarchy:  hier
    };
    _cacheSet(cacheKey, result);
    return result;
  } catch(e) {
    return { files:[], total:0, page:1, totalPages:1, error: e.message, hierarchy:[] };
  }
}

function forwardFile(fileId, role, hierarchyLevel, username, targetUsername) {
  var hier = getHierarchy();
  var roleName = role;
  for (var i = 0; i < hier.length; i++) {
    if (hier[i].level === parseInt(hierarchyLevel)) {
      roleName = hier[i].roleName;
      break;
    }
  }
  return updateFileProgress(
    fileId, 'forward', '', '', '',
    { username: username, role: roleName, hierarchyLevel: parseInt(hierarchyLevel) },
    targetUsername || ''
  );
}

// ── Mark file On Hold (skip from main list, count separately) ─
function setFileOnHold(fileId, onHold, currentUser) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { success: false, message: 'Files sheet छैन।' };
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var i = 1; i < data.length; i++) {
      if (parseInt(data[i][0]) === parseInt(fileId)) {
        sheet.getRange(i + 1, 28).setValue(onHold ? 'TRUE' : '');
        _cacheInvalidate();
        return { success: true };
      }
    }
    return { success: false, message: 'फाइल भेटिएन।' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Delay Report: files not finished on time ─────────────────
function getDelayReport(page, pageSize) {
  try {
    page     = page     || 1;
    pageSize = pageSize || 20;

    var cacheKey = 'delay_report_' + page + '_' + pageSize;
    var cached = _cacheGet(cacheKey);
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    var hier  = getHierarchy();
    var sets  = getSettings();
    if (!sheet) return { files:[], total:0, onHoldCount:0, page:1, totalPages:1, hierarchy:hier };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { files:[], total:0, onHoldCount:0, page:1, totalPages:1, hierarchy:hier };

    var data  = sheet.getRange(1, 1, lastRow, 28).getValues();
    var today = new Date(); today.setHours(0,0,0,0);
    var delayedFiles = [];
    var onHoldCount  = 0;

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0] || String(r[5]) === 'Completed') continue;

      var receiveDate  = r[3] ? new Date(r[3]) : null;
      var totalDays    = receiveDate ? _dateDiff(receiveDate, today) : 0;
      var expectedDate = r[26] ? _fmt(r[26]) : '';
      var delayReason  = String(r[25] || '');
      var onHold       = String(r[27] || '').toUpperCase() === 'TRUE';
      var currentLevel = parseInt(r[4]) || 1;

      if (onHold) { onHoldCount++; continue; }

      // "Delayed" = over orange threshold OR has an expected date that has passed
      var isDelayed = totalDays > sets.orange_threshold;
      if (expectedDate) {
        var expDate = new Date(expectedDate); expDate.setHours(0,0,0,0);
        if (expDate < today) isDelayed = true;
      }
      if (!isDelayed) continue;

      var daysOverdue = 0;
      if (expectedDate) {
        var expD = new Date(expectedDate); expD.setHours(0,0,0,0);
        daysOverdue = Math.max(0, _dateDiff(expD, today));
      }

      var levelOffset = 9 + (currentLevel - 1) * 4;
      var levelStart  = r[levelOffset] || '';
      var levelDays   = levelStart ? _dateDiff(levelStart, today) : 0;

      delayedFiles.push({
        id:           parseInt(r[0]),
        appNumber:    String(r[1] || ''),
        subject:      String(r[2] || ''),
        receiveDate:  _fmt(r[3]),
        currentLevel: currentLevel,
        status:       String(r[5] || 'Active'),
        totalDays:    totalDays,
        levelDays:    levelDays,
        delayReason:  delayReason,
        expectedDate: expectedDate,
        daysOverdue:  daysOverdue,
        addedBy:      String(r[7] || '')
      });
    }

    delayedFiles.sort(function(a,b){ return b.totalDays - a.totalDays; });

    var total  = delayedFiles.length;
    var start  = (page - 1) * pageSize;
    var result = {
      files:       delayedFiles.slice(start, start + pageSize),
      total:       total,
      onHoldCount: onHoldCount,
      page:        page,
      totalPages:  Math.ceil(total / pageSize) || 1,
      hierarchy:   hier,
      settings:    sets
    };
    _cacheSet(cacheKey, result);
    return result;
  } catch(e) {
    return { files:[], total:0, onHoldCount:0, page:1, totalPages:1, error: e.message, hierarchy:[] };
  }
}

// ── Update Delay Info on an existing file ────────────────────
function updateFileDelayInfo(fileId, delayReason, expectedDate, currentUser) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { success: false, message: 'Files sheet छैन।' };
    var lastRow = sheet.getLastRow();
    var data    = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var i = 1; i < data.length; i++) {
      if (parseInt(data[i][0]) === parseInt(fileId)) {
        if (delayReason !== undefined) sheet.getRange(i + 1, 26).setValue(delayReason);
        if (expectedDate)              sheet.getRange(i + 1, 27).setValue(_fmt(expectedDate));
        _cacheInvalidate();
        return { success: true };
      }
    }
    return { success: false, message: 'फाइल भेटिएन।' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Subjects ─────────────────────────────────────────────────
function getSubjects() {
  try {
    var cached = _cacheGet('subjects');
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SUBJECTS_SHEET);
    var defaults = [
      { name: 'अन्तर महसुल तथा अन्तरराज्य किनारा बारे', active: true, order: 1 },
      { name: 'प्रतिलिपि अधिकार', active: true, order: 2 },
      { name: 'राजस्व छानबिन', active: true, order: 3 },
      { name: 'सेवा सम्बन्धि', active: true, order: 4 },
      { name: 'प्रशासन', active: true, order: 5 },
      { name: 'बजेट तथा योजना', active: true, order: 6 },
      { name: 'अन्य', active: true, order: 7 }
    ];
    if (!sheet) return defaults;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return defaults;
    var data = sheet.getRange(1, 1, lastRow, 3).getValues();
    var subjects = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      subjects.push({
        name:   String(data[i][0] || ''),
        active: String(data[i][1] || 'TRUE').toUpperCase() === 'TRUE',
        order:  parseInt(data[i][2]) || i
      });
    }
    subjects.sort(function(a, b) { return a.order - b.order; });
    _cacheSet('subjects', subjects);
    return subjects;
  } catch(e) {
    return [{ name: 'अन्य', active: true, order: 1 }];
  }
}

function saveSubjects(subjects) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SUBJECTS_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(SUBJECTS_SHEET);
      sheet.appendRow(['Subject Name', 'Active', 'Order']);
    }
    var last = sheet.getLastRow();
    if (last > 1) sheet.getRange(2, 1, last - 1, 3).clearContent();
    for (var i = 0; i < subjects.length; i++) {
      sheet.appendRow([subjects[i].name, subjects[i].active ? 'TRUE' : 'FALSE', subjects[i].order]);
    }
    _cacheInvalidate();
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function addSubject(subjectName) {
  try {
    var subjects = getSubjects();
    var maxOrder = 0;
    for (var i = 0; i < subjects.length; i++) {
      if (subjects[i].name === subjectName) return { success: false, message: 'यो विषय पहिले नै अवस्थित छ।' };
      if (subjects[i].order > maxOrder) maxOrder = subjects[i].order;
    }
    subjects.push({ name: subjectName, active: true, order: maxOrder + 1 });
    return saveSubjects(subjects);
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function deleteSubject(subjectName) {
  try {
    var subjects = getSubjects();
    var filtered = subjects.filter(function(s){ return s.name !== subjectName; });
    if (filtered.length === subjects.length) return { success: false, message: 'विषय भेटिएन।' };
    filtered.forEach(function(s, i){ s.order = i + 1; });
    return saveSubjects(filtered);
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Hierarchy ────────────────────────────────────────────────
function getHierarchy() {
  try {
    var cached = _cacheGet('hierarchy');
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HIERARCHY_SHEET);
    var defaults = [
      {level:1,roleName:'नायब सुब्बा',active:true},
      {level:2,roleName:'शाखा अधिकृत',active:true},
      {level:3,roleName:'निर्देशक',active:true}
    ];
    if (!sheet) return defaults;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return defaults;
    var data = sheet.getRange(1, 1, lastRow, 3).getValues();
    var levels = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      levels.push({
        level:    parseInt(data[i][0]),
        roleName: String(data[i][1] || ''),
        active:   String(data[i][2] || 'TRUE').toUpperCase() === 'TRUE'
      });
    }
    levels.sort(function(a,b){ return a.level - b.level; });
    _cacheSet('hierarchy', levels);
    return levels;
  } catch(e) {
    return [{level:1,roleName:'नायब सुब्बा',active:true},{level:2,roleName:'शाखा अधिकृत',active:true},{level:3,roleName:'निर्देशक',active:true}];
  }
}

function saveHierarchy(levels) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(HIERARCHY_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(HIERARCHY_SHEET);
      sheet.appendRow(['Level','Role Name','Active']);
    }
    var last = sheet.getLastRow();
    if (last > 1) sheet.getRange(2, 1, last - 1, 3).clearContent();
    for (var i = 0; i < levels.length; i++) {
      sheet.appendRow([levels[i].level, levels[i].roleName, levels[i].active ? 'TRUE' : 'FALSE']);
    }
    _cacheInvalidate();
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Settings ─────────────────────────────────────────────────
function getSettings() {
  try {
    var cached = _cacheGet('settings');
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
    if (!sheet) return { green_threshold: 7, yellow_threshold: 12, orange_threshold: 15 };
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { green_threshold: 7, yellow_threshold: 12, orange_threshold: 15 };
    var data = sheet.getRange(1, 1, lastRow, 2).getValues();
    var cfg = {};
    for (var i = 1; i < data.length; i++) {
      var k = String(data[i][0] || '').trim();
      if (k) cfg[k] = data[i][1];
    }
    var result = {
      green_threshold:  parseInt(cfg.green_threshold)  || 7,
      yellow_threshold: parseInt(cfg.yellow_threshold) || 12,
      orange_threshold: parseInt(cfg.orange_threshold) || 15
    };
    _cacheSet('settings', result);
    return result;
  } catch(e) {
    return { green_threshold: 7, yellow_threshold: 12, orange_threshold: 15 };
  }
}

function updateSettings(g, y, o) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET);
    if (!sheet) return { success: false, message: 'Settings sheet छैन।' };
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 2).getValues();
    var rowMap = {};
    for (var i = 1; i < data.length; i++) {
      var k = String(data[i][0] || '').trim();
      if (k) rowMap[k] = i + 1;
    }
    if (rowMap.green_threshold)  sheet.getRange(rowMap.green_threshold,  2).setValue(g);
    if (rowMap.yellow_threshold) sheet.getRange(rowMap.yellow_threshold, 2).setValue(y);
    if (rowMap.orange_threshold) sheet.getRange(rowMap.orange_threshold, 2).setValue(o);
    _cacheInvalidate();
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── User Management ──────────────────────────────────────────
function getAllUsers() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    var users = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      users.push({
        rowIndex:       i + 1,
        username:       String(data[i][0] || ''),
        role:           String(data[i][2] || ''),
        fullName:       String(data[i][3] || ''),
        active:         String(data[i][4] || 'TRUE').toUpperCase() === 'TRUE',
        hierarchyLevel: parseInt(data[i][5]) || 0,
        email:          String(data[i][6] || '')
      });
    }
    return users;
  } catch(e) {
    return [];
  }
}

function createUser(username, password, fullName, hierarchyLevel, email) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    if (!sheet) return { success: false, message: 'Users sheet छैन।' };
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toLowerCase() === String(username).trim().toLowerCase()) {
        return { success: false, message: 'यो प्रयोगकर्ता नाम पहिले नै अवस्थित छ।' };
      }
    }
    var hier = getHierarchy();
    var roleName = 'User';
    for (var i = 0; i < hier.length; i++) {
      if (hier[i].level === hierarchyLevel) { roleName = hier[i].roleName; break; }
    }
    sheet.appendRow([username, _hash(String(password)), roleName, fullName, 'TRUE', hierarchyLevel, email]);
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function updateUser(username, fullName, hierarchyLevel, active, email) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    var hier = getHierarchy();
    var roleName = 'User';
    for (var i = 0; i < hier.length; i++) {
      if (hier[i].level === hierarchyLevel) { roleName = hier[i].roleName; break; }
    }
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === username) {
        sheet.getRange(i+1, 3).setValue(roleName);
        sheet.getRange(i+1, 4).setValue(fullName);
        sheet.getRange(i+1, 5).setValue(active ? 'TRUE' : 'FALSE');
        sheet.getRange(i+1, 6).setValue(hierarchyLevel);
        sheet.getRange(i+1, 7).setValue(email);
        return { success: true };
      }
    }
    return { success: false, message: 'प्रयोगकर्ता भेटिएन।' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function resetUserPassword(username, newPw) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === username) {
        sheet.getRange(i+1, 2).setValue(_hash(newPw));
        return { success: true };
      }
    }
    return { success: false, message: 'प्रयोगकर्ता भेटिएन।' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function deleteUser(username) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    var lastRow = sheet.getLastRow();
    var data = sheet.getRange(1, 1, lastRow, 7).getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === username) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, message: 'प्रयोगकर्ता भेटिएन।' };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function changePassword(username, oldPw, newPw) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    var lastRow = sheet.getLastRow();
    var data  = sheet.getRange(1, 1, lastRow, 7).getValues();
    var oldH  = _hash(oldPw);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === username && String(data[i][1]).trim() === oldH) {
        sheet.getRange(i+1, 2).setValue(_hash(newPw));
        return { success: true };
      }
    }
    return { success: false, message: 'पुरानो पासवर्ड मिलेन।' };
  } catch(err) {
    return { success: false, message: err.message };
  }
}

// ── File Management ───────────────────────────────────────────
function addFile(appNumber, subject, receiveDate, remarks, delayReason, expectedDate, currentUser) {
  try {
    if (!receiveDate || receiveDate === '') return { success: false, message: 'दर्ता मिति आवश्यक छ।' };
    var recDateObj = new Date(receiveDate);
    if (isNaN(recDateObj.getTime())) return { success: false, message: 'अवैध मिति ढाँचा।' };

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { success: false, message: 'Files sheet छैन।' };

    var lastRow = sheet.getLastRow();
    var newId   = lastRow;
    var addedAt = new Date();

    var uname = (typeof currentUser === 'object') ? currentUser.username : String(currentUser || '');

    var row = [
      newId, appNumber, subject, _fmt(receiveDate),
      1, 'Active', remarks || '', uname, _fmt(addedAt),
      _fmt(addedAt), '', '', uname,
      '','','','',
      '','','','',
      '','','','',
      delayReason || '',
      expectedDate ? _fmt(expectedDate) : '',
      ''   // On Hold = empty
    ];

    sheet.appendRow(row);
    _cacheInvalidate();
    return { success: true, id: newId };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

function updateFileProgress(fileId, action, remarks, delayReason, expectedDate, currentUser, targetUsername) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { success: false, message: 'Files sheet छैन।' };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: 'कुनै फाइल छैन।' };

    var data = sheet.getRange(1, 1, lastRow, 28).getValues();
    var hier = getHierarchy();
    var targetRow = -1;

    for (var i = 1; i < data.length; i++) {
      if (parseInt(data[i][0]) === parseInt(fileId)) { targetRow = i; break; }
    }
    if (targetRow === -1) return { success: false, message: 'फाइल भेटिएन।' };

    var row          = data[targetRow];
    var currentLevel = parseInt(row[4]) || 1;
    var status       = String(row[5]);

    if (status === 'Completed') return { success: false, message: 'फाइल पहिले नै सम्पन्न छ।' };

    var now      = new Date();
    var nowStr   = _fmt(now);
    var actualRow = targetRow + 1;

    if (action === 'forward') {
      var authorized = false;
      for (var i = 0; i < hier.length; i++) {
        if (hier[i].level === currentLevel && hier[i].roleName === currentUser.role) {
          authorized = true; break;
        }
      }
      if (!authorized && currentUser.role !== 'admin') {
        return { success: false, message: 'तपाईंलाई यो स्तरमा फाइल अगाडि बढाउन अधिकार छैन।' };
      }

      var levelOffset = 9 + (currentLevel - 1) * 4;
      var levelStart  = row[levelOffset] ? new Date(row[levelOffset]) : now;
      var levelDays   = _dateDiff(levelStart, now);

      sheet.getRange(actualRow, levelOffset + 2).setValue(nowStr);
      sheet.getRange(actualRow, levelOffset + 3).setValue(levelDays);

      var nextLevel = currentLevel + 1;
      var maxLevel  = hier.length;

      if (nextLevel > maxLevel) {
        sheet.getRange(actualRow, 6).setValue('Completed');
        // Clear On Hold flag on completion
        sheet.getRange(actualRow, 28).setValue('');
        if (remarks) sheet.getRange(actualRow, 7).setValue(remarks);
        // Auto-sync to completed archive
        var updatedRow = sheet.getRange(actualRow, 1, 1, 28).getValues()[0];
        _syncToCompletedSheet(updatedRow, hier);
      } else {
        sheet.getRange(actualRow, 5).setValue(nextLevel);
        var nextLevelOffset = 9 + (nextLevel - 1) * 4;
        sheet.getRange(actualRow, nextLevelOffset + 1).setValue(nowStr);
        sheet.getRange(actualRow, nextLevelOffset + 4).setValue(targetUsername || '');
        if (remarks) sheet.getRange(actualRow, 7).setValue(remarks);
      }
    } else if (action === 'complete') {
      var levelOffset = 9 + (currentLevel - 1) * 4;
      var levelStart  = row[levelOffset] ? new Date(row[levelOffset]) : now;
      sheet.getRange(actualRow, levelOffset + 2).setValue(nowStr);
      sheet.getRange(actualRow, levelOffset + 3).setValue(_dateDiff(levelStart, now));
      sheet.getRange(actualRow, 6).setValue('Completed');
      sheet.getRange(actualRow, 28).setValue('');
      if (remarks) sheet.getRange(actualRow, 7).setValue(remarks);
      var updatedRow2 = sheet.getRange(actualRow, 1, 1, 28).getValues()[0];
      _syncToCompletedSheet(updatedRow2, hier);
    }

    if (delayReason !== undefined && delayReason !== null) sheet.getRange(actualRow, 26).setValue(delayReason);
    if (expectedDate) sheet.getRange(actualRow, 27).setValue(_fmt(expectedDate));

    _cacheInvalidate();
    return { success: true };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Get Active Files (with cache + on-hold count + user filter) ─
function getActiveFiles(page, pageSize, hierarchyLevel, username) {
  try {
    var uname = username || '';
    var cacheKey = 'active_files_' + hierarchyLevel + '_' + uname + '_' + page + '_' + pageSize;
    var cached = _cacheGet(cacheKey);
    if (cached) return cached;

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    var hier  = getHierarchy();
    var sets  = getSettings();

    if (!sheet) return { files:[], total:0, onHoldCount:0, page:1, pageSize:20, totalPages:1, hierarchy:hier };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { files:[], total:0, onHoldCount:0, page:1, pageSize:20, totalPages:1, hierarchy:hier };

    var data  = sheet.getRange(1, 1, lastRow, 28).getValues();
    var today = new Date(); today.setHours(0,0,0,0);
    var files = [];
    var onHoldCount = 0;

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0] || String(r[5]) === 'Completed') continue;

      var currentLevel = parseInt(r[4]) || 1;
      if (hierarchyLevel !== 0 && currentLevel !== hierarchyLevel) continue;

      // ── Filter by assigned user ──────────────────────────────
      // L{N}User is at 0-indexed position: (9 + (level-1)*4) + 3
      // Sheet col (1-indexed): levelOffset+4 where levelOffset = 9+(level-1)*4
      if (hierarchyLevel !== 0 && uname !== '') {
        var userColIdx = 9 + (currentLevel - 1) * 4 + 3; // 0-indexed in data array
        var fileAssignee = String(r[userColIdx] || '').trim();
        // Only show if: assigned to this user OR unassigned (backward compat)
        if (fileAssignee !== '' && fileAssignee !== uname) continue;
      }

      var onHold = String(r[27] || '').toUpperCase() === 'TRUE';
      if (onHold) { onHoldCount++; continue; }

      var receiveDate = r[3] ? new Date(r[3]) : null;
      var totalDays   = receiveDate ? _dateDiff(receiveDate, today) : 0;

      var levelOffset = 9 + (currentLevel - 1) * 4;
      var levelStart  = r[levelOffset] || '';
      var levelDays   = levelStart ? _dateDiff(levelStart, today) : 0;
      var assignedTo  = String(r[levelOffset + 3] || '').trim();

      var colorClass = 'green';
      if      (totalDays > sets.orange_threshold) colorClass = 'red';
      else if (totalDays > sets.yellow_threshold) colorClass = 'orange';
      else if (totalDays > sets.green_threshold)  colorClass = 'yellow';

      files.push({
        id:           parseInt(r[0]),
        appNumber:    String(r[1] || ''),
        subject:      String(r[2] || ''),
        receiveDate:  _fmt(r[3]),
        currentLevel: currentLevel,
        status:       String(r[5] || 'Active'),
        remarks:      String(r[6] || ''),
        totalDays:    totalDays,
        levelDays:    levelDays,
        color:        colorClass,
        colorClass:   colorClass,
        delayReason:  String(r[25] || ''),
        expectedDate: _fmt(r[26]),
        assignedTo:   assignedTo
      });
    }

    files.sort(function(a, b) { return b.totalDays - a.totalDays; });

    var total = files.length;
    var start = (page - 1) * pageSize;

    var result = {
      files:       files.slice(start, start + pageSize),
      total:       total,
      onHoldCount: onHoldCount,
      page:        page,
      pageSize:    pageSize,
      totalPages:  Math.ceil(total / pageSize) || 1,
      hierarchy:   hier,
      settings:    sets
    };
    _cacheSet(cacheKey, result);
    return result;
  } catch(err) {
    return { files:[], total:0, onHoldCount:0, page:1, pageSize:20, totalPages:1, error: err.message, hierarchy:getHierarchy() };
  }
}

// ── User Report ───────────────────────────────────────────────
function getUserReport() {
  try {
    var cached = _cacheGet('user_report');
    if (cached) return cached;

    var fileSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    var hier  = getHierarchy();
    var users = getAllUsers();

    if (!fileSheet) return { report: [], hierarchy: hier };

    var lastRow = fileSheet.getLastRow();
    if (lastRow < 2) return { report: [], hierarchy: hier };

    var data = fileSheet.getRange(1, 1, lastRow, 28).getValues();
    var statsMap = {};

    users.forEach(function(u) {
      if (u.username === 'admin') return;
      statsMap[u.username] = {
        username: u.username, fullName: u.fullName, role: u.role,
        hierarchyLevel: u.hierarchyLevel,
        totalFiles: 0, completedFiles: 0, activeFiles: 0,
        totalDaysWorked: 0, avgDays: 0
      };
    });

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0]) continue;
      var st = String(r[5] || '');
      hier.forEach(function(h) {
        var off   = 9 + (h.level - 1) * 4;
        var lUser = String(r[off + 3] || '').trim();
        var lDays = (r[off+2] !== '' && r[off+2] != null) ? Number(r[off+2]) : 0;
        if (lUser && statsMap[lUser] !== undefined && lDays > 0) {
          statsMap[lUser].totalFiles++;
          statsMap[lUser].totalDaysWorked += lDays;
          if (st === 'Completed') statsMap[lUser].completedFiles++;
          else statsMap[lUser].activeFiles++;
        }
      });
    }

    var report = [];
    Object.keys(statsMap).forEach(function(uname) {
      var s = statsMap[uname];
      s.avgDays = s.totalFiles > 0 ? Math.round(s.totalDaysWorked / s.totalFiles * 10) / 10 : 0;
      report.push(s);
    });
    report.sort(function(a,b){ return a.hierarchyLevel - b.hierarchyLevel; });

    var result = { report: report, hierarchy: hier };
    _cacheSet('user_report', result);
    return result;
  } catch(e) {
    return { report: [], hierarchy: [], error: e.message };
  }
}

// ── Generate Shareable Report Link ───────────────────────────
function generateShareableReport() {
  try {
    // Get current web app URL
    var url = ScriptApp.getService().getUrl();
    if (!url) {
      // Fallback: return the spreadsheet share link
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      return {
        success: true,
        url: ss.getUrl(),
        type: 'spreadsheet',
        message: 'Spreadsheet link'
      };
    }
    return {
      success: true,
      url: url + '?view=report&public=1',
      type: 'webapp',
      message: 'Report link generated'
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Build full report data for PDF export ─────────────────────
function getFullReportData() {
  try {
    var hier  = getHierarchy();
    var sets  = getSettings();
    var users = getAllUsers();

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FILES_SHEET);
    if (!sheet) return { success: false, message: 'Files sheet छैन।' };

    var lastRow = sheet.getLastRow();
    var today   = new Date(); today.setHours(0,0,0,0);
    var allFiles = [];
    var statusCounts = { active:0, completed:0, delayed:0, onHold:0 };

    if (lastRow >= 2) {
      var data = sheet.getRange(1, 1, lastRow, 28).getValues();
      for (var i = 1; i < data.length; i++) {
        var r = data[i];
        if (!r[0]) continue;

        var status     = String(r[5] || '');
        var onHold     = String(r[27] || '').toUpperCase() === 'TRUE';
        var receiveDate = r[3] ? new Date(r[3]) : null;
        var totalDays   = receiveDate ? _dateDiff(receiveDate, today) : 0;
        var expectedDate = r[26] ? _fmt(r[26]) : '';
        var isDelayed = (status !== 'Completed') && !onHold &&
                        (totalDays > sets.orange_threshold ||
                         (expectedDate && new Date(expectedDate) < today));

        if (onHold)                   statusCounts.onHold++;
        else if (status === 'Completed') statusCounts.completed++;
        else if (isDelayed)           statusCounts.delayed++;
        else                          statusCounts.active++;

        allFiles.push({
          id:           parseInt(r[0]),
          appNumber:    String(r[1] || ''),
          subject:      String(r[2] || ''),
          receiveDate:  _fmt(r[3]),
          status:       status,
          currentLevel: parseInt(r[4]) || 1,
          totalDays:    totalDays,
          delayReason:  String(r[25] || ''),
          expectedDate: expectedDate,
          onHold:       onHold
        });
      }
    }

    var userReport = getUserReport();

    return {
      success:      true,
      generatedAt:  _today(),
      statusCounts: statusCounts,
      totalFiles:   allFiles.length,
      hierarchy:    hier,
      settings:     sets,
      userReport:   userReport.report || [],
      delayedFiles: allFiles.filter(function(f){
        return f.status !== 'Completed' && !f.onHold &&
               (f.totalDays > sets.orange_threshold ||
                (f.expectedDate && new Date(f.expectedDate) < today));
      }).sort(function(a,b){ return b.totalDays - a.totalDays; })
    };
  } catch(e) {
    return { success: false, message: e.message };
  }
}

// ── Bootstrap ─────────────────────────────────────────────────
function getBootstrapData() {
  try {
    return {
      settings:  getSettings(),
      hierarchy: getHierarchy(),
      subjects:  getSubjects()
    };
  } catch(e) {
    return {
      settings:  { green_threshold:7, yellow_threshold:12, orange_threshold:15 },
      hierarchy: [{level:1,roleName:'नायब सुब्बा',active:true},{level:2,roleName:'शाखा अधिकृत',active:true},{level:3,roleName:'निर्देशक',active:true}],
      subjects:  [{ name: 'अन्य', active: true, order: 1 }]
    };
  }
}
