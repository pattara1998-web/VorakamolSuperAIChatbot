import * as dbService from './database.js';
import type { PageConfig, Order, Customer, ActivityLog, EmergencyAlert, ProductAmulet, ProductChina, ProductOtop, ProductAgriculture } from '../types.js';

/**
 * Database Bridge: Synchronizes the in-memory store with PostgreSQL.
 * - On startup: loads all data from PostgreSQL into memory
 * - On persist: writes all in-memory data back to PostgreSQL
 * This allows gradual migration without breaking existing logic.
 */

export interface DatabaseStore {
  pages: PageConfig[];
  amulet: ProductAmulet[];
  china: ProductChina[];
  otop: ProductOtop[];
  agriculture: ProductAgriculture[];
  customers: Customer[];
  orders: Order[];
  logs: ActivityLog[];
  emergencyAlerts: EmergencyAlert[];
  settings: {
    geminiApiKey: string;
    geminiApiKeyUpdatedAt?: string;
    geminiModel?: string;
    // Multi-provider AI configuration
    aiProvider?: string; // 'GEMINI' | 'OPENAI' | 'QWEN' | 'ZAI' | 'LMSTUDIO'
    openaiApiKey?: string;
    openaiModel?: string;
    qwenApiKey?: string;
    qwenModel?: string;
    zaiApiKey?: string;
    zaiModel?: string;
    lmStudioBaseUrl?: string;
    lmStudioModel?: string;
    aiSettingsUpdatedAt?: string;
  };
}

// Every AI-provider setting is stored in the settings table under these keys.
export const PROVIDER_SETTING_KEYS = [
  'aiProvider',
  'openaiApiKey', 'openaiModel',
  'qwenApiKey', 'qwenModel',
  'zaiApiKey', 'zaiModel',
  'lmStudioBaseUrl', 'lmStudioModel',
  'aiSettingsUpdatedAt'
] as const;

export async function loadFromDatabase(db: DatabaseStore): Promise<boolean> {
  try {
    await dbService.initDatabase(); // initialize + create tables

    const dbPages = await dbService.getAllPages();
    if (dbPages.length > 0) {
      db.pages = dbPages.map(row => dbService.dbPageToPageConfig(row));
      console.log(`[DB Bridge] Loaded ${db.pages.length} pages from PostgreSQL`);
    }

    const categories: [string, keyof DatabaseStore][] = [
      ['AMULET', 'amulet'],
      ['CHINA', 'china'],
      ['OTOP', 'otop'],
      ['AGRICULTURE', 'agriculture']
    ];
    for (const [cat, key] of categories) {
      const products = await dbService.getProductsByCategory(cat);
      if (products.length > 0) {
        (db as any)[key] = products.map(p => ({
          ...p,
          custom_specs: safeParseJson(p.custom_specs, []),
          specs_json: undefined
        }));
        console.log(`[DB Bridge] Loaded ${(db as any)[key].length} ${cat} products from PostgreSQL`);
      }
    }

    const dbCustomers = await dbService.getAllCustomers();
    if (dbCustomers.length > 0) {
      db.customers = dbCustomers.map(c => ({ ...c, tags: safeParseJson(c.tags, []) }));
      console.log(`[DB Bridge] Loaded ${db.customers.length} customers from PostgreSQL`);
    }

    const dbOrders = await dbService.getAllOrders();
    if (dbOrders.length > 0) {
      db.orders = dbOrders;
      console.log(`[DB Bridge] Loaded ${db.orders.length} orders from PostgreSQL`);
    }

    const dbLogs = await dbService.getRecentLogs(250);
    if (dbLogs.length > 0) {
      db.logs = dbLogs.map(l => ({ ...l, details: safeParseJson(l.details, {}) }));
    }

    const dbAlerts = await dbService.getEmergencyAlerts();
    if (dbAlerts.length > 0) {
      db.emergencyAlerts = dbAlerts.map(a => ({
        ...a,
        detected_keywords: safeParseJson(a.detected_keywords, []),
        notified_channels: safeParseJson(a.notified_channels, [])
      }));
    }

    const geminiKey = await dbService.getSetting('gemini_apiKey');
    const geminiModel = await dbService.getSetting('gemini_model');
    const geminiUpdatedAt = await dbService.getSetting('gemini_apiKeyUpdatedAt');
    if (geminiKey) {
      db.settings.geminiApiKey = geminiKey;
    }
    if (geminiModel) {
      db.settings.geminiModel = geminiModel;
    }
    if (geminiUpdatedAt) {
      db.settings.geminiApiKeyUpdatedAt = geminiUpdatedAt;
    }

    // Multi-provider AI settings
    for (const key of PROVIDER_SETTING_KEYS) {
      const val = await dbService.getSetting(`ai_${key}`);
      if (val !== null) {
        (db.settings as any)[key] = val;
      }
    }

    return true;
  } catch (err) {
    console.error('[DB Bridge] Failed to load from PostgreSQL:', err);
    return false;
  }
}

