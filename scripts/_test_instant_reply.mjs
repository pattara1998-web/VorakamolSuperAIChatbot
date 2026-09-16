// Smoke test: ⚡ Instant Sales Engine (Tier 1)
// ดึงฟังก์ชันจริงจาก server.ts มาทดสอบ (ไม่ duplicate logic) —
// buildInstantAck / buildInstantSalesReply / buildLocalClosingAsk / buildLocalOrderInfoRequest
import fs from 'fs';
import { transformSync } from 'esbuild';

const src = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`ไม่พบ function ${name} ใน server.ts`);
  let i = src.indexOf('{', start);
  if (i < 0) throw new Error(`หา body brace ของ ${name} ไม่เจอ`);
  // signature หลายบรรทัดอาจมี return type เป็น object literal `): { ... }` ก่อน body
  // → ไล่จับกลุ่ม brace ทีละกลุ่ม ถ้าจบกลุ่มแล้ว next non-ws คือ `{` อีก = กลุ่มก่อนคือ return type
  for (;;) {
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) { j++; break; } }
    }
    let k = j;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] === '{') { i = k; continue; }
    return src.slice(start, j);
  }
}

function extractConst(prefix) {
  const line = src.split('\n').find(l => l.includes(prefix));
  if (!line) throw new Error(`ไม่พบ ${prefix}`);
  return line;
}

// stub: scrubBannedProductContent ตัวจริงต้องอ่านไฟล์คำแบน — ในเทสต์ให้ผ่านข้อความสะอาด
const stubScrub = `function scrubBannedProductContent(text: string): string | null { const t = String(text || '').trim(); return t || null; }`;

const tsCode = [
  "type IntentHint = 'GREETING' | 'PRICE' | 'PROMOTION' | 'SHIPPING' | 'TRUST' | 'NEGOTIATION' | 'ORDER' | 'FOLLOWUP' | 'PURCHASE' | 'QUESTION';",
  "type OrderDataProblem = 'PHONE_MISSING' | 'PHONE_NOT_START_ZERO' | 'PHONE_TOO_SHORT' | 'PHONE_TOO_LONG' | 'PHONE_NOT_MOBILE' | 'NAME_MISSING' | 'ADDRESS_TOO_SHORT';",
  extractConst('const MAX_OUTGOING_SEGMENT_CHARS').replace('process.env.MAX_OUTGOING_SEGMENT_CHARS || 120', '120'),
  // ORDER_PROBLEM_FIX_HINT เป็น multi-line record — ดึงทั้งก้อน
  (() => {
    const start = src.indexOf('const ORDER_PROBLEM_FIX_HINT');
    if (start < 0) throw new Error('ไม่พบ ORDER_PROBLEM_FIX_HINT');
    const end = src.indexOf('};', start) + 2;
    return src.slice(start, end);
  })(),
  extract('normalizeThaiText'),
  (() => {
    const start = src.indexOf('const INTENT_KEYWORDS');
    if (start < 0) throw new Error('ไม่พบ INTENT_KEYWORDS');
    const end = src.indexOf('];', start) + 2;
    return src.slice(start, end);
  })(),
  extract('classifyIntentInstant'),
  extract('sanitizeCustomerFacingText'),
  extract('stripStartingPricePhrasing'),
  extract('splitLongOutgoingText'),
  extract('resolveProductPricing'),
  stubScrub,
  'type InstantOutgoing = Array<{ text: string; imageUrl?: string; images?: string[] }>;',
  extract('polishInstantText'),
  extractConst('const ALL_IMAGE_KEYS'),
  extract('resolveInstantImageMap'),
  extract('collectInstantImageUrls'),
  'let instantAckRotation = 0;',
  extract('buildInstantAck'),
  extract('buildInstantSalesReply'),
  extract('buildLocalClosingAsk'),
  extract('buildLocalOrderInfoRequest')
].join('\n');

