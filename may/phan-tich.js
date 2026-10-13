// Phân tích SAM chuyền may: đọc file IE (sheet SAM, Layout, SAM FIN) thành dữ liệu mã hàng.
// Chỉ logic, không dùng DOM / Three.js → chạy được trong trình duyệt (window.PT) và node (require).
(function (root) {
'use strict';

const GROUPS = ['Treo đầu chuyền', 'May', 'Checker', 'QA', 'Là', 'Hoàn thiện'];
// norm gọi rất nhiều lần trên cùng chuỗi (mã CĐ, mã hàng, tên): nhớ kết quả (xem lại theo giờ kéo / chạy nhanh không bị giật)
const NORM = new Map();
const norm = s => {
  const k = String(s == null ? '' : s);
  let v = NORM.get(k);
  if (v === undefined) {
    v = k.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').replace(/\s+/g, ' ').toLowerCase().trim();
    if (NORM.size > 50000) NORM.clear();
    NORM.set(k, v);
  }
  return v;
};
const num = v => { if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const r3 = v => Math.round(v * 1000) / 1000;
const W = (vi, en) => ({ vi, en });          // cảnh báo song ngữ
const vn = v => String(r3(v)).replace('.', ',');   // số trong câu tiếng Việt
const cell = (rows, r, c) => (rows[r] && rows[r][c] != null ? rows[r][c] : '');
const txt = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const CK = new Map();
const codeKey = v => { let k = CK.get(v); if (k === undefined) { k = norm(v).replace(/\s/g, ''); if (CK.size > 50000) CK.clear(); CK.set(v, k); } return k; };
// Style gốc: bỏ 2 số thị trường ở đầu mã ETS (01347N278, 04347N278 → 347n278; 25346N392 → 346n392). Cùng style gốc = cùng mẫu, cùng SAM.
const styleCore = v => { const k = codeKey(v), m = k.match(/^\d{2}(\d{3}[a-z].*)$/); return m ? m[1] : k; };

// Xếp công đoạn vào cụm: ưu tiên cột Cụm trong file, không có thì đoán theo tên công đoạn
function groupOf(g, name) {
  const test = t => {
    if (/hoan thien|cat chi|hut chi|dong goi|treo the|gan the|finish|pack|remove|stamp|bo so/.test(t)) return 'Hoàn thiện';
    if (/treo hang|^treo$|dau chuyen|phan bo|nhan bo|cap hang|feeding/.test(t)) return 'Treo đầu chuyền';
    if (/checker|check|inspect|soi den|kiem.*cuoi|cuoi chuyen|kiem 100|kiem hang/.test(t)) return 'Checker';
    if (/\bqa\b|\bqc\b|kcs|do thong so/.test(t)) return 'QA';
    if (/^la\b|^ui\b|(^| )la$|(^| )ui$|iron|la thanh pham|ui thanh pham/.test(t)) return 'Là';
    return null;
  };
  const G = norm(g);
  if (G) return test(G) || 'May';
  return test(norm(name)) || 'May';
}

// Loại máy trong file IE → tên hiển thị (trang 3D chọn mô hình máy theo tên này)
const EQUIP = [[/^fl$/, 'FL (trần đè)'], [/^fl ?\(vien\)$/, 'FL (viền)'], [/^sn$/, 'SN (1 kim)'], [/^ol mom nho$/, 'OL mõm nhỏ (vắt sổ)'], [/^ol$/, 'OL (vắt sổ)'],
  [/^mh ?380$/, 'MH380 (viền)'], [/^hw$/, 'HW (bàn tay)'], [/^dn$/, 'DN (2 kim)'], [/^bt$/, 'BT (bọ)'], [/^kh$|^button ?hole$/, 'KH (thùa khuy)'], [/^bh$|^button$/, 'BH (đính cúc)']];
function equipName(type, name) {
  const t = norm(type);
  if (t) { const m = EQUIP.find(([re]) => re.test(t)); return m ? m[1] : txt(type); }
  const n = norm(name);
  if (/hut chi/.test(n)) return 'Máy hút chỉ';
  if (/kiem/.test(n)) return 'Bàn kiểm';
  if (/(^| )la( |$)|ui/.test(n)) return 'Bàn là';
  if (/treo/.test(n)) return 'Giá treo';
  return '';
}
const equipCode = e => txt(e).replace(/\s*\(.*\)$/, '');   // 'OL mõm nhỏ (vắt sổ)' → 'OL mõm nhỏ'

// ---------- Nhận dạng sheet ----------
const sheetNo = n => { const m = String(n).match(/(\d+)\s*\)?\s*$/); return m ? +m[1] : null; };
function findHeaders(rows, nameRe) {
  const out = [];
  for (let r = 0; r < Math.min(rows.length, 400); r++) {
    const cs = (rows[r] || []).map(norm);
    if (cs.some(c => nameRe.test(c)) && cs.some(c => /\bsam\b/.test(c))) out.push(r);
  }
  return out;
}
function findStyle(rows) {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const s = txt(row[c]); const m = s.match(/^style\s*[:：]?\s*(.*)$/i);
      if (!m) continue;
      if (m[1]) return m[1].trim();
      for (let k = c + 1; k < row.length; k++) if (txt(row[k])) return txt(row[k]);
    }
  }
  return '';
}
// sheetNames + rowsOf(name) → danh sách sheet SAM / Layout / FIN / CUT có thể dùng
function classify(sheetNames, rowsOf) {
  const res = { sam: [], layout: [], fin: [], cut: [] };
  sheetNames.forEach(name => {
    const n = norm(name), rows = rowsOf(name);
    const head = rows.slice(0, 12).map(r => (r || []).map(norm).join(' ')).join(' ');
    const item = { name, no: sheetNo(name), style: findStyle(rows) };
    if (/layout/.test(n) || /sewing layout/.test(head)) {
      const L = parseLayout(rows); item.tables = L.tables.length; if (item.tables) res.layout.push(item); return;
    }
    if (/cut/.test(n) || /sam for c/.test(head)) { if (findHeaders(rows, /operation name|ten cong doan/).length) res.cut.push(item); return; }
    if (/fin/.test(n) || /sam for fi/.test(head)) { if (findHeaders(rows, /operation name|ten cong doan/).length) res.fin.push(item); return; }
    if (/sam/.test(n) && findHeaders(rows, /operation name/).length) {
      const P = parseSam(rows); item.ops = P.ops.length; item.sum = r3(P.ops.reduce((a, o) => a + o.samAuto, 0));
      if (item.ops) res.sam.push(item);
    }
  });
  return res;
}
// Cặp sheet mặc định: SAM và Layout cùng số lớn nhất (VD "SAM 25" + "Layout 25")
function defaultPick(cls) {
  const lay = new Map(cls.layout.filter(l => l.no != null).map(l => [l.no, l.name]));
  const pairs = cls.sam.filter(s => s.no != null && lay.has(s.no)).sort((a, b) => b.no - a.no);
  const sam = pairs[0] ? pairs[0].name : (cls.sam[cls.sam.length - 1] || {}).name || '';
  const layout = pairs[0] ? lay.get(pairs[0].no) : (cls.layout[cls.layout.length - 1] || {}).name || '';
  const st = norm((cls.sam.find(x => x.name === sam) || {}).style);
  const fin = cls.fin.find(f => st && norm(f.style) === st) || cls.fin.find(f => /(^| )fin( |$)/.test(norm(f.name))) || cls.fin[0];
  return { sam, layout, fin: fin ? fin.name : '' };
}

// ---------- Sheet SAM (mẫu IE: NO | SC§ | OP CODE | OPERATION NAME | Skill Grade | SAM auto | SAM manual | TARGET | NO OPERATOR | MACHINE TYPE | OPERATOR | MACHINE) ----------
function parseSam(rows) {
  const heads = findHeaders(rows, /operation name|ten cong doan/);
  const ops = [], totals = [];
  let totalSam = NaN, phu = false;              // phu: đã qua dòng "Công đoạn phụ" (mẫu Auto hanger: CĐ phía trên = CĐ chính / C&M)
  heads.forEach((h, hi) => {
    const hd = (rows[h] || []).map(norm), sub = (rows[h + 1] || []).map(norm);
    const col = re => hd.findIndex(c => re.test(c));
    const samCols = hd.map((c, j) => (/\bsam\b/.test(c) && !/target/.test(c) ? j : -1)).filter(j => j >= 0);
    let man = samCols.find(j => /manual/.test(hd[j]) || /manual/.test(sub[j]));
    let auto = samCols.find(j => j !== man);
    if (man == null && samCols.length > 1) man = samCols[1];
    const C = { no: col(/^no\.?$|^stt$/), sc: col(/^sc|^ma cd|^ma cong doan/), op: col(/op code/), name: col(/operation name|ten cong doan/),
      grade: col(/skill|bac tho/), target: col(/target/), nOp: col(/no operator/), equip: col(/machine type|loai may/),
      w: hd.findIndex(c => /^operator$|^so nguoi$|^so cn$/.test(c)), mach: hd.findIndex(c => /^machine$|^so may$/.test(c)) };
    const end = heads[hi + 1] != null ? heads[hi + 1] : rows.length;
    for (let r = h + 1; r < end; r++) {
      const row = rows[r] || [];
      if (row.some(c => /cong doan phu/.test(norm(c)))) { phu = true; continue; }
      const name = txt(row[C.name]), sa = num(row[auto]), no = num(row[C.no]);
      if (!name && isFinite(sa) && !isFinite(no)) { if (!totals.some(t => t.block === hi)) totals.push({ block: hi, sam: sa, w: num(row[C.w]) }); continue; }
      if (/^(total|tong) ?sam/.test(norm(name)) && sa > 0) { totalSam = sa; continue; }
      if (!name || !(sa > 0) || /^(tong|total|cong)\b/.test(norm(name))) continue;
      if (!isFinite(no) && !txt(row[C.sc]) && !txt(row[C.op]) && !/[a-zà-ỹđ]/.test(name)) continue;   // dòng cộng phụ viết hoa (VD "HANGER AUTO"): không STT, không mã
      const sm = man != null ? num(row[man]) : NaN, w = num(row[C.w]), nOp = num(row[C.nOp]);
      ops.push({ block: hi, no: isFinite(no) ? no : ops.length + 1, code: txt(row[C.sc]), opCode: txt(row[C.op]), name, grade: txt(row[C.grade]),
        samAuto: sa, samMan: isFinite(sm) && sm > 0 ? sm : sa, w: w > 0 ? w : (nOp > 0 ? Math.round(nOp * 2) / 2 : 1),
        equipType: txt(row[C.equip]), machines: num(row[C.mach]), sub: phu });
    }
  });
  // Đầu sheet: TARGET OUTPUT … PCS/ 23 OPERATOR/8 HOUR … Eff%
  let target = NaN, operators = NaN, hours = NaN, eff = NaN;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    row.forEach((v, c) => {
      const t = norm(v);
      if (/target out ?put/.test(t)) for (let k = c + 1; k < row.length; k++) { if (/pcs|operator/.test(norm(row[k]))) break; if (isFinite(num(row[k])) && txt(row[k])) { target = num(row[k]); break; } }
      const hm = t.match(/operator\s*\/\s*(\d+)\s*hour/); if (hm) { hours = +hm[1]; if (isFinite(num(row[c - 1]))) operators = num(row[c - 1]); }
      if (/^eff/.test(t)) for (let k = c + 1; k < row.length; k++) if (isFinite(num(row[k])) && txt(row[k])) { eff = num(row[k]); break; }
    });
  }
  // Bảng "Machine requirement": loại máy → số máy
  const machineReq = {};
  for (let r = 0; r < rows.length; r++) {
    const c = (rows[r] || []).findIndex(v => /machine requirem/.test(norm(v)));
    if (c < 0) continue;
    for (let k = r + 1; k < Math.min(rows.length, r + 25); k++) {
      const t = txt(cell(rows, k, c)), n = num(cell(rows, k, c + 1));
      if (!t) { if (Object.keys(machineReq).length) break; continue; }
      if (/^total/i.test(t)) break;
      if (isFinite(n)) machineReq[t] = n;
    }
    break;
  }
  return { style: findStyle(rows), ops, totals, totalSam, target, operators, hours, eff, machineReq, hasSub: phu };
}

// ---------- Sheet Layout: các cụm ô [mã CĐ | tên | số bàn], loại máy ở dòng ngay dưới mã ----------
// Mẫu chuyền treo (VD "Layout Auto" 346N392): [loại máy | tên | số trạm], mã CĐ ở dòng ngay dưới loại máy.
function parseLayout(rows) {
  const isBan = v => (typeof v === 'number' || /^\d+$/.test(txt(v))) && Number.isInteger(+v) && +v >= 1 && +v <= 400;
  const isCode = s => /^[\d+\/ ,.]+$/.test(s);
  // Lượt 1: mọi cụm ô có thể là bàn / trạm
  const cand = [];
  rows.forEach((row, r) => {
    row = row || [];
    for (let c = 0; c + 2 < row.length; c++) {
      if (!isBan(row[c + 2])) continue;
      let code = txt(row[c]), eq = '';
      const name = txt(row[c + 1]), below = txt(cell(rows, r + 1, c));
      if (!name || /[:：]$/.test(name) || !/[a-zà-ỹđ]/i.test(name)) continue;
      if (code && !isCode(code)) {
        if (!(code.length <= 16 && below && isCode(below))) continue;
        eq = code; code = below;                // mẫu chuyền treo: loại máy ở trên, mã ở dưới
      } else eq = below && !/^\d/.test(below) && below.length <= 16 ? below : '';
      cand.push({ r, c, ban: +row[c + 2], code, name, equipType: eq });
      c += 2;
    }
  });
  // Bảng tổng hợp (Total sewer, Version, Folder…) chỉ chặn các cột bên phải nó khi đã có sơ đồ bàn ở bên trái, phía trên
  // (ô "eff. SAM", "Target output" đặt trên đầu sơ đồ thì không tính)
  let limit = Infinity, sewers = NaN, machines = NaN;
  rows.forEach((row, r) => (row || []).forEach((v, c) => {
    const t = norm(v);
    if (/total sewer/.test(t)) sewers = num(row[c + 1]);
    if (/total machine/.test(t)) machines = num(row[c + 1]);
    if (/total sewer|total machine|version|plan loading|eff\. ?sam|target output|folder|forder/.test(t) && cand.some(k => k.r <= r && k.c < c)) limit = Math.min(limit, c);
  }));
  const tables = [], empty = [], banCols = new Set();
  cand.filter(k => k.c + 2 < limit).forEach(k => {
    tables.push({ ban: k.ban, code: k.code, name: k.name, equipType: k.equipType, row: k.r, col: k.c });
    banCols.add(k.c + 2);
  });
  // Bàn trống: chỉ có số bàn, nằm ở cột số bàn, bên trái không có mã / tên
  rows.forEach(row => {
    row = row || [];
    banCols.forEach(c => { if (isBan(row[c]) && !txt(row[c - 1]) && !txt(row[c - 2])) empty.push(+row[c]); });
  });
  return { style: findStyle(rows), tables, empty: [...new Set(empty)].sort((a, b) => a - b), sewers, machines };
}

// ---------- Sheet SAM FIN / SAM CUT: No | Operation code | Operation name | SAM | … | Số người ----------
function parseFin(rows) {
  const heads = findHeaders(rows, /operation name|ten cong doan/);
  const ops = [];
  heads.forEach(h => {
    const hd = (rows[h] || []).map(norm), col = re => hd.findIndex(c => re.test(c));
    const C = { code: col(/operation code|ma cd/), name: col(/operation name|ten cong doan/), sam: col(/^sam\b/), w: col(/so nguoi|hc group|operator/) };
    for (let r = h + 1; r < rows.length; r++) {
      const name = txt(cell(rows, r, C.name)), sam = num(cell(rows, r, C.sam));
      if (!name) { if (ops.length) break; continue; }
      if (/total|tong/.test(norm(name)) || !(sam > 0)) continue;
      ops.push({ code: txt(cell(rows, r, C.code)), name, sam, w: num(cell(rows, r, C.w)) });
    }
  });
  return { style: findStyle(rows), ops };
}

