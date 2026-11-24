/* 角色图鉴页（联系簿入口）。设计稿：Figma 432:3615（角色详情）/ 433:4991（角色全列表），画布 1920×1080。
   数据：chars-data.js（飞书表 Codex_Character）。
   · 详情视图：左边一条头像栏 + 右边大白板（基本信息 / Q版立绘 / 三个可折叠分组：能力概览、幸福理论、信息 / 半身立绘）
   · 全列表视图：点头像栏底部的九宫格进入，左边展开成 5 列的头像方块 + 底部分类药丸，右边收窄成基本信息 + 半身立绘预览
   立绘 / Q版 / 头像：assets/chars/{id}.png / {id}_q.png / {id}_a.png，缺失就用设计稿里的示例图（avatar / chibi / portrait）占位。 */
(function () {
'use strict';
const GL = 'cubic-bezier(.7,0,.2,1)';
const AS = 'assets/chars/';
/* 先只做这几个角色（其余数据留在 chars-data.js 里，要加就往这里补 id） */
const SHOW = new Set(['1001', '1002', '1003', '1004', '1005', '1006', '1007']);
const DATA = (window.CHARS || []).filter((c) => SHOW.has(c.id));

/* 分类 = 阵营（Codex_Character 的「阵营」列，固定 8 个，顺序即列表里的顺序，Figma 86:964）。可多选：都不选 = 全部 */
const FACTIONS = ['认证作者', '神话体系', '教师', '黑费露的关系', '同学', '万象人员', '洪流秩序', '魔女'];
const FACTION_LABEL = { 黑费露的关系: '与黑费露的关系' };   // 表里的值 → 界面上的写法
const fLabel = (f) => FACTION_LABEL[f] || f;
const NUM = ['一', '二', '三', '四', '五'];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const fmtH = (h) => (/^\d+$/.test(h) ? h + 'cm' : h.replace(/(\d)\s*xm/i, '$1cm'));   // 表里有 "174xm" / "165" 这样的笔误
const UNK = '？？？';
const WD = (window.WARDROBE || []).map((it) => it.part !== '饰品' ? it : { ...it, part: /吊坠|项链|挂坠/.test(it.name) ? '颈饰' : '腰饰' });   // 2026-11-20 Figma 583:2399：饰品拆成 颈饰 / 腰饰（表里还没分，先按名字猜，之后以表为准）
const PARTS = ['头部', '上衣', '下装', '鞋子', '颈饰', '腰饰', '手持物'], DR_TABS = ['套装', ...PARTS];
const HAPPY_OPEN = 1;   // 幸福理论：前几条已解锁（其余显示锁 + ？？？，Figma 462:290）。之后接剧情进度

let dressing = false;
let el = null, $ = null, q = '', cur = 0, view = 'profile', open = { ability: true, happy: true, info: true }, kbBusy = 0;
const sel = new Set();   // 选中的阵营，空 = 全部

const shown = () => DATA.filter((c) => (!sel.size || sel.has(c.faction)) && (!q || c.name.includes(q)));
const imgOf = (id, suf, fb) => `<img src="${AS}${id}${suf}.png" alt="" onerror="this.onerror=null;this.src='${AS}${fb}.png'">`;   // 图还没有就用设计稿里的示例图占位

/* 能力：表里是「能力1 / 能力1描述 / 能力2 / 能力2描述」。名字列还空着时，兼容旧写法——描述里「1、名字」开头、「——」开头的是说明；
   只有一个短词（如「全知全能」）就当名字，没有说明 */
function abilityBlocks(c) {
  const out = [];
  (c.abilities || []).forEach((a) => {
    if (a.name) { out.push({ head: a.name, desc: a.desc }); return; }
    const t = a.desc || '';
    if (/^\s*\d+、/.test(t)) t.split(/\n(?=\d+、)/).forEach((b) => {
      const lines = b.split('\n'), head = lines[0].replace(/^\s*\d+、/, '').trim();
      out.push({ head, desc: lines.slice(1).map((x) => x.replace(/^——/, '').trim()).filter(Boolean).join('\n') });
    });
    else if (t && !t.includes('\n') && [...t].length <= 12) out.push({ head: t, desc: '' });
    else if (t) out.push({ head: '', desc: t });
  });
  return out;
}
/* 武器：「武器 / 武器描述」。描述空着、名字又是一整句话时，名字其实是描述（标签只写「武器」） */
function weaponBlock(c) {
  const w = c.weapon; if (!w) return null;
  if (w.desc) return { head: w.name, desc: w.desc };
  return [...w.name].length <= 8 && !w.name.includes('——') ? { head: w.name, desc: '' } : { head: '', desc: w.name };
}

function mount(root) {
  el = root; el.classList.add('chars');
  el.innerHTML =
    `<div class="ch-floor0"></div><div class="ch-floor"></div>` +
    `<div class="ch-deco a"><img src="${AS}deco.png" alt=""></div><div class="ch-deco b"><img src="${AS}deco2.png" alt=""></div>` +
    `<div class="ch-tbar"></div>` +
    `<div class="ch-right"></div>` +
    `<div class="ch-fade"></div>` +
    `<div class="ch-main"><div class="ch-rail"></div><div class="ch-grid"></div><div class="ch-pills"></div></div>` +
    `<div class="ch-viewbtn" data-hot><img src="${AS}grid-icon.svg" alt=""><i><u></u><u></u><u></u><u></u><u></u><u></u><u></u><u></u><u></u></i></div>` +   // 提到页面根上：位置固定在 (77,954)，不跟着白板伸缩 / 入场动画动
    `<div class="ch-info"><div class="hd"><em></em>基本信息</div><div class="rows"></div></div>` +
    `<div class="ch-chibi"><img class="fl" src="${AS}box-floor.svg" alt=""><img class="ch" alt=""><div class="bt b1"><span><img src="${AS}ic-dress-a.svg" class="x1"><img src="${AS}ic-dress-b.svg" class="x2"></span><i>换装</i></div><div class="bt b2"><span><img src="${AS}ic-ctl-a.svg" class="y1"><img src="${AS}ic-ctl-b.svg" class="y2"><img src="${AS}ic-ctl-c.svg" class="y3"></span><i>操控</i></div></div>` +
    `<div class="ch-dc"><i class="r1"></i><i class="r2"></i></div>` +   // 换装页左边白卡 + 两块灰底（Figma 583:2399）
    `<div class="ch-sk"><img alt=""></div><div class="ch-sk2"><img alt=""></div>` +   // 骨骼小人两张贴花：联系簿小窗里一张、换装页一张，互不关联，各自原地淡入淡出
    `<div class="ch-acc"></div>` +
    `<div class="ch-port"><div class="sil"><img src="${AS}sil.png" alt=""></div><div class="sg"></div><div class="pt"><img alt=""></div></div>` +
    `<div class="ch-tri"></div>` +
    `<div class="ch-name"><div class="in"><div class="nm"></div><div class="sb"></div></div></div>` +
    `<div class="ch-tip"><svg width="72" height="34"><path d="M0 0L36 34H72"/></svg><s></s><b></b><i></i></div>` +
    `<div class="closer ch-back" data-hot><img src="${AS}icon-back.png" alt=""></div>` +
    `<div class="ch-search"><input type="text" spellcheck="false" placeholder="" data-hot><img src="assets/codex/icon-search.png" alt=""></div>` +
    `<div class="ch-tab1">联系簿</div>` +
    `<div class="ch-t3"><div class="wb"></div><img class="fd" src="assets/codex/icon-folder.png" alt=""><div class="tx a" data-hot>联系簿</div><s class="ln"></s><img class="cv" src="${AS}wd-chev.png" alt=""><div class="tx b">换装</div></div>` +
    `<div class="ch-dn"><b></b><i></i></div>` +
    `<div class="ch-dr"><div class="pn"><div class="tt">衣橱</div><s class="dv"></s><div class="ct"></div>` +
    // 右上：「复原」按钮（Figma 459:934，网页原型里只做样子、不接功能）+「更换装扮」（= 原来的「完成」：保存当前穿戴，回到联系簿）
    `<div class="sw" data-hot><s class="l"></s><s class="r"></s><img src="${AS}wd-swap.png" alt=""></div><div class="ok" data-hot><b>更换装扮</b></div>` +
    `<div class="tabs">${DR_TABS.map((t) => `<div class="tb" data-tab="${t}" data-hot>${t}</div>`).join('')}</div>` +
    // 列表区：撕纸边的蒙版里上下滚动（Figma「蒙版」869×550），不再翻页
    `<div class="bd"></div><div class="pgr"><b class="pv" data-hot>‹</b><span></span><b class="nx" data-hot>›</b></div></div></div>` +
    `<div class="closer ch-x" data-hot><img src="assets/codex/icon-close.png" alt=""></div>`;
  $ = (q) => el.querySelector(q);
  el.addEventListener('click', (e) => {
    if (dressing && e.target.closest('.ch-back,.ch-t3 .a')) { e.stopPropagation(); setDress(false); return; }   // 换装里的返回 = 回到联系簿，不退出整页
    if (e.target.closest('.ch-chibi .b1')) { setDress(true); return; }
    if (dressing && e.target.closest('.ch-viewbtn')) { setDress(false); setTimeout(() => setView('list'), 900); return; }
    if (dressing && e.target.closest('.ch-dr')) { drClick(e); return; }
    if (e.target.closest('.ch-viewbtn')) { setView(view === 'profile' ? 'list' : 'profile'); return; }
    if (e.target.closest('.ch-sortbar .dd')) { setPop(!$('.ch-catpop').classList.contains('on')); return; }
    const ct = e.target.closest('.ch-opt'); if (ct) { pickCat(ct.dataset.c); return; }
    if (!e.target.closest('.ch-catpop')) setPop(false);
    const av = e.target.closest('.ch-av'); if (av) { select(+av.dataset.i); return; }
    const tl = e.target.closest('.ch-tile'); if (tl) { const i = +tl.dataset.i; if (i === cur) setView('profile'); else select(i); return; }
    const sh = e.target.closest('.sec-h'); if (sh) { toggleSec(sh.dataset.s); return; }
    const ip = e.target.closest('[data-ip]'); if (ip) { infoGo(+ip.dataset.ip); return; }
  });
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('on')) return;
    if (dressing && (e.key === 'Escape' || e.key === 'Backspace') && e.target.tagName !== 'INPUT') { e.preventDefault(); e.stopImmediatePropagation(); setDress(false); return; }
    if (dressing && e.target.tagName !== 'INPUT') {                         // 换装里：←→ 翻页，Tab 切分类
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); drPage(k === 'ArrowLeft' ? -1 : 1); return; }
      if (k === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); const i = DR_TABS.indexOf(dr.tab); drTab(DR_TABS[(i + (e.shiftKey ? -1 : 1) + DR_TABS.length) % DR_TABS.length]); return; }
      if (k.startsWith('Arrow')) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // 换装时不翻角色
    }
    if (e.target.tagName === 'INPUT') { e.stopImmediatePropagation(); return; }                       // 搜索框里打字：不触发翻角色 / 别处的快捷键
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    const k = e.key, list = view === 'list';
    if (k === 'Escape' && $('.ch-catpop').classList.contains('on')) { eat(); setPop(false); return; }   // Esc 先收起阵营选择框
    if (k === 'ArrowDown') { eat(); step(list ? 5 : 1); } else if (k === 'ArrowUp') { eat(); step(list ? -5 : -1); }
    else if (list && k === 'ArrowRight') { eat(); step(1); } else if (list && k === 'ArrowLeft') { eat(); step(-1); }
    else if (list && k === 'Enter') { eat(); setView('profile'); }
  }, true);
  const tip = $('.ch-tip'), stg = document.getElementById('stage'); let tipT = 0, tipAv = null;
  el.addEventListener('pointerover', (e) => {
    const av = e.target.closest('.ch-av'); if (!av || view !== 'profile' || dressing) return;   // 换装时不出名字提示，只有头像自己的轻微放大
    const c = shown()[+av.dataset.i]; if (!c) return;
    clearTimeout(tipT);
    if (av === tipAv && tip.classList.contains('on')) return;            // 还在同一个头像里：不重播
    tipAv = av;
    // 引线从头像圆（63px，在 .ch-av 里居中）的右边缘、中线出发；坐标取整，线和方块不会差半个像素
    const st = stg.getBoundingClientRect(), k = st.width / 1920, r = av.getBoundingClientRect();
    tip.style.top = Math.round((r.top + r.height / 2 - st.top) / k) + 'px';
    tip.style.left = Math.round((r.left + r.width / 2 - st.left) / k + 31.5 + 4) + 'px';
    tip.querySelector('b').textContent = c.name; const f = c.faction || c.inst; tip.querySelector('i').textContent = f ? `<${f}>` : '';
    tip.classList.toggle('cur', +av.dataset.i === cur);                   // 当前角色：末端方块变黄
    el.querySelectorAll('.ch-av.up').forEach((n) => n.classList.remove('up')); av.classList.add('up');
    tip.classList.add('on'); el.classList.add('tipping');
    // 入场：黑线从头像长出来（0.36s）→ 线头弹出方块 → 名字、体系从方块后面向右展开。每换一个头像都重新长一遍
    const A = (q, kf, o) => { const n = tip.querySelector(q); n.getAnimations().forEach((a) => a.cancel()); n.animate(kf, Object.assign({ fill: 'backwards' }, o)); };
    A('path', [{ strokeDashoffset: 90 }, { strokeDashoffset: 0 }], { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)' });
    A('s', [{ transform: 'scale(0)' }, { transform: 'none' }], { duration: 320, delay: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });
    const show = [{ clipPath: 'inset(0 100% 0 0)', transform: 'translateX(-10px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'none' }];
    A('b', show, { duration: 380, delay: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    A('i', show, { duration: 380, delay: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
  el.addEventListener('pointerout', (e) => {
    const av = e.target.closest('.ch-av'); if (!av || (e.relatedTarget && av.contains(e.relatedTarget))) return;
    clearTimeout(tipT); tipT = setTimeout(() => { tip.classList.remove('on'); tipAv = null; el.classList.remove('tipping'); el.querySelectorAll('.ch-av.up').forEach((n) => n.classList.remove('up')); }, 70);   // 稍等一下：从一个头像移到下一个时不收起
  });
  $('.ch-search input').addEventListener('input', (e) => { q = e.target.value.trim(); cur = 0; buildAll(); });
  buildAll();
}

function buildAll() { buildPills(); buildRail(); buildGrid(); render(false); }
/* 底部筛选条（左白板右下，Figma 86:964）：灰色胶囊「全部 ^」+「分类」。点胶囊向上展开阵营列表（全部 + 8 个阵营，可多选） */
const CATS = ['全部', ...FACTIONS];
const OPT_Y = (i) => (i === 0 ? 14 : 72 + (i - 1) * 37.5);   // 每行的 top：「全部」在横线上方，8 个阵营在下方
function buildPills() {
  if ($('.ch-sortbar')) { syncCats(); return; }   // 结构只建一次：筛选变化时只改状态，列表保持展开
  $('.ch-pills').innerHTML =
    `<div class="ch-sortbar"><div class="dd" data-hot><span class="v"></span><img src="${AS}icon-up.png" alt=""></div><b class="lb">分类</b></div>` +
    `<div class="ch-catpop"><b class="hd">阵营</b><i class="ln"></i>` +
    CATS.map((c, i) => `<div class="ch-opt${i ? '' : ' all'}" data-c="${esc(c)}" data-hot style="top:${OPT_Y(i)}px"><s></s>${esc(i ? fLabel(c) : c)}</div>`).join('') + `</div>`;
  syncCats();
}
const isOn = (c) => (c === '全部' ? !sel.size : sel.has(c));
function syncCats() {
  el.querySelectorAll('.ch-opt').forEach((n) => n.classList.toggle('sel', isOn(n.dataset.c)));
  const picked = FACTIONS.filter((f) => sel.has(f));   // 按固定顺序显示，不按点选顺序
  $('.ch-sortbar .v').textContent = !picked.length ? '全部' : picked.length === 1 ? fLabel(picked[0]) : `${fLabel(picked[0])} 等 ${picked.length} 个`;
}
function pickCat(c) {
  if (c === '全部') sel.clear(); else if (sel.has(c)) sel.delete(c); else sel.add(c);
  if (sel.size === FACTIONS.length) sel.clear();   // 8 个都选上 = 全部
  cur = 0; buildAll();
}
function setPop(on) { const p = $('.ch-catpop'); if (!p) return; p.classList.toggle('on', on); $('.ch-sortbar .dd').classList.toggle('on', on); }
const AVFB = ['avatar', 'avatar-b', 'avatar-c', 'avatar-d', 'avatar-e'];            // 没有自己头像时，按顺序用稿里的 5 张示例头像
const avHTML = (c, i) => `<div class="ai"><img class="f1" src="${AS}ring-out.svg" alt=""><img class="f2" src="${AS}ring-in.svg" alt=""><img class="s1" src="${AS}ring-a.svg" alt=""><img class="s2" src="${AS}ring-b.svg" alt=""><div class="c">${imgOf(c.id, '_a', AVFB[i % AVFB.length])}</div></div>`;
function buildRail() {
  $('.ch-rail').innerHTML = shown().map((c, i) => `<div class="ch-av${i === cur ? ' sel' : ''}" data-i="${i}" data-hot>${avHTML(c, i)}</div>`).join('') || '';
}
function buildGrid() {
  const g = $('.ch-grid');
  g.innerHTML = shown().map((c, i) => `<div class="ch-tile${i === cur ? ' sel' : ''}" data-i="${i}" data-hot>${imgOf(c.id, '_q', 'chibi')}<span>${esc(c.name)}</span></div>`).join('') || '<div class="ch-none">这个分类还没有角色</div>';
}
function step(d) { const n = shown().length, i = cur + d; if (i >= 0 && i < n) select(i); }
function select(i) {
  if (i === cur) return; cur = i;
  el.querySelectorAll('.ch-av,.ch-tile').forEach((n) => n.classList.toggle('sel', +n.dataset.i === cur));
  const s = el.querySelector(view === 'list' ? '.ch-tile.sel' : '.ch-av.sel'); if (s) s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  render(true);
}
/* 换装转场：小人只是贴花，不旋转、不挪位置。联系簿的内容（含小窗小人）原地淡出 → 换装页的大小人、名字、衣橱淡入；退出倒过来 */
const SK_FROM = 'translate(-183px,12px) scale(.4478)';   // 小窗小人：用换装位置 (396,337) 424×581 的图缩到小窗（中心 x 425、脚底 y 930、高 260）
function setDress(on) {
  if (on === dressing) return; dressing = on;
  if (on && view === 'list') setView('profile');
  if (on) { dr.tab = '套装'; dr.page = 0; dr.sel = null; drBuild(450); }
  el.classList.toggle('dressing', on);
  $('.ch-tip').classList.remove('on'); el.classList.remove('tipping');
}
/* ===== 衣橱（Figma 602:362 按部位 / 603:362 套装）=====
   数据：wardrobe-data.js（飞书「服装拆分汇总」）。分类 = 套装 + 表里 6 个部位。
   · 只显示已获得的服装（样例：先给地下街 + 一部分下街，凑 37 件；之后接存档）
   · 套装：表里「系列」相同、跨两个以上部位的算一套；第一张固定是角色自己的衣服「xx的服装」
   · 点格子 = 穿上（再点一次正在穿的 = 换回角色自己的那件）；点套装 = 把这套里已获得的部位都穿上
   · 小人身上还没有分件的服装图，穿上时小人跳一下表示换好了 */
const PER_SET = 6, PER_IT = 12;
const OWN = new Set(), NEW = new Set(['T006', 'B005']);   // 已获得 / 新获得（右上黄点，点过就消失）
['地下街', '下街'].forEach((s) => WD.forEach((it) => { if (OWN.size < 37 && it.street.startsWith(s)) OWN.add(it.id); }));
['颈饰', '腰饰'].forEach((p) => WD.filter((it) => it.part === p).slice(0, 6).forEach((it) => OWN.add(it.id)));   // 样例：颈饰 / 腰饰各给 6 件，免得这两个分类是空的
const SETS = (() => {
  const by = new Map(); WD.forEach((it) => { if (!by.has(it.series)) by.set(it.series, []); by.get(it.series).push(it); });
  return [...by].filter(([, a]) => new Set(a.map((x) => x.part)).size >= 2).map(([name, a]) => ({ key: name, name, items: a }));
})();
const dr = { tab: '套装', page: 0, sel: null }, eqBy = {};
const ownSet = (c) => ({ key: '@own', name: c.name + '的服装', items: ['头部', '上衣', '下装', '鞋子'].map((p) => ({ id: `${c.id}-${p}`, name: c.name + '的' + p, part: p, own: 1 })) });
const owned = (it) => it.own || OWN.has(it.id);
function eqOf(c) {   // 每个角色各自的穿戴；默认穿自己的衣服
  if (!eqBy[c.id]) { eqBy[c.id] = {}; ownSet(c).items.forEach((it) => { eqBy[c.id][it.part] = it.id; }); }
  return eqBy[c.id];
}
/* 一套里每个部位只算一件（同部位有好几件时取第一件已获得的） */
function setParts(s) {
  const m = new Map(); s.items.forEach((it) => { const o = m.get(it.part); if (!o || (!owned(o) && owned(it))) m.set(it.part, it); });
  return PARTS.filter((p) => m.has(p)).map((p) => m.get(p));
}
function drList() { const c = shown()[cur]; return dr.tab === '套装' ? [ownSet(c), ...SETS] : WD.filter((it) => it.part === dr.tab && OWN.has(it.id)); }
function drBuild(delay) {
  const c = shown()[cur]; if (!c) return;
  const eq = eqOf(c), list = drList(), per = dr.tab === '套装' ? PER_SET : PER_IT, pages = Math.max(1, Math.ceil(list.length / per));
  dr.page = Math.min(dr.page, pages - 1);
  $('.ch-dr .ct').textContent = `<已收集 ${OWN.size} / ${WD.length}>`;
  el.querySelectorAll('.ch-dr .tb').forEach((t) => t.classList.toggle('sel', t.dataset.tab === dr.tab));
  // 2026-11-13 Figma「更新部分」：整张列表放在撕纸蒙版里上下滚动（不再分页），格子 / 套装卡换成纸片样式
  const pg = list;
  const tag = '<em><i>穿戴中</i></em>';
  const setTop = (r) => [26, 228, 444][r] ?? 444 + (r - 2) * 216;   // 稿里三行套装：405 / 607 / 823（相对蒙版 379）
  const itTop = (r) => [42, 258, 472][r] ?? 472 + (r - 2) * 214;    // 稿里三行单件：421 / 637 / 851
  $('.ch-dr .bd').innerHTML = dr.tab === '套装'
    ? pg.map((s, i) => { const ps = setParts(s), have = ps.filter(owned), on = have.length && have.every((it) => eq[it.part] === it.id);
        return `<div class="sc${dr.sel === s.key ? ' sel' : ''}" data-set="${esc(s.key)}" data-hot style="left:${26 + (i % 2) * 432}px;top:${setTop(Math.floor(i / 2))}px"><s class="yf"></s><i class="bg"></i><i class="th"></i>${on ? tag : ''}` +
          `<b>${esc(s.name)}</b><img class="ln" src="${AS}wd-line.svg" alt=""><u${have.length === ps.length ? ' class="full"' : ''}>${have.length}/${ps.length}</u>` +
          `<div class="ps">${ps.map((it) => `<span${owned(it) ? ' class="o"' : ''}><i></i>${it.part}</span>`).join('')}</div></div>`; }).join('')
    : pg.map((it, i) => `<div class="it${dr.sel === it.id ? ' sel' : ''}" data-it="${it.id}" data-hot style="left:${41 + (i % 4) * 207}px;top:${itTop(Math.floor(i / 4))}px"><s class="yf"></s><i class="bx"></i><i class="ph"></i>${eq[it.part] === it.id ? tag : ''}${NEW.has(it.id) ? '<q></q>' : ''}<b>${esc(it.name)}</b></div>`).join('')
      || '<div class="none">还没有这个部位的服装</div>';
  // 列表底部留一点空，最后一行能完整滚进蒙版里
  const rows = Math.ceil(pg.length / (dr.tab === '套装' ? 2 : 4)), last = rows ? (dr.tab === '套装' ? setTop(rows - 1) + 176 : itTop(rows - 1) + 186) : 0;
  if (rows) $('.ch-dr .bd').insertAdjacentHTML('beforeend', `<i class="end" style="top:${last + 30}px"></i>`);
  $('.ch-dr .pgr span').textContent = `${dr.page + 1} / ${pages}`;
  $('.ch-dr .pv').classList.toggle('dis', dr.page === 0); $('.ch-dr .nx').classList.toggle('dis', dr.page >= pages - 1);
  if (delay != null) $('.ch-dr .bd').scrollTop = 0;   // 换分类 / 换人：回到列表顶上
  if (delay != null) el.querySelectorAll('.ch-dr .bd>div').forEach((n, i) => n.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: delay + i * 40, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'backwards' }));
}
function drTab(t) { if (t === dr.tab) return; dr.tab = t; dr.page = 0; drBuild(0); }
function drPage(d) { const bd = $('.ch-dr .bd'); bd.scrollBy({ top: d * 430, behavior: 'smooth' }); }   // 不再分页：左右键 = 列表上下滚两行
function hop() { $('.ch-sk2 img').animate([{ transform: 'none' }, { transform: 'translateY(-18px)', offset: .4 }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }
function drClick(e) {
  const c = shown()[cur], eq = eqOf(c);
  if (e.target.closest('.ok')) { setDress(false); return; }               // 完成：保存当前穿戴，回到联系簿
  const tb = e.target.closest('.tb'); if (tb) { drTab(tb.dataset.tab); return; }
  if (e.target.closest('.pv')) { drPage(-1); return; } if (e.target.closest('.nx')) { drPage(1); return; }
  const it = e.target.closest('.it');
  if (it) { const x = WD.find((w) => w.id === it.dataset.it), def = ownSet(c).items.find((o) => o.part === x.part);
    eq[x.part] = eq[x.part] === x.id ? (def ? def.id : null) : x.id; dr.sel = x.id; NEW.delete(x.id); drBuild(); hop(); return; }
  const sc = e.target.closest('.sc');
  if (sc) { const s = sc.dataset.set === '@own' ? ownSet(c) : SETS.find((x) => x.key === sc.dataset.set);
    setParts(s).filter(owned).forEach((x) => { eq[x.part] = x.id; }); dr.sel = s.key; drBuild(); hop(); }
}

function setView(v) {
  if (v === view) return; view = v; el.classList.toggle('v-list', v === 'list');
  $('.ch-viewbtn i').animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 900, easing: GL });   // 图标转一圈，方块在转的时候缩没 / 长出
  const s = el.querySelector(v === 'list' ? '.ch-tile.sel' : '.ch-av.sel'); if (s) setTimeout(() => s.scrollIntoView({ block: 'nearest' }), 50);
}

function bindImg(img, src, box, fb) {
  box.classList.remove('nopt'); img.onerror = () => { img.onerror = () => box.classList.add('nopt'); img.src = `${AS}${fb}.png`; }; img.src = src;
}
function render(anim) {
  const c = shown()[cur];
  if (!c) { ['.ch-name .nm', '.ch-name .sb', '.ch-info .rows', '.ch-acc'].forEach((q) => { $(q).innerHTML = ''; }); return; }
  $('.ch-name .nm').innerHTML = [...c.name].map((ch) => `<span>${esc(ch)}</span>`).join(''); $('.ch-name .sb').textContent = c.faction ? `< ${c.faction} >` : '';
  $('.ch-dn b').textContent = c.name; $('.ch-dn i').textContent = c.faction ? `< ${c.faction} >` : '';   // 换装页左上角的名字
  const ab = abilityBlocks(c);
  const rows = [['姓名', c.name], ['种族', c.race], ['身高', c.height && fmtH(c.height)], ['性别', c.gender], ['能力', ab[0] && ab[0].head], ['生日', c.birthday], ['居住地', c.residence]];
  $('.ch-info .rows').innerHTML = rows.map(([k, v]) => `<div class="r"><i>${k}</i><b style="font-size:${[...(v || UNK)].length > 11 ? 15 : 18}px">${esc(v || UNK)}</b></div>`).join('');
  bindImg($('.ch-sk img'), `${AS}${c.id}_q.png`, $('.ch-sk'), 'chibi');                 // 骨骼小人（缺失就用示例图）
  bindImg($('.ch-sk2 img'), `${AS}${c.id}_q.png`, $('.ch-sk2'), 'chibi');
  bindImg($('.ch-port .pt img'), `${AS}${c.id}.png`, $('.ch-port'), 'portrait');
  c._ab = ab; paintAcc();
  if (dressing) { dr.sel = null; drBuild(0); }   // 换装时在头像栏换人：衣橱换成这个人的穿戴
  if (anim && dressing) {   // 换装时换人：名字 / 信息 / 立绘本来就是藏着的，不能演入场动画（动画会临时把它们显示出来，闪一下又消失）
    $('.ch-sk2').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: GL, fill: 'backwards' });
  } else if (anim) {
    ['.ch-name', '.ch-info', '.ch-acc'].forEach((q, i) => $(q).animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: i * 40, easing: GL, fill: 'backwards' }));
    // 换角色：前景立绘从左边进，后面的剪影和格纹从右边进
    $('.ch-port .pt').animate([{ opacity: 0, transform: 'translateX(-260px)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: GL, fill: 'backwards' });
    $('.ch-port .sil').animate([{ opacity: 0, transform: 'translateX(220px) scaleX(-1)' }, { opacity: 1, transform: 'scaleX(-1)' }], { duration: 750, delay: 80, easing: GL, fill: 'backwards' });
    $('.ch-port .sg').animate([{ opacity: 0, transform: 'translateX(220px)' }, { opacity: 1, transform: 'none' }], { duration: 750, delay: 80, easing: GL, fill: 'backwards' });
    $(dressing ? '.ch-sk2' : '.ch-sk').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: GL, fill: 'backwards' });
  }
}

/* 三个可折叠的分组（Figma 461:2 / 462:290 / 468:2）：深灰标题条，三个可以同时展开，互不影响；
   能力概览 / 幸福理论按内容高度展开，信息占剩下的高度，放不下的在组内上下滚动 */
function paintAcc() {
  const c = shown()[cur]; if (!c) return;
  // 能力 / 武器：左边黑竖条 + 标签 + 图标（白色柔光上叠徽记，Figma 462:290 的「同学」「洪流秩序」，先所有角色共用）+ 说明框
  const wp = weaponBlock(c);
  // 2026-11-21：去掉能力 / 武器图标，统一用 Figma 39:1171「武器」那种样式：标签下面直接一条灰底说明
  const abBlk = (k, b) => `<div class="ab"><span class="tg">${k}${b.head ? '：' + esc(b.head) : ''}</span><div class="row"><div class="ds">${esc(b.desc || UNK)}</div></div></div>`;
  const abil = (c._ab || []).map((b) => abBlk('能力', b)).join('') + (wp ? abBlk('武器', wp) : '') || '<div class="nil">尚未收录</div>';
  // 幸福理论：每条 = 小标题（白底黑框）+ 正文；前 HAPPY_OPEN 条已解锁，之后的编号换成锁、小标题显示 ？？？、不显示正文
  const happy = (c.happy || []).map((h, i) => i < HAPPY_OPEN
    ? `<div class="np"><i>${i + 1}</i><p>${h.title ? `<span class="bx">${esc(h.title)}</span>` : ''}${h.text ? `<span class="tx">${esc(h.text)}</span>` : ''}</p></div>`
    : `<div class="np lk"><i><img src="${AS}lock-w.png" alt=""></i><p><span class="bx">？？？</span></p></div>`).join('') || '<div class="nil">尚未收录</div>';
  // 信息：兴趣爱好 + 信息1…n，每段一个深灰标签，竖着排
  const blk = (t, b) => `<div class="ib"><span class="tg">${t}</span><p>${esc(b)}</p></div>`;
  const info = (c.interest ? blk('兴趣爱好', c.interest) : '') + c.info.map((t, i) => (t ? blk('信息' + (i + 1), t) : '')).join('') || '<div class="nil">尚未收录</div>';
  const sec = (k, title, body, cls = '') => `<div class="sec ${k} ${cls}${open[k] ? ' on' : ''}" data-k="${k}"><div class="sec-h" data-s="${k}" data-hot><img src="${AS}chevron-sec-w.svg" alt="">${title}</div><div class="sec-b"><div class="in">${body}</div><s></s></div></div>`;
  const pd = (b) => `<div class="pd">${b}</div>`;
  $('.ch-acc').innerHTML = sec('ability', '能力概览', pd(abil)) + sec('happy', '幸福理论', pd(happy)) + sec('info', '信息', pd(info), 'info'); $('.ch-acc').scrollTop = 0;   // 换人：中部整列回到顶上
}
/* 点分组标题：只开 / 收这一组 */
function toggleSec(k) {
  open[k] = !open[k];
  el.querySelectorAll('.sec').forEach((s) => s.classList.toggle('on', !!open[s.dataset.k]));
}
/* 信息的分页：多栏 + 横向平移，页数 = 多栏总宽 / 步长；容器尺寸变化（展开动画、换角色）时重新量 */
let ipage = 0, ipages = 1, ro = null;
function layoutInfo() {
  const fl = $('.sec.info .fl'); if (!fl) return;
  const w = fl.clientWidth; if (w < 50) return;
  fl.style.columnWidth = w + 'px'; const stride = w + 36;
  ipages = Math.max(1, Math.round((fl.scrollWidth + 36) / stride)); ipage = Math.min(ipage, ipages - 1);
  fl.style.transform = `translateX(${-ipage * stride}px)`;
  const pg = $('.ipg'); pg.classList.toggle('one', ipages <= 1); pg.dataset.at = ipage === 0 ? 'first' : ipage === ipages - 1 ? 'last' : '';
  $('.ipg span').textContent = `${ipage + 1} / ${ipages}`;
}
function infoGo(d) { const n = Math.max(0, Math.min(ipages - 1, ipage + d)); if (n === ipage) return; ipage = n; layoutInfo(); }
function watchInfo() {
  if (ro) ro.disconnect(); ipage = 0;
  const fl = $('.sec.info .fl'); if (!fl) return;
  ro = new ResizeObserver(layoutInfo); ro.observe(fl);
}

// 从主页进来时停在哪：o.mode = 'first'（「联系簿」牌子：默认排序第一位角色的详情）| 'profile'（头像贴纸：o.id 这个角色的详情）| 'dress'（衣架：换装）| 'list'（全列表）
function enter(o = {}) {
  if (dressing && o.mode !== 'dress') { dressing = false; el.classList.remove('dressing'); }
  q = ''; sel.clear(); setPop(false); const inp = $('.ch-search input'); if (inp) inp.value = '';
  open = { ability: true, happy: true, info: true };   // 每次进联系簿三组都展开，玩家点了才收起
  const i = o.id ? DATA.findIndex((c) => c.id === o.id) : -1; cur = o.mode === 'profile' && i >= 0 ? i : 0;
  buildAll();
  setView(o.mode === 'list' ? 'list' : 'profile');
  // 衣架：直接进换装页。不经过角色详情（不放详情页的入场动画），也不走 联系簿→换装 的过渡；换装页的东西跟着整页一起入场
  if (o.mode === 'dress') {
    el.classList.add('instant'); dressing = true; dr.tab = '套装'; dr.page = 0; dr.sel = null;
    el.classList.add('dressing'); drBuild(600);
    setTimeout(() => el.classList.remove('instant'), 50);
  }
  const an = (q, kf, o) => el.querySelectorAll(q).forEach((n, i) => n.animate(kf, Object.assign({ easing: GL, fill: 'backwards' }, o, o.stag ? { delay: (o.delay || 0) + i * o.stag } : {})));
  if (o.mode === 'dress') {
    an('.ch-tbar,.ch-search,.ch-t3,.ch-back,.ch-x', [{ transform: 'translateY(-70px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 350, stag: 40 });
    an('.ch-main', [{ transform: 'translateY(90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 450 });
    an('.ch-av', [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 800, stag: 50 });
    an('.ch-dc', [{ transform: 'translateX(-90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 450 });
    an('.ch-dr .pn', [{ transform: 'translateX(90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 500 });
    an('.ch-dn', [{ transform: 'translateX(-40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 650 });
    an('.ch-sk2', [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 650 });   // 骨骼小人跟着白卡一起出现，不提前露出来
    return;
  }
  an('.ch-tbar,.ch-search,.ch-tab1,.ch-back,.ch-x', [{ transform: 'translateY(-70px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 350, stag: 40 });
  an('.ch-name', [{ transform: 'translateX(60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: 800 });
  an('.ch-right,.ch-main', [{ transform: 'translateY(90px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 450, stag: 80 });
  an('.ch-av', [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600, delay: 800, stag: 50 });
  an('.ch-info,.ch-chibi,.ch-acc', [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 750, stag: 70 });
  if (o.mode !== 'dress') an('.ch-sk', [{ transform: `${SK_FROM} translateY(50px)`, opacity: 0 }, { transform: SK_FROM, opacity: 1 }], { duration: 700, delay: 820 });   // 骨骼小人跟小窗一起出现，不先露出来
  an('.ch-port .pt', [{ transform: 'translateX(-560px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100, delay: 600 });          // 角色：从左侧入场
  an('.ch-port .sil', [{ transform: 'translateX(460px) scaleX(-1)', opacity: 0 }, { transform: 'scaleX(-1)', opacity: 1 }], { duration: 1100, delay: 750 });   // 剪影：从右侧入场
  an('.ch-port .sg', [{ transform: 'translateX(460px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 1100, delay: 750 });
}

window.Chars = { mount, enter };
})();
