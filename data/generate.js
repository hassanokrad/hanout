/* Hanout — synthetic sample data generator.
 * Produces data/sample.json: a small, FICTIONAL Moroccan corner shop (حانوت) so every
 * screen is populated in the demo build. Deterministic (seeded RNG) so rebuilds are stable.
 *
 * Goal: numbers that a real مول الحانوت would recognise — real-world MAD prices, items
 * sold by the piece OR by weight (butter/olives/dates priced per kg, sold in fractions of
 * a kilo), valid EAN-13 barcodes, busy days with a morning/evening rhythm, and financials
 * that hold together (each sale snapshots its cost so Reports can show a true margin).
 *
 *   node data/generate.js
 */
const fs = require('fs');
const path = require('path');

// deterministic PRNG (mulberry32) → stable sample.json across runs
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260623);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;
const round2 = (n) => Math.round(n * 100) / 100;

const ANCHOR = new Date('2026-06-23T20:30:00'); // newest sale lands ~today
const DAYS = 58;                                  // ~two months → "this month vs last month" both have data
function dayOffset(n) { const d = new Date(ANCHOR); d.setDate(d.getDate() - n); return d; }
const pad = (x) => String(x).padStart(2, '0');
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isots(d) { return d.toISOString(); }

// valid EAN-13 with the GS1 Morocco prefix (611). Deterministic from the RNG so codes are
// stable across rebuilds and pass a real checksum (a scanner won't reject them).
function ean13() {
  let d = '611';
  for (let i = 0; i < 9; i++) d += between(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (+d[i]) * (i % 2 === 0 ? 1 : 3);
  return d + ((10 - (sum % 10)) % 10);
}

// ---- catalogue ------------------------------------------------------------
// [name, category, price, cost, stock, unit, freq, qmax]
//   price/cost .... MAD; for weight items (unit 'كغ') these are PER KILOGRAM
//   stock ......... current on-hand; weight items are in kg, the rest in pieces
//   freq .......... relative sale frequency (how often it leaves the shelf)
//   qmax .......... typical largest single purchase (ignored for weight items)
// Prices reflect Moroccan retail (mid-2025): bread ~1.2, sugar ~7, oil ~16, milk ~8,
// rice ~15, beldi butter ~140/kg, a cigarette pack ~38, phone top-up sold near cost.
const RAW_ITEMS = [
  ['خبز',            'مخبزة',         1.2,  0.9,  35,  'حبة',   10, 5],
  ['كرواسون',        'مخبزة',         2,    1.3,  16,  'حبة',   4,  4],
  ['حليب 1ل',        'ألبان',         8,    7,    28,  'حبة',   9,  4],
  ['ياغورت',         'ألبان',         3,    2.2,  24,  'حبة',   6,  6],
  ['زبدة',           'ألبان',         140,  115,  4,   'كغ',    4,  0],   // sold loose, by weight
  ['بيض (30)',       'ألبان',         45,   39,   0,   'طبق',   3,  2],   // currently out of stock
  ['جبن حصص',        'ألبان',         9,    7,    10,  'علبة',  3,  3],
  ['ماء 1.5ل',       'مشروبات',       6,    4,    54,  'قنينة', 9,  4],
  ['مشروب غازي 1ل',  'مشروبات',       9,    6.5,  26,  'قنينة', 7,  3],
  ['عصير',           'مشروبات',       8,    6,    16,  'حبة',   4,  3],
  ['قهوة 200غ',      'بقالة',         30,   24,   2,   'حبة',   2,  2],   // low stock
  ['أتاي 200غ',      'بقالة',         18,   14,   12,  'حبة',   4,  3],
  ['سكر 1كغ',        'بقالة',         7,    6,    22,  'كيس',   6,  4],
  ['زيت 1ل',         'بقالة',         16,   14,   14,  'قنينة', 5,  3],
  ['دقيق 1كغ',       'بقالة',         6,    4.8,  20,  'كيس',   4,  3],
  ['أرز 1كغ',        'بقالة',         15,   12,   12,  'كيس',   3,  3],
  ['معكرونة 500غ',   'بقالة',         7,    5,    18,  'حبة',   4,  3],
  ['معجون الطماطم',  'بقالة',         4,    2.8,  26,  'علبة',  5,  4],
  ['علبة طون',       'بقالة',         11,   8.5,  15,  'علبة',  4,  3],
  ['زيتون أخضر',     'بقالة',         20,   14,   9,   'كغ',    5,  0],   // sold loose, by weight
  ['تمر',            'بقالة',         40,   30,   6,   'كغ',    3,  0],   // sold loose, by weight
  ['شيبس',           'وجبات خفيفة',   5,    3.2,  30,  'حبة',   7,  3],
  ['بسكويت',         'وجبات خفيفة',   4,    2.5,  28,  'حبة',   6,  3],
  ['لوح شوكولاتة',   'وجبات خفيفة',   6,    4,    24,  'حبة',   6,  3],
  ['علكة',           'وجبات خفيفة',   2,    1.2,  35,  'حبة',   5,  3],
  ['صابون',          'نظافة',         5,    3.5,  20,  'حبة',   3,  3],
  ['كيس شامبو',      'نظافة',         2,    1.2,  40,  'حبة',   4,  4],
  ['معجون أسنان',    'نظافة',         13,   10,   3,   'حبة',   2,  2],   // low stock
  ['مسحوق غسيل 1كغ', 'أدوات منزلية',  19,   15,   9,   'كيس',   3,  2],
  ['ثقاب',           'أدوات منزلية',  2,    1.2,  25,  'حبة',   3,  3],
  ['شمعة',           'أدوات منزلية',  3,    2,    14,  'حبة',   2,  3],
  ['علبة سجائر',     'أخرى',          38,   35,   20,  'علبة',  8,  2],
  ['تعبئة 10',       'أخرى',          10,   9.5,  999, 'حبة',   8,  3],
];
const items = RAW_ITEMS.map((r, i) => ({
  id: 'i' + (i + 1), name: r[0], category: r[1], price: r[2], cost: r[3],
  stock: r[4], unit: r[5], barcode: ean13(), active: true,
}));
// weighted pool for realistic sale frequency
const pool = [];
RAW_ITEMS.forEach((r, i) => { for (let w = 0; w < r[6]; w++) pool.push(i); });

// realistic single-purchase quantity for one sale of item `idx`
const WEIGHT_QTY = {
  'زبدة': [0.1, 0.15, 0.2, 0.25, 0.3, 0.5],       // butter: 100 g … ½ kg
  'زيتون أخضر': [0.25, 0.5, 0.5, 1],               // olives: ¼ … 1 kg
  'تمر': [0.25, 0.5, 1],                            // dates:  ¼ … 1 kg
};
function saleQty(idx) {
  const r = RAW_ITEMS[idx];
  if (r[5] === 'كغ') return pick(WEIGHT_QTY[r[0]] || [0.25, 0.5, 1]);
  const qmax = r[7] || 1;                            // piece items: mostly 1, occasionally more
  const u = rnd();
  let q = u < 0.78 ? 1 : u < 0.93 ? 2 : u < 0.985 ? 3 : between(4, 6);
  return Math.min(q, qmax);
}

// busier on Fri/Sat/Sun (Moroccan weekly shopping + Jumu'ah); quiet midweek
function dayBusy(d) { const g = d.getDay(); return (g === 5 || g === 6 || g === 0) ? 1.28 : (g === 1 ? 0.9 : 1); }
// shop is busiest early morning and after work; pick an hour from a peaked spread
const HOURS = [7, 8, 8, 9, 9, 10, 11, 12, 12, 13, 14, 16, 17, 18, 18, 19, 19, 20, 20, 21];

// ---- contacts -------------------------------------------------------------
const customerNames = ['مهدي', 'كريمة', 'يوسف', 'فاطمة', 'سعيد', 'نعيمة', 'عمر', 'سلمى', 'رشيد', 'هند'];
const supplierNames = ['موزع أطلس', 'المستودع المركزي', 'سوديال للتوزيع'];
const contacts = [];
customerNames.forEach((n, i) => contacts.push({ id: 'c' + (i + 1), name: n, type: 'customer', phone: '06' + between(10, 99) + ' ' + between(100, 999) + ' ' + between(100, 999) }));
supplierNames.forEach((n, i) => contacts.push({ id: 'cs' + (i + 1), name: n, type: 'supplier', phone: '05' + between(20, 39) + ' ' + between(100, 999) + ' ' + between(100, 999) }));
const customerIds = contacts.filter((c) => c.type === 'customer').map((c) => c.id);

// ---- sales (+ debt charges for credit sales) ------------------------------
const sales = [], debts = [];
let sN = 0, dN = 0;
for (let day = DAYS; day >= 0; day--) {
  const d0 = dayOffset(day);
  const count = Math.round(between(40, 60) * dayBusy(d0));
  for (let k = 0; k < count; k++) {
    const idx = pick(pool);
    const it = items[idx];
    const qty = saleQty(idx);
    const credit = chance(0.12);                      // a known customer "على الكريدي"
    const contactId = credit ? pick(customerIds) : null;
    const t = new Date(d0); t.setHours(pick(HOURS), between(0, 59), between(0, 59), 0);
    const sale = {
      id: 's' + (++sN), date: iso(d0), ts: isots(t), itemId: it.id, name: it.name,
      qty, price: it.price, cost: it.cost, unit: it.unit,
      total: round2(qty * it.price), payment: credit ? 'credit' : 'cash', contactId,
    };
    sales.push(sale);
    if (credit) debts.push({ id: 'd' + (++dN), contactId, kind: 'charge', amount: sale.total, date: sale.date, ts: sale.ts, saleId: sale.id, note: it.name });
  }
}
sales.sort((a, b) => a.ts < b.ts ? -1 : 1);

// partial repayments so some customers still owe and some are clear
customerIds.forEach((cid) => {
  const owed = debts.filter((x) => x.contactId === cid && x.kind === 'charge').reduce((s, x) => s + x.amount, 0);
  if (owed > 0 && chance(0.65)) {
    const pay = Math.round(owed * (chance(0.5) ? 1 : 0.5));
    const t = dayOffset(between(0, 18));
    debts.push({ id: 'd' + (++dN), contactId: cid, kind: 'payment', amount: pay, date: iso(t), ts: isots(t), note: 'تسديد' });
  }
});

// ---- expenses (operating costs only) --------------------------------------
// COGS is captured per-sale via `cost`, so the cashbook here is operating expenses only
// (rent, utilities, phone/internet, transport, sundries) — no double-counting of goods.
const expenses = [];
let eN = 0;
function addExp(off, amount, category, note) { const t = dayOffset(off); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount, category, note }); }
for (let m = 0; m * 30 <= DAYS; m++) {                // monthly fixed costs
  const base = m * 30;
  addExp(base + between(0, 3), 1500, 'كراء', 'كراء شهري');
  addExp(base + between(6, 12), between(180, 320), 'فواتير', 'كهرباء وماء');
  addExp(base + between(8, 14), between(100, 150), 'فواتير', 'هاتف وأنترنت');
}
for (let day = DAYS; day >= 0; day--) {               // scattered small running costs
  if (chance(0.16)) addExp(day, between(20, 80), 'نقل', 'نقل البضاعة');
  if (chance(0.10)) addExp(day, between(15, 45), 'متفرقات', pick(['أكياس', 'صيانة', 'متفرقات']));
}
expenses.sort((a, b) => a.ts < b.ts ? -1 : 1);