// ---------- Gộp SAM + Layout (+ FIN) thành 1 mã hàng ----------
const banRange = list => {                     // [2,3] → '2-3'; [5,7] → '5,7'
  const s = [...list].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`); i = j;
  }
  return out.join(',');
};
const NICE = { 'la': 'Là', 'kiem 100%': 'Kiểm 100%', 'hut chi': 'Hút chỉ', 'treo hang': 'Treo hàng', 'dong goi': 'Đóng gói', 'do thong so': 'Đo thông số' };
const cleanName = n => { const s = txt(n).replace(/^b[aà]n\s+/i, '').replace(/\s+%/, '%'); return NICE[norm(s)] || s.replace(/^./, c => c.toUpperCase()); };
// Mã công đoạn ghép ('48+84', '35/270'): khớp khi có chung ít nhất 1 mã con
const codeParts = v => codeKey(v).split(/[+\/,&]/).filter(Boolean);
const codeMatch = (a, b) => { const A = codeParts(a), B = codeParts(b); return A.length && B.length && A.some(x => B.includes(x)); };

function buildStyle(P) {               // P = { sam, layout?, fin?, names:{sam,layout,fin}, file }
  const warn = [], S = P.sam, L = P.layout, F = P.fin;
  const style = S.style || (L && L.style) || '';
  const ops = S.ops.map(o => ({ stt: o.no, code: o.code, opCode: o.opCode, name: o.name, grade: o.grade, group: 'May',
    equip: equipName(o.equipType, o.name), mtype: o.equipType, sam: o.samAuto, samAuto: o.samAuto, samMan: o.samMan, w: o.w, ban: '', note: '' }));
  ops.forEach(o => { if (r3(o.samMan) === r3(o.samAuto)) { delete o.samAuto; delete o.samMan; } });

  // Kiểm tra tổng trong sheet SAM
  const sumSam = ops.reduce((a, o) => a + o.sam, 0), sumW = ops.reduce((a, o) => a + o.w, 0);
  S.totals.forEach(t => {
    const blk = S.ops.filter(o => o.block === t.block);
    const bs = blk.reduce((a, o) => a + o.samAuto, 0), bw = blk.reduce((a, o) => a + o.w, 0);
    if (isFinite(t.sam) && Math.abs(t.sam - bs) > 0.0015) warn.push(W(`Dòng tổng SAM trong sheet ghi ${vn(t.sam)}, cộng các dòng được ${vn(bs)}.`, `Total SAM row says ${r3(t.sam)}, the rows add up to ${r3(bs)}.`));
    if (isFinite(t.w) && Math.abs(t.w - bw) > 0.01) warn.push(W(`Dòng tổng số người ghi ${vn(t.w)}, cộng các dòng được ${vn(bw)}.`, `Total operators row says ${r3(t.w)}, the rows add up to ${r3(bw)}.`));
  });
  if (isFinite(S.operators) && Math.abs(S.operators - sumW) > 0.01)
    warn.push(W(`Đầu sheet ghi ${vn(S.operators)} người, cột OPERATOR cộng được ${vn(sumW)} người.`, `Sheet header says ${S.operators} operators, the OPERATOR column adds up to ${r3(sumW)}.`));

  // Số máy theo loại so với bảng Machine requirement
  const byType = {};
  ops.forEach(o => { const k = o.mtype || equipCode(o.equip); if (k && !/^HW$/i.test(k)) byType[k] = (byType[k] || 0) + Math.ceil(o.w - 1e-9); });
  Object.entries(S.machineReq).forEach(([k, n]) => {
    const got = Object.entries(byType).find(([t]) => norm(t) === norm(k));
    if (!got) warn.push(W(`Bảng Machine requirement có ${n} máy ${k} nhưng không có công đoạn nào dùng máy này.`, `Machine requirement lists ${n} × ${k} but no operation uses it.`));
    else if (got[1] !== n) warn.push(W(`Máy ${k}: bảng Machine requirement ghi ${n}, theo số người các công đoạn cần ${got[1]}.`, `${k} machines: requirement table says ${n}, operations need ${got[1]}.`));
  });

  // Layout: gán số bàn theo mã công đoạn (SC§), không khớp mã thì khớp theo tên
  let spare = 0;
  if (L) {
    const used = new Set();
    const seen = {};
    L.tables.forEach(t => { seen[t.ban] = (seen[t.ban] || 0) + 1; });
    Object.entries(seen).filter(([, n]) => n > 1).forEach(([b, n]) => warn.push(W(`Layout: bàn ${b} xuất hiện ${n} lần.`, `Layout: table ${b} appears ${n} times.`)));
    ops.forEach(o => {
      let ts = L.tables.filter(t => t.code && codeKey(t.code) === codeKey(o.code));
      if (!ts.length) ts = L.tables.filter(t => t.code && codeMatch(t.code, o.code));
      if (!ts.length) ts = L.tables.filter(t => !t.code && norm(t.name) === norm(o.name));
      ts.forEach(t => used.add(t));
      if (!ts.length) { warn.push(W(`"${o.name}" (mã ${o.code}) không có trên Layout.`, `"${o.name}" (code ${o.code}) is not on the layout.`)); return; }
      o.ban = banRange([...new Set(ts.map(t => t.ban))]);
      if (ts.length !== Math.ceil(o.w - 1e-9))
        warn.push(W(`"${o.name}": ${vn(o.w)} người nhưng Layout có ${ts.length} bàn (${o.ban}).`, `"${o.name}": ${o.w} operators but the layout has ${ts.length} tables (${o.ban}).`));
      const mt = o.mtype || equipCode(o.equip);
      const eq = ts.filter(t => t.equipType && !/^hw$/i.test(t.equipType) && norm(t.equipType).replace(/\s/g, '') !== norm(mt).replace(/\s/g, ''));
      eq.forEach(t => warn.push(W(`Bàn ${t.ban} "${o.name}": Layout ghi máy ${t.equipType}, sheet SAM ghi ${mt} (đang dùng theo SAM).`, `Table ${t.ban} "${o.name}": layout says ${t.equipType}, SAM sheet says ${mt} (SAM sheet used).`)));
    });
    // Bàn phụ chỉ có trên Layout (treo hàng, kiểm, là, hút chỉ…) → thêm công đoạn, SAM lấy từ FIN hoặc chờ nhập
    const extra = new Map();
    L.tables.filter(t => !used.has(t) && t.code).forEach(t => {
      const k = codeKey(t.code); if (!extra.has(k)) extra.set(k, { code: t.code, name: t.name, equipType: t.equipType, bans: [] });
      extra.get(k).bans.push(t.ban);
    });
    const finStyle = F && F.style && norm(F.style) !== norm(style) ? F.style : '';
    extra.forEach(x => {
      const f = F && F.ops.find(o => codeKey(o.code) === codeKey(x.code));
      const name = cleanName(x.name);
      const o = { stt: 0, code: x.code, opCode: '', name, grade: '', group: groupOf('', name), equip: equipName(/^hw$/i.test(x.equipType) ? '' : x.equipType, name),
        sam: f ? f.sam : null, w: x.bans.length, ban: banRange(x.bans), note: '' };
      if (f) o.note = finStyle ? `SAM FIN tham khảo (${finStyle})` : 'SAM FIN';
      else { o.note = 'SAM ước tính'; o.needSam = true; }
      ops.push(o);
    });
    if (finStyle) warn.push(W(`Sheet SAM FIN là của mã ${finStyle}, khác mã ${style}: SAM bàn phụ chỉ là tham khảo.`, `The SAM FIN sheet is for style ${finStyle}, not ${style}: auxiliary SAMs are reference only.`));
    const others = L.tables.filter(t => !used.has(t) && !t.code);
    if (others.length) warn.push(W(`Layout có bàn không phải công đoạn (bỏ qua): ${others.map(t => `${t.ban} ${t.name}`).join(', ')}.`, `Layout tables that are not operations (ignored): ${others.map(t => `${t.ban} ${t.name}`).join(', ')}.`));
    spare = L.empty.length;
    if (isFinite(L.sewers) && Math.abs(L.sewers - sumW) > 0.01)
      warn.push(W(`Layout ghi Total sewer ${vn(L.sewers)}, sheet SAM có ${vn(sumW)} người may (đang dùng theo SAM).`, `Layout says total sewers ${L.sewers}, SAM sheet has ${r3(sumW)} sewing operators (SAM sheet used).`));
  }
  const missing = ops.filter(o => o.needSam);
  if (missing.length) warn.push(W(`Chưa có SAM: ${missing.map(o => o.name).join(', ')}. Nhập SAM ước tính trước khi dùng.`, `No SAM for: ${missing.map(o => o.name).join(', ')}. Enter an estimated SAM before use.`));

  // Thứ tự: theo cụm, trong cụm theo số bàn
  const firstBan = o => { const m = String(o.ban).match(/\d+/); return m ? +m[0] : 1e6 + (o.stt || 0); };
  ops.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || firstBan(a) - firstBan(b));
  ops.forEach((o, i) => { o.stt = i + 1; });

  const hours = isFinite(S.hours) ? S.hours : 8;
  // CĐ chính (sheet SAM có phần "Công đoạn phụ"): mã ghép "48+84" lấy CĐ đầu; "270/35" (mã ETS / mã cũ) lấy cả hai
  const mainOps = S.hasSub ? [...new Set(S.ops.filter(o => !o.sub && o.code).flatMap(o => (/\+/.test(o.code) ? codeParts(o.code).slice(0, 1) : codeParts(o.code))))] : null;
  return {
    style, file: P.file || '', sheets: P.names || {}, totalSam: S.totalSam, mainOps,
    set: { style, target: Math.round(isFinite(S.target) && S.target > 0 ? S.target : hours * 60 * sumW / sumSam), shift: hours * 60, spare },
    ops, warnings: warn,
  };
}

// ---------- Phân tích cân bằng (dùng chung cho trang và kiểm thử) ----------
function analyze(ops, set) {
  const takt = set.shift / set.target;
  const rows = ops.map(o => { const w = Math.max(o.w, 0.01); const ct = o.sam / w; return { ct, cap: 60 / ct, load: ct / takt }; });
  let bn = 0; rows.forEach((r, i) => { if (r.ct > rows[bn].ct) bn = i; });
  rows.forEach((r, i) => { r.status = r.load > 1.0005 || i === bn ? 'bn' : r.load >= .9 ? 'near' : r.load * 100 < set.surplus ? 'sur' : 'ok'; });
  const sum = (f, flt = () => true) => ops.reduce((a, o, i) => a + (flt(o, i) ? f(o, i) : 0), 0);
  const isSew = o => o.group === 'May';
  const sumSAM = sum(o => o.sam), N = sum(o => o.w);
  const sumSew = sum(o => o.sam, isSew), Nsew = sum(o => o.w, isSew);
  let maxSew = 0; ops.forEach((o, i) => { if (isSew(o)) maxSew = Math.max(maxSew, rows[i].ct); });
  const maxCT = rows[bn].ct;
  return {
    takt, rows, bn, maxCT, lineCap: 60 / maxCT, shiftOut: set.shift / maxCT,
    sumSAM, N, eff: sumSAM / (N * maxCT), sumSew, Nsew, effSew: maxSew ? sumSew / (Nsew * maxSew) : 0,
    needSew: sumSew / takt, needAll: sumSAM / takt, costPc: sumSAM * set.cost,
    machSew: ops.reduce((a, o) => a + (isSew(o) ? Math.ceil(o.w - 1e-9) : 0), 0),
  };
}

// ---------- ETS: phiếu sản lượng (Query Ticket) ----------
// Giờ trong ô → giây tính từ 0h ('2026-10-05 8:05:01 PM', '07:30', số ngày Excel)
const clockSec = v => {
  if (typeof v === 'number') return Math.round((v % 1) * 86400);
  const m = String(v == null ? '' : v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return NaN;
  let h = +m[1]; const ap = (m[4] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return h * 3600 + +m[2] * 60 + (+m[3] || 0);
};
const hhmm = s => `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;

// MO Bulletin (ETS): dòng tiêu đề có "Op.No." + "C&M"; style / MO ở phần đầu ("Style :", "MO:").
// → { style, mo, ops: [{ op, name, cm (true = C&M "Y"), sam, mtype }], main: [mã CĐ C&M = Y] } hoặc null
function parseBulletin(rows) {
  const h = rows.findIndex(r => r && r.some(c => /^op\.? ?no/.test(norm(c))) && r.some(c => /^c ?& ?m$/.test(norm(c))));
  if (h < 0) return null;
  const R = rows[h].map(norm), col = re => R.findIndex(c => re.test(c));
  const C = { op: col(/^op\.? ?no/), name: col(/^op\.? ?name/), cm: col(/^c ?& ?m$/), sam: col(/^sam$/), mt: col(/^machine type/) };
  const head = (re) => { for (let r = 0; r < h; r++) { const row = rows[r] || [], i = row.findIndex(c => re.test(norm(c))); if (i >= 0) { const v = row.slice(i + 1).find(c => txt(c)); if (v != null) return txt(v); } } return ''; };
  const ops = [];
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [], op = txt(row[C.op]);
    if (!op || !/^\d/.test(op)) { if (ops.length && !op) break; continue; }
    ops.push({ op, name: txt(row[C.name]), cm: /^y/i.test(txt(row[C.cm])), sam: num(row[C.sam]) || 0, mtype: C.mt >= 0 ? txt(row[C.mt]) : '' });
  }
  if (!ops.length) return null;
  return { style: head(/^style ?:?$/), mo: head(/^mo ?:?$/), ops, main: ops.filter(o => o.cm).map(o => o.op) };
}

// Danh sách nhân sự (SCP, file "HC mới" sheet Sheet1, 10/10): Emp No (D), sex (F), Join Date (I), Resign Date (K), Skill Grade (L).
// Tìm cột theo tiêu đề, không thấy thì theo vị trí cột. Ngày lưu = số ngày kiểu Excel (gọn).
// → { n, map: { mã NV: [giới tính 'F'/'M', ngày vào, bậc kỹ năng, ngày nghỉ] } } hoặc null
const xlSerial = v => {
  if (typeof v === 'number' && isFinite(v)) return Math.floor(v);
  if (v instanceof Date && !isNaN(v)) return Math.floor(v.getTime() / 864e5 + 25569);
  const m = String(v == null ? '' : v).trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);   // dd/mm/yyyy
  return m ? Math.floor(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 864e5 + 25569) : NaN;
};
function parseHc(rows) {
  let h = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cs = (rows[r] || []).map(norm);
    if (cs.some(c => /^emp\.? ?no/.test(c)) && cs.some(c => /^skill/.test(c))) { h = r; break; }
  }
  if (h < 0) return null;
  const hd = rows[h].map(norm), col = (re, d) => { const i = hd.findIndex(c => re.test(c)); return i >= 0 ? i : d; };
  const C = { emp: col(/^emp\.? ?no/, 3), sex: col(/^(sex|gender|gioi tinh)/, 5), join: col(/^join/, 8), resign: col(/^resign/, 10), skill: col(/^skill/, 11) };
  const map = {}; let n = 0;
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [], e = txt(row[C.emp]);
    if (!e) continue;
    const nz = v => (isFinite(v) ? v : null);                   // không có ngày → null (lưu JSON được)
    map[e] = [txt(row[C.sex]).toUpperCase().slice(0, 1), nz(xlSerial(row[C.join])), txt(row[C.skill]), nz(xlSerial(row[C.resign]))];
    n++;
  }
  return n ? { n, map } : null;
}
// Ngày Excel → Date (giờ địa phương 0:00); CN mới = vào chưa đủ `months` tháng tính tới `today`
// File %EFF cá nhân (CSV, thư mục %EFF 2U01): cột Period (Monthly | Daily), Date (dd/mm/yyyy), Empcode, Hours, Eff_pct (%).
// → { n, map: { mã NV: { m: { 'yyyy-mm': tỉ lệ|null }, d: { 'yyyy-mm-dd': tỉ lệ|null } } } }; tỉ lệ = Eff_pct / 100, null = không làm (Hours = 0 / trống)
function csvLine(l) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}
function parseEffCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const H = csvLine(lines[0]).map(h => h.trim().toLowerCase()), ix = k => H.indexOf(k);
  const iP = ix('period'), iD = ix('date'), iE = ix('empcode'), iH = ix('hours'), iF = ix('eff_pct');
  if (iP < 0 || iD < 0 || iE < 0 || iF < 0) return null;
  const map = {}; let rows = 0, last = '';
  for (let k = 1; k < lines.length; k++) {
    const c = csvLine(lines[k]), mt = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((c[iD] || '').trim()), emp = (c[iE] || '').trim();
    if (!mt || !emp) continue;
    const per = (c[iP] || '').trim().toLowerCase(), ym = mt[3] + '-' + mt[2].padStart(2, '0'), ymd = ym + '-' + mt[1].padStart(2, '0');
    const hrs = iH >= 0 ? +c[iH] : 1, f = c[iF] === '' || c[iF] == null ? NaN : +c[iF], v = isFinite(f) && hrs > 0 ? f / 100 : null;
    const o = map[emp] || (map[emp] = { m: {}, d: {} });
    if (per === 'monthly') o.m[ym] = v; else if (per === 'daily') { o.d[ymd] = v; if (ymd > last) last = ymd; } else continue;
    rows++;
  }
  return rows ? { n: Object.keys(map).length, rows, lastDay: last, map } : null;
}
const xlDate = s => (s != null && isFinite(s) ? (d => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))(new Date((s - 25569) * 864e5)) : null);
function isNewHire(joinSerial, today, months) {
  const j = xlDate(joinSerial); if (!j) return false;
  const lim = new Date(j.getFullYear(), j.getMonth() + (months == null ? 2 : months), j.getDate());
  return today < lim;
}

