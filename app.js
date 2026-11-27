/* PP Screening — หน้าเว็บ/แอปมือถือ
 * ข้อมูลทั้งหมดมาจาก Apps Script (config.js → API_URL) หรือโหมดตัวอย่าง (demo.js)
 */
var APP_API_VERSION = 3;

/* ================= state ================= */
var S = { init: null, fy: null, month: '', group: 'ทั้งหมด', data: {}, page: 'dash',
          user: null, eGroup: 'ทั้งหมด', dayEntries: [], rMode: 'a', hidden: {}, allItems: false };
var MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var ICON = {
  dash: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  entry: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  log: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/></svg>',
  report: '<svg class="i" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  sheet: '<svg class="i" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};
var PAGES = [
  { id: 'dash', label: 'ภาพรวม', locked: false },
  { id: 'entry', label: 'ลงผล', locked: true },
  { id: 'log', label: 'บันทึกรายวัน', locked: true },
  { id: 'report', label: 'รายงาน', locked: false }
];

/* ================= helpers ================= */
var $ = function (id) { return document.getElementById(id); };
var fmt = function (n) { return Math.round(Number(n || 0)).toLocaleString('th-TH'); };
var short = function (n) { n = Number(n || 0); return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1000 ? (n / 1000).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : fmt(n); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var pad = function (n) { return String(n).padStart(2, '0'); };
var be2 = function (y) { return String((Number(y) + 543) % 100).padStart(2, '0'); };
function thDate(iso, long) { var p = iso.split('-'); return Number(p[2]) + (long ? ' ' + MONTH_FULL[p[1] - 1] + ' ' + (Number(p[0]) + 543) : '/' + Number(p[1]) + '/' + be2(p[0])); }
function addDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); }
function fyOf(iso) { var y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return (m >= 10 ? y + 1 : y) + 543; }
/** 12 เดือนของปีงบ (พ.ศ.) เริ่ม ต.ค. */
function fyMonths(fy) {
  var ce = fy - 543, out = [];
  for (var i = 0; i < 12; i++) { var m = (9 + i) % 12, y = i < 3 ? ce - 1 : ce; out.push({ key: y + '-' + pad(m + 1), m: m, y: y, label: MONTH[m] + be2(y), full: MONTH_FULL[m] + ' ' + (y + 543) }); }
  return out;
}
function activeOn(it, date) { return it.enabled && (!it.from || date >= it.from) && (!it.to || date <= it.to); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

var DEMO = !window.PP_CONFIG || !PP_CONFIG.API_URL || /[?&]demo=1/.test(location.search);
function call(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  var p = DEMO
    ? PPDemo.call(fn, args)
    : fetch(PP_CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: fn, args: args }) })
        .then(function (r) { if (!r.ok) throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (' + r.status + ')'); return r.json(); })
        .then(function (j) { if (!j.ok) throw new Error(j.error); return j.data; });
  return p.catch(function (e) {
    var msg = (e && e.message) || String(e);
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) msg = 'ไม่มีอินเทอร์เน็ต หรือเชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    if (msg.indexOf('SESSION_EXPIRED') >= 0) { setUser(null); openLogin(); msg = msg.replace('SESSION_EXPIRED: ', ''); }
    throw new Error(msg);
  });
}
var tT;
function toast(msg, isErr, action) {
  var t = $('toast'); t.className = isErr ? 'err' : ''; t.innerHTML = esc(msg);
  if (action) { var b = document.createElement('button'); b.textContent = action.label; b.onclick = function () { t.style.display = 'none'; action.fn(); }; t.appendChild(b); }
  t.style.display = 'block'; clearTimeout(tT); tT = setTimeout(function () { t.style.display = 'none'; }, isErr ? 6000 : 4500);
}

/* ================= navigation ================= */
function renderNav() {
  var logged = !!S.user;
  $('sideNav').innerHTML = PAGES.map(function (p) {
    return '<button type="button" data-p="' + p.id + '" class="' + (S.page === p.id ? 'on' : '') + '">' + ICON[p.id] + p.label +
      (p.locked && !logged ? '<span class="lock">🔒</span>' : '') + '</button>';
  }).join('');
  var tabs = [PAGES[0], PAGES[2], 'fab', PAGES[3]];
  $('tabBar').innerHTML = tabs.map(function (p) {
    if (p === 'fab') return '<button type="button" class="fab ' + (S.page === 'entry' ? 'on' : '') + '" data-p="entry"><span class="c">' + ICON.entry + '</span>ลงผล</button>';
    return '<button type="button" data-p="' + p.id + '" class="' + (S.page === p.id ? 'on' : '') + '">' + ICON[p.id] + p.label +
      (p.locked && !logged ? '<span class="lk">🔒</span>' : '') + '</button>';
  }).join('');
  $('sideFoot').innerHTML = logged
    ? (S.user.sheetUrl ? '<a class="sheetlink" target="_blank" rel="noopener" href="' + esc(S.user.sheetUrl) + '">' + ICON.sheet + 'เปิด Google Sheet</a>' : '') +
      '<div class="me"><div class="av">' + esc(S.user.name.charAt(0)) + '</div><div style="flex:1;min-width:0">' + esc(S.user.name) +
      '<small>' + esc(S.user.role || 'ผู้ใช้') + '</small></div><button type="button" data-act="account">บัญชี</button></div>'
    : '<p style="font-size:12.5px;opacity:.7;margin:0 4px 10px">ดูกราฟได้โดยไม่ต้องเข้าสู่ระบบ · เข้าสู่ระบบเพื่อลงผลและแก้ไข</p><button type="button" class="btn-login" data-act="login">เข้าสู่ระบบ</button>';
  $('mUser').innerHTML = logged
    ? '<button type="button" data-act="account"><span class="av">' + esc(S.user.name.charAt(0)) + '</span>' + esc(S.user.name) + '</button>'
    : '<button type="button" class="guest" data-act="login">เข้าสู่ระบบ</button>';
}
function go(page) {
  var p = PAGES.find(function (x) { return x.id === page; });
  if (p.locked && !S.user) { openLogin(function () { go(page); }); return; }
  S.page = page;
  PAGES.forEach(function (x) { $('p-' + x.id).classList.toggle('hide', x.id !== page); });
  var sec = $('p-' + page); sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');
  $('mTitle').textContent = p.label;
  renderNav();
  window.scrollTo(0, 0);
  if (page === 'dash') loadYear(S.fy).then(renderDash).catch(function () {});
  if (page === 'report') loadYear(Number($('rYear').value)).then(renderReport).catch(function () {});
  if (page === 'entry') { renderRule(); loadDay($('eDate').value).then(renderEntry); }
  if (page === 'log') loadDay($('lDate').value).then(renderLog);
}
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-p]'); if (b && (b.closest('#sideNav') || b.closest('#tabBar'))) { go(b.dataset.p); return; }
  var a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'login') openLogin();
  if (a.dataset.act === 'logout') doLogout();
  if (a.dataset.act === 'account') openAccount();
});