export async function saveToDatabase(db: DatabaseStore): Promise<void> {
  try {
    // Pages
    for (const page of db.pages) {
      await dbService.upsertPage(flattenPage(page));
    }

    // Products
    const productMaps: [keyof DatabaseStore, string][] = [
      ['amulet', 'AMULET'], ['china', 'CHINA'], ['otop', 'OTOP'], ['agriculture', 'AGRICULTURE']
    ];
    for (const [key, cat] of productMaps) {
      const products = db[key] as any[];
      for (const product of products) {
        await dbService.upsertProduct({
          ...product,
          category: cat,
          custom_specs: JSON.stringify(product.custom_specs || []),
          specs_json: '{}'
        });
      }
    }

    // Customers
    for (const customer of db.customers) {
      await dbService.upsertCustomer({
        ...customer,
        tags: JSON.stringify(customer.tags || [])
      });
    }

    // Orders
    for (const order of db.orders) {
      await dbService.upsertOrder(order);
    }

    // Settings
    if (db.settings.geminiApiKey) {
      await dbService.setSetting('gemini_apiKey', db.settings.geminiApiKey);
    }
    if (db.settings.geminiModel) {
      await dbService.setSetting('gemini_model', db.settings.geminiModel);
    }
    if (db.settings.geminiApiKeyUpdatedAt) {
      await dbService.setSetting('gemini_apiKeyUpdatedAt', db.settings.geminiApiKeyUpdatedAt);
    }

    // Multi-provider AI settings
    for (const key of PROVIDER_SETTING_KEYS) {
      const val = (db.settings as any)[key];
      if (val !== undefined && val !== null && val !== '') {
        await dbService.setSetting(`ai_${key}`, String(val));
      }
    }

    // Cleanup old data
    await dbService.cleanupOldLogs(250);
    await dbService.cleanupOldChatHistory(30);
  } catch (err) {
    console.error('[DB Bridge] Failed to save to PostgreSQL:', err);
  }
}

export async function migrateFromJsonIfEmpty(jsonData: any): Promise<void> {
  try {
    const existingPages = await dbService.getAllPages();
    if (existingPages.length === 0 && jsonData && Object.keys(jsonData).length > 0) {
      console.log('[DB Bridge] PostgreSQL is empty, migrating from JSON data...');
      await dbService.migrateFromJson(jsonData);
    }
  } catch (err) {
    console.error('[DB Bridge] JSON migration failed:', err);
  }
}

function flattenPage(page: PageConfig): Record<string, any> {
  return {
    page_id: page.page_id,
    page_name: page.page_name,
    category: page.category,
    page_access_token: page.page_access_token || '',
    verify_token: page.verify_token || 'FB_AI_SALES_TOKEN_2026',
    is_active: page.is_active ? 1 : 0,
    auto_reply: page.auto_reply ? 1 : 0,
    auto_close_ai: page.auto_close_ai ? 1 : 0,
    page_avatar: page.page_avatar || '',
    page_cover: page.page_cover || '',
    follower_count: page.follower_count || 0,
    likes_count: page.likes_count || 0,
    inquiries_count: page.inquiries_count || 0,
    unread_messages: page.unread_messages || 0,
    ai_model: page.ai_model || 'gemini-3.6-flash',
    admin_name: page.admin_name || '',
    ai_tone: page.ai_tone || 'FRIENDLY',
    ai_custom_instructions: page.ai_custom_instructions || '',
    ai_brevity_mode: page.ai_brevity_mode ? 1 : 0,
    theme_color: page.theme_color || '',
    page_tag: page.page_tag || 'NORMAL',
    notification_channel: page.notification_channel || 'BOTH',
    line_notify_token: page.line_notify_token || '',
    line_group_id: page.line_group_id || '',
    telegram_bot_token: page.telegram_bot_token || '',
    telegram_chat_id: page.telegram_chat_id || '',
    google_sheet_url: page.google_sheet_url || '',
    scrape_comments_enabled: page.scrape_comments_enabled ? 1 : 0,
    auto_inbox_with_comment_context: page.auto_inbox_with_comment_context ? 1 : 0,
    hide_toxic_comments: page.hide_toxic_comments ? 1 : 0,
    toxic_keywords: JSON.stringify(page.toxic_keywords || []),
    purchase_keywords: JSON.stringify(page.purchase_keywords || []),
    comment_reply_template: page.comment_reply_template || '',
    comment_reply_images: JSON.stringify(page.comment_reply_images || []),
    comment_auto_tag_customer: page.comment_auto_tag_customer !== false ? 1 : 0,
    followup_enabled: page.followup_enabled ? 1 : 0,
    followup_messages: JSON.stringify(page.followup_messages || []),
    reply_delay_ms: page.reply_delay_ms ?? 1500,
    bot_stopped: page.bot_stopped ? 1 : 0,
    rate_limit_per_hour: page.rate_limit_per_hour ?? 30,
    quick_replies: JSON.stringify(page.quick_replies || []),
    sales_sequence_auto_trigger: page.sales_sequence_auto_trigger ? 1 : 0,
    cod_summary_template: page.cod_summary_template || '',
    cod_summary_fields: typeof page.cod_summary_fields === 'string' ? page.cod_summary_fields : JSON.stringify(page.cod_summary_fields || ''),
    product: JSON.stringify(page.product || {}),
    sequence: JSON.stringify(page.sequence || {}),
    sales_sequence_steps: JSON.stringify(page.sales_sequence_steps || []),
    is_connected: (page as any).is_connected ? 1 : 0,
    connected_at: (page as any).connected_at || null,
    last_active_at: (page as any).last_active_at || null
  };
}

function safeParseJson(val: string | undefined | null, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// SSE (Server-Sent Events) support for real-time updates
interface SSEClient {
  id: string;
  res: any; // Express Response
  pageId?: string;
}

const sseClients: Map<string, SSEClient> = new Map();

export function addSSEClient(clientId: string, res: any, pageId?: string): void {
  sseClients.set(clientId, { id: clientId, res, pageId });
  res.on('close', () => {
    sseClients.delete(clientId);
  });
}

export function broadcastSSE(event: string, data: any, targetPageId?: string): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, client] of sseClients) {
    if (!targetPageId || !client.pageId || client.pageId === targetPageId) {
      try {
        client.res.write(payload);
      } catch {
        sseClients.delete(client.id);
      }
    }
  }
}

export function getSSEClientCount(): number {
  return sseClients.size;
}
