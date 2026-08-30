import React, { useEffect, useState } from 'react';
import { X, Key, Bot, ShieldCheck, AlertCircle, Cpu, RefreshCw, MonitorSmartphone } from 'lucide-react';
import { detectLocalAi, LocalAiModelInfo, LocalAiStatus } from '../utils/localAi';

export const LOCAL_AI_MODEL_KEY = 'superai_local_ai_model';

/** อ่านโมเดล Local AI ที่ผู้ใช้เลือกไว้ (เก็บใน localStorage เพราะรันฝั่งเบราว์เซอร์) */
export function getStoredLocalAiModel(): string {
  try {
    return localStorage.getItem(LOCAL_AI_MODEL_KEY) || '';
  } catch {
    return '';
  }
}

interface AiApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

export const AiApiSettingsModal: React.FC<AiApiSettingsModalProps> = ({ isOpen, onClose, theme }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Local AI (Ollama / LM Studio) state
  const [localAiStatus, setLocalAiStatus] = useState<LocalAiStatus | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>(() => getStoredLocalAiModel());
  const [localAiMessage, setLocalAiMessage] = useState('');

  const runLocalAiDetection = async () => {
    setIsDetecting(true);
    setLocalAiMessage('');
    try {
      const status = await detectLocalAi();
      setLocalAiStatus(status);
      if (status.available && status.models.length > 0) {
        setLocalAiMessage(`✅ พบ ${status.provider === 'OLLAMA' ? 'Ollama' : 'LM Studio'} พร้อม ${status.models.length} โมเดล เลือกใช้งานได้เลย`);
        // ถ้ายังไม่ได้เลือกโมเดล ให้เลือกตัวแรกอัตโนมัติ (ใช้งานได้เลยโดยไม่ต้องเลือกเอง)
        if (!selectedLocalModel) {
          const first = `${status.provider === 'OLLAMA' ? 'ollama' : 'lmstudio'}:${status.models[0].model}`;
          setSelectedLocalModel(first);
          try { localStorage.setItem(LOCAL_AI_MODEL_KEY, first); } catch { /* noop */ }
        }
      } else if (status.available) {
        setLocalAiMessage('⚠️ พบโปรแกรมเปิดอยู่ แต่ยังไม่พบโมเดล — กรุณาโหลด/ติดตั้งโมเดลก่อน');
      } else {
        setLocalAiMessage(`❌ ${status.error || 'ไม่พบ Local AI'}`);
      }
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectLocalModel = (modelId: string) => {
    setSelectedLocalModel(modelId);
    try {
      if (modelId) localStorage.setItem(LOCAL_AI_MODEL_KEY, modelId);
      else localStorage.removeItem(LOCAL_AI_MODEL_KEY);
    } catch { /* noop */ }
    setLocalAiMessage(modelId ? `✅ เลือกโมเดล ${modelId} แล้ว — ระบบจะใช้ Local AI ตอบแชทลูกค้า` : 'ปิดโหมด Local AI แล้ว (กลับไปใช้ Gemini)');
  };

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setIsConfigured(!!data.geminiApiKeyConfigured);
        setUpdatedAt(data.geminiApiKeyUpdatedAt || null);
        setActiveModel(data.geminiModel || '');
        // Show warning if not configured (ยกเว้นกรณีเลือก Local AI ไว้แล้ว)
        if (!data.geminiApiKeyConfigured && !getStoredLocalAiModel()) {
          setErrorMessage('⚠️ ต้องใส่ API Key ก่อนจึงจะใช้งานระบบ AI และตอบแชทลูกค้าได้');
        }
      })
      .catch(() => {
        setIsConfigured(false);
        setActiveModel('');
        setErrorMessage('⚠️ ไม่สามารถตรวจสอบสถานะ API ได้ กรุณาใส่ API Key');
      });
    // ตรวจจับ Local AI อัตโนมัติทุกครั้งที่เปิดหน้าต่าง (แค่เปิดโปรแกรมค้างไว้ก็เจอเลย)
    runLocalAiDetection();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch('/api/settings/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveStatus('success');
        setIsConfigured(true);
        setUpdatedAt(new Date().toISOString());
        setActiveModel(data.model || '');
        setSuccessMessage(data.message || 'บันทึก API Key สำเร็จ ระบบพร้อมทำงาน!');
        setTimeout(() => {
          onClose();
          setSaveStatus('idle');
          setApiKey(''); // Clear the input field for security
        }, 2200);
      } else {
        setErrorMessage(data.message || 'ตรวจสอบ API key หรือโควต้าการใช้งานแล้วลองใหม่');
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">ตั้งค่า AI (Gemini / Local AI)</h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">Google Gemini API หรือ Ollama / LM Studio ในเครื่อง</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${isConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300'}`}>
            {isConfigured ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>
              {isConfigured
                ? `AI พร้อมใช้งาน • เก็บคีย์เดิมไว้แล้ว${activeModel ? ` • โมเดล: ${activeModel}` : ''}${updatedAt ? ` (อัปเดต ${new Date(updatedAt).toLocaleString('th-TH')})` : ''}`
                : '⚠️ ต้องใส่ API Key ก่อนจึงจะใช้งานระบบ AI และตอบแชทลูกค้าได้'}
            </span>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
              Google Gemini API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={isConfigured ? 'มีคีย์เดิมอยู่แล้ว — วางคีย์ใหม่เมื่อต้องการเปลี่ยน' : 'AIzaSy...'}
                className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none transition-colors"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed pt-1">
              คีย์จะถูกเก็บที่ฝั่งเซิร์ฟเวอร์และไม่ถูกส่งกลับมาแสดงอีก หากมีคีย์เดิมอยู่ ระบบจะใช้ต่อเนื่องจนกว่าจะเปลี่ยนคีย์ใหม่
            </p>
          </div>

          {/* ===================== LOCAL AI (Ollama / LM Studio) ===================== */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-[#16161C]/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                    Local AI ในเครื่อง (Ollama / LM Studio)
                    {selectedLocalModel && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                        เปิดใช้แล้ว
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                    แค่เปิดโปรแกรมค้างไว้ ระบบตรวจจับให้อัตโนมัติ ไม่ต้องใช้ API Key • ทำงานผ่านเบราว์เซอร์ของคุณ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={runLocalAiDetection}
                disabled={isDetecting}
                className="shrink-0 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isDetecting ? 'animate-spin' : ''}`} />
                {isDetecting ? 'กำลังตรวจ...' : 'ตรวจจับใหม่'}
              </button>
            </div>

            {localAiStatus?.available && localAiStatus.models.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 block">
                  เลือกโมเดล (หรือไม่ต้องเลือก — ระบบเลือกตัวแรกให้อัตโนมัติ):
                </label>
                <select
                  value={selectedLocalModel}
                  onChange={e => handleSelectLocalModel(e.target.value)}
                  className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-violet-500 outline-none"
                >
                  <option value="">— ปิดโหมด Local AI (ใช้ Gemini แทน) —</option>
                  {localAiStatus.models.map((m: LocalAiModelInfo) => (
                    <option key={`${m.provider}:${m.model}`} value={`${m.provider === 'OLLAMA' ? 'ollama' : 'lmstudio'}:${m.model}`}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2.5 bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                <MonitorSmartphone className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" />
                <span>
                  วิธีใช้: 1) เปิด Ollama (ollama serve) หรือ LM Studio → เปิด Developer Server
                  2) โหลดโมเดล เช่น llama3.2, qwen2.5 3) กด "ตรวจจับใหม่" ด้านบน
                </span>
              </div>
            )}

            {localAiMessage && (
              <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-medium break-words">
                {localAiMessage}
              </div>
            )}
          </div>

          {saveStatus === 'success' && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{successMessage || 'บันทึก API Key สำเร็จ ระบบพร้อมทำงาน!'}</span>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-lg text-xs">
              <X className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{errorMessage || 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่'}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving || !apiKey}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'กำลังบันทึก...' : 'บันทึก API Key และเริ่มใช้งาน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
