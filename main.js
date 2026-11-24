(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const stage = $('#stage'), room = $('#room'), wipe = $('#wipe');
const ink = $('#ink'), ictx = ink.getContext('2d'), cursor = $('#cursor'), flash = $('#flash'), pages = $('#pages');
const A = 'assets/';
const GLIDE = 'cubic-bezier(.7,0,.2,1)'; // 大平移统一用的缓动曲线，与 style.css 的 --glide 相同

/* ---------- 分组：名称、英文、爆发中心 ---------- */
const G = {
  story:   { name: '继续剧情', en: 'CONTINUE', c: [1026, 410] },   // CG
  cont:    { name: '继续',     en: 'CONTINUE', c: [882, 673] },    // 「继续」按钮
  task:    { name: '任务',     en: 'MISSION',  c: [878, 226] },
  main:    { name: '主线',     en: 'MAIN',     c: [1044, 200] },
  side:    { name: '支线',     en: 'SIDE',     c: [1144, 175] },
  map:     { name: '地图',     en: 'MAP',      c: [1230, 151] },
  notice:  { name: '公告板',   en: 'NOTICE',   c: [177, 404] },
  codex:   { name: '图鉴',     en: 'ARCHIVE',  c: [1451, 233] },
  contact: { name: '联系簿',   en: 'CONTACTS', c: [506, 623] },
  avatar:  { name: '角色',     en: 'PROFILE',  c: [565, 442] },
  wardrobe:{ name: '换装',     en: 'WARDROBE', c: [280, 597] },
  settings:{ name: '设置',     en: 'SETTINGS', c: [111, 917] },
  back:    { name: '返回',     en: 'BACK',     c: [1859, 62] },
  wiki:    { name: '作品百科', en: 'WIKI',     c: [1661, 312] },   // 上面的标签（右雕像）
  xiang:   { name: '万象站',   en: 'STATION',  c: [1648, 427] },   // 下面的标签（左雕像）
};
const ORDER = ['story', 'cont', 'task', 'main', 'side', 'map', 'codex', 'avatar', 'contact', 'wardrobe', 'settings', 'back'];

/* ---------- 场景（Figma 739:365）：每个图层按 Figma 导出成透明 PNG（assets/home3/），按 Figma 的叠放顺序摆放。
   同一个入口的几个图层合成一块（L 列表），悬停时整块一起抬起、描边；st 是静态布景（不接收鼠标）。
   L：[文件名, x, y, w, h]（Figma 渲染边界，画布坐标） ---------- */
const H2 = 'home3/';
const AVATAR_ID = '1001';   // 头像贴纸上的角色（chars-data.js 的 id），点贴纸直接打开他的详情页
const img = (f) => `<img src="${A}${f}" alt="">`;
// 齿轮（D:\自负\output\gear-icon）：8 个齿 + 六角孔，外层斜切做透视，里层 .spin 只管转
const GEAR_SVG = (() => {
  const pt = (r, a) => [160 + r * Math.cos(a), 160 + r * Math.sin(a)].map((v) => v.toFixed(2)).join(' ');
  let d = '';
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; for (const [o, r] of [[-.5, 104], [-.29, 104], [-.23, 140], [.23, 140], [.29, 104], [.5, 104]]) d += (d ? ' L' : 'M') + pt(r, a + o * Math.PI / 4); }
  d += ' Z';
  for (let i = 0; i < 6; i++) d += (i ? ' L' : ' M') + pt(57, i * Math.PI / 3);
  d += ' Z';
  return `<svg class="gear" viewBox="7 12 299 287" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g transform="translate(0 26) matrix(1 -.16 0 .94 0 0)"><g class="spin">`
    + `<path d="${d}" fill="#080808" stroke="#080808" stroke-width="14" stroke-linejoin="miter" fill-rule="evenodd" transform="translate(-6 7)"/>`
    + `<path d="${d}" fill="#fff" stroke="#080808" stroke-width="11" stroke-linejoin="miter" fill-rule="evenodd"/></g></g></svg>`;
})();
const ITEMS = [
  { g:'task', d:.95, pl:'T', L:[['task-title',786.5,150,183.5,152]] },
  // 任务标题右边斜排的三个入口：主线 / 支线 → 任务页；地图还没有页面
  { g:'main', d:.95, pl:'T', L:[['sub-main',998.1,171,92.7,58.4]] },
  { g:'side', d:.95, pl:'T', L:[['sub-side',1106.3,150.2,75.7,48.8]] },
  { g:'map', d:.95, pl:'T', L:[['sub-map',1192.3,127.8,75.6,47]] },
  { st:1, L:[['rug',982.3,679,582.9,253.4]] },
  { st:1, pl:'C', L:[['search',1394,569,440,338]] },   // 图鉴下面的搜索框（静态装饰）
  { g:'back', d:1.4, L:[['close',1838,40,42,45]] },   // 右上角 ×：原来的「返回」
  // 继续剧情：灰底、进度条、章节文字都不动；CG 和「继续」按钮各自单独放大，点了都进任务页
  { st:1, pl:'T', L:[['story-bg',725,398.6,604,367.1],['story-prog',1044.1,524.1,241.5,132.3],['story-last',757.9,590.3,87.3,50.9],['story-bar',1038,596.7,2.9,61.7],['story-ch',1192.7,545.6,86.3,52.6],['story-sub',1085.6,581.8,97.4,46.2]] },
  { g:'cont', d:.85, pl:'T', L:[['story-btn',820,624,125,97.7]] },
  { g:'story', d:.85, pl:'T', L:[['story-cg',729,141.2,594.3,537]] },
  // 联系簿牌子（连同上面两条灰胶囊）→ 默认排序第一位角色的详情页
  { g:'contact', d:.6, L:[['c-label',339,523.5,335,199.3],['c-pill2',363,520.6,121,60.5],['c-pill1',374,472.2,105,57.2]] },
  { g:'avatar', d:.6, cls:'flick', L:[['avatar',464,331,203,222.2],['avatar-a',464,331,203,223],['avatar-2',464,331,203,223],['avatar-1',464,331,203,223],['avatar-c',464,331,203,223]] },   // 第一张整图只用来判断点击（隐藏）；Figma「有改动」里 1 / 2 两张来回切换闪烁   // 头像贴纸 → 这个角色的详情页
  { g:'wardrobe', d:.6, L:[['c-coat',226.2,470,107.9,254.5]] },   // 衣架 → 换装
  { g:'contact', d:.6, L:[['c-text',384.1,544.9,251,152.2]] },
  { st:1, pl:'L', L:[['c-panel',297,646.9,378,247.7],['c-desc',324.4,701.1,330.8,132.9],['c-tri',627.5,751.6,26,19.1]] },   // 简介文字框（静态装饰）
  { st:1, pl:'L', L:[['story-pen',759,651,48.9,94.5]] },   // 继续按钮旁的小人
  // 设置：灰底不动（鼠标在灰底上也算悬停到设置，hg）；齿轮用矢量画（gear-icon 动效），悬停时绕自己转，倾斜透视不跟着转。
  // settings-gear.png 只用来算点击区域，不显示
  { st:1, pl:'F', hg:'settings', L:[['settings-base',51,898,128,85]] },
  { g:'settings', d:.95, pl:'F', gear:1, L:[['settings-gear',43,851,134,110.8]], extra:GEAR_SVG },
  { st:1, d:1.4, L:[['line-r',1857,101,4,162],['tick-r',1855,272,8,294],['tick-r2',1855,577,8,193],['line-tr',1647,59,172,4],['mark-tr',1770,95,57,46]] },   // 右侧取景框装饰
  // 图鉴：竖牌旁的白三角、底座不放大；竖牌是一个入口；
  // 左雕像 + 下面的「万象站」进万象站；右雕像（张开双臂，同作品百科页）+ 上面的「作品百科」进作品百科。标签和雕像按 Figma 叠放顺序分开摆
  { st:1, pl:'C', L:[['codex-tri',1397,192,152.5,282.8]] },
  { g:'codex', d:.6, L:[['codex-sign',1405,93,93,280]] },
  { st:1, pl:'C', L:[['platform',1452,505,358,317]] },
  { g:'wiki', d:.95, L:[['statue-r',1648,396,149.7,342.6]] },
  { g:'xiang', d:.95, L:[['statue-l',1500,263,131,361.4]] },
  { g:'wiki', d:.95, L:[['tag-wiki',1586,227,150.1,171.4]] },
  { g:'xiang', d:.95, L:[['tag-xiang',1584,349,128,155.2]] },
  { st:1, d:1.4, L:[['frame-l',58,59,1580,712],['head',36,31,66,61]] },   // 左上取景框和小头像（静态装饰）
  { st:1, L:[['sofa',527,766,339,275]] },
  { st:1, pl:'L', L:[['btn-pen',237,833,52.6,70.6],['btn-star',237,767,52.6,70.6]] },   // 星星 / 笔两个小方块（静态装饰）
  { st:1, d:1.4, L:[['title',69,78,438,143]] },   // 「Rounllbito」标题
  { st:1, L:[['shade-r',1355.6,666.1,529.7,382.9]] },
  { st:1, L:[['fg',1329,837,591,243]] },
  { st:1, L:[['plant',1294,571,112,204]] },
];

