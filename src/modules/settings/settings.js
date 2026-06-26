/* Hanout module — settings. Core. Business profile, language, theme, modules. */
;(function () {
  const APP_VERSION = '0.7.1';

  const MOD = {
    id: 'settings', core: true, secondary: true, order: 90, icon: '⚙️',
    title: { en: 'Settings', fr: 'Réglages', ar: 'الإعدادات' },
    strings: {
      en: { business: 'Business', core_module: 'Core module', enabled: 'Enabled', disabled: 'Disabled',
        always_on: 'always on', about: 'About', about_blurb: 'Free & open-source. Works offline — your data stays on this device.' },
      fr: { business: 'Commerce', core_module: 'Module principal', enabled: 'Activé', disabled: 'Désactivé',
        always_on: 'toujours actif', about: 'À propos', about_blurb: 'Libre et open-source. Fonctionne hors-ligne — vos données restent sur cet appareil.' },
      ar: { business: 'النشاط', core_module: 'وحدة أساسية', enabled: 'مفعّل', disabled: 'معطّل',
        always_on: 'دائم', about: 'حول', about_blurb: 'مجاني ومفتوح المصدر. يعمل دون إنترنت — بياناتك تبقى على هذا الجهاز.' },
    },

    view(app) {
      const { el, t } = app, ui = app.ui, s = app.settings;
      const wrap = el('div');
      wrap.appendChild(el('div', { class: 'h-page-title' }, app.moduleTitle(MOD)));

      // business profile
      wrap.appendChild(ui.card(t('business'), el('div', {}, [
        ui.field(t('business_name'), ui.input({ value: s.business, onchange: e => app.saveSettings({ business: e.target.value.trim() || 'Hanout' }) })),
        ui.field(t('currency'), ui.input({ value: s.currency, onchange: e => app.saveSettings({ currency: e.target.value.trim() || 'MAD' }) })),
        ui.field(t('theme'), el('div', { class: 'h-chips' }, [
          el('button', { class: 'h-chip' + (s.theme !== 'dark' ? ' active' : ''), onClick: () => app.saveSettings({ theme: 'light' }) }, t('light')),
          el('button', { class: 'h-chip' + (s.theme === 'dark' ? ' active' : ''), onClick: () => app.saveSettings({ theme: 'dark' }) }, t('dark')),
        ])),
      ])));

      // modules
      const list = el('div', { class: 'h-list' });
      app.allModules().slice().sort((a, b) => (a.order || 50) - (b.order || 50)).forEach(m => {
        const on = app.isEnabled(m);
        list.appendChild(el('div', { class: 'h-list-item' }, [
          el('div', { class: 'h-list-main' }, [
            el('div', { class: 'h-list-title' }, (m.icon || '•') + '  ' + app.moduleTitle(m)),
            el('div', { class: 'h-list-sub' }, m.core ? t('core_module') : (on ? t('enabled') : t('disabled'))),
          ]),
          m.core
            ? ui.pill(t('always_on'), 'accent')
            : el('input', { type: 'checkbox', checked: on, onchange: e => app.saveSettings({ enabled: { [m.id]: e.target.checked } }) }),
        ]));
      });
      wrap.appendChild(ui.card(t('modules'), list));

      // about
      wrap.appendChild(ui.card(t('about'), el('div', { class: 'h-muted', style: { fontSize: '13px' } }, [
        el('div', {}, [el('strong', {}, 'Hanout'), ' · v' + APP_VERSION]),
        el('div', { class: 'h-mt' }, t('about_blurb')),
      ])));

      return wrap;
    },
  };

  window.Hanout.module(MOD);
})();
