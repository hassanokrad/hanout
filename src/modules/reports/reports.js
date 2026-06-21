/* Hanout module — reports & insights. Core. Recomputed live from current data. */
;(function () {
  const MOD = {
    id: 'reports', core: true, order: 60, icon: '📊',
    title: { en: 'Reports', fr: 'Rapports', ar: 'التقارير' },
    strings: {
      en: { after_expenses: 'after expenses', avg_basket: 'Avg sale', no_data_period: 'No sales in this period',
        revenue_by_day: 'Revenue by day', revenue_by_month: 'Revenue by month', top_sellers: 'Top sellers',
        payment_mix: 'Cash vs credit', vs_prev: 'vs previous' },
      fr: { after_expenses: 'après dépenses', avg_basket: 'Vente moy.', no_data_period: 'Aucune vente sur cette période',
        revenue_by_day: 'Recettes par jour', revenue_by_month: 'Recettes par mois', top_sellers: 'Meilleures ventes',
        payment_mix: 'Espèces vs crédit', vs_prev: 'vs précédent' },
      ar: { after_expenses: 'بعد المصاريف', avg_basket: 'معدل البيع', no_data_period: 'لا مبيعات في هذه الفترة',
        revenue_by_day: 'المداخيل حسب اليوم', revenue_by_month: 'المداخيل حسب الشهر', top_sellers: 'الأكثر مبيعاً',
        payment_mix: 'نقداً مقابل كريدي', vs_prev: 'مقارنة بالسابق' },
    },

    view(app) {
      const { el, store, t, money, nf } = app, ui = app.ui;
      const wrap = el('div');
      const st = app.tabState();
      let period = st.period || 'month';
      const nowMonth = app.todayKey().slice(0, 7);

      wrap.appendChild(el('div', { class: 'h-page-title', style: { marginBottom: '8px' } }, app.moduleTitle(MOD)));
      const chips = el('div', { class: 'h-chips', style: { marginBottom: '12px' } });
      [['month', t('this_month')], ['prev', t('last_month')], ['all', t('all_time')]].forEach(([val, lbl]) =>
        chips.appendChild(el('button', { class: 'h-chip' + (period === val ? ' active' : ''), onClick: () => { period = val; st.period = val; [...chips.children].forEach((c, i) => c.classList.toggle('active', ['month', 'prev', 'all'][i] === val)); render(); } }, lbl)));
      wrap.appendChild(chips);
      const body = el('div');
      wrap.appendChild(body);

      const inPeriod = (d) => {
        if (period === 'all') return true;
        const m = (d || '').slice(0, 7);
        return period === 'month' ? m === nowMonth : m === monthsBack(nowMonth, 1);
      };

      function render() {
        ui.clear(body);
        const sales = store.all('sales').filter(s => inPeriod(s.date));
        const expenses = store.all('expenses').filter(e => inPeriod(e.date));
        const revenue = sales.reduce((s, x) => s + x.total, 0);
        const spent = expenses.reduce((s, x) => s + (+x.amount || 0), 0);
        const units = sales.reduce((s, x) => s + x.qty, 0);
        const count = sales.length;

        let prevRevenue = null;
        if (period !== 'all') {
          const pm = monthsBack(nowMonth, period === 'month' ? 1 : 2);
          prevRevenue = store.all('sales').filter(s => (s.date || '').slice(0, 7) === pm).reduce((s, x) => s + x.total, 0);
        }

        const kpis = el('div', { class: 'h-kpis' });
        kpis.appendChild(ui.kpi(t('revenue'), money(revenue), momentum(app, revenue, prevRevenue)));
        kpis.appendChild(ui.kpi(t('profit'), money(revenue - spent), t('after_expenses')));
        kpis.appendChild(ui.kpi(t('sales'), nf(count, 0), nf(units, 0) + ' ' + t('units').toLowerCase()));
        kpis.appendChild(ui.kpi(t('avg_basket'), money(count ? revenue / count : 0)));
        body.appendChild(kpis);

        if (!count) { body.appendChild(el('div', { class: 'h-mt' }, ui.card(null, ui.empty(t('no_data_period'), '📊')))); return; }

        // revenue chart
        let chart;
        if (period === 'all') {
          const byM = {}; sales.forEach(s => { const m = (s.date || '').slice(0, 7); byM[m] = (byM[m] || 0) + s.total; });
          chart = Object.keys(byM).sort().map(m => ({ label: m, value: byM[m] }));
        } else {
          const byD = {}; sales.forEach(s => { const d = (s.date || '').slice(8, 10); byD[d] = (byD[d] || 0) + s.total; });
          chart = Object.keys(byD).sort().map(d => ({ label: d, value: byD[d] }));
        }
        body.appendChild(el('div', { class: 'h-section-title' }, period === 'all' ? t('revenue_by_month') : t('revenue_by_day')));
        body.appendChild(ui.card(null, ui.bars(chart, { format: money })));

        // top sellers (by units)
        const byName = {}; sales.forEach(s => { byName[s.name] = (byName[s.name] || 0) + s.qty; });
        const top = Object.keys(byName).map(n => ({ label: n, value: byName[n] })).sort((a, b) => b.value - a.value).slice(0, 8);
        body.appendChild(el('div', { class: 'h-section-title' }, t('top_sellers')));
        body.appendChild(ui.card(null, ui.bars(top, { format: v => nf(v, 0) })));

        // payment mix
        const cashRev = sales.filter(s => s.payment !== 'credit').reduce((s, x) => s + x.total, 0);
        body.appendChild(el('div', { class: 'h-section-title' }, t('payment_mix')));
        body.appendChild(ui.card(null, ui.bars([
          { label: t('cash'), value: cashRev }, { label: t('credit'), value: revenue - cashRev },
        ], { format: money })));
      }
      render();
      return wrap;
    },
  };

  function monthsBack(ym, n) {
    let [y, m] = ym.split('-').map(Number);
    m -= n; while (m < 1) { m += 12; y--; }
    return y + '-' + String(m).padStart(2, '0');
  }
  function momentum(app, cur, prev) {
    if (prev == null) return null;
    if (!prev) return app.el('span', { class: 'h-muted' }, '—');
    const pct = Math.round((cur - prev) / prev * 100), up = pct >= 0;
    return app.el('span', { class: up ? 'h-ok' : 'h-danger' }, (up ? '▲ ' : '▼ ') + Math.abs(pct) + '% ' + app.t('vs_prev'));
  }

  window.Hanout.module(MOD);
})();
