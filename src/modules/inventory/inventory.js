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
        sell_price: 'Sale price', search_items: 'Search items…', name_required: 'Name is required',
        delete_item_q: 'Delete this item?', show_archived: 'Show archived', in_stock_n: '{n} in stock',
        n_low_m_out: '{low} low · {out} out of stock', all_good: 'Stock looks healthy',
      },
      fr: {
        add_item: 'Ajouter un article', edit_item: "Modifier l'article", low_stock: 'bas', out_of_stock_label: 'épuisé',
        stock: 'Stock', unit: 'Unité', status: 'Statut', active: 'Actif', archived: 'Archivé',
        sell_price: 'Prix de vente', search_items: 'Rechercher…', name_required: 'Le nom est requis',
        delete_item_q: 'Supprimer cet article ?', show_archived: 'Afficher archivés', in_stock_n: '{n} en stock',
        n_low_m_out: '{low} bas · {out} épuisés', all_good: 'Stock en bon état',
      },
      ar: {
        add_item: 'إضافة عنصر', edit_item: 'تعديل العنصر', low_stock: 'منخفض', out_of_stock_label: 'نفد',
        stock: 'المخزون', unit: 'الوحدة', status: 'الحالة', active: 'نشط', archived: 'مؤرشف',
        sell_price: 'ثمن البيع', search_items: 'بحث…', name_required: 'الاسم مطلوب',
        delete_item_q: 'حذف هذا العنصر؟', show_archived: 'إظهار المؤرشف', in_stock_n: '{n} في المخزون',
        n_low_m_out: '{low} منخفض · {out} نفد', all_good: 'المخزون بحالة جيدة',
      },
    },

    setup(app) {
      app.on('sale:recorded', s => {
        if (!s.itemId) return;
        const it = app.store.find('items', s.itemId);
        if (it && typeof it.stock === 'number') app.store.update('items', it.id, { stock: Math.max(0, it.stock - s.qty) });
      });
      app.on('sale:undone', s => {
        if (!s.itemId) return;
        const it = app.store.find('items', s.itemId);
        if (it && typeof it.stock === 'number') app.store.update('items', it.id, { stock: it.stock + s.qty });
      });
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      let q = '', filter = 'all', showArchived = false;

      // header
      wrap.appendChild(el('div', { class: 'h-row', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-page-title', style: { margin: 0 } }, app.moduleTitle(MOD)),
        el('div', { class: 'h-spacer' }),
        el('button', { class: 'h-btn h-btn-primary', onClick: () => openItemForm(app, null) }, '+ ' + t('add_item')),
      ]));

      // health banner
      const live = () => store.all('items').filter(i => i.active !== false);
      const lowN = live().filter(i => i.stock != null && i.stock > 0 && i.stock <= LOW).length;
      const outN = live().filter(i => i.stock != null && i.stock <= 0).length;
      wrap.appendChild(ui.card(null, (lowN + outN)
        ? el('div', { class: 'h-row' }, [el('span', {}, '⚠️'), el('span', {}, t('n_low_m_out', { low: lowN, out: outN }))])
        : el('div', { class: 'h-row h-ok' }, [el('span', {}, '✅'), el('span', {}, t('all_good'))])));

      // search + filter chips
      const search = ui.input({ type: 'search', placeholder: t('search_items'), oninput: e => { q = e.target.value.toLowerCase().trim(); renderList(); } });
      wrap.appendChild(el('div', { style: { marginBottom: '10px' } }, search));
      const chips = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
      [['all', t('all')], ['low', t('low_stock')], ['out', t('out_of_stock_label')]].forEach(([val, lbl]) =>
        chips.appendChild(el('button', { class: 'h-chip' + (filter === val ? ' active' : ''), onClick: () => { filter = val; [...chips.children].forEach((c, i) => c.classList.toggle('active', ['all', 'low', 'out'][i] === val)); renderList(); } }, lbl)));
      chips.appendChild(el('label', { class: 'h-chip h-row', style: { gap: '6px' } }, [
        el('input', { type: 'checkbox', onchange: e => { showArchived = e.target.checked; renderList(); } }),
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
        if (q) list = list.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
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
      stock: ui.input({ type: 'number', inputmode: 'numeric', step: '1', value: item.stock != null ? item.stock : '' }),
      unit: ui.input({ value: item.unit || '', placeholder: 'pc' }),
    };
    let active = item.active !== false;
    const body = el('div', {}, [
      el('datalist', { id: 'h-cats' }, cats.map(c => el('option', { value: c }))),
      ui.field(t('name'), f.name),
      el('div', { class: 'h-form-grid' }, [
        ui.field(t('category'), f.category),
        ui.field(t('unit') + ' (' + t('optional') + ')', f.unit),
        ui.field(t('sell_price'), f.price),
        ui.field(t('cost') + ' (' + t('optional') + ')', f.cost),
        ui.field(t('stock'), f.stock),
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
        price: parseFloat(f.price.value) || 0, cost: parseFloat(f.cost.value) || 0,
        stock: f.stock.value === '' ? null : (parseInt(f.stock.value, 10) || 0),
        unit: f.unit.value.trim() || 'pc', active,
      });
      close(); app.toast(t('saved'));
    } });

    app.sheet({ title: ed ? t('edit_item') : t('add_item'), body, actions });
  }

  window.Hanout.module(MOD);
})();
