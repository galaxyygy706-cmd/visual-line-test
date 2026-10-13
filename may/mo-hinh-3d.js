// Mô hình 3D dùng chung cho chuyền may (chuyen-may.html) và chuyền treo (chuyen-treo-3d.js):
// người (thân gộp sẵn, mặt vẽ texture, tay cử động), máy may / vắt sổ, bàn là, bàn kiểm, giá treo, móc treo + sản phẩm.
// Tách nguyên từ chuyen-may.html (07/10/2026). Cần THREE (r128) nạp trước. Xuất: window.MoHinh3D.
(function (root) {
'use strict';
const THREE = root.THREE;
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'d').toLowerCase().trim();

const MAT = {
  matte: new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.72, metalness:.04 }),
  metal: new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.34, metalness:.72 }),
  body:  new THREE.MeshStandardMaterial({ vertexColors:true, roughness:.64, metalness:0, side:THREE.DoubleSide }),
  garm:  new THREE.MeshBasicMaterial({ vertexColors:true }),   // áo: KHÔNG ăn sáng (đèn trần / môi trường) → cùng 1 màu ở mọi nơi (áo treo, áo trên bàn, chồng áo)
};
const mat = (c, o={}) => new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:.7, metalness:.05 }, o));
const COL = { garment:0x2c4a85, finished:0x86a5d4, carton:0xb98a55, op:0x2b4f9c, qc:0x24865a, steel:0x4a515a, rod:0x8a939c, wood:0xd8ccb2 };

// Số ngẫu nhiên cố định theo vị trí, để giới tính/màu tóc không đổi mỗi lần dựng lại cảnh
const seeded = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const pick3 = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
const SKINS = [0xeac3a2, 0xdcae8a, 0xcd9a74], HAIRS = [0x1b1512, 0x2a1d17, 0x3a271c];

// ---- Hình khối dùng lại (cache) ----
const GC = {};
const gc = (k, f) => GC[k] || (GC[k] = f());
const box = (w, h, d) => gc(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, seg = 16) => gc(`c${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const sph = r => gc(`s${r}`, () => new THREE.SphereGeometry(r, 18, 12));
const hemi = r => gc(`h${r}`, () => new THREE.SphereGeometry(r, 20, 10, 0, Math.PI*2, 0, Math.PI*.55));
const cone = (r, h) => gc(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 14));
const torus = (r, t) => gc(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 8, 20));
const lathe = (k, pts) => gc(`l${k}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 22));
function rrShape(w, h, r, x0 = -w/2, y0 = -h/2){
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0); s.lineTo(x0 + w - r, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + h - r); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h);
  s.lineTo(x0 + r, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r);
  s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
function ext(shape, depth, bev = .008){
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:true, bevelThickness:bev, bevelSize:bev, bevelSegments:2, curveSegments:6 });
  g.translate(0, 0, -depth/2); return g;
}
// hộp bo góc (bo theo mặt trước/sau), kích thước gần đúng w × h × d
const rbox = (w, h, d, r = .02) => gc(`r${w},${h},${d},${r}`, () => ext(rrShape(w - .016, h - .016, Math.min(r, (w - .02)/2, (h - .02)/2)), Math.max(.002, d - .016)));

// ---- Gộp nhiều khối thành 1 hình (vẽ 1 lần), màu lưu theo đỉnh ----
const DUMMY = new THREE.MeshBasicMaterial();
function part(parent, geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1){
  const m = new THREE.Mesh(geo, DUMMY);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); m.userData.c = hex;
  parent.add(m); return m;
}
const pm = (...a) => { const m = part(...a); m.userData.metal = true; return m; };   // chi tiết kim loại
function mergeParts(parts){
  const pos = [], nor = [], col = [], c = new THREE.Color();
  parts.forEach(([g, h]) => {
    const n = g.index ? g.toNonIndexed() : g, p = n.attributes.position.array, q = n.attributes.normal.array;
    c.setHex(h);
    for (let k = 0; k < p.length; k++){ pos.push(p[k]); nor.push(q[k]); }
    for (let k = 0; k < p.length / 3; k++) col.push(c.r, c.g, c.b);
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
function bake(root, pred = () => true){
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), parts = [];
  root.traverse(o => {
    if (!o.isMesh || !pred(o)) return;
    const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    parts.push([g, o.userData.c]);
  });
  return parts.length ? mergeParts(parts) : null;
}
const shade = (hex, f) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, f); return c.getHex(); };

// ================= Người =================
const HIP_M = [[.001,-.04],[.118,-.04],[.132,0],[.135,.06],[.128,.125],[.001,.125]];
const HIP_F = [[.001,-.04],[.126,-.04],[.143,0],[.145,.06],[.122,.13],[.001,.13]];
const TORSO_M = [[.001,.11],[.127,.11],[.124,.2],[.138,.3],[.158,.4],[.163,.45],[.132,.5],[.07,.525],[.001,.53]];
const TORSO_F = [[.001,.12],[.12,.12],[.106,.2],[.12,.29],[.133,.36],[.132,.42],[.112,.47],[.06,.5],[.001,.505]];

