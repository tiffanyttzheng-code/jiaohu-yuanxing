/* 任务页（主菜单「任务」入口）：阶梯。按 Figma 476:1871 还原。数据：tasks-data.js（飞书 Stage 表 + 章节名）。
   · 整个主线是一段一直往下折返的楼梯：平台 → 墙 → 下一块平台，方向 左、右 交替；
     每章开头一块章节平台（顶面躺着「第X章」+ 章名，黄描边；立着章节序号），小节平台的角上立一块牌子（灰竖条 + 编号 + 名字）
   · 每章前三节的平台上各放一个物件（雕像 / 玻璃温室 / 机械装置，带名字标签）；背景是云、细竖线和斜光（固定在屏幕上）
   · 选中的那一级顶面变黄（带 12px 白边），镜头把它移到设计稿 0-1 的位置 (657, 572)
   · 左边：章节目录（每章一个黑色标题条，可折叠；下面是这一章的小节编号，选中的变黄，未解锁的后面带一把锁；底部渐隐）；右边是详情卡片
   面的形状直接取自设计稿各图层的 transform（旋转 / 斜切 / 缩放）算出来的顶点 */
(function () {
'use strict';
const GL = 'cubic-bezier(.7,0,.2,1)';
const D = window.TASKS || { chapters: [], stages: [] };
const TA = 'assets/tasks/';
/* 进度：还没有存档，先假定走到第 1 章第 12 级（改这里看不同状态） */
const PROGRESS = { ch: 101, idx: 11 };
const MAIN = D.chapters.filter((c) => c.id < 200);
/* 支线（Figma 草稿 48:720）：表里的「支线汇总」章节。只显示已解锁的，不给完整目录；
   样例：前 5 条已解锁，前 4 条已完成、第 5 条未开始（之后接存档）。顶栏下拉（48:504）切换主线 / 支线，地图任务未开放 */
const SIDE = D.chapters.find((c) => c.id >= 200 && c.id < 300) || null;
const SIDE_OPEN = 5, SIDE_DONE = 4;
let mode = 'main', sideSeen = false;   // sideSeen：有新支线时下拉按钮和「支线任务」后面亮黄点，切到支线看过一次就灭
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KIND = (t) => (t.tid === '01' ? 'plot' : t.tid === '05' ? 'campus' : t.tid === '10' ? 'event' : +t.tid >= 11 ? 'char' : 'subj');
const KIND_NAME = { plot: '剧情', campus: '校园', event: '活动', char: '角色', subj: '学科' };
const NUMCN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/* ---------- 设计稿几何（Figma 476:1871；全部相对于菱形顶面中心） ----------
   fx：把 Figma 图层的 transform（rotate → skewX → scale，绕 w×h 矩形中心）直接算成四个顶点，再平移到 o。ins = 向内缩（选中平台的白边 12） */
const fx = (rot, skx, sx, sy, w, h, o, ins = 0) => {
  const r = rot * Math.PI / 180, t = Math.tan(skx * Math.PI / 180), c = Math.cos(r), s = Math.sin(r);
  return [[ins, ins], [w - ins, ins], [w - ins, h - ins], [ins, h - ins]].map(([x, y]) => {
    const X = (x - w / 2) * sx, Y = (y - h / 2) * sy; return [c * (X + t * Y) - s * Y + o[0], s * (X + t * Y) + c * Y + o[1]];
  });
};
const TOP = [-19.97, 50.1, 1, .64, 300, 300];
const RH = fx(...TOP, [0, 0]), RHI = fx(...TOP, [0, 0], 8);                         // 菱形顶面 / 去掉 8px 白边的内圈（Figma 483:11）
/* 规律：平台 → 一面墙（300×150）→ 下一块平台，方向 左、右、左、右……交替往下。
   往左下走时墙挂在平台的左下边（背光，灰 #aeaeae），往右下走时墙挂在右下边（受光，白） */
const WL = fx(20.01, 20.01, 1, .94, 300, 150, [-143.05, 129.97]);
const WR = fx(159.99, -20.01, 1, -.94, 300, 150, [143.95, 130.41]);
const GO_L = [-288, 261], GO_R = [288, 261];                                        // 落到下一块平台的位移（左右等长 → 整棵楼梯只在两列之间折返，不会越走越偏）
const dirOf = (k) => (k % 2 === 0 ? 'L' : 'R');
/* 镜头只上下移动、不左右移动：左列平台（如设计稿 0-1）永远在 x=657，右列（0-2、章节平台）在 x=945；选中的平台顶面中心落在 y=572 */
const ANCHOR = [657, 572], COL_L = -288;                                           // COL_L = 左列平台在楼梯坐标里的 x
/* 小节的牌子：一根灰竖条 + 竖立的编号和名字（黑字白描边）。A = 从左上落下来的平台（牌子在左角，字往右下走，左对齐）；
   B = 从右上落下来的平台（牌子在右角，字往右上走，右对齐）。偏移 = 文字左/右端中点 */
const SIGN = {
  A: { tf: 'rotate(19.2) skewX(19.11) scale(1,.94)', anchor: 'start', no: [-199.9, -68.5], nm: [-199.9, -10.5], bar: fx(21.4, 21.4, 1, .93, 22, 114.534, [-200.76, -39.96]) },
  B: { tf: 'rotate(-18.84) skewX(-18.69) scale(1,.95)', anchor: 'end', no: [222.6, -77.5], nm: [218.1, -16.8], bar: fx(-19.16, -19.16, 1, .94, 22, 119.661, [223.39, -50.14]) },
};
/* 章节平台：躺在顶面上的「第X章」+ 章名（黄描边）和一个立着的大号章节序号 */
const PLAT_TXT = {
  no: { o: [73.74, -46.49], tf: 'rotate(20) skewX(20.16) scale(1,.94)', fs: 96 },
  title: { o: [82.31, 29.05], tf: 'rotate(-18.84) skewX(51.2) scale(1,.63)', fs: 96 },
  sub: { o: [-34.14, 18.36], tf: 'rotate(-20.01) skewX(52.16) scale(1,.61)', fs: 64 },
};
/* 平台上的物件（每章前三节各放一个，占位：表里还没有「物件」列）：雕像（底座三个面 + 模糊投影 + 雕像）、玻璃温室、机械装置。
   雕像位置固定；另外两个按牌子在哪边放：牌子在右（B）时放平台左半边（标签往左伸），牌子在左（A）时放平台右半边（标签镜像往右伸），避开牌子和名字 */
const PLINTH = {
  t: fx(...TOP.slice(0, 4), 92.93, 92.93, [-6.64, -62.21]), l: fx(20.01, 20.01, 1, .94, 92.589, 24.317, [-49.5, -34.63]),
  r: fx(159.99, -20.01, 1, -.94, 91.524, 24.291, [37, -34.83]), shd: fx(...TOP.slice(0, 4), 99.839, 99.452, [-6.82, -37.91]),
};
/* 支线平台：没有墙和编号，只有顶面 + 一根短竖条（已完成灰、未开始黄）+ 名字（Figma 48:785~789：竖条比主线短一半、往下挪） */
const SIDE_BAR = { A: fx(21.4, 21.4, 1, .93, 22, 62, [-209.76, -17.46]), B: fx(-19.16, -19.16, 1, .94, 22, 64, [223.39, -21.64]) };
const STATUE = [-93, -317.92];
const PROP_AT = { A: [110, -55], B: [-149.5, -69.68] };
/* 奖励格里的物件（占位：表里还没有奖励数据，先固定放设计稿里的三件；位置 = 图在格子里的偏移和尺寸） */
const REWARDS = [
  { src: 'obj-terra.png', x: 13, y: 7, w: 48, h: 60 },
  { src: 'rw-bulb.png', x: 6, y: 13, w: 61, h: 53 },
  { src: 'rw-robot.png', x: 11, y: 5, w: 52, h: 62 },
];
const PROPS = [
  null,                                                                                        // 第 1 节：雕像（单独画）
  { src: 'obj-terra.png', w: 96.515, h: 120.33, tf: 'rotate(-19.46) skewX(-19.46) scale(1,.94)', shd: [4.35, 58.16], tag: { name: '魔术师雕像', dot: [-3.5, 23.76], pill: -138 } },
  { src: 'obj-robot.png', w: 99.582, h: 118.104, tf: 'rotate(20.25) skewX(20.25) scale(1,.94)' },
];
/* 物件名字标签：黄点 → 白线往左 34 → 斜线往左下 → 毛玻璃胶囊（131×39）里 14px 名字。dot = 黄点中心，pill = 胶囊左边相对黄点的 x */
const STATUE_TAG = { name: '魔术师雕像', dot: [-33, -238.92], pill: -125 };
const tag = (c, t, m = 1) => {                                                    // m = -1：整个标签左右镜像（黄点在物件右边，往右伸）
  const d = [c[0] + t.dot[0] * m, c[1] + t.dot[1]], f = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`, px = m > 0 ? d[0] + t.pill : d[0] - t.pill - 131, py = d[1] + 41;
  return `<g class="tag"><polyline points="${f(d)} ${f([d[0] - 36 * m, d[1]])} ${f([d[0] - 71 * m, py])}"/><circle cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="4"/>` +
    `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="131" height="39" rx="19.5"/><text x="${(px + 65.5).toFixed(1)}" y="${(py + 19.5).toFixed(1)}" text-anchor="middle" dominant-baseline="central">${esc(t.name)}</text></g>`;
};

/* 彩虹（Figma 477:4313 那道斜光带的形状：166×1450 梯形，宽端在左下、窄端在右上）。
   色带：横跨光带宽度的一整条浅彩虹 红→橙→黄→绿→蓝→紫，两侧过渡到透明，边缘柔化，整体 50% 透明。
   流光：一道柔和的白色高光沿长度从宽端滑向窄端，9s 一轮循环；整体亮度 85%~100% 呼吸，6s 一轮；
   每次切换平台再快速扫过一道亮光（0.9s，rainbowSweep()） */
const RB_PATH = 'M107.384 41.2691L139.429 0L166.238 1286.27L0 1449.78L107.384 41.2691Z';
const RAINBOW =
  `<svg class="tk-beam" width="166.238" height="1449.78" viewBox="0 0 166.238 1449.78" overflow="visible"><defs>` +
  `<linearGradient id="rb-c" x1="0" y1="0" x2="166.238" y2="0" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".14" stop-color="#ffd4d4"/><stop offset=".3" stop-color="#ffe2c4"/>` +
  `<stop offset=".46" stop-color="#fff4b8"/><stop offset=".62" stop-color="#c7ffc8"/><stop offset=".78" stop-color="#c9e6ff"/>` +
  `<stop offset=".9" stop-color="#e2d4ff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="rb-s" x1="0" y1="1450" x2="0" y2="1150" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
  `<animateTransform attributeName="gradientTransform" type="translate" from="0 300" to="0 -1500" dur="9s" repeatCount="indefinite"/></linearGradient>` +
  `<linearGradient id="rb-f" x1="0" y1="1450" x2="0" y2="1250" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
  `<animateTransform id="rb-go" attributeName="gradientTransform" type="translate" from="0 300" to="0 -1600" dur=".9s" begin="indefinite" fill="freeze"/></linearGradient>` +
  `<filter id="rb-blur" x="-30%" y="-5%" width="160%" height="110%"><feGaussianBlur stdDeviation="5"/></filter></defs>` +
  `<g filter="url(#rb-blur)"><path class="rb-c" d="${RB_PATH}" fill="url(#rb-c)"/><path class="rb-s" d="${RB_PATH}" fill="url(#rb-s)"/><path class="rb-f" d="${RB_PATH}" fill="url(#rb-f)"/></g></svg>`;
let rbSweepAt = -1e9;
function rainbowSweep() { rbSweepAt = performance.now(); const a = el && el.querySelector('#rb-go'); if (a && a.beginElement) a.beginElement(); }

/* 彩虹 · 极光版（参考 React Bits「Aurora」，WebGL 着色器）：浏览器支持 WebGL 时替换上面的 SVG 彩虹，不支持就留着 SVG。
   · 形状：同一个梯形，在着色器里按「横跨宽度的位置 t（0 左边缘 → 1 右边缘）」和「沿长度的位置 a（0 窄端 → 1 宽端）」来画；
     两侧和两端都在着色器里羽化，所以边缘是柔的
   · 过渡自然：7 个粉彩色沿 t 排开，再用一层慢速噪声把颜色边界扭曲、混合（极光那种互相渗透的感觉）
   · 自己流动：慢速噪声让颜色缓缓左右漂移；沿长度有一层细丝纹理从宽端往窄端流；亮度随噪声起伏；另有一道很淡的白光 9s 一轮扫过
   · 切换平台：一道更亮的白光 0.9s 从宽端扫到窄端（rainbowSweep） */
const AURORA_FS = `precision mediump float;
uniform vec2 uRes; uniform float uT; uniform float uSw;
vec3 perm(vec3 x){ return mod(((x*34.)+1.)*x, 289.); }
float snoise(vec2 v){
  const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
  vec2 i = floor(v + dot(v, C.yy)), x0 = v - i + dot(i, C.xx);
  vec2 i1 = x0.x > x0.y ? vec2(1., 0.) : vec2(0., 1.);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.);
  vec3 p = perm(perm(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
  vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.); m = m * m; m = m * m;
  vec3 x = 2. * fract(p * C.www) - 1., h = abs(x) - .5, ox = floor(x + .5), a0 = x - ox;
  m *= 1.79284291400159 - .85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130. * dot(m, g);
}
vec3 pal(float t){
  float s = clamp(t, 0., 1.) * 5.;
  vec3 c = mix(vec3(1., .83, .83), vec3(1., .886, .769), clamp(s, 0., 1.));
  c = mix(c, vec3(1., .957, .722), clamp(s - 1., 0., 1.));
  c = mix(c, vec3(.78, 1., .784), clamp(s - 2., 0., 1.));
  c = mix(c, vec3(.788, .902, 1.), clamp(s - 3., 0., 1.));
  return mix(c, vec3(.886, .831, 1.), clamp(s - 4., 0., 1.));
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes, p = vec2(uv.x * 166.238, (1. - uv.y) * 1449.78);
  float L = 107.384 - (p.y - 41.27) * (107.384 / 1408.51), R = 139.429 + p.y * (26.809 / 1286.27);
  float t = (p.x - L) / (R - L), a = p.y / 1449.78;
  float n1 = snoise(vec2(t * 1.2 + uT * .05, a * 2.5 - uT * .12));
  float n2 = snoise(vec2(t * 3. + 7., a * 9. - uT * .45));
  vec3 col = pal(smoothstep(.04, .96, t + n1 * .12));
  float edge = smoothstep(0., .24, t + n1 * .05) * smoothstep(1., .76, t - n1 * .05);
  float ends = smoothstep(0., .12, a) * smoothstep(1., .86, a);
  float streak = .78 + .22 * sin(a * 60. - uT * 2.2 + n2 * 2.5);
  float glow = clamp(.82 + .34 * n1, 0., 1.2);
  float idle = exp(-pow((a - (1.2 - fract(uT / 9.) * 1.4)) / .12, 2.)) * .3;
  float sw = (uSw > 0. && uSw < 1.) ? exp(-pow((a - (1.15 - uSw * 1.3)) / .06, 2.)) : 0.;
  float k = edge * ends;
  float alpha = k * (glow * streak * .55 + idle * .35 + sw * .45);
  col = mix(col, vec3(1.), clamp(idle + sw, 0., 1.) * .6);
  gl_FragColor = vec4(col * alpha, alpha);
}`;
function initAurora() {
  const svg = el.querySelector('svg.tk-beam'); if (!svg) return;
  const cv = document.createElement('canvas'); cv.className = 'tk-beam tk-aurora'; cv.width = 96; cv.height = 840;   // 半分辨率就够（本来就是柔的），省性能
  const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false }); if (!gl) return;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), fs = sh(gl.FRAGMENT_SHADER, AURORA_FS);
  if (!vs || !fs) return;
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(pr, 'uRes'), uT = gl.getUniformLocation(pr, 'uT'), uSw = gl.getUniformLocation(pr, 'uSw');
  gl.viewport(0, 0, cv.width, cv.height); gl.uniform2f(uRes, cv.width, cv.height);
  svg.style.display = 'none'; svg.before(cv);
  const t0 = performance.now();
  const frame = (now) => {
    if (el.classList.contains('on') && !document.hidden) {   // 只在任务页打开时画
      gl.uniform1f(uT, (now - t0) / 1000); gl.uniform1f(uSw, (now - rbSweepAt) / 900);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const poly = (c, tpl) => tpl.map(([x, y]) => `${(c[0] + x).toFixed(1)},${(c[1] + y).toFixed(1)}`).join(' ');
const txt = (c, off, tf, s, cls, fs, anchor = 'middle') => `<text class="${cls}" transform="translate(${(c[0] + off[0]).toFixed(1)} ${(c[1] + off[1]).toFixed(1)}) ${tf}" text-anchor="${anchor}" dominant-baseline="central"${fs ? ` style="font-size:${fs}px"` : ''}>${esc(s)}</text>`;

let el = null, $ = null, seq = [], sel = 0, q = '';

/* 章节里的站点按前置小节排成一条链 */
function chain(chid) {
  const st = D.stages.filter((s) => s.ch === chid), byPrev = {};
  st.forEach((s) => { byPrev[s.prev] = s; });
  const ids = new Set(st.map((s) => s.id)); let cur = st.find((s) => !s.prev || !ids.has(s.prev)); const out = [];
  while (cur && out.length < st.length) { out.push(cur); cur = byPrev[cur.id]; }
  st.forEach((s) => { if (!out.includes(s)) out.push(s); });
  return out;
}
const chIndex = (id) => MAIN.findIndex((c) => c.id === id);
function stateOf(ci, i) { const b = chIndex(PROGRESS.ch); return ci < b ? 'done' : ci > b ? 'lock' : i < PROGRESS.idx ? 'done' : i === PROGRESS.idx ? 'cur' : 'lock'; }

/* 把所有章节排成一整段往下折返的楼梯：章节平台和小节平台都在同一条路径上。记下每块平台的中心、怎么到达的（决定墙和字的方向） */
let path = [];
function layout() {
  seq = []; path = []; let c = [0, 0], k = 0;
  const push = (node) => { if (path.length) { const d = dirOf(k++); const v = d === 'L' ? GO_L : GO_R; path[path.length - 1].next = d; c = [c[0] + v[0], c[1] + v[1]]; node.via = d; } else node.via = 'L'; node.c = c; path.push(node); };
  if (mode === 'side') {   // 支线：解锁顺序排下来，同样左右交替
    if (SIDE) chain(SIDE.id).slice(0, SIDE_OPEN).forEach((st, i) => push({ side: true, st, ch: SIDE, ci: -1, i, n: SIDE_OPEN, sst: i < SIDE_DONE ? 'done' : 'new' }));
    seq = path; return;
  }
  MAIN.forEach((ch, ci) => {
    const list = chain(ch.id); if (!list.length) return;
    push({ plat: true, ch, ci });
    list.forEach((st, i) => push({ st, ch, ci, i, n: list.length }));
  });
  seq = path;
}
function stairsSVG() {
  // 按路径顺序画：先上后下，下面的平台盖在上面那面墙的底边上
  const pc = chIndex(PROGRESS.ch);
  return path.map((p) => {
    const wall = p.next === 'L' ? `<polygon class="wl" points="${poly(p.c, WL)}"/><polygon class="nz" points="${poly(p.c, WL)}"/>` :p.next === 'R' ? `<polygon class="wr" points="${poly(p.c, WR)}"/>` : '';
    const col = p.c[0] < COL_L / 2 ? ' cl' : '';   // 左列平台（设计稿 0-1 / 0-3）：顶面更深
    const top = `<polygon class="tp" points="${poly(p.c, RH)}"/><polygon class="ti" points="${poly(p.c, RHI)}"/>`;
    if (p.side) {   // 牌子按所在列：左列在左角（A），右列在右角（B）
      const ab = col ? 'A' : 'B', S = SIGN[ab], nm = p.st.name, fs = Math.max(30, Math.min(56, Math.floor(300 / ([...nm].length * .88))));
      return `<g class="tk-st tk-side ${p.sst}${col}" data-k="${path.indexOf(p)}" data-hot>${top}<polygon class="bar" points="${poly(p.c, SIDE_BAR[ab])}"/>` +
        txt(p.c, S.nm, S.tf, nm, 'nm', fs, S.anchor) + `</g>`;
    }
    if (p.plat) {
      const lock = p.ci > pc ? ' lock' : '', T = PLAT_TXT;
      return `<g class="tk-plat${lock}${col}" data-k="${path.indexOf(p)}" data-hot>${wall}${top}` +
        txt(p.c, T.sub.o, T.sub.tf, (p.ch.name.split('：')[1] || '').slice(0, 6), 'sub', T.sub.fs) + txt(p.c, T.title.o, T.title.tf, `第${NUMCN[p.ci] || p.ci}章`, 'ttl', T.title.fs) +
        txt(p.c, T.no.o, T.no.tf, String(p.ci), 'cno', T.no.fs) + `</g>`;
    }
    const S = SIGN[p.via === 'R' ? 'B' : 'A'], k = path.indexOf(p), st = stateOf(p.ci, p.i), nm = p.st.name;
    const fs = Math.max(30, Math.min(64, Math.floor(300 / ([...nm].length * .88))));   // 名字最长约 300 宽，超了就缩字
    const xy = (o) => `x="${(p.c[0] + o[0]).toFixed(1)}" y="${(p.c[1] + o[1]).toFixed(1)}"`;
    // 每章第 1 节：雕像（底座模糊投影 + 三个面 + 椭圆阴影 + 雕像 + 名字标签）；第 2、3 节：玻璃温室 / 机械装置
    let prop = '';
    if (p.i === 0) {
      prop = `<polygon class="pl-shd" points="${poly(p.c, PLINTH.shd)}"/><polygon class="pl-l" points="${poly(p.c, PLINTH.l)}"/><polygon class="pl-r" points="${poly(p.c, PLINTH.r)}"/><polygon class="pl-t" points="${poly(p.c, PLINTH.t)}"/>` +
        `<ellipse class="shd" cx="${(p.c[0] - 2.5).toFixed(1)}" cy="${(p.c[1] - 60.2).toFixed(1)}" rx="43.5" ry="9.5" transform="rotate(-15.4 ${(p.c[0] - 2.5).toFixed(1)} ${(p.c[1] - 60.2).toFixed(1)})"/>` +
        `<svg class="statue" ${xy(STATUE)} width="150" height="292" viewBox="0 0 150 292"><image href="${TA}statue-sheet.png" x="-190.25" y="-47.1" width="603.78" height="339.1" preserveAspectRatio="none"/></svg>` + tag(p.c, STATUE_TAG);
    } else if (PROPS[p.i]) {
      const P = PROPS[p.i], at = PROP_AT[p.via === 'R' ? 'B' : 'A'], c = [p.c[0] + at[0], p.c[1] + at[1]];
      prop = (P.shd ? `<ellipse class="oshd" cx="${(c[0] + P.shd[0]).toFixed(1)}" cy="${(c[1] + P.shd[1]).toFixed(1)}" rx="49" ry="11.5" transform="rotate(-21.15 ${(c[0] + P.shd[0]).toFixed(1)} ${(c[1] + P.shd[1]).toFixed(1)})"/>` : '') +
        `<image class="prop" href="${TA}${P.src}" x="${(-P.w / 2).toFixed(1)}" y="${(-P.h / 2).toFixed(1)}" width="${P.w}" height="${P.h}" preserveAspectRatio="none" transform="translate(${c[0].toFixed(1)} ${c[1].toFixed(1)}) ${P.tf}"/>` +
        (P.tag ? tag(c, P.tag, p.via === 'R' ? 1 : -1) : '');
    }
    return `<g class="tk-st ${KIND(p.st)} ${st}${col}" data-k="${k}" data-hot>${wall}${top}${prop}` +
      `<polygon class="bar" points="${poly(p.c, S.bar)}"/>` +
      txt(p.c, S.no, S.tf, `${p.ci}-${p.i + 1}`, 'no', 64, S.anchor) + txt(p.c, S.nm, S.tf, nm, 'nm', fs, S.anchor) + `</g>`;
  }).join('');
}

function mount(root) {
  el = root; el.classList.add('tasks');
  el.innerHTML =
    // 背景（固定在屏幕上，在楼梯后面）：三朵云（随滚动做视差）、左边三根白色细竖线、右下三根灰色细竖线。彩虹暂时去掉（Figma 483:355），要恢复就在竖线后面加回 ${RAINBOW}
    `<div class="tk-stage"><img class="tk-cloud a" src="${TA}cloud-a.svg" alt=""><img class="tk-cloud b" src="${TA}cloud-b.svg" alt=""><img class="tk-cloud c" src="${TA}cloud-c.svg" alt="">` +
    `<i class="tk-pil"></i><i class="tk-pil"></i><i class="tk-pil"></i><i class="tk-pil2"></i><i class="tk-pil2"></i><i class="tk-pil2"></i><svg class="tk-svg" width="1920" height="1080" viewBox="0 0 1920 1080">` +
    `<defs><filter id="tk-shd" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="tk-blur5" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5.3"/></filter>` +
    `<filter id="tk-ts" x="-20%" y="-50%" width="140%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".25"/></filter>` +
    `<linearGradient id="tk-pillg" x1="0" y1="0" x2="1" y2="1"><stop offset=".195" stop-color="rgb(241,246,255)" stop-opacity=".58"/><stop offset="1" stop-color="rgb(153,153,153)" stop-opacity=".58"/></linearGradient>` +
    // 灰墙上的颗粒：一块 200×200 的噪点图案（feTurbulence 只算一次，平铺）
    `<filter id="tk-nzf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 .95"/></filter>` +
    `<pattern id="tk-nz" width="200" height="200" patternUnits="userSpaceOnUse"><rect width="200" height="200" filter="url(#tk-nzf)"/></pattern></defs>` +
    `<g class="tk-cam"></g></svg></div>` +
    `<div class="tk-blur t"><i></i><i></i><i></i></div><div class="tk-blur b"><i></i><i></i><i></i></div>` +
    `<div class="tk-ttl"><b class="on" data-m="main" data-hot>主线</b><b data-m="side" data-hot>支线</b></div><div class="tk-track"></div>` +
    // 卡片底板（白 66% + 投影，里面是斜网格和喷泉，被卡片圆角裁掉）和卡片文字分两层：换选中时只换文字
    `<div class="tk-cardbg"><img class="dots" src="${TA}card-dots2.png" alt=""></div>` +
    `<div class="tk-card"></div>` +
    `<div class="tk-tbar"></div>` +
    `<div class="closer tk-back" data-hot><img src="assets/chars/icon-back.png" alt=""></div>` +
    `<div class="tk-search"><input type="text" spellcheck="false" data-hot><img src="assets/codex/icon-search.png" alt=""></div>` +
    `<div class="tk-tab1">任务</div><img class="tk-fd" src="assets/codex/icon-folder.png" alt="">` +
    // 主线 / 支线 / 地图 下拉（Figma 48:504）：按钮右上黄点 = 有新支线
    `<div class="tk-mode" data-hot><span>主线任务</span><svg class="cv" width="48" height="29" viewBox="0 0 48 29"><path d="M5 5L24 23L43 5"/></svg><q></q></div>` +
    `<div class="tk-dd"><div class="op cur" data-m="main" data-hot><i></i>主线任务</div><div class="op" data-m="side" data-hot><i></i>支线任务<q></q></div><div class="op off" data-hot><i></i>地图任务<small>未开放</small></div></div>` +
    `<div class="closer tk-x" data-hot><img src="assets/codex/icon-close.png" alt=""></div>`;
  $ = (s) => el.querySelector(s);
  layout(); $('.tk-cam').innerHTML = stairsSVG();
  initAurora();
  buildTrack();
  sel = defaultSel(); el.classList.add('sidenew');
  el.addEventListener('click', (e) => {
    // 下拉：点按钮开 / 关；选主线 / 支线；地图未开放只晃一下；开着时点别处 = 只收起
    if (e.target.closest('.tk-mode')) { ddOpen(!$('.tk-dd').classList.contains('open')); return; }
    const tt = e.target.closest('.tk-ttl b'); if (tt) { if (!tt.classList.contains('on')) { ddOpen(false); setMode(tt.dataset.m); } return; }   // 目录顶上的「主线 / 支线」标签：点另一个 = 切换
    const op = e.target.closest('.tk-dd .op'); if (op) { if (op.classList.contains('off')) { shake(op); return; } ddOpen(false); setMode(op.dataset.m); return; }
    if ($('.tk-dd').classList.contains('open')) { ddOpen(false); return; }
    const sr = e.target.closest('.tk-srow'); if (sr) { select(+sr.dataset.k); return; }
    const ar = e.target.closest('[data-step]'); if (ar) { select(sel + +ar.dataset.step); return; }
    // 未解锁的平台 / 小节 / 章节：点了不跳转，只轻晃一下
    const st = e.target.closest('.tk-st,.tk-plat'); if (st) { if (st.classList.contains('lock')) { shake(st); return; } spark(e); select(+st.dataset.k); return; }
    const ch = e.target.closest('.tk-chip'); if (ch) { if (ch.classList.contains('lock')) { shake(ch); return; } select(+ch.dataset.k); return; }
    // 点章节标题：收起时 = 展开并选中这一章的章节平台；已展开时 = 只收起（不动镜头和选中）
    const gh = e.target.closest('.tk-grp .hd'); if (gh) { const g = gh.parentNode, ci = +g.dataset.ci; if (g.classList.contains('lock')) { shake(gh); return; } if (g.classList.contains('fold')) select(seq.findIndex((x) => x.plat && x.ci === ci)); else g.classList.add('fold'); return; }
    const go = e.target.closest('.tk-go'); if (go) { press(go, e); return; }
  });
  let wAt = 0;
  $('.tk-stage').addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) < 4 || performance.now() - wAt < 200) return; wAt = performance.now(); select(sel + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
  $('.tk-search input').addEventListener('input', (e) => {
    q = e.target.value.trim(); el.classList.toggle('searching', !!q);
    el.querySelectorAll('.tk-st').forEach((n) => n.classList.toggle('hit', !!q && seq[+n.dataset.k].st.name.includes(q)));
    if (q) { const k = seq.findIndex((s) => !s.plat && s.st.name.includes(q)); if (k >= 0) select(k); }
  });
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('on')) return;
    if (e.target.tagName === 'INPUT') { e.stopImmediatePropagation(); return; }
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (e.key === 'Enter') { const go = $('.tk-go'); if (go) { eat(); press(go); } return; }   // 回车 = 按主按钮
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { eat(); select(sel + 1); } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { eat(); select(sel - 1); }
  }, true);
  select(sel, true);
}

