/* 店铺商品展示页（主菜单「返回」入口，临时接在这里）。不占满全屏：底下是地图画面（原稿 Figma 529:177 的「苹果黄油」场景，原色），
   左边贴着屏幕边浮一块面板，右边留出地图。黑白灰 + 黄：
   · 面板头：店名 + <所在地>，右上角 ✕；点面板外的地图也关闭
   · 档口：一排横向标签（方块 + 粗字，当前档口方块变黄），Tab / Shift+Tab 切换
   · 左：商品格 4×2，一页 8 个，超出翻页（◂ 1/2 ▸）；名字里有「的」就在「的」后面换行（原稿规则）
   · 右：选中商品的大图、<分类>、名字、说明
   · 没有购买按钮：只看，不买 */
(function () {
'use strict';
const GL = 'cubic-bezier(.7,0,.2,1)';
const A = 'assets/shop/';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// 名字换行：有「的」在「的」后面断（原稿规则）；否则在括号前、或引号结束后断，避免「（下 / 装）」这种断法
const brk = (s) => { const t = esc(s);
  if (/的./.test(s)) return t.replace(/的(?!$)/, '的<br>');
  if (/.（/.test(s)) return t.replace(/（/, '<br>（');
  return t.replace(/^(&quot;[^&]+&quot;)(?=.)/, '$1<br>'); };

/* ---------- 数据（示例；一个店铺多个档口，每个档口多件商品） ---------- */
const FOOD = '至尊炒饭', DOLL = '被飞船吸走的牧羊犬玩偶', VEG = '"健康到难过"蔬菜干', PANTS = '先珀利流行装（下装）';
const D = {
  [FOOD]: ['熟食', '地下街最出名的一碗饭。米粒先过一遍猛火，再把当天剩下的所有配菜一口气倒进去，所以每天吃到的都不一样。'],
  [DOLL]: ['玩具', '据说原型是一只真的被飞船吸走的牧羊犬。玩偶肚子里塞了一张小纸条，写着它最后被看见的坐标。'],
  [VEG]: ['干货', '号称营养过剩的蔬菜干，吃一口就会让人反省最近的饮食。包装背面印着一整面的膳食建议。'],
  [PANTS]: ['服饰', '先珀利今年的流行款，裤脚故意做得一长一短。店主说这是「为了让人记住你的走路姿势」。'],
};
const mix = (n, seed) => Array.from({ length: n }, (_, i) => [FOOD, DOLL, VEG, PANTS][(i * 7 + seed) % 4]);
const SHOP = {
  name: '卡奔咕哧', where: '地下街',
  stalls: [
    { name: '熟食档口', items: mix(20, 0) },
    { name: '杂货档口', items: mix(9, 1) },
    { name: '服饰档口', items: mix(14, 3) },
    { name: '玩具档口', items: mix(6, 2) },
    { name: '干货档口', items: mix(11, 1) },
  ],
};
const PER = 8;

let el, si = 0, page = 0, sel = 0;   // 档口 / 页 / 当前页里选中的格子
const $ = (s) => el.querySelector(s);

function mount(root) {
  el = root; el.classList.add('shp');
  el.innerHTML =
    `<div class="sp-bg closer"><img src="${A}shop-bg.png" alt=""></div>` +
    `<div class="sp-card">` +
    `<div class="sp-ttl">${esc(SHOP.name)}<span>&lt;${esc(SHOP.where)}&gt;</span></div>` +
    `<div class="closer sp-x" data-hot><img src="assets/codex/icon-close.png" alt=""></div>` +
    `<div class="sp-stalls">${SHOP.stalls.map((s, i) => `<div class="sp-stall" data-s="${i}" data-hot><i class="sq"></i><b>${esc(s.name)}</b></div>`).join('')}</div>` +
    `<div class="sp-hl"></div><div class="sp-grid"></div>` +
    `<div class="sp-pager"><i class="ar l" data-hot></i><span></span><i class="ar r" data-hot></i></div>` +
    `<div class="sp-vl"></div><div class="sp-det"></div></div>`;

  el.addEventListener('click', (e) => {
    const st = e.target.closest('.sp-stall'); if (st) return setStall(+st.dataset.s);
    const t = e.target.closest('.sp-it'); if (t) return setSel(+t.dataset.i);
    const ar = e.target.closest('.sp-pager .ar'); if (ar) return turn(ar.classList.contains('l') ? -1 : 1);
  });
  el.addEventListener('pointerover', (e) => { const t = e.target.closest('.sp-it'); if (t && +t.dataset.i !== sel) window.SFX && window.SFX('tick'); });
  el.addEventListener('wheel', (e) => { if (e.target.closest('.sp-grid')) turn(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!el.classList.contains('on')) return;
    const n = items().length, k = e.key;
    if (k === 'Tab') { e.preventDefault(); e.stopPropagation(); setStall((si + (e.shiftKey ? -1 : 1) + SHOP.stalls.length) % SHOP.stalls.length); }
    else if (k === 'ArrowRight') { e.preventDefault(); sel + 1 < n ? setSel(sel + 1) : turn(1, 'first'); }
    else if (k === 'ArrowLeft') { e.preventDefault(); sel > 0 ? setSel(sel - 1) : turn(-1, 'last'); }
    else if (k === 'ArrowDown') { e.preventDefault(); if (sel + 4 < n) setSel(sel + 4); }
    else if (k === 'ArrowUp') { e.preventDefault(); if (sel >= 4) setSel(sel - 4); }
  }, true);
  render(true);
}

const pages = () => Math.max(1, Math.ceil(SHOP.stalls[si].items.length / PER));
const items = () => SHOP.stalls[si].items.slice(page * PER, page * PER + PER);

function setStall(i) {
  if (i === si) return; si = i; page = 0; sel = 0;
  window.SFX && window.SFX('press'); render();
}
function turn(d, to) {
  const p = page + d; if (p < 0 || p >= pages()) return;
  page = p; sel = to === 'last' ? items().length - 1 : 0;
  window.SFX && window.SFX('tick'); render(false, d);
}
function setSel(i) {
  if (i === sel) return; sel = i;
  el.querySelectorAll('.sp-it').forEach((t) => t.classList.toggle('on', +t.dataset.i === sel));
  window.SFX && window.SFX('tick'); detail();
}

// 当前档口：方块变黄放大（同设置页分类）
function placeInd() {
  el.querySelectorAll('.sp-stall').forEach((r) => r.classList.toggle('on', +r.dataset.s === si));
}

function render(quiet, dir = 0) {
  placeInd(quiet);
  const list = items(), g = $('.sp-grid');
  g.innerHTML = list.map((nm, i) =>
    `<div class="sp-it${i === sel ? ' on' : ''}" data-i="${i}" data-hot><div class="pic"><img src="${A}food.png" alt=""></div><b>${brk(nm)}</b></div>`).join('');
  const P = pages();
  $('.sp-pager span').textContent = `${page + 1} / ${P}`;
  $('.sp-pager').classList.toggle('one', P === 1);
  $('.sp-pager .l').classList.toggle('off', page === 0);
  $('.sp-pager .r').classList.toggle('off', page === P - 1);
  if (!quiet) g.querySelectorAll('.sp-it').forEach((t, i) => t.animate(
    [{ opacity: 0, transform: `translate(${dir * 40}px,${dir ? 0 : 18}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 420, delay: i * 25, easing: GL, fill: 'backwards' }));
  detail(quiet);
}

function detail(quiet) {
  const nm = items()[sel], [kind, txt] = D[nm] || ['', ''];
  const d = $('.sp-det');
  d.innerHTML =
    `<div class="pic"><img src="${A}food.png" alt=""></div>` +
    `<div class="tg">&lt;${esc(kind)}&gt;</div><h2>${esc(nm)}</h2><div class="ln"></div><p>${esc(txt)}</p>`;
  const h = d.querySelector('h2'), L = [...nm].length; if (L * 32 > 380) h.style.fontSize = `${Math.max(22, Math.floor(380 / L))}px`;
  if (quiet) return;
  d.querySelector('.pic').animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 460, easing: GL });
  d.querySelectorAll('.tg,h2,.ln,p').forEach((n, i) => n.animate([{ opacity: 0, transform: 'translateX(24px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 60 + i * 40, easing: GL, fill: 'backwards' }));
}

function enter() {
  const an = (s, kf, o) => el.querySelectorAll(s).forEach((n, i) => n.animate(kf, Object.assign({ easing: GL, fill: 'backwards' }, o, o.stag ? { delay: (o.delay || 0) + i * o.stag } : {})));
  an('.sp-bg', [{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 1200 });
  an('.sp-card', [{ transform: 'translateX(-160px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 300 });
  an('.sp-ttl,.sp-stall', [{ transform: 'translateX(-30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 550, stag: 40 });
  an('.sp-it', [{ transform: 'translateY(18px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 500, delay: 800, stag: 30 });
}

window.Shop = { mount, enter };
})();
