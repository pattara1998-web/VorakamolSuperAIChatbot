import React, { useState } from 'react';
import { Lock, User, Shield, AlertCircle, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (sessionData: any) => void;
  theme: 'dark' | 'light';
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, theme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityCode, setSecurityCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const isDark = theme === 'dark';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, security_code: securityCode })
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('superai_session_id', data.session_id);
        localStorage.setItem('superai_token', data.token);
        localStorage.setItem('superai_user', JSON.stringify(data.user));
        localStorage.setItem('fb_chatbot_unlocked', 'true');
        onLoginSuccess(data);
      } else {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        if (data.error?.includes('จำนวนครั้ง')) {
          const match = data.error.match(/(\d+) นาที/);
          if (match) setAttemptsLeft(parseInt(match[1]));
        }
      }
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }

    setLoading(false);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#09090B]' : 'bg-slate-100'}`}>
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl p-8 ${isDark ? 'bg-[#121216] border-zinc-800' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-indigo-500/10 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200'}`}>
            <Shield className={`w-8 h-8 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
          </div>
          <h1 className={`text-2xl font-black ${isDark ? 'text-zinc-100' : 'text-slate-900'}`}>
            Vorakamol SuperAI
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
            เข้าสู่ระบบจัดการแชทบอทอัจฉริยะ
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-red-500 font-medium">{error}</p>
              {attemptsLeft !== null && (
                <p className="text-[10px] text-red-400 mt-1">ลองใหม่อีกครั้งใน {attemptsLeft} นาที</p>
              )}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Username */}
          <div>
            <label className={`text-xs font-bold mb-1.5 block ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              ชื่อผู้ใช้
            </label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้"
                autoComplete="username"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? 'bg-[#0A0A0C] border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
                } outline-none transition-colors`}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className={`text-xs font-bold mb-1.5 block ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? 'bg-[#0A0A0C] border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
                } outline-none transition-colors`}
              />
            </div>
          </div>

          {/* Security Code */}
          <div>
            <label className={`text-xs font-bold mb-1.5 block ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>
              รหัสความปลอดภัย
            </label>
            <div className="relative">
              <Shield className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} />
              <input
                type="password"
                value={securityCode}
                onChange={e => setSecurityCode(e.target.value)}
                placeholder="กรอกรหัสความปลอดภัย 6 หลัก"
                maxLength={10}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? 'bg-[#0A0A0C] border-zinc-800 text-zinc-200 placeholder-zinc-600 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'
                } outline-none transition-colors`}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !username || !password || !securityCode}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20 mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังเข้าสู่ระบบ...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                เข้าสู่ระบบ
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={`mt-6 pt-4 border-t text-center ${isDark ? 'border-zinc-800' : 'border-slate-200'}`}>
          <p className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
            🔒 ระบบรักษาความปลอดภัยด้วย AES-256 + Session Token
          </p>
          <p className={`text-[10px] mt-1 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`}>
            เวอร์ชัน 3.0 PRO • © 2026 Vorakamol SuperAI
          </p>
        </div>
      </div>
    </div>
  );
};