const bg = document.createElement('div');
bg.id = 'bg'; bg.innerHTML = img(H2 + 'bg.png'); room.appendChild(bg);

const els = ITEMS.map((c) => {
  const x0 = Math.min(...c.L.map((l) => l[1])), y0 = Math.min(...c.L.map((l) => l[2]));
  const x1 = Math.max(...c.L.map((l) => l[1] + l[3])), y1 = Math.max(...c.L.map((l) => l[2] + l[4]));
  c.b = [x0, y0, x1 - x0, y1 - y0];
  const it = document.createElement('div');
  const small = Math.min(c.b[2], c.b[3]) < 160;
  it.className = 'it' + (c.st ? ' static' : small ? ' ols' : ' ol') + (c.idle ? ' idle-' + c.idle : '') + (c.cls ? ' ' + c.cls : '');
  if (c.g) it.dataset.g = c.g;
  if (c.gear) it.classList.add('gear-it');
  it.style.setProperty('--d', c.d || 0);
  it.style.left = (x0 + c.b[2] / 2) + 'px'; it.style.top = (y0 + c.b[3] / 2) + 'px';
  const fx = document.createElement('div'); fx.className = 'fx';
  const sk = document.createElement('div'); sk.className = 'sk';
  sk.style.width = c.b[2] + 'px'; sk.style.height = c.b[3] + 'px'; sk.style.transform = 'translate(-50%,-50%)';
  sk.innerHTML = c.L.map(([f, x, y, w, h]) => `<img class="ly" src="${A}${H2}${f}.png" style="left:${x - x0}px;top:${y - y0}px;width:${w}px;height:${h}px" alt="">`).join('') + (c.extra || '');
  fx.appendChild(sk); it.appendChild(fx); room.appendChild(it);
  return { it, fx, cfg: c };
});
// 旧版主页的翻页书已经不在场景里：留一个隐藏的画布，让翻页逻辑空转（bookSide 永远返回 null）
room.insertAdjacentHTML('beforeend', '<canvas id="book" width="720" height="620" hidden></canvas>');

