import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'superai.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('busy_timeout = 5000');
    initTables();
  }
  return db;
}

function initTables() {
  db.exec(`
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'CHINA',
      display_price REAL DEFAULT 0,
      price_1 REAL DEFAULT 0,
      price_2 REAL DEFAULT 0,
      price_3 REAL DEFAULT 0,
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      psid TEXT PRIMARY KEY,
      customer_name TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      address TEXT DEFAULT '',
      category_preference TEXT DEFAULT '',
      total_spent REAL DEFAULT 0,
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      psid TEXT NOT NULL,
      customer_name TEXT DEFAULT '',
      phone_number TEXT DEFAULT '',
      shipping_address TEXT DEFAULT '',
      items TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      total_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'PENDING',
      created_at TEXT DEFAULT (datetime('now')),
      tracking_number TEXT DEFAULT '',
      page_id TEXT,
      category TEXT,
      notes TEXT,
      dispatch_number INTEGER,
      dispatch_message_id TEXT,
      is_cancelled INTEGER DEFAULT 0,
      cancelled_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_dispatch_counter (
      page_id TEXT PRIMARY KEY,
      current_number INTEGER DEFAULT 1,
      round_started_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'admin', 'ai')),
      text TEXT NOT NULL,
      intent TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS custom_buttons (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      title TEXT NOT NULL,
      payload TEXT NOT NULL,
      button_type TEXT DEFAULT 'QUICK_REPLY',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(page_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_products_page ON products(page_id);
    CREATE INDEX IF NOT EXISTS idx_customers_page ON customers(page_id);
    CREATE INDEX IF NOT EXISTS idx_orders_page ON orders(page_id);
    CREATE INDEX IF NOT EXISTS idx_orders_psid ON orders(psid);
    CREATE INDEX IF NOT EXISTS idx_custom_buttons_page ON custom_buttons(page_id);
  `);
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

export function getAllPages(): DbPage[] {
  return getDb().prepare('SELECT * FROM pages ORDER BY updated_at DESC').all() as DbPage[];
}

export function getPage(pageId: string): DbPage | undefined {
  return getDb().prepare('SELECT * FROM pages WHERE page_id = ?').get(pageId) as DbPage | undefined;
}

export function upsertPage(page: Record<string, any>): void {
  const d = getDb();
  const existing = d.prepare('SELECT page_id FROM pages WHERE page_id = ?').get(page.page_id);

  const jsonFields = ['toxic_keywords', 'purchase_keywords', 'comment_reply_images', 'followup_messages', 'quick_replies', 'product', 'sequence', 'sales_sequence_steps', 'cod_summary_fields'];
  const normalized: Record<string, any> = { ...page };
  for (const f of jsonFields) {
    if (normalized[f] !== undefined && typeof normalized[f] !== 'string') {
      normalized[f] = JSON.stringify(normalized[f]);
    }
  }

  const boolFields = ['is_active', 'auto_reply', 'auto_close_ai', 'ai_brevity_mode', 'scrape_comments_enabled', 'auto_inbox_with_comment_context', 'hide_toxic_comments', 'comment_auto_tag_customer', 'followup_enabled', 'bot_stopped', 'sales_sequence_auto_trigger', 'is_connected'];
  for (const f of boolFields) {
    if (normalized[f] !== undefined) {
      normalized[f] = normalized[f] ? 1 : 0;
    }
  }

  normalized.updated_at = new Date().toISOString();

  if (existing) {
    const keys = Object.keys(normalized).filter(k => k !== 'page_id' && k !== 'created_at');
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => normalized[k] ?? null);
    values.push(page.page_id);
    d.prepare(`UPDATE pages SET ${setClause} WHERE page_id = ?`).run(...values);
  } else {
    normalized.created_at = normalized.created_at || new Date().toISOString();
    const cols = Object.keys(normalized);
    const placeholders = cols.map(() => '?').join(', ');
    d.prepare(`INSERT INTO pages (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(k => normalized[k] ?? null));
  }
}

export function updatePageField(pageId: string, field: string, value: any): void {
  const jsonFields = ['toxic_keywords', 'purchase_keywords', 'comment_reply_images', 'followup_messages', 'quick_replies', 'product', 'sequence', 'sales_sequence_steps', 'cod_summary_fields'];
  const val = jsonFields.includes(field) && typeof value !== 'string' ? JSON.stringify(value) : value;
  getDb().prepare(`UPDATE pages SET ${field} = ?, updated_at = ? WHERE page_id = ?`).run(val, new Date().toISOString(), pageId);
}

export function deletePage(pageId: string): void {
  getDb().prepare('DELETE FROM pages WHERE page_id = ?').run(pageId);
}

export function getConnectedPages(): DbPage[] {
  return getDb().prepare('SELECT * FROM pages WHERE is_connected = 1 AND is_active = 1').all() as DbPage[];
}

// ===================== PRODUCTS =====================

export function getProductsByCategory(category: string): any[] {
  return getDb().prepare('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC').all(category) as any[];
}

export function getProductsByPage(pageId: string): any[] {
  return getDb().prepare('SELECT * FROM products WHERE page_id = ?').all(pageId) as any[];
}

export function upsertProduct(product: Record<string, any>): void {
  const d = getDb();
  const existing = d.prepare('SELECT product_id FROM products WHERE product_id = ?').get(product.product_id);

  const normalized = { ...product };
  if (normalized.specs_json && typeof normalized.specs_json !== 'string') {
    normalized.specs_json = JSON.stringify(normalized.specs_json);
  }
  if (normalized.custom_specs && typeof normalized.custom_specs !== 'string') {
    normalized.custom_specs = JSON.stringify(normalized.custom_specs);
  }
  normalized.updated_at = new Date().toISOString();

  if (existing) {
    const keys = Object.keys(normalized).filter(k => k !== 'product_id' && k !== 'created_at');
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => normalized[k] ?? null);
    values.push(product.product_id);
    d.prepare(`UPDATE products SET ${setClause} WHERE product_id = ?`).run(...values);
  } else {
    normalized.created_at = normalized.created_at || new Date().toISOString();
    const cols = Object.keys(normalized);
    const placeholders = cols.map(() => '?').join(', ');
    d.prepare(`INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(k => normalized[k] ?? null));
  }
}

