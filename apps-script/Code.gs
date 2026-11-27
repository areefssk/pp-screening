/**
 * PP Screening — หลังบ้าน (Google Sheet + Apps Script)
 * หน้าเว็บ/แอปมือถืออยู่บน GitHub Pages และเรียกไฟล์นี้ผ่าน doPost (JSON API)
 *
 * แท็บในชีต
 *   ตั้งค่ารายการ    รายการ ราคา หมวด วันเริ่ม/สิ้นสุด (ผู้ดูแลแก้ได้)
 *   ผู้ใช้            ชื่อ PIN สิทธิ์ (ใส่ PIN เป็นตัวเลขได้ ระบบจะเข้ารหัสให้ตอนล็อกอินครั้งแรก)
 *   ข้อมูลดิบ         ทุกการลงผล 1 แถว/รายการ/วัน — ระบบเขียนเท่านั้น
 *   ประวัติการแก้ไข  ใครแก้/ยกเลิกอะไร เมื่อไร เพราะอะไร — ระบบเขียนเท่านั้น
 *   ตั้งค่าระบบ       ชื่อหน่วยงาน ปิดยอดถึงวันที่ ลงย้อนหลังได้กี่วัน
 *   สรุป ต.ค.69 …     ตารางรายวันแบบไฟล์เดิม ระบบสร้างใหม่ทุกครั้ง (ห้ามแก้มือ)
 */

const API_VERSION = 3;
const SHEET = { ITEMS: 'ตั้งค่ารายการ', USERS: 'ผู้ใช้', LOG: 'ข้อมูลดิบ', AUDIT: 'ประวัติการแก้ไข', SETTINGS: 'ตั้งค่าระบบ' };
const TZ = 'Asia/Bangkok';
const ADMIN_ROLE = 'ผู้ดูแล';
const CANCELLED = 'ยกเลิก';
const REPORT_PREFIX = 'สรุป ';
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const ITEM_HEADERS = ['รหัส', 'ลำดับ', 'ชื่อรายการ', 'ชื่อเต็ม (กิจกรรม)', 'หมวด', 'ราคา/หน่วย (บาท)', 'เริ่มใช้ (ปปปป-ดด-วว ค.ศ.)', 'สิ้นสุด', 'เปิดใช้'];
const USER_HEADERS = ['ชื่อ', 'PIN', 'สิทธิ์ (ผู้ดูแล/ผู้ใช้)', 'เปิดใช้', 'เข้าใช้ล่าสุด'];
const LOG_HEADERS = ['รหัสบันทึก', 'เวลาบันทึก', 'วันที่ให้บริการ', 'รหัสรายการ', 'รายการ', 'จำนวน (คน)', 'ราคา/หน่วย', 'ยอดเงิน (บาท)', 'ผู้กรอก', 'หมายเหตุ', 'สถานะ', 'แก้ไขล่าสุด'];
const AUDIT_HEADERS = ['เวลา', 'ผู้ทำ', 'การกระทำ', 'รหัสบันทึก', 'วันที่ให้บริการ', 'รายการ', 'จำนวนเดิม', 'จำนวนใหม่', 'เหตุผล'];
const L = { ID: 0, TS: 1, DATE: 2, CODE: 3, NAME: 4, QTY: 5, PRICE: 6, AMT: 7, USER: 8, NOTE: 9, STATUS: 10, EDITED: 11 };

