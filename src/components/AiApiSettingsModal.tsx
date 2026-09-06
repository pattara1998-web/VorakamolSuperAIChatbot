import React, { useEffect, useState } from 'react';
import { X, Key, Bot, ShieldCheck, AlertCircle, RefreshCw, Check, Globe, Cpu } from 'lucide-react';

// Kept for PageSettingsModal compatibility — the browser-side local-AI path
// reads this legacy localStorage key; empty means "use the server provider".
export const LOCAL_AI_MODEL_KEY = 'superai_local_ai_model';

export function getStoredLocalAiModel(): string {
  try {
    return localStorage.getItem(LOCAL_AI_MODEL_KEY) || '';
  } catch {
    return '';
  }
}

interface ProviderInfo {
  id: string;
  label: string;
  needsKey: boolean;
  defaultModel: string;
  configured: boolean;
  model: string;
  setupHint: string;
}

interface AiApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

export const AiApiSettingsModal: React.FC<AiApiSettingsModalProps> = ({ isOpen, onClose, theme }) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [current, setCurrent] = useState<string>('GEMINI');
  const [selected, setSelected] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [lmBaseUrl, setLmBaseUrl] = useState('http://localhost:1234');
  const [models, setModels] = useState<{ id: string; label: string }[]>([]);
  const [model, setModel] = useState<string>('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const selectedInfo = providers.find(p => p.id === (selected || current));

  const loadModels = async (providerId: string) => {
    setLoadingModels(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/ai/models?provider=${providerId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setModels(data.models || []);
        if (!(data.models || []).some((m: any) => m.id === model)) setModel('');
        setSuccessMessage(`พบโมเดล ${data.models.length} ตัว — เลือกได้เลย`);
      } else {
        setModels([]);
        setErrorMessage(data.message || 'โหลดรายชื่อโมเดลไม่สำเร็จ');
      }
    } catch {
      setModels([]);
      setErrorMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setLoadingModels(false);
    }
  };

  const switchProvider = (id: string) => {
    setSelected(id);
    setModels([]);
    setModel('');
    setApiKey('');
    setSuccessMessage('');
    setErrorMessage('');
    const info = providers.find(p => p.id === id);
    if (info) setModel(info.model || info.defaultModel || '');
  };

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setSuccessMessage('');
    fetch('/api/ai/providers')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        const list: ProviderInfo[] = data.providers || [];
        setProviders(list);
        const cur = data.current || 'GEMINI';
        setCurrent(cur);
        setSelected(cur);
        const info = list.find(p => p.id === cur);
        setModel(info?.model || info?.defaultModel || '');
      })
      .catch(() => setErrorMessage('ตรวจสอบสถานะ AI ไม่สำเร็จ — ลองเปิดหน้านี้ใหม่'));
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        if (data.lmStudioBaseUrl) setLmBaseUrl(data.lmStudioBaseUrl);
        setUpdatedAt(data.aiSettingsUpdatedAt || data.geminiApiKeyUpdatedAt || null);
      })
      .catch(() => { /* non-critical */ });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const body: Record<string, any> = { provider: selected, model: model.trim() };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      if (selected === 'LMSTUDIO' && lmBaseUrl.trim()) body.baseUrl = lmBaseUrl.trim();
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccessMessage(data.message || 'บันทึกสำเร็จ!');
        setCurrent(selected);
        setTimeout(() => { onClose(); setIsSaving(false); setApiKey(''); }, 2000);
        return;
      }
      setErrorMessage(data.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
    } catch {
      setErrorMessage('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const isLm = selected === 'LMSTUDIO';

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
              <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">ตั้งค่า AI Provider</h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">เลือกผู้ให้บริการ AI ที่ใช้ตอบแชทลูกค้า</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Current status */}
          <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${providers.find(p => p.id === current)?.configured ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300'}`}>
            {providers.find(p => p.id === current)?.configured ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>
              ใช้งานอยู่: <b>{providers.find(p => p.id === current)?.label || current}</b>
              {providers.find(p => p.id === current)?.model ? ` • โมเดล: ${providers.find(p => p.id === current)?.model}` : ''}
              {updatedAt ? ` (อัปเดต ${new Date(updatedAt).toLocaleString('th-TH')})` : ''}
            </span>
          </div>

          {/* Provider tabs */}
          <div className="grid grid-cols-3 gap-1.5">
            {(providers.length ? providers : [
              { id: 'GEMINI', label: 'Google Gemini' },
              { id: 'OPENAI', label: 'OpenAI' },
              { id: 'QWEN', label: 'Qwen' },
              { id: 'ZAI', label: 'Z.AI (GLM)' },
              { id: 'LMSTUDIO', label: 'LM Studio' }
            ]).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchProvider(p.id)}
                className={`px-2 py-2 rounded-lg text-[10px] font-bold border transition-colors flex items-center justify-center gap-1 ${
                  selected === p.id
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-[#16161C] border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-indigo-400'
                }`}
              >
                {p.id === 'LMSTUDIO' ? <Cpu className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                {p.label}
              </button>
            ))}
          </div>

          {/* API key field */}
          {selectedInfo && selectedInfo.needsKey && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">API Key ของ {selectedInfo.label}</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                </div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={selectedInfo.configured ? 'มีคีย์เดิมอยู่แล้ว — วางคีย์ใหม่เมื่อต้องการเปลี่ยน' : selectedInfo.setupHint}
                  className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none transition-colors"
                  required={selectedInfo.id === current ? false : true}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed pt-1">{selectedInfo.setupHint} • คีย์จะถูกเก็บฝั่งเซิร์ฟเวอร์และไม่ถูกส่งกลับมาแสดง</p>
            </div>
          )}

          {/* LM Studio base URL */}
          {isLm && (
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">LM Studio Server URL</label>
              <input
                type="text"
                value={lmBaseUrl}
                onChange={e => setLmBaseUrl(e.target.value)}
                placeholder="http://localhost:1234"
                className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-violet-500 outline-none transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                ต้องรันเซิร์ฟเวอร์ในเครื่องเดียวกับ LM Studio (เปิด LM Studio → Developer → Start Server พอร์ต 1234)
              </p>
            </div>
          )}

          {/* Model picker — real models from the provider */}
          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-[#16161C]/60 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                โมเดลที่ใช้ {isLm ? '(ดึงจาก LM Studio จริง)' : ''}
              </label>
              <button
                type="button"
                onClick={() => loadModels(selected || current)}
                disabled={loadingModels}
                className="shrink-0 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                {loadingModels ? 'กำลังโหลด...' : 'โหลดรายชื่อโมเดล'}
              </button>
            </div>
            {models.length > 0 ? (
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
              >
                <option value="">— เลือกโมเดล —</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder={`ชื่อโมเดล เช่น ${selectedInfo?.defaultModel || 'โมเดลของผู้ให้บริการ'} (หรือกดโหลดรายชื่อโมเดล)`}
                className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
              />
            )}
            <p className="text-[10px] text-slate-500 dark:text-zinc-400">
              {isLm
                ? 'กด "โหลดรายชื่อโมเดล" เพื่อดึงโมเดลที่มีใน LM Studio ของคุณจริง ๆ ไม่ต้องพิมพ์เอง'
                : 'กด "โหลดรายชื่อโมเดล" เพื่อดึงรายการจริงจากผู้ให้บริการ'}
            </p>
          </div>

          {successMessage && (
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs">
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{successMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words">{errorMessage}</span>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSaving || !selected || (!selectedInfo?.configured && selectedInfo?.needsKey && !apiKey.trim())}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'กำลังบันทึกและยืนยัน...' : 'บันทึกและเริ่มใช้งาน Provider นี้'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
