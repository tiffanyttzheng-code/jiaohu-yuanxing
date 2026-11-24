/* 图鉴内部：万象站 + 作品百科（共用一个页面容器）。
   设计稿：万象站 351:12374，作品百科 359:12605，画布 1920×1080。
   两页之间的切换是一次「摄像机绕两尊雕像环绕」：雕像和地板线都钉在世界的地面上，
   摄像机沿圆弧从万象站机位转到作品百科机位；卡片和顶栏是界面，不跟摄像机动，沿弧线滑出滑入。
   对外：window.Atlas = { el, enter(scene), leave() }，由 main.js 在进入/退出图鉴子页面时调用。 */
(() => {
'use strict';
const S = 'assets/sub/';
const f = (n) => Math.round(n * 100) / 100;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

/* ---------- 摄像机模型（由两页的手绘地板线和雕像位置反推） ----------
   · 地平线 y=53.5；万象站的两个消失点 (2006.6, -651.1) 相互垂直 → 焦距 f = 1298.5
   · 世界：X 向右、Z 向前；机位 A（万象站）在原点、偏航 0°
   · 机位 B（作品百科）拟合得到 C=(2.6138, 3.6593)，偏航 -100.426°：摄像机绕过神龛，回头望向坐姿雕像
   · 两个机位恰好是绕两尊雕像中点 O=(-0.217, 2.918) 转 100.4° 的一次环绕（O 到两尊雕像距离 1.93 / 1.83） */
const CAM = { f: 1298.5, u0: 960, yh: 53.5, FH: 1127.5, zmin: 0.12 };
const camA = { C: [0, 0], th: 0 };
const camB = { C: [2.6138, 3.6593], th: -100.426 * Math.PI / 180 };
const rot = (a, v) => [v[0] * Math.cos(a) + v[1] * Math.sin(a), -v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const ORB = (() => { // 解 (I - R)·O = C_B
  const c = Math.cos(camB.th), s = Math.sin(camB.th), a = 1 - c, b = -s, cc = s, d = 1 - c, det = a * d - b * cc;
  return [(d * camB.C[0] - b * camB.C[1]) / det, (-cc * camB.C[0] + a * camB.C[1]) / det];
})();
// p=0 是万象站机位，p=1 是作品百科机位；中间沿圆弧环绕，偏航与位置同步转动（刚体运动）
const camAt = (p) => { const th = p * camB.th, r = rot(th, ORB); return { C: [ORB[0] - r[0], ORB[1] - r[1]], th }; };
// 世界点 → 摄像机坐标（x 横向、z 深度）
const toCam = (P, cam) => {
  const dx = P[0] - cam.C[0], dz = P[1] - cam.C[1], c = Math.cos(cam.th), s = Math.sin(cam.th);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
};
const toScreen = (x, z) => [CAM.u0 + CAM.f * x / z, CAM.yh + CAM.FH / z];
// 屏幕地面点 → 世界点（地面上，由 v 求深度）
const toWorld = (u, v, cam) => {
  const z = CAM.FH / (v - CAM.yh), x = (u - CAM.u0) * z / CAM.f, c = Math.cos(cam.th), s = Math.sin(cam.th);
  return [cam.C[0] + x * c + z * s, cam.C[1] - x * s + z * c];
};
const HY = CAM.yh;
const VP = { R: [2006.6, HY], L: [-651.1, HY], W: [-186.6, HY] };

// 缓动：与 style.css 的 --glide 相同的三次贝塞尔 cubic-bezier(.7,0,.2,1)
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let lo = 0, hi = 1; t = x;
    while (hi - lo > 1e-6) { X(t) < x ? (lo = t) : (hi = t); t = (lo + hi) / 2; }
    return Y(t);
  };
}
const glide = bezier(.7, 0, .2, 1);

/* ---------- 小工具：绝对定位盒子 / 图片 / 裁切图 / 等距变换 ---------- */
const box = (l, t, w, h, style = '', inner = '', cls = '', attrs = '') =>
  `<div class="a ${cls}" ${attrs} style="left:${f(l)}px;top:${f(t)}px;width:${f(w)}px;height:${f(h)}px;${style}">${inner}</div>`;
const im = (src, l, t, w, h, style = '') => box(l, t, w, h, style, `<img src="${S}${src}" alt="">`);
// 以包围盒中心定位的等距变换元素：内部 rotate → scaleY → skewX
const iso = (cx, cy, w, h, t, inner, style = '', attrs = '', cls = '') =>
  `<div class="a" style="left:${f(cx)}px;top:${f(cy)}px;width:0;height:0">` +
  `<div class="a ${cls}" ${attrs} style="left:0;top:0;${w ? `width:${f(w)}px;height:${f(h)}px;` : ''}` +
  `transform:translate(-50%,-50%) rotate(${f(t[0])}deg) scale(1,${Math.round(t[1] * 10000) / 10000}) skewX(${f(t[2])}deg);${style}">${inner}</div></div>`;
const bc = (b) => [b[0] + b[2] / 2, b[1] + b[3] / 2];

/* ---------- 地板线：世界里的地面线，每帧按摄像机重新投影 ----------
   每条线保持原稿的远端点，并重画成严格穿过自己的消失点（原稿手绘有 0.1°~2.6° 偏差）；
   再用各自机位把屏幕端点反算回世界坐标。E 是近端（深色），S 是远端（淡出）。 */
const FLOOR_LINES = [ // [组, 颜色, S 远端(屏幕), E 近端(屏幕), 消失点, 机位]
  ...[[[1748.2, 144.46], [-48.8, 950.46]], [[1728.26, 228.42], [329.26, 1100.42]], [[1785.32, 273.38], [808.32, 1100.38]], [[1889.43, 228.25], [1375.43, 1100.25]]]
    .map(([s, e]) => ['a', '#000', s, e, VP.R, camA]),
  ...[[[121.17, 258.53], [1933.17, 924.53]], [[-44.79, 351.54], [1887.21, 1224.54]], [[-250.72, 300.59], [1101.28, 1215.59]], [[461.11, 300.51], [2008.11, 661.51]], [[588.07, 244.5], [1959.07, 439.5]]]
    .map(([s, e]) => ['a', '#000', s, e, VP.L, camA]),
  ...[[[-61.54, 329.78], [326.46, 1189.77]], [[24.41, 287.69], [627.41, 1147.69]], [[119.32, 329.59], [1221.32, 1223.59]], [[119.24, 238.54], [1770.24, 1124.54]], [[162.17, 199.51], [2033.17, 856.51]], [[205.1, 143.49], [2167.1, 540.49]]]
    .map(([s, e]) => ['b', '#666', s, e, VP.W, camB]),
].map(([grp, color, S0, E0, vp, cam]) => {
  const t = dist(S0, vp) / dist(E0, vp);
  const ns = [vp[0] + (E0[0] - vp[0]) * t, vp[1] + (E0[1] - vp[1]) * t];
  return { grp, color, S: toWorld(ns[0], ns[1], cam), E: toWorld(E0[0], E0[1], cam) };
});
{ // 斜线（万象站）：保持中心和长度，方向指向左消失点
  const c = [131, 797.5], hl = 628.17, dir = [c[0] - VP.L[0], c[1] - VP.L[1]], dl = Math.hypot(...dir), u = [dir[0] / dl, dir[1] / dl];
  const a = [c[0] - u[0] * hl, c[1] - u[1] * hl], b = [c[0] + u[0] * hl, c[1] + u[1] * hl];
  FLOOR_LINES.push({ grp: 'a', color: '#000', S: toWorld(a[0], a[1], camA), E: toWorld(b[0], b[1], camA) });
}
// 深色带状地面：上下两条边都穿过右消失点
const onLine = (p0, vp, x) => [x, p0[1] + (vp[1] - p0[1]) * (x - p0[0]) / (vp[0] - p0[0])];
const BAND = (() => {
  const P0 = [-262.5, 905], P3 = [224.5, 1420],   // 地面深色带：上沿抬高、下沿放低，范围加大（原稿 1051 / 1189）
     P1 = onLine(P0, VP.R, 1984.5), P2 = onLine(P3, VP.R, 2022.5);
  return { top: [toWorld(...P0, camA), toWorld(...P1, camA)], bot: [toWorld(...P3, camA), toWorld(...P2, camA)] };
})();

// 线性的 z(s) 在 [s0,s1] 内裁掉 z<zmin 的部分，返回 [lo,hi] 或 null
function clipZ(A, B, s0, s1) {
  let lo = s0, hi = s1; const zmin = CAM.zmin;
  if (Math.abs(B) < 1e-9) return A >= zmin ? [lo, hi] : null;
  const sc = (zmin - A) / B;
  if (B > 0) lo = Math.max(lo, sc); else hi = Math.min(hi, sc);
  return lo < hi ? [lo, hi] : null;
}

// 世界里的线无限长，投影后坐标可能极大，需要再裁到屏幕范围（带边距）内，浏览器才能正常渲染
const VIEW = [-300, -300, 2220, 1380];
function clipSeg(a, b) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  const test = (pp, qq) => { if (Math.abs(pp) < 1e-12) return qq >= 0; const r = qq / pp; if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  if (test(-dx, a[0] - VIEW[0]) && test(dx, VIEW[2] - a[0]) && test(-dy, a[1] - VIEW[1]) && test(dy, VIEW[3] - a[1]))
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  return null;
}
function clipPoly(pts) {
  const edges = [[0, VIEW[0], 1], [0, VIEW[2], -1], [1, VIEW[1], 1], [1, VIEW[3], -1]];
  for (const [ax, lim, sg] of edges) {
    const out = [], inside = (q) => (q[ax] - lim) * sg >= 0;
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length], ci = inside(cur), pi = inside(prev);
      if (ci !== pi) { const t = (lim - prev[ax]) / (cur[ax] - prev[ax]); out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]); }
      if (ci) out.push(cur);
    }
    pts = out; if (!pts.length) break;
  }
  return pts;
}
const lerp2 = (a, b, s) => ({ x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s });
const scr = (q) => toScreen(q.x, q.z);

