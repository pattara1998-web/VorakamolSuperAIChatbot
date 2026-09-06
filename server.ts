import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_PAGES,
  INITIAL_AMULET,
  INITIAL_CHINA,
  INITIAL_OTOP,
  INITIAL_AGRICULTURE,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS
} from './src/data/initialDatabase.ts';
import {
  ProductAmulet,
  ProductChina,
  ProductOtop,
  ProductAgriculture,
  Order,
  Customer,
  PageConfig,
  ProductCategory,
  ActivityLog,
  EmergencyAlert
} from './src/types.ts';
import * as dbBridge from './src/services/dbBridge.ts';
import * as dbService from './src/services/database.ts';
import * as auth from './src/services/auth.ts';
import { runSelfTests, type SelfTestReport } from './src/services/selftest.ts';

dotenv.config();

// In-Memory Durable Store for Database tables, logs, and emergency alerts
interface DatabaseStore {
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

const db: DatabaseStore = {
  pages: [...INITIAL_PAGES],
  amulet: [...INITIAL_AMULET],
  china: [...INITIAL_CHINA],
  otop: [...INITIAL_OTOP],
  agriculture: [...INITIAL_AGRICULTURE],
  customers: [...INITIAL_CUSTOMERS],
  orders: [...INITIAL_ORDERS],
  settings: {
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },
  logs: [
    {
      id: 'log-init-1',
      timestamp: new Date().toISOString(),
      type: 'INFO',
      sender_id: 'SYSTEM',
      page_id: 'ALL',
      content: 'ระบบ Facebook AI Auto-Sales Hub & Google Sheets CRM เริ่มทำงาน พร้อมเชื่อมต่อ Webhook, Telegram, LINE, และ Crisis Alert System',
      status: 'SUCCESS'
    } as any
  ],
  emergencyAlerts: []
};

// ---------------------------------------------------------------------------
// Safe Base Page Template Factory
// INITIAL_PAGES may be an empty array (Strictly Real Data mode), so relying
// on INITIAL_PAGES[0] directly causes "Cannot read properties of undefined
// (reading 'page_cover')" during Facebook connection. This factory guarantees
// a fully-formed PageConfig fallback at all times.
// ---------------------------------------------------------------------------
const DEFAULT_PAGE_AVATAR = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80';
const DEFAULT_PAGE_COVER = 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1200&q=80';

function createDefaultPageTemplate(): PageConfig {
  return {
    page_id: 'template-default',
    page_name: 'เพจใหม่',
    category: 'CHINA',
    page_access_token: '',
    verify_token: 'FB_AI_SALES_TOKEN_2026',
    is_active: true,
    auto_reply: true,
    auto_close_ai: true,
    page_avatar: DEFAULT_PAGE_AVATAR,
    page_cover: DEFAULT_PAGE_COVER,
    follower_count: 0,
    likes_count: 0,
    inquiries_count: 0,
    ai_model: 'gemini-3.6-flash',
    admin_name: 'น้ำหวาน',
    ai_tone: 'FRIENDLY',
    ai_custom_instructions: 'ตอบลูกค้าด้วยความสุภาพ แนะนำโปรโมชั่นและเก็บเงินปลายทางทันที',
    ai_brevity_mode: true,
    product: {
      product_id: '',
      product_name: '',
      category: 'CHINA',
      base_price: 0,
      display_price: 0,
      description: '',
      promotions: [],
      images: { main: '', detail: '', promotion: '', review: '', closing: '' }
    },
    sequence: {
      step1_opening_text: '',
      step2_product_image: '',
      step3_promotion_detail: '',
      step4_promotion_image: '',
      step5_review_image: '',
      step6_closing_text: ''
    },
    scrape_comments_enabled: false,
    auto_inbox_with_comment_context: false,
    hide_toxic_comments: true,
    toxic_keywords: [],
    purchase_keywords: [],
    followup_enabled: false,
    followup_messages: []
  };
}

function getBasePageTemplate(): PageConfig {
  return INITIAL_PAGES[0] || createDefaultPageTemplate();
}

// Meta Graph API `/me/accounts` returns only 25 pages per call by default.
// Accounts with hundreds of pages MUST follow cursor pagination (paging.next),
// otherwise the hub silently shows a fraction of the user's pages.
async function fetchAllManagedPages(userAccessToken: string): Promise<any[]> {
  const fields = 'id,name,picture{url},cover{source},category,access_token,followers_count,fan_count';
  const collected: any[] = [];
  let url: string | null =
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}&fields=${encodeURIComponent(fields)}&limit=100`;

  // Guard: 50 iterations × 100 items = up to 5,000 pages per sync.
  for (let page = 0; page < 50 && url; page++) {
    const res: any = await fetch(url as string);
    const data: any = await res.json();
    url = null;

    if (data?.error) {
      if (collected.length === 0) {
        const err: any = new Error(data.error.message || 'Cannot fetch managed pages');
        err.graphError = data.error;
        throw err;
      }
      console.warn('[FB Pages] Pagination stopped early due to Graph error:', data.error.message);
      break;
    }

    collected.push(...(data.data || []));
    // `paging.next` already carries access_token + after cursor.
    url = data?.paging?.next || null;
    if (!url) break;
  }

  // De-duplicate by page id in case Meta repeats a boundary item.
  const seen = new Set<string>();
  return collected.filter(p => p?.id && !seen.has(p.id) && seen.add(p.id));
}

let deliverTelegram: ((page: PageConfig, text: string) => Promise<{ success: boolean; [key: string]: any }>) | null = null;
let deliverLine: ((page: PageConfig, text: string) => Promise<{ success: boolean; [key: string]: any }>) | null = null;

// Operational data must live beyond a browser session or server restart.
// Mount DATA_FILE to durable storage when hosting on a serverless platform.
const DATA_FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data', 'superai-v2.8.json');
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v24.0';
// Human-like reply pacing: wait ~1.5s before answering so the page does not
// instant-fire like a bot (Meta anti-spam / BAN prevention). Configurable.
const REPLY_DELAY_MS = Number(process.env.REPLY_DELAY_MS || 1500);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
// Hard cap on any single AI call so a hung Gemini request can never leave a
// customer waiting for minutes — we race the call against a timer and, on
// timeout, retry once on the lite model before falling back to a template.
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 9000);
const AI_FAST_RETRY_MS = Number(process.env.AI_FAST_RETRY_MS || 6000);
const AI_FAST_MODEL = process.env.AI_FAST_MODEL || 'gemini-2.5-flash-lite';
function withTimeout<T>(promise: Promise<T>, ms: number, label = 'AI'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms))
  ]);
}
// Two-stage AI call: primary model first; if it stalls or errors, one quick
// retry on the lite model. Bounds worst-case latency at primaryMs + fastMs
// instead of dropping straight to a template reply — only a total AI outage
// (auth/quota/network down) reaches the fallback template.
async function generateWithFastRetry(ai: any, primaryModel: string, params: any, primaryMs: number, fastMs: number): Promise<any> {
  try {
    return await withTimeout(ai.models.generateContent({ ...params, model: primaryModel }), primaryMs);
  } catch (primaryErr: any) {
    try {
      return await withTimeout(ai.models.generateContent({ ...params, model: AI_FAST_MODEL }), fastMs);
    } catch {
      throw primaryErr;
    }
  }
}
// Dedupe stores: webhook pushes + Graph API polling may deliver the same
// message/comment twice — never process (or reply to) an event twice.
const processedMessageIds = new Set<string>();
const processedCommentIds = new Set<string>();

// ---------------------------------------------------------------------------
// Thai-aware understanding helpers. Customers type with elongated characters
// ("ราคาค่าาาา"), slang, emoji and no spaces — raw substring matching misses
// all of that. Everything below runs instantly (no AI call) and its output is
// fed INTO the AI prompt as a hint, plus used as a regex safety-net for
// order data the AI may fail to extract.
// ---------------------------------------------------------------------------
function normalizeThaiText(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1')                       // "ค่าาาา" → "ค่าา"
    .replace(/[\u200b-\u200f\uFEFF]/g, '')             // zero-width / bidi marks
    // Keep \p{M}: Thai tone marks and combining vowels are Unicode marks,
    // stripping them would mangle every word ("เท่าไหร่" → "เทา ไหร").
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type IntentHint = 'GREETING' | 'PRICE' | 'PROMOTION' | 'SHIPPING' | 'TRUST' | 'NEGOTIATION' | 'ORDER' | 'FOLLOWUP' | 'QUESTION';

// Ordered by priority: order signals outrank price signals, price outranks
// greeting — "สวัสดีคะราคาเท่าไหร่" must classify as PRICE, not GREETING.
const INTENT_KEYWORDS: Array<[IntentHint, string[]]> = [
  ['ORDER', ['สั่งซื้อ', 'จอง', 'โอนเงิน', 'โอนแล้ว', 'ชำระเงินแล้ว', 'ชำระเงิน', 'ยืนยันออเดอร์', 'เอาไปเลย', 'ตัดสินใจแล้ว', 'กรอกที่อยู่', 'ส่งที่อยู่', 'เอา 2', 'เอา 3', 'เอาสอง', 'เอาสาม', 'ซื้อเลย']],
  ['NEGOTIATION', ['ลดได้ไหม', 'ลดได้มั้ย', 'ลดหน่อย', 'ลดอีก', 'ต่อรอง', 'ถูกกว่านี้', 'ขอราคาพิเศษ', 'แพงไป', 'แพงสุด', 'ขอส่วนลด']],
  ['TRUST', ['ของแท้', 'ของปลอม', 'โกง', 'หลอก', 'มั่นใจ', 'เชื่อถือ', 'รับประกัน', 'รีวิว', 'เคลม', 'ยังไงถึงไว้ใจ', 'ขายมานานไหม']],
  ['SHIPPING', ['ส่งกี่วัน', 'ส่งเมื่อไหร่', 'ส่งทางไหน', 'ส่งฟรี', 'ค่าส่ง', 'เก็บเงินปลายทาง', 'มีcod', 'พัสดุ', 'จัดส่ง', 'ส่งด่วน', 'ลงทะเบียน']],
  ['PROMOTION', ['โปรโมชั่น', 'โปรโมชั้น', 'มีโปร', 'โปรไหน', 'ของแถม', 'แถมไร', 'แถมอะไร', 'แพ็คเกจ', 'แพ็คไหน', 'ชุดไหน', 'ซื้อ 2 แถม', 'คุ้มสุด']],
  ['PRICE', ['ราคา', 'เท่าไหร่', 'เท่าไร', 'กี่บาท', 'เหลือเท่าไหร่', 'จ่ายเท่าไหร่', 'ตัวละ']],
  ['GREETING', ['สวัสดี', 'หวัดดี', 'hello', 'hi ', 'สอบถาม', 'ทักครับ', 'ทักค่ะ', 'แอดมินอยู่ไหม', 'มาจากเพจ', 'ดีครับ', 'ดีค่ะ']],
  ['FOLLOWUP', ['เมื่อกี้', 'ก่อนหน้า', 'ตามที่คุย', 'ที่บอกไว้', 'อันที่ถาม']]
];

function classifyIntentInstant(rawText: string): IntentHint {
  const text = normalizeThaiText(rawText);
  if (!text) return 'QUESTION';
  for (const [intent, keywords] of INTENT_KEYWORDS) {
    if (keywords.some(k => text.includes(normalizeThaiText(k)))) return intent;
  }
  return 'QUESTION';
}

// Regex safety-net: pull phone/address straight from the message so an order
// is never lost just because the AI omitted a field in its JSON.
function extractOrderInfo(rawText: string): { phone_number: string; address: string } {
  const text = String(rawText || '');
  const compact = text.replace(/[-\s.]/g, '');
  const phoneMatch = compact.match(/(?<!\d)0\d{8,9}(?!\d)/);
  const addressMatch = text.match(/.{0,50}(?:\d{1,4}\/\d{1,5}|หมู่ที่?\s?\d|ม\.\s?\d|ซอย|ถนน|ต\.|อ\.|จังหวัด|แขวง|เขต|ตำบล|อำเภอ).{0,140}/);
  return {
    phone_number: phoneMatch ? phoneMatch[0] : '',
    address: addressMatch ? addressMatch[0].trim() : ''
  };
}

// Per-intent sales playbook injected into every prompt so the AI does not just
// answer — it sells. Strategies only ever use REAL product data (promotions,
// free_shipping flags) already in the prompt; nothing here invents facts.
const SALES_PLAYBOOK: Record<IntentHint, string> = {
  GREETING: 'ลูกค้าเปิดแชท: ทักทายสั้น สุภาพ เป็นกันเอง 1 ประโยค แล้วถามกลับทันทีว่าสนใจเรื่องไหน (ราคา/โปรโมชั่น/สินค้า) ห้ามยัดรายละเอียดยาวตอนทักแรก',
  PRICE: 'ลูกค้าถามราคา: ตอบราคาโปรโมชั่นตรงๆ ทันที (ใช้ตัวเลขจริงจากข้อมูลด้านล่าง) + ชี้จุดคุณค่า 1 ข้อ + ปิดท้ายด้วยการชวนเลือกแพ็กเกจ',
  PROMOTION: 'ลูกค้าถามโปรโมชั่น/ของแถม: สรุปแพ็กเกจที่มีจริงแบบกระชับ เทียบให้เห็นว่าแพ็กไหนคุ้มสุด แล้วชวนเลือกซื้อแพ็กนั้น',
  SHIPPING: 'ลูกค้าถามการจัดส่ง: ตอบตามข้อมูลจริงเท่านั้น (บอกส่งฟรีได้เฉพาะแพ็กที่ free_shipping=true) ย้ำเก็บเงินปลายทางถ้ามี แล้วชวนสั่ง',
  TRUST: 'ลูกค้ากังวลความน่าเชื่อถือ: ไม่โต้ตอบเสียงดัง ย้ำจุดแข็งที่มีข้อมูลจริง เช่น รับประกันของแท้/รีวิวลูกค้า/เก็บเงินปลายทาง (ถ้ามี) ให้ลูกค้าตัดสินใจได้สบายใจ แล้วเสนอให้เริ่มจากแพ็กเล็กก็ได้',
  NEGOTIATION: 'ลูกค้าต่อรองราคา: ยึดราคาที่ตั้งไว้ ห้ามลดราคาเองนอกโปรโมชั่น แต่นำเสนอมูลค่าเพิ่มจากโปร/ของแถมที่มีจริงแทน แล้วปิดการขาย',
  ORDER: 'ลูกค้าแสดงเจตนาซื้อ/ให้ข้อมูล: ขอบคุณ + ยืนยันรายการสั้นๆ + ถ้าข้อมูลยังไม่ครบ (ชื่อ/เบอร์โทร/ที่อยู่) ให้ถามเฉพาะชิ้นที่ขาด ทีละอย่าง อย่าถามรวบทุกอย่างพร้อมกัน',
  FOLLOWUP: 'ลูกค้าอ้างถึงบทสนทนาเดิม: ต่อประเด็นเดิมทันที ห้ามทักทายใหม่ ห้ามเริ่มเรื่องใหม่',
  QUESTION: 'คำถามทั่วไป: ตอบตรงคำถามจากข้อมูลสินค้าเท่านั้น สั้นกระชับ แล้วปิดด้วยคำถามชวนคุยต่อ'
};

// Spec lines whose value is missing ("ไม่ระบุ") burn input tokens on every
// single message without adding any knowledge — strip them before prompting.
function compactSpecText(specs: string): string {
  return specs
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      return !t.endsWith(': ไม่ระบุ') && !t.endsWith(':');
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Per-conversation chat memory. Without it the AI only ever sees ONE message,
// which is the root cause of off-topic answers and repeated identical replies:
// it literally cannot know what was already said. The last few exchanges are
// injected into every prompt so answers continue the conversation naturally.
// ---------------------------------------------------------------------------
interface HistoryEntry {
  role: 'customer' | 'admin';
  text: string;
  timestamp: number;
}
const conversationHistory = new Map<string, HistoryEntry[]>();
const HISTORY_MAX_PER_SENDER = 300;
function pushHistory(pageId: string, senderId: string, role: 'customer' | 'admin', text: string) {
  const key = `${pageId}:${senderId}`;
  const list = conversationHistory.get(key) || [];
  list.push({ role, text: String(text || '').slice(0, 600), timestamp: Date.now() });
  if (list.length > HISTORY_MAX_PER_SENDER) list.splice(0, list.length - HISTORY_MAX_PER_SENDER);
  conversationHistory.set(key, list);
  // Also persist to PostgreSQL ChatHistory table (fire-and-forget)
  try {
    dbService.addChatMessage(pageId, senderId, role, text).catch(() => { /* non-critical */ });
  } catch { /* non-critical */ }
  // Broadcast real-time update via SSE
  try {
    dbBridge.broadcastSSE('new_message', { page_id: pageId, sender_id: senderId, role, text: text.slice(0, 200), timestamp: new Date().toISOString() }, pageId);
  } catch { /* non-critical */ }
  // Meta-style inbox state: unread badge + preview per conversation
  try {
    if (role === 'customer') {
      dbService.recordIncomingMessage(pageId, senderId, text.slice(0, 200)).catch(() => { /* non-critical */ });
    } else {
      dbService.recordOutgoingMessage(pageId, senderId, text.slice(0, 200)).catch(() => { /* non-critical */ });
    }
  } catch { /* non-critical */ }
}
function getRecentHistory(pageId: string, senderId: string, limit = 8): HistoryEntry[] {
  const list = conversationHistory.get(`${pageId}:${senderId}`) || [];
  return list.slice(-limit);
}

// Restore conversation memory from PostgreSQL after a server restart (the
// in-memory map starts empty). Await this once in the webhook handler before
// building the AI prompt so the very first message still has full context.
async function seedHistoryFromDb(pageId: string, senderId: string): Promise<void> {
  const key = `${pageId}:${senderId}`;
  if (conversationHistory.has(key)) return;
  try {
    const rows = await dbService.getRecentChatHistory(pageId, senderId, 12);
    if (rows && rows.length > 0) {
      conversationHistory.set(key, rows.map(r => ({
        role: r.role === 'admin' ? 'admin' as const : 'customer' as const,
        text: String(r.text || '').slice(0, 600),
        timestamp: Date.parse(r.created_at) || Date.now()
      })));
    }
  } catch { /* non-critical: empty memory just means a fresh conversation */ }
}
function getRecentAdminReplies(pageId: string, senderId: string, limit = 4): string[] {
  return getRecentHistory(pageId, senderId, 20)
    .filter(h => h.role === 'admin')
    .slice(-limit)
    .map(h => h.text);
}

// Track recent AI replies per sender to prevent repetition
interface RecentReply {
  senderId: string;
  pageId: string;
  replyText: string;
  timestamp: number;
}
const recentReplies: RecentReply[] = [];
const MAX_RECENT_REPLIES = 50; // Keep last 50 replies
const REPLY_MEMORY_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

// Clean old entries from recentReplies
function cleanRecentReplies() {
  const now = Date.now();
  const filtered = recentReplies.filter(r => now - r.timestamp < REPLY_MEMORY_WINDOW_MS);
  if (filtered.length < recentReplies.length) {
    while (recentReplies.length > 0) recentReplies.pop();
    recentReplies.push(...filtered);
  }
}

// Check if this reply text is too similar to a recent reply from the same sender/page
function isRepeatedReply(pageId: string, senderId: string, newText: string): boolean {
  cleanRecentReplies();
  const senderReplies = recentReplies.filter(r => r.pageId === pageId && r.senderId === senderId);
  if (senderReplies.length === 0) return false;
  
  // Normalize texts for comparison
  const normalize = (t: string) => t.replace(/[^\w\s\u0000-\u00FF]/g, '').trim().toLowerCase();
  const normalizedNew = normalize(newText);
  if (normalizedNew.length < 10) return false; // Skip short texts
  
  // Check similarity with recent replies
  for (const recent of senderReplies) {
    const normalizedRecent = normalize(recent.replyText);
    if (normalizedRecent.length < 10) continue;
    
    // Exact match check
    if (normalizedNew === normalizedRecent) return true;
    
    // Substring check (new reply contains old reply or vice versa with 80%+ overlap)
    if (normalizedNew.includes(normalizedRecent) || normalizedRecent.includes(normalizedNew)) {
      const shorter = Math.min(normalizedNew.length, normalizedRecent.length);
      const longer = Math.max(normalizedNew.length, normalizedRecent.length);
      if (shorter / longer > 0.8) return true; // 80%+ overlap
    }
    
    // Word overlap check (at least 70% of words are the same)
    const newWords = normalizedNew.split(/\s+/).filter(w => w.length > 2);
    const recentWords = normalizedRecent.split(/\s+/).filter(w => w.length > 2);
    if (newWords.length >= 3 && recentWords.length >= 3) {
      const commonWords = newWords.filter(w => recentWords.includes(w));
      if (commonWords.length / Math.max(newWords.length, recentWords.length) > 0.7) {
        return true;
      }
    }
  }
  return false;
}

// Add reply to recent history
function addRecentReply(pageId: string, senderId: string, replyText: string) {
  cleanRecentReplies();
  recentReplies.unshift({ senderId, pageId, replyText, timestamp: Date.now() });
  if (recentReplies.length > MAX_RECENT_REPLIES) {
    recentReplies.pop();
  }
}
function rememberId(store: Set<string>, id: string | undefined | null): boolean {
  if (!id) return true;
  if (store.has(id)) return false;
  store.add(id);
  if (store.size > 4000) {
    for (const key of store) {
      store.delete(key);
      if (store.size <= 3000) break;
    }
  }
  return true;
}

// Rate limiting: track replies per sender per hour to prevent bot spam/nonsense.
// Key: `${pageId}:${senderId}`, Value: { count, windowStart }
const rateLimitTracker = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_RATE_LIMIT = 30; // max replies per sender per hour

function checkRateLimit(pageId: string, senderId: string, limit: number): boolean {
  const key = `${pageId}:${senderId}`;
  const now = Date.now();
  const entry = rateLimitTracker.get(key);
  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    rateLimitTracker.set(key, { count: 1, windowStart: now });
    return true; // allowed
  }
  if (entry.count >= limit) return false; // blocked
  entry.count++;
  return true;
}

// Clean up rate limit tracker periodically (every 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitTracker) {
    if ((now - entry.windowStart) > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitTracker.delete(key);
    }
  }
}, 7_200_000);
const STORE_SECRET = process.env.ENCRYPTION_SECRET_KEY || process.env.FACEBOOK_APP_SECRET || '';
function encryptStoredSecret(value: string) {
  if (!value || value.startsWith('store:') || !STORE_SECRET) return value;
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash('sha256').update(STORE_SECRET).digest();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `store:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
}
function decryptStoredSecret(value: string) {
  if (!value?.startsWith('store:') || !STORE_SECRET) return value;
  try {
    const [, ivHex, tagHex, encryptedHex] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(STORE_SECRET).digest(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
// ---------------------------------------------------------------------------
// Database bootstrap. Production points DATABASE_URL at a hosted PostgreSQL
// (Render / Neon / Supabase). Without DATABASE_URL the database layer runs the
// same SQL on PGlite (real Postgres as WASM, persisted under data/pglite) so
// local development needs zero external setup.
// ---------------------------------------------------------------------------
async function loadPersistedData() {
  try {
    // 1. PostgreSQL (primary database)
    await dbService.initDatabase();
    // One-time import from the legacy SQLite file (data/superai.db) if PG is empty
    const migrated = await dbService.migrateFromSqliteIfEmpty(path.join(process.cwd(), 'data', 'superai.db'));
    const pgLoaded = await dbBridge.loadFromDatabase(db);
    if (pgLoaded) {
      console.log(`[Store] Loaded data from PostgreSQL database${migrated ? ' (migrated from legacy SQLite)' : ''}`);
      // Still check JSON for migration if PostgreSQL was empty
      if (fs.existsSync(DATA_FILE)) {
        try {
          const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<DatabaseStore>;
          await dbBridge.migrateFromJsonIfEmpty(saved);
        } catch { /* JSON migration is best-effort */ }
      }
      // Apply env var fallback for Gemini key
      if (!db.settings.geminiApiKey && process.env.GEMINI_API_KEY) {
        db.settings.geminiApiKey = process.env.GEMINI_API_KEY;
      }
      return;
    }

    // 2. Fallback: load from JSON file if PostgreSQL fails
    if (!fs.existsSync(DATA_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as Partial<DatabaseStore>;
    for (const key of ['pages', 'amulet', 'china', 'otop', 'agriculture', 'customers', 'orders', 'logs', 'emergencyAlerts'] as const) {
      if (Array.isArray(saved[key])) (db as any)[key] = saved[key];
    }
    if (saved.settings) {
      const savedKey = decryptStoredSecret(saved.settings.geminiApiKey || '');
      db.settings = {
        ...db.settings,
        ...saved.settings,
        geminiApiKey: savedKey || process.env.GEMINI_API_KEY || db.settings.geminiApiKey || ''
      };
    }
    // Migrate JSON data into PostgreSQL for future loads
    await dbBridge.migrateFromJsonIfEmpty(saved);
  } catch (error) {
    console.error('[Store] Could not load persisted data:', error);
  }
}
// Serialized persistence queue: concurrent webhook events must not race their
// Postgres write-backs. persistData() only enqueues; the promise chains.
let persistQueue: Promise<void> = Promise.resolve();
function persistData(): void {
  persistQueue = persistQueue.then(async () => {
    try {
      // Save to PostgreSQL (primary database)
      await dbBridge.saveToDatabase(db);
    } catch (error) {
      console.error('[Store] Could not persist data to PostgreSQL:', error);
    }
    try {
      // Local JSON snapshot (cheap backup alongside the database)
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const persistable = { ...db, settings: { ...db.settings, geminiApiKey: encryptStoredSecret(db.settings.geminiApiKey) } };
      fs.writeFileSync(DATA_FILE, JSON.stringify(persistable), 'utf8');
    } catch (error) {
      console.error('[Store] Could not persist JSON backup:', error);
    }
  });
}

const PRODUCT_CORE_FIELDS = new Set([
  'product_id', 'page_id', 'product_name', 'category', 'display_price', 'price_1', 'price_2', 'price_3',
  'promotion_detail', 'shipping_duration', 'image_main', 'image_detail', 'image_promotion', 'image_review',
  'image_closing', 'opening_text', 'detail_text', 'promotion_text', 'review_text', 'closing_text', 'custom_specs'
]);
function syncPagesFromCatalog(collection: 'amulet' | 'china' | 'otop' | 'agriculture') {
  for (const record of db[collection] as any[]) {
    const page = db.pages.find(p => p.page_id === record.page_id);
    if (!page) continue;
    const specs = Object.fromEntries(Object.entries(record).filter(([key, value]) => !PRODUCT_CORE_FIELDS.has(key) && value !== undefined && value !== ''));
    page.product = {
      ...page.product,
      product_id: record.product_id || page.product?.product_id,
      product_name: record.product_name || page.product?.product_name,
      category: record.category || page.category,
      base_price: Number(record.price_1 ?? page.product?.base_price ?? record.display_price ?? 0),
      display_price: Number(record.display_price ?? page.product?.display_price ?? 0),
      description: record.description || record.detail_text || page.product?.description || '',
      shipping_duration: record.shipping_duration || page.product?.shipping_duration,
      specs: { ...(page.product?.specs || {}), ...specs, custom_specs: record.custom_specs || page.product?.specs?.custom_specs },
      images: {
        main: record.image_main || page.product?.images?.main || '', detail: record.image_detail || page.product?.images?.detail || '',
        promotion: record.image_promotion || page.product?.images?.promotion || '', review: record.image_review || page.product?.images?.review || '',
        closing: record.image_closing || page.product?.images?.closing || ''
      },
      promotions: page.product?.promotions?.length ? page.product.promotions : [
        { id: 'tier-1', name: 'โปรโมชั่น 1 ชิ้น', quantity: 1, price: Number(record.price_1 || record.display_price || 0), description: '' },
        { id: 'tier-2', name: 'โปรโมชั่น 2 ชิ้น', quantity: 2, price: Number(record.price_2 || 0), description: record.promotion_detail || '' },
        { id: 'tier-3', name: 'โปรโมชั่น 3 ชิ้น', quantity: 3, price: Number(record.price_3 || 0), description: '' }
      ]
    };
  }
}
function syncCatalogFromPages() {
  const collections: Record<string, 'amulet' | 'china' | 'otop' | 'agriculture'> = { AMULET: 'amulet', CHINA: 'china', OTOP: 'otop', AGRICULTURE: 'agriculture' };
  for (const page of db.pages) {
    const collection = collections[page.category];
    if (!collection || !page.product) continue;
    const catalog = db[collection] as any[];
    const index = catalog.findIndex(item => item.page_id === page.page_id || item.product_id === page.product.product_id);
    const current = index >= 0 ? catalog[index] : {};
    const next = {
      ...current,
      ...(page.product.specs || {}),
      product_id: page.product.product_id || current.product_id || `PROD-${page.page_id}`,
      page_id: page.page_id,
      product_name: page.product.product_name,
      category: page.product.category || page.category,
      display_price: page.product.display_price,
      price_1: page.product.promotions?.[0]?.price ?? current.price_1 ?? page.product.display_price,
      price_2: page.product.promotions?.[1]?.price ?? current.price_2 ?? 0,
      price_3: page.product.promotions?.[2]?.price ?? current.price_3 ?? 0,
      // Feature 8: keep the SAME real promotion tiers (custom names, free_shipping, gift_quantity)
      // on the catalog row so the database editor and Pages Hub always show identical data.
      promotions: page.product.promotions?.length ? page.product.promotions : current.promotions,
      promotion_detail: page.product.promotions?.[1]?.description || current.promotion_detail || '',
      shipping_duration: page.product.shipping_duration || current.shipping_duration,
      image_main: page.product.images?.main || current.image_main || '', image_detail: page.product.images?.detail || current.image_detail || '',
      image_promotion: page.product.images?.promotion || current.image_promotion || '', image_review: page.product.images?.review || current.image_review || '', image_closing: page.product.images?.closing || current.image_closing || '',
      opening_text: page.sequence?.step1_opening_text || current.opening_text || '', detail_text: page.product.description || current.detail_text || '',
      promotion_text: page.sequence?.step3_promotion_detail || current.promotion_text || '', closing_text: page.sequence?.step6_closing_text || current.closing_text || ''
    };
    if (index >= 0) catalog[index] = next; else catalog.unshift(next);
  }
}

// Helper: Add Activity Log
function addLog(
  type: ActivityLog['type'],
  sender_id: string,
  page_id: string,
  content: string,
  status: ActivityLog['status'] = 'SUCCESS',
  details?: Record<string, any>
) {
  const log: ActivityLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    type,
    sender_id,
    page_id,
    content,
    status,
    details
  };
  db.logs.unshift(log);
  if (db.logs.length > 250) {
    db.logs.pop();
  }
  return log;
}

// Crisis Dispatcher Helper (Telegram & LINE)
async function triggerCrisisAlert(alert: {
  page_id: string;
  page_name: string;
  threat_type: 'LEGAL_THREAT' | 'SAKOB_POLICE_THREAT' | 'SEVERE_COMPLAINT' | 'PAGE_DISCONNECTED' | 'SYSTEM_OUTAGE';
  customer_name?: string;
  message_text: string;
  psid?: string;
  keywords?: string[];
}) {
  const emergencyItem: EmergencyAlert = {
    id: `EMG-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: alert.threat_type,
    severity: 'CRITICAL',
    source: 'CHAT_SENTINEL',
    page_id: alert.page_id,
    sender_id: alert.psid,
    customer_name: alert.customer_name || 'ไม่ระบุชื่อ',
    threat_text: alert.message_text,
    detected_keywords: alert.keywords || ['สคบ', 'แจ้งความ', 'ฟ้อง'],
    is_resolved: false,
    notified_channels: ['TELEGRAM', 'LINE']
  };

  db.emergencyAlerts.unshift(emergencyItem);

  const page = db.pages.find(p => p.page_id === alert.page_id) || db.pages[0];

  const alertMessage = `🚨 [เตือนภัยวิกฤตด่วน / CRISIS ALERT]\nเพจ: ${alert.page_name}\nประเภท: ${alert.threat_type === 'SAKOB_POLICE_THREAT' || alert.threat_type === 'LEGAL_THREAT' ? 'ลูกค้าขู่ร้องเรียน / สคบ. / แจ้งความ' : 'ระบบหรือเพจขัดข้อง'}\nลูกค้า: ${alert.customer_name || 'ลูกค้าเพจ'}\nข้อความ: "${alert.message_text}"\nเวลา: ${new Date().toLocaleTimeString('th-TH')}\n⚠️ กรุณาให้ผู้จัดการหรือแอดมินคนจริงติดต่อกลับด่วนที่สุด!`;

  // Log Crisis
  addLog(
    'INFO',
    alert.psid || 'SYSTEM',
    alert.page_id,
    `🚨 [CRISIS DISPATCH] ตรวจพบเหตุด่วน/ขู่แจ้งความ สคบ: "${alert.message_text}" -> ส่งแจ้งเตือนฉุกเฉินไปยัง Telegram & LINE ทันที`,
    'WARNING',
    emergencyItem
  );

  // Send to Telegram
  if (page.telegram_bot_token && page.telegram_chat_id && deliverTelegram) {
    const sent = await deliverTelegram(page, alertMessage);
    addLog(
      'INFO',
      'TELEGRAM_BOT',
      alert.page_id,
      sent.success ? `📡 [Telegram Crisis Alert] ส่งข้อความด่วนไปยัง Telegram Group (${page.telegram_chat_id}) สำเร็จ` : '❌ [Telegram Crisis Alert] ส่งไม่สำเร็จ',
      sent.success ? 'SUCCESS' : 'ERROR'
    );
  }

  // Send to LINE
  if (page.line_notify_token && page.line_group_id && deliverLine) {
    const sent = await deliverLine(page, alertMessage);
    addLog(
      'LINE_ALERT',
      'LINE_BOT',
      alert.page_id,
      sent.success ? `📲 [LINE Crisis Alert] ส่งแจ้งเตือนด่วนไปยัง LINE Group (${page.line_group_id}) สำเร็จ` : '❌ [LINE Crisis Alert] ส่งไม่สำเร็จ',
      sent.success ? 'SUCCESS' : 'ERROR'
    );
  }

  return emergencyItem;
}

// Order Summary Dispatcher Helper (Telegram & LINE)
async function dispatchOrderSummary(order: Order, page: PageConfig) {
  const channel = page.notification_channel || 'BOTH';

  // Format using cod_summary_template if provided, else use standard format
  let formattedSummary = '';
  if (page.cod_summary_template) {
    formattedSummary = page.cod_summary_template
      .replace('{customer_name}', order.customer_name)
      .replace('{shipping_address}', order.shipping_address)
      .replace('{phone_number}', order.phone_number)
      .replace('{items}', order.items)
      .replace('{total_amount}', `${order.total_amount.toLocaleString()}`);
  } else {
    formattedSummary = `${order.customer_name}\n${order.shipping_address}\n${order.phone_number}\n***${order.items}`;
  }

  const dispatchContent = `📦 [คำสั่งซื้อใหม่ - เก็บเงินปลายทาง]\nเพจ: ${page.page_name}\n----------------------------------\n${formattedSummary}\n----------------------------------\nยอดเรียกเก็บ: ฿${order.total_amount.toLocaleString()}\nสถานะ: ส่งสรุปยอดเรียบร้อย ✅`;

  // Per-channel delivery results so callers (e.g. /api/notifications/test) can
  // report the REAL outcome instead of assuming success.
  let telegramResult: { success: boolean; skipped?: boolean; error?: string } = { success: false, skipped: true, error: 'CHANNEL_DISABLED' };
  let lineResult: { success: boolean; skipped?: boolean; error?: string } = { success: false, skipped: true, error: 'CHANNEL_DISABLED' };

  // Send to Telegram if enabled
  if ((channel === 'TELEGRAM' || channel === 'BOTH') && deliverTelegram) {
    telegramResult = await deliverTelegram(page, dispatchContent);
    addLog(
      'INFO',
      'TELEGRAM_BOT',
      page.page_id,
      telegramResult.success ? `✈️ ส่งสรุปยอด COD ไปยัง Telegram (${page.telegram_chat_id || 'CHANNEL'}):\n${formattedSummary.replace(/\n/g, ' | ')}` : '❌ ส่งสรุปยอด COD ไปยัง Telegram ไม่สำเร็จ',
      telegramResult.success ? 'SUCCESS' : 'ERROR',
      { order_id: order.order_id, target: 'TELEGRAM' }
    );
  }

  // Send to LINE if enabled
  if ((channel === 'LINE' || channel === 'BOTH') && deliverLine) {
    lineResult = await deliverLine(page, dispatchContent);
    addLog(
      'LINE_ALERT',
      'LINE_BOT',
      page.page_id,
      lineResult.success ? `📲 ส่งสรุปยอด COD ไปยังกลุ่ม LINE (${page.line_group_id || 'DEFAULT'}):\n${formattedSummary.replace(/\n/g, ' | ')}` : '❌ ส่งสรุปยอด COD ไปยัง LINE ไม่สำเร็จ',
      lineResult.success ? 'SUCCESS' : 'ERROR',
      { order_id: order.order_id, target: 'LINE' }
    );
  }

  return { formattedSummary, telegram: telegramResult, line: lineResult };
}

// Lazy Gemini AI client
let aiClient: GoogleGenAI | null = null;
let currentApiKey = '';

function getGemini(): GoogleGenAI {
  const apiKey = db.settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('AI_NOT_CONFIGURED');
  
  if (!aiClient || currentApiKey !== apiKey) {
    currentApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// ---------------------------------------------------------------------------
// Central Gemini model resolution. Google periodically deprecates model IDs
// (e.g. `gemini-2.5-flash` now returns NOT_FOUND for new API keys and Google
// recommends `gemini-3.6-flash`). The /api/settings/gemini validator probes
// GEMINI_MODEL_CANDIDATES newest-first and stores the first working model in
// db.settings.geminiModel; resolveAiModel() routes every AI call through it so
// a deprecated per-page model selection can never break chat replies.
// ---------------------------------------------------------------------------
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_MODEL_CANDIDATES = ['gemini-3.6-flash', 'gemini-3.7-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite',
  'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'
]);

function resolveAiModel(preferred?: string): string {
  // Local AI models (ollama:*/lmstudio:*) run in the user's browser and are
  // unreachable from this cloud server — always fall back to Gemini here.
  if (preferred && (preferred.startsWith('ollama:') || preferred.startsWith('lmstudio:'))) {
    return db.settings.geminiModel || DEFAULT_GEMINI_MODEL;
  }
  if (preferred && !DEPRECATED_GEMINI_MODELS.has(preferred)) return preferred;
  return db.settings.geminiModel || DEFAULT_GEMINI_MODEL;
}

// ---------------------------------------------------------------------------
// Multi-provider AI gateway. The chat brain can run on any of these providers
// — selection, keys and per-provider model are all stored in the settings
// table (see POST /api/settings/ai). Every non-Gemini provider speaks the
// OpenAI chat-completions dialect, so one caller covers them all.
// ---------------------------------------------------------------------------
type AiProvider = 'GEMINI' | 'OPENAI' | 'QWEN' | 'ZAI' | 'LMSTUDIO';

interface ProviderInfo {
  label: string;
  baseUrl: string;        // OpenAI-compatible base URL ('' = native client)
  needsKey: boolean;
  keySetting: string;     // db.settings field holding the API key
  modelSetting: string;   // db.settings field holding the selected model
  defaultModel: string;   // used when the user has not picked one
  fastModel: string;      // quick-retry model on primary failure
  setupHint: string;
}

const AI_PROVIDERS: Record<AiProvider, ProviderInfo> = {
  GEMINI: {
    label: 'Google Gemini',
    baseUrl: '',
    needsKey: true,
    keySetting: 'geminiApiKey',
    modelSetting: 'geminiModel',
    defaultModel: DEFAULT_GEMINI_MODEL,
    fastModel: 'gemini-2.5-flash-lite',
    setupHint: 'สร้างคีย์ฟรีได้ที่ aistudio.google.com/apikey'
  },
  OPENAI: {
    label: 'OpenAI (ChatGPT)',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    keySetting: 'openaiApiKey',
    modelSetting: 'openaiModel',
    defaultModel: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
    setupHint: 'สร้างคีย์ได้ที่ platform.openai.com/api-keys'
  },
  QWEN: {
    label: 'Alibaba Qwen (DashScope)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    needsKey: true,
    keySetting: 'qwenApiKey',
    modelSetting: 'qwenModel',
    defaultModel: 'qwen-plus',
    fastModel: 'qwen-turbo',
    setupHint: 'สร้างคีย์ได้ที่ dashscope.console.aliyun.com (ใช้ Region International)'
  },
  ZAI: {
    label: 'Z.AI / Zhipu (GLM)',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    needsKey: true,
    keySetting: 'zaiApiKey',
    modelSetting: 'zaiModel',
    defaultModel: 'glm-4-flash',
    fastModel: 'glm-4-flash',
    setupHint: 'สร้างคีย์ได้ที่ z.ai/manage-apikey/apikey-list (glm-4-flash ฟรี)'
  },
  LMSTUDIO: {
    label: 'LM Studio (AI ในเครื่อง)',
    baseUrl: '',
    needsKey: false,
    keySetting: '',
    modelSetting: 'lmStudioModel',
    defaultModel: '',
    fastModel: '',
    setupHint: 'เปิด LM Studio → Developer → Start Server (พอร์ต 1234) แล้วกดโหลดรายชื่อโมเดล'
  }
};

function getCurrentProvider(): AiProvider {
  const p = String(db.settings.aiProvider || 'GEMINI').toUpperCase() as AiProvider;
  return AI_PROVIDERS[p] ? p : 'GEMINI';
}

function getProviderApiKey(provider: AiProvider): string {
  if (provider === 'GEMINI') return db.settings.geminiApiKey || process.env.GEMINI_API_KEY || '';
  if (provider === 'LMSTUDIO') return '';
  const key = (db.settings as any)[AI_PROVIDERS[provider].keySetting] || '';
  // Env fallbacks so a key can be configured without touching the UI
  if (!key && provider === 'OPENAI') return process.env.OPENAI_API_KEY || '';
  if (!key && provider === 'QWEN') return process.env.QWEN_API_KEY || '';
  if (!key && provider === 'ZAI') return process.env.ZAI_API_KEY || '';
  return key;
}

function getProviderModel(provider: AiProvider): string {
  const info = AI_PROVIDERS[provider];
  const chosen = String((db.settings as any)[info.modelSetting] || '').trim();
  return chosen || info.defaultModel;
}

function getLmStudioBaseUrl(): string {
  let base = String(db.settings.lmStudioBaseUrl || process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234').replace(/\/+$/, '');
  // Normalize: LM Studio serves the OpenAI dialect under /v1 — users often
  // paste just http://localhost:1234, so append the version path if missing.
  if (!/\/v\d+$/.test(base)) base += '/v1';
  return base;
}

/** True when the currently selected provider has everything it needs to run. */
function isAiConfigured(): boolean {
  const provider = getCurrentProvider();
  if (provider === 'LMSTUDIO') return Boolean(getProviderModel('LMSTUDIO')); // model picked via the real /models list
  return Boolean(getProviderApiKey(provider));
}

function providerBaseUrl(provider: AiProvider): string {
  if (provider === 'LMSTUDIO') return getLmStudioBaseUrl();
  return AI_PROVIDERS[provider].baseUrl;
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = data?.error?.message || data?.message || `HTTP ${res.status}`;
      throw Object.assign(new Error(detail), { status: res.status });
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One AI call on the OpenAI-compatible chat-completions dialect.
 * Returns the raw assistant text. Throws with a Thai-friendly message.
 */
async function callOpenAiCompatible(provider: AiProvider, prompt: string, model: string, maxTokens: number, temperature: number, jsonMode: boolean): Promise<string> {
  const info = AI_PROVIDERS[provider];
  const apiKey = getProviderApiKey(provider);
  if (info.needsKey && !apiKey) throw Object.assign(new Error(`${info.label}: ยังไม่ได้ตั้งค่า API Key`), { status: 401 });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body: Record<string, any> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const data = await fetchJsonWithTimeout(`${providerBaseUrl(provider)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  }, AI_TIMEOUT_MS);

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error(`${info.label}: ไม่ได้รับข้อความตอบกลับจากโมเดล`);
  return text;
}

/** Strip markdown fences / leading junk before JSON.parse. */
function parseLooseJson(raw: string): any {
  const trimmed = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(trimmed.slice(first, last + 1));
    throw new Error('โมเดลตอบกลับมาไม่ใช่ JSON ที่อ่านได้');
  }
}

/**
 * Provider-aware AI call returning parsed JSON + metadata.
 * GEMINI uses the native SDK with a strict response schema and a fast-retry
 * on the lite model; every other provider uses the OpenAI-compatible caller.
 */
async function generateAiJson(prompt: string, options: { temperature?: number; maxOutputTokens?: number; extraInstruction?: string } = {}): Promise<{ parsed: any; model: string; latencyMs: number }> {
  const provider = getCurrentProvider();
  const temperature = options.temperature ?? 0.9;
  const maxOutputTokens = options.maxOutputTokens ?? 500;
  const fullPrompt = options.extraInstruction ? `${prompt}\n\n${options.extraInstruction}` : prompt;
  const started = Date.now();

  if (provider === 'GEMINI') {
    const model = getProviderModel('GEMINI');
    const response = await generateWithFastRetry(getGemini(), model, {
      contents: fullPrompt,
      config: {
        responseMimeType: 'application/json',
        temperature,
        maxOutputTokens,
        responseSchema: AI_REPLY_SCHEMA
      }
    }, AI_TIMEOUT_MS, AI_FAST_RETRY_MS);
    return { parsed: JSON.parse(response.text?.trim() || '{}'), model, latencyMs: Date.now() - started };
  }

  const info = AI_PROVIDERS[provider];
  const model = getProviderModel(provider);
  const jsonInstruction = `${options.extraInstruction ? options.extraInstruction + '\n\n' : ''}ตอบกลับเป็น JSON เท่านั้น รูปแบบ: {"intent": "GREETING|QUESTION|PRICE|PROMOTION|SHIPPING|TRUST|NEGOTIATION|ORDER", "replyText": "...", "sequenceStep": 1-6, "isOrderDetected": true/false, "orderData": {"customer_name": "", "phone_number": "", "address": "", "quantity": 0, "unit_price": 0, "total_amount": 0}}`;

  const raw = await callOpenAiCompatible(provider, fullPrompt, model, maxOutputTokens, temperature, true)
    .catch(async (primaryErr: any) => {
      // One quick retry on the provider's fast model before giving up.
      const fast = info.fastModel && info.fastModel !== model ? info.fastModel : model;
      try {
        return await callOpenAiCompatible(provider, fullPrompt, fast, maxOutputTokens, temperature, false);
      } catch {
        throw primaryErr;
      }
    });

  return { parsed: parseLooseJson(raw), model, latencyMs: Date.now() - started };
}

// Shared Gemini response schema for the chat-brain reply (kept in one place so
// the Gemini path and the OpenAI-compatible JSON instruction stay in sync).
const AI_REPLY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: 'GREETING, QUESTION, PRICE, PROMOTION, SHIPPING, TRUST, NEGOTIATION หรือ ORDER'
    },
    replyText: {
      type: Type.STRING,
      description: 'ข้อความตอบกลับลูกค้า สั้นกระชับ สุภาพ เหมือนแอดมินคนจริง'
    },
    sequenceStep: {
      type: Type.NUMBER,
      description: 'ขั้นตอน Sales Sequence 1-6'
    },
    isOrderDetected: {
      type: Type.BOOLEAN,
      description: 'ตรวจพบเจตนาสั่งซื้อและข้อมูลที่อยู่/เบอร์โทรหรือไม่'
    },
    orderData: {
      type: Type.OBJECT,
      properties: {
        customer_name: { type: Type.STRING },
        phone_number: { type: Type.STRING },
        address: { type: Type.STRING },
        product_id: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unit_price: { type: Type.NUMBER },
        total_amount: { type: Type.NUMBER }
      }
    }
  },
  required: ['intent', 'replyText', 'isOrderDetected']
};

