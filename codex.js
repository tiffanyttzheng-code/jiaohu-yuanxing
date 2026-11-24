/* 图鉴内容页：分类（左侧滚动条）→ 卡堆（斜白板 4×2）→ 扇形（分支）→ 书（详情）。
   设计稿：Figma 390:278 / 390:144。对外：window.Codex = { open(cat, from, cats, onClose, sec), close(), isOpen }。
   sec = 'wiki'（作品百科）| 'xiang'（万象站）：两边共用这个内页，只有顶栏的标签文字和下拉菜单的当前项不同。
   数据来自飞书表（codex-data.js）：组 = DisplayName，分支 = ItemBranches，简介 = Introduction，故事 = Info1 / Info2 / Info3。 */
(() => {
'use strict';
const A = window.Atlas;
if (!A) return;
const GL = 'cubic-bezier(.7,0,.2,1)';
const AS = 'assets/codex/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const f2 = (v) => Math.round(v * 100) / 100;

/* ---------- 设计稿数值 ---------- */
// 三条地砖带：[left, top]（外框左上角）。浅色带 #f3f3f3 / 白板内的深色重叠 #c7c7c7 / 最下面一条 #d9d9d9
const TL = [[-203, 637], [1042.49, 827.66], [419.72, 732.33], [1665.24, 922.99], [108.34, 684.67], [1353.87, 875.33], [731.09, 780], [-99.24, 652.89], [1146.28, 843.55], [523.51, 748.22], [1769.03, 938.88], [212.13, 700.56], [1457.66, 891.22], [834.91, 795.89], [4.55, 668.78], [1250.07, 859.44], [627.3, 764.11], [1872.82, 954.77], [315.92, 716.44], [1561.45, 907.1], [938.7, 811.77]];
const TD = [[-196, 638], [1049.49, 828.66], [426.75, 733.33], [1672.24, 923.99], [115.37, 685.67], [1360.87, 876.33], [738.12, 781], [-92.21, 653.89], [1153.28, 844.55], [530.54, 749.22], [1776.03, 939.88], [219.16, 701.56], [1464.66, 892.22], [841.91, 796.89], [11.58, 669.78], [1257.07, 860.44], [634.33, 765.11], [1879.82, 955.77], [322.96, 717.44], [1568.45, 908.1], [945.7, 812.77]];
const TB = [[484.81, 778.24], [1193.94, 560.13], [1903.15, 342], [-123, 965.18], [586.13, 747.07], [1295.34, 528.94], [383.5, 809.4], [1092.63, 591.29], [1801.84, 373.16], [282.18, 840.56], [991.31, 622.45], [1700.52, 404.32], [180.86, 871.72], [889.99, 653.61], [1599.21, 435.49], [79.55, 902.88], [788.68, 684.78], [1497.89, 466.65], [-21.77, 934.04], [687.36, 715.94], [1396.58, 497.81], [2004.47, 310.83], [2105.79, 279.66]];   // 末尾多补几块：条带移动时那一端不会露出空缺
const TC = [[310.62, 402.06], [788.51, -165.44], [1266.46, -733], [-99, 888.47], [378.89, 320.98], [856.85, -246.59], [242.34, 483.14], [720.23, -84.36], [1198.18, -651.92], [174.06, 564.22], [651.95, -3.28], [1129.9, -570.84], [105.78, 645.3], [583.68, 77.8], [1061.62, -489.76], [37.5, 726.38], [515.4, 158.88], [993.35, -408.68], [-30.78, 807.46], [447.12, 239.96], [925.07, -327.6], [-167.27, 969.55], [-235.54, 1050.63]];   // 末尾多补几块：条带移动时那一端不会露出空缺
const TA = [[596.07, 1543.62], [-33.97, 452.45], [281.07, 998.06], [-348.99, -93.14], [438.58, 1270.85], [-191.48, 179.66], [123.56, 725.27], [543.58, 1452.71], [-86.48, 361.52], [228.56, 907.13], [-401.5, -184.07], [386.07, 1179.92], [-243.99, 88.73], [71.03, 634.31], [491.08, 1361.78], [-138.98, 270.59], [176.06, 816.2], [-454, -275], [333.57, 1088.99], [-296.49, -2.21], [18.53, 543.38]];
const COLX = [1041, 1237.5, 1433, 1634];           // 4 列的中心（设计稿 403:592，第 4 列右移到 1570）
const ROWB = [498, 755];                           // 2 行卡片的底边（新稿：第 1 行上沿 367 + 131，第 2 行 624 + 131；白板整体比旧稿低 25）
const PAGE = 8;
const TICK_Y = (j) => 348.5 + 43 * j;              // 滚动条每条线的中心 y
const TICK_X = [14, 8, 4, 0, 0];                   // 离选中线 0/1/2/3/4+ 格时的右凸量
const TICK_UP = ['#000', '#969696', 'rgba(132,132,132,.6)', 'rgba(178,178,178,.5)', 'rgba(210,210,210,.4)'];
const TICK_DN = ['#000', 'rgba(120,120,120,.8)', 'rgba(181,181,181,.6)', 'rgba(217,217,217,.4)', 'rgba(210,210,210,.4)'];

/* ---------- DOM ---------- */
const root = document.createElement('div');
root.className = 'cdx';
root.innerHTML =
  `<div class="cdx-band ta"></div><div class="cdx-band tb"></div><div class="cdx-band tc"></div>` +
  `<canvas class="cdx-dots" width="1920" height="500"></canvas>` +
  `<img class="cdx-glow" src="${AS}glow.svg">` +
  `<div class="cdx-band tl"></div>` +
  `<div class="cdx-panelwrap">` +
    `<img class="cdx-panel" src="${AS}panel.svg">` +
    `<div class="cdx-dark td"></div>` +
    `<img class="cdx-tabline" src="${AS}tab-line.svg">` +
    `<div class="cdx-tabs"></div>` +
    `<div class="cdx-pg"><i>◂</i><span></span><i>▸</i></div>` +
    `<div class="cdx-empty">这个分类还没有收录内容</div>` +
  `</div>` +
  `<div class="cdx-statuewrap"><div class="cdx-pole"></div><img class="cdx-statue" src="${AS}statue.png"></div>` +
  `<div class="cdx-rail"></div>` +
  `<div class="cdx-stage"></div><div class="cdx-fan"></div>` +
  `<div class="cdx-top">` +
    `<div class="cdx-bar"></div>` +
    `<div class="cdx-back" data-hot><img src="assets/chars/icon-back.png" alt=""></div>` +
    `<input class="cdx-search" type="text" spellcheck="false" data-hot>` +
    `<img class="a" src="${AS}icon-search.png" style="left:346px;top:46px;width:51.559px;height:34.927px;transform:rotate(14.85deg)">` +
    `<div class="cdx-t1">` +
      `<div class="wb" style="left:1371px;top:38px;width:120px;height:55px"></div><div class="tt" style="left:1392px;top:40px">图鉴</div>` +
      `<img class="a" src="${AS}icon-folder.png" style="left:1508px;top:44px;width:42px;height:42px">` +
      `<div class="wb" style="left:1566px;top:37px;width:241px;height:55px"></div><div class="tt sec" style="left:1579px;top:40px">作品百科</div>` +
      `<img class="a" src="assets/chars/icon-chev.png" style="left:1748px;top:51px;width:48px;height:29px">` +
      `<div class="cdx-dd" data-hot></div><div class="cdx-menu"><div data-go="wiki" data-hot>作品百科</div><div data-go="xiang" data-hot>万象站</div></div>` +
    `</div>` +
    `<div class="cdx-t2">` +
      `<div class="wb" style="left:1077px;top:38px;width:120px;height:55px"></div><div class="tt" style="left:1098px;top:40px">图鉴</div>` +
      `<img class="a" src="${AS}icon-folder.png" style="left:1214px;top:44px;width:42px;height:42px">` +
      `<div class="wb" style="left:1272px;top:37px;width:241px;height:55px"></div><div class="tt sec" style="left:1285px;top:40px">作品百科</div>` +
      `<img class="a" src="assets/chars/icon-chev.png" style="left:1454px;top:51px;width:48px;height:29px">` +
      `<img class="a" src="${AS}icon-folder.png" style="left:1530px;top:44px;width:42px;height:42px">` +
      `<div class="wb" style="left:1583px;top:37px;width:224px;height:55px"></div><div class="tt t2cat" style="left:1596px;top:40px"></div>` +
      `<div class="cdx-fb" data-hot style="left:1077px;top:37px;width:730px;height:55px"></div>` +
    `</div>` +
    `<div class="cdx-close" data-hot><img src="${AS}icon-close.png"></div>` +
  `</div>`;
// 地砖带（三组）
const fill = (el, arr) => { el.innerHTML = '<div class="tr">' + arr.map((p) => `<div class="tw" style="left:${p[0]}px;top:${p[1]}px"><div class="ti"></div></div>`).join('') + '</div>'; };
fill(root.querySelector('.cdx-band.ta'), TA);
fill(root.querySelector('.cdx-band.tb'), TB);
fill(root.querySelector('.cdx-band.tc'), TC);
fill(root.querySelector('.cdx-band.tl'), TL);
fill(root.querySelector('.cdx-dark'), TD);
A.el.appendChild(root);

const $ = (q, r = root) => r.querySelector(q);
const rail = $('.cdx-rail'), stage = $('.cdx-stage'), fan = $('.cdx-fan'), tabsEl = $('.cdx-tabs'), pgEl = $('.cdx-pg'), emptyEl = $('.cdx-empty'),
  searchEl = $('.cdx-search'), menuEl = $('.cdx-menu'), statueWrap = $('.cdx-statuewrap'), panelWrap = $('.cdx-panelwrap');

let cats = [], cat = '', allGroups = [], tabs = [], tab = '', q = '', pageNo = 0, groups = [], mode = 'stacks', curG = -1, curI = -1,
  busy = false, page = 0, onClose = null, sec = 'wiki', srcPt = [960, 540], stackEls = [], book = null, bookSrc = null, isOpen = false, tickEls = [], selEl = null;

const rectOf = (el) => { // 元素在舞台（1920×1080）里的包围盒
  const r = el.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(), s = st.width / 1920;
  return { x: (r.left - st.left) / s, y: (r.top - st.top) / s, w: r.width / s, h: r.height / s };
};
const setDeep = (on) => root.classList.toggle('deep', on);
const syncMode = () => { root.dataset.m = mode; };            // 顶栏 / 背景按模式切换（stacks / fan / book）
let bkHead = null, bkArr = null;                               // bkArr：书两侧的翻页箭头                                            // 书页顶上的大标题 + 简介

/* ---------- 文字特效 ----------
   · floatText：逐字从下方「槽」里拉长升起（Scroll Float 的思路），带轻微过冲，逐字错开
   · scramble：名字先是乱码，从左到右逐字定下来（Decrypted Text 的思路）
   · flapNumber：页码像翻牌一样翻（Split Flap 的思路）
   · clickSpark：点击处溅出几道黄 / 黑的墨迹线（Click Spark 的思路） */
const FLOAT_EASE = 'cubic-bezier(.34,1.45,.5,1)';
function floatText(el, text, o = {}) {
  const { stagger = 34, dur = 760, delay = 0, dist = 115, stretch = 2.2 } = o;
  el.textContent = '';
  [...text].forEach((ch, i) => {
    const slot = document.createElement('span'); slot.className = 'fxs';
    const g = document.createElement('span'); g.className = 'fxc'; g.textContent = ch === ' ' ? '\u00a0' : ch;
    slot.appendChild(g); el.appendChild(slot);
    g.animate([{ transform: `translateY(${dist}%) scaleY(${stretch})`, transformOrigin: '50% 100%', opacity: 0 }, { opacity: 1, offset: .25 }, { transform: 'none', transformOrigin: '50% 100%', opacity: 1 }],
      { duration: dur, delay: delay + i * stagger, easing: FLOAT_EASE, fill: 'backwards' });
  });
}

// 从 from 状态过渡到元素原本的样式（to）。第一帧画出来就已经是 from，不会先闪一下终点。
function enterFrom(el, from, o = {}) {
  const { duration = 800, delay = 0, easing = GL } = o, props = Object.keys(from);
  const saved = props.map((k) => [k, el.style[k]]), savedTr = el.style.transition;
  el.style.transition = 'none';
  props.forEach((k) => { el.style[k] = from[k]; });
  void el.offsetWidth;                                           // 强制一次排版，让起点真的生效（不依赖 rAF，页面在后台时也能走）
  el.style.transition = props.map((k) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())} ${duration}ms ${easing} ${delay}ms`).join(',');
  saved.forEach(([k, v]) => { el.style[k] = v; });
  setTimeout(() => { el.style.transition = savedTr; }, duration + delay + 60);
}
const SCR = '█▓▒░#@%&*+=?/\\<>01';
function scramble(el, text, o = {}) {
  const { dur = 650, delay = 0 } = o, n = [...text].length, t0 = performance.now() + delay;
  el.dataset.final = text;
  const tick = () => {
    if (!el.isConnected || el.dataset.final !== text) return;
    const t = performance.now() - t0;
    if (t < 0) { el.textContent = [...text].map(() => SCR[Math.random() * SCR.length | 0]).join(''); return requestAnimationFrame(tick); }
    const k = Math.min(n, Math.floor((t / dur) * (n + 1)));
    el.textContent = [...text].map((ch, i) => (i < k ? ch : SCR[Math.random() * SCR.length | 0])).join('');
    if (k < n) setTimeout(tick, 40); else el.textContent = text;
  };
  tick();
}
function flapNumber(el, text) {                                      // 旧的向下翻走，新的从上面翻下来
  if (el.dataset.v === text) return;
  const old = el.dataset.v; el.dataset.v = text;
  if (old == null) { el.textContent = text; return; }
  el.innerHTML = `<span class="flp"><span class="flo">${esc(old)}</span><span class="fln">${esc(text)}</span></span>`;
  const o = el.querySelector('.flo'), n = el.querySelector('.fln');
  o.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(-90deg)', opacity: .2 }], { duration: 260, easing: 'cubic-bezier(.5,0,.8,.5)', fill: 'forwards' });
  n.animate([{ transform: 'rotateX(90deg)', opacity: .2 }, { transform: 'rotateX(0)', opacity: 1 }], { duration: 340, delay: 240, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
  setTimeout(() => { if (el.dataset.v === text) el.textContent = text; }, 620);
}
function clickSpark(x, y) {
  for (let i = 0; i < 9; i++) {
    const l = document.createElement('i'); l.className = 'cdx-spark';
    const a = (i / 9) * Math.PI * 2 + Math.random() * .4, d = 40 + Math.random() * 46;
    l.style.cssText = `left:${x}px;top:${y}px;background:${i % 3 === 0 ? '#ffc822' : '#0b0b0b'};transform:rotate(${a}rad)`;
    root.appendChild(l);
    l.animate([{ transform: `rotate(${a}rad) translateX(6px) scaleX(.2)`, opacity: 1 }, { transform: `rotate(${a}rad) translateX(${d}px) scaleX(1)`, opacity: 1, offset: .5 }, { transform: `rotate(${a}rad) translateX(${d + 18}px) scaleX(.1)`, opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => l.remove());
  }
}


/* ---------- 左：分类滚动条 ----------
   8 条线是 8 个分类，选中那条右凸变黑，旁边是黑色平行四边形 + 黄色错位阴影的标签（普通形状，来自设计稿 403:592）。
   切换分类：旧标签向左擦出，换位置和文字，新标签从线头向右擦入；文字逐字升起。 */
function buildRail() {
  rail.innerHTML = `<div class="cdx-ticks">` + cats.map((c, j) => `<div class="cdx-tick" data-j="${j}" style="left:34px;top:${TICK_Y(j)}px"></div>`).join('') + `</div>` +
    cats.map((c, j) => `<div class="cdx-hit" data-cat="${esc(c)}" data-hot style="top:${TICK_Y(j)}px"></div>`).join('') +
    `<div class="cdx-sel"><div class="lbw"><img class="bl" src="${AS}label.svg"><div class="tx"></div></div></div>`;
  tickEls = [...rail.querySelectorAll('.cdx-tick')]; selEl = $('.cdx-sel');
  $('.cdx-rail').style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:6';
  updateRail(false);
}
function paintTicks(s = Math.max(0, cats.indexOf(cat))) {
  tickEls.forEach((t, j) => {
    const d = Math.abs(j - s), dx = TICK_X[Math.min(d, 4)];
    t.style.transform = `translateX(${dx}px)`;
    t.style.background = (j <= s ? TICK_UP : TICK_DN)[Math.min(d, 4)];
  });
}
const WIPE_HIDE = 'inset(-10px 100% -10px -10px)', WIPE_SHOW = 'inset(-10px -10px -10px -10px)';
let railCat = '';                                                // 分类栏当前显示（或正滑向）的分类，可能比 cat 先走一步
// 切分类要「干脆」：点下去当帧就开始动，标签直接滑到新线头（300ms 快出慢收，无中途停顿），
// 线条同时伸缩，文字 360ms 内逐字升起。只用 transform / width / opacity，不再用主线程的 clip-path 擦除。
function updateRail(anim = true, target = cat) {
  const s = Math.max(0, cats.indexOf(target)), w = [...target].length * 36 + 13;
  const lw = $('.lbw', selEl), txt = $('.tx', selEl), bl = $('.bl', selEl);
  paintTicks(s);
  if (!anim) {
    railCat = target;
    lw.getAnimations().forEach((x) => x.cancel()); lw.style.clipPath = WIPE_SHOW;
    selEl.style.transition = bl.style.transition = 'none';
    selEl.style.transform = `translate(0,${TICK_Y(s)}px)`; bl.style.width = w + 'px'; txt.textContent = target;
    void selEl.offsetWidth; selEl.style.transition = bl.style.transition = '';
    return;
  }
  if (railCat === target) return;
  railCat = target;
  selEl.style.transform = `translate(0,${TICK_Y(s)}px)`; bl.style.width = w + 'px';
  floatText(txt, target, { delay: 20, stagger: 22, dur: 360, dist: 70, stretch: 1.5 });
}

/* ---------- 数据 → 当前页 ---------- */
function visible() {
  let list = allGroups;
  if (q) { const k = q.toLowerCase(); list = list.filter((g) => g.name.toLowerCase().includes(k) || g.items.some((it) => it.name.toLowerCase().includes(k))); }
  else if (tab) list = list.filter((g) => g.tab === tab);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  pageNo = Math.max(0, Math.min(pages - 1, pageNo));
  return { list, pages, slice: list.slice(pageNo * PAGE, pageNo * PAGE + PAGE) };
}
function buildTabs() {
  // 「全部」固定在左边（913），其余种类标签靠右排（右端 1715），宽 = 字数 × 24 + 43，间距 5
  const list = ['全部', ...tabs], cur = tab || '全部', W = (t) => [...t].length * 24 + 43;
  let x = 1715; const pos = {};
  for (let i = list.length - 1; i >= 1; i--) { x -= W(list[i]); pos[list[i]] = x; x -= 5; }
  pos['全部'] = 913;
  tabsEl.innerHTML = tabs.length ? list.map((t) => `<div class="cdx-tab${t === cur ? ' sel' : ''}" data-tab="${esc(t)}" data-hot style="left:${pos[t]}px;width:${W(t)}px">${esc(t)}</div>`).join('') : '';
}
function buildPager() {
  const { pages } = visible();
  pgEl.classList.toggle('one', pages <= 1);
  flapNumber($('span', pgEl), `${pageNo + 1} / ${pages}`);
}

/* ---------- 卡堆 ---------- */
const layersOf = (g) => (g.items.length <= 1 ? 1 : g.items.length >= 5 ? 3 : 2);
const wide = (n) => [...n].length > 6;                                            // 药丸两种宽度：137（≤6 字）/ 185（更长的）
const nameFs = (n) => Math.min(20, Math.floor((wide(n) ? 160 : 118) / Math.max(1, [...n].length)));   // 一行放下所有字：最大 20px，字多就按字数缩小
function buildStacks() {
  groups = visible().slice;
  stage.innerHTML = groups.map((g, i) => {
    const cx = COLX[i % 4], yb = ROWB[Math.floor(i / 4)];
    const img = `<img src="${AS}card.png" alt="">`;
    const layers = g.items.length <= 1
      ? `<div class="cl one front">${img}</div>`
      : `<div class="cl st b1">${img}</div><div class="cl st b2">${img}</div><div class="cl st front">${img}</div>`;   // 3 张：后两张向右下错开并微微旋转
    return `<div class="cs${g.items.length > 1 ? ' multi' : ''}" data-g="${i}" data-hot style="left:${cx}px;top:${yb}px"><div class="cs-in">${layers}<div class="nmbar${wide(g.name) ? ' w2' : ''}" style="font-size:${nameFs(g.name)}px">${esc(g.name)}</div></div></div>`;
  }).join('');
  stackEls = [...stage.querySelectorAll('.cs')];
  emptyEl.style.display = groups.length ? 'none' : 'block';
}
function stacksIn(delay = 850) {
  stackEls.forEach((e, i) => e.animate([{ opacity: 0, transform: 'translateY(70px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: delay + i * 45, easing: GL, fill: 'backwards' }));
}
function refreshStage() { buildStacks(); buildPager(); buildTabs(); stackEls.forEach((e, i) => { const b = $('.nmbar', e); if (b) scramble(b, groups[i].name, { delay: 120 + i * 60, dur: 700 }); }); }

function loadCat(name) {
  cat = name; const data = (window.CODEX || {})[name] || {};
  allGroups = data.groups || []; tabs = data.tabs || []; tab = ''; pageNo = 0; q = ''; searchEl.value = '';
  mode = 'stacks'; syncMode(); curG = -1; curI = -1; setDeep(false);
  { const t = $('.t2cat'); t.textContent = name; t.style.fontSize = Math.min(40, Math.floor(200 / [...name].length)) + 'px'; }
  updateRail(true); refreshStage();
}
// 换分类 / 种类 / 翻页：这一页的卡沿斜边滑出，新的一页滑进来
async function swap(dir, change) {
  if (busy || mode !== 'stacks') return; busy = true;
  await stage.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${-dir * 150}px,${-dir * 14}px)` }], { duration: 380, easing: GL, fill: 'forwards' }).finished;
  change(); refreshStage();
  stage.getAnimations().forEach((a) => a.cancel());
  stage.animate([{ opacity: 0, transform: `translate(${dir * 150}px,${dir * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: 520, easing: GL });
  stackEls.forEach((e, i) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: i * 40, fill: 'backwards' }));
  await sleep(520); busy = false;
}
const turnPage = (d) => { const { pages } = visible(); if (pageNo + d < 0 || pageNo + d >= pages) return; swap(d, () => { pageNo += d; }); };
const pickTab = (t) => { const nt = t === '全部' ? '' : t; if (nt === tab) return; const i0 = tabs.indexOf(tab), i1 = tabs.indexOf(nt); swap(i1 > i0 ? 1 : -1, () => { tab = nt; pageNo = 0; }); };
// 换分类：分类栏当帧就动；卡片快速滑出（180ms）→ 换成最后点的分类 → 滑入（380ms）。连点不排队，只认最后一次。
let nextCat = null, catSwap = false;
const pickCat = (c) => {
  if (mode !== 'stacks') return;
  const cur = nextCat || cat; if (c === cur) return;
  const dir = cats.indexOf(c) > cats.indexOf(cur) ? 1 : -1;
  nextCat = c; updateRail(true, c);
  if (!catSwap) catSwapRun(dir);
};
async function catSwapRun(dir) {
  catSwap = true; busy = true;
  stage.getAnimations().forEach((a) => a.cancel());
  await stage.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate(${-dir * 120}px,${-dir * 11}px)` }], { duration: 180, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }).finished;
  const c = nextCat; nextCat = null;
  if (c && c !== cat) loadCat(c);
  stage.getAnimations().forEach((a) => a.cancel());
  stage.animate([{ opacity: 0, transform: `translate(${dir * 120}px,${dir * 11}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.85,.25,1)' });
  stackEls.forEach((e, i) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, delay: i * 25, fill: 'backwards' }));
  catSwap = false; busy = false;
  if (nextCat && nextCat !== cat) catSwapRun(cats.indexOf(nextCat) > cats.indexOf(cat) ? 1 : -1); else nextCat = null;
}
const stepCat = (d) => { const i = cats.indexOf(nextCat || cat) + d; if (i >= 0 && i < cats.length) pickCat(cats[i]); };

/* ---------- 扇形（新稿 413:1354）：三张方卡从卡堆里散开，中间的在上，两边各转约 6°，每张卡下面压一个白色药丸名称 ---------- */
const frontOf = (el) => $('.cl.front', el);
const FANC = [906.5, 568];                                       // 中间那张卡的中心
const fanPose = (k, n) => { const t = k - (n - 1) / 2, a = Math.abs(t), sp = n <= 3 ? 235 : Math.min(235, 1000 / (n - 1));
  return { x: t * sp, y: 62 * Math.pow(a, .7), r: t * Math.min(6.4, 24 / Math.max(1, n - 1)) }; };
const fanFs = (n) => Math.min(32, Math.floor(270 / Math.max(1, [...n].length)));
function openFan(gi) {
  if (busy) return; busy = true; mode = 'fan'; syncMode(); curG = gi; setDeep(true);
  const g = groups[gi], n = g.items.length, el = stackEls[gi], r = rectOf(frontOf(el));
  const scx = r.x + r.w / 2, scy = r.y + r.h / 2, sc0 = r.w / 295;
  stackEls.forEach((e, i) => e.classList.add(i === gi ? 'gone' : 'dim'));
  fan.className = 'cdx-fan'; fan.innerHTML = `<div class="fan-title"><h2>${esc(g.name)}</h2><p>${esc(g.intro)}</p></div>` +
    g.items.map((it, k) => { const p = fanPose(k, n);
      return `<div class="fc" data-k="${k}" data-hot style="--x:${f2(p.x)}px;--y:${f2(p.y)}px;--r:${f2(p.r)}deg;z-index:${n - k}"><div class="cd"><img src="${AS}card.png" alt=""></div><div class="nm" style="font-size:${fanFs(it.name)}px">${esc(it.name)}</div></div>`; }).join('');
  const cards = [...fan.querySelectorAll('.fc')];
  cards.forEach((c, k) => {
    enterFrom(c, { transform: `translate(${scx - FANC[0]}px,${scy - FANC[1]}px) scale(${sc0}) rotate(0deg)` }, { duration: 820, delay: k * 50 });
    $('.nm', c).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 520 + k * 60, easing: GL, fill: 'backwards' });
  });
  floatText(fan.querySelector('.fan-title h2'), g.name, { delay: 350, stagger: 60, dur: 820 });
  fan.querySelector('.fan-title p').animate([{ opacity: 0, transform: 'translateY(16px)' }], { duration: 700, delay: 700, easing: GL, fill: 'backwards' });
  sleep(820 + n * 50).then(() => { busy = false; });
}
async function closeFan() {
  if (busy) return; busy = true;
  const el = stackEls[curG], r = rectOf(frontOf(el)), cards = [...fan.querySelectorAll('.fc')], n = cards.length;
  const scx = r.x + r.w / 2, scy = r.y + r.h / 2, sc0 = r.w / 295;
  setDeep(false);
  fan.querySelector('.fan-title').animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  cards.forEach((c, k) => {
    const p = fanPose(k, n);
    c.style.transition = 'none';
    $('.nm', c).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' });
    c.animate([{ transform: `translate(${p.x}px,${p.y}px) rotate(${p.r}deg)` },
      { transform: `translate(${scx - FANC[0]}px,${scy - FANC[1]}px) scale(${sc0}) rotate(0deg)` }],
      { duration: 700, delay: (n - 1 - k) * 35, easing: GL, fill: 'forwards' });
  });
  await sleep(700 + n * 35);
  fan.innerHTML = ''; el.classList.remove('gone'); stackEls.forEach((e) => e.classList.remove('dim'));
  mode = 'stacks'; syncMode(); curG = -1; busy = false;
}

/* ---------- 书 ---------- */
const BKC = [927.5, 645];                                       // 书框（605×770，缩放 0.7686）的中心
const pageText = (t) => (t ? `<div class="tx">${esc(t)}</div>` : '<div class="tx nil">· 尚未收录 ·</div>');
function bookHTML(g, it, single) {
  const title = single ? g.name : it.name, series = g.tab || (single ? cat : g.name);
  const row = (k, v) => (v ? `<div class="mr"><b>${k}</b><span>${esc(v)}</span></div>` : '');
  const story2 = (it.info2 ? pageText(it.info2) : (it.info3 ? '' : pageText('')));
  const story3 = it.info3 ? `<div class="hd h3">故事 · 三</div>${pageText(it.info3)}` : '';
  const art = `<div class="art"><img src="${AS}card.png" alt=""></div>`;
  return `<div class="bk-sp">` +
    `<div class="bk-tilt"><div class="bk-shadow"></div>` +
    `<div class="base"><div class="face pg rt"><div class="hd">档案信息</div><div class="meta">${row('编号', it.id)}${row('所属', series)}${row('所在地', it.place)}${row('配方', it.recipe)}${row('解锁', it.unlock || '无条件')}</div><div class="pn">3 / 4</div></div></div>` +
    `<div class="leaf l1"><div class="face pg rt"><div class="hd">故事 · 一</div>${pageText(it.info1)}<div class="pn">2 / 4</div></div>` +
    `<div class="face bkf pg lf"><div class="hd">故事 · 二</div>${story2}${story3}<div class="pn">3 / 4</div></div></div>` +
    `<div class="leaf l0"><div class="face cover">${art.replace('class="art"', 'class="art"')}<div class="nm">${esc(title)}</div></div>` +
    `<div class="face bkf pg lf">${art}<h3>${esc(title)}</h3><div class="sub">&lt;${esc(series)}&gt;</div>${g.intro ? `<p>${esc(g.intro)}</p>` : ''}<div class="pn">1 / 4</div></div></div>` +
    '</div></div>';
}
function burst(cx, cy) {
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('i'); b.className = 'cdx-burst'; b.style.left = cx + 'px'; b.style.top = cy + 'px'; root.appendChild(b);
    const a = Math.random() * Math.PI * 2, d = 260 + Math.random() * 420, s = .5 + Math.random();
    b.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d * .7}px) rotate(${Math.random() * 360}deg) scale(${s})`, opacity: 0 }],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.then(() => b.remove());
  }
}
function mountBook(gi, ii, from) {
  const g = groups[gi], it = g.items[ii], single = g.items.length === 1;
  curG = gi; curI = ii; page = 0; mode = 'book'; syncMode();
  book = document.createElement('div'); book.className = 'bk'; book.innerHTML = bookHTML(g, it, single); root.appendChild(book);
  book.style.transformOrigin = '302.5px 385px';
  return from;
}
async function openBook(gi, ii, srcEl) {
  if (busy) return; busy = true;
  const g = groups[gi], single = g.items.length === 1, r = rectOf(srcEl);
  const sx = r.x + r.w / 2, sy = r.y + r.h / 2, s0 = r.w / 605;
  setDeep(true);
  if (!bkHead) { bkHead = document.createElement('div'); bkHead.className = 'bk-head'; bkHead.innerHTML = `<h2></h2><p>${esc(g.intro || '')}</p>`; root.appendChild(bkHead);
    floatText($('h2', bkHead), g.name, { delay: 300, stagger: 55, dur: 800 }); $('p', bkHead).animate([{ opacity: 0, transform: 'translateY(16px)' }], { duration: 700, delay: 650, easing: GL, fill: 'backwards' }); }
  if (!bkArr) { bkArr = document.createElement('div'); bkArr.className = 'bk-arr';
    bkArr.innerHTML = `<div class="ar pv" data-turn="-1" data-hot><svg viewBox="0 0 48.8966 80" width="48.9" height="80"><path d="M45.4483 3.62069 3.44828 43.6207M45.4483 76.3793 3.44827 36.3793" stroke="currentColor" stroke-width="10" fill="none"/></svg></div><div class="ar nx" data-turn="1" data-hot><svg viewBox="0 0 48.8966 80" width="48.9" height="80"><path d="M45.4483 3.62069 3.44828 43.6207M45.4483 76.3793 3.44827 36.3793" stroke="currentColor" stroke-width="10" fill="none"/></svg></div>`; root.appendChild(bkArr);
    bkArr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1600, fill: 'backwards' }); }   // 书翻开后再淡入
  bookSrc = { sx, sy, s0, fromStack: single, gi };
  if (single) stackEls[gi].classList.add('gone'); else fan.classList.add('back');
  stackEls.forEach((e, i) => { if (i !== gi) e.classList.add('dim'); });
  mountBook(gi, ii);
  enterFrom(book, { transform: `translate(${sx - BKC[0]}px,${sy - BKC[1]}px) scale(${s0})` }, { duration: 700 });
  await sleep(700);
  book.classList.add('spread'); $('.l0', book).classList.add('open');
  burst(924, 645);
  { const h = $('.face.bkf h3', book); if (h) floatText(h, h.textContent, { delay: 500, stagger: 55, dur: 800 }); }
  await sleep(1000); busy = false;
}
async function turn(d) {
  if (busy || mode !== 'book' || !book) return;
  const np = Math.max(0, Math.min(1, page + d)); if (np === page) return;
  busy = true; page = np; $('.l1', book).classList.toggle('open', page === 1);
  await sleep(950); busy = false;
}
// 同一组里翻到前一张 / 后一张：整本书合上再换内容打开
async function nav(d) {
  if (busy || mode !== 'book' || !book) return;
  const g = groups[curG], ni = curI + d;
  if (ni < 0 || ni >= g.items.length) return;
  busy = true;
  if (page === 1) { page = 0; $('.l1', book).classList.remove('open'); await sleep(700); }
  book.classList.remove('spread'); $('.l0', book).classList.remove('open');
  await sleep(850);
  const old = book; mountBook(curG, ni); old.remove();
  const sx = bookSrc.sx, sy = bookSrc.sy; void sx; void sy;
  await sleep(30);
  book.classList.add('spread'); $('.l0', book).classList.add('open');
  burst(924, 645);
  await sleep(1000); busy = false;
}
async function closeBook() {
  if (busy || !book) return;
  if (page === 1) { await turn(-1); }
  busy = true;
  if (bkHead) { const h = bkHead; bkHead = null; h.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }).finished.then(() => h.remove()); }
  if (bkArr) { const a = bkArr; bkArr = null; a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished.then(() => a.remove()); }
  book.classList.remove('spread'); $('.l0', book).classList.remove('open');
  await sleep(1000);
  const b = bookSrc, bk = book;
  await bk.animate([{ transform: 'scale(.7686)', opacity: 1 }, { transform: `translate(${b.sx - BKC[0]}px,${b.sy - BKC[1]}px) scale(${b.s0})`, opacity: 1 }], { duration: 700, easing: GL, fill: 'forwards' }).finished;
  bk.remove(); book = null;
  stackEls.forEach((e, i) => { e.classList.remove('dim'); if (i === b.gi && b.fromStack) e.classList.remove('gone'); });
  if (b.fromStack) { mode = 'stacks'; syncMode(); curG = -1; setDeep(false); }
  else { mode = 'fan'; syncMode(); fan.classList.remove('back'); stackEls.forEach((e, i) => e.classList.add(i === b.gi ? 'gone' : 'dim')); }
  curI = -1; busy = false;
}