export function replaceProductsForCategory(category: string, products: any[]): void {
  const d = getDb();
  d.prepare('DELETE FROM products WHERE category = ?').run(category);
  for (const p of products) {
    upsertProduct({ ...p, category });
  }
}

// ===================== CUSTOMERS =====================

export function getAllCustomers(): any[] {
  return getDb().prepare('SELECT * FROM customers ORDER BY last_interaction DESC').all() as any[];
}

export function getCustomer(psid: string): any | undefined {
  return getDb().prepare('SELECT * FROM customers WHERE psid = ?').get(psid);
}

export function upsertCustomer(customer: Record<string, any>): void {
  const d = getDb();
  const existing = d.prepare('SELECT psid FROM customers WHERE psid = ?').get(customer.psid);
  const normalized = { ...customer };
  if (normalized.tags && typeof normalized.tags !== 'string') {
    normalized.tags = JSON.stringify(normalized.tags);
  }
  normalized.updated_at = new Date().toISOString();

  if (existing) {
    const keys = Object.keys(normalized).filter(k => k !== 'psid' && k !== 'created_at');
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => normalized[k] ?? null);
    values.push(customer.psid);
    d.prepare(`UPDATE customers SET ${setClause} WHERE psid = ?`).run(...values);
  } else {
    normalized.created_at = normalized.created_at || new Date().toISOString();
    const cols = Object.keys(normalized);
    const placeholders = cols.map(() => '?').join(', ');
    d.prepare(`INSERT INTO customers (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(k => normalized[k] ?? null));
  }
}

export function replaceCustomers(customers: any[]): void {
  const d = getDb();
  d.prepare('DELETE FROM customers').run();
  for (const c of customers) {
    upsertCustomer(c);
  }
}

// ===================== ORDERS =====================

export function getAllOrders(): any[] {
  return getDb().prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as any[];
}

export function upsertOrder(order: Record<string, any>): void {
  const d = getDb();
  const existing = d.prepare('SELECT order_id FROM orders WHERE order_id = ?').get(order.order_id);
  const normalized: Record<string, any> = { ...order, updated_at: new Date().toISOString() };
  if (!normalized.created_at) {
    normalized.created_at = new Date().toISOString();
  }

  if (existing) {
    const keys = Object.keys(normalized).filter(k => k !== 'order_id');
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => normalized[k] ?? null);
    values.push(order.order_id);
    d.prepare(`UPDATE orders SET ${setClause} WHERE order_id = ?`).run(...values);
  } else {
    normalized.created_at = normalized.created_at || new Date().toISOString();
    const cols = Object.keys(normalized);
    const placeholders = cols.map(() => '?').join(', ');
    d.prepare(`INSERT INTO orders (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(k => normalized[k] ?? null));
  }
}