function workerLook(o){
  const { female, seed } = o;
  return Object.assign({}, o, {
    skin: pick3(SKINS, seeded(seed)), hair: pick3(HAIRS, seeded(seed + 7)),
    hairStyle: Math.floor(seeded(seed + 3) * 3), mask: seeded(seed + 13) < .45, longSleeve: seeded(seed + 17) < .5,
    pantsC: female ? pick3([0x2b2f3a, 0x3a3f4b, 0x1f2a44], seeded(seed + 23)) : pick3([0x2d3440, 0x3b3530, 0x23272d], seeded(seed + 23)),
    shoe: seeded(seed + 19) < .5 ? 0xe4e6e9 : 0x23262b,
    capC: pick3([0xf1f2f4, 0x9cc3e6, 0xe9b8c8], seeded(seed + 29)),
  });
}
// Thân + đầu + chân (tĩnh). Trả về gốc và nhóm thân để gắn tay.
function buildBody(L){
  const root = new THREE.Group(), hipY = L.seated ? .5 : .92;
  [-1, 1].forEach(sd => {
    const hip = new THREE.Group(); hip.position.set(sd*(L.female ? .07 : .078), hipY, 0); root.add(hip);
    part(hip, cyl(.072, .056, .43), L.pantsC, 0, -.215, 0);
    const knee = new THREE.Group(); knee.position.y = -.43; hip.add(knee);
    part(knee, sph(.055), L.pantsC);
    part(knee, cyl(.052, .04, .43), L.pantsC, 0, -.215, 0);
    part(knee, sph(.045), L.shoe, 0, -.45, .05, 0, 0, 0, 1, .7, 2.3);
    if (L.seated){ hip.rotation.set(-Math.PI/2 + .08, 0, sd*.06); knee.rotation.x = Math.PI/2 - .02; }
    else hip.rotation.z = sd*.03;
  });
  const torso = new THREE.Group(); torso.position.y = hipY; torso.rotation.x = L.seated ? .14 : .05; root.add(torso);
  part(torso, lathe(L.female ? 'hf' : 'hm', L.female ? HIP_F : HIP_M), L.pantsC, 0, 0, 0, 0, 0, 0, 1, 1, .72);
  part(torso, lathe(L.female ? 'tf' : 'tm', L.female ? TORSO_F : TORSO_M), L.color, 0, 0, 0, 0, 0, 0, 1, 1, .68);
  part(torso, cyl(.134, .134, .025, 20), 0x24272c, 0, .118, 0, 0, 0, 0, 1, 1, .73);           // thắt lưng
  const top = L.female ? .5 : .52;
  part(torso, torus(.05, .014), shade(L.color, -.08), 0, top - .01, .005, Math.PI/2, 0, 0, 1, .85, 1); // cổ áo
  part(torso, cyl(.036, .041, .1), L.skin, 0, top + .035, 0);
  const head = new THREE.Group(); head.position.set(0, top + .165, .012); torso.add(head);
  // đầu có vẽ mặt là khối riêng (faceHead); chuyền nền ở xa dùng đầu trơn
  if (!L.texHead) part(head, sph(.1), L.skin, 0, 0, 0, 0, 0, 0, HEAD_S[0], HEAD_S[1], HEAD_S[2]);
  [-1, 1].forEach(sd => part(head, sph(.022), L.skin, sd*.088, -.008, -.004, 0, 0, 0, .5, 1, .8)); // tai
  if (L.female){
    if (L.hairStyle === 2){                                                                     // mũ vải
      part(head, hemi(.116), L.capC, 0, .01, -.005, -.2, 0, 0, 1, 1.02, 1.05);
      part(head, sph(.1), L.hair, 0, -.025, -.05, 0, 0, 0, .95, .9, .7);
    } else {
      part(head, hemi(.108), L.hair, 0, .012, -.012, -.5, 0, 0, .96, 1, 1.06);           // chân tóc cao, lộ trán
      part(head, sph(.1), L.hair, 0, -.03, -.045, 0, 0, 0, .97, 1.05, .86);
      if (L.hairStyle === 0) part(head, sph(.055), L.hair, 0, .03, -.12);                       // búi tóc
      else { part(head, sph(.045), L.hair, 0, 0, -.11); part(head, cyl(.035, .014, .24), L.hair, 0, -.13, -.13, .25, 0, 0); } // đuôi ngựa
    }
  } else {
    part(head, hemi(.107), L.hair, 0, .014, -.012, -.5, 0, 0, .95, 1, 1.05);
    part(head, sph(.1), L.hair, 0, -.005, -.03, 0, 0, 0, .93, .92, .85);
  }
  if (L.mask){
    // khẩu trang ôm theo mặt (cùng tỉ lệ với đầu, nhô ra rất ít)
    const mk = gc('mask', () => new THREE.CylinderGeometry(.1, .094, .072, 20, 1, true, -1.25, 2.5));
    part(head, mk, 0xdfeaf2, 0, -.042, .004, 0, 0, 0, HEAD_S[0]*1.04, 1, HEAD_S[2]*1.05);
  }
  return { root, torso };
}
// Tay: cánh tay (xoay ở vai) + cẳng tay, bàn tay (xoay ở khuỷu)
function buildArm(L){
  const sh = new THREE.Group(), el = new THREE.Group(); el.position.y = -.28; sh.add(el);
  part(sh, sph(L.female ? .046 : .052), L.color);
  part(sh, cyl(L.female ? .044 : .05, .04, .28), L.color, 0, -.14, 0);
  if (L.longSleeve){ part(el, cyl(.04, .034, .22), L.color, 0, -.11, 0); part(el, cyl(.03, .028, .05), L.skin, 0, -.235, 0); }
  else { part(el, cyl(.041, .04, .05), L.color, 0, -.025, 0); part(el, cyl(.034, .027, .21), L.skin, 0, -.145, 0); }
  part(el, sph(.035), L.skin, 0, -.28, .005, 0, 0, 0, .75, 1.25, .55);
  return { sh, el };
}
const armPos = L => ({ x:L.female ? .145 : .168, y:(L.female ? .5 : .52) - .045 });
// Ngồi may: bàn tay đặt LÊN mặt bàn (cao 0,81 m, bàn 0,76) giữ mép vải cạnh kim và đẩy vải qua kim: tiến nhẹ theo vải (feed 0 → 1)
// rồi nhả về nắm lại; tính góc vai / khuỷu bằng IK 2 đoạn (mỗi đoạn 0,28 m) nên tay luôn ở cùng độ cao, không xuyên bàn.
const SEW_SH = { y: .884, z: .0485 }, SEW_L = .28, SEW_HAND_Y = .81;   // vai (hệ người, z so với ghế), độ cao bàn tay
function sewArm(arm, feed){
  const dy = SEW_SH.y - SEW_HAND_Y, dz = (-.11 + .08*feed) + .62 - SEW_SH.z;                   // tay chạm vải ở z = −0,11 … −0,03 trong hệ trạm
  const r = Math.min(Math.hypot(dy, dz), 2*SEW_L*.999), th = Math.atan2(dz, dy);
  const bend = Math.acos((r*r - 2*SEW_L*SEW_L) / (2*SEW_L*SEW_L));
  arm.sh.rotation.x = -(th - bend/2); arm.el.rotation.x = -bend;
}
function armPose(arm, k, busy, seated, phase, feed){
  if (busy && seated) return sewArm(arm, feed == null ? .5 : feed);
  const wob = busy ? Math.sin(phase + k*1.7) * .12 : 0;
  arm.sh.rotation.x = busy ? -.75 + wob : (seated ? -.35 : -.05);
  arm.el.rotation.x = busy ? -.85 - wob*.8 : (seated ? -.55 : -.15);
}
// ---- Khuôn mặt vẽ lên đầu (texture), nhẹ nhàng, giống người thật hơn mắt/mũi khối ----
// Trên khối cầu: chính diện (+z) nằm ở u = 0,25 → x = 128 trên canvas 512 px; xích đạo ở y = 128.
const HEAD_S = [.9, 1.1, .98];
const FACE = {};
function faceMaterial(skin, female, hair, seed){
  const variant = Math.floor(seeded(seed + 31) * 3);
  const key = [skin, female, hair, variant].join('|');
  if (FACE[key]) return FACE[key];
  const tex = canvasTex(512, 256, (g, w, h) => {
    const sk = new THREE.Color(skin), base = '#' + sk.getHexString();
    const dark = (f, a = 1) => { const c = sk.clone().multiplyScalar(f); return `rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${a})`; };
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cx = 128, ey = 114, dx = 26 + variant;
    // bóng hốc mắt rất nhẹ
    [-1, 1].forEach(s => { const r = g.createRadialGradient(cx + s*dx, ey, 2, cx + s*dx, ey, 22); r.addColorStop(0, dark(.88, .35)); r.addColorStop(1, dark(.88, 0)); g.fillStyle = r; g.fillRect(cx + s*dx - 24, ey - 22, 48, 44); });
    // má hồng
    if (female) [-1, 1].forEach(s => { const r = g.createRadialGradient(cx + s*36, 146, 2, cx + s*36, 146, 20); r.addColorStop(0, 'rgba(226,128,128,.28)'); r.addColorStop(1, 'rgba(226,128,128,0)'); g.fillStyle = r; g.fillRect(cx + s*36 - 22, 124, 44, 44); });
    // lông mày
    const hc = new THREE.Color(hair);
    g.strokeStyle = `rgba(${hc.r*255|0},${hc.g*255|0},${hc.b*255|0},.9)`; g.lineCap = 'round';
    [-1, 1].forEach(s => { g.lineWidth = female ? 3 : 4.5; g.beginPath(); g.moveTo(cx + s*(dx - 11), ey - 13 + (female ? 0 : 1)); g.quadraticCurveTo(cx + s*dx, ey - 18 - (female ? 2 : 0), cx + s*(dx + 12), ey - 13); g.stroke(); });
    // mắt: lòng trắng, tròng nâu, con ngươi, điểm sáng, mí trên
    [-1, 1].forEach(s => {
      const x = cx + s*dx, ew = female ? 9.5 : 8.5, eh = female ? 5 : 4.2;
      g.save(); g.beginPath(); g.ellipse(x, ey, ew, eh, 0, 0, Math.PI*2); g.clip();
      g.fillStyle = '#f3efe9'; g.fillRect(x - ew, ey - eh, ew*2, eh*2);
      g.fillStyle = '#4a3326'; g.beginPath(); g.arc(x, ey + .5, 4.4, 0, Math.PI*2); g.fill();
      g.fillStyle = '#16110e'; g.beginPath(); g.arc(x, ey + .5, 2.1, 0, Math.PI*2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x + 1.4, ey - 1, 1.1, 0, Math.PI*2); g.fill();
      g.restore();
      g.strokeStyle = female ? '#2a1d18' : dark(.45); g.lineWidth = female ? 2.2 : 1.6;
      g.beginPath(); g.ellipse(x, ey + .6, ew + .4, eh + .6, 0, Math.PI*1.08, Math.PI*1.92); g.stroke();
      if (female){                                                   // lông mi ở đuôi mắt
        g.lineWidth = 1.2;
        [0, 1, 2].forEach(k => {
          const a = Math.PI*(s > 0 ? 1.62 + k*.13 : 1.38 - k*.13);
          g.beginPath(); g.moveTo(x + Math.cos(a)*(ew + .4), ey + .6 + Math.sin(a)*(eh + .6)); g.lineTo(x + Math.cos(a)*(ew + 3.2), ey + Math.sin(a)*(eh + 3.2)); g.stroke();
        });
      }
      g.strokeStyle = dark(.8, .5); g.lineWidth = 1; g.beginPath(); g.ellipse(x, ey + 1, ew - 1, eh + 1, 0, Math.PI*.15, Math.PI*.85); g.stroke();
    });
    // mũi: bóng sống mũi + cánh mũi
    g.strokeStyle = dark(.78, .45); g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 3, ey + 6); g.quadraticCurveTo(cx - 6, ey + 20, cx - 6, ey + 25); g.stroke();
    g.beginPath(); g.moveTo(cx - 7, ey + 27); g.quadraticCurveTo(cx, ey + 31, cx + 7, ey + 27); g.stroke();
    g.fillStyle = dark(.7, .5); [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s*4, ey + 28, 2, 1.2, 0, 0, Math.PI*2); g.fill(); });
    // miệng hơi cười
    const my = 160;
    if (female){
      g.fillStyle = '#c86d70'; g.beginPath(); g.moveTo(cx - 11, my); g.quadraticCurveTo(cx - 4, my - 4, cx, my - 2); g.quadraticCurveTo(cx + 4, my - 4, cx + 11, my); g.quadraticCurveTo(cx, my + 7, cx - 11, my); g.fill();
      g.strokeStyle = '#8f4447'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx - 11, my); g.quadraticCurveTo(cx, my + 2.5, cx + 11, my); g.stroke();
    } else {
      g.strokeStyle = '#8e5a4c'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 11, my); g.quadraticCurveTo(cx, my + 4, cx + 11, my); g.stroke();
      g.strokeStyle = dark(.82, .4); g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx - 6, my + 7); g.quadraticCurveTo(cx, my + 9, cx + 6, my + 7); g.stroke();
    }
  });
  tex.anisotropy = 4;
  return FACE[key] = new THREE.MeshStandardMaterial({ map:tex, roughness:.62, metalness:0 });
}
// Số phân đoạn đầu theo mức đồ họa (Lite3D.level): cao 36x26, trung bình 20x14, thấp 12x8
const HEAD_GEO = () => { const lv = root.Lite3D ? root.Lite3D.level : 'high', s = lv === 'low' ? [12, 8] : lv === 'mid' ? [20, 14] : [36, 26]; return gc('headGeo' + s[0], () => new THREE.SphereGeometry(.1, s[0], s[1])); };

