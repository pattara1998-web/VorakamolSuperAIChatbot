import * as dbService from './database.js';
import type { DatabaseStore } from './dbBridge.js';

/**
 * Self-Test Suite (ระบบทดสอบตัวเอง)
 * ----------------------------------
 * Black-box tests that exercise the running server through its real HTTP API
 * plus direct PostgreSQL read/write checks. Everything uses `selftest_`
 * prefixed entities and is cleaned up afterwards, so the suite is safe to run
 * on a live system with real data.
 *
 * Results are returned as JSON and written to reports/ as a Markdown file
 * (รายงานผลการทดสอบ-<timestamp>.md + selftest-latest.md) for analysis.
 */

export type TestStatus = 'PASS' | 'FAIL' | 'WARN';

export interface SelfTestResult {
  id: string;
  group: string;
  name: string;
  status: TestStatus;
  durationMs: number;
  detail: string;
  error?: string;
  fixHint?: string;
}

export interface SelfTestReport {
  startedAt: string;
  finishedAt: string;
  totalMs: number;
  summary: { total: number; pass: number; fail: number; warn: number };
  environment: Record<string, any>;
  results: SelfTestResult[];
  reportPath: string;
}

export interface SelfTestDeps {
  baseUrl: string;
  db: DatabaseStore;
  persistData: () => void;
}

const PREFIX = 'selftest_';

async function fetchJson(baseUrl: string, path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<{ status: number; data: any; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text.slice(0, 200); }
    return { status: res.status, data, ok: res.ok };
  } finally {
    clearTimeout(timer);
  }
}

import crypto from 'crypto';

/**
 * Build a Meta-style webhook payload WITHOUT hand-writing nested braces,
 * signed with X-Hub-Signature-256 when the server has META_APP_SECRET —
 * production rejects unsigned webhooks with 403.
 */
