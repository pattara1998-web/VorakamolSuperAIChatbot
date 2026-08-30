import React, { useEffect, useState } from 'react';
import { X, Key, Bot, ShieldCheck, AlertCircle } from 'lucide-react';

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

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setIsConfigured(!!data.geminiApiKeyConfigured);
        setUpdatedAt(data.geminiApiKeyUpdatedAt || null);
        setActiveModel(data.geminiModel || '');
        // Show warning if not configured
        if (!data.geminiApiKeyConfigured) {
          setErrorMessage('⚠️ ต้องใส่ API Key ก่อนจึงจะใช้งานระบบ AI และตอบแชทลูกค้าได้');
        }
      })
      .catch(() => {
        setIsConfigured(false);
        setActiveModel('');
        setErrorMessage('⚠️ ไม่สามารถตรวจสอบสถานะ API ได้ กรุณาใส่ API Key');
      });
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
      
      <div className="relative bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">ตั้งค่า AI API Key</h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">เชื่อมต่อ Google Gemini API</p>
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
