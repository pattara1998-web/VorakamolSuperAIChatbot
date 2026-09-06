import path from 'path';
import { Pool, types as pgTypes } from 'pg';

/**
 * PostgreSQL database layer (replaces better-sqlite3).
 * - Production: set DATABASE_URL (Render Postgres / Neon / Supabase / any PG)
 *   and every query goes through the node-postgres Pool.
 * - Local dev: if DATABASE_URL is not set, the same SQL runs on PGlite —
 *   real PostgreSQL compiled to WASM, persisted under data/pglite. (An
 *   external postgres.exe process cannot start under a Windows Administrator
 *   account, so the in-process engine is used instead — same engine semantics,
 *   zero setup.)
 * - Every function is async; callers await them. All timestamps are stored as
 *   ISO TEXT (UTC) and booleans as INTEGER 0/1 to keep row semantics identical
 *   to the previous SQLite schema.
 */

// PostgreSQL returns BIGINT (COUNT/SUM) as strings by default — parse them.
pgTypes.setTypeParser(20, (v) => parseInt(v, 10));
pgTypes.setTypeParser(1700, (v) => parseFloat(v));

interface DbDriver {
  query(text: string, params?: any[]): Promise<{ rows: any[] }>;
  exec(text: string): Promise<unknown>;
}

let driver: DbDriver | null = null;

async function getDriver(): Promise<DbDriver> {
  if (driver) return driver;

  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    pool.on('error', (err) => {
      console.error('[PG Pool] Unexpected idle client error:', err.message);
    });
    driver = {
      query: (text, params) => pool.query(text, params),
      exec: async (text) => { await pool.query(text); }
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), 'data', 'pglite'));
    await db.waitReady;
    driver = {
      query: (text, params) => db.query(text, params as any[]) as Promise<{ rows: any[] }>,
      exec: (text) => db.exec(text)
    };
  }
  return driver;
}

/** Convert SQLite-style `?` placeholders to PostgreSQL `$n`. */
async function q(sql: string, params: any[] = []): Promise<any> {
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  const d = await getDriver();
  return d.query(text, params);
}

