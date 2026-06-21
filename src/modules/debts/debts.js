/* Hanout module — debts (the credit book / كريدي). Tracks who owes what. */
;(function () {
  const MOD = {
    id: 'debts', order: 30, icon: '📒',
    title: { en: 'Debts', fr: 'Crédits', ar: 'الكريدي' },
    strings: {
      en: {
        total_outstanding: 'Total outstanding', record_payment: 'Record payment', add_charge: 'Add charge',
        owes: 'owes', settled: 'All settled — nobody owes anything', pick_contact: 'Pick a customer',
        charge: 'Charge', a_payment: 'Payment', amount_gt0: 'Enter an amount', repayment: 'Repayment',
      },
      fr: {
        total_outstanding: 'Total dû', record_payment: 'Enregistrer un paiement', add_charge: 'Ajouter une dette',
        owes: 'doit', settled: 'Tout est réglé — personne ne doit rien', pick_contact: 'Choisir un client',
        charge: 'Dette', a_payment: 'Paiement', amount_gt0: 'Saisissez un montant', repayment: 'Remboursement',
      },
      ar: {
        total_outstanding: 'المجموع المتبقي', record_payment: 'تسجيل دفعة', add_charge: 'إضافة دين',
        owes: 'عليه', settled: 'كل شيء مسدد — لا أحد مدين', pick_contact: 'اختر زبوناً',
        charge: 'دين', a_payment: 'دفعة', amount_gt0: 'أدخل مبلغاً', repayment: 'تسديد',
      },
    },

    setup(app) {
      app.on('sale:recorded', s => {
        if (s.payment === 'credit' && s.contactId)
          app.store.insert('debts', { id: app.store.uid(), contactId: s.contactId, kind: 'charge', amount: s.total, date: s.date, ts: s.ts, saleId: s.id, note: s.name });
      });
      app.on('sale:undone', s => {
        if (s.payment === 'credit' && s.contactId) {
          const charge = app.store.all('debts').find(d => d.saleId === s.id);
          if (charge) app.store.del('debts', charge.id);
        }
      });
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      const bal = balances(app);
      const contacts = store.all('contacts');
      const cname = id => (contacts.find(c => c.id === id) || {}).name || '—';
      const total = Object.keys(bal).reduce((s, id) => s + Math.max(0, bal[id]), 0);

      wrap.appendChild(el('div', { class: 'h-row', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-page-title', style: { margin: 0 } }, app.moduleTitle(MOD)),
        el('div', { class: 'h-spacer' }),
        el('button', { class: 'h-btn h-btn-primary', onClick: () => openEntry(app, null, 'payment') }, '+ ' + t('record_payment')),
      ]));
      wrap.appendChild(ui.card(null, el('div', {}, [
        el('div', { class: 'h-bignum ' + (total > 0 ? 'h-danger' : 'h-ok') }, money(total)),
        el('div', { class: 'h-muted', style: { fontSize: '12.5px' } }, t('total_outstanding')),
      ])));

      const owing = Object.keys(bal).filter(id => bal[id] > 0.001).sort((a, b) => bal[b] - bal[a]);
      if (!owing.length) {
        wrap.appendChild(ui.card(null, el('div', { class: 'h-row h-ok' }, [el('span', {}, '✅'), el('span', {}, t('settled'))])));
        return wrap;
      }
      const list = el('div', { class: 'h-list' });
      owing.forEach(id => list.appendChild(el('div', { class: 'h-list-item', onClick: () => openContact(app, id) }, [
        el('div', { class: 'h-list-main' }, [
          el('div', { class: 'h-list-title' }, cname(id)),
          el('div', { class: 'h-list-sub' }, t('owes')),
        ]),
        el('div', { class: 'h-list-end' }, ui.pill(money(bal[id]), 'danger')),
      ])));
      wrap.appendChild(ui.card(null, list));
      return wrap;
    },
  };

  function ledger(app, cid) { return app.store.all('debts').filter(d => d.contactId === cid).sort((a, b) => (a.ts < b.ts ? -1 : 1)); }
  function balanceOf(app, cid) { return ledger(app, cid).reduce((s, d) => s + (d.kind === 'payment' ? -d.amount : d.amount), 0); }
  function balances(app) {
    const m = {};
    app.store.all('debts').forEach(d => { m[d.contactId] = (m[d.contactId] || 0) + (d.kind === 'payment' ? -d.amount : d.amount); });
    return m;
  }

  function openContact(app, cid) {
    const { el, store, t, money } = app, ui = app.ui;
    const c = store.find('contacts', cid) || { name: '—' };
    const body = el('div', {});
    function render() {
      ui.clear(body);
      const balance = balanceOf(app, cid);
      body.appendChild(el('div', { class: 'h-center', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-bignum ' + (balance > 0 ? 'h-danger' : 'h-ok') }, money(Math.max(0, balance))),
        el('div', { class: 'h-muted', style: { fontSize: '12px' } }, balance > 0 ? t('owes') : t('settled')),
      ]));
      body.appendChild(el('div', { class: 'h-row', style: { gap: '10px', marginBottom: '12px' } }, [
        el('button', { class: 'h-btn h-btn-primary h-spacer', onClick: () => openEntry(app, cid, 'payment', render) }, t('record_payment')),
        el('button', { class: 'h-btn h-spacer', onClick: () => openEntry(app, cid, 'charge', render) }, t('add_charge')),
      ]));
      const led = ledger(app, cid).slice().reverse();
      const list = el('div', { class: 'h-list' });
      if (!led.length) list.appendChild(ui.empty());
      led.forEach(d => {
        const pay = d.kind === 'payment';
        list.appendChild(el('div', { class: 'h-list-item' }, [
          el('div', { class: 'h-list-main' }, [
            el('div', { class: 'h-list-title' }, pay ? t('a_payment') : (d.note || t('charge'))),
            el('div', { class: 'h-list-sub' }, d.date),
          ]),
          el('div', { class: 'h-list-end' }, el('span', { class: 'h-list-amount ' + (pay ? 'h-ok' : 'h-danger') }, (pay ? '−' : '+') + money(d.amount))),
          el('button', { class: 'h-link', title: t('delete'), onClick: () => { store.del('debts', d.id); render(); } }, '✕'),
        ]));
      });
      body.appendChild(list);
    }
    render();
    app.sheet({ title: c.name, body });
  }

  function openEntry(app, cid, kind, after) {
    const { el, store, t } = app, ui = app.ui;
    const customers = store.all('contacts').filter(c => c.type === 'customer');
    let contactId = cid || '';
    const amt = ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', placeholder: '0' });
    const note = ui.input({ placeholder: t('note') + ' (' + t('optional') + ')' });
    const pickField = cid ? null : ui.field(t('customer'),
      ui.select([{ value: '', label: '— ' + t('pick_contact') + ' —' }].concat(customers.map(c => ({ value: c.id, label: c.name }))), { onchange: e => { contactId = e.target.value; } }));
    app.sheet({
      title: kind === 'payment' ? t('record_payment') : t('add_charge'),
      body: el('div', {}, [pickField, ui.field(t('amount'), amt), ui.field(t('note'), note)]),
      actions: [
        { label: t('cancel'), onClick: close => close() },
        { label: t('save'), kind: 'primary', onClick: close => {
            const a = parseFloat(amt.value) || 0;
            if (!contactId) { app.toast(t('pick_contact')); return; }
            if (a <= 0) { app.toast(t('amount_gt0')); return; }
            const now = new Date();
            store.insert('debts', { id: store.uid(), contactId, kind, amount: +a.toFixed(2), date: app.fmtDate(now), ts: now.toISOString(), note: note.value.trim() || (kind === 'payment' ? t('repayment') : '') });
            close(); app.toast(t('saved')); after && after();
          } },
      ],
    });
  }

  window.Hanout.module(MOD);
})();