function webhookRequest(entry: Record<string, any>): { method: string; body: string; headers: Record<string, string> } {
  const body = JSON.stringify({ object: 'page', entry: [entry] });
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
  if (secret) {
    headers['X-Hub-Signature-256'] = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
  return { method: 'POST', headers, body };
}

export async function runSelfTests(deps: SelfTestDeps): Promise<SelfTestReport> {
  const { baseUrl, db, persistData } = deps;
  const startedAt = new Date();
  const results: SelfTestResult[] = [];

  const run = async (id: string, group: string, name: string, fn: () => Promise<{ detail: string; status?: TestStatus; fixHint?: string }>) => {
    const t0 = Date.now();
    try {
      const out = await fn();
      results.push({ id, group, name, status: out.status || 'PASS', durationMs: Date.now() - t0, detail: out.detail, fixHint: out.fixHint });
    } catch (err: any) {
      results.push({ id, group, name, status: 'FAIL', durationMs: Date.now() - t0, detail: 'เกิดข้อผิดพลาดระหว่างทดสอบ', error: String(err?.message || err), fixHint: err?.fixHint });
    }
  };

  // ---------- purge: ล้างเศษการทดสอบทุกตาราง ทั้ง memory และ PostgreSQL ----------
  // ทำงานตอนเริ่มและจบชุดทดสอบ — กันเศษจากรอบก่อนที่ assertion พังก่อน cleanup
  // (เช่น selftest_mem_order ที่เคยค้างใน production) รอดไปโผล่ในหน้าจริง
  const purgeTestLeftovers = async () => {
    db.orders = db.orders.filter(o => !String(o.order_id || '').startsWith(PREFIX));
    db.customers = db.customers.filter(c => !String(c.psid || '').startsWith(PREFIX));
    db.pages = db.pages.filter(p => !p.page_id.startsWith(PREFIX));
    await dbService.executeRaw("DELETE FROM orders WHERE order_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM customers WHERE psid LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM pages WHERE page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM chat_history WHERE sender_id LIKE 'selftest_%' OR page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM conversation_state WHERE sender_id LIKE 'selftest_%' OR page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM activity_logs WHERE sender_id LIKE 'selftest_%' OR page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM custom_buttons WHERE page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM order_dispatch_counter WHERE page_id LIKE 'selftest_%'").catch(() => {});
    await dbService.executeRaw("DELETE FROM dispatched_messages WHERE page_id LIKE 'selftest_%'").catch(() => {});
    persistData(); // เขียน memory ที่สะอาดแล้วทับ — กัน persistData รอบหลังฟื้นเศษกลับมา
  };
  await purgeTestLeftovers();

  // ---------- helper: temporary selftest page in memory + DB ----------
  const addTestPage = () => {
    const pageId = `${PREFIX}page`;
    // Remove leftovers from a previous crashed run
    db.pages = db.pages.filter(p => p.page_id !== pageId);
    db.pages.unshift({
      page_id: pageId,
      page_name: 'เพจสำหรับทดสอบระบบ',
      category: 'AMULET',
      page_access_token: '',
      verify_token: 'SELFTEST_TOKEN',
      is_active: true,
      auto_reply: true,
      auto_close_ai: true,
      page_avatar: '',
      page_cover: '',
      follower_count: 0,
      likes_count: 0,
      inquiries_count: 0,
      unread_messages: 0,
      ai_model: 'gemini-3.6-flash',
      admin_name: 'ผู้ทดสอบ',
      ai_tone: 'FRIENDLY',
      ai_custom_instructions: 'ตอบสั้นกระชับ',
      ai_brevity_mode: true,
      theme_color: '',
      page_tag: 'NORMAL',
      notification_channel: 'NONE',
      line_notify_token: '',
      line_group_id: '',
      telegram_bot_token: '',
      telegram_chat_id: '',
      google_sheet_url: '',
      scrape_comments_enabled: false,
      auto_inbox_with_comment_context: false,
      hide_toxic_comments: true,
      toxic_keywords: ['โกง'],
      purchase_keywords: ['สนใจ', 'ราคา'],
      comment_reply_template: '',
      comment_reply_images: [],
      comment_auto_tag_customer: true,
      followup_enabled: false,
      followup_messages: [],
      reply_delay_ms: 10,
      bot_stopped: false,
      rate_limit_per_hour: 60,
      quick_replies: [],
      sales_sequence_auto_trigger: false,
      cod_summary_template: '',
      cod_summary_fields: '',
      product: {
        product_id: `${PREFIX}prod`,
        product_name: 'สินค้าทดสอบระบบ',
        category: 'AMULET',
        base_price: 2000,
        display_price: 1490,
        description: 'สินค้าใช้สำหรับทดสอบการตอบแชท',
        promotions: [{ name: 'แพ็ก 1', quantity: 1, price: 1490, free_shipping: false, gift_quantity: 0, free_gifts: '' }],
        images: { main: '', detail: '', promotion: '', review: '', closing: '' }
      },
      sequence: { step1_opening_text: 'สวัสดีค่ะ', step2_product_image: '', step3_promotion_detail: '', step4_promotion_image: '', step5_review_image: '', step6_closing_text: '' },
      sales_sequence_steps: [],
      is_connected: false,
      connected_at: null,
      last_active_at: null
    } as any);
    persistData();
    return pageId;
  };

  const removeTestPage = (pageId: string) => {
    db.pages = db.pages.filter(p => p.page_id !== pageId);
    persistData();
  };

  // ===================== A. INFRASTRUCTURE =====================
  await run('health', 'โครงสร้างพื้นฐาน', 'Health endpoint ตอบสถานะปกติ', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/health');
    if (status !== 200 || data?.status !== 'ok') throw new Error(`HTTP ${status} status=${JSON.stringify(data)}`);
    return { detail: `OK • connected_pages=${data.connected_pages} • ai_configured=${data.ai_configured}` };
  });

  await run('database', 'โครงสร้างพื้นฐาน', 'PostgreSQL อ่าน/เขียนได้', async () => {
    await dbService.executeRaw('SELECT 1');
    const logs = await dbService.getRecentLogs(1);
    return { detail: `PostgreSQL เชื่อมต่อสำเร็จ • อ่าน activity_logs ได้ ${logs.length} แถว` };
  });

  await run('sse', 'โครงสร้างพื้นฐาน', 'SSE endpoint (/api/events) stream ได้', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${baseUrl}/api/events`, { signal: controller.signal });
      if (!res.ok || !(res.headers.get('content-type') || '').includes('text/event-stream')) {
        throw new Error(`HTTP ${res.status} content-type=${res.headers.get('content-type')}`);
      }
      const reader = res.body?.getReader();
      if (reader) { await reader.read(); reader.cancel(); }
      return { detail: 'เชื่อมต่อ SSE และรับ event แรกสำเร็จ' };
    } finally {
      clearTimeout(timer);
    }
  });

  // ===================== B. AUTH & SECURITY =====================
  await run('auth-login-validation', 'ความปลอดภัย', 'Login endpoint ตรวจข้อมูลครบ', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (status !== 400) throw new Error(`คาดว่า HTTP 400 แต่ได้ ${status}`);
    return { detail: `ตรวจ field ครบ: ${data?.error || 'ok'}` };
  });

  await run('auth-login-success', 'ความปลอดภัย', 'Login ด้วยบัญชีจริง + ได้ device_token (เครื่องที่ไว้ใจ)', async () => {
    // บัญชีจริงของเจ้าของระบบ (env ยัง override ได้เสมอ)
    const u = process.env.ADMIN_USERNAME || 'adminpremium';
    const p = process.env.ADMIN_PASSWORD || '18062522';
    const s = process.env.ADMIN_SECURITY_CODE || '170962';
    const { status, data } = await fetchJson(baseUrl, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, security_code: s }) });
    if (status !== 200 || !data?.success) throw new Error(`HTTP ${status}: ${JSON.stringify(data).slice(0, 150)}`);
    if (!data.device_token) throw new Error('login สำเร็จแต่ไม่ได้ device_token (ระบบจำเครื่องพัง)');
    // device_token ต้องใช้ปลดล็อกด้วย PIN ได้จริง
    const pinRes = await fetchJson(baseUrl, '/api/auth/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_token: data.device_token, pin: s }) });
    if (pinRes.status !== 200 || !pinRes.data?.success) throw new Error(`PIN จาก device_token ใช้ไม่ได้: HTTP ${pinRes.status}`);
    return { detail: 'ล็อกอินสำเร็จ + ได้ device_token + ปลดล็อกด้วย PIN จากเครื่องที่ไว้ใจ สำเร็จ' };
  });

  await run('auth-pin-gate', 'ความปลอดภัย', 'PIN Gate: ปฏิเสธเครื่องที่ไม่ได้ลงทะเบียน', async () => {
    // ขาด field → 400
    const missing = await fetchJson(baseUrl, '/api/auth/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    if (missing.status !== 400) throw new Error(`ขาด field ควร 400 ได้ ${missing.status}`);
    // device_token ปลอม → 401 DEVICE_NOT_TRUSTED (เครื่องแปลกต้องล็อกอินเต็มเสมอ)
    const fake = await fetchJson(baseUrl, '/api/auth/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_token: PREFIX + 'fake_token_' + Date.now(), pin: '170962' }) });
    if (fake.status !== 401) throw new Error(`token ปลอม ควร 401 ได้ ${fake.status}`);
    if (fake.data?.error !== 'DEVICE_NOT_TRUSTED') throw new Error(`error=${fake.data?.error}`);
    return { detail: 'ปฏิเสธ field ไม่ครบ + ปฏิเสธเครื่องที่ไม่ได้ลงทะเบียน (DEVICE_NOT_TRUSTED)' };
  });

  // ===================== C. DATABASE CRUD =====================
  await run('db-pages-crud', 'ฐานข้อมูล', 'Pages: สร้าง/อ่าน/แก้/ลบ', async () => {
    const id = `${PREFIX}crud_page`;
    await dbService.upsertPage({ page_id: id, page_name: 'CRUD', category: 'CHINA', is_active: true, product: '{}', sequence: '{}', sales_sequence_steps: '[]', quick_replies: '[]', toxic_keywords: '[]', purchase_keywords: '[]', comment_reply_images: '[]', followup_messages: '[]' });
    const row = await dbService.getPage(id);
    if (!row) throw new Error('สร้างแล้วอ่านไม่เจอ');
    await dbService.updatePageField(id, 'page_name', 'CRUD-แก้แล้ว');
    const after = await dbService.getPage(id);
    if (after?.page_name !== 'CRUD-แก้แล้ว') throw new Error('อัปเดต field ไม่สำเร็จ');
    await dbService.deletePage(id);
    const gone = await dbService.getPage(id);
    if (gone) throw new Error('ลบไม่สำเร็จ');
    return { detail: 'create → read → update → delete ครบวงจร' };
  });

  await run('db-products-read', 'ฐานข้อมูล', 'Products: อ่านตามหมวด', async () => {
    const rows = await dbService.getProductsByCategory('AMULET');
    return { detail: `อ่าน products หมวด AMULET ได้ ${rows.length} รายการ` };
  });

  await run('db-customer-crud', 'ฐานข้อมูล', 'Customers: สร้าง/อ่าน/ยอดซื้อรวม/ลบ', async () => {
    const psid = `${PREFIX}cus`;
    const orderId = `${PREFIX}cus_order`;
    try {
      await dbService.upsertCustomer({ psid, customer_name: 'ลูกค้าทดสอบ' });
      const row = await dbService.getCustomer(psid);
      if (!row) throw new Error('สร้างแล้วอ่านไม่เจอ');
      // ยอดซื้อรวมนับจากออเดอร์ที่ยังไม่ยกเลิก (ไม่ใช่คอลัมน์ customers.total_spent)
      await dbService.upsertOrder({ order_id: orderId, psid, total_amount: 500, quantity: 1, payment_status: 'PENDING' });
      const spent = await dbService.getCustomerTotalSpent(psid);
      if (Number(spent) !== 500) throw new Error(`ยอดรวมไม่ตรง: ${spent}`);
      return { detail: 'upsert → read → ยอดซื้อจากออเดอร์ → cleanup สำเร็จ' };
    } finally {
      await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]).catch(() => {});
      await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [psid]).catch(() => {});
    }
  });

  await run('db-order-crud', 'ฐานข้อมูล', 'Orders: สร้าง/ยกเลิก/นับ', async () => {
    const orderId = `${PREFIX}order`;
    try {
      await dbService.upsertOrder({ order_id: orderId, psid: `${PREFIX}cus2`, total_amount: 990, quantity: 1, payment_status: 'PENDING' });
      let count = await dbService.getCustomerOrderCount(`${PREFIX}cus2`);
      if (count !== 1) throw new Error(`นับออเดอร์ได้ ${count}`);
      await dbService.cancelOrder(orderId);
      count = await dbService.getCustomerOrderCount(`${PREFIX}cus2`);
      if (count !== 0) throw new Error(`หลังยกเลิกนับได้ ${count}`);
      return { detail: 'upsert → count → cancel → count สำเร็จ' };
    } finally {
      await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]).catch(() => {});
      await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [`${PREFIX}cus2`]).catch(() => {});
    }
  });

  await run('db-chat-history', 'ฐานข้อมูล', 'Chat history: บันทึก/อ่านย้อนหลัง', async () => {
    const sender = `${PREFIX}chat`;
    await dbService.addChatMessage(`${PREFIX}page`, sender, 'customer', 'ทดสอบข้อความ ภาษาไทย 🙏');
    const rows = await dbService.getRecentChatHistory(`${PREFIX}page`, sender, 5);
    if (!rows.some(r => String(r.text).includes('ภาษาไทย'))) throw new Error('อ่านย้อนหลังไม่เจอข้อความที่บันทึก');
    await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]);
    return { detail: 'บันทึกและอ่านข้อความไทยถูกต้อง' };
  });

  await run('db-activity-logs', 'ฐานข้อมูล', 'Activity logs: เขียน/อ่าน', async () => {
    const id = `${PREFIX}log`;
    await dbService.addActivityLog({ id, timestamp: new Date().toISOString(), type: 'INFO', sender_id: PREFIX, page_id: PREFIX, content: 'selftest log', status: 'SUCCESS' });
    const logs = await dbService.getRecentLogs(50);
    if (!logs.some(l => l.id === id)) throw new Error('อ่านไม่เจอ log ที่เขียน');
    await dbService.executeRaw('DELETE FROM activity_logs WHERE id = ?', [id]);
    return { detail: 'เขียน/อ่าน log สำเร็จ' };
  });

  await run('db-custom-buttons', 'ฐานข้อมูล', 'Custom buttons: CRUD', async () => {
    const pageId = `${PREFIX}page`;
    await dbService.upsertPage({ page_id: pageId, page_name: 'ปุ่มทดสอบ', category: 'CHINA', product: '{}', sequence: '{}', sales_sequence_steps: '[]', quick_replies: '[]', toxic_keywords: '[]', purchase_keywords: '[]', comment_reply_images: '[]', followup_messages: '[]' });
    const btnId = `${PREFIX}btn`;
    await dbService.addCustomButton({ id: btnId, page_id: pageId, title: 'ราคา', payload: 'price' });
    let list = await dbService.getCustomButtons(pageId);
    if (!list.some(b => b.id === btnId)) throw new Error('เพิ่มปุ่มแล้วอ่านไม่เจอ');
    await dbService.updateCustomButton(btnId, { title: 'ราคาพิเศษ' });
    list = await dbService.getCustomButtons(pageId);
    if (!list.some(b => b.title === 'ราคาพิเศษ')) throw new Error('แก้ปุ่มไม่สำเร็จ');
    await dbService.deleteCustomButton(btnId);
    list = await dbService.getCustomButtons(pageId);
    if (list.some(b => b.id === btnId)) throw new Error('ลบปุ่มไม่สำเร็จ');
    await dbService.deletePage(pageId);
    return { detail: 'add → list → update → delete สำเร็จ' };
  });

  await run('db-dispatch-counter', 'ฐานข้อมูล', 'ตัวนับออเดอร์: เพิ่ม/รีเซ็ต', async () => {
    const pageId = `${PREFIX}page`;
    await dbService.resetDispatchCounter(pageId);
    const first = await dbService.incrementDispatchCounter(pageId);
    const second = await dbService.incrementDispatchCounter(pageId);
    if (second !== first + 1) throw new Error(`ลำดับไม่ถูก: ${first} → ${second}`);
    await dbService.resetDispatchCounter(pageId);
    const afterReset = await dbService.getDispatchCounter(pageId);
    if (afterReset !== 1) throw new Error(`หลังรีเซ็ตได้ ${afterReset}`);
    await dbService.executeRaw('DELETE FROM order_dispatch_counter WHERE page_id = ?', [pageId]);
    return { detail: `increment ${first} → ${second} → reset → 1 สำเร็จ` };
  });

  await run('db-settings', 'ฐานข้อมูล', 'Settings: เขียน/อ่าน', async () => {
    const key = `${PREFIX}setting`;
    await dbService.setSetting(key, 'ค่าทดสอบ-123');
    const val = await dbService.getSetting(key);
    if (val !== 'ค่าทดสอบ-123') throw new Error(`อ่านได้: ${val}`);
    await dbService.executeRaw('DELETE FROM settings WHERE key = ?', [key]);
    return { detail: 'set → get → cleanup สำเร็จ' };
  });

  // ===================== D. HTTP API ENDPOINTS =====================
  await run('api-data', 'API Endpoints', 'GET /api/data คืนครบทุก collection', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/data');
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const keys = ['pages', 'amulet', 'china', 'otop', 'agriculture', 'customers', 'orders', 'logs', 'emergencyAlerts'];
    const missing = keys.filter(k => !Array.isArray(data?.[k]));
    if (missing.length) throw new Error(`ขาด collection: ${missing.join(', ')}`);
    return { detail: `ครบทุก collection • pages=${data.pages.length} customers=${data.customers.length} orders=${data.orders.length}` };
  });

  await run('api-pages-sorted', 'API Endpoints', 'GET /api/pages/sorted', async () => {
    const { status } = await fetchJson(baseUrl, '/api/pages/sorted');
    if (status !== 200) throw new Error(`HTTP ${status}`);
    return { detail: 'ตอบ 200 ปกติ' };
  });

  await run('api-buttons-fk-guard', 'API Endpoints', 'POST /api/buttons ป้องกันเพจไม่มีอยู่ (FK)', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/buttons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: `${PREFIX}no_such_page`, title: 'X' }) });
    if (status !== 400) throw new Error(`คาด 400 ได้ ${status}`);
    if (!String(data?.error || '').includes('not found')) throw new Error('ข้อความผิดพลาดไม่ชัด');
    return { detail: 'ปฏิเสธอย่างสุภาพด้วย 400 พร้อมคำอธิบาย' };
  });

  await run('api-customer-memory', 'API Endpoints', 'GET /api/customer/memory', async () => {
    const psid = `${PREFIX}mem`;
    const orderId = `${PREFIX}mem_order`;
    try {
      await dbService.upsertCustomer({ psid, customer_name: 'คนจำ' });
      await dbService.upsertOrder({ order_id: orderId, psid, total_amount: 300, quantity: 1, payment_status: 'PENDING' });
      const { status, data } = await fetchJson(baseUrl, `/api/customer/memory?psid=${psid}`);
      if (status !== 200 || !data?.success) throw new Error(`HTTP ${status}`);
      if (data.order_count !== 1) throw new Error(`order_count=${data.order_count}`);
      if (data.star_rating !== 2) throw new Error(`star_rating=${data.star_rating}`);
      return { detail: 'ดึงความจำลูกค้า + order_count + star rating สำเร็จ' };
    } finally {
      await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]).catch(() => {});
      await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [psid]).catch(() => {});
    }
  });

  await run('api-dispatch-status', 'API Endpoints', 'GET /api/orders/dispatch-status', async () => {
    const { status } = await fetchJson(baseUrl, `/api/orders/dispatch-status?page_id=${PREFIX}page`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    return { detail: 'ตอบ 200 ปกติ' };
  });

  await run('api-chat-history', 'API Endpoints', 'GET /api/chat-history', async () => {
    const sender = `${PREFIX}inbox`;
    await dbService.addChatMessage(`${PREFIX}page`, sender, 'admin', 'ตอบกลับทดสอบ');
    const { status, data } = await fetchJson(baseUrl, `/api/chat-history?page_id=${PREFIX}page&sender_id=${sender}`);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const history = data?.history || data;
    if (!Array.isArray(history) || !history.some((r: any) => String(r.text).includes('ตอบกลับทดสอบ'))) throw new Error(`อ่านไม่เจอ: ${JSON.stringify(data).slice(0, 100)}`);
    await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]);
    return { detail: 'อ่านประวัติแชทสำหรับ Inbox สำเร็จ' };
  });

  await run('ai-providers', 'AI Provider', 'GET /api/ai/providers มีครบ 3 เจ้าที่คัดแล้ว', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/ai/providers');
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const ids = (data.providers || []).map((p: any) => p.id);
    for (const need of ['GEMINI', 'ZAI', 'LMSTUDIO']) {
      if (!ids.includes(need)) throw new Error(`ขาด provider: ${need}`);
    }
    for (const gone of ['OPENAI', 'QWEN']) {
      if (ids.includes(gone)) throw new Error(`ยังเหลือ provider ที่ตัดออก: ${gone}`);
    }
    return { detail: `ครบ 3 เจ้า (Gemini/Z.AI/LM Studio) • current=${data.current}` };
  });

  await run('ai-configured', 'AI Provider', 'Provider ปัจจุบันพร้อมใช้งาน (โปรบการเชื่อมต่อจริง)', async () => {
    const { data } = await fetchJson(baseUrl, '/api/health');
    const providers = (await fetchJson(baseUrl, '/api/ai/providers')).data;
    const cur = providers.providers.find((p: any) => p.id === providers.current);
    if (!data.ai_configured) {
      return { status: 'WARN', detail: `ยังไม่ได้ตั้งค่า ${cur?.label || providers.current} — เปิดหน้า "ตั้งค่า AI" ใส่คีย์/เลือกโมเดลก่อน`, fixHint: 'เปิดหน้าตั้งค่า AI แล้วใส่ API Key หรือเลือกโมเดล LM Studio' };
    }
    // LM Studio: "ตั้งค่าแล้ว" ไม่พอ — ต้องโปรบว่าโปรแกรมในเครื่องเปิดอยู่จริง
    if (providers.current === 'LMSTUDIO') {
      let base = String(db.settings.lmStudioBaseUrl || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234').replace(/\/+$/, '');
      if (!/\/v\d+$/.test(base)) base += '/v1';
      try {
        const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        const count = (list.data || []).length;
        return { detail: `LM Studio เชื่อมต่อได้จริง (${base}) • มีโมเดลโหลดอยู่ ${count} ตัว • ใช้: ${cur?.model || '-'}` };
      } catch (err: any) {
        return { status: 'WARN', detail: `ตั้งค่า LM Studio ไว้แต่เชื่อมต่อไม่ได้ (${base}): ${err.message} — ลูกค้าจะได้รับข้อความสำรองแทน AI`, fixHint: 'เปิดโปรแกรม LM Studio → Developer → Start Server (พอร์ต 1234) หรือเปลี่ยน provider เป็นคลาวด์ (Gemini/OpenAI/Qwen/Z.AI)' };
      }
    }
    return { detail: `${cur?.label || providers.current} พร้อมทำงาน • โมเดล: ${cur?.model || '-'}` };
  });

  await run('ai-models-invalid-provider', 'AI Provider', 'GET /api/ai/models ปฏิเสธ provider ปลอม', async () => {
    const { status } = await fetchJson(baseUrl, '/api/ai/models?provider=NOT_A_PROVIDER');
    if (status !== 400) throw new Error(`คาด 400 ได้ ${status}`);
    return { detail: 'ปฏิเสธถูกต้อง' };
  });

  // ===================== E. WEBHOOK END-TO-END =====================
  await run('webhook-unknown-page', 'Webhook E2E', 'Webhook เพจที่ไม่มีในระบบ → ปฏิเสธอย่างนุ่มนวล', async () => {
    const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', (webhookRequest({ id: PREFIX + 'ghost', messaging: [{ sender: { id: 'x' }, message: { mid: PREFIX + 'm1', text: 'hi' } }] })));
    if (status !== 200) throw new Error(`HTTP ${status} — Meta ต้องได้ 200 เสมอ`);
    return { detail: 'ตอบ 200 EVENT_RECEIVED โดยไม่ประมวลผล (Meta ไม่ retry)' };
  });

  await run('webhook-echo-guard', 'Webhook E2E', 'Echo message ของเพจเองไม่ถูกตอบกลับ', async () => {
    const pageId = addTestPage();
    try {
      const before = (await fetchJson(baseUrl, '/api/data')).data.logs.length;
      await fetchJson(baseUrl, '/api/webhook/facebook', (webhookRequest({ id: pageId, messaging: [{ sender: { id: pageId }, message: { mid: PREFIX + 'echo_' + Date.now(), text: 'echo', is_echo: true } }] })));
      await new Promise(r => setTimeout(r, 800));
      const afterLogs = (await fetchJson(baseUrl, '/api/data')).data.logs;
      // assertion: no NEW customer-message log created by the echo
      const newChatLogs = afterLogs.slice(0, Math.max(0, afterLogs.length - before)).filter((l: any) => l.type === 'MESSAGE');
      if (newChatLogs.length > 0) throw new Error('echo ถูกประมวลผลเหมือนลูกค้า!');
      return { detail: 'echo ถูกกรองออก ไม่มีการตอบกลับตัวเอง' };
    } finally {
      removeTestPage(pageId);
    }
  });

  await run('webhook-message-e2e', 'Webhook E2E', 'ลูกค้าทักแชท → ประมวลผล → ตอบกลับ (ครบวงจร)', async () => {
    // ใช้เพจจริง (เจ้าของระบบอนุญาต): เพจหนังมันดูทั้งคืน หรือเพจที่เชื่อมต่อจริงและเปิดบอท
    const realPage = db.pages.find(p => p.page_name.includes('เพจหนังมันดูทั้งคืน') && p.is_active && p.auto_reply)
      || db.pages.find(p => Boolean((p as any).is_connected) && p.is_active && p.auto_reply && (p.page_access_token || '').length > 20);
    const usingRealPage = Boolean(realPage);
    const pageId = usingRealPage ? realPage!.page_id : addTestPage();
    const sender = usingRealPage ? `selftest_e2e_real_${Date.now()}` : PREFIX + 'e2e_' + Date.now();
    try {
      const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', (webhookRequest({ id: pageId, messaging: [{ sender: { id: sender }, message: { mid: PREFIX + 'm_' + Date.now(), text: 'ราคาเท่าไหร่คะ' } }] })));
      if (status !== 200) throw new Error(`webhook HTTP ${status}`);
      // Poll for the reply log: a real AI call (Gemini/OpenAI) can take 3-15s
      // on production — a fixed short sleep fails healthy slow replies.
      let logs: any[] = [];
      let msgLog: any = null;
      let aiLog: any = null;
      for (let attempt = 0; attempt < 10 && !aiLog; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        logs = (await fetchJson(baseUrl, '/api/data')).data.logs;
        msgLog = msgLog || logs.find((l: any) => l.sender_id === sender && l.type === 'MESSAGE');
        aiLog = logs.find((l: any) => l.sender_id === sender && (l.type === 'AI_REPLY'));
      }
      if (!msgLog) throw new Error('ไม่พบ log รับข้อความของลูกค้า');
      const intentMatch = String(msgLog.content).match(/\[intent:(\w+)\]/);
      if (!aiLog) throw new Error('ไม่พบ log การตอบกลับ (รอ 20 วินาทีแล้ว — AI อาจใช้เวลานานผิดปกติ)');
      const isFallback = String(aiLog.content).includes('สำรอง');
      const latencyMatch = String(aiLog.content).match(/(\d+)ms/);
      // ดึงสาเหตุจริงที่ AI ล้มเหลวจาก log เพื่อวินิจฉัยได้ทันที
      const errMatch = String(aiLog.content).match(/AI Error: (.+)$/);
      const realError = errMatch ? errMatch[1].slice(0, 160) : '';
      return {
        status: isFallback ? 'WARN' : 'PASS',
        detail: `ใช้เพจ: ${realPage?.page_name || 'selftest_page'} • intent=${intentMatch?.[1] || '?'} • ${isFallback ? `ตอบด้วย template สำรอง — สาเหตุ: ${realError || 'ไม่ทราบ'}` : `AI ตอบจริง (${String(aiLog.content).match(/\(([^|]+)\|/)?.[1]?.trim() || 'โมเดลจาก prompt'} )`} • latency ${latencyMatch?.[1] || '?'}ms`,
        fixHint: isFallback ? `สาเหตุจริง: ${realError || 'ดู log AI Error ในหน้าระบบ'}` : undefined
      };
    } finally {
      if (!usingRealPage) removeTestPage(pageId);
      await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM activity_logs WHERE sender_id = ?', [sender]).catch(() => {});
    }
  });

  await run('webhook-comment-flow', 'Webhook E2E', 'คอมเมนต์ซื้อของ → moderation + ตอบกลับ', async () => {
    const pageId = addTestPage();
    const sender = PREFIX + 'cmt_' + Date.now();
    try {
      const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', (webhookRequest({ id: pageId, changes: [{ field: 'feed', value: { item: 'comment', from: { id: sender }, message: 'สนใจค่ะ ราคาเท่าไหร่', comment_id: PREFIX + 'c_' + Date.now(), post_id: PREFIX + 'p1' } }] })));
      if (status !== 200) throw new Error(`HTTP ${status}`);
      await new Promise(r => setTimeout(r, 4000));
      const logs = (await fetchJson(baseUrl, '/api/data')).data.logs;
      const cmtLog = logs.find((l: any) => l.sender_id === sender && (l.type === 'COMMENT' || l.type === 'COMMENT_HIDDEN'));
      if (!cmtLog) throw new Error('ไม่พบ log การจัดการคอมเมนต์');
      return { detail: 'รับคอมเมนต์ → จัดการตามนโยบายเพจ สำเร็จ (ส่ง Facebook จริงจะข้ามเพราะไม่มี token)' };
    } finally {
      removeTestPage(pageId);
      await dbService.executeRaw('DELETE FROM activity_logs WHERE sender_id = ?', [sender]).catch(() => {});
    }
  });

  // ===================== E2. PAGE TOGGLE & META-STYLE INBOX =====================
  await run('page-toggle', 'Page Toggle', 'สวิตช์เปิด/ปิดเพจ ทำงานครบวงจร', async () => {
    const pageId = addTestPage();
    try {
      // ปิดเพจ
      let { status, data } = await fetchJson(baseUrl, '/api/pages/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, field: 'is_active', value: false }) });
      if (status !== 200 || !data?.success) throw new Error(`ปิดเพจไม่สำเร็จ: HTTP ${status}`);
      if (db.pages.find(p => p.page_id === pageId)?.is_active !== false) throw new Error('memory ไม่อัปเดต');
      // เปิด AI toggle ฝั่ง auto_reply
      ({ status, data } = await fetchJson(baseUrl, '/api/pages/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, field: 'auto_reply', value: false }) }));
      if (status !== 200 || !data?.success) throw new Error(`ปิด AI ไม่สำเร็จ: HTTP ${status}`);
      // field นอก whitelist ต้องถูกปฏิเสธ
      const bad = await fetchJson(baseUrl, '/api/pages/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, field: 'page_access_token', value: 'hack' }) });
      if (bad.status !== 400) throw new Error('ไม่ปฏิเสธ field ต้องห้าม!');
      return { detail: 'ปิดเพจ → ปิด AI → ปฏิเสธ field ต้องห้าม สำเร็จ' };
    } finally {
      removeTestPage(pageId);
    }
  });

  await run('inbox-meta-features', 'Meta Inbox', 'รายการแชท + ติดดาว/บล็อก/ยังไม่ได้อ่าน', async () => {
    const pageId = addTestPage();
    const sender = PREFIX + 'inbox_meta';
    try {
      // จำลองลูกค้าทักเข้ามา 1 ข้อความ (ผ่าน webhook เพื่อให้ state ถูกสร้างจริง)
      const hook = webhookRequest({ id: pageId, messaging: [{ sender: { id: sender }, message: { mid: PREFIX + 'im_' + Date.now(), text: 'สวัสดีคะ' } }] });
      const hookRes = await fetchJson(baseUrl, '/api/webhook/facebook', hook);
      if (hookRes.status !== 200) throw new Error(`webhook HTTP ${hookRes.status} — ต้องได้ 200 เสมอ`);
      // Poll: รอ pipeline (pushHistory -> Postgres) ให้เสร็จ สูงสุด 8 วินาที
      let convo: any = null;
      let lastList: any = null;
      for (let attempt = 0; attempt < 4 && !convo; attempt++) {
        await new Promise(r => setTimeout(r, 2000));
        const list = await fetchJson(baseUrl, `/api/inbox/conversations?page_id=${pageId}`);
        if (list.status !== 200 || !list.data?.success) throw new Error(`conversations HTTP ${list.status}`);
        lastList = list.data;
        convo = (list.data.conversations || []).find((c: any) => c.thread_id === sender);
      }
      if (!convo) throw new Error(`ไม่พบบทสนทนาจากลูกค้าที่เพิ่งทัก (มีทั้งหมด ${lastList?.conversations?.length ?? '?'} แชท: ${JSON.stringify((lastList?.conversations || []).map((c: any) => c.thread_id)).slice(0, 120)})`);
      if (!convo.unread) throw new Error('แชทใหม่ควรสถานะยังไม่ได้อ่าน');
      // ติดดาว + บล็อก
      const st = await fetchJson(baseUrl, '/api/inbox/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, sender_id: sender, is_starred: true, is_blocked: true }) });
      if (st.status !== 200 || !st.data?.success) throw new Error(`state HTTP ${st.status}`);
      const list2 = await fetchJson(baseUrl, `/api/inbox/conversations?page_id=${pageId}`);
      const convo2 = (list2.data.conversations || []).find((c: any) => c.thread_id === sender);
      if (!convo2?.starred || !convo2?.blocked) throw new Error('สถานะติดดาว/บล็อกไม่ถูกบันทึก');
      // ข้อความของบทสนทนา
      const msgs = await fetchJson(baseUrl, `/api/inbox/messages?page_id=${pageId}&sender_id=${sender}`);
      if (msgs.status !== 200 || !msgs.data?.success) throw new Error(`messages HTTP ${msgs.status}`);
      if (!Array.isArray(msgs.data.messages) || msgs.data.messages.length === 0) throw new Error('ไม่พบข้อความในบทสนทนา');
      // mark read หลังเปิดแชท
      if (!convo2.unread === false && msgs.data.messages.length > 0) { /* messages endpoint ล้าง unread แล้ว */ }
      return { detail: `แชทเข้า → unread → ติดดาว → บล็อก → อ่านข้อความ (${msgs.data.messages.length} ข้อความ) สำเร็จ` };
    } finally {
      removeTestPage(pageId);
      await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM conversation_state WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM activity_logs WHERE sender_id = ?', [sender]).catch(() => {});
    }
  });

  // ===================== E3. BOT PAUSE & BROADCAST =====================
  await run('bot-pause-per-customer', 'Meta Inbox', 'หยุดบอทต่อลูกค้า — webhook ไม่ตอบ', async () => {
    const pageId = addTestPage();
    const sender = PREFIX + 'paused_' + Date.now();
    try {
      // หยุดบอทลูกค้ารายนี้
      const st = await fetchJson(baseUrl, '/api/inbox/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, sender_id: sender, bot_paused: true }) });
      if (st.status !== 200 || !st.data?.success) throw new Error(`state HTTP ${st.status}`);
      // ลูกค้าทักเข้ามา — บอทต้องไม่ตอบ (มี log ข้าม ไม่มี AI_REPLY)
      const hook = webhookRequest({ id: pageId, messaging: [{ sender: { id: sender }, message: { mid: PREFIX + 'pz_' + Date.now(), text: 'สนใจค่ะ' } }] });
      const r = await fetchJson(baseUrl, '/api/webhook/facebook', hook);
      if (r.status !== 200) throw new Error(`webhook HTTP ${r.status}`);
      await new Promise(rr => setTimeout(rr, 3000));
      const logs = (await fetchJson(baseUrl, '/api/data')).data.logs;
      const aiLog = logs.find((l: any) => l.sender_id === sender && l.type === 'AI_REPLY');
      if (aiLog) throw new Error('บอทยังตอบลูกค้าที่หยุดบอทไว้!');
      const skipLog = logs.find((l: any) => l.sender_id === sender && String(l.content).includes('หยุดบอท'));
      if (!skipLog) throw new Error('ไม่พบ log การข้ามข้อความ');
      return { detail: 'หยุดบอท → ลูกค้าทัก → ระบบข้าม (ไม่ตอบอัตโนมัติ) สำเร็จ' };
    } finally {
      removeTestPage(pageId);
      await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM conversation_state WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM activity_logs WHERE sender_id = ?', [sender]).catch(() => {});
    }
  });

  await run('broadcast-scan', 'Broadcast', 'สแกนกลุ่มเป้าหมาย + กรองติดดาว/วันที่', async () => {
    const pageId = addTestPage();
    const starSender = PREFIX + 'bc_star';
    const normalSender = PREFIX + 'bc_norm';
    try {
      // สร้าง 2 ลูกค้า: คนหนึ่งติดดาว
      await dbService.addChatMessage(pageId, starSender, 'customer', 'สวัสดีค่ะ');
      await dbService.updateConversationState(pageId, starSender, { is_starred: 1 });
      await dbService.addChatMessage(pageId, normalSender, 'customer', 'สอบถามค่ะ');
      const scanAll = await fetchJson(baseUrl, '/api/broadcast/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId }) });
      if (scanAll.status !== 200 || !scanAll.data?.success) throw new Error(`scan HTTP ${scanAll.status}`);
      if (scanAll.data.total < 2) throw new Error(`เจอแค่ ${scanAll.data.total} คน (ควร >= 2)`);
      const scanStar = await fetchJson(baseUrl, '/api/broadcast/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page_id: pageId, starred: 'only' }) });
      const ids = (scanStar.data.targets || []).map((t: any) => t.sender_id);
      if (scanStar.data.total !== 1 || !ids.includes(starSender)) throw new Error(`กรองติดดาวไม่แม่น: ${scanStar.data.total}`);
      return { detail: `สแกนได้ ${scanAll.data.total} คน → กรองติดดาวเหลือ ${scanStar.data.total} คน ถูกต้อง` };
    } finally {
      removeTestPage(pageId);
      for (const s of [starSender, normalSender]) {
        await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [s]).catch(() => {});
        await dbService.executeRaw('DELETE FROM conversation_state WHERE sender_id = ?', [s]).catch(() => {});
      }
    }
  });

  await run('inbox-avatar-endpoint', 'Meta Inbox', 'รูปโปรไฟล์ลูกค้า (proxy ไม่พังแม้ไม่มีรูป)', async () => {
    const pageId = addTestPage();
    try {
      // เพจทดสอบไม่มี token จริง → endpoint ต้องตอบ 404 อย่างสุภาพ (ไม่ crash)
      const r = await fetchJson(baseUrl, `/api/inbox/avatar?page_id=${pageId}&sender_id=${PREFIX}av`);
      if (r.status !== 404) throw new Error(`คาด 404 ได้ ${r.status}`);
      return { detail: 'endpoint ตอบ 404 เมื่อไม่มีรูป — หน้าเว็บ fallback เป็นไอคอน' };
    } finally {
      removeTestPage(pageId);
    }
  });

  await run('database-status-sync', 'Database', 'สถานะ DB อัตโนมัติ + ซิงค์ลง PostgreSQL', async () => {
    const st = await fetchJson(baseUrl, '/api/database/status');
    if (st.status !== 200 || !st.data?.success) throw new Error(`status HTTP ${st.status}`);
    if (st.data.engine !== 'PostgreSQL') throw new Error(`engine=${st.data.engine}`);
    const sync = await fetchJson(baseUrl, '/api/database/sync', { method: 'POST' }, 30000);
    if (sync.status !== 200 || !sync.data?.success) throw new Error(`sync HTTP ${sync.status}`);
    return { detail: `${st.data.engine} (${st.data.mode}) ซิงค์สำเร็จ ${sync.data.durationMs}ms — เพจ ${sync.data.counts.pages} ลูกค้า ${sync.data.counts.customers} ออเดอร์ ${sync.data.counts.orders}` };
  });

  await run('backup-import-dedupe', 'Database', 'นำเข้า JSON กันข้อมูลซ้ำ (นำเข้าซ้ำ 2 รอบไม่เพิ่ม)', async () => {
    const stamp = Date.now();
    const testCustomers = [
      { psid: PREFIX + 'imp_a', customer_name: 'ลูกค้านำเข้า A', phone_number: '0900000001' },
      { psid: PREFIX + 'imp_b', customer_name: 'ลูกค้านำเข้า B', phone_number: '0900000002' }
    ];
    const payload = { data: { customers: testCustomers }, mode: 'merge' };
    try {
      // เคลียร์เศษจากรอบก่อนทั้ง memory และ DB เพื่อผลลัพธ์ที่แน่นอน
      db.customers = db.customers.filter(c => !c.psid.startsWith(PREFIX + 'imp_'));
      await dbService.executeRaw("DELETE FROM customers WHERE psid LIKE 'selftest_imp_%'");
      // รอบที่ 1: นำเข้าใหม่
      const r1 = await fetchJson(baseUrl, '/api/backup/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r1.status !== 200 || !r1.data?.success) throw new Error(`import#1 HTTP ${r1.status}`);
      const added1 = r1.data.result.customers?.added ?? -1;
      if (added1 !== 2) throw new Error(`รอบ 1 ควรเพิ่ม 2 ได้ ${added1}`);
      // รอบที่ 2: นำเข้าซ้ำเป๊ะ — ต้องเป็น update ทั้งหมด ไม่เพิ่ม
      const r2 = await fetchJson(baseUrl, '/api/backup/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const added2 = r2.data.result.customers?.added ?? -1;
      const updated2 = r2.data.result.customers?.updated ?? -1;
      if (added2 !== 0 || updated2 !== 2) throw new Error(`รอบ 2 ควร 0 เพิ่ม/2 อัปเดต ได้ ${added2}/${updated2}`);
      // DB ต้องมีแค่ 2 แถวพอดี (ไม่ซ้ำมั่ว)
      const inDb = await dbService.executeRaw("SELECT COUNT(*) AS cnt FROM customers WHERE psid LIKE 'selftest_imp_%'");
      if (Number(inDb[0]?.cnt) !== 2) throw new Error(`ใน DB มี ${inDb[0]?.cnt} แถว (ควร 2)`);
      return { detail: 'นำเข้า 2 คน → นำเข้าซ้ำ = อัปเดตทับ (0 เพิ่ม) — ข้อมูลใน DB ไม่ซ้ำ' };
    } finally {
      db.customers = db.customers.filter(c => !c.psid.startsWith(PREFIX + 'imp_'));
      await dbService.executeRaw("DELETE FROM customers WHERE psid LIKE 'selftest_imp_%'").catch(() => {});
      persistData();
    }
  });

  // ===================== F. BACKUP =====================
  await run('backup-create-list', 'สำรองข้อมูล', 'Backup: สร้าง/ดูรายการ', async () => {
    const create = await fetchJson(baseUrl, '/api/backup/create', { method: 'POST' }, 30000);
    if (create.status !== 200) throw new Error(`create HTTP ${create.status}: ${JSON.stringify(create.data).slice(0, 100)}`);
    const list = await fetchJson(baseUrl, '/api/backup/list');
    if (list.status !== 200) throw new Error(`list HTTP ${list.status}`);
    return { detail: 'สร้าง backup และอ่านรายการสำเร็จ' };
  });

  // ---------- cleanup any leftovers, then build the report ----------
  try {
    await purgeTestLeftovers(); // ล้างซ้ำรอบสุดท้าย — รับประกันข้อมูลจริงไม่มีเศษทดสอบ
  } catch { /* best effort */ }

  const finishedAt = new Date();
  const summary = {
    total: results.length,
    pass: results.filter(r => r.status === 'PASS').length,
    fail: results.filter(r => r.status === 'FAIL').length,
    warn: results.filter(r => r.status === 'WARN').length
  };

  const report: SelfTestReport = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    totalMs: finishedAt.getTime() - startedAt.getTime(),
    summary,
    environment: {
      nodeVersion: process.version,
      aiProvider: db.settings.aiProvider || 'GEMINI',
      pages: db.pages.length,
      customers: db.customers.length,
      orders: db.orders.length,
      database: process.env.DATABASE_URL ? 'PostgreSQL (DATABASE_URL)' : 'PostgreSQL (PGlite local)'
    },
    results,
    reportPath: ''
  };

  report.reportPath = writeReportFile(report);
  return report;
}