function parseEts(rows) {
  let h = -1;
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const cs = (rows[r] || []).map(norm);
    if (cs.some(c => /^emp\.? ?no/.test(c)) && cs.some(c => /^op\.? ?no/.test(c)) && cs.some(c => /^output/.test(c))) { h = r; break; }
  }
  if (h < 0) return null;
  const hd = rows[h].map(norm), col = re => hd.findIndex(c => re.test(c));
  const C = { emp: col(/^emp\.? ?no/), name: col(/^name/), date: col(/^date/), style: col(/^style/), op: col(/^op\.? ?no/), out: col(/^output/),
    add: col(/^add date/), group: col(/^prod\.? ?group/), term: col(/^terminal/), sam: col(/^sam$/), start: col(/^start|start ?time/), end: col(/^end|end ?time/),
    creator: col(/^creator/), bdl: col(/^bdl/), color: col(/^colou?r$/), colorNo: col(/^colou?r ?no/), mo: col(/^mo$/),
    tc: col(/^time consumption/), std: col(/^on-? ?std/) };   // thời gian phiếu (phút, Smart loop tính) + cờ On-Std (OAS)
  const tickets = []; let zero = 0;
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || [], emp = txt(row[C.emp]);
    if (!emp) continue;
    const qty = num(row[C.out]);
    if (!(qty > 0)) { zero++; continue; }
    tickets.push({ emp, name: txt(row[C.name]), op: txt(row[C.op]), qty, sam: num(row[C.sam]) || 0, add: clockSec(row[C.add]), term: txt(row[C.term]),
      start: C.start >= 0 ? clockSec(row[C.start]) : NaN, end: C.end >= 0 ? clockSec(row[C.end]) : NaN,
      style: txt(row[C.style]), group: txt(row[C.group]), date: txt(row[C.date]), creator: C.creator >= 0 ? txt(row[C.creator]) : '', bdl: C.bdl >= 0 ? txt(row[C.bdl]) : '',
      color: C.color >= 0 ? txt(row[C.color]) : '', colorNo: C.colorNo >= 0 ? txt(row[C.colorNo]) : '', mo: C.mo >= 0 ? txt(row[C.mo]) : '',
      tc: C.tc >= 0 ? num(row[C.tc]) : NaN, onStd: C.std >= 0 ? !/^(false|0|n|no)$/i.test(txt(row[C.std])) : true });
  }
  // Giờ xuất báo cáo ở đầu file: "Time: 07/10/2026 4:02:40 PM"
  let exportAt = NaN;
  for (let r = 0; r < h; r++) (rows[r] || []).forEach(v => { const m = txt(v).match(/^time\s*[:：]\s*(.+)$/i); if (m && !isFinite(exportAt)) exportAt = clockSec(m[1]); });
  const f = rows[h + 1] || [];
  return { date: txt(f[C.date]), style: txt(f[C.style]), group: txt(f[C.group]), tickets, zero, exportAt,
    hasStartEnd: tickets.some(t => isFinite(t.start) && isFinite(t.end) && t.end > t.start), hasTc: tickets.some(t => t.tc > 0) };
}

// Bảng MỤC TIÊU SAH (file SAH_TARGET_2U01.xlsx, 13/10/2026): ngày hiệu lực | ngành | xưởng | chuyền | mục tiêu SAH | tổng giờ làm | giờ bắt đầu | giờ ăn chính từ-đến | giờ ăn phụ từ-đến.
// Trả { 'YYYY-MM-DD': { '201S01': { xuong, target, hours (phút), start 'hh:mm', end 'hh:mm' (= bắt đầu + giờ làm + giờ ăn), breaks 'hh:mm-hh:mm, …' } } }; không thấy bảng → null.
// Kế hoạch này là nguồn của OAS: Accumulate target = target × giờ đã làm ÷ tổng giờ làm.
function parseSahTarget(rows) {
  let h = -1;
  for (let r = 0; r < Math.min(rows.length, 30); r++) { const cs = (rows[r] || []).map(norm); if (cs.some(c => /muc tieu/.test(c)) && cs.some(c => /^chuyen/.test(c))) { h = r; break; } }
  if (h < 0) return null;
  const hd = (rows[h] || []).map(norm), col = re => hd.findIndex(c => re.test(c));
  const C = { date: col(/ngay/), xuong: col(/^xuong/), line: col(/^chuyen/), target: col(/muc tieu/), hours: col(/tong so gio/), start: col(/gio bat dau/), b1: col(/gio an chinh/), b2: col(/gio an phu/) };
  const tm = v => { if (typeof v === 'number' && v > 0 && v < 1) return Math.round(v * 1440); const m = String(v == null ? '' : v).match(/(\d+)\s*[hH:]\s*(\d*)/); return m ? +m[1] * 60 + (+m[2] || 0) : NaN; };
  const hh = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const iso = v => { const d = typeof v === 'number' ? xlDate(v) : (m => (m ? new Date(+m[3], +m[2] - 1, +m[1]) : null))(String(v).match(/(\d+)\/(\d+)\/(\d{4})/)); return d && !isNaN(d) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : ''; };
  const out = {}; let n = 0;
  for (let r = h + 1; r < rows.length; r++) {
    const x = rows[r] || [], line = txt(x[C.line]), target = num(x[C.target]), d = iso(x[C.date]);
    if (!/^\d{3}S\d+/i.test(line) || !(target > 0) || !d) continue;
    const s = tm(x[C.start]), w = tm(x[C.hours]); if (!isFinite(s) || !isFinite(w)) continue;
    const br = [C.b1, C.b2].map(c => (c >= 0 ? [tm(x[c]), tm(x[c + 1])] : null)).filter(b => b && isFinite(b[0]) && isFinite(b[1]) && b[1] > b[0]);
    const end = s + w + br.reduce((a, b) => a + (b[1] - b[0]), 0);
    (out[d] = out[d] || {})[line.toUpperCase()] = { xuong: txt(x[C.xuong]), target, hours: w, start: hh(s), end: hh(end), breaks: br.map(b => hh(b[0]) + '-' + hh(b[1])).join(', ') };
    n++;
  }
  return n ? out : null;
}

// Giờ làm việc: cfg = { start:'07:30', end:'20:30', breaks:'12:00-13:00, 16:30-17:00' }
function workClock(cfg) {
  const s = clockSec(cfg.start), e = clockSec(cfg.end);
  const br = String(cfg.breaks || '').split(/[,;]/).map(x => x.split(/[-–]/).map(clockSec)).filter(([a, b]) => b > a && a >= s && b <= e).sort((x, y) => x[0] - y[0]);
  const work = t => { const c = Math.min(Math.max(t, s), e); let w = c - s; br.forEach(([a, b]) => { w -= Math.max(0, Math.min(c, b) - a); }); return w; };
  const unwork = w => { let t = s + w; br.forEach(([a, b]) => { if (t > a) t += b - a; }); return Math.min(t, e); };
  const inBreak = t => br.some(([a, b]) => t >= a && t < b);
  return { s, e, br, work, unwork, inBreak, total: work(e) };
}

// Tổng hợp mã công đoạn ETS và ghép với công đoạn của mã hàng (theo mã SC§)
function etsCodes(E, ops) {
  const codes = {};
  E.tickets.forEach(t => {
    const c = codes[t.op] || (codes[t.op] = { op: t.op, qty: 0, sam: 0, emps: new Set(), idx: -1 });
    c.qty += t.qty; c.emps.add(t.emp); if (t.sam > 0) c.sam = t.sam;
  });
  Object.values(codes).forEach(c => {
    c.idx = ops.findIndex(o => codeKey(o.code) === codeKey(c.op));
    if (c.idx < 0) c.idx = ops.findIndex(o => o.code && codeMatch(o.code, c.op));
    c.nEmp = c.emps.size; delete c.emps;
  });
  return Object.values(codes).sort((a, b) => (+a.op || 0) - (+b.op || 0));
}

// Dựng lịch phát lại. Không có giờ bắt đầu / kết thúc từng phiếu → mỗi lần đồng bộ của máy quét (~30 phút)
// coi là 1 khối; số áo của mỗi người trong khối được chia đều trên giờ làm việc của khối (trừ giờ nghỉ).
function buildReplay(E, ops, cfg) {
  const W = workClock(cfg), codes = etsCodes(E, ops);
  const idxOf = {}; codes.forEach(c => { idxOf[c.op] = c.idx; });
  // Công đoạn ghép nhiều mã ETS (VD 53+84): luồng hàng tính theo mã có sản lượng lớn nhất
  const flowCode = {};
  codes.filter(c => c.idx >= 0).forEach(c => { const f = flowCode[c.idx]; if (!f || c.qty > f.qty) flowCode[c.idx] = c; });
  const T = E.tickets.filter(t => idxOf[t.op] >= 0);

  // Công nhân: công đoạn chính = công đoạn có nhiều phút chuẩn nhất (SAM = 0 thì theo số lượng)
  const wk = new Map();
  T.forEach(t => {
    const i = idxOf[t.op], sam = t.sam > 0 ? t.sam : 0;
    const w = wk.get(t.emp) || (wk.set(t.emp, { emp: t.emp, name: t.name, qty: 0, earned: 0, byOp: {} }), wk.get(t.emp));
    w.qty += t.qty; w.earned += t.qty * sam;
    const b = w.byOp[i] || (w.byOp[i] = { qty: 0, earned: 0 }); b.qty += t.qty; b.earned += t.qty * sam;
  });
  const workers = [...wk.values()];
  workers.forEach(w => {
    w.primary = +Object.entries(w.byOp).sort((a, b) => b[1].earned - a[1].earned || b[1].qty - a[1].qty)[0][0];
    const p = w.name.split(/\s+/); w.short = p.length > 1 ? `${p[0]} ${p.slice(1).map(x => x[0]).join('')}` : w.name;
  });

  // Công đoạn phát lại: số người = số công nhân có công đoạn chính ở đây
  const rops = ops.map((o, i) => {
    const own = workers.filter(w => w.primary === i).sort((a, b) => b.qty - a.qty);
    const has = T.some(t => idxOf[t.op] === i);
    return Object.assign({}, o, { wPlan: o.w, w: own.length || (has ? 1 : o.w), etsWorkers: own.map(w => w.emp), hasEts: has });
  });
  const ei = new Map(workers.map((w, k) => [w.emp, k]));
  workers.forEach(w => { w.k = rops[w.primary].etsWorkers.indexOf(w.emp); });

  // Khối đồng bộ: theo từng máy quét, từ lần đồng bộ trước (tối đa 30 phút) đến lần này
  const syncs = {};
  T.forEach(t => { (syncs[t.term] = syncs[t.term] || new Set()).add(t.add); });
  Object.keys(syncs).forEach(k => { syncs[k] = [...syncs[k]].sort((a, b) => a - b); });
  const winOf = t => {
    if (E.hasStartEnd && isFinite(t.start) && t.end > t.start) return [W.work(t.start), W.work(t.end)];
    const L = syncs[t.term], j = L.indexOf(t.add);
    const prev = j > 0 ? L[j - 1] : W.s;
    const b = W.work(t.add); let a = W.work(Math.max(prev, t.add - 1800, W.s));
    if (b - a < 60) a = Math.max(0, b - 1800);
    return [a, b];
  };
  const groups = new Map();       // người + khối → danh sách phiếu
  T.forEach(t => {
    const [a, b] = winOf(t), key = `${t.emp}|${a}|${b}`;
    const g = groups.get(key) || (groups.set(key, { e: ei.get(t.emp), a, b, list: [] }), groups.get(key));
    g.list.push(t);
  });
  const events = [], busy = workers.map(() => []);
  groups.forEach(g => {
    const n = g.list.reduce((s, t) => s + t.qty, 0), slot = (g.b - g.a) / n;
    let j = 0;
    g.list.forEach(t => {
      const i = idxOf[t.op], flow = flowCode[i] && flowCode[i].op === t.op;
      for (let q = 0; q < t.qty; q++, j++) events.push({ t: W.unwork(g.a + slot * (j + 1)) - W.s, i, e: g.e, flow, sam: t.sam > 0 ? t.sam : 0 });
    });
    busy[g.e].push([g.a, g.b]);
  });
  events.sort((x, y) => x.t - y.t);
  busy.forEach(L => L.sort((x, y) => x[0] - y[0]));

  // Công đoạn trước có dữ liệu (để tính hàng chờ) và công đoạn cuối có dữ liệu (thành phẩm)
  const prevIdx = rops.map((o, i) => { for (let k = i - 1; k >= 0; k--) if (rops[k].hasEts) return k; return -1; });
  let lastIdx = -1, lastSew = -1;
  rops.forEach((o, i) => { if (o.hasEts) { lastIdx = i; if (o.group === 'May') lastSew = i; } });

  // Sản lượng theo giờ (theo giờ đồng hồ, tính từ đầu ca)
  const hours = Math.ceil((W.e - W.s) / 3600), hourly = rops.map(() => new Array(hours).fill(0));
  events.forEach(ev => { if (ev.flow) hourly[ev.i][Math.min(hours - 1, Math.floor(ev.t / 3600))]++; });
  const opQty = rops.map((o, i) => hourly[i].reduce((a, b) => a + b, 0));
  const earned = workers.reduce((a, w) => a + w.earned, 0);
  workers.forEach(w => { w.eff = W.total > 0 ? w.earned / (W.total / 60) : 0; });

  return {
    date: E.date, style: E.style, group: E.group, exact: E.hasStartEnd, codes, ops: rops, workers, events, busy, prevIdx, lastIdx, lastSew,
    hourly, opQty, earned, eff: earned / (workers.length * W.total / 60), workMin: W.total / 60,
    start: W.s, end: W.e, dur: W.e - W.s, work: t => W.work(W.s + t), inBreak: t => W.inBreak(W.s + t),
  };
}

