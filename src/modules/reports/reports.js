/* Hanout module — reports & insights. Core. Recomputed live from current data. */
;(function () {
  const MOD = {
    id: 'reports', core: true, order: 60, icon: '📊',
    title: { en: 'Reports', fr: 'Rapports', ar: 'التقارير' },
    strings: {
      en: { after_expenses: 'after expenses', avg_basket: 'Avg sale', no_data_period: 'No sales in this period',
        revenue_by_day: 'Revenue by day', revenue_by_month: 'Revenue by month', top_sellers: 'Top sellers',
        payment_mix: 'Cash vs credit', vs_prev: 'vs previous',
        gross_profit: 'Gross profit', margin: 'margin', net_profit: 'Net profit',
        after_cost_exp: 'after cost & expenses', expenses_kpi: 'Expenses' },
      fr: { after_expenses: 'après dépenses', avg_basket: 'Vente moy.', no_data_period: 'Aucune vente sur cette période',
        revenue_by_day: 'Recettes par jour', revenue_by_month: 'Recettes par mois', top_sellers: 'Meilleures ventes',
        payment_mix: 'Espèces vs crédit', vs_prev: 'vs précédent',
        gross_profit: 'Marge brute', margin: 'marge', net_profit: 'Bénéfice net',
        after_cost_exp: 'après coût & dépenses', expenses_kpi: 'Dépenses' },
      ar: { after_expenses: 'بعد المصاريف', avg_basket: 'معدل البيع', no_data_period: 'لا مبيعات في هذه الفترة',
        revenue_by_day: 'المداخيل حسب اليوم', revenue_by_month: 'المداخيل حسب الشهر', top_sellers: 'الأكثر مبيعاً',
        payment_mix: 'نقداً مقابل كريدي', vs_prev: 'مقارنة بالسابق',
        gross_profit: 'ربح البضاعة', margin: 'هامش', net_profit: 'الربح الصافي',
        after_cost_exp: 'بعد التكلفة والمصاريف', expenses_kpi: 'المصاريف' },
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
        // Cost of goods sold from the cost snapshotted on each sale → a real margin.
        // Sales recorded before cost-tracking (or quick sales) have no cost → counted as
        // zero COGS, so this degrades gracefully to revenue − expenses.
        const cogs = sales.reduce((s, x) => s + (+x.cost || 0) * x.qty, 0);
        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - spent;
        const marginPct = revenue ? Math.round(grossProfit / revenue * 100) : 0;

        let prevRevenue = null;
        if (period !== 'all') {
          const pm = monthsBack(nowMonth, period === 'month' ? 1 : 2);
          prevRevenue = store.all('sales').filter(s => (s.date || '').slice(0, 7) === pm).reduce((s, x) => s + x.total, 0);
        }

        const kpis = el('div', { class: 'h-kpis' });
        kpis.appendChild(ui.kpi(t('revenue'), money(revenue), momentum(app, revenue, prevRevenue)));
        kpis.appendChild(ui.kpi(t('gross_profit'), money(grossProfit), marginPct + '% ' + t('margin')));
        kpis.appendChild(ui.kpi(t('net_profit'), money(netProfit), t('after_cost_exp')));
        kpis.appendChild(ui.kpi(t('expenses_kpi'), money(spent)));
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
        // daily → vertical bars (the redesign look); monthly (all-time) → horizontal w/ readable labels
        body.appendChild(ui.card(null, period === 'all' ? ui.bars(chart, { format: money }) : vbars(app, chart)));

        // top sellers (by units)
        const byName = {}; sales.forEach(s => { byName[s.name] = (byName[s.name] || 0) + s.qty; });
        const top = Object.keys(byName).map(n => ({ label: n, value: byName[n] })).sort((a, b) => b.value - a.value).slice(0, 6);
        body.appendChild(el('div', { class: 'h-section-title' }, t('top_sellers')));
        body.appendChild(ui.card(null, ui.bars(top, { format: v => nf(v, 0) })));

        // payment mix — single stacked bar + legend with percentages
        const cashRev = sales.filter(s => s.payment !== 'credit').reduce((s, x) => s + x.total, 0);
        const cashPct = revenue ? Math.round(cashRev / revenue * 100) : 0;
        body.appendChild(el('div', { class: 'h-section-title' }, t('payment_mix')));
        body.appendChild(ui.card(null, el('div', {}, [
          el('div', { class: 'h-paybar' }, [
            el('div', { class: 'h-paybar-cash', style: { width: cashPct + '%' } }),
            el('div', { class: 'h-paybar-credit', style: { width: (100 - cashPct) + '%' } }),
          ]),
          el('div', { class: 'h-paylegend' }, [
            el('div', {}, [el('i', { style: { background: 'var(--accent)' } }), el('span', {}, t('cash')), el('b', {}, cashPct + '%')]),
            el('div', {}, [el('i', { style: { background: '#d98a2b' } }), el('span', {}, t('credit')), el('b', {}, (100 - cashPct) + '%')]),
          ]),
        ])));
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
  // vertical bar chart (revenue by day). Every bar is drawn; the x-axis shows a label
  // under every day for a short span, else clean "ruler" ticks (day 1 + every 5th) so a
  // busy month can't fit 30 numbers on a phone — they read as a scale, not as gaps.
  // The single tallest bar is highlighted as the peak day.
  function vbars(app, data) {
    const { el, nf } = app;
    const max = Math.max(1, ...data.map(d => +d.value || 0));
    if (!data.length) return app.ui.empty();
    const dense = data.length > 16;
    const showLabel = (d) => { const n = +d.label; return !dense || n === 1 || n % 5 === 0; };
    return el('div', { class: 'h-vbars' }, data.map((d) =>
      el('div', { class: 'h-vbar-col' }, [
        el('div', { class: 'h-vbar' + ((+d.value || 0) === max ? ' peak' : ''), style: { height: Math.max(6, Math.round((+d.value || 0) / max * 100)) + '%' }, title: nf(d.value, 0) }),
        el('div', { class: 'h-vbar-label' }, showLabel(d) ? String(+d.label || d.label) : ''),
      ])
    ));
  }
  function momentum(app, cur, prev) {
    if (prev == null) return null;
    if (!prev) return app.el('span', { class: 'h-muted' }, '—');
    const pct = Math.round((cur - prev) / prev * 100), up = pct >= 0;
    return app.el('span', { class: up ? 'h-ok' : 'h-danger' }, (up ? '▲ ' : '▼ ') + Math.abs(pct) + '% ' + app.t('vs_prev'));
  }

  window.Hanout.module(MOD);
})();
