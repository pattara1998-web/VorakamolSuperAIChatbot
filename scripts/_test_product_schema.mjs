/**
 * ทดสอบว่าตาราง products มีคอลัมน์ shipping_fee จริง
 * และ upsertProduct() บันทึก "รูปสินค้า" ลง Postgres/PGlite ได้ครบทุกใบ
 *
 * รากเหง้าที่เจอใน production:
 *   [DB Bridge] Failed to save to PostgreSQL:
 *   error: column "shipping_fee" of relation "products" does not exist
 * → upsertRow() สร้าง INSERT จาก Object.keys(record) ทั้งหมด
 *   คอลัมน์หายไป 1 ตัว = การบันทึกสินค้าล้มเหลวทั้งแถว
 *   image_main…image_closing จึงไม่เคยลง DB = บอทไม่มีรูปส่งให้ลูกค้าเลย
 *
 * วิธีรัน: node scripts/_test_product_schema.mjs
 * (ต้องปิด dev server ก่อน เพราะ PGlite ล็อกโฟลเดอร์ data/pglite ไว้)
 */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? ` → ${extra}` : ''}`); }
};

// ใช้ data dir แยก เพื่อไม่แตะข้อมูลจริงของเจ้าของร้าน
const TEST_DIR = path.join(ROOT, 'data', 'pglite_schema_test');
process.env.PGLITE_DATA_DIR = TEST_DIR;
delete process.env.DATABASE_URL;

// Windows: dynamic import ต้องเป็น file:// URL เสมอ (ไม่อย่างนั้น ERR_UNSUPPORTED_ESM_URL_SCHEME)
const db = await import(pathToFileURL(path.join(ROOT, 'src', 'services', 'database.ts')).href);

await db.initDatabase();

// ── 1) คอลัมน์ shipping_fee ต้องมีอยู่ในตาราง products ──
const cols = await db.executeRaw(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`
);
const colNames = new Set(cols.map(c => String(c.column_name).toLowerCase()));
check('products.shipping_fee มีอยู่จริง', colNames.has('shipping_fee'));
check('products.shipping_duration มีอยู่จริง', colNames.has('shipping_duration'));
for (const img of ['image_main', 'image_detail', 'image_promotion', 'image_review', 'image_closing']) {
  check(`products.${img} มีอยู่จริง`, colNames.has(img));
}

// ── 2) upsertProduct() ด้วย payload แบบที่ UI ส่งจริง (มี shipping_fee) ต้องไม่ล้ม ──
const PAGE_ID = 'SCHEMA_TEST_PAGE';
await db.upsertPage({
  page_id: PAGE_ID,
  page_name: 'เพจทดสอบ schema',
  category: 'AMULET',
  is_active: 1,
  is_connected: 1
});

const PRODUCT_ID = 'SCHEMA_TEST_PRODUCT';
const payload = {
  product_id: PRODUCT_ID,
  page_id: PAGE_ID,
  product_name: 'พระเครื่องทดสอบ schema',
  category: 'AMULET',
  display_price: 590,
  price_1: 590,
  price_2: 1500,
  price_3: 0,
  promotions: [{ id: 'p1', name: 'แพ็ก 2', quantity: 2, price: 1500 }],
  promotion_detail: 'ซื้อ 2 ถูกกว่า',
  shipping_duration: 'จัดส่งด่วน Flash 1-3 วัน',
  courier_brand: 'Flash Express',
  delivery_days: '1-3 วัน',
  shipping_fee: 'ฟรี',
  image_main: 'https://example.com/main.jpg',
  image_detail: 'https://example.com/detail.jpg',
  image_promotion: 'https://example.com/promo.jpg',
  image_review: 'https://example.com/review.jpg',
  image_closing: 'https://example.com/closing.jpg',
  opening_text: 'สวัสดีค่ะ',
  detail_text: 'รายละเอียด',
  promotion_text: 'โปรโมชั่น',
  review_text: 'รีวิว',
  closing_text: 'ปิดการขาย',
  custom_specs: [{ key: 'เนื้อ', value: 'ผงพุทธคุณ' }],
  specs_json: { material: 'ผงพุทธคุณ' }
};

let upsertError = null;
try {
  await db.upsertProduct(payload);
} catch (err) {
  upsertError = err;
}
check('upsertProduct() ไม่ throw (payload มี shipping_fee)', upsertError === null, upsertError?.message || '');

// ── 3) อ่านกลับมา: รูป + shipping_fee + promotions ต้องอยู่ครบ ──
const rows = await db.getProductsByPage(PAGE_ID);
const saved = rows.find(r => r.product_id === PRODUCT_ID);
check('สินค้าถูกบันทึกลง DB จริง', Boolean(saved));
if (saved) {
  check('shipping_fee ถูกบันทึก', String(saved.shipping_fee) === 'ฟรี', `ได้ "${saved.shipping_fee}"`);
  check('image_main ถูกบันทึก', saved.image_main === payload.image_main, `ได้ "${saved.image_main}"`);
  check('image_detail ถูกบันทึก', saved.image_detail === payload.image_detail);
  check('image_promotion ถูกบันทึก', saved.image_promotion === payload.image_promotion);
  check('image_review ถูกบันทึก', saved.image_review === payload.image_review);
  check('image_closing ถูกบันทึก', saved.image_closing === payload.image_closing);
  check('promotions ถูกบันทึกเป็น JSON', Array.isArray(JSON.parse(saved.promotions || '[]')) && JSON.parse(saved.promotions).length === 1);
  check('custom_specs ถูกบันทึกเป็น JSON', Array.isArray(JSON.parse(saved.custom_specs || '[]')));
}

// ── 4) Self-heal: ฟิลด์ใหม่ที่ตารางยังไม่มี ต้องไม่ทำให้ทั้งแถวล้ม ──
let futureError = null;
try {
  await db.upsertProduct({ ...payload, some_future_field_from_ui: 'x' });
} catch (err) {
  futureError = err;
}
check('ฟิลด์แปลกปลอมไม่ทำให้บันทึกสินค้าล้มทั้งแถว (self-heal)', futureError === null, futureError?.message || '');
const afterHeal = (await db.getProductsByPage(PAGE_ID)).find(r => r.product_id === PRODUCT_ID);
check('หลัง self-heal รูปยังอยู่ครบ', Boolean(afterHeal) && afterHeal.image_main === payload.image_main);

// ── cleanup ──
try {
  await db.executeRaw('DELETE FROM products WHERE page_id = ?', [PAGE_ID]);
  await db.executeRaw('DELETE FROM pages WHERE page_id = ?', [PAGE_ID]);
} catch {}

console.log(`\nสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail > 0) process.exit(1);