// ---------- Công thức chỉ số (người dùng sửa được, chung mọi chuyền) ----------
// Bộ đọc biểu thức tự viết (không dùng eval / Function): số, biến, + - * / ^, so sánh (< <= > >= == !=), and / or / not,
// ngoặc, hàm min, max, round(x[, số lẻ]), floor, ceil, abs, sqrt, if(điều kiện, khi đúng, khi sai). Số thập phân dùng dấu chấm.
const FN = {
  min: Math.min, max: Math.max, abs: Math.abs, sqrt: Math.sqrt, floor: Math.floor, ceil: Math.ceil,
  round: (x, d) => { const k = Math.pow(10, d || 0); return Math.round(x * k) / k; },
};
function compileExpr(src, allowed) {
  const s = String(src == null ? '' : src), toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (m) { toks.push({ t: 'n', v: +m[1] }); i += m[1].length; continue; }
    m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (m) { toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    m = /^(<=|>=|==|!=|&&|\|\||[-+*/^(),<>!])/.exec(s.slice(i));
    if (m) { toks.push({ t: 'op', v: m[1] }); i += m[1].length; continue; }
    throw new Error(`Ký tự không hợp lệ "${c}" | Invalid character "${c}"`);
  }
  let p = 0;
  const peek = v => toks[p] && toks[p].t !== 'n' && toks[p].v === v;
  const eat = v => { if (!peek(v)) throw new Error(`Thiếu "${v}" | Missing "${v}"`); p++; };
  const used = new Set();
  const bin = (next, ops, f) => () => {
    let a = next();
    while (toks[p] && toks[p].t !== 'n' && ops.includes(toks[p].v)) { const o = toks[p++].v, l = a, r = next(); a = f(o, l, r); }
    return a;
  };
  const prim = () => {
    const k = toks[p++];
    if (!k) throw new Error('Công thức chưa hết | Unexpected end');
    if (k.t === 'n') return () => k.v;
    if (k.t === 'op' && k.v === '(') { const e = expr(); eat(')'); return e; }
    if (k.t === 'op' && k.v === '-') { const e = pow(); return v => -e(v); }
    if (k.t === 'op' && (k.v === '!')) { const e = pow(); return v => (e(v) ? 0 : 1); }
    if (k.t === 'id') {
      const name = k.v.toLowerCase();
      if (name === 'not') { const e = pow(); return v => (e(v) ? 0 : 1); }
      if (peek('(')) {
        p++;
        const args = [];
        if (!peek(')')) { args.push(expr()); while (peek(',')) { p++; args.push(expr()); } }
        eat(')');
        if (name === 'if') {
          if (args.length !== 3) throw new Error('if cần 3 phần: if(điều kiện, đúng, sai) | if needs 3 arguments');
          const [c, a, b] = args; return v => (c(v) ? a(v) : b(v));
        }
        const f = Object.prototype.hasOwnProperty.call(FN, name) ? FN[name] : null;
        if (!f) throw new Error(`Không có hàm "${k.v}" | Unknown function "${k.v}"`);
        return v => f(...args.map(a => a(v)));
      }
      if (allowed && !allowed.includes(k.v)) throw new Error(`Không có biến "${k.v}" | Unknown variable "${k.v}"`);
      used.add(k.v);
      return v => v[k.v];
    }
    throw new Error(`Không hiểu "${k.v}" | Unexpected "${k.v}"`);
  };
  const pow = () => { const a = prim(); if (peek('^')) { p++; const b = pow(); return v => Math.pow(a(v), b(v)); } return a; };
  const mul = bin(pow, ['*', '/'], (o, l, r) => (o === '*' ? v => l(v) * r(v) : v => l(v) / r(v)));
  const add = bin(mul, ['+', '-'], (o, l, r) => (o === '+' ? v => l(v) + r(v) : v => l(v) - r(v)));
  const cmp = bin(add, ['<', '<=', '>', '>=', '==', '!='], (o, l, r) => ({
    '<': v => +(l(v) < r(v)), '<=': v => +(l(v) <= r(v)), '>': v => +(l(v) > r(v)), '>=': v => +(l(v) >= r(v)),
    '==': v => +(l(v) === r(v)), '!=': v => +(l(v) !== r(v)) }[o]));
  const and = () => { let a = cmp(); while (peek('and') || peek('&&')) { p++; const l = a, r = cmp(); a = v => +(!!l(v) && !!r(v)); } return a; };
  const expr = () => { let a = and(); while (peek('or') || peek('||')) { p++; const l = a, r = and(); a = v => +(!!l(v) || !!r(v)); } return a; };
  if (!toks.length) throw new Error('Công thức trống | Empty formula');
  const fn = expr();
  if (p < toks.length) throw new Error(`Thừa "${toks[p].v}" | Unexpected "${toks[p].v}"`);
  return { fn, vars: [...used] };
}

// Danh mục công thức: key, cấp (công nhân / công đoạn / chuyền), tên, mặc định, biến dùng được, giá trị khi lỗi (chia 0…)
const FV = (vi, en) => ({ vi, en });
const FV_SHORT = {"onStdHours":{"vi":"giờ On Std","en":"On Std h"},"nonCmHours":{"vi":"giờ Non C&M","en":"Non C&M h"},"sah":{"vi":"SAH","en":"SAH"},"totalHours":{"vi":"giờ làm cả ngày","en":"day hours"},"outSAH":{"vi":"SAH ra chuyền","en":"SAH out"},"planSAH":{"vi":"KH SAH cả ngày","en":"day plan SAH"},"planNowSAH":{"vi":"KH SAH tới giờ","en":"plan SAH to now"},"earned":{"vi":"phút chuẩn làm được","en":"earned minutes"},"qty":{"vi":"sản lượng","en":"output"},"primaryQty":{"vi":"SL công đoạn chính","en":"main-op output"},"workMin":{"vi":"phút đã làm","en":"minutes worked"},"workHours":{"vi":"giờ đã làm","en":"hours worked"},"runMin":{"vi":"phút CĐ đã chạy","en":"op minutes run"},"runHours":{"vi":"giờ CĐ đã chạy","en":"op hours run"},"q60":{"vi":"SL 60′ gần nhất","en":"output last 60′"},"winHours":{"vi":"thời gian 60′ gần nhất (giờ)","en":"last-60′ time (h)"},"fte":{"vi":"người quy đổi","en":"FTE"},"people":{"vi":"số người","en":"people"},"sam":{"vi":"SAM","en":"SAM"},"rate":{"vi":"sp/giờ TB","en":"avg pcs/h"},"rate60":{"vi":"sp/giờ 60′","en":"pcs/h 60′"},"cap":{"vi":"năng lực chuẩn","en":"std capacity"},"totalMin":{"vi":"phút làm cả ngày","en":"day minutes"},"effTarget":{"vi":"hiệu suất mục tiêu","en":"target eff."},"factor":{"vi":"hệ số đường cong học","en":"learning factor"},"planEM":{"vi":"KH phút chuẩn cả ngày","en":"day plan EM"},"planNow":{"vi":"KH phút chuẩn tới giờ","en":"plan EM to now"},"outEM":{"vi":"phút chuẩn ra chuyền","en":"EM out"},"share":{"vi":"tỉ trọng mã hàng","en":"style share"},"sumSam":{"vi":"ΣSAM mã hàng","en":"style ΣSAM"},"peoplePlan":{"vi":"người kế hoạch","en":"planned people"},"ct":{"vi":"CT","en":"CT"},"wl":{"vi":"phút chuẩn/người","en":"std min/person"},"sumCT":{"vi":"tổng CT","en":"Σ CT"},"maxCT":{"vi":"CT lớn nhất","en":"max CT"},"sumWL":{"vi":"tổng phút chuẩn/người","en":"Σ std min/person"},"maxWL":{"vi":"phút chuẩn/người lớn nhất","en":"max std min/person"},"nOps":{"vi":"số công đoạn","en":"no. of operations"}};   // tên ngắn để diễn giải công thức thành chữ
const FORMULA_VARS = {
  sah: FV('SAH = giờ chuẩn làm được = Σ (SAM × SL) ÷ 60', 'SAH = standard allowed hours earned = Σ (SAM × qty) ÷ 60'),
  totalHours: FV('giờ làm cả ngày (trừ nghỉ)', 'working hours in the day (net of breaks)'),
  outSAH: FV('SAH ra chuyền = Σ (SL ra × ΣSAM mã) ÷ 60', 'SAH out of the line = Σ (output × style ΣSAM) ÷ 60'),
  planSAH: FV('kế hoạch SAH cả ngày', 'planned SAH for the day'), planNowSAH: FV('kế hoạch SAH tới giờ dữ liệu', 'planned SAH to data time'),
  earned: FV('phút chuẩn làm được (Σ SL × SAM) = SAH × 60', 'earned minutes (Σ qty × SAM) = SAH × 60'), qty: FV('sản lượng', 'output'),
  primaryQty: FV('SL công đoạn chính', 'output at main operation'), workMin: FV('phút đã làm (trừ nghỉ, tới giờ dữ liệu)', 'minutes worked (net of breaks, to data time)'),
  workHours: FV('giờ đã làm', 'hours worked'), runMin: FV('phút công đoạn đã chạy (từ Data ETS đầu tiên)', 'minutes the operation has run (since first ETS data)'),
  runHours: FV('giờ công đoạn đã chạy', 'hours the operation has run'), q60: FV('sản lượng cả công đoạn trong 60 phút làm việc gần nhất', 'whole-operation output in the latest 60 working minutes'),
  winHours: FV('số giờ dùng để tính 60′ gần nhất: bình thường = 1 (60 phút làm việc gần nhất trước giờ dữ liệu, không tính giờ nghỉ); công đoạn mới chạy chưa đủ 60 phút thì = số giờ đã chạy (VD 30 phút = 0,5). 60 phút lấy theo cài đặt "Khởi động chuyền".', 'hours used for the last-60′ rate: normally 1 (the latest 60 working minutes before data time, breaks excluded); if the operation has run less than 60 min, the hours it has run (e.g. 30 min = 0.5). The 60 min follows the "Line warm-up" setting.'),
  fte: FV('người quy đổi (theo tỉ lệ thời gian)', 'FTE (by time share)'), people: FV('số người', 'people'), sam: FV('SAM (phút)', 'SAM (min)'),
  rate: FV('sp/giờ TB', 'avg pcs/h'), rate60: FV('sp/giờ cửa sổ gần nhất', 'pcs/h latest window'), cap: FV('năng lực chuẩn', 'standard capacity'),
  totalMin: FV('phút làm cả ngày', 'working minutes in the day'), effTarget: FV('hiệu suất mục tiêu (0,8 = 80%)', 'target efficiency (0.8 = 80%)'),
  factor: FV('hệ số đường cong học', 'learning-curve factor'), planEM: FV('kế hoạch phút chuẩn cả ngày', 'planned earned minutes for the day'),
  planNow: FV('kế hoạch phút chuẩn tới giờ dữ liệu', 'planned earned minutes to data time'), outEM: FV('phút chuẩn ra chuyền (Σ SL ra × ΣSAM)', 'earned minutes out (Σ output × ΣSAM)'),
  share: FV('tỉ trọng mã hàng (theo phút chuẩn ra chuyền)', 'style share (by earned minutes out)'), sumSam: FV('ΣSAM mã hàng', 'style ΣSAM'),
  peoplePlan: FV('người kế hoạch (cài đặt)', 'planned people (setting)'),
  onStdHours: FV('On Std (giờ) = Σ "Time Consumption" phiếu công đoạn chính (C&M = Y), On-Std', 'On Std (h) = Σ "Time Consumption" of main-op (C&M = Y) tickets, On-Std'),
  nonCmHours: FV('Non C&M (giờ) = Σ "Time Consumption" phiếu công đoạn phụ do công nhân may (có phiếu công đoạn chính) dập, On-Std', 'Non C&M (h) = Σ "Time Consumption" of secondary-op tickets clocked by sewing operators (who have main-op tickets), On-Std'),
  ct: FV('CT công đoạn (phút/sp) = 60 ÷ sp/giờ', 'operation CT (min/pc) = 60 ÷ pcs/h'),
  wl: FV('thời gian chuẩn mỗi người gánh (phút/sp) = SAM ÷ người quy đổi', 'standard time per person (min/pc) = SAM ÷ FTE'),
  sumCT: FV('tổng CT các công đoạn chuyền', 'sum of operation CTs'), maxCT: FV('CT lớn nhất (công đoạn bottleneck)', 'largest CT (bottleneck operation)'),
  sumWL: FV('tổng thời gian chuẩn mỗi người các công đoạn', 'sum of standard time per person'), maxWL: FV('thời gian chuẩn mỗi người lớn nhất', 'largest standard time per person'),
  nOps: FV('số công đoạn tính (chuyền, có SAM, đã chạy ≥ khởi động)', 'operations counted (line, with SAM, running ≥ warm-up)'),
};
const FORMULAS = [
  { key: 'w_eff', note: {"vi":"SAH công nhân làm ra (Σ SAM × sản lượng ÷ 60, mọi công đoạn) chia cho số giờ đã làm từ đầu ca tới giờ dữ liệu (đã trừ giờ nghỉ). VD vào 7h30, tới 9h30 = 2 giờ; làm 200 sp SAM 0,45 → SAH 1,5 → %EFF = 1,5 ÷ 2 = 75%. 100% = làm đúng SAM.","en":"Operator SAH (Σ SAM × output ÷ 60 over all operations) divided by hours worked since shift start (net of breaks). E.g. start 7:30, at 9:30 = 2 h; 200 pcs at SAM 0.45 → 1.5 SAH → %EFF = 1.5 ÷ 2 = 75%. 100% = exactly at SAM."}, lv: 'w', vi: '%EFF công nhân', en: 'Operator %EFF', def: 'sah / workHours', vars: ['sah', 'workHours', 'earned', 'qty', 'primaryQty', 'workMin'], bad: 0, pct: true },
  { key: 'w_rate', note: {"vi":"Sản lượng của công nhân ở công đoạn chính (công đoạn họ làm nhiều phút chuẩn nhất) chia cho số giờ đã làm.","en":"Operator's output at their main operation (the one with most earned minutes) divided by hours worked."}, lv: 'w', vi: 'sp/giờ công nhân', en: 'Operator pcs/h', def: 'primaryQty / workHours', vars: ['earned', 'qty', 'primaryQty', 'workMin', 'workHours'], bad: 0 },
  { key: 'op_rate', note: {"vi":"Tổng sản lượng mọi người làm công đoạn này chia cho số giờ từ Data ETS đầu tiên của công đoạn tới giờ dữ liệu.","en":"Total output of everyone on this operation divided by hours from its first ETS data to data time."}, lv: 'op', vi: 'sp/giờ TB công đoạn', en: 'Operation avg pcs/h', def: 'qty / runHours', vars: ['qty', 'runMin', 'runHours', 'fte', 'people', 'sam'], bad: 0 },
  { key: 'op_rate60', note: {"vi":"Sản lượng cả công đoạn trong 60 phút làm việc gần nhất (mới chạy chưa đủ 60′ thì lấy từ lúc bắt đầu), quy ra sp/giờ. Cho thấy tốc độ hiện tại.","en":"Output of the whole operation in the latest 60 working minutes (or since start if shorter), as pcs/h. Shows the current pace."}, lv: 'op', vi: 'sp/giờ 60′ gần nhất', en: 'Operation pcs/h last 60′', def: 'q60 / winHours', vars: ['q60', 'winHours', 'qty', 'runHours', 'fte', 'people', 'sam'], bad: 0 },
  { key: 'op_cap', note: {"vi":"Số sp/giờ công đoạn làm được nếu mọi người chạy đúng 100% SAM: người quy đổi × 60 phút ÷ SAM. Người quy đổi = tính theo tỉ lệ thời gian (người làm 2 công đoạn được chia ra).","en":"Pcs/h the operation would make at exactly 100% SAM: FTE × 60 ÷ SAM. FTE splits people who work on several operations by time share."}, lv: 'op', vi: 'Năng lực chuẩn công đoạn (sp/giờ)', en: 'Operation std capacity (pcs/h)', def: 'fte * 60 / sam', vars: ['fte', 'people', 'sam', 'qty', 'runHours'], bad: NaN, pos: true },
  { key: 'op_load', note: {"vi":"%EFF của cả công đoạn (gộp mọi người làm công đoạn): sp/giờ thực tế ÷ năng lực chuẩn = SAH mỗi giờ ÷ người quy đổi. Trên 100% = phải làm nhanh hơn SAM mới theo kịp chuyền (phải gồng, hoặc SAM đặt cao). Công đoạn có %EFF cao nhất (đã chạy ≥ 1 giờ) là «quá tải nhất»; ≥ 90% là sát nhịp. (Bottleneck theo Nike xem CT.)","en":"%EFF of the whole operation (all its operators together): actual pcs/h ÷ standard capacity = SAH per hour ÷ FTE. Above 100% = must run faster than SAM to keep up with the line (stretched, or SAM set high). Highest op %EFF (after ≥ 1 h) is «most overloaded»; ≥ 90% is near limit. (Nike bottleneck: see CT.)"}, lv: 'op', vi: '%EFF công đoạn', en: 'Operation %EFF', def: 'rate / cap', vars: ['rate', 'rate60', 'cap', 'fte', 'people', 'sam'], bad: NaN, pct: true },
  { key: 'op_load60', note: {"vi":"Như %EFF công đoạn nhưng dùng sp/giờ 60′ gần nhất: %EFF hiện tại.","en":"Like operation %EFF but using pcs/h of the latest 60′: current %EFF."}, lv: 'op', vi: '%EFF công đoạn 60′ gần nhất', en: 'Operation %EFF last 60′', def: 'rate60 / cap', vars: ['rate', 'rate60', 'cap', 'fte', 'people', 'sam'], bad: NaN, pct: true },
  { key: 'op_ct', note: {"vi":"Cycle Time theo giáo trình Nike (slide 8, 11): thời gian giữa 2 sản phẩm ra khỏi công đoạn = 60 ÷ sp/giờ của cả công đoạn. CT càng lớn = công đoạn ra hàng càng chậm.","en":"Cycle Time as in the Nike training (slides 8, 11): time between 2 pieces leaving the operation = 60 ÷ pcs/h of the whole operation. Larger CT = slower operation."}, lv: 'op', vi: 'CT công đoạn (phút/sp)', en: 'Operation CT (min/pc)', def: '60 / rate', vars: ['rate', 'rate60', 'qty', 'runHours', 'fte', 'people', 'sam'], bad: NaN, pos: true },
  { key: 'op_wl', note: {"vi":"Thời gian chuẩn mỗi người phải gánh cho 1 sp = SAM ÷ người quy đổi. Dùng cho LBR theo SAM: công đoạn có số này lớn nhất là chỗ chia việc nặng nhất (chưa cần đo sản lượng).","en":"Standard time each person carries per piece = SAM ÷ FTE. Used for LBR by SAM: the largest value is where work is split heaviest (no output needed)."}, lv: 'op', vi: 'Phút chuẩn mỗi người (SAM ÷ người)', en: 'Std minutes per person (SAM ÷ FTE)', def: 'sam / fte', vars: ['sam', 'fte', 'people'], bad: NaN, pos: true },
  { key: 'line_eff_oas', note: {"vi":"Như OAS: SAH các công đoạn chính (C&M = Y) chia cho giờ On Std (thời gian phiếu công đoạn chính) + giờ Non C&M (thời gian công nhân may dập thẻ công đoạn phụ). Giờ lấy cột \"Time Consumption (Minute)\" trên Data ETS. Dùng khi có danh sách công đoạn chính và cột thời gian.","en":"As in OAS: SAH of main operations (C&M = Y) divided by On Std hours (main-op ticket time) + Non C&M hours (time sewing operators clock on secondary ops). Hours from the \"Time Consumption (Minute)\" column of the ETS data. Used when main ops and the time column exist."}, lv: 'line', vi: 'Hiệu suất chuyền (OAS)', en: 'Line efficiency (OAS)', def: 'sah / (onStdHours + nonCmHours)', vars: ['sah', 'onStdHours', 'nonCmHours', 'earned', 'people', 'workHours'], bad: 0, pct: true },
  { key: 'line_eff', note: {"vi":"Tổng SAH mọi người trong chuyền làm ra chia cho (số người có Data ETS trong chuyền × giờ đã làm).","en":"Total SAH of everyone on the line divided by (people with ETS data on the line × hours worked)."}, lv: 'line', vi: 'Hiệu suất chuyền', en: 'Line efficiency', def: 'sah / (people * workHours)', vars: ['sah', 'people', 'peoplePlan', 'workHours', 'totalHours', 'earned', 'workMin', 'totalMin'], bad: 0, pct: true },
  { key: 'lbr', note: {"vi":"Tỉ lệ cân bằng chuyền theo giáo trình Nike (slide 12, 14): tổng CT ÷ (CT bottleneck × số công đoạn). 100% = mọi công đoạn ra hàng đều nhau. Chuyền treo kéo mọi công đoạn cùng nhịp nên số này thường cao; muốn thấy chia việc có đều không xem LBR theo SAM.","en":"Line balancing rate as in the Nike training (slides 12, 14): Σ CT ÷ (bottleneck CT × no. of operations). 100% = all operations equally fast. A hanger line pulls everything at one pace so this is usually high; see LBR by SAM for workload balance."}, lv: 'line', vi: 'LBR (theo CT, Nike)', en: 'LBR (by CT, Nike)', def: 'sumCT / (maxCT * nOps)', vars: ['sumCT', 'maxCT', 'nOps'], bad: NaN, pct: true },
  { key: 'lbr_sam', note: {"vi":"LBR tính bằng phút chuẩn mỗi người (SAM ÷ người quy đổi) thay cho CT đo được: tổng ÷ (lớn nhất × số công đoạn). Cho biết bố trí người đã chia việc đều chưa; thấp = có công đoạn gánh quá nặng so với các công đoạn khác.","en":"LBR using standard minutes per person (SAM ÷ FTE) instead of measured CT: sum ÷ (largest × no. of operations). Shows whether staffing splits the work evenly; low = some operation carries far more than others."}, lv: 'line', vi: 'LBR theo SAM (chia việc)', en: 'LBR by SAM (workload)', def: 'sumWL / (maxWL * nOps)', vars: ['sumWL', 'maxWL', 'nOps'], bad: NaN, pct: true },
  { key: 'plan_sah', note: {"vi":"Kế hoạch cả ngày tính bằng SAH khi quản đốc không nhập target: người kế hoạch × giờ làm cả ngày × hiệu suất mục tiêu × hệ số đường cong học (mã mới / lặp lại).","en":"Day plan in SAH when no supervisor target: planned people × day hours × target efficiency × learning-curve factor (new / repeat style)."}, lv: 'line', vi: 'Kế hoạch SAH cả ngày (khi không có target quản đốc)', en: 'Planned SAH / day (no supervisor target)', def: 'peoplePlan * totalHours * effTarget * factor', vars: ['peoplePlan', 'people', 'totalHours', 'effTarget', 'factor', 'totalMin'], bad: 0 },
  { key: 'plan_now_sah', note: {"vi":"Phần kế hoạch phải đạt tới giờ dữ liệu: kế hoạch SAH cả ngày × giờ đã làm ÷ giờ làm cả ngày (chia đều theo thời gian).","en":"Plan due by data time: day plan SAH × hours worked ÷ day hours (spread evenly over time)."}, lv: 'line', vi: 'Kế hoạch SAH tới giờ dữ liệu', en: 'Planned SAH to data time', def: 'planSAH * workHours / totalHours', vars: ['planSAH', 'workHours', 'totalHours', 'workMin', 'totalMin'], bad: 0 },
  { key: 'progress', note: {"vi":"Như OAS: Actual SAH (SAH thực tế = Σ SAM × SL các phiếu ETS ÷ 60) chia cho Accumulate target (kế hoạch SAH tới giờ). 100% = đúng tiến độ; < 90% đỏ, 90–100% vàng, 100–110% xanh, ≥ 110% tím.","en":"As in OAS: Actual SAH (earned SAH = Σ SAM × qty of ETS tickets ÷ 60) divided by the accumulate target (planned SAH to now). 100% = on schedule; < 90% red, 90–100% yellow, 100–110% green, ≥ 110% purple."}, lv: 'line', vi: 'Tiến độ chuyền', en: 'Line progress', def: 'sah / planNowSAH', vars: ['outSAH', 'planNowSAH', 'planSAH', 'sah', 'workHours', 'totalHours', 'outEM', 'planNow', 'planEM', 'earned', 'workMin', 'totalMin'], bad: NaN, pct: true },
  { key: 'style_target', note: {"vi":"Target sp/ngày của mã hàng khi không có target quản đốc: kế hoạch SAH cả ngày × 60 × tỉ trọng mã ÷ ΣSAM mã, làm tròn.","en":"Style target pcs/day without a supervisor target: day plan SAH × 60 × style share ÷ style ΣSAM, rounded."}, lv: 'line', vi: 'Target mã hàng theo SAM (sp/ngày)', en: 'Style target by SAM (pcs/day)', def: 'round(planSAH * 60 * share / sumSam)', vars: ['planSAH', 'share', 'sumSam', 'factor', 'planEM'], bad: NaN },
];
// Bộ công thức dùng khi tính: ô trống / sai → mặc định. → { ev(key, vars), err: { key: thông báo } }
const formulaCache = new Map();
function formulaSet(custom) {
  custom = custom || {};
  const err = {}, fns = {};
  FORMULAS.forEach(f => {
    const src = String(custom[f.key] == null ? '' : custom[f.key]).trim();
    const ck = f.key + '|' + (src || f.def);
    if (!formulaCache.has(ck)) {
      try { formulaCache.set(ck, { fn: compileExpr(src || f.def, f.vars).fn }); }
      catch (e) { formulaCache.set(ck, { e: e.message }); }
    }
    const c = formulaCache.get(ck);
    if (c.e) { err[f.key] = c.e; fns[f.key] = compileExpr(f.def, f.vars).fn; } else fns[f.key] = c.fn;
  });
  const ev = (key, vars) => {
    const f = FORMULAS.find(x => x.key === key);
    let v; try { v = +fns[key](vars); } catch (e) { v = NaN; }
    return !isFinite(v) || (f.pos && v <= 0) ? f.bad : v;
  };
  return { ev, err };
}