const progressK = () => { if (mode === 'side') return seq.length - 1; const k = seq.findIndex((s) => !s.plat && s.ch.id === PROGRESS.ch && s.i === PROGRESS.idx); return k < 0 ? seq.length - 1 : k; };
/* 默认选中：主线 = 当前进度；支线 = 第一条未开始的（都做完了就最后一条） */
const defaultSel = () => { if (mode === 'side') { const k = seq.findIndex((s) => s.sst === 'new'); return k < 0 ? Math.max(0, seq.length - 1) : k; } return progressK(); };
function ddOpen(o) { $('.tk-dd').classList.toggle('open', o); el.classList.toggle('dd', o); }
/* 主线 ⇄ 支线：楼梯整个淡掉，换成另一套从下往上升起；目录、卡片跟着换 */
function setMode(m, quiet) {
  if (m === mode && !quiet) return;
  const apply = () => {
    mode = m; if (m === 'side') sideSeen = true;
    el.classList.toggle('side', m === 'side'); el.classList.toggle('sidenew', !sideSeen);
    $('.tk-mode span').textContent = m === 'side' ? '支线任务' : '主线任务'; el.querySelectorAll('.tk-ttl b').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    el.querySelectorAll('.tk-dd .op').forEach((o) => o.classList.toggle('cur', o.dataset.m === m));
    $('.tk-search input').value = ''; q = ''; el.classList.remove('searching');
    layout(); $('.tk-cam').innerHTML = stairsSVG(); buildTrack();
    sel = -1; select(defaultSel(), true);
  };
  if (quiet) { apply(); return; }
  $('.tk-cam').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).finished.then(() => {
    apply(); $('.tk-cam').getAnimations().forEach((a) => a.cancel());
    el.querySelectorAll('.tk-st,.tk-plat').forEach((n) => { const d = Math.abs(+n.dataset.k - sel); if (d > 6) return;
      n.animate([{ opacity: 0, transform: 'translateY(80px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: d * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }); });
    $('.tk-card').animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: GL });
    el.querySelectorAll('.tk-track>*').forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 60 + i * 40, easing: GL, fill: 'backwards' }));
    decrypt($('.tk-ttl b.on')); halftone();
  });
}
function bump() { const c = $('.tk-cam'); c.animate([{ translate: '0 0' }, { translate: '0 -18px' }, { translate: '0 0' }], { duration: 420, easing: 'cubic-bezier(.3,1.4,.5,1)' }); }
/* 主按钮按下：缩一下 + 点击处火花（回车时火花在按钮中间）；不可点的按钮只轻晃 */
function press(go, e) {
  if (go.classList.contains('off')) { shake(go); return; }
  go.animate([{ transform: 'scale(.96)' }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
  if (e) spark(e); else { const r = go.getBoundingClientRect(); spark({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }); }
}
function shake(n) { n.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 360, easing: 'ease-out' }); }
function select(k, quiet) {
  if (!seq.length) return;
  // 只能走到当前进度为止：滚轮 / 方向键 / 搜索往下到头时停住，楼梯轻轻弹一下表示「到底了」
  const lim = progressK(); if (k > lim) { k = lim; if (k === sel && !quiet) { bump(); return; } }
  k = Math.max(0, Math.min(seq.length - 1, k)); const changed = k !== sel; sel = k;
  const s = seq[k], pc = chIndex(PROGRESS.ch);
  el.querySelectorAll('.tk-st,.tk-plat').forEach((n) => n.classList.toggle('sel', +n.dataset.k === k));
  const cam = $('.tk-cam'), an = ANCHOR;
  if (quiet) cam.style.transition = 'none';
  cam.style.transform = `translate(${(an[0] - COL_L).toFixed(1)}px,${(an[1] - s.c[1]).toFixed(1)}px)`;
  clouds((seq[1] ? seq[1].c[1] : 0) - s.c[1], quiet);
  if (quiet) { void cam.getBoundingClientRect(); cam.style.transition = ''; }
  // 左：目录（刻度尺）跟着选中走
  syncTrack(s, k, quiet);
  if (!quiet && changed) rainbowSweep();
  // 右：详情卡片。上半（Figma 476:1871）：「第X章　序号」→ 大标题 → 分隔线 → 概括；
  // 小节：标题下一行〈类型 · 关联〉；章节平台：概括下面是本章进度条。
  // 最底下（Figma 483:355）：左边奖励框（黄 / 浅灰 / 深灰三条底带 + 白字「奖励」+ 三个奖励格），右边单独的按钮框
  // （48px 玄黑体两个字 + 23px 黄方块：开始 / 回溯 / 继续 / 回顾 / 未解锁）；已完成时奖励格盖灰底白勾；未解锁时奖励框上方写解锁条件
  const btn = (act, txt) => act[1] +
    `<div class="tk-rwb${act[0] === 're' ? ' got' : ''}"><i class="y"></i><i class="g"></i><i class="d"></i><b>奖励</b>` +
    REWARDS.map((r) => `<div class="tl"><img src="${TA}${r.src}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px" alt="">${act[0] === 're' ? `<img class="ck" src="${TA}rw-got.svg" alt="">` : ''}</div>`).join('') + `</div>` +
    `<div class="tk-go ${act[0]}${[...txt].length > 2 ? ' sm' : ''}"${act[0] === 'off' ? '' : ' data-hot'}><i class="pl"></i><span>${txt}</span></div>`;
  if (s.side) {   // 支线卡片（Figma 48:720）：「支线」→ 名字 → <分类> → 分隔线 → 概括；底部奖励 + 回溯（已完成）/ 开始（未开始）
    const done = s.sst === 'done', act = done ? ['re', ''] : ['', ''];
    $('.tk-card').innerHTML =
      `<div class="hd"><b>支线</b></div>` +
      `<h2>${esc(s.st.name)}</h2><div class="tg">&lt;${esc(KIND_NAME[KIND(s.st)])}&gt;</div><i class="ln"></i>` +
      `<p>${s.st.desc ? esc(s.st.desc) : '<span class="nil">暂无简介</span>'}</p>` +
      btn(act, done ? '回溯' : '开始');
  } else if (s.plat) {
    const items = seq.filter((x) => !x.plat && x.ci === s.ci), n = items.length, done = s.ci < pc ? n : s.ci > pc ? 0 : PROGRESS.idx;
    const lock = s.ci > pc, prevCh = MAIN[s.ci - 1];
    const bar = items.map((x) => `<i class="${stateOf(x.ci, x.i)}"></i>`).join('');
    const act = lock ? ['off', `<p class="st lk"><img src="${TA}lock.png" alt="">${esc(s.ch.hint || (prevCh ? `完成「${prevCh.name}」后解锁` : '完成前一章后解锁'))}</p>`]
      : s.ci < pc ? ['re', ''] : ['', ''];
    $('.tk-card').innerHTML =
      `<div class="hd"><b>第${NUMCN[s.ci] || s.ci}章</b><b>共 ${n} 节</b></div>` +
      `<h2>${esc(s.ch.name.split('：')[1] || s.ch.name)}</h2><i class="ln"></i>` +
      `<p>${s.ch.desc ? esc(s.ch.desc) : '<span class="nil">暂无简介</span>'}</p>` +
      `<div class="tk-prog"><b>本章进度</b><span class="tk-pgv">${done} / ${n}</span><div class="tk-bar">${bar}</div></div>` +
      btn(act, lock ? '未解锁' : s.ci < pc ? '回顾' : '继续');
  } else {
    const st = stateOf(s.ci, s.i), prev = s.i > 0 ? seq[k - 1].st : null, hint = s.st.hint || (prev ? `完成「${prev.name}」后解锁` : '完成前一级后解锁');
    const kind = KIND_NAME[KIND(s.st)], rel = s.st.type && s.st.type !== kind ? s.st.type : '';
    const act = st === 'lock' ? ['off', `<p class="st lk"><img src="${TA}lock.png" alt="">${esc(hint)}</p>`]
      : st === 'done' ? ['re', ''] : ['', ''];
    $('.tk-card').innerHTML =
      `<div class="hd"><b>第${NUMCN[s.ci] || s.ci}章</b><b>${s.ci}-${s.i + 1}</b></div>` +
      `<h2>${esc(s.st.name)}</h2><div class="tg">&lt;${esc(kind)}${rel ? ` · ${esc(rel)}` : ''}&gt;</div><i class="ln"></i>` +
      `<p>${s.st.desc ? esc(s.st.desc) : '<span class="nil">暂无简介</span>'}</p>` +
      btn(act, st === 'lock' ? '未解锁' : st === 'done' ? '回溯' : '开始');
  }
  { // 标题始终一行：字多时缩小（64px 起，最小 36px），免得把概括挤到下面的信息区
    const h = $('.tk-card h2'), L = [...h.textContent].length; if (L * 64 > 455) h.style.fontSize = `${Math.max(36, Math.floor(455 / L))}px`;
  }
  if (changed && !quiet) {
    $('.tk-card').animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: GL });
    decrypt($('.tk-card h2'));
    const pg = $('.tk-card .tk-pgv'); if (pg) countUp(pg);
    $('.tk-card').querySelectorAll('.tk-rwb .ck').forEach((n, i) => n.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 220 + i * 90, easing: 'cubic-bezier(.3,1.6,.5,1)', fill: 'backwards' }));   // 已完成：奖励格上的对勾依次弹出
    $('.tk-card').querySelectorAll('.tk-prog .tk-bar i').forEach((n, i) => n.animate([{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 380, delay: 120 + i * 10, easing: GL, fill: 'backwards' }));   // 进度条依次长出来
  }
  halftone(quiet);
}

