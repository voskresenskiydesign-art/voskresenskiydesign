import { LANGS, LANG_LABELS, UI, icons, loadContent, tr, esc, contactLinks, parseEmbed } from "./core.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const PAGE = 24;

const state = { data: null, lang: "ru", filter: "all", shown: PAGE, list: [], lbIndex: -1 };

/* ——————————————————— boot ——————————————————— */
init();

async function init() {
  try {
    state.data = await loadContent();
  } catch (e) {
    console.error(e);
    return;
  }
  state.lang = pickLang();
  applyTheme();
  injectIcons(document);
  buildLangSwitches();
  renderAll();
  setupNav();
  setupHeroMotion();
  setupLightbox();
  setupMasonryResize();
  $("[data-year]").textContent = new Date().getFullYear();
  setupNoise();
  requestAnimationFrame(() => document.documentElement.classList.add("is-ready"));
}

/* ——— мелкий анимированный шум поверх всего сайта ——— */
function setupNoise() {
  const el = $("[data-noise]");
  if (!el) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const size = 256, FRAMES = 8, FPS = 12;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  // несколько независимых кадров шума; слой стоит на месте, меняется только зерно
  const frames = Array.from({ length: FRAMES }, () => {
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return `url(${c.toDataURL("image/png")})`;
  });
  // 2 пикселя шума на 1 физический пиксель экрана: браузер усредняет их → зерно мельче пикселя
  el.style.backgroundSize = `${size / (dpr * 2)}px ${size / (dpr * 2)}px`;
  el.style.backgroundImage = frames[0];
  if (reduceMotion) return;
  let k = 0, timer = 0;
  const tick = () => { k = (k + 1) % FRAMES; el.style.backgroundImage = frames[k]; };
  const play = () => { if (!timer) timer = setInterval(tick, 1000 / FPS); };
  const stop = () => { clearInterval(timer); timer = 0; };
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : play()));
  play();
}

function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) return q;
  try { const saved = localStorage.getItem("vd-lang"); if (LANGS.includes(saved)) return saved; } catch {}
  const nav = (navigator.language || "").slice(0, 2);
  if (nav === "uz") return "uz";
  if (nav === "en") return "en";
  return state.data?.settings?.defaultLang || "ru";
}

function applyTheme() {
  const s = state.data.settings || {};
  const root = document.documentElement.style;
  if (s.accentA) root.setProperty("--a", s.accentA);
  if (s.accentB) root.setProperty("--b", s.accentB);
  if (s.accentC) root.setProperty("--bg", s.accentC);
}

function injectIcons(scope) {
  $$("i[data-icon]", scope).forEach((el) => { if (!el.firstChild) el.innerHTML = icons[el.dataset.icon] || ""; });
}

/* ——————————————————— render ——————————————————— */
function renderAll() {
  renderTexts();
  renderHero();
  renderStatus();
  renderSocials();
  renderFilters();
  renderWorks(true);
  renderStats();
  renderSkills();
  renderRoles();
  renderClients();
  renderContact();
  renderCV();
  observeReveals();
}

function t(key) { return tr(UI[key], state.lang); }

function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }

function renderTexts() {
  const d = state.data, L = state.lang;
  document.documentElement.lang = L;
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const v = key === "brand" ? d.settings.brand : key === "brandSuffix" ? d.settings.brandSuffix : getPath(d, key);
    el.textContent = tr(v, L);
  });
  const seo = d.settings.seo || {};
  if (seo.title) document.title = tr(seo.title, L);
  if (seo.description) $('meta[name="description"]').setAttribute("content", tr(seo.description, L));
  $$("[data-lang-switch]").forEach(syncLangSwitch);
}

