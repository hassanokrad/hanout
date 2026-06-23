/* Hanout module — sales (point of sale). Core. Tap a product → record a sale. */
;(function () {
  const MOD = {
    id: 'sales', core: true, order: 10, icon: '🛒',
    title: { en: 'Sell', fr: 'Vendre', ar: 'بيع' },
    strings: {
      en: {
        todays_total: "Today's total", todays_sales: "Today's sales", record_sale: 'Record sale',
        unit_price: 'Unit price', payment: 'Payment', customer: 'Customer', pick_customer: 'pick a customer',
        no_products: 'No products yet — use Quick sale, or add items in Inventory.', search_products: 'Search products…',
        sale_recorded: 'Sale recorded', out_of_stock: 'out', in_stock: 'in stock',
        select_customer_first: 'Pick a customer for a credit sale', undo_sale: 'Undo this sale?',
        quick_sale: 'Quick sale', enter_price: 'Enter a price',
        scan: 'Scan', point_at_barcode: 'Point the camera at a barcode', camera_error: 'Could not open the camera.', no_barcode_match: 'No product has that code yet.',
        scan_title: 'Scan barcode', scan_unsupported: 'Scanning isn’t available here — you can type a barcode onto an item in Inventory instead.',
      },
      fr: {
        todays_total: 'Total du jour', todays_sales: 'Ventes du jour', record_sale: 'Enregistrer la vente',
        unit_price: 'Prix unitaire', payment: 'Paiement', customer: 'Client', pick_customer: 'choisir un client',
        no_products: 'Aucun produit — utilisez Vente rapide, ou ajoutez des articles dans Stock.', search_products: 'Rechercher un produit…',
        sale_recorded: 'Vente enregistrée', out_of_stock: 'épuisé', in_stock: 'en stock',
        select_customer_first: 'Choisissez un client pour une vente à crédit', undo_sale: 'Annuler cette vente ?',
        quick_sale: 'Vente rapide', enter_price: 'Saisissez un prix',
        scan: 'Scanner', point_at_barcode: 'Pointez la caméra vers un code-barres', camera_error: "Impossible d'ouvrir la caméra.", no_barcode_match: "Aucun produit n'a ce code pour l'instant.",
        scan_title: 'Scanner un code-barres', scan_unsupported: "Le scan n'est pas disponible ici — saisissez un code-barres sur un article dans Stock.",
      },
      ar: {
        todays_total: 'مجموع اليوم', todays_sales: 'مبيعات اليوم', record_sale: 'تسجيل البيع',
        unit_price: 'ثمن الوحدة', payment: 'الأداء', customer: 'الزبون', pick_customer: 'اختر زبوناً',
        no_products: 'لا توجد منتجات بعد — استعمل البيع السريع، أو أضِف عناصر في المخزون.', search_products: 'ابحث عن منتج…',
        sale_recorded: 'تم تسجيل البيع', out_of_stock: 'نفد', in_stock: 'متوفر',
        select_customer_first: 'اختر زبوناً للبيع بالكريدي', undo_sale: 'تراجع عن هذا البيع؟',
        quick_sale: 'بيع سريع', enter_price: 'أدخل الثمن',
        scan: 'مسح', point_at_barcode: 'وجّه الكاميرا نحو الباركود', camera_error: 'تعذّر فتح الكاميرا.', no_barcode_match: 'لا يوجد منتج بهذا الرمز بعد.',
        scan_title: 'مسح الباركود', scan_unsupported: 'المسح غير متاح هنا — يمكنك إضافة الباركود يدويًا لعنصر في المخزون.',
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

      // Scan a barcode + quick/custom sale. Both are always shown so they're discoverable;
      // the scanner explains itself if the device/browser can't do camera scanning.
      wrap.appendChild(el('div', { class: 'h-row', style: { gap: '10px', marginBottom: '12px' } }, [
        el('button', { class: 'h-btn h-spacer', onClick: () => openScanner(app) }, '📷 ' + t('scan')),
        el('button', { class: 'h-btn h-spacer', onClick: () => openSale(app, null) }, '＋ ' + t('quick_sale')),
      ]));

      // search + category, persisted across re-renders so filters survive a sale
      const st = app.tabState();
      let q = st.q || '', cat = st.cat || '';
      const search = ui.input({ type: 'search', placeholder: t('search_products'), value: q, oninput: e => { q = e.target.value; st.q = q; renderGrid(); } });
      wrap.appendChild(el('div', { style: { marginBottom: '10px' } }, search));

      const activeItems = () => store.all('items').filter(i => i.active !== false);
      const cats = Array.from(new Set(activeItems().map(i => i.category).filter(Boolean)));
      const chipRow = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
      function renderChips() {
        ui.clear(chipRow);
        [['', t('all')]].concat(cats.map(c => [c, c])).forEach(([val, lbl]) =>
          chipRow.appendChild(el('button', { class: 'h-chip' + (cat === val ? ' active' : ''), onClick: () => { cat = val; st.cat = val; renderChips(); renderGrid(); } }, lbl)));
      }
      if (cats.length) { renderChips(); wrap.appendChild(chipRow); }

      const grid = el('div', { class: 'h-prodgrid' });
      function renderGrid() {
        ui.clear(grid);
        let list = activeItems();
        if (cat) list = list.filter(i => i.category === cat);
        if (q) { const qq = q.toLowerCase().trim(); list = list.filter(i => (i.name || '').toLowerCase().includes(qq) || (i.barcode || '').toLowerCase().includes(qq)); }
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
    const custom = !item;                                   // a quick sale not tied to any catalogue item
    let name = custom ? '' : item.name;
    let qty = 1, price = custom ? 0 : (+item.price || 0), payment = 'cash', contactId = '';
    const customers = store.all('contacts').filter(c => c.type === 'customer');

    const totalEl = el('div', { class: 'h-bignum h-accent' });
    const qtyEl = el('span', { style: { minWidth: '38px', textAlign: 'center', fontWeight: '700', fontSize: '18px' } }, String(qty));
    const upd = () => { totalEl.textContent = money(qty * price); };

    const nameInput = custom ? ui.input({ value: '', placeholder: t('name'), oninput: e => { name = e.target.value; } }) : null;
    const priceInput = ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: String(price), oninput: e => { price = parseFloat(e.target.value) || 0; upd(); } });

    const custField = ui.field(t('customer'),
      ui.select([{ value: '', label: '— ' + t('pick_customer') + ' —' }].concat(customers.map(c => ({ value: c.id, label: c.name }))), { onchange: e => { contactId = e.target.value; } }));
    custField.style.display = 'none';

    const cashBtn = el('button', { class: 'h-chip active', onClick: () => setPay('cash') }, t('cash'));
    const creditBtn = el('button', { class: 'h-chip', onClick: () => setPay('credit') }, t('credit'));
    function setPay(p) { payment = p; cashBtn.classList.toggle('active', p === 'cash'); creditBtn.classList.toggle('active', p === 'credit'); custField.style.display = p === 'credit' ? '' : 'none'; }

    let saving = false;
    app.sheet({
      autofocus: custom,                                    // focus the name field for a quick sale; keep the keyboard down for catalogue taps
      title: custom ? t('quick_sale') : item.name,
      body: el('div', {}, [
        custom ? ui.field(t('name'), nameInput) : null,
        ui.field(t('unit_price'), priceInput,
          (!custom && item.stock != null) ? (item.stock <= 0 ? t('out_of_stock') : item.stock + ' ' + (item.unit || '') + ' ' + t('in_stock')) : null),
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
            if (price <= 0) { app.toast(t('enter_price')); return; }
            if (payment === 'credit' && !contactId) { app.toast(t('select_customer_first')); return; }
            saving = true;
            const saleItem = custom ? { id: null, name: name.trim() || t('custom') } : item;
            recordSale(app, saleItem, qty, price, payment, payment === 'credit' ? contactId : null);
            close();
          } },
      ],
    });
    upd();
  }

  function recordSale(app, item, qty, price, payment, contactId) {
    const now = new Date();
    price = Math.max(0, +price || 0); qty = Math.max(1, parseInt(qty, 10) || 1);
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

  // Camera barcode scan via the native BarcodeDetector API (no dependency). Opens the
  // rear camera, polls for a code, matches it to an item's `barcode`, and opens its sale
  // sheet. The Scan button is only shown when this API + getUserMedia are available.
  function openScanner(app) {
    const { el, store, t } = app;
    // Camera scan needs the native BarcodeDetector API + a camera on a secure origin
    // (https or localhost). Where that's missing, say so plainly instead of failing silently.
    if (!('BarcodeDetector' in window) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      app.toast(t('scan_unsupported'));
      return;
    }
    let stream = null, timer = null, detector = null, closed = false, busy = false, ref;
    const video = el('video', { autoplay: true, muted: true, playsinline: true });
    video.muted = true; video.setAttribute('playsinline', '');

    ref = app.sheet({
      title: '📷 ' + t('scan_title'),
      body: el('div', {}, [
        el('div', { class: 'h-scan' }, [video, el('div', { class: 'h-scan-frame' })]),
        el('div', { class: 'h-muted h-center', style: { marginTop: '10px', fontSize: '13px' } }, t('point_at_barcode')),
      ]),
      onClose: stop,
    });

    function stop() {
      closed = true;
      if (timer) { clearInterval(timer); timer = null; }
      if (stream) { stream.getTracks().forEach(tr => tr.stop()); stream = null; }
    }
    try { detector = new window.BarcodeDetector(); } catch (e) { detector = null; }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
      if (closed) { s.getTracks().forEach(tr => tr.stop()); return; }
      stream = s; video.srcObject = s;
      const p = video.play(); if (p && p.catch) p.catch(() => {});
      timer = setInterval(tick, 350);
    }).catch(() => { app.toast(t('camera_error')); ref.close(); });

    function tick() {
      if (busy || closed || !detector || !video.videoWidth) return;
      busy = true;
      detector.detect(video).then(codes => {
        busy = false;
        if (closed || !codes || !codes.length) return;
        const raw = (codes[0].rawValue || '').trim();
        if (raw) onCode(raw);
      }).catch(() => { busy = false; });
    }
    function onCode(code) {
      stop(); ref.close();
      const item = store.all('items').find(i => (i.barcode || '').trim() === code && i.active !== false);
      if (item) openSale(app, item);
      else app.toast(t('no_barcode_match'));
    }
  }

  window.Hanout.module(MOD);
})();