/* ---------- 翻页书（序列帧 page-turn-v1：42 帧 / 60fps / 0.7s，720×620） ----------
   鼠标在书的右半 → 播放 rtl（向左翻），露出「作品百科」；在左半 → 播放 ltr（向右翻），露出「万象站」。
   翻页由一个进度 pos(0~41) 驱动：前进 60fps，离开 300ms 后倒放回 0；切换方向前先倒放回 0。 */
const BOOK = { N: 42, W: 720, H: 620, HINGE: 346, DEAD: 10 };
const bookCv = $('#book'), bctx = bookCv.getContext('2d');
bookCv.style.width = '669.6px'; bookCv.style.height = '576.6px'; // 序列帧按 0.93 缩放，对齐 Figma 里的书页
const frames = { rtl: [], ltr: [] };
for (const d of ['rtl', 'ltr']) for (let i = 0; i < BOOK.N; i++) {
  const im = new Image(); im.src = `${A}book/${d}/frame_${String(i).padStart(3, '0')}.png`; frames[d].push(im);
}
const MASK = window.BOOK_MASK;
const maskData = MASK ? Uint8Array.from(atob(MASK.data), (c) => c.charCodeAt(0)) : null;
const bk = { dir: null, pos: 0, target: 0, pending: null, leave: 0, shown: null, key: '' };