const WB = {}, WA = {};
function makeWorker(o){
  const L = workerLook(o), g = new THREE.Group();
  L.texHead = true;
  const bk = [L.female, L.seated, L.skin, L.hair, L.hairStyle, L.mask, L.color, L.pantsC, L.shoe, L.capC].join('|');
  const body = new THREE.Mesh(WB[bk] || (WB[bk] = bake(buildBody(L).root)), MAT.body);
  body.castShadow = true; g.add(body);
  const torso = new THREE.Group(); torso.position.y = L.seated ? .5 : .92; torso.rotation.x = L.seated ? .14 : .05; g.add(torso);
  const head = new THREE.Mesh(HEAD_GEO(), faceMaterial(L.skin, L.female, L.hair, o.seed));
  head.position.set(0, (L.female ? .5 : .52) + .165, .012); head.scale.set(...HEAD_S); head.castShadow = true; torso.add(head);
  const ak = [L.female, L.color, L.skin, L.longSleeve].join('|');
  if (!WA[ak]){ const a = buildArm(L); WA[ak] = { up:bake(a.sh, m => m.parent === a.sh), fo:bake(a.el) }; }
  const ap = armPos(L);
  const arms = [-1, 1].map(sd => {
    const sh = new THREE.Group(); sh.position.set(sd*ap.x, ap.y, 0); sh.rotation.z = sd*.07; torso.add(sh);
    const up = new THREE.Mesh(WA[ak].up, MAT.body); up.castShadow = true; sh.add(up);
    const el = new THREE.Group(); el.position.y = -.28; sh.add(el);
    const fo = new THREE.Mesh(WA[ak].fo, MAT.body); fo.castShadow = true; el.add(fo);
    return { sh, el };
  });
  g.userData = { arms, seated:L.seated, phase:seeded(o.seed + 11) * 6, female:!!L.female, seed:o.seed, color:o.color };
  pose(g, false);
  return g;
}
// Tư thế: đang làm thì tay đưa ra trước thao tác, rảnh thì tay hạ xuống
function pose(w, busy){
  const u = w.userData;
  u.arms.forEach((a, k) => armPose(a, k, busy, u.seated, u.phase, u.feed));
}
// Người tĩnh trọn khối (cho các chuyền nền): thân + tay ở tư thế đang may, đặt sau bàn máy
function ghostWorkerGeo(female){
  return gc('gw' + female, () => {
    const L = workerLook({ female, seated:true, color:female ? 0x35599f : 0x2b4f9c, seed:female ? 4 : 9 });
    const wrap = new THREE.Group(), b = buildBody(L); b.root.position.z = -.62; wrap.add(b.root);
    const ap = armPos(L);
    [-1, 1].forEach((sd, k) => {
      const a = buildArm(L); a.sh.position.set(sd*ap.x, ap.y, 0); a.sh.rotation.z = sd*.07; b.torso.add(a.sh);
      armPose(a, k, true, true, 0);
    });
    return bake(wrap);
  });
}