// ---------- Giám sát chuyền (Visual Line): chỉ số + trạng thái từ phiếu ETS ----------
// Tham số mặc định 1 chuyền. Mọi số ở đây chỉnh được trên trang (lưu localStorage / file .json), không viết cứng nơi khác.
const DEFAULT_LINE = {
  group: '',                                   // mã tổ ETS (Prod. Group), VD '201S01'
  shift: { start: '07:30', end: '20:30', breaks: '11:35-12:35, 16:30-17:00' },
  people: 32,                                  // số người kế hoạch trong chuyền
  tapPeople: 2,                                // người làm tập bên ngoài
  effTarget: 0.8,                              // hiệu suất mục tiêu (tính target theo SAM)
  styles: {},                                  // { 'mã ETS': { ie:'mã IE', target:null (target quản đốc), start:'YYYY-MM-DD', level:'Mã lặp lại' } }
  ops: { first: '33', last: '84', tap: ['34', '40'], check: ['141', '150', '151'], exclude: ['270'] },
  samOverride: {},                             // SAM nhập tay theo mã công đoạn ETS, VD { '33': 0.15 }
  samSrc: 'ets',                               // nguồn SAM ưu tiên (13/10/2026: mặc định ETS cho mọi thiết bị, để PC và điện thoại ra cùng số): 'ets' = SAM trên phiếu ETS (phiếu không có SAM thì file IE), 'ie' = file IE (thiếu thì SAM trên phiếu ETS); chỉ chọn IE khi đã lưu tay (samSrcSet)
  stationOp: {},                               // đổi công đoạn của trạm (bấm thẻ trên đầu trạm 3D): { trạm: mã CĐ }
  stationEmp: {},                              // gán tay trạm → mã CN, VD { '9': '408386' }, '-' = để trống (ETS không có số trạm)
  freePos: {},                                 // công nhân đặt ra ngoài trạm trên 3D: { mã CN: [x, z] } (m)
  orders: { minQty: 20, endMin: 30 },          // đơn = mã hàng + màu: bỏ đơn < 20 sp (phiếu lẫn); đơn cũ hết khi CĐ cuối không có phiếu 30'
  autoSt: true,                               // xếp trạm theo người dập thẻ (autoStations); false = đúng layout IE
  carryMin: 25,                                // file không có cột Date: phiếu đồng bộ trước giờ vào ca + 25' = hàng tăng ca hôm trước (có Date thì xét theo ngày)
  syncGapMin: 10,                              // các lần đồng bộ cách nhau ≤ 10' gộp thành 1 khối
  syncMinRows: 10,                             // lần đồng bộ < 10 phiếu là lẻ, không làm mốc khối
  curve: {                                     // đường cong học (ƯỚC TÍNH): % của hiệu suất mục tiêu theo ngày chạy mã
    repeatDays: 90,
    levels: [{ name: 'Mã mới', en: 'New style', pct: [0.5, 0.65, 0.8, 0.9, 0.95, 1] },
      { name: 'Mã lặp lại', en: 'Repeat style', pct: [0.7, 0.85, 0.95, 1] }],
  },
  status: { green: 1.0, red: 0.9, purple: 1.1, stallMin: 60,   // màu chuyền theo OAS (13/10): < 90% đỏ · 90–100% vàng · 100–110% xanh · ≥ 110% tím (Actual SAH ÷ Accumulate target)
    staleMin: 90, shortPeople: 0.1, warmupMin: 60,
    gapPct: 0.1,                               // tắc nghẽn: SL lũy kế thấp hơn công đoạn đứng trước ≥ 10% (hàng dồn trước công đoạn)
    skillEff: 1.3, skillPeople: 2,             // phụ thuộc tay nghề: %EFF công đoạn ≥ 130% và ≤ 2 người
    wGreen: 0.9, wYellow: 0.8,                 // (cũ, không dùng từ 09/10)
    wRed: 0.5, wYel: 0.6, wBlue: 0.8 },        // màu %EFF công nhân (09/10): < 50% đỏ, 50–60% vàng, 60–80% xanh dương, ≥ 80% tím
};
const clone = o => JSON.parse(JSON.stringify(o));
function lineConfig(cfg) {                     // ghép tham số người dùng lên mặc định
  const d = clone(DEFAULT_LINE), c = cfg || {};
  const oldSt = c.status && c.status.purple == null;     // cài đặt lưu trước 13/10 (85 / 95%): đổi sang mốc OAS 90 / 100 / 110%
  Object.keys(c).forEach(k => { d[k] = c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) && d[k] && typeof d[k] === 'object' ? Object.assign(d[k], c[k]) : c[k]; });
  if (oldSt) Object.assign(d.status, { red: 0.9, green: 1.0, purple: 1.1 });
  if (!c.samSrcSet) d.samSrc = 'ets';                       // cấu hình lưu trước 13/10 (mặc định cũ 'ie' tuỳ máy) → ETS; chọn tay trong ⚙ thì được giữ
  return d;
}
// Số ngày làm việc (bỏ Chủ nhật) từ ngày bắt đầu mã tới ngày xét, ngày bắt đầu = 1
function workDayNo(from, to) {
  const a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (isNaN(a) || isNaN(b) || b < a) return NaN;
  let n = 0; for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++;
  return n;
}
// Hệ số đường cong học: mức (tên) + ngày thứ mấy → % (quá số cột thì lấy cột cuối)
function learnFactor(curve, level, day) {
  const L = (curve.levels || []).find(l => l.name === level);
  if (!L || !L.pct.length || !(day >= 1)) return 1;
  return L.pct[Math.min(day, L.pct.length) - 1];
}