// 指针落在书页轮廓内？返回 'rtl'/'ltr'（右半/左半）、'mid'（书脊死区）或 null。用画布当前的屏幕矩形换算，所以视差和抬起都不影响命中
function bookSide(e) {
  if (!maskData) return null;
  const r = bookCv.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width * BOOK.W, v = (e.clientY - r.top) / r.height * BOOK.H;
  const mx = Math.floor(u / MASK.s), my = Math.floor(v / MASK.s);
  if (mx < 0 || my < 0 || mx >= MASK.w || my >= MASK.h || !maskData[my * MASK.w + mx]) return null;
  if (u > BOOK.HINGE + BOOK.DEAD) return 'rtl';
  if (u < BOOK.HINGE - BOOK.DEAD) return 'ltr';
  // 书脊附近：已经翻开时保持当前方向（防抖）；还没翻开时一碰到书就立刻按所在一侧判断
  return bk.dir ? 'mid' : (u >= BOOK.HINGE ? 'rtl' : 'ltr');
}
function bookWant(side) {
  if (bk.dir === null) { bk.dir = side; bk.target = BOOK.N - 1; bk.pending = null; sfx.page(); }
  else if (bk.dir === side) { bk.target = BOOK.N - 1; bk.pending = null; }
  else { bk.target = 0; bk.pending = side; } // 要换方向：先倒放回初始帧
}
function bookPointer(side, overLabel) {
  const keep = () => { clearTimeout(bk.leave); bk.leave = 0; };
  if (side === 'rtl' || side === 'ltr') { keep(); bookWant(side); }
  else if (side === 'mid' || overLabel) keep();
  else if (!bk.leave && (bk.dir || bk.pending)) bk.leave = setTimeout(() => { bk.leave = 0; bk.target = 0; bk.pending = null; }, 300);
}
function bookDraw() {
  const d = bk.dir || 'rtl', f = Math.round(bk.pos), key = d + f;
  if (key === bk.key) return;
  const im = frames[d][f];
  if (!im.complete || !im.naturalWidth) return;
  bctx.clearRect(0, 0, BOOK.W, BOOK.H); bctx.drawImage(im, 0, 0); bk.key = key;
}
// 书里的雕像弹出/收回：ltr（左半，万象站）→ 坐姿雕像；rtl（右半，作品百科）→ 神龛雕像。.pop 的位移/缩放在 style.css
const popEls = {
  ltr: els.filter((e) => /\bsit\b/.test(e.cfg.cls || '')).map((e) => e.it),
  rtl: els.filter((e) => /\bshr\b/.test(e.cfg.cls || '')).map((e) => e.it),
};
const bookLabs = els.filter((e) => /\bblab\b/.test(e.cfg.cls || '')).map((e) => e.it);
function setPop(dir) {
  for (const k of ['ltr', 'rtl']) popEls[k].forEach((n) => n.classList.toggle('popped', k === dir));
  bookLabs.forEach((n) => n.classList.toggle('on', n.dataset.g === (dir === 'ltr' ? 'xiang' : dir === 'rtl' ? 'wiki' : ''))); // 只出现被翻开那一侧的标签：左半 → 万象站，右半 → 作品百科；合上后都消失
  bk.shown = dir;
}
function bookTick(dt) {
  if (bk.pos !== bk.target) {
    const step = (bk.target > bk.pos ? 60 : 84) * dt / 1000; // 前进 60fps，回翻略快
    bk.pos = bk.target > bk.pos ? Math.min(bk.target, bk.pos + step) : Math.max(bk.target, bk.pos - step);
    if (bk.pos === 0) { bk.dir = bk.pending; bk.pending = null; if (bk.dir) { bk.target = BOOK.N - 1; sfx.page(); } }
  }
  bookDraw();
  // 一判断出左/右半，翻页和雕像弹出同时开始；离开或换方向时雕像先收回
  const dir = bk.dir && bk.target === BOOK.N - 1 ? bk.dir : null;
  if (dir !== bk.shown) setPop(dir);
}
function bookReset() {
  clearTimeout(bk.leave); bk.leave = 0;
  bk.dir = null; bk.pos = 0; bk.target = 0; bk.pending = null; bk.key = ''; bookDraw(); setPop(null);
}

/* ---------- 适配缩放 / 坐标 ---------- */
let S = 1;
function fit() { S = Math.min(innerWidth / 1920, innerHeight / 1080); stage.style.setProperty('--s', S); }
addEventListener('resize', fit); fit();
const toStage = (e) => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / S, (e.clientY - r.top) / S]; };