/* —— 动效（参考 React Bits，改写成原生 JS，只保留黑白灰 + 黄） —— */
// Halftone Reveal：选中平台的黄色先以网点长出来，网点长满后才换成整块黄
/* 云的视差：楼梯每移动 1px，云只移动 CLOUD_K px（选中 0-1 时云在设计稿位置）；和镜头同时开始、同时结束（同为 0.8s GLIDE），只是位移小。
   云移出屏幕上方后从下方绕回来（周期 CLOUD_P），往下翻多少节都一直有云 */
const CLOUD_K = 1 / 3,CLOUD_P = 1500, CLOUD_MS = 800, CLOUD_TOP = { a: 263.8, b: 522.8, c: 934.8 };
// GLIDE = cubic-bezier(.7,0,.2,1) 的 JS 版（牛顿迭代解 x→t），保证云和 .tk-cam 的 CSS 过渡曲线一模一样
const GLIDE = (() => {
  const x1 = .7, y1 = 0, x2 = .2, y2 = 1, B = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  const dB = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x) => { let t = x; for (let i = 0; i < 8; i++) { const d = dB(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (B(t, x1, x2) - x) / d; t = Math.min(1, Math.max(0, t)); } return B(t, y1, y2); };
})();
let cloudNow = 0, cloudRaf = 0;
function placeClouds(off) {
  el.querySelectorAll('.tk-cloud').forEach((n) => {
    const base = CLOUD_TOP[n.classList[1]];
    n.style.top = `${((((base + off + 300) % CLOUD_P) + CLOUD_P) % CLOUD_P - 300).toFixed(1)}px`;
  });
}
function clouds(camDy, quiet) {
  const to = camDy * CLOUD_K, from = cloudNow, t0 = performance.now();
  cancelAnimationFrame(cloudRaf);
  if (quiet) { cloudNow = to; placeClouds(to); return; }
  const tick = () => {
    const p = Math.min(1, (performance.now() - t0) / CLOUD_MS); cloudNow = from + (to - from) * GLIDE(p); placeClouds(cloudNow);
    if (p < 1) cloudRaf = requestAnimationFrame(tick);
  };
  tick();
}

