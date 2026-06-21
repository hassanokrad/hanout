/* Hanout build — concatenates the core + the enabled modules + the sample seed
 * into a single self-contained file: dist/hanout.html. No dependencies.
 *
 *   node build/build.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcCore = path.join(root, 'src', 'core');
const srcMods = path.join(root, 'src', 'modules');

const read = (p) => fs.readFileSync(p, 'utf8');

// 1. core (fixed order — store, then i18n, then ui, then the runtime)
const CORE_ORDER = ['store.js', 'i18n.js', 'ui.js', 'app.js'];
const core = CORE_ORDER
  .map((f) => `/* ===== core/${f} ===== */\n` + read(path.join(srcCore, f)))
  .join('\n\n');

// 2. modules (from src/config/modules.json)
const modList = JSON.parse(read(path.join(root, 'src', 'config', 'modules.json')));
let missing = 0;
const modules = modList
  .map((id) => {
    const p = path.join(srcMods, id, id + '.js');
    if (!fs.existsSync(p)) { console.warn('  ! missing module:', id); missing++; return ''; }
    return `/* ===== modules/${id} ===== */\n` + read(p);
  })
  .join('\n\n');

// 3. styles
const styles = read(path.join(srcCore, 'styles.css'));

// 4. seed data (optional)
let seed = {};
const seedPath = path.join(root, 'data', 'sample.json');
if (fs.existsSync(seedPath)) {
  try { seed = JSON.parse(read(seedPath)); }
  catch (e) { console.warn('  ! could not parse data/sample.json:', e.message); }
} else {
  console.warn('  ! data/sample.json not found — run `npm run generate` first (building with empty seed)');
}
// escape "<" so the JSON can live safely inside a <script> tag
const seedJson = JSON.stringify(seed).split('<').join('\\u003c');

// 5. PWA: inline a web-app manifest + icon as data URIs (keeps the single-file promise).
//    Served over HTTPS (e.g. GitHub Pages) this makes Hanout installable / add-to-home-screen.
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d9488"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="url(#g)"/><text x="256" y="358" font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="300" font-weight="800" text-anchor="middle" fill="#ffffff">H</text></svg>';
const iconUri = 'data:image/svg+xml,' + encodeURIComponent(ICON_SVG);
const manifest = {
  name: 'Hanout - shop manager', short_name: 'Hanout',
  description: 'Free, offline, modular manager for any small shop.',
  start_url: '.', scope: '.', display: 'standalone', orientation: 'portrait',
  background_color: '#f5f7f9', theme_color: '#0f766e',
  icons: [{ src: iconUri, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
};
const head =
  '<link rel="manifest" href="data:application/manifest+json;base64,' + Buffer.from(JSON.stringify(manifest)).toString('base64') + '">\n  ' +
  '<link rel="icon" href="' + iconUri + '">\n  ' +
  '<link rel="apple-touch-icon" href="' + iconUri + '">';

// 6. inject (function replacers avoid `$&`/`$1` interpretation in the payloads)
let html = read(path.join(srcCore, 'shell.html'));
html = html.replace('<!--__HEAD__-->', () => head);
html = html.replace('/*__STYLES__*/', () => styles);
html = html.replace('/*__CORE__*/', () => core);
html = html.replace('/*__MODULES__*/', () => modules);
html = html.replace('/*__SEED__*/', () => seedJson);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'hanout.html');
fs.writeFileSync(outPath, html);

console.log(
  `Built ${path.relative(root, outPath)}  —  ${(html.length / 1024).toFixed(0)} KB, ` +
  `${modList.length - missing}/${modList.length} modules`
);