/* ---------- 声音（WebAudio 合成，M 静音） ---------- */
let AC = null, muted = false;
function tone(f0, f1, dur, type = 'square', vol = .06, delay = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t + dur);
    const ST = window.Settings; if (ST) vol *= (ST.get('master') / 100) * (ST.get('sfx') / 100);   // 设置页：总音量 × 音效
    if (vol <= 0.0001) return;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + .02);
  } catch (_) {}
}
window.SFX = (n) => { if (sfx[n]) sfx[n](); };   // 给设置页用：改值时的提示音
const sfx = {
  hover: () => { tone(520, 880, .07, 'square', .04); },
  press: () => { tone(220, 110, .09, 'square', .06); },
  slam:  () => { tone(160, 40, .35, 'sawtooth', .12); tone(900, 200, .12, 'square', .05, .02); },
  whoosh:() => { tone(1200, 120, .3, 'sawtooth', .04); },
  tick:  () => { tone(1000, 1000, .03, 'square', .03); },
  page:  () => { tone(320, 110, .18, 'sawtooth', .03); tone(1800, 400, .12, 'square', .015, .03); },
};

/* ---------- 墨点粒子 ---------- */
const parts = [];
function splat(x, y, n = 18, cols = ['#0b0b0b', '#ffc822', '#fff']) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 12;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 1, r: 4 + Math.random() * 12, c: cols[i % cols.length], rot: Math.random() * 6 });
  }
}
let lastT = 0;
function loop(now = performance.now()) {
  const dt = Math.min(50, now - (lastT || now)); lastT = now;
  try { bookTick(dt); } catch (err) { window.__err = String(err && err.stack || err); }
  ictx.clearRect(0, 0, 1920, 1080);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vx *= .92; p.vy = p.vy * .92 + .35; p.life -= .03; p.rot += .2;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    ictx.save(); ictx.translate(p.x, p.y); ictx.rotate(p.rot); ictx.globalAlpha = Math.min(1, p.life * 1.4);
    ictx.fillStyle = p.c; ictx.strokeStyle = '#0b0b0b'; ictx.lineWidth = 3;
    const r = p.r * (.4 + p.life * .6);
    ictx.beginPath(); ictx.rect(-r, -r, r * 2, r * 2); ictx.fill(); if (p.c !== '#0b0b0b') ictx.stroke(); ictx.restore();
  }
  // 视差平滑
  px += (tx - px) * .08; py += (ty - py) * .08;
  room.style.setProperty('--mx', px.toFixed(2)); room.style.setProperty('--my', py.toFixed(2));
  requestAnimationFrame(loop);
}
let px = 0, py = 0, tx = 0, ty = 0;

/* ---------- 悬停 / 焦点 ---------- */
let hot = null, busy = true, cur = null, kbIdx = -1;
function setHot(g) {
  if (g === hot) return;
  if (hot) els.forEach((e) => e.cfg.g === hot && e.it.classList.remove('g-hot'));
  hot = g;
  cursor.classList.toggle('hot', !!g);
  if (!g) return;
  els.forEach((e) => e.cfg.g === g && e.it.classList.add('g-hot'));
  const [cx, cy] = G[g].c;
  sfx.hover();
  splat(cx, cy, 8);
}
const press = (g, on) => els.forEach((e) => e.cfg.g === g && e.it.classList.toggle('g-press', on));

/* 命中检测按图片的不透明像素算，不按矩形：从最上层往下找，先碰到入口就是它；先碰到不透明的静态布景（沙发、花盆）就算没碰到。
   半透明的光（左墙光斑、图鉴下的高光）不挡鼠标。每张图的 alpha 只读一次，缓存起来 */