/* 选中平台变黄（线 → 面）：黄色先在顶面后边缘出现成一条细线，再沿着平台的斜面往前铺开，直到铺满整个顶面。
   内圈四个角 p0 p1 p2 p3：p0-p1 是起始边，铺到对边 p3-p2；延迟 220ms 开始（镜头正在移动），480ms，GLIDE */
let htTok = 0;
function halftone(quiet) {
  const tok = ++htTok;
  el.querySelectorAll('.tk-ht').forEach((n) => n.remove()); el.querySelectorAll('.pre').forEach((n) => n.classList.remove('pre'));
  const g = el.querySelector('.tk-st.sel,.tk-plat.sel'); if (!g || quiet) return;
  const tp = g.querySelector('.ti'), ov = tp.cloneNode(); ov.setAttribute('class', 'tk-ht'); tp.after(ov); g.classList.add('pre');
  const [p0, p1, p2, p3] = tp.getAttribute('points').trim().split(/\s+/).map((v) => v.split(',').map(Number));
  const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const set = (t) => { const e = Math.max(t, .012), q = at(p1, p2, e), r = at(p0, p3, e); ov.setAttribute('points', [p0, p1, q, r].map((v) => v.map((n) => n.toFixed(1)).join(',')).join(' ')); };
  set(0); ov.style.opacity = '0';
  const t0 = performance.now() + 220, D = 480;
  const tick = (now) => {
    if (tok !== htTok) return;
    const t = (now - t0) / D;
    if (t < 0) { requestAnimationFrame(tick); return; }
    ov.style.opacity = '1'; set(GLIDE(Math.min(1, t)));
    if (t < 1) requestAnimationFrame(tick); else { g.classList.remove('pre'); ov.remove(); }
  };
  requestAnimationFrame(tick);
}
// Decrypted Text：标题先是乱码，从左到右逐字解出
let decTok = 0; const POOL = [...new Set((window.TASKS ? window.TASKS.stages : []).map((x) => x.name).join('').replace(/[\s\d\w「」（）·：，。！？、—…]/g, ''))];
function decrypt(n) {
  if (!n || !POOL.length) return;
  const tok = ++decTok, txt = [...n.textContent], t0 = performance.now(), step = Math.max(28, Math.min(60, 420 / txt.length));
  const rnd = (c) => (/\s/.test(c) ? c : /[0-9A-Za-z]/.test(c) ? '0123456789'[Math.random() * 10 | 0] : POOL[Math.random() * POOL.length | 0]);
  const tick = () => {
    if (tok !== decTok) return;
    const t = performance.now() - t0, done = Math.floor((t - 140) / step);
    n.textContent = txt.map((c, i) => (i < done ? c : rnd(c))).join('');
    if (done < txt.length) setTimeout(tick, 45); else n.textContent = txt.join('');
  };
  tick();
}
// Count Up：章节进度数字从 0 数上去
function countUp(n) {
  const [a, b] = n.textContent.split(' / ').map(Number), t0 = performance.now();
  const tick = () => { const p = Math.min(1, (performance.now() - t0) / 700), e = 1 - Math.pow(1 - p, 3); n.textContent = `${Math.round(a * e)} / ${b}`; if (p < 1) requestAnimationFrame(tick); };
  tick();
}
// Click Spark：点到平台时，点击处迸出 8 根短黑线
function spark(e) {
  const r = el.getBoundingClientRect(), k = r.width / 1920, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'tk-spark');
  s.setAttribute('style', `left:${x - 40}px;top:${y - 40}px`); s.setAttribute('viewBox', '-40 -40 80 80');
  s.innerHTML = Array.from({ length: 8 }, (_, i) => `<g transform="rotate(${i * 45})"><line x1="0" y1="-12" x2="0" y2="-24"/></g>`).join('');
  el.appendChild(s);
  s.querySelectorAll('line').forEach((l) => l.animate([{ strokeDashoffset: 0, transform: 'translateY(0)' }, { strokeDashoffset: -12, transform: 'translateY(-12px)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }));
  setTimeout(() => s.remove(), 450);
}
// Animated List：展开章节时，小节的刻度和编号依次从脊上「长」出来（刻度从 0 伸长，编号从左边 12px 滑入）
function dealChips(grp) {
  grp.querySelectorAll('.tk-chip').forEach((n, i) => {
    const o = { duration: 420, delay: 80 + Math.min(i, 16) * 24, easing: GL, fill: 'backwards' };
    n.querySelector('.tick').animate([{ transform: 'scaleX(0)' }, { transform: 'none' }], o);
    n.querySelector('b').animate([{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], o);
  });
}

/* 左侧章节目录：刻度尺（不画竖线）。章节 = 黑色小方块 +「第X章」+ 灰色章名；小节 = 一根短刻度 + 编号，悬停时展开小节名。
   只展开选中所在的那一章（手风琴），其它章收起只剩标题；选中的小节由一个黄色小方块沿刻度左端滑过去标出 */
function buildTrack() {
  if (mode === 'side') {   // 支线：只列已解锁的，一行一条；右边小方块 深灰 = 已完成、黄 = 未开始；选中白底（Figma 48:720）
    $('.tk-track').innerHTML = seq.map((s, k) => `<div class="tk-srow ${s.sst}" data-k="${k}" data-hot><b>${esc(s.st.name)}</b><i></i></div>`).join('');
    return;
  }
  let h = '';
  MAIN.forEach((ch, ci) => {
    const items = seq.map((s, k) => [s, k]).filter(([s]) => s.ci === ci && !s.plat); if (!items.length) return;
    const sub = ch.name.split('：')[1];
    const lk = ci > chIndex(PROGRESS.ch);   // 进度之后的章节：标题前面是锁，不是方块
    h += `<div class="tk-grp fold${lk ? ' lock' : ''}" data-ci="${ci}"><div class="hd" data-hot>${lk ? `<em><img src="${TA}lock.png" alt=""></em>` : '<i class="sq"></i>'}<b>第${NUMCN[ci] || ci}章</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>` +
      `<div class="ls"><div class="in"><i class="tk-ind"></i>` +
      items.map(([s, k]) => { const st = stateOf(s.ci, s.i); return `<div class="tk-chip ${st}" data-k="${k}" data-hot><i class="tick"></i>${st === 'lock' ? `<em><img src="${TA}lock.png" alt=""></em>` : ''}<b>${s.ci}-${s.i + 1}</b><span>${esc(s.st.name)}</span></div>`; }).join('') +
      `</div></div></div>`;
  });
  $('.tk-track').innerHTML = h;
}
/* 目录跟着选中走：只展开选中所在的章；黄色方块滑到选中的那一格；目录只在自己的框里滚 */
function syncTrack(s, k, quiet) {
  if (mode === 'side') {
    el.querySelectorAll('.tk-srow').forEach((n) => n.classList.toggle('on', +n.dataset.k === k));
    const on = el.querySelector('.tk-srow.on'); if (on) on.scrollIntoView({ block: 'nearest', behavior: quiet ? 'auto' : 'smooth' });
    return;
  }
  el.querySelectorAll('.tk-grp').forEach((g) => {
    const me = +g.dataset.ci === s.ci, was = g.classList.contains('fold');
    g.classList.toggle('fold', !me); g.classList.toggle('on', me && !!s.plat);
    if (me && was && !quiet) dealChips(g);
  });
  el.querySelectorAll('.tk-chip').forEach((n) => { const d = Math.abs(+n.dataset.k - k); n.classList.toggle('on', d === 0); });
  el.querySelectorAll('.tk-ind').forEach((ind) => {
    const on = ind.parentNode.querySelector('.tk-chip.on');
    if (!on) { ind.classList.remove('show'); return; }
    if (!ind.classList.contains('show') || quiet) { ind.style.transition = 'none'; void ind.offsetWidth; }   // 刚换到这一章：直接出现在位置上，不从别处滑过来
    ind.style.transform = `translateY(${on.offsetTop + 10.5}px)`; ind.classList.add('show');   // 方块 6 的中心对准横线（行内 13.5）
    requestAnimationFrame(() => { ind.style.transition = ''; });
  });
  const tr = $('.tk-track'), grp = el.querySelector(`.tk-grp[data-ci="${s.ci}"]`);
  const fit = () => {   // 手风琴展开收起要 0.55s，位置要等它停下才准
    if (!grp) return;
    const on = grp.querySelector('.tk-chip.on'), top = (!on || s.i < 4 ? grp.offsetTop : grp.offsetTop + on.offsetTop - 80) - 20,   /* 扣掉顶部 20px 渐隐区 */
      bot = on ? grp.offsetTop + on.offsetTop + 160 : grp.offsetTop + 200;
    if (top < tr.scrollTop) tr.scrollTo({ top, behavior: quiet ? 'auto' : 'smooth' });
    else if (bot > tr.scrollTop + tr.clientHeight) tr.scrollTo({ top: bot - tr.clientHeight, behavior: quiet ? 'auto' : 'smooth' });
  };
  fit(); if (!quiet) setTimeout(fit, 560);
}
// o.mode = 'main'（白板「任务」「主线」）| 'side'（白板「支线」）
function enter(o = {}) {
  ddOpen(false); setMode(o.mode === 'side' ? 'side' : 'main', true);
  const an = (s, kf, o) => el.querySelectorAll(s).forEach((n, i) => n.animate(kf, Object.assign({ easing: GL, fill: 'backwards' }, o, o.stag ? { delay: (o.delay || 0) + i * o.stag } : {})));
  an('.tk-tbar,.tk-search,.tk-tab1,.tk-fd,.tk-mode,.tk-back,.tk-x', [{ transform: 'translateY(-70px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 350, stag: 40 });   // 文件夹图标、主线任务下拉跟顶栏一起落下
  an('.tk-cardbg,.tk-card',[{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 500 });
  an('.tk-ttl,.tk-track',[{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 550, stag: 60 });
  // 选中附近的台阶从下往上依次升起
  el.querySelectorAll('.tk-st,.tk-plat').forEach((n) => {
    const k = n.dataset.k !== undefined ? +n.dataset.k : sel, d = Math.abs(k - sel); if (d > 6) return;
    n.animate([{ opacity: 0, transform: 'translateY(80px)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 600 + d * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
}

window.Tasks = { mount, enter };
})();