const PG_NOW_DEFAULT = `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Raw query escape hatch (used by the self-test suite for cleanup). */
export async function executeRaw(sql: string, params: any[] = []): Promise<any[]> {
  const res = await q(sql, params);
  return res.rows;
}

export async function initDatabase(): Promise<void> {
  const d = await getDriver();
  // Health probe — fails fast with a clear error if the engine is unreachable.
  await d.query('SELECT 1');
  await initTables();
}

async function initTables() {
  const d = await getDriver();
  await d.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      page_id TEXT PRIMARY KEY,
      page_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'CHINA',
      page_access_token TEXT DEFAULT '',
      verify_token TEXT DEFAULT 'FB_AI_SALES_TOKEN_2026',
      is_active INTEGER DEFAULT 1,
      auto_reply INTEGER DEFAULT 1,
      auto_close_ai INTEGER DEFAULT 1,
      page_avatar TEXT DEFAULT '',
      page_cover TEXT DEFAULT '',
      follower_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      inquiries_count INTEGER DEFAULT 0,
      unread_messages INTEGER DEFAULT 0,
      ai_model TEXT DEFAULT 'gemini-3.6-flash',
      admin_name TEXT DEFAULT '',
      ai_tone TEXT DEFAULT 'FRIENDLY',
      ai_custom_instructions TEXT DEFAULT '',
      ai_brevity_mode INTEGER DEFAULT 1,
      theme_color TEXT DEFAULT '',
      page_tag TEXT DEFAULT 'NORMAL',
      notification_channel TEXT DEFAULT 'BOTH',
      line_notify_token TEXT DEFAULT '',
      line_group_id TEXT DEFAULT '',
      telegram_bot_token TEXT DEFAULT '',
      telegram_chat_id TEXT DEFAULT '',
      google_sheet_url TEXT DEFAULT '',
      scrape_comments_enabled INTEGER DEFAULT 0,
      auto_inbox_with_comment_context INTEGER DEFAULT 0,
      hide_toxic_comments INTEGER DEFAULT 1,
      toxic_keywords TEXT DEFAULT '[]',
      purchase_keywords TEXT DEFAULT '[]',
      comment_reply_template TEXT DEFAULT '',
      comment_reply_images TEXT DEFAULT '[]',
      comment_auto_tag_customer INTEGER DEFAULT 1,
      followup_enabled INTEGER DEFAULT 0,
      followup_messages TEXT DEFAULT '[]',
      reply_delay_ms INTEGER DEFAULT 1500,
      bot_stopped INTEGER DEFAULT 0,
      rate_limit_per_hour INTEGER DEFAULT 30,
      quick_replies TEXT DEFAULT '[]',
      sales_sequence_auto_trigger INTEGER DEFAULT 0,
      cod_summary_template TEXT DEFAULT '',
      cod_summary_fields TEXT DEFAULT '',
      product TEXT DEFAULT '{}',
      sequence TEXT DEFAULT '{}',
      sales_sequence_steps TEXT DEFAULT '[]',
      is_connected INTEGER DEFAULT 0,
      connected_at TEXT,
      last_active_at TEXT,
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'CHINA',
      display_price DOUBLE PRECISION DEFAULT 0,
      price_1 DOUBLE PRECISION DEFAULT 0,
      price_2 DOUBLE PRECISION DEFAULT 0,
      price_3 DOUBLE PRECISION DEFAULT 0,
      promotion_detail TEXT DEFAULT '',
      shipping_duration TEXT DEFAULT '',
      image_main TEXT DEFAULT '',
      image_detail TEXT DEFAULT '',
      image_promotion TEXT DEFAULT '',
      image_review TEXT DEFAULT '',
      image_closing TEXT DEFAULT '',
      opening_text TEXT DEFAULT '',
      detail_text TEXT DEFAULT '',
      promotion_text TEXT DEFAULT '',
      review_text TEXT DEFAULT '',
      closing_text TEXT DEFAULT '',
      specs_json TEXT DEFAULT '{}',
      custom_specs TEXT DEFAULT '[]',
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      psid TEXT PRIMARY KEY,
      customer_name TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      address TEXT DEFAULT '',
      category_preference TEXT DEFAULT '',
      total_spent DOUBLE PRECISION DEFAULT 0,
      total_items_count INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'NORMAL',
      first_interaction TEXT DEFAULT '',
      last_interaction TEXT DEFAULT '',
      last_order_date TEXT,
      last_order_items TEXT,
      last_tracking_number TEXT,
      status TEXT DEFAULT 'NEW_CUSTOMER',
      notes TEXT DEFAULT '',
      order_count INTEGER DEFAULT 0,
      last_product_id TEXT,
      source_comment TEXT,
      page_id TEXT,
      tags TEXT DEFAULT '[]',
      telesales_status TEXT DEFAULT 'NOT_CONTACTED',
      telesales_note TEXT,
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      psid TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      shipping_address TEXT DEFAULT '',
      items TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      total_amount DOUBLE PRECISION DEFAULT 0,
      payment_status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      tracking_number TEXT DEFAULT '',
      page_id TEXT,
      category TEXT,
      notes TEXT,
      dispatch_number INTEGER,
      dispatch_message_id TEXT,
      is_cancelled INTEGER DEFAULT 0,
      cancelled_at TEXT,
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS order_dispatch_counter (
      page_id TEXT PRIMARY KEY,
      current_number INTEGER DEFAULT 1,
      round_started_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS dispatched_messages (
      message_id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'TELEGRAM',
      chat_id TEXT NOT NULL,
      order_id TEXT,
      dispatch_number INTEGER,
      message_text TEXT,
      is_cancelled INTEGER DEFAULT 0,
      sent_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id BIGSERIAL PRIMARY KEY,
      page_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'admin', 'ai')),
      text TEXT NOT NULL,
      intent TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE INDEX IF NOT EXISTS idx_chat_history_lookup ON chat_history(page_id, sender_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_history_recent ON chat_history(created_at DESC);

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'SUCCESS',
      details TEXT DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS emergency_alerts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'HIGH',
      source TEXT DEFAULT 'SYSTEM_MONITOR',
      page_id TEXT NOT NULL,
      sender_id TEXT,
      customer_name TEXT,
      phone_number TEXT,
      threat_text TEXT,
      detected_keywords TEXT DEFAULT '[]',
      is_resolved INTEGER DEFAULT 0,
      notified_channels TEXT DEFAULT '[]',
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT}
    );

    CREATE TABLE IF NOT EXISTS custom_buttons (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      title TEXT NOT NULL,
      payload TEXT NOT NULL,
      button_type TEXT DEFAULT 'QUICK_REPLY',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_state (
      page_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      is_starred INTEGER DEFAULT 0,
      is_blocked INTEGER DEFAULT 0,
      is_unread INTEGER DEFAULT 0,
      unread_count INTEGER DEFAULT 0,
      last_message_at TEXT DEFAULT '',
      last_message_text TEXT DEFAULT '',
      participant_name TEXT DEFAULT '',
      updated_at TEXT DEFAULT ${PG_NOW_DEFAULT},
      PRIMARY KEY (page_id, sender_id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_page ON products(page_id);
    CREATE INDEX IF NOT EXISTS idx_customers_page ON customers(page_id);
    CREATE INDEX IF NOT EXISTS idx_orders_page ON orders(page_id);
    CREATE INDEX IF NOT EXISTS idx_orders_psid ON orders(psid);
    CREATE INDEX IF NOT EXISTS idx_custom_buttons_page ON custom_buttons(page_id);
  `);
}