const alphaOf = new Map(), HM = window.HIT_MASK;   // HIT_MASK：assets/home2/hitmask.js 里提前算好的遮罩（双击打开本地文件时也能用）
function alphaAt(im, u, v) {
  const n = im.src.slice(im.src.lastIndexOf('/') + 1, -4), m = HM && HM.m[n];
  if (m) {
    if (!m.b) m.b = Uint8Array.from(atob(m.d), (ch) => ch.charCodeAt(0));
    const px = Math.floor(u * m.w), py = Math.floor(v * m.h);
    if (px < 0 || py < 0 || px >= m.w || py >= m.h) return 0;
    const i = py * m.w + px;
    return (m.b[i >> 3] >> (i & 7)) & 1 ? 255 : 0;
  }
  let a = alphaOf.get(im.src);
  if (!a) {
    if (!im.complete || !im.naturalWidth) return 0;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
    a = { w: c.width, h: c.height, d: cx.getImageData(0, 0, c.width, c.height).data }; alphaOf.set(im.src, a);
  }
  const px = Math.floor(u * a.w), py = Math.floor(v * a.h);
  return px < 0 || py < 0 || px >= a.w || py >= a.h ? 0 : a.d[(py * a.w + px) * 4 + 3];
}
// 直接双击打开 index.html（file://）时，浏览器不允许读图片像素（getImageData 报安全错误）：这时退回按元素矩形判断
let alphaOK = true;
function hitByRect(x, y) {
  const r = stage.getBoundingClientRect(), el = document.elementFromPoint(r.left + x * S, r.top + y * S);
  const it = el && el.closest('.it[data-g]');
  return it ? it.dataset.g : null;
}
function hitG(x, y) {
  if (!alphaOK) return hitByRect(x, y);
  try { return hitAlpha(x, y); } catch (err) { alphaOK = false; return hitByRect(x, y); }
}
function hitAlpha(x, y) {
  for (let i = els.length - 1; i >= 0; i--) {
    const { cfg: c } = els[i], [bx, by, bw, bh] = c.b;
    if (x < bx || y < by || x > bx + bw || y > by + bh) continue;
    const ims = els[i].it.querySelectorAll('img.ly');
    for (let j = c.L.length - 1; j >= 0; j--) {
      const [, lx, ly, lw, lh] = c.L[j], al = alphaAt(ims[j], (x - lx) / lw, (y - ly) / lh);
      if (c.st && !c.hg ? al > 160 : al > 40) return c.hg || (c.st ? null : c.g);   // hg：不放大的底，但算作那个入口的点击区域
    }
  }
  return null;
}

stage.addEventListener('pointermove', (e) => {
  const [x, y] = toStage(e); lastPt = [x, y];
  cursor.style.transform = `translate(${x}px,${y}px)`;
  // 主页图标不再随鼠标晃动（视差已关闭：tx/ty 恒为 0）
  if (Math.random() < .35) parts.push({ x, y, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, life: .6, r: 3 + Math.random() * 4, c: Math.random() < .5 ? '#ffc822' : '#0b0b0b', rot: 0 });
  if (busy || cur) return;
  let g = hitG(x, y);
  let side = bookSide(e);
  if (side && !g) g = 'codex'; // 书页本体也算图鉴，悬停时整组抬起
  // 悬停在书页下方的「万象站 / 作品百科」标签上，也保持对应一侧翻开、雕像弹出（鼠标从书移到标签的路上不会收回）
  if (!side || side === 'mid') { if (g === 'xiang') side = 'ltr'; else if (g === 'wiki') side = 'rtl'; }
  bookPointer(side, false);
  if (g && ORDER.includes(g)) kbIdx = ORDER.indexOf(g);
  setHot(g);
});
stage.addEventListener('pointerleave', () => { if (!cur) { setHot(null); bookPointer(null, false); } });
stage.addEventListener('pointerdown', (e) => {
  cursor.classList.add('down'); sfx.press();
  const g = hitG(...toStage(e)); if (g && !busy && !cur) press(g, true);
});
addEventListener('pointerup', () => { cursor.classList.remove('down'); ORDER.forEach((g) => press(g, false)); });
stage.addEventListener('click', (e) => {
  if (busy) return;
  if (cur) {
    if (e.target.closest('.back,.closer')) close();
    return;
  }
  const pt = toStage(e), g = hitG(...pt);
  if (g) { open(g, pt); return; }
  // 点在翻开的书页本体上：左半进万象站，右半进作品百科
  const sd = bookSide(e), dir = sd === 'mid' ? bk.dir : sd;
  if (dir === 'ltr' || dir === 'rtl') open(dir === 'rtl' ? 'wiki' : 'xiang', toStage(e));
});
// 光标在页面里的状态
stage.addEventListener('pointerover', (e) => {
  if (cur) cursor.classList.toggle('hot', !!e.target.closest('.back,.closer,[data-hot],.card,.st,.tog,.slider'));
});

