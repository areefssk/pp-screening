/* โหมดตัวอย่าง: ใช้เมื่อยังไม่ได้ใส่ API_URL ใน config.js หรือเปิดด้วย ?demo=1
   รายการและราคาเป็นของจริง แต่จำนวนคนสุ่มขึ้น และไม่ได้บันทึกที่ไหน (รีเฟรชแล้วหาย) */
(function () {
  var ITEMS = [
    ['PNC', 1, 'ตรวจหลังคลอด', 'ค่าบริการตรวจหลังคลอด', 'แม่และเด็ก', 150, '', ''],
    ['PNC_TRI', 2, 'ยาเสริม Triferdine (หลังคลอด)', 'ค่ายาเสริม ธาตุเหล็ก กรดโฟลิก ไอโอดีน Triferdine', 'แม่และเด็ก', 135, '', ''],
    ['CBC', 3, 'คัดกรองโลหิตจาง (CBC)', 'ค่าบริการเจาะเลือดตรวจนับเม็ดเลือด (CBC)', 'แม่และเด็ก', 65, '', ''],
    ['IRON', 4, 'ยาเม็ดเสริมธาตุเหล็ก (13–45 ปี)', 'ยาเม็ดเสริมธาตุเหล็กและกรดโฟลิค (13-45 ปี)', 'แม่และเด็ก', 80, '', ''],
    ['DT', 5, 'วัคซีน dT ผู้ใหญ่', 'ฉีดวัคซีนป้องกันโรคคอตีบและบาดทะยัก (dT)', 'วัคซีน', 20, '', ''],
    ['FLU', 6, 'วัคซีนไข้หวัดใหญ่', 'ฉีดวัคซีนป้องกันโรคไข้หวัดใหญ่ตามฤดูกาล', 'วัคซีน', 20, '', ''],
    ['CXR', 7, 'คัดกรองวัณโรค CXR', 'คัดกรองวัณโรคด้วย Chest X-ray', 'โรคติดเชื้อ', 100, '', ''],
    ['HBV', 8, 'คัดกรองไวรัสตับอักเสบบี', 'ค่าตรวจคัดกรองไวรัสตับอักเสบบี', 'โรคติดเชื้อ', 50, '', ''],
    ['HCV', 9, 'คัดกรองไวรัสตับอักเสบซี', 'Anti-HCV Screening test', 'โรคติดเชื้อ', 50, '', ''],
    ['HPV', 10, 'คัดกรองมะเร็งปากมดลูก HPV', 'HPV DNA Test (Self-sampling)', 'มะเร็ง', 50, '', ''],
    ['FIT', 11, 'คัดกรองมะเร็งลำไส้ (FIT test)', 'คัดกรองมะเร็งลำไส้ใหญ่และลำไส้ตรง (Fit test)', 'มะเร็ง', 60, '', ''],
    ['DMLIPID', 12, 'คัดกรองเบาหวานและไขมัน (เดิม)', 'ค่าบริการคัดกรองเบาหวานและไขมันในเลือด', 'NCD', 40, '', '2026-04-30'],
    ['DM', 12, 'คัดกรองเบาหวาน', 'ค่าบริการคัดกรองเบาหวาน', 'NCD', 40, '2026-05-01', ''],
    ['LIPID', 13, 'คัดกรองไขมันในเลือด', 'ค่าบริการคัดกรองไขมันในเลือด', 'NCD', 160, '2026-05-01', ''],
    ['WCC', 14, 'วัคซีน WCC', 'บริการให้วัคซีน WCC', 'วัคซีน', 20, '', ''],
    ['HIV', 15, 'คัดกรอง HIV', 'ค่าบริการตรวจ HIV', 'โรคติดเชื้อ', 100, '', ''],
    ['SYP', 16, 'คัดกรอง Syphilis', 'ค่าบริการตรวจ Syphilis', 'โรคติดเชื้อ', 50, '', ''],
    ['TBDM', 17, 'คัดกรอง TB กลุ่ม DM', 'ค่าบริการตรวจคัดกรอง TB กลุ่ม DM', 'โรคติดเชื้อ', 100, '', ''],
    ['PALL', 18, 'เยี่ยมบ้าน Palliative Care', 'เยี่ยมบ้าน Palliative Care', 'Palliative', 1000, '2026-03-01', '']
  ].map(function (r) { return { code: r[0], order: r[1], name: r[2], full: r[3], group: r[4], price: r[5], from: r[6], to: r[7], enabled: true }; });
  var byCode = {}; ITEMS.forEach(function (i) { byCode[i.code] = i; });
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var now = new Date();
  var TODAY = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var fyOf = function (d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return (m >= 10 ? y + 1 : y) + 543; };
  var on = function (it, d) { return (!it.from || d >= it.from) && (!it.to || d <= it.to); };

  var seed = 11; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var base = { PNC: .5, PNC_TRI: .3, IRON: 3, HBV: 4, HCV: 4, HPV: .6, FIT: .5, WCC: 2, FLU: 1.5, HIV: 6, SYP: 6, CXR: .5, TBDM: .5, LIPID: .3, PALL: .03 };
  var LOG = [], id = 0, start = new Date(now.getFullYear() - 1, 9, 1);
  for (var t = new Date(start); ; t.setDate(t.getDate() + 1)) {
    var iso = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    if (iso >= TODAY) break;
    if (t.getDay() === 0 || t.getDay() === 6) continue;
    var big = rnd() < .15;
    Object.keys(base).forEach(function (c) {
      if (!on(byCode[c], iso)) return;
      var q = Math.round(base[c] * (big ? 7 : .6) * rnd() * 2);
      if (q > 0) LOG.push({ id: 'd' + (++id), date: iso, code: c, qty: q, price: byCode[c].price, user: rnd() < .5 ? 'พยาบาล ก' : 'พยาบาล ข', time: '09:' + pad(Math.floor(rnd() * 60)), note: '', edited: '' });
    });
  }
  var AUDIT = [], session = null;
  var me = function () {
    if (!session) { try { var u = JSON.parse(localStorage.getItem('ppUser') || 'null'); if (u) session = { name: u.name, role: u.role }; } catch (e) {} }
    if (!session) throw new Error('SESSION_EXPIRED: กรุณาเข้าสู่ระบบอีกครั้ง');
    return session;
  };
  var API = {
    getInit: function () {
      var fys = {}; LOG.forEach(function (e) { fys[fyOf(e.date)] = 1; }); fys[fyOf(TODAY)] = 1;
      return { apiVersion: 3, items: ITEMS, users: ['ผู้ดูแลระบบ', 'พยาบาล ก', 'พยาบาล ข'], today: TODAY,
               fys: Object.keys(fys).map(Number).sort(function (a, b) { return b - a; }),
               settings: { org: 'โหมดตัวอย่าง', closedUntil: '', editDays: 7 } };
    },
    getYearData: function (fy) {
      var ce = fy - 543, s = (ce - 1) + '-10-01', e = ce + '-09-30', sum = {};
      LOG.forEach(function (x) { if (x.date < s || x.date > e) return; var k = x.date + '|' + x.code, c = sum[k] = sum[k] || [x.date, x.code, 0, 0]; c[2] += x.qty; c[3] += x.qty * x.price; });
      return { fy: fy, start: s, end: e, items: ITEMS, rows: Object.keys(sum).map(function (k) { return sum[k]; }), updated: 'โหมดตัวอย่าง' };
    },
    login: function (name, pin) {
      if (!name || !pin) throw new Error('เลือกชื่อและใส่ PIN');
      session = { name: name, role: name === 'ผู้ดูแลระบบ' ? 'ผู้ดูแล' : 'ผู้ใช้' };
      return { token: 'demo', name: name, role: session.role, admin: session.role === 'ผู้ดูแล', weakPin: false, sheetUrl: '' };
    },
    logout: function () { session = null; return true; },
    changePin: function () { me(); return true; },
    saveEntries: function (t, p) {
      var u = me(), tq = 0, ta = 0, n = 0;
      p.rows.forEach(function (r) { var it = byCode[r.code]; n++; tq += r.qty; ta += r.qty * it.price;
        LOG.push({ id: 'd' + (++id), date: p.date, code: r.code, qty: r.qty, price: it.price, user: u.name, time: new Date().toTimeString().slice(0, 5), note: p.note || '', edited: '' }); });
      return { count: n, people: tq, total: ta };
    },
    getEntries: function (t, date) {
      var u = me();
      return LOG.filter(function (e) { return e.date === date; }).map(function (e) {
        return { id: e.id, code: e.code, item: byCode[e.code].name, qty: e.qty, price: e.price, amount: e.qty * e.price, user: e.user, note: e.note, time: e.time, edited: e.edited,
                 canEdit: u.role === 'ผู้ดูแล' || e.user === u.name };
      });
    },
    updateEntry: function (t, eid, qty, reason) {
      var u = me(), i = LOG.findIndex(function (e) { return e.id === eid; });
      if (i < 0) throw new Error('ไม่พบรายการนี้');
      if (!reason || reason.length < 3) throw new Error('กรุณาใส่เหตุผลการแก้ไข');
      AUDIT.unshift({ at: new Date().toTimeString().slice(0, 5), by: u.name, action: qty ? 'แก้จำนวน' : 'ยกเลิก', date: LOG[i].date, item: byCode[LOG[i].code].name, from: LOG[i].qty, to: qty, reason: reason });
      if (qty === 0) LOG.splice(i, 1); else { LOG[i].qty = qty; LOG[i].edited = 'yes'; }
      return true;
    },
    getAudit: function () { me(); return AUDIT.slice(0, 50); }
  };
  window.PPDemo = {
    call: function (fn, args) {
      return new Promise(function (res, rej) {
        setTimeout(function () { try { res(JSON.parse(JSON.stringify(API[fn].apply(null, args)))); } catch (e) { rej(e); } }, 120);
      });
    }
  };
})();