// ================= Máy, bàn =================
function equipKind(o){
  const t = norm(o.equip) + ' ' + norm(o.name);
  if (o.group === 'Là' || /ban la|ban ui|\bla\b|iron/.test(norm(o.equip))) return 'iron';
  if (/giá treo|gia treo|rack/.test(t) || o.group === 'Treo đầu chuyền') return 'rack';
  if (/vat so|overlock|\d chi/.test(t)) return 'overlock';
  if (/hut chi/.test(t)) return 'vacuum';
  if (/ban|kiem|check|qa|kcs|tay/.test(norm(o.equip)) || ['Checker','QA','Hoàn thiện'].includes(o.group)) return 'table';
  return 'sewing';
}
// Màu thân máy theo loại thiết bị
function machineStyle(equip){
  const t = norm(equip);
  if (/vat so|overlock|\d chi/.test(t)) return { key:'ov', c:0xe6e2d6, acc:0x6b7480 };
  if (/xich|2 kim|hai kim|\bfl\b|tran de|mh380|vien/.test(t)) return { key:'l2', c:0xd5d9dc, acc:0x3e5a7e, scale:1.05 };
  if (/\bbo\b|khuy|nut|lung|thua/.test(t)) return { key:'lx', c:0x5d646c, acc:0xc9ced3, scale:1.12 };
  return { key:'l1', c:0xebe7dc, acc:0x7a838d };
}
function lockShape(){
  return gc('lockShape', () => {
    const s = new THREE.Shape();
    s.moveTo(-.30, 0); s.lineTo(.26, 0); s.lineTo(.26, .29);
    s.quadraticCurveTo(.26, .36, .19, .36);
    s.lineTo(-.24, .35); s.quadraticCurveTo(-.30, .35, -.30, .30);
    s.lineTo(-.30, .15); s.lineTo(-.22, .15); s.lineTo(-.21, .25);
    s.lineTo(.08, .25); s.quadraticCurveTo(.12, .25, .12, .21);
    s.lineTo(.12, .05); s.lineTo(-.30, .05); s.lineTo(-.30, 0);
    return s;
  });
}
function boardShape(){
  return gc('boardShape', () => {
    const s = new THREE.Shape();
    s.moveTo(-.7, -.22); s.lineTo(.4, -.22); s.quadraticCurveTo(.75, -.12, .78, 0);
    s.quadraticCurveTo(.75, .12, .4, .22); s.lineTo(-.7, .22); s.lineTo(-.7, -.22);
    return s;
  });
}
const THREAD = [0x2b4f9c, 0xe9e3d6, 0x3b3f46, 0xc7a35a, 0x6d8fbf];
function sewTable(r){
  part(r, rbox(1.22, .035, .62, .02), COL.wood, 0, .742, 0);
  [[-.54, -.26], [.54, -.26], [-.54, .26], [.54, .26]].forEach(([x, z]) => pm(r, cyl(.016, .016, .72, 10), COL.steel, x, .36, z));
  [-.54, .54].forEach(x => pm(r, box(.025, .025, .52), COL.steel, x, .12, 0));
  pm(r, box(1.08, .025, .025), COL.steel, 0, .12, .26);
  part(r, rbox(.16, .14, .22, .02), 0x2c3137, .3, .64, .03);                                    // mô-tơ
  part(r, box(.18, .025, .26), 0x2c3137, .05, .045, -.1, .15, 0, 0);                            // bàn đạp
  pm(r, cyl(.006, .006, .58, 6), COL.rod, .2, .36, .0);
  part(r, rbox(.32, .09, .4, .015), 0x9ba3ab, -.38, .67, .03);                                  // ngăn kéo
}
function threadStand(r, n, x0){
  pm(r, cyl(.008, .008, .66, 8), COL.rod, x0, 1.09, .24);
  pm(r, box(.05 + n*.07, .008, .008), COL.rod, x0, 1.36, .24);
  for (let k = 0; k < n; k++){
    const x = x0 - (n - 1)*.035 + k*.07;
    pm(r, cyl(.025, .025, .006, 12), COL.rod, x, .78, .24);
    part(r, cone(.03, .11), THREAD[(k + Math.round(x0*10)) % THREAD.length], x, .84, .24);
  }
}
function wheelGeo(){
  return gc('wheel', () => mergeParts([
    [new THREE.CylinderGeometry(.068, .068, .035, 20).rotateZ(Math.PI/2), 0x4a525c],
    [new THREE.BoxGeometry(.04, .02, .11).translate(.02, .03, 0), 0xc9ced3],
  ]));
}
function ironGeo(){
  return gc('ironG', () => {
    const s = new THREE.Shape(); s.moveTo(-.12, 0); s.lineTo(.08, 0); s.quadraticCurveTo(.15, .01, .16, .03); s.quadraticCurveTo(.1, .07, -.12, .07); s.lineTo(-.12, 0);
    const body = ext(s, .11, .006);
    return mergeParts([
      [body, 0xdfe3e8], [new THREE.BoxGeometry(.26, .012, .12).translate(0, .003, 0), 0x9aa3ad],
      [new THREE.BoxGeometry(.12, .025, .03).translate(-.02, .1, 0), 0x2d3238],
      [new THREE.BoxGeometry(.02, .03, .03).translate(-.07, .08, 0), 0x2d3238], [new THREE.BoxGeometry(.02, .03, .03).translate(.03, .08, 0), 0x2d3238],
    ]);
  });
}
// Ghế công nhân ngồi (người ở z = −0,62, hông cao 0,5): mặt ghế gỗ, 4 chân thép có giằng, tựa lưng thấp
function chair(r, z = -.66){
  const zb = z - .2;
  part(r, rbox(.42, .04, .4, .015), COL.wood, 0, .44, z);                                      // mặt ghế
  [[-.18, -.17], [.18, -.17], [-.18, .17], [.18, .17]].forEach(([x, dz]) => pm(r, cyl(.014, .014, .42, 8), COL.steel, x, .21, z + dz));
  [-.18, .18].forEach(x => pm(r, box(.02, .02, .34), COL.steel, x, .12, z));                  // giằng chân
  [-.15, .15].forEach(x => pm(r, cyl(.012, .012, .36, 8), COL.steel, x, .62, zb + .02));      // trụ tựa lưng
  part(r, rbox(.38, .14, .03, .012), COL.wood, 0, .74, zb, -.12, 0, 0);                        // tựa lưng
}
function garmentStack(r, x, y, z, n, color, w = .34, d = .26){
  for (let k = 0; k < n; k++) part(r, rbox(w, .03, d, .012), k % 2 ? color : shade(color, -.07), x, y + .015 + k*.032, z, 0, (seeded(k + x*10) - .5)*.08, 0);
}
// Phần tĩnh của từng loại vị trí (gộp sẵn, dùng chung)
const SC = {};
function stationStatic(kind, sty, standing){
  const key = kind + (sty ? sty.key : '') + (standing ? 's' : '');
  if (SC[key]) return SC[key];
  const r = new THREE.Group(), rs = new THREE.Group();   // rs = chồng áo: bake riêng, tô màu theo đơn đang chạy
  if (kind === 'empty') sewTable(r);                                                            // bàn trống (chưa bố trí công đoạn)
  else if (kind === 'sewing' || kind === 'overlock'){
    sewTable(r);
    const h = new THREE.Group(); h.position.set(-.02, .76, .02); h.scale.setScalar(sty.scale || 1); r.add(h);
    if (kind === 'sewing'){
      part(h, ext(lockShape(), .15, .012), sty.c);
      part(h, box(.005, .14, .12), sty.acc, -.31, .24, 0);                                      // nắp đầu máy
      part(h, box(.4, .012, .1), sty.acc, -.02, .362, 0);                                       // nắp trên
      pm(h, box(.09, .006, .11), 0xb9c0c8, -.25, .053, 0);                                      // mặt nguyệt
      pm(h, box(.03, .015, .05), 0xb9c0c8, -.25, .075, -.01);                                   // chân vịt
      pm(h, cyl(.024, .024, .02, 14), 0x5a636c, .19, .17, .085, Math.PI/2, 0, 0);               // núm chỉnh mũi
      part(h, box(.06, .014, .04), 0x30343a, -.15, .238, .07);                                  // đèn LED
      threadStand(r, 2, .5);
    } else {
      part(h, rbox(.36, .22, .26, .05), sty.c, 0, .11, 0);
      part(h, rbox(.2, .16, .012, .03), sty.acc, -.06, .12, .136);
      part(h, rbox(.14, .06, .2, .02), sty.c, -.22, .03, 0);
      pm(h, box(.07, .006, .09), 0xb9c0c8, -.2, .064, 0);
      threadStand(r, 4, .48);
    }
  } else if (kind === 'iron'){
    part(r, rbox(.95, .72, .5, .03), 0xa6aeb7, 0, .36, .05);                                   // tủ hút chân không
    pm(r, box(.9, .02, .45), 0x7d868f, 0, .73, .05);
    pm(r, cyl(.03, .03, .16, 10), 0x7d868f, 0, .82, .05);
    part(r, ext(boardShape(), .05, .012), 0xe7eaee, 0, .9, 0, -Math.PI/2, 0, 0);                 // mặt bàn là
    pm(r, cyl(.02, .02, 1.2, 10), 0x5a636c, -.45, 1.3, .3);                                     // cần treo
    pm(r, cyl(.015, .015, .85, 8), 0x5a636c, -.04, 1.9, .3, 0, 0, Math.PI/2);
    part(r, cyl(.006, .006, .75, 6), 0x2a2d32, .36, 1.5, .25, .2, 0, 0);                        // dây hơi
    part(r, cyl(.17, .17, .62, 20), 0xe9ecef, .78, .31, .3);                                    // nồi hơi
    pm(r, cyl(.04, .04, .02, 14), 0xb9c0c8, .78, .5, .47, Math.PI/2, 0, 0);
    pm(r, hemi(.17), 0xc9ced3, .78, .62, .3);
  } else if (kind === 'vacuum'){
    // máy hút chỉ: bàn đứng + tủ hút (quạt hút, túi lọc) + ống mềm dẫn tới đầu hút trên mặt bàn
    part(r, rbox(1.1, .04, .62, .02), 0xdfe3e7, -.15, .88, 0);
    [[-.62, -.27], [.32, -.27], [-.62, .27], [.32, .27]].forEach(([x, z]) => pm(r, cyl(.018, .018, .86, 10), COL.steel, x, .43, z));
    pm(r, box(.96, .025, .025), COL.steel, -.15, .14, .27);
    garmentStack(rs, -.45, .9, .12, 6, 0xffffff);
    part(r, rbox(.46, .78, .46, .04), 0x2f6fb0, .72, .43, .05);                                 // tủ hút
    part(r, rbox(.3, .16, .012, .02), 0x1e2a36, .72, .66, -.18);                                // bảng điều khiển
    part(r, cyl(.022, .022, .02, 12), 0x3fbf6a, .66, .66, -.19, Math.PI/2, 0, 0);               // nút xanh
    part(r, cyl(.022, .022, .02, 12), 0xe5483c, .78, .66, -.19, Math.PI/2, 0, 0);               // nút đỏ
    pm(r, cyl(.17, .19, .2, 20), 0x8a939c, .72, .92, .05);                                      // mô-tơ quạt hút
    pm(r, cyl(.05, .05, .1, 12), 0x8a939c, .72, 1.06, .05);
    part(r, cyl(.16, .14, .34, 18), 0xe8e4d8, .72, .2, .32);                                    // túi lọc chỉ
    pm(r, box(.04, .05, .2), COL.steel, .72, .05, -.05);
    const hose = gc('vacHose', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(.72, 1.1, .05), new THREE.Vector3(.62, 1.42, .05), new THREE.Vector3(.3, 1.45, -.02),
      new THREE.Vector3(.05, 1.22, -.08), new THREE.Vector3(-.05, 1.02, -.1)]), 24, .028, 8, false));
    part(r, hose, 0x30353c);
    pm(r, cyl(.032, .022, .12, 12), 0xb9c0c8, -.06, .96, -.1);                                 // đầu hút
  } else if (kind === 'table'){
    const hgt = standing ? .9 : .76, big = !standing;
    part(r, rbox(big ? 1.5 : 1.3, .04, big ? .78 : .7, .02), standing ? 0xdfe3e7 : COL.wood, 0, hgt - .02, 0);
    [[-.6, -.3], [.6, -.3], [-.6, .3], [.6, .3]].forEach(([x, z]) => pm(r, cyl(.018, .018, hgt - .04, 10), COL.steel, x*(big ? 1.12 : 1), (hgt - .04)/2, z*(big ? 1.08 : 1)));
    if (standing){
      part(r, box(1.3, .58, .05), 0x7d868f, 0, hgt + .32, .37);                                 // khung hộp đèn soi
      pm(r, cyl(.012, .012, .55, 8), COL.rod, .55, hgt + .28, -.15, .4, 0, 0);
      part(r, cone(.08, .09), 0xe6e9ec, .55, hgt + .52, -.25, Math.PI*.8, 0, 0);
      garmentStack(rs, .42, hgt, 0, 5, 0xffffff);
    } else {
      garmentStack(rs, -.45, hgt, .15, 7, 0xffffff);
      garmentStack(rs, .45, hgt, .15, 4, 0xffffff);
      part(r, box(.3, .2, .25), COL.carton, .95, .1, .45);
      part(r, box(.3, .2, .25), COL.carton, .95, .3, .45);
    }
  } else if (kind === 'rack'){
    [-.75, .75].forEach(x => { pm(r, cyl(.02, .02, 1.85, 10), COL.steel, x, .925, 0); pm(r, box(.04, .04, .6), COL.steel, x, .03, 0); });
    pm(r, cyl(.016, .016, 1.6, 10), COL.rod, 0, 1.85, 0, 0, 0, Math.PI/2);
    // xe đẩy bó hàng
    pm(r, box(.7, .04, .5), COL.steel, .2, .3, -.8); [[-.1, -1], [.5, -1], [-.1, -.6], [.5, -.6]].forEach(([x, z]) => part(r, cyl(.05, .05, .04, 12), 0x1e2228, x, .05, z, Math.PI/2, 0, 0));
    for (let k = 0; k < 6; k++) part(rs, rbox(.3, .1, .22, .02), 0xffffff, .05 + (k % 2)*.32, .37 + Math.floor(k/2)*.1, -.8);
  }
  if (!standing && ['empty', 'sewing', 'overlock', 'table'].includes(kind)) chair(r);
  const res = { matte:bake(r, m => !m.userData.metal), metal:bake(r, m => m.userData.metal), tint:bake(rs) };
  return SC[key] = res;
}
// Áo phẳng nằm trên bàn (thân + 2 tay + cổ, dày 1,2 cm), cổ áo hướng về phía người may (−z); màu đặt qua material.color theo đơn đang chạy
function shirtGeo(){
  return gc('shirtFlat', () => {
    const sh = new THREE.Shape();
    sh.moveTo(-.12, .19); sh.quadraticCurveTo(0, .12, .12, .19);
    sh.lineTo(.2, .17); sh.lineTo(.34, .06); sh.lineTo(.29, -.02); sh.lineTo(.2, .03);
    sh.lineTo(.2, -.2); sh.lineTo(-.2, -.2); sh.lineTo(-.2, .03);
    sh.lineTo(-.29, -.02); sh.lineTo(-.34, .06); sh.lineTo(-.2, .17); sh.lineTo(-.12, .19);
    const g = new THREE.ExtrudeGeometry(sh, { depth:.012, bevelEnabled:false }); g.rotateX(-Math.PI/2);
    return g;
  });
}
const shirtPiece = (x, y, z, sc) => { const m = new THREE.Mesh(shirtGeo(), new THREE.MeshBasicMaterial({ color:COL.garment })); m.position.set(x, y, z); m.scale.setScalar(sc); m.userData.z0 = z; return m; };
// Một vị trí làm việc: phần tĩnh gộp + phần động (vải, kim, bánh đà, bàn là)
function makeStation(kind, o, standing, gType){
  const g = new THREE.Group(), sty = (kind === 'sewing' || kind === 'overlock') ? machineStyle(o.equip) : null;
  const geo = stationStatic(kind, sty, standing);
  if (geo.matte){ const m = new THREE.Mesh(geo.matte, MAT.matte); m.castShadow = m.receiveShadow = true; g.add(m); }
  if (geo.metal){ const m = new THREE.Mesh(geo.metal, MAT.metal); m.castShadow = true; g.add(m); }
  if (geo.tint){   // chồng áo: vật liệu riêng của vị trí, đổi màu theo đơn (userData.tint)
    const tm = MAT.garm.clone(); tm.color.setHex(kind === 'rack' ? COL.garment : COL.finished);
    const m = new THREE.Mesh(geo.tint, tm); m.castShadow = m.receiveShadow = true; g.add(m); g.userData.tint = tm;
  }
  const u = g.userData;
  if (sty){
    const sc = sty.scale || 1;
    u.piece = shirtPiece(-.12, .762, .1, 1); g.add(u.piece);   // áo đang may, nằm trước đầu máy
    u.wheel = new THREE.Mesh(wheelGeo(), MAT.metal); u.wheel.position.set(-.02 + (kind === 'sewing' ? .285 : .2)*sc, .76 + (kind === 'sewing' ? .27 : .12)*sc, .02); g.add(u.wheel);
    if (kind === 'sewing'){
      u.needle = new THREE.Mesh(cyl(.006, .006, .07, 6), mat(0xc9ced3, { metalness:.8, roughness:.3 }));
      u.needleY = .76 + .115*sc; u.needle.position.set(-.02 - .25*sc, u.needleY, .02); g.add(u.needle);
    }
  } else if (kind === 'iron'){
    u.iron = new THREE.Mesh(ironGeo(), MAT.matte); u.ironX = .1; u.iron.position.set(.1, .93, 0); u.iron.castShadow = true; g.add(u.iron);
    u.piece = shirtPiece(.05, .921, 0, 1); g.add(u.piece);
  } else if (kind === 'vacuum'){
    u.piece = shirtPiece(-.1, .898, -.08, .9); g.add(u.piece);
  } else if (kind === 'table'){
    if (standing){ const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .48), new THREE.MeshBasicMaterial({ color:0xf4f8ff })); glow.position.set(0, 1.22, .34); glow.rotation.y = Math.PI; g.add(glow); }
    u.piece = shirtPiece(-.15, (standing ? .9 : .76) - .002, -.05, .9); g.add(u.piece);
  } else if (kind === 'rack'){
    const gm = new THREE.InstancedMesh(garmentGeo(gType || 'ao'), MAT.garm, 9), M = new THREE.Matrix4();
    for (let k = 0; k < 9; k++){ M.makeTranslation(-.6 + k*.15, 1.86, 0); gm.setMatrixAt(k, M); }
    gm.castShadow = true; g.add(gm);
  }
  return g;
}