// ===================== GENERIC UPSERT HELPERS =====================

/** INSERT ... ON CONFLICT(pk) DO UPDATE built from an object's own keys. */
async function upsertRow(table: string, pk: string, record: Record<string, any>, skipOnUpdate: string[] = []): Promise<void> {
  const cols = Object.keys(record);
  if (cols.length === 0) return;
  const updateCols = cols.filter(c => c !== pk && !skipOnUpdate.includes(c));
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const setClause = updateCols.map((c, i) => `${c} = $${cols.indexOf(c) + 1}`).join(', ');
  const conflictCols = updateCols.length > 0
    ? `DO UPDATE SET ${setClause}`
    : 'DO NOTHING';
  await q(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${pk}) ${conflictCols}`,
    cols.map(c => record[c] ?? null)
  );
}

async function findOne(table: string, pk: string, id: any): Promise<any | undefined> {
  const res = await q(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`, [id]);
  return res.rows[0] ?? undefined;
}

// ===================== PAGES =====================

export interface DbPage {
  page_id: string;
  page_name: string;
  category: string;
  page_access_token: string;
  verify_token: string;
  is_active: number;
  auto_reply: number;
  auto_close_ai: number;
  page_avatar: string;
  page_cover: string;
  follower_count: number;
  likes_count: number;
  inquiries_count: number;
  unread_messages: number;
  ai_model: string;
  admin_name: string;
  ai_tone: string;
  ai_custom_instructions: string;
  ai_brevity_mode: number;
  theme_color: string;
  page_tag: string;
  notification_channel: string;
  line_notify_token: string;
  line_group_id: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  google_sheet_url: string;
  scrape_comments_enabled: number;
  auto_inbox_with_comment_context: number;
  hide_toxic_comments: number;
  toxic_keywords: string;
  purchase_keywords: string;
  comment_reply_template: string;
  comment_reply_images: string;
  comment_auto_tag_customer: number;
  followup_enabled: number;
  followup_messages: string;
  reply_delay_ms: number;
  bot_stopped: number;
  rate_limit_per_hour: number;
  quick_replies: string;
  sales_sequence_auto_trigger: number;
  cod_summary_template: string;
  cod_summary_fields: string;
  product: string;
  sequence: string;
  sales_sequence_steps: string;
  is_connected: number;
  connected_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

const PAGE_JSON_FIELDS = ['toxic_keywords', 'purchase_keywords', 'comment_reply_images', 'followup_messages', 'quick_replies', 'product', 'sequence', 'sales_sequence_steps', 'cod_summary_fields'];
const PAGE_BOOL_FIELDS = ['is_active', 'auto_reply', 'auto_close_ai', 'ai_brevity_mode', 'scrape_comments_enabled', 'auto_inbox_with_comment_context', 'hide_toxic_comments', 'comment_auto_tag_customer', 'followup_enabled', 'bot_stopped', 'sales_sequence_auto_trigger', 'is_connected'];

export async function getAllPages(): Promise<DbPage[]> {
  const res = await q('SELECT * FROM pages ORDER BY updated_at DESC');
  return res.rows as DbPage[];
}

export async function getPage(pageId: string): Promise<DbPage | undefined> {
  return findOne('pages', 'page_id', pageId) as Promise<DbPage | undefined>;
}

export async function upsertPage(page: Record<string, any>): Promise<void> {
  const normalized: Record<string, any> = { ...page };
  for (const f of PAGE_JSON_FIELDS) {
    if (normalized[f] !== undefined && typeof normalized[f] !== 'string') {
      normalized[f] = JSON.stringify(normalized[f]);
    }
  }
  for (const f of PAGE_BOOL_FIELDS) {
    if (normalized[f] !== undefined) {
      normalized[f] = normalized[f] ? 1 : 0;
    }
  }
  normalized.updated_at = new Date().toISOString();
  if (!normalized.created_at) {
    const existing = await q('SELECT created_at FROM pages WHERE page_id = ? LIMIT 1', [normalized.page_id]);
    if (existing.rows.length === 0) {
      normalized.created_at = new Date().toISOString();
    } else {
      delete normalized.created_at;
    }
  }
  await upsertRow('pages', 'page_id', normalized, ['created_at']);
}

export async function updatePageField(pageId: string, field: string, value: any): Promise<void> {
  const val = PAGE_JSON_FIELDS.includes(field) && typeof value !== 'string' ? JSON.stringify(value) : value;
  await q(`UPDATE pages SET ${field} = ?, updated_at = ? WHERE page_id = ?`, [val, new Date().toISOString(), pageId]);
}

export async function deletePage(pageId: string): Promise<void> {
  await q('DELETE FROM pages WHERE page_id = ?', [pageId]);
}

export async function getConnectedPages(): Promise<DbPage[]> {
  const res = await q('SELECT * FROM pages WHERE is_connected = 1 AND is_active = 1');
  return res.rows as DbPage[];
}

// ===================== PRODUCTS =====================

export async function getProductsByCategory(category: string): Promise<any[]> {
  const res = await q('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC', [category]);
  return res.rows;
}

export async function getProductsByPage(pageId: string): Promise<any[]> {
  const res = await q('SELECT * FROM products WHERE page_id = ?', [pageId]);
  return res.rows;
}

export async function upsertProduct(product: Record<string, any>): Promise<void> {
  const normalized = { ...product };
  if (normalized.specs_json && typeof normalized.specs_json !== 'string') {
    normalized.specs_json = JSON.stringify(normalized.specs_json);
  }
  if (normalized.custom_specs && typeof normalized.custom_specs !== 'string') {
    normalized.custom_specs = JSON.stringify(normalized.custom_specs);
  }
  normalized.updated_at = new Date().toISOString();
  if (!normalized.created_at) {
    const existing = await q('SELECT created_at FROM products WHERE product_id = ? LIMIT 1', [normalized.product_id]);
    if (existing.rows.length === 0) {
      normalized.created_at = new Date().toISOString();
    } else {
      delete normalized.created_at;
    }
  }
  await upsertRow('products', 'product_id', normalized, ['created_at']);
}

export async function replaceProductsForCategory(category: string, products: any[]): Promise<void> {
  await q('DELETE FROM products WHERE category = ?', [category]);
  for (const p of products) {
    await upsertProduct({ ...p, category });
  }
}

// ===================== CUSTOMERS =====================

export async function getAllCustomers(): Promise<any[]> {
  const res = await q('SELECT * FROM customers ORDER BY last_interaction DESC');
  return res.rows;
}

export async function getCustomer(psid: string): Promise<any | undefined> {
  return findOne('customers', 'psid', psid);
}

export async function upsertCustomer(customer: Record<string, any>): Promise<void> {
  const normalized = { ...customer };
  if (normalized.tags && typeof normalized.tags !== 'string') {
    normalized.tags = JSON.stringify(normalized.tags);
  }
  normalized.updated_at = new Date().toISOString();
  if (!normalized.created_at) {
    const existing = await q('SELECT created_at FROM customers WHERE psid = ? LIMIT 1', [normalized.psid]);
    if (existing.rows.length === 0) {
      normalized.created_at = new Date().toISOString();
    } else {
      delete normalized.created_at;
    }
  }
  await upsertRow('customers', 'psid', normalized, ['created_at']);
}

export async function replaceCustomers(customers: any[]): Promise<void> {
  await q('DELETE FROM customers');
  for (const c of customers) {
    await upsertCustomer(c);
  }
}

// ===================== ORDERS =====================

export async function getAllOrders(): Promise<any[]> {
  const res = await q('SELECT * FROM orders ORDER BY created_at DESC');
  return res.rows;
}

export async function upsertOrder(order: Record<string, any>): Promise<void> {
  const normalized: Record<string, any> = { ...order, updated_at: new Date().toISOString() };
  if (!normalized.created_at) {
    const existing = await q('SELECT created_at FROM orders WHERE order_id = ? LIMIT 1', [normalized.order_id]);
    if (existing.rows.length === 0) {
      normalized.created_at = new Date().toISOString();
    } else {
      delete normalized.created_at;
    }
  }
  await upsertRow('orders', 'order_id', normalized, ['created_at']);
}

export async function replaceOrders(orders: any[]): Promise<void> {
  await q('DELETE FROM orders');
  for (const o of orders) {
    await upsertOrder(o);
  }
}

// ===================== CHAT HISTORY =====================

export async function addChatMessage(pageId: string, senderId: string, role: 'customer' | 'admin' | 'ai', text: string, intent?: string, metadata?: Record<string, any>): Promise<void> {
  await q(
    'INSERT INTO chat_history (page_id, sender_id, role, text, intent, metadata) VALUES (?, ?, ?, ?, ?, ?)',
    [pageId, senderId, role, String(text || '').slice(0, 2000), intent || '', JSON.stringify(metadata || {})]
  );
}

export async function getRecentChatHistory(pageId: string, senderId: string, limit = 15): Promise<any[]> {
  const res = await q(
    'SELECT * FROM chat_history WHERE page_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT ?',
    [pageId, senderId, limit]
  );
  return res.rows.reverse();
}

export async function getChatHistoryForInbox(pageId: string, senderId: string, limit = 50): Promise<any[]> {
  const res = await q(
    'SELECT * FROM chat_history WHERE page_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT ?',
    [pageId, senderId, limit]
  );
  return res.rows.reverse();
}

export async function cleanupOldChatHistory(olderThanDays = 30): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
  await q('DELETE FROM chat_history WHERE created_at < ?', [cutoff]);
}