/* ---------- 转场（圆形展开：和图鉴内容页同一种） ----------
   新页面盖在上面，从点击点用一个圆形展开（0.9s，GLIDE 缓动）；返回时圆形收回点击点，露出下面的房间。 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastPt = [960, 540];
const CIRCLE = (pt, r) => `circle(${r}px at ${pt[0]}px ${pt[1]}px)`;

/* ---------- 子页面 ---------- */
const mk = (g, inner) => {
  const d = document.createElement('section'); d.className = 'page'; d.dataset.p = g;
  d.innerHTML = `<div class="halftone"></div><div class="ghost">${G[g].en}</div><div class="back">返回</div><h1>${G[g].name}</h1><div class="body">${inner}</div>`;
  pages.appendChild(d); return d;
};
// 整页由 Figma 排版生成的页面：没有通用的标题和返回按钮，右上角的 × 带 .closer
const mkRaw = (g, html) => {
  const d = document.createElement('section'); d.className = 'page sub'; d.dataset.p = g; d.innerHTML = html;
  pages.appendChild(d); return d;
};
const PAGES = {
  task: mkRaw('task', ''),                             // 任务页：tasks.js（线路图）
  contact: mkRaw('contact', ''),                       // 角色设计页：chars.js
  settings: mkRaw('settings', ''),                     // 设置页：settings.js
  back: mkRaw('back', ''),                             // 店铺商品展示页：shop.js（先临时接在「返回」上）
  // 翻页书的两个模块：静态排版来自 Figma（subpages.js），交互还没做
  // 万象站与作品百科共用 atlas.js 里的同一个页面容器，雕像在两页之间平移
  wiki: window.Atlas.el,
  xiang: window.Atlas.el,
};
window.Chars.mount(PAGES.contact);
window.Tasks.mount(PAGES.task);
window.Settings.mount(PAGES.settings);
window.Shop.mount(PAGES.back);
// 滑块 / 开关 / 星标
$$('.slider').forEach((s) => {
  const set = (v) => { v = Math.max(0, Math.min(100, v)); s.dataset.v = v; $('i', s).style.width = v + '%'; $('u', s).style.left = v + '%'; s.parentNode.querySelector('output').textContent = Math.round(v); };
  set(+s.dataset.v);
  const mv = (e) => { const r = s.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); sfx.tick(); };
  s.addEventListener('pointerdown', (e) => { mv(e); s.setPointerCapture(e.pointerId); s.onpointermove = mv; });
  s.addEventListener('pointerup', () => { s.onpointermove = null; });
});
$$('.tog').forEach((t) => t.addEventListener('click', () => { t.classList.toggle('on'); sfx.press(); const r = t.getBoundingClientRect(), [x, y] = toStage({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); splat(x, y, 14); }));
$$('.st').forEach((t) => t.addEventListener('click', (e) => { t.classList.toggle('on'); sfx.press(); if (t.classList.contains('on')) { const [x, y] = toStage(e); splat(x, y, 22, ['#ffc822', '#0b0b0b', '#fff']); } }));

function popIn(p) {
  const list = $$('.pop', p); list.forEach((e) => e.classList.remove('in'));
  $$('.bar i', p).forEach((i) => (i.style.width = '0'));
  list.forEach((e, i) => setTimeout(() => { e.classList.add('in'); sfx.tick(); }, 90 + i * 70));
  setTimeout(() => $$('.bar i', p).forEach((i) => (i.style.width = i.dataset.w + '%')), 300);
}

/* ---------- 打开 / 关闭 ---------- */
async function open(g, pt) {
  if (busy) return;
  // 图鉴没有总览页，只有两个去处：翻开了哪一侧就进哪一侧；没有翻开（点标签、键盘）就按点击位置在书脊的哪边决定，默认万象站
  // 图鉴竖牌：没有总览页，默认进万象站（作品百科 / 万象站点对应的雕像）
  if (g === 'codex') g = 'xiang';
  const tkMode = g === 'side' ? 'side' : 'main';
  if (g === 'main' || g === 'side' || g === 'story' || g === 'cont') g = 'task';   // 「任务」「主线」、CG、「继续」都进任务页的主线，「支线」进同一页的支线
  // 联系簿墙：三个入口进同一个联系簿页，打开时停在不同的状态
  const chMode = { contact: 'first', avatar: 'profile', wardrobe: 'dress' }[g];   // 「联系簿」牌子 → 默认排序第一位角色的详情
  if (chMode) g = 'contact';
  busy = true;
  pt = pt || G[g].c; lastPt = pt; sfx.whoosh(); splat(pt[0], pt[1], 30);
  if (g === 'map') { await sleep(350); busy = false; return; }   // 还没有页面
  cur = g; setHot(null); bookReset();
  const p = PAGES[g];
  if (g === 'wiki' || g === 'xiang') window.Atlas.enter(g);
  p.classList.add('on');
  if (g === 'contact') window.Chars.enter({ mode: chMode, id: AVATAR_ID });
  if (g === 'task') window.Tasks.enter({ mode: tkMode });
  if (g === 'settings') window.Settings.enter();
  if (g === 'back') window.Shop.enter();
  setTimeout(() => popIn(p), 380);
  await p.animate([{ clipPath: CIRCLE(pt, 0) }, { clipPath: CIRCLE(pt, 2300) }], { duration: 900, easing: GLIDE, fill: 'backwards' }).finished;
  room.style.visibility = 'hidden'; busy = false;
}
async function close() {
  if (busy || !cur) return; busy = true;
  const g = cur, p = PAGES[g], pt = lastPt;
  sfx.whoosh(); room.style.visibility = '';
  await p.animate([{ clipPath: CIRCLE(pt, 2300) }, { clipPath: CIRCLE(pt, 0) }], { duration: 700, easing: GLIDE, fill: 'forwards' }).finished;
  p.getAnimations().forEach((a) => a.cancel());
  p.classList.remove('on'); cur = null;
  if (g === 'wiki' || g === 'xiang') window.Atlas.leave();
  setHot(g); busy = false;
}

/* ---------- 键盘 ---------- */
addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') { muted = !muted; return; }
  if (busy) return;
  if (cur) { if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); close(); } return; }
  const step = { ArrowRight: 1, ArrowDown: 1, Tab: e.shiftKey ? -1 : 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (step) { e.preventDefault(); kbIdx = (kbIdx + step + ORDER.length) % ORDER.length; setHot(ORDER[kbIdx]); }
  else if ((e.key === 'Enter' || e.key === ' ') && hot) { e.preventDefault(); open(hot); }
});

