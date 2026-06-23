/* Hanout module — expenses (cashbook out): purchases, rent, utilities… */
;(function () {
  const DEFAULT_CATS = ['مشتريات', 'كراء', 'فواتير', 'نقل', 'أجور', 'أخرى'];

  const MOD = {
    id: 'expenses', order: 40, icon: '💸',
    title: { en: 'Expenses', fr: 'Dépenses', ar: 'المصاريف' },
    strings: {
      en: { add_expense: 'Add expense', edit_expense: 'Edit expense', this_month_spent: 'Spent this month',
        no_expenses: 'No expenses recorded yet', delete_expense_q: 'Delete this expense?', amount_gt0: 'Enter an amount' },
      fr: { add_expense: 'Ajouter une dépense', edit_expense: 'Modifier la dépense', this_month_spent: 'Dépensé ce mois-ci',
        no_expenses: 'Aucune dépense enregistrée', delete_expense_q: 'Supprimer cette dépense ?', amount_gt0: 'Saisissez un montant' },
      ar: { add_expense: 'إضافة مصروف', edit_expense: 'تعديل المصروف', this_month_spent: 'مصاريف هذا الشهر',
        no_expenses: 'لا توجد مصاريف مسجلة', delete_expense_q: 'حذف هذا المصروف؟', amount_gt0: 'أدخل مبلغاً' },
    },

    view(app) {
      const { el, store, t, money } = app, ui = app.ui;
      const wrap = el('div');
      const st = app.tabState();
      let cat = st.cat || '';
      const month = app.todayKey().slice(0, 7);
      const all = store.all('expenses');
      const monthTotal = all.filter(e => (e.date || '').slice(0, 7) === month).reduce((s, e) => s + (+e.amount || 0), 0);

      wrap.appendChild(el('div', { class: 'h-row', style: { marginBottom: '12px' } }, [
        el('div', { class: 'h-page-title', style: { margin: 0 } }, app.moduleTitle(MOD)),
        el('div', { class: 'h-spacer' }),
        el('button', { class: 'h-btn h-btn-primary', onClick: () => openForm(app, null) }, '+ ' + t('add_expense')),
      ]));
      wrap.appendChild(ui.card(null, el('div', {}, [
        el('div', { class: 'h-bignum h-warn' }, money(monthTotal)),
        el('div', { class: 'h-muted', style: { fontSize: '12.5px' } }, t('this_month_spent')),
      ])));

      const cats = Array.from(new Set(all.map(e => e.category).filter(Boolean)));
      if (cats.length) {
        const chips = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
        [['', t('all')]].concat(cats.map(c => [c, c])).forEach(([val, lbl]) =>
          chips.appendChild(el('button', { class: 'h-chip' + (cat === val ? ' active' : ''), onClick: () => { cat = val; st.cat = val; renderList(); [...chips.children].forEach((ch, i) => ch.classList.toggle('active', (['', ...cats][i]) === val)); } }, lbl)));
        wrap.appendChild(chips);
      }

      const listCard = el('section', { class: 'h-card' });
      wrap.appendChild(listCard);
      function renderList() {
        ui.clear(listCard);
        let list = all.slice().sort((a, b) => ((a.ts || a.date) < (b.ts || b.date) ? 1 : -1));
        if (cat) list = list.filter(e => e.category === cat);
        if (!list.length) { listCard.appendChild(ui.empty(t('no_expenses'), '💸')); return; }
        const inner = el('div', { class: 'h-list' });
        list.slice(0, 60).forEach(e => inner.appendChild(el('div', { class: 'h-list-item', onClick: () => openForm(app, e) }, [
          el('div', { class: 'h-list-main' }, [
            el('div', { class: 'h-list-title' }, e.category || t('none')),
            el('div', { class: 'h-list-sub' }, [e.date, e.note ? ' · ' + e.note : '']),
          ]),
          el('div', { class: 'h-list-end' }, el('span', { class: 'h-list-amount h-warn' }, money(e.amount))),
        ])));
        listCard.appendChild(inner);
      }
      renderList();
      return wrap;
    },
  };

  function openForm(app, exp) {
    const { el, store, t } = app, ui = app.ui;
    const ed = !!exp; exp = exp || {};
    const cats = Array.from(new Set(DEFAULT_CATS.concat(store.all('expenses').map(e => e.category).filter(Boolean))));
    const amt = ui.input({ type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: exp.amount != null ? exp.amount : '' });
    const category = ui.input({ value: exp.category || '', placeholder: t('category'), list: 'h-exp-cats' });
    const date = ui.input({ type: 'date', value: exp.date || app.todayKey() });
    const note = ui.input({ value: exp.note || '', placeholder: t('note') + ' (' + t('optional') + ')' });

    const actions = [];
    if (ed) actions.push({ label: t('delete'), kind: 'danger', onClick: close => {
      app.confirm(t('delete_expense_q'), { danger: true, ok: t('delete') }).then(ok => { if (ok) { store.del('expenses', exp.id); close(); app.toast(t('deleted')); } });
    } });
    actions.push({ label: t('save'), kind: 'primary', onClick: close => {
      const a = parseFloat(amt.value) || 0;
      if (a <= 0) { app.toast(t('amount_gt0')); return; }
      const d = date.value || app.todayKey();
      store.upsert('expenses', { id: exp.id, amount: +a.toFixed(2), category: category.value.trim() || t('none'), date: d, ts: exp.ts || new Date(d).toISOString(), note: note.value.trim() });
      close(); app.toast(t('saved'));
    } });

    app.sheet({
      title: ed ? t('edit_expense') : t('add_expense'),
      body: el('div', {}, [
        el('datalist', { id: 'h-exp-cats' }, cats.map(c => el('option', { value: c }))),
        ui.field(t('amount'), amt),
        el('div', { class: 'h-form-grid' }, [ui.field(t('category'), category), ui.field(t('date'), date)]),
        ui.field(t('note'), note),
      ]),
      actions,
    });
  }

  window.Hanout.module(MOD);
})();
