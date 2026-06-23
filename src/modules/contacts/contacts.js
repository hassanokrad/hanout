/* Hanout module — contacts (customers & suppliers) with history + balances. */
;(function () {
  const MOD = {
    id: 'contacts', secondary: true, order: 50, icon: '👥',
    title: { en: 'Contacts', fr: 'Contacts', ar: 'الزبناء' },
    strings: {
      en: { add_contact: 'Add contact', edit_contact: 'Edit contact', customers: 'Customers', suppliers: 'Suppliers',
        customer: 'Customer', supplier: 'Supplier', no_contacts: 'No contacts yet', delete_contact_q: 'Delete this contact?',
        recent_purchases: 'Recent purchases', name_required: 'Name is required', owes: 'owes', search_contacts: 'Search contacts…' },
      fr: { add_contact: 'Ajouter un contact', edit_contact: 'Modifier le contact', customers: 'Clients', suppliers: 'Fournisseurs',
        customer: 'Client', supplier: 'Fournisseur', no_contacts: 'Aucun contact', delete_contact_q: 'Supprimer ce contact ?',
        recent_purchases: 'Achats récents', name_required: 'Le nom est requis', owes: 'doit', search_contacts: 'Rechercher…' },
      ar: { add_contact: 'إضافة جهة', edit_contact: 'تعديل الجهة', customers: 'الزبناء', suppliers: 'الموردون',
        customer: 'زبون', supplier: 'مورد', no_contacts: 'لا توجد جهات بعد', delete_contact_q: 'حذف هذه الجهة؟',
        recent_purchases: 'آخر المشتريات', name_required: 'الاسم مطلوب', owes: 'عليه', search_contacts: 'بحث…' },
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      const st = app.tabState();
      let q = st.q || '', type = st.type || '';

      wrap.appendChild(el('div', { class: 'h-row', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-page-title', style: { margin: 0 } }, app.moduleTitle(MOD)),
        el('div', { class: 'h-spacer' }),
        el('button', { class: 'h-btn h-btn-primary', onClick: () => openForm(app, null) }, '+ ' + t('add_contact')),
      ]));

      const search = ui.input({ type: 'search', placeholder: t('search_contacts'), value: q, oninput: e => { q = e.target.value; st.q = q; renderList(); } });
      wrap.appendChild(el('div', { style: { marginBottom: '10px' } }, search));
      const chips = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
      [['', t('all')], ['customer', t('customers')], ['supplier', t('suppliers')]].forEach(([val, lbl], i) =>
        chips.appendChild(el('button', { class: 'h-chip' + (type === val ? ' active' : ''), onClick: () => { type = val; st.type = val; [...chips.children].forEach((c, j) => c.classList.toggle('active', ['', 'customer', 'supplier'][j] === val)); renderList(); } }, lbl)));
      wrap.appendChild(chips);

      const listCard = el('section', { class: 'h-card' });
      wrap.appendChild(listCard);
      function renderList() {
        ui.clear(listCard);
        const bal = balances(app);
        let list = store.all('contacts').slice();
        if (type) list = list.filter(c => c.type === type);
        if (q) { const qq = q.toLowerCase().trim(); list = list.filter(c => (c.name || '').toLowerCase().includes(qq) || (c.phone || '').includes(qq)); }
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        if (!list.length) { listCard.appendChild(ui.empty(t('no_contacts'), '👥')); return; }
        const inner = el('div', { class: 'h-list' });
        list.forEach(c => {
          const owed = c.type === 'customer' ? (bal[c.id] || 0) : 0;
          inner.appendChild(el('div', { class: 'h-list-item', onClick: () => openDetail(app, c.id) }, [
            el('div', { class: 'h-list-main' }, [
              el('div', { class: 'h-list-title' }, [c.name, ' ', ui.pill(c.type === 'supplier' ? t('supplier') : t('customer'), c.type === 'supplier' ? 'accent' : '')]),
              el('div', { class: 'h-list-sub' }, c.phone || '—'),
            ]),
            owed > 0.001 ? el('div', { class: 'h-list-end' }, ui.pill(money(owed), 'danger')) : null,
          ]));
        });
        listCard.appendChild(inner);
      }
      renderList();
      return wrap;
    },
  };

  function balances(app) {
    const m = {};
    app.store.all('debts').forEach(d => { m[d.contactId] = (m[d.contactId] || 0) + (d.kind === 'payment' ? -d.amount : d.amount); });
    return m;
  }

  function openDetail(app, cid) {
    const { el, store, t, money } = app, ui = app.ui;
    const c = store.find('contacts', cid);
    if (!c) return;
    const owed = c.type === 'customer' ? (balances(app)[cid] || 0) : 0;
    const purchases = store.all('sales').filter(s => s.contactId === cid).sort((a, b) => (a.ts < b.ts ? 1 : -1)).slice(0, 20);

    const body = el('div', {}, [
      el('div', { class: 'h-row', style: { marginBottom: '10px' } }, [
        el('div', {}, [
          el('div', { class: 'h-muted', style: { fontSize: '12px' } }, c.type === 'supplier' ? t('supplier') : t('customer')),
          c.phone ? el('div', {}, c.phone) : null,
        ]),
        el('div', { class: 'h-spacer' }),
        owed > 0.001 ? el('div', { class: 'h-center' }, [el('div', { class: 'h-list-amount h-danger' }, money(owed)), el('div', { class: 'h-muted', style: { fontSize: '11px' } }, t('owes'))]) : null,
      ]),
      el('button', { class: 'h-btn h-btn-block', onClick: () => { openForm(app, c); } }, t('edit_contact')),
    ]);
    if (purchases.length) {
      body.appendChild(el('div', { class: 'h-section-title' }, t('recent_purchases')));
      const list = el('div', { class: 'h-list' });
      purchases.forEach(s => list.appendChild(el('div', { class: 'h-list-item' }, [
        el('div', { class: 'h-list-main' }, [el('div', { class: 'h-list-title' }, s.name), el('div', { class: 'h-list-sub' }, s.date + ' · ' + (s.payment === 'credit' ? t('credit') : t('cash')))]),
        el('div', { class: 'h-list-end' }, money(s.total)),
      ])));
      body.appendChild(list);
    }
    app.sheet({ title: c.name, body });
  }

  function openForm(app, contact) {
    const { el, store, t } = app, ui = app.ui;
    const ed = !!contact; contact = contact || {};
    const name = ui.input({ value: contact.name || '', placeholder: t('name') });
    const phone = ui.input({ type: 'tel', value: contact.phone || '', placeholder: t('phone') });
    let type = contact.type || 'customer';
    const custBtn = el('button', { class: 'h-chip' + (type === 'customer' ? ' active' : ''), onClick: () => setType('customer') }, t('customer'));
    const supBtn = el('button', { class: 'h-chip' + (type === 'supplier' ? ' active' : ''), onClick: () => setType('supplier') }, t('supplier'));
    function setType(v) { type = v; custBtn.classList.toggle('active', v === 'customer'); supBtn.classList.toggle('active', v === 'supplier'); }

    const actions = [];
    if (ed) actions.push({ label: t('delete'), kind: 'danger', onClick: close => {
      app.confirm(t('delete_contact_q'), { danger: true, ok: t('delete') }).then(ok => { if (ok) { store.del('contacts', contact.id); close(); app.toast(t('deleted')); } });
    } });
    actions.push({ label: t('save'), kind: 'primary', onClick: close => {
      const n = name.value.trim();
      if (!n) { app.toast(t('name_required')); return; }
      store.upsert('contacts', { id: contact.id, name: n, type, phone: phone.value.trim() });
      close(); app.toast(t('saved'));
    } });

    app.sheet({
      title: ed ? t('edit_contact') : t('add_contact'),
      body: el('div', {}, [
        ui.field(t('name'), name),
        ui.field(t('type'), el('div', { class: 'h-chips' }, [custBtn, supBtn])),
        ui.field(t('phone') + ' (' + t('optional') + ')', phone),
      ]),
      actions,
    });
  }

  window.Hanout.module(MOD);
})();
