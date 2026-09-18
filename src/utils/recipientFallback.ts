export interface RecipientInfo {
  name: string;
  address: string;
  phone: string;
  rawText: string;
}

/** Conservative extraction: uncertain fields stay empty, never invent an order. */
export function parseRecipientInfo(text: string): RecipientInfo {
  const rawText = String(text || '').trim();
  const phoneMatch = /(?<!\d)0[689](?:[ -]?\d){8}(?!\d)/.exec(rawText);
  const phone = phoneMatch?.[0].replace(/\D/g, '') || '';
  const body = (phoneMatch ? rawText.replace(phoneMatch[0], ' ') : rawText)
    .replace(/(?:เบอร์โทร(?:ศัพท์)?|โทร(?:ศัพท์)?|มือถือ)\s*[:：]?/g, ' ')
    .trim();
  const addressStart = /(?:บ้านเลขที่\s*[:：]?\s*)?\d+(?:\/\d+)?(?=\s|$)|(?:ตำบล|อำเภอ|จังหวัด|แขวง|เขต)/.exec(body);
  // A number alone can be a quantity or price, not a shipping address.
  const hasAddress = Boolean(addressStart) && /ตำบล|อำเภอ|จังหวัด|แขวง|เขต|ต\.|อ\.|จ\.|หมู่|ม\.?\s*\d/.test(body);
  let name = '';
  let address = '';
  const cleanName = (s: string) => s.replace(/^(?:ชื่อ(?:ผู้รับ)?(?:[- ]?นามสกุล)?|ผู้รับ)\s*[:：]?\s*/, '').trim();
  const plausibleName = (s: string) => /^[\p{L}\p{M}]+(?:[ \t]+[\p{L}\p{M}]+){1,3}$/u.test(s);
  if (hasAddress && addressStart) {
    const prefix = cleanName(body.slice(0, addressStart.index));
    const rest = body.slice(addressStart.index).trim();
    const postcode = /(?<!\d)\d{5}(?!\d)/.exec(rest);
    const suffix = postcode ? cleanName(rest.slice(postcode.index + postcode[0].length)) : '';
    // 🔧 ชื่ออยู่ได้ทั้งก่อนที่อยู่ (prefix) และหลังรหัสไปรษณีย์ (suffix) เช่น
    // "สั่งซื้อค่ะ 106/373 ... 24140 สมชาย ใจดี 0826529336" — เดิมเงื่อนไข !prefix
    // ทำให้ชื่อท้ายข้อความถูกทิ้งเมื่อมีคำนำหน้า (เช่น "สั่งซื้อค่ะ") → ออเดอร์ไม่ถูกสร้าง
    const nameFromPrefix = plausibleName(prefix);
    const nameFromSuffix = !nameFromPrefix && Boolean(postcode) && plausibleName(suffix);
    if (nameFromPrefix) name = prefix;
    else if (nameFromSuffix) name = suffix;
    address = postcode && nameFromSuffix
      ? rest.slice(0, postcode.index + postcode[0].length).trim()
      : rest;
  } else if (phone) {
    const candidate = cleanName(body);
    if (plausibleName(candidate)) name = candidate;
  }
  return { name, address: address.replace(/\s+/g, ' '), phone, rawText };
}

/** Pending receipt only. Pricing and final COD confirmation belong to validated order creation. */
export function buildRecipientFallback(text: string, info = parseRecipientInfo(text)): string | null {
  if (!info.phone && !info.address) return null;
  const lines = ['ได้รับข้อมูลผู้รับแล้วค่ะ'];
  if (info.name && info.name !== 'ลูกค้า') lines.push(`ชื่อ: ${info.name}`);
  if (info.phone) lines.push(`โทร: ${info.phone}`);
  if (info.address && info.address !== 'รอส่งที่อยู่') lines.push(`ที่อยู่: ${info.address}`);
  const missing: string[] = [];
  if (!info.name || info.name === 'ลูกค้า') missing.push('ชื่อ-นามสกุลผู้รับ');
  if (!info.phone) missing.push('เบอร์มือถือ 10 หลัก');
  if (!info.address || info.address === 'รอส่งที่อยู่') missing.push('ที่อยู่จัดส่ง');
  if (missing.length) lines.push(`ขอ${missing.join(' และ ')}เพิ่มเติมค่ะ`);
  lines.push('ยังไม่ได้ยืนยันคำสั่งซื้อหรือยอด COD ต้องตรวจสอบสินค้า จำนวน และยอดกับแอดมินก่อนค่ะ');
  return lines.join('\n');
}