/* ================= auth ================= */
function setUser(u) {
  S.user = u;
  store('ppUser', u ? JSON.stringify(u) : null);
  if (!u && PAGES.find(function (x) { return x.id === S.page; }).locked) { go('dash'); return; }
  renderNav();
}
function openModal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hide'); }
function closeModal() { $('modal').classList.add('hide'); }
$('modal').addEventListener('click', function (e) { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });

function openLogin(after) {
  var last = store('ppLastName') || '';
  openModal('<h2>เข้าสู่ระบบ</h2><p>สำหรับเจ้าหน้าที่ที่ลงผลและแก้ไขข้อมูล</p>' +
    '<label class="f">ชื่อผู้ใช้<select id="lgName"><option value="">— เลือกชื่อ —</option>' +
    S.init.users.map(function (u) { return '<option' + (u === last ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select></label>' +
    '<label class="f">PIN<input id="lgPin" type="password" inputmode="numeric" autocomplete="current-password"></label>' +
    '<div class="err" id="lgErr"></div>' +
    '<div class="acts"><button type="button" class="btn ghost" data-close>ยกเลิก</button><button type="button" class="btn" id="lgGo">เข้าสู่ระบบ</button></div>');
  var submit = function () {
    var n = $('lgName').value, p = $('lgPin').value;
    if (!n || !p) { $('lgErr').textContent = 'เลือกชื่อและใส่ PIN'; return; }
    $('lgGo').disabled = true; $('lgErr').textContent = '';
    call('login', n, p).then(function (u) {
      store('ppLastName', n); setUser(u); closeModal();
      if (u.weakPin) toast('PIN ของคุณเดาง่าย กรุณาเปลี่ยน PIN', true, { label: 'เปลี่ยนเลย', fn: openAccount });
      else toast('ยินดีต้อนรับ ' + u.name);
      if (after) after();
    }).catch(function (e) { $('lgErr').textContent = e.message; $('lgGo').disabled = false; });
  };
  $('lgGo').onclick = submit;
  $('lgPin').addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  setTimeout(function () { (last ? $('lgPin') : $('lgName')).focus(); }, 50);
}
function openAccount() {
  openModal('<h2>' + esc(S.user.name) + '</h2><p>' + esc(S.user.role || 'ผู้ใช้') + '</p>' +
    (S.user.sheetUrl ? '<a class="btn ghost" style="display:block;text-align:center;text-decoration:none;margin-bottom:10px" target="_blank" rel="noopener" href="' + esc(S.user.sheetUrl) + '">เปิด Google Sheet (ตั้งราคา / ผู้ใช้ / ปิดยอด)</a>' : '') +
    '<button type="button" class="btn ghost" id="acAudit" style="width:100%;margin-bottom:14px">ประวัติการแก้ไข' + (S.user.admin ? ' (ทุกคน)' : 'ของฉัน') + '</button>' +
    '<h3 style="margin:0 0 8px;font-size:15px">เปลี่ยน PIN</h3>' +
    '<label class="f">PIN เดิม<input id="pcOld" type="password" inputmode="numeric"></label>' +
    '<label class="f">PIN ใหม่ (ตัวเลข 4–6 หลัก)<input id="pcNew" type="password" inputmode="numeric"></label>' +
    '<div class="err" id="pcErr"></div>' +
    '<div class="acts"><button type="button" class="btn ghost" id="pcGo">บันทึก PIN ใหม่</button><button type="button" class="btn" data-act="logout" style="background:var(--red)">ออกจากระบบ</button></div>');
  $('pcGo').onclick = function () {
    var o = $('pcOld').value, n = $('pcNew').value;
    if (!/^\d{4,6}$/.test(n)) { $('pcErr').textContent = 'PIN ใหม่ต้องเป็นตัวเลข 4–6 หลัก'; return; }
    this.disabled = true;
    call('changePin', S.user.token, o, n).then(function () { closeModal(); toast('เปลี่ยน PIN แล้ว'); })
      .catch(function (e) { $('pcErr').textContent = e.message; $('pcGo').disabled = false; });
  };
  $('acAudit').onclick = openAudit;
}
function openAudit() {
  openModal('<h2>ประวัติการแก้ไข</h2><p>50 รายการล่าสุด</p><div id="auList" class="empty">กำลังโหลด…</div><div class="acts"><button type="button" class="btn" data-close>ปิด</button></div>');
  call('getAudit', S.user.token, 50).then(function (l) {
    $('auList').className = '';
    $('auList').innerHTML = l.length ? l.map(function (a) {
      return '<div class="audit"><b>' + esc(a.action) + '</b> ' + esc(a.item) + ' · ' + thDate(a.date) + ' · ' + esc(a.from) + ' → ' + esc(a.to) + ' คน' +
        '<small>' + esc(a.by) + ' · ' + esc(a.at) + ' · เหตุผล: ' + esc(a.reason) + '</small></div>';
    }).join('') : '<div class="empty">ยังไม่มีการแก้ไข</div>';
  }).catch(function (e) { $('auList').textContent = e.message; });
}
function doLogout() {
  var t = S.user && S.user.token; closeModal(); setUser(null); toast('ออกจากระบบแล้ว');
  if (t) call('logout', t).catch(function () {});
}

/* ================= data ================= */
function loadYear(fy, force) {
  if (!force && S.data[fy]) return Promise.resolve(S.data[fy]);
  return call('getYearData', fy).then(function (d) { S.data[fy] = d; return d; })
    .catch(function (e) { toast(e.message, true); throw e; });
}
function loadDay(date) {
  if (!S.user) return Promise.resolve([]);
  return call('getEntries', S.user.token, date).then(function (l) { S.dayEntries = l; S.dayDate = date; return l; })
    .catch(function (e) { toast(e.message, true); S.dayEntries = []; return []; });
}
function itemMap(items) { var m = {}; items.forEach(function (i) { m[i.code] = i; }); return m; }
function groupsOf(items) {
  var seen = []; items.slice().sort(function (a, b) { return a.order - b.order; })
    .forEach(function (i) { if (seen.indexOf(i.group) < 0) seen.push(i.group); }); return seen;
}

/* ================= dashboard ================= */
// สีประจำหมวด: ลำดับคงที่ตามลำดับหมวดในแท็บตั้งค่ารายการ (ตรวจสีสำหรับคนตาบอดสีแล้ว)
var GROUP_PALETTE = ['#257de0', '#f47230', '#00b894', '#f2a600', '#ee7fac', '#6a4ce2', '#008a17', '#ec4647'];
function gColor(g) {
  var i = groupsOf(S.init.items).indexOf(g);
  return i >= 0 && i < GROUP_PALETTE.length ? GROUP_PALETTE[i] : '#8a958e';
}
var KICON = {
  money: '<svg class="i" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
  people: '<svg class="i" viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M16 4a4 4 0 010 8M22 21c0-3-2-5-4-6"/></svg>',
  cal: '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  star: '<svg class="i" viewBox="0 0 24 24"><path d="M12 2l3 7 7 .6-5.3 4.6 1.6 7.3L12 17.8 5.7 21.5l1.6-7.3L2 9.6 9 9z"/></svg>'
};
function countUp(root) {
  root.querySelectorAll('[data-n]').forEach(function (el) {
    var end = Number(el.dataset.n), suf = el.dataset.s || '', t0 = null, dur = 700;
    if (!end) { el.textContent = '0' + suf; return; }
    function step(t) { t0 = t0 || t; var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(end * e) + suf; if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  });
}

function renderDash() {
  var d = S.data[S.fy]; if (!d) return;
  var months = fyMonths(S.fy);
  $('dTitle').textContent = 'ภาพรวมผลงาน PP ปีงบ ' + S.fy;
  $('dUpdated').textContent = d.updated ? 'ลงผลล่าสุด ' + d.updated + (/\d:\d/.test(d.updated) ? ' น.' : '') : 'ยังไม่มีข้อมูลในปีงบนี้';
  var items = itemMap(d.items.length ? d.items : S.init.items);
  var groups = groupsOf(d.items.length ? d.items : S.init.items);
  $('dGroups').innerHTML = ['ทั้งหมด'].concat(groups).map(function (g) {
    return '<button type="button" class="chip' + (S.group === g ? ' on' : '') + '" data-g="' + esc(g) + '">' + (g === 'ทั้งหมด' ? '' : '<i class="dot" style="background:' + gColor(g) + '"></i>') + esc(g) + '</button>';
  }).join('');

  var gOf = function (code) { return (items[code] || {}).group || 'อื่น ๆ'; };
  var rowsY = d.rows.filter(function (r) { return S.group === 'ทั้งหมด' || gOf(r[1]) === S.group; });
  var rows = S.month ? rowsY.filter(function (r) { return r[0].slice(0, 7) === S.month; }) : rowsY;

  var tq = 0, ta = 0, days = {}, byItem = {}, byGroup = {};
  rows.forEach(function (r) {
    tq += r[2]; ta += r[3]; days[r[0]] = 1;
    var x = byItem[r[1]] = byItem[r[1]] || { q: 0, a: 0 }; x.q += r[2]; x.a += r[3];
  });
  d.rows.filter(function (r) { return !S.month || r[0].slice(0, 7) === S.month; })
    .forEach(function (r) { var g = gOf(r[1]); byGroup[g] = (byGroup[g] || 0) + r[3]; });
  var nDays = Object.keys(days).length;
  var top = Object.keys(byItem).sort(function (a, b) { return byItem[b].a - byItem[a].a; })[0];
  var scopeM = months.find(function (m) { return m.key === S.month; });
  var scope = scopeM ? scopeM.full : 'ทั้งปีงบ';
  var delta = '';
  if (scopeM) {
    var idx = months.indexOf(scopeM);
    if (idx > 0) {
      var pk = months[idx - 1].key;
      var pa = rowsY.filter(function (r) { return r[0].slice(0, 7) === pk; }).reduce(function (s, r) { return s + r[3]; }, 0);
      if (pa > 0) { var pc = (ta - pa) / pa * 100; delta = '<span class="' + (pc >= 0 ? 'up' : 'down') + '">' + (pc >= 0 ? '▲ ' : '▼ ') + Math.abs(pc).toFixed(1) + '% จาก ' + months[idx - 1].label + '</span>'; }
    }
  }
  $('dKpis').innerHTML =
    '<div class="kpi k1"><div class="kic">' + KICON.money + '</div><small>ยอดเงิน · ' + scope + '</small><b data-n="' + ta + '" data-s=" ฿">0 ฿</b>' + (delta || '<span>' + (S.group === 'ทั้งหมด' ? 'ทุกหมวด' : esc(S.group)) + '</span>') + '</div>' +
    '<div class="kpi k2"><div class="kic">' + KICON.people + '</div><small>ผู้รับบริการ</small><b data-n="' + tq + '" data-s=" คน">0 คน</b><span>' + (nDays ? 'เฉลี่ย ' + fmt(tq / nDays) + ' คน/วัน' : '—') + '</span></div>' +
    '<div class="kpi k3"><div class="kic">' + KICON.cal + '</div><small>วันที่มีบริการ</small><b data-n="' + nDays + '" data-s=" วัน">0 วัน</b><span>' + (nDays ? 'เฉลี่ย ' + fmt(ta / nDays) + ' ฿/วัน' : '—') + '</span></div>' +
    '<div class="kpi k4"><div class="kic">' + KICON.star + '</div><small>ยอดสูงสุด</small><b class="txt">' + (top ? esc(items[top] ? items[top].name : top) : '—') + '</b><span>' + (top ? fmt(byItem[top].a) + ' ฿ · ' + Math.round(byItem[top].a / ta * 100) + '%' : '') + '</span></div>';
  countUp($('dKpis'));

  var cols;
  if (!S.month) {
    $('cTitle').textContent = 'ยอดเงินรายเดือน · ปีงบ ' + S.fy; $('cSub').textContent = 'บาท · แตะแท่งเพื่อดูตัวเลข แตะซ้ำเพื่อดูรายวัน';
    cols = months.map(function (m) {
      var q = 0, a = 0;
      rowsY.forEach(function (r) { if (r[0].slice(0, 7) === m.key) { q += r[2]; a += r[3]; } });
      return { label: MONTH[m.m], tip: m.full, q: q, a: a, month: m.key };
    });
  } else {
    var y = Number(S.month.slice(0, 4)), mi = Number(S.month.slice(5, 7)) - 1, nd = new Date(y, mi + 1, 0).getDate();
    $('cTitle').innerHTML = 'ยอดเงินรายวัน · ' + esc(scope) + ' <button type="button" class="backbtn" id="backMonth">← กลับไปดูรายเดือน</button>';
    $('cSub').textContent = 'บาท · แตะแท่งเพื่อดูตัวเลข';
    cols = [];
    for (var dd = 1; dd <= nd; dd++) {
      var k2 = S.month + '-' + pad(dd), q2 = 0, a2 = 0;
      rows.forEach(function (r) { if (r[0] === k2) { q2 += r[2]; a2 += r[3]; } });
      cols.push({ label: (dd === 1 || dd % 5 === 0) ? String(dd) : '', tip: thDate(k2, true), q: q2, a: a2 });
    }
  }
  colChart($('cMain'), cols, !S.month);
  if ($('backMonth')) $('backMonth').onclick = function () { S.month = ''; $('dMonth').value = ''; renderDash(); };

  var list = Object.keys(byItem).map(function (c) { var it = items[c] || {}; return { name: it.name || c, g: it.group || 'อื่น ๆ', q: byItem[c].q, a: byItem[c].a }; })
    .sort(function (a, b) { return b.a - a.a; });
  $('iSub').textContent = scope + ' · ' + (S.group === 'ทั้งหมด' ? 'ทุกหมวด' : S.group) + ' · เรียงจากมากไปน้อย';
  var max = list.length ? list[0].a : 0, LIM = 8, showAll = S.allItems || list.length <= LIM + 1;
  $('cItems').innerHTML = list.length ? (showAll ? list : list.slice(0, LIM)).map(function (x) {
    return '<div class="hb"><span class="nm" title="' + esc(x.name) + '">' + esc(x.name) + '</span><div class="t"><i style="width:' + (max ? x.a / max * 100 : 0) + '%;background:' + gColor(x.g) + '"></i></div><div class="v">' + fmt(x.a) + '<small>' + fmt(x.q) + ' คน</small></div></div>';
  }).join('') + (list.length > LIM + 1 ? '<button type="button" class="more" id="moreItems">' + (showAll ? 'ย่อ' : 'ดูทั้งหมด ' + list.length + ' รายการ') + '</button>' : '') : '<div class="empty">ยังไม่มีข้อมูลในช่วงนี้</div>';
  if ($('moreItems')) $('moreItems').onclick = function () { S.allItems = !S.allItems; renderDash(); };

  var gl = groups.map(function (g) { return { g: g, a: byGroup[g] || 0 }; }).sort(function (a, b) { return b.a - a.a; });
  var gsum = gl.reduce(function (s, x) { return s + x.a; }, 0), gmax = gl.length ? gl[0].a : 0;
  $('cGroups').innerHTML = gsum ? gl.map(function (x) {
    return '<div class="hb" data-g="' + esc(x.g) + '" style="cursor:pointer' + (S.group !== 'ทั้งหมด' && S.group !== x.g ? ';opacity:.45' : '') + '"><span class="nm"><i class="dot" style="background:' + gColor(x.g) + '"></i>' + esc(x.g) + '</span><div class="t"><i style="width:' + (gmax ? x.a / gmax * 100 : 0) + '%;background:' + gColor(x.g) + '"></i></div><div class="v">' + fmt(x.a) + '<small>' + Math.round(x.a / gsum * 100) + '%</small></div></div>';
  }).join('') : '<div class="empty">ยังไม่มีข้อมูลในช่วงนี้</div>';
}

function colChart(el, cols, clickable) {
  var max = Math.max.apply(null, cols.map(function (c) { return c.a; }).concat([0]));
  var nice = niceMax(max), showVal = cols.length <= 12;
  el.innerHTML = '<div class="colchart">' +
    [1, 2].map(function (k) { return '<div class="gl" style="bottom:' + (k / 3 * 100) + '%"><span>' + short(nice * k / 3) + '</span></div>'; }).join('') +
    cols.map(function (c, i) {
      return '<div class="col' + (c.a ? '' : ' zero') + '" data-i="' + i + '">' + (showVal ? '<em>' + (c.a ? short(c.a) : '') + '</em>' : '') +
        '<i style="height:' + (nice ? Math.max(c.a / nice * 100, c.a ? 1.5 : 0.8) : 0.8) + '%"></i></div>';
    }).join('') + '</div><div class="xlab">' + cols.map(function (c) { return '<span>' + c.label + '</span>'; }).join('') + '</div>';
  var chart = el.querySelector('.colchart'), tip = null;
  function show(col) {
    var c = cols[col.dataset.i];
    chart.querySelectorAll('.col.on').forEach(function (x) { x.classList.remove('on'); });
    col.classList.add('on');
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; chart.appendChild(tip); }
    tip.innerHTML = '<b>' + esc(c.tip) + '</b><br>' + fmt(c.a) + ' บาท · ' + fmt(c.q) + ' คน' + (clickable && c.a ? '<br><small style="opacity:.7">แตะ/คลิกอีกครั้งเพื่อดูรายวัน</small>' : '');
    var cr = chart.getBoundingClientRect(), r = col.getBoundingClientRect();
    var left = r.left - cr.left + r.width / 2 - tip.offsetWidth / 2;
    tip.style.left = Math.max(0, Math.min(left, cr.width - tip.offsetWidth)) + 'px';
    tip.style.top = '-8px';
  }
  chart.addEventListener('mousemove', function (e) { var col = e.target.closest('.col'); if (col) show(col); });
  chart.addEventListener('mouseleave', function () { if (tip) { tip.remove(); tip = null; } chart.querySelectorAll('.col.on').forEach(function (x) { x.classList.remove('on'); }); });
  chart.addEventListener('click', function (e) {
    var col = e.target.closest('.col'); if (!col) return;
    var c = cols[col.dataset.i];
    if (clickable && c.a && col.classList.contains('on') && tip) { S.month = c.month; $('dMonth').value = c.month; renderDash(); return; }
    show(col);
  });
}
function niceMax(v) { if (v <= 0) return 0; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; var s = n <= 1.5 ? 1.5 : n <= 3 ? 3 : n <= 6 ? 6 : 12; return s * p; }

$('dGroups').addEventListener('click', function (e) { var c = e.target.closest('[data-g]'); if (c) { S.group = c.dataset.g; renderDash(); } });
$('cGroups').addEventListener('click', function (e) { var c = e.target.closest('[data-g]'); if (c) { S.group = S.group === c.dataset.g ? 'ทั้งหมด' : c.dataset.g; renderDash(); } });
$('dMonth').addEventListener('change', function () { S.month = this.value; renderDash(); });
$('dYear').addEventListener('change', function () { S.fy = Number(this.value); S.month = ''; fillMonthSelect(); loadYear(S.fy).then(renderDash).catch(function () {}); });
function fillMonthSelect() {
  $('dMonth').innerHTML = '<option value="">ทุกเดือน</option>' + fyMonths(S.fy).map(function (m) { return '<option value="' + m.key + '">' + m.full + '</option>'; }).join('');
  $('dMonth').value = S.month;
}

/* ================= entry ================= */
function renderRule() {
  var st = S.init.settings, msg = [];
  if (S.user && !S.user.admin) msg.push('ลงผลหรือแก้ย้อนหลังได้ไม่เกิน ' + st.editDays + ' วัน');
  if (st.closedUntil) msg.push('ปิดยอดแล้วถึง ' + thDate(st.closedUntil, true));
  $('eRule').innerHTML = msg.length ? '<div class="bt">' + esc(msg.join(' · ')) + '</div>' : '';
  $('eRule').classList.toggle('hide', !msg.length);
}
function entryItems() {
  var date = $('eDate').value;
  return S.init.items.filter(function (it) { return activeOn(it, date); }).sort(function (a, b) { return a.order - b.order; });
}
function renderEntry() {
  var items = entryItems(), groups = groupsOf(items);
  if (S.eGroup !== 'ทั้งหมด' && groups.indexOf(S.eGroup) < 0) S.eGroup = 'ทั้งหมด';
  var done = {}; S.dayEntries.forEach(function (e) { done[e.code] = (done[e.code] || 0) + e.qty; });
  renderDone();
  $('eGroups').innerHTML = ['ทั้งหมด'].concat(groups).map(function (g) {
    return '<button type="button" class="chip' + (S.eGroup === g ? ' on' : '') + '" data-g="' + esc(g) + '">' + (g === 'ทั้งหมด' ? '' : '<i class="dot" style="background:' + gColor(g) + '"></i>') + esc(g) + '</button>';
  }).join('');
  $('eItems').innerHTML = groups.filter(function (g) { return S.eGroup === 'ทั้งหมด' || S.eGroup === g; }).map(function (g) {
    var gi = items.filter(function (it) { return it.group === g; });
    return '<div class="grp" style="--gc:' + gColor(g) + '"><h4><span><i class="dot" style="background:' + gColor(g) + '"></i>' + esc(g) + '</span><span id="gs-' + esc(g) + '"></span></h4><div class="box">' + gi.map(function (it) {
      var v = S.hidden[it.code] || '';
      return '<div class="it" id="row-' + it.code + '"><div class="info"><div class="nm">' + esc(it.name) + '</div>' +
        '<div class="meta">' + (it.price ? fmt(it.price) + ' ฿/' + (it.code === 'PALL' ? 'ครั้ง' : 'คน') : '<span style="color:var(--warn)">ยังไม่ตั้งราคา</span>') +
        (done[it.code] ? ' · ลงแล้ววันนี้ <b>' + fmt(done[it.code]) + '</b>' : '') + '<span id="amt-' + it.code + '"></span></div></div>' +
        '<div class="step"><button type="button" data-code="' + it.code + '" data-d="-1" aria-label="ลด">−</button>' +
        '<input type="number" min="0" inputmode="numeric" data-q="' + it.code + '" id="q-' + it.code + '" placeholder="0" value="' + esc(v) + '">' +
        '<button type="button" data-code="' + it.code + '" data-d="1" aria-label="เพิ่ม">+</button></div></div>';
    }).join('') + '</div></div>';
  }).join('') || '<div class="card empty">ไม่มีรายการที่ใช้ได้ในวันที่นี้</div>';
  recalc();
}
function recalc() {
  document.querySelectorAll('#eItems input[data-q]').forEach(function (el) {
    var v = Math.max(0, parseInt(el.value, 10) || 0); if (v) S.hidden[el.dataset.q] = v; else delete S.hidden[el.dataset.q];
  });
  var items = entryItems(), sq = 0, sa = 0, gsum = {};
  items.forEach(function (it) {
    var q = S.hidden[it.code] || 0; sq += q; sa += q * it.price; gsum[it.group] = (gsum[it.group] || 0) + q;
    var row = $('row-' + it.code); if (!row) return;
    row.classList.toggle('has', q > 0);
    $('amt-' + it.code).innerHTML = q ? ' · <b>' + q + ' = ' + fmt(q * it.price) + ' ฿</b>' : '';
  });
  Object.keys(gsum).forEach(function (g) { var el = $('gs-' + g); if (el) el.textContent = gsum[g] ? gsum[g] + ' คน' : ''; });
  $('eQ').textContent = fmt(sq); $('eA').textContent = fmt(sa);
}
$('eItems').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-code]'); if (!b) return;
  var inp = $('q-' + b.dataset.code); inp.value = Math.max(0, (parseInt(inp.value, 10) || 0) + Number(b.dataset.d)) || ''; recalc();
});
$('eItems').addEventListener('input', recalc);
$('eGroups').addEventListener('click', function (e) { var c = e.target.closest('[data-g]'); if (c) { recalc(); S.eGroup = c.dataset.g; renderEntry(); } });
var DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function dayLabel(id, d) {
  var t = S.init.today, diff = daysBetween(d, t);
  var rel = diff === 0 ? 'วันนี้' : diff === 1 ? 'เมื่อวาน' : diff + ' วันก่อน';
  $(id).innerHTML = 'วัน' + DOW[new Date(d + 'T00:00:00').getDay()] + 'ที่ ' + thDate(d, true) + ' <span class="rel' + (diff ? '' : ' now') + '">' + rel + '</span>';
}
function setEntryDate(d) {
  if (!d || d > S.init.today) return;
  recalc();
  $('eDate').value = d; dayLabel('eDay', d);
  $('eNext').disabled = d >= S.init.today;
  $('eToday').classList.toggle('hide', d === S.init.today);
  S.doneOpen = false;
  $('eDone').innerHTML = '<div class="skel" style="height:52px"></div>';
  loadDay(d).then(renderEntry);
}
$('eDate').addEventListener('change', function () { setEntryDate(this.value); });
$('ePrev').addEventListener('click', function () { setEntryDate(addDays($('eDate').value, -1)); });
$('eNext').addEventListener('click', function () { setEntryDate(addDays($('eDate').value, 1)); });
$('eToday').addEventListener('click', function () { setEntryDate(S.init.today); });
function renderDone() {
  var l = S.dayEntries, el = $('eDone');
  if (!l.length) { el.innerHTML = '<div class="done-empty">ยังไม่มีการลงผลของวันนี้</div>'; return; }
  var tq = 0, ta = 0; l.forEach(function (e) { tq += e.qty; ta += e.amount; });
  el.innerHTML = '<button type="button" class="done-head" id="doneToggle"><span class="ok">✓</span><span><b>ลงผลไปแล้ว ' + l.length + ' รายการ</b><br><small>' + fmt(tq) + ' คน · ' + fmt(ta) + ' ฿</small></span><span class="chev' + (S.doneOpen ? ' open' : '') + '">▾</span></button>' +
    '<div class="done-list' + (S.doneOpen ? ' open' : '') + '"><div class="done-inner">' + l.map(function (e) {
      return '<div class="ent"><div class="info">' + esc(e.item) + '<small>' + esc(e.user) + (e.time ? ' · ' + e.time : '') + (e.edited ? '<span class="edited"> · แก้ไขแล้ว</span>' : '') + '</small></div>' +
        '<div class="amt">' + fmt(e.qty) + '<small>' + fmt(e.amount) + ' ฿</small></div>' +
        (e.canEdit ? '<button type="button" data-eid="' + esc(e.id) + '">แก้ไข</button>' : '') + '</div>';
    }).join('') + '</div></div>';
  $('doneToggle').onclick = function () { S.doneOpen = !S.doneOpen; renderDone(); };
}
$('eDone').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-eid]'); if (!b) return;
  var en = S.dayEntries.find(function (x) { return x.id === b.dataset.eid; });
  openEditEntry(en, $('eDate').value, function () { renderEntry(); });
});
$('eSave').addEventListener('click', function () {
  recalc();
  var date = $('eDate').value, st = S.init.settings;
  var list = entryItems().filter(function (it) { return S.hidden[it.code]; });
  if (!date) { toast('เลือกวันที่ก่อน', true); return; }
  if (!list.length) { toast('ยังไม่ได้กรอกจำนวนคน', true); return; }
  if (!S.user.admin && daysBetween(date, S.init.today) > st.editDays) { toast('ลงย้อนหลังได้ไม่เกิน ' + st.editDays + ' วัน ติดต่อผู้ดูแล', true); return; }
  var done = {}; S.dayEntries.forEach(function (e) { done[e.code] = (done[e.code] || 0) + e.qty; });
  var dup = list.filter(function (it) { return done[it.code]; });
  var tq = 0, ta = 0;
  var reqId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  openModal('<h2>ยืนยันการลงผล</h2><p>วันที่ ' + thDate(date, true) + '</p>' + list.map(function (it) {
    var q = S.hidden[it.code]; tq += q; ta += q * it.price;
    return '<div class="rv"><span>' + esc(it.name) + '</span><b style="white-space:nowrap">' + q + ' · ' + fmt(q * it.price) + ' ฿</b></div>';
  }).join('') + '<div class="rv" style="border:0;font-size:15px"><b>รวม</b><b>' + fmt(tq) + ' คน · ' + fmt(ta) + ' ฿</b></div>' +
    (dup.length ? '<p style="color:var(--warn);margin:8px 0 0">มีรายการที่ลงไปแล้ววันนี้: ' + dup.map(function (it) { return esc(it.name) + ' (' + done[it.code] + ')'; }).join(', ') + ' — ยอดใหม่จะบวกเพิ่ม ไม่ได้แทนที่</p>' : '') +
    '<div class="err" id="cfErr"></div><div class="acts"><button type="button" class="btn ghost" data-close>แก้ไข</button><button type="button" class="btn" id="cfGo">ยืนยันบันทึก</button></div>');
  $('cfGo').onclick = function () {
    var btn = this; btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    call('saveEntries', S.user.token, { date: date, note: $('eNote').value, reqId: reqId, rows: list.map(function (it) { return { code: it.code, qty: S.hidden[it.code] }; }) })
      .then(function (r) {
        closeModal(); S.hidden = {}; $('eNote').value = '';
        var fy = fyOf(date); delete S.data[fy];
        S.doneOpen = true; loadDay(date).then(renderEntry); celebrate();
        toast('บันทึกแล้ว ' + fmt(r.people) + ' คน · ' + fmt(r.total) + ' ฿', false, { label: 'ดูภาพรวม', fn: function () { S.fy = fy; $('dYear').value = fy; S.month = date.slice(0, 7); fillMonthSelect(); go('dash'); } });
      })
      .catch(function (e) { $('cfErr').textContent = e.message; btn.disabled = false; btn.textContent = 'ลองบันทึกอีกครั้ง'; });
  };
});