const app = express();
// Render (and most PaaS) injects a dynamic PORT env var; fall back to 3000 for local dev.
const PORT = Number(process.env.PORT) || 3000;

// JSON Body Parser with raw body capture for webhook signature verification
app.use(express.json({ limit: '25mb', verify: (req: any, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

async function startServer() {

  // Load the persisted store (PostgreSQL) before accepting any traffic.
  await loadPersistedData();

  // CORS middleware for iframe & cross-origin safety
  app.use((req, res, next) => {
    const allowedOrigin = process.env.APP_URL || req.headers.origin || '';
    if (req.headers.origin && process.env.APP_URL && req.headers.origin !== process.env.APP_URL) {
      return res.status(403).json({ error: 'ORIGIN_NOT_ALLOWED' });
    }
    if (allowedOrigin) res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // ================================================================
  // AUTHENTICATION & SECURITY ENDPOINTS
  // ================================================================

  // Login endpoint
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password, security_code } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || '';

    if (!username || !password || !security_code) {
      return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบทุกช่อง' });
    }

    const result = auth.authenticateUser(username, password, security_code, ip, userAgent);

    if (result.success) {
      addLog('INFO', 'AUTH', 'SYSTEM', `🔐 เข้าสู่ระบบสำเร็จ: ${username} จาก IP ${ip} (${result.session?.device_info})`, 'SUCCESS');
      res.json({
        success: true,
        token: result.token,
        session_id: result.session?.session_id,
        user: {
          id: result.session?.user_id,
          username: result.session?.username,
          role: result.session?.role
        },
        message: 'เข้าสู่ระบบสำเร็จ'
      });
    } else {
      addLog('INFO', 'AUTH', 'SYSTEM', `❌ เข้าสู่ระบบล้มเหลวจาก IP ${ip}: ${result.error}`, 'WARNING');
      res.status(401).json({ success: false, error: result.error });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) {
      auth.endSession(sessionId);
      addLog('INFO', 'AUTH', 'SYSTEM', `🚪 ออกจากระบบ: session ${sessionId.slice(0, 8)}...`, 'INFO');
    }
    res.json({ success: true, message: 'ออกจากระบบเรียบร้อย' });
  });

  // Validate session
  app.get('/api/auth/validate', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) return res.status(401).json({ valid: false, error: 'No session' });

    const session = auth.validateSession(sessionId);
    if (!session) return res.status(401).json({ valid: false, error: 'Session expired' });

    res.json({
      valid: true,
      session: {
        session_id: session.session_id,
        user_id: session.user_id,
        username: session.username,
        role: session.role,
        login_at: session.login_at,
        last_activity: session.last_activity
      }
    });
  });

  // ================================================================
  // ADMIN PANEL - Session Management & User Control
  // ================================================================

  // Get all active sessions
  app.get('/api/admin/sessions', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const sessions = auth.getAllSessions();
    res.json({
      success: true,
      sessions: sessions.map(s => ({
        session_id: s.session_id,
        username: s.username,
        role: s.role,
        ip_address: s.ip_address,
        device_info: s.device_info,
        location: s.location,
        login_at: s.login_at,
        last_activity: s.last_activity,
        is_active: s.is_active
      })),
      total_active: sessions.length
    });
  });

  // Kick a session
  app.post('/api/admin/kick-session', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { target_session_id } = req.body;
    if (!target_session_id) return res.status(400).json({ error: 'target_session_id required' });

    const kicked = auth.kickSession(target_session_id);
    if (kicked) {
      addLog('INFO', 'ADMIN', 'SYSTEM', `🦵 Kick session ${target_session_id.slice(0, 8)}... โดย ${session.username}`, 'WARNING');
    }
    res.json({ success: kicked, message: kicked ? 'เตะผู้ใช้ ออกจากระบบแล้ว' : 'ไม่พบ session' });
  });

  // Block an IP
  app.post('/api/admin/block-ip', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { ip, reason, duration_hours } = req.body;
    if (!ip) return res.status(400).json({ error: 'ip required' });

    auth.blockIP(ip, reason || 'Blocked by admin', duration_hours);
    addLog('INFO', 'ADMIN', 'SYSTEM', `🚫 Block IP ${ip}: ${reason || 'No reason'} โดย ${session.username}`, 'WARNING');
    res.json({ success: true, message: `บล็อก IP ${ip} แล้ว` });
  });

  // Unblock an IP
  app.post('/api/admin/unblock-ip', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { ip } = req.body;
    auth.unblockIP(ip);
    addLog('INFO', 'ADMIN', 'SYSTEM', `✅ Unblock IP ${ip} โดย ${session.username}`, 'SUCCESS');
    res.json({ success: true, message: `ปลดบล็อก IP ${ip} แล้ว` });
  });

  // Get blocked IPs
  app.get('/api/admin/blocked-ips', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({ success: true, blocked_ips: auth.getBlockedIPs() });
  });

  // Admin: View all user data (pages, customers, messages)
  app.get('/api/admin/user-data/:userId', (req: Request, res: Response) => {
    const sessionId = req.headers['x-session-id'] as string;
    const session = auth.validateSession(sessionId);
    if (!session || session.role !== 'superadmin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId } = req.params;
    // Get all data related to this user
    const userPages = db.pages.filter(p => (p as any).owner_id === userId || p.page_id === userId);
    const userCustomers = db.customers.filter(c => (c as any).owner_id === userId);
    const userOrders = db.orders.filter(o => (o as any).owner_id === userId || userPages.some(p => p.page_id === o.page_id));
    const userLogs = db.logs.filter(l => l.sender_id === userId || l.page_id === userId);

    res.json({
      success: true,
      user_id: userId,
      pages: userPages.length,
      customers: userCustomers.length,
      orders: userOrders.length,
      logs: userLogs.length,
      data: {
        pages: userPages.map(p => ({ page_id: p.page_id, page_name: p.page_name, is_active: p.is_active })),
        recent_orders: userOrders.slice(0, 20),
        recent_customers: userCustomers.slice(0, 20)
      }
    });
  });

  // Session count for UI
  app.get('/api/auth/session-count', (req: Request, res: Response) => {
    res.json({ count: auth.getSessionCount() });
  });

  // ================================================================
  // AUTOMATIC BACKUP SYSTEM
  // ================================================================
  const BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
  const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

  function createBackup(): string | null {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

      const backupData = {
        version: '3.0.0',
        created_at: new Date().toISOString(),
        counts: {
          pages: db.pages.length,
          customers: db.customers.length,
          orders: db.orders.length,
          amulet: db.amulet.length,
          china: db.china.length,
          otop: db.otop.length,
          agriculture: db.agriculture.length
        },
        data: {
          pages: db.pages.map(p => ({ ...p, page_access_token: maskToken(p.page_access_token) })),
          customers: db.customers,
          orders: db.orders,
          amulet: db.amulet,
          china: db.china,
          otop: db.otop,
          agriculture: db.agriculture,
          settings: { ...db.settings, geminiApiKey: encryptStoredSecret(db.settings.geminiApiKey) }
        }
      };

      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

      // Keep only last 20 backups
      const backups = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_')).sort().reverse();
      for (const old of backups.slice(20)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old));
      }

      addLog('INFO', 'BACKUP', 'SYSTEM', `💾 สร้าง Backup สำเร็จ: ${backupFile}`, 'SUCCESS');
      return backupFile;
    } catch (err) {
      console.error('[Backup] Failed:', err);
      return null;
    }
  }

  // Auto backup every 6 hours
  if (process.env.VERCEL !== '1') {
    setInterval(() => {
      createBackup();
    }, BACKUP_INTERVAL_MS);

    // Initial backup on startup (after 30 seconds)
    setTimeout(() => createBackup(), 30000);
  }

  // Manual backup endpoint
  app.post('/api/backup/create', (req: Request, res: Response) => {
    const file = createBackup();
    if (file) {
      res.json({ success: true, file, message: 'สร้าง Backup สำเร็จ' });
    } else {
      res.status(500).json({ success: false, error: 'สร้าง Backup ไม่สำเร็จ' });
    }
  });

  // List backups
  app.get('/api/backup/list', (req: Request, res: Response) => {
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .map(f => ({
          filename: f,
          size: fs.statSync(path.join(BACKUP_DIR, f)).size,
          created_at: fs.statSync(path.join(BACKUP_DIR, f)).mtime.toISOString()
        }));
      res.json({ success: true, backups });
    } catch {
      res.json({ success: true, backups: [] });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      connected_pages: db.pages.filter(p => p.is_active).length,
      total_products: db.amulet.length + db.china.length + db.otop.length + db.agriculture.length,
      total_orders: db.orders.length,
      total_customers: db.customers.length,
      active_emergencies: db.emergencyAlerts.filter(e => !e.is_resolved).length,
      ai_configured: isAiConfigured()
    });
  });

  app.get('/api/system/readiness', (req: Request, res: Response) => {
    const hasAi = isAiConfigured();
    const hasMetaCredentials = Boolean(process.env.META_APP_ID || process.env.FACEBOOK_APP_ID) && Boolean(process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET);
    const pages = db.pages.map(page => {
      const token = decryptToken(page.page_access_token || '');
      const catalog = page.category === 'AMULET' ? db.amulet : page.category === 'CHINA' ? db.china : page.category === 'OTOP' ? db.otop : db.agriculture;
      const productConfigured = Boolean(page.product?.product_name && (catalog as any[]).some(product => product.page_id === page.page_id));
      return {
        page_id: page.page_id, page_name: page.page_name, active: page.is_active && page.auto_reply,
        token_configured: Boolean(token && token.startsWith('EAA')),
        product_configured: productConfigured,
        ready: Boolean(hasAi && hasMetaCredentials && page.is_active && page.auto_reply && token?.startsWith('EAA') && productConfigured)
      };
    });
    const issues = [
      !hasAi && 'ยังไม่ได้ตั้งค่า AI Provider (Gemini/OpenAI/Qwen/Z.AI/LM Studio)',
      !hasMetaCredentials && 'ยังไม่ได้ตั้งค่า Meta App ID/Secret บนเซิร์ฟเวอร์',
      !STORE_SECRET && 'ยังไม่ได้ตั้งค่า ENCRYPTION_SECRET_KEY สำหรับเก็บ token และ API key อย่างปลอดภัย',
      ...pages.filter(page => !page.ready).map(page => `เพจ ${page.page_name} ยังไม่พร้อมรับ-ส่งข้อความจริง`)
    ].filter(Boolean);
    res.json({ ready: issues.length === 0, ai_configured: hasAi, meta_configured: hasMetaCredentials, encrypted_storage_configured: Boolean(STORE_SECRET), pages, issues });
  });

  // Settings endpoints
  app.get('/api/settings', (req: Request, res: Response) => {
    // Only return true/false if key exists to prevent exposing the key
    res.json({
      geminiApiKeyConfigured: !!(db.settings.geminiApiKey || process.env.GEMINI_API_KEY),
      geminiApiKeyUpdatedAt: db.settings.geminiApiKeyUpdatedAt || null,
      geminiModel: db.settings.geminiModel || DEFAULT_GEMINI_MODEL,
      aiProvider: getCurrentProvider(),
      aiSettingsUpdatedAt: db.settings.aiSettingsUpdatedAt || null,
      openaiApiKeyConfigured: Boolean(getProviderApiKey('OPENAI')),
      qwenApiKeyConfigured: Boolean(getProviderApiKey('QWEN')),
      zaiApiKeyConfigured: Boolean(getProviderApiKey('ZAI')),
      lmStudioBaseUrl: getLmStudioBaseUrl(),
      lmStudioModel: db.settings.lmStudioModel || '',
      openaiModel: db.settings.openaiModel || AI_PROVIDERS.OPENAI.defaultModel,
      qwenModel: db.settings.qwenModel || AI_PROVIDERS.QWEN.defaultModel,
      zaiModel: db.settings.zaiModel || AI_PROVIDERS.ZAI.defaultModel
    });
  });

  app.post('/api/settings/gemini', async (req: Request, res: Response) => {
    const { apiKey } = req.body;
    if (!(typeof apiKey === 'string' && apiKey.trim().length >= 10)) {
      return res.status(400).json({ success: false, message: 'Invalid API Key.' });
    }
    try {
      const validator = new GoogleGenAI({ apiKey: apiKey.trim() });
      // Google deprecates model IDs over time (gemini-2.5-flash now returns
      // NOT_FOUND for new keys). Probe candidates newest-first and remember
      // the first model that actually works for this key.
      const candidates = Array.from(new Set([db.settings.geminiModel, ...GEMINI_MODEL_CANDIDATES].filter(Boolean))) as string[];
      let workingModel = '';
      let quotaLimited = false;
      let lastError: any = null;
      for (const model of candidates) {
        try {
          await validator.models.generateContent({ model, contents: 'Reply only: OK', config: { maxOutputTokens: 2 } });
          workingModel = model;
          break;
        } catch (probeErr: any) {
          lastError = probeErr;
          const msg = String(probeErr?.message || '');
          const status = Number(probeErr?.status || probeErr?.code || 0);
          if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || status === 401 || status === 403) {
            return res.status(400).json({ success: false, message: 'API Key ไม่ถูกต้องหรือถูกปิดใช้งาน โปรดคัดลอกคีย์ใหม่จาก Google AI Studio แล้วลองอีกครั้ง' });
          }
          if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
            // Key is valid but temporarily rate/quota limited — accept it.
            workingModel = model;
            quotaLimited = true;
            break;
          }
          // NOT_FOUND (deprecated model) or other model error → try next candidate
        }
      }
      if (!workingModel) {
        return res.status(400).json({ success: false, message: `ไม่สามารถยืนยัน Gemini API key ได้: ${lastError?.message || 'โปรดตรวจสอบคีย์และโควต้าการใช้งาน'}` });
      }
      db.settings.geminiApiKey = apiKey.trim();
      db.settings.geminiModel = workingModel;
      db.settings.geminiApiKeyUpdatedAt = new Date().toISOString();
      persistData();
      res.json({
        success: true,
        model: workingModel,
        message: quotaLimited
          ? `คีย์ถูกต้องและบันทึกแล้ว (ขณะนี้โควต้าถูกจำกัดชั่วคราว) ระบบจะใช้โมเดล ${workingModel}`
          : `ยืนยันและบันทึก API Key สำเร็จ ระบบจะใช้โมเดล ${workingModel}`
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: `ไม่สามารถยืนยัน Gemini API key ได้: ${error.message || 'โปรดตรวจสอบคีย์และโควต้าการใช้งาน'}` });
    }
  });

  // ================================================================
  // PAGE TOGGLE (เปิด/ปิดเพจ และ เปิด/ปิด AI ตอบแชท ต่อเพจ)
  // ================================================================
  app.post('/api/pages/toggle', (req: Request, res: Response) => {
    const { page_id, field, value } = req.body || {};
    const allowed = ['is_active', 'auto_reply'];
    if (!page_id || !allowed.includes(field) || typeof value !== 'boolean') {
      return res.status(400).json({ success: false, message: 'ต้องระบุ page_id, field (is_active|auto_reply) และ value เป็น boolean' });
    }
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });
    (page as any)[field] = value;
    dbService.updatePageField(page_id, field, value ? 1 : 0).catch(() => {});
    persistData();
    dbBridge.broadcastSSE('page_toggled', { page_id, field, value }, page_id);
    const label = field === 'is_active'
      ? (value ? 'เปิดใช้งานเพจแล้ว — บอทพร้อมตอบแชท' : 'ปิดใช้งานเพจแล้ว — บอทจะไม่ตอบแชทเพจนี้')
      : (value ? 'เปิด AI ตอบอัตโนมัติแล้ว' : 'ปิด AI ตอบอัตโนมัติแล้ว — แอดมินตอบเองทั้งหมด');
    addLog('INFO', 'PAGE_TOGGLE', page_id, `${value ? 'ON' : 'OFF'} ${label}`, value ? 'SUCCESS' : 'WARNING');
    res.json({ success: true, page_id, field, value, message: label });
  });

  // ================================================================
  // META BUSINESS SUITE-STYLE INBOX (local Postgres + Graph API merge)
  // ================================================================

  // Conversation list with unread/starred/blocked state
  app.get('/api/inbox/conversations', async (req: Request, res: Response) => {
    const page_id = req.query.page_id as string;
    if (!page_id) return res.status(400).json({ success: false, message: 'ต้องระบุ page_id' });
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });

    // Local: aggregate chat_history per sender
    const msgs = await dbService.executeRaw(
      'SELECT sender_id, text, role, created_at FROM chat_history WHERE page_id = ? ORDER BY created_at DESC LIMIT 500',
      [page_id]
    );
    const states = await dbService.listConversationStates(page_id);
    const stateMap = new Map(states.map((s: any) => [s.sender_id, s]));
    const bySender = new Map<string, any>();
    for (const m of msgs) {
      if (!bySender.has(m.sender_id)) {
        bySender.set(m.sender_id, { sender_id: m.sender_id, last_text: m.text, last_at: m.created_at, last_role: m.role });
      }
    }
    const conversations: any[] = [...bySender.values()].map(c => {
      const st: any = stateMap.get(c.sender_id) || {};
      return {
        thread_id: c.sender_id,
        participant: { id: c.sender_id, name: st.participant_name || ('ลูกค้า ' + String(c.sender_id).slice(-4)) },
        updated_time: c.last_at,
        preview: c.last_text,
        last_role: c.last_role,
        unread: Boolean(st.is_unread),
        unread_count: Number(st.unread_count) || (st.is_unread ? 1 : 0),
        starred: Boolean(st.is_starred),
        blocked: Boolean(st.is_blocked),
        source: 'local'
      };
    });

    // Graph augment (best-effort): real customer names + threads that never hit our webhook
    const rawToken = decryptToken(page.page_access_token || '');
    if (rawToken?.startsWith('EAA')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/conversations?platform=messenger&fields=participants,updated_time,snippet,messages.limit(1){message}&limit=25&access_token=${encodeURIComponent(rawToken)}`;
        const g = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        const gd: any = await g.json();
        if (!gd.error) {
          for (const convo of (gd.data || [])) {
            const other = convo.participants?.data?.find((p: any) => p.id !== page_id);
            if (!other) continue;
            const graphPreview = convo.snippet || convo.messages?.data?.[0]?.message || '';
            const existing = conversations.find(c => c.thread_id === other.id);
            if (existing) {
              if (other.name) existing.participant.name = other.name;
              if (new Date(convo.updated_time) > new Date(existing.updated_time)) {
                existing.updated_time = convo.updated_time;
                existing.preview = graphPreview || existing.preview;
              }
              existing.graph_thread_id = convo.id;
            } else {
              const st: any = stateMap.get(other.id) || {};
              conversations.push({
                thread_id: other.id,
                participant: { id: other.id, name: other.name || ('ลูกค้า ' + String(other.id).slice(-4)) },
                updated_time: convo.updated_time,
                preview: graphPreview,
                last_role: 'customer',
                unread: Boolean(st.is_unread),
                unread_count: Number(st.unread_count) || 0,
                starred: Boolean(st.is_starred),
                blocked: Boolean(st.is_blocked),
                source: 'graph'
              });
            }
          }
        }
      } catch { /* Graph unreachable/slow -> local-only list is fine */ }
    }

    // Blocked conversations sink to the bottom, newest first otherwise
    conversations.sort((a, b) =>
      (a.blocked ? 1 : 0) - (b.blocked ? 1 : 0) ||
      new Date(b.updated_time).getTime() - new Date(a.updated_time).getTime()
    );
    res.json({
      success: true,
      conversations,
      page_id,
      page_name: page.page_name,
      auto_reply: Boolean(page.auto_reply),
      is_active: Boolean(page.is_active)
    });
  });

  // Messages of one conversation: Graph history when possible, local otherwise
  app.get('/api/inbox/messages', async (req: Request, res: Response) => {
    const page_id = req.query.page_id as string;
    const sender_id = req.query.sender_id as string;
    if (!page_id || !sender_id) return res.status(400).json({ success: false, message: 'ต้องระบุ page_id และ sender_id' });
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });

    const localRows = await dbService.getChatHistoryForInbox(page_id, sender_id, 50);
    const localMessages = localRows.map(m => ({
      id: 'local_' + m.id,
      from: { id: m.role === 'admin' ? page_id : sender_id, name: m.role === 'admin' ? page.page_name : undefined },
      message: m.text,
      created_time: m.created_at,
      is_from_page: m.role !== 'customer',
      attachments: [] as any[]
    }));

    // Best-effort Graph history (real Messenger thread, richer than local)
    let messages: any[] = localMessages;
    let source = 'local';
    const rawToken = decryptToken(page.page_access_token || '');
    if (rawToken?.startsWith('EAA')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/conversations?platform=messenger&user_id=${encodeURIComponent(sender_id)}&fields=messages.limit(50){id,from,message,created_time,attachments}&access_token=${encodeURIComponent(rawToken)}`;
        const g = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        const gd: any = await g.json();
        const convo = gd?.data?.[0];
        if (!gd.error && convo?.messages?.data) {
          messages = (convo.messages.data as any[]).map(m => ({
            id: m.id,
            from: m.from || { id: sender_id },
            message: m.message || '',
            created_time: m.created_time,
            is_from_page: m.from?.id === page_id,
            attachments: m.attachments?.data || []
          })).reverse();
          source = 'graph';
        }
      } catch { /* fall back to local history */ }
    }

    // Best-effort: mark seen on Messenger + clear local unread badge
    if (rawToken?.startsWith('EAA')) {
      fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(rawToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: sender_id }, sender_action: 'mark_seen' })
      }).catch(() => {});
    }
    await dbService.updateConversationState(page_id, sender_id, { is_unread: 0, unread_count: 0 }).catch(() => {});

    res.json({ success: true, messages, source, page_id, sender_id });
  });

  // Star / block / unread flags for one conversation
  app.post('/api/inbox/state', async (req: Request, res: Response) => {
    const { page_id, sender_id, is_starred, is_blocked, mark_read, mark_unread } = req.body || {};
    if (!page_id || !sender_id) return res.status(400).json({ success: false, message: 'ต้องระบุ page_id และ sender_id' });
    const patch: Record<string, any> = {};
    if (is_starred !== undefined) patch.is_starred = is_starred ? 1 : 0;
    if (is_blocked !== undefined) patch.is_blocked = is_blocked ? 1 : 0;
    if (mark_read) { patch.is_unread = 0; patch.unread_count = 0; }
    if (mark_unread) patch.is_unread = 1;
    await dbService.updateConversationState(page_id, sender_id, patch);
    dbBridge.broadcastSSE('inbox_state_changed', { page_id, sender_id }, page_id);
    res.json({ success: true, page_id, sender_id, ...patch });
  });

  // ================================================================
  // MULTI-PROVIDER AI SETTINGS (Gemini / OpenAI / Qwen / Z.AI / LM Studio)
  // ================================================================

  app.get('/api/ai/providers', (req: Request, res: Response) => {
    res.json({
      current: getCurrentProvider(),
      providers: (Object.keys(AI_PROVIDERS) as AiProvider[]).map(id => ({
        id,
        label: AI_PROVIDERS[id].label,
        needsKey: AI_PROVIDERS[id].needsKey,
        defaultModel: AI_PROVIDERS[id].defaultModel,
        configured: id === getCurrentProvider() ? isAiConfigured() : Boolean(getProviderApiKey(id)),
        model: getProviderModel(id),
        setupHint: AI_PROVIDERS[id].setupHint
      }))
    });
  });

  // List the REAL models a provider currently offers (LM Studio -> its local
  // server /v1/models; Gemini -> generativelanguage; others -> {base}/models)
  // so the UI never makes the user type a model id blind.
  app.get('/api/ai/models', async (req: Request, res: Response) => {
    const provider = String(req.query.provider || getCurrentProvider()).toUpperCase() as AiProvider;
    if (!AI_PROVIDERS[provider]) return res.status(400).json({ success: false, message: 'Provider ไม่ถูกต้อง' });
    try {
      let models: { id: string; label: string }[] = [];
      if (provider === 'GEMINI') {
        const key = getProviderApiKey('GEMINI');
        if (!key) return res.status(400).json({ success: false, message: 'กรุณาใส่ Gemini API Key ก่อน' });
        const data = await fetchJsonWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`, { method: 'GET' }, 10000);
        models = (data.models || [])
          .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map((m: any) => ({ id: String(m.name || '').replace(/^models\//, ''), label: m.displayName || String(m.name || '').replace(/^models\//, '') }));
      } else {
        const apiKey = getProviderApiKey(provider);
        const headers: Record<string, string> = {};
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const data = await fetchJsonWithTimeout(`${providerBaseUrl(provider)}/models`, { method: 'GET', headers }, 10000);
        models = (data.data || [])
          .filter((m: any) => m && m.id)
          .map((m: any) => ({ id: String(m.id), label: String(m.id) }));
      }
      res.json({ success: true, provider, models });
    } catch (err: any) {
      res.status(502).json({ success: false, message: `ดึงรายชื่อโมเดลไม่สำเร็จ: ${err.message}` });
    }
  });

  // Save + validate the active AI provider. Validation always performs a real
  // network probe (models list) so a broken key or unreachable LM Studio is
  // caught here, not when the first customer message arrives.
  app.post('/api/settings/ai', async (req: Request, res: Response) => {
    const { provider, apiKey, baseUrl, model } = req.body;
    const p = String(provider || '').toUpperCase() as AiProvider;
    if (!AI_PROVIDERS[p]) return res.status(400).json({ success: false, message: 'Provider ไม่ถูกต้อง' });
    const info = AI_PROVIDERS[p];

    // Stage the credentials before probing so validation uses the new values.
    if (p === 'GEMINI' && typeof apiKey === 'string' && apiKey.trim().length >= 10) {
      db.settings.geminiApiKey = apiKey.trim();
    }
    if (p !== 'GEMINI' && p !== 'LMSTUDIO' && typeof apiKey === 'string' && apiKey.trim()) {
      (db.settings as any)[info.keySetting] = apiKey.trim();
    }
    if (p === 'LMSTUDIO' && typeof baseUrl === 'string' && baseUrl.trim()) {
      db.settings.lmStudioBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    }

    try {
      // Real probe: fetch the provider's model list (validates key + reachability).
      const probeUrl = p === 'GEMINI'
        ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(getProviderApiKey('GEMINI'))}&pageSize=1`
        : `${providerBaseUrl(p)}/models`;
      const headers: Record<string, string> = {};
      if (p !== 'GEMINI' && info.needsKey) headers['Authorization'] = `Bearer ${getProviderApiKey(p)}`;
      await fetchJsonWithTimeout(probeUrl, { method: 'GET', headers }, 10000);

      if (typeof model === 'string' && model.trim()) {
        (db.settings as any)[info.modelSetting] = model.trim();
      }
      db.settings.aiProvider = p;
      db.settings.aiSettingsUpdatedAt = new Date().toISOString();
      persistData();
      res.json({
        success: true,
        provider: p,
        model: getProviderModel(p),
        message: `บันทึกสำเร็จ — ระบบจะใช้ ${info.label} โมเดล ${getProviderModel(p)} ตอบแชทลูกค้า`
      });
    } catch (err: any) {
      persistData();
      const hint = p === 'LMSTUDIO'
        ? `เชื่อมต่อ LM Studio ไม่ได้ (${getLmStudioBaseUrl()}) — เปิด LM Studio → Developer → Start Server แล้วลองอีกครั้ง`
        : `ยืนยันไม่สำเร็จ: ${err.message}`;
      res.status(400).json({ success: false, message: hint });
    }
  });

  // ================================================================
  // SELF-TEST SUITE (ปุ่ม 🧪 Test — ระบบทดสอบตัวเองทุกฟังก์ชัน)
  // ================================================================

  let lastSelfTestReport: SelfTestReport | null = null;
  let selfTestRunning = false;

  app.post('/api/selftest', async (req: Request, res: Response) => {
    if (selfTestRunning) return res.status(409).json({ success: false, message: 'การทดสอบกำลังรันอยู่ กรุณารอสักครู่' });
    selfTestRunning = true;
    try {
      const report = await runSelfTests({ baseUrl: `http://127.0.0.1:${PORT}`, db, persistData });
      lastSelfTestReport = report;
      res.json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, message: `รันการทดสอบไม่สำเร็จ: ${err.message}` });
    } finally {
      selfTestRunning = false;
    }
  });

  // Markdown รายงานล่าสุด สำหรับดาวน์โหลด/ดูย้อนหลัง
  app.get('/api/selftest/last-report', (req: Request, res: Response) => {
    if (!lastSelfTestReport) return res.status(404).json({ success: false, message: 'ยังไม่เคยรันการทดสอบ' });
    res.set('Content-Type', 'text/markdown; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="selftest-report.md"`);
    const lines: string[] = [];
    lines.push(`# รายงานผลการทดสอบระบบ`);
    lines.push(`- วันที่: ${lastSelfTestReport.startedAt}`);
    lines.push(`- ผลรวม: ผ่าน ${lastSelfTestReport.summary.pass} / เตือน ${lastSelfTestReport.summary.warn} / พัง ${lastSelfTestReport.summary.fail}`);
    for (const r of lastSelfTestReport.results) {
      lines.push(`- [${r.status}] ${r.group} / ${r.name}: ${r.detail}${r.error ? ` | error: ${r.error}` : ''}${r.fixHint ? ` | วิธีแก้: ${r.fixHint}` : ''}`);
    }
    res.send(lines.join('\n'));
  });

  // AES-256-GCM Token Encryption and Decryption Helpers
  const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET_KEY || process.env.FACEBOOK_APP_SECRET || 'fb_ai_sales_master_secret_key_32_bytes!';

  function getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
  }

  function encryptToken(token: string): string {
    if (!token || !token.trim()) return '';
    if (token.startsWith('enc:')) return token; // Already encrypted
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');
      return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (err) {
      console.error('Token encryption failed:', err);
      return token;
    }
  }

  function decryptToken(encryptedToken: string): string {
    if (!encryptedToken || !encryptedToken.trim()) return '';
    if (!encryptedToken.startsWith('enc:')) return encryptedToken; // Plain token
    try {
      const parts = encryptedToken.slice(4).split(':');
      if (parts.length !== 3) return encryptedToken;
      const [ivHex, authTagHex, encDataHex] = parts;
      const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
      let decrypted = decipher.update(encDataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('Token decryption failed:', err);
      return encryptedToken;
    }
  }

  function maskToken(token: string): string {
    if (!token) return '';
    const raw = decryptToken(token);
    if (raw.startsWith('EAA') && raw.length > 15) {
      return `${raw.substring(0, 7)}••••••••••••••••${raw.slice(-4)}`;
    }
    return '••••••••••••••••';
  }

  // Helper to send Facebook Messenger Private Message using Graph API
  async function sendFacebookMessage(accessToken: string, recipientId: string, text: string) {
    const rawToken = decryptToken(accessToken);
    if (!rawToken || !rawToken.startsWith('EAA')) {
      addLog('INFO', 'FACEBOOK_API', recipientId, '⛔ ไม่ส่งข้อความ: เพจยังไม่มี Page Access Token จริง', 'ERROR');
      return { success: false, simulated: true, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          // Messenger text limit is 2000 characters — truncate anything longer.
          message: { text: String(text || '').slice(0, 2000) }
        })
      });
      const data = await res.json();
      console.log('[FB Send] Graph API Response:', data);
      if (data.error) {
        addLog('INFO', 'FACEBOOK_API', recipientId, `❌ ส่ง Facebook Message ไม่สำเร็จ (${data.error.code}): ${data.error.message}`, 'ERROR', data.error);
        return { success: false, error: data.error };
      }
      addLog('INFO', 'FACEBOOK_API', recipientId, `✅ ส่งข้อความ Messenger ถึงผู้ใช้จริงสำเร็จ (Message ID: ${data.message_id || 'OK'})`, 'SUCCESS');
      return { success: true, messageId: data.message_id };
    } catch (err: any) {
      console.error('[FB Send] Error sending message via Graph API:', err);
      addLog('INFO', 'FACEBOOK_API', recipientId, `❌ Network Error ส่ง Facebook Message: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  async function sendFacebookImage(accessToken: string, recipientId: string, imageUrl: string) {
    const rawToken = decryptToken(accessToken);
    if (!rawToken?.startsWith('EAA') || !imageUrl) return { success: false, error: 'PAGE_ACCESS_TOKEN_OR_IMAGE_NOT_CONFIGURED' };
    try {
      const response = await fetch(`https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(rawToken)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } } })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error?.message || 'Send image failed');
      return { success: true, messageId: data.message_id };
    } catch (error: any) {
      addLog('INFO', 'FACEBOOK_API', recipientId, `❌ ส่งรูปประกอบไม่สำเร็จ: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  // Send Facebook Messenger message with Quick Reply buttons.
  // Limits enforced by the Send API: max 13 buttons per message, 20-char
  // titles, 1000-char payloads. Empty/broken entries are filtered out so a
  // single bad button can never fail the whole message.
  async function sendFacebookQuickReplies(accessToken: string, recipientId: string, text: string, quickReplies: { title: string; payload: string }[]) {
    const rawToken = decryptToken(accessToken);
    if (!rawToken || !rawToken.startsWith('EAA')) {
      return { success: false, simulated: true, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    }
    const validReplies = (quickReplies || [])
      .filter(qr => qr && typeof qr.title === 'string' && qr.title.trim())
      .map(qr => ({
        content_type: 'text',
        title: qr.title.trim().slice(0, 20),
        payload: String(qr.payload || qr.title).slice(0, 1000)
      }))
      .slice(0, 13);
    if (validReplies.length === 0) {
      return sendFacebookMessage(accessToken, recipientId, text);
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            text: String(text || '').slice(0, 2000),
            quick_replies: validReplies
          }
        })
      });
      const data = await res.json();
      if (data.error) {
        addLog('INFO', 'FACEBOOK_API', recipientId, `❌ ส่ง Quick Reply ไม่สำเร็จ (${data.error.code}): ${data.error.message}`, 'ERROR');
        return { success: false, error: data.error };
      }
      addLog('INFO', 'FACEBOOK_API', recipientId, `✅ ส่ง Quick Reply ${quickReplies.length} ปุ่ม สำเร็จ`, 'SUCCESS');
      return { success: true, messageId: data.message_id };
    } catch (err: any) {
      addLog('INFO', 'FACEBOOK_API', recipientId, `❌ Network Error ส่ง Quick Reply: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  async function sendConfiguredSequenceStep(page: PageConfig, recipientId: string, stepNumber: number) {
    const step = page.sales_sequence_steps?.find(item => item.step_number === stepNumber);
    if (!step) return { sent: false };
    if (step.type !== 'IMAGE' && step.text_content?.trim()) {
      await sendFacebookMessage(page.page_access_token || '', recipientId, step.text_content.trim());
    }
    if (step.type !== 'TEXT' && step.image_url?.trim()) {
      await sendFacebookImage(page.page_access_token || '', recipientId, step.image_url.trim());
    }
    return { sent: true };
  }

  // Helper to reply to a Facebook Comment using Graph API
  async function sendFacebookCommentReply(accessToken: string, commentId: string, text: string) {
    const rawToken = decryptToken(accessToken);
    if (!rawToken || !rawToken.startsWith('EAA')) {
      addLog('COMMENT', 'FACEBOOK_API', commentId, '⛔ ไม่ตอบคอมเมนต์: เพจยังไม่มี Page Access Token จริง', 'ERROR');
      return { success: false, simulated: true, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${commentId}/comments?access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text
        })
      });
      const data = await res.json();
      console.log('[FB Comment Send] Graph API Response:', data);
      if (data.error) {
        addLog('INFO', 'FACEBOOK_API', commentId, `❌ ตอบกลับคอมเมนต์ไม่สำเร็จ (${data.error.code}): ${data.error.message}`, 'ERROR', data.error);
        return { success: false, error: data.error };
      }
      addLog('INFO', 'FACEBOOK_API', commentId, `✅ ตอบกลับคอมเมนต์จริงสำเร็จ (ID: ${data.id || commentId})`, 'SUCCESS');
      return { success: true, id: data.id };
    } catch (err: any) {
      console.error('[FB Comment Send] Error replying to comment via Graph API:', err);
      addLog('INFO', 'FACEBOOK_API', commentId, `❌ Network Error ตอบกลับคอมเมนต์: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  // Helper to hide a toxic comment using Graph API
  async function hideFacebookComment(accessToken: string, commentId: string) {
    const rawToken = decryptToken(accessToken);
    if (!rawToken || !rawToken.startsWith('EAA')) {
      addLog('COMMENT_HIDDEN', 'FACEBOOK_API', commentId, '⛔ ไม่ซ่อนคอมเมนต์: เพจยังไม่มี Page Access Token จริง', 'ERROR');
      return { success: false, simulated: true, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${commentId}?access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_hidden: true
        })
      });
      const data = await res.json();
      console.log('[FB Comment Hide] Graph API Response:', data);
      if (data.error) {
        addLog('INFO', 'FACEBOOK_API', commentId, `❌ ซ่อนคอมเมนต์ไม่สำเร็จ (${data.error.code}): ${data.error.message}`, 'ERROR', data.error);
        return { success: false, error: data.error };
      }
      addLog('INFO', 'FACEBOOK_API', commentId, `🛡️ ซ่อนคอมเมนต์คำต้องห้ามสำเร็จบน Facebook จริง`, 'SUCCESS');
      return { success: true };
    } catch (err: any) {
      console.error('[FB Comment Hide] Error hiding comment via Graph API:', err);
      addLog('INFO', 'FACEBOOK_API', commentId, `❌ Network Error ซ่อนคอมเมนต์: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  async function sendTelegramNotification(page: PageConfig, text: string) {
    const token = decryptToken(page.telegram_bot_token || '');
    const chatId = page.telegram_chat_id || '';
    if (!token || !chatId) return { success: false, skipped: true, error: 'TELEGRAM_NOT_CONFIGURED' };
    try {
      const response = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.description || 'Telegram request failed');
      return { success: true };
    } catch (error: any) {
      addLog('INFO', 'TELEGRAM_BOT', page.page_id, `❌ ส่ง Telegram ไม่สำเร็จ: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  async function sendLineNotification(page: PageConfig, text: string) {
    const channelAccessToken = decryptToken(page.line_notify_token || '');
    const target = page.line_group_id || '';
    if (!channelAccessToken || !target) return { success: false, skipped: true, error: 'LINE_NOT_CONFIGURED' };
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${channelAccessToken}` },
        body: JSON.stringify({ to: target, messages: [{ type: 'text', text: text.slice(0, 5000) }] })
      });
      if (!response.ok) throw new Error(`LINE API HTTP ${response.status}`);
      return { success: true };
    } catch (error: any) {
      addLog('LINE_ALERT', 'LINE_BOT', page.page_id, `❌ ส่ง LINE ไม่สำเร็จ: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  deliverTelegram = sendTelegramNotification;
  deliverLine = sendLineNotification;

  // Connection Status API: Check if pages are connected (for UI status indicator)
  app.get('/api/facebook/connection-status', (req: Request, res: Response) => {
    const connectedPages = db.pages.filter(p => {
      const token = decryptToken(p.page_access_token || '');
      return token && token.startsWith('EAA');
    });
    res.json({
      connected: connectedPages.length > 0,
      count: connectedPages.length,
      pages: connectedPages.map(p => ({
        page_id: p.page_id,
        page_name: p.page_name,
        is_active: p.is_active,
        auto_reply: p.auto_reply,
        bot_stopped: p.bot_stopped || false
      }))
    });
  });

  // Bot Control API: Start/Stop bot for a page
  app.post('/api/facebook/bot-control', (req: Request, res: Response) => {
    const { page_id, action } = req.body || {};
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });
    }
    if (action === 'stop') {
      page.bot_stopped = true;
      addLog('INFO', 'BOT_CONTROL', page_id, `⏹️ บอทถูกหยุดโดยคำสั่ง /stop สำหรับเพจ ${page.page_name}`, 'WARNING');
    } else if (action === 'start') {
      page.bot_stopped = false;
      addLog('INFO', 'BOT_CONTROL', page_id, `▶️ บอทถูกเปิดใช้งานอีกครั้งสำหรับเพจ ${page.page_name}`, 'SUCCESS');
    }
    persistData();
    res.json({ success: true, bot_stopped: page.bot_stopped });
  });

  // Reply Delay Settings API: Get/Set per-page reply delay
  app.post('/api/facebook/reply-delay', (req: Request, res: Response) => {
    const { page_id, delay_ms } = req.body || {};
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });
    }
    const delay = Number(delay_ms);
    if (isNaN(delay) || delay < 0 || delay > 30000) {
      return res.status(400).json({ success: false, message: 'ค่า delay ต้องอยู่ระหว่าง 0-30000 มิลลิวินาที' });
    }
    page.reply_delay_ms = delay;
    persistData();
    addLog('INFO', 'SETTINGS', page_id, `⏱️ ตั้งเวลาตอบกลับเป็น ${delay}ms สำหรับเพจ ${page.page_name}`, 'SUCCESS');
    res.json({ success: true, reply_delay_ms: delay });
  });

  // Real Page Live Health & Connection Verification Endpoint (GET & POST /api/facebook/verify-page)
  app.all(['/api/facebook/verify-page', '/api/facebook/check-status'], async (req: Request, res: Response) => {
    const pageId = (req.query.page_id as string) || req.body?.page_id || (db.pages[0] ? db.pages[0].page_id : '');
    const page = db.pages.find(p => p.page_id === pageId) || db.pages[0];

    if (!page) {
      return res.status(404).json({
        success: false,
        status: 'PAGE_NOT_FOUND',
        message: 'ไม่พบข้อมูลเพจในระบบ'
      });
    }

    const rawToken = decryptToken(page.page_access_token);
    if (!rawToken || !rawToken.startsWith('EAA')) {
      return res.json({
        success: false,
        page_id: page.page_id,
        page_name: page.page_name,
        is_token_valid: false,
        is_webhook_subscribed: false,
        is_mock_token: true,
        status: 'MOCK_TOKEN',
        message: 'เพจนี้ใช้ Mock Token จำลอง — กรุณากด "เชื่อมต่อ Facebook" หรือระบุ Token จริงเพื่อใช้งานระบบถ่ายทอดข้อความสด',
        category: page.category,
        product: page.product?.product_name || 'สินค้าประจำเพจ'
      });
    }

    try {
      // 1. Verify Page & Access Token via Graph API
      const pageInfoUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(page.page_id)}?fields=id,name,is_published,category,followers_count,fan_count&access_token=${encodeURIComponent(rawToken)}`;
      const pageInfoRes = await fetch(pageInfoUrl);
      const pageInfoData = await pageInfoRes.json();

      if (pageInfoData.error) {
        const errCode = pageInfoData.error.code;
        const errMsg = pageInfoData.error.message;
        let diagnosticHelp = 'กรุณาตรวจสอบสิทธิ์ของเพจ';

        if (errCode === 190) {
          diagnosticHelp = 'Page Access Token หมดอายุหรือถูกยกเลิก กรุณาเชื่อมต่อ Facebook ใหม่อีกครั้ง';
        } else if (errCode === 200 || errCode === 210) {
          diagnosticHelp = 'บัญชี Facebook ขาดสิทธิ์การเข้าถึงเพจนี้ (ต้องการสิทธิ์ pages_messaging, pages_show_list)';
        }

        return res.json({
          success: false,
          page_id: page.page_id,
          page_name: page.page_name,
          is_token_valid: false,
          is_webhook_subscribed: false,
          error_code: errCode,
          error_message: errMsg,
          diagnostic_help: diagnosticHelp,
          status: 'TOKEN_INVALID',
          message: `ตรวจพบข้อผิดพลาดจาก Meta: ${errMsg}`
        });
      }

      // 2. Check and enforce Webhook Subscription status
      let isSubscribed = false;
      let subscribedFields: string[] = [];
      try {
        const subCheckUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(page.page_id)}/subscribed_apps?access_token=${encodeURIComponent(rawToken)}`;
        const subCheckRes = await fetch(subCheckUrl);
        const subCheckData = await subCheckRes.json();

        if (subCheckData.data && Array.isArray(subCheckData.data) && subCheckData.data.length > 0) {
          isSubscribed = true;
          subscribedFields = subCheckData.data[0]?.subscribed_fields || ['messages', 'messaging_postbacks', 'feed'];
        } else {
          // Auto subscribe now if not yet subscribed
          const autoSubUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(page.page_id)}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${encodeURIComponent(rawToken)}`;
          const subRes = await fetch(autoSubUrl, { method: 'POST' });
          const subData = await subRes.json();
          if (subData.success) {
            isSubscribed = true;
            subscribedFields = ['messages', 'messaging_postbacks', 'feed'];
          }
        }
      } catch (subErr) {
        console.warn('Webhook subscription check note:', subErr);
      }

      // Update page profile with latest real Facebook data
      if (pageInfoData.name) {
        page.page_name = pageInfoData.name;
      }
      if (pageInfoData.followers_count || pageInfoData.fan_count) {
        page.follower_count = pageInfoData.followers_count || pageInfoData.fan_count;
        page.likes_count = pageInfoData.fan_count || page.follower_count;
      }

      return res.json({
        success: true,
        page_id: page.page_id,
        page_name: page.page_name,
        is_token_valid: true,
        is_webhook_subscribed: isSubscribed,
        subscribed_fields: subscribedFields,
        followers_count: page.follower_count,
        status: isSubscribed ? 'CONNECTED_AND_ACTIVE' : 'CONNECTED_NO_WEBHOOK',
        message: isSubscribed
          ? `🟢 เชื่อมต่อเพจ "${page.page_name}" และ Webhook สมบูรณ์ 100% พร้อมรับ-ส่งข้อความ Messenger จริง`
          : `🟡 เชื่อมต่อเพจ "${page.page_name}" สำเร็จ แต่ยังไม่ได้ผูก Webhook Subscribed Apps`
      });

    } catch (err: any) {
      console.error('[FB Verify Page Error]:', err);
      return res.status(500).json({
        success: false,
        status: 'NETWORK_ERROR',
        error_message: err.message,
        message: `ไม่สามารถเชื่อมต่อไปยัง Meta Graph API ได้: ${err.message}`
      });
    }
  });

  // ==========================================
  // Facebook Meta OAuth & Webhook Endpoints
  // ==========================================

  // 1. Meta OAuth Connect Endpoint (GET /api/facebook/connect & /facebook/connect)
  const handleFacebookConnect = (req: Request, res: Response) => {
    try {
      const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) {
        return res.status(503).json({ error: 'META_APP_NOT_CONFIGURED', message: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า META_APP_ID และ META_APP_SECRET บนเซิร์ฟเวอร์' });
      }
      
      // Determine the base origin accurately
      let baseOrigin = (req.query.redirect_origin as string) || '';
      if (!baseOrigin) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
        baseOrigin = `${protocol}://${host}`;
      }
      baseOrigin = baseOrigin.replace(/\/$/, '');

      // Support explicit META_REDIRECT_URI / FACEBOOK_REDIRECT_URI or default to /api/facebook/callback
      const callbackUrl = process.env.META_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI || `${baseOrigin}/api/facebook/callback`;
      
      // Cryptographic CSRF state token with HMAC-SHA256 signature and expiration
      const nonce = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const sig = crypto.createHmac('sha256', ENCRYPTION_SECRET).update(`${baseOrigin}:${appId}:${nonce}:${timestamp}`).digest('hex');
      
      const stateObj = {
        origin: baseOrigin,
        callback_url: callbackUrl,
        app_id: appId,
        nonce,
        timestamp,
        sig
      };
      const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');
      
      // Default scopes are the minimal set that works for NEW Meta apps without
      // App Review: listing pages, reading engagement, sending messages, and
      // webhook subscription.
      //
      // NOTE: `pages_manage_posts` and `pages_manage_engagement` are ADVANCED
      // permissions that Meta rejects with "Invalid Scopes" until the app passes
      // App Review (Advanced Access). Comment replies need `pages_manage_engagement`.
      // Once approved, add it via the FB_OAUTH_SCOPES env var (no redeploy needed).
      const scopes = process.env.FB_OAUTH_SCOPES || [
        'pages_show_list',
        'pages_manage_metadata',
        'pages_read_engagement',
        'pages_messaging'
      ].join(',');

      const authUrl = `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`;

      console.log(`[FB OAuth Connect] Auth URL generated for App ${appId} with callback ${callbackUrl}`);
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `🚀 เริ่มต้นกระบวนการเชื่อมต่อ Facebook OAuth (App ID: ${appId}) Callback: ${callbackUrl}`, 'INFO');

      // If client requested JSON URL (for popup-based flow)
      if (req.query.json === '1' || req.headers.accept?.includes('application/json')) {
        return res.json({
          success: true,
          url: authUrl,
          app_id: appId,
          callback_url: callbackUrl
        });
      }

      res.redirect(authUrl);
    } catch (err: any) {
      console.error('[FB OAuth Connect Error]:', err);
      res.status(500).json({
        error: 'FACEBOOK_CONNECT_FAILED',
        message: `ไม่สามารถเริ่มต้นการเชื่อมต่อ Facebook ได้: ${err.message}`
      });
    }
  };

  app.get('/api/facebook/connect', handleFacebookConnect);
  app.get('/facebook/connect', handleFacebookConnect);

  // 2. Meta OAuth Callback Handler (GET /api/facebook/callback & /facebook/callback)
  const handleFacebookCallback = async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    // Helper to send popup communication HTML (Zero tokens exposed)
    const renderPopupResponse = (isSuccess: boolean, message: string, payloadData: any = {}) => {
      const safeOrigin = payloadData.origin || '*';
      return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Facebook Authorization Status</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; }
    .card { background: #1e293b; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); max-width: 440px; width: 90%; text-align: left; }
    .header { text-align: center; margin-bottom: 1.25rem; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #3b82f6; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .icon { font-size: 2.5rem; margin-bottom: 0.5rem; text-align: center; }
    .title { font-size: 1.15rem; font-weight: 700; margin-bottom: 0.5rem; text-align: center; }
    .msg { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem; text-align: center; }
    .btn { display: block; width: 100%; box-sizing: border-box; background: #2563eb; color: white; border: none; padding: 0.75rem; border-radius: 0.75rem; font-weight: 600; cursor: pointer; text-decoration: none; text-align: center; margin-top: 1rem; font-size: 0.875rem; }
    .btn:hover { background: #1d4ed8; }
    .diagnostic { background: #0f172a; padding: 0.75rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.75rem; color: #f87171; overflow-x: auto; word-break: break-all; margin-top: 0.75rem; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">${isSuccess ? '🎉' : '⚠️'}</div>
      <div class="title">${isSuccess ? 'เชื่อมต่อ Facebook สำเร็จ!' : 'การเชื่อมต่อไม่สำเร็จ'}</div>
      <div class="msg">${message}</div>
    </div>
    ${!isSuccess && payloadData.error ? `<div class="diagnostic">สาเหตุ: ${payloadData.error}</div>` : ''}
    <button class="btn" onclick="handleFinish()">กลับสู่ระบบจัดการเพจ</button>
  </div>
  <script>
    const isSuccess = ${JSON.stringify(isSuccess)};
    const payload = ${JSON.stringify({
      type: isSuccess ? 'FB_AUTH_SUCCESS' : 'FB_AUTH_ERROR',
      success: isSuccess,
      message,
      ...payloadData
    })};
    const targetOrigin = ${JSON.stringify(safeOrigin)};

    function notifyParent() {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(payload, targetOrigin);
          setTimeout(() => { window.close(); }, 1200);
        } catch (e) {
          console.warn('Could not postMessage to opener:', e);
        }
      }
    }

    function handleFinish() {
      if (window.opener && !window.opener.closed) {
        window.close();
      } else {
        window.location.href = (targetOrigin !== '*' ? targetOrigin : '/') + '?fb_connected=' + (isSuccess ? '1' : '0') + '&count=' + (payload.count || 0);
      }
    }

    notifyParent();
  </script>
</body>
</html>`);
    };

    // Default origin fallback from request headers
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    let origin = `${protocol}://${host}`.replace(/\/$/, '');

    // 1. Surface OAuth errors returned by Meta FIRST (e.g. domain not in App Domains, user cancelled)
    //    so the admin sees the real cause instead of a confusing CSRF message.
    if (error) {
      console.error('[FB OAuth Callback] Error returned by Facebook:', error, error_description);
      const errMsg = (error_description as string) || (error as string) || 'Facebook login was cancelled';
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `❌ การยืนยันตัวตน Facebook ล้มเหลว: ${errMsg}`, 'ERROR');
      return renderPopupResponse(false, errMsg, { origin, error: errMsg });
    }

    // 2. Strict CSRF State Validation
    if (!state || typeof state !== 'string') {
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', '❌ ปฏิเสธการเชื่อมต่อ: ตรวจพบคำขอที่ไม่ปลอดภัยหรือขาด CSRF State Parameter', 'ERROR');
      return renderPopupResponse(false, 'การยืนยันตัวตนล้มเหลว (CSRF State ไม่ถูกต้องหรือขาดหาย) — มักเกิดเมื่อ Meta ไม่ยอม redirect กลับ (เช่นโดเมนไม่อยู่ใน App Domain/Valid OAuth Redirect URIs)', { origin, error: 'missing_csrf_state' });
    }

    let stateData: { origin?: string; callback_url?: string; app_id?: string; nonce?: string; timestamp?: number; sig?: string } = {};
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch (parseErr) {
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', '❌ ปฏิเสธการเชื่อมต่อ: CSRF State Data ถูกดัดแปลงหรือไม่ถูกต้อง', 'ERROR');
      return renderPopupResponse(false, 'การยืนยันตัวตนล้มเหลว (State Format Invalid)', { origin, error: 'invalid_csrf_format' });
    }

    const { origin: stateOrigin, callback_url: stateCallbackUrl, app_id: stateAppId, nonce, timestamp, sig } = stateData;
    if (stateOrigin) {
      origin = stateOrigin.replace(/\/$/, '');
    }

    // Check expiration (TTL: 15 minutes)
    const MAX_STATE_AGE_MS = 15 * 60 * 1000;
    if (!timestamp || Date.now() - timestamp > MAX_STATE_AGE_MS) {
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', '❌ ปฏิเสธการเชื่อมต่อ: เซสชันยืนยันตัวตนหมดอายุ (กรุณากดเชื่อมต่อใหม่อีกครั้ง)', 'WARNING');
      return renderPopupResponse(false, 'เซสชันการเชื่อมต่อหมดอายุ (เกิน 15 นาที) กรุณากดเชื่อมต่อใหม่', { origin, error: 'state_expired' });
    }

    // Verify cryptographic HMAC signature
    const stateTargetAppId = stateAppId || process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
    const expectedSig = crypto.createHmac('sha256', ENCRYPTION_SECRET).update(`${origin}:${stateTargetAppId}:${nonce}:${timestamp}`).digest('hex');
    
    if (!sig || sig !== expectedSig) {
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', '🚨 ตรวจพบความพยายามโจมตี CSRF: ลายเซ็น State HMAC ไม่ตรงกับเซิร์ฟเวอร์', 'ERROR');
      return renderPopupResponse(false, 'การตรวจสอบความปลอดภัยล้มเหลว (CSRF Signature Mismatch)', { origin, error: 'csrf_verification_failed' });
    }

    // 2. Check for OAuth Error returned by Meta
    if (error) {
      console.error('[FB OAuth Callback] Error returned by Facebook:', error, error_description);
      const errMsg = (error_description as string) || (error as string) || 'Facebook login was cancelled';
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `❌ การยืนยันตัวตน Facebook ล้มเหลว: ${errMsg}`, 'ERROR');
      return renderPopupResponse(false, errMsg, { origin, error: errMsg });
    }

    if (!code) {
      return renderPopupResponse(false, 'ไม่พบ Authorization Code จาก Facebook', { origin, error: 'Missing authorization code' });
    }

    const appId = stateTargetAppId;
    const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
    const callbackUrl = stateCallbackUrl || process.env.META_REDIRECT_URI || process.env.FACEBOOK_REDIRECT_URI || `${origin}/api/facebook/callback`;

    try {
      // 3. Exchange authorization code for User Access Token
      const tokenExchangeUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code as string)}`;
      
      const tokenRes = await fetch(tokenExchangeUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        console.error('[FB OAuth Callback] Token exchange failed:', tokenData.error);
        const errMsg = tokenData.error.message || 'Token exchange failed';
        addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `❌ แลกเปลี่ยน Token ล้มเหลว: ${errMsg}`, 'ERROR');
        return renderPopupResponse(false, `Meta Token Error: ${errMsg}`, { origin, error: errMsg });
      }

      let userAccessToken = tokenData.access_token;

      // 4. Upgrade to long-lived User Access Token if appSecret is available
      if (appSecret && userAccessToken) {
        try {
          const longLivedUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(userAccessToken)}`;
          const longLivedRes = await fetch(longLivedUrl);
          const longLivedData = await longLivedRes.json();
          if (longLivedData.access_token) {
            userAccessToken = longLivedData.access_token;
            console.log('[FB OAuth Callback] Upgraded to long-lived user token successfully.');
          }
        } catch (llErr) {
          console.warn('[FB OAuth Callback] Long-lived token upgrade note:', llErr);
        }
      }

      // 5. Fetch managed Facebook Pages with Meta Graph API (follows pagination
      //    so accounts with 100+ pages sync completely, not just the first 25).
      let rawPages: any[];
      try {
        rawPages = await fetchAllManagedPages(userAccessToken);
      } catch (acctErr: any) {
        console.error('[FB OAuth Callback] Accounts fetch failed:', acctErr);
        const errMsg = acctErr?.graphError?.message || acctErr.message || 'Cannot fetch managed pages';
        return renderPopupResponse(false, `ไม่สามารถดึงข้อมูลเพจ: ${errMsg}`, { origin, error: errMsg });
      }
      if (rawPages.length === 0) {
        addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', '⚠️ บัญชีนี้ไม่มีเพจที่คุณเป็นผู้ดูแล หรือยังไม่ได้ให้สิทธิ์ pages_show_list', 'WARNING');
        return renderPopupResponse(true, 'เชื่อมต่อบัญชีสำเร็จ แต่ไม่พบเพจที่คุณเป็นผู้ดูแลในบัญชีนี้', { origin, count: 0, warning: 'no_pages' });
      }

      const basePage = getBasePageTemplate();
      const syncedPages: PageConfig[] = [];

      // 6. Securely Store Pages in Database with AES-256-GCM Encryption
      for (const fbPage of rawPages) {
        const existing = db.pages.find(p => p.page_id === fbPage.id);
        const cat: ProductCategory = existing?.category || (fbPage.category?.toUpperCase().includes('RELIG') ? 'AMULET' : fbPage.category?.toUpperCase().includes('AGRI') ? 'AGRICULTURE' : 'CHINA');
        
        // Auto-subscribe page to webhook app
        if (fbPage.access_token) {
          try {
            const subUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${fbPage.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${encodeURIComponent(fbPage.access_token)}`;
            await fetch(subUrl, { method: 'POST' });
            console.log(`[FB OAuth Callback] Page ${fbPage.name} subscribed to Webhook successfully.`);
          } catch (subErr) {
            console.warn(`[FB OAuth Callback] Webhook subscription note for page ${fbPage.name}:`, subErr);
          }
        }

        // Encrypt Page Token before saving in database
        const encryptedPageToken = encryptToken(fbPage.access_token || '');

        const newPageConfig: PageConfig = {
          ...(existing || basePage),
          page_id: fbPage.id,
          page_name: fbPage.name,
          page_access_token: encryptedPageToken,
          verify_token: existing?.verify_token || 'FB_AI_SALES_TOKEN_2026',
          is_active: existing?.is_active ?? true,
          auto_reply: existing?.auto_reply ?? true,
          auto_close_ai: existing?.auto_close_ai ?? true,
          ai_model: existing?.ai_model || 'gemini-3.6-flash',
          category: cat,
          page_avatar: fbPage.picture?.data?.url || existing?.page_avatar || basePage.page_avatar,
          page_cover: fbPage.cover?.source || existing?.page_cover || basePage.page_cover || 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1200&q=80',
          follower_count: fbPage.followers_count || fbPage.fan_count || existing?.follower_count || 15000,
          likes_count: fbPage.fan_count || existing?.likes_count || 12000,
          inquiries_count: existing?.inquiries_count || 0,
          admin_name: existing?.admin_name || 'น้ำหวาน',
          ai_tone: existing?.ai_tone || 'FRIENDLY',
          ai_custom_instructions: existing?.ai_custom_instructions || 'ตอบลูกค้าด้วยความสุภาพ แนะนำโปรโมชั่นและเก็บเงินปลายทางทันที',
          ai_brevity_mode: existing?.ai_brevity_mode ?? true
        };

        const idx = db.pages.findIndex(p => p.page_id === fbPage.id);
        if (idx >= 0) {
          db.pages[idx] = newPageConfig;
        } else {
          db.pages.push(newPageConfig);
        }
        syncedPages.push(newPageConfig);
      }

      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `🎉 เชื่อมต่อบัญชี Facebook และซิงค์เพจจริงสำเร็จ ${syncedPages.length} เพจ (Token เข้ารหัสปลอดภัย AES-256 ในฐานข้อมูล)`, 'SUCCESS', {
        pagesCount: syncedPages.length,
        pageNames: syncedPages.map(p => p.page_name)
      });

      // 7. Sanitize pages before sending to frontend: ZERO tokens exposed
      const sanitizedPagesForFrontend = syncedPages.map(p => ({
        ...p,
        page_access_token: maskToken(p.page_access_token)
      }));

      return renderPopupResponse(true, `ซิงค์ ${syncedPages.length} เพจเข้าสู่ระบบเรียบร้อยแล้ว Webhook & AI พร้อมทำงาน`, {
        origin,
        count: syncedPages.length,
        pages: sanitizedPagesForFrontend
      });
    } catch (err: any) {
      console.error('[FB OAuth Callback] Exception:', err);
      const errMsg = err.message || 'Internal error in OAuth callback';
      addLog('INFO', 'FACEBOOK_OAUTH', 'SYSTEM', `❌ เกิดข้อผิดพลาดในการประมวลผล Facebook Callback: ${errMsg}`, 'ERROR');
      return renderPopupResponse(false, `ข้อผิดพลาด: ${errMsg}`, { origin, error: errMsg });
    }
  };

  app.get('/api/facebook/callback', handleFacebookCallback);
  app.get('/facebook/callback', handleFacebookCallback);

  // Facebook Graph API Sync Pages Endpoint (POST /api/facebook/sync-pages)
  app.post('/api/facebook/sync-pages', async (req: Request, res: Response) => {
    try {
      const { userAccessToken, pageAccessToken, singlePageId } = req.body;

      if (!userAccessToken && !pageAccessToken) {
        return res.status(400).json({ error: 'กรุณาระบุ User Access Token หรือ Page Access Token' });
      }

      // If single page token & ID provided
      if (pageAccessToken && singlePageId) {
        const rawToken = decryptToken(pageAccessToken);
        const pageGraphUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${singlePageId}?access_token=${encodeURIComponent(rawToken)}&fields=id,name,picture{url},cover{source},category,followers_count,fan_count`;
        const resp = await fetch(pageGraphUrl);
        const data = await resp.json();
        if (data.error) {
          return res.status(400).json({ error: data.error.message || 'ไม่สามารถเชื่อมต่อเพจด้วย Page Access Token นี้ได้' });
        }

        // Auto-subscribe page to webhook app
        if (rawToken.startsWith('EAA')) {
          try {
            const subUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${singlePageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${encodeURIComponent(rawToken)}`;
            await fetch(subUrl, { method: 'POST' });
            console.log(`[FB Sync] Subscribed page ${singlePageId} to Webhooks.`);
          } catch (subErr) {
            console.warn('[FB Sync] Subscribed app note:', subErr);
          }
        }

        const detectedCategory: ProductCategory = data.category?.toUpperCase().includes('RELIG') ? 'AMULET' : data.category?.toUpperCase().includes('AGRI') ? 'AGRICULTURE' : 'CHINA';
        const basePage = getBasePageTemplate();
        const encryptedPageToken = encryptToken(rawToken);

        const newPage: PageConfig = {
          ...basePage,
          page_id: data.id,
          page_name: data.name,
          page_access_token: encryptedPageToken,
          verify_token: 'FB_AI_SALES_TOKEN_2026',
          is_active: true,
          auto_reply: true,
          auto_close_ai: true,
          ai_model: 'gemini-3.6-flash',
          category: detectedCategory,
          page_avatar: data.picture?.data?.url || basePage.page_avatar,
          page_cover: data.cover?.source || basePage.page_cover || 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1200&q=80',
          follower_count: data.followers_count || data.fan_count || 12000,
          likes_count: data.fan_count || 10000,
          inquiries_count: 0,
          admin_name: 'น้ำหวาน',
          ai_tone: 'FRIENDLY',
          ai_custom_instructions: 'ตอบลูกค้าด้วยความสุภาพ แนะนำโปรโมชั่นและเก็บเงินปลายทางทันที',
          ai_brevity_mode: true
        };

        const idx = db.pages.findIndex(p => p.page_id === newPage.page_id);
        if (idx >= 0) {
          db.pages[idx] = { ...db.pages[idx], ...newPage };
        } else {
          db.pages.push(newPage);
        }

        addLog('INFO', 'USER', newPage.page_id, `🔗 เชื่อมต่อเพจ Facebook สำเร็จ: ${newPage.page_name} (ID: ${newPage.page_id})`, 'SUCCESS');
        return res.json({
          success: true,
          pages: [{ ...newPage, page_access_token: maskToken(newPage.page_access_token) }],
          count: 1,
          message: `เชื่อมต่อเพจ ${newPage.page_name} สำเร็จ!`
        });
      }

      // Query all accounts linked to User Access Token (follows pagination so
      // accounts with 100+ pages sync completely, not just the first 25).
      let rawPages: any[];
      try {
        rawPages = await fetchAllManagedPages(userAccessToken);
      } catch (graphErr: any) {
        return res.status(400).json({
          error: graphErr?.graphError?.message || graphErr.message || 'เกิดข้อผิดพลาดจาก Meta Graph API',
          details: graphErr?.graphError
        });
      }
      if (rawPages.length === 0) {
        return res.json({ success: true, pages: [], count: 0, message: 'ไม่พบเพจที่บัญชีนี้เป็นผู้ดูแล (กรุณาตรวจสอบสิทธิ์ pages_show_list)' });
      }

      const basePage = getBasePageTemplate();
      const syncedPages: PageConfig[] = [];

      for (const fbPage of rawPages) {
        const existing = db.pages.find(p => p.page_id === fbPage.id);
        const cat: ProductCategory = existing?.category || (fbPage.category?.toUpperCase().includes('RELIG') ? 'AMULET' : fbPage.category?.toUpperCase().includes('AGRI') ? 'AGRICULTURE' : 'CHINA');
        
        // Auto-subscribe page to webhook app
        if (fbPage.access_token) {
          try {
            const subUrl = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${fbPage.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=${encodeURIComponent(fbPage.access_token)}`;
            await fetch(subUrl, { method: 'POST' });
          } catch (subErr) {
            console.warn('[FB Sync] Subscribed app error:', subErr);
          }
        }

        const encryptedToken = encryptToken(fbPage.access_token || '');

        const pageObj: PageConfig = {
          ...(existing || basePage),
          page_id: fbPage.id,
          page_name: fbPage.name,
          page_access_token: encryptedToken,
          verify_token: existing?.verify_token || 'FB_AI_SALES_TOKEN_2026',
          is_active: existing?.is_active ?? true,
          auto_reply: existing?.auto_reply ?? true,
          auto_close_ai: existing?.auto_close_ai ?? true,
          ai_model: existing?.ai_model || 'gemini-3.6-flash',
          category: cat,
          page_avatar: fbPage.picture?.data?.url || existing?.page_avatar || basePage.page_avatar,
          page_cover: fbPage.cover?.source || existing?.page_cover || basePage.page_cover || 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?auto=format&fit=crop&w=1200&q=80',
          follower_count: fbPage.followers_count || fbPage.fan_count || existing?.follower_count || 15000,
          likes_count: fbPage.fan_count || existing?.likes_count || 12000,
          inquiries_count: existing?.inquiries_count || 0,
          admin_name: existing?.admin_name || 'น้ำหวาน',
          ai_tone: existing?.ai_tone || 'FRIENDLY',
          ai_custom_instructions: existing?.ai_custom_instructions || 'ตอบลูกค้าด้วยความสุภาพ แนะนำโปรโมชั่นและเก็บเงินปลายทางทันที',
          ai_brevity_mode: existing?.ai_brevity_mode ?? true
        };

        const idx = db.pages.findIndex(p => p.page_id === pageObj.page_id);
        if (idx >= 0) {
          db.pages[idx] = { ...db.pages[idx], ...pageObj };
        } else {
          db.pages.push(pageObj);
        }
        syncedPages.push(pageObj);
      }

      addLog('INFO', 'USER', 'ALL', `🔄 ซิงค์เพจ Facebook สำเร็จ: ดึง ${syncedPages.length} เพจผ่าน User Token (Token เข้ารหัสปลอดภัย)`, 'SUCCESS');
      return res.json({
        success: true,
        pages: syncedPages.map(p => ({ ...p, page_access_token: maskToken(p.page_access_token) })),
        count: syncedPages.length,
        message: `ซิงค์สำเร็จ ${syncedPages.length} เพจ!`
      });
    } catch (err: any) {
      console.error('[FB Sync Error]:', err);
      return res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  // Disconnect Facebook Page Endpoint (POST /api/facebook/disconnect)
  app.post('/api/facebook/disconnect-page', (req: Request, res: Response) => {
    const { page_id } = req.body;
    if (!page_id) {
      return res.status(400).json({ error: 'Missing page_id' });
    }
    const idx = db.pages.findIndex(p => p.page_id === page_id);
    if (idx >= 0) {
      const pageName = db.pages[idx].page_name;
      db.pages[idx].is_active = false;
      addLog('INFO', 'USER', page_id, `🔌 ยกเลิกการเชื่อมต่อเพจ Facebook: ${pageName}`, 'WARNING');
      return res.json({ success: true, message: `ยกเลิกการเชื่อมต่อเพจ ${pageName} แล้ว` });
    }
    res.status(404).json({ error: 'Page not found' });
  });

  // 1. Facebook Webhook Hub Verification Endpoint (GET)
  const handleWebhookVerify = (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log(`[FB Webhook GET] Verification request. Mode: ${mode}, Token: ${token}`);

    const expectedToken = process.env.FACEBOOK_VERIFY_TOKEN || 'FB_AI_SALES_TOKEN_2026';
    const isMatched = db.pages.some(p => p.verify_token === token) || token === expectedToken;

    if (mode === 'subscribe' && isMatched) {
      console.log('[FB Webhook GET] Verified successfully!');
      addLog('INFO', 'FACEBOOK_HUB', 'SYSTEM', `Webhook Verification สำเร็จ (Challenge: ${challenge})`, 'SUCCESS');
      return res.status(200).send(challenge);
    } else {
      console.warn('[FB Webhook GET] Verification failed. Token mismatch.');
      addLog('INFO', 'FACEBOOK_HUB', 'SYSTEM', `Webhook Verification ล้มเหลว (Token ไม่ตรงกัน)`, 'WARNING', { token });
      return res.sendStatus(403);
    }
  };

  app.get('/webhook/facebook', handleWebhookVerify);
  app.get('/webhooks/facebook', handleWebhookVerify);
  app.get('/api/webhook/facebook', handleWebhookVerify);
  app.get('/api/webhooks/facebook', handleWebhookVerify);

  // 2. Facebook Webhook Handler Endpoint (POST)
  const handleWebhookPost = async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
      if (body?.object === 'page' && !(req as any).isInternal && appSecret) {
        const receivedSignature = req.headers?.['x-hub-signature-256'];
        const expectedSignature = `sha256=${crypto.createHmac('sha256', appSecret).update((req as any).rawBody || '').digest('hex')}`;
        const valid = typeof receivedSignature === 'string' && receivedSignature.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature));
        if (!valid) {
          addLog('INFO', 'FACEBOOK_WEBHOOK', 'SYSTEM', '⛔ ปฏิเสธ Webhook: ลายเซ็น X-Hub-Signature-256 ไม่ถูกต้อง', 'ERROR');
          return res.status(403).json({ error: 'INVALID_WEBHOOK_SIGNATURE' });
        }
      }
      console.log('[FB Webhook POST] Received payload:', JSON.stringify(body, null, 2));

      // Immediate acknowledge to Facebook within 20 seconds
      res.status(200).json({ status: 'EVENT_RECEIVED' });

      // Meta may batch events for multiple Pages and multiple senders. Process
      // every item; never silently discard all but entry[0].
      if (Array.isArray(body.entry) && body.entry.length > 1) {
        for (const entry of body.entry) {
          await handleWebhookPost({ body: { object: body.object, entry: [entry] }, isInternal: true } as any, { status: () => ({ json: () => {} }), sendStatus: () => {} } as any);
        }
        return;
      }
      if (body.entry?.[0]?.messaging?.length > 1) {
        const entry = body.entry[0];
        for (const messaging of entry.messaging) {
          await handleWebhookPost({ body: { object: body.object, entry: [{ ...entry, messaging: [messaging] }] }, isInternal: true } as any, { status: () => ({ json: () => {} }), sendStatus: () => {} } as any);
        }
        return;
      }
      if (body.entry?.[0]?.changes?.length > 1) {
        const entry = body.entry[0];
        for (const change of entry.changes) {
          await handleWebhookPost({ body: { object: body.object, entry: [{ ...entry, changes: [change] }] }, isInternal: true } as any, { status: () => ({ json: () => {} }), sendStatus: () => {} } as any);
        }
        return;
      }

      // Step 2 in n8n: Event Router
      let eventType: 'MESSAGE' | 'COMMENT' | 'UNKNOWN' = 'UNKNOWN';
      let senderId = '';
      let pageId = '';
      let messageText = '';
      let isQuickReplyTap = false;
      let commentId: string | null = null;
      let postId: string | null = null;

      if (body.entry && body.entry[0]) {
        const entry = body.entry[0];
        pageId = entry.id || 'AMULET_PAGE_ID';

        if (entry.messaging && entry.messaging[0]) {
          const messagingEvent = entry.messaging[0];

          // Ignore delivery or read receipts gracefully
          if (messagingEvent.delivery || messagingEvent.read) {
            return;
          }

          // Echo guard: every message the PAGE sends (bot replies + admin
          // inbox replies) comes back to the webhook with is_echo=true.
          // Without this filter the bot would answer its own messages.
          if (messagingEvent.message?.is_echo) {
            return;
          }

          // Dedupe: the same message can arrive via webhook AND inbox polling.
          const incomingMid = messagingEvent.message?.mid;
          if (incomingMid && !rememberId(processedMessageIds, incomingMid)) {
            return;
          }

          if (messagingEvent.message?.text || messagingEvent.message?.quick_reply?.payload) {
            eventType = 'MESSAGE';
            senderId = messagingEvent.sender?.id || 'UNKNOWN_SENDER';
            isQuickReplyTap = Boolean(messagingEvent.message.quick_reply?.payload);
            // Quick Reply taps deliver the button payload — prefer it over the
            // 20-char title so the full configured text reaches the AI.
            messageText = messagingEvent.message.quick_reply?.payload || messagingEvent.message.text;
          } else if (messagingEvent.message?.attachments?.length) {
            // Customer sent an image/sticker/file — acknowledge instead of staying silent.
            eventType = 'MESSAGE';
            senderId = messagingEvent.sender?.id || 'UNKNOWN_SENDER';
            messageText = '(ลูกค้าส่งรูปภาพหรือไฟล์แนบมา ไม่มีข้อความ ให้ตอบว่าได้รับรูปเรียบร้อยแล้ว พร้อมสอบถามว่าสนใจสินค้าตัวไหน)';
          } else if (messagingEvent.postback?.payload) {
            eventType = 'MESSAGE';
            senderId = messagingEvent.sender?.id || 'UNKNOWN_SENDER';
            messageText = messagingEvent.postback.title || messagingEvent.postback.payload;
          }
        } else if (entry.changes && entry.changes[0]) {
          const change = entry.changes[0];
          if (change.field === 'feed' && change.value?.item === 'comment') {
            eventType = 'COMMENT';
            senderId = change.value.from?.id || 'COMMENT_USER';
            messageText = change.value.message || '';
            commentId = change.value.comment_id || `cmt_${Date.now()}`;
            postId = change.value.post_id || `post_${Date.now()}`;
          }
        }
      } else if (body.event_type) {
        // Direct simulated structure
        eventType = body.event_type;
        senderId = body.sender_id || `PSID_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        pageId = body.page_id || 'AMULET_PAGE_ID';
        messageText = body.message_text || '';
        commentId = body.comment_id || null;
        postId = body.post_id || null;
      }

      if (eventType === 'UNKNOWN' || !messageText) {
        return;
      }

      // Dedupe comment events (webhook feed changes + comment scraper polling).
      if (eventType === 'COMMENT' && commentId && !rememberId(processedCommentIds, commentId)) {
        return;
      }

      const page = db.pages.find(p => p.page_id === pageId);
      if (!page) {
        addLog('INFO', senderId || 'UNKNOWN', pageId || 'UNKNOWN', '⛔ ปฏิเสธ event: ไม่พบเพจที่เชื่อมต่ออยู่ในระบบ', 'ERROR');
        return;
      }
      if (!page.is_active || !page.auto_reply) {
        addLog('INFO', senderId || 'UNKNOWN', pageId, '⏸️ รับ event แล้ว แต่เพจถูกพักหรือปิด Auto-reply อยู่', 'INFO');
        return;
      }

      // Blocked customer: never auto-reply (admin blocked them in the Inbox)
      const blockedState = await dbService.getConversationState(pageId, senderId).catch(() => null);
      if (blockedState?.is_blocked) {
        addLog('INFO', senderId, pageId, `🚫 ข้ามข้อความจาก ${senderId} (ลูกค้าถูกบล็อกไว้ใน Inbox)`, 'INFO');
        return;
      }

      // /stop command: Admin can stop bot to prevent auto-reply
      if (messageText.trim().toLowerCase() === '/stop') {
        page.bot_stopped = true;
        persistData();
        addLog('INFO', 'BOT_CONTROL', pageId, `⏹️ บอทถูกหยุดโดยคำสั่ง /stop จาก ${senderId}`, 'WARNING');
        await sendFacebookMessage(page.page_access_token || '', senderId, '⏹️ บอทถูกหยุดแล้ว ระบบจะไม่ตอบข้อความอัตโนมัติจนกว่าจะเปิดใช้งานอีกครั้ง');
        return;
      }
      if (messageText.trim().toLowerCase() === '/start') {
        page.bot_stopped = false;
        persistData();
        addLog('INFO', 'BOT_CONTROL', pageId, `▶️ บอทถูกเปิดใช้งานอีกครั้งโดย ${senderId}`, 'SUCCESS');
        await sendFacebookMessage(page.page_access_token || '', senderId, '▶️ บอทถูกเปิดใช้งานแล้ว ระบบจะตอบข้อความอัตโนมัติอีกครั้ง');
        return;
      }

      // ตัดรอบ command: Admin resets order counter
      if (messageText.trim() === 'ตัดรอบ' || messageText.trim().toLowerCase() === '/cutround') {
        const prevCounter = await dbService.getDispatchCounter(pageId);
        await dbService.resetDispatchCounter(pageId);
        addLog('INFO', 'ADMIN', pageId, `🔔 ตัดรอบออเดอร์! รีเซ็ตตัวนับจาก ${prevCounter} → 1`, 'SUCCESS');
        dbBridge.broadcastSSE('round_cut', { page_id: pageId, previous_counter: prevCounter });
        await sendFacebookMessage(page.page_access_token || '', senderId, `🔔 ตัดรอบเรียบร้อยค่ะ! ตัวนับออเดอร์รีเซ็ตเป็น 1 (รอบก่อนหน้าถึง ${prevCounter - 1})`);
        return;
      }

      // ยกเลิกออเดอร์ command: Customer cancels their order
      if (messageText.trim().toLowerCase().includes('ยกเลิก') || messageText.trim().toLowerCase().includes('cancel')) {
        const customerOrders = db.orders.filter(o => o.psid === senderId && o.payment_status !== 'CANCELLED' && o.page_id === pageId);
        if (customerOrders.length > 0) {
          const latestOrder = customerOrders[0];
          await cancelOrderAndNotify(latestOrder.order_id, page, 'ลูกค้าขอยกเลิก');
          await sendFacebookMessage(page.page_access_token || '', senderId, `✅ ยกเลิกออเดอร์ ${latestOrder.order_id} เรียบร้อยแล้วค่ะ\nหากต้องการสั่งซื้อใหม่ ทักมาได้เลยนะคะ 🙏`);
          return;
        }
      }

      // Check if bot is stopped for this page
      if (page.bot_stopped) {
        addLog('INFO', senderId || 'UNKNOWN', pageId, '⏹️ บอทถูกหยุดไว้ ไม่ตอบข้อความอัตโนมัติ', 'INFO');
        return;
      }

      // Rate limiting: prevent bot from replying too much to same sender
      const rateLimit = page.rate_limit_per_hour || DEFAULT_RATE_LIMIT;
      if (!checkRateLimit(pageId, senderId, rateLimit)) {
        addLog('INFO', senderId || 'UNKNOWN', pageId, `🚫 Rate limit exceeded: ${senderId} ส่งข้อความเกิน ${rateLimit} ครั้ง/ชั่วโมง`, 'WARNING');
        await sendFacebookMessage(page.page_access_token || '', senderId, '🙏 ขออภัยค่ะ ระบบได้รับข้อความจำนวนมาก กรุณารอสักครู่แล้วแอดมินจะตอบกลับให้นะคะ');
        return;
      }

      if (!isAiConfigured()) {
        addLog('INFO', senderId || 'UNKNOWN', pageId, `⛔ ไม่ตอบอัตโนมัติ: ยังไม่ได้ตั้งค่า AI Provider (${getCurrentProvider()})`, 'ERROR');
        // Send notification to user that API key is not configured
        await sendFacebookMessage(page.page_access_token || '', senderId, '🙏 สวัสดีค่ะ ระบบ AI ยังไม่ได้ตั้งค่า API Key กรุณาติดต่อแอดมินเพื่อตั้งค่าก่อนนะคะ แอดมินจะตอบกลับให้เร็วที่สุดค่ะ');
        return;
      }

      // CRISIS MONITORING: Scan for major customer complaints / legal threats / สคบ / แจ้งความ
      const crisisKeywords = [
        'แจ้งความ',
        'สคบ',
        'ฟ้อง',
        'ตำรวจ',
        'ทนาย',
        'ดำเนินคดี',
        'ร้องเรียน',
        'โกงเงิน',
        'ฉ้อโกง',
        'เอาเรื่อง',
        'จับกุม',
        'ขึ้นศาล'
      ];
      const isCrisis = crisisKeywords.some(k => messageText.includes(k));
      if (isCrisis) {
        await triggerCrisisAlert({
          page_id: pageId,
          page_name: page.page_name,
          threat_type: messageText.includes('สคบ') || messageText.includes('ตำรวจ') || messageText.includes('แจ้งความ')
            ? 'SAKOB_POLICE_THREAT'
            : messageText.includes('ฟ้อง') || messageText.includes('ทนาย') || messageText.includes('ดำเนินคดี')
            ? 'LEGAL_THREAT'
            : 'SEVERE_COMPLAINT',
          customer_name: senderId,
          message_text: messageText,
          psid: senderId
        });
      }

      // Handle COMMENT moderation & Auto-Reply with up to 6 images & customer tagging
      if (eventType === 'COMMENT') {
        const hideKeywords = page.toxic_keywords || ['โกง', 'หลอก', 'แย่', 'ฟ้อง', 'ระวัง', 'ปลอม', 'โกงเงิน', 'มิจฉาชีพ'];
        const intentKeywords = page.purchase_keywords || ['สนใจ', 'ราคา', 'ซื้อ', 'เอา', 'รายละเอียด', 'สั่ง', 'เท่าไหร่', 'ขอราคา', 'จอง'];

        const shouldHide = hideKeywords.some(w => messageText.includes(w));
        const hasPurchaseIntent = intentKeywords.some(w => messageText.includes(w));

        if (shouldHide && page.hide_toxic_comments !== false) {
          addLog('COMMENT_HIDDEN', senderId, pageId, `🛡️ ซ่อนคอมเมนต์สแปม/คำต้องห้าม: "${messageText}" (Comment ID: ${commentId})`, 'WARNING');
          if (commentId) {
            await hideFacebookComment(page.page_access_token || '', commentId);
          }
          return;
        }

        if (hasPurchaseIntent || page.scrape_comments_enabled !== false) {
          const customerTag = page.comment_auto_tag_customer !== false ? `@ลูกค้า` : '';
          const replyTemplate = page.comment_reply_template || 'ขอบพระคุณที่สนใจค่ะคุณ @customer_name แอดมินทัก Inbox ส่งรายละเอียดให้เรียบร้อยแล้วนะคะ 🙏';
          const replyText = replyTemplate.replace('@customer_name', customerTag || 'ลูกค้า');
          const replyImages = page.comment_reply_images || [];

          addLog(
            'COMMENT',
            senderId,
            pageId,
            `💬 ตอบกลับคอมเมนต์ & แนบรูป ${replyImages.length} รูป: "${replyText}" -> ทัก Inbox ทันที`,
            'SUCCESS',
            { replyText, replyImagesCount: replyImages.length, tagged: customerTag }
          );

          if (commentId) {
            await sleep(REPLY_DELAY_MS); // human-like pacing before replying publicly
            await sendFacebookCommentReply(page.page_access_token || '', commentId, replyText);
          }

          // Send automatic inbox invite
          const autoInboxMsg = `สวัสดีค่ะคุณลูกค้า สนใจ ${page.product?.product_name || 'สินค้า'} แอดมินส่งรายละเอียดและของแถมพิเศษให้ในแชทนี้แล้วนะคะ 🙏`;
          addLog('AI_REPLY', senderId, pageId, `📨 ส่งข้อความทัก Inbox: "${autoInboxMsg}"`, 'SUCCESS');

          await sleep(REPLY_DELAY_MS);
          await sendFacebookMessage(page.page_access_token || '', senderId, autoInboxMsg);
        }
        return;
      }

      // Handle MESSENGER MESSAGE Event
      const intentHint: IntentHint = classifyIntentInstant(messageText);
      addLog('MESSAGE', senderId, pageId, `📩 ลูกค้าทักแชท [intent:${intentHint}]: "${messageText}"`, 'INFO', { senderId, pageId, intentHint });
      // Restore conversation memory from PostgreSQL if the server restarted
      await seedHistoryFromDb(pageId, senderId);
      // Remember the customer's message in conversation memory BEFORE any
      // mutation so first-message detection below stays truthful.
      const isNewCustomer = !db.customers.some(c => c.psid === senderId);
      pushHistory(pageId, senderId, 'customer', messageText);

      // Customer Memory: Check if returning customer with order history
      const customerOrderCount = await dbService.getCustomerOrderCount(senderId);
      const customerTotalSpent = await dbService.getCustomerTotalSpent(senderId);
      const isReturningCustomer = customerOrderCount > 0;
      let customerStarRating = 0;
      if (customerOrderCount >= 10) customerStarRating = 5;
      else if (customerOrderCount >= 5) customerStarRating = 4;
      else if (customerOrderCount >= 3) customerStarRating = 3;
      else if (customerOrderCount >= 1) customerStarRating = 2;

      // Customer Search & Create/Update (Steps 3-6 in n8n)
      let customer = db.customers.find(c => c.psid === senderId);
      if (!customer) {
        customer = {
          psid: senderId,
          customer_name: `ลูกค้า Facebook (${senderId.substring(senderId.length - 4)})`,
          phone_number: '',
          address: '',
          first_interaction: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          status: isReturningCustomer ? 'ORDER_COMPLETED' : 'NEW_CUSTOMER',
          notes: isReturningCustomer ? `ลูกค้าเก่า เคยสั่งซื้อ ${customerOrderCount} ครั้ง ยอดรวม ฿${customerTotalSpent.toLocaleString()}` : 'ทักมาจากข้อความเพจ',
          order_count: customerOrderCount
        };
        db.customers.unshift(customer);
        addLog('INFO', senderId, pageId, `👤 สร้างประวัติลูกค้าใหม่${isReturningCustomer ? ' (ลูกค้าเก่ากลับมา!)' : ''} (PSID: ${senderId})`, 'SUCCESS');
      } else {
        customer.last_interaction = new Date().toISOString();
        if (isReturningCustomer && customer.status !== 'ORDER_COMPLETED') {
          customer.status = 'ORDER_COMPLETED';
        } else if (customer.status !== 'ORDER_COMPLETED') {
          customer.status = 'OLD_CUSTOMER';
        }
        customer.order_count = customerOrderCount;
      }

      // Product Knowledge Check: ถ้าเพจไม่มีข้อมูลสินค้าเลย ให้ถามแอดมินก่อน
      const hasProductData = Boolean(page.product?.product_name && (page.product?.display_price > 0 || page.product?.description));
      if (!hasProductData && !isReturningCustomer) {
        // Page has no product data - ask admin for info instead of answering blindly
        const knowledgePrompt = `📝 สวัสดีค่ะแอดมิน! เพจ "${page.page_name}" ยังไม่มีข้อมูลสินค้าในระบบค่ะ

เพื่อให้ AI ตอบลูกค้าได้อย่างถูกต้อง รบกวนแอดมินกรอกข้อมูลดังนี้ค่ะ:
1️⃣ ชื่อสินค้าคืออะไรค่ะ?
2️⃣ ราคาเท่าไรค่ะ?
3️⃣ มีรายละเอียด/คุณสมบัติอะไรที่ลูกค้าชอบถามบ้างค่ะ?
4️⃣ มีโปรโมชั่นอะไรบ้างค่ะ?

แอดมินสามารถพิมพ์ตอบกลับมาได้เลย หรือตั้งค่าในหน้า "แก้ไขฐานข้อมูล" ค่ะ 🙏

(ลูกค้า "${customer?.customer_name || 'ไม่ทราบชื่อ'}" ทักเข้ามาถาม: "${messageText.slice(0, 100)}")`;

        await sendFacebookMessage(page.page_access_token || '', senderId, '🙏 ขออภัยค่ะ แอดมินกำลังอัปเดตข้อมูลสินค้า กรุณารอสักครู่ แอดมินจะรีบมาตอบให้เร็วที่สุดค่ะ');
        addLog('INFO', 'KNOWLEDGE', pageId, `📝 เพจไม่มีข้อมูลสินค้า - แจ้งแอดมินให้กรอกข้อมูล (ลูกค้า: ${senderId})`, 'WARNING');
        dbBridge.broadcastSSE('knowledge_needed', { page_id: pageId, customer_message: messageText, sender_id: senderId });
        return;
      }

      // Product and Detailed Specs selection
      let relevantProducts: any[] = [];
      if (page.category === 'CHINA' || pageId === 'CHINA_PAGE_ID') {
        relevantProducts = db.china.filter(product => product.page_id === pageId);
      } else if (page.category === 'OTOP' || pageId === 'OTOP_PAGE_ID') {
        relevantProducts = db.otop.filter(product => product.page_id === pageId);
      } else if (page.category === 'AGRICULTURE' || pageId === 'AGRI_PAGE_ID') {
        relevantProducts = db.agriculture.filter(product => product.page_id === pageId);
      } else {
        relevantProducts = db.amulet.filter(product => product.page_id === pageId);
      }

      // The page product is the canonical fallback, so a chat can never use
      // another page's catalog item merely because it shares a category.
      let matchedProduct: any = relevantProducts[0] || page.product || {};
      for (const prod of relevantProducts) {
        if (
          messageText.includes(prod.product_name) ||
          (prod.product_id && messageText.includes(prod.product_id)) ||
          (prod.master && messageText.includes(prod.master)) ||
          (prod.temple && messageText.includes(prod.temple)) ||
          (prod.brand && messageText.includes(prod.brand))
        ) {
          matchedProduct = prod;
          break;
        }
      }

      // AI Persona & Model Execution
      const selectedModel = getProviderModel(getCurrentProvider());
      const adminName = page.admin_name || 'น้ำหวาน';
      const aiTone = page.ai_tone || 'FRIENDLY';
      const customInstructions = page.ai_custom_instructions || 'ตอบสั้นกระชับ สุภาพ เหมือนแอดมินคนจริง และเน้นปิดการขาย';
      const brevityMode = page.ai_brevity_mode !== false;
      const combinedSpecs = {
        ...(matchedProduct || {}),
        ...(page.product?.specs || {})
      };

      let specsText = '';
      if (page.category === 'AMULET' || pageId === 'AMULET_PAGE_ID') {
        specsText = `
- หมวดหมู่สินค้า: พระเครื่อง / วัตถุมงคล
- วัดที่จัดสร้าง (Temple): ${combinedSpecs.temple || combinedSpecs.origin_or_temple || 'ไม่ระบุ'}
- พระเกจิอาจารย์ (Master/Maker): ${combinedSpecs.master || combinedSpecs.master_or_maker || 'ไม่ระบุ'}
- ปีสร้าง (Year): ${combinedSpecs.year || combinedSpecs.ceremony_or_batch || 'ไม่ระบุ'}
- รุ่น/พิมพ์ (Edition): ${combinedSpecs.edition || combinedSpecs.ceremony_or_batch || 'ไม่ระบุ'}
- เนื้อวัสดุ/มวลสาร (Material): ${combinedSpecs.material || 'ไม่ระบุ'}
- จำนวนสร้าง (Quantity Created): ${combinedSpecs.quantity_created || combinedSpecs.quantity || 'ไม่ระบุ'}
- ข้อมูลความเชื่อ/พุทธคุณ (Belief Info): ${combinedSpecs.belief_info || 'ไม่ระบุ'}
- คาถาบทสวด (Spell/Prayer): ${combinedSpecs.spell || combinedSpecs.spell_or_instructions || 'ไม่ระบุ'}
- วิธีบูชา (Worship Method): ${combinedSpecs.worship_method || 'ไม่ระบุ'}
- การดูแลรักษา (Care Instruction): ${combinedSpecs.care_instruction || 'ไม่ระบุ'}
- ข้อควรระวัง (Warning): ${combinedSpecs.warning || 'ไม่ระบุ'}
- ประวัติความเป็นมา (History): ${combinedSpecs.history || 'ไม่ระบุ'}
- ใบรับประกันความแท้ (Warranty/Cert): ${combinedSpecs.warranty || combinedSpecs.authenticity_cert || 'รับประกันพระแท้ 100%'}
        `;
      } else if (page.category === 'CHINA' || pageId === 'CHINA_PAGE_ID') {
        specsText = `
- หมวดหมู่สินค้า: สินค้านำเข้า / ไอที
- แบรนด์ (Brand): ${combinedSpecs.brand || 'ไม่ระบุ'}
- วัสดุ (Material): ${combinedSpecs.material || 'ไม่ระบุ'}
- ขนาด (Size/Dimensions): ${combinedSpecs.size || combinedSpecs.dimensions || 'มาตรฐาน'}
- น้ำหนัก (Weight): ${combinedSpecs.weight || 'ไม่ระบุ'}
- วิธีใช้งาน (Usage Instructions): ${combinedSpecs.usage || combinedSpecs.usage_instructions || 'ไม่ระบุ'}
- ข้อมูลการจัดส่ง (Shipping Info): ${combinedSpecs.shipping_info || combinedSpecs.shipping_duration || 'จัดส่งด่วน 1-2 วัน มีบริการเก็บเงินปลายทาง'}
- คุณสมบัติเด่น (Features): ${combinedSpecs.features || 'ไม่ระบุ'}
- ประโยชน์/จุดเด่น (Benefits): ${combinedSpecs.benefit || combinedSpecs.benefits || 'ไม่ระบุ'}
- การรับประกัน (Warranty): ${combinedSpecs.warranty || 'รับประกันคุณภาพสินค้า'}
        `;
      } else if (page.category === 'OTOP' || pageId === 'OTOP_PAGE_ID') {
        specsText = `
- หมวดหมู่สินค้า: สินค้า OTOP / วิสาหกิจชุมชน
- ชุมชน/กลุ่มผู้ผลิต (Community): ${combinedSpecs.community || 'ไม่ระบุ'}
- จังหวัด (Province): ${combinedSpecs.province || 'ไม่ระบุ'}
- ผู้ผลิต (Maker): ${combinedSpecs.maker || combinedSpecs.master_or_maker || 'ไม่ระบุ'}
- แหล่งที่มา (Origin): ${combinedSpecs.origin || combinedSpecs.origin_or_temple || 'ไม่ระบุ'}
- วัตถุดิบหลัก (Material): ${combinedSpecs.material || 'วัตถุดิบธรรมชาติจากชุมชน'}
- ขนาด / น้ำหนัก (Size/Weight): ${combinedSpecs.size || combinedSpecs.weight || 'มาตรฐาน'}
- เรื่องราวสินค้า (Story): ${combinedSpecs.story || 'ภูมิปัญญาท้องถิ่นสืบทอดกันมา'}
- วิธีการผลิตโบราณ (Production Method): ${combinedSpecs.production_method || 'งานหัตถกรรม/ฝีมือโบราณ'}
- วิธีการดูแลรักษา (Care Instruction): ${combinedSpecs.care_instruction || 'ไม่ระบุ'}
- ข้อควรระวัง (Warning): ${combinedSpecs.warning || 'ไม่ระบุ'}
- ประโยชน์เด่น (Benefit): ${combinedSpecs.benefit || 'คุณภาพมาตรฐาน OTOP'}
        `;
      } else if (page.category === 'AGRICULTURE' || pageId === 'AGRI_PAGE_ID') {
        specsText = `
- หมวดหมู่สินค้า: สินค้าการเกษตร / ปุ๋ยชีวภาพ / เมล็ดพันธุ์
- ข้อมูลพืช & เมล็ดพันธุ์ / หมวดย่อย (Subcategory): ${combinedSpecs.subcategory || combinedSpecs.species || 'ไม่ระบุ'}
- สายพันธุ์ F1 / ชนิดสายพันธุ์ (Variety): ${combinedSpecs.variety || 'ไม่ระบุ'}
- อัตราการงอกโดยประมาณ (Germination Rate): ${combinedSpecs.germination_rate || 'ไม่ระบุ'}
- ระยะเวลาเพาะงอก (Germination Days): ${combinedSpecs.germination_days || 'ไม่ระบุ'}
- การเพาะ & การปลูก (Planting Method): ${combinedSpecs.planting_method || 'ไม่ระบุ'}
- ดิน/วัสดุปลูก (Soil Type): ${combinedSpecs.soil_type || 'ไม่ระบุ'}
- ระยะห่างระหว่างแปลง/ต้น (Plant Spacing): ${combinedSpecs.plant_spacing || 'ไม่ระบุ'}
- ความต้องการแสงแดด (Sunlight Requirement): ${combinedSpecs.sunlight_requirement || 'ไม่ระบุ'}
- อุณหภูมิที่เหมาะสม (Suitable Temperature): ${combinedSpecs.suitable_temperature || 'ไม่ระบุ'}
- การรดน้ำ & ความถี่ (Watering Method): ${combinedSpecs.watering_method || 'ไม่ระบุ'}
- ปุ๋ย & อัตราการใช้ (Usage/Fertilizer): ${combinedSpecs.usage_instructions || 'ไม่ระบุ'}
- ระยะเวลาเก็บเกี่ยว (Harvest Time): ${combinedSpecs.harvest_time || 'ไม่ระบุ'}
- ผลผลิตคาดการณ์ (Expected Yield): ${combinedSpecs.expected_yield || 'ไม่ระบุ'}
- ประโยชน์และผลลัพธ์ (Benefits): ${combinedSpecs.benefits || 'ไม่ระบุ'}
- การเก็บรักษา (Storage Method): ${combinedSpecs.storage_method || 'ไม่ระบุ'}
- แบรนด์ (Brand): ${combinedSpecs.brand || 'ไม่ระบุ'}
- เลขที่จดทะเบียนปุ๋ย/ยา (Registration Number): ${combinedSpecs.registration_number || 'ไม่ระบุ'}
- ขนาดบรรจุภัณฑ์ (Package Size): ${combinedSpecs.package_size || 'ไม่ระบุ'}
- ข้อควรระวังด้านความปลอดภัย (Safety Warning): ${combinedSpecs.safety_warning || 'ไม่ระบุ'}
        `;
      } else {
        specsText = Object.entries(combinedSpecs)
          .filter(([k, v]) => v && typeof v === 'string' && k !== 'product_name' && k !== 'product_id' && k !== 'page_id' && k !== 'category')
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n');
      }


      // Conversation memory: the last few exchanges so the answer continues
      // the chat instead of ignoring what was already said. (Each entry is
      // capped at 200 chars in the prompt — full text lives in the DB.)
      const historyEntries = getRecentHistory(pageId, senderId, 8);
      const historyText = historyEntries.length
        ? historyEntries.map(h => `${h.role === 'customer' ? 'ลูกค้า' : adminName}: ${String(h.text).slice(0, 200)}`).join('\n')
        : '(ยังไม่มีประวัติบทสนทนา — นี่คือข้อความแรก)';
      // Replies already used in this conversation — the AI must not repeat them.
      const usedReplies = getRecentAdminReplies(pageId, senderId, 4);
      const usedRepliesText = usedReplies.length
        ? usedReplies.map(r => `- "${r}"`).join('\n')
        : '(ยังไม่มีคำตอบก่อนหน้า)';

      const promptContext = `
คุณคือ "${adminName}" ซึ่งเป็นแอดมินร้านค้าเพจ Facebook: "${page.page_name}"
ลักษณะการตอบและบุคลิก:
- ชื่อแอดมิน: ${adminName}
- โทนเสียง: ${aiTone}
- ความยาวคำตอบ: ${brevityMode ? 'ตอบสั้น กระชับ ตรงประเด็น 1-3 ประโยค เหมือนคนพิมพ์แชทมือถือจริง' : 'ให้ข้อมูลครบถ้วน ชัดเจน แต่ไม่เกิน 5 ประโยค'}
- คำสั่งเฉพาะของเพจนี้: ${customInstructions}

🎯 เจตนาลูกค้าที่ระบบวิเคราะห์เบื้องต้น: ${intentHint}
📋 กลยุทธ์การตอบสำหรับเจตนานี้: ${SALES_PLAYBOOK[intentHint]}

👤 ข้อมูลลูกค้าคนนี้:
- สถานะ: ${isReturningCustomer ? `⭐ ลูกค้าเก่า (เคยสั่งซื้อ ${customerOrderCount} ครั้ง ยอดรวม ฿${customerTotalSpent.toLocaleString()} ดาว ${customerStarRating}/5)` : '🆕 ลูกค้าใหม่ (ยังไม่เคยสั่งซื้อ)'}
- ชื่อ: ${customer?.customer_name || 'ไม่ทราบ'}
- สถานะลูกค้า: ${customer?.status || 'NEW_CUSTOMER'}
${isReturningCustomer ? '- ⚡ ลูกค้าเคยสั่งซื้อแล้ว ให้ต้อนรับเป็นพิเศษ เช่น "ยินดีกลับมาอีกครั้งค่ะ!" และอาจเสนอโปรโมชั่นพิเศษสำหรับลูกค้าเก่า' : ''}

📜 ประวัติบทสนทนาล่าสุดกับลูกค้าคนนี้ (ข้อความล่าสุดอยู่ท้ายสุด ให้ตอบต่อเนื่องจากนี้):
${historyText}

🚫 คำตอบที่คุณเคยตอบไปแล้วกับลูกค้าคนนี้ (ห้ามใช้ประโยคหรือโครงสร้างเดิมซ้ำ ต้องตอบใหม่ทุกครั้ง):
${usedRepliesText}

⚠️ กฎสำคัญที่สุด - ทำตามทุกข้อ:
1. อ่าน "ข้อความล่าสุดของลูกค้า" แล้วตอบสิ่งที่ลูกค้าถามโดยเฉพาะ ห้ามเลี่ยงคำถาม ห้ามตอบวนเรื่องเดิม
2. ถ้าลูกค้าถามต่อเนื่อง ให้ต่อยอดจากที่เคยตอบ (เช่น บอกรายละเอียดเพิ่ม หรือถามปิดการขาย) ไม่ใช่เริ่มใหม่
3. ตอบเหมือนมนุษย์แอดมินคุยจริง พิมพ์สั้น เป็นธรรมชาติ ใช้คำอุดมคติของแอดมินไทย
4. ตัวเลขราคา/โปรโมชั่น ใช้จากข้อมูลสินค้าด้านล่างเท่านั้น ห้ามเดา ห้ามมั่ว
5. ห้ามอ้างว่าเป็น AI ห้ามแนะนำตัวซ้ำทุกข้อความ ห้ามทักทายใหม่ทุกครั้งเมื่อกำลังคุยอยู่
6. ปิดท้ายทุกข้อความด้วยคำถามสั้นๆ ชวนตัดสินใจหรือชวนคุยต่อ (เช่น "เอาแพ็กนี้เลยไหมคะ" / "สนใจแบบไหนคะ") — ยกเว้นตอนลูกค้ากำลังส่งข้อมูลที่อยู่
7. ถ้าลูกค้าให้ชื่อ/เบอร์โทร/ที่อยู่ ให้จดจำใช้ตลอดบทสนทนา ไม่ต้องถามซ้ำสิ่งที่ลูกค้าบอกไปแล้ว

ข้อมูลสินค้าหลักของเพจนี้ (1 เพจ 1 สินค้า):
- รหัสสินค้า: ${page.product?.product_id || matchedProduct.product_id}
- ชื่อสินค้า: ${page.product?.product_name || matchedProduct.product_name}
- ราคาปกติ: ฿${(page.product?.base_price || matchedProduct.price_1 || 0).toLocaleString()}
- ราคาโปรโมชั่นขาย: ฿${(page.product?.display_price || matchedProduct.display_price || 0).toLocaleString()}
- รายละเอียด: ${page.product?.description || matchedProduct.detail_text || ''}
- รายการของแถมในกล่อง: ${combinedSpecs.box_contents || 'ของแถมพิเศษ'}

📋 ข้อมูลสเปกสินค้าแบบละเอียด (Detailed Product Specifications):
${compactSpecText(specsText)}
- โปรโมชั่นทั้งหมดที่มี (ชื่อแพ็กเกจคือชื่อที่ร้านกำหนดเอง ให้ใช้ชื่อนี้ตามนั้น):
${JSON.stringify((page.product?.promotions || [
  { name: 'โปรโมชั่น 1 ชิ้น', price: matchedProduct.price_1 || 0 },
  { name: 'โปรโมชั่น 2 ชิ้น', price: matchedProduct.price_2 || 0 },
  { name: 'โปรโมชั่น 3 ชิ้น', price: matchedProduct.price_3 || 0 }
]).map((p: any) => ({
  name: p.name,
  quantity: p.quantity,
  price: p.price,
  free_shipping: p.free_shipping === true,
  gift_quantity: p.gift_quantity || 0,
  free_gifts: p.free_gifts || ''
})))}

แพตเทิร์นการขาย 6 สเต็ปของเพจนี้ (ใช้เป็นแนวทาง ไม่ต้องเรียงทุกข้อความ):
- สเต็ป 1 (ข้อความเปิด): ${page.sequence?.step1_opening_text || matchedProduct.opening_text}
- สเต็ป 3 (รายละเอียดโปรโมชั่น): ${page.sequence?.step3_promotion_detail || matchedProduct.promotion_text}
- สเต็ป 6 (ข้อความปิดการขาย): ${page.sequence?.step6_closing_text || matchedProduct.closing_text}

กฎเหล็กเพิ่มเติม:
1. ให้ข้อมูลเฉพาะสินค้าและโปรโมชั่นของเพจนี้ ห้ามแต่งข้อมูล ห้ามเดา
2. หากเป็นพระเครื่อง: ห้ามสร้างพุทธคุณเอง ให้ใช้ข้อมูลแท้เท่านั้น
3. ถ้าลูกค้ายังไม่ได้ถามเรื่องราคา/โปรโมชั่น อย่ายัดโปรทันที — ตอบคำถามก่อน แล้วค่อยมีจังหวะปิดการขายสั้นๆ ท้ายข้อความ
4. หากลูกค้าส่งข้อมูลสั่งซื้อหรือส่งชื่อ/ที่อยู่/เบอร์โทร หรือจำนวน: ให้ตรวจจับเป็น ORDER และดึงข้อมูลลูกค้าออกมาให้ครบถ้วน
5. เรื่องการจัดส่ง: บอกว่า "ส่งฟรี" ได้เฉพาะแพ็กเกจที่ free_shipping = true เท่านั้น แพ็กเกจที่ free_shipping = false ห้ามบอกส่งฟรีเด็ดขาด
6. เรื่องของแถม: บอกของแถมเฉพาะแพ็กเกจที่ gift_quantity > 0 หรือมี free_gifts ระบุเท่านั้น
7. ทุกคำตอบต้องต่างจากคำตอบก่อนหน้า (ดูรายการ 🚫 ด้านบน) — ปรับคำพูดใหม่เสมอ

ข้อความล่าสุดของลูกค้าที่ต้องตอบ:
"${messageText}"
`;

      try {
        // Provider-aware AI call: capped by the timeout race inside
        // generateAiJson (primary model + fast retry) before any fallback.
        const { parsed, model: usedModel, latencyMs: aiLatencyMs } = await generateAiJson(promptContext, { temperature: 0.9, maxOutputTokens: 500 });
        const selectedModel = usedModel;

        let intent = parsed.intent === 'ORDER' || parsed.isOrderDetected ? 'ORDER' : 'QUESTION';
        let replyText = parsed.replyText || page.sequence?.step1_opening_text || 'สวัสดีค่ะ สอบถามข้อมูลสินค้าหรือโปรโมชั่นแจ้งได้เลยนะคะ 🙏';

        // Merge regex-extracted order info: if the AI missed the phone or
        // address but the customer clearly typed one, fill it in here so a
        // valid order is never lost to an AI oversight. (Only overwrite when
        // the regex actually found something — never blank AI-provided data.)
        const regexOrder = extractOrderInfo(messageText);
        parsed.orderData = { ...(parsed.orderData || {}) };
        if (regexOrder.phone_number) parsed.orderData.phone_number = regexOrder.phone_number;
        if (regexOrder.address) parsed.orderData.address = regexOrder.address;

        // Check if AI generated a repeated reply - regenerate ONCE with
        // different wording (more retries would double the reply latency).
        let regenerationCount = 0;
        const maxRegenerations = 1;
        while (isRepeatedReply(pageId, senderId, replyText) && regenerationCount < maxRegenerations) {
          addLog('INFO', senderId, pageId, `⚠️ ตรวจพบ AI ตอบข้อความซ้ำ กำลังสร้างคำตอบใหม่... (ครั้งที่ ${regenerationCount + 1})`, 'INFO');
          
          // Re-run AI with instruction to not repeat
          const freshPrompt = promptContext + `\n\n⚠️ สำคัญ: คุณเพิ่งตอบข้อความนี้ไปแล้ว กรุณาตอบด้วยวิธีอื่นที่แตกต่างกันอย่างชัดเจน อย่าใช้ประโยคเดิม`;

          try {
            const regenResult = await generateAiJson(freshPrompt, {
              temperature: 1.0,
              maxOutputTokens: 500,
              extraInstruction: 'สำคัญ: คุณเพิ่งตอบข้อความนี้ไปแล้ว กรุณาตอบด้วยวิธีอื่นที่แตกต่างกันอย่างชัดเจน อย่าใช้ประโยคเดิม'
            });
            const regenParsed: any = regenResult.parsed;
            replyText = regenParsed.replyText || replyText;
            intent = regenParsed.intent === 'ORDER' || regenParsed.isOrderDetected ? 'ORDER' : intent;
            regenerationCount++;
          } catch (regenErr) {
            addLog('AI_REPLY', senderId, pageId, `❌ ไม่สามารถสร้างคำตอบใหม่ได้: ${regenErr}`, 'ERROR');
            break;
          }
        }

        if (isRepeatedReply(pageId, senderId, replyText)) {
          addLog('AI_REPLY', senderId, pageId, `⚠️ ยังตรวจพบการตอบซ้ำหลังจากพยายาม ${regenerationCount} ครั้ง ใช้ fallback reply`, 'WARNING');
          replyText = `รบกวนสอบถามเพิ่มเติมหน่อยนะคะ ${adminName} ยินดีช่วยเหลือเรื่อง ${page.product?.product_name || 'สินค้า'} เต็มที่ค่ะ พิมพ์สิ่งที่อยากทราบมาได้เลยค่า 🙏`;
        }

        // Track this reply to prevent future repetitions
        addRecentReply(pageId, senderId, replyText);

        // Add Log of AI Closing response
        addLog(
          'AI_REPLY',
          senderId,
          pageId,
          `🤖 AI Closing (${selectedModel} | ${adminName} | ${aiLatencyMs}ms | intent:${intentHint}): "${replyText.substring(0, 100)}${replyText.length > 100 ? '...' : ''}"`,
          'SUCCESS',
          { fullReply: replyText, matchedProduct: page.product?.product_name || matchedProduct.product_name, model: selectedModel, regenerations: regenerationCount, aiLatencyMs, intentHint }
        );

        // Per-page reply delay (configurable). 300ms default reads as "typing"
        // to the customer without leaving them hanging; cap at 3000ms so a
        // misconfigured huge delay can never stall a conversation.
        const pageDelay = Math.min(Number(page.reply_delay_ms ?? 300), 3000);

        // Purchase-intent keywords: when the customer shows buying interest the
        // closing sales sequence fires immediately.
        const purchaseIntentKeywords = ['สนใจ', 'อยากได้', 'อยากซื้อ', 'ต้องการ', 'ซื้อ', 'ราคา', 'เท่าไหร่', 'เท่าไร', 'สั่ง', 'จอง', 'เอา', 'โอน', 'cod'];
        const hasPurchaseIntent = purchaseIntentKeywords.some(kw => messageText.toLowerCase().includes(kw));

        // Quick Reply buttons go to every NEW customer (first contact) and on
        // any message when the customer hasn't tapped one yet — not only when
        // order_count is 0 AND last_interaction is empty (that condition was
        // always false here because last_interaction was just set above).
        const shouldSendQuickReplies = page.quick_replies && page.quick_replies.length > 0;

        // Purchase intent => fire the closing sales sequence immediately
        // (customer said สนใจ/ราคา/สั่ง etc.) or on first contact.
        const shouldTriggerSalesSequence = (page.sales_sequence_auto_trigger && (isNewCustomer || hasPurchaseIntent)) || false;

        // Send the AI answer with human-like pacing
        await sleep(pageDelay);

        if (shouldSendQuickReplies) {
          await sendFacebookQuickReplies(page.page_access_token || '', senderId, replyText, page.quick_replies);
          addLog('INFO', senderId, pageId, `🔘 ส่ง Quick Reply ${page.quick_replies.length} ปุ่ม พร้อมข้อความตอบกลับ`, 'SUCCESS');
        } else {
          await sendFacebookMessage(page.page_access_token || '', senderId, replyText);
        }
        // Remember what we answered for the conversation memory + anti-repeat.
        pushHistory(pageId, senderId, 'admin', replyText);

        // Send configured sales sequence step
        const sequenceStep = shouldTriggerSalesSequence ? 1 : Math.min(6, Math.max(1, Number(parsed.sequenceStep) || 1));
        await sendConfiguredSequenceStep(page, senderId, sequenceStep);

        // If sales sequence auto-trigger is enabled, send full sequence (steps 1-6)
        if (shouldTriggerSalesSequence && page.sales_sequence_steps && page.sales_sequence_steps.length > 0) {
          addLog('INFO', senderId, pageId, `🚀 Sales Sequence Auto-Trigger: ส่งลำดับการขายทั้งหมด ${page.sales_sequence_steps.length} ขั้นตอน`, 'SUCCESS');
          for (const step of page.sales_sequence_steps) {
            if (step.step_number > 1) {
              await sleep(pageDelay);
              await sendConfiguredSequenceStep(page, senderId, step.step_number);
            }
          }
        }

        // If ORDER is detected
        if (intent === 'ORDER' || (parsed.orderData && (parsed.orderData.phone_number || parsed.orderData.address))) {
          const od = parsed.orderData || {};
          const qty = Number(od.quantity) || 1;
          const unitPrice = Number(od.unit_price) || Number(page.product?.display_price || matchedProduct.display_price) || 990;
          const totalAmount = od.total_amount || qty * unitPrice;
          const custName = (od.customer_name || customer.customer_name || '').trim();
          const phone = String(od.phone_number || customer.phone_number || '').replace(/\D/g, '');
          const address = (od.address || customer.address || '').trim();
          const hasCustomerName = custName.length >= 2 && !custName.startsWith('ลูกค้า Facebook');
          const hasValidOrderData = hasCustomerName && /^0\d{9}$/.test(phone) && address.length >= 10;

          if (!hasValidOrderData) {
            addLog('ORDER', senderId, pageId, '🟡 พบความต้องการสั่งซื้อ แต่ข้อมูลยังไม่ครบ จึงยังไม่สร้างออเดอร์', 'WARNING', { hasCustomerName, hasPhone: /^0\d{9}$/.test(phone), hasAddress: address.length >= 10 });
            persistData();
            return;
          }

          const newOrder: Order = {
            order_id: `ORD-${Date.now()}`,
            psid: senderId,
            customer_name: custName,
            phone_number: phone,
            shipping_address: address,
            items: `${page.product?.product_name || matchedProduct.product_name} ${qty} ชุด`,
            quantity: qty,
            total_amount: totalAmount,
            payment_status: 'PENDING',
            created_at: new Date().toISOString(),
            tracking_number: `TH${Math.floor(1000000000 + Math.random() * 9000000000)}FL`,
            page_id: pageId
          };

          db.orders.unshift(newOrder);

          // Update customer record
          customer.customer_name = custName;
          customer.phone_number = phone;
          customer.address = address;
          customer.status = 'ORDER_COMPLETED';
          customer.order_count = (customer.order_count || 0) + 1;
          customer.last_product_id = page.product?.product_id || matchedProduct.product_id;

          addLog('ORDER', senderId, pageId, `🎉 บันทึกคำสั่งซื้อใหม่! รหัส ${newOrder.order_id} ยอดรวม ฿${totalAmount.toLocaleString()}`, 'SUCCESS', newOrder);

          // Order Dispatch: รันเลขออเดอร์และส่งไป LINE/Telegram
          const dispatchNumber = await dbService.incrementDispatchCounter(pageId);
          newOrder.dispatch_number = dispatchNumber;

          // Dispatch formatted order message to configured channel
          try {
            const dispatchResult = await dispatchOrderToChannel(newOrder, page, dispatchNumber);
            addLog('ORDER', senderId, pageId, `📤 ส่งออเดอร์ #${dispatchNumber} ไป ${page.notification_channel || 'BOTH'} สำเร็จ`, 'SUCCESS', { dispatch_number: dispatchNumber, message_id: dispatchResult.messageId });
          } catch (dispatchErr: any) {
            addLog('ORDER', senderId, pageId, `❌ ส่งออเดอร์ไป LINE/Telegram ไม่สำเร็จ: ${dispatchErr.message}`, 'ERROR');
          }

          // Also dispatch order summary (legacy)
          await dispatchOrderSummary(newOrder, page);

          dbBridge.broadcastSSE('new_order', { order_id: newOrder.order_id, page_id: pageId, dispatch_number: dispatchNumber, customer_name: custName, total_amount: totalAmount });
        }

      } catch (aiErr: any) {
        console.error('Gemini AI execution error:', aiErr);
        // Short, relevant fallback — never dump the whole product sheet. A
        // small rotating set keeps repeated failures from reading as a stuck
        // record if the customer keeps messaging during an outage.
        const price = (page.product?.display_price || matchedProduct.display_price || 0).toLocaleString();
        const fallbackTemplates = [
          `ขออภัยค่ะ ระบบขัดข้องชั่วครู่ 🙏 ${page.product?.product_name || 'สินค้าของเรา'} ราคา ฿${price} สอบถามเพิ่มเติมได้เลยนะคะ แอดมินจะรีบตอบให้เร็วที่สุดค่ะ`,
          `🙏 ขออภัยด้วยนะคะ ตอนนี้ระบบตอบอัตโนมัติมีปัญหาชั่วคราว แอดมินจะรีบกลับมาตอบเร็วที่สุดค่ะ (สนใจ ${page.product?.product_name || 'สินค้า'} ราคา ฿${price})`,
          `สวัสดีค่ะ 🙏 ขอโทษที่ตอบช้า ระบบกำลังซ่อมบำรุงค่ะ ฝากข้อความไว้ได้เลยนะคะ แอดมินจะรีบตอบให้เองค่ะ`
        ];
        const fallbackReply = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];
        addLog('AI_REPLY', senderId, pageId, `🤖 ตอบกลับแบบสำรอง (AI Error: ${aiErr.message})`, 'INFO');
        await sleep(Math.min(Number(page.reply_delay_ms ?? 300), 500));
        await sendFacebookMessage(page.page_access_token || '', senderId, fallbackReply);
        await sendConfiguredSequenceStep(page, senderId, 1);
      }

      persistData();

    } catch (err: any) {
      console.error('[FB Webhook POST] Error processing webhook:', err);
      addLog('INFO', 'SYSTEM', 'SYSTEM', `เกิดข้อผิดพลาดในการประมวลผล Webhook: ${err.message}`, 'ERROR');
    }
  };

  app.post('/webhook/facebook', handleWebhookPost);
  app.post('/webhooks/facebook', handleWebhookPost);
  app.post('/api/webhook/facebook', handleWebhookPost);
  app.post('/api/webhooks/facebook', handleWebhookPost);

  // =====================================================================
  // REAL INBOX & COMMENT POLLING ENGINE
  // Even when Meta webhook events never arrive (not subscribed / network),
  // every active page must still answer real inbox messages and moderate
  // real comments. We pull straight from the Graph API on an interval and
  // route each new event through the exact same pipeline above.
  // =====================================================================
  const fakeRes = () => ({ status: () => ({ json: () => {} }), sendStatus: () => {} } as any);

  async function dispatchSyntheticEvent(body: any) {
    try {
      await handleWebhookPost({ body, isInternal: true } as any, fakeRes());
    } catch (err: any) {
      addLog('INFO', 'SYSTEM', 'SYSTEM', `Polling dispatch error: ${err.message}`, 'ERROR');
    }
  }

  // Pull latest Messenger conversations for a page; every new customer
  // message is answered through the normal AI reply flow.
  // Stale-message cutoff: messages older than this were probably already
  // answered before a restart/reconnect — replying to them feels broken and
  // wastes the reply window on old chats instead of fresh customer messages.
  const POLL_MESSAGE_MAX_AGE_MS = 10 * 60 * 1000;
  async function pollPageInbox(page: PageConfig) {
    const rawToken = decryptToken(page.page_access_token || '');
    if (!rawToken?.startsWith('EAA')) return { success: false, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/conversations?platform=messenger&fields=participants,updated_time,messages.limit(4){id,from,message,created_time}&limit=15&access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (data.error) throw new Error(data.error.message || 'Graph API error');
      let dispatched = 0;
      for (const convo of (data.data || [])) {
        const messages: any[] = convo.messages?.data || [];
        // Graph returns newest-first; reverse so replies follow real order.
        for (const msg of [...messages].reverse()) {
          if (!msg?.id || !msg.from || msg.from.id === page.page_id) continue; // skip page's own messages
          if (!msg.message || processedMessageIds.has(msg.id)) continue;
          // Skip stale messages so the bot only ever answers fresh chats.
          const msgTime = Date.parse(msg.created_time) || 0;
          if (msgTime && Date.now() - msgTime > POLL_MESSAGE_MAX_AGE_MS) {
            rememberId(processedMessageIds, msg.id); // mark seen, never answer
            continue;
          }
          dispatched++;
          await dispatchSyntheticEvent({
            object: 'page',
            entry: [{
              id: page.page_id,
              messaging: [{
                sender: { id: msg.from.id },
                message: { mid: msg.id, text: msg.message },
                timestamp: Date.parse(msg.created_time) || Date.now()
              }]
            }]
          });
        }
      }
      if (dispatched > 0) {
        addLog('INFO', 'INBOX_POLL', page.page_id, `📥 ดูดข้อความ Inbox จริง: พบข้อความใหม่ ${dispatched} รายการ และตอบกลับแล้ว`, 'SUCCESS');
      }
      return { success: true, dispatched };
    } catch (err: any) {
      addLog('INFO', 'INBOX_POLL', page.page_id, `❌ ดูดข้อความ Inbox ไม่สำเร็จ: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  // Pull real comments from the page feed; each new comment goes through the
  // same moderation + auto-reply + inbox-invite flow as webhook events.
  async function scrapePageComments(page: PageConfig) {
    const rawToken = decryptToken(page.page_access_token || '');
    if (!rawToken?.startsWith('EAA')) return { success: false, error: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' };
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/feed?fields=id,message,permalink_url,comments.limit(50).order(chronological){id,message,from,created_time}&limit=8&access_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (data.error) throw new Error(data.error.message || 'Graph API error');
      let scannedPosts = 0;
      let newComments = 0;
      for (const post of (data.data || [])) {
        scannedPosts++;
        for (const comment of (post.comments?.data || [])) {
          if (!comment?.id || comment.from?.id === page.page_id) continue; // skip page's own replies
          if (processedCommentIds.has(comment.id)) continue;
          // Skip stale comments (older than 1 hour) — they were likely
          // handled before; answering them now confuses customers.
          const cmtTime = Date.parse(comment.created_time) || 0;
          if (cmtTime && Date.now() - cmtTime > 60 * 60 * 1000) {
            rememberId(processedCommentIds, comment.id);
            continue;
          }
          newComments++;
          await dispatchSyntheticEvent({
            object: 'page',
            entry: [{
              id: page.page_id,
              changes: [{
                field: 'feed',
                value: {
                  item: 'comment',
                  verb: 'add',
                  from: { id: comment.from?.id || 'COMMENT_USER', name: comment.from?.name || '' },
                  message: comment.message || '',
                  comment_id: comment.id,
                  post_id: post.id,
                  created_time: comment.created_time
                }
              }]
            }]
          });
        }
      }
      if (newComments > 0) {
        addLog('COMMENT', 'COMMENT_SCRAPER', page.page_id, `🧲 ดูดคอมเมนต์จริงจาก ${scannedPosts} โพสต์: พบคอมเมนต์ใหม่ ${newComments} รายการ`, 'SUCCESS');
      }
      return { success: true, scannedPosts, newComments };
    } catch (err: any) {
      addLog('INFO', 'COMMENT_SCRAPER', page.page_id, `❌ ดูดคอมเมนต์จริงไม่สำเร็จ: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  }

  // Manual trigger: scrape real comments right now (all active pages or one page)
  app.post('/api/facebook/scrape-comments', async (req: Request, res: Response) => {
    const { page_id } = req.body || {};
    const targets = db.pages.filter(p => (page_id ? p.page_id === page_id : p.is_active && p.auto_reply));
    if (!targets.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจที่พร้อมดูดคอมเมนต์ (ต้องเปิดใช้งานเพจและเชื่อมต่อ Page Access Token แล้ว)' });
    }
    const results: any[] = [];
    for (const page of targets) {
      const r = await scrapePageComments(page);
      results.push({ page_id: page.page_id, page_name: page.page_name, ...r });
    }
    const totalNew = results.reduce((sum, r) => sum + (r.newComments || 0), 0);
    res.json({
      success: true,
      message: totalNew > 0
        ? `🧲 ดูดคอมเมนต์จริงสำเร็จ: พบคอมเมนต์ใหม่ ${totalNew} รายการ ระบบตอบกลับตามกฎที่ตั้งไว้แล้ว`
        : '✅ ดูดคอมเมนต์จริงสำเร็จ: ยังไม่มีคอมเมนต์ใหม่เข้ามาในตอนนี้',
      results
    });
  });

  // Manual trigger: pull real inbox messages right now
  app.post('/api/facebook/poll-inbox', async (req: Request, res: Response) => {
    const { page_id } = req.body || {};
    const targets = db.pages.filter(p => (page_id ? p.page_id === page_id : p.is_active && p.auto_reply));
    if (!targets.length) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจที่พร้อมดึงข้อความ (ต้องเปิดใช้งานเพจและเชื่อมต่อ Page Access Token แล้ว)' });
    }
    const results: any[] = [];
    for (const page of targets) {
      const r = await pollPageInbox(page);
      results.push({ page_id: page.page_id, page_name: page.page_name, ...r });
    }
    const total = results.reduce((sum, r) => sum + (r.dispatched || 0), 0);
    res.json({
      success: true,
      message: total > 0 ? `📥 พบข้อความใหม่ ${total} รายการ และระบบตอบกลับแล้ว` : '✅ ดึงข้อความสำเร็จ: ยังไม่มีข้อความใหม่ในตอนนี้',
      results
    });
  });

  // Chat Inbox API: Fetch conversations for a page (for admin reply UI)
  app.get('/api/facebook/inbox', async (req: Request, res: Response) => {
    const page_id = req.query.page_id as string;
    if (!page_id) {
      return res.status(400).json({ success: false, message: 'ต้องระบุ page_id' });
    }
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });
    }
    const rawToken = decryptToken(page.page_access_token || '');
    if (!rawToken?.startsWith('EAA')) {
      return res.status(400).json({ success: false, message: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' });
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/conversations?platform=messenger&fields=participants,updated_time,messages.limit(50){id,from,message,created_time,attachments}&limit=25&access_token=${encodeURIComponent(rawToken)}`;
      const res2 = await fetch(url);
      const data: any = await res2.json();
      if (data.error) {
        addLog('INFO', 'INBOX_API', page_id, `❌ ดึง Inbox ไม่สำเร็จ: ${data.error.message}`, 'ERROR');
        return res.status(502).json({ success: false, error: data.error });
      }
      // Group messages by participant (customer)
      const conversations: any[] = (data.data || []).map((convo: any) => {
        const messages: any[] = (convo.messages?.data || []).reverse();
        const otherParticipant = convo.participants?.data?.find((p: any) => p.id !== page_id);
        return {
          thread_id: convo.id,
          participant: otherParticipant || { id: 'unknown', name: 'ไม่ทราบชื่อ' },
          updated_time: convo.updated_time,
          messages: messages.map((m: any) => ({
            id: m.id,
            from: m.from,
            message: m.message || '',
            created_time: m.created_time,
            is_from_page: m.from?.id === page_id,
            attachments: m.attachments?.data || []
          }))
        };
      });
      addLog('INFO', 'INBOX_API', page_id, `📥 ดึง Inbox สำเร็จ: ${conversations.length} บทสนทนา`, 'SUCCESS');
      res.json({ success: true, conversations, page_id, page_name: page.page_name });
    } catch (err: any) {
      addLog('INFO', 'INBOX_API', page_id, `❌ ดึง Inbox ไม่สำเร็จ: ${err.message}`, 'ERROR');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Send Message API: Admin sends message to customer via page
  app.post('/api/facebook/send-message', async (req: Request, res: Response) => {
    const { page_id, recipient_id, message } = req.body || {};
    if (!page_id || !recipient_id || !message) {
      return res.status(400).json({ success: false, message: 'ต้องระบุ page_id, recipient_id และ message' });
    }
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ' });
    }
    const rawToken = decryptToken(page.page_access_token || '');
    if (!rawToken?.startsWith('EAA')) {
      return res.status(400).json({ success: false, message: 'PAGE_ACCESS_TOKEN_NOT_CONFIGURED' });
    }
    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(rawToken)}`;
      const fetchRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: message }
        })
      });
      const data: any = await fetchRes.json();
      if (data.error) {
        const code = Number(data.error.code || 0);
        const subcode = Number(data.error.error_subcode || 0);
        // 10/551/2018108: Messenger 24-hour window closed or no open thread
        const hint = (code === 10 || code === 551 || subcode === 2018108)
          ? ' Messenger เปิดให้ตอบกลับได้ภายใน 24 ชม. หลังลูกค้าทักเท่านั้น — รอลูกค้าทักก่อน หรือใช้ Message Tag ที่อนุญาต'
          : '';
        addLog('INFO', 'SEND_MSG', page_id, `❌ ส่งข้อความไม่สำเร็จ: ${data.error.message}${hint}`, 'ERROR');
        return res.status(502).json({ success: false, error: data.error, message: data.error.message + hint });
      }
      addLog('INFO', 'SEND_MSG', page_id, `✅ ส่งข้อความถึง ${recipient_id} สำเร็จ`, 'SUCCESS');
      // Record in the local inbox (Postgres) so the conversation stays visible
      try {
        await dbService.addChatMessage(page_id, recipient_id, 'admin', message);
        await dbService.recordOutgoingMessage(page_id, recipient_id, message.slice(0, 200));
        dbBridge.broadcastSSE('new_message', { page_id, sender_id: recipient_id, role: 'admin', text: message.slice(0, 200), timestamp: new Date().toISOString() }, page_id);
      } catch { /* non-critical */ }
      res.json({ success: true, message_id: data.message_id });
    } catch (err: any) {
      addLog('INFO', 'SEND_MSG', page_id, `❌ ส่งข้อความไม่สำเร็จ: ${err.message}`, 'ERROR');
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Database Data APIs (Read & Write for all Google Sheets tables)
  app.get('/api/data', (req: Request, res: Response) => {
    const sanitizedPages = db.pages.map(p => ({
      ...p,
      page_access_token: maskToken(p.page_access_token),
      telegram_bot_token: maskToken(p.telegram_bot_token || ''),
      line_notify_token: maskToken(p.line_notify_token || '')
    }));

    res.json({
      pages: sanitizedPages,
      amulet: db.amulet,
      china: db.china,
      otop: db.otop,
      agriculture: db.agriculture,
      customers: db.customers,
      orders: db.orders,
      logs: db.logs.slice(0, 60),
      emergencyAlerts: db.emergencyAlerts
    });
  });

  // Full Database Backup Export API
  app.get('/api/backup/export', (req: Request, res: Response) => {
    const backupData = {
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      counts: {
        pages: db.pages.length,
        customers: db.customers.length,
        orders: db.orders.length,
        amulet: db.amulet.length,
        china: db.china.length,
        otop: db.otop.length,
        agriculture: db.agriculture.length
      },
      data: {
        pages: db.pages.map(p => ({ ...p, page_access_token: maskToken(p.page_access_token) })),
        amulet: db.amulet,
        china: db.china,
        otop: db.otop,
        agriculture: db.agriculture,
        customers: db.customers,
        orders: db.orders
      }
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=SuperAI_CRM_Backup_${Date.now()}.json`);
    res.json(backupData);
  });

  // Full Database Restore API
  app.post('/api/backup/restore', (req: Request, res: Response) => {
    try {
      const { data, mode } = req.body; // mode: 'overwrite' | 'merge'
      if (!data) {
        return res.status(400).json({ error: 'No backup data provided' });
      }

      if (mode === 'merge') {
        if (data.customers && Array.isArray(data.customers)) {
          for (const newCust of data.customers) {
            const idx = db.customers.findIndex(c => c.phone_number === newCust.phone_number || (c.psid && c.psid === newCust.psid));
            if (idx >= 0) {
              db.customers[idx] = { ...db.customers[idx], ...newCust };
            } else {
              db.customers.push(newCust);
            }
          }
        }
        if (data.orders && Array.isArray(data.orders)) {
          for (const newOrd of data.orders) {
            const idx = db.orders.findIndex(o => o.order_id === newOrd.order_id);
            if (idx >= 0) {
              db.orders[idx] = { ...db.orders[idx], ...newOrd };
            } else {
              db.orders.push(newOrd);
            }
          }
        }
        if (data.pages && Array.isArray(data.pages)) {
          for (const newPage of data.pages) {
            const idx = db.pages.findIndex(p => p.page_id === newPage.page_id);
            if (idx >= 0) db.pages[idx] = newPage;
            else db.pages.push(newPage);
          }
        }
      } else {
        // Overwrite mode
        if (data.pages && Array.isArray(data.pages)) db.pages = data.pages;
        if (data.customers && Array.isArray(data.customers)) db.customers = data.customers;
        if (data.orders && Array.isArray(data.orders)) db.orders = data.orders;
        if (data.amulet && Array.isArray(data.amulet)) db.amulet = data.amulet;
        if (data.china && Array.isArray(data.china)) db.china = data.china;
        if (data.otop && Array.isArray(data.otop)) db.otop = data.otop;
        if (data.agriculture && Array.isArray(data.agriculture)) db.agriculture = data.agriculture;
      }

      addLog('INFO', 'USER', 'SYSTEM', `🔄 กู้คืนฐานข้อมูล (${mode === 'merge' ? 'Merge รวมข้อมูล' : 'Overwrite เขียนทับ'}) สำเร็จ ลูกค้า: ${db.customers.length}, ออเดอร์: ${db.orders.length}`, 'SUCCESS');

      res.json({
        success: true,
        counts: {
          customers: db.customers.length,
          orders: db.orders.length,
          pages: db.pages.length
        }
      });
    } catch (err: any) {
      console.error('Backup restore error:', err);
      res.status(500).json({ error: err.message || 'Restore failed' });
    }
  });

  // AI CRM Smart Parser Endpoint (Gemini Auto-Extraction for Bulk Copy-Paste / Excel)
  app.post('/api/ai/parse-crm', async (req: Request, res: Response) => {
    try {
      const { rawText, rowsData } = req.body;
      const textToParse = rawText || (Array.isArray(rowsData) ? JSON.stringify(rowsData.slice(0, 50)) : '');

      if (!textToParse || !textToParse.trim()) {
        return res.status(400).json({ error: 'Text or data is required for parsing' });
      }

      const ai = getGemini();
      const parsePrompt = `
คุณคือ AI ผู้เชี่ยวชาญการวิเคราะห์ข้อมูลลูกค้าและคำสั่งซื้อ (CRM Data Parser) สำหรับธุรกิจออนไลน์ไทย
งานของคุณ:
อ่านข้อมูลข้อความหรือตารางที่ผู้ใช้คัดลอกมาวาง ซึ่งอาจเป็นรายชื่อลูกค้า เบอร์โทร ที่อยู่ รายการสินค้าที่สั่ง วันที่สั่งซื้อ หรือเลขพัสดุ
ให้สกัด (Extract) ออกมาเป็นโครงสร้างข้อมูลมาตรฐานทีละรายการอย่างแม่นยำที่สุด:

กฎการทำงาน:
1. customer_name: ชื่อ-นามสกุลลูกค้า (เช่น "คุณสมศักดิ์ วันดี" หรือ "สมศักดิ์")
2. phone_number: เบอร์โทรศัพท์ (กรองเอาเฉพาะตัวเลข 9-10 หลัก เช่น "0812345678")
3. address: ที่อยู่จัดส่งพัสดุพร้อมรหัสไปรษณีย์
4. items: รายการสินค้าที่ลูกค้าสั่งหรือสนใจ (เช่น "เหรียญหลวงปู่ทวด 1 องค์", "ปุ๋ยน้ำ 2 ขวด", "เครื่องฟอกอากาศ")
5. quantity: จำนวนชิ้น (ตัวเลข default 1)
6. total_amount: ยอดเงินรวมที่จ่ายหรือเก็บเงินปลายทาง (ตัวเลข ถ้าไม่มีให้คำนวณหรือใส่ 0)
7. order_date: วันที่สั่งซื้อ (ISO string หรือ YYYY-MM-DD ถ้าไม่มีให้ใช้วันนี้)
8. tracking_number: เลขพัสดุ (เช่น TH123456789FL หรือ Kerry/Flash tracking ถ้ามี ถ้าไม่มีให้เว้นว่างไว้)
9. category: หมวดหมู่สินค้า ('AMULET' | 'CHINA' | 'OTOP' | 'AGRICULTURE' หรือเดาจากชื่อสินค้า)
10. notes: บันทึกพิเศษหรือความต้องการเพิ่มเติม
11. tier: ระดับลูกค้า ('NORMAL' | 'VIP' | 'SUPER_VIP') ประเมินจากยอดซื้อหรือประวัติ

ข้อมูลที่ส่งมาให้วิเคราะห์:
"""
${textToParse}
"""
`;

      const response = await ai.models.generateContent({
        model: resolveAiModel(),
        contents: parsePrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              parsedCount: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              customers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    customer_name: { type: Type.STRING },
                    phone_number: { type: Type.STRING },
                    address: { type: Type.STRING },
                    items: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    total_amount: { type: Type.NUMBER },
                    order_date: { type: Type.STRING },
                    tracking_number: { type: Type.STRING },
                    category: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    tier: { type: Type.STRING }
                  },
                  required: ['customer_name', 'phone_number']
                }
              }
            },
            required: ['parsedCount', 'customers']
          }
        }
      });

      const parsedResult: any = JSON.parse(response.text?.trim() || '{"customers":[], "parsedCount": 0}');
      addLog('INFO', 'AI_CRM', 'SYSTEM', `🤖 AI Smart Parser สกัดข้อมูลสำเร็จ ${parsedResult.customers?.length || 0} รายการ`, 'SUCCESS');
      res.json(parsedResult);
    } catch (err: any) {
      console.error('AI Parse CRM error:', err);
      res.status(500).json({ error: err.message || 'AI parsing failed' });
    }
  });

  // AI Admin Copilot Chatbot Endpoint (Floating Assistant on Bottom-Right)
  app.post('/api/ai/copilot', async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const totalRevenue = db.orders.reduce((sum, o) => sum + (o.payment_status !== 'CANCELLED' ? o.total_amount : 0), 0);
      const pendingOrders = db.orders.filter(o => o.payment_status === 'PENDING');
      const paidOrders = db.orders.filter(o => o.payment_status === 'PAID' || o.payment_status === 'SHIPPED');
      const unresolvedAlerts = db.emergencyAlerts.filter(e => !e.is_resolved);

      // Category and product breakdown for sales summary
      const categorySummary: Record<string, any> = {
        'ของจีน / ไอที': { items: {}, revenue: 0, orderCount: 0, units: 0, inquiries: 0 },
        'พระเครื่อง / วัตถุมงคล': { items: {}, revenue: 0, orderCount: 0, units: 0, inquiries: 0 },
        'โอทอป OTOP / ชุมชน': { items: {}, revenue: 0, orderCount: 0, units: 0, inquiries: 0 },
        'เกษตร / ปุ๋ยยาชีวภาพ': { items: {}, revenue: 0, orderCount: 0, units: 0, inquiries: 0 }
      };

      db.pages.forEach(p => {
        const catKey = p.category === 'CHINA' ? 'ของจีน / ไอที' :
                       p.category === 'AMULET' ? 'พระเครื่อง / วัตถุมงคล' :
                       p.category === 'OTOP' ? 'โอทอป OTOP / ชุมชน' : 'เกษตร / ปุ๋ยยาชีวภาพ';
        if (categorySummary[catKey]) {
          categorySummary[catKey].inquiries += (p.inquiries_count || 15);
        }
      });

      let totalItemsCount = 0;
      db.orders.forEach(o => {
        const amt = o.total_amount || 0;
        const qty = o.quantity || 1;
        totalItemsCount += qty;
        let catKey = 'ของจีน / ไอที';
        if (o.page_id === 'AMULET_PAGE_ID' || o.items?.includes('หลวงปู่ทวด') || o.items?.includes('AML')) {
          catKey = 'พระเครื่อง / วัตถุมงคล';
        } else if (o.page_id === 'OTOP_PAGE_ID' || o.items?.includes('ผ้าไหม') || o.items?.includes('OTP')) {
          catKey = 'โอทอป OTOP / ชุมชน';
        } else if (o.page_id === 'AGRI_PAGE_ID' || o.items?.includes('ปุ๋ย') || o.items?.includes('AGR')) {
          catKey = 'เกษตร / ปุ๋ยยาชีวภาพ';
        }

        const itemName = o.items || 'สินค้าทั่วไป';
        if (!categorySummary[catKey].items[itemName]) {
          categorySummary[catKey].items[itemName] = {
            prices: {},
            subtotal: 0,
            count: 0,
            units: 0
          };
        }

        const priceKey = `${amt}.-`;
        const method = o.payment_status === 'PAID' ? 'โอน' : 'COD';
        const priceTierKey = `(${amt}.-) ${method}`;
        if (!categorySummary[catKey].items[itemName].prices[priceTierKey]) {
          categorySummary[catKey].items[itemName].prices[priceTierKey] = 0;
        }
        categorySummary[catKey].items[itemName].prices[priceTierKey] += 1;
        categorySummary[catKey].items[itemName].subtotal += amt;
        categorySummary[catKey].items[itemName].count += 1;
        categorySummary[catKey].items[itemName].units += qty;

        categorySummary[catKey].revenue += amt;
        categorySummary[catKey].orderCount += 1;
        categorySummary[catKey].units += qty;
      });

      const totalInquiriesAll = db.pages.reduce((sum, p) => sum + (p.inquiries_count || 20), 0);
      const overallConversionRate = totalInquiriesAll > 0 ? ((db.orders.length / totalInquiriesAll) * 100).toFixed(1) : '85.5';

      const copilotContext = `
คุณคือ "Vorakamol SuperAI Copilot" — ผู้ช่วย AI อัจฉริยะส่วนตัวของเจ้าของธุรกิจและแอดมินระบบ
คุณสามารถสั่งการ, วิเคราะห์ข้อมูลธุรกิจ, ตรวจสอบยอดขาย, รายงานปัญหาฉุกเฉิน, ค้นหาลูกค้า, และช่วยร่างข้อความตอบลูกค้าหรือเทเลเซลได้อย่างยอดเยี่ยม

บริบทข้อมูลสดปัจจุบันของระบบ (Live Context):
- จำนวนเพจทั้งหมด: ${db.pages.length} เพจ (${db.pages.map(p => p.page_name).join(', ')})
- จำนวนลูกค้าทั้งหมดใน CRM: ${db.customers.length} คน
- จำนวนคำสั่งซื้อทั้งหมด: ${db.orders.length} ออเดอร์
- จำนวนสินค้าทั้งหมดที่ขายได้: ${totalItemsCount} ชิ้น
- ยอดขายรวม: ฿${totalRevenue.toLocaleString()}
- จำนวนคนทักรวม (Total Inquiries): ${totalInquiriesAll} คน
- อัตราปิดการขายเฉลี่ย (Conversion Rate): ${overallConversionRate}%
- ออเดอร์ที่ชำระ/ส่งแล้ว: ${paidOrders.length} รายการ
- ออเดอร์รอจัดส่ง/รอชำระ (Pending): ${pendingOrders.length} รายการ
- ปัญหาหรือการแจ้งเตือนวิกฤต (Emergency / Crisis): ${unresolvedAlerts.length} รายการ
  ${unresolvedAlerts.map(a => `- [${a.type}] เพจ ${a.page_id}: "${a.threat_text}"`).join('\n')}
- สินค้าแยกตามหมวด:
  * พระเครื่อง: ${db.amulet.length} รายการ (${db.amulet.map(a => a.product_name).join(', ')})
  * จีน/ไอที: ${db.china.length} รายการ (${db.china.map(c => c.product_name).join(', ')})
  * โอทอป OTOP: ${db.otop.length} รายการ (${db.otop.map(o => o.product_name).join(', ')})
  * เกษตร/ปุ๋ยยา: ${db.agriculture.length} รายการ (${db.agriculture.map(g => g.product_name).join(', ')})

โครงสร้างข้อมูลคำสั่งซื้อแยกตามหมวดหมู่และราคาสินค้า:
${JSON.stringify(categorySummary, null, 2)}

กฎเหล็กสำคัญสำหรับการสรุปยอดขาย / ปิดยอด (Sales Closing Summary Format):
หากผู้ใช้ขอให้ "สรุปยอด", "ปิดยอด", "รายงานยอดขาย", หรือถามยอดขายประจำวัน/แยกหมวดสินค้า ให้คุณจัดรูปแบบข้อความสรุปตามแพทเทิร์นเป๊ะๆ ดังต่อไปนี้:

ตัวอย่างแพทเทิร์นที่ต้องตอบ:
ปิดยอด[ชื่อหมวดหมู่ หรือ รวมทุกหมวด] [ระบุวันที่ เช่น 24 ส.ค. 69]

[ชื่อสินค้า เช่น เสาอากาศ / เครื่องฟอกอากาศ]
([ราคา].-) [จำนวน] ออเดอร์ [COD/โอน]
([ราคา].-) [จำนวน] ออเดอร์ [COD/โอน]
ยอดขาย[ชื่อสินค้า] [ยอดเงินรวมของสินค้านั้น] บาท

[ชื่อสินค้าถัดไป เช่น ชุดบล็อก / หลวงปู่ทวด]
([ราคา].-) [จำนวน] ออเดอร์ [COD/โอน]
ยอดขาย[ชื่อสินค้า] [ยอดเงินรวมของสินค้านั้น] บาท

━━━━━━━━━━━━━━━━━━━━
📊 สรุปรวมทั้งหมด
💰 ยอดขายรวม: [ยอดเงินรวมทั้งหมด] บาท
📦 จำนวนคำสั่งซื้อ: [จำนวนออเดอร์รวม] ออเดอร์
🛍️ จำนวนสินค้า: [จำนวนชิ้นรวม] ชิ้น
👥 จำนวนคนทัก: [จำนวนคนทัก] คน
🎯 เปอร์เซ็นต์ปิดการขาย: [xx.x]%

ลักษณะการตอบอื่นๆ:
1. ตอบสุภาพ ชัดเจน มีความรู้จริงเรื่องธุรกิจปิดการขาย แนะนำขั้นตอนอย่างเป็นมืออาชีพ
2. หากถามเรื่องปัญหา ให้รายงานสถานะระบบ ออเดอร์ค้าง หรือข้อความวิกฤตอย่างรวดเร็ว
3. หากผู้ใช้ถามสั้นๆ ให้ตอบกระชับ ตรงประเด็น
`;

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: resolveAiModel(),
        contents: [
          { text: copilotContext },
          ...(history && Array.isArray(history)
            ? history.slice(-6).map((h: any) => ({
                text: `${h.role === 'user' ? 'ผู้ใช้' : 'AI Copilot'}: ${h.text}`
              }))
            : []),
          { text: `คำถามหรือคำสั่งจากผู้ใช้: "${message}"` }
        ]
      });

      const reply = response.text?.trim() || 'ขออภัยค่ะ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้งนะคะ';

      res.json({
        reply,
        systemStats: {
          totalRevenue,
          totalCustomers: db.customers.length,
          totalOrders: db.orders.length,
          pendingOrders: pendingOrders.length,
          unresolvedAlertsCount: unresolvedAlerts.length
        }
      });
    } catch (err: any) {
      console.error('AI Copilot error:', err);
      res.status(500).json({ error: err.message || 'AI Copilot error' });
    }
  });

  // Dedicated AI Sales Summary & Daily Closing Generator API
  app.post('/api/ai/sales-summary-report', async (req: Request, res: Response) => {
    try {
      const { dateStr, category = 'ALL', customOrders, customDateTitle } = req.body;

      // Select target orders
      let targetOrders = customOrders && Array.isArray(customOrders) && customOrders.length > 0
        ? customOrders
        : db.orders;

      if (dateStr && dateStr !== 'ALL') {
        targetOrders = targetOrders.filter((o: any) => o.created_at?.startsWith(dateStr));
      }

      if (category && category !== 'ALL') {
        targetOrders = targetOrders.filter((o: any) => {
          if (category === 'AMULET' && (o.page_id === 'AMULET_PAGE_ID' || o.items?.includes('AML') || o.items?.includes('หลวงปู่ทวด'))) return true;
          if (category === 'CHINA' && (o.page_id === 'CHINA_PAGE_ID' || o.items?.includes('CHN') || o.items?.includes('ฟอกอากาศ') || o.items?.includes('เสาอากาศ') || o.items?.includes('ชุดบล็อก'))) return true;
          if (category === 'OTOP' && (o.page_id === 'OTOP_PAGE_ID' || o.items?.includes('OTP') || o.items?.includes('ผ้าไหม'))) return true;
          if (category === 'AGRICULTURE' && (o.page_id === 'AGRI_PAGE_ID' || o.items?.includes('AGR') || o.items?.includes('ปุ๋ย'))) return true;
          return false;
        });
      }

      // Group by Category -> Product -> Price Tier
      const categoryMap: Record<string, Record<string, { prices: Record<string, number>; subtotal: number; units: number; count: number }>> = {};

      let grandTotalRevenue = 0;
      let grandTotalOrders = targetOrders.length;
      let grandTotalUnits = 0;

      targetOrders.forEach((o: any) => {
        const amt = o.total_amount || 0;
        const qty = o.quantity || 1;
        grandTotalRevenue += amt;
        grandTotalUnits += qty;

        // Determine category label
        let catLabel = 'สินค้าของจีน / Gadget';
        if (o.page_id === 'AMULET_PAGE_ID' || o.items?.includes('หลวงปู่ทวด') || o.items?.includes('AML')) {
          catLabel = 'หมวดพระเครื่อง / วัตถุมงคล';
        } else if (o.page_id === 'OTOP_PAGE_ID' || o.items?.includes('ผ้าไหม') || o.items?.includes('OTP')) {
          catLabel = 'หมวดโอทอป OTOP / ของดีชุมชน';
        } else if (o.page_id === 'AGRI_PAGE_ID' || o.items?.includes('ปุ๋ย') || o.items?.includes('AGR')) {
          catLabel = 'หมวดเกษตร / ปุ๋ยยาชีวภาพ';
        }

        if (!categoryMap[catLabel]) {
          categoryMap[catLabel] = {};
        }

        // Clean product name
        const rawItem = o.items || 'สินค้าทั่วไป';
        let prodName = rawItem;
        if (rawItem.includes('เสาอากาศ')) prodName = 'เสาอากาศดิจิตอล';
        else if (rawItem.includes('ชุดบล็อก')) prodName = 'ชุดบล็อกประแจ';
        else if (rawItem.includes('ฟอกอากาศ')) prodName = 'เครื่องฟอกอากาศ Smart H13';
        else if (rawItem.includes('หลวงปู่ทวด')) prodName = 'เหรียญหลวงปู่ทวด วัดช้างให้';
        else if (rawItem.includes('ผ้าไหม')) prodName = 'ผ้าไหมแพรวากาฬสินธุ์';
        else if (rawItem.includes('ปุ๋ย')) prodName = 'ปุ๋ยน้ำอะมิโนพลัส';

        if (!categoryMap[catLabel][prodName]) {
          categoryMap[catLabel][prodName] = {
            prices: {},
            subtotal: 0,
            units: 0,
            count: 0
          };
        }

        const method = o.payment_status === 'PAID' ? 'โอน' : 'COD';
        const tierKey = `(${amt.toLocaleString()}.-) ${method}`;

        if (!categoryMap[catLabel][prodName].prices[tierKey]) {
          categoryMap[catLabel][prodName].prices[tierKey] = 0;
        }
        categoryMap[catLabel][prodName].prices[tierKey] += 1;
        categoryMap[catLabel][prodName].subtotal += amt;
        categoryMap[catLabel][prodName].units += qty;
        categoryMap[catLabel][prodName].count += 1;
      });

      // Calculate inquiries & closing rate
      let relevantPages = db.pages;
      if (category && category !== 'ALL') {
        relevantPages = db.pages.filter(p => p.category === category);
      }
      const totalInquiries = relevantPages.reduce((sum, p) => sum + (p.inquiries_count || (grandTotalOrders > 0 ? Math.round(grandTotalOrders / 0.85) : 15)), 0);
      const conversionRate = totalInquiries > 0
        ? Math.min(100, Number(((grandTotalOrders / totalInquiries) * 100).toFixed(1)))
        : 88.5;

      // Format Date string in Thai (e.g. "9 ก.ค. 68" or "24 ส.ค. 69")
      const now = new Date();
      const thaiMonthsShort = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
      const dateTitle = customDateTitle || `${now.getDate()} ${thaiMonthsShort[now.getMonth()]} ${String(now.getFullYear() + 543).slice(-2)}`;

      const categoryTitle = category === 'CHINA' ? 'ของจีน' :
                            category === 'AMULET' ? 'พระเครื่อง' :
                            category === 'OTOP' ? 'โอทอป' :
                            category === 'AGRICULTURE' ? 'สินค้าเกษตร' : 'ทุกหมวดสินค้า';

      // Build structured text output
      let textOutput = `ปิดยอด${categoryTitle} ${dateTitle}\n\n`;

      Object.keys(categoryMap).forEach(cat => {
        const prods = categoryMap[cat];
        Object.keys(prods).forEach(prodName => {
          const pData = prods[prodName];
          textOutput += `${prodName}\n`;
          Object.keys(pData.prices).forEach(tierKey => {
            const count = pData.prices[tierKey];
            textOutput += `${tierKey.replace(' COD', '')} ${count} ออเดอร์ COD\n`;
          });
          textOutput += `ยอดขาย${prodName} ${pData.subtotal.toLocaleString()} บาท\n\n`;
        });
      });

      if (Object.keys(categoryMap).length === 0) {
        textOutput += `ไม่มีรายการคำสั่งซื้อในช่วงเวลาที่เลือก\n\n`;
      }

      textOutput += `━━━━━━━━━━━━━━━━━━━━\n`;
      textOutput += `📊 สรุปรวมผลประกอบการทั้งหมด\n`;
      textOutput += `💰 ยอดเงินรวม: ${grandTotalRevenue.toLocaleString()} บาท\n`;
      textOutput += `📦 จำนวนออเดอร์: ${grandTotalOrders} ออเดอร์\n`;
      textOutput += `🛍️ จำนวนสินค้า: ${grandTotalUnits} ชิ้น\n`;
      textOutput += `👥 จำนวนคนทัก: ${totalInquiries} คน\n`;
      textOutput += `🎯 เปอร์เซ็นต์ปิดการขาย: ${conversionRate}%\n`;

      addLog('INFO', 'AI_SUMMARY', 'SYSTEM', `📊 AI สร้างรายงานสรุปยอดขาย ${categoryTitle} (${grandTotalOrders} ออเดอร์ ยอด ฿${grandTotalRevenue.toLocaleString()}) สำเร็จ`, 'SUCCESS');

      res.json({
        success: true,
        summaryText: textOutput.trim(),
        stats: {
          categoryTitle,
          dateTitle,
          totalRevenue: grandTotalRevenue,
          totalOrders: grandTotalOrders,
          totalUnits: grandTotalUnits,
          totalInquiries,
          conversionRate,
          breakdown: categoryMap
        }
      });
    } catch (err: any) {
      console.error('AI Sales Summary error:', err);
      res.status(500).json({ error: err.message || 'Sales summary failed' });
    }
  });

  // Update specific collection in Database
  app.post('/api/data/update', (req: Request, res: Response) => {
    const { collection, data } = req.body;
    if (collection && Array.isArray(data)) {
      if (collection === 'pages') {
        db.pages = data.map((incomingPage: PageConfig) => {
          const existing = db.pages.find(p => p.page_id === incomingPage.page_id);
          let token = incomingPage.page_access_token || '';
          if (!token || token.includes('•••') || token.includes('••••')) {
            token = existing ? existing.page_access_token : '';
          } else if (token.startsWith('EAA') && !token.startsWith('enc:')) {
            token = encryptToken(token);
          }
          const protectSecret = (value: string | undefined, prior: string | undefined) => {
            if (!value || value.includes('•••') || value.includes('••••')) return prior || '';
            return value.startsWith('enc:') ? value : encryptToken(value);
          };
          return {
            ...incomingPage,
            page_access_token: token,
            telegram_bot_token: protectSecret(incomingPage.telegram_bot_token, existing?.telegram_bot_token),
            line_notify_token: protectSecret(incomingPage.line_notify_token, existing?.line_notify_token)
          };
        });
        syncCatalogFromPages();
      }
      else if (collection === 'amulet') { db.amulet = data; syncPagesFromCatalog('amulet'); }
      else if (collection === 'china') { db.china = data; syncPagesFromCatalog('china'); }
      else if (collection === 'otop') { db.otop = data; syncPagesFromCatalog('otop'); }
      else if (collection === 'agriculture') { db.agriculture = data; syncPagesFromCatalog('agriculture'); }
      else if (collection === 'customers') db.customers = data;
      else if (collection === 'orders') db.orders = data;

      addLog('INFO', 'USER', 'SYSTEM', `อัปเดตข้อมูลตาราง ${collection.toUpperCase()} จำนวน ${data.length} รายการ`, 'SUCCESS');
      persistData();
      return res.json({ success: true, count: data.length });
    }
    res.status(400).json({ error: 'Invalid collection or data' });
  });

  // ================================================================
  // SSE (Server-Sent Events) - Real-time Live Updates
  // ================================================================
  app.get('/api/events', (req: Request, res: Response) => {
    const pageId = req.query.page_id as string | undefined;
    const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

    dbBridge.addSSEClient(clientId, res, pageId);
    addLog('INFO', 'SSE', 'SYSTEM', `SSE client connected: ${clientId} (page: ${pageId || 'ALL'})`, 'INFO');
  });

  // ================================================================
  // Custom Buttons CRUD API
  // ================================================================
  app.get('/api/buttons', async (req: Request, res: Response) => {
    const pageId = req.query.page_id as string;
    if (!pageId) return res.status(400).json({ error: 'page_id required' });
    const buttons = await dbService.getCustomButtons(pageId);
    res.json({ success: true, buttons });
  });

  app.post('/api/buttons', async (req: Request, res: Response) => {
    const { page_id, title, payload, button_type, sort_order } = req.body;
    if (!page_id || !title) return res.status(400).json({ error: 'page_id and title required' });
    if (title.length > 20) return res.status(400).json({ error: 'Quick Reply title must be 20 characters or less' });

    // Verify the page exists before inserting (avoids FK constraint 500)
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(400).json({ error: 'Page not found. Please save the page first before adding buttons.' });

    try {
      const id = `btn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await dbService.addCustomButton({ id, page_id, title, payload: payload || title, button_type: button_type || 'QUICK_REPLY', sort_order: sort_order || 0 });

      // Also update in-memory page quick_replies
      const allButtons = await dbService.getCustomButtons(page_id);
      page.quick_replies = allButtons.map(b => ({ title: b.title, payload: b.payload }));
      persistData();
      dbBridge.broadcastSSE('buttons_updated', { page_id, buttons: allButtons }, page_id);
      res.json({ success: true, id });
    } catch (err: any) {
      addLog('ERROR', 'BUTTONS', 'SYSTEM', `Failed to add button: ${err?.message}`, 'ERROR');
      res.status(400).json({ error: `Unable to add button: ${err?.message || 'unknown error'}` });
    }
  });

  app.put('/api/buttons/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;
    if (updates.title && updates.title.length > 20) return res.status(400).json({ error: 'Quick Reply title must be 20 characters or less' });
    try {
      await dbService.updateCustomButton(id, updates);

      if (req.body.page_id) {
        const page = db.pages.find(p => p.page_id === req.body.page_id);
        if (page) {
          const allButtons = await dbService.getCustomButtons(req.body.page_id);
          page.quick_replies = allButtons.map(b => ({ title: b.title, payload: b.payload }));
          persistData();
          dbBridge.broadcastSSE('buttons_updated', { page_id: req.body.page_id, buttons: allButtons }, req.body.page_id);
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      addLog('ERROR', 'BUTTONS', 'SYSTEM', `Failed to update button ${id}: ${err?.message}`, 'ERROR');
      res.status(400).json({ error: `Unable to update button: ${err?.message || 'unknown error'}` });
    }
  });

  app.delete('/api/buttons/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const pageId = req.query.page_id as string;
    try {
      await dbService.deleteCustomButton(id);
      if (pageId) {
        const page = db.pages.find(p => p.page_id === pageId);
        if (page) {
          const allButtons = await dbService.getCustomButtons(pageId);
          page.quick_replies = allButtons.map(b => ({ title: b.title, payload: b.payload }));
          persistData();
          dbBridge.broadcastSSE('buttons_updated', { page_id: pageId, buttons: allButtons }, pageId);
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      addLog('ERROR', 'BUTTONS', 'SYSTEM', `Failed to delete button ${id}: ${err?.message}`, 'ERROR');
      res.status(400).json({ error: `Unable to delete button: ${err?.message || 'unknown error'}` });
    }
  });

  // ================================================================
  // Page Sorting & Filtering API
  // ================================================================
  app.get('/api/pages/sorted', (req: Request, res: Response) => {
    const sortBy = (req.query.sort_by as string) || 'name';
    const sanitizedPages = db.pages.map(p => ({
      ...p,
      page_access_token: maskToken(p.page_access_token),
      telegram_bot_token: maskToken(p.telegram_bot_token || ''),
      line_notify_token: maskToken(p.line_notify_token || '')
    }));

    let sorted = [...sanitizedPages];
    if (sortBy === 'name') {
      sorted.sort((a, b) => (a.page_name || '').localeCompare(b.page_name || '', 'th'));
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const aTime = (a as any).last_active_at || (a as any).connected_at || '';
        const bTime = (b as any).last_active_at || (b as any).connected_at || '';
        return bTime.localeCompare(aTime);
      });
    } else if (sortBy === 'active') {
      sorted.sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));
    }
    res.json({ success: true, pages: sorted, sort_by: sortBy });
  });

  // ================================================================
  // JSON/CSV File Import for Products
  // ================================================================
  app.post('/api/products/import', (req: Request, res: Response) => {
    const { products, category, format } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'No products data provided' });
    }

    const targetCategory = category || 'CHINA';
    const collectionKey = targetCategory.toLowerCase() as 'amulet' | 'china' | 'otop' | 'agriculture';
    const existing = db[collectionKey] as any[];
    let imported = 0;
    let updated = 0;

    for (const item of products) {
      const productId = item.product_id || `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const idx = existing.findIndex(p => p.product_id === productId);
      const productData = {
        product_id: productId,
        page_id: item.page_id || '',
        product_name: item.product_name || item.name || '',
        category: targetCategory,
        display_price: Number(item.display_price || item.price || 0),
        price_1: Number(item.price_1 || item.price || 0),
        price_2: Number(item.price_2 || 0),
        price_3: Number(item.price_3 || 0),
        promotion_detail: item.promotion_detail || '',
        shipping_duration: item.shipping_duration || '',
        image_main: item.image_main || item.image || '',
        image_detail: item.image_detail || '',
        image_promotion: item.image_promotion || '',
        image_review: item.image_review || '',
        image_closing: item.image_closing || '',
        opening_text: item.opening_text || '',
        detail_text: item.detail_text || item.description || '',
        promotion_text: item.promotion_text || '',
        review_text: item.review_text || '',
        closing_text: item.closing_text || '',
        custom_specs: item.custom_specs || []
      };

      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...productData };
        updated++;
      } else {
        existing.unshift(productData as any);
        imported++;
      }
    }

    syncPagesFromCatalog(collectionKey);
    persistData();
    addLog('INFO', 'IMPORT', 'SYSTEM', `นำเข้าสินค้า ${targetCategory}: ${imported} ใหม่, ${updated} อัปเดต`, 'SUCCESS');
    dbBridge.broadcastSSE('data_updated', { collection: collectionKey });

    res.json({ success: true, imported, updated, total: products.length });
  });

  // CSV parser endpoint
  app.post('/api/products/import-csv', (req: Request, res: Response) => {
    const { csvText, category } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText is required' });
    }
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + data rows' });

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const products = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g);
        if (!values) continue;
        const cleanValues = values.map(v => v.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = cleanValues[idx] || ''; });
        products.push(obj);
      }

      res.json({ success: true, products, count: products.length });
    } catch (err: any) {
      res.status(400).json({ error: `CSV parse error: ${err.message}` });
    }
  });

  // ================================================================
  // Chat History API (for admin review)
  // ================================================================
  app.get('/api/chat-history', async (req: Request, res: Response) => {
    const { page_id, sender_id, limit } = req.query;
    if (!page_id || !sender_id) {
      return res.status(400).json({ error: 'page_id and sender_id required' });
    }
    const history = await dbService.getChatHistoryForInbox(page_id as string, sender_id as string, Number(limit) || 50);
    res.json({ success: true, history });
  });

  // ================================================================
  // Connection Status with isConnected flag
  // ================================================================
  // Fresh page avatar proxy: Facebook CDN URLs stored in the DB expire after
  // a while, which made page profile pictures disappear from the UI. Redirect
  // to a live Graph API picture URL generated with the stored page token.
  app.get('/api/pages/:pageId/avatar', (req: Request, res: Response) => {
    const page = db.pages.find(p => p.page_id === req.params.pageId);
    const raw = page ? decryptToken(page.page_access_token || '') : '';
    if (!raw || !raw.startsWith('EAA')) return res.status(404).json({ error: 'NO_PAGE_TOKEN' });
    res.redirect(302, `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(page!.page_id)}/picture?type=normal&access_token=${encodeURIComponent(raw)}`);
  });

  app.post('/api/pages/set-connected', (req: Request, res: Response) => {
    const { page_id, is_connected } = req.body;
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    (page as any).is_connected = Boolean(is_connected);
    (page as any).connected_at = is_connected ? new Date().toISOString() : null;
    persistData();
    dbBridge.broadcastSSE('connection_changed', { page_id, is_connected });
    res.json({ success: true, is_connected: Boolean(is_connected) });
  });

  // ================================================================
  // CUSTOMER MEMORY API - จำลูกค้าเก่า/ใหม่, ดาว, ประวัติสั่งซื้อ
  // ================================================================
  app.get('/api/customer/memory', async (req: Request, res: Response) => {
    const { psid, page_id } = req.query;
    if (!psid) return res.status(400).json({ error: 'psid required' });

    const orderCount = await dbService.getCustomerOrderCount(psid as string);
    const totalSpent = await dbService.getCustomerTotalSpent(psid as string);
    const isReturning = orderCount > 0;
    const customer = db.customers.find(c => c.psid === psid);
    const recentOrders = db.orders.filter(o => o.psid === psid && o.payment_status !== 'CANCELLED').slice(0, 5);

    // Star rating based on order history
    let starRating = 0;
    if (orderCount >= 10) starRating = 5;
    else if (orderCount >= 5) starRating = 4;
    else if (orderCount >= 3) starRating = 3;
    else if (orderCount >= 1) starRating = 2;
    else starRating = 0;

    res.json({
      success: true,
      psid,
      is_returning: isReturning,
      star_rating: starRating,
      order_count: orderCount,
      total_spent: totalSpent,
      customer_name: customer?.customer_name || '',
      phone_number: customer?.phone_number || '',
      status: customer?.status || 'NEW_CUSTOMER',
      recent_orders: recentOrders.map(o => ({
        order_id: o.order_id,
        items: o.items,
        total_amount: o.total_amount,
        payment_status: o.payment_status,
        created_at: o.created_at
      }))
    });
  });

  // ================================================================
  // ORDER DISPATCH COUNTER API - รันเลขออเดอร์, ตัดรอบ
  // ================================================================
  app.get('/api/orders/dispatch-counter', async (req: Request, res: Response) => {
    const pageId = req.query.page_id as string;
    if (!pageId) return res.status(400).json({ error: 'page_id required' });
    const counter = await dbService.getDispatchCounter(pageId);
    const activeOrders = await dbService.getActiveOrdersByPage(pageId);
    res.json({ success: true, page_id: pageId, current_number: counter, active_orders_count: activeOrders.length });
  });

  app.post('/api/orders/cut-round', async (req: Request, res: Response) => {
    const { page_id } = req.body;
    if (!page_id) return res.status(400).json({ error: 'page_id required' });
    const prevCounter = await dbService.getDispatchCounter(page_id);
    await dbService.resetDispatchCounter(page_id);
    addLog('INFO', 'ADMIN', page_id, `🔔 ตัดรอบออเดอร์! รีเซ็ตตัวนับจาก ${prevCounter} → 1`, 'SUCCESS');
    dbBridge.broadcastSSE('round_cut', { page_id, previous_counter: prevCounter });
    res.json({ success: true, message: `ตัดรอบเรียบร้อย! ตัวneyรีเซ็ตเป็น 1 (รอบก่อนหน้าถึง ${prevCounter - 1})` });
  });

  // ================================================================
  // ORDER DISPATCH - ส่งออเดอร์ไป LINE/Telegram พร้อมรันเลข
  // ================================================================
  async function dispatchOrderToChannel(order: Order, page: PageConfig, dispatchNumber: number) {
    const channel = page.notification_channel || 'BOTH';
    const formattedMsg = `${dispatchNumber}. 📦 ออเดอร์ใหม่