/* ---------- 开场动画 ---------- */
async function intro() {
  stage.classList.add('ready');
  bg.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, easing: GLIDE, fill: 'backwards' });
  // 三个平面各自沿透视线入场：左墙从左、右墙从右、地板从左
  // ang 是入场运动方向（朝目标位置前进的方向），与场景透视线平行；delay 是该平面的起始时间
  const PLANES = {
    L: { ang: -24, delay: 400 },   // 左墙：沿左墙透视线，从左下往右上滑入
    T: { ang: -12, delay: 500 },   // 任务白板：从左边横着滑进来（略往上）
    C: { ang: 204, delay: 650 },   // 图鉴：从右边滑进来（略往上）
    R: { ang: 214.8, delay: 650 }, // 右上：沿右墙透视线，从右下往左上滑入
    F: { ang: -24, delay: 900 },   // 下方：沿地板透视线，从左侧滑入
  };
  const OF = { task: 'T', main: 'T', story: 'T', cont: 'T', side: 'T', map: 'T', back: 'R', codex: 'C', wiki: 'C', xiang: 'C', contact: 'L', avatar: 'L', wardrobe: 'L', settings: 'F' };
  const DIST = 1500, DUR = 900, STEP = 70;
  const count = { L: 0, T: 0, C: 0, R: 0, F: 0 };
  let end = 0;
  els.forEach((e) => {
    if (e.cfg.st && !e.cfg.pl) { e.fx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 300, fill: 'backwards' }); return; }   // 静态布景只淡入
    const k = e.cfg.pl || (e.cfg.g ? OF[e.cfg.g] : 'R'); // 没有分组的是右上角的菜单标题
    const pl = PLANES[k], rad = (pl.ang * Math.PI) / 180, vx = Math.cos(rad), vy = Math.sin(rad);
    const delay = pl.delay + count[k]++ * STEP;
    // 平移只用一条缓动曲线（GLIDE），速度的变化全由曲线决定，不再用带过冲的关键帧
    e.fx.animate([{ transform: `translate(${-vx * DIST}px,${-vy * DIST}px)` }, { transform: 'none' }],
      { duration: DUR, delay, easing: GLIDE, fill: 'backwards' });
    if (!e.cfg.hid) e.fx.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay, fill: 'backwards' }); // 淡入单独走，避免随位移被拖慢（平时隐藏的物件不参与）
    end = Math.max(end, delay + DUR);
    setTimeout(() => {
      const c = e.cfg, p = [c.b[0] + c.b[2] / 2, c.b[1] + c.b[3] / 2];
      splat(p[0], p[1] + 20, 5); if (Math.random() < .35) sfx.tick();
    }, delay + DUR * .92);
  });
  await sleep(end + 200);
  busy = false;
}
loop(); intro();
// 暴露给调试
window.__menu = { open, close, setHot, bk, hitG, isBusy: () => busy };
})();
