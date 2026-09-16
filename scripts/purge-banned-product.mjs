#!/usr/bin/env node
/**
 * 🚫 Purge Banned Product — ล้างข้อมูลสินค้า/ข้อความขายเก่าที่ถูกยกเลิกออกจากฐานข้อมูลจริง
 *
 * ใช้กรณี: ลูกค้ายังได้รับข้อความขายสินค้าเก่า (เช่น "กล่องตัดยา พกพาง่าย ... โปรอยู่ ฿990")
 * ทั้งที่โค้ดไม่มีข้อความนี้แล้ว — ต้นเหตุคือข้อมูลค้างในตาราง pages/products/chat_history
 * ของ PostgreSQL Production และ AI เห็นประวัติแชทเก่าแล้วพูดเลียนแบบ
 *
 * สคริปต์นี้ทำ 3 อย่าง (เหมือน endpoint POST /api/admin/purge-banned-product แต่รันตรงกับ DB):
 *   1) ลบทุกแถวใน chat_history ที่มีข้อความตรงคำแบน
 *   2) รีเซ็ต product/sequence snapshot ของเพจที่ติดข้อมูลเก่า
 *   3) ลบแถว products ที่ขายสินค้าค่านี้ + เขียนไฟล์ data/banned-product-phrases.json
 *
 * วิธีรัน:
 *   - บนเครื่อง (ชี้ Production): DATABASE_URL="postgres://..." node scripts/purge-banned-product.mjs
 *   - บน Render Shell:            node scripts/purge-banned-product.mjs   (ใช้ DATABASE_URL จาก env อยู่แล้ว)
 *   - เพิ่มคำแบนเอง:              node scripts/purge-banned-product.mjs --phrase "ข้อความที่อยากแบน"
 *   - ดูอย่างเดียวไม่ลบ:          node scripts/purge-banned-product.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';

const DEFAULT_BANNED_PRODUCT_PHRASES = [
  'กล่องตัดยา',
  'ตัดยา พกพาง่าย',
  'โปรอยู่ 990',
  'พกพาง่าย 990',
  'สเปกหรือโปรโมชั่นเพิ่มแจ้งได้เลย'
];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const phraseIdx = args.indexOf('--phrase');
const extraPhrases = phraseIdx !== -1 ? args.slice(phraseIdx + 1).filter(a => !a.startsWith('--')) : [];

const DATABASE_URL = process.env.DATABASE_URL || '';
if (!DATABASE_URL) {
  console.error('❌ ต้องตั้ง DATABASE_URL ก่อน (เช่น DATABASE_URL="postgres://..." node scripts/purge-banned-product.mjs)');
  process.exit(2);
}

// รวมคำแบนจากไฟล์เดิม (ถ้ามี) + default + ที่ส่งมาทาง --phrase
const phrasesFile = path.join(process.cwd(), 'data', 'banned-product-phrases.json');
let phrases = [...DEFAULT_BANNED_PRODUCT_PHRASES];
try {
  if (fs.existsSync(phrasesFile)) {
    const saved = JSON.parse(fs.readFileSync(phrasesFile, 'utf8'));
    if (Array.isArray(saved?.phrases)) phrases.push(...saved.phrases.map(String));
  }
} catch { /* corrupted file -> keep defaults */ }
phrases.push(...extraPhrases.map(p => String(p).trim()).filter(Boolean));
phrases = [...new Set(phrases)];

console.log(`🚫 Purge Banned Product ${dryRun ? '(DRY RUN — ไม่ลบจริง)' : ''}`);
console.log(`   คำแบน ${phrases.length} รายการ:`);
for (const p of phrases) console.log(`   - "${p}"`);
console.log('');

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

const report = { chatHistoryDeleted: 0, pagesReset: [], productsDeleted: 0 };

