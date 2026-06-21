/* Hanout module — backup. Core. JSON backup/restore, CSV export, reset. */
;(function () {
  const MOD = {
    id: 'backup', core: true, secondary: true, order: 95, icon: '💾',
    title: { en: 'Backup', fr: 'Sauvegarde', ar: 'النسخ' },
    strings: {
      en: { backup: 'Backup', export_backup: 'Export backup (JSON)', import_backup: 'Import backup (JSON)',
        export_sales_csv: 'Export sales (CSV)', danger_zone: 'Danger zone', reset_to_sample: 'Reset to sample data',
        reset_sample_q: 'Replace everything with the sample data?', clear_all_data: 'Delete all data',
        clear_all_q: 'Delete ALL data? This cannot be undone.', imported: 'Backup restored', bad_file: 'Could not read that file',
        count_items: 'Items', count_sales: 'Sales', count_contacts: 'Contacts', count_expenses: 'Expenses' },
      fr: { backup: 'Sauvegarde', export_backup: 'Exporter (JSON)', import_backup: 'Importer (JSON)',
        export_sales_csv: 'Exporter ventes (CSV)', danger_zone: 'Zone sensible', reset_to_sample: 'Réinitialiser (démo)',
        reset_sample_q: 'Tout remplacer par les données de démo ?', clear_all_data: 'Supprimer les données',
        clear_all_q: 'Supprimer TOUTES les données ? Irréversible.', imported: 'Sauvegarde restaurée', bad_file: 'Fichier illisible',
        count_items: 'Articles', count_sales: 'Ventes', count_contacts: 'Contacts', count_expenses: 'Dépenses' },
      ar: { backup: 'نسخة احتياطية', export_backup: 'تصدير نسخة (JSON)', import_backup: 'استيراد نسخة (JSON)',
        export_sales_csv: 'تصدير المبيعات (CSV)', danger_zone: 'منطقة الخطر', reset_to_sample: 'استعادة بيانات تجريبية',
        reset_sample_q: 'استبدال كل شيء بالبيانات التجريبية؟', clear_all_data: 'حذف كل البيانات',
        clear_all_q: 'حذف كل البيانات؟ لا يمكن التراجع.', imported: 'تمت الاستعادة', bad_file: 'تعذّرت قراءة الملف',
        count_items: 'العناصر', count_sales: 'المبيعات', count_contacts: 'الزبناء', count_expenses: 'المصاريف' },
    },

    view(app) {
      const { el, store, t } = app, ui = app.ui;
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'h-page-title' }, app.moduleTitle(MOD)));

      // counts
      const grid = el('div', { class: 'h-kpis' });
      [['count_items', store.all('items').length], ['count_sales', store.all('sales').length],
       ['count_contacts', store.all('contacts').length], ['count_expenses', store.all('expenses').length]]
        .forEach(([k, v]) => grid.appendChild(ui.kpi(t(k), app.nf(v, 0))));
      wrap.appendChild(grid);

      // backup actions
      const fileInput = el('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: e => importJSON(app, e.target.files[0]) });
      wrap.appendChild(ui.card(t('backup'), el('div', { class: 'h-stack' }, [
        el('button', { class: 'h-btn h-btn-primary h-btn-block', onClick: () => exportJSON(app) }, '⬇  ' + t('export_backup')),
        el('button', { class: 'h-btn h-btn-block', onClick: () => fileInput.click() }, '⬆  ' + t('import_backup')),
        el('button', { class: 'h-btn h-btn-block', onClick: () => exportCSV(app) }, '⬇  ' + t('export_sales_csv')),
        fileInput,
      ])));

      // danger zone
      wrap.appendChild(ui.card(t('danger_zone'), el('div', { class: 'h-stack' }, [
        el('button', { class: 'h-btn h-btn-block', onClick: () => app.confirm(t('reset_sample_q')).then(ok => { if (ok) { app.resetToSample(); app.toast(t('saved')); } }) }, t('reset_to_sample')),
        el('button', { class: 'h-btn h-btn-danger h-btn-block', onClick: () => app.confirm(t('clear_all_q'), { danger: true, ok: t('delete') }).then(ok => { if (ok) { const s = app.settings; store.clearAll(); store.set('settings', { business: 'Hanout', currency: s.currency, lang: s.lang, theme: s.theme, enabled: {} }); location.reload(); } }) }, t('clear_all_data')),
      ])));

      return wrap;
    },
  };

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportJSON(app) {
    download('hanout-backup-' + app.todayKey() + '.json', JSON.stringify(app.store.exportAll(), null, 2), 'application/json');
    app.toast(app.t('saved'));
  }

  function importJSON(app, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        app.store.importAll(data);
        app.toast(app.t('imported'));
        setTimeout(() => location.reload(), 400);
      } catch (e) { app.toast(app.t('bad_file')); }
    };
    reader.readAsText(file);
  }

  function exportCSV(app) {
    const { store } = app;
    const contacts = store.all('contacts');
    const cname = id => (contacts.find(c => c.id === id) || {}).name || '';
    const cell = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const rows = [['date', 'time', 'item', 'qty', 'unit_price', 'total', 'payment', 'customer']];
    store.all('sales').slice().sort((a, b) => (a.ts < b.ts ? -1 : 1)).forEach(s =>
      rows.push([s.date, app.fmtTime(s.ts), s.name, s.qty, s.price, s.total, s.payment || 'cash', cname(s.contactId)]));
    download('hanout-sales-' + app.todayKey() + '.csv', rows.map(r => r.map(cell).join(',')).join('\n'), 'text/csv');
    app.toast(app.t('saved'));
  }

  window.Hanout.module(MOD);
})();