// ---- settings -------------------------------------------------------------
const settings = { business: 'حانوت كريمة', currency: 'MAD', lang: 'ar', theme: 'light', enabled: {} };

const out = { version: 'demo-2', settings, items, contacts, sales, debts, expenses };
fs.writeFileSync(path.join(__dirname, 'sample.json'), JSON.stringify(out));

// ---- summary --------------------------------------------------------------
const revenue = sales.reduce((s, x) => s + x.total, 0);
const cogs = sales.reduce((s, x) => s + x.cost * x.qty, 0);
const opex = expenses.reduce((s, x) => s + x.amount, 0);
const owed = (() => {
  const bal = {};
  debts.forEach((x) => { bal[x.contactId] = (bal[x.contactId] || 0) + (x.kind === 'charge' ? x.amount : -x.amount); });
  return Object.values(bal).reduce((s, v) => s + Math.max(0, v), 0);
})();
console.log('Generated data/sample.json');
console.log('  items     ', items.length);
console.log('  contacts  ', contacts.length);
console.log('  sales     ', sales.length, '·', revenue.toFixed(0), 'MAD over', DAYS, 'days (~' + (revenue / DAYS).toFixed(0) + '/day)');
console.log('  gross marg', (revenue - cogs).toFixed(0), 'MAD · net after opex', (revenue - cogs - opex).toFixed(0), 'MAD');
console.log('  debts     ', debts.length, 'entries ·', owed.toFixed(0), 'MAD outstanding');
console.log('  expenses  ', expenses.length, '·', opex.toFixed(0), 'MAD opex');