/* ---------- 右上角的网点：逐点闪烁 ----------
   点的位置来自设计稿的网点图（codex-dots.js）。约一半的点会闪烁（各自的相位和周期不同，亮得快、暗得慢，像星星），其余的保持稳定；
   闪烁时半径也跟着轻微起伏。第一块（x=441）右侧向左渐隐，和设计稿的蒙版一致。 */
const dotsCv = $('.cdx-dots'), dctx = dotsCv.getContext('2d');
const DOTS = (window.CDX_DOTS || []);
const TILES_X = [441, 931, 1420];
const dotSt = [];
{ let sd = 3; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  TILES_X.forEach((tx, ti) => DOTS.forEach(([x, y, r, al]) => {
    // 第一块的蒙版：以 (500, 191.5) 为圆心、半径 500，中心不透明、向外渐隐
    const fade = ti === 0 ? Math.max(0, 1 - Math.hypot(x - 500, y - 191.5) / 500) : 1;
    if (fade <= 0.02) return;
    const tw = rn() < 0.55;
    dotSt.push({ x: tx + x, y: y + 2, r, a: al * fade, tw, ph: rn() * 6.283, sp: 2.2 + rn() * 4.6 });   // 闪烁频率：2.2~6.8 rad/s（周期约 0.9~2.9 秒），比之前快一倍多
  }));
}
let dotsT0 = 0;
function drawDots(now) {
  if (!isOpen) return;
  if (now - dotsT0 < 25) return;                                   // 约 30fps 足够，省电
  dotsT0 = now; const t = now / 1000;
  dctx.clearRect(0, 0, 1920, 500);
  dctx.fillStyle = '#4e4e4e';
  for (const d of dotSt) {
    let al = d.a, rr = d.r;
    if (d.tw) {
      const s = Math.pow(0.5 + 0.5 * Math.sin(t * d.sp + d.ph), 2.4);   // 大部分时间偏暗，周期性亮一下
      al *= 0.12 + 0.88 * s; rr *= 0.75 + 0.5 * s;
    }
    dctx.globalAlpha = Math.min(1, al);
    dctx.beginPath(); dctx.arc(d.x, d.y, rr, 0, 6.283); dctx.fill();
  }
  dctx.globalAlpha = 1;
}
(function dotLoop(now) { drawDots(now); requestAnimationFrame(dotLoop); })(0);