// รหัส, ลำดับ, ชื่อรายการ, ชื่อเต็ม, หมวด, ราคา, เริ่มใช้, สิ้นสุด
const DEFAULT_ITEMS = [
  ['PNC', 1, 'ตรวจหลังคลอด', 'ค่าบริการตรวจหลังคลอด', 'แม่และเด็ก', 150, '', ''],
  ['PNC_TRI', 2, 'ยาเสริม Triferdine (หลังคลอด)', 'ค่ายาเสริม ธาตุเหล็ก กรดโฟลิก ไอโอดีน Triferdine', 'แม่และเด็ก', 135, '', ''],
  ['CBC', 3, 'คัดกรองโลหิตจาง (CBC)', 'ค่าบริการเจาะเลือดเพื่อตรวจนับเม็ดเลือดอย่างสมบูรณ์ (CBC)', 'แม่และเด็ก', 65, '', ''],
  ['IRON', 4, 'ยาเม็ดเสริมธาตุเหล็ก (13–45 ปี)', 'ค่าบริการยาเม็ดเสริมธาตุเหล็กและกรดโฟลิค และการให้คำแนะนำ ติดตาม (13-45 ปี)', 'แม่และเด็ก', 80, '', ''],
  ['DT', 5, 'วัคซีน dT ผู้ใหญ่', 'ค่าบริการฉีดวัคซีนป้องกันโรคคอตีบและบาดทะยัก (dT)', 'วัคซีน', 20, '', ''],
  ['FLU', 6, 'วัคซีนไข้หวัดใหญ่', 'บริการฉีดวัคซีนป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล', 'วัคซีน', 20, '', ''],
  ['CXR', 7, 'คัดกรองวัณโรค CXR', 'ค่าบริการตรวจคัดกรองวัณโรคด้วยวิธีการถ่ายภาพรังสีทรวงอก Chest X-ray (CXR)', 'โรคติดเชื้อ', 100, '', ''],
  ['HBV', 8, 'คัดกรองไวรัสตับอักเสบบี', 'ค่าตรวจคัดกรองไวรัสตับอักเสบบี', 'โรคติดเชื้อ', 50, '', ''],
  ['HCV', 9, 'คัดกรองไวรัสตับอักเสบซี', 'บริการตรวจคัดกรองไวรัสตับอักเสบซี (Anti-HCV Screening test)', 'โรคติดเชื้อ', 50, '', ''],
  ['HPV', 10, 'คัดกรองมะเร็งปากมดลูก HPV', 'คัดกรองมะเร็งปากมดลูกด้วยวิธี HPV DNA Test (HPV Self-sampling)', 'มะเร็ง', 50, '', ''],
  ['FIT', 11, 'คัดกรองมะเร็งลำไส้ (FIT test)', 'บริการตรวจคัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test)', 'มะเร็ง', 60, '', ''],
  ['DMLIPID', 12, 'คัดกรองเบาหวานและไขมัน (เดิม)', 'ค่าบริการคัดกรองเบาหวานและไขมันในเลือด', 'NCD', 40, '', '2026-04-30'],
  ['DM', 12, 'คัดกรองเบาหวาน', 'ค่าบริการคัดกรองเบาหวาน', 'NCD', 40, '2026-05-01', ''],
  ['LIPID', 13, 'คัดกรองไขมันในเลือด', 'ค่าบริการคัดกรองไขมันในเลือด', 'NCD', 160, '2026-05-01', ''],
  ['WCC', 14, 'วัคซีน WCC', 'บริการให้วัคซีน WCC', 'วัคซีน', 20, '', ''],
  ['HIV', 15, 'คัดกรอง HIV', 'ค่าบริการตรวจ HIV', 'โรคติดเชื้อ', 100, '', ''],
  ['SYP', 16, 'คัดกรอง Syphilis', 'ค่าบริการตรวจ Syphilis', 'โรคติดเชื้อ', 50, '', ''],
  ['TBDM', 17, 'คัดกรอง TB กลุ่ม DM', 'ค่าบริการตรวจคัดกรอง TB กลุ่ม DM', 'โรคติดเชื้อ', 100, '', ''],
  ['PALL', 18, 'เยี่ยมบ้าน Palliative Care', 'เยี่ยมบ้าน Palliative Care', 'Palliative', 1000, '2026-03-01', ''],
];

/* ───────────────────────── JSON API ───────────────────────── */

const API = {
  getInit: getInit, getYearData: getYearData, login: login, logout: logout, changePin: changePin,
  saveEntries: saveEntries, getEntries: getEntries, updateEntry: updateEntry, getAudit: getAudit,
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.fn) return json_({ ok: true, data: 'PP Screening API v' + API_VERSION + ' พร้อมใช้งาน' });
  return handle_(p.fn, p.args ? JSON.parse(p.args) : []);
}

function doPost(e) {
  let body;
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'รูปแบบคำขอไม่ถูกต้อง' }); }
  return handle_(body.fn, body.args || []);
}

