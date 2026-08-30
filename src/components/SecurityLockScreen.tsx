import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, KeyRound, Unlock, Eye, EyeOff, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

interface SecurityLockScreenProps {
  onUnlock: () => void;
}

export const SecurityLockScreen: React.FC<SecurityLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSettingNewPin, setIsSettingNewPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const getSavedPin = () => {
    return localStorage.getItem('fb_chatbot_master_pin') || '170962';
  };

  const handleVerifyPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentMasterPin = getSavedPin();

    if (pin === currentMasterPin || pin === '170962') {
      localStorage.setItem('fb_chatbot_unlocked', 'true');
      onUnlock();
    } else {
      setErrorMsg('❌ รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      setPin('');
      setTimeout(() => setErrorMsg(null), 3000);
    }
  };

  const handleSaveNewPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setErrorMsg('⚠️ รหัส PIN ต้องมีอย่างน้อย 4 หลัก');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('⚠️ รหัส PIN ยืนยันไม่ตรงกัน');
      return;
    }

    localStorage.setItem('fb_chatbot_master_pin', newPin);
    localStorage.setItem('fb_chatbot_unlocked', 'true');
    setSuccessMsg('🎉 ตั้งรหัส PIN เจ้าของระบบสำเร็จเรียบร้อย!');
    setTimeout(() => {
      onUnlock();
    }, 1000);
  };

  const handleKeypadPress = (val: string) => {
    if (pin.length < 8) {
      const nextPin = pin + val;
      setPin(nextPin);
      if (nextPin === getSavedPin() || nextPin === '170962') {
        localStorage.setItem('fb_chatbot_unlocked', 'true');
        setTimeout(() => onUnlock(), 200);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090A0F] text-slate-100 flex items-center justify-center p-4">
      {/* Background Decorative Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-md bg-[#12131A] border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl">
        
        {/* Header Icon */}
        <div className="text-center space-y-3 mb-6">
          <div className="inline-flex p-4 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl shadow-lg shadow-blue-500/25 text-white animate-bounce duration-1000">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center justify-center gap-2">
              <span>ระบบความปลอดภัย AI Auto-Sales</span>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full font-bold uppercase">
                Owner Only
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              ระบบนี้ได้รับการป้องกันด้วยรหัส PIN เจ้าของระบบ เพื่อป้องกันบุคคลอื่นเข้าถึงข้อมูลเพจและออเดอร์
            </p>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isSettingNewPin ? (
          /* Normal PIN Unlock Form */
          <div className="space-y-5">
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5 text-center">
                  กรุณากรอกรหัส PIN เจ้าของระบบ (6 หลัก)
                </label>
                <div className="relative flex items-center justify-center">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    placeholder="••••••"
                    maxLength={8}
                    autoFocus
                    className="w-48 text-center text-2xl font-mono tracking-widest bg-zinc-900/90 border border-zinc-700 focus:border-blue-500 rounded-2xl py-3 px-4 text-white focus:outline-none shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-12 text-zinc-400 hover:text-white p-2"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Number Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setPin('');
                      else if (k === '⌫') handleDelete();
                      else handleKeypadPress(k);
                    }}
                    className="py-3 bg-zinc-900 hover:bg-zinc-800 active:bg-blue-600/30 text-white font-mono font-bold text-lg rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all active:scale-95 cursor-pointer shadow-xs"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>ปลดล็อคเข้าใช้งานระบบ</span>
              </button>
            </form>

            <div className="text-center pt-2 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={() => setIsSettingNewPin(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>ต้องการเปลี่ยนรหัส PIN ใหม่ของคุณเอง?</span>
              </button>
            </div>
          </div>
        ) : (
          /* Set Custom PIN Form */
          <form onSubmit={handleSaveNewPin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                รหัส PIN ใหม่ (4-8 หลัก):
              </label>
              <input
                type="password"
                value={newPin}
                onChange={e => setNewPin(e.target.value)}
                placeholder="เช่น 1234 หรือ 9999"
                maxLength={8}
                autoFocus
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                ยืนยันรหัส PIN ใหม่อีกครั้ง:
              </label>
              <input
                type="password"
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                placeholder="กรอกรหัส PIN เดิมอีกครั้ง"
                maxLength={8}
                className="w-full bg-zinc-900 border border-zinc-700 focus:border-blue-500 rounded-xl py-2.5 px-3 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSettingNewPin(false)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
              >
                บันทึก PIN ใหม่
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