/* ——— статус: «Работаю» / «Отдыхаю» — векторные зацикленные иконки ——— */
const STATUS_SVG = {
  // человечек лежит на спине, нога на колене покачивается, над головой всплывают Z
  rest: `<svg class="st st--rest" viewBox="0 0 72 44" aria-hidden="true">
    <path class="st__ground" d="M4 37.5h64"/>
    <path class="st__pillow" d="M5 36.5c0-3.2 2.6-5 6.4-5h5.2c2.6 0 4 1.5 4 3.4v1.6"/>
    <path d="M20.5 32.2L10.4 20.6l2.6 6.6"/>
    <circle class="st__head" cx="13" cy="27.5" r="4.6"/>
    <path d="M17.6 32.2h20.2"/>
    <path d="M37.8 32.2l7.4-10.4 6.6 15.4"/>
    <g class="st__leg"><path d="M45.2 21.8l13.4-2.2"/><path d="M58.6 19.6l2.4-3.6"/></g>
    <g class="st__z">
      <text class="z z1" x="19" y="21">z</text>
      <text class="z z2" x="24" y="15">z</text>
      <text class="z z3" x="30" y="9">Z</text>
    </g>
  </svg>`,
  // человечек в наушниках за ноутбуком: качает головой в ритм, печатает, экран мигает курсором
  work: `<svg class="st st--work" viewBox="0 0 72 44" aria-hidden="true">
    <g class="st__headset">
      <circle class="st__head" cx="36" cy="13" r="5.6"/>
      <path class="st__phones" d="M29.4 13.4a6.6 6.6 0 0 1 13.2 0"/>
      <rect class="st__cup" x="27.6" y="12" width="3.2" height="5" rx="1.4"/>
      <rect class="st__cup" x="41.2" y="12" width="3.2" height="5" rx="1.4"/>
    </g>
    <path d="M24 33c.6-7.6 5.2-11.6 12-11.6S47.4 25.4 48 33"/>
    <g class="st__arm st__arm--l"><path d="M25.6 26.6l-4.2 7.4"/></g>
    <g class="st__arm st__arm--r"><path d="M46.4 26.6l4.2 7.4"/></g>
    <rect class="st__lid" x="22" y="22.5" width="28" height="13.5" rx="2.2"/>
    <circle class="st__logo" cx="36" cy="29.2" r="1.7"/>
    <path d="M14 37.5h44"/>
    <g class="st__code">
      <text class="c c1" x="52" y="17">&lt;/&gt;</text>
      <text class="c c2" x="10" y="19">{ }</text>
    </g>
  </svg>`,
};

function currentMode() {
  const m = state.data.hero.mode || "work";
  if (m !== "auto") return m;
  // авто: рабочее время по Ташкенту (UTC+5), пн–сб 10:00–20:00
  const now = new Date(Date.now() + 5 * 3600e3 + new Date().getTimezoneOffset() * 60e3);
  const h = now.getHours(), d = now.getDay();
  return d !== 0 && h >= 10 && h < 20 ? "work" : "rest";
}

function renderStatus() {
  const el = $("[data-status]"); if (!el) return;
  const mode = currentMode();
  el.dataset.mode = mode;
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", t(`status.${mode}`));
  el.title = t(`status.${mode}`);
  el.innerHTML = `${STATUS_SVG[mode]}<span class="status__cap"><i class="status__dot"></i>${mode === "work" ? "Online" : "Offline"}</span>`;
}