/* ---------- 入场：雕像从下方升起，其余依次进来 ---------- */
function enterAnim() {
  const an = (el, kf, o) => el && el.animate(kf, Object.assign({ easing: GL, fill: 'backwards' }, o));
  an(statueWrap, [{ transform: 'translateY(760px)' }, { transform: 'none' }], { duration: 1100, delay: 250 });     // 雕像 + 竖杆整根升起
  an($('.cdx-glow'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay: 700 });
  an($('.cdx-band.ta'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1100, delay: 100 });
  an($('.cdx-band.tb'), [{ transform: 'translate(-320px,60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1000, delay: 200 });
  an($('.cdx-band.tc'), [{ transform: 'translate(240px,-80px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1000, delay: 260 });
  an($('.cdx-band.tl'), [{ transform: 'translate(320px,-60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1000, delay: 200 });
  an(panelWrap, [{ transform: 'translate(150px,24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 450 });   // 白板沿斜边滑入
  an($('.cdx-dots'), [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 300 });
  an($('.cdx-top'), [{ transform: 'translateY(-90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 700 });
  tickEls.forEach((t, j) => t.animate([{ opacity: 0, transform: `translateX(-70px) scaleX(.15)` }, { opacity: 1, transform: t.style.transform || 'none' }], { duration: 700, delay: 650 + j * 60, easing: GL, fill: 'backwards' }));
  const lw = $('.lbw', selEl); lw.style.clipPath = WIPE_HIDE;
  setTimeout(() => { if (!isOpen) return; floatText($('.tx', selEl), cat, { delay: 250, stagger: 55 }); lw.animate([{ clipPath: WIPE_HIDE }, { clipPath: WIPE_SHOW }], { duration: 700, easing: GL }); lw.style.clipPath = WIPE_SHOW; }, 1200);
  stacksIn(850);
}

/* ---------- 打开 / 关闭整页 ---------- */
function open(name, from, list, cb, section) {
  cats = list || [name]; onClose = cb; srcPt = from || [960, 540]; sec = section || 'wiki';
  root.querySelectorAll('.tt.sec').forEach((n) => { n.textContent = sec === 'xiang' ? '万象站' : '作品百科'; });   // 顶栏：当前在哪一边
  menuEl.querySelectorAll('[data-go]').forEach((n) => n.classList.toggle('cur', n.dataset.go === sec));
  isOpen = true; busy = true; root.classList.add('on'); fan.innerHTML = ''; if (book) { book.remove(); book = null; } if (bkHead) { bkHead.remove(); bkHead = null; } if (bkArr) { bkArr.remove(); bkArr = null; }
  menuEl.classList.remove('on'); setDeep(false);
  buildRail(); loadCat(name); updateRail(false);
  const [x, y] = srcPt;
  root.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(2300px at ${x}px ${y}px)` }], { duration: 900, easing: GL, fill: 'backwards' });
  enterAnim();
  sleep(1500).then(() => { busy = false; });
}
async function close(to) {
  if (!isOpen || busy) return; busy = true;
  const [x, y] = srcPt;
  await root.animate([{ clipPath: `circle(2300px at ${x}px ${y}px)` }, { clipPath: `circle(0px at ${x}px ${y}px)` }], { duration: 700, easing: GL, fill: 'forwards' }).finished;
  root.classList.remove('on'); root.getAnimations().forEach((a) => a.cancel());
  isOpen = false; busy = false; fan.innerHTML = ''; if (book) { book.remove(); book = null; } if (bkHead) { bkHead.remove(); bkHead = null; } if (bkArr) { bkArr.remove(); bkArr = null; }
  if (onClose) onClose(to);
}
function back() {
  if (mode === 'book') closeBook(); else if (mode === 'fan') closeFan();
  else if (q) { q = ''; searchEl.value = ''; pageNo = 0; swap(1, () => {}); } else close();
}

/* ---------- 交互 ---------- */
root.addEventListener('click', (e) => {
  e.stopPropagation();
  { const st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 1920; clickSpark((e.clientX - st.left) / k, (e.clientY - st.top) / k); }
  if (!e.target.closest('.cdx-dd,.cdx-menu')) menuEl.classList.remove('on');
  if (e.target.closest('.cdx-close')) { close(); return; }
  if (e.target.closest('.cdx-back')) { back(); return; }
  if (e.target.closest('.cdx-fb')) { if (mode === 'fan') back(); return; }
  if (e.target.closest('.cdx-dd')) { menuEl.classList.toggle('on'); return; }
  const go = e.target.closest('[data-go]'); if (go) { menuEl.classList.remove('on'); if (go.dataset.go !== sec) close(go.dataset.go); return; }   // 切到另一边：关掉内页，回到那一边的场景
  const hit = e.target.closest('.cdx-hit'); if (hit) { pickCat(hit.dataset.cat); return; }
  const nv = e.target.closest('[data-nav]'); if (nv) { nav(+nv.dataset.nav); return; }
  const tn = e.target.closest('[data-turn]'); if (tn) { turn(+tn.dataset.turn); return; }
  const tb = e.target.closest('.cdx-tab'); if (tb) { if (mode === 'stacks') pickTab(tb.dataset.tab); return; }
  if (e.target.closest('.cdx-pg')) {
    if (mode !== 'stacks') return;
    const r = $('.cdx-pg').getBoundingClientRect(); turnPage(e.clientX < r.left + r.width / 2 ? -1 : 1); return;
  }
  if (e.target.closest('.cdx-search')) return;
  if (mode === 'stacks') {
    const cs = e.target.closest('.cs'); if (!cs || busy) return;
    const gi = +cs.dataset.g;
    if (groups[gi].items.length === 1) openBook(gi, 0, frontOf(cs)); else openFan(gi);
  } else if (mode === 'fan') {
    const fc = e.target.closest('.fc');
    if (fc && !busy) openBook(curG, +fc.dataset.k, $('.cd', fc)); else if (!fc && !busy) back();
  } else if (mode === 'book') {
    if (!e.target.closest('.bk') && !busy) back();
  }
});
searchEl.addEventListener('input', () => { q = searchEl.value.trim(); pageNo = 0; if (mode === 'stacks') swap(1, () => {}); });
let wheelAt = 0;
root.addEventListener('wheel', (e) => {
  e.stopPropagation();
  const onRail = e.clientX < root.getBoundingClientRect().left + root.getBoundingClientRect().width * 0.12;
  if (mode !== 'stacks' || (!onRail && busy) || Math.abs(e.deltaY) < 4 || performance.now() - wheelAt < (onRail ? 160 : 700)) return;
  wheelAt = performance.now();
  if (onRail) stepCat(e.deltaY > 0 ? 1 : -1); else turnPage(e.deltaY > 0 ? 1 : -1);
}, { passive: true });
addEventListener('keydown', (e) => {
  if (!isOpen) return;
  if (e.target === searchEl) {                                     // 搜索框里打字：不让别的快捷键（比如 M 静音）收到
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (searchEl.value) { searchEl.value = ''; q = ''; pageNo = 0; swap(1, () => {}); } searchEl.blur(); }
    return;
  }
  const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'Escape' || e.key === 'Backspace') { eat(); back(); }
  else if (mode === 'book' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { eat(); turn(e.key === 'ArrowRight' ? 1 : -1); }
  else if (mode === 'book' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { eat(); nav(e.key === 'ArrowDown' ? 1 : -1); }
  else if (mode === 'stacks' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { eat(); turnPage(e.key === 'ArrowRight' ? 1 : -1); }
  else if (mode === 'stacks' && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { eat(); stepCat(e.key === 'ArrowDown' ? 1 : -1); }
  else if (['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key)) eat();
}, true);

window.Codex = { open, close, get isOpen() { return isOpen; } };
})();