// ===================== ACTIVITY LOGS =====================

export async function addActivityLog(log: { id: string; timestamp: string; type: string; sender_id: string; page_id: string; content: string; status: string; details?: Record<string, any> }): Promise<void> {
  await q(
    'INSERT INTO activity_logs (id, timestamp, type, sender_id, page_id, content, status, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
    [log.id, log.timestamp, log.type, log.sender_id, log.page_id, log.content, log.status, JSON.stringify(log.details || {})]
  );
}

export async function getRecentLogs(limit = 60): Promise<any[]> {
  const res = await q('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
  return res.rows;
}

export async function cleanupOldLogs(maxLogs = 250): Promise<void> {
  const res = await q('SELECT COUNT(*) AS cnt FROM activity_logs');
  const count = res.rows[0]?.cnt ?? 0;
  if (count > maxLogs) {
    await q('DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT ?)', [maxLogs]);
  }
}

// ===================== EMERGENCY ALERTS =====================

export async function addEmergencyAlert(alert: Record<string, any>): Promise<void> {
  const normalized = { ...alert };
  if (normalized.detected_keywords && typeof normalized.detected_keywords !== 'string') {
    normalized.detected_keywords = JSON.stringify(normalized.detected_keywords);
  }
  if (normalized.notified_channels && typeof normalized.notified_channels !== 'string') {
    normalized.notified_channels = JSON.stringify(normalized.notified_channels);
  }
  const cols = Object.keys(normalized);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  await q(
    `INSERT INTO emergency_alerts (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
    cols.map(c => normalized[c] ?? null)
  );
}

export async function getEmergencyAlerts(): Promise<any[]> {
  const res = await q('SELECT * FROM emergency_alerts ORDER BY timestamp DESC');
  return res.rows;
}

export async function resolveEmergencyAlert(alertId: string): Promise<void> {
  await q('UPDATE emergency_alerts SET is_resolved = 1 WHERE id = ?', [alertId]);
}

// ===================== SETTINGS =====================

export async function getSetting(key: string): Promise<string | null> {
  const res = await q('SELECT value FROM settings WHERE key = ? LIMIT 1', [key]);
  return res.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await q(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at',
    [key, value, new Date().toISOString()]
  );
}

// ===================== CUSTOM BUTTONS =====================

export async function getCustomButtons(pageId: string): Promise<any[]> {
  const res = await q('SELECT * FROM custom_buttons WHERE page_id = ? ORDER BY sort_order ASC', [pageId]);
  return res.rows;
}

export async function addCustomButton(button: { id: string; page_id: string; title: string; payload: string; button_type?: string; sort_order?: number }): Promise<void> {
  await q(
    'INSERT INTO custom_buttons (id, page_id, title, payload, button_type, sort_order) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
    [button.id, button.page_id, button.title, button.payload, button.button_type || 'QUICK_REPLY', button.sort_order || 0]
  );
}

export async function updateCustomButton(id: string, updates: Record<string, any>): Promise<void> {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const values = keys.map(k => updates[k]);
  values.push(new Date().toISOString());
  values.push(id);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  await q(`UPDATE custom_buttons SET ${setClause}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2}`, values);
}

export async function deleteCustomButton(id: string): Promise<void> {
  await q('DELETE FROM custom_buttons WHERE id = ?', [id]);
}

// ===================== ORDER DISPATCH COUNTER =====================

export async function getDispatchCounter(pageId: string): Promise<number> {
  const res = await q('SELECT current_number FROM order_dispatch_counter WHERE page_id = ? LIMIT 1', [pageId]);
  return res.rows[0]?.current_number ?? 1;
}

export async function incrementDispatchCounter(pageId: string): Promise<number> {
  // Atomic single-statement upsert: first dispatch stores 1 and returns 1,
  // every later dispatch increments. Safe under concurrent webhook bursts.
  const res = await q(
    `INSERT INTO order_dispatch_counter (page_id, current_number) VALUES (?, 1)
     ON CONFLICT (page_id) DO UPDATE SET current_number = order_dispatch_counter.current_number + 1, updated_at = ?
     RETURNING current_number`,
    [pageId, new Date().toISOString()]
  );
  return res.rows[0]?.current_number ?? 1;
}

export async function resetDispatchCounter(pageId: string): Promise<void> {
  await q(
    `INSERT INTO order_dispatch_counter (page_id, current_number) VALUES (?, 1)
     ON CONFLICT (page_id) DO UPDATE SET current_number = 1, round_started_at = ?, updated_at = ?`,
    [pageId, new Date().toISOString(), new Date().toISOString()]
  );
}

// ===================== DISPATCHED MESSAGES =====================

export async function saveDispatchedMessage(msg: { message_id: string; page_id: string; channel: string; chat_id: string; order_id?: string; dispatch_number?: number; message_text: string }): Promise<void> {
  await q(
    'INSERT INTO dispatched_messages (message_id, page_id, channel, chat_id, order_id, dispatch_number, message_text) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (message_id) DO NOTHING',
    [msg.message_id, msg.page_id, msg.channel, msg.chat_id, msg.order_id || null, msg.dispatch_number || null, msg.message_text]
  );
}

export async function markDispatchedMessageCancelled(messageId: string): Promise<void> {
  await q('UPDATE dispatched_messages SET is_cancelled = 1 WHERE message_id = ?', [messageId]);
}

export async function getDispatchedMessages(pageId: string, activeOnly = true): Promise<any[]> {
  const sql = activeOnly
    ? 'SELECT * FROM dispatched_messages WHERE page_id = ? AND is_cancelled = 0 ORDER BY dispatch_number ASC'
    : 'SELECT * FROM dispatched_messages WHERE page_id = ? ORDER BY dispatch_number ASC';
  const res = await q(sql, [pageId]);
  return res.rows;
}

export async function getDispatchedMessageByOrderId(orderId: string): Promise<any | undefined> {
  const res = await q('SELECT * FROM dispatched_messages WHERE order_id = ? AND is_cancelled = 0 LIMIT 1', [orderId]);
  return res.rows[0] ?? undefined;
}

// ===================== CUSTOMER MEMORY HELPERS =====================

export async function getCustomerOrderCount(psid: string): Promise<number> {
  const res = await q('SELECT COUNT(*) AS cnt FROM orders WHERE psid = ? AND is_cancelled = 0', [psid]);
  return res.rows[0]?.cnt ?? 0;
}

export async function getCustomerTotalSpent(psid: string): Promise<number> {
  const res = await q('SELECT COALESCE(SUM(total_amount), 0)::float8 AS total FROM orders WHERE psid = ? AND is_cancelled = 0', [psid]);
  return res.rows[0]?.total ?? 0;
}

export async function isReturningCustomer(psid: string): Promise<boolean> {
  return (await getCustomerOrderCount(psid)) > 0;
}

export async function cancelOrder(orderId: string): Promise<void> {
  const now = new Date().toISOString();
  await q('UPDATE orders SET is_cancelled = 1, cancelled_at = ?, payment_status = ?, updated_at = ? WHERE order_id = ?', [now, 'CANCELLED', now, orderId]);
}

export async function getActiveOrdersByPage(pageId: string): Promise<any[]> {
  const res = await q('SELECT * FROM orders WHERE page_id = ? AND is_cancelled = 0 ORDER BY created_at DESC', [pageId]);
  return res.rows;
}

export async function getPageRevenue(pageId: string): Promise<number> {
  const res = await q('SELECT COALESCE(SUM(total_amount), 0)::float8 AS total FROM orders WHERE page_id = ? AND is_cancelled = 0 AND payment_status != ?', [pageId, 'CANCELLED']);
  return res.rows[0]?.total ?? 0;
}

// ===================== CONVERSATION STATE (Meta-style inbox) =====================

export interface ConversationStateRow {
  page_id: string;
  sender_id: string;
  is_starred: number;
  is_blocked: number;
  is_unread: number;
  unread_count: number;
  last_message_at: string;
  last_message_text: string;
  participant_name: string;
  updated_at: string;
}

export async function getConversationState(pageId: string, senderId: string): Promise<ConversationStateRow | undefined> {
  const res = await q('SELECT * FROM conversation_state WHERE page_id = ? AND sender_id = ? LIMIT 1', [pageId, senderId]);
  return res.rows[0] ?? undefined;
}

export async function listConversationStates(pageId: string): Promise<ConversationStateRow[]> {
  const res = await q('SELECT * FROM conversation_state WHERE page_id = ?', [pageId]);
  return res.rows;
}

/** Partial update - only patched columns change on conflict. */
export async function updateConversationState(pageId: string, senderId: string, patch: Partial<ConversationStateRow>): Promise<void> {
  const patchKeys = Object.keys(patch).filter(k => !['page_id', 'sender_id'].includes(k));
  const cols: Record<string, any> = { page_id: pageId, sender_id: senderId, ...patch, updated_at: new Date().toISOString() };
  const allKeys = Object.keys(cols);
  const placeholders = allKeys.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = patchKeys.length > 0
    ? patchKeys.map(k => `${k} = EXCLUDED.${k}`).join(', ')
    : 'updated_at = EXCLUDED.updated_at';
  await q(
    `INSERT INTO conversation_state (${allKeys.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (page_id, sender_id) DO UPDATE SET ${updateSet}`,
    allKeys.map(k => (cols as any)[k] ?? null)
  );
}

/** Customer message arrived: bump unread + preview atomically. */
export async function recordIncomingMessage(pageId: string, senderId: string, text: string, participantName = ''): Promise<void> {
  const now = new Date().toISOString();
  await q(
    `INSERT INTO conversation_state (page_id, sender_id, is_unread, unread_count, last_message_at, last_message_text, participant_name, updated_at)
     VALUES (?, ?, 1, 1, ?, ?, ?, ?)
     ON CONFLICT (page_id, sender_id) DO UPDATE SET
       is_unread = 1,
       unread_count = conversation_state.unread_count + 1,
       last_message_at = EXCLUDED.last_message_at,
       last_message_text = EXCLUDED.last_message_text,
       participant_name = COALESCE(NULLIF(EXCLUDED.participant_name, ''), conversation_state.participant_name),
       updated_at = EXCLUDED.updated_at`,
    [pageId, senderId, now, String(text || '').slice(0, 200), String(participantName || '').slice(0, 100), now]
  );
}

/** Admin/AI replied: update preview, conversation stays read. */
export async function recordOutgoingMessage(pageId: string, senderId: string, text: string): Promise<void> {
  const now = new Date().toISOString();
  await q(
    `INSERT INTO conversation_state (page_id, sender_id, is_unread, unread_count, last_message_at, last_message_text, updated_at)
     VALUES (?, ?, 0, 0, ?, ?, ?)
     ON CONFLICT (page_id, sender_id) DO UPDATE SET
       last_message_at = EXCLUDED.last_message_at,
       last_message_text = EXCLUDED.last_message_text,
       updated_at = EXCLUDED.updated_at`,
    [pageId, senderId, now, String(text || '').slice(0, 200), now]
  );
}

// ===================== DATA MIGRATION (JSON -> PostgreSQL) =====================

export async function migrateFromJson(jsonData: any): Promise<void> {
  if (Array.isArray(jsonData.pages)) {
    for (const page of jsonData.pages) {
      await upsertPage(page);
    }
  }

  const productCategories = ['amulet', 'china', 'otop', 'agriculture'];
  for (const cat of productCategories) {
    if (Array.isArray(jsonData[cat])) {
      for (const product of jsonData[cat]) {
        await upsertProduct({ ...product, category: cat.toUpperCase() });
      }
    }
  }

  if (Array.isArray(jsonData.customers)) {
    for (const c of jsonData.customers) {
      await upsertCustomer(c);
    }
  }

  if (Array.isArray(jsonData.orders)) {
    for (const o of jsonData.orders) {
      await upsertOrder(o);
    }
  }

  if (Array.isArray(jsonData.logs)) {
    for (const log of jsonData.logs) {
      try {
        await addActivityLog(log);
      } catch { /* skip duplicates */ }
    }
  }

  if (Array.isArray(jsonData.emergencyAlerts)) {
    for (const alert of jsonData.emergencyAlerts) {
      try {
        await addEmergencyAlert(alert);
      } catch { /* skip duplicates */ }
    }
  }

  if (jsonData.settings) {
    for (const [key, value] of Object.entries(jsonData.settings)) {
      await setSetting(`gemini_${key}`, String(value));
    }
  }

  console.log('[DB Migration] JSON -> PostgreSQL migration completed successfully');
}

/**
 * One-time migration: import every row from the legacy SQLite file into
 * PostgreSQL when the Postgres database is still empty. Uses better-sqlite3
 * as a read-only reader — the old data/superai.db is never modified.
 */
export async function migrateFromSqliteIfEmpty(sqlitePath: string): Promise<boolean> {
  const existing = await q('SELECT COUNT(*) AS cnt FROM pages');
  if ((existing.rows[0]?.cnt ?? 0) > 0) return false;

  let fsMod: any;
  try {
    fsMod = await import('fs');
    if (!fsMod.existsSync(sqlitePath)) return false;
  } catch {
    return false;
  }

  const Database = (await import('better-sqlite3')).default;
  let sqlite: any;
  try {
    sqlite = new Database(sqlitePath, { readonly: true });
    const tableRows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tables = new Set(tableRows.map((t: any) => t.name));
    let migrated = 0;

    const copy = async (table: string, fn: (row: any) => Promise<void>) => {
      if (!tables.has(table)) return;
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        await fn(row);
        migrated++;
      }
    };

    await copy('pages', (row) => upsertPage(row));
    await copy('products', (row) => upsertProduct(row));
    await copy('customers', (row) => upsertCustomer(row));
    await copy('orders', (row) => upsertOrder(row));
    await copy('custom_buttons', (row) => addCustomButton(row));
    await copy('activity_logs', (row) => addActivityLog({ ...row, details: row.details || {} }));
    await copy('emergency_alerts', (row) => addEmergencyAlert(row));
    await copy('dispatched_messages', (row) => saveDispatchedMessage(row));
    await copy('chat_history', async (row) => addChatMessage(row.page_id, row.sender_id, row.role, row.text, row.intent));

    if (tables.has('settings')) {
      for (const row of sqlite.prepare('SELECT * FROM settings').all()) {
        await setSetting(row.key, row.value);
        migrated++;
      }
    }
    if (tables.has('order_dispatch_counter')) {
      for (const row of sqlite.prepare('SELECT * FROM order_dispatch_counter').all()) {
        await resetDispatchCounter(row.page_id);
      }
    }

    console.log(`[DB Migration] SQLite -> PostgreSQL: imported ${migrated} rows`);
    return migrated > 0;
  } catch (err: any) {
    console.error('[DB Migration] SQLite import failed (continuing with empty DB):', err.message);
    return false;
  } finally {
    try { sqlite?.close(); } catch { /* ignore */ }
  }
}

// ===================== HELPER: Convert DB row to PageConfig shape =====================

export function dbPageToPageConfig(row: DbPage): any {
  const parseJson = (val: string, fallback: any) => {
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
  };

  return {
    page_id: row.page_id,
    page_name: row.page_name,
    category: row.category,
    page_access_token: row.page_access_token,
    verify_token: row.verify_token,
    is_active: Boolean(row.is_active),
    auto_reply: Boolean(row.auto_reply),
    auto_close_ai: Boolean(row.auto_close_ai),
    page_avatar: row.page_avatar,
    page_cover: row.page_cover,
    follower_count: row.follower_count,
    likes_count: row.likes_count,
    inquiries_count: row.inquiries_count,
    unread_messages: row.unread_messages,
    ai_model: row.ai_model,
    admin_name: row.admin_name,
    ai_tone: row.ai_tone,
    ai_custom_instructions: row.ai_custom_instructions,
    ai_brevity_mode: Boolean(row.ai_brevity_mode),
    theme_color: row.theme_color,
    page_tag: row.page_tag,
    notification_channel: row.notification_channel,
    line_notify_token: row.line_notify_token,
    line_group_id: row.line_group_id,
    telegram_bot_token: row.telegram_bot_token,
    telegram_chat_id: row.telegram_chat_id,
    google_sheet_url: row.google_sheet_url,
    scrape_comments_enabled: Boolean(row.scrape_comments_enabled),
    auto_inbox_with_comment_context: Boolean(row.auto_inbox_with_comment_context),
    hide_toxic_comments: Boolean(row.hide_toxic_comments),
    toxic_keywords: parseJson(row.toxic_keywords, []),
    purchase_keywords: parseJson(row.purchase_keywords, []),
    comment_reply_template: row.comment_reply_template,
    comment_reply_images: parseJson(row.comment_reply_images, []),
    comment_auto_tag_customer: Boolean(row.comment_auto_tag_customer),
    followup_enabled: Boolean(row.followup_enabled),
    followup_messages: parseJson(row.followup_messages, []),
    reply_delay_ms: row.reply_delay_ms,
    bot_stopped: Boolean(row.bot_stopped),
    rate_limit_per_hour: row.rate_limit_per_hour,
    quick_replies: parseJson(row.quick_replies, []),
    sales_sequence_auto_trigger: Boolean(row.sales_sequence_auto_trigger),
    cod_summary_template: row.cod_summary_template,
    cod_summary_fields: parseJson(row.cod_summary_fields, ''),
    product: parseJson(row.product, {}),
    sequence: parseJson(row.sequence, {}),
    sales_sequence_steps: parseJson(row.sales_sequence_steps, []),
    is_connected: Boolean(row.is_connected),
    connected_at: row.connected_at,
    last_active_at: row.last_active_at
  };
}
