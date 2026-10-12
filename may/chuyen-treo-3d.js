// 3D chuyền treo tự động (hanger line) dựng từ sheet Layout chuyền treo (VD "Layout Auto" 346N392).
// Nhiều chuyền trong 1 nhà xưởng (dùng chung MoHinh3D.buildHall với chuyen-may.html), chuyền đặt song song, chuyền đầu bên trái.
// Chỉ vẽ: không tính toán, trang gọi update() với trạng thái từng trạm.
// Cần THREE (r128) + THREE.OrbitControls; MoHinh3D (mo-hinh-3d.js) để có nhà xưởng + mô hình chi tiết; Lite3D (lib/lite.js) nếu có.
// Dùng: const V = ChuyenTreo3D.create(div, { onHover, onDrop, onLabel, onPick });
//       V.setLines([{ id: '201S01', stations }, …]);  V.update(id, { stations, free, speed, running, sign, garment (màu áo, số hex) });
//       V.view('all' | 'line' | 'top', id?, smooth);  V.focus(id, ban, smooth);  V.dispose();
// Đối tượng trả về trong callback có .line = mã chuyền.
(function (root) {
'use strict';

const P = 1.35;            // khoảng cách 2 trạm dọc chuyền (m)
const RX = 0.75;           // nửa khoảng cách 2 nhánh ray chính (m), cũng là bán kính 2 đầu vòng ray
const SX = 2.05;           // tâm bàn trạm cách trục chuyền (m)
const AX = SX + 1.6;       // vạch lối đi cách trục chuyền (m)
const OX = 1.8;            // hàng ngoài (trạm phụ) cách hàng trạm chính (m); bên có trạm phụ thì vạch lối đi lùi ra thêm OX
const RAIL_Y = 2.25;       // độ cao ray (m)
const LABEL_Y = 3.1;       // độ cao hàng nhãn trên đầu (m), mọi trạm cùng 1 hàng
const LINE_GAP = 11;       // khoảng cách trục 2 chuyền cạnh nhau khi không có trạm phụ (m): lối đi giữa ≈ 3,7 m
const WALK = 2.5;          // lối đi bao quanh khu chuyền (m)
const HALL_H = 9;          // chiều cao nhà xưởng (m), như chuyen-may.html
const FAR_D = 45, NEAR_D = 18;                      // m: xa hơn FAR_D = toàn cảnh (chế độ smart chỉ hiện 1 chấm / chuyền); gần hơn NEAR_D mới hiện dấu từng công nhân
const BROKEN_COL = 0x7b3fb5;                       // máy hỏng (tím)
const PROB_COL = { bn: 0xc63a2f, skill: 0xe8742a, stall: 0x39424f };   // màu cột báo cụm công đoạn có vấn đề (như màu trạng thái)
const SEV = { bn: 6, skill: 5, stall: 4, near: 3, ok: 2, start: 1, none: 0 };   // mức nặng khi cụm công đoạn có nhiều trạng thái
const COLORS = { bn: 0xc63a2f, skill: 0xe8742a, stall: 0x39424f, near: 0xd39a12, ok: 0x2e9a66, start: 0x2391b5, none: 0x9aa3b1 };

function create(el, opt) {
  opt = opt || {};
  const THREE = root.THREE;
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
  const lv = root.Lite3D ? root.Lite3D.level : 'high', lite = lv !== 'high';
  // Theo mức: giới hạn khung/s (ms giữa 2 khung), khoảng cách chuyển sang khối đơn giản (LOD, m), nhãn ẩn khi xa (m, chỉ mức thấp)
  const CAP_MS = lv === 'low' ? 50 : lv === 'mid' ? 30 : 0, LOD_D = lv === 'low' ? 22 : lv === 'mid' ? 60 : Infinity, LABEL_D = lv === 'low' ? 32 : Infinity;
  const MH = root.MoHinh3D || null;

  // ---------- Cảnh, camera, đèn (như chuyen-may.html) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: !lite });
  renderer.setPixelRatio(lv === 'low' ? 0.75 : lite ? 1 : Math.min(root.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = !lite;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 500);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.45;   // không hạ camera sát mặt phẳng nhìn (tối thiểu ~9° so với đích) controls.minDistance = 3; controls.maxDistance = 140;
  scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x5f6b66, 0.5));
  const sun = new THREE.DirectionalLight(0xfffaf0, 0.55);
  sun.position.set(12, 40, 20); sun.castShadow = !lite; sun.shadow.mapSize.set(lite ? 1024 : 2048, lite ? 1024 : 2048);
  scene.add(sun, sun.target);

  // Tài nguyên cần dispose
  const res = [];
  const keep = o => { res.push(o); return o; };
  const mat = (c, o) => keep(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o || {})));
  const M = {
    floor: mat(0xc2c9c5, { roughness: 0.6 }), rail: mat(0x8f99a8, { metalness: 0.6, roughness: 0.35 }),
    leg: mat(0x6f7886, { metalness: 0.4, roughness: 0.5 }), machine: mat(0xeef1f5, { roughness: 0.4 }), head: mat(0xd9b38c),
    shirt: mat(0x2b4f9c), hook: mat(0x5d6573, { metalness: 0.5 }), cloth: mat(0x6f8fd0, { roughness: 0.9 }), marker: mat(0xc63a2f, { emissive: 0x5a0d08 }),
  };
  const G = {
    box: keep(new THREE.BoxGeometry(1, 1, 1)), cyl: keep(new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
    sph: keep(new THREE.SphereGeometry(0.5, 16, 12)), cone: keep(new THREE.ConeGeometry(0.22, 0.45, 16)),
    tag: keep(new THREE.PlaneGeometry(1.25, 0.55)), plane: keep(new THREE.PlaneGeometry(1, 1)),
  };
  const hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }));

  const lines = [];                              // [{ id, x, g, stations, zMax, railLen, carriers, marker, freeGroup, freeMap, sign, lastS, key }]
  let hallGroup = null, roof = [], roofOn = null, fallbackFloor = null, hallBox = null;
  const applyTheme = () => {
    scene.background = new THREE.Color(dark() ? 0x111822 : 0xdbe2ec);
    lines.forEach(L => { L.stations.forEach(o => { if (o.tag) o.tag.userData.key = ''; }); if (L.lastS) update(L.id, L.lastS); });
  };
  applyTheme();

  // Ánh sáng phản chiếu kiểu nhà xưởng (đèn trần + cửa sổ) cho bề mặt kim loại, nhựa (giống chuyen-may.html)
  if (MH) {
    const pmg = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.BoxGeometry(80, 16, 60), new THREE.MeshBasicMaterial({ color: 0x7f878f, side: THREE.BackSide })));
    const lm = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    for (let x = -30; x <= 30; x += 10) for (let z = -20; z <= 20; z += 8) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), lm); p.rotation.x = Math.PI / 2; p.position.set(x, 7.8, z); es.add(p);
    }
    scene.environment = keep(pmg.fromScene(es, 0.04).texture); pmg.dispose();
    es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }
  const seeded = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const labelCache = new Map();

  // Trạm chi tiết: máy theo loại (layout), người ngồi phía ngoài quay mặt vào ray (trạm treo hàng / kiểm: đứng)
  function buildDetailed(g, t, side) {
    const PT = root.PT;
    const equip = PT ? PT.equipName(t.equipType, t.name) : (t.equipType || '');
    let kind = MH.equipKind({ equip, name: t.name, group: '' });
    if (kind === 'iron' || kind === 'vacuum') kind = 'table';
    // Đứng: treo hàng đầu chuyền, kiểm (không lấy chữ "treo" giữa tên, VD "Ghim dây treo vào thân")
    const nm = PT ? PT.norm(t.name) : String(t.name || '').toLowerCase();
    const standing = kind === 'rack' || /^treo hang|dau chuyen|^kiem|^check/.test(nm);
    if (kind === 'rack') kind = 'table';
    // Hệ trục trạm (chuyen-may.html): người ở −z quay về +z → xoay để +z hướng vào trục chuyền
    const unit = new THREE.Group(); unit.rotation.y = -side * Math.PI / 2; g.add(unit);
    const stn = MH.makeStation(kind, { equip, name: t.name }, standing, 'ao'); unit.add(stn);
    g.userData.piece = stn.userData.piece || null;   // mảnh vải trên bàn: tô theo màu áo của đơn
    const seed = Math.round(t.ban * 13) + 7;
    const w = MH.makeWorker({ female: seeded(seed) < 0.65, color: MH.pick3([0x2b4f9c, 0x35599f, 0x24467f], seeded(seed + 5)), seated: !standing, seed });
    w.position.set(0, 0, -0.62); unit.add(w);
    MH.pose(w, true);
    g.userData.worker = w;
    // LOD: khi camera xa chỉ ẩn 2 tay (xem lodPass); người, bàn, máy giữ nguyên hình
    if (LOD_D < Infinity) g.userData.lod = { w };

  }
  // Trạm đơn giản (khi không có mo-hinh-3d.js)
  function buildSimple(g, t, side) {
    const top = new THREE.Mesh(G.box, M.machine); top.scale.set(0.9, 0.06, 1.05); top.position.y = 0.76; top.castShadow = top.receiveShadow = true; g.add(top);
    [[-0.38, -0.45], [0.38, -0.45], [-0.38, 0.45], [0.38, 0.45]].forEach(([x, zz]) => {
      const l = new THREE.Mesh(G.box, M.leg); l.scale.set(0.05, 0.74, 0.05); l.position.set(x, 0.37, zz); g.add(l);
    });
    if (!/^hw$/i.test(t.equipType || '')) {
      const mc = new THREE.Mesh(G.box, M.leg); mc.scale.set(0.42, 0.28, 0.2); mc.position.set(-side * 0.05, 0.93, 0); mc.castShadow = true; g.add(mc);
    }
    const body = new THREE.Mesh(G.cyl, M.shirt); body.scale.set(0.36, 0.62, 0.26); body.position.set(side * 0.78, 0.98, 0); body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(G.sph, M.head); head.scale.setScalar(0.22); head.position.set(side * 0.78, 1.42, 0); head.castShadow = true; g.add(head);
  }

  // ---------- Đường ray chính 1 chuyền (tọa độ trong nhóm chuyền): 2 nhánh thẳng + 2 nửa vòng tròn ở 2 đầu ----------
  // d = quãng đường từ đầu chuyền (trạm 1, bên phải, đáy chữ U) đi lên → vòng đầu kín → đi xuống bên trái → vòng về
  function railPoint(L, d, out) {
    const Z = L.zMax, A = Math.PI * RX;
    d = ((d % L.railLen) + L.railLen) % L.railLen;
    if (d < Z) return out.set(RX, RAIL_Y, Z - d);                                   // bên phải: z từ Z về 0
    d -= Z;
    if (d < A) { const a = d / RX; return out.set(RX * Math.cos(a), RAIL_Y, -RX * Math.sin(a)); }   // vòng đầu kín (z < 0)
    d -= A;
    if (d < Z) return out.set(-RX, RAIL_Y, d);                                      // bên trái: z từ 0 về Z
    d -= Z;
    const a = d / RX; return out.set(-RX * Math.cos(a), RAIL_Y, Z + RX * Math.sin(a));             // vòng đáy (trạm 1 / cuối)
  }

  // Nhãn chữ (canvas → sprite), dùng lại texture khi chữ không đổi
  // dot: màu chấm nhỏ góc trái (đơn cũ / mới khi đang chuyển đơn), không có thì bỏ
  // lines2 = [tiêu đề, dòng dưới, chữ nhỏ cạnh tiêu đề (VD "SAM 0,342")]
  function label(lines2, color, dot) {
    const key = lines2.join('|') + color + (dot || '');
    if (labelCache.has(key)) return labelCache.get(key);
    const c = document.createElement('canvas'); c.width = 320; c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.strokeStyle = color; g.lineWidth = 3;
    g.beginPath(); if (g.roundRect) g.roundRect(2, 2, 316, 116, 10); else g.rect(2, 2, 316, 116); g.fill(); g.stroke();
    if (dot) { g.fillStyle = dot; g.beginPath(); g.arc(26, 26, 14, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke(); }
    g.fillStyle = '#162033'; g.textAlign = 'center';
    const ex = lines2[2] || '', F1 = px => `700 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`, F2 = '600 24px "Be Vietnam Pro", system-ui, sans-serif';
    if (!ex) { g.font = F1(44); g.fillText(lines2[0], 160, 52); }
    else {                                      // tiêu đề + chữ nhỏ, canh giữa cả cụm; quá rộng thì thu nhỏ tiêu đề
      g.font = F2; const w2 = g.measureText(ex).width; let px = 44, w1;
      do { g.font = F1(px); w1 = g.measureText(lines2[0]).width; } while (w1 + 10 + w2 > 296 && --px > 28);
      const x0 = 160 - (w1 + 10 + w2) / 2; g.textAlign = 'left';
      g.fillText(lines2[0], x0, 52); g.font = F2; g.fillStyle = '#2361a8'; g.fillText(ex, x0 + w1 + 10, 50);
      g.fillStyle = '#162033'; g.textAlign = 'center';
    }
    g.font = '500 26px "Be Vietnam Pro", system-ui, sans-serif';
    let t = lines2[1] || ''; while (t.length > 3 && g.measureText(t).width > 296) t = t.slice(0, -2);
    if (t !== (lines2[1] || '')) t += '…';
    g.fillText(t, 160, 94);
    const tex = keep(new THREE.CanvasTexture(c));
    const m = keep(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    labelCache.set(key, m);
    return m;
  }

  // Bảng tên chuyền (09/10: treo trên đầu chuyền). s = { title (mã chuyền), state (chữ trạng thái, bên phải), color,
  //   lines: [{ k (nhãn mờ), v (đơn: style · màu), vc (màu chữ v), t (giờ, mờ) }] 1–4 dòng, change: đang chuyển đơn (viền vàng) }; kiểu cũ { title, sub } vẫn dùng được
  function signSprite() {
    const c = document.createElement("canvas"); c.width = 640; c.height = 440;
    const tex = keep(new THREE.CanvasTexture(c)); tex.anisotropy = 8;
    const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: tex, depthWrite: false })));
    sp.scale.set(4.2, 4.2 * 440 / 640, 1); sp.renderOrder = 3; sp.userData = { c, tex, key: "" };
    return sp;
  }
  function drawSign(sp, s) {
    const lines = s.lines || (s.sub ? [{ v: s.sub }] : []);
    const key = JSON.stringify([s.title, s.state, s.color, s.change, lines]);
    if (sp.userData.key === key) return; sp.userData.key = key;
    const { c, tex } = sp.userData, g = c.getContext("2d"), H = 128 + 52 * Math.max(1, lines.length);
    g.clearRect(0, 0, c.width, c.height);
    const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
    const col = s.color || "#9aa3b1", edge = s.change ? "#d39a12" : col;
    g.fillStyle = "#ffffff"; rr(4, 4, 632, H - 8, 16); g.fill();
    g.fillStyle = col; rr(4, 4, 632, 22, [16, 16, 0, 0]); g.fill();
    g.lineWidth = s.change ? 8 : 4; g.strokeStyle = edge; rr(4, 4, 632, H - 8, 16); g.stroke();
    g.textBaseline = "middle"; g.textAlign = "left"; g.fillStyle = "#162033";
    g.font = "700 76px \"Barlow Condensed\", \"Arial Narrow\", sans-serif"; g.fillText(s.title || "", 26, 76);
    if (s.state) { g.textAlign = "right"; g.fillStyle = s.change ? "#a8720a" : col; g.font = "700 34px \"Barlow Condensed\", \"Arial Narrow\", sans-serif"; g.fillText(s.state, 614, 78); }
    lines.forEach((x, i) => {
      const y = 152 + i * 52; let xx = 26;
      g.textAlign = "left";
      if (x.k) { g.fillStyle = "#7a8596"; g.font = "600 26px \"Be Vietnam Pro\", system-ui, sans-serif"; g.fillText(x.k, xx, y); xx += g.measureText(x.k).width + 12; }
      const tt = x.t || ""; g.font = "600 26px \"JetBrains Mono\", monospace"; const wt = tt ? g.measureText(tt).width + 14 : 0;
      g.fillStyle = x.vc || "#162033"; g.font = "700 34px \"Be Vietnam Pro\", system-ui, sans-serif";
      let v = x.v || ""; while (v.length > 3 && g.measureText(v).width > 614 - xx - wt) v = v.slice(0, -2);
      if (v !== (x.v || "")) v += "…";
      g.fillText(v, xx, y);
      if (tt) { g.textAlign = "right"; g.fillStyle = "#7a8596"; g.font = "600 26px \"JetBrains Mono\", monospace"; g.fillText(tt, 614, y + 2); }
    });
    // chỉ hiện phần đã vẽ (H px trên cùng của canvas cao 440), đúng tỉ lệ chữ
    sp.scale.set(4.2, 4.2 * H / 640, 1); tex.repeat.set(1, H / c.height); tex.offset.set(0, 1 - H / c.height);
    tex.needsUpdate = true;
  }

  // Công nhân %EFF dưới ngưỡng đỏ (x.tag.low): dấu "!" đỏ trên đầu người (như biểu tượng máy hỏng), luôn hiện, nhỏ (to dần rất ít khi camera ra xa), không nhấp nháy
  let lowMat = null;
  function lowGlow(o, on) {
    if (on && !o.lw) {
      if (!lowMat) {
        const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
        g.fillStyle = '#e0281c'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
        g.fillStyle = '#fff'; g.fillRect(55, 24, 18, 52); g.beginPath(); g.arc(64, 94, 11, 0, 7); g.fill();
        lowMat = keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthTest: false }));
      }
      o.lw = new THREE.Sprite(lowMat.clone()); o.lw.renderOrder = 7; o.lw.position.set((o.side || 0) * 0.3, 2.05, 0); o.g.add(o.lw);
    }
    if (o.lw) o.lw.visible = !!on;
  }
  // Thẻ sản lượng nằm trên sàn phía lối đi (giống chuyen-may.html)
  function floorTag() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 112;
    const tex = keep(new THREE.CanvasTexture(c)); tex.anisotropy = 8;
    const m = new THREE.Mesh(G.tag, keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.PI / 2, 0); m.renderOrder = 2; m.userData = { c, tex, key: '' };
    return m;
  }
  // lines = ['1.234 sp', '120/h · 95%'], color = viền (CSS)
  // eff = { txt, color }: chữ %EFF nối sau dòng 2, tô màu riêng (ngưỡng %EFF công nhân); badge = chữ nhỏ góc trên phải (VD "MỚI": CN mới)
  function drawTag(m, txt, color, eff, badge) {
    const d = dark(), key = txt.join('|') + color + d + (eff ? eff.txt + eff.color : '') + (badge || '');
    if (m.userData.key === key) return; m.userData.key = key;
    const { c, tex } = m.userData, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = d ? 'rgba(21,28,39,.9)' : 'rgba(255,255,255,.92)';
    g.beginPath(); if (g.roundRect) g.roundRect(4, 4, c.width - 8, c.height - 8, 12); else g.rect(4, 4, c.width - 8, c.height - 8); g.fill();
    g.lineWidth = 5; g.strokeStyle = color; g.stroke();
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = d ? '#e5eaf2' : '#162033'; g.font = '700 50px "Barlow Condensed", "Arial Narrow", sans-serif';
    // có dấu (badge): dấu bên phải dòng 1, số sản lượng canh giữa phần còn lại
    let bw = 0;
    if (badge) { g.font = '800 30px "Barlow Condensed", "Arial Narrow", sans-serif'; bw = g.measureText(badge).width + 16; }
    g.font = '700 50px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.fillText(txt[0] || '', bw ? (c.width - bw - 14) / 2 + 4 : c.width / 2, 42);
    g.fillStyle = d ? '#93a0b3' : '#5a6679'; g.font = '600 24px "JetBrains Mono", monospace';
    if (eff) {                                   // "783/h · " xám + "85%" đậm, màu theo ngưỡng; cả cụm canh giữa
      const a = txt[1] || '', wa = g.measureText(a).width;
      g.font = '800 28px "JetBrains Mono", monospace';
      const wb = g.measureText(eff.txt).width, x0 = (c.width - wa - wb) / 2;
      g.textAlign = 'left'; g.fillStyle = eff.color; g.fillText(eff.txt, x0 + wa, 86);
      g.font = '600 24px "JetBrains Mono", monospace'; g.fillStyle = d ? '#93a0b3' : '#5a6679'; g.fillText(a, x0, 86);
    } else g.fillText(txt[1] || '', c.width / 2, 86);
    if (badge) {
      g.font = '800 30px "Barlow Condensed", "Arial Narrow", sans-serif';
      g.fillStyle = '#e8742a'; g.beginPath(); if (g.roundRect) g.roundRect(c.width - bw - 12, 22, bw, 40, 8); else g.rect(c.width - bw - 12, 22, bw, 40); g.fill();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(badge, c.width - 12 - bw / 2, 43);
    }
    tex.needsUpdate = true;
  }

  // ---------- Dựng 1 chuyền ----------
  // st = [{ ban, code, name, equipType, row, col }] (PT.parseLayout(...).tables)
  //      + trạm phụ { ban (VD 8.1), extra: true, anchorBan, col (= trạm neo) } khi công đoạn có nhiều người hơn số trạm layout
  function buildLine(id, st) {
    const L = { id, x: 0, g: new THREE.Group(), stations: [], zMax: P, railLen: 0, carriers: null, marks: [], broken: new Set(), pin: null, pinInfo: null,
      freeGroup: new THREE.Group(), freeMap: new Map(), sign: null, lastS: null };
    const all = (st || []).filter(t => t.ban > 0).sort((a, b) => a.ban - b.ban);
    const list = all.filter(t => !t.extra && !t.head), extras = all.filter(t => t.extra), heads = all.filter(t => t.head);
    // 2 bên chữ U theo cột Excel: bên có trạm 1 = bên phải
    const cols = [...new Set(list.map(t => t.col))];
    const s1 = list[0] ? list[0].col : cols[0];
    const sides = { R: list.filter(t => t.col === s1), L: list.filter(t => t.col !== s1) };
    // Dọc chuyền theo dòng Excel (dòng trên = đầu kín chữ U, z = 0)
    const rows = [...new Set(list.map(t => t.row))].sort((a, b) => a - b);
    const nRow = Math.max(sides.R.length, sides.L.length, 1);
    const zBase = t => { const k = rows.indexOf(t.row); return (rows.length > 1 ? k / (rows.length - 1) : 0) * (nRow - 1) * P; };
    // Trạm phụ: KHÔNG kéo dài chuyền (độ dài cố định theo layout, mọi chuyền đồng bộ) → đặt ở hàng ngoài, sát trạm neo;
    // nhiều trạm phụ cùng neo thì xếp tiếp theo chiều đi (bên phải z giảm, bên trái z tăng), tránh chỗ đã có
    const zMap = new Map(list.map(t => [t, zBase(t)]));
    L.zMax = Math.max(P, ...[...zMap.values()]);
    const used = new Set();
    extras.forEach(x => {
      const a = all.find(t => t.ban === x.anchorBan) || list[0]; if (!a) return;
      const right = a.col === s1, dir = right ? -1 : 1, ka = Math.round(zMap.get(a) / P), kMax = Math.round(L.zMax / P);
      let k = ka;
      for (let i = 0; i <= 2 * kMax + 1; i++) {
        const c = ka + (i % 2 ? Math.ceil(i / 2) : -i / 2) * dir;              // 0, +1, −1, +2, −2… theo chiều đi
        if (c >= 0 && c <= kMax && !used.has((right ? 'R' : 'L') + c)) { k = c; break; }
      }
      used.add((right ? 'R' : 'L') + k); zMap.set(x, k * P);
    });
    L.outR = extras.some(t => t.col === s1); L.outL = extras.some(t => t.col !== s1);
    sides.R.push(...extras.filter(t => t.col === s1)); sides.L.push(...extras.filter(t => t.col !== s1));
    // Trạm đầu chuyền (làm tập): ngoài khu chuyền, bên kia lối đi chính phía đầu chuyền, lưới 3 cột (ô đầu của cụm ngoài, xem outSlot);
    // người ngoài trạm xếp tiếp sau
    L.zEnd = L.zMax + RX + 1.2;                                             // mép trước khu chuyền (vạch lối đi chính)
    L.nHead = heads.length;
    const hx = new Map(), hs = heads.slice().sort((a, b) => opCmp(a.code, b.code) || a.ban - b.ban), hp = packSlots(hs.map(t => String(t.code)), 0);
    L.outStart = L.outN = hp.next;                                          // người ngoài trạm xếp từ ô này
    hs.forEach((t, i) => { const p = outSlot(L, hp.idx[i]); zMap.set(t, p.z); hx.set(t, p.x); (p.x >= 0 ? sides.R : sides.L).push(t); });
    L.railLen = 2 * L.zMax + 2 * Math.PI * RX;
    const g0 = L.g;

    // Ray chính (ống) + cột treo
    const pts = [], v = new THREE.Vector3();
    for (let d = 0; d <= L.railLen; d += 0.2) pts.push(railPoint(L, d, v).clone());
    g0.add(new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), Math.ceil(L.railLen * 4), 0.04, 6, true)), M.rail));
    for (let z = 0; z <= L.zMax + 0.01; z += P * 3) [-1, 1].forEach(s => {
      const m = new THREE.Mesh(G.box, M.leg); m.scale.set(0.05, 0.6, 0.05); m.position.set(s * RX, RAIL_Y + 0.3, z); g0.add(m);
    });

    g0.add(L.freeGroup);
    list.concat(extras, heads).forEach(t => {
      const side = sides.R.includes(t) ? 1 : -1, z = zMap.get(t), sx = t.head ? Math.abs(hx.get(t)) : SX + (t.extra ? OX : 0);
      const g = new THREE.Group(); g.position.set(side * sx, 0, z); g0.add(g);
      // Ô nền dưới trạm tô màu trạng thái
      const tile = new THREE.Mesh(G.box, keep(new THREE.MeshBasicMaterial({ color: COLORS.none, transparent: true, opacity: 0.6, depthWrite: false })));
      tile.scale.set(1.75, 0.01, 1.25); tile.position.set(side * 0.3, 0.012, 0); g.add(tile);
      // Khối chọn (không vẽ) để rê / bấm vào trạm
      const hit = new THREE.Mesh(G.box, hitMat); hit.scale.set(1.75, 1.6, 1.25); hit.position.set(side * 0.3, 0.8, 0); g.add(hit);
      if (MH) buildDetailed(g, t, side); else buildSimple(g, t, side);
      // Nhánh ray rẽ vào trạm (trạm đầu chuyền làm ngoài ray: không có)
      if (!t.head) {
        const a = new THREE.Vector3(side * RX, RAIL_Y, z - 0.42), b = new THREE.Vector3(side * (sx - 0.45), RAIL_Y - 0.1, z), c = new THREE.Vector3(side * RX, RAIL_Y, z + 0.42);
        g0.add(new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, b, c), 12, 0.025, 5, false)), M.rail));
      }
      // Nhãn
      const sp = new THREE.Sprite(label([t.extra ? t.anchorBan + '+' : t.head ? String(t.code) : String(t.ban), t.name || ''], '#9aa3b1'));
      sp.scale.set(1.28, 0.48, 1); sp.position.set(side * (sx + 0.2), LABEL_Y, z); g0.add(sp);
      // Thẻ sàn: giữa chỗ ngồi và vạch lối đi
      const tag = floorTag(); tag.position.set(side * (sx + 1.12), 0.016, z); tag.visible = false; g0.add(tag);
      // Khối chọn công nhân (kéo thả sang trạm khác / ra sàn)
      const whit = new THREE.Mesh(G.box, hitMat); whit.scale.set(0.8, 1.5, 0.9); whit.position.set(side * 0.62, 0.75, 0); g.add(whit);
      const o = { line: id, t, side, sx, z, g, tile, hit, whit, sp, tag, info: null, has: true, model: g.userData.worker || null, lod: g.userData.lod || null, far: false, piece: g.userData.piece || null };
      hit.userData.ref = whit.userData.ref = sp.userData.ref = o; L.stations.push(o);
    });

    // Khoanh vùng công đoạn (như chuyen-may.html): ô kẻ trên sàn bao các trạm liền nhau cùng mã công đoạn, màu theo trạng thái công đoạn
    L.groups = [];
    [1, -1].forEach(sd => {
      let cur = null;
      L.stations.filter(o => o.side === sd && !o.t.extra && !o.t.head && o.t.code != null && String(o.t.code) !== '').sort((a, b) => a.z - b.z).forEach(o => {
        const k = String(o.t.code);
        if (cur && cur.k === k && o.z - cur.z1 < P * 1.5) { cur.list.push(o); cur.z1 = o.z; return; }
        cur = { k, side: sd, sx: o.sx, list: [o], z0: o.z, z1: o.z }; L.groups.push(cur);
      });
    });
    L.groups.forEach(q => {
      q.mat = keep(new THREE.MeshBasicMaterial({ color: COLORS.none, transparent: true, depthWrite: false }));   // vẽ trước thẻ sàn (renderOrder 2): không che chữ trên thẻ
      // Cạnh ngoài sát vạch vàng lối đi (AX); bên có trạm phụ (hàng ngoài) thì dừng ở mép ô nền để không đè lên hàng ngoài
      const xIn = q.sx - 0.525, xOut = (q.side > 0 ? L.outR : L.outL) ? q.sx + 1.125 : AX - 0.06;
      const hx = (xOut - xIn) / 2, zA = q.z0 - 0.625 + 0.05, zB = q.z1 + 0.625 - 0.05, cx = q.side * (xIn + xOut) / 2, cz = (zA + zB) / 2, w = 0.07;
      const edge = (sw, sd2, x, z) => { const e = new THREE.Mesh(G.box, q.mat); e.scale.set(sw, 0.004, sd2); e.position.set(x, 0.02, z); e.renderOrder = 1; g0.add(e); };
      edge(2 * hx, w, cx, zA); edge(2 * hx, w, cx, zB); edge(w, zB - zA, cx - hx, cz); edge(w, zB - zA, cx + hx, cz);
    });

    // Cột báo công đoạn có vấn đề: mỗi cụm công đoạn tắc nghẽn / ngừng / phụ thuộc tay nghề 1 mũi tên đỏ / xám / cam trên đầu cụm (dựng khi cần, xem update)
    L.marks = [];
    // Bảng tên chuyền: treo cao phía đầu chuyền (09/10, trước ở đầu kín chữ U)
    L.sign = signSprite(); L.sign.position.set(0, 4.8, L.zMax + RX + 0.4); g0.add(L.sign);   // trên đáy chữ U (đầu chuyền), nhìn từ lối đi chính
    drawSign(L.sign, { title: id, sub: '', color: '#9aa3b1' });

    // Móc treo: InstancedMesh chạy trên ray chính
    const NC = Math.max(24, Math.round(L.railLen / 0.55));
    if (MH) {
      const gm = new THREE.InstancedMesh(keep(MH.garmentGeo('ao')), MH.MAT.matte, NC);
      gm.castShadow = !lite; gm.frustumCulled = false; g0.add(gm);
      L.carriers = { n: NC, gm, d: 0, gap: L.railLen / NC, speed: 0.25 };
    } else {
      const hook = new THREE.InstancedMesh(G.box, M.hook, NC), cloth = new THREE.InstancedMesh(G.box, M.cloth, NC);
      cloth.castShadow = !lite; hook.frustumCulled = cloth.frustumCulled = false;
      g0.add(hook, cloth);
      L.carriers = { n: NC, hook, cloth, d: 0, gap: L.railLen / NC, speed: 0.25 };
    }
    return L;
  }
  // Nửa bề rộng khu chuyền tới vạch lối đi (side 1 = bên phải +x, −1 = bên trái)
  const halfW = (L, side) => AX + ((side > 0 ? L.outR : L.outL) ? OX : 0);
  const xL = L => L.x - halfW(L, -1), xR = L => L.x + halfW(L, 1);
  // Chuyền ngoài cùng bên trái / phải (chuyền đầu danh sách đặt bên phải)
  const lineLeft = () => lines[lines.length - 1], lineRight = () => lines[0];
  function dropLine(L) {
    L.g.traverse(o => { if (o.isInstancedMesh && o.dispose) o.dispose(); });
    scene.remove(L.g);
  }

  // ---------- Nhà xưởng + vạch phân khu + mũi tên lối đi (dựng lại khi danh sách chuyền đổi) ----------
  function buildHallAll() {
    if (hallGroup) { scene.remove(hallGroup); hallGroup = null; }
    if (fallbackFloor) { scene.remove(fallbackFloor); fallbackFloor = null; }
    roof = []; roofOn = null;
    if (!lines.length) return;
    const x0 = xL(lineLeft()), x1 = xR(lineRight());
    const zz0 = -RX - 1.2, zz1 = Math.max(...lines.map(L => L.zEnd));
    const b = { minX: x0 - WALK, maxX: x1 + WALK, z0: zz0 - WALK, z1: zz1 + WALK };
    hallBox = { x0: b.minX - 6, x1: b.maxX + 6, z0: b.z0 - 6, z1: b.z1 + 6, front: zz1 + WALK / 2 };
    if (!MH || !MH.buildHall) {                  // không có mo-hinh-3d.js: chỉ có sàn
      fallbackFloor = new THREE.Mesh(G.plane, M.floor); fallbackFloor.rotation.x = -Math.PI / 2;
      fallbackFloor.scale.set(b.maxX - b.minX + 30, b.z1 - b.z0 + 40, 1); fallbackFloor.position.set((b.minX + b.maxX) / 2, 0, (b.z0 + b.z1) / 2);
      fallbackFloor.receiveShadow = true; scene.add(fallbackFloor);
      return;
    }
    hallGroup = new THREE.Group(); scene.add(hallGroup);
    // Khung vạch vàng mỗi chuyền = mép lối đi 2 bên + 2 đầu
    const zones = lines.map(L => [xL(L), xR(L), zz0, L.zEnd]);
    // Mũi tên vàng giữa lối đi: lối giữa 2 chuyền + 2 lối ngoài chạy về phía đầu chuyền (lối chính); lối chính chạy về cửa ra (+x)
    const arrows = [];
    const lanes = [(b.minX - 0.5 + x0) / 2];          // chính giữa lối đi: giữa 2 vạch vàng (khung ngoài và khung chuyền)
    for (let i = 0; i + 1 < lines.length; i++) lanes.push((xR(lines[i]) + xL(lines[i + 1])) / 2);
    lanes.push((x1 + b.maxX + 0.5) / 2);
    lanes.forEach(x => arrows.push([x, zz0 - 0.5, x, zz1 + 0.3]));
    const zf = (zz1 + b.z1 + 0.3) / 2;                // lối chính phía cửa ra: giữa vạch đáy khung chuyền và vạch khung ngoài
    arrows.push([b.minX + 1, zf, b.maxX - 1, zf]);
    // Đèn LED treo dọc chuyền, trên 2 dãy trạm (như chuyen-may.html: đèn chạy theo chuyền)
    const lampsZ = lines.flatMap(L => [-1, 1].map(s => [0.3, L.zMax, L.x + s * SX]));
    const r = MH.buildHall({ root: hallGroup, sun, b, height: HALL_H, zones, lampsZ, arrows, midCols: false, noStock: true });   // bỏ cột giữa nhà: chỗ cụm ngoài chuyền
    roof = r.roof;
    if (r.hall) { const h = r.hall; hallBox = Object.assign(hallBox, { x0: h.hx0, x1: h.hx1, z0: h.hz0, z1: h.hz1 }); }
    if (walkMan) placeMan();
  }

  // ---------- Danh sách chuyền ----------
  // ls = [{ id, stations }] theo thứ tự phải → trái (nhìn từ đầu chuyền: 201S01 bên phải, rồi S03, S05…). Chuyền có bộ trạm không đổi thì giữ nguyên (không dựng lại).
  function setLines(ls) {
    ls = ls || [];
    const keyOf = x => (x.stations || []).map(t => [t.ban, t.code, t.equipType, t.row, t.col, t.extra ? 1 : 0, t.head ? 1 : 0].join(',')).join(';');
    let changed = ls.length !== lines.length;
    const next = ls.map((x, i) => {
      const k = keyOf(x), old = lines.find(L => L.id === x.id);
      if (old && old.key === k) return old;
      changed = true;
      if (old) dropLine(old);
      const L = buildLine(x.id, x.stations); L.key = k; scene.add(L.g);
      return L;
    });
    lines.filter(L => !next.includes(L)).forEach(dropLine);
    lines.length = 0; lines.push(...next);
    // Đặt chuyền cạnh nhau: lối đi giữa luôn = LINE_GAP − 2·AX (bên có trạm phụ thì khu chuyền rộng thêm OX), cả cụm canh giữa x = 0
    let x = 0;
    lines.forEach((L, i) => { if (i) x -= halfW(lines[i - 1], -1) + (LINE_GAP - 2 * AX) + halfW(L, 1); L.x = x; });
    const mid = lines.length ? (xL(lineLeft()) + xR(lineRight())) / 2 : 0;
    lines.forEach(L => { L.x -= mid; L.g.position.x = L.x; });
    hovObj = null; drag = null;
    if (changed) { buildHallAll(); if (!W.on) view(lines.length > 1 ? 'all' : 'line', lines[0] && lines[0].id); }   // đang đi dạo: giữ chỗ
    if (changed) lines.forEach(L => { if (L.lastS) update(L.id, L.lastS); });   // không đổi chuyền nào: khỏi vẽ lại (xem lại theo giờ gọi rất nhiều lần)
  }
  const lineOf = id => lines.find(L => L.id === id) || (id == null ? lines[0] : null);

  // Giới tính theo hồ sơ nhân sự (HC): gd = 'F' | 'M' dựng lại người mẫu nữ / nam cho đúng; không rõ ('') thì về người mẫu mặc định của trạm
  function setGender(o, gd) {
    const w = o.model; if (!MH || !w) return;
    if (o.dfl == null) o.dfl = w.userData.female;
    const female = gd === 'F' ? true : gd === 'M' ? false : o.dfl;
    if (w.userData.female === female) return;
    const u = w.userData, n = MH.makeWorker({ female, color: u.color, seated: u.seated, seed: u.seed }), par = w.parent;
    if (!par) return;
    n.position.copy(w.position); n.rotation.copy(w.rotation); n.scale.copy(w.scale); n.visible = w.visible;
    n.userData.far = !!u.far; if (u.far) n.children[1].children.forEach((c, k) => { if (k > 0) c.visible = false; });
    par.add(n); par.remove(w);
    o.model = n; if (o.lod) o.lod.w = n;
    if (o.g && o.g.userData && o.g.userData.worker === w) o.g.userData.worker = n;
  }

  // Cột báo (mũi tên úp) trên đầu cụm công đoạn có vấn đề; dấu tròn "!" (đỏ: %EFF thấp) / "II" (xám: lâu không có dữ liệu) trên đầu công nhân có vấn đề
  const beaconMat = {};
  const beacon = st => { const m = new THREE.Mesh(G.cone, beaconMat[st] || (beaconMat[st] = keep(new THREE.MeshBasicMaterial({ color: PROB_COL[st] })))); m.rotation.x = Math.PI; m.renderOrder = 5; return m; };
  const pinMat = {};
  function pinSprite(n, col) {
    const k = n + '|' + col;
    if (!pinMat[k]) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 ' + (n > 9 ? 62 : 76) + 'px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'; g.fillText(String(n), 64, 68);
      pinMat[k] = keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthTest: false }));
    }
    const sp = new THREE.Sprite(pinMat[k]); sp.renderOrder = 7; return sp;
  }
  // Ghi chú chưa xong tại trạm (x.notes > 0): ô cam có biểu tượng ghi chú, cạnh biểu tượng máy hỏng
  let noteMat = null;
  function noteSprite() {
    if (!noteMat) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#d9822b'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 112, 112, 26) : g.rect(8, 8, 112, 112); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '70px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.fillText('\u{1F4DD}', 64, 70);
      noteMat = keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthTest: false }));
    }
    const sp = new THREE.Sprite(noteMat); sp.renderOrder = 6; return sp;
  }
  let brokenMat = null;
  function brokenSprite() {
    if (!brokenMat) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.fillStyle = '#7b3fb5'; g.beginPath(); g.roundRect ? g.roundRect(8, 8, 112, 112, 26) : g.rect(8, 8, 112, 112); g.fill();
      g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '70px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'; g.fillText('\u{1F527}', 64, 70);
      brokenMat = keep(new THREE.SpriteMaterial({ map: keep(new THREE.CanvasTexture(c)), transparent: true, depthTest: false }));
    }
    const sp = new THREE.Sprite(brokenMat); sp.renderOrder = 6; return sp;
  }
  // ---------- Cập nhật trạng thái 1 chuyền ----------
  // s = { stations: [{ ban, status, title, sub, bn, worker, tag: { lines, color } }], free: […], speed: 0..1.5 (so với kế hoạch), running,
  //       sign: { title, sub, color } }
  function update(id, s) {
    if (typeof id === 'object' && id) { s = id; id = null; }   // kiểu cũ: update(s) cho chuyền đầu
    const L = lineOf(id);
    if (!L || !s) return;
    L.lastS = s;
    const by = new Map((s.stations || []).map(x => [x.ban, x]));
    L.stations.forEach(o => {
      const x = by.get(o.t.ban) || { status: 'none', title: String(o.t.ban), sub: o.t.name || '' };
      o.info = x;
      o.tile.material.color.setHex(COLORS[x.status] != null ? COLORS[x.status] : COLORS.none);
      // Người: đang làm thì tay thao tác (cử động trong vòng lặp), ngừng / không có dữ liệu thì tay hạ
      o.busy = x.status !== 'stall' && x.status !== 'none';
      o.has = x.worker !== undefined ? !!x.worker : true;
      setGender(o, x.gender);
      const w = o.model;
      if (w) { w.visible = o.has; if (o.ph == null) o.ph = w.userData.phase; MH.pose(w, o.busy); }
      const col = '#' + (COLORS[x.status] != null ? COLORS[x.status] : COLORS.none).toString(16).padStart(6, '0');
      o.sp.material = label([x.title, x.sub, x.samTxt || ''], col, x.dot);
      o.tag.visible = !!x.tag;
      if (x.tag) drawTag(o.tag, x.tag.lines, x.tag.color || col, x.tag.eff, x.tag.badge);
      o.low = !!(x.tag && x.tag.low && o.has && !x.blank && !x.head); lowGlow(o, o.low);
      // Máy hỏng (x.broken từ trang, hoặc setBroken): biểu tượng cờ lê tím trên máy
      const bk = !x.blank && !x.head && (x.broken || L.broken.has(o.t.ban));
      if (bk) {
        if (!o.bk) { o.bk = brokenSprite(); o.g.add(o.bk); }
        o.bk.position.set(o.side * 0.3, 1.75, 0); o.bk.userData.on = true;
      } else if (o.bk) { o.bk.userData.on = false; o.bk.visible = false; }
      const nn = !x.blank && !x.head && x.notes > 0;
      if (nn) {
        if (!o.nt) { o.nt = noteSprite(); o.g.add(o.nt); }
        o.nt.position.set(o.side * 0.3, 1.75, 0.5); o.nt.userData.on = true;
      } else if (o.nt) { o.nt.userData.on = false; o.nt.visible = false; }
    });
    (L.groups || []).forEach(q => {
      const st = q.list.map(o => (o.info && o.info.status) || 'none').sort((a, b) => (SEV[b] || 0) - (SEV[a] || 0))[0];
      q.mat.color.setHex(COLORS[st] != null ? COLORS[st] : COLORS.none);
      q.blink = st === 'bn';
      if (!q.blink) { q.mat.opacity = 1; q.list.forEach(o => { o.tile.material.opacity = 0.6; }); }   // hết nhấp nháy: trả về như thường
    });
    syncFree(L, s.free || []);
    // Cột báo: mỗi cụm công đoạn có vấn đề (bn / stall / skill), ở giữa cụm, cao hơn nhãn trạm
    let nm = 0;
    (L.groups || []).forEach(q => {
      const st = q.list.map(o => (o.info && o.info.status) || 'none').sort((a, b) => (SEV[b] || 0) - (SEV[a] || 0))[0];
      if (!PROB_COL[st]) return;
      let m = L.marks[nm];
      if (!m || m.userData.st !== st) { if (m) L.g.remove(m); m = L.marks[nm] = beacon(st); m.userData.st = st; L.g.add(m); }
      m.userData.at = new THREE.Vector3(q.side * (q.sx + 0.2), LABEL_Y + 0.9, (q.z0 + q.z1) / 2); m.userData.on = true; nm++;
    });
    for (let i = nm; i < L.marks.length; i++) { L.marks[i].userData.on = false; L.marks[i].visible = false; }
    // Chấm cả chuyền (toàn cảnh, chế độ smart): số vấn đề + màu của vấn đề nặng nhất
    {
      const grp = (L.groups || []).map(q => q.list.map(o => (o.info && o.info.status) || 'none').sort((a, b) => (SEV[b] || 0) - (SEV[a] || 0))[0]).filter(st => PROB_COL[st]);
      const nW = 0, nB = L.stations.filter(o => o.bk && o.bk.userData.on).length, n = grp.length + nW + nB;
      const col = grp.includes('bn') ? PROB_COL.bn : nB ? BROKEN_COL : grp.includes('skill') ? PROB_COL.skill : grp.length ? PROB_COL.stall : nW ? 0xc63a2f : 0;
      if (!n) { L.pinInfo = null; if (L.pin) L.pin.visible = false; }
      else if (!L.pinInfo || L.pinInfo.n !== n || L.pinInfo.col !== col) {
        if (L.pin) L.g.remove(L.pin);
        L.pin = pinSprite(n, col); L.pinInfo = { n, col }; L.g.add(L.pin);
      }
    }
    if (s.sign) drawSign(L.sign, s.sign);
    if (s.garment != null && s.garment !== L.garm) paintGarment(L, s.garment);
    L.carriers.speed = s.running === false ? 0 : 0.25 * Math.max(0.15, Math.min(1.5, s.speed || 1));
  }

  // Màu áo của chuyền (số hex): áo trên móc treo + mảnh vải trên bàn các trạm. Hình áo theo màu dùng chung (cache), giải phóng khi dispose.
  const garmGeo = {}, garmMat = {};
  function paintGarment(L, hex) {
    L.garm = hex;
    const C = L.carriers;
    if (C.gm) C.gm.geometry = garmGeo[hex] || (garmGeo[hex] = keep(MH.garmentGeo('ao', hex)));
    else C.cloth.material = garmMat[hex] || (garmMat[hex] = mat(hex, { roughness: 0.9 }));
    L.stations.forEach(o => { if (o.piece) o.piece.material.color.setHex(hex); });
    L.freeMap.forEach(o => { if (o.piece) o.piece.material.color.setHex(hex); });
  }

  // Công nhân chưa có trạm (làm công đoạn ngoài layout): ngồi máy riêng tại vị trí đã lưu (x, z trong hệ chuyền);
  // chưa có vị trí thì xếp hàng phía sau đầu kín chữ U (không chắn lối đi).
  // free = [{ id, x, z, name, equipType (máy theo công đoạn chính), busy, tag: { lines, color } }]
  const hashId = id => { let h = 7; String(id).split('').forEach(c => { h = (h * 31 + c.charCodeAt(0)) % 100003; }); return h; };
  // Cụm ngoài chuyền (09/10, trước ở sau đầu kín chữ U): phía đầu chuyền, bên kia lối đi chính, lưới 3 cột;
  // ô 0…nHead−1 = trạm đầu chuyền (làm tập), sau đó người ngoài trạm
  function outSlot(L, i) { const r = Math.floor(i / 3), c = i % 3; return { x: (c - 1) * 1.9 + 0.3, z: L.zEnd + WALK + 1.6 + r * 1.6 }; }
  // So mã công đoạn: số thì theo số (34 < 140), còn lại theo chữ
  const opCmp = (a, b) => { const x = parseFloat(a), y = parseFloat(b); return isFinite(x) && isFinite(y) && x !== y ? x - y : String(a || '').localeCompare(String(b || '')); };
  // Đánh số ô theo nhóm công đoạn (keys đã sắp): cùng công đoạn nằm liền nhau; nhóm ≤ 3 người không vừa phần còn lại của hàng thì sang hàng mới
  function packSlots(keys, start) {
    const idx = []; let i = start;
    keys.forEach((k, j) => {
      if (j && k !== keys[j - 1] || !j) { let n = 0; while (j + n < keys.length && keys[j + n] === k) n++; const c = i % 3; if (c && n <= 3 && c + n > 3) i += 3 - c; }
      idx.push(i++);
    });
    return { idx, next: i };
  }
  function dropFree(L, o) { L.freeGroup.remove(o.g, o.tag, o.sp); L.freeMap.delete(o.id); }
  function syncFree(L, list) {
    const ids = new Set(list.map(x => String(x.id)));
    L.freeMap.forEach((o, id) => { if (!ids.has(id)) dropFree(L, o); });
    // Người chưa kéo thả: sắp theo công đoạn (x.op) rồi mã CN, xếp ô sau trạm đầu chuyền
    const auto = list.filter(x => !(isFinite(x.x) && isFinite(x.z))).sort((a, b) => opCmp(a.op, b.op) || String(a.id).localeCompare(String(b.id)));
    const fp = packSlots(auto.map(x => String(x.op || '')), L.outStart || 0), slotOf = new Map(auto.map((x, i) => [x, fp.idx[i]]));
    L.outN = fp.next;
    list.forEach(x => {
      const id = String(x.id), p = slotOf.has(x) ? outSlot(L, slotOf.get(x)) : x, side = p.x >= 0 ? 1 : -1;
      const key = side + '|' + (x.equipType || '') + '|' + (x.name || '');
      let o = L.freeMap.get(id);
      if (o && o.key !== key) { dropFree(L, o); o = null; }                 // đổi bên / đổi máy: dựng lại
      if (!o) {
        const g = new THREE.Group(), t = { ban: hashId(id), name: x.name || '', equipType: x.equipType || '' };
        if (MH) buildDetailed(g, t, side); else buildSimple(g, t, side);
        const hit = new THREE.Mesh(G.box, hitMat); hit.scale.set(1.75, 1.6, 1.25); hit.position.set(side * 0.3, 0.8, 0); g.add(hit);
        const tag = floorTag(); tag.visible = false;
        // Nhãn trên đầu: số công đoạn + tên (như nhãn trạm), màu theo trạng thái công đoạn
        const sp = new THREE.Sprite(label(['', ''], '#9aa3b1')); sp.scale.set(1.28, 0.48, 1);
        o = { line: L.id, id, key, free: true, g, model: g.userData.worker || null, lod: g.userData.lod || null, far: false, piece: g.userData.piece || null, hit, tag, sp }; hit.userData.ref = o;
        if (o.piece && L.garm != null) o.piece.material.color.setHex(L.garm);
        L.freeGroup.add(g, tag, sp); L.freeMap.set(id, o);
      }
      o.g.position.set(p.x, 0, p.z);
      setGender(o, x.gender);
      if (o.model) MH.pose(o.model, !!x.busy);
      o.tag.position.set(p.x + side * 1.12, 0.016, p.z);
      o.sp.position.set(p.x + side * 0.2, LABEL_Y, p.z);
      o.sp.visible = !!x.title;
      if (x.title) o.sp.material = label([x.title, x.sub || '', x.samTxt || ''], '#' + (COLORS[x.status] != null ? COLORS[x.status] : COLORS.none).toString(16).padStart(6, '0'));
      o.tag.visible = !!x.tag;
      if (x.tag) drawTag(o.tag, x.tag.lines, x.tag.color || '#9aa3b1', x.tag.eff, x.tag.badge);
      o.low = !!(x.tag && x.tag.low); lowGlow(o, o.low);
    });
  }

  // ---------- Dò tia (mọi chuyền) ----------
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const allSt = () => lines.flatMap(L => L.stations);
  const setRay = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(mouse, camera);
  };
  const refAt = objs => { const h = objs.length ? ray.intersectObjects(objs)[0] : null; return h ? h.object.userData.ref : null; };
  // Công nhân dưới con trỏ (người ở trạm có người + người ngồi ngoài)
  const workerAt = () => refAt(allSt().filter(o => o.has).map(o => o.whit).concat(lines.flatMap(L => [...L.freeMap.values()].map(o => o.hit))));
  const labelAt = () => refAt(allSt().map(o => o.sp));
  const stationAt = () => refAt(allSt().map(o => o.hit));

  // Bấm: thẻ trên đầu trạm → opt.onLabel (đổi công đoạn); công nhân / trạm → opt.onPick (bấm chỗ trống: null)
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 || !lines.length) return;
    setRay(e);
    const lb = opt.onLabel ? labelAt() : null;
    if (lb) { opt.onLabel(lb, e); return; }
    if (opt.onPick) opt.onPick(workerAt() || stationAt(), e);
  });

  // Nhấp đúp vào trạm / công nhân: camera bay tới đúng chỗ đó, nhìn chính diện
  renderer.domElement.addEventListener('dblclick', e => {
    if (!lines.length || W.on) return;
    setRay(e);
    const o = workerAt() || stationAt();
    if (o && o.t && o.line != null) focusEmp(o.line, { ban: o.t.ban }, true, { flat: true });   // nhìn chính diện từ lối đi (như bấm công đoạn), không còn góc chéo
  });

  // Rê chuột lên trạm / công nhân: báo trang (opt.onHover); dò tia tối đa 1 lần / khung hình
  let hovE = null, hovRaf = 0, hovObj = null;
  function hoverAt() {
    hovRaf = 0;
    const e = hovE; if (!e || !opt.onHover || drag) return;
    setRay(e);
    if (opt.onLabel && labelAt()) {               // trên thẻ: con trỏ bấm, ẩn thẻ thông tin
      renderer.domElement.style.cursor = 'pointer'; if (hovObj) opt.onHover(null, e); hovObj = null; return;
    }
    const o = workerAt() || stationAt();
    renderer.domElement.style.cursor = o && (o.free || o.has) ? 'grab' : o ? 'pointer' : '';
    if (o !== hovObj || o) opt.onHover(o, e);
    hovObj = o;
  }
  renderer.domElement.addEventListener('pointermove', e => {
    if (drag) { dragMove(e); return; }
    if (e.buttons) { if (hovObj && opt.onHover) opt.onHover(null, e); hovObj = null; return; }   // đang kéo xoay: ẩn
    hovE = e; if (!hovRaf) hovRaf = requestAnimationFrame(hoverAt);
  });
  renderer.domElement.addEventListener('pointerleave', e => {
    hovE = null; if (hovRaf) { cancelAnimationFrame(hovRaf); hovRaf = 0; }
    if (hovObj && opt.onHover) opt.onHover(null, e); hovObj = null; if (!drag) renderer.domElement.style.cursor = '';
  });

  // ---------- Kéo thả công nhân (trong cùng 1 chuyền) ----------
  // Thả lên trạm khác → opt.onDrop(src, { ban }), thả ra sàn → opt.onDrop(src, { x, z }) (tọa độ trong hệ chuyền nguồn).
  // src = { line, ban } (người đang ở trạm) hoặc { line, id } (người ngồi ngoài).
  let drag = null, ghost = null, dropMark = null;
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp = new THREE.Vector3();
  renderer.domElement.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !opt.onDrop || !lines.length) return;
    setRay(e);
    const o = workerAt();
    if (!o) return;
    controls.enabled = false;                     // listener capture chạy trước OrbitControls: không xoay camera
    drag = { o, L: lineOf(o.line), x0: e.clientX, y0: e.clientY, moved: false, pid: e.pointerId };
  }, true);
  function dragMove(e) {
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) <= 5) return;
      drag.moved = true;
      try { renderer.domElement.setPointerCapture(drag.pid); } catch (er) {}
      if (opt.onHover) opt.onHover(null, e);
      if (!ghost) {
        if (MH) { ghost = MH.makeWorker({ female: true, color: 0x2b4f9c, seated: false, seed: 3 }); MH.pose(ghost, false); }
        else { ghost = new THREE.Mesh(G.cyl, M.shirt); ghost.scale.set(0.36, 1.6, 0.26); }
        dropMark = new THREE.Mesh(G.box, keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false })));
        dropMark.scale.set(1.85, 0.03, 1.3);
      }
      scene.add(ghost, dropMark);
      (drag.o.free ? drag.o.g : drag.o.model || {}).visible = false;
      renderer.domElement.style.cursor = 'grabbing';
    }
    setRay(e);
    const onFloor = ray.ray.intersectPlane(ground, gp);
    if (onFloor) ghost.position.set(gp.x, 0.05, gp.z);
    ghost.visible = true;
    const t = stationAt(), ok = t && t !== drag.o && t.line === drag.o.line;
    drag.to = ok ? { ban: t.t.ban } : onFloor ? { x: +(gp.x - drag.L.x).toFixed(2), z: +gp.z.toFixed(2) } : null;
    dropMark.visible = !!ok;
    if (ok) dropMark.position.set(drag.L.x + t.side * (t.sx + 0.3), 0.03, t.z);
  }
  function dragEnd(e) {
    if (!drag) return;
    const d = drag; drag = null;
    controls.enabled = !W.on;
    if (!d.moved) return;
    if (ghost) { ghost.visible = false; dropMark.visible = false; }
    if (d.o.free) d.o.g.visible = true; else if (d.o.model) d.o.model.visible = d.o.has;
    renderer.domElement.style.cursor = '';
    if (d.to) opt.onDrop(d.o.free ? { line: d.o.line, id: d.o.id } : { line: d.o.line, ban: d.o.t.ban }, d.to, e);
  }
  root.addEventListener('pointerup', dragEnd);
  root.addEventListener('pointercancel', dragEnd);

  // ---------- Đi dạo góc nhìn thứ nhất (quản lý đi bộ quanh xưởng) ----------
  // W / S tiến lùi, A / D sang ngang, ← → quay, ↑ ↓ tiến lùi, Shift đi nhanh, kéo chuột nhìn quanh, Esc thoát.
  // Không đi xuyên khu chuyền (bàn, ray), không ra khỏi tường nhà xưởng. Ngoài chế độ đi dạo: hình người quản lý đứng ở chỗ vừa đi tới.
  const EYE = 1.62, SPEED = 1.6, RUN = 3.6, PAD = 0.35;
  const W = { on: false, x: 0, z: 0, yaw: 0, pitch: -0.08, keys: new Set(), saved: null, look: null };
  let walkMan = null;
  function placeMan() {
    if (!walkMan) return;
    walkMan.position.set(W.x, 0, W.z); walkMan.rotation.y = W.yaw + Math.PI;
    walkMan.visible = !W.on && !!lines.length;
  }
  function makeMan() {
    if (walkMan || !MH) return;
    walkMan = MH.makeWorker({ female: false, color: 0xe9edf2, seated: false, seed: 41 });   // áo sơ mi trắng: quản lý
    MH.pose(walkMan, false); scene.add(walkMan);
  }
  // Va chạm: khu mỗi chuyền (bàn + người ngồi + ray chữ U) và tường nhà xưởng
  function blocked(x, z) {
    const h = hallBox;
    if (h && (x < h.x0 + PAD + 0.3 || x > h.x1 - PAD - 0.3 || z < h.z0 + PAD + 0.3 || z > h.z1 - PAD - 0.3)) return true;
    return lines.some(L => {
      const l = L.x - halfW(L, -1) + 0.65, r = L.x + halfW(L, 1) - 0.65;
      return x > l - PAD && x < r + PAD && z > -RX - 1.0 - PAD && z < L.zEnd - 0.2 + PAD;
    });
  }
  function startPos() {
    const h = hallBox, zM = lines.length ? Math.max(...lines.map(L => L.zMax)) : 10;
    const x = lines.length ? xL(lineLeft()) - WALK / 2 : 0;
    return { x, z: h ? h.front : (lines.length ? Math.max(...lines.map(L => L.zEnd)) : zM + RX + 1.2) + WALK / 2, yaw: 0 };   // đầu lối đi bên trái chuyền đầu tiên, nhìn dọc chuyền (−z)
  }
  function walk(on) {
    on = !!on;
    if (on === W.on) return W.on;
    if (on) {
      if (!lines.length) return false;
      makeMan();
      if (!W.placed) { Object.assign(W, startPos()); W.placed = true; }
      if (blocked(W.x, W.z)) Object.assign(W, startPos());
      W.saved = { p: camera.position.clone(), t: controls.target.clone() };
      camAnim = null; controls.enabled = false; W.on = true; W.pitch = -0.08;
      renderer.domElement.focus && renderer.domElement.focus();
    } else {
      W.on = false; W.keys.clear(); W.look = null;
      controls.enabled = true;
      if (W.saved) { camera.position.copy(W.saved.p); controls.target.copy(W.saved.t); }
      controls.update();
    }
    placeMan();
    if (opt.onWalk) opt.onWalk(W.on);
    return W.on;
  }
  const typing = e => e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  const WALK_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE'];
  function onKey(e) {
    if (!W.on || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.type === 'keydown' && e.code === 'Escape') { walk(false); e.preventDefault(); return; }
    if (!WALK_KEYS.includes(e.code)) return;
    e.preventDefault();
    if (e.type === 'keydown') W.keys.add(e.code); else W.keys.delete(e.code);
  }
  root.addEventListener('keydown', onKey); root.addEventListener('keyup', onKey);
  const clearKeys = () => W.keys.clear();
  root.addEventListener('blur', clearKeys);
  // Kéo chuột (không phải kéo công nhân): quay đầu nhìn quanh
  renderer.domElement.addEventListener('pointerdown', e => { if (W.on && !drag && e.button === 0) W.look = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointermove', e => {
    if (!W.on || !W.look || drag || !(e.buttons & 1)) return;
    W.yaw -= (e.clientX - W.look[0]) * 0.004; W.pitch = Math.max(-1.2, Math.min(1.0, W.pitch - (e.clientY - W.look[1]) * 0.003));
    W.look = [e.clientX, e.clientY];
  });
  root.addEventListener('pointerup', () => { W.look = null; });
  function stepWalk(dt, now) {
    const k = W.keys, has = c => k.has(c);
    if (has('ArrowLeft') || has('KeyQ')) W.yaw += 1.8 * dt;
    if (has('ArrowRight') || has('KeyE')) W.yaw -= 1.8 * dt;
    const f = (has('KeyW') || has('ArrowUp') ? 1 : 0) - (has('KeyS') || has('ArrowDown') ? 1 : 0);
    const s = (has('KeyD') ? 1 : 0) - (has('KeyA') ? 1 : 0);
    const moving = f || s;
    if (moving) {
      const v = (has('ShiftLeft') || has('ShiftRight') ? RUN : SPEED) * dt / Math.hypot(f, s);
      const fx = -Math.sin(W.yaw), fz = -Math.cos(W.yaw);           // hướng nhìn (yaw = 0 nhìn về −z)
      const dx = (fx * f - fz * s) * v, dz = (fz * f + fx * s) * v;  // phải = (−fz, fx)
      if (!blocked(W.x + dx, W.z)) W.x += dx;                       // trượt dọc vật cản
      if (!blocked(W.x, W.z + dz)) W.z += dz;
      W.bob = (W.bob || 0) + v * 7;
    }
    const y = EYE + (moving ? Math.sin(W.bob) * 0.025 : 0);
    camera.position.set(W.x, y, W.z);
    tmp.set(W.x - Math.sin(W.yaw) * Math.cos(W.pitch), y + Math.sin(W.pitch), W.z - Math.cos(W.yaw) * Math.cos(W.pitch));
    camera.lookAt(tmp);
  }

  // ---------- Vòng lặp ----------
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), wv = new THREE.Vector3(), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let last = performance.now(), raf = 0, alive = true, camAnim = null, lodN = 0, lodDirty = true, kickT = 0;
  // Chuyển trạm sang khối đơn giản khi xa camera (có trễ ±10%); nhãn xa ẩn ở mức thấp
  function lodPass() {
    lines.forEach(L => L.stations.forEach(o => {
      if (!o.lod) return;
      o.hit.getWorldPosition(tmp);
      const d = tmp.distanceTo(camera.position), far = d > LOD_D * (o.far ? 0.9 : 1);
      if (far !== o.far) {
        o.far = far; const k = o.lod;
        // Xa: giữ nguyên người + bàn máy (không đổi thành ô vuông), chỉ ẩn 2 tay và đầu chi tiết (khối nặng nhất)
        k.w.userData.far = far; k.w.children[1].children.forEach((c, n) => { if (n > 0) c.visible = !far; });
      }
      o.sp.visible = !(d > LABEL_D);
    }));
  }
  controls.addEventListener('start', () => { camAnim = null; });   // người dùng kéo chuột thì dừng bay
  function frame(now) {
    raf = 0;
    if (!alive) return;
    if (CAP_MS && now - last < CAP_MS - 3) { if (!document.hidden) raf = requestAnimationFrame(frame); return; }   // máy yếu: giới hạn khung/s
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (LOD_D < Infinity && (++lodN % 8 === 1 || lodDirty)) { lodDirty = false; lodPass(); }
    // Công đoạn tắc nghẽn (đỏ): khung + ô nền nhấp nháy
    const bl = 0.5 + 0.5 * Math.sin(now / 260);
    lines.forEach(L => (L.groups || []).forEach(q => { if (q.blink) { q.mat.opacity = 0.2 + 0.8 * bl; q.list.forEach(o => { o.tile.material.opacity = 0.25 + 0.55 * bl; }); } }));
    const lowAny = lines.some(L => L.stations.some(o => o.low) || [...L.freeMap.values()].some(o => o.low));
    if (lowAny) lines.forEach(L => { const f = o => { if (o.low && o.lw) { const k = Math.min(0.8, Math.max(0.3, camera.position.distanceTo(wv.copy(o.g.position).add(L.g.position)) / 45)); o.lw.scale.set(k, k, k); } }; L.stations.forEach(f); L.freeMap.forEach(f); });
    const moving = !!(camAnim || W.on || (pin && pin.visible) || lines.some(L => L.stations.some(o => (o.bk && o.bk.visible))) || lines.some(L => (L.carriers && L.carriers.speed > 0) || L.marks.some(m => m.visible) || (L.pin && L.pin.visible) || (L.groups || []).some(q => q.blink)));
    lines.forEach(L => {
      const C = L.carriers;
      if (C) {
        C.d = (C.d + C.speed * dt) % L.railLen;
        for (let i = 0; i < C.n; i++) {
          const d = C.d + i * C.gap;
          railPoint(L, d, tmp); railPoint(L, d + 0.05, tmp2);
          const ang = Math.atan2(tmp2.x - tmp.x, tmp2.z - tmp.z);
          if (C.gm) {
            q.setFromAxisAngle(up, ang - Math.PI / 2);    // áo mỏng theo trục x của hình → xoay trục x dọc hướng chạy
            mtx.compose(tmp.set(tmp.x, RAIL_Y - 0.02, tmp.z), q, sc.set(1, 1, 1)); C.gm.setMatrixAt(i, mtx);
          } else {
            q.setFromAxisAngle(up, ang);
            mtx.compose(tmp.set(tmp.x, RAIL_Y - 0.12, tmp.z), q, sc.set(0.03, 0.22, 0.03)); C.hook.setMatrixAt(i, mtx);
            mtx.compose(tmp.set(tmp.x, RAIL_Y - 0.5, tmp.z), q, sc.set(0.05, 0.55, 0.42)); C.cloth.setMatrixAt(i, mtx);
          }
        }
        if (C.gm) C.gm.instanceMatrix.needsUpdate = true;
        else C.hook.instanceMatrix.needsUpdate = C.cloth.instanceMatrix.needsUpdate = true;
        if (MH && C.speed > 0) L.stations.forEach(o => {
          const w = o.busy && o.model;
          if (w && !w.userData.far) { w.userData.phase = o.ph + now / 260; MH.pose(w, true); }
        });
      }
      // Thẻ sàn cùng chiều, đầu chữ quay ra xa camera: camera bên phải trục chuyền hay bên trái
      const yaw = camera.position.x >= L.x ? Math.PI / 2 : -Math.PI / 2;
      L.stations.forEach(o => { if (o.tag.visible) o.tag.rotation.y = yaw; });
      L.freeMap.forEach(o => { if (o.tag.visible) o.tag.rotation.y = yaw; });
      // Hiện / ẩn dấu vấn đề theo chế độ (markMode) + khoảng cách camera tới chuyền
      const dL = camera.position.distanceTo(wv.set(L.x, 1, L.zMax / 2)), far = dL > FAR_D, near = dL <= NEAR_D;
      const showPin = markMode === 'smart' && far && !!L.pinInfo;
      L.marks.forEach(m => { const st = m.userData.st; m.visible = !!m.userData.on && (markMode === 'all' || (markMode === 'smart' ? !far && (st === 'bn' || st === 'stall' || near) : st === 'bn')); });
      L.stations.forEach(o => {
        if (o.bk) o.bk.visible = !!o.bk.userData.on && (markMode === 'all' || !(markMode === 'smart' && far));
        if (o.nt) o.nt.visible = !!o.nt.userData.on && (markMode === 'all' || !(markMode === 'smart' && far));
      });
      if (L.pin) { L.pin.visible = showPin; if (showPin) { const f = Math.min(4, Math.max(1.6, dL / 16)); L.pin.position.set(0, 5.6 + Math.sin(now / 320) * 0.15, L.zMax / 2); L.pin.scale.set(f, f, f); } }
      // Cột báo nhún lên xuống, to dần khi camera ở xa để toàn cảnh vẫn thấy (wv: vị trí thế giới = vị trí trong chuyền + vị trí chuyền)
      L.marks.forEach(m => {
        if (!m.visible || !m.userData.at) return;
        m.position.copy(m.userData.at); m.position.y += Math.sin(now / 300) * 0.12;
        const f = Math.min(3.2, Math.max(1.4, camera.position.distanceTo(wv.copy(m.position).add(L.g.position)) / 14));
        m.scale.set(f, f * 1.2, f);
      });
      L.stations.forEach(o => {
        if (o.bk && o.bk.visible) { const f = Math.min(2.4, Math.max(0.45, camera.position.distanceTo(wv.copy(o.g.position).add(L.g.position)) / 22)); o.bk.scale.set(f, f, f); }
        if (o.nt && o.nt.visible) { const f = Math.min(2.4, Math.max(0.45, camera.position.distanceTo(wv.copy(o.g.position).add(L.g.position)) / 22)); o.nt.scale.set(f, f, f); }
      });
    });
    if (pin && pin.visible) { if (now > pin.userData.until) pin.visible = false; else pin.position.y = 1.9 + Math.sin(now / 200) * 0.08; }
    if (camAnim) {                               // bay camera 1,6 giây theo đồng hồ thật, chậm dần ở 2 đầu
      const t = Math.min(1, Math.max(0, (now - camAnim.start) / 1600)), k = t * t * (3 - 2 * t);
      camera.position.lerpVectors(camAnim.p0, camAnim.p1, k); controls.target.lerpVectors(camAnim.t0, camAnim.t1, k);
      if (t >= 1) camAnim = null;
    }
    let ctlMoved = true;
    if (W.on) stepWalk(dt, now); else {
      ctlMoved = controls.update();
      if (controls.target.y < 0 || camera.position.y < 1) {          // không cho nhìn từ dưới sàn lên
        controls.target.y = Math.max(0, controls.target.y); camera.position.y = Math.max(1, camera.position.y); controls.update(); ctlMoved = true;
      }
    }
    // Mái + dây đèn: ẩn khi camera lên cao hơn mái (nhìn từ trên), như chuyen-may.html
    const on = camera.position.y < HALL_H - 0.3;
    if (on !== roofOn) { roofOn = on; roof.forEach(o => { o.visible = on; }); }
    // Mức trung bình / thấp: đứng yên (không camera, không chuyển động, không thao tác) thì không vẽ lại
    if (!lite || moving || ctlMoved || now < kickT) renderer.render(scene, camera);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (!raf && alive && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', wake);

  function resize() {
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = root.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(el); else root.addEventListener('resize', resize);
  resize(); wake();

  function dispose() {
    alive = false; if (raf) cancelAnimationFrame(raf); if (hovRaf) cancelAnimationFrame(hovRaf);
    document.removeEventListener('visibilitychange', wake);
    root.removeEventListener('pointerup', dragEnd); root.removeEventListener('pointercancel', dragEnd);
    root.removeEventListener('keydown', onKey); root.removeEventListener('keyup', onKey); root.removeEventListener('blur', clearKeys);
    if (ro) ro.disconnect(); else root.removeEventListener('resize', resize);
    lines.forEach(dropLine); lines.length = 0;
    if (hallGroup) scene.remove(hallGroup);
    res.forEach(r => r.dispose && r.dispose());
    controls.dispose(); renderer.dispose(); renderer.domElement.remove();
  }

  // ---------- Camera ----------
  // Đặt camera: ngay (smooth = false) hoặc bay mượt trong ~1,6 giây (trình chiếu)
  function moveCam(pos, tgt, smooth) {
    if (W.on) { W.saved = null; walk(false); }    // đổi góc nhìn (nút, trình chiếu) = thoát đi dạo
    if (!smooth) { camAnim = null; camera.position.copy(pos); controls.target.copy(tgt); controls.update(); return; }
    camAnim = { start: performance.now(), p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: tgt.clone() };
  }
  // kind: 'all' = cả cặp từ phía đầu chuyền (lối đi chính), chính diện (camera nằm giữa các chuyền, không lệch ngang); 'line' = 1 chuyền nhìn ngang từ phía ngoài
  //       (chuyền ngoài cùng bên trái nhìn từ bên trái), chuyền nằm ngang khung hình; 'top' = từ trên ('top' + id = 1 chuyền)
  //       'def' (kiểu cũ) = 'all' khi nhiều chuyền, 'line' khi 1 chuyền. view(kind, smooth) kiểu cũ vẫn dùng được.
  function view(kind, id, smooth) {
    if (typeof id === 'boolean') { smooth = id; id = null; }
    if (!lines.length) return;
    resize();                                    // khung có thể vừa đổi kích thước (chuyển sang màn trình chiếu)
    if (kind === 'def') kind = lines.length > 1 ? 'all' : 'line';
    const vfov = camera.fov * Math.PI / 360, hfov = Math.atan(Math.tan(vfov) * camera.aspect);
    const L = id != null && !Array.isArray(id) ? lineOf(id) : null;
    const sel = kind === 'range' && Array.isArray(id) ? lines.filter(x => id.includes(x.id)) : null;   // 'range': khung ôm 1 nhóm chuyền (trang trình chiếu)
    if (kind === 'top' && (L || lines.length === 1)) {
      const A = L || lines[0], half = A.zMax / 2 + 2.5, dist = half / Math.tan(hfov) * 1.2;
      const tgt = new THREE.Vector3(A.x, 0.9, A.zMax / 2);
      const s = lines.length > 1 && A === lineLeft() ? -1 : 1;
      const pos = kind === 'top' ? new THREE.Vector3(A.x + s * 0.5, dist + 1, A.zMax / 2)
        : new THREE.Vector3(A.x + s * dist * 0.72, dist * 0.62, A.zMax / 2 + dist * 0.28);
      moveCam(pos, tgt, smooth); return;
    }
    // Khung dọc chuyền: từ đầu kín chữ U tới hết cụm ngoài chuyền phía đầu chuyền (trạm làm tập + người ngoài trạm)
    const zF = Math.max(...lines.map(x => { const n = Math.max(x.outN || 0, (x.nHead || 0) + x.freeMap.size); return n ? outSlot(x, n - 1).z + 0.8 : x.zMax; }));
    // 'line' (1 chuyền): cùng góc nhìn chéo từ đầu chuyền như toàn cảnh, ôm chuyền đó + chừa chỗ cho chuyền kế bên; đổi chuyền = camera trượt ngang
    const one = kind === 'line' ? (L || lines[0]) : null;
    const sl = one ? one : sel && sel.length ? sel.reduce((a, b) => (b.x < a.x ? b : a)) : lineLeft(), sr = one ? one : sel && sel.length ? sel.reduce((a, b) => (b.x > a.x ? b : a)) : lineRight();
    const pad = one ? (xR(one) - xL(one)) * 0.2 + 1 : 1, zc = zF / 2, x0 = xL(sl) - pad, x1 = xR(sr) + pad;
    const cx = one ? one.x : (x0 + x1) / 2, tgt = new THREE.Vector3(cx, 0, zc);
    if (kind === 'top') {                        // chuyền dọc màn hình, chuyền đầu bên phải
      const dist = Math.max((x1 - x0) / 2 / Math.tan(hfov), (zc + 3) / Math.tan(vfov)) * 1.1;
      moveCam(new THREE.Vector3(cx, dist + 1, zc + 0.5), tgt, smooth); return;
    }
    const dist = Math.max((x1 - x0) / 2 / Math.tan(hfov) * 1.45, (zc + 3) / Math.tan(vfov) * (one ? 0.55 : 1.0));
    // 1 chuyền: nhìn trực diện thẳng dọc chuyền (camera nằm đúng trục chuyền, không lệch ngang), hơi cao
    moveCam(one ? new THREE.Vector3(cx, dist * 0.5, zc + dist * 0.87) : new THREE.Vector3(cx, dist * 0.62, zc + dist * 0.82), tgt, smooth);
  }
  // Camera lại gần 1 trạm: LUÔN nhìn chính diện từ lối đi (ngang tầm, vuông góc chuyền), không góc chéo (người dùng yêu cầu 12/10/2026). focus(ban, smooth) kiểu cũ = chuyền đầu.
  function focus(id, ban, smooth) {
    if (typeof id === 'number' && (typeof ban === 'boolean' || ban == null)) { smooth = ban; ban = id; id = null; }
    const L = lineOf(id); if (!L) return;
    const o = L.stations.find(s => s.t.ban === ban);
    if (!o) return;
    moveCam(new THREE.Vector3(L.x + o.side * (o.sx + 0.62 + 5.6), 2.9, o.z), new THREE.Vector3(L.x + o.side * (o.sx + 0.62 - 0.6), 0.8, o.z), smooth);
  }

  // Tới chỗ 1 công nhân (bấm tên trong bảng công nhân): emp ngồi trạm (ban) hoặc ngồi ngoài trạm (freeMap); mũi tên xanh ngay trên đầu người (dưới ray) 6 giây.
  // Trả false khi người đó không có trên 3D.
  let pin = null;
  // Luôn nhìn ngang từ lối đi (chính diện, vuông góc chuyền); opt.flat giữ lại cho tương thích, không còn góc chéo
  function focusEmp(id, ref, smooth, opt) {
    const L = lineOf(id); if (!L) return false;
    let x, z, side;
    if (ref && ref.ban != null) { const o = L.stations.find(s => s.t.ban === ref.ban); if (!o) return false; side = o.side; x = o.side * (o.sx + 0.62); z = o.z; }
    else { const o = L.freeMap.get(String(ref && ref.emp)); if (!o) return false; x = o.g.position.x; z = o.g.position.z; side = x >= 0 ? 1 : -1; x += side * 0.62; }
    moveCam(new THREE.Vector3(L.x + x + side * 5.6, 2.9, z), new THREE.Vector3(L.x + x - side * 0.6, 0.8, z), smooth);
    if (!pin) { pin = new THREE.Mesh(G.cone, keep(new THREE.MeshBasicMaterial({ color: 0x2391b5 }))); pin.rotation.x = Math.PI; pin.renderOrder = 4; scene.add(pin); }
    pin.position.set(L.x + x, 1.9, z); pin.scale.setScalar(0.5); pin.visible = true; pin.userData.until = performance.now() + ((opt && opt.pinMs) || 6000); wake();
    return true;
  }

  // Kiểu cũ (1 chuyền): setLayout(stations) = 1 chuyền mã '_'
  const setLayout = st => setLines([{ id: lines[0] ? lines[0].id : '_', stations: st }]);
  // Đo hiệu năng (chỉ đọc): số lệnh vẽ / tam giác / texture; bench(n) = ms mỗi khung (ép GPU xong từng khung bằng readPixels)
  function stats() {
    let meshes = 0, visible = 0, inst = 0, lights = 0, shadowCasters = 0;
    scene.traverse(o => { if (o.isLight) lights++; if (o.isMesh) { meshes++; if (o.visible) visible++; if (o.isInstancedMesh) inst += o.count; if (o.castShadow) shadowCasters++; } });
    const r = renderer.info.render, m = renderer.info.memory;
    return { calls: r.calls, tris: r.triangles, geometries: m.geometries, textures: m.textures, meshes, visible, instances: inst, lights, shadowCasters, lite, level: lv, pixelRatio: renderer.getPixelRatio(), shadows: renderer.shadowMap.enabled, w: renderer.domElement.width, h: renderer.domElement.height };
  }
  function bench(n) {
    const gl = renderer.getContext(), px = new Uint8Array(4); n = n || 20;
    renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
    return (performance.now() - t0) / n;
  }
  let markMode = 'smart';                                // 'smart' (mặc định, gọn theo khoảng cách) | 'all' (hiện hết) | 'top' (chỉ nghiêm trọng)
  function setMarkMode(m) { markMode = ['all', 'smart', 'top'].includes(m) ? m : 'smart'; }
  // Đánh dấu máy hỏng ở trạm ban của chuyền id (on = false: bỏ); trang sau này gọi từ danh sách máy hỏng
  function setBroken(id, ban, on) { const L = lineOf(id); if (!L) return; if (on === false) L.broken.delete(ban); else L.broken.add(ban); if (L.lastS) update(L.id, L.lastS); }
  const api = { setLines, setMarkMode, setBroken, get markMode() { return markMode; }, setLayout, update, resize, dispose, view, focus, focusEmp, applyTheme, walk, stats, bench, get _debug() { return { scene, renderer, camera, controls }; }, get walking() { return W.on; }, get walkPos() { return { x: W.x, z: W.z, yaw: W.yaw }; },
    get lines() { return lines.map(L => ({ id: L.id, x: L.x, zMax: L.zMax })); }, get stations() { return allSt(); } };
  // Mọi lệnh gọi từ ngoài (đổi dữ liệu, camera, theme...) và thao tác chuột / phím đều "đánh thức" việc vẽ vài trăm ms
  const kick = ms => { kickT = Math.max(kickT, performance.now() + (ms || 600)); lodDirty = true; wake(); };
  Object.keys(api).forEach(k => { const d = Object.getOwnPropertyDescriptor(api, k); if (d && typeof d.value === 'function' && k !== 'stats' && k !== 'bench' && k !== 'dispose') { const f = d.value; api[k] = function () { kick(800); return f.apply(this, arguments); }; } });
  ['pointermove', 'pointerdown', 'pointerup', 'wheel', 'keydown'].forEach(ev => renderer.domElement.addEventListener(ev, () => kick(500), { passive: true }));
  root.addEventListener('keydown', () => kick(500));
  return api;
}

root.ChuyenTreo3D = { create, COLORS };
})(this);
