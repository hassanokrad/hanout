/* Hanout module — inventory (stock). Items CRUD, low-stock, auto-decrement on sale. */
;(function () {
  const LOW = 3;

  const MOD = {
    id: 'inventory', order: 20, icon: '📦',
    title: { en: 'Inventory', fr: 'Stock', ar: 'المخزون' },
    strings: {
      en: {
        add_item: 'Add item', edit_item: 'Edit item', low_stock: 'low', out_of_stock_label: 'out',
        stock: 'Stock', unit: 'Unit', status: 'Status', active: 'Active', archived: 'Archived',
        sell_price: 'Sale price', search_items: 'Search items…', name_required: 'Name is required', barcode: 'Barcode',
        delete_item_q: 'Delete this item?', show_archived: 'Show archived', in_stock_n: '{n} in stock',
        n_low_m_out: '{low} low · {out} out of stock', all_good: 'Stock looks healthy',
      },
      fr: {
        add_item: 'Ajouter un article', edit_item: "Modifier l'article", low_stock: 'bas', out_of_stock_label: 'épuisé',
        stock: 'Stock', unit: 'Unité', status: 'Statut', active: 'Actif', archived: 'Archivé',
        sell_price: 'Prix de vente', search_items: 'Rechercher…', name_required: 'Le nom est requis', barcode: 'Code-barres',
        delete_item_q: 'Supprimer cet article ?', show_archived: 'Afficher archivés', in_stock_n: '{n} en stock',
        n_low_m_out: '{low} bas · {out} épuisés', all_good: 'Stock en bon état',
      },
      ar: {
        add_item: 'إضافة عنصر', edit_item: 'تعديل العنصر', low_stock: 'منخفض', out_of_stock_label: 'نفد',
        stock: 'المخزون', unit: 'الوحدة', status: 'الحالة', active: 'نشط', archived: 'مؤرشف',
        sell_price: 'ثمن البيع', search_items: 'بحث…', name_required: 'الاسم مطلوب', barcode: 'الباركود',
        delete_item_q: 'حذف هذا العنصر؟', show_archived: 'إظهار المؤرشف', in_stock_n: '{n} في المخزون',
        n_low_m_out: '{low} منخفض · {out} نفد', all_good: 'المخزون بحالة جيدة',
      },
    },

    setup(app) {
      app.on('sale:recorded', s => {
        if (!s.itemId) return;
        const it = app.store.find('items', s.itemId);
        if (it && typeof it.stock === 'number') app.store.update('items', it.id, { stock: Math.max(0, +((it.stock - s.qty).toFixed(3))) });
      });
      app.on('sale:undone', s => {
        if (!s.itemId) return;
        const it = app.store.find('items', s.itemId);
        if (it && typeof it.stock === 'number') app.store.update('items', it.id, { stock: +((it.stock + s.qty).toFixed(3)) });
      });
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      const st = app.tabState();
      let q = st.q || '', filter = st.filter || 'all', showArchived = !!st.showArchived;

      // header
      wrap.appendChild(el('div', { class: 'h-row', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-page-title', style: { margin: 0 } }, app.moduleTitle(MOD)),
        el('div', { class: 'h-spacer' }),
        el('button', { class: 'h-btn h-btn-primary', onClick: () => openItemForm(app, null) }, '+ ' + t('add_item')),
      ]));

      // health: two stat cards (low / out)
      const live = () => store.all('items').filter(i => i.active !== false);
      const lowN = live().filter(i => i.stock != null && i.stock > 0 && i.stock <= LOW).length;
      const outN = live().filter(i => i.stock != null && i.stock <= 0).length;
      wrap.appendChild(el('div', { class: 'h-statgrid' }, [
        el('div', { class: 'h-stat' + (lowN ? ' warn' : ' ok'), onClick: () => { filter = 'low'; st.filter = 'low'; syncFilter(); renderList(); } }, [
          el('div', { class: 'h-stat-num' }, String(lowN)),
          el('div', { class: 'h-stat-lbl' }, t('low_stock')),
        ]),
        el('div', { class: 'h-stat' + (outN ? ' danger' : ' ok'), onClick: () => { filter = 'out'; st.filter = 'out'; syncFilter(); renderList(); } }, [
          el('div', { class: 'h-stat-num' }, String(outN)),
          el('div', { class: 'h-stat-lbl' }, t('out_of_stock_label')),
        ]),
      ]));

      // search + filter chips
      const search = ui.input({ type: 'search', placeholder: t('search_items'), value: q, oninput: e => { q = e.target.value; st.q = q; renderList(); } });
      wrap.appendChild(el('div', { style: { marginBottom: '10px' } }, search));
      const chips = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
      function syncFilter() { [...chips.children].forEach((c, i) => { if (i < 3) c.classList.toggle('active', ['all', 'low', 'out'][i] === filter); }); }
      [['all', t('all')], ['low', t('low_stock')], ['out', t('out_of_stock_label')]].forEach(([val, lbl]) =>
        chips.appendChild(el('button', { class: 'h-chip' + (filter === val ? ' active' : ''), onClick: () => { filter = val; st.filter = val; syncFilter(); renderList(); } }, lbl)));
      chips.appendChild(el('label', { class: 'h-chip h-row', style: { gap: '6px' } }, [
        el('input', { type: 'checkbox', checked: showArchived, onchange: e => { showArchived = e.target.checked; st.showArchived = showArchived; renderList(); } }),
        el('span', {}, t('show_archived')),
      ]));
      wrap.appendChild(chips);

      const listCard = el('section', { class: 'h-card' });
      wrap.appendChild(listCard);
      function renderList() {
        ui.clear(listCard);
        let list = store.all('items').slice();
        if (!showArchived) list = list.filter(i => i.active !== false);
        if (filter === 'low') list = list.filter(i => i.stock != null && i.stock > 0 && i.stock <= LOW);
        if (filter === 'out') list = list.filter(i => i.stock != null && i.stock <= 0);
        if (q) { const qq = q.toLowerCase().trim(); list = list.filter(i => (i.name || '').toLowerCase().includes(qq) || (i.category || '').toLowerCase().includes(qq) || (i.barcode || '').toLowerCase().includes(qq)); }
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!list.length) { listCard.appendChild(ui.empty(null, '📦')); return; }
        const inner = el('div', { class: 'h-list' });
        list.forEach(it => {
          const out = it.stock != null && it.stock <= 0;
          const low = it.stock != null && it.stock > 0 && it.stock <= LOW;
          const badge = it.stock == null ? null
            : ui.pill((out ? t('out_of_stock_label') : it.stock + ' ' + (it.unit || '')), out ? 'danger' : (low ? 'warn' : 'ok'));
          inner.appendChild(el('div', { class: 'h-list-item', onClick: () => openItemForm(app, it) }, [
            el('div', { class: 'h-list-main' }, [
              el('div', { class: 'h-list-title' }, [it.name, it.active === false ? ' ' : null, it.active === false ? ui.pill(t('archived')) : null]),
              el('div', { class: 'h-list-sub' }, [it.category || '—', ' · ', money(it.price)]),
            ]),
            el('div', { class: 'h-list-end' }, badge),
          ]));
        });
        listCard.appendChild(inner);
      }
      renderList();
      return wrap;
    },
  };

  function openItemForm(app, item) {
    const { el, store, t } = app, ui = app.ui;
    const ed = !!item; item = item || {};
    const cats = Array.from(new Set(store.all('items').map(i => i.category).filter(Boolean)));
    const f = {
      name: ui.input({ value: item.name || '', placeholder: t('name') }),
      category: ui.input({ value: item.category || '', placeholder: t('category'), list: 'h-cats' }),
      price: ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: item.price != null ? item.price : '' }),
      cost: ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: item.cost != null ? item.cost : '' }),
      stock: ui.input({ type: 'number', inputmode: 'decimal', step: 'any', value: item.stock != null ? item.stock : '' }),
      unit: ui.input({ value: item.unit || '', placeholder: 'حبة' }),
      barcode: ui.input({ value: item.barcode || '', placeholder: t('barcode'), style: { flex: '1', minWidth: '0' } }),
    };
    let active = item.active !== false;
    // Only name + sell price are upfront; everything else is optional and collapsed, so
    // adding a product feels like two fields, not seven (open by default when editing).
    const body = el('div', {}, [
      el('datalist', { id: 'h-cats' }, cats.map(c => el('option', { value: c }))),
      ui.field(t('name'), f.name),
      ui.field(t('sell_price'), f.price),
      el('details', { class: 'h-details', open: ed }, [
        el('summary', {}, t('more_details') + ' (' + t('optional') + ')'),
        el('div', { class: 'h-form-grid', style: { marginTop: '10px' } }, [
          ui.field(t('category'), f.category),
          ui.field(t('unit'), f.unit),
          ui.field(t('cost'), f.cost),
          ui.field(t('stock'), f.stock),
        ]),
        ui.field(t('barcode'), el('div', { class: 'h-row', style: { gap: '8px' } }, [
          f.barcode,
          el('button', { class: 'h-btn', type: 'button', title: t('scan'), onClick: () => app.scanBarcode(code => { f.barcode.value = code; }) }, '📷'),
        ])),
      ]),
      ed ? ui.field(t('status'), el('label', { class: 'h-row', style: { gap: '8px' } }, [
        el('input', { type: 'checkbox', checked: active, onchange: e => { active = e.target.checked; } }),
        el('span', {}, t('active')),
      ])) : null,
    ]);

    const actions = [];
    if (ed) actions.push({ label: t('delete'), kind: 'danger', onClick: close => {
      app.confirm(t('delete_item_q'), { danger: true, ok: t('delete') }).then(ok => { if (ok) { store.del('items', item.id); close(); app.toast(t('deleted')); } });
    } });
    actions.push({ label: t('save'), kind: 'primary', onClick: close => {
      const name = f.name.value.trim();
      if (!name) { app.toast(t('name_required')); return; }
      store.upsert('items', {
        id: item.id, name, category: f.category.value.trim(),
        price: Math.max(0, parseFloat(f.price.value) || 0), cost: Math.max(0, parseFloat(f.cost.value) || 0),
        stock: f.stock.value === '' ? null : Math.max(0, +((parseFloat(f.stock.value) || 0).toFixed(3))),
        unit: f.unit.value.trim() || 'حبة', barcode: f.barcode.value.trim(), active,
      });
      close(); app.toast(t('saved'));
    } });

    app.sheet({ title: ed ? t('edit_item') : t('add_item'), body, actions });
  }

  window.Hanout.module(MOD);
})();
