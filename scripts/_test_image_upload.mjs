// Smoke test: 📷 Messenger Image Delivery — กัน regression "ตั้งรูปไว้แต่ลูกค้าไม่ได้รับรูป"
//
// ต้นเหตุจริงที่เคยทำให้รูปไม่ส่งเลย:
//   uploadReusableAttachment() ยิง multipart ไป /me/message_attachments ด้วย field
//   is_reusable / type / source → Meta ตอบ "(#100) The parameter message is required"
//   → อัปโหลดล้มทุกครั้ง → รูปทุกใบไม่ถึงลูกค้า
// สเปคที่ถูกต้อง: field `message` (JSON string) + `filedata` (ตัวไฟล์)
//
// เทสต์นี้ดึงฟังก์ชันจริงจาก server.ts มาทดสอบ "payload ที่ยิงไป Meta จริง"
// (stub fetch) — ไม่ duplicate logic
import fs from 'fs';
import { transformSync } from 'esbuild';

const src = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

function extract(name) {
  let start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`ไม่พบ function ${name} ใน server.ts`);
  // 🔑 ต้องรวมคำ `async` ด้วย ไม่งั้นฟังก์ชันที่ใช้ await จะพังตอน transform
  if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
  // ⚠️ signature อาจมี object type ใน generic เช่น `Promise<{ success: boolean }>`
  // → ต้องหา `{` ที่เป็น "body จริง" เท่านั้น (ข้าม `{` ที่อยู่ใน <...> หรือ (...))
  let angle = 0, paren = 0, bracket = 0, bodyStart = -1;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '<') angle++;
    else if (c === '>') { if (angle > 0) angle--; }
    else if (c === '(') paren++;
    else if (c === ')') { if (paren > 0) paren--; }
    else if (c === '[') bracket++;
    else if (c === ']') { if (bracket > 0) bracket--; }
    else if (c === '{' && angle === 0 && paren === 0 && bracket === 0) { bodyStart = i; break; }
  }
  if (bodyStart < 0) throw new Error(`หา body brace ของ ${name} ไม่เจอ`);
  let depth = 0;
  for (let j = bodyStart; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
  }
  throw new Error(`body ของ ${name} ไม่ปิด`);
}

const prelude = `
const META_GRAPH_API_VERSION = 'v24.0';
function decryptToken(t: string): string { return String(t || ''); }
const __logs: string[] = [];
function addLog(_t: any, _s: any, _p: any, content: any): void { __logs.push(String(content)); }
`;

const tsCode = [
  prelude,
  extract('attachmentTypeFromMime'),
  extract('extensionForMime'),
  extract('uploadReusableAttachment'),
  extract('sendFacebookImage')
].join('\n');

const jsCode = transformSync(tsCode, { loader: 'ts', format: 'cjs', target: 'node18' }).code;
const { uploadReusableAttachment, sendFacebookImage, __logs } = new Function(
  `${jsCode}\nreturn { uploadReusableAttachment, sendFacebookImage, __logs };`
)();

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log(`  ✅ ${label}`); } else { fail++; console.log(`  ❌ ${label}`); } };

// ── stub fetch: ดักจับ request จริงที่ยิงไป Meta ──
let lastReq = null;
let callLog = [];
let plan = [];
const setPlan = (...entries) => { plan = [...entries]; };
globalThis.fetch = async (url, init) => {
  lastReq = { url: String(url), init };
  let body = null;
  try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { body = null; }
  callLog.push({ url: String(url), body, form: init?.body instanceof FormData ? init.body : null });
  const next = plan.shift();
  if (!next) throw new Error('unexpected fetch call');
  return next;
};

const buf = Buffer.alloc(2048, 7);
const okUpload = { ok: true, json: async () => ({ attachment_id: 'ATT_123' }) };

// ── 1) อัปโหลด reusable attachment: รูปแบบ multipart ต้องตรงสเปค Meta ──
console.log('── uploadReusableAttachment (multipart ตามสเปค Meta) ──');
setPlan(okUpload);
const up = await uploadReusableAttachment('EAA_test_token', buf, 'product-image.jpg', 'image/jpeg');
check('อัปโหลดสำเร็จ → คืน attachment_id', up.success === true && up.attachment_id === 'ATT_123');
check('ยิงไป /me/message_attachments พร้อม access_token', /\/me\/message_attachments\?access_token=EAA_test_token/.test(lastReq.url));
const form = callLog[0].form;
check('body เป็น multipart/form-data (FormData)', form instanceof FormData);
const msgField = form.get('message');
check('มี field "message" เป็น JSON string (Meta บังคับ — ต้นเหตุ error #100)', typeof msgField === 'string' && msgField.trim().startsWith('{'));
const parsed = JSON.parse(String(msgField));
check('message.attachment.type = IMAGE (จาก mime image/jpeg)', parsed?.attachment?.type === 'IMAGE');
check('message.attachment.payload.is_reusable = true', parsed?.attachment?.payload?.is_reusable === true);
const fileField = form.get('filedata');
check('มี field "filedata" เป็นไฟล์จริง (ขนาดตรงกับ buffer)', fileField && typeof fileField !== 'string' && fileField.size === buf.length);
check('นามสกุลไฟล์ตรงกับ mime (image/jpeg → .jpg)', String(fileField?.name || '') === 'product-image.jpg');
check('ไม่ส่ง field ผิดสเปคอีก (is_reusable/type/source)', form.get('source') === null && form.get('is_reusable') === null && form.get('type') === null);

