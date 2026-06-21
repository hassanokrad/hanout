/* Hanout — synthetic sample data generator.
 * Produces data/sample.json: a small, FICTIONAL corner shop so every screen is
 * populated in the demo build. Deterministic (seeded RNG) so rebuilds are stable.
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
const rnd = mulberry32(20260621);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;

const ANCHOR = new Date('2026-06-20T20:00:00');
const DAYS = 74;
function dayOffset(n) { const d = new Date(ANCHOR); d.setDate(d.getDate() - n); return d; }
const pad = (x) => String(x).padStart(2, '0');
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function isots(d) { return d.toISOString(); }

// ---- catalogue: [name, category, price, cost, stock, unit, weight] ----
const RAW_ITEMS = [
  ['Bread', 'Bakery', 2, 1.4, 40, 'pc', 10],
  ['Croissant', 'Bakery', 3, 2, 18, 'pc', 4],
  ['Milk 1L', 'Dairy', 7, 6, 30, 'pc', 9],
  ['Yogurt', 'Dairy', 3, 2.2, 24, 'pc', 6],
  ['Butter 200g', 'Dairy', 14, 11, 2, 'pc', 2],
  ['Eggs (30)', 'Dairy', 42, 36, 0, 'tray', 3],
  ['Cheese portions', 'Dairy', 9, 7, 10, 'pc', 3],
  ['Water 1.5L', 'Drinks', 5, 3.5, 60, 'pc', 9],
  ['Soda 1L', 'Drinks', 9, 6.5, 28, 'pc', 7],
  ['Juice', 'Drinks', 8, 6, 16, 'pc', 4],
  ['Coffee 200g', 'Grocery', 28, 23, 3, 'pc', 2],
  ['Tea 200g', 'Grocery', 18, 14, 12, 'pc', 4],
  ['Sugar 1kg', 'Grocery', 9, 7.5, 22, 'kg', 6],
  ['Oil 1L', 'Grocery', 23, 20, 14, 'pc', 4],
  ['Flour 1kg', 'Grocery', 6, 4.8, 20, 'kg', 4],
  ['Rice 1kg', 'Grocery', 14, 11, 12, 'kg', 3],
  ['Pasta 500g', 'Grocery', 7, 5, 18, 'pc', 4],
  ['Tomato paste', 'Grocery', 4, 2.8, 26, 'pc', 5],
  ['Tuna can', 'Grocery', 11, 8.5, 15, 'pc', 4],
  ['Chips', 'Snacks', 5, 3.2, 30, 'pc', 7],
  ['Biscuits', 'Snacks', 4, 2.5, 28, 'pc', 6],
  ['Chocolate bar', 'Snacks', 6, 4, 24, 'pc', 6],
  ['Chewing gum', 'Snacks', 2, 1.2, 35, 'pc', 5],
  ['Soap', 'Hygiene', 5, 3.5, 20, 'pc', 3],
  ['Shampoo sachet', 'Hygiene', 2, 1.2, 40, 'pc', 4],
  ['Toothpaste', 'Hygiene', 13, 10, 8, 'pc', 2],
  ['Detergent 1kg', 'Household', 19, 15, 9, 'pc', 3],
  ['Matches', 'Household', 2, 1.2, 25, 'pc', 3],
  ['Candle', 'Household', 3, 2, 14, 'pc', 2],
  ['Cigarettes pack', 'Other', 38, 35, 20, 'pc', 8],
  ['Phone credit 10', 'Other', 10, 9.5, 999, 'pc', 8],
];
const items = RAW_ITEMS.map((r, i) => ({
  id: 'i' + (i + 1), name: r[0], category: r[1], price: r[2], cost: r[3],
  stock: r[4], unit: r[5], active: true,
}));
// weighted pool for realistic sale frequency
const pool = [];
RAW_ITEMS.forEach((r, i) => { for (let w = 0; w < r[6]; w++) pool.push(items[i]); });

// ---- contacts ----
const customerNames = ['Mehdi', 'Karima', 'Youssef', 'Fatima', 'Said', 'Naima', 'Omar', 'Salma', 'Rachid', 'Hind'];
const supplierNames = ['Grossiste Atlas', 'Dépôt Central', 'Sodial Distribution'];
const contacts = [];
customerNames.forEach((n, i) => contacts.push({ id: 'c' + (i + 1), name: n, type: 'customer', phone: '06' + between(10, 99) + ' ' + between(100, 999) + ' ' + between(100, 999) }));
supplierNames.forEach((n, i) => contacts.push({ id: 'cs' + (i + 1), name: n, type: 'supplier', phone: '05' + between(20, 39) + ' ' + between(100, 999) + ' ' + between(100, 999) }));
const customerIds = contacts.filter((c) => c.type === 'customer').map((c) => c.id);

// ---- sales (+ debt charges for credit sales) ----
const sales = [], debts = [];
let sN = 0, dN = 0;
for (let day = DAYS; day >= 0; day--) {
  const d0 = dayOffset(day);
  const count = between(3, 9);
  for (let k = 0; k < count; k++) {
    const it = pick(pool);
    if (it.stock === 0 && it.id === 'i6') continue; // eggs are out — skip
    const qty = chance(0.85) ? 1 : between(2, 3);
    let price = it.price;
    if (chance(0.08)) price = Math.max(1, price + pick([-1, 1, 2]));
    const credit = chance(0.14);
    const contactId = credit ? pick(customerIds) : null;
    const t = new Date(d0); t.setHours(between(8, 20), between(0, 59), between(0, 59), 0);
    const sale = {
      id: 's' + (++sN), date: iso(d0), ts: isots(t), itemId: it.id, name: it.name,
      qty, price, total: +(qty * price).toFixed(2), payment: credit ? 'credit' : 'cash', contactId,
    };
    sales.push(sale);
    if (credit) debts.push({ id: 'd' + (++dN), contactId, kind: 'charge', amount: sale.total, date: sale.date, ts: sale.ts, saleId: sale.id, note: it.name });
  }
}
// partial repayments so some customers still owe and some are clear
customerIds.forEach((cid) => {
  const owed = debts.filter((x) => x.contactId === cid && x.kind === 'charge').reduce((s, x) => s + x.amount, 0);
  if (owed > 0 && chance(0.6)) {
    const pay = Math.round(owed * (chance(0.5) ? 1 : 0.5));
    const t = dayOffset(between(0, 20));
    debts.push({ id: 'd' + (++dN), contactId: cid, kind: 'payment', amount: pay, date: iso(t), ts: isots(t), note: 'Repayment' });
  }
});

// ---- expenses (cashbook out) ----
const expenses = [];
let eN = 0;
for (let day = DAYS; day >= 0; day--) {
  if (chance(0.28)) { const t = dayOffset(day); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: between(200, 900), category: 'Purchases', note: pick(supplierNames) }); }
}
[60, 30, 0].forEach((off) => { const t = dayOffset(off); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: 800, category: 'Rent', note: 'Monthly rent' }); });
[55, 25].forEach((off) => { const t = dayOffset(off); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: between(150, 350), category: 'Utilities', note: 'Electricity & water' }); });
expenses.sort((a, b) => a.ts < b.ts ? -1 : 1);

// ---- settings ----
const settings = { business: 'Chez Karima', currency: 'MAD', lang: 'en', theme: 'light', enabled: {} };

const out = { version: 'demo-1', settings, items, contacts, sales, debts, expenses };
fs.writeFileSync(path.join(__dirname, 'sample.json'), JSON.stringify(out));

const revenue = sales.reduce((s, x) => s + x.total, 0);
console.log('Generated data/sample.json');
console.log('  items     ', items.length);
console.log('  contacts  ', contacts.length);
console.log('  sales     ', sales.length, '(' + revenue.toFixed(0) + ' MAD)');
console.log('  debts     ', debts.length, 'ledger entries');
console.log('  expenses  ', expenses.length);