function floorSVG() {
  const defs = [], A = [], B = [];
  FLOOR_LINES.forEach((L, i) => {
    defs.push(`<linearGradient id="g${i}" gradientUnits="userSpaceOnUse"><stop stop-color="${L.color}"/><stop offset="1" stop-color="${L.color}" stop-opacity="0"/></linearGradient>`);
    (L.grp === 'a' ? A : B).push(`<path class="ln" pathLength="1" fill="none" stroke="url(#g${i})" style="--d:${(i % 9) * 0.05}s"/>`);
  });
  defs.push('<linearGradient id="gbd" gradientUnits="userSpaceOnUse" x1="880" y1="19.5" x2="880" y2="1175.5"><stop stop-color="#D9D9D9" stop-opacity="0"/><stop offset="1" stop-color="#737373"/></linearGradient>');
  defs.push('<linearGradient id="gtop" x1="0" y1="0" x2="0" y2="1"><stop offset=".17062" stop-color="#D9D9D9"/><stop offset="1" stop-color="#737373" stop-opacity="0"/></linearGradient>');
  return `<svg class="floor" viewBox="0 0 1920 1080" width="1920" height="1080"><defs>${defs.join('')}</defs>` +
    `<g class="fl ga"><polygon class="band" fill="url(#gbd)"/>${A.join('')}</g>` +
    `<g class="fl gb"><rect class="topg" x="-16" y="-58" width="1936" height="427" fill="url(#gtop)"/>${B.join('')}</g></svg>`;
}

/* ---------- 顶部栏（两页共用，新稿 359:12820 / 351:12374）：返回箭头 + 搜索框 | 图鉴 · 当前页 ﹀ | ✕ ----------
   两页的右侧标签位置不同（作品百科页的标签更宽），用 sc-x / sc-w 两套，按场景显示其一 */
