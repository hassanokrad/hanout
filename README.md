# Hanout — a free, modular business manager

**Hanout** (الحانوت — "the shop") is a lightweight, **offline-first** management app for any small
business: a grocery (مول الحانوت), a boutique, a café, a phone-repair stall — whatever you run.

You set your business name, currency and language, then **turn on only the modules you need**:
point-of-sale, inventory, the credit book (كريدي), a cashbook, contacts, reports. Everything is
stored on the device (`localStorage`) — no account, no server, no internet required.

It builds down to **one self-contained HTML file** you can open in any browser, add to a phone's
home screen, email, or drop on a USB stick.

![license](https://img.shields.io/badge/license-MIT-green)
![dependencies](https://img.shields.io/badge/dependencies-0-blue)
![offline](https://img.shields.io/badge/works-offline-success)
![i18n](https://img.shields.io/badge/i18n-EN%20%2F%20FR%20%2F%20AR-orange)

## Try it

Open [`dist/hanout.html`](dist/hanout.html) in a browser — it ships with a small, **fictional**
sample shop so every screen is populated. To rebuild it from source, see [Build](#build).

## Modules

| Module | What it does |
| --- | --- |
| **Sell** (core) | Tap a product to record a sale — quantity, price, and cash-or-credit payment. Running daily total, today's list, one-tap undo. |
| **Inventory** | Items with stock levels, categories and units; low-stock alerts; stock auto-decrements on each sale. |
| **Debts (كريدي)** | The shop credit book: who owes what, partial repayments, outstanding balances. A credit sale opens or grows a debt automatically. |
| **Expenses** | A simple cashbook — purchases and expenses in/out, so reports show real profit, not just sales. |
| **Contacts** | Customers & suppliers, each with their purchase history and a running balance. |
| **Reports** (core) | KPIs, daily revenue chart, top sellers, payment mix, and momentum vs. the previous period — recomputed live from your data. |
| **Backup** (core) | Full JSON backup & restore, CSV export of sales, and reset-to-sample. |
| **Settings** (core) | Business profile, currency, language, theme, and which modules are enabled. |

Languages: **English / Français / العربية** (Arabic switches the whole UI to right-to-left). Light
theme by default, with a dark-mode toggle remembered per device.

## Architecture

Hanout is a tiny **core** plus self-contained **feature modules**. The core owns the data store,
navigation, settings, i18n, theming and backup; each module registers its own tab, its own storage,
and its own views, and talks to other modules only through a small event bus.

```
src/
  core/
    shell.html     HTML template with /*__STYLES__*/, /*__CORE__*/, /*__MODULES__*/,
                   /*__SEED__*/ and /*__BOOT__*/ placeholders
    styles.css     CSS variables, light/dark themes, RTL support
    store.js       localStorage-backed reactive store + collections (CRUD by id)
    i18n.js        EN / FR / AR dictionaries, t(), language + direction handling
    ui.js          tiny DOM helpers: el(), money(), dates, modal, bottom-sheet, toast, charts
    app.js         the Hanout runtime: module registry, event bus, nav, settings, boot
  modules/
    <id>/<id>.js   one folder per module, each calls Hanout.module({ ... })
  config/
    modules.json   the ordered list of modules compiled into a build
build/
  build.js         concatenates core + enabled modules + seed data → dist/hanout.html
  serve.js         zero-dependency static server for local preview
data/
  generate.js      produces the synthetic sample dataset
  sample.json      generated demo data (products, sales, contacts, expenses)
dist/
  hanout.html      the built, ready-to-open app
docs/
  how-to-use.html  one-page user guide
```

### Writing a module

A module is a single file that calls `Hanout.module({...})`. Nothing else is required — drop the
folder in `src/modules/`, add its id to `src/config/modules.json`, and rebuild.

```js
Hanout.module({
  id: 'inventory',
  title: { en: 'Inventory', fr: 'Stock', ar: 'المخزون' },
  icon: '📦',
  order: 20,                       // position in the nav bar
  core: false,                     // core modules can't be disabled in Settings
  strings: {                       // optional i18n keys merged into the dictionary
    en: { low_stock: 'Low stock' },
    fr: { low_stock: 'Stock bas' },
    ar: { low_stock: 'مخزون منخفض' },
  },
  setup(app) {
    // run once at boot: subscribe to events, migrate storage, seed defaults
    app.on('sale:recorded', (sale) => { /* decrement stock */ });
  },
  view(app) {
    // return an HTMLElement rendered when the tab is opened
    return app.ui.el('div', {}, 'Hello from inventory');
  },
});
```

The `app` handed to every module exposes the whole toolkit: `app.store` (data), `app.t` /
`app.i18n` (translation), `app.ui` (DOM + components), `app.on` / `app.emit` (event bus),
`app.settings`, `app.money()`, and `app.refresh()` to re-render the active view.

The event bus is how modules cooperate without importing each other — e.g. a credit sale in **Sell**
emits `sale:recorded`, which **Inventory** uses to lower stock and **Debts** uses to grow a balance.

## Build

No dependencies — just Node.js (≥16).

```bash
npm run generate   # (re)create the synthetic sample dataset in data/sample.json
npm run build      # bundle core + modules + sample data → dist/hanout.html
npm run serve      # serve dist/ locally for testing
npm run dev        # build, then serve
```

`build.js` reads the module list from `src/config/modules.json`, concatenates the core and those
modules, inlines the styles and the seed data into `src/core/shell.html`, and writes the
single-file `dist/hanout.html`.

## Notes

- The repository ships **only synthetic sample data**; no real business or customer data is included.
- Vanilla JavaScript, no framework, no build dependency — chosen for longevity and zero-maintenance
  hosting (it can be emailed, put on a USB stick, or added to a home screen).
- Currency, language and the business name are all configurable in **Settings**.
- **Installable**: served over HTTPS (e.g. GitHub Pages) Hanout is a PWA — "Add to Home screen" gives it its own icon and a full-screen, standalone window. The manifest and icon are inlined, so it stays a single file.

## License

[MIT](LICENSE)