/* ================= log ================= */
function renderLog() {
  var l = S.dayEntries;
  if (!l.length) { $('lList').className = 'empty'; $('lList').textContent = 'ยังไม่มีการลงผลวันที่ ' + thDate($('lDate').value, true); return; }
  var tq = 0, ta = 0;
  $('lList').className = '';
  $('lList').innerHTML = l.map(function (e) {
    tq += e.qty; ta += e.amount;
    return '<div class="ent"><div class="info">' + esc(e.item) + '<small>' + esc(e.user) + (e.time ? ' · ' + e.time : '') + (e.note ? ' · ' + esc(e.note) : '') +
      (e.edited ? '<span class="edited"> · แก้ไขแล้ว</span>' : '') + '</small></div>' +
      '<div class="amt">' + fmt(e.qty) + ' คน<small>' + fmt(e.amount) + ' ฿</small></div>' +
      (e.canEdit ? '<button type="button" data-id="' + esc(e.id) + '">แก้ไข</button>' : '') + '</div>';
  }).join('') + '<div class="sumline"><span>รวมวันนี้</span><span>' + fmt(tq) + ' คน · ' + fmt(ta) + ' ฿</span></div>';
}
/** หน้าต่างแก้ไข/ยกเลิก ใช้ร่วมกันทั้งหน้าลงผลและหน้าบันทึกรายวัน */
function openEditEntry(en, date, onDone) {
  openModal('<h2>แก้ไขรายการ</h2><p>' + esc(en.item) + ' · ' + thDate(date, true) + ' · ลงโดย ' + esc(en.user) + '</p>' +
    '<label class="f">จำนวนคน<div class="step" style="margin-top:6px"><button type="button" id="edM">−</button><input type="number" min="0" inputmode="numeric" id="edQ" value="' + en.qty + '" style="flex:1;width:auto"><button type="button" id="edP">+</button></div></label>' +
    '<p id="edAmt" style="margin:0 0 10px">' + fmt(en.amount) + ' ฿</p>' +
    '<label class="f">เหตุผล (จำเป็น)<input id="edWhy" maxlength="200" placeholder="เช่น นับผิด, ลงซ้ำ, ผิดรายการ"></label>' +
    '<div class="err" id="edErr"></div>' +
    '<div class="acts"><button type="button" class="btn ghost" id="edDel" style="color:var(--red)">ยกเลิกรายการ</button><button type="button" class="btn" id="edGo">บันทึก</button></div>');
  var upd = function () { $('edAmt').textContent = fmt((parseInt($('edQ').value, 10) || 0) * en.price) + ' ฿'; };
  $('edM').onclick = function () { $('edQ').value = Math.max(0, (parseInt($('edQ').value, 10) || 0) - 1); upd(); };
  $('edP').onclick = function () { $('edQ').value = (parseInt($('edQ').value, 10) || 0) + 1; upd(); };
  $('edQ').oninput = upd;
  var send = function (q, msg) {
    var why = $('edWhy').value.trim();
    if (why.length < 3) { $('edErr').textContent = 'กรุณาใส่เหตุผล'; $('edWhy').focus(); return; }
    $('edGo').disabled = $('edDel').disabled = true;
    call('updateEntry', S.user.token, en.id, q, why).then(function () {
      closeModal(); toast(msg); delete S.data[fyOf(date)];
      loadDay(date).then(onDone);
    }).catch(function (er) { $('edErr').textContent = er.message; $('edGo').disabled = $('edDel').disabled = false; });
  };
  $('edGo').onclick = function () { var q = parseInt($('edQ').value, 10) || 0; if (q === en.qty) { closeModal(); return; } send(q, q ? 'แก้ไขแล้ว' : 'ยกเลิกรายการแล้ว'); };
  $('edDel').onclick = function () { if (this.dataset.sure) send(0, 'ยกเลิกรายการแล้ว'); else { this.dataset.sure = 1; this.textContent = 'กดอีกครั้งเพื่อยืนยัน'; } };
}
$('lList').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-id]'); if (!b) return;
  var en = S.dayEntries.find(function (x) { return x.id === b.dataset.id; });
  openEditEntry(en, $('lDate').value, renderLog);
});
function setLogDate(d) { if (d > S.init.today) return; $('lDate').value = d; dayLabel('lDay', d); loadDay(d).then(renderLog); }
$('lDate').addEventListener('change', function () { setLogDate(this.value); });
$('lPrev').addEventListener('click', function () { setLogDate(addDays($('lDate').value, -1)); });
$('lNext').addEventListener('click', function () { setLogDate(addDays($('lDate').value, 1)); });