const tabT = (l, t, w, txt, cls) => box(l, t, w, 60.3, 'display:flex;align-items:center;justify-content:center', `<div class="tab" style="width:${w - 24}px;font-size:40px;transform:translateY(-2px) rotate(-.38deg)">${txt}</div>`, cls);
const topBar = () => box(0, 0, 0, 0, '', [
  box(45, 29, 1779, 72, 'background:rgba(227,227,227,.7);border-radius:15px'),
  box(76, 41, 29, 48, '', `<img src="assets/chars/icon-back.png" alt="" style="position:absolute;left:-9.5px;top:9.5px;width:48px;height:29px;transform:rotate(90deg)">`, 'closer back2', 'data-hot'),
  box(126, 37, 284, 55, 'background:rgba(255,255,255,.7);border-radius:10px'),
  iso(346 + 58.788 / 2, 42 + 46.974 / 2, 51.559, 34.927, [14.85, 1, 0], `<img src="${S}icon-search.png" alt="" style="width:100%;height:100%">`),
  box(1400, 38, 120, 55, 'background:#fff;border-radius:10px', '', 'sc-x'), tabT(1409, 36, 144, '图鉴', 'sc-x'),
  box(1537, 44, 42, 42, '', `<img src="${S}icon-folder.png" alt="" style="width:100%;height:100%">`, 'sc-x'),
  box(1597, 37, 210, 55, 'background:#fff;border-radius:10px', '', 'sc-x'), tabT(1608, 36, 168, '万象站', 'sc-x'),
  box(1748, 51, 48, 29, '', `<img src="assets/chars/icon-chev.png" alt="" style="width:100%;height:100%">`, 'sc-x'),
  box(1597, 37, 210, 55, '', '', 'sc-x tbtab', 'data-hot'),
  box(1371, 38, 120, 55, 'background:#fff;border-radius:10px', '', 'sc-w'), tabT(1380, 36, 144, '图鉴', 'sc-w'),
  box(1508, 44, 42, 42, '', `<img src="${S}icon-folder.png" alt="" style="width:100%;height:100%">`, 'sc-w'),
  box(1566, 37, 241, 55, 'background:#fff;border-radius:10px', '', 'sc-w'), tabT(1566, 36, 192, '作品百科', 'sc-w'),
  box(1748, 51, 48, 29, '', `<img src="assets/chars/icon-chev.png" alt="" style="width:100%;height:100%">`, 'sc-w'),
  box(1566, 37, 241, 55, '', '', 'sc-w tbtab', 'data-hot'),
  box(1845, 41, 42, 45, '', `<img src="${S}icon-close.png" alt="" style="width:100%;height:100%">`, 'closer', 'data-hot'),
  `<div class="tbmenu"><div class="swtch" data-to="wiki" data-hot>作品百科</div><div class="swtch" data-to="xiang" data-hot>万象站</div></div>`,
].join(''), 'barw');

/* ---------- 万象站：4 张固定卡片，选中的一张放大（轮播） ---------- */
const XNAMES = ['经典剑', '美食', '机构/阵营', '生物'];
const xcards = XNAMES.map((n, i) =>
  `<div class="xc sxi" data-card="${i}" data-kind="x" data-hot style="--i:${3 - i};--ox:250px;--oy:-80px;--os:.9">` +
  `<div class="n"><i class="g"></i><i class="b1"></i><img class="im" src="${S}x-card-img.svg" alt=""><span class="nm">${n}</span></div>` +
  `<div class="s"><img class="sb" src="${S}x-sel-bg.svg" alt=""><i class="tp"></i><img class="sb1" src="${S}x-sel-bg1.svg" alt=""><img class="si" src="${S}x-sel-image.svg" alt=""><span class="tn">${n}</span></div></div>`).join('');
