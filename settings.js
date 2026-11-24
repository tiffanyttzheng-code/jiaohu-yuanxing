/* 设置页（主菜单「设置」入口）。画布 1920×1080，风格同任务页：灰白渐变底、顶栏、左侧分类目录（方块 + 黄色指示块）、右侧白色卡片。
   · 左：标题「设置」+ 5 个分类：画面 / 声音 / 游戏 / 操作 / 辅助功能（Tab / Shift+Tab 切换）
   · 中：当前分类的选项，一行一个；只用四种控件：滑条（线 + 黄方块）、开关（方块左右移动）、左右选择器（◂ 值 ▸ + 选项圆点）、按键框
   · 右：选中 / 悬停那一行的说明（亮度带参考方块）；底部「恢复本页默认」和键盘提示
   · 改了立刻生效、立刻保存（浏览器 localStorage）；只有分辨率要确认：10 秒内不点「保留」就退回原值
   · 原型里真正生效的：音量（主菜单音效）、亮度（整个画面）、显示模式（全屏）、光标大小、减弱动效、文字大小（本页）；其余只保存数值，给程序对照 */
(function () {
'use strict';
const GL = 'cubic-bezier(.7,0,.2,1)';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYNAME = { ' ': '空格', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backspace: '退格', Shift: 'Shift', Control: 'Ctrl', Alt: 'Alt' };
const keyName = (k) => KEYNAME[k] || (k.length === 1 ? k.toUpperCase() : k);

/* ---------- 选项清单（给策划 / 程序对照的就是这张表） ---------- */
// t：sl 滑条（0~100）| tog 开关 | sel 左右选择器 | key 按键；def 默认值；sub 画质细项（缩进显示）；desc 说明
const CATS = [
  { id: 'video', name: '画面', rows: [
    { k: 'mode', t: 'sel', name: '显示模式', opts: ['全屏', '无边框窗口', '窗口'], def: 1, desc: '全屏独占显示器，切换窗口时会闪一下；无边框窗口看起来和全屏一样，切换更顺；窗口方便同时做别的事。' },
    { k: 'res', t: 'sel', name: '分辨率', opts: ['1280×720', '1600×900', '1920×1080', '2560×1440', '3840×2160'], def: 2, confirm: true, desc: '画面的渲染尺寸。改完会询问是否保留，10 秒内不确认就自动退回原来的分辨率。' },
    { k: 'vsync', t: 'tog', name: '垂直同步', def: true, desc: '让画面刷新和显示器同步，避免画面撕裂；打开后操作可能有一点点延迟。' },
    { k: 'fps', t: 'sel', name: '帧率上限', opts: ['30', '60', '120', '144', '不限'], def: 1, desc: '限制每秒最多画多少帧。笔记本上限低一点更省电、更安静。' },
    { k: 'preset', t: 'sel', name: '画质预设', opts: ['低', '中', '高', '极高', '自定义'], def: 2, desc: '一次设好下面五项细项；单独改了任何一项，这里会变成「自定义」。' },
    { k: 'shadow', t: 'sel', name: '阴影', opts: ['关', '低', '中', '高'], def: 2, sub: true, desc: '角色、平台和物件的投影。对性能影响最大的一项。' },
    { k: 'aa', t: 'sel', name: '抗锯齿', opts: ['关', 'FXAA', 'TAA'], def: 2, sub: true, desc: '让斜线和边缘更平滑。TAA 效果最好，FXAA 最省。' },
    { k: 'post', t: 'sel', name: '后处理', opts: ['低', '中', '高'], def: 2, sub: true, desc: '景深、泛光、颗粒等画面效果。' },
    { k: 'tex', t: 'sel', name: '贴图质量', opts: ['低', '中', '高', '极高'], def: 2, sub: true, desc: '贴图清晰度，主要占用显存。' },
    { k: 'fx', t: 'sel', name: '特效质量', opts: ['低', '中', '高'], def: 2, sub: true, desc: '粒子、云、光效的精细程度。' },
    { k: 'bright', t: 'sl', name: '亮度', def: 50, desc: '调到下面左边那个方块刚好看不清、右边两个还能分清为止。', ref: true },
  ] },
  { id: 'audio', name: '声音', rows: [
    { k: 'master', t: 'sl', name: '总音量', def: 80, desc: '所有声音的总开关。原型里调它会影响主菜单的界面音效。' },
    { k: 'music', t: 'sl', name: '音乐', def: 70, desc: '背景音乐。' },
    { k: 'sfx', t: 'sl', name: '音效', def: 80, desc: '点击、翻页、切换等界面和动作音效。原型里会影响主菜单的界面音效。' },
    { k: 'amb', t: 'sl', name: '环境音', def: 60, desc: '风声、人声、城市底噪等。' },
    { k: 'voice', t: 'sl', name: '语音', def: 80, desc: '角色配音（有配音时才生效）。' },
    { k: 'bgmute', t: 'tog', name: '切到后台时静音', def: true, desc: '切换到别的窗口时自动静音，回来时恢复。' },
  ] },
  { id: 'game', name: '游戏', rows: [
    { k: 'lang', t: 'sel', name: '语言', opts: ['简体中文', '繁體中文', 'English'], def: 0, desc: '界面和剧情文字的语言。原型里只有简体中文。' },
    { k: 'textSpeed', t: 'sl', name: '文字速度', def: 60, desc: '对话文字一个个出现的速度，拉到最右是一次显示整句。' },
    { k: 'autoWait', t: 'sl', name: '自动播放等待', def: 50, desc: '自动播放时，一句话放完后等多久再翻到下一句。' },
    { k: 'skipRead', t: 'tog', name: '只跳过已读内容', def: true, desc: '快进时遇到第一次看到的剧情会自动停下。' },
    { k: 'cursor', t: 'sel', name: '光标大小', opts: ['小', '中', '大'], def: 1, desc: '菱形光标的大小，立刻生效。' },
  ] },
  { id: 'keys', name: '操作', rows: [
    { k: 'kOk', t: 'key', name: '确认', def: 'Enter', desc: '点一下按键框，再按新的按键。按 Esc 取消；和别的操作重复时会互换。' },
    { k: 'kBack', t: 'key', name: '返回', def: 'Escape', desc: '关闭当前页面、退回上一层。' },
    { k: 'kUp', t: 'key', name: '上一项', def: 'ArrowUp', desc: '在列表里往上移动。' },
    { k: 'kDown', t: 'key', name: '下一项', def: 'ArrowDown', desc: '在列表里往下移动。' },
    { k: 'kLeft', t: 'key', name: '向左', def: 'ArrowLeft', desc: '向左切换、减小数值。' },
    { k: 'kRight', t: 'key', name: '向右', def: 'ArrowRight', desc: '向右切换、增大数值。' },
    { k: 'kTab', t: 'key', name: '切换分类', def: 'Tab', desc: '切换页面里的分类或模块。' },
    { k: 'kMute', t: 'key', name: '静音', def: 'M', desc: '一键静音 / 取消静音。' },
  ] },
  { id: 'access', name: '辅助功能', rows: [
    { k: 'reduce', t: 'tog', name: '减弱动效', def: false, desc: '缩短飞入、扫光、视差、弹跳等动画，改成快速的淡入淡出。对晕动敏感时建议打开。' },
    { k: 'textSize', t: 'sel', name: '文字大小', opts: ['小', '标准', '大', '特大'], def: 1, desc: '对话和说明文字的大小。原型里先作用在本页。' },
  ] },
];
const PRESETS = { 0: [1, 1, 0, 0, 0], 1: [2, 1, 1, 1, 1], 2: [2, 2, 2, 2, 2], 3: [3, 2, 2, 3, 2] };   // 低 / 中 / 高 / 极高 → 阴影 抗锯齿 后处理 贴图 特效
const SUBS = ['shadow', 'aa', 'post', 'tex', 'fx'];
const ROW = {}; CATS.forEach((c) => c.rows.forEach((r) => { ROW[r.k] = r; r.cat = c.id; }));

/* ---------- 存取 ---------- */
const LS = 'arrogism.settings';
const val = {};
function load() {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (_) {}
  Object.values(ROW).forEach((r) => { val[r.k] = r.k in saved ? saved[r.k] : r.def; });
}
function save() { try { localStorage.setItem(LS, JSON.stringify(val)); } catch (_) {} }
load();

/* ---------- 立刻生效的部分 ---------- */
const origAnimate = Element.prototype.animate;
Element.prototype.animate = function (kf, o) {   // 减弱动效：所有 WAAPI 动画缩到 ≤160ms、去掉延迟
  if (val.reduce && o && typeof o === 'object') o = Object.assign({}, o, { duration: Math.min(+o.duration || 0, 160), delay: 0 });
  return origAnimate.call(this, kf, o);
};
function apply(k) {
  const root = document.documentElement, stage = document.getElementById('stage');
  if (!k || k === 'bright') { const b = .7 + val.bright / 100 * .6; if (stage) stage.style.filter = Math.abs(b - 1) < .01 ? '' : `brightness(${b.toFixed(2)})`; }
  if (!k || k === 'cursor') root.style.setProperty('--cur-k', [.8, 1, 1.25][val.cursor]);
  if (!k || k === 'reduce') root.classList.toggle('reduce-motion', !!val.reduce);
  if (!k || k === 'textSize') root.style.setProperty('--sg-fs', [.88, 1, 1.12, 1.25][val.textSize]);
  if (k === 'mode') {   // 全屏 ↔ 窗口（浏览器里只能做到这一步）
    try { if (val.mode === 0) document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {}
  }
}
apply();

let el = null, $ = null, ci = 0, focus = 0, listening = null, confirmT = 0;

/* ---------- 控件 ---------- */
function ctrl(r) {
  const v = val[r.k];
  if (r.t === 'sl') return `<div class="sg-sl" data-k="${r.k}"><i class="ln"></i><i class="fl" style="width:${v}%"></i><i class="kb" style="left:${v}%"></i></div><b class="sg-num">${Math.round(v)}</b>`;
  if (r.t === 'tog') return `<div class="sg-tog${v ? ' on' : ''}" data-k="${r.k}" data-hot><i></i></div><b class="sg-num">${v ? '开' : '关'}</b>`;
  if (r.t === 'sel') return `<div class="sg-sel" data-k="${r.k}"><i class="ar l" data-d="-1" data-hot></i><span>${esc(r.opts[v])}</span><i class="ar r" data-d="1" data-hot></i>` +
    `<div class="dots">${r.opts.map((_, j) => `<u${j === v ? ' class="on"' : ''}></u>`).join('')}</div></div>`;
  if (r.t === 'key') return `<div class="sg-key${listening === r.k ? ' wait' : ''}" data-k="${r.k}" data-hot>${listening === r.k ? '请按键…' : esc(keyName(v))}</div>`;
  return '';
}
function rowHTML(r, i) {
  return `<div class="sg-row${r.sub ? ' sub' : ''}${i === focus ? ' on' : ''}" data-i="${i}" data-hot><b class="nm">${esc(r.name)}</b><div class="ct">${ctrl(r)}</div></div>`;
}
function renderRows() {
  const c = CATS[ci];
  $('.sg-rows').innerHTML = `<i class="sg-ind"></i>` + c.rows.map(rowHTML).join('');
  $('.sg-h').textContent = c.name;
  placeInd(true); renderDesc();
}
function refreshRow(k) {   // 只重画一行的控件；滑条只改宽度和位置（拖动中不能把元素换掉）
  const r = ROW[k]; if (r.cat !== CATS[ci].id) return;
  const i = CATS[ci].rows.indexOf(r), row = el.querySelector(`.sg-row[data-i="${i}"] .ct`); if (!row) return;
  const sl = r.t === 'sl' && row.querySelector('.sg-sl');
  if (sl) { const v = val[k]; sl.querySelector('.fl').style.width = v + '%'; sl.querySelector('.kb').style.left = v + '%'; row.querySelector('.sg-num').textContent = Math.round(v); }
  else row.innerHTML = ctrl(r);
}
function placeInd(instant) {
  const ind = $('.sg-ind'), row = el.querySelector(`.sg-row[data-i="${focus}"]`); if (!ind || !row) return;
  if (instant) { ind.style.transition = 'none'; void ind.offsetWidth; }
  ind.style.transform = `translateY(${row.offsetTop + row.offsetHeight / 2 - 5}px)`;
  if (instant) requestAnimationFrame(() => { ind.style.transition = ''; });
  el.querySelectorAll('.sg-row').forEach((n) => n.classList.toggle('on', +n.dataset.i === focus));
}
function renderDesc() {
  const r = CATS[ci].rows[focus]; if (!r) return;
  $('.sg-desc').innerHTML = `<h3>${esc(r.name)}</h3><p>${esc(r.desc)}</p>` +
    (r.ref ? `<div class="sg-ref"><i style="background:#141414"></i><i style="background:#262626"></i><i style="background:#3a3a3a"></i></div>` : '') +
    (r.t === 'key' ? '' : `<p class="df">默认：${esc(r.t === 'sel' ? r.opts[r.def] : r.t === 'tog' ? (r.def ? '开' : '关') : r.def)}</p>`);
}
function renderCats() {
  $('.sg-cats').innerHTML = CATS.map((c, i) => `<div class="sg-cat${i === ci ? ' on' : ''}" data-c="${i}" data-hot><i class="sq"></i><b>${c.name}</b></div>`).join('');
}

/* ---------- 改值 ---------- */
function set(k, v, from) {
  const r = ROW[k];
  if (r.t === 'sl') v = Math.max(0, Math.min(100, Math.round(v)));
  if (r.t === 'sel') v = (v + r.opts.length) % r.opts.length;
  if (val[k] === v) return;
  const old = val[k]; val[k] = v;
  if (k === 'preset' && PRESETS[v]) SUBS.forEach((s, j) => { val[s] = PRESETS[v][j]; refreshRow(s); });   // 预设 → 一次改五个细项
  if (SUBS.includes(k)) { const p = Object.keys(PRESETS).find((p) => PRESETS[p].every((x, j) => x === val[SUBS[j]])); val.preset = p === undefined ? 4 : +p; refreshRow('preset'); }
  refreshRow(k); save(); apply(k);
  if (r.confirm && from !== 'revert') askKeep(k, old);
  if (window.SFX) window.SFX(r.t === 'sl' ? 'tick' : 'press');
}
function step(d) {   // ← →：改当前行
  const r = CATS[ci].rows[focus]; if (!r) return;
  if (r.t === 'sl') set(r.k, val[r.k] + d * 5);
  else if (r.t === 'sel') { set(r.k, val[r.k] + d); bump(r.k, d); }
  else if (r.t === 'tog') set(r.k, !val[r.k]);
}
function bump(k, d) { const s = el.querySelector(`.sg-sel[data-k="${k}"] span`); if (s) s.animate([{ transform: `translateX(${d * 16}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: GL }); }

/* 分辨率确认：10 秒倒计时，不点「保留」就退回 */
function askKeep(k, old) {
  clearInterval(confirmT);
  const box = $('.sg-confirm'); let n = 10;
  box.innerHTML = `<div class="in"><h3>保留这个分辨率吗？</h3><p><b>${n}</b> 秒后恢复为 ${esc(ROW[k].opts[old])}</p><div class="bt"><div class="sg-btn y" data-keep="1" data-hot>保留</div><div class="sg-btn" data-keep="0" data-hot>恢复</div></div></div>`;
  box.classList.add('on'); box.dataset.k = k; box.dataset.old = old;
  confirmT = setInterval(() => { n--; const b = box.querySelector('b'); if (b) b.textContent = n; if (n <= 0) keep(false); }, 1000);
}
function keep(yes) {
  clearInterval(confirmT); const box = $('.sg-confirm'); if (!box.classList.contains('on')) return;
  box.classList.remove('on'); if (!yes) set(box.dataset.k, +box.dataset.old, 'revert');
}

function pickCat(i, dir) {
  i = (i + CATS.length) % CATS.length; if (i === ci) return;
  ci = i; focus = 0; listening = null; renderCats(); renderRows();
  const rows = el.querySelectorAll('.sg-row');
  rows.forEach((n, j) => n.animate([{ opacity: 0, transform: `translateY(${(dir || 1) * 16}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, delay: j * 24, easing: GL, fill: 'backwards' }));
  $('.sg-h').animate([{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: GL });
}
function setFocus(i) { const n = CATS[ci].rows.length; i = Math.max(0, Math.min(n - 1, i)); if (i === focus) return; focus = i; placeInd(); renderDesc(); }
function resetCat() {
  CATS[ci].rows.forEach((r) => { val[r.k] = r.def; }); save(); apply(); renderRows();
  el.querySelectorAll('.sg-row .ct').forEach((n, j) => n.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 300, delay: j * 20 }));
}

/* ---------- 页面 ---------- */
function mount(root) {
  el = root; el.classList.add('sgp');
  el.innerHTML =
    `<div class="sg-tbar"></div>` +
    `<div class="closer sg-back" data-hot><img src="assets/chars/icon-back.png" alt=""></div>` +
    `<div class="sg-tab1">设置</div>` +
    `<div class="closer sg-x" data-hot><img src="assets/codex/icon-close.png" alt=""></div>` +
    `<div class="sg-ttl">设置</div><div class="sg-cats"></div>` +
    `<div class="sg-card"><div class="sg-h"></div><i class="sg-hl"></i><div class="sg-rows"></div><i class="sg-vl"></i><div class="sg-desc"></div>` +
    `<div class="sg-foot"><div class="sg-btn" data-reset data-hot>恢复本页默认</div><span>上下 选择　左右 调整　Tab 切换分类　Esc 返回</span></div>` +
    `<div class="sg-confirm"></div></div>`;
  $ = (s) => el.querySelector(s);
  renderCats(); renderRows();

  el.addEventListener('click', (e) => {
    const kp = e.target.closest('[data-keep]'); if (kp) { keep(kp.dataset.keep === '1'); return; }
    const c = e.target.closest('.sg-cat'); if (c) { pickCat(+c.dataset.c, +c.dataset.c > ci ? 1 : -1); return; }
    if (e.target.closest('[data-reset]')) { resetCat(); return; }
    const row = e.target.closest('.sg-row'); if (row) setFocus(+row.dataset.i);
    const ar = e.target.closest('.sg-sel .ar'); if (ar) { const k = ar.closest('.sg-sel').dataset.k, d = +ar.dataset.d; set(k, val[k] + d); bump(k, d); return; }
    const tg = e.target.closest('.sg-tog'); if (tg) { set(tg.dataset.k, !val[tg.dataset.k]); return; }
    const ky = e.target.closest('.sg-key'); if (ky) { listening = listening === ky.dataset.k ? null : ky.dataset.k; refreshRow(ky.dataset.k); return; }
  });
  el.addEventListener('pointerover', (e) => { const row = e.target.closest('.sg-row'); if (row && !e.target.closest('.sg-sl')) setFocus(+row.dataset.i); });
  // 滑条：按住拖动；拖动时黄方块转 45°
  el.addEventListener('pointerdown', (e) => {
    const s = e.target.closest('.sg-sl'); if (!s) return;
    const k = s.dataset.k, row = s.closest('.sg-row'); setFocus(+row.dataset.i);
    const mv = (ev) => { const r = s.getBoundingClientRect(); set(k, (ev.clientX - r.left) / r.width * 100); };
    s.classList.add('drag'); mv(e); s.setPointerCapture(e.pointerId);
    s.onpointermove = mv;
    s.onpointerup = () => { s.onpointermove = null; s.classList.remove('drag'); };
  });
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('on')) return;
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (listening) {   // 改键：Esc 取消；和别的操作重复时互换
      eat();
      if (e.key !== 'Escape') {
        const k = listening, dup = Object.keys(val).find((x) => ROW[x] && ROW[x].t === 'key' && x !== k && val[x] === e.key);
        if (dup) { val[dup] = val[k]; refreshRow(dup); const n = el.querySelector(`.sg-key[data-k="${dup}"]`); if (n) n.animate([{ background: '#ffc822' }, { background: '#fff' }], { duration: 700 }); }
        val[k] = e.key; save();
      }
      const k = listening; listening = null; refreshRow(k); return;
    }
    if ($('.sg-confirm').classList.contains('on')) { if (e.key === 'Enter') { eat(); keep(true); } else if (e.key === 'Escape') { eat(); keep(false); } return; }
    if (e.key === 'ArrowDown') { eat(); setFocus(focus + 1); }
    else if (e.key === 'ArrowUp') { eat(); setFocus(focus - 1); }
    else if (e.key === 'ArrowLeft') { eat(); step(-1); }
    else if (e.key === 'ArrowRight') { eat(); step(1); }
    else if (e.key === 'Tab') { eat(); pickCat(ci + (e.shiftKey ? -1 : 1), e.shiftKey ? -1 : 1); }
    else if (e.key === 'Enter' || e.key === ' ') { const r = CATS[ci].rows[focus]; if (!r) return; eat(); if (r.t === 'key') { listening = r.k; refreshRow(r.k); } else if (r.t === 'tog') step(1); }
    else if (e.key === 'm' || e.key === 'M') e.stopImmediatePropagation();   // 设置页里不让 M 触发静音（可能正在改键）
  }, true);
}

function enter() {
  listening = null; keep(false);
  const an = (s, kf, o) => el.querySelectorAll(s).forEach((n, i) => n.animate(kf, Object.assign({ easing: GL, fill: 'backwards' }, o, o.stag ? { delay: (o.delay || 0) + i * o.stag } : {})));
  an('.sg-tbar,.sg-back,.sg-tab1,.sg-x', [{ transform: 'translateY(-70px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 350, stag: 40 });
  an('.sg-ttl,.sg-cat', [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 450, stag: 50 });
  an('.sg-card', [{ transform: 'translateX(120px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 500 });
  an('.sg-row', [{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 800, stag: 30 });
  requestAnimationFrame(() => placeInd(true));
}

window.Settings = { mount, enter, get: (k) => val[k] };
})();