// E = parseEts(...), cfg = lineConfig(...), ie = { 'mã ETS': kết quả buildStyle (ops, totalSam) },
// opt = { now: giây trong ngày (xét dữ liệu cũ), until: chỉ lấy phiếu đồng bộ tới giờ này (xem lại trong ngày),
//         formulas: { key: biểu thức } công thức người dùng (FORMULAS), trống = mặc định }
// Khóa đơn hàng: style gốc (bỏ 2 số thị trường) + màu
const ordKey = t => `${styleCore(t.style)}|${t.color || ''}`;
// Đoán màu áo từ tên màu ETS (VD "65/A BLUE", "08/A DARK GRAY", "60 LIGHT BLUE") → '#rrggbb'; không nhận ra → '' (dùng màu mặc định).
// Từ khóa dài xét trước (NAVY trước BLUE); LIGHT / PALE nhạt hơn, DARK / DEEP đậm hơn.
const COLOR_WORDS = [
  ['off white', '#efeadf'], ['navy', '#1f2f55'], ['royal', '#2a4fb0'], ['sky', '#8ec5e8'], ['turquoise', '#30b5b0'], ['teal', '#1f7f80'],
  ['mint', '#a8e0c4'], ['olive', '#6b6b35'], ['khaki', '#b8a77a'], ['beige', '#d9c8a6'], ['sand', '#d4bf95'], ['camel', '#b68a55'],
  ['cream', '#f1e8cf'], ['ivory', '#f4efdf'], ['charcoal', '#3a3d42'], ['heather', '#9a9ea6'], ['melange', '#a3a6ab'], ['silver', '#bfc3c8'],
  ['burgundy', '#6e1f2e'], ['maroon', '#6b1f24'], ['wine', '#6a1f35'], ['coral', '#f07c6a'], ['salmon', '#f19a85'], ['peach', '#f6b99a'],
  ['lavender', '#b9a8d9'], ['lilac', '#c3a6d3'], ['violet', '#7a4fb0'], ['purple', '#6a3d9a'], ['magenta', '#c2307a'], ['fuchsia', '#c2307a'],
  ['mustard', '#c9a227'], ['lemon', '#f2e45c'], ['gold', '#d4a72c'], ['indigo', '#33407a'], ['denim', '#3f5f8a'], ['aqua', '#5fd0d6'],
  ['white', '#f5f6f7'], ['black', '#26272b'], ['grey', '#8c9097'], ['gray', '#8c9097'], ['blue', '#2f62b5'], ['red', '#c0362c'],
  ['green', '#2f8a4c'], ['yellow', '#efd23a'], ['orange', '#ec7d2c'], ['pink', '#ef9ab8'], ['brown', '#6e4a2f'], ['tan', '#c4a07a'],
  ['xanh than', '#1f2f55'], ['trang', '#f5f6f7'], ['den', '#26272b'], ['xam', '#8c9097'], ['xanh', '#2f62b5'], ['do', '#c0362c'], ['vang', '#efd23a'], ['hong', '#ef9ab8'],
];
function garmentColor(name) {
  const s = ' ' + norm(name).replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
  const hit = COLOR_WORDS.find(([w]) => s.includes(' ' + w + ' '));
  if (!hit) return '';
  const c = parseInt(hit[1].slice(1), 16);
  let r = c >> 16, g = (c >> 8) & 255, b = c & 255;
  const mix = (t, k) => { r = Math.round(r + (t - r) * k); g = Math.round(g + (t - g) * k); b = Math.round(b + (t - b) * k); };
  if (/ (light|lt|pale|soft|baby) /.test(s)) mix(255, 0.45);
  else if (/ (dark|dk|deep) /.test(s)) mix(0, 0.4);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function lineStatus(E, cfg, ie, opt) {
  cfg = lineConfig(cfg); ie = ie || {}; opt = opt || {};
  const Wc = workClock(cfg.shift), st = cfg.status, warn = [], FS = formulaSet(opt.formulas), F = FS.ev;
  const has = (list, op) => (list || []).some(x => codeKey(x) === codeKey(op));
  const T = E.tickets.filter(t => (!cfg.group || !t.group || t.group === cfg.group) && !(t.add > opt.until))
    .map(t => Object.assign({}, t));            // không ghi đè phiếu gốc (gọi lại nhiều lần khi kéo thanh thời gian)
  // Mã khác thị trường cùng style gốc (04347N278 / 01347N278) = cùng loại hàng (người dùng 09/10): gộp về 1 mã đại diện
  // (ưu tiên mã có IE, rồi mã nhiều sp nhất) cho công đoạn, mã hàng, target, tắc nghẽn. Mã ETS gốc giữ ở t.etsStyle.
  const coreQty = {}; T.forEach(t => { const c = styleCore(t.style), m = coreQty[c] || (coreQty[c] = {}); m[t.style] = (m[t.style] || 0) + t.qty; });
  const repOf = {};
  Object.entries(coreQty).forEach(([c, m]) => { const ks = Object.keys(m).sort((a, b) => m[b] - m[a]); repOf[c] = ks.find(k => ie && ie[k]) || ks[0]; });
  T.forEach(t => { t.etsStyle = t.style; t.style = repOf[styleCore(t.style)]; });

  // SAM từng phiếu: nhập tay > file IE (mã ghép '48+84' chỉ gán cho mã đầu) > SAM trên phiếu ETS
  // (cfg.samSrc = 'ets': nhập tay > SAM trên phiếu ETS > file IE; tên công đoạn vẫn lấy từ file IE)
  const ieOf = s => ie[s] || null, etsFirst = cfg.samSrc === 'ets';
  const samOf = t => {
    if (cfg.samOverride[t.op] != null) return { sam: +cfg.samOverride[t.op], src: 'tay' };
    const I = ieOf(t.style);
    if (etsFirst && t.sam > 0) { const o = I && I.ops.find(o => codeMatch(o.code, t.op)); return { sam: t.sam, src: 'ETS', name: o ? o.name : '' }; }
    let name = '';
    if (I) {
      const o = I.ops.find(o => codeKey(o.code) === codeKey(t.op));
      if (o && o.sam > 0) return { sam: o.sam, src: 'IE', name: o.name };
      const g = I.ops.find(o => o.code && codeParts(o.code).length > 1 && codeMatch(o.code, t.op));
      if (g) return codeParts(g.code)[0] === codeKey(t.op) && g.sam > 0 ? { sam: g.sam, src: 'IE', name: g.name } : { sam: 0, src: 'IE ghép', name: g.name };
      name = o ? o.name : '';
    }
    return { sam: t.sam > 0 ? t.sam : 0, src: 'ETS', name };
  };

  // Phân loại phiếu. Tồn ca trước (09/10): phiếu có Date trước ngày báo cáo (ngày mới nhất trong file) — ETS ghi Date = ngày làm;
  // công nhân vào sớm (07:14) dập thẻ trước giờ ca vẫn là hàng hôm nay. File không có Date: phiếu đồng bộ trước giờ vào ca + carryMin.
  const dKey = v => { const x = String(v || '').trim(), m = x.match(/^(d{1,2})[/.-](d{1,2})[/.-](d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : x.slice(0, 10); };
  const dayOf = T.reduce((a, t) => { const k = dKey(t.date); return k > a ? k : a; }, ''), byDate = !!dayOf && T.every(t => dKey(t.date));
  const carryEnd = Wc.s + cfg.carryMin * 60;
  T.forEach(t => {
    const s = samOf(t); t.samUse = s.sam; t.samSrc = s.src; t.opName = s.name || '';
    t.kind = has(cfg.ops.exclude, t.op) ? 'exclude' : has(cfg.ops.tap, t.op) ? 'tap' : has(cfg.ops.check, t.op) ? 'check' : 'line';
    t.carry = byDate ? dKey(t.date) < dayOf : t.add < carryEnd;
  });
  const used = T.filter(t => t.kind !== 'exclude');
  const today = used.filter(t => !t.carry);
  const lineStyles = [...new Set(used.filter(t => t.kind === 'line').map(t => t.style))];
  lineStyles.filter(s => !ieOf(s)).forEach(s => warn.push(W(`Mã ${s} chưa có file IE: dùng SAM trong Data ETS.`, `Style ${s} has no IE file: using the SAM in the ETS data.`)));

  // Khối đồng bộ: chỉ lần đồng bộ lớn (≥ syncMinRows phiếu) làm mốc; các mốc cách nhau ≤ syncGapMin gộp 1 khối.
  // Khối = (cuối khối trước, cuối khối này]. Phiếu của lần đồng bộ lẻ (1–2 phiếu) đi theo khối kế tiếp.
  const cnt = new Map(); today.forEach(t => cnt.set(t.add, (cnt.get(t.add) || 0) + 1));
  const adds = [...cnt.keys()].sort((a, b) => a - b);
  const major = adds.filter(a => cnt.get(a) >= cfg.syncMinRows);
  const blocks = []; let cur = [];
  const flush = () => { if (cur.length) blocks.push(cur[cur.length - 1]); cur = []; };
  major.forEach(a => { if (cur.length && a - cur[cur.length - 1] > cfg.syncGapMin * 60) flush(); cur.push(a); });
  flush();
  const blockEnd = new Map();
  adds.forEach(a => {
    const k = blocks.findIndex(e => e >= a);
    blockEnd.set(a, k >= 0 ? [k ? blocks[k - 1] : Wc.s, blocks[k]] : [blocks.length ? blocks[blocks.length - 1] : Wc.s, a]);
  });
  // Dữ liệu tới = lần đồng bộ mới nhất của phiếu chuyền (phiếu bó lẻ đồng bộ giờ khác không tính)
  const lineAdds = today.filter(t => t.kind === 'line').map(t => t.add);
  const dataAt = lineAdds.length ? Math.max(...lineAdds) : adds.length ? adds[adds.length - 1] : NaN;
  const dataW = isFinite(dataAt) ? Wc.work(dataAt) : 0;
  const nMin = Math.ceil(Wc.total / 60);

  // Công đoạn (theo mã hàng + mã công đoạn): sản lượng rải đều trong khối, theo phút làm việc
  const opMap = new Map();
  const opOf = t => {
    const k = `${t.style}|${t.op}`;
    if (!opMap.has(k)) opMap.set(k, { key: k, style: t.style, op: t.op, kind: t.kind, name: t.opName, sam: t.samUse, samSrc: t.samSrc,
      qty: 0, carry: 0, emps: new Map(), min: new Float32Array(nMin), firstW: Infinity, lastW: -Infinity, lastAdd: -Infinity });
    return opMap.get(k);
  };
  used.forEach(t => {
    const o = opOf(t);
    if (t.carry) { o.carry += t.qty; return; }
    o.qty += t.qty;
    const [a, b] = blockEnd.get(t.add), wa = Wc.work(a), wb = Wc.work(b);
    o.firstW = Math.min(o.firstW, wa); o.lastW = Math.max(o.lastW, wb); o.lastAdd = Math.max(o.lastAdd, t.add);
    const m0 = Math.floor(wa / 60), m1 = Math.max(m0 + 1, Math.ceil(wb / 60)), per = t.qty / (m1 - m0);
    for (let m = m0; m < m1 && m < nMin; m++) o.min[m] += per;
    const e = o.emps.get(t.emp) || { qty: 0, w: 0 }; e.qty += t.qty; o.emps.set(t.emp, e);
  });

  // Công nhân: phút chuẩn, người quy đổi (tỉ lệ thời gian theo phút chuẩn; công đoạn SAM = 0 tạm tính 0,1 phút/sp)
  const wk = new Map();
  today.forEach(t => {
    const w = wk.get(t.emp) || (wk.set(t.emp, { emp: t.emp, name: t.name, kinds: new Set(), ops: new Set(), qty: 0, earned: 0, load: 0, lastAdd: -Infinity, byOp: {} }), wk.get(t.emp));
    const ld = t.qty * (t.samUse > 0 ? t.samUse : 0.1);
    w.kinds.add(t.kind); w.ops.add(t.op); w.qty += t.qty; w.earned += t.qty * t.samUse; w.load += ld;
    const ok = ordKey(t); w.byOrd = w.byOrd || {}; w.byOrd[ok] = (w.byOrd[ok] || 0) + t.qty * t.samUse;
    w.byOrdQ = w.byOrdQ || {}; w.byOrdQ[ok] = (w.byOrdQ[ok] || 0) + t.qty;
    if (t.kind === 'line' && !(t.add < w.lastOrdAt)) { w.lastOrd = ok; w.lastOrdAt = t.add; }   // đơn của phiếu chuyền gần nhất
    w.lastAdd = Math.max(w.lastAdd, t.add);
    const b = w.byOp[t.op] || (w.byOp[t.op] = { qty: 0, load: 0, kind: t.kind }); b.qty += t.qty; b.load += ld;
  });
  today.forEach(t => { const e = opOf(t).emps.get(t.emp); e.w += t.qty * (t.samUse > 0 ? t.samUse : 0.1) / wk.get(t.emp).load; });
  // Công đoạn chính = công đoạn chuyền có phút chuẩn lớn nhất (dùng để gán trạm 3D); sp/giờ tính trên công đoạn chính
  const workers = [...wk.values()].map(w => {
    const bo = Object.entries(w.byOp).sort((a, b) => (b[1].kind === 'line') - (a[1].kind === 'line') || b[1].load - a[1].load)[0];
    const pq = bo ? bo[1].qty : 0, fv = { sah: w.earned / 60, earned: w.earned, qty: w.qty, primaryQty: pq, workMin: dataW / 60, workHours: dataW / 3600 };
    return Object.assign(w, {
      inLine: w.kinds.has('line'), kinds: [...w.kinds], ops: [...w.ops].sort((a, b) => (+a || 0) - (+b || 0)),
      primary: bo ? bo[0] : '', primaryQty: pq, rate: F('w_rate', fv), sah: w.earned / 60, workHours: dataW / 3600,
      eff: F('w_eff', fv), stalled: dataW - Wc.work(w.lastAdd) >= st.stallMin * 60 });
  });

  // Chỉ số từng công đoạn
  const ops = [...opMap.values()].map(o => {
    const run = o.qty > 0 ? dataW - o.firstW : 0;
    const fte = [...o.emps.values()].reduce((a, e) => a + e.w, 0);
    const win = Math.min(st.warmupMin * 60, run), m1 = Math.floor(dataW / 60), m0 = Math.max(0, m1 - Math.round(win / 60));
    let q60 = 0; for (let m = m0; m < m1 && m < nMin; m++) q60 += o.min[m];
    const fv = { qty: o.qty, runMin: run / 60, runHours: run / 3600, q60, winHours: (m1 - m0) / 60, fte, people: o.emps.size, sam: o.sam };
    const rate = F('op_rate', fv), rate60 = F('op_rate60', fv), cap = F('op_cap', fv);
    const lv = { rate, rate60, cap, fte, people: o.emps.size, sam: o.sam };
    return { key: o.key, style: o.style, op: o.op, kind: o.kind, name: o.name, sam: o.sam, samSrc: o.samSrc, qty: o.qty, carry: o.carry,
      people: o.emps.size, fte, rate, rate60, cap, load: F('op_load', lv), load60: F('op_load60', lv), runMin: run / 60,
      ct: F('op_ct', Object.assign({ qty: o.qty, runHours: run / 3600 }, lv)), wl: F('op_wl', { sam: o.sam, fte, people: o.emps.size }),
      running: run >= st.warmupMin * 60, stalled: o.qty > 0 && dataW - o.lastW >= st.stallMin * 60, lastAdd: o.lastAdd,
      perMin: o.min };
  });
  // Công đoạn chưa có tên (mã hàng chưa có IE: ETS không có cột tên) → mượn tên cùng mã công đoạn của mã hàng khác trên chuyền
  ops.filter(o => !o.name).forEach(o => { const x = ops.find(p => p.name && !p.nameFrom && codeKey(p.op) === codeKey(o.op)); if (x) { o.name = x.name; o.nameFrom = x.style; } });
  // Thứ tự hiển thị: theo trạm đầu tiên trên layout IE, không có thì theo mã công đoạn
  const station = o => { const I = ieOf(o.style), x = I && I.ops.find(p => p.code && codeMatch(p.code, o.op)); const m = x && String(x.ban).match(/\d+/); return m ? +m[0] : 1000 + (+o.op || 0); };
  ops.sort((a, b) => a.style.localeCompare(b.style) || station(a) - station(b) || (+a.op || 0) - (+b.op || 0));

  // Bottleneck theo Nike: CT lớn nhất (công đoạn chuyền có SAM, đã chạy ≥ warmupMin); LBR theo CT và theo SAM ÷ người
  const lbrOps = ops.filter(o => o.kind === 'line' && o.sam > 0 && o.running);
  const ctOps = lbrOps.filter(o => isFinite(o.ct)), wlOps = lbrOps.filter(o => isFinite(o.wl));
  let ctBn = null; ctOps.forEach(o => { if (!ctBn || o.ct > ctBn.ct) ctBn = o; });
  const lbr = ctOps.length ? F('lbr', { sumCT: ctOps.reduce((a, o) => a + o.ct, 0), maxCT: ctBn.ct, nOps: ctOps.length }) : NaN;
  const wlMax = wlOps.reduce((a, o) => Math.max(a, o.wl), 0);
  const lbrSam = wlOps.length ? F('lbr_sam', { sumWL: wlOps.reduce((a, o) => a + o.wl, 0), maxWL: wlMax, nOps: wlOps.length }) : NaN;
  const notes = [];

  // Theo mã hàng: ra chuyền (công đoạn cuối), tồn trên chuyền (đầu − cuối, tính cả tồn ca trước), target
  const date = (today[0] || used[0] || {}).date || E.date;
  const styles = lineStyles.map(s => {
    const I = ieOf(s), sc = cfg.styles[s] || {};
    const fst = ops.find(o => o.style === s && codeKey(o.op) === codeKey(cfg.ops.first));
    const lst = ops.find(o => o.style === s && codeKey(o.op) === codeKey(cfg.ops.last));
    const sumSam = I && I.totalSam > 0 ? I.totalSam : I ? I.ops.reduce((a, o) => a + (o.sam || 0), 0)
      : ops.filter(o => o.style === s && o.kind !== 'check').reduce((a, o) => a + o.sam, 0);
    const day = sc.start ? workDayNo(sc.start, date) : NaN;
    return { style: s, ie: sc.ie || (I && I.style) || '', sumSam, out: lst ? lst.qty : 0, carryOut: lst ? lst.carry : 0,
      wip: fst && lst ? (fst.qty + fst.carry) - (lst.qty + lst.carry) : NaN, targetQd: sc.target > 0 ? +sc.target : null,
      day, level: sc.level || '', factor: learnFactor(cfg.curve, sc.level, day), noLast: !lst };
  });
  styles.filter(s => s.noLast).forEach(s => warn.push(W(`Mã ${s.style}: chưa có Data ETS công đoạn cuối (${cfg.ops.last}).`, `Style ${s.style}: no ETS data at the last operation (${cfg.ops.last}) yet.`)));

  // Cả chuyền: người, SAH, hiệu suất, tiến độ (bên trong vẫn giữ phút chuẩn = SAH × 60; công thức hiển thị theo SAH / giờ)
  const inLine = workers.filter(w => w.inLine), tapOnly = workers.filter(w => !w.inLine && w.kinds.includes('tap'));
  const workMin = dataW / 60, totalMin = Wc.total / 60, workHours = workMin / 60, totalHours = totalMin / 60;
  // Có danh sách công đoạn chính (C&M = Y, ⚙ Mã hàng / MO Bulletin): SAH chuyền = Σ phiếu hôm nay của CĐ chính (kể cả CĐ làm tập / "Bỏ ra"),
  // người = người dập thẻ CĐ chính (như OAS). Không có thì như cũ: mọi phiếu của người trong chuyền.
  // CĐ chính: nhập tay / MO Bulletin (cfg.styles[mã].main) > file IE (sheet SAM, phần trên "Công đoạn phụ")
  const mainOf = s => { const c = styleCore(s), k = Object.keys(cfg.styles || {}).find(x => styleCore(x) === c && (cfg.styles[x].main || []).length); if (k) return cfg.styles[k].main; const I = ieOf(s); return I && I.mainOps && I.mainOps.length ? I.mainOps : null; };
  // phiếu mã khác chưa có danh sách (VD phiếu CĐ 270 ghi mã 04347N274, như OAS vẫn tính): dùng CĐ chính chung của chuyền
  const lineMain = [...new Set(Object.values(cfg.styles || {}).flatMap(x => x.main || []).concat(lineStyles.flatMap(s => mainOf(s) || [])))];
  // Chưa nhập MO Bulletin nhưng Data ETS có cột thời gian: tự suy CĐ chính = CĐ có SAM > 0, trừ CĐ kiểm / hoàn thiện (danh sách kiểm + tên IE bắt đầu "Kiểm" / "Check", VD 70 Kiểm cổ) (201S01: ra đúng 34, 40–48, 270 như Bulletin)
  const mainAuto = !lineStyles.some(s => mainOf(s)) && !!E.hasTc && cfg.mainAuto !== false;
  const autoMain = mainAuto ? [...new Set(T.filter(t => t.samUse > 0 && t.kind !== 'check' && !/^(kiem|check)/.test(norm(t.opName))).map(t => t.op))] : [];
  const mainOfT = s => mainOf(s) || (lineMain.length ? lineMain : mainAuto ? autoMain : null);
  const byMain = lineStyles.some(s => mainOf(s)) || mainAuto;
  const mainT = byMain ? T.filter(t => !t.carry && (mainOfT(t.style) || []).some(c => codeKey(c) === codeKey(t.op))) : [];
  const earned = byMain ? mainT.reduce((a, t) => a + t.qty * t.samUse, 0) : inLine.reduce((a, w) => a + w.earned, 0);
  const effPeople = byMain ? new Set(mainT.map(t => t.emp)).size : inLine.length;
  // Giờ như OAS (cần CĐ chính + cột "Time Consumption"): On Std = phút phiếu CĐ chính, Non C&M = phút phiếu CĐ phụ do công nhân may (người có phiếu CĐ chính) dập,
  // Off Std = phiếu không On-Std
  const byTc = byMain && !!E.hasTc;
  const tcH = f => T.filter(t => !t.carry && f(t)).reduce((a, t) => a + (t.tc > 0 ? t.tc : 0), 0) / 60;
  const isMain = t => (mainOfT(t.style) || []).some(c => codeKey(c) === codeKey(t.op));
  const onStdHours = byTc ? tcH(t => t.onStd && isMain(t)) : NaN, sewers = new Set(mainT.map(t => t.emp)), nonCmHours = byTc ? tcH(t => t.onStd && !isMain(t) && sewers.has(t.emp)) : NaN;
  const offStdHours = byTc ? tcH(t => !t.onStd) : NaN;
  const eff = byTc ? F('line_eff_oas', { sah: earned / 60, earned, onStdHours, nonCmHours, people: effPeople, workHours })
    : F('line_eff', { sah: earned / 60, earned, people: effPeople, peoplePlan: cfg.people, workHours, totalHours, workMin, totalMin });
  const outEM = styles.reduce((a, s) => a + s.out * s.sumSam, 0);

  // Đơn hàng (09/10) = style gốc + màu (mã khác thị trường cùng style gốc, cùng màu = cùng đơn, VD 04347N278 / 01347N278 BLUE). Lên đầu chuyền = phiếu đầu tiên ở CĐ đầu (ops.first), ra chuyền = CĐ cuối (ops.last);
  // giờ = giờ đồng bộ phiếu (phiếu ca trước tính từ đầu ca). Bỏ đơn < orders.minQty sp (phiếu lẫn màu / mã khác).
  // Đang chuyển đơn: đơn mới nhất đã lên đầu chuyền, đơn trước nó vẫn còn phiếu CĐ cuối trong orders.endMin phút gần nhất.
  const oc = cfg.orders, ordMap = new Map();
  used.filter(t => t.kind === 'line').forEach(t => {
    const k = ordKey(t), at = t.carry ? Wc.s : t.add;
    const o = ordMap.get(k) || (ordMap.set(k, { key: k, style: t.style, color: t.color || '', colorNo: t.colorNo || '', mos: new Map(), sq: {},
      headQty: 0, outQty: 0, headStart: Infinity, headToday: Infinity, outFirst: Infinity, outLast: -Infinity }), ordMap.get(k));
    o.sq[t.style] = (o.sq[t.style] || 0) + t.qty;                 // sp từng mã (đại diện) trong đơn (chia tỉ trọng / target theo mã)
    o.codes = o.codes || {}; o.codes[t.etsStyle] = (o.codes[t.etsStyle] || 0) + t.qty;   // mã ETS gốc (hiển thị)
    if (t.mo) o.mos.set(t.mo, (o.mos.get(t.mo) || 0) + t.qty);
    if (codeKey(t.op) === codeKey(cfg.ops.first)) { o.headQty += t.qty; o.headStart = Math.min(o.headStart, at); if (!t.carry) o.headToday = Math.min(o.headToday, t.add); }
    if (codeKey(t.op) === codeKey(cfg.ops.last)) { o.outQty += t.qty; o.outFirst = Math.min(o.outFirst, at); o.outLast = Math.max(o.outLast, at); }
  });
  // Thứ tự đơn: theo giờ phiếu treo đầu tiên HÔM NAY ở CĐ đầu; đơn không treo hôm nay (chỉ còn hàng ca trước đang ra) = đơn từ ca trước, xếp trước
  const oStart = o => (isFinite(o.headToday) ? o.headToday : -1);
  const orders = [...ordMap.values()].filter(o => Math.max(o.headQty, o.outQty) >= oc.minQty ).sort((a, b) => oStart(a) - oStart(b) || a.outFirst - b.outFirst);
  orders.forEach((o, i) => {
    o.fromPrev = !isFinite(o.headToday); o.start = o.fromPrev ? Wc.s : o.headToday; o.mo = [...o.mos.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]); delete o.mos;
    o.styles = Object.keys(o.sq).sort((a, b) => o.sq[b] - o.sq[a]); o.style = o.styles[0];   // mã chính = nhiều sp nhất
    o.codes = Object.keys(o.codes).sort((a, b) => o.codes[b] - o.codes[a]);
    // Khung giờ kế hoạch của đơn: từ lúc lên đầu chuyền (đơn đầu: đầu ca) tới lúc đơn sau lên đầu chuyền (đơn cuối: hết ca)
    const a = i ? Math.max(Wc.s, o.start) : Wc.s, b = i + 1 < orders.length ? Math.max(Wc.s, oStart(orders[i + 1])) : Wc.e;
    o.share = Wc.total > 0 ? Math.max(0, Wc.work(b) - Wc.work(a)) / Wc.total : 0;
    // %EFF đơn (người trong chuyền, như %EFF chuyền): SAH của đơn ÷ giờ người chia theo tỉ lệ phút chuẩn từng người làm cho đơn
    // (người chưa có SAM: chia theo số sp)
    const iw = workers.filter(w => w.inLine);
    o.sah = iw.reduce((s, w) => s + (w.byOrd[o.key] || 0), 0) / 60;
    o.hours = iw.reduce((s, w) => s + dataW / 3600 * (w.earned > 0 ? (w.byOrd[o.key] || 0) / w.earned : w.qty > 0 ? (w.byOrdQ[o.key] || 0) / w.qty : 0), 0);
    o.eff = o.hours > 0 ? o.sah / o.hours : NaN;
  });
  const headO = orders[orders.length - 1] || null;
  orders.forEach(o => { o.active = o === headO || (isFinite(o.outLast) && dataAt - o.outLast < oc.endMin * 60); o.done = !o.active; });
  const olds = orders.filter(o => o !== headO && o.active);
  const orderPhase = { phase: !orders.length ? 'none' : olds.length ? 'change' : 'single', head: headO ? headO.key : null,
    out: olds.length ? olds[olds.length - 1].key : headO ? headO.key : null, since: olds.length && headO ? headO.start : NaN };
  // Tỉ trọng kế hoạch từng mã (chia target): theo thời gian chạy đơn; thiếu dữ liệu CĐ đầu / cuối thì theo phút chuẩn đã ra chuyền
  // (đơn gồm nhiều mã ETS cùng style gốc: khung giờ của đơn chia cho từng mã theo số sp)
  const fr = (o, st) => { const n = Object.values(o.sq).reduce((a, b) => a + b, 0); return n > 0 ? (o.sq[st] || 0) / n : 0; };
  const tShare = {}; orders.forEach(o => o.styles.forEach(st => { tShare[st] = (tShare[st] || 0) + o.share * fr(o, st); }));
  const byTime = styles.length && styles.every(s => tShare[s.style] > 0);
  const shareOf = s => byTime ? tShare[s.style] : outEM > 0 ? s.out * s.sumSam / outEM : 1 / styles.length;
  styles.forEach(s => { s.share = shareOf(s); });
  const factor = styles.length ? styles.reduce((a, s) => a + s.factor * shareOf(s), 0) : 1;
  // Kế hoạch phút chuẩn cả ngày: có target quản đốc thì dùng, không thì người × phút × hiệu suất mục tiêu × đường cong học
  const allQd = styles.length && styles.every(s => s.targetQd);
  const planEM = cfg.sahTarget > 0 ? cfg.sahTarget * 60        // mục tiêu SAH của OAS (file SAH_TARGET): ưu tiên, để màu chuyền trùng OAS
    : allQd ? styles.reduce((a, s) => a + s.targetQd * s.sumSam, 0)
    : F('plan_sah', { peoplePlan: cfg.people, people: inLine.length, totalHours, effTarget: cfg.effTarget, factor, totalMin }) * 60;
  styles.forEach(s => { s.target = s.targetQd || F('style_target', { planSAH: planEM / 60, planEM, share: shareOf(s), sumSam: s.sumSam, factor: s.factor }); s.targetSrc = s.targetQd ? 'qd' : 'sam'; });
  // Target từng đơn = target mã chia theo khung giờ của đơn
  orders.forEach(o => {
    const t = o.styles.reduce((a, st) => { const x = styles.find(y => y.style === st); return x && tShare[st] > 0 ? a + x.target * o.share * fr(o, st) / tShare[st] : a; }, 0);
    o.target = t > 0 ? Math.round(t) : NaN;
  });
  // Dự báo cuối ca (09/10): ra chuyền hiện tại + sp/giờ 60′ gần nhất của CĐ cuối × giờ làm còn lại (trừ giờ nghỉ);
  // CĐ cuối chưa có tốc độ 60′ (ngừng / mới chạy) → sp/giờ TB. Cần = (target − ra) ÷ giờ còn lại để vẫn đạt target.
  const lastOps = ops.filter(o => codeKey(o.op) === codeKey(cfg.ops.last));
  const outNow = styles.reduce((a, x) => a + x.out, 0), tgtDay = styles.reduce((a, x) => a + (x.target || 0), 0);
  const r60 = lastOps.reduce((a, o) => a + (isFinite(o.rate60) ? o.rate60 : 0), 0), rAvg = lastOps.reduce((a, o) => a + (isFinite(o.rate) ? o.rate : 0), 0);
  const remH = Math.max(0, Wc.total - dataW) / 3600, pace = r60 > 0 ? r60 : rAvg;
  const forecast = { out: outNow, target: tgtDay, pace, paceSrc: r60 > 0 ? '60' : 'avg', remH, end: Math.round(outNow + pace * remH),
    need: remH > 0 ? Math.max(0, tgtDay - outNow) / remH : NaN };
  forecast.gap = forecast.end - tgtDay;
  // Accumulate target như OAS: tính theo GIỜ ĐỒNG HỒ hiện tại (opt.clock, giây trong ngày) khi đang xem mới nhất của ngày hôm nay, không phải giờ phiếu cuối của file ETS
  // (file xuất trễ vài phút thì OAS vẫn tính tới giờ hiện tại → chuyền "đỏ" hơn). Xem lại / ngày cũ: tính tới giờ dữ liệu như trước.
  const accMin = isFinite(opt.clock) && isFinite(dataAt) ? Math.max(dataW, Wc.work(Math.min(Math.max(opt.clock, dataAt), Wc.e))) / 60 : workMin;
  const planNow = F('plan_now_sah', { planSAH: planEM / 60, workHours: accMin / 60, totalHours, workMin: accMin, totalMin }) * 60;
  const progress = F('progress', { outSAH: outEM / 60, planNowSAH: planNow / 60, planSAH: planEM / 60, sah: earned / 60, workHours, totalHours, outEM, planNow, planEM, earned, workMin, totalMin });

  // Tắc nghẽn = công đoạn đang giới hạn sản lượng chuyền (KHÔNG phải %EFF công đoạn cao nhất: %EFF cao mà vẫn theo kịp = người giỏi).
  // Ứng viên: công đoạn chuyền có SAM, đã chạy ≥ warmupMin, và [hàng dồn trước công đoạn: SL lũy kế thấp hơn công đoạn đứng trước ≥ gapPct
  // HOẶC sp/giờ < nhịp cần để đạt target (target ngày ÷ giờ làm cả ngày)]. Chọn công đoạn ra hàng chậm nhất (CT lớn nhất).
  const lineOps = ops.filter(o => o.kind === 'line');
  lineOps.forEach((o, i) => {
    const prev = lineOps.slice(0, i).reverse().find(p => p.style === o.style && p.qty + p.carry > 0);
    const sx = styles.find(y => y.style === o.style);
    o.prevOp = prev ? prev.op : '';
    o.gap = prev ? 1 - (o.qty + o.carry) / (prev.qty + prev.carry) : NaN;
    o.need = sx && sx.target > 0 && totalHours > 0 ? sx.target / totalHours : NaN;
  });
  // Mã của đơn cũ (đang ra dần / đã hết, khác đơn đầu chuyền): hàng của mã đó còn nằm giữa các công đoạn trên đường chuyền,
  // SL lũy kế thấp hơn công đoạn trước không phải hàng dồn → không xét điều kiện "hàng dồn" cho mã này (vẫn xét chậm hơn nhịp cần)
  const headSq = headO ? headO.sq : {};
  const oldStyles = [...new Set(orders.filter(o => o !== headO).flatMap(o => Object.keys(o.sq)))].filter(s => !(s in headSq));
  const gapHit = o => o.gap >= st.gapPct && !oldStyles.includes(o.style), rateHit = o => o.rate < o.need;
  let bn = null;
  lineOps.filter(o => o.sam > 0 && o.running && isFinite(o.ct) && (gapHit(o) || rateHit(o)))
    .forEach(o => { if (!bn || o.ct > bn.ct) bn = o; });
  if (bn) bn.trig = gapHit(bn) && rateHit(bn) ? 'both' : gapHit(bn) ? 'gap' : 'rate';   // lý do: hàng dồn / chậm nhịp / cả hai
  // Nguyên nhân: năng lực chuẩn (100% SAM) < nhịp cần → thiếu người; đủ năng lực mà vẫn chậm → tay nghề (người %EFF thấp nhất)
  if (bn) {
    if (bn.cap < bn.need) bn.why = { kind: 'people', add: bn.need * bn.sam / 60 - bn.fte };
    else {
      const w = workers.filter(x => x.primary === bn.op && x.earned > 0).sort((a, b) => a.eff - b.eff)[0];
      bn.why = { kind: 'skill', emp: w ? w.emp : '', name: w ? w.name : '', eff: w ? w.eff : NaN };
    }
  }
  const skillDep = o => o.kind === 'line' && o.sam > 0 && o.running && o.load >= st.skillEff && o.people <= st.skillPeople;
  ops.forEach(o => { o.status = o.stalled ? 'stall' : o === bn ? 'bn' : skillDep(o) ? 'skill' : !o.running ? 'start' : o.load >= 0.9 ? 'near' : 'ok'; });
  if (bn) {
    const r = Math.round, b1 = `Tắc nghẽn CĐ ${bn.op} ${bn.name}: ${r(bn.rate)} sp/giờ`, b2 = `Bottleneck op ${bn.op} ${bn.name}: ${r(bn.rate)} pcs/h`;
    const byRate = bn.trig !== 'gap', byGap = bn.trig !== 'rate';
    const n1 = isFinite(bn.need) ? (byRate ? ` (cần ${r(bn.need)} để đạt target)` : ` (vẫn đạt nhịp cần ${r(bn.need)})`) : '', n2 = isFinite(bn.need) ? (byRate ? ` (need ${r(bn.need)} for target)` : ` (still meets required ${r(bn.need)})`) : '';
    const g1 = byGap ? `, SL thấp hơn CĐ ${bn.prevOp} ${r(bn.gap * 100)}% (hàng dồn)` : '', g2 = byGap ? `, output ${r(bn.gap * 100)}% below op ${bn.prevOp} (WIP piling up)` : '';
    const c1 = bn.why.kind === 'people' ? `thiếu người, cần thêm ~${(Math.ceil(bn.why.add * 10) / 10).toLocaleString('vi-VN')} người quy đổi`
      : bn.why.emp ? `tay nghề, %EFF thấp nhất: ${bn.why.name || bn.why.emp} ${r(bn.why.eff * 100)}%` : 'tay nghề';
    const c2 = bn.why.kind === 'people' ? `short of people, add ~${Math.ceil(bn.why.add * 10) / 10} FTE`
      : bn.why.emp ? `skill, lowest %EFF: ${bn.why.name || bn.why.emp} ${r(bn.why.eff * 100)}%` : 'skill';
    notes.push(W(`${b1}${n1}${g1} → ${c1}.`, `${b2}${n2}${g2} → ${c2}.`));
  }
  ops.filter(o => o.status === 'skill').forEach(o => notes.push(W(
    `Phụ thuộc tay nghề CĐ ${o.op} ${o.name}: %EFF công đoạn ${Math.round(o.load * 100)}%, ${o.people} người → 1 người vắng / chậm sẽ thành tắc nghẽn.`,
    `Skill-dependent op ${o.op} ${o.name}: op %EFF ${Math.round(o.load * 100)}%, ${o.people} operator(s) → one absent / slow makes it a bottleneck.`)));

  // Sản lượng ra chuyền theo giờ đồng hồ (từ đầu ca), kế hoạch / giờ
  const nH = Math.ceil((Wc.e - Wc.s) / 3600), hourly = styles.map(() => new Array(nH).fill(0));
  styles.forEach((s, k) => {
    const lst = ops.find(o => o.style === s.style && codeKey(o.op) === codeKey(cfg.ops.last));
    if (lst) lst.perMin.forEach((q, m) => { if (q) hourly[k][Math.min(nH - 1, Math.floor((Wc.unwork(m * 60 + 30) - Wc.s) / 3600))] += q; });
  });
  const planPerMin = totalMin > 0 ? planEM / totalMin : 0;

  // Trạng thái chuyền
  const now = isFinite(opt.now) ? opt.now : isFinite(opt.until) ? opt.until : dataAt, why = [];
  const lastOut = Math.max(-Infinity, ...ops.filter(o => codeKey(o.op) === codeKey(cfg.ops.last)).map(o => o.lastAdd));
  let state = 'green';
  if (!isFinite(dataAt)) { state = 'gray'; why.push(W('Chưa có dữ liệu trong ngày.', 'No data for today yet.')); }
  else if (now - dataAt >= st.staleMin * 60) { state = 'gray'; why.push(W(`Dữ liệu cũ: mới nhất lúc ${hhmm(dataAt)}.`, `Stale data: latest at ${hhmm(dataAt)}.`)); }
  else if (dataW < st.warmupMin * 60) { state = 'start'; why.push(W('Đang khởi động chuyền (chưa đủ 1 giờ dữ liệu).', 'Line warming up (less than 1 hour of data).')); }
  else {
    const red = [], yel = [], pu = isFinite(st.purple) ? st.purple : 1.1;
    // Màu chuyền theo OAS: chỉ do tiến độ (Actual SAH ÷ Accumulate target); các cảnh báo khác (ngừng, thiếu người…) vẫn liệt kê ở "why" nhưng không đổi màu
    state = !isFinite(progress) ? 'gray' : progress < st.red ? 'red' : progress < st.green ? 'yellow' : progress < pu ? 'green' : 'purple';
    if (progress < st.red) red.push(W(`Tiến độ ${Math.round(progress * 100)}% (< ${Math.round(st.red * 100)}%).`, `Progress ${Math.round(progress * 100)}% (< ${Math.round(st.red * 100)}%).`));
    else if (progress < st.green) yel.push(W(`Tiến độ ${Math.round(progress * 100)}% (< ${Math.round(st.green * 100)}%).`, `Progress ${Math.round(progress * 100)}% (< ${Math.round(st.green * 100)}%).`));
    else if (progress >= pu) why.push(W(`Tiến độ ${Math.round(progress * 100)}% (≥ ${Math.round(pu * 100)}%): vượt kế hoạch.`, `Progress ${Math.round(progress * 100)}% (≥ ${Math.round(pu * 100)}%): above plan.`));
    if (!isFinite(lastOut) || dataAt - lastOut >= st.stallMin * 60) red.push(W(`Không có hàng ra chuyền từ ${isFinite(lastOut) ? hhmm(lastOut) : 'đầu ca'}.`, `No output since ${isFinite(lastOut) ? hhmm(lastOut) : 'shift start'}.`));
    if (inLine.length < cfg.people * (1 - st.shortPeople)) red.push(W(`Thiếu người: ${inLine.length}/${cfg.people}.`, `Short of people: ${inLine.length}/${cfg.people}.`));
    const stl = ops.filter(o => o.stalled && o.kind === 'line');
    if (stl.length) yel.push(W(`Công đoạn ngừng: ${stl.map(o => o.op).join(', ')}.`, `Stopped operations: ${stl.map(o => o.op).join(', ')}.`));
    if (eff < cfg.effTarget * factor) yel.push(W(`Hiệu suất ${Math.round(eff * 100)}% (< ${Math.round(cfg.effTarget * factor * 100)}%).`, `Efficiency ${Math.round(eff * 100)}% (< ${Math.round(cfg.effTarget * factor * 100)}%).`));
    why.push(...red, ...yel);
  }

  return {
    formulaErr: FS.err,
    group: cfg.group || E.group, date, exportAt: E.exportAt, dataAt, workMin, totalMin, state, why, notes, warnings: warn,
    people: effPeople, effBasis: byTc ? 'oas' : byMain ? 'main' : 'line', mainAuto, mainOps: byMain ? [...new Set(mainT.map(t => t.op))].sort((a, b) => (+a || 0) - (+b || 0)) : [], onStdHours, nonCmHours, offStdHours, peoplePlan: cfg.people, tapPeople: tapOnly.length, earned, eff, effTarget: cfg.effTarget * factor, factor, wGreen: st.wGreen, wYellow: st.wYellow, wCut: [st.wRed, st.wYel, st.wBlue],
    sah: earned / 60, workHours, outSAH: outEM / 60, planSAH: planEM / 60, planNowSAH: planNow / 60,
    outEM, planEM, planNow, progress, forecast, styles, orders, orderPhase, ops, bottleneck: bn ? bn.key : null, oldStyles, workers, hourly, planPerMin,
    ctBottleneck: ctBn ? ctBn.key : null, lbr, lbrSam, lbrN: ctOps.length,
    excluded: T.filter(t => t.kind === 'exclude').reduce((a, t) => a + t.qty, 0),
    carry: T.filter(t => t.carry && t.kind !== 'exclude').reduce((a, t) => a + t.qty, 0),
  };
}

// Gán công nhân vào trạm layout (3D). ETS không ghi số trạm nên: gán tay (manual) trước,
// còn lại tự gán người trong chuyền vào trạm cùng công đoạn chính, người sản lượng cao vào trạm số nhỏ trước.
// stations = layout [{ ban, code }], workers = lineStatus().workers, manual = { ban: emp | '-' (để trống) },
// away = [emp] người đã đặt ra ngoài (kéo thả trên 3D), không tự gán
// opt.extra: người dư (công đoạn chính có trạm trên layout nhưng hết chỗ) → trạm phụ ngay sau trạm cuối của công đoạn đó
//   { ban: trạm neo + 0,1 / 0,2…, code: công đoạn chính, extra: true, anchorBan, … máy / vị trí như trạm neo }
// → { byBan: { ban: { emp, auto } }, free: [emp chưa có trạm], extras: [trạm phụ] }
// opt.extra: người dư → trạm phụ; opt.tap: người chỉ làm tập (ngoài chuyền) cũng được gán (trạm đầu chuyền, head)
function assignStations(stations, workers, manual, away, opt) {
  manual = manual || {};
  const byBan = {}, used = new Set(), list = (stations || []).filter(s => s.ban > 0).slice().sort((a, b) => a.ban - b.ban);
  const empty = new Set();
  list.forEach(s => {
    const e = String(manual[s.ban] == null ? '' : manual[s.ban]).trim();
    if (e === '-') empty.add(s.ban); else if (e) { byBan[s.ban] = { emp: e, auto: false }; used.add(e); }
  });
  const out = new Set((away || []).map(String).filter(e => !used.has(e)));
  const pool = (workers || []).filter(w => (w.inLine || (opt && opt.tap && (w.kinds || []).includes('tap'))) && !used.has(String(w.emp))).sort((a, b) => b.primaryQty - a.primaryQty);
  out.forEach(e => used.add(e));
  list.forEach(s => {
    if (byBan[s.ban] || empty.has(s.ban)) return;
    const w = pool.find(x => !used.has(String(x.emp)) && x.primary && codeMatch(s.code, x.primary));
    if (w) { byBan[s.ban] = { emp: String(w.emp), auto: true }; used.add(String(w.emp)); }
  });
  const extras = [];
  if (opt && opt.extra) pool.filter(w => !used.has(String(w.emp)) && w.primary).forEach(w => {
    const an0 = list.filter(s => !s.head && codeMatch(s.code, w.primary));   // trạm đầu chuyền (làm tập) không thêm trạm phụ
    if (!an0.length) return;                                  // công đoạn không có trên layout: để ngoài chuyền
    const an = an0.some(s => !s.layoutCode) ? an0.filter(s => !s.layoutCode) : an0;   // neo ở trạm có CĐ gốc theo layout (không lấy trạm đã đổi tay)
    const a = an.reduce((m, s) => (s.ban > m.ban ? s : m)), k = extras.filter(x => x.anchorBan === a.ban).length + 1;
    const x = Object.assign({}, a, { ban: Math.round((a.ban + k / 10) * 10) / 10, code: w.primary, extra: true, anchorBan: a.ban });
    extras.push(x); byBan[x.ban] = { emp: String(w.emp), auto: true }; used.add(String(w.emp));
  });
  const onSt = new Set(Object.values(byBan).map(x => x.emp));
  return { byBan, extras, free: pool.filter(w => !onSt.has(String(w.emp))).map(w => String(w.emp)) };   // free gồm cả người đặt ra ngoài
}

// Cân bằng chuyền (Yamazumi, 09/10): mỗi cụm công đoạn chuyền có SAM = 1 cột, cao = SAM ÷ người quy đổi (phút chuẩn / sp / người).
// takt = phút làm cả ngày ÷ target cả ngày; giới hạn = takt × hiệu suất mục tiêu (đã nhân đường cong học, L.effTarget).
// Người cần = SAM ÷ giới hạn; chênh = người quy đổi − người cần (âm = thiếu). Mức: bad > giới hạn +3%, near ±3%, low < 70% giới hạn (dư người).
// Nhiều mã cùng mã công đoạn: gộp, SAM bình quân theo sản lượng. LBR = Σ cột ÷ (số cột × cột cao nhất).
function lineBalance(L) {
  const tgt = (L.styles || []).reduce((a, s) => a + (s.target || 0), 0), takt = tgt > 0 ? L.totalMin / tgt : NaN, lim = takt * L.effTarget;
  const m = new Map();
  (L.ops || []).filter(o => o.kind === 'line' && o.sam > 0 && o.qty > 0).forEach(o => {
    const k = codeKey(o.op), x = m.get(k) || (m.set(k, { op: o.op, name: o.name, keys: [], sq: 0, qty: 0, fte: 0 }), m.get(k));
    x.keys.push(o.key); x.sq += o.sam * o.qty; x.qty += o.qty; x.fte += o.fte; if (!x.name) x.name = o.name;
  });
  const items = [...m.values()].map(x => {
    const sam = x.sq / x.qty, wl = x.fte > 0 ? sam / x.fte : NaN, need = lim > 0 ? sam / lim : NaN;
    const emps = (L.workers || []).filter(w => w.inLine && w.byOp && Object.keys(w.byOp).some(op => codeKey(op) === codeKey(x.op))).map(w => w.emp);
    const lv = !isFinite(wl) || !(lim > 0) ? 'na' : wl > lim * 1.03 ? 'bad' : wl >= lim * 0.97 ? 'near' : wl < lim * 0.7 ? 'low' : 'ok';
    return { op: x.op, name: x.name, keys: x.keys, sam, fte: x.fte, people: emps.length, emps, wl, need, diff: x.fte - need, lv };
  });
  const ok = items.filter(x => isFinite(x.wl)), mx = ok.reduce((a, x) => Math.max(a, x.wl), 0);
  return { takt, lim, effTarget: L.effTarget, target: tgt, items, lbr: ok.length && mx > 0 ? ok.reduce((a, x) => a + x.wl, 0) / (ok.length * mx) : NaN };
}

// Xếp trạm theo người dập thẻ (quản lý tự cân bằng chuyền): giữ thứ tự công đoạn theo layout IE (đường chữ U),
// bỏ công đoạn làm ngoài chuyền (skip, VD tập 34, 40 → cụm đầu chuyền); mỗi công đoạn chiếm số trạm = số người có công đoạn chính đó
// (0 người → giữ 1 trạm trống). Vị trí trạm (dòng / cột) giữ theo layout, đủ số trạm layout (chuyền dài cố định):
// thừa trạm → trạm cuối trống (blank); thiếu trạm → bớt ở công đoạn đông người nhất, người dư thành trạm phụ (assignStations extra).
function autoStations(stations, workers, skip) {
  const list = (stations || []).filter(s => s.ban > 0).slice().sort((a, b) => a.ban - b.ban);
  const seq = [];
  list.forEach(s => { if (s.code && !(skip || []).some(k => codeMatch(s.code, k)) && !seq.some(x => codeKey(x.t.code) === codeKey(s.code))) seq.push({ t: s, n: 0 }); });
  (workers || []).filter(w => w.inLine && w.primary).forEach(w => { const x = seq.find(x => codeMatch(x.t.code, w.primary)); if (x) x.n++; });
  seq.forEach(x => { x.n = Math.max(1, x.n); });
  for (let tot = seq.reduce((a, x) => a + x.n, 0); tot > list.length; tot--) {
    const x = seq.reduce((m, y) => (y.n > m.n ? y : m), seq[0]); if (!x || x.n <= 1) break; x.n--;
  }
  const tpl = []; seq.forEach(x => { for (let i = 0; i < x.n; i++) tpl.push(x.t); });
  return list.map((s, i) => tpl[i] ? Object.assign({}, tpl[i], { ban: s.ban, row: s.row, col: s.col })
    : Object.assign({}, s, { code: '', name: '', blank: true }));
}

const PT = { GROUPS, norm, num, groupOf, equipName, equipCode, classify, defaultPick, parseSam, parseLayout, parseFin, buildStyle, analyze, banRange,
  codeKey, styleCore, codeMatch, clockSec, hhmm, parseEts, workClock, etsCodes, buildReplay,
  DEFAULT_LINE, lineConfig, workDayNo, garmentColor, parseBulletin, parseHc, parseEffCsv, parseSahTarget, xlDate, isNewHire, learnFactor, lineStatus, lineBalance, assignStations, autoStations, compileExpr, FORMULAS, FORMULA_VARS, FV_SHORT, formulaSet };
if (typeof module !== 'undefined' && module.exports) module.exports = PT;
else root.PT = PT;
})(this);