// 轮播布局：普通卡 281×349，选中卡缩小 10% 至 327.8448×443.7，保持原垂直中心；间距取自设计稿（普通-普通 20.07，普通-选中 11.5/11.9）
const XW = { n: [281.082, 349.424, 504], s: [327.8448, 443.7, 456.65], gap: { nn: 20.07, ns: 11.5, sn: 11.9 }, x0: 626 };
function layoutX(sel) {
  let x = XW.x0;
  [...el.querySelectorAll('.xc')].forEach((c, i) => {
    const on = i === sel, [w, h, t] = on ? XW.s : XW.n;
    Object.assign(c.style, { left: f(x) + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    c.classList.toggle('sel', on);
    x += w + (on ? XW.gap.sn : (i + 1 === sel ? XW.gap.ns : XW.gap.nn));
  });
}

/* ---------- 作品百科：8 张卡片轮换，屏幕上同时排 6 个弧形卡位 ----------
   8 个分类首尾相接成一圈（基本工具 罪恶 神龛 圣物 宇宙质生物 宇宙质美食 武器 认证作者作品），
   每次转动一格：左端的卡沿弧线滑出画面，右侧的卡从画面外滑入；中间（第 3 卡位）的「圣物」是正对镜头的平面卡。
   卡位的位置、旋转角取自设计稿（旋转角：用卡片自己的位置拟合一条平滑曲线，取各卡中心处的切线，中心卡 0°；
   scaleY = cos(旋转角)，skewX = atan(sin(旋转角))，竖边保持竖直）。卡片在卡位之间用 Catmull-Rom 曲线插值，
   两端各外推一个画面外的卡位用来淡出/淡入。 */
const WN = ['基本工具', '罪恶', '神龛', '圣物', '宇宙质生物', '宇宙质美食', '武器', '认证作者作品'];
const NW = WN.length, NS = 6, MID = 3;                              // 总数、同屏卡位数、中间卡位
const anchorOf = (tx, a) => { const r = a * Math.PI / 180; return [tx.right - tx.w / 2 + tx.w / 2 * Math.cos(r), tx.top + tx.h / 2 + tx.w / 2 * Math.sin(r)]; };
const slotOf = (img, tb, tx, rot) => [...bc(img), ...bc(tb), ...anchorOf(tx, rot), rot];   // [图心x,y, 名牌心x,y, 文字右端x,y, 旋转角]
const SLOTS = [
  slotOf([-48, 453.82, 288.526, 355.439], [-41.2, 759.72, 273.954, 116.882], { right: 156.01, top: 782.45, w: 131.148, h: 74.018 }, -17.90),
  slotOf([293, 327.71, 277.495, 390.857], [299.54, 634.56, 263.48, 150.511], { right: 464.6, top: 675, w: 62.6, h: 65.88 }, -19.34),
  slotOf([625, 204, 279.192, 386.296], [631.58, 510.73, 265.091, 146.18], { right: 786.98, top: 552, w: 62.983, h: 64.851 }, -15.38),
  [969 + 148.5, 192 + 142.5, 976 + 141, 496 + 25, 1151, 521.3, 0],
  slotOf([1325, 218, 292.722, 335.226], [1331.9, 523.18, 277.938, 97.689], { right: 1546.57, top: 532.93, w: 166.566, h: 70.58 }, 14.23),
  slotOf([1670, 305, 270.4, 407.852], [1676.37, 611.9, 256.744, 166.648], { right: 1872.86, top: 633, w: 153.864, h: 111.906 }, 20.28),
];
const SLOT_EXT = (() => {                                            // 卡位 -2 … 7：两端线性外推（位置），旋转角取端点值
  const ext = (a, b) => a.map((v, k) => (k === 6 ? v : 2 * v - b[k]));
  const L1 = ext(SLOTS[0], SLOTS[1]), L2 = ext(L1, SLOTS[0]), R1 = ext(SLOTS[NS - 1], SLOTS[NS - 2]), R2 = ext(R1, SLOTS[NS - 1]);
  return [L2, L1, ...SLOTS, R1, R2];
})();
const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const sampleSlot = (m) => {                                          // m：浮点卡位，-1 … 6
  const s = clamp(m, -1, NS) + 2, k = Math.min(Math.floor(s), 7), t = s - k, P = SLOT_EXT;
  return P[k].map((_, c) => cr(P[k - 1][c], P[k][c], P[k + 1][c], P[k + 2][c], t));
};
const img = `<img src="${S}card-image.png" alt="" style="width:100%;height:100%">`;
const wcards = WN.map((n, i) => {
  const g = SLOTS[Math.min(i, NS - 1)], ctr = [g[0], g[1]];
  // 入场/退场沿弧线从消失点方向过来：偏移 = 指向消失点的向量 × 0.2，并缩小
  const ox = (VP.W[0] - ctr[0]) * 0.2, oy = (VP.W[1] - ctr[1]) * 0.2;
  return `<div class="wc swi" data-ord="${i}" style="--i:${Math.min(i, NS - 1)};--ox:${f(ox)}px;--oy:${f(oy)}px;--os:.7;--cx:${f(ctr[0])}px;--cy:${f(ctr[1])}px"><div class="wl">` +
    `<div class="wp wi" data-card="${i}" data-kind="w" data-hot style="width:297px;height:285px">${img}</div>` +
    `<div class="wp np wb" style="width:282px;height:50px"><div class="tbg"></div></div>` +
    `<div class="wp np cardname wn" style="font-size:32px;letter-spacing:2.24px">${n}</div>` +
    `</div></div>`;
}).join('');

/* ---------- 雕像（钉在地面上，由摄像机投影决定位置和大小） ----------
   外框取「大」姿态的尺寸，每帧用 translate + scale 摆放；大小遵循透视规律：高度 = c·(底点 y − 地平线)。
   环带和底座是大雕像的子元素，随雕像缩放；雕像变小时淡出。 */
const ST = {
  sit: { w: 469, h: 1233, a: [355.5, 1181], b: [204.5, 415], opA: .57, opB: .38, bigV: 1181 }, // a：万象站姿态的底点；b：作品百科姿态的底点
  shr: { w: 603, h: 766, a: [1493.5, 367], b: [1123.5, 1050], opA: .37, opB: .62, bigV: 1050 },
};
Object.values(ST).forEach((s) => {
  s.P = toWorld(s.a[0], s.a[1], camA);                              // 世界位置：由万象站姿态反算
  s.c = s.h / (s.bigV - CAM.yh);                                    // 透视常数：高度 = c·(v − yh)
  const q = toCam(s.P, camB), uv = toScreen(q.x, q.z);              // 刚性摄像机下落在 B 机位的位置
  s.res = [s.b[0] - uv[0], s.b[1] - uv[1]];                         // 与设计稿的残差（≤40px），随进度逐步补上，保证终点和设计稿一致
});
/* ---------- 环带：围着雕像腰部的水平圆环，逐帧程序绘制 ----------
   环是地面平行的圆，投影成椭圆（长半轴 a、短半轴 b、倾角 tilt，数值量自设计稿的 ribbon 图）。
   一圈灰色斜切瓦片沿椭圆缓慢公转（90 秒一圈），椭圆本身不动；前半圈（屏幕下半）盖在雕像前面，后半圈藏在雕像后面。 */
const RING = {
  rx: { c: [138, 342], a: 413, b: 190, tilt: 21, clip: [-313, -67, 908, 684] },
  rw: { c: [295.7, 449.7], a: 320, b: 147, tilt: 3 },
};
const TILES = (() => {                                              // 固定的瓦片表：长短不一、间隔不一，凑满 360°
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const raw = []; let sum = 0;
  for (let i = 0; i < 26; i++) { const len = 6 + rnd() * 16, gap = 2 + rnd() * 5; raw.push([len, gap]); sum += len + gap; }
  let t = 0; return raw.map(([len, gap]) => { const o = { t0: t * 360 / sum, len: len * 360 / sum }; t += len + gap; return o; });
})();
function ringSVG(k, layer) {
  const r = RING[k], clip = r.clip ? ` clip-path="url(#rc${k})"` : '';
  const cp = r.clip ? `<clipPath id="rc${k}${layer}"><rect x="${r.clip[0]}" y="${r.clip[1]}" width="${r.clip[2]}" height="${r.clip[3]}"/></clipPath>` : '';
  return `<svg class="ring ${k} ${layer}" width="1" height="1" style="overflow:visible"><defs>${cp}</defs><g class="rg"${r.clip ? ` clip-path="url(#rc${k}${layer})"` : ''}></g></svg>`;
}
const statues =
  `<div class="sta sit" style="width:${ST.sit.w}px;height:${ST.sit.h}px">` +
    ringSVG('rx', 'back') + `<img class="stbody" src="${S}statue-sit.png" alt="">` + ringSVG('rx', 'front') +
  `</div>` +
  `<div class="sta shr" style="width:${ST.shr.w}px;height:${ST.shr.h}px">` +
    ringSVG('rw', 'back') + `<img class="stbody" src="${S}statue-shrine.png" alt="">` + ringSVG('rw', 'front') +
  `</div>`;

/* ---------- 底部模块标签 ---------- */
const tri = (l, t, w, h, rt, inner, extra = '') => box(l, t, w, h, '', `<div class="a" style="left:50%;top:50%;width:${rt.w}px;height:${rt.h}px;transform:translate(-50%,-50%) rotate(90deg) ${extra}"><div class="a" style="inset:${inner}"><img src="${S}${rt.src}" alt="" style="width:100%;height:100%"></div></div>`);
const labX = [
  `<div class="a big" style="left:1843px;top:949px;font-size:96px;transform:translateX(-100%)">万象站</div>`,
  `<div class="a lgray" style="left:1535px;top:963px;font-size:64px;transform:translateX(-100%)">作品百科</div>`,
  box(1290, 950, 268, 89, 'border:8px solid #a3a3a3;border-radius:27px'),
  box(1567, 939, 296, 111, 'border:8px solid #000;border-radius:27px'),
  box(1290, 950, 268, 89, '', '', 'swtch', 'data-hot data-to="wiki"'),
  tri(1877, 969, 30, 61, { w: 61, h: 30, src: 'tri-right.svg' }, '-15.32% -5.85% -16.67% -5.85%'),
].join('');
const labW = [
  `<div class="a big" style="left:420px;top:946px;font-size:96px;transform:translateX(-100%)">作品百科</div>`,
  `<div class="a lgray" style="left:639px;top:971px;font-size:64px;transform:translateX(-100%)">万象站</div>`,
  box(447, 958, 216, 89, 'border:8px solid #a3a3a3;border-radius:27px'),
  box(72, 936, 361, 111, 'border:8px solid #000;border-radius:27px'),
  box(447, 958, 216, 89, '', '', 'swtch', 'data-hot data-to="xiang"'),
  tri(24, 957, 33.75, 70.148, { w: 70.148, h: 33.75, src: 'tri-left.svg' }, '-13.67% -5.03% -14.81% -5.03%', 'scaleY(-1)'),
].join('');

/* ---------- 详情占位 ---------- */
const detail = `<div class="det"><div class="dim"></div><div class="dc"><div class="dimg"><img src="${S}card-image.png" alt=""></div><div class="dn"></div><div class="dsub">详情页占位</div><div class="dhint">Esc / 点击空白处返回</div></div></div>`;

/* ---------- 组装 ---------- */
const html = floorSVG() +
  `<div class="sc">${box(0, 604, 526, 476, 'overflow:hidden', `<img class="crop" src="${S}dots-src.png" alt="" style="left:-100.17%;top:-83.83%;width:260.37%;height:287.78%">`, 'sxi')}${xcards}${wcards}</div>` +
  `<div class="stat">${statues}</div>` +
  `<div class="lab lx sxi" style="--ox:170px;--oy:30px;--os:1;--i:0">${labX}</div><div class="lab lw swi" style="--ox:-170px;--oy:30px;--os:1;--i:0">${labW}</div>` +
  topBar() + detail;

const el = document.createElement('section');
el.className = 'page sub atlas pre'; el.dataset.p = 'atlas'; el.dataset.scene = 'xiang'; el.innerHTML = html;
document.getElementById('pages').appendChild(el);

/* ---------- 摄像机驱动：每帧更新雕像、环带和地板线 ---------- */
const $ = (q) => el.querySelector(q);
const stEl = { sit: $('.sta.sit'), shr: $('.sta.shr') }, stBody = { sit: stEl.sit.querySelector('.stbody'), shr: stEl.shr.querySelector('.stbody') };
const ringEl = { rx: [...el.querySelectorAll('.ring.rx')], rw: [...el.querySelectorAll('.ring.rw')] }, ringOp = { rx: 0, rw: 0 };
const lineEls = [...el.querySelectorAll('.ln')], gradEls = FLOOR_LINES.map((_, i) => el.querySelector('#g' + i));
const gA = $('.fl.ga'), gB = $('.fl.gb'), bandEl = $('.band');
let p = 0, enterFade = 1, R = 0, rAnim = null;   // R：作品百科轮换的进度（浮点，每转一格 +1）
const wcAll = [...el.querySelectorAll('.wc')];
const wcParts = wcAll.map((w) => ({ w, l: w.querySelector('.wl'), im: w.querySelector('.wi'), pl: w.querySelector('.wb'), tx: w.querySelector('.wn') }));
const slotPos = (i, r = R) => { const m = (((i - r + 1) % NW) + NW) % NW - 1; return m; };   // 卡片 i 当前所在的卡位（-1 … 7）
let cardDt = 0;
function renderCards() {
  wcParts.forEach((c, i) => {
    // 悬停：角度回正（不再倾斜）并略微放大，随 hv 平滑过渡
    c.hv = (c.hv || 0) + ((c.w.classList.contains('hot') ? 1 : 0) - (c.hv || 0)) * Math.min(1, cardDt * 12);
    const hv = c.hv < .002 ? 0 : c.hv, he = hv * hv * (3 - 2 * hv);
    const m = slotPos(i), v = sampleSlot(m); v[6] *= 1 - he; const rd = v[6] * Math.PI / 180, tf = `rotate(${f(v[6])}deg) scale(1,${Math.round(Math.cos(rd) * 10000) / 10000}) skewX(${f(Math.atan(Math.sin(rd)) * 180 / Math.PI)}deg) scale(${f(1 + 0.08 * he)})`;
    const op = clamp(Math.min(m + 1, NS - m));
    c.im.style.transform = `translate(${f(v[0])}px,${f(v[1])}px) translate(-50%,-50%) ${tf}`;
    c.pl.style.transform = `translate(${f(v[2])}px,${f(v[3])}px) translate(-50%,-50%) ${tf}`;
    c.tx.style.transform = `translate(${f(v[2])}px,${f(v[3])}px) translate(-50%,-50%) ${tf}`;   // 名字居中在名牌中心（不再右对齐，长名字不会溢出、短名字不偏）
    c.l.style.opacity = op; c.w.style.pointerEvents = op < .6 ? 'none' : ''; c.w.style.zIndex = 100 - Math.round(Math.abs(m - MID) * 10);
    c.w.dataset.slot = Math.round(m);
  });
}

function renderStatues(P) {
  const cam = camAt(P), w = smooth(P);
  for (const k of ['sit', 'shr']) {
    const s = ST[k], q = toCam(s.P, cam), box_ = stEl[k], body = stBody[k];
    if (q.z < CAM.zmin) { box_.style.visibility = 'hidden'; ringOp[k === 'sit' ? 'rx' : 'rw'] = 0; continue; }
    const uv = toScreen(q.x, q.z), u = uv[0] + s.res[0] * w, v = uv[1] + s.res[1] * w;   // 位置：投影 + 逐步补上的残差
    const H = s.c * (v - CAM.yh), sc = H / s.h;                                             // 大小：透视规律
    box_.style.visibility = 'visible';
    box_.style.transform = `translate(${f(u - sc * s.w / 2)}px,${f(v - H)}px) scale(${Math.round(sc * 10000) / 10000})`;
    const near = clamp((q.z - CAM.zmin) / 0.3);                                             // 贴近镜头时淡出
    body.style.opacity = (s.opA + (s.opB - s.opA) * w) * near * enterFade;
    const big = clamp((sc - 0.55) / 0.3) * near * enterFade;                                 // 大雕像才带环带和底座
    ringOp[k === 'sit' ? 'rx' : 'rw'] = big;
  }
}

const RAD = Math.PI / 180;
function drawRings(now) {
  for (const k of ['rx', 'rw']) {
    const r = RING[k], op = ringOp[k], [back, front] = ringEl[k];
    for (const svg of [back, front]) svg.style.opacity = op;
    if (op < 0.01) continue;
    const spin = (now / 90000) * 360, co = Math.cos(r.tilt * RAD), si = Math.sin(r.tilt * RAD);
    const pt = (t, m) => { const x = r.a * m * Math.cos(t * RAD), y = r.b * m * Math.sin(t * RAD); return [r.c[0] + x * co - y * si, r.c[1] + x * si + y * co]; };
    let dB = '', dF = '';
    for (const tl of TILES) {
      const t0 = tl.t0 + spin, n = Math.max(2, Math.ceil(tl.len / 4)), mid = t0 + tl.len / 2;
      const front_ = Math.sin(mid * RAD) > 0, wd = 0.075 * (1 + 0.45 * Math.sin(mid * RAD));   // 近大远小：前半圈更宽
      const o = [], i_ = [];
      for (let j = 0; j <= n; j++) { const t = t0 + tl.len * j / n, sk = tl.len * 0.18 * (j / n - 0.5); o.push(pt(t + sk, 1 + wd)); i_.push(pt(t - sk, 1 - wd)); }
      const d = 'M' + o.concat(i_.reverse()).map((q) => f(q[0]) + ' ' + f(q[1])).join('L') + 'Z';
      if (front_) dF += d; else dB += d;
    }
    back.querySelector('.rg').innerHTML = `<path d="${dB}" fill="#b1b1b1" fill-opacity=".7"/>`;
    front.querySelector('.rg').innerHTML = `<path d="${dF}" fill="#b1b1b1"/>`;
  }
}
function placeLine(L, i, cam) {
  const a = toCam(L.E, cam), b = toCam(L.S, cam), path = lineEls[i], g = gradEls[i];
  const A0 = a.z, B0 = b.z - a.z;
  const rng = clipZ(A0, B0, -30, 30);                             // 世界里的线是无限长的：两个方向都延伸，只裁掉镜头后方
  if (!rng) { path.setAttribute('d', ''); return; }
  const seg = clipSeg(scr(lerp2(a, b, rng[0])), scr(lerp2(a, b, rng[1])));
  if (!seg) { path.setAttribute('d', ''); return; }
  path.setAttribute('d', `M${f(seg[0][0])} ${f(seg[0][1])}L${f(seg[1][0])} ${f(seg[1][1])}`);
  const gr = clipZ(A0, B0, 0, 1) || rng, g0 = scr(lerp2(a, b, gr[0])), g1 = scr(lerp2(a, b, gr[1]));
  g.setAttribute('x1', f(g0[0])); g.setAttribute('y1', f(g0[1])); g.setAttribute('x2', f(g1[0])); g.setAttribute('y2', f(g1[1]));
}
function renderFloor(P) {
  const cam = camAt(P);
  FLOOR_LINES.forEach((L, i) => placeLine(L, i, cam));
  // 两套地板线都是世界里的线：中段重叠显示（环绕时地板不空），只在两端各自单独出现
  gA.style.opacity = 1 - smooth((P - 0.45) / 0.35);
  gB.style.opacity = smooth((P - 0.2) / 0.35);
  // 带状地面：上下两条边各自裁剪后围成多边形
  const edge = (pair) => {
    const a = toCam(pair[0], cam), b = toCam(pair[1], cam), r = clipZ(a.z, b.z - a.z, 0, 1);  // 带状地面在世界里是有限的一块，不无限延伸
    return r ? [scr(lerp2(a, b, r[0])), scr(lerp2(a, b, r[1]))] : null;
  };
  const t = edge(BAND.top), bt = edge(BAND.bot);
  const poly = t && bt ? clipPoly([t[0], t[1], bt[1], bt[0]]) : [];
  bandEl.setAttribute('points', poly.map((q) => f(q[0]) + ',' + f(q[1])).join(' '));
}
function render() { renderStatues(p); renderFloor(p); renderCards(); }

let anim = null, fadeAnim = null, raf = 0;
function frame(now) {
  raf = 0;
  if (anim) {
    const u = clamp((now - anim.t0) / anim.dur);
    p = anim.from + (anim.to - anim.from) * glide(u);       // 速度变化全由缓动曲线决定
    if (u >= 1) { p = anim.to; anim = null; }
  }
  if (fadeAnim) {
    const u = clamp((now - fadeAnim.t0) / fadeAnim.dur);
    enterFade = u; if (u >= 1) fadeAnim = null;
  }
  if (rAnim) {
    const u = clamp((now - rAnim.t0) / rAnim.dur);
    R = rAnim.from + (rAnim.to - rAnim.from) * glide(u);
    if (u >= 1) { R = rAnim.to; rAnim = null; }
  }
  render(); drawRings(now);
  if (anim || fadeAnim || rAnim) raf = requestAnimationFrame(frame);
}
let lastT = 0;
requestAnimationFrame(function ringLoop(now) {
  const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
  if (active) {
    drawRings(now);
    // 连续转动：不在缓动转动中、没有悬停卡片/详情时，转速平滑升到匀速；否则平滑降到 0
    // 按住拖动时完全停下（由手带着走）；松手后先按松手速度惯性滑行并衰减，再平滑加速回匀速。刚拖完时鼠标还停在卡上也照样恢复转动
    const free = scene === 'wiki' && !detailOpen && !rAnim && !drag && !el.classList.contains('pre') && !fadeAnim && (afterDrag || !el.querySelector('.wc.hot'));
    if (!drag && flingV) { R += flingV * dt; flingV *= Math.exp(-dt * 3.5); if (Math.abs(flingV) < 0.03) flingV = 0; }
    drift += ((free && !flingV ? DRIFT : 0) - drift) * Math.min(1, dt * 2.5);
    cardDt = dt; if (drift > 0.0005 && !drag) R += drift * dt;
    if (scene === 'wiki') renderCards();
  }
  requestAnimationFrame(ringLoop);
});   // 环带公转：页面打开期间持续转
// 作品百科：平时匀速连续转动（传送带式，不停顿）；点击/按键时用缓动曲线转到目标，转完再平滑加速回匀速
const DRIFT = 0.3;                                                   // 匀速：每秒 0.3 张卡
let drift = 0;                                                       // 当前转速（平滑升降）
/* 按住卡片拖动：按下即停，左右拖 = 卡片跟手沿弧线移动（横向 342px ≈ 一个卡位）；松手带惯性，然后恢复自动转。
   拖动超过 6px 才算拖，没超过就是普通点击（照旧进入分类） */
const SLOT_W = 342;
let drag = null, flingV = 0, dragMoved = false, afterDrag = false, dragEndAt = -1e9;
el.addEventListener('dragstart', (e) => e.preventDefault());       // 卡片是图片：不让浏览器启动原生「拖图片」，否则会发 pointercancel 把拖动打断
el.addEventListener('pointerdown', (e) => {
  if (!active || scene !== 'wiki' || detailOpen || (window.Codex && window.Codex.isOpen) || e.button !== 0 || !e.target.closest('.wc')) return;
  const now = performance.now();
  drag = { id: e.pointerId, x: e.clientX, sc: stageEl.getBoundingClientRect().width / 1920, R0: R, lx: e.clientX, lt: now, v: 0 };
  rAnim = null; drift = 0; flingV = 0; dragMoved = false;
  e.preventDefault();                                                 // 也不选中文字；不影响之后的 click
});
addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = (e.clientX - drag.x) / drag.sc;
  if (!dragMoved) { if (Math.abs(dx) < 6) return; dragMoved = true; clearHot(); hotW = -1; el.classList.add('dragging'); }
  R = drag.R0 - dx / SLOT_W;                                          // 往右拖 = 卡片往右走
  const now = performance.now(), dt = (now - drag.lt) / 1000;
  if (dt > 0) { const v = -((e.clientX - drag.lx) / drag.sc / SLOT_W) / dt; drag.v = drag.v * .6 + v * .4; }
  drag.lx = e.clientX; drag.lt = now;
});
const dragEnd = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (dragMoved) {
    const still = performance.now() - drag.lt > 90;                   // 停住再松手：不甩
    flingV = still ? 0 : Math.max(-4, Math.min(4, drag.v)); afterDrag = true; el.classList.remove('dragging');
    dragEndAt = performance.now();                                    // 拖完紧跟着的那一下 click（如果浏览器发了）不算点击
  }
  drag = null; dragMoved = false;
};
addEventListener('pointerup', dragEnd); addEventListener('pointercancel', dragEnd);
function spinTo(to) {
  clearHot(); hotW = -1;
  rAnim = { from: R, to, t0: performance.now(), dur: Math.max(520, 620 * Math.abs(to - R)) }; kick();
}
const spin = (d) => spinTo((rAnim ? rAnim.to : Math.round(R)) + d);
const centerCard = () => wcParts.reduce((b, c, i) => (Math.abs(slotPos(i) - MID) < Math.abs(slotPos(b) - MID) ? i : b), 0);
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
// 切换：从当前进度出发，环绕过去；中途反向会从当前位置接着转（时长按剩余弧长折算）
function goTo(to) {
  if (anim && anim.to === to) return;
  const from = p, dur = Math.max(500, 1500 * Math.abs(to - from));
  anim = { from, to, t0: performance.now(), dur }; kick();
}

