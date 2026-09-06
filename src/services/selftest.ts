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

/** Build a Meta-style webhook payload without hand-writing nested braces. */
function webhookBody(entry: Record<string, any>): string {
  return JSON.stringify({ object: 'page', entry: [entry] });
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

  await run('auth-login-success', 'ความปลอดภัย', 'Login ด้วยบัญชีจริง (ถ้าตั้งค่า env ไว้)', async () => {
    const u = process.env.ADMIN_USERNAME, p = process.env.ADMIN_PASSWORD, s = process.env.ADMIN_SECURITY_CODE;
    if (!u || !p || !s) {
      return { status: 'WARN', detail: 'ข้ามการทดสอบ — ตั้ง ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SECURITY_CODE ใน .env เพื่อทดสอบ login อัตโนมัติได้' };
    }
    const { status, data } = await fetchJson(baseUrl, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, security_code: s }) });
    if (status !== 200 || !data?.success) throw new Error(`HTTP ${status}: ${JSON.stringify(data).slice(0, 150)}`);
    return { detail: 'เข้าสู่ระบบด้วย env credentials สำเร็จ' };
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
    await dbService.upsertCustomer({ psid, customer_name: 'ลูกค้าทดสอบ' });
    const row = await dbService.getCustomer(psid);
    if (!row) throw new Error('สร้างแล้วอ่านไม่เจอ');
    // ยอดซื้อรวมนับจากออเดอร์ที่ยังไม่ยกเลิก (ไม่ใช่คอลัมน์ customers.total_spent)
    await dbService.upsertOrder({ order_id: orderId, psid, total_amount: 500, quantity: 1, payment_status: 'PENDING' });
    const spent = await dbService.getCustomerTotalSpent(psid);
    if (Number(spent) !== 500) throw new Error(`ยอดรวมไม่ตรง: ${spent}`);
    await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]);
    await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [psid]);
    return { detail: 'upsert → read → ยอดซื้อจากออเดอร์ → cleanup สำเร็จ' };
  });

  await run('db-order-crud', 'ฐานข้อมูล', 'Orders: สร้าง/ยกเลิก/นับ', async () => {
    const orderId = `${PREFIX}order`;
    await dbService.upsertOrder({ order_id: orderId, psid: `${PREFIX}cus2`, total_amount: 990, quantity: 1, payment_status: 'PENDING' });
    let count = await dbService.getCustomerOrderCount(`${PREFIX}cus2`);
    if (count !== 1) throw new Error(`นับออเดอร์ได้ ${count}`);
    await dbService.cancelOrder(orderId);
    count = await dbService.getCustomerOrderCount(`${PREFIX}cus2`);
    if (count !== 0) throw new Error(`หลังยกเลิกนับได้ ${count}`);
    await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]);
    await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [`${PREFIX}cus2`]);
    return { detail: 'upsert → count → cancel → count สำเร็จ' };
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
    await dbService.upsertCustomer({ psid, customer_name: 'คนจำ' });
    await dbService.upsertOrder({ order_id: orderId, psid, total_amount: 300, quantity: 1, payment_status: 'PENDING' });
    const { status, data } = await fetchJson(baseUrl, `/api/customer/memory?psid=${psid}`);
    if (status !== 200 || !data?.success) throw new Error(`HTTP ${status}`);
    if (data.order_count !== 1) throw new Error(`order_count=${data.order_count}`);
    if (data.star_rating !== 2) throw new Error(`star_rating=${data.star_rating}`);
    await dbService.executeRaw('DELETE FROM orders WHERE order_id = ?', [orderId]);
    await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [psid]);
    return { detail: 'ดึงความจำลูกค้า + order_count + star rating สำเร็จ' };
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

  await run('ai-providers', 'AI Provider', 'GET /api/ai/providers มีครบ 5 เจ้า', async () => {
    const { status, data } = await fetchJson(baseUrl, '/api/ai/providers');
    if (status !== 200) throw new Error(`HTTP ${status}`);
    const ids = (data.providers || []).map((p: any) => p.id);
    for (const need of ['GEMINI', 'OPENAI', 'QWEN', 'ZAI', 'LMSTUDIO']) {
      if (!ids.includes(need)) throw new Error(`ขาด provider: ${need}`);
    }
    return { detail: `ครบ 5 เจ้า • current=${data.current}` };
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
    const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webhookBody({ id: PREFIX + 'ghost', messaging: [{ sender: { id: 'x' }, message: { mid: PREFIX + 'm1', text: 'hi' } }] }) });
    if (status !== 200) throw new Error(`HTTP ${status} — Meta ต้องได้ 200 เสมอ`);
    return { detail: 'ตอบ 200 EVENT_RECEIVED โดยไม่ประมวลผล (Meta ไม่ retry)' };
  });

  await run('webhook-echo-guard', 'Webhook E2E', 'Echo message ของเพจเองไม่ถูกตอบกลับ', async () => {
    const pageId = addTestPage();
    try {
      const before = (await fetchJson(baseUrl, '/api/data')).data.logs.length;
      await fetchJson(baseUrl, '/api/webhook/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webhookBody({ id: pageId, messaging: [{ sender: { id: pageId }, message: { mid: PREFIX + 'echo_' + Date.now(), text: 'echo', is_echo: true } }] }) });
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
    const pageId = addTestPage();
    const sender = PREFIX + 'e2e_' + Date.now();
    try {
      const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webhookBody({ id: pageId, messaging: [{ sender: { id: sender }, message: { mid: PREFIX + 'm_' + Date.now(), text: 'ราคาเท่าไหร่คะ' } }] }) });
      if (status !== 200) throw new Error(`webhook HTTP ${status}`);
      // Give the async pipeline (AI call or fallback) time to finish
      await new Promise(r => setTimeout(r, 6000));
      const logs = (await fetchJson(baseUrl, '/api/data')).data.logs;
      const msgLog = logs.find((l: any) => l.sender_id === sender && l.type === 'MESSAGE');
      if (!msgLog) throw new Error('ไม่พบ log รับข้อความของลูกค้า');
      const intentMatch = String(msgLog.content).match(/\[intent:(\w+)\]/);
      const aiLog = logs.find((l: any) => l.sender_id === sender && (l.type === 'AI_REPLY'));
      if (!aiLog) throw new Error('ไม่พบ log การตอบกลับ (AI หรือ fallback)');
      const isFallback = String(aiLog.content).includes('สำรอง');
      const latencyMatch = String(aiLog.content).match(/(\d+)ms/);
      return {
        status: isFallback ? 'WARN' : 'PASS',
        detail: `intent=${intentMatch?.[1] || '?'} • ${isFallback ? 'ตอบด้วย template สำรอง (AI ยังไม่ตั้งค่า)' : 'AI ตอบจริง'} • latency ${latencyMatch?.[1] || '?'}ms`,
        fixHint: isFallback ? 'ตั้งค่า AI Provider ในหน้าตั้งค่า AI เพื่อให้ AI ตอบจริงแทน template' : undefined
      };
    } finally {
      removeTestPage(pageId);
      await dbService.executeRaw('DELETE FROM chat_history WHERE sender_id = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM customers WHERE psid = ?', [sender]).catch(() => {});
      await dbService.executeRaw('DELETE FROM activity_logs WHERE sender_id = ?', [sender]).catch(() => {});
    }
  });

  await run('webhook-comment-flow', 'Webhook E2E', 'คอมเมนต์ซื้อของ → moderation + ตอบกลับ', async () => {
    const pageId = addTestPage();
    const sender = PREFIX + 'cmt_' + Date.now();
    try {
      const { status } = await fetchJson(baseUrl, '/api/webhook/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: webhookBody({ id: pageId, changes: [{ field: 'feed', value: { item: 'comment', from: { id: sender }, message: 'สนใจค่ะ ราคาเท่าไหร่', comment_id: PREFIX + 'c_' + Date.now(), post_id: PREFIX + 'p1' } }] }) });
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
    await dbService.deletePage(`${PREFIX}page`);
    await dbService.executeRaw("DELETE FROM custom_buttons WHERE page_id LIKE 'selftest_%'");
    await dbService.executeRaw("DELETE FROM order_dispatch_counter WHERE page_id LIKE 'selftest_%'");
    db.pages = db.pages.filter(p => !p.page_id.startsWith(PREFIX));
    persistData();
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
