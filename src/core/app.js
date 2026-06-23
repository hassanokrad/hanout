/* Hanout core — app.js
 * The runtime: module registry, event bus, navigation, settings, theming, boot.
 * Modules register at parse time via Hanout.module({...}); Hanout.boot(SEED) starts
 * everything once the DOM is ready.
 */
;(function () {
  const H = (window.Hanout = window.Hanout || {});
  const ui = H.ui, I18n = H.I18n;

  const registry = [];
  function module(def) { registry.push(def); }

  const SETTINGS_KEY = 'settings';
  const SEEDVER_KEY = 'seedver';
  // Arabic-only build: the UI and sample data are Arabic (RTL). `lang` is forced to 'ar'
  // in loadSettings, so there is no in-app language switch.
  const DEFAULT_SETTINGS = { business: 'Hanout', currency: 'MAD', lang: 'ar', theme: 'light', enabled: {} };

  let store, settings, app, activeId, SEED = null;
  const listeners = {};
  const tabStates = {};
  // Per-tab UI state (search query, active filter, report period…) that must
  // survive the auto re-render triggered on every store write.
  function tabState(id) { id = id || activeId; return tabStates[id] || (tabStates[id] = {}); }

  // ---- settings ----
  function loadSettings() { const s = Object.assign({}, DEFAULT_SETTINGS, store.get(SETTINGS_KEY, {})); s.lang = 'ar'; return s; }
  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    if (patch && patch.enabled) settings.enabled = Object.assign({}, settings.enabled, patch.enabled);
    store.set(SETTINGS_KEY, settings);
    applySettings();
    renderNav();
    render();
  }
  // Moroccan Arabic day/month names — built with Latin digits to match the app's
  // numbers-stay-LTR rule (avoids Eastern-Arabic numerals from toLocaleDateString).
  const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'];
  function headerStatus() {
    const d = new Date();
    return I18n.t('open_status') + ' · ' + AR_DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + AR_MONTHS[d.getMonth()];
  }
  function applySettings() {
    ui.cfg.currency = settings.currency || 'MAD';
    ui.cfg.lang = settings.lang || 'ar';
    I18n.setLang(settings.lang || 'ar');
    ui.cfg.dir = I18n.dir();
    document.documentElement.lang = settings.lang || 'ar';
    document.documentElement.dir = I18n.dir();
    document.body.setAttribute('data-theme', settings.theme || 'light');
    const name = settings.business || 'Hanout';
    const bn = document.getElementById('h-business');
    if (bn) bn.textContent = name;
    const lg = document.getElementById('h-logo');
    if (lg) lg.textContent = (name.trim()[0] || 'ح');
    const st = document.getElementById('h-status-txt');
    if (st) st.textContent = headerStatus();
  }

  // ---- modules ----
  function isEnabled(m) { return !!m && (m.core || settings.enabled[m.id] !== false); }
  function enabledModules() { return registry.filter(isEnabled).sort((a, b) => (a.order || 50) - (b.order || 50)); }
  function moduleById(id) { return registry.find(m => m.id === id) || null; }
  function moduleTitle(m) { const t = m && m.title; return (t && (t[settings.lang] || t.en)) || (m && m.id) || ''; }

  // ---- event bus ----
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return () => { const a = listeners[evt]; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  function emit(evt, payload) { (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); }

  // ---- navigation / rendering ----
  function openTab(id) {
    const m = moduleById(id);
    if (!isEnabled(m)) id = (enabledModules()[0] || {}).id;
    activeId = id;
    renderNav();
    render();
    const main = document.getElementById('h-view');
    if (main) main.scrollTop = 0;
  }
  function render() {
    const main = document.getElementById('h-view');
    if (!main) return;
    ui.clear(main);
    const m = moduleById(activeId);
    if (!m) return;
    try { ui.append(main, m.view(app)); }
    catch (e) { console.error(e); ui.append(main, ui.el('pre', { class: 'h-err' }, String((e && e.stack) || e))); }
  }
  function refresh() { render(); }
  const MAX_SLOTS = 7;
  // line icons for the bottom nav (stroke, rounded) — keyed by module id so modules
  // keep their emoji (used in the More sheet) while the nav looks premium.
  const SW = 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"';
  const NAV_ICONS = {
    sales: '<svg width="23" height="23" viewBox="0 0 24 24" ' + SW + '><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h2.3l2.2 12.4a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.3L20.8 7H5.4"/></svg>',
    inventory: '<svg width="23" height="23" viewBox="0 0 24 24" ' + SW + '><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
    debts: '<svg width="23" height="23" viewBox="0 0 24 24" ' + SW + '><path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h11"/><circle cx="16.5" cy="13" r="1.25"/></svg>',
    reports: '<svg width="23" height="23" viewBox="0 0 24 24" ' + SW + '><path d="M5 21V10M12 21V4M19 21v-7"/></svg>',
    __more: '<svg width="23" height="23" viewBox="0 0 24 24" ' + SW + '><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  function navTab(m, opts) {
    opts = opts || {};
    const ico = opts.iconHtml || (m && NAV_ICONS[m.id]);
    return ui.el('button', { class: 'h-tab' + (opts.active ? ' active' : ''), onClick: opts.onClick || (() => openTab(m.id)) }, [
      ico ? ui.el('span', { class: 'h-tab-ico', html: ico }) : ui.el('span', { class: 'h-tab-ico' }, opts.icon || m.icon || '•'),
      ui.el('span', { class: 'h-tab-lbl' }, opts.label || moduleTitle(m)),
    ]);
  }
  function renderNav() {
    const nav = document.getElementById('h-nav');
    if (!nav) return;
    ui.clear(nav);
    const enabled = enabledModules();
    const prim = enabled.filter(m => !m.secondary);
    const sec = enabled.filter(m => m.secondary);
    const needMore = sec.length > 0 || prim.length > MAX_SLOTS;
    const slots = needMore ? MAX_SLOTS - 1 : prim.length;
    const shown = prim.slice(0, slots);
    const overflow = prim.slice(slots).concat(sec);
    shown.forEach(m => nav.appendChild(navTab(m, { active: m.id === activeId })));
    if (overflow.length) {
      nav.appendChild(navTab(null, {
        iconHtml: NAV_ICONS.__more, label: I18n.t('more'),
        active: overflow.some(m => m.id === activeId),
        onClick: () => openMore(overflow),
      }));
    }
  }
  function openMore(mods) {
    let ref;
    const list = ui.el('div', { class: 'h-list' }, mods.map(m =>
      ui.el('div', { class: 'h-list-item' + (m.id === activeId ? ' active' : ''), onClick: () => { ref.close(); openTab(m.id); } },
        ui.el('div', { class: 'h-list-title' }, (m.icon || '•') + '  ' + moduleTitle(m)))));
    ref = ui.sheet({ title: I18n.t('more'), body: list });
  }

  // ---- seed / reset ----
  function installSeed(seed) {
    Object.keys(seed).forEach(k => { if (k !== 'version') store.set(k, seed[k]); });
    store.set(SEEDVER_KEY, seed.version);
  }
  function firstRunSeed(seed) {
    if (!seed) return;
    if (store.has(SETTINGS_KEY)) return;            // an install already exists — never clobber user data
    installSeed(seed);
  }
  function resetToSample() {
    store.clearAll();
    if (SEED) installSeed(SEED);
    settings = loadSettings();
    applySettings();
    renderNav();
    openTab((enabledModules()[0] || {}).id);
  }

  // ---- boot ----
  function boot(seed) {
    SEED = seed || null;
    store = H.Store.create();
    // warn (once, then throttle) if a write to localStorage fails — the in-memory
    // cache still shows the data, but it won't survive a reload, so the user must act.
    let stWarned = false;
    H.Store.onWriteError = function () {
      if (stWarned) return; stWarned = true;
      try { ui.toast(I18n.t('storage_full'), { priority: true }); } catch (e) {}
      setTimeout(function () { stWarned = false; }, 8000);
    };
    firstRunSeed(SEED);
    settings = loadSettings();

    app = {
      store, ui, i18n: I18n,
      t: (k, v) => I18n.t(k, v),
      el: ui.el, money: ui.money, nf: ui.nf, fmtDate: ui.fmtDate, fmtTime: ui.fmtTime, todayKey: ui.todayKey,
      toast: ui.toast, modal: ui.modal, sheet: ui.sheet, confirm: ui.confirm, scanBarcode: ui.scanBarcode,
      on, emit,
      get settings() { return settings; },
      saveSettings,
      refresh, openTab, tabState,
      modules: enabledModules,
      allModules: () => registry.slice(),
      moduleTitle, isEnabled,
      resetToSample,
      seed: () => SEED,
    };

    registry.forEach(m => m.strings && I18n.extend(m.strings));
    applySettings();
    // Setup ALL registered modules (not only enabled ones) so cross-module event
    // hooks — stock decrement on sale, debt charge on credit — stay consistent no
    // matter which tabs a business shows. Enable/disable controls navigation only.
    registry.forEach(m => { if (m.setup) { try { m.setup(app); } catch (e) { console.error(e); } } });

    // re-render the active view whenever data changes (simple + fine at this scale)
    store.subscribe(() => { if (document.getElementById('h-view')) render(); });

    wireHeader();
    renderNav();
    openTab((enabledModules()[0] || {}).id);
  }

  function wireHeader() {
    const themeBtn = document.getElementById('h-theme');
    if (themeBtn) themeBtn.onclick = () => saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
    // gear → the secondary sections (settings, backup, contacts, expenses) as a sheet
    const setBtn = document.getElementById('h-settings');
    if (setBtn) setBtn.onclick = () => {
      const sec = enabledModules().filter(m => m.secondary);
      if (sec.length) openMore(sec); else openTab('settings');
    };
  }

  H.module = module;
  H.boot = boot;
  H.app = () => app;
})();
