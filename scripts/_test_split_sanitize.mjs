// Smoke test: ดึงฟังก์ชันจริงจาก server.ts มาทดสอบ (ไม่ duplicate logic)
// ทดสอบ sanitizeCustomerFacingText (COD) + splitLongOutgoingText/splitOutgoingMessages (แตกข้อความยาว)
import fs from 'fs';
import { transformSync } from 'esbuild';

const src = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`ไม่พบ function ${name} ใน server.ts`);
  // body brace = "{" ตัวสุดท้ายของบรรทัด signature (กัน generic Array<{...}> ใน return type)
  const lineEnd = src.indexOf('\n', start);
  let i = src.lastIndexOf('{', lineEnd);
  if (i < start) throw new Error(`หา body brace ของ ${name} ไม่เจอ`);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const constLine = src.split('\n').find(l => l.includes('const MAX_OUTGOING_SEGMENT_CHARS'));
if (!constLine) throw new Error('ไม่พบ MAX_OUTGOING_SEGMENT_CHARS');

const tsCode = [
  constLine.replace('process.env.MAX_OUTGOING_SEGMENT_CHARS || 120', '120'),
  extract('sanitizeCustomerFacingText'),
  extract('splitLongOutgoingText'),
  extract('splitOutgoingMessages')
].join('\n');

// server.ts เป็น TypeScript → ต้อง transpile ด้วย esbuild ก่อน eval
// (return ต่อท้ายหลัง transpile เพราะ esbuild มอง top-level return เป็น syntax error)
const jsCode = transformSync(tsCode, { loader: 'ts', format: 'cjs', target: 'node18' }).code;
const { sanitizeCustomerFacingText, splitLongOutgoingText, splitOutgoingMessages } = new Function(
  `${jsCode}\nreturn { sanitizeCustomerFacingText, splitLongOutgoingText, splitOutgoingMessages };`
)();

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label}`); } };

console.log('── sanitizeCustomerFacingText (COD) ──');
check('"เก็บเงินปลายทาง COD" → "เก็บเงินปลายทาง"', sanitizeCustomerFacingText('มีบริการเก็บเงินปลายทาง COD ค่ะ') === 'มีบริการเก็บเงินปลายทางค่ะ' || sanitizeCustomerFacingText('มีบริการเก็บเงินปลายทาง COD ค่ะ') === 'มีบริการเก็บเงินปลายทาง ค่ะ');
check('"COD" เดี่ยว ๆ → "เก็บเงินปลายทาง"', sanitizeCustomerFacingText('รองรับ COD ค่ะ').includes('เก็บเงินปลายทาง') && !/COD/i.test(sanitizeCustomerFacingText('รองรับ COD ค่ะ')));
check('cod ตัวเล็กก็โดนกรอง', !/cod/i.test(sanitizeCustomerFacingText('ส่งแบบ cod ได้ค่ะ')));
check('ข้อความปกติไม่เปลี่ยน', sanitizeCustomerFacingText('สวัสดีค่ะ สนใจรับชุดไหนดีคะ 😊') === 'สวัสดีค่ะ สนใจรับชุดไหนดีคะ 😊');

console.log('── splitLongOutgoingText (แตกข้อความยาว) ──');
check('ข้อความสั้น → ไม่แตก', splitLongOutgoingText('สนใจรับเป็นชุดไหนดีคะ 😊').length === 1);
const longMsg = 'สนใจรับเป็นชุดไหนดีคะ 😊\n\nสนใจสั่งซื้อ แจ้งชื่อ ที่อยู่ เบอร์โทรผู้รับให้หน่อยนะคะ เดี๋ยวแอดมินสรุปยอดให้ค่ะ มีบริการเก็บเงินปลายทาง ไม่ต้องโอนก่อนค่ะ';
const parts = splitLongOutgoingText(longMsg);
check('ย่อหน้าคั่นบรรทัดว่าง → แยกคนละข้อความ (≥2)', parts.length >= 2);
check('ทุกชิ้นสั้น ≤ 120 ตัวอักษร', parts.every(p => p.length <= 120));
const veryLongLine = 'โปรโมชั่นพิเศษ '.repeat(30).trim(); // ~480 chars บรรทัดเดียว
const hardSplit = splitLongOutgoingText(veryLongLine);
check('บรรทัดเดียวยาวมาก → แตกหลายชิ้น ไม่เกินเพดาน', hardSplit.length > 1 && hardSplit.every(p => p.length <= 120));

console.log('── splitOutgoingMessages (คิวส่ง + รูป) ──');
const queue = [
  { text: '🔥 จุดขายหลักสั้น ๆ', imageUrl: 'img-main' },
  { text: longMsg }
];
const split = splitOutgoingMessages(queue);
check('ข้อความสั้นคงรูปไว้', split[0].imageUrl === 'img-main');
check('ข้อความยาวถูกแตก', split.length > queue.length);
check('รูปไม่ถูกก๊อปไปข้อความย่อยอื่น', split.filter(m => m.imageUrl).length === 1);
check('เพดานรวมไม่เกิน 12 ข้อความ', splitOutgoingMessages(Array.from({ length: 30 }, (_, i) => ({ text: `ข้อความที่ ${i + 1} ยาว ๆ `.repeat(10) }))).length <= 12);

console.log(`\nสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
process.exit(fail > 0 ? 1 : 0);
