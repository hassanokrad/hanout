/* Hanout core — i18n.js
 * EN / FR / AR dictionaries, translation with {var} interpolation, and text
 * direction (Arabic → RTL). Modules add their own keys via Hanout.I18n.extend().
 */
;(function () {
  const H = (window.Hanout = window.Hanout || {});
  const dict = { en: {}, fr: {}, ar: {} };
  const RTL = { ar: true };
  let lang = 'en';

  const core = {
    en: {
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', close: 'Close',
      search: 'Search', confirm: 'Confirm', yes: 'Yes', no: 'No', ok: 'OK', today: 'Today',
      total: 'Total', all: 'All', none: 'None', name: 'Name', price: 'Price', cost: 'Cost',
      qty: 'Qty', quantity: 'Quantity', amount: 'Amount', date: 'Date', time: 'Time',
      category: 'Category', note: 'Note', notes: 'Notes', phone: 'Phone', type: 'Type',
      balance: 'Balance', actions: 'Actions', empty_here: 'Nothing here yet', undo: 'Undo',
      saved: 'Saved', deleted: 'Deleted', removed: 'Removed', are_you_sure: 'Are you sure?',
      this_cannot_be_undone: 'This cannot be undone.', revenue: 'Revenue', profit: 'Profit',
      units: 'Units', sales: 'Sales', custom: 'Custom', cash: 'Cash', credit: 'Credit',
      paid: 'Paid', unpaid: 'Unpaid', settings: 'Settings', currency: 'Currency',
      language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark',
      business_name: 'Business name', modules: 'Modules', required: 'required', optional: 'optional', more_details: 'More details',
      this_month: 'This month', last_month: 'Last month', all_time: 'All time', more: 'More',
      open_status: 'Open',
      storage_full: 'Could not save — device storage may be full. Export a backup.',
      scan: 'Scan', scan_title: 'Scan barcode', point_at_barcode: 'Point the camera at a barcode',
      camera_error: 'Could not open the camera.', camera_denied: 'Camera access was blocked — allow it in your browser settings.',
      scan_unsupported: 'Scanning isn’t available here — type a barcode onto an item in Inventory instead.',
    },
    fr: {
      save: 'Enregistrer', cancel: 'Annuler', delete: 'Supprimer', edit: 'Modifier', add: 'Ajouter',
      close: 'Fermer', search: 'Rechercher', confirm: 'Confirmer', yes: 'Oui', no: 'Non', ok: 'OK',
      today: "Aujourd'hui", total: 'Total', all: 'Tout', none: 'Aucun', name: 'Nom', price: 'Prix',
      cost: 'Coût', qty: 'Qté', quantity: 'Quantité', amount: 'Montant', date: 'Date', time: 'Heure',
      category: 'Catégorie', note: 'Note', notes: 'Notes', phone: 'Téléphone', type: 'Type',
      balance: 'Solde', actions: 'Actions', empty_here: 'Rien pour le moment', undo: 'Annuler',
      saved: 'Enregistré', deleted: 'Supprimé', removed: 'Retiré', are_you_sure: 'Êtes-vous sûr ?',
      this_cannot_be_undone: 'Cette action est irréversible.', revenue: 'Recettes', profit: 'Bénéfice',
      units: 'Unités', sales: 'Ventes', custom: 'Autre', cash: 'Espèces', credit: 'Crédit',
      paid: 'Payé', unpaid: 'Impayé', settings: 'Réglages', currency: 'Devise', language: 'Langue',
      theme: 'Thème', light: 'Clair', dark: 'Sombre', business_name: 'Nom du commerce',
      modules: 'Modules', required: 'requis', optional: 'optionnel', more_details: 'Plus de détails',
      this_month: 'Ce mois-ci', last_month: 'Le mois dernier', all_time: 'Tout', more: 'Plus',
      open_status: 'Ouvert',
      storage_full: "Échec de l'enregistrement — stockage peut-être plein. Exportez une sauvegarde.",
      scan: 'Scanner', scan_title: 'Scanner un code-barres', point_at_barcode: 'Pointez la caméra vers un code-barres',
      camera_error: "Impossible d'ouvrir la caméra.", camera_denied: "Accès caméra bloqué — autorisez-le dans les réglages du navigateur.",
      scan_unsupported: "Le scan n'est pas disponible ici — saisissez un code-barres sur un article dans Stock.",
    },
    ar: {
      save: 'حفظ', cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', add: 'إضافة', close: 'إغلاق',
      search: 'بحث', confirm: 'تأكيد', yes: 'نعم', no: 'لا', ok: 'حسناً', today: 'اليوم',
      total: 'المجموع', all: 'الكل', none: 'لا شيء', name: 'الاسم', price: 'الثمن', cost: 'التكلفة',
      qty: 'الكمية', quantity: 'الكمية', amount: 'المبلغ', date: 'التاريخ', time: 'الوقت',
      category: 'الفئة', note: 'ملاحظة', notes: 'ملاحظات', phone: 'الهاتف', type: 'النوع',
      balance: 'الرصيد', actions: 'إجراءات', empty_here: 'لا يوجد شيء بعد', undo: 'تراجع',
      saved: 'تم الحفظ', deleted: 'تم الحذف', removed: 'تمت الإزالة', are_you_sure: 'هل أنت متأكد؟',
      this_cannot_be_undone: 'لا يمكن التراجع عن هذا.', revenue: 'المداخيل', profit: 'الربح',
      units: 'الوحدات', sales: 'المبيعات', custom: 'آخر', cash: 'نقداً', credit: 'بالكريدي',
      paid: 'مدفوع', unpaid: 'غير مدفوع', settings: 'الإعدادات', currency: 'العملة',
      language: 'اللغة', theme: 'المظهر', light: 'فاتح', dark: 'داكن', business_name: 'اسم النشاط',
      modules: 'الوحدات', required: 'مطلوب', optional: 'اختياري', more_details: 'تفاصيل إضافية',
      this_month: 'هذا الشهر', last_month: 'الشهر الماضي', all_time: 'الكل', more: 'المزيد',
      open_status: 'مفتوح',
      storage_full: 'تعذّر الحفظ — قد تكون ذاكرة الجهاز ممتلئة. صدّر نسخة احتياطية.',
      scan: 'مسح', scan_title: 'مسح الباركود', point_at_barcode: 'وجّه الكاميرا نحو الباركود',
      camera_error: 'تعذّر فتح الكاميرا.', camera_denied: 'تم حظر الكاميرا — اسمح بها في إعدادات المتصفّح.',
      scan_unsupported: 'المسح غير متاح هنا — أضِف الباركود يدويًا لعنصر في المخزون.',
    },
  };

  function extend(strings) {
    for (const l of Object.keys(strings || {})) {
      dict[l] = Object.assign(dict[l] || {}, strings[l]);
    }
  }
  extend(core);

  function setLang(l) { if (dict[l]) lang = l; }
  function t(key, vars) {
    let s = dict[lang] && dict[lang][key];
    if (s == null) s = dict.en && dict.en[key];
    if (s == null) s = key;
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function dir() { return RTL[lang] ? 'rtl' : 'ltr'; }

  H.I18n = {
    extend, setLang, t, dir,
    langs: ['en', 'fr', 'ar'],
    label: { en: 'English', fr: 'Français', ar: 'العربية' },
    get lang() { return lang; },
  };
})();