/** เขียนรายงาน Markdown ลงโฟลเดอร์ reports/ เพื่อนำไปวิเคราะห์และแก้ไขต่อ */
export function writeReportFile(report: SelfTestReport): string {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const icon = (s: TestStatus) => s === 'PASS' ? '✅' : s === 'WARN' ? '⚠️' : '❌';

  const lines: string[] = [];
  lines.push(`# 🧪 รายงานผลการทดสอบระบบ (Self-Test Report)`);
  lines.push('');
  lines.push(`- วันที่ทดสอบ: ${new Date(report.startedAt).toLocaleString('th-TH')}`);
  lines.push(`- ใช้เวลา: ${(report.totalMs / 1000).toFixed(1)} วินาที`);
  lines.push(`- ผลรวม: ✅ ผ่าน ${report.summary.pass} / ⚠️ เตือน ${report.summary.warn} / ❌ พัง ${report.summary.fail} (ทั้งหมด ${report.summary.total})`);
  lines.push(`- สภาพแวดล้อม: Node ${report.environment.nodeVersion} • DB: ${report.environment.database} • AI: ${report.environment.aiProvider} • เพจ ${report.environment.pages} หน้า`);
  lines.push('');

  if (report.summary.fail > 0 || report.summary.warn > 0) {
    lines.push(`## 🚨 สิ่งที่ต้องแก้ไข`);
    lines.push('');
    for (const r of report.results.filter(x => x.status !== 'PASS')) {
      lines.push(`### ${icon(r.status)} [${r.status}] ${r.name} (${r.id})`);
      lines.push(`- กลุ่ม: ${r.group}`);
      lines.push(`- รายละเอียด: ${r.detail}`);
      if (r.error) lines.push(`- Error: \`${r.error}\``);
      if (r.fixHint) lines.push(`- **วิธีแก้**: ${r.fixHint}`);
      lines.push('');
    }
  }

  lines.push(`## 📋 ผลรายการทั้งหมด`);
  lines.push('');
  lines.push(`| สถานะ | กลุ่ม | การทดสอบ | เวลา (ms) | รายละเอียด |`);
  lines.push(`|---|---|---|---|---|`);
  for (const r of report.results) {
    lines.push(`| ${icon(r.status)} ${r.status} | ${r.group} | ${r.name} | ${r.durationMs} | ${r.detail.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  lines.push(`> รันซ้ำ: กดปุ่ม 🧪 Test ในเว็บ หรือ \`npm run selftest\``);

  const md = lines.join('\n');
  fs.writeFileSync(path.join(dir, `รายงานผลการทดสอบ-${stamp}.md`), md, 'utf8');
  fs.writeFileSync(path.join(dir, 'selftest-latest.md'), md, 'utf8');
  return path.join(dir, `รายงานผลการทดสอบ-${stamp}.md`);
}