/* ================= report ================= */
function reportMatrix() {
  var fy = Number($('rYear').value), d = S.data[fy]; if (!d) return null;
  var months = fyMonths(fy), mi = {}; months.forEach(function (m, i) { mi[m.key] = i; });
  var idx = S.rMode === 'a' ? 3 : 2, cell = {};
  d.rows.forEach(function (r) { var i = mi[r[0].slice(0, 7)]; if (i == null) return; cell[r[1]] = cell[r[1]] || new Array(12).fill(0); cell[r[1]][i] += r[idx]; });
  var items = (d.items.length ? d.items : S.init.items).filter(function (it) {
    return cell[it.code] || (it.enabled && (!it.to || it.to >= d.start) && (!it.from || it.from <= d.end));
  }).sort(function (a, b) { return a.order - b.order; });
  return { fy: fy, months: months, cell: cell, items: items, groups: groupsOf(items) };
}
function renderReport() {
  var M = reportMatrix(); if (!M) return;
  $('rSub').textContent = 'ปีงบ ' + M.fy + ' (ต.ค.' + be2(M.fy - 544) + '–ก.ย.' + be2(M.fy - 543) + ') · หน่วย: ' + (S.rMode === 'a' ? 'บาท' : 'คน');
  var colTot = new Array(12).fill(0), grand = 0;
  var html = '<tr><th>รายการ</th><th>ราคา</th>' + M.months.map(function (m) { return '<th>' + m.label + '</th>'; }).join('') + '<th>รวม</th></tr>';
  M.groups.forEach(function (g) {
    var gi = M.items.filter(function (i) { return i.group === g; }), gt = new Array(12).fill(0);
    var body = gi.map(function (it) {
      var v = M.cell[it.code] || new Array(12).fill(0), t = 0;
      var tds = v.map(function (x, k) { t += x; gt[k] += x; return '<td class="' + (x ? '' : 'z') + '">' + (x ? fmt(x) : '–') + '</td>'; }).join('');
      return '<tr><td title="' + esc(it.full) + '">' + esc(it.name) + '</td><td>' + fmt(it.price) + '</td>' + tds + '<td class="tc">' + fmt(t) + '</td></tr>';
    }).join('');
    var gs = gt.reduce(function (s, x) { return s + x; }, 0);
    gt.forEach(function (x, k) { colTot[k] += x; }); grand += gs;
    html += '<tr class="g"><td>' + esc(g) + '</td><td></td>' + gt.map(function (x) { return '<td>' + (x ? fmt(x) : '') + '</td>'; }).join('') + '<td>' + fmt(gs) + '</td></tr>' + body;
  });
  html += '<tr class="tot"><td>รวมทั้งหมด</td><td></td>' + colTot.map(function (x) { return '<td>' + fmt(x) + '</td>'; }).join('') + '<td>' + fmt(grand) + '</td></tr>';
  $('rTable').innerHTML = html;
}
$('rYear').addEventListener('change', function () { loadYear(Number(this.value)).then(renderReport).catch(function () {}); });
$('rMode').addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b) return; S.rMode = b.dataset.m;
  this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderReport();
});
$('rPrint').addEventListener('click', function () { window.print(); });
$('rCsv').addEventListener('click', function () {
  var M = reportMatrix(); if (!M) return;
  var q = function (s) { s = String(s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  var lines = [['หมวด', 'รหัส', 'รายการ', 'กิจกรรม', 'ราคา'].concat(M.months.map(function (m) { return m.label; }), ['รวม']).map(q).join(',')];
  var colTot = new Array(12).fill(0);
  M.items.forEach(function (it) {
    var v = M.cell[it.code] || new Array(12).fill(0), t = v.reduce(function (s, x) { return s + x; }, 0);
    v.forEach(function (x, k) { colTot[k] += x; });
    lines.push([it.group, it.code, it.name, it.full, it.price].concat(v, [t]).map(q).join(','));
  });
  lines.push(['', '', 'รวมทั้งหมด', '', ''].concat(colTot, [colTot.reduce(function (s, x) { return s + x; }, 0)]).map(q).join(','));
  var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'PP_ปีงบ' + M.fy + '_' + (S.rMode === 'a' ? 'บาท' : 'คน') + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
});

/* ================= start ================= */
call('getInit').then(function (init) {
  S.init = init;
  if (!DEMO && init.apiVersion !== APP_API_VERSION) toast('หลังบ้าน (Apps Script) เป็นเวอร์ชัน ' + init.apiVersion + ' แต่หน้าเว็บต้องการ ' + APP_API_VERSION + ' — กรุณา Deploy เวอร์ชันใหม่', true);
  if (init.settings && init.settings.org) $('orgName').textContent = init.settings.org;
  S.fy = fyOf(init.today);
  var yopt = init.fys.map(function (y) { return '<option value="' + y + '">ปีงบ ' + y + '</option>'; }).join('');
  $('dYear').innerHTML = yopt; $('rYear').innerHTML = yopt; $('dYear').value = S.fy; $('rYear').value = S.fy;
  fillMonthSelect();
  $('eDate').value = init.today; $('eDate').max = init.today;
  $('lDate').value = init.today; $('lDate').max = init.today;
  dayLabel('eDay', init.today); dayLabel('lDay', init.today); $('eNext').disabled = true; $('eToday').classList.add('hide');
  try { var u = JSON.parse(store('ppUser') || 'null'); if (u && u.token) S.user = u; } catch (e) {}
  if (DEMO) $('demoBar').classList.remove('hide');
  go('dash');
}).catch(function (e) { $('dUpdated').textContent = e.message; toast(e.message, true); });

/* ================= PWA: ติดตั้ง + อัปเดต ================= */
if ('serviceWorker' in navigator) window.addEventListener('load', function () {
  navigator.serviceWorker.register('sw.js').then(function (reg) {
    reg.addEventListener('updatefound', function () {
      var nw = reg.installing; if (!nw) return;
      nw.addEventListener('statechange', function () {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('มีเวอร์ชันใหม่ของแอป', false, { label: 'อัปเดต', fn: function () { location.reload(); } });
      });
    });
  }).catch(function () {});
});
var installEvt = null;
var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; showInstall(); });
function showInstall() {
  if (standalone || store('ppNoInstall')) return;
  if (!installEvt && !isIOS) return;
  $('installBar').classList.remove('hide');
}
$('installGo').addEventListener('click', function () {
  if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; $('installBar').classList.add('hide'); }); return; }
  openModal('<h2>ติดตั้งบน iPhone / iPad</h2><p>เปิดลิงก์นี้ด้วย Safari แล้วทำตามนี้</p>' +
    '<div class="rv"><span>1. แตะปุ่มแชร์ <b>⬆︎</b> ด้านล่างจอ</span></div><div class="rv"><span>2. เลือก <b>เพิ่มไปยังหน้าจอโฮม</b></span></div><div class="rv" style="border:0"><span>3. แตะ <b>เพิ่ม</b> ไอคอน PP จะอยู่บนหน้าจอ</span></div>' +
    '<div class="acts"><button type="button" class="btn" data-close>เข้าใจแล้ว</button></div>');
});
$('installNo').addEventListener('click', function () { store('ppNoInstall', '1'); $('installBar').classList.add('hide'); });
setTimeout(showInstall, 1500);

/* ================= effects ================= */
// ระลอกน้ำเมื่อกดปุ่ม
document.addEventListener('pointerdown', function (e) {
  var b = e.target.closest('.btn, .chip, .step button, .tabbar button, .nav button, .daynav button, .datebar button');
  if (!b || b.disabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.6, s = document.createElement('span');
  s.className = 'ripple'; s.style.width = s.style.height = d + 'px';
  s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
  b.appendChild(s); setTimeout(function () { s.remove(); }, 600);
});
// เครื่องหมายถูกเด้งเมื่อบันทึกสำเร็จ
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var o = document.createElement('div'); o.className = 'celebrate';
  o.innerHTML = '<div class="burst"></div><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg>';
  document.body.appendChild(o); setTimeout(function () { o.remove(); }, 1300);
}