ชื่อ: ${order.customer_name}
โทร: ${order.phone_number}
ที่อยู่: ${order.shipping_address}
สินค้า: ${order.items}
จำนวน: ${order.quantity || 1} ชุด
ยอดรวม: ฿${order.total_amount.toLocaleString()}
รหัส: ${order.order_id}
เวลา: ${new Date().toLocaleString('th-TH')}`;

    let telegramMsgId = '';
    let lineMsgId = '';

    // Send to Telegram
    if ((channel === 'TELEGRAM' || channel === 'BOTH') && deliverTelegram) {
      const result = await deliverTelegram(page, formattedMsg);
      if (result.success && (result as any).messageId) {
        telegramMsgId = String((result as any).messageId);
      }
      // Also try sending to the configured chat
      const rawTgToken = decryptToken(page.telegram_bot_token || '');
      const chatId = page.telegram_chat_id || '';
      if (rawTgToken && chatId) {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(rawTgToken)}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: formattedMsg })
          });
          const tgData: any = await tgRes.json();
          if (tgData.ok && tgData.result?.message_id) {
            telegramMsgId = String(tgData.result.message_id);
          }
        } catch (tgErr) {
          console.warn('[Dispatch] Telegram send error:', tgErr);
        }
      }
    }

    // Send to LINE
    if ((channel === 'LINE' || channel === 'BOTH') && deliverLine) {
      const result = await deliverLine(page, formattedMsg);
      if (result.success) {
        lineMsgId = `line_${Date.now()}`;
      }
      // Also try LINE push to group
      const rawLineToken = decryptToken(page.line_notify_token || '');
      const lineGroupId = page.line_group_id || '';
      if (rawLineToken && lineGroupId) {
        try {
          const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${rawLineToken}` },
            body: JSON.stringify({ to: lineGroupId, messages: [{ type: 'text', text: formattedMsg }] })
          });
          if (lineRes.ok) {
            lineMsgId = `line_${Date.now()}`;
          }
        } catch (lineErr) {
          console.warn('[Dispatch] LINE send error:', lineErr);
        }
      }
    }

    // Save dispatched message record
    const msgId = telegramMsgId || lineMsgId || `disp_${Date.now()}`;
    await dbService.saveDispatchedMessage({
      message_id: msgId,
      page_id: page.page_id,
      channel: channel === 'BOTH' ? 'TELEGRAM' : channel,
      chat_id: page.telegram_chat_id || page.line_group_id || '',
      order_id: order.order_id,
      dispatch_number: dispatchNumber,
      message_text: formattedMsg
    });

    return { messageId: msgId, dispatchNumber, message: formattedMsg };
  }

  // Cancel order and notify
  async function cancelOrderAndNotify(orderId: string, page: PageConfig, reason: string = 'ลูกค้า取消了การสั่งซื้อ') {
    const order = db.orders.find(o => o.order_id === orderId);
    if (!order) return { success: false, error: 'Order not found' };

    // Mark order as cancelled in DB
    await dbService.cancelOrder(orderId);
    order.payment_status = 'CANCELLED';

    // Find the dispatched message for this order
    const dispatchedMsg = await dbService.getDispatchedMessageByOrderId(orderId);

    // Try to delete the original message (Telegram supports this)
    if (dispatchedMsg && dispatchedMsg.channel === 'TELEGRAM') {
      const rawTgToken = decryptToken(page.telegram_bot_token || '');
      const chatId = dispatchedMsg.chat_id;
      if (rawTgToken && chatId && dispatchedMsg.message_id) {
        try {
          await fetch(`https://api.telegram.org/bot${encodeURIComponent(rawTgToken)}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: dispatchedMsg.message_id })
          });
        } catch {
          // If can't delete, send cancellation notice instead
          const cancelNotice = `${dispatchedMsg.dispatch_number}. ❌ ${order.customer_name} ได้ยกเลิกการสั่งซื้อ\n(${reason})`;
          await deliverTelegram?.(page, cancelNotice);
        }
      }
    }

    // Mark dispatched message as cancelled
    if (dispatchedMsg) {
      await dbService.markDispatchedMessageCancelled(dispatchedMsg.message_id);
    }

    // Send cancellation notice to chat
    const channel = page.notification_channel || 'BOTH';
    const cancelNotice = `${dispatchedMsg?.dispatch_number || '?'}. ❌ ${order.customer_name} ได้ยกเลิกการสั่งซื้อ\n(${reason})`;
    if (channel === 'TELEGRAM' || channel === 'BOTH') {
      await deliverTelegram?.(page, cancelNotice);
    }
    if (channel === 'LINE' || channel === 'BOTH') {
      await deliverLine?.(page, cancelNotice);
    }

    addLog('ORDER', 'SYSTEM', page.page_id, `❌ ออเดอร์ ${orderId} ถูกยกเลิกโดย ${order.customer_name} - ${reason}`, 'WARNING');
    dbBridge.broadcastSSE('order_cancelled', { order_id: orderId, page_id: page.page_id });
    persistData();

    return { success: true, order_id: orderId };
  }

  // API: Cancel order manually
  app.post('/api/orders/cancel', async (req: Request, res: Response) => {
    const { order_id, page_id, reason } = req.body;
    if (!order_id) return res.status(400).json({ error: 'order_id required' });
    const page = db.pages.find(p => p.page_id === (page_id || (db.orders.find(o => o.order_id === order_id)?.page_id)));
    if (!page) return res.status(404).json({ error: 'Page not found' });
    const result = await cancelOrderAndNotify(order_id, page, reason || 'แอดมินยกเลิก');
    res.json(result);
  });

  // API: Get dispatch status for a page
  app.get('/api/orders/dispatch-status', async (req: Request, res: Response) => {
    const pageId = req.query.page_id as string;
    if (!pageId) return res.status(400).json({ error: 'page_id required' });
    const counter = await dbService.getDispatchCounter(pageId);
    const activeOrders = await dbService.getActiveOrdersByPage(pageId);
    const dispatchedMsgs = await dbService.getDispatchedMessages(pageId, true);
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    res.json({
      success: true,
      page_id: pageId,
      current_number: counter,
      active_orders: activeOrders.length,
      total_revenue: totalRevenue,
      dispatched_messages: dispatchedMsgs.length
    });
  });

  // ================================================================
  // PRODUCT KNOWLEDGE PROMPT - ระบบถามข้อมูลสินค้าเมื่อไม่มีข้อมูล
  // ================================================================
  app.get('/api/products/knowledge-status', (req: Request, res: Response) => {
    const pageId = req.query.page_id as string;
    if (!pageId) return res.status(400).json({ error: 'page_id required' });
    const page = db.pages.find(p => p.page_id === pageId);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const hasProductName = Boolean(page.product?.product_name);
    const hasDescription = Boolean(page.product?.description);
    const hasPrice = (page.product?.display_price || 0) > 0;
    const hasPromotions = (page.product?.promotions?.length || 0) > 0;
    const hasImages = Boolean(page.product?.images?.main);

    const completeness = [hasProductName, hasDescription, hasPrice, hasPromotions, hasImages].filter(Boolean).length;
    const percentage = Math.round((completeness / 5) * 100);

    const missingFields: string[] = [];
    if (!hasProductName) missingFields.push('ชื่อสินค้า');
    if (!hasDescription) missingFields.push('รายละเอียดสินค้า');
    if (!hasPrice) missingFields.push('ราคา');
    if (!hasPromotions) missingFields.push('โปรโมชั่น');
    if (!hasImages) missingFields.push('รูปภาพสินค้า');

    res.json({
      success: true,
      page_id: pageId,
      completeness_percentage: percentage,
      is_ready_for_ai: percentage >= 60,
      missing_fields: missingFields,
      questions_for_admin: missingFields.length > 0 ? [
        `สินค้าชื่ออะไรค่ะ?`,
        `รายละเอียด/คุณสมบัติสินค้าเป็นยังไงบ้าง?`,
        `ราคาเท่าไรค่ะ? มีโปรโมชั่นไหม?`,
        `มีรูปภาพสินค้าไหมค่ะ?`,
        `มีอะไรที่ลูกค้าชอบถามอีกไหมค่ะ?`
      ].slice(0, missingFields.length) : []
    });
  });

  // AI asks admin for product info (triggered when page has no data)
  app.post('/api/products/knowledge-prompt', async (req: Request, res: Response) => {
    const { page_id, answers } = req.body;
    if (!page_id || !answers) return res.status(400).json({ error: 'page_id and answers required' });
    const page = db.pages.find(p => p.page_id === page_id);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    // Update page product with admin's answers
    if (answers.product_name) page.product.product_name = answers.product_name;
    if (answers.description) page.product.description = answers.description;
    if (answers.price) page.product.display_price = Number(answers.price);
    if (answers.promotions) {
      page.product.promotions = [{ id: 'tier-1', name: 'โปรโมชั่น', quantity: 1, price: Number(answers.price || 0), description: answers.promotions }];
    }
    if (answers.images) page.product.images = { ...page.product.images, main: answers.images };
    if (answers.additional_info) {
      page.ai_custom_instructions = (page.ai_custom_instructions || '') + '\n' + answers.additional_info;
    }

    persistData();
    addLog('INFO', 'KNOWLEDGE', page_id, `📝 อัปเดตข้อมูลสินค้าจากแอดมิน: ${Object.keys(answers).join(', ')}`, 'SUCCESS');
    dbBridge.broadcastSSE('knowledge_updated', { page_id });

    res.json({ success: true, message: 'บันทึกข้อมูลสินค้าเรียบร้อย! AI จะใช้ข้อมูลนี้ตอบลูกค้า' });
  });

  // ================================================================
  // DASHBOARD API - รวมยอดขายไม่รวมออเดอร์ที่ถูกยกเลิก
  // ================================================================
  app.get('/api/dashboard/summary', (req: Request, res: Response) => {
    const activeOrders = db.orders.filter(o => o.payment_status !== 'CANCELLED');
    const cancelledOrders = db.orders.filter(o => o.payment_status === 'CANCELLED');
    const totalRevenue = activeOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const cancelledRevenue = cancelledOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Per-page breakdown
    const pageBreakdown: Record<string, { revenue: number; orders: number; cancelled: number }> = {};
    for (const order of db.orders) {
      const pid = order.page_id || 'unknown';
      if (!pageBreakdown[pid]) pageBreakdown[pid] = { revenue: 0, orders: 0, cancelled: 0 };
      if (order.payment_status === 'CANCELLED') {
        pageBreakdown[pid].cancelled++;
      } else {
        pageBreakdown[pid].revenue += order.total_amount || 0;
        pageBreakdown[pid].orders++;
      }
    }

    res.json({
      success: true,
      total_revenue: totalRevenue,
      total_orders: activeOrders.length,
      cancelled_orders: cancelledOrders.length,
      cancelled_revenue: cancelledRevenue,
      net_revenue: totalRevenue,
      page_breakdown: pageBreakdown,
      customers_total: db.customers.length,
      returning_customers: db.customers.filter(c => db.orders.some(o => o.psid === c.psid && o.payment_status !== 'CANCELLED')).length
    });
  });

  // 4. Voice Audio Transcription API using Gemini (gemini-3.7-flash)
  app.post('/api/ai/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType } = req.body;
      if (!audioBase64) {
        return res.status(400).json({ error: 'audioBase64 is required' });
      }

      const ai = getGemini();
      const response = await ai.models.generateContent({
        model: resolveAiModel(),
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64
            }
          },
          {
            text: 'กรุณาถอดเสียงภาษาไทยจากคลิปเสียงนี้อย่างแม่นยำ ทุกถ้อยคำ หากมีชื่อสินค้า ที่อยู่ เบอร์โทรศัพท์ หรือการสั่งซื้อ ให้ถอดข้อความออกมาให้ถูกต้องตามธรรมชาติของการพิมพ์แชท'
          }
        ]
      });

      const transcribedText = response.text?.trim() || '';
      addLog('INFO', 'VOICE_USER', 'SYSTEM', `🎙️ ถอดเสียงสำเร็จ: "${transcribedText}"`, 'SUCCESS');
      res.json({ text: transcribedText });
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
    }
  });

  // 4.5 Real-AI Spec Parser (AI Auto-Key แบบใช้ AI จริง)
  // รับข้อความรายละเอียดสินค้าดิบ แล้วให้ Gemini แยกข้อมูลลงช่องสเปกที่ถูกต้อง
  // ตามหมวดหมู่สินค้า แก้ปัญหา "คุณสมบัติสินค้าใส่ไม่ถูกช่องและไม่ได้ใส่บางอัน"
  app.post('/api/ai/parse-specs', async (req: Request, res: Response) => {
    try {
      const { rawText, category } = req.body;
      if (!rawText || !String(rawText).trim()) {
        return res.status(400).json({ error: 'rawText is required' });
      }

      const categoryLabel: Record<string, string> = {
        AMULET: 'พระเครื่อง / วัตถุมงคล',
        CHINA: 'สินค้านำเข้าจากจีน / สินค้าทั่วไป',
        OTOP: 'สินค้าโอทอปไทย / สินค้าชุมชน',
        AGRICULTURE: 'สินค้าการเกษตร / ปุ๋ยยา / เมล็ดพันธุ์'
      };

      const ai = getGemini();
      const prompt = `คุณคือผู้เชี่ยวชาญระบบกรอกข้อมูลสินค้าอีคอมเมิร์ซไทย หน้าที่ของคุณคืออ่านข้อความรายละเอียดสินค้าดิบ แล้วแยกข้อมูลใส่ "ช่องฟิลด์" ที่กำหนดให้ถูกต้อง ครบถ้วนที่สุด

หมวดหมู่สินค้า: ${categoryLabel[category] || 'สินค้าทั่วไป'}

กฎเหล็ก:
1. ใส่ข้อมูลลงช่องให้ตรงความหมายของแต่ละช่องเท่านั้น ห้ามใส่ข้อมูลผิดช่อง
2. ถ้าข้อความมีข้อมูลแต่ไม่มีช่องที่ตรงกัน ให้ใส่ใน custom_specs เป็นรายการ {key, value}
3. ถ้าไม่มีข้อมูลในข้อความสำหรับช่องใด ให้เว้นช่องนั้นเป็นค่าว่าง "" ห้ามเดาหรือแต่งข้อมูลเพิ่มเองเด็ดขาด
4. คงข้อความต้นฉบับไว้ให้มากที่สุด ปรับเฉพาะรูปแบบให้อ่านง่าย
5. ตอบเป็นภาษาไทย

ข้อความรายละเอียดสินค้าดิบ:
"""
${String(rawText).slice(0, 12000)}
"""`;

      const response = await ai.models.generateContent({
        model: resolveAiModel(),
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              product_name: { type: Type.STRING, description: 'ชื่อสินค้า' },
              description: { type: Type.STRING, description: 'รายละเอียดสินค้าโดยรวม' },
              features: { type: Type.STRING, description: 'คุณสมบัติเด่น / จุดเด่นของสินค้า' },
              benefit: { type: Type.STRING, description: 'ประโยชน์ที่ได้รับ' },
              usage: { type: Type.STRING, description: 'วิธีใช้งาน' },
              material: { type: Type.STRING, description: 'วัสดุ / มวลสาร / ส่วนประกอบ' },
              size: { type: Type.STRING, description: 'ขนาด กว้างxยาวxสูง' },
              weight: { type: Type.STRING, description: 'น้ำหนัก' },
              brand: { type: Type.STRING, description: 'แบรนด์ / ยี่ห้อ' },
              shipping_info: { type: Type.STRING, description: 'ข้อมูลการจัดส่ง / ค่าส่ง / ระยะเวลา' },
              // พระเครื่อง
              temple: { type: Type.STRING, description: 'วัด / สำนักที่จัดสร้าง' },
              master: { type: Type.STRING, description: 'พระเกจิอาจารย์ผู้สร้าง / ปลุกเสก' },
              year: { type: Type.STRING, description: 'ปีที่สร้าง พ.ศ.' },
              edition: { type: Type.STRING, description: 'รุ่น / พิมพ์' },
              quantity: { type: Type.STRING, description: 'จำนวนการสร้าง (ตัวเลข)' },
              history: { type: Type.STRING, description: 'ประวัติการจัดสร้าง' },
              belief_info: { type: Type.STRING, description: 'พุทธคุณ / ความเชื่อ (เฉพาะที่ระบุในข้อความ)' },
              spell: { type: Type.STRING, description: 'คาถาบูชา' },
              worship_method: { type: Type.STRING, description: 'วิธีบูชา' },
              care_instruction: { type: Type.STRING, description: 'วิธีดูแลรักษา' },
              warning: { type: Type.STRING, description: 'ข้อควรระวัง' },
              // OTOP
              community: { type: Type.STRING, description: 'ชุมชน / กลุ่มผู้ผลิต' },
              province: { type: Type.STRING, description: 'จังหวัดผู้ผลิต' },
              maker: { type: Type.STRING, description: 'ผู้ผลิต / ผู้ประกอบการ' },
              origin: { type: Type.STRING, description: 'แหล่งที่มา / ต้นกำเนิด' },
              story: { type: Type.STRING, description: 'เรื่องราว / ภูมิปัญญา' },
              production_method: { type: Type.STRING, description: 'วิธีการผลิต' },
              // การเกษตร
              subcategory: { type: Type.STRING, description: 'หมวดย่อย / ประเภทสินค้า' },
              variety: { type: Type.STRING, description: 'สายพันธุ์' },
              species: { type: Type.STRING, description: 'ชนิดพืช / ชนิดสินค้า' },
              seed_quantity: { type: Type.STRING, description: 'จำนวนเมล็ด / ปริมาณบรรจุ' },
              planting_season: { type: Type.STRING, description: 'ฤดูปลูก / ช่วงเวลาปลูก' },
              planting_method: { type: Type.STRING, description: 'วิธีปลูก / การเพาะ' },
              soil_type: { type: Type.STRING, description: 'ประเภทดินที่เหมาะสม' },
              sunlight: { type: Type.STRING, description: 'ความต้องการแสงแดด' },
              watering: { type: Type.STRING, description: 'การรดน้ำ / การให้น้ำ' },
              fertilizer: { type: Type.STRING, description: 'ปุ๋ยที่แนะนำ / การให้ปุ๋ย' },
              harvest_time: { type: Type.STRING, description: 'ระยะเวลาเก็บเกี่ยว' },
              usage_instructions: { type: Type.STRING, description: 'วิธีใช้ / อัตราการใช้ (ปุ๋ยยา)' },
              benefits: { type: Type.STRING, description: 'ประโยชน์และผลลัพธ์' },
              custom_specs: {
                type: Type.ARRAY,
                description: 'ข้อมูลอื่น ๆ ที่ไม่มีช่องด้านบน',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: { type: Type.STRING },
                    value: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const parsedText = response.text || '{}';
      let parsed: any = {};
      try {
        parsed = JSON.parse(parsedText);
      } catch {
        const match = parsedText.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : {};
      }

      // กรองค่าว่างออกเพื่อไม่ให้ไปทับข้อมูลเดิมที่ผู้ใช้กรอกไว้
      const cleanResult: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'custom_specs') {
          const customs = Array.isArray(value)
            ? value
                .filter((c: any) => c && (c.key || '').trim() && (c.value || '').trim())
                .map((c: any) => ({ id: `cs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, key: String(c.key).trim(), value: String(c.value).trim() }))
            : [];
          if (customs.length) cleanResult.custom_specs = customs;
        } else if (value !== null && value !== undefined && String(value).trim() !== '') {
          cleanResult[key] = key === 'quantity' ? (Number(String(value).replace(/[^0-9]/g, '')) || undefined) : String(value).trim();
        }
      }

      addLog('INFO', 'AI_AUTO_KEY', 'SYSTEM', `🧠 AI แยกสเปกสินค้าสำเร็จ ${Object.keys(cleanResult).length} ช่อง (หมวด ${category || 'GENERAL'})`, 'SUCCESS');
      res.json({ success: true, specs: cleanResult });
    } catch (err: any) {
      console.error('AI parse-specs error:', err);
      res.status(500).json({ error: err.message || 'AI ไม่สามารถแยกข้อมูลสเปกได้ กรุณาตั้ง API Key ก่อน' });
    }
  });

  // 5. Test Notification Dispatch API (Telegram / LINE)
  //    Sends a REAL test message using the values from the settings form —
  //    including tokens/destinations the user just typed but has not saved yet.
  //    Returns the genuine per-channel outcome plus helpers (bot username,
  //    auto-detected Chat ID, deep links) so the admin can pick a destination.
  app.post('/api/notifications/test', async (req: Request, res: Response) => {
    const { channel, page_id, page_name, line_token, line_group_id, telegram_token, telegram_chat_id, sample_order } = req.body;

    const basePage = db.pages.find(p => p.page_id === page_id) || db.pages[0];
    if (!basePage) {
      return res.status(404).json({ success: false, message: 'ไม่พบเพจในระบบ กรุณาเพิ่มเพจก่อนทดสอบการแจ้งเตือน' });
    }

    // The form shows masked stored tokens (••••). Only treat the incoming value
    // as a NEW plain token when it is not the mask of the stored one.
    const resolveTestToken = (incoming: any, stored: string | undefined): string => {
      const value = typeof incoming === 'string' ? incoming.trim() : '';
      if (!value) return stored || '';
      if (stored && (value === maskToken(stored) || /^•+$/.test(value))) return stored;
      if (value.startsWith('enc:')) return value;
      return encryptToken(value);
    };

    const requestedChannel: 'TELEGRAM' | 'LINE' | 'BOTH' = channel === 'TELEGRAM' || channel === 'LINE' ? channel : 'BOTH';

    // Temporary override page: unsaved UI values are tested without touching db.
    const testPage: PageConfig = {
      ...basePage,
      notification_channel: requestedChannel === 'BOTH' ? (basePage.notification_channel || 'BOTH') : requestedChannel,
      telegram_bot_token: resolveTestToken(telegram_token, basePage.telegram_bot_token),
      telegram_chat_id: (typeof telegram_chat_id === 'string' && telegram_chat_id.trim()) || basePage.telegram_chat_id || '',
      line_notify_token: resolveTestToken(line_token, basePage.line_notify_token),
      line_group_id: (typeof line_group_id === 'string' && line_group_id.trim()) || basePage.line_group_id || ''
    };

    // Telegram helpers: resolve bot username (deep link) and auto-detect the
    // latest Chat ID via getUpdates when the admin has not filled one in yet.
    let telegramBotUsername = '';
    let detectedTelegramChatId = '';
    const rawTgToken = decryptToken(testPage.telegram_bot_token || '');
    if (rawTgToken) {
      try {
        const meRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(rawTgToken)}/getMe`);
        const meData: any = await meRes.json();
        if (meData?.ok && meData.result?.username) telegramBotUsername = meData.result.username;
      } catch (meErr) {
        console.warn('[Notifications Test] Telegram getMe lookup failed:', meErr);
      }
      if (!testPage.telegram_chat_id) {
        try {
          const updRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(rawTgToken)}/getUpdates?limit=10`);
          const updData: any = await updRes.json();
          if (updData?.ok && Array.isArray(updData.result)) {
            for (let i = updData.result.length - 1; i >= 0; i--) {
              const chat = updData.result[i]?.message?.chat || updData.result[i]?.channel_post?.chat || updData.result[i]?.my_chat_member?.chat;
              if (chat?.id) { detectedTelegramChatId = String(chat.id); break; }
            }
          }
        } catch (updErr) {
          console.warn('[Notifications Test] Telegram getUpdates lookup failed:', updErr);
        }
        if (detectedTelegramChatId) testPage.telegram_chat_id = detectedTelegramChatId;
      }
    }

    const orderData: Order = {
      order_id: `ORD-TEST-${Date.now()}`,
      psid: 'PSID_TEST',
      customer_name: sample_order?.customer_name || 'คุณวิชัย วันดี',
      shipping_address: sample_order?.address || 'โตโยต้าชัวร์ ทีบีเอ็น 318/4 ถ.ลาดกระบัง กทม 10520',
      phone_number: sample_order?.phone || '0927015995',
      items: sample_order?.item || `${basePage.product?.product_name || 'กล้องส่องพระแบบเซียน'} 1 ชุด`,
      quantity: 1,
      total_amount: sample_order?.total || 990,
      payment_status: 'PENDING',
      created_at: new Date().toISOString(),
      tracking_number: 'TH999888777FL',
      page_id: page_id || 'AMULET_PAGE_ID'
    };

    const { formattedSummary, telegram, line } = await dispatchOrderSummary(orderData, testPage);
    const channelResults: Record<'TELEGRAM' | 'LINE', { success: boolean; skipped?: boolean; error?: string }> = { TELEGRAM: telegram, LINE: line };

    const describeResult = (ch: 'TELEGRAM' | 'LINE', r: { success: boolean; skipped?: boolean; error?: string }) => {
      if (r.success) return `✅ ${ch === 'TELEGRAM' ? 'Telegram' : 'LINE'} ส่งข้อความทดสอบสำเร็จ`;
      if (r.error === 'TELEGRAM_NOT_CONFIGURED') return '⚠️ Telegram ยังไม่ได้ตั้งค่า Bot Token หรือ Chat ID ให้ครบ';
      if (r.error === 'LINE_NOT_CONFIGURED') return '⚠️ LINE ยังไม่ได้ตั้งค่า Token หรือ Group ID ให้ครบ';
      if (r.error === 'CHANNEL_DISABLED') return `⏸️ ช่องทาง ${ch} ไม่ได้ถูกเลือกให้ส่ง`;
      return `❌ ${ch} ส่งไม่สำเร็จ: ${r.error || 'ไม่ทราบสาเหตุ'}`;
    };

    const relevantResults = requestedChannel === 'BOTH'
      ? [describeResult('TELEGRAM', telegram), describeResult('LINE', line)]
      : [describeResult(requestedChannel, channelResults[requestedChannel])];
    const overallSuccess = requestedChannel === 'BOTH'
      ? telegram.success && line.success
      : Boolean(channelResults[requestedChannel]?.success);

    res.json({
      success: overallSuccess,
      message: overallSuccess
        ? `ส่งการแจ้งเตือนทดสอบ (${requestedChannel}) สำหรับเพจ ${page_name || basePage.page_name} สำเร็จเรียบร้อย!`
        : `ทดสอบส่ง (${requestedChannel}) สำหรับเพจ ${page_name || basePage.page_name} ไม่สำเร็จ`,
      results: relevantResults,
      telegram: { ...telegram, bot_username: telegramBotUsername, detected_chat_id: detectedTelegramChatId },
      line,
      deepLinks: {
        telegram: telegramBotUsername ? `https://t.me/${telegramBotUsername}` : 'https://t.me/',
        line: 'line://'
      },
      summaryFormatted: formattedSummary
    });
  });

  // 6. Emergency Crisis Alert Trigger API
  app.post('/api/emergency/alert', async (req: Request, res: Response) => {
    const { page_id, threat_type, message_text, customer_name } = req.body;
    const page = db.pages.find(p => p.page_id === page_id) || db.pages[0];

    const alert = await triggerCrisisAlert({
      page_id: page_id || page.page_id,
      page_name: page.page_name,
      threat_type: threat_type || 'SAKOB_POLICE_THREAT',
      customer_name: customer_name || 'ลูกค้าขู่แจ้งความ/สคบ.',
      message_text: message_text || 'จะไปแจ้ง สคบ และแจ้งความดำเนินคดีหลอกลวง'
    });

    res.json({ success: true, alert });
  });

  // 7. Automated Follow-Up Runner with interval logic
  app.post('/api/followup/run', async (req: Request, res: Response) => {
    const { psid, intervalName, page_id } = req.body;
    const page = db.pages.find(p => p.page_id === page_id) || db.pages[0];

    const targets = psid
      ? db.customers.filter(c => c.psid === psid)
      : db.customers.filter(c => c.status !== 'ORDER_COMPLETED');

    const configuredFollowups = page.followup_messages || [];
    const matchedFollowup = configuredFollowups.find(f => f.interval === intervalName);

    const followUpMessages = matchedFollowup
      ? [matchedFollowup.message]
      : configuredFollowups.length
      ? configuredFollowups.map(f => f.message)
      : [
          'สวัสดีค่ะ สอบถามข้อมูลสินค้าหรือโปรโมชั่นเพิ่มเติมไหมคะ รับส่วนลดพิเศษแจ้งได้เลยนะคะ 😊',
          'แจ้งเตือนสิทธิ์ของแถมและส่งฟรีวันนี้ สินค้ามีจำนวนจำกัดนะคะ สนใจรับสิทธิ์พิมพ์ 1 หรือแจ้งชื่อได้เลยค่ะ 🙏',
          'โปรโมชั่นรอบพิเศษวันนี้ใกล้จะหมดแล้วนะคะ หากคุณพี่ต้องการให้จัดส่งพรุ่งนี้เช้าแจ้งที่อยู่ได้เลยค่ะ 📦'
        ];

    const results = [];
    for (const target of targets) {
      const selectedMsg = followUpMessages[Math.floor(Math.random() * followUpMessages.length)];
      target.status = 'FOLLOW_UP_SENT';
      target.last_interaction = new Date().toISOString();

      addLog(
        'FOLLOW_UP',
        target.psid,
        page.page_id,
        `⏰ ส่งข้อความติดตามออเดอร์ (${intervalName || 'Follow-Up ตามเวลาที่ตั้งไว้'}) ให้ ${target.customer_name}: "${selectedMsg}"`,
        'SUCCESS'
      );

      // Dispatch to Facebook Messenger if real PSID and Page Token available
      if (target.psid) {
        await sendFacebookMessage(page.page_access_token || '', target.psid, selectedMsg);
      }

      results.push({ psid: target.psid, name: target.customer_name, message: selectedMsg });
    }

    res.json({ success: true, processedCount: results.length, details: results });
  });

  // 8. Interactive Simulation endpoint
  app.post('/api/simulate', async (req: Request, res: Response) => {
    const { event_type, sender_id, page_id, message_text, comment_id } = req.body;
    await handleWebhookPost(
      {
        body: {
          event_type: event_type || 'MESSAGE',
          sender_id: sender_id || `PSID_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          page_id: page_id || 'AMULET_PAGE_ID',
          message_text: message_text || 'สอบถามราคาครับ',
          comment_id: comment_id || null
        },
        isInternal: true
      } as any,
      {
        status: () => ({ json: () => {} }),
        sendStatus: () => {}
      } as any
    );

    res.json({
      success: true,
      latestLogs: db.logs.slice(0, 6),
      ordersCount: db.orders.length,
      customersCount: db.customers.length
    });
  });

  // Vite Middleware for Dev & Static Serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ================================================================
  // Token Auto-Refresh Background Worker
  // Extends Page Access Tokens before they expire (Facebook tokens
  // last ~60 days). Runs every 12 hours to ensure continuity.
  // ================================================================
  async function refreshTokenForPage(page: PageConfig): Promise<boolean> {
    const rawToken = decryptToken(page.page_access_token || '');
    if (!rawToken || !rawToken.startsWith('EAA')) return false;
    const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
    const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '';
    if (!appId || !appSecret) return false;

    try {
      const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(rawToken)}`;
      const res = await fetch(url);
      const data: any = await res.json();
      if (data.access_token && data.access_token !== rawToken) {
        page.page_access_token = encryptToken(data.access_token);
        addLog('INFO', 'TOKEN_REFRESH', page.page_id, `🔄 ต่ออายุ Page Access Token สำเร็จสำหรับเพจ ${page.page_name}`, 'SUCCESS');
        persistData();
        return true;
      }
      return false;
    } catch (err: any) {
      addLog('INFO', 'TOKEN_REFRESH', page.page_id, `❌ ต่ออายุ Token ไม่สำเร็จ: ${err.message}`, 'ERROR');
      return false;
    }
  }

  if (process.env.VERCEL !== '1') {
    // Token refresh: every 12 hours
    setInterval(async () => {
      console.log('[Token Refresh] Starting auto-refresh cycle...');
      let refreshed = 0;
      for (const page of db.pages.filter(p => p.is_active)) {
        const rawToken = decryptToken(page.page_access_token || '');
        if (rawToken?.startsWith('EAA')) {
          const success = await refreshTokenForPage(page);
          if (success) refreshed++;
        }
      }
      console.log(`[Token Refresh] Cycle complete: ${refreshed} tokens refreshed`);
    }, 12 * 60 * 60 * 1000);

    // Also run once 5 minutes after startup (give server time to stabilize)
    setTimeout(async () => {
      console.log('[Token Refresh] Initial auto-refresh cycle...');
      for (const page of db.pages.filter(p => p.is_active)) {
        const rawToken = decryptToken(page.page_access_token || '');
        if (rawToken?.startsWith('EAA')) {
          await refreshTokenForPage(page);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Background polling so every active page answers real messages/comments
  // even when Meta webhook events never arrive. (Skipped on serverless Vercel
  // where the manual trigger endpoints above are used instead.)
  // OPTIMIZED: Faster polling intervals for near-instant AI response
  if (process.env.VERCEL !== '1') {
    // Inbox polling: 10 seconds (was 60s) - ensures AI responds within 10-15 seconds
    let inboxPollRunning = false;
    setInterval(async () => {
      if (inboxPollRunning) return;
      inboxPollRunning = true;
      try {
        for (const page of db.pages.filter(p => p.is_active && p.auto_reply)) {
          await pollPageInbox(page);
        }
      } finally {
        inboxPollRunning = false;
      }
    }, 10_000);

    // Comment scraping: 30 seconds (was 90s) - faster comment moderation
    let commentPollRunning = false;
    setInterval(async () => {
      if (commentPollRunning) return;
      commentPollRunning = true;
      try {
        for (const page of db.pages.filter(p => p.is_active && p.auto_reply && p.scrape_comments_enabled !== false)) {
          await scrapePageComments(page);
        }
      } finally {
        commentPollRunning = false;
      }
    }, 30_000);
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚀 Facebook AI Auto-Sales Hub & Sheet CRM Ready`);
      console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🔗 Webhook GET/POST endpoint: /api/webhook/facebook`);
      console.log(`=======================================================`);
    });
  }
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});

export { app };
export default app;
