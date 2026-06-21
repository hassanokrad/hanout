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
  const DEFAULT_SETTINGS = { business: 'Hanout', currency: 'MAD', lang: 'en', theme: 'light', enabled: {} };

  let store, settings, app, activeId, SEED = null;
  const listeners = {};
  const tabStates = {};
  // Per-tab UI state (search query, active filter, report period…) that must
  // survive the auto re-render triggered on every store write.
  function tabState(id) { id = id || activeId; return tabStates[id] || (tabStates[id] = {}); }

  // ---- settings ----
  function loadSettings() { return Object.assign({}, DEFAULT_SETTINGS, store.get(SETTINGS_KEY, {})); }
  function saveSettings(patch) {
    settings = Object.assign({}, settings, patch);
    if (patch && patch.enabled) settings.enabled = Object.assign({}, settings.enabled, patch.enabled);
    store.set(SETTINGS_KEY, settings);
    applySettings();
    renderNav();
    render();
  }
  function applySettings() {
    ui.cfg.currency = settings.currency || 'MAD';
    ui.cfg.lang = settings.lang || 'en';
    I18n.setLang(settings.lang || 'en');
    ui.cfg.dir = I18n.dir();
    document.documentElement.lang = settings.lang || 'en';
    document.documentElement.dir = I18n.dir();
    document.body.setAttribute('data-theme', settings.theme || 'light');
    const bn = document.getElementById('h-business');
    if (bn) bn.textContent = settings.business || 'Hanout';
    const langSel = document.getElementById('h-lang');
    if (langSel) langSel.value = settings.lang;
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
  function navTab(m, opts) {
    opts = opts || {};
    return ui.el('button', { class: 'h-tab' + (opts.active ? ' active' : ''), onClick: opts.onClick || (() => openTab(m.id)) }, [
      ui.el('span', { class: 'h-tab-ico' }, opts.icon || m.icon || '•'),
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
        icon: '☰', label: I18n.t('more'),
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
    firstRunSeed(SEED);
    settings = loadSettings();

    app = {
      store, ui, i18n: I18n,
      t: (k, v) => I18n.t(k, v),
      el: ui.el, money: ui.money, nf: ui.nf, fmtDate: ui.fmtDate, fmtTime: ui.fmtTime, todayKey: ui.todayKey,
      toast: ui.toast, modal: ui.modal, sheet: ui.sheet, confirm: ui.confirm,
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
    const langSel = document.getElementById('h-lang');
    if (langSel) {
      langSel.innerHTML = '';
      I18n.langs.forEach(l => langSel.appendChild(ui.el('option', { value: l }, I18n.label[l])));
      langSel.value = settings.lang;
      langSel.onchange = () => saveSettings({ lang: langSel.value });
    }
    const themeBtn = document.getElementById('h-theme');
    if (themeBtn) themeBtn.onclick = () => saveSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  H.module = module;
  H.boot = boot;
  H.app = () => app;
})();