function handle_(fn, args) {
  try {
    if (!Object.prototype.hasOwnProperty.call(API, fn)) throw new Error('ไม่รู้จักคำสั่ง: ' + fn);
    return json_({ ok: true, data: API[fn].apply(null, args) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────────────────── เปิดให้ทุกคน ───────────────────────── */

function getInit() {
  const today = today_();
  const fys = new Set(readLog_().map(r => fyOf_(fmtDate_(r[L.DATE]))).filter(Boolean));
  fys.add(fyOf_(today));
  const st = settings_();
  return {
    apiVersion: API_VERSION,
    items: getItems_().map(publicItem_),
    users: getUsers_().filter(u => u.active).map(u => u.name),
    today: today,
    fys: [...fys].sort((a, b) => b - a),
    settings: { org: st.org, closedUntil: st.closedUntil, editDays: st.editDays },
  };
}

/** ยอดของปีงบ (พ.ศ. เช่น 2570 = ต.ค.2569–ก.ย.2570) รวมเป็น [วันที่, รหัส, คน, บาท] ไม่มีชื่อผู้กรอก */
function getYearData(fy) {
  fy = Number(fy);
  const key = 'fy_' + fy;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const range = fyRange_(fy);
  const sum = {};
  let last = null;
  readLog_().forEach(r => {
    if (r[L.STATUS] === CANCELLED) return;
    const d = fmtDate_(r[L.DATE]);
    if (d < range.start || d > range.end) return;
    const k = d + '|' + r[L.CODE];
    const c = sum[k] = sum[k] || [d, String(r[L.CODE]), 0, 0];
    c[2] += Number(r[L.QTY]) || 0;
    c[3] += Number(r[L.AMT]) || 0;
    if (r[L.TS] instanceof Date && (!last || r[L.TS] > last)) last = r[L.TS];
  });
  const out = {
    fy: fy, start: range.start, end: range.end,
    items: getItems_().map(publicItem_),
    rows: Object.values(sum),
    updated: last ? Utilities.formatDate(last, TZ, 'd/M/') + (Number(Utilities.formatDate(last, TZ, 'yyyy')) + 543) + ' ' + Utilities.formatDate(last, TZ, 'HH:mm') : '',
  };
  try { cache.put(key, JSON.stringify(out), 600); } catch (e) { /* ใหญ่เกิน cache ก็ไม่เป็นไร */ }
  return out;
}

/* ───────────────────────── ล็อกอิน ───────────────────────── */

function login(name, pin) {
  name = String(name || '').trim(); pin = String(pin || '').trim();
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + name;
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) throw new Error('ใส่ PIN ผิดเกิน 5 ครั้ง กรุณารอ 15 นาที');
  const users = getUsers_();
  const u = users.find(x => x.active && x.name === name);
  if (!u || !checkPin_(u, pin)) {
    cache.put(failKey, String(fails + 1), 900);
    Utilities.sleep(600);
    throw new Error('ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง');
  }
  cache.remove(failKey);
  sheet_(SHEET.USERS).getRange(u.row, 5).setValue(new Date());
  const token = Utilities.getUuid();
  cache.put('s_' + token, JSON.stringify({ name: u.name }), 8 * 3600);
  return {
    token: token, name: u.name, role: u.role || 'ผู้ใช้', admin: u.role === ADMIN_ROLE,
    weakPin: pin === '1234' || pin === '0000',
    sheetUrl: u.role === ADMIN_ROLE ? SpreadsheetApp.getActive().getUrl() : '',
  };
}

function logout(token) {
  CacheService.getScriptCache().remove('s_' + token);
  return true;
}

function changePin(token, oldPin, newPin) {
  const user = session_(token);
  newPin = String(newPin || '').trim();
  if (!/^\d{4,6}$/.test(newPin)) throw new Error('PIN ใหม่ต้องเป็นตัวเลข 4–6 หลัก');
  const u = getUsers_().find(x => x.name === user.name);
  if (!checkPin_(u, String(oldPin || '').trim())) throw new Error('PIN เดิมไม่ถูกต้อง');
  sheet_(SHEET.USERS).getRange(u.row, 2).setValue(hashPin_(u.name, newPin));
  return true;
}

function session_(token) {
  const s = token && CacheService.getScriptCache().get('s_' + token);
  if (!s) throw new Error('SESSION_EXPIRED: กรุณาเข้าสู่ระบบอีกครั้ง');
  const name = JSON.parse(s).name;
  const u = getUsers_().find(x => x.active && x.name === name);
  if (!u) throw new Error('SESSION_EXPIRED: บัญชีถูกปิดการใช้งาน');
  return { name: u.name, role: u.role, admin: u.role === ADMIN_ROLE };
}

function checkPin_(u, pin) {
  if (!u || !pin) return false;
  if (u.pin.indexOf('h:') === 0) return u.pin === hashPin_(u.name, pin);
  if (u.pin !== pin) return false;
  sheet_(SHEET.USERS).getRange(u.row, 2).setValue(hashPin_(u.name, pin)); // เข้ารหัส PIN ที่พิมพ์ไว้ในชีต
  return true;
}

function hashPin_(name, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt_() + '|' + name + '|' + pin, Utilities.Charset.UTF_8);
  return 'h:' + bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

function salt_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('PIN_SALT');
  if (!s) { s = Utilities.getUuid(); props.setProperty('PIN_SALT', s); }
  return s;
}

/* ───────────────────────── ต้องล็อกอิน ───────────────────────── */

function saveEntries(token, p) {
  const user = session_(token);
  p = p || {};
  const cache = CacheService.getScriptCache();
  if (p.reqId) {
    const done = cache.get('req_' + p.reqId);
    if (done) return JSON.parse(done); // กดซ้ำ/เน็ตหลุดแล้วส่งใหม่ — ไม่บันทึกซ้ำ
  }
  const date = String(p.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('วันที่ไม่ถูกต้อง');
  checkEditable_(user, date, 'ลงผล');

  const items = getItems_();
  const now = new Date();
  const note = cleanNote_(p.note);
  const rows = [];
  (p.rows || []).forEach(r => {
    const q = Math.floor(Number(r.qty));
    if (!(q > 0)) return;
    if (q > 5000) throw new Error('จำนวนมากผิดปกติ: ' + q);
    const it = items.find(i => i.code === String(r.code) && activeOn_(i, date));
    if (!it) throw new Error('รายการ ' + r.code + ' ใช้ไม่ได้ในวันที่ ' + date);
    rows.push([newId_(), now, date, it.code, it.name, q, it.price, q * it.price, user.name, note, '', '']);
  });
  if (!rows.length) throw new Error('ยังไม่ได้กรอกจำนวนคน');

  const result = withLock_(() => {
    const sh = sheet_(SHEET.LOG);
    const start = sh.getLastRow() + 1;
    if (sh.getMaxRows() < start + rows.length - 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 200);
    sh.getRange(start, 3, rows.length, 1).setNumberFormat('@');
    sh.getRange(start, 1, rows.length, LOG_HEADERS.length).setValues(rows);
    afterWrite_(date);
    return { count: rows.length, people: rows.reduce((s, r) => s + r[L.QTY], 0), total: rows.reduce((s, r) => s + r[L.AMT], 0) };
  });
  if (p.reqId) cache.put('req_' + p.reqId, JSON.stringify(result), 1800);
  return result;
}

function getEntries(token, date) {
  const user = session_(token);
  const st = settings_();
  return readLog_()
    .filter(r => fmtDate_(r[L.DATE]) === date && r[L.STATUS] !== CANCELLED)
    .map(r => ({
      id: String(r[L.ID]), code: String(r[L.CODE]), item: String(r[L.NAME]), qty: Number(r[L.QTY]),
      price: Number(r[L.PRICE]), amount: Number(r[L.AMT]), user: String(r[L.USER]), note: String(r[L.NOTE] || ''),
      time: r[L.TS] instanceof Date ? Utilities.formatDate(r[L.TS], TZ, 'HH:mm') : '',
      edited: String(r[L.EDITED] || ''),
      canEdit: canEdit_(user, date, String(r[L.USER]), st),
    }));
}

/** แก้จำนวน (qty > 0) หรือยกเลิก (qty = 0) — ต้องมีเหตุผล ข้อมูลเดิมเก็บไว้ในประวัติ */
function updateEntry(token, id, qty, reason) {
  const user = session_(token);
  const q = Math.floor(Number(qty));
  if (!(q >= 0) || q > 5000) throw new Error('จำนวนไม่ถูกต้อง');
  reason = String(reason || '').trim().slice(0, 200);
  if (reason.length < 3) throw new Error('กรุณาใส่เหตุผลการแก้ไข');
  return withLock_(() => {
    const sh = sheet_(SHEET.LOG);
    const n = sh.getLastRow() - 1;
    if (n < 1) throw new Error('ไม่พบรายการนี้');
    const ids = sh.getRange(2, 1, n, 1).getValues();
    const idx = ids.findIndex(r => String(r[0]) === String(id));
    if (idx < 0) throw new Error('ไม่พบรายการนี้ (อาจถูกยกเลิกไปแล้ว)');
    const rowNo = idx + 2;
    const row = sh.getRange(rowNo, 1, 1, LOG_HEADERS.length).getValues()[0];
    const date = fmtDate_(row[L.DATE]);
    if (row[L.STATUS] === CANCELLED) throw new Error('รายการนี้ถูกยกเลิกไปแล้ว');
    if (!canEdit_(user, date, String(row[L.USER]), settings_())) throw new Error('ไม่มีสิทธิ์แก้รายการนี้ (ของคนอื่น หรือเกินช่วงที่แก้ได้)');
    const stamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + ' ' + user.name;
    if (q === 0) {
      sh.getRange(rowNo, L.STATUS + 1, 1, 2).setValues([[CANCELLED, stamp]]);
    } else {
      sh.getRange(rowNo, L.QTY + 1, 1, 3).setValues([[q, row[L.PRICE], q * Number(row[L.PRICE])]]);
      sh.getRange(rowNo, L.EDITED + 1).setValue(stamp);
    }
    audit_(user.name, q === 0 ? 'ยกเลิก' : 'แก้จำนวน', row[L.ID], date, row[L.NAME], row[L.QTY], q, reason);
    afterWrite_(date);
    return true;
  });
}

function getAudit(token, limit) {
  const user = session_(token);
  const sh = sheet_(SHEET.AUDIT);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const take = Math.min(n, Math.max(1, Math.min(Number(limit) || 50, 200)));
  return sh.getRange(n - take + 2, 1, take, AUDIT_HEADERS.length).getValues()
    .filter(r => user.admin || String(r[1]) === user.name)
    .reverse()
    .map(r => ({
      at: r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'd/M HH:mm') : String(r[0]),
      by: String(r[1]), action: String(r[2]), date: fmtDate_(r[4]), item: String(r[5]),
      from: r[6], to: r[7], reason: String(r[8]),
    }));
}

/* ───────────────────────── กติกาการแก้ไข ───────────────────────── */

function checkEditable_(user, date, verb) {
  const st = settings_();
  if (date > today_()) throw new Error(verb + 'ล่วงหน้าไม่ได้');
  if (user.admin) return;
  if (st.closedUntil && date <= st.closedUntil) throw new Error('เดือนนี้ปิดยอดแล้ว (ถึง ' + thDate_(st.closedUntil) + ') ติดต่อผู้ดูแล');
  if (daysBetween_(date, today_()) > st.editDays) throw new Error(verb + 'ย้อนหลังได้ไม่เกิน ' + st.editDays + ' วัน ติดต่อผู้ดูแล');
}

function canEdit_(user, date, owner, st) {
  if (user.admin) return true;
  if (owner !== user.name) return false;
  if (st.closedUntil && date <= st.closedUntil) return false;
  return daysBetween_(date, today_()) <= st.editDays;
}

function afterWrite_(date) {
  SpreadsheetApp.flush();
  CacheService.getScriptCache().remove('fy_' + fyOf_(date));
  try { buildMonth_(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1); } catch (e) { console.error(e); }
}

function audit_(by, action, id, date, item, from, to, reason) {
  const sh = sheet_(SHEET.AUDIT);
  sh.appendRow([new Date(), by, action, id, date, item, from, to, reason]);
}

/* ───────────────────────── แท็บสรุปรายเดือน (หน้าตาแบบไฟล์เดิม) ───────────────────────── */

/** y = ปี ค.ศ., m = 0–11 · คืนชื่อแท็บ */
function buildMonth_(y, m) {
  const key = y + '-' + pad_(m + 1);
  const yy = String((y + 543) % 100).padStart(2, '0');
  const sheetName = REPORT_PREFIX + TH_MONTH[m] + yy;
  const first = key + '-01', lastDay = key + '-' + pad_(new Date(y, m + 1, 0).getDate());

  const dates = new Set();
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
    const dow = new Date(y, m, d).getDay();
    if (dow !== 0 && dow !== 6) dates.add(key + '-' + pad_(d));
  }
  const agg = {};
  readLog_().forEach(r => {
    if (r[L.STATUS] === CANCELLED) return;
    const d = fmtDate_(r[L.DATE]);
    if (d.slice(0, 7) !== key) return;
    dates.add(d);
    const c = (agg[r[L.CODE]] = agg[r[L.CODE]] || {});
    const x = (c[d] = c[d] || { q: 0, a: 0 });
    x.q += Number(r[L.QTY]) || 0;
    x.a += Number(r[L.AMT]) || 0;
  });
  const dl = [...dates].sort();
  const items = getItems_().filter(i => agg[i.code] || (i.enabled && (!i.from || i.from <= lastDay) && (!i.to || i.to >= first)))
    .sort((a, b) => a.order - b.order);

  const nCols = 4 + dl.length * 2 + 2;
  const label = d => Number(d.slice(8, 10)) + '/' + Number(d.slice(5, 7)) + '/' + yy;
  const values = [];
  values.push(['สรุปยอดงาน PP Fee Schedule เดือน ' + TH_MONTH[m] + yy].concat(blank_(nCols - 1)));
  values.push(['ข้อ', 'รายการ', 'กิจกรรม', 'ราคา'].concat(...dl.map(d => ['วันที่ ' + label(d), '']), ['รวมทั้งเดือน', '']));
  values.push(['', '', '', '(บาท)'].concat(...dl.map(() => ['คน', 'บาท']), ['คน', 'บาท']));
  const colSum = new Array(dl.length * 2 + 2).fill(0);
  items.forEach(it => {
    const row = [it.order, it.name, it.full, it.price];
    let tq = 0, ta = 0;
    dl.forEach((d, j) => {
      const c = (agg[it.code] || {})[d];
      row.push(c ? c.q : '', c ? c.a : '');
      if (c) { tq += c.q; ta += c.a; colSum[j * 2] += c.q; colSum[j * 2 + 1] += c.a; }
    });
    row.push(tq, ta);
    colSum[colSum.length - 2] += tq;
    colSum[colSum.length - 1] += ta;
    values.push(row);
  });
  values.push(['', 'รวม', '', ''].concat(colSum));

  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(sheetName);
  if (!sh) sh = ss.insertSheet(sheetName);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  if (sh.getMaxColumns() < nCols) sh.insertColumnsAfter(sh.getMaxColumns(), nCols - sh.getMaxColumns());
  if (sh.getMaxRows() < values.length) sh.insertRowsAfter(sh.getMaxRows(), values.length - sh.getMaxRows());
  sh.getRange(1, 1, values.length, nCols).setValues(values);
  sh.getRange(1, 1, 1, nCols).merge().setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
  ['A', 'B', 'C', 'D'].forEach(c => sh.getRange(c + '2:' + c + '3').merge().setVerticalAlignment('middle'));
  for (let c = 5; c <= nCols; c += 2) sh.getRange(2, c, 1, 2).merge();
  sh.getRange(2, 1, 2, nCols).setFontWeight('bold').setBackground('#d9ead3').setHorizontalAlignment('center');
  sh.getRange(4, 4, values.length - 3, nCols - 3).setNumberFormat('#,##0').setHorizontalAlignment('center');
  sh.getRange(2, nCols - 1, values.length - 1, 2).setBackground('#fff2cc').setFontWeight('bold');
  sh.getRange(values.length, 1, 1, nCols).setFontWeight('bold').setBackground('#fce5cd');
  sh.getRange(2, 1, values.length - 1, nCols).setBorder(true, true, true, true, true, true, '#999999', null);
  sh.setFrozenRows(3);
  sh.setFrozenColumns(4);
  sh.setColumnWidth(1, 36); sh.setColumnWidth(2, 220); sh.setColumnWidth(3, 260); sh.setColumnWidth(4, 56);
  if (nCols > 6) sh.setColumnWidths(5, nCols - 6, 48);
  sh.setColumnWidths(nCols - 1, 2, 76);
  return sheetName;
}

/* ───────────────────────── เมนูในชีต ───────────────────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ระบบ PP')
    .addItem('ติดตั้ง / ตรวจโครงสร้างชีต', 'setup')
    .addSeparator()
    .addItem('สร้างแท็บสรุปเดือนนี้', 'reportThisMonth')
    .addItem('สร้างแท็บสรุปทุกเดือนที่มีข้อมูล', 'reportAll')
    .addSeparator()
    .addItem('เปิดสำรองข้อมูลอัตโนมัติทุกคืน', 'installBackup')
    .addItem('สำรองข้อมูลตอนนี้', 'nightlyBackup')
    .addItem('ล้างแคชแดชบอร์ด', 'clearCache')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  ensureSheet_(SHEET.ITEMS, ITEM_HEADERS, sh => {
    sh.getRange(2, 1, DEFAULT_ITEMS.length, 9).setValues(DEFAULT_ITEMS.map(r => r.concat([true])));
    sh.getRange(2, 9, DEFAULT_ITEMS.length, 1).insertCheckboxes();
  });
  sheet_(SHEET.ITEMS).getRange('G:H').setNumberFormat('@');
  ensureSheet_(SHEET.USERS, USER_HEADERS, sh => {
    sh.getRange(2, 1, 1, 4).setValues([['ผู้ดูแลระบบ', '1234', ADMIN_ROLE, true]]);
    sh.getRange(2, 4).insertCheckboxes();
  });
  sheet_(SHEET.USERS).getRange('B:B').setNumberFormat('@');
  ensureSheet_(SHEET.LOG, LOG_HEADERS);
  sheet_(SHEET.LOG).getRange('C:C').setNumberFormat('@');
  ensureSheet_(SHEET.AUDIT, AUDIT_HEADERS);
  ensureSheet_(SHEET.SETTINGS, ['ค่า', 'ตั้งเป็น', 'คำอธิบาย'], sh => {
    sh.getRange(2, 1, 3, 3).setValues([
      ['ชื่อหน่วยงาน', '', 'แสดงที่หัวแอป'],
      ['ปิดยอดถึงวันที่', '', 'ปปปป-ดด-วว (ค.ศ.) ผู้ใช้ทั่วไปแก้ข้อมูลถึงวันนี้ไม่ได้ เว้นว่าง = ยังไม่ปิด'],
      ['ลงผล/แก้ย้อนหลังได้ (วัน)', 7, 'สำหรับผู้ใช้ทั่วไป ผู้ดูแลแก้ได้เสมอ'],
    ]);
    sh.getRange('B3').setNumberFormat('@');
  });
  salt_();
  clearCache();
  SpreadsheetApp.getUi().alert(
    'พร้อมใช้งาน\n\n' +
    '1) แท็บ "ผู้ใช้": เพิ่มชื่อ + PIN ของทีม และเปลี่ยน PIN 1234 ของผู้ดูแล\n' +
    '2) Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone)\n' +
    '3) นำ URL ที่ลงท้ายด้วย /exec ไปใส่ใน config.js บน GitHub\n' +
    '4) เมนู ระบบ PP → เปิดสำรองข้อมูลอัตโนมัติทุกคืน');
}

function reportThisMonth() {
  const t = today_();
  const name = buildMonth_(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1);
  SpreadsheetApp.getActive().getSheetByName(name).activate();
}

function reportAll() {
  const months = new Set(readLog_().map(r => fmtDate_(r[L.DATE]).slice(0, 7)).filter(k => /^\d{4}-\d{2}$/.test(k)));
  [...months].sort().forEach(k => buildMonth_(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1));
  SpreadsheetApp.getUi().alert('สร้างแท็บสรุปแล้ว ' + months.size + ' เดือน');
}

function clearCache() {
  const fys = [];
  const y = Number(today_().slice(0, 4)) + 543;
  for (let f = y - 5; f <= y + 2; f++) fys.push('fy_' + f);
  CacheService.getScriptCache().removeAll(fys);
}

function installBackup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'nightlyBackup').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('nightlyBackup').timeBased().atHour(2).everyDays(1).inTimezone(TZ).create();
  SpreadsheetApp.getUi().alert('เปิดสำรองข้อมูลทุกคืนเวลาประมาณ 02:00 แล้ว\nไฟล์สำรองอยู่ในโฟลเดอร์ "PP Screening Backup" ใน Google Drive (เก็บ 30 ชุดล่าสุด)');
}

function nightlyBackup() {
  const ss = SpreadsheetApp.getActive();
  const it = DriveApp.getFoldersByName('PP Screening Backup');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('PP Screening Backup');
  DriveApp.getFileById(ss.getId()).makeCopy('PP backup ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HHmm'), folder);
  const files = [];
  const fi = folder.getFiles();
  while (fi.hasNext()) files.push(fi.next());
  files.sort((a, b) => b.getDateCreated() - a.getDateCreated()).slice(30).forEach(f => f.setTrashed(true));
}

/* ───────────────────────── helpers ───────────────────────── */

function ensureSheet_(name, headers, seed) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#d9ead3');
  sh.setFrozenRows(1);
  if (seed) seed(sh);
  return sh;
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('ยังไม่ได้ติดตั้งระบบ: เปิดชีตแล้วกดเมนู ระบบ PP > ติดตั้ง');
  return sh;
}

