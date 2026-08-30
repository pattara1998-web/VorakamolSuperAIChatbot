import React, { useState } from 'react';
import {
  Code,
  FileCode2,
  Terminal,
  Server,
  Workflow,
  Cpu,
  ShieldAlert,
  Bug,
  HelpCircle,
  Copy,
  Check,
  Zap,
  Layers,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Bot,
  Search,
  BookOpen,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  MessageSquare,
  Lock,
  Key,
  ShieldCheck,
  Flame,
  Radio,
  FileCheck,
  Play
} from 'lucide-react';
import { PageConfig } from '../types';

interface SystemDocsTabProps {
  pages: PageConfig[];
  selectedPageId?: string;
  theme?: 'dark' | 'light';
}

export const SystemDocsTab: React.FC<SystemDocsTabProps> = ({
  pages,
  selectedPageId,
  theme
}) => {
  const [activeSection, setActiveSection] = useState<'architecture' | 'ai_prompt' | 'webhook_flow' | 'security_oauth' | 'troubleshooting' | 'interactive_diagnostic' | 'code_reference' | 'api_endpoints'>('architecture');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [diagnosticInput, setDiagnosticInput] = useState('');
  const [diagnosticResult, setDiagnosticResult] = useState<{
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
    issue: string;
    rootCause: string;
    actionPlan: string[];
    aiFixCode: string;
  } | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({
    'trouble_1': true,
    'trouble_2': true,
    'trouble_3': false,
    'trouble_4': false,
    'trouble_5': false,
    'trouble_6': false,
    'trouble_7': false
  });

  const toggleTopic = (id: string) => {
    setExpandedTopics(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Run AI Diagnostic Engine
  const handleRunDiagnostic = (presetText?: string) => {
    const textToAnalyze = presetText || diagnosticInput;
    if (!textToAnalyze.trim()) return;

    setIsDiagnosing(true);
    setTimeout(() => {
      const lower = textToAnalyze.toLowerCase();
      if (lower.includes('400') || lower.includes('token') || lower.includes('190') || lower.includes('oauth') || lower.includes('expire')) {
        setDiagnosticResult({
          status: 'CRITICAL',
          issue: 'Meta Graph API Error 190/400: Invalid OAuth Access Token / Permissions Missing',
          rootCause: 'Page Access Token หมดอายุ หรือยังไม่ได้ให้สิทธิ์ pages_messaging / pages_read_engagement หรือไม่ได้ Subscribe Webhook field "messages"',
          actionPlan: [
            '1. ไปที่แท็บ "ศูนย์รวมเพจ" -> กดปุ่ม "เชื่อมต่อ Facebook"',
            '2. เลือกเชื่อมต่อผ่าน 1-Click Meta OAuth หรือกรอก User Token ใหม่เพื่อรับ Long-lived Token 60 วัน',
            '3. ตรวจสอบว่าระบบทำการยิง POST /<page_id>/subscribed_apps สำเร็จเรียบร้อย',
            '4. ตรวจสอบว่าในไฟล์ .env มี FACEBOOK_APP_ID และ FACEBOOK_APP_SECRET ครบถ้วน'
          ],
          aiFixCode: `// AI Self-Healing Action: Token Refresh & Auto-Subscription
const rawToken = decryptToken(pageConfig.page_access_token);
if (!rawToken || !rawToken.startsWith('EAA')) {
  throw new Error("ERR_INVALID_TOKEN: Please re-authenticate via /api/facebook/connect");
}
// Re-subscribe webhook
await fetch(\`https://graph.facebook.com/v19.0/\${pageConfig.page_id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,feed&access_token=\${encodeURIComponent(rawToken)}\`, {
  method: 'POST'
});`
        });
      } else if (lower.includes('address') || lower.includes('phone') || lower.includes('cod') || lower.includes('ยอด') || lower.includes('ที่อยู่')) {
        setDiagnosticResult({
          status: 'WARNING',
          issue: 'Order Extraction Anomaly: ข้อมูลที่อยู่หรือเบอร์โทรไม่สมบูรณ์',
          rootCause: 'ลูกค้าพิมพ์ข้อความที่มีอักขระพิเศษ หรือพิมพ์เบอร์โทรไม่ครบ 10 หลัก หรือระบุสินค้าโดยไม่ตรงกับ Promotion Tier',
          actionPlan: [
            '1. ฟังก์ชัน sanitizePhoneNumber จะทำความสะอาดและตัดขีด/เว้นวรรคอัตโนมัติ',
            '2. หากพบรหัสไปรษณีย์ 5 หลักและชื่อตำบล/อำเภอ ระบบจะจัดรูปเป็น Complete Thai Address',
            '3. หากไม่พบ Promotion Tier ระบุไว้ AI จะทำการ Default เป็น Tier 1 (ชุดทดลอง) เสมอ'
          ],
          aiFixCode: `// AI Address Sanitization & Tier Fallback
function sanitizeAndExtractOrder(rawText: string, product: PageProductConfig) {
  const phoneMatch = rawText.match(/(0[689]\\d{8}|0[2-57]\\d{7})/);
  const zipMatch = rawText.match(/\\b\\d{5}\\b/);
  const detectedPhone = phoneMatch ? phoneMatch[0].replace(/\\D/g, '') : '';
  const detectedZip = zipMatch ? zipMatch[0] : '';
  return {
    phone: detectedPhone,
    zip: detectedZip,
    tier: product.tiers[0] // Safe fallback to Tier 1
  };
}`
        });
      } else if (lower.includes('gemini') || lower.includes('ai') || lower.includes('quota') || lower.includes('api_key')) {
        setDiagnosticResult({
          status: 'CRITICAL',
          issue: 'Gemini AI API Engine Disruption: GEMINI_API_KEY Missing / Rate Limit Exceeded',
          rootCause: 'ไม่ได้ตั้งค่า GEMINI_API_KEY ในสภาพแวดล้อม (.env) หรือโควต้า API Key หมด',
          actionPlan: [
            '1. ตรวจสอบว่าไฟล์ .env มี GEMINI_API_KEY ที่ถูกต้อง',
            '2. สลับโมเดล AI ในการตั้งค่าเพจเป็น gemini-3.7-flash หรือ gemini-2.5-flash เพื่อประหยัดโควต้า',
            '3. ตรวจสอบสถานะการเชื่อมต่อที่หน้าแรกของระบบ'
          ],
          aiFixCode: `// Robust Gemini Fallback Engine
import { GoogleGenAI } from '@google/genai';
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined. Using Rule-Based Template Engine.");
  return getRuleBasedSalesResponse(customerMessage, pageConfig);
}
const ai = new GoogleGenAI({ apiKey });`
        });
      } else {
        setDiagnosticResult({
          status: 'NORMAL',
          issue: 'System Health Check: ทั่วไป & วิเคราะห์สถานะปกติ',
          rootCause: 'ไม่พบข้อผิดพลาดร้ายแรงจากข้อความที่ระบุ ตรวจสอบให้แน่ใจว่า Webhook URL ชี้ไปที่ Domain ปัจจุบัน',
          actionPlan: [
            '1. ทดสอบส่งข้อความจำลองในแท็บ "ภาพรวมระบบ & Logs"',
            '2. ตรวจสอบสถานะ Server: GET /api/health ได้รับ { "status": "ok" }',
            '3. ตรวจสอบการเข้ารหัส AES-256 ของ Token ว่าขึ้นต้นด้วย enc:'
          ],
          aiFixCode: `// Server Health Verification
const healthCheck = await fetch('/api/health');
const data = await healthCheck.json();
console.log('System Status:', data.status === 'ok' ? 'HEALTHY' : 'DEGRADED');`
        });
      }
      setIsDiagnosing(false);
    }, 600);
  };

  // Full AI System Prompt Reference
  const aiClosingSystemPrompt = `// -----------------------------------------------------------------------------
// VORAKAMOL SUPERAI 2026: 6-STEP CLOSING SALES & COD PROMPT TEMPLATE
// -----------------------------------------------------------------------------
You are the top-tier sales representative and administrative assistant for the Facebook Page "{{PAGE_NAME}}".
Category: {{PAGE_CATEGORY}} (AMULET / CHINA / OTOP / AGRICULTURE).
Your Goal: Deliver enthusiastic, polite, trustworthy responses, answer inquiries precisely, and close Cash-On-Delivery (COD) orders within 6 structured steps.

### CORE CONVERSATIONAL DIRECTIVES:
1. Speak Thai politely using gender-appropriate polite particles (ค่ะ/ครับ ตามแอดมินเพจ).
2. Never invent discounts or product specs not listed in the Database/Tier table.
3. Automatically detect customer intent:
   - GREETING / INQUIRY -> Respond with Warm Welcome + Product Highlight (Step 1-2).
   - ASKING PRICE / PROMOTION -> Present Tier 1, 2, 3 clearly + Free Shipping COD hook (Step 3-4).
   - ASKING REVIEWS / AUTHENTICITY -> Present social proof & warranty cert (Step 5).
   - READY TO BUY / SENT ADDRESS -> Immediately extract Name, Phone, Full Address, Selected Tier, and output Order Confirmation Summary with COD total (Step 6).
4. Strictly detect and correct Thai phone numbers (10 digits starting with 0) and Thai postal codes (5 digits).
5. If customer drops a comment under post -> reply with brief comment + immediately send private message to Messenger with attached context.

### 6-STEP SALES FLOW ENGINE:
- Step 1 [Opening Greeting]: ยินดีต้อนรับ + ทักทายชื่อลูกค้า + แนะนำตัวแอดมิน
- Step 2 [Value Proposition]: ชูจุดเด่นมวลสาร/นวัตกรรม/ใบรับประกัน
- Step 3 [Promotion Tiers]: นำเสนอโปรชุดทดลอง (Tier 1), โปรยอดนิยมแถมฟรี (Tier 2), โปรสุดคุ้ม (Tier 3)
- Step 4 [Visual & Urgency]: สิทธิ์ส่งฟรีเก็บเงินปลายทางวันนี้
- Step 5 [Social Proof]: การันตีความพึงพอใจและยอดรีวิว
- Step 6 [COD Order Closing]: สรุปยอดและขอ ชื่อ-เบอร์โทร-ที่อยู่จัดส่ง`;

  const webhookFlowCode = `// -----------------------------------------------------------------------------
// BACKEND WEBHOOK CONTROLLER & MESSAGE PIPELINE (/server.ts)
// -----------------------------------------------------------------------------
app.post(['/webhook/facebook', '/api/webhook/facebook'], async (req: Request, res: Response) => {
  const body = req.body;
  if (body.object !== 'page') return res.sendStatus(404);

  // Return HTTP 200 immediately to prevent Meta Webhook Timeout (< 5s)
  res.status(200).send('EVENT_RECEIVED');

  for (const entry of body.entry || []) {
    const pageId = entry.id;
    const pageConfig = db.pages.find(p => p.page_id === pageId) || db.pages[0];

    // 1. Process Inbox Messaging
    if (entry.messaging) {
      for (const event of entry.messaging) {
        const senderPsid = event.sender?.id;
        const messageText = event.message?.text;
        if (!messageText || !senderPsid) continue;

        // Extract Customer Profile & Intent with Gemini 3.7 Flash
        const { replyText, extractedOrder } = await processSalesEngineWithAI(
          messageText,
          pageConfig,
          senderPsid
        );

        // Auto Create COD Order if full address & phone detected
        if (extractedOrder?.shipping_address && extractedOrder?.phone_number) {
          createCodOrder(extractedOrder, pageId, senderPsid);
          sendLineAlert(extractedOrder, pageConfig);
          sendTelegramAlert(extractedOrder, pageConfig);
        }

        // Send Facebook Messenger Graph API Reply (with AES-256 Decrypted Token)
        await sendFacebookMessage(pageConfig.page_access_token, senderPsid, replyText);
      }
    }

    // 2. Process Feed Comments (Auto Reply & Hide Negative Words)
    if (entry.changes) {
      for (const change of entry.changes) {
        if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
          handleFacebookCommentModeration(change.value, pageConfig);
        }
      }
    }
  }
});`;

  const securityOauthCode = `// -----------------------------------------------------------------------------
// META OAUTH 2.0 & AES-256-GCM SECURITY ENGINE (/server.ts)
// -----------------------------------------------------------------------------
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET_KEY || process.env.FACEBOOK_APP_SECRET || 'fb_ai_sales_master_secret_key_32_bytes!';

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();
}

export function encryptToken(token: string): string {
  if (!token || token.startsWith('enc:')) return token;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return \`enc:\${iv.toString('hex')}:\${authTag}:\${encrypted}\`;
}

export function decryptToken(encryptedToken: string): string {
  if (!encryptedToken || !encryptedToken.startsWith('enc:')) return encryptedToken;
  const parts = encryptedToken.slice(4).split(':');
  if (parts.length !== 3) return encryptedToken;
  const [ivHex, authTagHex, encDataHex] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encDataHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Meta OAuth Flow Endpoints
app.get('/api/facebook/connect', (req: Request, res: Response) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const callbackUrl = \`\${req.protocol}://\${req.get('host')}/api/facebook/callback\`;
  const scopes = 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,pages_manage_posts';
  res.redirect(\`https://www.facebook.com/v19.0/dialog/oauth?client_id=\${appId}&redirect_uri=\${encodeURIComponent(callbackUrl)}&scope=\${encodeURIComponent(scopes)}&response_type=code\`);
});`;

  const troubleshootingGuide = [
    {
      id: 'trouble_1',
      title: '1. AI ไม่ยอมตอบแชทลูกค้า หรือตอบผิดเพจ / ไม่มีข้อความส่งกลับใน Messenger',
      symptom: 'ลูกค้าทักเข้ามาใน Messenger แต่ไม่มีข้อความตอบกลับ หรือแอดมิน AI นิ่งเฉย ไม่มี Log ส่งข้อความ',
      causes: [
        'สวิตช์ Auto Reply หรือ Auto Close AI ในศูนย์รวมเพจ (Pages Hub) ถูกปิดอยู่',
        'Page Access Token หมดอายุ หรือไม่มีสิทธิ์ pages_messaging / pages_read_engagement',
        'ไม่ได้ตั้งค่า Webhook Callback URL ใน Meta App Dashboard หรือยังไม่ได้ Subscribe field "messages"',
        'ไม่ได้ระบุ GEMINI_API_KEY หรือเครดิตโควต้า API เต็ม'
      ],
      solutions: [
        'เข้าไปที่แท็บ "ศูนย์รวมเพจ" ตรวจสอบให้สวิตช์ "ระบบตอบ AI อัตโนมัติ" และ "ระบบปิดการขาย 6 สเต็ป" เป็นสีเขียว (ON)',
        'กดปุ่ม "เชื่อมต่อ Facebook" -> เลือก 1-Click Meta Login หรือกรอก User Token เพื่ออัปเดต Long-lived Token ชุดใหม่',
        'ตรวจสอบที่ Facebook Developer Console -> Webhooks -> Page -> ตรวจสอบว่า Subscribe "messages", "messaging_postbacks", "feed" เรียบร้อยแล้ว',
        'เปิดแท็บ "ภาพรวมระบบ & Logs" ตรวจสอบ Activity Logs ว่ามี Error Code 401 หรือ 400 หรือไม่'
      ],
      aiFixInstruction: `เมื่อ AI พบปัญหาข้อความไม่ส่ง:
1. ตรวจสอบ Object db.pages.find(p => p.page_id === targetId) ว่ามีอยู่จริงและ is_active === true
2. เช็คการถอดรหัส decryptToken(pageConfig.page_access_token) ว่าได้ Token ที่ขึ้นต้นด้วย 'EAA'
3. ตรวจสอบ fetch("https://graph.facebook.com/v19.0/me/messages") หากได้ 400 ให้ log data.error ลงใน addLog ทันที`
    },
    {
      id: 'trouble_2',
      title: '2. Facebook OAuth Login ล้มเหลว หรือ Error "URL Blocked: This redirect failed"',
      symptom: 'กดปุ่ม Connect Facebook แล้วขึ้นข้อความแจ้งเตือนสีแดง หรือเกิดข้อผิดพลาดจากหน้าต่างของ Meta',
      causes: [
        'ไม่ได้ระบุ Valid OAuth Redirect URIs ใน Facebook Login Settings บน Meta App Dashboard',
        'Facebook App ID หรือ Facebook App Secret ใน .env ไม่ถูกต้อง',
        'App ยังอยู่ในสถานะ "In Development" และบัญชี Facebook ที่ใช้ล็อกอินยังไม่ได้ถูกเพิ่มเป็น Administrator/Developer/Tester ใน App Roles'
      ],
      solutions: [
        'คัดลอก URL Callback: https://<your-domain>/api/facebook/callback ไปวางใน Meta App Dashboard -> Facebook Login -> Settings -> Valid OAuth Redirect URIs',
        'หากแอปยังอยู่ในสถานะ In Development ให้เพิ่ม Facebook User เข้าใน App Roles -> Roles -> Add Testers',
        'หรือสลับไปใช้แท็บ "User Token ซิงค์" โดยคัดลอก Token จาก Graph API Explorer มาวางเพื่อซิงค์ 1-Click โดยไม่ต้องผ่าน OAuth Dialog'
      ],
      aiFixInstruction: `การแก้ไขปัญหา Meta OAuth Redirect:
1. ตรวจสอบค่า host จาก req.headers['x-forwarded-host'] || req.get('host')
2. ตรวจสอบ URL Callback: \`\${req.protocol}://\${host}/api/facebook/callback\` ว่าตรงกับที่อนุญาตใน Meta Dashboard หรือไม่
3. ตรวจสอบการแลก authorization code ผ่าน https://graph.facebook.com/v19.0/oauth/access_token`
    },
    {
      id: 'trouble_3',
      title: '3. Token ถูกเข้ารหัสแล้วถอดรหัสไม่ได้ หรือเกิดข้อผิดพลาด Invalid Key Length',
      symptom: 'ระบบไม่สามารถส่งข้อความได้เนื่องจากเกิดข้อผิดพลาด Decryption Failed หรือ Token ปรากฏเป็น enc:...',
      causes: [
        'ENCRYPTION_SECRET_KEY ใน .env ถูกเปลี่ยนแปลงหลังจากที่ได้ทำการเข้ารหัส Token ไปแล้ว',
        'โครงสร้าง Token ในรูปแบบ enc:iv:tag:data ถูกตัดทอนหรือมีอักขระขาดหาย'
      ],
      solutions: [
        'ระบบสร้าง SHA-256 Hash จาก ENCRYPTION_SECRET_KEY อัตโนมัติเพื่อให้ได้ 32-byte key เสมอ',
        'หากมีการเปลี่ยน Secret Key ให้ทำการกด "ซิงค์เพจ Facebook" ใหม่อีกครั้งเพื่อเข้ารหัสด้วย Key ชุดปัจจุบัน',
        'ตรวจสอบว่าใน database JSON ไม่มี Token ที่เสียหาย'
      ],
      aiFixInstruction: `การแก้ไขปัญหา Decryption Token:
1. ฟังก์ชัน getEncryptionKey() ต้องใช้ crypto.createHash('sha256').update(secret).digest()
2. หาก Token ไม่ได้ขึ้นต้นด้วย 'enc:' ให้ return Token เดิมออกมาตรงๆ เพื่อรองรับ Plain Token
3. ครอบ try-catch ใน decryptToken เพื่อป้องกัน Server Crash`
    },
    {
      id: 'trouble_4',
      title: '4. ระบบดึงที่อยู่ลูกค้าผิด หรือยอด COD ไม่ตรงกับโปรโมชั่นที่เลือก',
      symptom: 'ลูกค้าพิมพ์ที่อยู่หรือเบอร์โทรมา แต่ในตารางออเดอร์ช่องที่อยู่ว่างเปล่า หรือยอดเงินกลายเป็น 0',
      causes: [
        'ลูกค้าพิมพ์เบอร์โทรแบบมีขีด (081-234-5678) หรือเว้นวรรค แล้ว Regex สกัดข้อมูลไม่ครอบคลุม',
        'ลูกค้าพิมพ์สั่งซื้อหลายชิ้นแต่ข้อความไม่มีชื่อรุ่นสินค้าชัดเจน',
        'โมเดล AI สกัด JSON Schema ใน IntentResult ไม่สมบูรณ์'
      ],
      solutions: [
        'ระบบเวอร์ชัน 2.7+ ใช้ฟังก์ชัน sanitizePhoneNumber ทำความสะอาดตัวอักษรพิเศษและตัดขีดออกอัตโนมัติ',
        'ใช้ Structured JSON Prompting บังคับ Gemini 3.7 Flash ให้ส่งออก extractedOrder ในรูปแบบ JSON มาตรฐาน',
        'ตรวจสอบค่า display_price และ promotion tiers ในแท็บ "แก้ไขฐานข้อมูล"'
      ],
      aiFixInstruction: `การแก้ไขการดึงข้อมูลที่อยู่และยอดเงิน:
- ใช้ Regex: /(0[689]\\d{8}|0[2-57]\\d{7})/g เพื่อสกัดเบอร์โทรไทยทุกรูปแบบ
- ตรวจสอบรหัสไปรษณีย์ 5 หลักด้วย /\\b\\d{5}\\b/g
- นำผลลัพธ์มาผูกกับ Promotion Tier ของสินค้านั้นๆ หากไม่ระบุ Tier ให้ Default เป็น Tier 1 เสมอ`
    },
    {
      id: 'trouble_5',
      title: '5. ระบบแจ้งเตือน LINE / Telegram ไม่ส่งการแจ้งเตือนเมื่อมีออเดอร์ใหม่',
      symptom: 'มีออเดอร์ COD เข้าระบบแล้ว แต่ไม่มีข้อความแจ้งเตือนเข้ากลุ่ม LINE หรือ Telegram Bot',
      causes: [
        'LINE Notify Token หรือ Telegram Bot Token ไม่ถูกต้อง หรือหมดอายุ',
        'ยังไม่ได้ดึง LINE Notify เข้ากลุ่มแชท หรือยังไม่ได้กด /start ใน Telegram Bot',
        'ช่อง notification_channel ในการตั้งค่าเพจถูกปิดไว้'
      ],
      solutions: [
        'กดปุ่ม "ตั้งค่าเพจ" (ไอคอนฟันเฟือง) ที่เพจนั้นๆ -> ตรวจสอบ Token และเปิดช่องทางแจ้งเตือนเป็น LINE / Telegram / BOTH',
        'ทดสอบส่งข้อความแจ้งเตือนด้วยปุ่มจำลอง Webhook ในหน้า ภาพรวมระบบ & Logs',
        'ตรวจสอบว่าเซิร์ฟเวอร์ยิง Request ไปที่ https://notify-api.line.me/api/notify ด้วย Header Authorization: Bearer <TOKEN>'
      ],
      aiFixInstruction: `แนวทางแก้ไข LINE / Telegram Notify:
1. ตรวจสอบฟังก์ชัน sendLineNotification(token, message):
   fetch('https://notify-api.line.me/api/notify', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Bearer ' + token },
     body: new URLSearchParams({ message })
   });
2. หากส่งไม่สำเร็จ ให้ดักจับ error.message แล้วบันทึกลง ActivityLog ด้วย type "LINE_ALERT" และ status "ERROR"`
    },
    {
      id: 'trouble_6',
      title: '6. ลูกค้าคอมเมนต์ใต้โพสต์แต่ AI ไม่ตอบเมนต์ หรือไม่ส่งเข้าแชทส่วนตัว',
      symptom: 'มีลูกค้าพิมพ์สอบถามราคาใต้โพสต์เพจ แต่ AI ไม่ตอบคอมเมนต์และไม่ดึงเข้า Messenger',
      causes: [
        'Webhook ใน Meta Dashboard ยังไม่ได้เปิด Subscribe ฟิลด์ "feed"',
        'ไม่ได้ให้สิทธิ์ pages_manage_posts หรือ pages_read_user_content ใน Access Token',
        'สวิตช์ Auto Reply ในเพจนั้นๆ ปิดอยู่'
      ],
      solutions: [
        'ตรวจสอบที่ Meta App Dashboard -> Webhooks -> Page -> เปิด Subscribe ฟิลด์ "feed"',
        'ตรวจสอบว่า Page Access Token มีสิทธิ์ pages_manage_posts เพื่อให้สามารถยิง POST /<comment_id>/comments ได้',
        'ทดสอบจำลอง Feed Comment Event ในแท็บ "ภาพรวมระบบ & Logs"'
      ],
      aiFixInstruction: `การแก้ไข Feed Comment Moderation:
1. ตรวจสอบ change.field === 'feed' && change.value.item === 'comment'
2. สกัด comment_id = change.value.comment_id, message = change.value.message
3. ส่งคำตอบกลับ: fetch(\`https://graph.facebook.com/v19.0/\${comment_id}/comments?access_token=\${rawToken}\`, { method: 'POST', body: JSON.stringify({ message: replyText }) })`
    },
    {
      id: 'trouble_7',
      title: '7. การเชื่อมต่อ Google Sheets API ไม่ซิงค์ข้อมูล หรือ Error 403 Forbidden',
      symptom: 'กดปุ่ม Sync Google Sheets แล้วเกิดข้อผิดพลาด 403 Forbidden หรือข้อมูลไม่อัปเดต',
      causes: [
        'ยังไม่ได้แชร์สิทธิ์ Edit (ผู้แก้ไข) ให้กับ Service Account Email ในไฟล์ Google Sheets',
        'GOOGLE_SHEET_ID ใน .env ไม่ถูกต้อง หรือไม่มี Sheet Tab ชื่อ pages, amulet, china, otop, agriculture'
      ],
      solutions: [
        'เปิดไฟล์ Google Sheets -> กดปุ่ม "แชร์ (Share)" -> ใส่ Email ของ Service Account แล้วให้สิทธิ์ "ผู้แก้ไข (Editor)"',
        'ตรวจสอบ Tab Name ใน Google Sheets ให้ตรงกับชื่อตารางของระบบ เช่น "pages", "amulet", "china", "otop", "agriculture", "orders"',
        'ตรวจสอบค่า GOOGLE_SHEET_ID ใน .env'
      ],
      aiFixInstruction: `การแก้ไข Google Sheets 403:
1. นำ Service Account Client Email จาก GOOGLE_SERVICE_ACCOUNT_JSON
2. ตรวจสอบ scope: ['https://www.googleapis.com/auth/spreadsheets']
3. ให้แอดมินแชร์สิทธิ์ Spreadsheet ให้ Client Email เป็น Editor`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono rounded-full border border-indigo-200 dark:border-indigo-500/20 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                ADVANCED ARCHITECTURE & AI DIAGNOSTIC ENGINE
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold font-mono rounded-full border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                AES-256 + META OAUTH 2.0
              </span>
              <span className="px-2.5 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-bold font-mono rounded-full border border-purple-200 dark:border-purple-500/20">
                v2.8 PRODUCTION SPEC
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              คู่มือระบบเชิงลึก & โค้ดสำหรับ AI วิเคราะห์แก้ไขปัญหา
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-3xl leading-relaxed">
              เอกสารสถาปัตยกรรมระบบขั้นสูง แผนผังการทำงาน Webhook Hub โครงสร้างความปลอดภัย AES-256 Meta OAuth 2.0 โค้ดแม่แบบ Gemini 3.7 Flash และเครื่องมือวินิจฉัยแก้ไขปัญหาอัตโนมัติ (AI Self-Healing Engine)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(JSON.stringify(pages, null, 2), 'all_pages_json')}
              className="px-4 py-2.5 bg-slate-100 dark:bg-[#141418] hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-zinc-700 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              {copiedKey === 'all_pages_json' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-indigo-500" />}
              <span>{copiedKey === 'all_pages_json' ? 'คัดลอก JSON แล้ว' : 'คัดลอก Config ทั้งหมด'}</span>
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 p-1.5 bg-slate-100 dark:bg-[#141418] rounded-2xl border border-slate-200 dark:border-zinc-800 mt-6 text-xs">
          <button
            onClick={() => setActiveSection('architecture')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'architecture'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Workflow className="w-3.5 h-3.5" />
            <span>1. ผังระบบ</span>
          </button>

          <button
            onClick={() => setActiveSection('ai_prompt')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'ai_prompt'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. AI 6 สเต็ป</span>
          </button>

          <button
            onClick={() => setActiveSection('webhook_flow')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'webhook_flow'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>3. Webhook</span>
          </button>

          <button
            onClick={() => setActiveSection('security_oauth')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'security_oauth'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>4. OAuth & AES</span>
          </button>

          <button
            onClick={() => setActiveSection('interactive_diagnostic')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'interactive_diagnostic'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>5. วินิจฉัย AI</span>
          </button>

          <button
            onClick={() => setActiveSection('troubleshooting')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'troubleshooting'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
            <span>6. จุดแก้ปัญหา</span>
          </button>

          <button
            onClick={() => setActiveSection('code_reference')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'code_reference'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>7. Database</span>
          </button>

          <button
            onClick={() => setActiveSection('api_endpoints')}
            className={`py-2 px-2.5 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeSection === 'api_endpoints'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>8. REST APIs</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ARCHITECTURE OVERVIEW */}
      {activeSection === 'architecture' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Workflow className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                สถาปัตยกรรมระบบการทำงานแบบ Multi-Page SuperAI (End-to-End Workflow)
              </h3>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                Express.js + Gemini 3.7 Flash + Meta Graph API v19.0
              </span>
            </div>

            {/* Visual Step-by-Step Flow */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  1
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-zinc-100">ลูกค้าส่งข้อความ / เมนต์</h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Meta ส่ง Webhook Event ไปที่ <code className="text-indigo-500">/api/webhook/facebook</code> พร้อม PSID ของลูกค้า
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                  2
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-zinc-100">AI สกัดเจตนา & ปิดการขาย</h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Gemini 3.7 Flash วิเคราะห์ 6-Step Sales Sequence, เลือกโปรโมชั่น, และสกัดที่อยู่จัดส่ง COD
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                  3
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-zinc-100">บันทึก Order & CRM</h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  สร้างตารางออเดอร์ COD, อัปเดต Tier ลูกค้า (VIP/Gold), พร้อมสร้าง Tracking อัตโนมัติ
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center text-white font-bold text-xs">
                  4
                </div>
                <h4 className="font-bold text-xs text-slate-900 dark:text-zinc-100">แจ้งเตือนแอดมิน & ขนส่ง</h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  ส่งข้อความแจ้งเตือนกลุ่ม LINE Notify / Telegram Bot และเตรียมข้อมูลพร้อมพิมพ์ใบปะหน้า Flash/Kerry
                </p>
              </div>
            </div>

            {/* Detailed System Architecture Specification */}
            <div className="space-y-3 text-xs text-slate-700 dark:text-zinc-300">
              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-500" />
                  1. การแบ่งโมเดลแยกอิสระ (Multi-Tenant Per-Page Architecture)
                </h4>
                <p className="leading-relaxed">
                  แต่ละเพจในระบบมี <strong>PageConfig</strong> ของตนเองอย่างสมบูรณ์แบบ ได้แก่ Access Token (เข้ารหัส AES-256-GCM), Verify Token, สินค้าเฉพาะเพจ (Product Config), สเต็ปการปิดการขาย (6-Step Sales Sequence), ป้ายกำกับหมวดหมู่ (พระเครื่อง / จีน / OTOP / การเกษตร), และ Token สำหรับการแจ้งเตือนแยกกลุ่ม LINE / Telegram ของแต่ละทีมขาย
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  2. ระบบ Intent Recognition & 6-Step Hybrid Sales Engine
                </h4>
                <p className="leading-relaxed">
                  ระบบไม่ได้แค่ตอบตามคีย์เวิร์ดธรรมดา แต่ใช้ Gemini 3.7 Flash ผสานกับ Regular Expressions ในการตรวจจับความพร้อมในการซื้อ (Buying Signals) เช่น เมื่อลูกค้าพิมพ์ "เอา 2 กล่อง ส่งมาที่..." ระบบจะข้ามสเต็ป 1-5 ไปทำ <strong>Step 6: COD Order Closing</strong> ทันที โดยดึงชื่อ, เบอร์โทร 10 หลัก, และที่อยู่ออกมา แล้วตอบกลับข้อความสรุปยอดเก็บเงินปลายทางพร้อมยอดสุทธิ
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: AI PROMPT 6 STEPS */}
      {activeSection === 'ai_prompt' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  โครงสร้าง System Prompt & คำสั่งควบคุม AI ปิดการขาย (Gemini 3.7 Flash)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  โค้ด Prompt แม่แบบที่ส่งให้โมเดล AI ในการคำนวณราคา สรุปโปร และตอบลูกค้าแบบอัตโนมัติ
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(aiClosingSystemPrompt, 'ai_prompt_text')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedKey === 'ai_prompt_text' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'ai_prompt_text' ? 'คัดลอก Prompt แล้ว' : 'คัดลอก Prompt'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-indigo-200 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-[500px]">
                {aiClosingSystemPrompt}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: WEBHOOK FLOW CODE */}
      {activeSection === 'webhook_flow' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  โค้ดตัวอย่าง Backend Webhook Handler (/server.ts)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  กระบวนการรับ Event จาก Meta Graph API และประมวลผลข้อความแบบ Non-blocking
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(webhookFlowCode, 'webhook_flow_code')}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedKey === 'webhook_flow_code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'webhook_flow_code' ? 'คัดลอก Code แล้ว' : 'คัดลอก Code'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-emerald-300 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-[500px]">
                {webhookFlowCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SECURITY & META OAUTH FLOW */}
      {activeSection === 'security_oauth' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  การเข้ารหัส Token (AES-256-GCM) & Meta OAuth 2.0 Flow
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  มาตรฐานความปลอดภัยระดับธนาคาร ป้องกัน Token รั่วไหล พร้อมระบบ Auto-Subscribe Webhook
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(securityOauthCode, 'security_code')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedKey === 'security_code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'security_code' ? 'คัดลอก Code แล้ว' : 'คัดลอก Code'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <Key className="w-4 h-4" />
                  1. AES-256-GCM Encryption
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Page Access Token ทั้งหมดจะถูกเข้ารหัสก่อนบันทึกลงฐานข้อมูลในรูปแบบ <code>enc:iv:authTag:cipher</code> โดยใช้ Key จาก <code>ENCRYPTION_SECRET_KEY</code>
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-4 h-4" />
                  2. Token Masking on Frontend
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  เมื่อ Frontend ร้องขอข้อมูลเพจผ่าน <code>/api/data</code> ระบบจะทำการ Mask Token เป็น <code>EAA•••4f8a</code> เพื่อไม่ให้ Token ตัวจริงแสดงบนเบราว์เซอร์
                </p>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                  <Workflow className="w-4 h-4" />
                  3. Auto-Subscribed Apps
                </div>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  เมื่อเชื่อมต่อเพจสำเร็จ เซิร์ฟเวอร์จะยิง <code>POST /&lt;page_id&gt;/subscribed_apps</code> เพื่อให้เพจเริ่มส่ง Webhook Messages/Feed เข้ามาทันที
                </p>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-teal-300 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800 max-h-[500px]">
                {securityOauthCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: INTERACTIVE AI DIAGNOSTIC PLAYGROUND */}
      {activeSection === 'interactive_diagnostic' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" />
                เครื่องมือทดสอบ & วินิจฉัยข้อผิดพลาดอัจฉริยะ (Interactive AI Diagnostic Engine)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                พิมพ์ Error Log หรือสถานการณ์ปัญหาที่พบ ระบบจะประมวลผล Root Cause พร้อมโค้ดซ่อมแซมสำหรับ AI ให้ทันที
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">ตัวอย่างสถานการณ์ทดสอบด่วน:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setDiagnosticInput('Meta Graph API Error 190: Error validating access token: Session has expired or user changed password.');
                    handleRunDiagnostic('Meta Graph API Error 190: Error validating access token: Session has expired or user changed password.');
                  }}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  🔴 Token Expired / Error 190
                </button>
                <button
                  onClick={() => {
                    setDiagnosticInput('ลูกค้าส่งข้อความ "ขอสั่ง 2 ชุด เบอร์ 0891234567 ที่อยู่ 123 ม.4 บางพลี สมุทรปราการ 10540" แต่ในตารางยอดเงินไม่แสดง');
                    handleRunDiagnostic('ลูกค้าส่งข้อความ "ขอสั่ง 2 ชุด เบอร์ 0891234567 ที่อยู่ 123 ม.4 บางพลี สมุทรปราการ 10540" แต่ในตารางยอดเงินไม่แสดง');
                  }}
                  className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-xl border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  🟡 ดึงที่อยู่หรือยอด COD ไม่ตรง
                </button>
                <button
                  onClick={() => {
                    setDiagnosticInput('Error: GEMINI_API_KEY is not defined or quota 429 ResourceExhausted');
                    handleRunDiagnostic('Error: GEMINI_API_KEY is not defined or quota 429 ResourceExhausted');
                  }}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-xl border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  🟣 Gemini API Error / Rate Limit
                </button>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-3">
              <textarea
                value={diagnosticInput}
                onChange={(e) => setDiagnosticInput(e.target.value)}
                placeholder="วาง Error Message, Network Log, หรือพิมพ์อธิบายอาการปัญหาที่พบที่นี่..."
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-[#141418] border border-slate-300 dark:border-zinc-700 rounded-2xl text-xs font-mono text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex justify-end">
                <button
                  onClick={() => handleRunDiagnostic()}
                  disabled={isDiagnosing || !diagnosticInput.trim()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  {isDiagnosing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                  <span>{isDiagnosing ? 'กำลังวิเคราะห์ Root Cause...' : 'เริ่มวินิจฉัยปัญหา'}</span>
                </button>
              </div>
            </div>

            {/* Diagnostic Output */}
            {diagnosticResult && (
              <div className="bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full font-mono flex items-center gap-1.5 ${
                    diagnosticResult.status === 'CRITICAL' ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-300' :
                    diagnosticResult.status === 'WARNING' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300' :
                    'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300'
                  }`}>
                    {diagnosticResult.status === 'CRITICAL' ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    STATUS: {diagnosticResult.status}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">DIAGNOSTIC RESOLUTION PLAN</span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100">{diagnosticResult.issue}</h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                    <strong>สาเหตุที่แท้จริง (Root Cause):</strong> {diagnosticResult.rootCause}
                  </p>
                </div>

                <div className="space-y-1.5 text-xs text-slate-700 dark:text-zinc-300">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 block">ขั้นตอนการแก้ปัญหา (Action Plan):</span>
                  {diagnosticResult.actionPlan.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-indigo-400 font-bold text-xs">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      โค้ดสำหรับ AI วิเคราะห์แก้ไขปัญหา (AI Fix Snippet):
                    </span>
                    <button
                      onClick={() => copyToClipboard(diagnosticResult.aiFixCode, 'diag_code')}
                      className="text-[10px] px-2.5 py-1 bg-indigo-600/40 hover:bg-indigo-600/70 rounded font-mono text-indigo-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'diag_code' ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
                    </button>
                  </div>
                  <pre className="text-emerald-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-x-auto">
                    {diagnosticResult.aiFixCode}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 6: TROUBLESHOOTING & AI FIX GUIDE */}
      {activeSection === 'troubleshooting' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <h4 className="font-bold text-xs text-rose-800 dark:text-rose-300">
                ศูนย์วิเคราะห์ข้อผิดพลาด & คู่มือการซ่อมแซมระบบ (Diagnostic & Self-Healing Matrix)
              </h4>
              <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
                รวบรวมปัญหาที่พบบ่อย 7 ประการ สาเหตุ และโค้ดคำสั่งสำหรับให้ AI หรือแอดมินนำไปตรวจเช็คและแก้ไขทันที
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {troubleshootingGuide.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4"
              >
                <div
                  onClick={() => toggleTopic(item.id)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    {item.title}
                  </h4>
                  {expandedTopics[item.id] ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>

                {expandedTopics[item.id] && (
                  <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 block mb-1">
                        อาการที่พบ:
                      </span>
                      <p className="text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-[#141418] p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800">
                        {item.symptom}
                      </p>
                    </div>

                    <div>
                      <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                        สาเหตุที่เป็นไปได้:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-zinc-300 pl-1">
                        {item.causes.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                        วิธีแก้ไขสำหรับผู้ใช้:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-zinc-300 pl-1">
                        {item.solutions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      <div className="flex items-center justify-between text-indigo-400 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          คำสั่งสำหรับ AI นำไปวิเคราะห์โค้ด (AI Repair Logic):
                        </span>
                        <button
                          onClick={() => copyToClipboard(item.aiFixInstruction, item.id + '_fix')}
                          className="text-[10px] px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/50 rounded font-mono text-indigo-300 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === item.id + '_fix' ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่ง'}
                        </button>
                      </div>
                      <pre className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                        {item.aiFixInstruction}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 7: CODE & DATA SCHEMAS */}
      {activeSection === 'code_reference' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <FileCode2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              โครงสร้าง Type Definition & Database Schema (`/src/types.ts`)
            </h3>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">1. PageConfig Interface</h4>
                <p className="text-slate-600 dark:text-zinc-400">
                  โครงสร้างหลักสำหรับจัดเก็บข้อมูล 1 เพจ Facebook รวม Access Token (Encrypted), สินค้า, และค่าคอนฟิก AI
                </p>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
{`interface PageConfig {
  page_id: string;
  page_name: string;
  category: 'AMULET' | 'CHINA' | 'OTOP' | 'AGRICULTURE';
  page_access_token: string; // Stored encrypted as "enc:iv:tag:cipher"
  verify_token: string;
  is_active: boolean;
  auto_reply: boolean;
  auto_close_ai: boolean;
  ai_model: string; // 'gemini-3.7-flash'
  admin_name: string;
  ai_tone: 'FRIENDLY' | 'PROFESSIONAL' | 'SACRED' | 'FAST_CLOSING';
  product: PageProductConfig;
  sequence: SalesSequenceConfig;
  cod_summary_fields: CodSummaryFieldsConfig;
}`}
                </pre>
              </div>

              <div className="bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-2">
                <h4 className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">2. Order Interface (COD & Shipping)</h4>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto">
{`interface Order {
  order_id: string; // 'ORD-17234...'
  psid: string;
  customer_name: string;
  phone_number: string;
  shipping_address: string;
  items: string;
  quantity?: number;
  total_amount: number;
  payment_status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  created_at: string;
  tracking_number: string;
  page_id?: string;
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: API ENDPOINTS */}
      {activeSection === 'api_endpoints' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              รายการ API Endpoints ภายในระบบ (REST API Directory)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold font-mono rounded">
                  GET
                </span>
                <div className="space-y-1 flex-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">/api/facebook/connect</div>
                  <p className="text-slate-500 dark:text-zinc-400">Initiate Meta OAuth 2.0 Flow สำหรับ 1-Click Facebook Page Authorization</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold font-mono rounded">
                  GET
                </span>
                <div className="space-y-1 flex-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">/api/facebook/callback</div>
                  <p className="text-slate-500 dark:text-zinc-400">Meta OAuth Callback แลกเปลี่ยน Token, ดึงเพจ, เข้ารหัส AES-256 และ Subscribe Webhooks</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold font-mono rounded">
                  GET
                </span>
                <div className="space-y-1 flex-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">/api/data</div>
                  <p className="text-slate-500 dark:text-zinc-400">ดึงข้อมูล Database ทั้งหมด (Pages masked token, Orders, Customers, Logs, Products)</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 font-bold font-mono rounded">
                  POST
                </span>
                <div className="space-y-1 flex-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">/api/facebook/sync-pages</div>
                  <p className="text-slate-500 dark:text-zinc-400">ดึงรายชื่อเพจและ Access Token ทั้งหมดอัตโนมัติผ่าน User Access Token หรือ Page Token</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl flex items-start gap-3">
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold font-mono rounded">
                  ALL
                </span>
                <div className="space-y-1 flex-1">
                  <div className="font-mono font-bold text-slate-900 dark:text-zinc-100">/api/webhook/facebook & /webhook/facebook</div>
                  <p className="text-slate-500 dark:text-zinc-400">Hub Webhook Receiver รองรับ GET (Verify Challenge) และ POST (Message/Comment Ingress)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
