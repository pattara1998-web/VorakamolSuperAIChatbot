import React, { useState } from 'react';
import { Lock, User, Shield, AlertCircle, Loader2, Delete, KeyRound } from 'lucide-react';

interface SecurityLockScreenProps {
  onUnlock: (sessionData: any) => void;
  onFullLogin: () => void;
  theme: 'dark' | 'light';
}

/**
 * PIN Gate - หน้าจอปลดล็อกสำหรับ "เครื่องที่ไว้ใจ"
 * ตรวจ PIN กับเซิร์ฟเวอร์เสมอ (POST /api/auth/pin ด้วย device_token ของเครื่องนี้)
 * ถ้าเซิร์ฟเวอร์บอกว่าเครื่องนี้ไม่ได้ลงทะเบียน (DEVICE_NOT_TRUSTED)
 * จะส่งกลับไปหน้าล็อกอินแบบเต็มรูปแบบอัตโนมัติ
 */
export const SecurityLockScreen: React.FC<SecurityLockScreenProps> = ({ onUnlock, onFullLogin, theme }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isDark = theme === 'dark';

  const handleVerify = async (pinToVerify?: string) => {
    const code = pinToVerify ?? pin;
    if (!code) return;
    const deviceToken = localStorage.getItem('fb_chatbot_device_token');
    if (!deviceToken) { onFullLogin(); return; }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_token: deviceToken, pin: code })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        localStorage.setItem('superai_session_id', data.session_id);
        localStorage.setItem('superai_token', data.token);
        localStorage.setItem('superai_user', JSON.stringify(data.user));
        onUnlock(data);
        return;
      }
      if (data.error === 'DEVICE_NOT_TRUSTED') {
        localStorage.removeItem('fb_chatbot_device_token');
        onFullLogin();
        return;
      }
      setError(data.error || 'PIN ไม่ถูกต้อง');
      setPin('');
    } catch {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypad = (val: string) => {
    if (loading) return;
    const next = (pin + val).slice(0, 8);
    setPin(next);
    if (next.length >= 6) handleVerify(next);
  };

  const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#09090B] text-zinc-100' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`w-full max-w-sm rounded-3xl border p-8 shadow-2xl ${isDark ? 'bg-[#121216] border-zinc-800' : 'bg-white border-slate-200'}`}>
        <div className="text-center mb-6">
          <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-indigo-950/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-lg font-bold flex items-center justify-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" /> กรอก PIN เพื่อปลดล็อก
          </h1>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
            เครื่องนี้เป็นเครื่องที่ไว้ใจ — กรอก PIN (รหัสความปลอดภัย) ได้เลย ไม่ต้องล็อกอินใหม่
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-4">
          {Array.from({ length: Math.max(6, pin.length) }).map((_, i) => (
            <span key={i} className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < pin.length ? 'bg-indigo-500 border-indigo-500 scale-110' : isDark ? 'border-zinc-700' : 'border-slate-300'
            }`} />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {keypad.map((k, i) => (
            <button
              key={i}
              onClick={() => {
                if (k === 'del') setPin(pin.slice(0, -1));
                else if (k) handleKeypad(k);
              }}
              disabled={loading || k === ''}
              className={`h-12 rounded-xl text-lg font-bold transition-all ${k === '' ? 'invisible' : isDark ? 'bg-[#181820] hover:bg-[#20202a] border border-zinc-800' : 'bg-white hover:bg-slate-100 border border-slate-200'}`}
            >
              {k === 'del' ? <Delete className="w-5 h-5 mx-auto" /> : k}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleVerify()}
          disabled={loading || !pin}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-all mb-4"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {loading ? 'กำลังตรวจสอบ...' : 'ปลดล็อกระบบ'}
        </button>

        <button
          onClick={() => { localStorage.removeItem('fb_chatbot_device_token'); onFullLogin(); }}
          className={`w-full text-center text-[11px] font-medium flex items-center justify-center gap-1.5 ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User className="w-3 h-3" />
          ใช้ชื่อผู้ใช้และรหัสผ่านเต็มแทน (สำหรับเครื่องสาธารณะ)
        </button>
      </div>
    </div>
  );
};
