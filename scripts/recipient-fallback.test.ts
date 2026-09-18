import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildRecipientFallback, parseRecipientInfo } from '../src/utils/recipientFallback.ts';

const address = '106/373 ม1 ตำบลแสนภูดาษ อำเภอบ้านโพธิ์ จังหวัดฉะเชิงเทรา24140';

test('address first: preserves house number and separates recipient', () => {
  const info = parseRecipientInfo(`${address} ทวีโชค ดวงแก้ว 0826529336`);
  assert.equal(info.name, 'ทวีโชค ดวงแก้ว');
  assert.equal(info.address, address);
  assert.equal(info.phone, '0826529336');
});

test('name first and formatted 06 mobile', () => {
  const info = parseRecipientInfo(`ชื่อ: ทวีโชค ดวงแก้ว ${address} โทร: 062-652-9336`);
  assert.equal(info.name, 'ทวีโชค ดวงแก้ว');
  assert.equal(info.address, address);
  assert.equal(info.phone, '0626529336');
});

test('receipt is pending, without fabricated total or tracking', () => {
  const reply = buildRecipientFallback(`${address} ทวีโชค ดวงแก้ว 0826529336`)!;
  assert.match(reply, /ทวีโชค ดวงแก้ว/);
  assert.match(reply, /0826529336/);
  assert.match(reply, /106\/373/);
  assert.match(reply, /ยังไม่ได้ยืนยันคำสั่งซื้อ/);
  assert.doesNotMatch(reply, /฿|เลขพัสดุ|โปรโมชั่น|รับชุดไหน/);
});

test('phone alone asks for missing recipient fields', () => {
  const reply = buildRecipientFallback('0826529336')!;
  assert.match(reply, /ขอชื่อ-นามสกุลผู้รับ และ ที่อยู่จัดส่งเพิ่มเติม/);
});

test('address alone does not invent a name', () => {
  assert.equal(parseRecipientInfo(address).name, '');
  assert.match(buildRecipientFallback(address)!, /ขอชื่อ-นามสกุลผู้รับ และ เบอร์มือถือ/);
});

for (const text of ['1 ชุดราคาเท่าไหร่', 'ราคา 990 บาท', 'ติดตั้งยังไง', '', 'ขอบคุณครับ']) {
  test(`not recipient data: ${text || '(empty)'}`, () => {
    assert.equal(buildRecipientFallback(text), null);
  });
}

test('invalid or overlong phone is not accepted as valid mobile', () => {
  assert.equal(parseRecipientInfo('082652933').phone, '');
  assert.equal(parseRecipientInfo('108265293360').phone, '');
});

test('prefix text before address does not drop the name after postcode', () => {
  const info = parseRecipientInfo('สั่งซื้อค่ะ 106/373 ม1 ตำบลแสนสุข อำเภอบ้านโพธิ์ จังหวัดฉะเชิงเทรา 24140 สมชาย ใจดี 0826529336');
  assert.equal(info.name, 'สมชาย ใจดี');
  assert.equal(info.address, '106/373 ม1 ตำบลแสนสุข อำเภอบ้านโพธิ์ จังหวัดฉะเชิงเทรา 24140');
  assert.equal(info.phone, '0826529336');
});