/* ---------- 状态与交互 ---------- */
let scene = 'xiang', selX = 2, hotW = -1, active = false, detailOpen = false, enterTimer = 0;
const GLIDE = 'cubic-bezier(.7,0,.2,1)';
const stageEl = document.getElementById('stage');

function clearHot() { el.querySelectorAll('.hot').forEach((n) => n.classList.remove('hot')); }
function setScene(s) { scene = s; el.dataset.scene = s; clearHot(); hotW = -1; }
function go(to) { if (to === scene) return; closeDetail(true); setScene(to); goTo(to === 'wiki' ? 1 : 0); }

// 作品百科、万象站的分类卡：都进入同一个图鉴内容页（卡堆 → 扇形 → 书）；sec 决定内页顶栏写哪一边、左侧列哪些分类
function openCodex(srcEl, name, sec = 'wiki') {
  if (!window.Codex) { openDetail(srcEl, name); return; }
  const r = srcEl.getBoundingClientRect(), st = stageEl.getBoundingClientRect(), sc = st.width / 1920;
  detailOpen = true;
  window.Codex.open(name, [(r.left + r.width / 2 - st.left) / sc, (r.top + r.height / 2 - st.top) / sc], sec === 'xiang' ? XNAMES : WN,
    (to) => { detailOpen = false; if (to && to !== scene) go(to); }, sec);
}
function openDetail(srcEl, name) {
  detailOpen = true;
  const det = el.querySelector('.det'), dc = det.querySelector('.dc');
  det.querySelector('.dn').textContent = name; det.classList.add('on');
  const r = srcEl.getBoundingClientRect(), st = stageEl.getBoundingClientRect(), sc = st.width / 1920;
  const from = { x: (r.left - st.left) / sc, y: (r.top - st.top) / sc, w: r.width / sc, h: r.height / sc };
  det.querySelector('.dim').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, fill: 'backwards' });
  // 详情卡片从被点击的卡片位置放大到中央（缓动同其他大平移）
  dc.animate([{ transform: `translate(${from.x - 360}px,${from.y - 150}px) scale(${from.w / 1200},${from.h / 780})`, opacity: .35 }, { transform: 'none', opacity: 1 }],
    { duration: 520, easing: GLIDE, fill: 'backwards' });
}
function closeDetail(instant) {
  if (!detailOpen) return;
  detailOpen = false;
  const det = el.querySelector('.det');
  if (instant) { det.classList.remove('on'); return; }
  det.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200 }).finished.then(() => det.classList.remove('on'));
}