export function replaceOrders(orders: any[]): void {
  const d = getDb();
  d.prepare('DELETE FROM orders').run();
  for (const o of orders) {
    upsertOrder(o);
  }
}

// ===================== CHAT HISTORY =====================

export function addChatMessage(pageId: string, senderId: string, role: 'customer' | 'admin' | 'ai', text: string, intent?: string, metadata?: Record<string, any>): void {
  getDb().prepare(
    'INSERT INTO chat_history (page_id, sender_id, role, text, intent, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(pageId, senderId, role, text.slice(0, 2000), intent || '', JSON.stringify(metadata || {}));
}

export function getRecentChatHistory(pageId: string, senderId: string, limit = 15): any[] {
  return getDb().prepare(
    'SELECT * FROM chat_history WHERE page_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(pageId, senderId, limit).reverse() as any[];
}

export function getChatHistoryForInbox(pageId: string, senderId: string, limit = 50): any[] {
  return getDb().prepare(
    'SELECT * FROM chat_history WHERE page_id = ? AND sender_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(pageId, senderId, limit).reverse() as any[];
}

export function cleanupOldChatHistory(olderThanDays = 30): void {
  const cutoff = new Date(Date.now() - olderThanDays * 86400000).toISOString();
  getDb().prepare('DELETE FROM chat_history WHERE created_at < ?').run(cutoff);
}

// ===================== ACTIVITY LOGS =====================

export function addActivityLog(log: { id: string; timestamp: string; type: string; sender_id: string; page_id: string; content: string; status: string; details?: Record<string, any> }): void {
  getDb().prepare(
    'INSERT INTO activity_logs (id, timestamp, type, sender_id, page_id, content, status, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(log.id, log.timestamp, log.type, log.sender_id, log.page_id, log.content, log.status, JSON.stringify(log.details || {}));
}

export function getRecentLogs(limit = 60): any[] {
  return getDb().prepare('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];
}

export function cleanupOldLogs(maxLogs = 250): void {
  const d = getDb();
  const count = (d.prepare('SELECT COUNT(*) as cnt FROM activity_logs').get() as any).cnt;
  if (count > maxLogs) {
    d.prepare(`DELETE FROM activity_logs WHERE id NOT IN (SELECT id FROM activity_logs ORDER BY timestamp DESC LIMIT ${maxLogs})`).run();
  }
}

// ===================== EMERGENCY ALERTS =====================

export function addEmergencyAlert(alert: Record<string, any>): void {
  const normalized = { ...alert };
  if (normalized.detected_keywords && typeof normalized.detected_keywords !== 'string') {
    normalized.detected_keywords = JSON.stringify(normalized.detected_keywords);
  }
  if (normalized.notified_channels && typeof normalized.notified_channels !== 'string') {
    normalized.notified_channels = JSON.stringify(normalized.notified_channels);
  }
  const cols = Object.keys(normalized);
  const placeholders = cols.map(() => '?').join(', ');
  getDb().prepare(`INSERT INTO emergency_alerts (${cols.join(', ')}) VALUES (${placeholders})`).run(...cols.map(k => normalized[k] ?? null));
}

export function getEmergencyAlerts(): any[] {
  return getDb().prepare('SELECT * FROM emergency_alerts ORDER BY timestamp DESC').all() as any[];
}

export function resolveEmergencyAlert(alertId: string): void {
  getDb().prepare('UPDATE emergency_alerts SET is_resolved = 1 WHERE id = ?').run(alertId);
}

// ===================== SETTINGS =====================

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, new Date().toISOString());
}

// ===================== CUSTOM BUTTONS =====================

export function getCustomButtons(pageId: string): any[] {
  return getDb().prepare('SELECT * FROM custom_buttons WHERE page_id = ? ORDER BY sort_order ASC').all(pageId) as any[];
}

export function addCustomButton(button: { id: string; page_id: string; title: string; payload: string; button_type?: string; sort_order?: number }): void {
  getDb().prepare(
    'INSERT INTO custom_buttons (id, page_id, title, payload, button_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(button.id, button.page_id, button.title, button.payload, button.button_type || 'QUICK_REPLY', button.sort_order || 0);
}

export function updateCustomButton(id: string, updates: Record<string, any>): void {
  const keys = Object.keys(updates);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]);
  values.push(id);
  getDb().prepare(`UPDATE custom_buttons SET ${setClause}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString());
}

export function deleteCustomButton(id: string): void {
  getDb().prepare('DELETE FROM custom_buttons WHERE id = ?').run(id);
}

// ===================== ORDER DISPATCH COUNTER =====================

export function getDispatchCounter(pageId: string): number {
  const row = getDb().prepare('SELECT current_number FROM order_dispatch_counter WHERE page_id = ?').get(pageId) as any;
  return row?.current_number ?? 1;
}

export function incrementDispatchCounter(pageId: string): number {
  const d = getDb();
  const existing = d.prepare('SELECT current_number FROM order_dispatch_counter WHERE page_id = ?').get(pageId) as any;
  if (existing) {
    const next = existing.current_number + 1;
    d.prepare('UPDATE order_dispatch_counter SET current_number = ?, updated_at = ? WHERE page_id = ?').run(next, new Date().toISOString(), pageId);
    return next;
  } else {
    d.prepare('INSERT INTO order_dispatch_counter (page_id, current_number) VALUES (?, 2)').run(pageId);
    return 1;
  }
}

export function resetDispatchCounter(pageId: string): void {
  const d = getDb();
  const existing = d.prepare('SELECT page_id FROM order_dispatch_counter WHERE page_id = ?').get(pageId);
  if (existing) {
    d.prepare('UPDATE order_dispatch_counter SET current_number = 1, round_started_at = ?, updated_at = ? WHERE page_id = ?').run(new Date().toISOString(), new Date().toISOString(), pageId);
  } else {
    d.prepare('INSERT INTO order_dispatch_counter (page_id, current_number) VALUES (?, 1)').run(pageId);
  }
}

// ===================== DISPATCHED MESSAGES =====================

export function saveDispatchedMessage(msg: { message_id: string; page_id: string; channel: string; chat_id: string; order_id?: string; dispatch_number?: number; message_text: string }): void {
  getDb().prepare(
    'INSERT INTO dispatched_messages (message_id, page_id, channel, chat_id, order_id, dispatch_number, message_text) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(msg.message_id, msg.page_id, msg.channel, msg.chat_id, msg.order_id || null, msg.dispatch_number || null, msg.message_text);
}

export function markDispatchedMessageCancelled(messageId: string): void {
  getDb().prepare('UPDATE dispatched_messages SET is_cancelled = 1 WHERE message_id = ?').run(messageId);
}

export function getDispatchedMessages(pageId: string, activeOnly = true): any[] {
  if (activeOnly) {
    return getDb().prepare('SELECT * FROM dispatched_messages WHERE page_id = ? AND is_cancelled = 0 ORDER BY dispatch_number ASC').all(pageId) as any[];
  }
  return getDb().prepare('SELECT * FROM dispatched_messages WHERE page_id = ? ORDER BY dispatch_number ASC').all(pageId) as any[];
}

export function getDispatchedMessageByOrderId(orderId: string): any | undefined {
  return getDb().prepare('SELECT * FROM dispatched_messages WHERE order_id = ? AND is_cancelled = 0').get(orderId) as any | undefined;
}

// ===================== CUSTOMER MEMORY HELPERS =====================

export function getCustomerOrderCount(psid: string): number {
  const row = getDb().prepare('SELECT COUNT(*) as cnt FROM orders WHERE psid = ? AND is_cancelled = 0').get(psid) as any;
  return row?.cnt ?? 0;
}

export function getCustomerTotalSpent(psid: string): number {
  const row = getDb().prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE psid = ? AND is_cancelled = 0').get(psid) as any;
  return row?.total ?? 0;
}

export function isReturningCustomer(psid: string): boolean {
  return getCustomerOrderCount(psid) > 0;
}

export function cancelOrder(orderId: string): void {
  getDb().prepare('UPDATE orders SET is_cancelled = 1, cancelled_at = ?, payment_status = ?, updated_at = ? WHERE order_id = ?')
    .run(new Date().toISOString(), 'CANCELLED', new Date().toISOString(), orderId);
}

export function getActiveOrdersByPage(pageId: string): any[] {
  return getDb().prepare('SELECT * FROM orders WHERE page_id = ? AND is_cancelled = 0 ORDER BY created_at DESC').all(pageId) as any[];
}

export function getPageRevenue(pageId: string): number {
  const row = getDb().prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE page_id = ? AND is_cancelled = 0 AND payment_status != ?').get(pageId, 'CANCELLED') as any;
  return row?.total ?? 0;
}

// ===================== DATA MIGRATION (JSON -> SQLite) =====================

export function migrateFromJson(jsonData: any): void {
  const d = getDb();

  if (Array.isArray(jsonData.pages)) {
    for (const page of jsonData.pages) {
      upsertPage(page);
    }
  }

  const productCategories = ['amulet', 'china', 'otop', 'agriculture'];
  for (const cat of productCategories) {
    if (Array.isArray(jsonData[cat])) {
      for (const product of jsonData[cat]) {
        upsertProduct({ ...product, category: cat.toUpperCase() });
      }
    }
  }

  if (Array.isArray(jsonData.customers)) {
    for (const c of jsonData.customers) {
      upsertCustomer(c);
    }
  }

  if (Array.isArray(jsonData.orders)) {
    for (const o of jsonData.orders) {
      upsertOrder(o);
    }
  }

  if (Array.isArray(jsonData.logs)) {
    for (const log of jsonData.logs) {
      try {
        addActivityLog(log);
      } catch { /* skip duplicates */ }
    }
  }

  if (Array.isArray(jsonData.emergencyAlerts)) {
    for (const alert of jsonData.emergencyAlerts) {
      try {
        addEmergencyAlert(alert);
      } catch { /* skip duplicates */ }
    }
  }

  if (jsonData.settings) {
    for (const [key, value] of Object.entries(jsonData.settings)) {
      setSetting(`gemini_${key}`, String(value));
    }
  }

  console.log('[DB Migration] JSON -> SQLite migration completed successfully');
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