async function main() {
  await client.connect();
  console.log('🔌 เชื่อมต่อฐานข้อมูลสำเร็จ\n');

  // (1) chat_history — ลบทุกแถวที่ตรงคำแบน
  for (const phrase of phrases) {
    try {
      const cnt = await client.query('SELECT COUNT(*)::int AS c FROM chat_history WHERE text ILIKE $1', [`%${phrase}%`]);
      const n = cnt.rows?.[0]?.c || 0;
      if (n > 0) {
        console.log(`💬 chat_history: พบ ${n} ข้อความตรง "${phrase}"`);
        if (!dryRun) await client.query('DELETE FROM chat_history WHERE text ILIKE $1', [`%${phrase}%`]);
        report.chatHistoryDeleted += Number(n);
      }
    } catch (err) {
      console.warn(`   ⚠️ chat_history ข้าม "${phrase}": ${err.message}`);
    }
  }

  // (2) pages — รีเซ็ต product/sequence snapshot ของเพจที่ติดข้อมูลเก่า
  try {
    const pageRows = await client.query('SELECT page_id, page_name, product, sequence, sales_sequence_steps FROM pages');
    for (const row of pageRows.rows || []) {
      const blob = JSON.stringify([row.product, row.sequence, row.sales_sequence_steps]);
      const hit = phrases.find(p => blob.includes(p));
      if (hit) {
        console.log(`📄 pages: รีเซ็ตเพจ "${row.page_name || row.page_id}" (ตรงคำแบน "${hit}")`);
        if (!dryRun) {
          await client.query("UPDATE pages SET product = '{}', sequence = '{}', sales_sequence_steps = '[]' WHERE page_id = $1", [row.page_id]);
        }
        report.pagesReset.push(String(row.page_name || row.page_id));
      }
    }
  } catch (err) {
    console.warn(`   ⚠️ pages scan ข้าม: ${err.message}`);
  }

  // (3) products — ลบแถวสินค้าที่ขายของค่านี้
  for (const phrase of phrases) {
    try {
      const sel = await client.query(
        'SELECT product_id FROM products WHERE product_name ILIKE $1 OR promotion_detail ILIKE $1 OR opening_text ILIKE $1 OR detail_text ILIKE $1',
        [`%${phrase}%`]
      );
      if (sel.rows.length > 0) {
        console.log(`📦 products: พบ ${sel.rows.length} รายการตรง "${phrase}"`);
        if (!dryRun) {
          await client.query(
            'DELETE FROM products WHERE product_name ILIKE $1 OR promotion_detail ILIKE $1 OR opening_text ILIKE $1 OR detail_text ILIKE $1',
            [`%${phrase}%`]
          );
        }
        report.productsDeleted += sel.rows.length;
      }
    } catch (err) {
      console.warn(`   ⚠️ products ข้าม "${phrase}": ${err.message}`);
    }
  }

  // เขียนไฟล์คำแบนถาวร (รวมคำที่เพิ่มผ่าน --phrase) — เซิร์ฟเวอร์จะโหลดใช้กับ Guard อัตโนมัติ
  if (!dryRun) {
    try {
      fs.mkdirSync(path.dirname(phrasesFile), { recursive: true });
      const custom = phrases.filter(p => !DEFAULT_BANNED_PRODUCT_PHRASES.includes(p));
      fs.writeFileSync(phrasesFile, JSON.stringify({ phrases: custom, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
      console.log(`\n💾 บันทึกคำแบนถาวร: ${phrasesFile}`);
    } catch (err) {
      console.warn(`   ⚠️ บันทึกไฟล์คำแบนไม่สำเร็จ: ${err.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`สรุป: ลบแชท ${report.chatHistoryDeleted} ข้อความ | รีเซ็ต ${report.pagesReset.length} เพจ | ลบสินค้า ${report.productsDeleted} รายการ${dryRun ? ' (DRY RUN — ไม่มีอะไรถูกลบจริง)' : ''}`);
  console.log('หมายเหตุ: หลังรันสำเร็จ แนะนำรีสตาร์ทเซิร์ฟเวอร์ 1 ครั้ง เพื่อเคลียร์แคชประวัติแชท in-memory ให้หมด');
}

main()
  .catch(err => { console.error('❌ purge ล้มเหลว:', err.message); process.exitCode = 1; })
  .finally(() => client.end().catch(() => {}));

