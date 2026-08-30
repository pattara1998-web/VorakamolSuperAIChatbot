/**
 * Local AI Client (Ollama / LM Studio)
 * ------------------------------------
 * รันฝั่งเบราว์เซอร์โดยตรง เพราะเซิร์ฟเวอร์บนคลาวด์ (Render)
 * ไม่สามารถเข้าถึง localhost ในเครื่องของผู้ใช้ได้
 *
 * - Ollama:     http://localhost:11434  (GET /api/tags, POST /api/chat)
 * - LM Studio:  http://localhost:1234/v1 (GET /v1/models, POST /v1/chat/completions)
 *
 * ผู้ใช้แค่เปิดโปรแกรม Local AI ค้างไว้ ระบบจะตรวจจับให้อัตโนมัติ
 */

export type LocalAiProvider = 'OLLAMA' | 'LMSTUDIO';

export interface LocalAiModelInfo {
  provider: LocalAiProvider;
  model: string; // model id เช่น 'llama3.2', 'qwen2.5-7b-instruct'
  label: string; // ชื่อแสดงใน UI
}

export interface LocalAiStatus {
  available: boolean;
  provider?: LocalAiProvider;
  baseUrl?: string;
  models: LocalAiModelInfo[];
  error?: string;
}

const OLLAMA_BASE = 'http://localhost:11434';
const LMSTUDIO_BASE = 'http://localhost:1234/v1';
const DETECT_TIMEOUT_MS = 2500;
const CHAT_TIMEOUT_MS = 120000;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DETECT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** ตรวจสอบว่า Ollama กำลังรันอยู่หรือไม่ แล้วดึงรายชื่อโมเดลที่ติดตั้งไว้ */
export async function detectOllama(): Promise<LocalAiStatus> {
  try {
    const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { available: false, models: [], error: `Ollama ตอบกลับ HTTP ${res.status}` };
    const data = await res.json();
    const models: LocalAiModelInfo[] = (data.models || [])
      .map((m: any) => ({
        provider: 'OLLAMA' as LocalAiProvider,
        model: String(m.name || m.model || ''),
        label: `Ollama • ${m.name || m.model}`
      }))
      .filter((m: LocalAiModelInfo) => m.model);
    return { available: true, provider: 'OLLAMA', baseUrl: OLLAMA_BASE, models };
  } catch (err: any) {
    return { available: false, models: [], error: 'เชื่อมต่อ Ollama ไม่ได้ (เปิดโปรแกรม Ollama หรือยัง?)' };
  }
}

/** ตรวจสอบว่า LM Studio กำลังรันอยู่หรือไม่ แล้วดึงรายชื่อโมเดลที่โหลดไว้ */
export async function detectLmStudio(): Promise<LocalAiStatus> {
  try {
    const res = await fetchWithTimeout(`${LMSTUDIO_BASE}/models`);
    if (!res.ok) return { available: false, models: [], error: `LM Studio ตอบกลับ HTTP ${res.status}` };
    const data = await res.json();
    const models: LocalAiModelInfo[] = (data.data || [])
      .map((m: any) => ({
        provider: 'LMSTUDIO' as LocalAiProvider,
        model: String(m.id || ''),
        label: `LM Studio • ${m.id}`
      }))
      .filter((m: LocalAiModelInfo) => m.model);
    return { available: true, provider: 'LMSTUDIO', baseUrl: LMSTUDIO_BASE, models };
  } catch (err: any) {
    return { available: false, models: [], error: 'เชื่อมต่อ LM Studio ไม่ได้ (เปิด Developer Server หรือยัง?)' };
  }
}

/**
 * ตรวจจับ Local AI อัตโนมัติ: ลอง Ollama ก่อน แล้วลอง LM Studio
 * ถ้าเปิดโปรแกรมใดโปรแกรมหนึ่งไว้ จะได้รายชื่อโมเดลพร้อมใช้ทันที
 */
export async function detectLocalAi(): Promise<LocalAiStatus> {
  const [ollama, lmstudio] = await Promise.all([detectOllama(), detectLmStudio()]);
  if (ollama.available && ollama.models.length > 0) return ollama;
  if (lmstudio.available && lmstudio.models.length > 0) return lmstudio;
  if (ollama.available) return ollama; // รันอยู่แต่ยังไม่มีโมเดล
  if (lmstudio.available) return lmstudio;
  return {
    available: false,
    models: [],
    error: 'ไม่พบ Local AI ที่เปิดอยู่ — กรุณาเปิด Ollama หรือ LM Studio (Developer Server) แล้วลองใหม่'
  };
}

/** ส่งข้อความไปให้ Local AI ตอบ (เลือก provider ตาม model id ที่ขึ้นต้นด้วย ollama:/lmstudio:) */
export async function chatWithLocalAi(modelId: string, systemPrompt: string, userMessage: string): Promise<string> {
  const isOllama = modelId.startsWith('ollama:');
  const rawModel = modelId.replace(/^(ollama:|lmstudio:)/, '');

  if (isOllama) {
    const res = await fetchWithTimeout(
      `${OLLAMA_BASE}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: rawModel,
          stream: false,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ]
        })
      },
      CHAT_TIMEOUT_MS
    );
    if (!res.ok) throw new Error(`Ollama ตอบกลับ HTTP ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
  }

  const res = await fetchWithTimeout(
    `${LMSTUDIO_BASE}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: rawModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.4
      })
    },
    CHAT_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`LM Studio ตอบกลับ HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/** ตรวจสอบว่า model id เป็น Local AI หรือไม่ */
export function isLocalAiModel(modelId?: string): boolean {
  return !!modelId && (modelId.startsWith('ollama:') || modelId.startsWith('lmstudio:'));
}