function renderHero() {
  const h = state.data.hero, L = state.lang;
  const title = tr(h.title, L), hl = tr(h.highlight, L).trim();
  const hlWords = hl ? hl.split(/\s+/).map((x) => x.replace(/[.,!?…:;«»"]/g, "").toLowerCase()) : [];
  const el = $("[data-hero-title]");
  el.innerHTML = title.split(/\n/).map((line) => line.trim().split(/\s+/).filter(Boolean).map((w) => {
    const clean = w.replace(/[.,!?…:;«»"]/g, "").toLowerCase();
    return `<span class="w${hlWords.includes(clean) ? " hl" : ""}">${esc(w)}</span>`;
  }).join(" ")).join("<br>");

  // staged intro (only once)
  if (!el.dataset.revealed) {
    const seq = [$(".status"), $(".hero__eyebrow"), el, $(".hero__sub"), $(".hero__actions")];
    seq.forEach((n, i) => { n.classList.add("reveal-in"); n.style.setProperty("--d", `${120 + i * 90}ms`); });
    el.dataset.revealed = "1";
  }

  const cover = state.data.settings.cover || {};
  const media = $("[data-hero-media]");
  if (media.dataset.src !== (cover.url || "")) {
    media.dataset.src = cover.url || "";
    if (cover.type === "image" && cover.url) {
      media.innerHTML = `<img src="${esc(cover.url)}" alt="" fetchpriority="high">`;
    } else if (cover.type === "video" && cover.url) {
      media.innerHTML = `<video src="${esc(cover.url)}" ${cover.poster ? `poster="${esc(cover.poster)}"` : ""} autoplay muted loop playsinline></video>`;
    } else media.innerHTML = "";
  }
}

function buildLangSwitches() {
  $$("[data-lang-switch]").forEach((box) => {
    box.innerHTML = `<span class="lang__thumb" aria-hidden="true"></span>` +
      LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="false">${LANG_LABELS[l]}</button>`).join("");
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-lang]");
      if (!b || b.dataset.lang === state.lang) return;
      setLang(b.dataset.lang);
    });
  });
}

function syncLangSwitch(box) {
  const btns = $$("button", box);
  btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === state.lang)));
  const active = btns.find((b) => b.dataset.lang === state.lang);
  const thumb = $(".lang__thumb", box);
  if (active && thumb && active.offsetWidth) {
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
  }
}

function setLang(l) {
  state.lang = l;
  try { localStorage.setItem("vd-lang", l); } catch {}
  const url = new URL(location.href); url.searchParams.set("lang", l); history.replaceState(null, "", url);
  renderTexts();
  renderHero();
  renderFilters();
  renderWorks(false);
  renderStats();
  renderSkills();
  renderRoles();
  renderContact();
  renderStatus();
  moveNavPill();
}

function renderSocials() {
  const links = contactLinks(state.data.contacts);
  const html = ["telegram", "instagram", "phone"].filter((k) => links[k]).map((k) =>
    `<a class="social social--${k}" href="${esc(links[k].href)}" ${k !== "phone" ? 'target="_blank" rel="noopener"' : ""} aria-label="${k} ${esc(links[k].label)}">${icons[k]}</a>`
  ).join("");
  $$("[data-socials]").forEach((el) => { el.innerHTML = html; });
}

/* ——— works ——— */
function publishedWorks() { return (state.data.works || []).filter((w) => w.published !== false); }

function renderFilters() {
  const box = $("[data-filters]");
  const works = publishedWorks();
  const cats = (state.data.categories || []).filter((c) => works.some((w) => w.category === c.id));
  const items = [{ id: "all", label: t("works.all"), n: works.length }, ...cats.map((c) => ({ id: c.id, label: tr(c.label, state.lang), n: works.filter((w) => w.category === c.id).length }))];
  if (!items.some((i) => i.id === state.filter)) state.filter = "all";
  box.innerHTML = `<span class="filters__thumb" aria-hidden="true"></span>` + items.map((i) =>
    `<button type="button" role="tab" data-filter="${esc(i.id)}" aria-selected="${i.id === state.filter}">${esc(i.label)}<sup>${i.n}</sup></button>`
  ).join("");
  if (!box.dataset.bound) {
    box.dataset.bound = "1";
    box.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-filter]");
      if (!b || b.dataset.filter === state.filter) return;
      state.filter = b.dataset.filter;
      state.shown = PAGE;
      $$("button", box).forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      moveFilterThumb();
      b.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
      renderWorks(true);
    });
  }
  requestAnimationFrame(moveFilterThumb);
}

function moveFilterThumb() {
  const box = $("[data-filters]");
  const active = $('button[aria-selected="true"]', box);
  const thumb = $(".filters__thumb", box);
  if (!active || !thumb) return;
  thumb.style.width = `${active.offsetWidth}px`;
  thumb.style.transform = `translateX(${active.offsetLeft - 4}px)`;
  thumb.style.left = "4px";
}

function catLabel(id) { return tr((state.data.categories || []).find((c) => c.id === id)?.label, state.lang) || id || ""; }

function ratioOf(w) {
  const [a, b] = String(w.ratio || "4/5").split("/").map(Number);
  return a > 0 && b > 0 ? a / b : 0.8;
}

function columnsFor(width) {
  if (width < 560) return 2;
  if (width < 1000) return 3;
  if (width < 1500) return 4;
  return 5;
}

function tileHTML(w, i) {
  const title = tr(w.title, state.lang);
  let media = "";
  let badge = "";
  if (w.type === "image" && w.src) {
    media = `<img src="${esc(w.src)}" alt="${esc(title)}" loading="lazy" decoding="async">`;
  } else if (w.type === "video" && w.src) {
    // в сетке — лёгкий беззвучный превью-клип; полный ролик грузится только в просмотрщике
    // отрезок цикла задаётся в админке (w.loop). Если лёгкий превью-файл уже нарезан под этот отрезок — берём его,
    // иначе крутим выбранный кусок прямо из полного ролика.
    const lp = w.loop, fresh = w.preview && (!lp || w.previewFor === `${lp.start}-${lp.end}`);
    const s0 = lp ? +lp.start || 0 : 0, e0 = lp ? +lp.end || s0 + 5 : 5;
    media = fresh
      ? `<video src="${esc(w.preview)}" ${w.poster ? `poster="${esc(w.poster)}"` : ""} muted loop autoplay playsinline preload="none"></video>`
      : `<video src="${esc(`${w.src}#t=${s0}`)}" data-ls="${s0}" data-le="${e0}" ${w.poster ? `poster="${esc(w.poster)}"` : ""} muted autoplay playsinline preload="none"></video>`;
    badge = `<span class="tile__badge">${icons.play}</span>`;
  } else if (w.type === "embed") {
    const em = parseEmbed(w.src || "");
    const poster = w.poster || em?.thumb;
    media = poster ? `<img src="${esc(poster)}" alt="${esc(title)}" loading="lazy" decoding="async">` : demoHTML(w);
    badge = `<span class="tile__badge">${icons.play}</span>`;
  } else {
    media = demoHTML(w);
  }
  return `<article class="tile is-entering" tabindex="0" role="button" data-index="${i}" style="--ratio:${esc(String(w.ratio || "4/5").replace("/", " / "))}" aria-label="${esc(title)}">
    <div class="tile__media">${media}</div>${badge}
    <div class="tile__info"><div><span class="tile__cat">${esc(catLabel(w.category))}</span><h3 class="tile__title">${esc(title)}</h3></div><span class="tile__go">${icons.arrowUpRight}</span></div>
  </article>`;
}

function demoHTML(w) {
  const p = w.palette || ["#7B5CFF", "#FF5C8A", "#120A24"];
  return `<div class="demo demo--${esc(w.shape || "sphere")}" style="--p0:${esc(p[0])};--p1:${esc(p[1])};--p2:${esc(p[2])}"><span class="demo__label">Demo</span><span class="demo__shape"></span></div>`;
}

let currentCols = 0;
function renderWorks(animate) {
  const all = publishedWorks();
  state.list = state.filter === "all" ? all : all.filter((w) => w.category === state.filter);
  const list = state.list.slice(0, state.shown);
  const host = $("[data-masonry]");
  const cols = columnsFor(host.clientWidth || window.innerWidth);
  currentCols = cols;
  host.style.setProperty("--mgap", window.innerWidth < 560 ? "10px" : "16px");

  const colEls = Array.from({ length: cols }, () => { const c = document.createElement("div"); c.className = "masonry__col"; return c; });
  const heights = new Array(cols).fill(0);
  const frag = document.createDocumentFragment();
  list.forEach((w, i) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = tileHTML(w, i);
    const tile = tmp.firstElementChild;
    let k = 0;
    for (let j = 1; j < cols; j++) if (heights[j] < heights[k] - 0.02) k = j;
    colEls[k].appendChild(tile);
    heights[k] += 1 / ratioOf(w);
    if (!animate) tile.classList.remove("is-entering");
  });
  colEls.forEach((c) => frag.appendChild(c));
  host.replaceChildren(frag);

  $("[data-works-empty]").hidden = list.length > 0;
  const more = $("[data-more]");
  more.hidden = state.list.length <= state.shown;
  more.onclick = () => { state.shown += PAGE; renderWorks(true); };

  wireTiles(host, animate);
}

/** крутит только отрезок [s, e] ролика — точно по кадрам, где браузер это умеет */
function segmentLoop(v, s, e) {
  const guard = () => { if (v.currentTime >= e - 0.03 || v.currentTime < s - 0.15) v.currentTime = s; };
  // покадрово, где умеет браузер; timeupdate — подстраховка (фоновые вкладки, старые браузеры)
  if ("requestVideoFrameCallback" in v) { const f = () => { guard(); v.requestVideoFrameCallback(f); }; v.requestVideoFrameCallback(f); }
  v.addEventListener("timeupdate", guard);
  v.addEventListener("ended", () => { v.currentTime = s; v.play().catch(() => {}); });
}

function wireTiles(host, animate) {
  const tiles = $$(".tile", host);
  tiles.forEach((tile) => {
    const img = $(".tile__media img", tile);
    if (img) { if (img.complete) img.classList.add("is-loaded"); else img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true }); }
  });

  // entrance: stagger by visual order within viewport
  if (animate) {
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.filter((e) => e.isIntersecting).forEach((e) => {
        const el = e.target;
        el.style.setProperty("--d", `${Math.min(n++ * 45, 360)}ms`);
        el.classList.add("is-in");
        el.addEventListener("transitionend", () => { el.classList.remove("is-entering", "is-in"); el.style.removeProperty("--d"); }, { once: true });
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    tiles.forEach((t) => io.observe(t));
  }

  // видео в сетке играют сами по кругу, пока плитка на экране; вне экрана — пауза (экономим CPU/трафик)
  const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = $("video", e.target); if (!v) return;
    if (e.isIntersecting) v.play().then(() => e.target.classList.add("is-playing")).catch(() => {});
    else v.pause();
  }), { rootMargin: "200px 0px", threshold: 0 });
  tiles.forEach((t) => $("video", t) && vio.observe(t));
  tiles.forEach((t) => { const v = $("video[data-le]", t); if (v) segmentLoop(v, +v.dataset.ls, +v.dataset.le); });
}

function setupMasonryResize() {
  const host = $("[data-masonry]");
  host.addEventListener("click", (e) => { const tile = e.target.closest(".tile"); if (tile) openLightbox(+tile.dataset.index, tile); });
  host.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("tile")) { e.preventDefault(); openLightbox(+e.target.dataset.index, e.target); }
  });
  let raf;
  new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      if (columnsFor(host.clientWidth) !== currentCols) renderWorks(false);
      moveFilterThumb();
      $$("[data-lang-switch]").forEach(syncLangSwitch);
      moveNavPill();
    });
  }).observe(host);
}

/* ——— about / skills / clients / contact ——— */
function renderStats() {
  $("[data-stats]").innerHTML = (state.data.stats || []).map((s) =>
    `<div class="stat"><dt>${esc(s.value)}</dt><dd>${esc(tr(s.label, state.lang))}</dd></div>`).join("");
}

function renderSkills() {
  $("[data-skills]").innerHTML = (state.data.skills || []).map((s, i) => {
    const grad = Array.isArray(s.grad) && s.grad.length > 1 ? `linear-gradient(120deg, ${s.grad.join(",")})` : "";
    const glow = s.fg || "#7B5CFF";
    const iconInner = s.icon
      ? `<img src="${esc(s.icon)}" alt="" loading="lazy">`
      : `<span>${esc(s.mono || s.name.slice(0, 2))}</span>`;
    return `<li class="skill reveal" style="--d:${(i % 8) * 40}ms;--bg-c:${esc(s.bg || "#111")};--fg-c:${esc(s.fg || "#fff")};--glow:${esc(glow)};${grad ? `--fg-grad:${grad}` : ""}">
      <span class="skill__icon${grad ? " is-grad" : ""}${s.icon ? " has-img" : ""}" data-len="${(s.mono || "").length}" aria-hidden="true">${iconInner}</span>
      <div><h3 class="skill__name">${esc(s.name)}</h3><p class="skill__desc">${esc(tr(s.desc, state.lang))}</p></div>
    </li>`;
  }).join("");
  observeReveals();
}

/* ——— роли: пайплайн «бренд → направления → задачи» ——— */
function renderRoles() {
  const host = $("[data-roles]"); if (!host) return;
  const roles = (state.data.roles || []).filter((r) => (r.tasks || []).length || tr(r.title, state.lang));
  host.closest("section").hidden = !roles.length;
  host.style.setProperty("--n", roles.length || 1);
  const L = state.lang;
  host.innerHTML = `
    <div class="pipe__hub reveal"><span class="pipe__pulse" aria-hidden="true"></span><b>${esc(state.data.settings.brand || "Voskresenskiy")}</b><small>${esc(t("roles.hub"))}</small></div>
    <div class="pipe__bus" aria-hidden="true"><i></i></div>
    <ol class="pipe__grid">${roles.map((r, i) => `
      <li class="pipe__col" style="--i:${i}">
        <div class="pipe__role reveal" style="--d:${120 + i * 90}ms">
          <span class="pipe__icon" aria-hidden="true">${esc(r.mono || tr(r.title, L).slice(0, 2))}</span>
          <div><small>${String(i + 1).padStart(2, "0")}</small><h3>${esc(tr(r.title, L))}</h3></div>
        </div>
        <ol class="pipe__tasks">${(r.tasks || []).map((tk, j) => `
          <li class="pipe__task reveal" style="--d:${220 + i * 90 + j * 70}ms;--j:${j}"><i class="pipe__node" aria-hidden="true"></i><span>${esc(tr(tk, L))}</span></li>`).join("")}
        </ol>
      </li>`).join("")}
    </ol>`;
  observeReveals();
}

function renderClients() {
  const clients = state.data.clients || [];
  const count = state.data.settings.clientsCount || "150+";
  $("[data-clients-count]").textContent = count;
  if (!clients.length) { $("[data-marquee]").innerHTML = ""; return; }
  // three rows, items dealt round-robin so every row gets a mix
  const nRows = clients.length >= 9 ? 3 : clients.length >= 4 ? 2 : 1;
  const rows = Array.from({ length: nRows }, (_, r) => clients.filter((_, i) => i % nRows === r));
  const card = (c) => `<div class="logo-card" title="${esc(c.name)}">${c.logo ? `<img src="${esc(c.logo)}" alt="${esc(c.name)}" loading="lazy">` : `<span>${esc(c.name)}</span>`}</div>`;
  $("[data-marquee]").innerHTML = rows.map((row) => {
    // repeat until the track is comfortably wider than any screen, then duplicate for a seamless loop
    let seq = [...row];
    while (seq.length < 12) seq = seq.concat(row);
    const html = seq.map(card).join("");
    return `<div class="marquee__row" style="--dur:${Math.max(40, seq.length * 5)}s">${html}${html.replace(/class="logo-card"/g, 'class="logo-card" aria-hidden="true"')}</div>`;
  }).join("");
}

function renderCV() {
  const url = (state.data.settings.cv || "").trim();
  $$("[data-cv]").forEach((a) => {
    a.hidden = !url;
    if (!url) return;
    a.href = url;
    const local = !/^https?:/i.test(url) || url.startsWith(location.origin);
    if (local) { a.setAttribute("download", "CV_Voskresenskiy.pdf"); a.target = ""; }
    else { a.download = ""; a.target = "_blank"; a.rel = "noopener"; }
  });
}

function renderContact() {
  const links = contactLinks(state.data.contacts);
  const keys = ["telegram", "instagram", "phone", "email"].filter((k) => links[k]);
  $("[data-contact-links]").innerHTML = keys.map((k) =>
    `<a class="contact-link social--${k}" href="${esc(links[k].href)}" ${k === "telegram" || k === "instagram" ? 'target="_blank" rel="noopener"' : ""}>
      <span class="contact-link__ic">${icons[k]}</span>
      <span class="contact-link__txt"><small>${esc(t(`contact.${k}`))}</small><b>${esc(links[k].label)}</b></span>
      <span class="contact-link__go">${icons.arrowUpRight}</span>
    </a>`).join("");
}

/* ——————————————————— reveal on scroll ——————————————————— */
let revealIO;
function observeReveals() {
  revealIO ||= new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-visible"); revealIO.unobserve(e.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  $$(".reveal:not(.is-visible)").forEach((el) => revealIO.observe(el));
}
// static section heads get the same treatment
$$(".section-head, .about__title, .about__grid > div, .clients__head, .contact__card > *:not(.grain):not(.contact__glow)").forEach((el, i) => {
  el.classList.add("reveal");
});

/* ——————————————————— nav ——————————————————— */
function setupNav() {
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  // burger sheet
  const sheet = $("#sheet"), burger = $("[data-burger]");
  const setOpen = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    if (open) {
      sheet.hidden = false;
      sheet.dataset.state = "closed";
      requestAnimationFrame(() => { sheet.dataset.state = "open"; $$("[data-lang-switch]", sheet).forEach(syncLangSwitch); });
    } else {
      sheet.dataset.state = "closed";
      setTimeout(() => { if (sheet.dataset.state === "closed") sheet.hidden = true; }, 260);
    }
  };
  burger.addEventListener("click", () => setOpen(burger.getAttribute("aria-expanded") !== "true"));
  sheet.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) setOpen(false); });

  // active section indicator
  const links = $$(".nav__links a");
  const sections = links.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`)); moveNavPill(); } });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => io.observe(s));
  const top = new IntersectionObserver(([e]) => { if (e.isIntersecting) { links.forEach((a) => a.classList.remove("is-active")); moveNavPill(); } }, { rootMargin: "-45% 0px -50% 0px" });
  top.observe($("#top"));
  const contact = new IntersectionObserver(([e]) => { if (e.isIntersecting) { links.forEach((a) => a.classList.remove("is-active")); moveNavPill(); } }, { rootMargin: "-45% 0px -50% 0px" });
  contact.observe($("#contact"));
}

function moveNavPill() {
  const pill = $(".nav__pill");
  const a = $(".nav__links a.is-active");
  if (!pill) return;
  if (!a) { pill.style.opacity = "0"; return; }
  pill.style.opacity = "1";
  pill.style.width = `${a.offsetWidth}px`;
  pill.style.transform = `translateX(${a.offsetLeft}px)`;
}

/* ——————————————————— hero pointer motion (spring-damped) ——————————————————— */
function setupHeroMotion() {
  if (reduceMotion || !finePointer) return;
  const stage = $(".hero__stage"), mesh = $("[data-mesh] .glow");
  let tx = 0, ty = 0, x = 0, y = 0, vx = 0, vy = 0, running = false, visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(stage);
  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
    if (!running) { running = true; requestAnimationFrame(step); }
  });
  stage.addEventListener("pointerleave", () => { tx = 0; ty = 0; });
  // critically-damped spring (ζ≈1, response≈0.6s)
  const k = 110, c = 2 * Math.sqrt(k);
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    vx += (k * (tx - x) - c * vx) * dt; x += vx * dt;
    vy += (k * (ty - y) - c * vy) * dt; y += vy * dt;
    if (visible) {
      mesh.style.transform = `translate3d(${x * 60}px, ${y * 40}px, 0)`;
    }
    if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > 0.0005) requestAnimationFrame(step);
    else running = false;
  }
}