el.addEventListener('pointerover', (e) => {
  const c = e.target.closest('[data-card]'); if (!c || detailOpen || (drag && dragMoved)) return;
  if (afterDrag && c.dataset.kind !== 'x') return;                    // 刚拖完：鼠标离开卡片之前不算悬停（不回正、不暂停）
  clearHot();
  if (c.dataset.kind === 'x') c.classList.add('hot'); else { c.closest('.wc').classList.add('hot'); hotW = +c.dataset.card; }
});
el.addEventListener('pointerout', (e) => {
  const w = e.target.closest('.wc'); if (w && afterDrag && !drag && !(e.relatedTarget && w.contains(e.relatedTarget))) afterDrag = false;
  const c = e.target.closest('[data-card]'); if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
  (c.dataset.kind === 'x' ? c : c.closest('.wc')).classList.remove('hot');
});
el.addEventListener('click', (e) => {
  if (window.Codex && window.Codex.isOpen) return;
  if (performance.now() - dragEndAt < 300) return;                    // 拖完松手不算点击（只吞紧跟着的那一下，不会吞掉之后真正的点击）
  if (detailOpen) { closeDetail(); return; }
  const tm = el.querySelector('.tbmenu');
  if (e.target.closest('.tbtab')) { tm.classList.toggle('on'); return; }
  if (!e.target.closest('.tbmenu')) tm.classList.remove('on');
  const sw = e.target.closest('.swtch'); if (sw) { tm.classList.remove('on'); go(sw.dataset.to); return; }
  const c = e.target.closest('[data-card]'); if (!c || e.target.closest('.closer')) return;
  if (c.dataset.kind === 'x') {
    const i = +c.dataset.card;
    if (i !== selX) { selX = i; layoutX(selX); } else openCodex(c, XNAMES[i], 'xiang');   // 先点选中，再点进入
  } else {
    const i = +c.dataset.card;
    openCodex(c, WN[i]);                                              // 点哪张卡就直接进入哪个分类，不用先转到正中间
  }
});
// 键盘：←→ 选择，Enter 确认，Tab 切换模块，Esc 关闭详情（没有详情时交给 main.js 退出页面）
addEventListener('keydown', (e) => {
  if (!active) return;
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (window.Codex && window.Codex.isOpen) return;      // 内容页自己处理按键
  if (detailOpen) { if (['Escape', 'Enter', ' ', 'Backspace'].includes(e.key)) { eat(); closeDetail(); } return; }
  if (e.key === 'Tab') { eat(); go(scene === 'xiang' ? 'wiki' : 'xiang'); return; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    eat(); const d = e.key === 'ArrowLeft' ? -1 : 1;
    if (scene === 'xiang') { selX = Math.max(0, Math.min(3, selX + d)); layoutX(selX); }
    else spin(d);
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    eat();
    if (scene === 'xiang') openCodex(el.querySelectorAll('.xc')[selX], XNAMES[selX], 'xiang');
    else { const c = wcParts[centerCard()]; openCodex(c.im, WN[+c.im.dataset.card]); }
  }
}, true);

el.addEventListener('wheel', (e) => {                              // 滚轮：作品百科转动一格（节流）
  if (!active || scene !== 'wiki' || detailOpen) return;
  const now = performance.now(); if (now - wheelAt < 450 || Math.abs(e.deltaY) < 4) return;
  wheelAt = now; spin(e.deltaY > 0 ? 1 : -1);
}, { passive: true });

window.Atlas = {
  el,
  enter(g) {
    active = true; selX = 2; hotW = -1; detailOpen = false;
    el.querySelector('.det').classList.remove('on');
    clearTimeout(enterTimer); anim = null;
    el.classList.add('pre'); setScene(g); layoutX(selX);
    p = g === 'wiki' ? 1 : 0; enterFade = 0; render(); void el.offsetWidth;
    enterTimer = setTimeout(() => { el.classList.remove('pre'); fadeAnim = { t0: performance.now(), dur: 700 }; kick(); }, 260); // 等墨水收回一点再开始入场
  },
  leave() { active = false; anim = null; fadeAnim = null; closeDetail(true); clearHot(); el.classList.add('pre'); },
  _debug: { camAt, ST, ORB, setP(v) { p = v; enterFade = 1; render(); } },
};
layoutX(selX); render();
})();