const jsCode = transformSync(tsCode, { loader: 'ts', format: 'cjs', target: 'node18' }).code;
const {
  buildInstantAck, buildInstantSalesReply, buildLocalClosingAsk, buildLocalOrderInfoRequest, classifyIntentInstant
} = new Function(
  `${jsCode}\nreturn { buildInstantAck, buildInstantSalesReply, buildLocalClosingAsk, buildLocalOrderInfoRequest, classifyIntentInstant };`
)();

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label}`); } };

// ── เพจทดสอบเต็มรูปแบบ (เหมือนเพจสมุนไพรจริง) ──
const fullPage = {
  page_name: 'สมุนไพรคุณย่า',
  admin_name: 'น้องฟ้า',
  product: {
    product_name: 'ยาสมุนไพรบำรุงกำลัง',
    benefit: 'ช่วยบำรุงร่างกาย แก้อาการอ่อนเพลีย',
    description: 'สมุนไพรแท้ 100%\nผ่าน อย. เรียบร้อย',
    shipping_fee: 'ฟรี',
    delivery_days: '1-3 วัน',
    courier_brand: 'Flash Express',
    images: {
      main: 'https://img.example/main.jpg',
      detail: 'https://img.example/detail.jpg',
      promotion: 'https://img.example/promo.jpg',
      review: 'https://img.example/review.jpg',
      closing: 'https://img.example/closing.jpg'
    },
    promotions: [
      { name: '1 ชุด', quantity: 1, price: 390, free_shipping: false },
      { name: '3 ชุดสุดคุ้ม', quantity: 3, price: 990, free_shipping: true }
    ]
  }
};

// ── เพจข้อมูลน้อย (ไม่มีรูป ไม่มีโปร มีแค่ราคาเดียว) ──
const minimalPage = {
  page_name: 'ร้านน้องใหม่',
  product: { product_name: 'กระเป๋าผ้า', price_1: 199 }
};

console.log('── classifyIntentInstant ("สนใจ" ต้องเป็น PURCHASE ไม่ใช่ QUESTION) ──');
check('"สนใจ" → PURCHASE', classifyIntentInstant('สนใจ') === 'PURCHASE');
check('"สนใจค่ะ" → PURCHASE', classifyIntentInstant('สนใจค่ะ') === 'PURCHASE');
check('"อยากได้" → PURCHASE', classifyIntentInstant('อยากได้') === 'PURCHASE');
check('"สนใจค่าส่งเท่าไหร่" → SHIPPING (คำถามเฉพาะทางชนะ)', classifyIntentInstant('สนใจค่าส่งเท่าไหร่') === 'SHIPPING');
check('"สนใจราคาเท่าไหร่" → PRICE', classifyIntentInstant('สนใจราคาเท่าไหร่') === 'PRICE');
check('"สั่งซื้อเลย" → ORDER', classifyIntentInstant('สั่งซื้อเลย') === 'ORDER');
check('"สวัสดี" → GREETING', classifyIntentInstant('สวัสดี') === 'GREETING');

console.log('── buildInstantAck (ทักทายทันที + รูปหลัก) ──');
const ack = buildInstantAck(fullPage, 'GREETING');
check('ได้ ≥1 ข้อความ', ack.length >= 1);
check('แนบรูปหลักมากับข้อความแรก', ack[0].images?.[0] === 'https://img.example/main.jpg');
check('มีคำทักทาย', /สวัสดี|หวัดดี/.test(ack[0].text));
const ackSales = buildInstantAck(fullPage, 'PRICE');
check('intent ไม่ใช่ GREETING → เอ่ยชื่อสินค้า', ackSales[0].text.includes('ยาสมุนไพรบำรุงกำลัง'));
const ackMin = buildInstantAck(minimalPage, 'GREETING');
check('เพจไม่มีรูป → ได้ข้อความทักทายอย่างเดียว ไม่พัง', ackMin.length >= 1 && !ackMin[0].images);
const ackA = buildInstantAck(fullPage, 'GREETING')[0].text;
const ackB = buildInstantAck(fullPage, 'GREETING')[0].text;
const ackC = buildInstantAck(fullPage, 'GREETING')[0].text;
check('หมุนเวียนคำทักทาย 3 แบบไม่ซ้ำ', new Set([ackA, ackB, ackC]).size === 3);

console.log('── buildInstantSalesReply (พรีเซนเต็มชุดจาก DB) ──');
const pres = buildInstantSalesReply(fullPage, null, 'PRICE');
check('ได้ 3-8 ข้อความ', pres.length >= 3 && pres.length <= 8);
const allText = pres.map(m => m.text).join('\n');
check('เอ่ยชื่อสินค้า', allText.includes('ยาสมุนไพรบำรุงกำลัง'));
check('บอกราคาจริงจากแพ็ก (390 + 990)', allText.includes('390') && allText.includes('990'));
check('ไม่แต่งราคาเอง (ไม่มี ฿ เลขอื่นนอกจากแพ็กจริง)', !/฿\s*\d/.test(allText.replace(/฿390|฿990/g, '')));
check('บอกส่งฟรีตามแพ็กจริง', allText.includes('ส่งฟรี'));
// 🔧 ฟีดแบ็กเจ้าของร้าน: ระหว่างพรีเซน "ห้าม" พูดเรื่องขนส่ง/ระยะเวลาจัดส่ง
// (พูดได้เฉพาะลูกค้าถามเรื่องส่ง หรือตอนสรุปยอดหลังได้ข้อมูลลูกค้าแล้ว)
check('พรีเซน (PRICE) → ไม่พูดขนส่ง/ระยะเวลาส่ง', !allText.includes('Flash Express') && !allText.includes('1-3 วัน'));
check('ปิดท้ายด้วยคำถามปิดการขาย', /ชุดไหน|กี่ชุด|เลยไหม/.test(pres[pres.length - 1].text));
check('มีรูปประกอบ ≥2 ใบ', pres.filter(m => m.images?.length).length >= 2);
check('ทุกข้อความ ≤120 ตัวอักษร', pres.every(m => m.text.length <= 120));
check('ไม่มีคำว่า COD', !/COD/i.test(allText));
check('ไม่มีข้อความถ่วงเวลา "รอสักครู่"', !/รอสักครู่|กำลังตรวจสอบ/.test(allText));
check('ไม่มีคำว่า "ราคาเริ่มต้น"', !/ราคาเริ่มต้น/.test(allText));

const presMin = buildInstantSalesReply(minimalPage, null, 'GREETING');
const minText = presMin.map(m => m.text).join('\n');
check('เพจข้อมูลน้อย → ยังพรีเซนได้ ไม่พัง', presMin.length >= 2);
check('เพจข้อมูลน้อย → บอกราคาเดียวที่มีจริง (199)', minText.includes('199'));
check('เพจข้อมูลน้อย → ยังปิดการขายด้วยคำถาม', /กี่ชุด|ชุดไหน|เลยไหม/.test(minText));
check('เพจไม่มีรูป → ไม่มี images ติดมา', presMin.every(m => !m.images || m.images.length === 0));

const presShip = buildInstantSalesReply(fullPage, null, 'SHIPPING');
check('intent SHIPPING → รูปแรกไม่ใช่ review (เน้น main/promo)', presShip.find(m => m.images)?.images?.[0] !== 'https://img.example/review.jpg');
const shipText = presShip.map(m => m.text).join('\n');
check('intent SHIPPING (ลูกค้าถามเรื่องส่ง) → บอกขนส่ง+ระยะเวลาจริงได้', shipText.includes('Flash Express') && shipText.includes('1-3 วัน'));
const presTrust = buildInstantSalesReply(fullPage, null, 'TRUST');
check('intent TRUST → เอารูปรีวิวขึ้นก่อน', presTrust.find(m => m.images)?.images?.[0] === 'https://img.example/review.jpg');

console.log('── intent PURCHASE ("สนใจ") = พรีเซนเต็มชุด + รูปครบ ──');
const presBuy = buildInstantSalesReply(fullPage, null, 'PURCHASE');
const buyText = presBuy.map(m => m.text).join('\n');
const buyImages = presBuy.flatMap(m => m.images || []);
check('ได้ ≥3 ข้อความ', presBuy.length >= 3);
check('แนบรูปครบทุกใบที่มีใน DB (5 ใบ ไม่ซ้ำ)', new Set(buyImages).size === 5 && buyImages.length === 5);
check('รูปใบแรก = main (ไล่ตามลำดับการขายจริง)', buyImages[0] === 'https://img.example/main.jpg');
check('บอกราคาจริงจากแพ็ก', buyText.includes('390') && buyText.includes('990'));
check('ไม่พูดเรื่องขนส่ง/ระยะเวลาส่งระหว่างพรีเซน', !buyText.includes('Flash Express') && !buyText.includes('1-3 วัน'));
check('ปิดท้ายด้วยคำถามปิดการขาย', /ชุดไหน|กี่ชุด|เลยไหม/.test(presBuy[presBuy.length - 1].text));

console.log('── รูปจากแหล่งอื่น (ตาราง products / สเต็ป) ต้องถูกส่งจริง ──');
// 🔧 ต้นเหตุ "ลูกค้าไม่ได้รับรูปเลยแม้แต่รูปเดียว": เพจที่เก็บรูปไว้ในคอลัมน์
// image_* ของตาราง products (matchedProduct) หรืออัปโหลดผ่านสเต็ป → เดิมอ่านไม่เจอ
const catalogPage = {
  page_name: 'เพจขายจากแคตตาล็อก',
  product: { product_name: 'พระสมเด็จ', price_1: 1200 },
  sales_sequence_steps: [
    { step_number: 1, text_content: 'เปิดการขาย', image_url: 'https://img.example/step1.jpg' },
    { step_number: 6, text_content: 'ปิดการขาย', image_url: 'https://img.example/step6.jpg' }
  ]
};
const catalogProduct = {
  product_name: 'พระสมเด็จ',
  image_main: 'https://img.example/cat-main.jpg',
  image_detail: 'https://img.example/cat-detail.jpg',
  image_promotion: 'https://img.example/cat-promo.jpg',
  image_review: 'https://img.example/cat-review.jpg',
  image_closing: 'https://img.example/cat-closing.jpg'
};
const presCat = buildInstantSalesReply(catalogPage, catalogProduct, 'PURCHASE');
const catImages = presCat.flatMap(m => m.images || []);
check('รูปจาก matchedProduct.image_* ถูกแนบจริง (≥3 ใบ)', catImages.length >= 3);
check('รูปหลักมาจากคอลัมน์ตาราง products', catImages.includes('https://img.example/cat-main.jpg'));
const ackCat = buildInstantAck(catalogPage, 'PURCHASE', catalogProduct);
check('instant ack แนบรูปหลักจาก matchedProduct', ackCat[0].images?.[0] === 'https://img.example/cat-main.jpg');
check('instant ack เอ่ยชื่อสินค้าจาก matchedProduct', ackCat[0].text.includes('พระสมเด็จ'));

// เพจที่ไม่มีรูปใน product เลย แต่มีรูปอัปโหลดไว้ในสเต็ป → ต้องยังส่งรูปได้
const stepOnlyPage = {
  page_name: 'เพจอัปโหลดรูปผ่านสเต็ป',
  product: { product_name: 'ครีมหน้าใส', price_1: 290 },
  sales_sequence_steps: [
    { step_number: 2, text_content: 'รายละเอียด', image_url: 'https://img.example/step2.jpg' },
    { step_number: 4, text_content: 'โปรโมชั่น', image_url: 'https://img.example/step4.jpg' }
  ]
};
const presStep = buildInstantSalesReply(stepOnlyPage, null, 'PURCHASE');
const stepImages = presStep.flatMap(m => m.images || []);
check('รูปจากสเต็ปถูกดึงมาใช้เมื่อช่องรูปหลักว่าง', stepImages.includes('https://img.example/step2.jpg') && stepImages.includes('https://img.example/step4.jpg'));

console.log('── buildLocalClosingAsk (ชวนปิดการขาย) ──');
const close = buildLocalClosingAsk(fullPage, null);
const closeText = close.map(m => m.text).join('\n');
check('ได้ ≥2 ข้อความ', close.length >= 2);
check('ถามเลือกรับชุดไหน', closeText.includes('ชุดไหน'));
check('โชว์แพ็กจริงพร้อมราคา', closeText.includes('390') && closeText.includes('990'));
check('ขอชื่อ-ที่อยู่-เบอร์โทร', /ชื่อ/.test(closeText) && /ที่อยู่/.test(closeText) && /เบอร์โทร/.test(closeText));
check('แนบรูป closing', close.some(m => m.images?.[0] === 'https://img.example/closing.jpg'));
check('ทุกข้อความ ≤120 ตัวอักษร', close.every(m => m.text.length <= 120));

console.log('── buildLocalOrderInfoRequest (ขอข้อมูลสั่งซื้อที่ขาด) ──');
const fix = buildLocalOrderInfoRequest(['PHONE_NOT_START_ZERO', 'ADDRESS_TOO_SHORT']);
const fixText = fix.map(m => m.text).join('\n');
check('ได้ ≥2 ข้อความ', fix.length >= 2);
check('ขอบคุณก่อนขอข้อมูล', fixText.includes('ขอบคุณ'));
check('บอกปัญหาจริงจาก hint (เบอร์ไม่ขึ้นต้น 0)', fixText.includes('ไม่ขึ้นต้นด้วย 0'));
check('บอกปัญหาที่อยู่ไม่ครบ', fixText.includes('ที่อยู่จัดส่งยังไม่ครบ'));
check('ทุกข้อความ ≤120 ตัวอักษร', fix.every(m => m.text.length <= 120));
const fixEmpty = buildLocalOrderInfoRequest([]);
check('problems ว่าง → ยังขอข้อมูลครบชุดได้ ไม่พัง', fixEmpty.length >= 1 && fixEmpty.map(m => m.text).join('').includes('ชื่อ-นามสกุล'));

console.log(`\nสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
process.exit(fail > 0 ? 1 : 0);