/* ——————————————————— lightbox ——————————————————— */
let lbReturnFocus = null;
function setupLightbox() {
  const lb = $("[data-lightbox]");
  $$("[data-lb-close]", lb).forEach((b) => b.addEventListener("click", closeLightbox));
  $("[data-lb-prev]", lb).addEventListener("click", () => stepLightbox(-1));
  $("[data-lb-next]", lb).addEventListener("click", () => stepLightbox(1));
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowRight") stepLightbox(1);
    else if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "Tab") trapFocus(e, lb);
  });

  // swipe: 1:1 tracking, commit by distance or velocity
  const media = $("[data-lb-media]", lb);
  let sx = 0, dx = 0, st = 0, dragging = false, target = null;
  media.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || state.list[state.lbIndex]?.type === "embed") return;
    dragging = true; sx = e.clientX; dx = 0; st = performance.now();
    target = media.firstElementChild; media.setPointerCapture(e.pointerId);
    if (target) target.style.transition = "none";
  });
  media.addEventListener("pointermove", (e) => {
    if (!dragging || !target) return;
    dx = e.clientX - sx;
    target.style.transform = `translateX(${dx}px)`;
    target.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.5));
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    const v = Math.abs(dx) / (performance.now() - st);
    if (target) { target.style.transition = ""; target.style.transform = ""; target.style.opacity = ""; }
    if (Math.abs(dx) > 70 || (v > 0.45 && Math.abs(dx) > 16)) stepLightbox(dx < 0 ? 1 : -1);
  };
  media.addEventListener("pointerup", end);
  media.addEventListener("pointercancel", end);
}