// ── 2) แปลงชนิดไฟล์ตาม mime (รูป/วิดีโอ) ──
console.log('── ชนิด attachment ตาม mime ──');
setPlan(okUpload);
await uploadReusableAttachment('EAA_t', buf, 'x.bin', 'video/mp4');
check('video/mp4 → type VIDEO + นามสกุล .mp4', JSON.parse(String(callLog[1].form.get('message'))).attachment.type === 'VIDEO' && String(callLog[1].form.get('filedata')?.name) === 'product-image.mp4');
setPlan(okUpload);
await uploadReusableAttachment('EAA_t', buf, 'x.bin', 'image/png');
check('image/png → type IMAGE + นามสกุล .png (กัน PNG ถูกส่งชื่อ .jpg)', JSON.parse(String(callLog[2].form.get('message'))).attachment.type === 'IMAGE' && String(callLog[2].form.get('filedata')?.name) === 'product-image.png');

// ── 3) ทางที่ล้มเหลวต้องไม่กลืนเงียบ ──
console.log('── error paths ──');
setPlan({ ok: false, json: async () => ({ error: { message: '(#100) The parameter message is required' } }) });
const bad = await uploadReusableAttachment('EAA_t', buf, 'x.jpg', 'image/jpeg');
check('Meta ปฏิเสธ → success=false พร้อมข้อความ error จาก Meta', bad.success === false && /#100/.test(String(bad.error)));
check('อัปโหลดล้ม → บันทึก Activity log (ไม่กลืนเงียบ)', __logs.some(l => l.includes('อัปโหลด attachment ไม่สำเร็จ')));
const empty = await uploadReusableAttachment('EAA_t', Buffer.alloc(0), 'x.jpg', 'image/jpeg');
check('ไฟล์ว่าง → EMPTY_FILE (ไม่ยิง API)', empty.success === false && empty.error === 'EMPTY_FILE');
const noTok = await uploadReusableAttachment('', buf, 'x.jpg', 'image/jpeg');
check('ไม่มี Page token จริง → PAGE_ACCESS_TOKEN_NOT_CONFIGURED', noTok.success === false && noTok.error === 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED');

// ── 4) ส่งรูปด้วย public URL: มี retry เมื่อ is_reusable ถูกปฏิเสธ ──
console.log('── sendFacebookImage (URL + retry) ──');
callLog = [];
setPlan(
  { ok: false, json: async () => ({ error: { message: 'is_reusable not supported' } }) },
  { ok: true, json: async () => ({ message_id: 'MID_1' }) }
);
const img1 = await sendFacebookImage('EAA_t', 'PSID_1', 'https://example.com/a.jpg');
check('รอบแรกพลาด → ยิงซ้ำแบบ URL ธรรมดาแล้วสำเร็จ', img1.success === true && img1.messageId === 'MID_1' && callLog.length === 2);
check('รอบแรกมี is_reusable / รอบสองไม่มี (fallback)', callLog[0].body.message.attachment.payload.is_reusable === true && callLog[1].body.message.attachment.payload.is_reusable === undefined);
check('payload.url ส่งครบทั้งสองรอบ + recipient ถูกต้อง', callLog[0].body.message.attachment.payload.url === 'https://example.com/a.jpg' && callLog[1].body.message.attachment.payload.url === 'https://example.com/a.jpg' && callLog[0].body.recipient.id === 'PSID_1');
check('ยิงไป /me/messages พร้อม access_token', /\/me\/messages\?access_token=EAA_t/.test(callLog[0].url));
callLog = [];
setPlan(okUpload);
const img2 = await sendFacebookImage('EAA_t', 'PSID_1', 'https://example.com/b.jpg');
check('สำเร็จตั้งแต่รอบแรก → ยิงครั้งเดียว (ไม่ retry เกินจำเป็น)', img2.success === true && callLog.length === 1);
callLog = [];
setPlan(
  { ok: false, json: async () => ({ error: { message: 'boom A' } }) },
  { ok: false, json: async () => ({ error: { message: 'boom B' } }) }
);
const img3 = await sendFacebookImage('EAA_t', 'PSID_1', 'https://example.com/c.jpg');
check('ล้มทั้งสองรอบ → success=false + error จาก Meta', img3.success === false && String(img3.error).includes('boom B'));
const img4 = await sendFacebookImage('', 'PSID_1', 'https://example.com/d.jpg');
check('token ว่าง → ไม่ยิง API (PAGE_ACCESS_TOKEN_OR_IMAGE_NOT_CONFIGURED)', img4.success === false && img4.error === 'PAGE_ACCESS_TOKEN_OR_IMAGE_NOT_CONFIGURED');

console.log(`\nสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
process.exit(fail > 0 ? 1 : 0);