// ---- Sản phẩm trên móc treo (gộp nhiều khối thành 1 hình, tô màu theo đỉnh) ----
// Gốc tọa độ ở đầu móc (chạm thanh treo), sản phẩm rủ xuống; bề mỏng theo trục x (dọc thanh treo). type = 'ao' | 'quan'.
// color (số hex, tùy chọn) = màu vải; cổ / cạp đậm hơn 25%.
function garmentGeo(type, color){
  const HOOK = 0x9aa5b4, DEN = color != null ? color : COL.garment, STITCH = 0xc9a24a;
  const DEN2 = color != null ? new THREE.Color(color).multiplyScalar(.75).getHex() : 0x1f355f;
  const bx = (w, h, d, x, y, z, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return g; };
  const hook = new THREE.TorusGeometry(.028, .006, 6, 12, Math.PI * 1.3); hook.rotateY(Math.PI/2); hook.translate(0, -.03, 0);
  const parts = [[hook, HOOK], [bx(.012, .05, .012, 0, -.075, 0), HOOK]];
  if (type === 'ao'){
    parts.push(
      [bx(.02, .022, .21, 0, -.13, .09, .35), HOOK], [bx(.02, .022, .21, 0, -.13, -.09, -.35), HOOK],
      [bx(.036, .05, .11, 0, -.12, 0), DEN2],                                   // cổ áo
      [bx(.03, .5, .32, 0, -.4, 0), DEN],                                       // thân áo
      [bx(.032, .02, .02, 0, -.3, 0), STITCH], [bx(.032, .02, .02, 0, -.42, 0), STITCH], // nút áo
      [bx(.028, .4, .085, 0, -.33, .2, -.15), DEN], [bx(.028, .4, .085, 0, -.33, -.2, .15), DEN] // tay áo
    );
  } else {
    parts.push(
      [bx(.02, .025, .36, 0, -.11, 0), HOOK],                                    // thanh ngang móc kẹp
      [bx(.03, .04, .03, 0, -.135, .13), HOOK], [bx(.03, .04, .03, 0, -.135, -.13), HOOK], // kẹp
      [bx(.04, .06, .32, 0, -.17, 0), DEN2],                                     // cạp quần
      [bx(.036, .13, .3, 0, -.26, 0), DEN],                                      // đáy, hông
      [bx(.038, .012, .3, 0, -.205, 0), STITCH],                                 // đường chỉ cạp
      [bx(.032, .5, .14, 0, -.56, .075, -.05), DEN], [bx(.032, .5, .14, 0, -.56, -.075, .05), DEN] // 2 ống quần
    );
  }
  const pos = [], nor = [], col = [], c = new THREE.Color();
  parts.forEach(([g, h]) => {
    const n = g.index ? g.toNonIndexed() : g, p = n.attributes.position.array, q = n.attributes.normal.array;
    c.setHex(h);
    for (let k = 0; k < p.length; k++){ pos.push(p[k]); nor.push(q[k]); }
    for (let k = 0; k < p.length / 3; k++) col.push(c.r, c.g, c.b);
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

function canvasTex(w, h, draw){
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

// ================= Nhà xưởng (dùng chung, tách từ chuyen-may.html 08/10/2026) =================
const FLOOR_TEX = () => gc('floorTex', () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#8b968f'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 9000; k++){ const v = 120 + Math.random()*40; g.fillStyle = `rgba(${v},${v + 12},${v + 6},.18)`; g.fillRect(Math.random()*w, Math.random()*h, 2, 2); }
  g.strokeStyle = 'rgba(70,80,74,.35)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);                    // mạch ron sàn 6 m
}));
const WALL_TEX = () => gc('wallTex', () => canvasTex(16, 256, (g, w, h) => {
  g.fillStyle = '#dde1e4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#6f877b'; g.fillRect(0, h*.86, w, h*.14);                                           // chân tường sơn xanh
  g.fillStyle = '#c8cdd2'; g.fillRect(0, h*.855, w, 3);
}));
const WIN_TEX = () => gc('winTex', () => canvasTex(256, 96, (g, w, h) => {
  g.fillStyle = '#5d6b78'; g.fillRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#e6f1fa'); grd.addColorStop(1, '#b9d2e8');
  g.fillStyle = grd;
  for (let k = 0; k < 4; k++) g.fillRect(8 + k*62, 8, 54, h - 16);
}));
const STRIPE_TEX = () => gc('stripeTex', () => { const t = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#1d1f22'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8b400';
  for (let k = -2; k < 4; k++){ g.beginPath(); g.moveTo(k*32, h); g.lineTo(k*32 + 16, h); g.lineTo(k*32 + 16 + h, 0); g.lineTo(k*32 + h, 0); g.fill(); }
}); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t; });

