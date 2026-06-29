/* ============================================================
   PERFUMES ORIGINALES — app.js
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SITE_CONFIG || {};
  const ALL = (window.CATALOG && window.CATALOG.products) || [];
  // productos ocultos desde el panel admin (visible === false) no se muestran
  const DATA = ALL.filter(p => p.visible !== false);
  const IMG = "assets/products/";
  const FAV_KEY = "po_favs";
  const THEME_KEY = "po_theme";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const norm = (s) => (s || "").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");

  // ---------- favorites ----------
  let favs = [];
  try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch (e) { favs = []; }
  const isFav = (id) => favs.includes(id);
  function toggleFav(id, name) {
    const i = favs.indexOf(id);
    if (i >= 0) { favs.splice(i, 1); toast("Quitado de favoritos"); }
    else { favs.push(id); toast("<b>♥</b> Añadido a favoritos"); }
    try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch (e) {}
    updateFavBadge(); syncFavButtons(id);
  }
  function updateFavBadge() {
    const b = $("#favBadge");
    b.textContent = favs.length;
    b.classList.toggle("show", favs.length > 0);
  }
  function syncFavButtons(id) {
    $$(`.fav-btn[data-id="${id}"]`).forEach(btn => btn.classList.toggle("active", isFav(id)));
  }

  // ---------- price ----------
  function fmtPrice(v) {
    if (v == null || v === "") return null;
    try {
      return new Intl.NumberFormat(CFG.currencyLocale || "es-CO", {
        style: "currency", currency: CFG.currency || "COP", maximumFractionDigits: 0
      }).format(v);
    } catch (e) { return "$" + v; }
  }

  // ---------- whatsapp ----------
  function waLink(text) {
    const n = (CFG.whatsapp || "").replace(/\D/g, "");
    return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
  }
  function waProduct(p, intent) {
    const price = fmtPrice(p.price) || CFG.pricePlaceholder || "Consultar";
    const present = `${p.size_ml} ml · ${p.concentration}`;
    const verb = intent === "buy" ? "comprar" : intent === "quote" ? "cotizar" : "consultar disponibilidad de";
    return waLink(
      `Hola 👋, quiero ${verb}:\n\n` +
      `*${p.brand} — ${p.name}*\n` +
      `Presentación: ${present}\n` +
      `Precio: ${price}\n` +
      `Código: ${p.sku}\n\n` +
      `¿Está disponible?`
    );
  }

  // ---------- toast ----------
  let toastT;
  function toast(html) {
    const t = $("#toast"); t.innerHTML = html; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- icons ----------
  const heartSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  const waSVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.512 5.26l-.999 3.648 3.985-1.052zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.017-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>';

  // ---------- state ----------
  const state = { search: "", sort: "relevance", filters: { brand: [], gender: [], family: [], tags: [] } };

  // ---------- config-driven text ----------
  function applyConfig() {
    $("#topbar").textContent = CFG.topBar || "";
    if (!CFG.topBar) $("#topbar").style.display = "none";
    if (CFG.tagline) $("#heroTag").textContent = CFG.tagline;
    $("#year").textContent = new Date().getFullYear();
    $("#statProducts").textContent = DATA.length;
    $("#statBrands").textContent = new Set(DATA.map(p => p.brand)).size;
    const loc = $("#footLoc"); if (CFG.location) loc.textContent = CFG.location; else loc.style.display = "none";
    [["#heroWa","¡Hola! Quiero ver el catálogo de perfumes 🌟"],
     ["#ctaWa","¡Hola! Quiero asesoría para elegir un perfume ✨"],
     ["#footWa","Hola, vengo del catálogo 👋"],
     ["#waFloat","¡Hola! Estoy viendo el catálogo de perfumes y quiero más información 🙂"]]
      .forEach(([sel, msg]) => { const el = $(sel); if (el) el.href = waLink(msg); });
  }

  // ---------- hero art ----------
  function renderHero() {
    const withImg = DATA.filter(p => p.photos && p.photos.length);
    const picks = [withImg[0], withImg[3] || withImg[1], withImg[5] || withImg[2]].filter(Boolean);
    $("#heroArt").innerHTML = picks.map((p, i) =>
      `<div class="bottle-card c${i + 1}" data-open="${p.id}" style="cursor:pointer">
        <img src="${IMG}${p.photos[0]}" alt="${p.name}" loading="lazy"><div class="glow"></div></div>`
    ).join("");
  }

  // ---------- categories ----------
  const CATS = [
    { key: "gender", val: "Hombre", ic: "♂", sub: "Fragancias masculinas" },
    { key: "gender", val: "Mujer", ic: "♀", sub: "Fragancias femeninas" },
    { key: "gender", val: "Unisex", ic: "⚲", sub: "Para todos" },
    { key: "tags", val: "Árabes", ic: "✦", sub: "Esencias de oriente" },
    { key: "tags", val: "Nicho", ic: "◆", sub: "Perfumería de autor" },
    { key: "tags", val: "Premium", ic: "★", sub: "Selección exclusiva" },
    { key: "tags", val: "Nuevos", ic: "✷", sub: "Recién llegados" },
    { key: "tags", val: "Más vendidos", ic: "♛", sub: "Los favoritos" },
  ];
  function renderCats() {
    $("#catsGrid").innerHTML = CATS.map(c => {
      const n = DATA.filter(p => c.key === "gender" ? p.gender === c.val : (p.tags || []).includes(c.val)).length;
      if (!n) return "";
      return `<div class="cat reveal" data-cat-key="${c.key}" data-cat-val="${c.val}">
        <span class="ic">${c.ic}</span><h3>${c.val}</h3><span>${n} ${n === 1 ? "perfume" : "perfumes"}</span></div>`;
    }).join("");
  }

  // ---------- brands ----------
  function renderBrands() {
    const brands = {};
    DATA.forEach(p => { (brands[p.brand] = brands[p.brand] || []).push(p); });
    $("#brandsGrid").innerHTML = Object.entries(brands).map(([b, list]) =>
      `<div class="cat reveal" data-cat-key="brand" data-cat-val="${b}">
        <span class="ic">✦</span><h3>${b}</h3><span>${list.length} referencias</span></div>`
    ).join("");
  }

  // ---------- filter groups ----------
  function buildFilters() {
    const groups = [
      { key: "brand", title: "Marca", values: uniq(p => [p.brand]) },
      { key: "gender", title: "Género", values: uniq(p => [p.gender]) },
      { key: "family", title: "Familia olfativa", values: uniq(p => [p.family]) },
      { key: "tags", title: "Colección", values: uniq(p => p.tags || []) },
    ];
    $("#filterGroups").innerHTML = groups.map(g => `<h4>${g.title}</h4>` + g.values.map(([v, n]) =>
      `<label class="fitem"><input type="checkbox" data-fkey="${g.key}" value="${v}">
        <span>${v}</span><span class="count">${n}</span></label>`).join("")).join("");
    $$("#filterGroups input").forEach(inp => inp.addEventListener("change", () => {
      const k = inp.dataset.fkey, v = inp.value, arr = state.filters[k];
      if (inp.checked) arr.push(v); else arr.splice(arr.indexOf(v), 1);
      render();
    }));
  }
  function uniq(fn) {
    const m = {};
    DATA.forEach(p => fn(p).forEach(v => { if (v) m[v] = (m[v] || 0) + 1; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }

  // ---------- filtering + sorting ----------
  function getFiltered() {
    const q = norm(state.search);
    let list = DATA.filter(p => {
      const f = state.filters;
      if (f.brand.length && !f.brand.includes(p.brand)) return false;
      if (f.gender.length && !f.gender.includes(p.gender)) return false;
      if (f.family.length && !f.family.includes(p.family)) return false;
      if (f.tags.length && !f.tags.some(t => (p.tags || []).includes(t))) return false;
      if (q) {
        const hay = norm([p.name, p.brand, p.family, p.gender,
          ...(p.notes_top || []), ...(p.notes_heart || []), ...(p.notes_base || []),
          ...(p.tags || [])].join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const s = state.sort;
    list.sort((a, b) => {
      if (s === "name") return a.name.localeCompare(b.name);
      if (s === "brand") return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
      if (s === "new") return (b.year || 0) - (a.year || 0);
      if (s === "price-asc") return (a.price ?? 1e15) - (b.price ?? 1e15);
      if (s === "price-desc") return (b.price ?? -1) - (a.price ?? -1);
      return (b.photo_count || 0) - (a.photo_count || 0); // relevance
    });
    return list;
  }

  // ---------- card ----------
  function cardHTML(p) {
    const price = fmtPrice(p.price);
    const old = fmtPrice(p.price_old);
    const tags = (p.tags || []).slice(0, 2).map(t => `<span class="tag">${t}</span>`).join("");
    const saleTag = old ? `<span class="tag sale">Oferta</span>` : "";
    const img = p.photos && p.photos[0] ? IMG + p.photos[0] : "";
    return `<article class="card reveal" data-open="${p.id}">
      <div class="card-media">
        ${img ? `<img src="${img}" alt="${p.brand} ${p.name}" loading="lazy">` : ""}
        <div class="card-tags">${saleTag}${tags}</div>
        <button class="fav-btn ${isFav(p.id) ? "active" : ""}" data-id="${p.id}" data-fav title="Favorito">${heartSVG}</button>
        ${p.in_stock ? "" : `<div class="stock-out"><span>Agotado</span></div>`}
      </div>
      <div class="card-body">
        <span class="card-brand">${p.brand}</span>
        <h3 class="card-name">${p.name}</h3>
        <span class="card-fam">${p.family} · ${p.size_ml} ml</span>
        <div class="card-foot">
          <div class="price">
            ${old ? `<span class="old">${old}</span>` : ""}
            ${price ? `<span class="now">${price}</span>` : `<span class="now consult">${CFG.pricePlaceholder || "Consultar"}</span>`}
          </div>
          <a class="wa-mini" href="${waProduct(p, "consult")}" target="_blank" rel="noopener"
             data-stop title="Consultar por WhatsApp">${waSVG}</a>
        </div>
      </div>
    </article>`;
  }

  // ---------- render grid ----------
  function render() {
    const list = getFiltered();
    const grid = $("#grid");
    $("#resultCount").textContent = `${list.length} ${list.length === 1 ? "resultado" : "resultados"}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <p>No encontramos perfumes con esos filtros.</p></div>`;
    } else {
      grid.innerHTML = list.map(cardHTML).join("");
    }
    observeReveals();
  }

  // ---------- autocomplete ----------
  let acIndex = -1;
  function autocomplete() {
    const q = norm(state.search), box = $("#autocomplete");
    if (q.length < 2) { box.classList.remove("show"); return; }
    const matches = DATA.filter(p => norm(`${p.name} ${p.brand} ${(p.notes_top||[]).join(" ")}`).includes(q)).slice(0, 6);
    if (!matches.length) { box.classList.remove("show"); return; }
    box.innerHTML = matches.map((p, i) =>
      `<div class="ac-item ${i === acIndex ? "active" : ""}" data-open="${p.id}">
        <img src="${p.photos && p.photos[0] ? IMG + p.photos[0] : ""}" alt="">
        <div><div class="t">${p.name}</div><div class="b">${p.brand} · ${p.family}</div></div></div>`
    ).join("");
    box.classList.add("show");
  }

  // ---------- modal ----------
  let galleryPhotos = [], galleryIdx = 0;
  function openModal(id) {
    const p = DATA.find(x => x.id === id); if (!p) return;
    galleryPhotos = (p.photos || []).map(f => IMG + f);
    galleryIdx = 0;
    const price = fmtPrice(p.price), old = fmtPrice(p.price_old);
    const off = (p.price && p.price_old) ? Math.round((1 - p.price / p.price_old) * 100) : 0;
    const pyr = [["Salida", p.notes_top], ["Corazón", p.notes_heart], ["Fondo", p.notes_base]]
      .filter(([, v]) => v && v.length)
      .map(([k, v]) => `<div class="pyr-row"><span class="k">${k}</span>
        <span class="v">${v.map(n => `<span class="note">${n}</span>`).join("")}</span></div>`).join("");
    const chips = [p.gender, p.concentration, `${p.size_ml} ml`, p.family, p.inspiration && p.inspiration !== "Original" ? p.inspiration : null]
      .filter(Boolean).map(c => `<span class="chip">${c}</span>`).join("");

    $("#modalBody").innerHTML = `
      <div class="m-gallery">
        <div class="m-main" id="mMain"><img src="${galleryPhotos[0] || ""}" alt="${p.name}" id="mMainImg"></div>
        ${galleryPhotos.length > 1 ? `<div class="m-thumbs" id="mThumbs">${galleryPhotos.map((src, i) =>
          `<div class="m-thumb ${i === 0 ? "active" : ""}" data-idx="${i}"><img src="${src}" alt=""></div>`).join("")}</div>` : ""}
      </div>
      <div class="m-info">
        <span class="brand">${p.brand}</span>
        <h3>${p.name}</h3>
        <div class="m-meta">${chips}</div>
        <div class="m-price">
          ${price ? `<span class="now">${price}</span>` : `<span class="now consult">${CFG.pricePlaceholder || "Consultar precio"}</span>`}
          ${old ? `<span class="old">${old}</span>` : ""}
          ${off > 0 ? `<span class="off">-${off}%</span>` : ""}
        </div>
        <p class="m-desc">${p.description_es || ""}</p>
        ${pyr ? `<div class="pyramid">${pyr}</div>` : ""}
        <div class="m-actions">
          <a class="btn btn-wa full btn-lg" href="${waProduct(p, "buy")}" target="_blank" rel="noopener">${waSVG} Comprar / Consultar</a>
          <a class="btn btn-ghost" href="${waProduct(p, "quote")}" target="_blank" rel="noopener">Cotizar</a>
          <button class="btn btn-ghost fav-btn-text ${isFav(p.id) ? "active" : ""}" data-fav data-id="${p.id}">
            ${heartSVG} ${isFav(p.id) ? "Guardado" : "Favorito"}</button>
        </div>
        <div class="m-share">
          <button data-share="link">🔗 Copiar enlace</button>
          <button data-share="native">↗ Compartir</button>
        </div>
      </div>`;
    // gallery events
    $$("#mThumbs .m-thumb").forEach(t => t.addEventListener("click", () => setGallery(+t.dataset.idx)));
    const main = $("#mMain");
    if (main) {
      main.addEventListener("mousemove", zoomMove);
      main.addEventListener("mouseleave", () => { $("#mMainImg").style.transform = ""; });
      main.addEventListener("click", () => setGallery((galleryIdx + 1) % galleryPhotos.length));
    }
    $$('[data-share]', $("#modalBody")).forEach(b => b.addEventListener("click", () => share(p, b.dataset.share)));
    const modal = $("#modal");
    modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    location.hash = "p-" + p.slug;
  }
  function setGallery(i) {
    galleryIdx = i;
    $("#mMainImg").src = galleryPhotos[i];
    $$("#mThumbs .m-thumb").forEach((t, k) => t.classList.toggle("active", k === i));
  }
  function zoomMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100, y = ((e.clientY - r.top) / r.height) * 100;
    const img = $("#mMainImg");
    img.style.transformOrigin = `${x}% ${y}%`; img.style.transform = "scale(1.8)";
  }
  function closeModal() {
    const modal = $("#modal");
    modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    if (location.hash.startsWith("#p-")) history.replaceState(null, "", location.pathname + location.search);
  }
  function share(p, mode) {
    const url = location.origin + location.pathname + "#p-" + p.slug;
    const text = `${p.brand} — ${p.name} | Perfumes Originales`;
    if (mode === "native" && navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else {
      const tmp = url + " — " + text;
      if (navigator.clipboard) navigator.clipboard.writeText(tmp).then(() => toast("<b>🔗</b> Enlace copiado")).catch(() => toast("Copia: " + url));
      else toast("Copia: " + url);
    }
  }

  // ---------- reveals ----------
  let io;
  function observeReveals() {
    if (!io) io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    $$(".reveal:not(.in)").forEach(el => io.observe(el));
  }

  // ---------- theme ----------
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    $("#themeIcon").innerHTML = t === "light"
      ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>'
      : '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
  }

  // ---------- nav events ----------
  function bindNav() {
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    $("#themeToggle").addEventListener("click", () =>
      applyTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"));
    $("#favToggle").addEventListener("click", showFavs);
    $("#searchToggle").addEventListener("click", () => {
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => $("#searchInput").focus(), 500);
    });
    const mm = $("#mobileMenu");
    $("#burger").addEventListener("click", () => mm.classList.toggle("open"));
    $$("[data-nav]").forEach(a => a.addEventListener("click", () => mm.classList.remove("open")));

    // filters drawer (mobile)
    $("#filtersToggle").addEventListener("click", () => $("#filtersPanel").classList.toggle("open"));

    $("#clearFilters").addEventListener("click", () => {
      state.filters = { brand: [], gender: [], family: [], tags: [] };
      $$("#filterGroups input").forEach(i => i.checked = false);
      state.search = ""; $("#searchInput").value = "";
      render();
    });
  }

  function showFavs() {
    if (!favs.length) { toast("Aún no tienes favoritos"); return; }
    // filter grid to favorites
    state.filters = { brand: [], gender: [], family: [], tags: [] };
    $$("#filterGroups input").forEach(i => i.checked = false);
    state.search = ""; $("#searchInput").value = "";
    const grid = $("#grid");
    const list = DATA.filter(p => favs.includes(p.id));
    $("#resultCount").textContent = `${list.length} favorito${list.length === 1 ? "" : "s"}`;
    grid.innerHTML = list.map(cardHTML).join("");
    observeReveals();
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    toast("<b>♥</b> Mostrando tus favoritos");
  }

  // ---------- global delegation ----------
  function bindGlobal() {
    document.addEventListener("click", e => {
      const fav = e.target.closest("[data-fav]");
      if (fav) { e.preventDefault(); e.stopPropagation(); const id = +fav.dataset.id;
        toggleFav(id);
        if (fav.classList.contains("fav-btn-text")) { fav.classList.toggle("active", isFav(id));
          fav.innerHTML = heartSVG + (isFav(id) ? " Guardado" : " Favorito"); }
        return; }
      if (e.target.closest("[data-stop]")) { e.stopPropagation(); return; }
      const opener = e.target.closest("[data-open]");
      if (opener) { openModal(+opener.dataset.open); return; }
      const cat = e.target.closest("[data-cat-key]");
      if (cat) { applyCategory(cat.dataset.catKey, cat.dataset.catVal); return; }
    });
    $("#modalBg").addEventListener("click", closeModal);
    $("#modalClose").addEventListener("click", closeModal);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

    // search
    const inp = $("#searchInput");
    inp.addEventListener("input", () => { state.search = inp.value; acIndex = -1; autocomplete(); render(); });
    inp.addEventListener("keydown", e => {
      const items = $$("#autocomplete .ac-item");
      if (e.key === "ArrowDown") { acIndex = Math.min(acIndex + 1, items.length - 1); autocomplete(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { acIndex = Math.max(acIndex - 1, 0); autocomplete(); e.preventDefault(); }
      else if (e.key === "Enter" && acIndex >= 0 && items[acIndex]) { openModal(+items[acIndex].dataset.open); $("#autocomplete").classList.remove("show"); }
    });
    document.addEventListener("click", e => {
      if (!e.target.closest(".search")) $("#autocomplete").classList.remove("show");
    });
    $("#sortSelect").addEventListener("change", e => { state.sort = e.target.value; render(); });
  }

  function applyCategory(key, val) {
    state.filters = { brand: [], gender: [], family: [], tags: [] };
    $$("#filterGroups input").forEach(i => i.checked = false);
    if (state.filters[key]) {
      state.filters[key] = [val];
      const box = $(`#filterGroups input[data-fkey="${key}"][value="${val}"]`);
      if (box) box.checked = true;
    }
    render();
    document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- deep link ----------
  function openFromHash() {
    if (location.hash.startsWith("#p-")) {
      const slug = location.hash.slice(3);
      const p = DATA.find(x => x.slug === slug);
      if (p) setTimeout(() => openModal(p.id), 300);
    }
  }

  // ---------- init ----------
  function init() {
    try { applyTheme(localStorage.getItem(THEME_KEY) || "dark"); } catch (e) { applyTheme("dark"); }
    if (!DATA.length) {
      $("#grid").innerHTML = `<div class="empty"><p>No hay productos cargados todavía. Ejecuta <b>build_catalog.py</b> para generar el catálogo.</p></div>`;
      applyConfig(); return;
    }
    applyConfig(); renderHero(); renderCats(); renderBrands();
    buildFilters(); render(); bindNav(); bindGlobal();
    updateFavBadge(); observeReveals(); openFromHash();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
