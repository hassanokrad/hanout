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
  ['خبز', 'مخبزة', 2, 1.4, 40, 'حبة', 10],
  ['كرواسون', 'مخبزة', 3, 2, 18, 'حبة', 4],
  ['حليب 1ل', 'ألبان', 7, 6, 30, 'حبة', 9],
  ['ياغورت', 'ألبان', 3, 2.2, 24, 'حبة', 6],
  ['زبدة 200غ', 'ألبان', 14, 11, 2, 'حبة', 2],
  ['بيض (30)', 'ألبان', 42, 36, 0, 'طبق', 3],
  ['جبن حصص', 'ألبان', 9, 7, 10, 'حبة', 3],
  ['ماء 1.5ل', 'مشروبات', 5, 3.5, 60, 'حبة', 9],
  ['مشروب غازي 1ل', 'مشروبات', 9, 6.5, 28, 'حبة', 7],
  ['عصير', 'مشروبات', 8, 6, 16, 'حبة', 4],
  ['قهوة 200غ', 'بقالة', 28, 23, 3, 'حبة', 2],
  ['أتاي 200غ', 'بقالة', 18, 14, 12, 'حبة', 4],
  ['سكر 1كغ', 'بقالة', 9, 7.5, 22, 'كغ', 6],
  ['زيت 1ل', 'بقالة', 23, 20, 14, 'حبة', 4],
  ['دقيق 1كغ', 'بقالة', 6, 4.8, 20, 'كغ', 4],
  ['أرز 1كغ', 'بقالة', 14, 11, 12, 'كغ', 3],
  ['معكرونة 500غ', 'بقالة', 7, 5, 18, 'حبة', 4],
  ['معجون الطماطم', 'بقالة', 4, 2.8, 26, 'حبة', 5],
  ['علبة طون', 'بقالة', 11, 8.5, 15, 'حبة', 4],
  ['شيبس', 'وجبات خفيفة', 5, 3.2, 30, 'حبة', 7],
  ['بسكويت', 'وجبات خفيفة', 4, 2.5, 28, 'حبة', 6],
  ['لوح شوكولاتة', 'وجبات خفيفة', 6, 4, 24, 'حبة', 6],
  ['علكة', 'وجبات خفيفة', 2, 1.2, 35, 'حبة', 5],
  ['صابون', 'نظافة', 5, 3.5, 20, 'حبة', 3],
  ['كيس شامبو', 'نظافة', 2, 1.2, 40, 'حبة', 4],
  ['معجون أسنان', 'نظافة', 13, 10, 8, 'حبة', 2],
  ['مسحوق غسيل 1كغ', 'أدوات منزلية', 19, 15, 9, 'حبة', 3],
  ['ثقاب', 'أدوات منزلية', 2, 1.2, 25, 'حبة', 3],
  ['شمعة', 'أدوات منزلية', 3, 2, 14, 'حبة', 2],
  ['علبة سجائر', 'أخرى', 38, 35, 20, 'حبة', 8],
  ['تعبئة 10', 'أخرى', 10, 9.5, 999, 'حبة', 8],
];
const items = RAW_ITEMS.map((r, i) => ({
  id: 'i' + (i + 1), name: r[0], category: r[1], price: r[2], cost: r[3],
  stock: r[4], unit: r[5], active: true,
}));
// weighted pool for realistic sale frequency
const pool = [];
RAW_ITEMS.forEach((r, i) => { for (let w = 0; w < r[6]; w++) pool.push(items[i]); });

// ---- contacts ----
const customerNames = ['مهدي', 'كريمة', 'يوسف', 'فاطمة', 'سعيد', 'نعيمة', 'عمر', 'سلمى', 'رشيد', 'هند'];
const supplierNames = ['موزع أطلس', 'المستودع المركزي', 'سوديال للتوزيع'];
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
    debts.push({ id: 'd' + (++dN), contactId: cid, kind: 'payment', amount: pay, date: iso(t), ts: isots(t), note: 'تسديد' });
  }
});

// ---- expenses (cashbook out) ----
const expenses = [];
let eN = 0;
for (let day = DAYS; day >= 0; day--) {
  if (chance(0.28)) { const t = dayOffset(day); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: between(200, 900), category: 'مشتريات', note: pick(supplierNames) }); }
}
[60, 30, 0].forEach((off) => { const t = dayOffset(off); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: 800, category: 'كراء', note: 'كراء شهري' }); });
[55, 25].forEach((off) => { const t = dayOffset(off); expenses.push({ id: 'e' + (++eN), date: iso(t), ts: isots(t), amount: between(150, 350), category: 'فواتير', note: 'كهرباء وماء' }); });
expenses.sort((a, b) => a.ts < b.ts ? -1 : 1);

// ---- settings ----
const settings = { business: 'حانوت كريمة', currency: 'MAD', lang: 'ar', theme: 'light', enabled: {} };

const out = { version: 'demo-1', settings, items, contacts, sales, debts, expenses };
fs.writeFileSync(path.join(__dirname, 'sample.json'), JSON.stringify(out));

const revenue = sales.reduce((s, x) => s + x.total, 0);
console.log('Generated data/sample.json');
console.log('  items     ', items.length);
console.log('  contacts  ', contacts.length);
console.log('  sales     ', sales.length, '(' + revenue.toFixed(0) + ' MAD)');
console.log('  debts     ', debts.length, 'ledger entries');
console.log('  expenses  ', expenses.length);
