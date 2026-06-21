/* Hanout module — sales (point of sale). Core. Tap a product → record a sale. */
;(function () {
  const MOD = {
    id: 'sales', core: true, order: 10, icon: '🛒',
    title: { en: 'Sell', fr: 'Vendre', ar: 'بيع' },
    strings: {
      en: {
        todays_total: "Today's total", todays_sales: "Today's sales", record_sale: 'Record sale',
        unit_price: 'Unit price', payment: 'Payment', customer: 'Customer', pick_customer: 'pick a customer',
        no_products: 'No products yet — add items in Inventory.', search_products: 'Search products…',
        sale_recorded: 'Sale recorded', out_of_stock: 'out', in_stock: 'in stock',
        select_customer_first: 'Pick a customer for a credit sale', undo_sale: 'Undo this sale?',
      },
      fr: {
        todays_total: 'Total du jour', todays_sales: 'Ventes du jour', record_sale: 'Enregistrer la vente',
        unit_price: 'Prix unitaire', payment: 'Paiement', customer: 'Client', pick_customer: 'choisir un client',
        no_products: 'Aucun produit — ajoutez des articles dans Stock.', search_products: 'Rechercher un produit…',
        sale_recorded: 'Vente enregistrée', out_of_stock: 'épuisé', in_stock: 'en stock',
        select_customer_first: 'Choisissez un client pour une vente à crédit', undo_sale: 'Annuler cette vente ?',
      },
      ar: {
        todays_total: 'مجموع اليوم', todays_sales: 'مبيعات اليوم', record_sale: 'تسجيل البيع',
        unit_price: 'ثمن الوحدة', payment: 'الأداء', customer: 'الزبون', pick_customer: 'اختر زبوناً',
        no_products: 'لا توجد منتجات بعد — أضِف عناصر في المخزون.', search_products: 'ابحث عن منتج…',
        sale_recorded: 'تم تسجيل البيع', out_of_stock: 'نفد', in_stock: 'متوفر',
        select_customer_first: 'اختر زبوناً للبيع بالكريدي', undo_sale: 'تراجع عن هذا البيع؟',
      },
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      const today = app.todayKey();
      const todays = store.all('sales').filter(s => s.date === today);
      const todayTotal = todays.reduce((a, s) => a + s.total, 0);

      // today summary
      wrap.appendChild(ui.card(null, el('div', {}, [
        el('div', { class: 'h-bignum h-accent' }, money(todayTotal)),
        el('div', { class: 'h-muted', style: { fontSize: '12.5px', marginTop: '2px' } },
          t('todays_total') + ' · ' + todays.length + ' ' + t('sales').toLowerCase()),
      ])));

      // search
      let q = '', cat = '';
      const search = ui.input({ type: 'search', placeholder: t('search_products'), oninput: e => { q = e.target.value.toLowerCase().trim(); renderGrid(); } });
      wrap.appendChild(el('div', { style: { marginBottom: '10px' } }, search));

      const activeItems = () => store.all('items').filter(i => i.active !== false);
      const cats = Array.from(new Set(activeItems().map(i => i.category).filter(Boolean)));
      const chipRow = el('div', { class: 'h-chips', style: { flexWrap: 'nowrap', overflowX: 'auto', marginBottom: '12px' } });
      function renderChips() {
        ui.clear(chipRow);
        [['', t('all')]].concat(cats.map(c => [c, c])).forEach(([val, lbl]) =>
          chipRow.appendChild(el('button', { class: 'h-chip' + (cat === val ? ' active' : ''), onClick: () => { cat = val; renderChips(); renderGrid(); } }, lbl)));
      }
      if (cats.length) { renderChips(); wrap.appendChild(chipRow); }

      const grid = el('div', { class: 'h-prodgrid' });
      function renderGrid() {
        ui.clear(grid);
        let list = activeItems();
        if (cat) list = list.filter(i => i.category === cat);
        if (q) list = list.filter(i => (i.name || '').toLowerCase().includes(q));
        if (!list.length) { grid.appendChild(ui.empty(store.all('items').length ? t('empty_here') : t('no_products'), '🛒')); return; }
        list.forEach(it => {
          const low = it.stock != null && it.stock > 0 && it.stock <= 3;
          const out = it.stock != null && it.stock <= 0;
          grid.appendChild(el('button', { class: 'h-prod' + (low ? ' low' : '') + (out ? ' out' : ''), onClick: () => openSale(app, it) }, [
            el('div', { class: 'h-prod-name' }, it.name),
            el('div', { class: 'h-prod-price' }, money(it.price)),
            it.stock != null ? el('div', { class: 'h-prod-stock' }, out ? t('out_of_stock') : it.stock + ' ' + (it.unit || '')) : null,
          ]));
        });
      }
      renderGrid();
      wrap.appendChild(grid);

      // today's sales list
      if (todays.length) {
        const list = el('div', { class: 'h-list' });
        todays.slice().reverse().forEach(s => {
          list.appendChild(el('div', { class: 'h-list-item' }, [
            el('div', { class: 'h-list-main' }, [
              el('div', { class: 'h-list-title' }, s.name),
              el('div', { class: 'h-list-sub' }, app.fmtTime(s.ts) + (s.qty > 1 ? ' · ' + s.qty + '×' + money(s.price) : '') + ' · ' + (s.payment === 'credit' ? t('credit') : t('cash'))),
            ]),
            el('div', { class: 'h-list-end' }, el('div', { class: 'h-list-amount' }, money(s.total))),
            el('button', { class: 'h-link', onClick: () => undoSale(app, s) }, t('undo')),
          ]));
        });
        wrap.appendChild(el('div', { class: 'h-section-title' }, t('todays_sales')));
        wrap.appendChild(ui.card(null, list));
      }
      return wrap;
    },
  };

  function openSale(app, item) {
    const { el, store, t, money } = app, ui = app.ui;
    let qty = 1, price = +item.price || 0, payment = 'cash', contactId = '';
    const customers = store.all('contacts').filter(c => c.type === 'customer');

    const totalEl = el('div', { class: 'h-bignum h-accent' });
    const qtyEl = el('span', { style: { minWidth: '38px', textAlign: 'center', fontWeight: '700', fontSize: '18px' } }, String(qty));
    const upd = () => { totalEl.textContent = money(qty * price); };

    const priceInput = ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: String(price), oninput: e => { price = parseFloat(e.target.value) || 0; upd(); } });

    const custField = ui.field(t('customer'),
      ui.select([{ value: '', label: '— ' + t('pick_customer') + ' —' }].concat(customers.map(c => ({ value: c.id, label: c.name }))), { onchange: e => { contactId = e.target.value; } }));
    custField.style.display = 'none';

    const cashBtn = el('button', { class: 'h-chip active', onClick: () => setPay('cash') }, t('cash'));
    const creditBtn = el('button', { class: 'h-chip', onClick: () => setPay('credit') }, t('credit'));
    function setPay(p) { payment = p; cashBtn.classList.toggle('active', p === 'cash'); creditBtn.classList.toggle('active', p === 'credit'); custField.style.display = p === 'credit' ? '' : 'none'; }

    let saving = false;
    app.sheet({
      title: item.name,
      body: el('div', {}, [
        ui.field(t('unit_price'), priceInput,
          item.stock != null ? (item.stock <= 0 ? t('out_of_stock') : item.stock + ' ' + (item.unit || '') + ' ' + t('in_stock')) : null),
        ui.field(t('quantity'), el('div', { class: 'h-row' }, [
          el('button', { class: 'h-btn', onClick: () => { if (qty > 1) { qty--; qtyEl.textContent = qty; upd(); } } }, '−'),
          qtyEl,
          el('button', { class: 'h-btn', onClick: () => { qty++; qtyEl.textContent = qty; upd(); } }, '+'),
        ])),
        ui.field(t('payment'), el('div', { class: 'h-chips' }, [cashBtn, creditBtn])),
        custField,
        el('div', { class: 'h-row h-mt' }, [el('span', { class: 'h-muted' }, t('total')), el('div', { class: 'h-spacer' }), totalEl]),
      ]),
      actions: [
        { label: t('cancel'), onClick: close => close() },
        { label: t('record_sale'), kind: 'primary', onClick: close => {
            if (saving) return;
            if (payment === 'credit' && !contactId) { app.toast(t('select_customer_first')); return; }
            saving = true;
            recordSale(app, item, qty, price, payment, payment === 'credit' ? contactId : null);
            close();
          } },
      ],
    });
    upd();
  }

  function recordSale(app, item, qty, price, payment, contactId) {
    const now = new Date();
    const sale = {
      id: app.store.uid(), date: app.fmtDate(now), ts: now.toISOString(),
      itemId: item.id, name: item.name, qty, price, total: +(qty * price).toFixed(2),
      payment, contactId: contactId || null,
    };
    app.store.insert('sales', sale);
    app.emit('sale:recorded', sale);
    app.toast(app.t('sale_recorded'));
  }

  function undoSale(app, sale) {
    app.confirm(app.t('undo_sale'), { danger: true, ok: app.t('undo') }).then(ok => {
      if (!ok) return;
      app.store.del('sales', sale.id);
      app.emit('sale:undone', sale);
      app.toast(app.t('removed'));
    });
  }

  window.Hanout.module(MOD);
})();