function openLightbox(i, from) {
  const lb = $("[data-lightbox]");
  lbReturnFocus = from || document.activeElement;
  state.lbIndex = i;
  fillLightbox(false);
  lb.hidden = false;
  document.body.classList.add("is-locked");
  requestAnimationFrame(() => requestAnimationFrame(() => lb.classList.add("is-open")));
  $(".lightbox__close", lb).focus({ preventScroll: true });
}

function closeLightbox() {
  const lb = $("[data-lightbox]");
  lb.classList.remove("is-open");
  document.body.classList.remove("is-locked");
  const media = $("[data-lb-media]", lb);
  setTimeout(() => { if (!lb.classList.contains("is-open")) { lb.hidden = true; media.innerHTML = ""; } }, 200);
  lbReturnFocus?.focus?.({ preventScroll: true });
}

function stepLightbox(dir) {
  const n = state.list.length;
  if (n < 2) return;
  state.lbIndex = (state.lbIndex + dir + n) % n;
  if (state.lbIndex >= state.shown) { state.shown = state.lbIndex + 1; renderWorks(false); }
  fillLightbox(true);
}

function fillLightbox(swap) {
  const lb = $("[data-lightbox]");
  const w = state.list[state.lbIndex];
  if (!w) return;
  const L = state.lang;
  const media = $("[data-lb-media]", lb);
  const write = () => {
    const title = tr(w.title, L);
    if (w.type === "image" && w.src) media.innerHTML = `<img src="${esc(w.full || w.src)}" alt="${esc(title)}">`;
    else if (w.type === "video" && w.src) media.innerHTML = `<video src="${esc(w.src)}" ${w.poster ? `poster="${esc(w.poster)}"` : ""} controls autoplay playsinline loop></video>`;
    else if (w.type === "embed" && parseEmbed(w.src)) media.innerHTML = `<iframe src="${esc(parseEmbed(w.src).embed)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="${esc(title)}"></iframe>`;
    else media.innerHTML = demoHTML(w).replace('class="demo', `style="--ratio:${esc(String(w.ratio || "4/5").replace("/", " / "))}" class="demo`);
    media.classList.remove("is-swapping");
  };
  if (swap && !reduceMotion) { media.classList.add("is-swapping"); setTimeout(write, 180); } else write();

  $("[data-lb-cat]", lb).textContent = catLabel(w.category);
  $("[data-lb-title]", lb).textContent = tr(w.title, L);
  $("[data-lb-desc]", lb).textContent = tr(w.desc, L);
  const meta = [[t("lb.client"), w.client], [t("lb.year"), w.year], [t("lb.category"), catLabel(w.category)]].filter(([, v]) => v);
  $("[data-lb-meta]", lb).innerHTML = meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  $("[data-lb-count]", lb).textContent = `${state.lbIndex + 1} / ${state.list.length}`;
  $(".lightbox__close", lb).setAttribute("aria-label", t("lb.close"));
}

function trapFocus(e, root) {
  const f = $$('button, [href], video, iframe, [tabindex]:not([tabindex="-1"])', root).filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
