/* Hanout module — sales (point of sale). Core.
 * Tap products to build a ticket (cart), then check out once: pick cash/credit (+ a
 * customer for كريدي) and record the whole basket. Weight items (sold per kg) get a
 * quick amount entry on tap. Quick-sale adds a one-off custom line. */
;(function () {
  const round2 = (n) => Math.round(n * 100) / 100;

  const MOD = {
    id: 'sales', core: true, order: 10, icon: '🛒',
    title: { en: 'Sell', fr: 'Vendre', ar: 'بيع' },
    strings: {
      en: {
        todays_total: "Today's revenue", todays_sales: 'Recent sales', record_sale: 'Record sale',
        unit_price: 'Unit price', payment: 'Payment', customer: 'Customer', pick_customer: 'pick a customer',
        no_products: 'No products yet — add items in Inventory.', search_products: 'Search a product…',
        sale_recorded: 'Recorded', out_of_stock: 'out', in_stock: 'in stock',
        select_customer_first: 'Pick a customer for a credit sale', undo_sale: 'Undo this sale?',
        quick_sale: 'Quick sale', enter_price: 'Enter a price', add_to_cart: 'Add to cart',
        no_barcode_match: 'No product has that code yet.', enter_qty: 'Enter a quantity',
        cart_title: 'Cart', empty_cart: 'Cart is empty', in_ticket: '{n} in the ticket',
        vs_yesterday: 'vs yesterday', sales_word: 'sales', recorded_credit: 'Credit',
        new_product: 'New product', save_and_sell: 'Save & sell', sell_once_no_save: "Sell once, don't save", add_named: 'Add "{name}"',
      },
      fr: {
        todays_total: 'Recette du jour', todays_sales: 'Ventes récentes', record_sale: 'Enregistrer',
        unit_price: 'Prix unitaire', payment: 'Paiement', customer: 'Client', pick_customer: 'choisir un client',
        no_products: 'Aucun produit — ajoutez des articles dans Stock.', search_products: 'Chercher un produit…',
        sale_recorded: 'Enregistré', out_of_stock: 'épuisé', in_stock: 'en stock',
        select_customer_first: 'Choisissez un client pour une vente à crédit', undo_sale: 'Annuler cette vente ?',
        quick_sale: 'Vente rapide', enter_price: 'Saisissez un prix', add_to_cart: 'Au panier',
        no_barcode_match: "Aucun produit n'a ce code.", enter_qty: 'Saisissez une quantité',
        cart_title: 'Panier', empty_cart: 'Panier vide', in_ticket: '{n} dans le ticket',
        vs_yesterday: 'vs hier', sales_word: 'ventes', recorded_credit: 'Crédit',
        new_product: 'Nouveau produit', save_and_sell: 'Enregistrer & vendre', sell_once_no_save: 'Vendre une fois, sans enregistrer', add_named: 'Ajouter « {name} »',
      },
      ar: {
        todays_total: 'مداخيل اليوم', todays_sales: 'آخر المبيعات', record_sale: 'تسجيل البيع',
        unit_price: 'ثمن الوحدة', payment: 'الأداء', customer: 'الزبون', pick_customer: 'اختر زبوناً',
        no_products: 'لا توجد منتجات بعد — أضِف عناصر في المخزون.', search_products: 'ابحث عن منتج…',
        sale_recorded: 'تم التسجيل', out_of_stock: 'نفد', in_stock: 'متوفر',
        select_customer_first: 'اختر زبوناً للبيع بالكريدي', undo_sale: 'تراجع عن هذا البيع؟',
        quick_sale: 'بيع سريع', enter_price: 'أدخل الثمن', add_to_cart: 'أضف للسلة',
        no_barcode_match: 'لا يوجد منتج بهذا الرمز بعد.', enter_qty: 'أدخل الكمية',
        cart_title: 'السلة', empty_cart: 'السلة فارغة', in_ticket: '{n} في السلة',
        vs_yesterday: 'مقارنة بالأمس', sales_word: 'مبيعات', recorded_credit: 'كريدي',
        new_product: 'منتج جديد', save_and_sell: 'حفظ وبيع', sell_once_no_save: 'بيع مرة واحدة بدون حفظ', add_named: 'أضف «{name}»',
      },
    },

    view(app) {
      const { el, store, t, money, nf } = app, ui = app.ui;
      const st = app.tabState();
      const ticket = st.ticket = st.ticket || {};      // { key: {key,itemId,name,price,cost,unit,qty} }
      const wrap = el('div');

      const today = app.todayKey();
      const allSales = store.all('sales');
      const todays = allSales.filter(s => s.date === today);
      const todayTotal = todays.reduce((a, s) => a + s.total, 0);

      // ---- today hero (revenue + count + trend vs yesterday) ----
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      const yKey = app.fmtDate(yd);
      const yTotal = allSales.filter(s => s.date === yKey).reduce((a, s) => a + s.total, 0);
      const meta = [el('span', {}, [el('b', {}, nf(todays.length, 0)), ' ' + t('sales_word')])];
      if (yTotal > 0) {
        const pct = Math.round((todayTotal - yTotal) / yTotal * 100), up = pct >= 0;
        meta.push(el('span', { class: 'h-hero-sep' }));
        meta.push(el('span', {}, (up ? '▲ ' : '▼ ') + Math.abs(pct) + '% ' + t('vs_yesterday')));
      }
      wrap.appendChild(el('div', { class: 'h-hero' }, [
        el('div', { class: 'h-hero-eyebrow' }, t('todays_total')),
        el('div', { class: 'h-hero-num' }, money(todayTotal)),
        el('div', { class: 'h-hero-meta' }, meta),
      ]));

      // ---- search + scan ----
      const stUI = st;
      let q = stUI.q || '', cat = stUI.cat || '';
      const searchInput = el('input', { type: 'search', placeholder: t('search_products'), value: q,
        oninput: e => { q = e.target.value; stUI.q = q; renderGrid(); } });
      wrap.appendChild(el('div', { class: 'h-searchrow', style: { marginTop: '16px' } }, [
        el('div', { class: 'h-searchbox' }, [
          el('span', { html: ICON.search }),
          searchInput,
        ]),
        el('button', { class: 'h-iconbtn-dark', 'aria-label': t('scan'), onClick: () => openScanner(app) }, el('span', { html: ICON.scan })),
      ]));

      // ---- category chips ----
      const activeItems = () => store.all('items').filter(i => i.active !== false);
      const cats = Array.from(new Set(activeItems().map(i => i.category).filter(Boolean)));
      const chipRow = el('div', { class: 'h-chips scroll', style: { marginTop: '14px' } });
      function renderChips() {
        ui.clear(chipRow);
        [['', t('all')]].concat(cats.map(c => [c, c])).forEach(([val, lbl]) =>
          chipRow.appendChild(el('button', { class: 'h-chip' + (cat === val ? ' active' : ''), onClick: () => { cat = val; stUI.cat = val; renderChips(); renderGrid(); } }, lbl)));
      }
      if (cats.length) { renderChips(); wrap.appendChild(chipRow); }

      // ---- product grid ----
      const grid = el('div', { class: 'h-prodgrid', style: { marginTop: '12px' } });
      function renderGrid() {
        ui.clear(grid);
        let list = activeItems();
        if (cat) list = list.filter(i => i.category === cat);
        if (q) { const qq = q.toLowerCase().trim(); list = list.filter(i => (i.name || '').toLowerCase().includes(qq) || (i.barcode || '').toLowerCase().includes(qq)); }
        // searched for something not in the catalogue → offer to add it on the spot
        if (!list.length && q.trim()) {
          grid.appendChild(el('button', { class: 'h-addcard', style: { gridColumn: '1 / -1' }, onClick: () => openNewProduct(app, q.trim()) }, [
            el('span', { class: 'h-prod-plus' }, '＋'),
            el('span', {}, t('add_named', { name: q.trim() })),
          ]));
        } else if (!list.length && store.all('items').length) {
          grid.appendChild(el('div', { style: { gridColumn: '1 / -1' } }, ui.empty(t('empty_here'), '🔍')));
        }
        list.forEach(it => {
          const low = it.stock != null && it.stock > 0 && it.stock <= 3;
          const out = it.stock != null && it.stock <= 0;
          const inQty = ticket[it.id] ? ticket[it.id].qty : 0;
          grid.appendChild(el('button', { class: 'h-prod' + (low ? ' low' : '') + (out ? ' out' : '') + (inQty ? ' in' : ''), onClick: () => tapProduct(it) }, [
            inQty ? el('span', { class: 'h-prod-badge' }, nf(inQty, 3)) : null,
            el('div', { class: 'h-prod-name' }, it.name),
            el('div', { class: 'h-prod-price' }, [el('b', {}, nf(it.price)), el('span', {}, ui.cfg.currency)]),
            it.stock != null ? el('div', { class: 'h-prod-stock' }, out ? t('out_of_stock') : (nf(it.stock, 3) + ' ' + (it.unit || ''))) : el('div', { class: 'h-prod-stock' }, ' '),
          ]));
        });
        // add a brand-new product (saves to the catalogue) — the start-empty / first-sale path
        grid.appendChild(el('button', { class: 'h-prod add', onClick: () => openNewProduct(app, '') }, [
          el('div', { class: 'h-prod-plus' }, '＋'),
          el('div', {}, t('new_product')),
        ]));
      }
      renderGrid();
      wrap.appendChild(grid);

      // ---- recent sales (today) with undo ----
      if (todays.length) {
        wrap.appendChild(el('div', { class: 'h-section-title' }, t('todays_sales')));
        const list = el('div', { class: 'h-list' });
        todays.slice().reverse().slice(0, 8).forEach(s => {
          list.appendChild(el('div', { class: 'h-list-item' }, [
            el('div', { class: 'h-list-main' }, [
              el('div', { class: 'h-list-title' }, s.name),
              el('div', { class: 'h-list-sub' }, app.fmtTime(s.ts) + (s.qty !== 1 ? ' · ' + nf(s.qty, 3) + (s.unit ? ' ' + s.unit : '') + ' × ' + money(s.price) : '') + ' · ' + (s.payment === 'credit' ? t('credit') : t('cash'))),
            ]),
            el('div', { class: 'h-list-end' }, el('div', { class: 'h-list-amount' }, money(s.total))),
            el('button', { class: 'h-link', onClick: () => undoSale(app, s) }, t('undo')),
          ]));
        });
        wrap.appendChild(ui.card(null, list));
      }

      // ---- ticket bar (fixed above nav) ----
      const ticketHost = el('div');
      wrap.appendChild(ticketHost);
      function updateTicketBar() {
        ui.clear(ticketHost);
        const lines = Object.values(ticket);
        const count = lines.reduce((a, l) => a + l.qty, 0);
        if (!lines.length) { wrap.style.paddingBottom = ''; return; }
        const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
        ticketHost.appendChild(el('div', { class: 'h-ticketbar' }, el('button', { class: 'h-ticketbtn', onClick: () => openCheckout(app, renderAll) }, [
          el('span', { class: 'h-ticketbtn-count' }, nf(count, 3)),
          el('span', { class: 'h-ticketbtn-lbl' }, t('in_ticket', { n: lines.length })),
          el('span', { class: 'h-ticketbtn-total' }, [money(total), el('span', { html: ICON.arrow })]),
        ])));
        wrap.style.paddingBottom = '78px';   // keep content clear of the fixed bar
      }

      // mutate ticket, then refresh just the grid badges + the ticket bar (keeps scroll/focus)
      function tapProduct(it) {
        if (it.unit === 'كغ') { openWeightEntry(app, it, ticket[it.id] ? ticket[it.id].qty : 0, (kg) => { setLine(it, kg, true); renderGrid(); updateTicketBar(); }); return; }
        setLine(it, 1, false);
        renderGrid(); updateTicketBar();
      }
      function setLine(it, qty, replace) {
        const key = it.id;
        const cur = ticket[key];
        const next = replace ? qty : ((cur ? cur.qty : 0) + qty);
        if (next <= 0) { delete ticket[key]; return; }
        ticket[key] = { key, itemId: it.id, name: it.name, price: +it.price || 0, cost: +it.cost || 0, unit: it.unit || '', qty: +next.toFixed(3) };
      }
      function renderAll() { app.refresh(); }   // full re-render (after checkout commits)

      updateTicketBar();
      return wrap;
    },
  };

  // weight items: a quick kg entry (decimal + 0.1 steppers + live total)
  function openWeightEntry(app, item, current, onConfirm) {
    const { el, t, money, nf } = app, ui = app.ui;
    let qty = current > 0 ? current : 0.5;
    const totalEl = el('div', { class: 'h-bignum h-accent' });
    const input = ui.input({ type: 'number', inputmode: 'decimal', step: 'any', min: '0', value: String(qty),
      style: { textAlign: 'center', maxWidth: '130px', fontWeight: '800', fontSize: '20px' },
      oninput: e => { qty = parseFloat(e.target.value) || 0; upd(); } });
    const upd = () => { totalEl.textContent = money(qty * (+item.price || 0)); };
    const step = (d) => { qty = Math.max(0, +(((parseFloat(input.value) || 0) + d).toFixed(3))); input.value = qty; upd(); };
    let ref;
    ref = app.sheet({
      title: item.name,
      body: el('div', {}, [
        ui.field(t('unit_price'), null, money(item.price) + ' / ' + (item.unit || '')),
        ui.field(t('quantity') + ' · ' + (item.unit || ''), el('div', { class: 'h-row h-center', style: { gap: '10px', justifyContent: 'center' } }, [
          el('button', { class: 'h-step h-step-minus', type: 'button', onClick: () => step(-0.1) }, '−'),
          input,
          el('button', { class: 'h-step h-step-plus', type: 'button', onClick: () => step(0.1) }, '+'),
        ])),
        el('div', { class: 'h-row h-mt' }, [el('span', { class: 'h-muted' }, t('total')), el('div', { class: 'h-spacer' }), totalEl]),
      ]),
      actions: [
        { label: t('cancel'), onClick: close => close() },
        { label: t('add_to_cart'), kind: 'primary', onClick: close => { if (qty <= 0) { app.toast(t('enter_qty')); return; } onConfirm(qty); close(); } },
      ],
    });
    upd();
  }

  // New product (the easy-onboarding path): only name + price are required — the rest is
  // optional and tucked away. Saves to the catalogue AND drops it in the ticket, so a new
  // shop builds its product list simply by selling. A one-off link sells without saving.
  function openNewProduct(app, prefill) {
    const { el, store, t } = app, ui = app.ui;
    const ticket = (function () { const st = app.tabState('sales'); return st.ticket = st.ticket || {}; })();
    const cats = Array.from(new Set(store.all('items').map(i => i.category).filter(Boolean)));
    const f = {
      name: ui.input({ value: prefill || '', placeholder: t('name') }),
      price: ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', placeholder: '0' }),
      category: ui.input({ value: '', placeholder: t('category'), list: 'h-np-cats' }),
      unit: ui.input({ value: '', placeholder: 'حبة' }),
      cost: ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', placeholder: '0' }),
      stock: ui.input({ type: 'number', inputmode: 'decimal', step: 'any', placeholder: '' }),
      barcode: ui.input({ value: '', placeholder: t('barcode'), style: { flex: '1', minWidth: '0' } }),
    };
    const lineOf = (item, qty) => ({ key: item.id, itemId: item.id, name: item.name, price: +item.price || 0, cost: +item.cost || 0, unit: item.unit || '', qty });
    function addToTicket(item) {
      if (item.unit === 'كغ') openWeightEntry(app, item, 0, (kg) => { ticket[item.id] = lineOf(item, kg); app.refresh(); });
      else { const cur = ticket[item.id]; ticket[item.id] = lineOf(item, (cur ? cur.qty : 0) + 1); app.refresh(); }
    }
    let ref;
    ref = app.sheet({
      title: t('new_product'),
      body: el('div', {}, [
        el('datalist', { id: 'h-np-cats' }, cats.map(c => el('option', { value: c }))),
        ui.field(t('name'), f.name),
        ui.field(t('sell_price'), f.price),
        el('details', { class: 'h-details' }, [
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
        el('button', { class: 'h-link', style: { marginTop: '2px', paddingInline: '0' }, onClick: () => {
            const price = parseFloat(f.price.value) || 0;
            if (price <= 0) { app.toast(t('enter_price')); return; }
            const key = 'q' + store.uid();
            ticket[key] = { key, itemId: null, name: f.name.value.trim() || t('custom'), price, cost: 0, unit: '', qty: 1 };
            ref.close(); app.refresh();
          } }, t('sell_once_no_save')),
      ]),
      actions: [
        { label: t('cancel'), onClick: close => close() },
        { label: t('save_and_sell'), kind: 'primary', onClick: close => {
            const name = f.name.value.trim();
            const price = parseFloat(f.price.value) || 0;
            if (!name) { app.toast(t('name_required')); return; }
            if (price <= 0) { app.toast(t('enter_price')); return; }
            const sku = store.upsert('items', {
              id: store.uid(), name, category: f.category.value.trim(),
              price: Math.max(0, price), cost: Math.max(0, parseFloat(f.cost.value) || 0),
              stock: f.stock.value === '' ? null : Math.max(0, +((parseFloat(f.stock.value) || 0).toFixed(3))),
              unit: f.unit.value.trim() || 'حبة', barcode: f.barcode.value.trim(), active: true,
            });
            close(); addToTicket(sku);
          } },
      ],
    });
  }

  // checkout: review lines, pick payment (+ customer for credit), record the basket
  function openCheckout(app, after) {
    const { el, store, t, money, nf } = app, ui = app.ui;
    const st = app.tabState('sales'); const ticket = st.ticket = st.ticket || {};
    let payment = 'cash', contactId = '';
    const customers = store.all('contacts').filter(c => c.type === 'customer');
    const body = el('div', {});
    let ref;

    function commit() {
      const lines = Object.values(ticket);
      if (!lines.length) return;
      if (payment === 'credit' && !contactId) { app.toast(t('select_customer_first')); return; }
      const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
      const now = new Date(), ts = now.toISOString(), date = app.fmtDate(now);
      // record one sale per line, sharing timestamp/payment/customer (a single basket).
      // existing hooks fire per line: inventory decrements, debts charges the customer.
      Object.keys(ticket).forEach(k => delete ticket[k]);   // clear before inserts re-render the view
      ref.close();
      lines.forEach(l => {
        const sale = {
          id: store.uid(), date, ts, itemId: l.itemId, name: l.name,
          qty: +(+l.qty).toFixed(3), price: Math.max(0, +l.price || 0), total: round2(l.qty * l.price),
          cost: Math.max(0, +l.cost || 0), unit: l.unit || '',
          payment, contactId: payment === 'credit' ? contactId : null,
        };
        store.insert('sales', sale);
        app.emit('sale:recorded', sale);
      });
      const cust = (customers.find(c => c.id === contactId) || {}).name;
      app.toast(payment === 'credit' ? (t('recorded_credit') + ' · ' + (cust || '') + ' · ' + money(total)) : (t('sale_recorded') + ' · ' + money(total)));
      after && after();
    }

    function render() {
      ui.clear(body);
      const lines = Object.values(ticket);
      if (!lines.length) { body.appendChild(ui.empty(t('empty_cart'), '🛒')); return; }

      // lines
      const lineCard = el('div', { class: 'h-card', style: { padding: '0', marginBottom: '14px', overflow: 'hidden' } });
      lines.forEach((l, i) => {
        const weight = l.unit === 'كغ';
        const qtyEl = weight
          ? el('button', { class: 'h-stepval h-link', style: { minWidth: '40px' }, onClick: () => openWeightEntry(app, l, l.qty, (kg) => { if (kg <= 0) delete ticket[l.key]; else l.qty = kg; render(); }) }, nf(l.qty, 3))
          : el('span', { class: 'h-stepval' }, nf(l.qty, 0));
        lineCard.appendChild(el('div', { class: 'h-row', style: { gap: '12px', padding: '11px 13px', borderBottom: i < lines.length - 1 ? '1px solid var(--divider)' : '0' } }, [
          el('div', { class: 'h-list-main' }, [
            el('div', { class: 'h-list-title' }, l.name),
            el('div', { class: 'h-list-sub' }, money(l.price) + (l.unit ? ' / ' + l.unit : '')),
          ]),
          el('div', { class: 'h-row', style: { gap: '9px' } }, [
            el('button', { class: 'h-step h-step-minus', onClick: () => { l.qty = +(l.qty - (weight ? 0.1 : 1)).toFixed(3); if (l.qty <= 0) delete ticket[l.key]; render(); } }, '−'),
            qtyEl,
            el('button', { class: 'h-step h-step-plus', onClick: () => { l.qty = +(l.qty + (weight ? 0.1 : 1)).toFixed(3); render(); } }, '+'),
          ]),
          el('div', { style: { flex: '0 0 64px', textAlign: 'end', fontWeight: '800', fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' } }, money(l.price * l.qty)),
        ]));
      });
      body.appendChild(lineCard);

      // payment
      body.appendChild(el('div', { class: 'h-section-title', style: { margin: '0 2px 9px' } }, t('payment')));
      const cashBtn = el('button', { class: 'h-pay' + (payment === 'cash' ? ' active' : ''), onClick: () => { payment = 'cash'; render(); } }, [el('span', { html: ICON.cash }), t('cash')]);
      const creditBtn = el('button', { class: 'h-pay' + (payment === 'credit' ? ' active' : ''), onClick: () => { payment = 'credit'; render(); } }, [el('span', { html: ICON.credit }), t('credit')]);
      body.appendChild(el('div', { class: 'h-row', style: { gap: '10px', marginBottom: '13px' } }, [cashBtn, creditBtn]));

      // customer (credit only)
      if (payment === 'credit') {
        body.appendChild(el('div', { class: 'h-section-title', style: { margin: '0 2px 9px' } }, t('customer')));
        const chips = el('div', { class: 'h-chips', style: { marginBottom: '4px' } });
        if (!customers.length) chips.appendChild(el('span', { class: 'h-muted', style: { fontSize: '13px' } }, t('pick_customer')));
        customers.forEach(c => chips.appendChild(el('button', { class: 'h-chip' + (contactId === c.id ? ' active' : ''), onClick: () => { contactId = c.id; render(); } }, c.name)));
        body.appendChild(chips);
      }
      // grand total
      const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
      body.appendChild(el('div', { style: { marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-2)' } }, [
        el('div', { class: 'h-muted', style: { fontSize: '12px', fontWeight: '600' } }, t('total')),
        el('div', { style: { fontSize: '24px', fontWeight: '800', letterSpacing: '-.4px', fontVariantNumeric: 'tabular-nums' } }, money(total)),
      ]));
    }

    render();
    ref = app.sheet({
      title: t('cart_title'),
      body,
      actions: [
        { label: t('cancel'), onClick: close => close() },
        { label: t('record_sale'), kind: 'primary', onClick: () => commit() },
      ],
    });
  }

  function undoSale(app, sale) {
    app.confirm(app.t('undo_sale'), { danger: true, ok: app.t('undo') }).then(ok => {
      if (!ok) return;
      app.store.del('sales', sale.id);
      app.emit('sale:undone', sale);
      app.toast(app.t('removed'));
    });
  }

  // POS scan: read a barcode (shared core scanner) and add the matching item to the ticket
  function openScanner(app) {
    app.scanBarcode(function (code) {
      const item = app.store.all('items').find(i => (i.barcode || '').trim() === code && i.active !== false);
      if (!item) { app.toast(app.t('no_barcode_match')); return; }
      const st = app.tabState('sales'); const ticket = st.ticket = st.ticket || {};
      if (item.unit === 'كغ') {
        openWeightEntry(app, item, ticket[item.id] ? ticket[item.id].qty : 0, (kg) => {
          ticket[item.id] = { key: item.id, itemId: item.id, name: item.name, price: +item.price || 0, cost: +item.cost || 0, unit: item.unit, qty: kg };
          app.refresh();
        });
      } else {
        const cur = ticket[item.id];
        ticket[item.id] = { key: item.id, itemId: item.id, name: item.name, price: +item.price || 0, cost: +item.cost || 0, unit: item.unit || '', qty: (cur ? cur.qty : 0) + 1 };
        app.refresh();
      }
    });
  }

  // inline line icons (stroke, rounded) — match the design language, no dependency
  const ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.2-3.2"/></svg>',
    scan: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 8V6a2 2 0 0 1 2-2h2M17 4h2a2 2 0 0 1 2 2v2M21 16v2a2 2 0 0 1-2 2h-2M7 20H5a2 2 0 0 1-2-2v-2"/><path d="M3 12h18" stroke-width="2.2"/></svg>',
    arrow: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    cash: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.6"/></svg>',
    credit: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v10H3z"/><path d="M3 10h18"/></svg>',
  };

  window.Hanout.module(MOD);
})();
