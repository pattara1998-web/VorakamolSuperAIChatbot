// E2E test: seed a test page, simulate "สนใจ", verify sentReplies shape.
// Run against a live dev server on http://localhost:3000
// Usage: node scripts/_test_simulate_e2e.mjs

const BASE = 'http://localhost:3000';
const PAGE_ID = 'AMULET_PAGE_ID';
const PSID = `PSID_TEST_SPLIT_${Date.now()}`;

const testPage = {
  page_id: PAGE_ID,
  page_name: 'เพจทดสอบสมุนไพร',
  category: 'AMULET',
  page_access_token: '',
  verify_token: 'FB_AI_SALES_TOKEN_2026',
  is_active: true,
  auto_reply: true,
  auto_close_ai: true,
  ai_model: 'gemini-2.5-flash-lite',
  admin_name: 'น้ำหวาน',
  ai_tone: 'FRIENDLY',
  ai_brevity_mode: true,
  reply_delay_ms: 500,
  product: {
    product_id: 'TEST_HERB_01',
    product_name: 'สมุนไพรบำรุงร่างกาย ตราธรรมชาติ',
    category: 'AMULET',
    base_price: 590,
    display_price: 590,
    description: 'สมุนไพรสกัดเข้มข้น บำรุงร่างกาย รับประทานวันละ 1 แคปซูลก่อนนอน',
    promotions: [
      { id: 'p1', label: 'ซื้อ 1 กล่อง', price: 590, detail: 'ส่งฟรีเก็บเงินปลายทาง' },
      { id: 'p2', label: 'ซื้อ 3 กล่อง', price: 1500, detail: 'ส่งฟรีเก็บเงินปลายทาง + แถม 1 กล่อง' }
    ],
    images: {
      main: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=800&q=80',
      detail: '',
      promotion: '',
      review: '',
      closing: ''
    }
  },
  sequence: {
    step1_opening_text: '',
    step2_product_image: '',
    step3_promotion_detail: '',
    step4_promotion_image: '',
    step5_review_image: '',
    step6_closing_text: ''
  }
};

let failures = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name} ${extra}`);
  }
};

// 1. Seed page
const seedRes = await fetch(`${BASE}/api/data/update`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ collection: 'pages', data: [testPage] })
});
const seedJson = await seedRes.json();
console.log('Seed:', seedRes.status, JSON.stringify(seedJson));
check('seed page success', seedJson.success === true);

// 2. Simulate "สนใจ"
const t0 = Date.now();
const simRes = await fetch(`${BASE}/api/simulate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event_type: 'MESSAGE', sender_id: PSID, page_id: PAGE_ID, message_text: 'สนใจ' })
});
const simJson = await simRes.json();
const elapsed = Date.now() - t0;
console.log(`Simulate: HTTP ${simRes.status} in ${(elapsed / 1000).toFixed(2)}s`);

const replies = simJson.sentReplies || [];
console.log(`sentReplies count: ${replies.length}`);
replies.forEach((r, i) => {
  console.log(`--- entry ${i + 1} ---`);
  console.log(`  text: ${JSON.stringify((r.text || '').slice(0, 120))}`);
  console.log(`  images: ${JSON.stringify(r.images)} (type=${typeof r.images}, isArray=${Array.isArray(r.images)})`);
  if (r.imageUrl !== undefined) console.log(`  imageUrl: ${JSON.stringify(String(r.imageUrl).slice(0, 100))}`);
});

check('at least 1 reply sent', replies.length >= 1);
check('no entry has string-typed images', replies.every(r => r.images === undefined || Array.isArray(r.images)));
check('no entry has COD in text', replies.every(r => !/\bCOD\b/i.test(r.text || '')));
check('all texts within split limit (<=140 chars)', replies.every(r => (r.text || '').length <= 140),
  `(max=${Math.max(...replies.map(r => (r.text || '').length))})`);
check('at least one image attached somewhere', replies.some(r => (r.images && r.images.length > 0) || r.imageUrl));

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