function readLog_() {
  const sh = sheet_(SHEET.LOG);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, LOG_HEADERS.length).getValues().filter(r => r[0] !== '');
}

function getItems_() {
  const sh = sheet_(SHEET.ITEMS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues()
    .filter(r => String(r[0]).trim() && String(r[2]).trim())
    .map(r => ({
      code: String(r[0]).trim(), order: Number(r[1]) || 99, name: String(r[2]).trim(), full: String(r[3] || '').trim(),
      group: String(r[4] || '').trim() || 'อื่น ๆ', price: Number(r[5]) || 0,
      from: r[6] ? fmtDate_(r[6]) : '', to: r[7] ? fmtDate_(r[7]) : '',
      enabled: r[8] === true || String(r[8]).toUpperCase() === 'TRUE',
    }));
}

function publicItem_(i) {
  return { code: i.code, order: i.order, name: i.name, full: i.full, group: i.group, price: i.price, from: i.from, to: i.to, enabled: i.enabled };
}

function activeOn_(i, date) {
  return i.enabled && (!i.from || date >= i.from) && (!i.to || date <= i.to);
}

function getUsers_() {
  const sh = sheet_(SHEET.USERS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .map((r, i) => ({
      row: i + 2, name: String(r[0]).trim(), pin: String(r[1]).trim(), role: String(r[2]).trim(),
      active: r[3] === true || String(r[3]).toUpperCase() === 'TRUE',
    }))
    .filter(u => u.name);
}

function settings_() {
  const out = { org: '', closedUntil: '', editDays: 7 };
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET.SETTINGS);
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => {
    const k = String(r[0]);
    if (k.indexOf('ชื่อหน่วยงาน') === 0) out.org = String(r[1] || '');
    if (k.indexOf('ปิดยอด') === 0 && r[1]) out.closedUntil = fmtDate_(r[1]);
    if (k.indexOf('ลงผล') === 0 && r[1] !== '') out.editDays = Math.max(0, Number(r[1]) || 0);
  });
  return out;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function cleanNote_(s) {
  s = String(s || '').trim().slice(0, 100);
  if (/\d{13}/.test(s.replace(/[\s-]/g, ''))) throw new Error('หมายเหตุมีตัวเลขคล้ายเลขบัตรประชาชน กรุณาอย่าใส่ข้อมูลผู้ป่วย');
  return s;
}

function newId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function fmtDate_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').trim(); }
function fyOf_(d) {
  if (!/^\d{4}-\d{2}/.test(d)) return 0;
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7));
  return (m >= 10 ? y + 1 : y) + 543;
}
function fyRange_(fy) { const ce = fy - 543; return { start: (ce - 1) + '-10-01', end: ce + '-09-30' }; }
function daysBetween_(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
function thDate_(d) { return Number(d.slice(8, 10)) + '/' + Number(d.slice(5, 7)) + '/' + (Number(d.slice(0, 4)) + 543); }
function pad_(n) { return String(n).padStart(2, '0'); }
function blank_(n) { return new Array(Math.max(n, 0)).fill(''); }
