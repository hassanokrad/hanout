/* Hanout core — ui.js
 * Minimal DOM builder + a handful of UI components (modal, bottom sheet, toast,
 * confirm, form fields, bar chart, KPI, cards). No framework, no dependencies.
 */
;(function () {
  const H = (window.Hanout = window.Hanout || {});
  const cfg = { currency: 'MAD', lang: 'en', dir: 'ltr' };

  function el(tag, props, children) {
    const node = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
    append(node, children);
    return node;
  }
  function append(node, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(x => append(node, x));
    else if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  // number / money / date formatting (Latin digits everywhere to avoid bidi issues)
  function nf(n, max) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: max == null ? 2 : max }); }
  // Wrap in an LTR isolate (U+2066 … U+2069) so "5,402 MAD" always reads left-to-right
  // even inside RTL (Arabic) text — without reordering the surrounding text or its alignment.
  function money(n) { return '⁦' + nf(n) + ' ' + cfg.currency + '⁩'; }
  function pad(x) { return String(x).padStart(2, '0'); }
  function fmtDate(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return String(d || '');
    return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
  }
  function fmtTime(d) {
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return '';
    return pad(dt.getHours()) + ':' + pad(dt.getMinutes());
  }
  function todayKey() { return fmtDate(new Date()); }

  // ---- toast ----
  let toastT, toastLockUntil = 0;
  function toast(msg, opts) {
    opts = opts || {};
    const now = Date.now();
    if (!opts.priority && now < toastLockUntil) return;   // don't let a routine toast bury a priority one (e.g. a failed save)
    if (opts.priority) toastLockUntil = now + 2200;
    let t = document.getElementById('h-toast');
    if (!t) { t = el('div', { id: 'h-toast', class: 'h-toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---- modal / bottom sheet ----
  function modal(opts) {
    opts = opts || {};
    const overlay = el('div', { class: 'h-overlay' });
    const card = el('div', { class: 'h-modal' + (opts.sheet ? ' h-sheet' : '') });
    if (opts.title) card.appendChild(el('div', { class: 'h-modal-head' }, [
      el('h3', {}, opts.title),
      el('button', { class: 'h-x', 'aria-label': 'close', onClick: dismiss }, '✕'),
    ]));
    const body = el('div', { class: 'h-modal-body' });
    append(body, typeof opts.body === 'function' ? opts.body() : opts.body);
    card.appendChild(body);
    if (opts.actions && opts.actions.length) {
      const foot = el('div', { class: 'h-modal-foot' });
      opts.actions.forEach(a => foot.appendChild(
        el('button', { class: 'h-btn' + (a.kind ? ' h-btn-' + a.kind : ''), onClick: () => a.onClick && a.onClick(dismiss) }, a.label)
      ));
      card.appendChild(foot);
    }
    overlay.appendChild(card);
    overlay.addEventListener('click', e => { if (e.target === overlay && opts.dismissable !== false) dismiss(); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    // autofocus the first text field (skip when asked, e.g. the sale sheet)
    if (opts.autofocus !== false) {
      requestAnimationFrame(() => {
        const f = card.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=search]),select,textarea');
        if (f) { try { f.focus(); } catch (e) {} }
      });
    }
    // Enter on a text input triggers the primary action; Escape closes.
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'search' && !e.shiftKey) {
        const primary = (opts.actions || []).find(a => a.kind === 'primary');
        if (primary && primary.onClick) { e.preventDefault(); primary.onClick(dismiss); }
      }
    });
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    document.addEventListener('keydown', onKey);

    let closed = false;
    function dismiss() {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      opts.onClose && opts.onClose();
    }
    return { close: dismiss, card, body };
  }
  function sheet(opts) { return modal(Object.assign({ sheet: true }, opts)); }

  function confirm(message, opts) {
    opts = opts || {};
    return new Promise(resolve => {
      let decided = false;
      const done = v => { if (decided) return; decided = true; resolve(v); };
      modal({
        title: opts.title || H.I18n.t('confirm'),
        body: el('p', { class: 'h-muted' }, message),
        actions: [
          // record the decision BEFORE close() — close() runs onClose (→ done(false)),
          // which would otherwise win the race and make OK resolve false.
          { label: opts.cancel || H.I18n.t('cancel'), onClick: close => { done(false); close(); } },
          { label: opts.ok || H.I18n.t('confirm'), kind: opts.danger ? 'danger' : 'primary', onClick: close => { done(true); close(); } },
        ],
        onClose: () => done(false),
      });
    });
  }

  // ---- form helpers ----
  function field(label, control, hint) {
    return el('label', { class: 'h-field' }, [
      label ? el('span', { class: 'h-field-label' }, label) : null,
      control,
      hint ? el('span', { class: 'h-field-hint' }, hint) : null,
    ]);
  }
  function input(props) { return el('input', Object.assign({ class: 'h-input' }, props)); }
  function select(options, props) {
    const s = el('select', Object.assign({ class: 'h-input' }, props));
    (options || []).forEach(o => s.appendChild(el('option', { value: o.value, selected: o.selected }, o.label)));
    return s;
  }
  function button(label, props) { return el('button', Object.assign({ class: 'h-btn' }, props), label); }

  // ---- bar chart ----
  function bars(data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map(d => +d.value || 0));
    return el('div', { class: 'h-bars' }, data.length ? data.map(d =>
      el('div', { class: 'h-bar-row' }, [
        el('span', { class: 'h-bar-label', title: d.label }, d.label),
        el('span', { class: 'h-bar-track' }, el('span', { class: 'h-bar-fill', style: { width: (100 * (+d.value || 0) / max) + '%' } })),
        el('span', { class: 'h-bar-val' }, opts.format ? opts.format(d.value) : nf(d.value, 0)),
      ])
    ) : empty());
  }

  // ---- misc components ----
  function empty(msg, emoji) {
    return el('div', { class: 'h-empty' }, [
      el('div', { class: 'h-empty-emoji' }, emoji || '🗒️'),
      el('p', {}, msg || H.I18n.t('empty_here')),
    ]);
  }
  function card(title, body, extra) {
    return el('section', { class: 'h-card' }, [
      title ? el('div', { class: 'h-card-head' }, [el('h3', {}, title), extra || null]) : null,
      body,
    ]);
  }
  function kpi(label, value, sub) {
    return el('div', { class: 'h-kpi' }, [
      el('div', { class: 'h-kpi-val' }, value),
      el('div', { class: 'h-kpi-label' }, label),
      sub ? el('div', { class: 'h-kpi-sub' }, sub) : null,
    ]);
  }
  function pill(text, kind) { return el('span', { class: 'h-pill' + (kind ? ' h-pill-' + kind : '') }, text); }
  function row(cells, props) { return el('div', Object.assign({ class: 'h-row' }, props), cells); }

  H.ui = {
    cfg, el, append, clear, money, nf, fmtDate, fmtTime, todayKey,
    toast, modal, sheet, confirm, field, input, select, button, bars,
    empty, card, kpi, pill, row,
  };
})();