// Nhà xưởng dùng chung (chuyen-may.html, giam-sat.html): sàn, vạch vàng phân khu, tường + cửa sổ, khung thép, đèn, vật dụng.
// o = { root, sun, b: { minX, maxX, z0, z1 } vùng sản xuất chính, zones: [[x0, x1, z0, z1]] khung vạch vàng thêm,
//       lamps: [[x0, x1, z]] dải đèn LED treo (dọc trục x), lampsZ: [[z0, z1, x]] (dọc trục z), board: material bảng kế hoạch đầu chuyền (tùy chọn), height (m, mặc định 9),
//       arrows: [[x0, z0, x1, z1]] mũi tên vàng giữa lối đi (tùy chọn), noStock: true = không vẽ kệ cuộn vải + pallet thùng ngoài chuyền }
// → { hall: { hx0, hx1, hz0, hz1, W, D, cx, cz }, roof: [mesh ẩn khi nhìn từ trên] }
function buildHall(o){
  const b = o.b, R = o.root, sun = o.sun, HALL_H = o.height || 9, roof = [];
  const hx0 = b.minX - 13, hx1 = b.maxX + 13, hz0 = b.z0 - 10, hz1 = b.z1 + 28;
  const W = hx1 - hx0, D = hz1 - hz0, cx = (hx0 + hx1)/2, cz = (hz0 + hz1)/2;
  const hall = { hx0, hx1, hz0, hz1, W, D, cx, cz };
  // sàn
  const ft = FLOOR_TEX(); ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W/6, D/6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map:ft, color:0xc2c9c5, roughness:.5, metalness:0 }));
  floor.rotation.x = -Math.PI/2; floor.position.set(cx, 0, cz); floor.receiveShadow = true; R.add(floor);
  // vạch vàng phân khu sản xuất
  const lines = new THREE.Group(), yl = 0xe2b100;
  const edge = [];                                                                                  // đường 1 điểm ảnh dọc vạch: nhìn xa / nghiêng vẫn liền
  const rect = (x0, x1, z0, z1) => {
    edge.push(x0, .006, z0, x1, .006, z0, x1, .006, z0, x1, .006, z1, x1, .006, z1, x0, .006, z1, x0, .006, z1, x0, .006, z0);
    part(lines, box(x1 - x0, .002, .1), yl, (x0 + x1)/2, .004, z0); part(lines, box(x1 - x0, .002, .1), yl, (x0 + x1)/2, .004, z1);
    part(lines, box(.1, .002, z1 - z0), yl, x0, .004, (z0 + z1)/2); part(lines, box(.1, .002, z1 - z0), yl, x1, .004, (z0 + z1)/2);
  };
  rect(b.minX - .5, b.maxX + .5, b.z0 - .3, b.z1 + .3);
  (o.zones || []).forEach(z => rect(...z));
  const lm = new THREE.Mesh(bake(lines), new THREE.MeshBasicMaterial({ vertexColors:true })); R.add(lm);
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
  R.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color:yl })));
  // mũi tên vàng giữa lối đi chỉ hướng đi: o.arrows = [[x0, z0, x1, z1]] (từ điểm đầu tới điểm cuối), ~6 m 1 mũi
  if (o.arrows && o.arrows.length){
    const ag = gc('arrowGeo', () => { const a = new THREE.Shape();
      a.moveTo(-.35, .4); a.lineTo(.05, .4); a.lineTo(.45, 0); a.lineTo(.05, -.4); a.lineTo(-.35, -.4); a.lineTo(.05, 0); a.closePath();
      return new THREE.ShapeGeometry(a); });
    const am = new THREE.MeshBasicMaterial({ color:yl, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
    o.arrows.forEach(([x0, z0, x1, z1]) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(L/6)), ry = Math.atan2(-(z1 - z0), x1 - x0);
      for (let k = 0; k < n; k++){
        const t = (k + .5)/n, m = new THREE.Mesh(ag, am);
        m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI/2, ry, 0); m.position.set(x0 + (x1 - x0)*t, .007, z0 + (z1 - z0)*t); R.add(m);
      }
    });
  }
  // tường (mặt quay vào trong, nhìn từ ngoài sẽ trong suốt) + dải cửa sổ
  const wallM = new THREE.MeshStandardMaterial({ map:WALL_TEX(), roughness:.9 });
  const wt = WIN_TEX(); wt.wrapS = THREE.RepeatWrapping;
  [[cx, hz0, 0, W], [cx, hz1, Math.PI, W], [hx0, cz, Math.PI/2, D], [hx1, cz, -Math.PI/2, D]].forEach(([x, z, ry, len]) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, HALL_H), wallM); wall.position.set(x, HALL_H/2, z); wall.rotation.y = ry; wall.receiveShadow = true; R.add(wall);
    const t = wt.clone(); t.needsUpdate = true; t.repeat.set(len/3.2, 1);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(len - 2, 1.7), new THREE.MeshBasicMaterial({ map:t }));
    win.position.set(x + Math.sin(ry)*.04, 6.3, z + Math.cos(ry)*.04); win.rotation.y = ry; R.add(win);
  });
  // khung thép: cột, kèo, xà gồ (gộp 1 khối)
  const st = new THREE.Group(), rf = new THREE.Group(), stC = 0x8592a0;
  const colXs = []; for (let x = hx0 + 1; x <= hx1 - 1; x += 10) colXs.push(x);
  // không đặt cột phía trước để khỏi che chuyền chính; o.midCols = false: bỏ 2 hàng cột giữa nhà (giám sát chuyền treo: cụm ngoài chuyền nằm ở đó)
  const midZ = o.midCols === false ? [] : [b.z1 + 4.5, b.z1 + 15];
  const colZs = [...midZ, hz1 - .4];   // tường phía trước để trống cho camera nhìn vào
  colXs.forEach(x => {
    colZs.forEach(z => {
      pm(st, box(.36, HALL_H, .08), stC, x, HALL_H/2, z - .14); pm(st, box(.36, HALL_H, .08), stC, x, HALL_H/2, z + .14); pm(st, box(.06, HALL_H, .3), stC, x, HALL_H/2, z);
    });
    pm(rf, box(.22, .45, D), stC, x, HALL_H - .1, cz);                                            // kèo trên
    pm(rf, box(.16, .16, D), stC, x, HALL_H - 1.3, cz);                                           // thanh dưới
    for (let z = hz0 + 1; z < hz1 - 1; z += 2.4) pm(rf, box(.08, 1.45, .08), stC, x, HALL_H - .7, z, (Math.floor((z - hz0)/2.4) % 2 ? .9 : -.9), 0, 0);
  });
  for (let z = hz0 + 1.5; z < hz1; z += 3) pm(rf, box(W, .14, .1), stC, cx, HALL_H + .2, z);    // xà gồ
  const steel = new THREE.Mesh(bake(st), MAT.metal); steel.castShadow = true; R.add(steel);
  const roofM = new THREE.Mesh(bake(rf), MAT.metal); R.add(roofM); roof.push(roofM);
  // quấn sọc vàng đen chân cột giữa + bình chữa cháy
  const stripeM = new THREE.MeshStandardMaterial({ map:STRIPE_TEX(), roughness:.6 });
  const ex = new THREE.Group();
  colXs.forEach((x, k) => midZ.forEach((z, j) => {
    const s = new THREE.Mesh(box(.42, 1.2, .42), stripeM); s.position.set(x, .6, z); R.add(s);
    if ((k + j) % 2 === 0){ part(ex, cyl(.09, .09, .5, 14), 0xc8281f, x + .3, .55, z); part(ex, hemi(.09), 0xc8281f, x + .3, .8, z); part(ex, box(.04, .1, .04), 0x1d1f22, x + .3, .9, z); }
  }));
  // đèn LED treo trên chuyền + đèn trần
  const lamps = new THREE.Group(), wires = new THREE.Group();
  const lampLine = (x0, x1, z) => { for (let x = x0; x <= x1; x += 2.4){ part(lamps, box(1.25, .04, .12), 0xffffff, x, 4.4, z); part(wires, box(.006, HALL_H - 1.5 - 4.4, .006), 0x333333, x - .5, (HALL_H - 1.5 + 4.4)/2, z); part(wires, box(.006, HALL_H - 1.5 - 4.4, .006), 0x333333, x + .5, (HALL_H - 1.5 + 4.4)/2, z); } };
  (o.lamps || []).forEach(l => lampLine(...l));
  // dải đèn chạy dọc trục z (chuyền treo đặt dọc): o.lampsZ = [[z0, z1, x]]
  (o.lampsZ || []).forEach(([z0, z1, x]) => { for (let z = z0; z <= z1; z += 2.4){ part(lamps, box(.12, .04, 1.25), 0xffffff, x, 4.4, z); part(wires, box(.006, HALL_H - 1.5 - 4.4, .006), 0x333333, x, (HALL_H - 1.5 + 4.4)/2, z - .5); part(wires, box(.006, HALL_H - 1.5 - 4.4, .006), 0x333333, x, (HALL_H - 1.5 + 4.4)/2, z + .5); } });
  colXs.forEach(x => { for (let z = hz0 + 4; z < hz1 - 2; z += 8){ part(wires, cyl(.25, .32, .3, 16), 0xf6f6f2, x + 5, HALL_H - 1.6, z); } });
  const lampM = new THREE.Mesh(bake(lamps), new THREE.MeshBasicMaterial({ vertexColors:true })); R.add(lampM);
  const wireM = new THREE.Mesh(bake(wires), new THREE.MeshBasicMaterial({ vertexColors:true })); R.add(wireM); roof.push(wireM);
  // vật dụng: kệ cây vải, pallet thùng thành phẩm, bảng kế hoạch, quạt tường, cửa ra
  const pr = new THREE.Group(), rx = b.minX - 7, rz = (b.z0 + b.z1)/2;
  if (!o.noStock) [-.9, .9].forEach(dz => [0, 1, 2].forEach(lv => pm(pr, box(3.4, .05, .05), COL.steel, rx, .3 + lv*.7, rz + dz)));
  if (!o.noStock) [-1.7, 1.7].forEach(dx => [-.9, .9].forEach(dz => pm(pr, box(.06, 2.1, .06), COL.steel, rx + dx, 1.05, rz + dz)));
  if (!o.noStock) [0, 1, 2].forEach(lv => { for (let k = 0; k < 9; k++) part(pr, cyl(.17, .17, 1.75, 16), pick3([0x22335f, 0x2c4a85, 0x3a5b94, 0x1b2a4d], seeded(k + lv*9)), rx - 1.5 + k*.37, .5 + lv*.7, rz, Math.PI/2, 0, 0); });
  const px = b.maxX + 5;
  if (!o.noStock) [-1, 1].forEach(sd => [0, 1, 2].forEach(k => {
    const z = (b.z0 + b.z1)/2 + sd*2.2, x = px + k*1.5;
    part(pr, box(1.2, .14, 1.0), 0xb08a5f, x, .07, z);
    for (let j = 0; j < 3 + Math.floor(seeded(k*3 + sd)*3); j++) part(pr, box(.55, .4, .45), COL.carton, x + (j % 2 ? .28 : -.28), .34 + Math.floor(j/2)*.41, z + (j % 3 === 0 ? .22 : -.22));
  }));
  // quạt công nghiệp gắn tường
  for (let x = hx0 + 6; x < hx1 - 4; x += 12) [[hz1 - .3, Math.PI]].forEach(([z, ry]) => {
    const fz = z + Math.cos(ry)*.25;
    pm(pr, torus(.38, .025), 0x9aa5b4, x, 3.6, fz, 0, ry, 0); pm(pr, cyl(.12, .12, .25, 14), 0x5a636c, x, 3.6, z + Math.cos(ry)*.12, Math.PI/2, 0, 0);
    for (let k = 0; k < 3; k++) part(pr, box(.1, .34, .01), 0x8592a0, x + Math.cos(k*2.09)*.17, 3.6 + Math.sin(k*2.09)*.17, fz, 0, ry, k*2.09 + Math.PI/2);
  });
  // cửa ra vào + biển thoát hiểm
  part(pr, box(3.2, 3.4, .12), 0x9aa5b4, hx1 - .06, 1.7, cz, 0, Math.PI/2, 0);
  const props = bake(pr, m => !m.userData.metal), propsM = bake(pr, m => m.userData.metal);
  [[props, MAT.matte], [propsM, MAT.metal]].forEach(([geo, m]) => { if (geo){ const me = new THREE.Mesh(geo, m); me.castShadow = me.receiveShadow = true; R.add(me); } });
  const exm = bake(ex); if (exm) R.add(new THREE.Mesh(exm, MAT.matte));
  const exit = new THREE.Mesh(box(.12, .35, 1.1), new THREE.MeshBasicMaterial({ color:0x1fa34a })); exit.position.set(hx1 - .1, 3.7, cz); R.add(exit);
  // bảng kế hoạch sản xuất ở đầu chuyền
  if (o.board){
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), o.board); bd.position.set(b.minX - 1.5, 1.75, b.z0 - 1.8); bd.rotation.y = Math.PI; R.add(bd);
  const bl = new THREE.Group(); [-1.1, 1.1].forEach(dx => pm(bl, cyl(.025, .025, 1.1, 8), COL.steel, b.minX - 1.5 + dx, .55, b.z0 - 1.78)); pm(bl, box(2.5, 1.5, .03), 0x9aa5b4, b.minX - 1.5, 1.75, b.z0 - 1.76);
  R.add(new THREE.Mesh(bake(bl), MAT.metal));
  }
  // ánh nắng/đèn đổ bóng phủ toàn xưởng
  const sc = sun.shadow.camera, half = Math.max(W, D)/2 + 2;
  Object.assign(sc, { left:-half, right:half, top:half, bottom:-half, near:1, far:220 }); sc.updateProjectionMatrix();
  sun.position.set(cx + 18, 70, cz + 26); sun.target.position.set(cx, 0, cz);
  return { hall, roof };
}

root.MoHinh3D = { MAT, mat, COL, seeded, pick3, SKINS, HAIRS, GC, gc, box, cyl, sph, hemi, cone, torus, lathe, rrShape, ext, rbox, DUMMY, part, pm, mergeParts, bake, shade, HIP_M, HIP_F, TORSO_M, TORSO_F, workerLook, buildBody, buildArm, armPos, armPose, HEAD_S, FACE, faceMaterial, HEAD_GEO, WB, WA, makeWorker, pose, ghostWorkerGeo, equipKind, machineStyle, lockShape, boardShape, THREAD, sewTable, threadStand, wheelGeo, ironGeo, garmentStack, SC, stationStatic, makeStation, shirtGeo, garmentGeo, canvasTex, FLOOR_TEX, WALL_TEX, WIN_TEX, STRIPE_TEX, buildHall };
})(this);
