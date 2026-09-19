import * as React from 'react';
import {
  Settings,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Layers,
  Globe,
  Settings2
} from 'lucide-react';

interface SystemSettingsTabProps {
  theme?: 'dark' | 'light';
  onRefresh?: () => void;
}

type SettingsStatus = {
  reply_delay_ms: number | null;
  settingsUpdatedAt: string | null;
  loaded: boolean;
  saving: boolean;
  message: { ok: boolean; text: string } | null;
};

export const SystemSettingsTab: React.FC<SystemSettingsTabProps> = ({ theme, onRefresh }) => {
  const [settings, setSettings] = React.useState<SettingsStatus>({
    reply_delay_ms: null,
    settingsUpdatedAt: null,
    loaded: false,
    saving: false,
    message: null
  });

  React.useEffect(() => {
    let es: EventSource | null = null;
    const load = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        setSettings(prev => ({ ...prev, reply_delay_ms: data.reply_delay_ms ?? null, settingsUpdatedAt: data.settingsUpdatedAt ?? null, loaded: true }));
      } catch { /* keep last */ }
    };
    load();
    if (typeof window !== 'undefined') {
      es = new EventSource('/api/events');
      es.addEventListener('data_updated', (e: MessageEvent) => {
        try { const d = JSON.parse(e.data); if (d.collection === 'settings') load(); } catch {}
      });
    }
    return () => { es?.close(); };
  }, []);

  const saveDelay = async (ms: number) => {
    const val = Math.max(0, Math.min(30000, Math.floor(Number(ms) || 0)));
    setSettings(prev => ({ ...prev, saving: true, message: null }));
    try {
      const res = await fetch('/api/settings/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_delay_ms: val })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSettings(prev => ({ ...prev, saving: false, message: { ok: false, text: data.message || 'ไม่สามารถบันทึกได้' } }));
        return;
      }
      setSettings(prev => ({ ...prev, reply_delay_ms: data.reply_delay_ms, settingsUpdatedAt: new Date().toISOString(), saving: false, message: { ok: true, text: data.message || 'บันทึกเรียบร้อย' } }));
            onRefresh?.();
    } catch {
      setSettings(prev => ({ ...prev, saving: false, message: { ok: false, text: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' } }));
    }
  };

  // Pages fetch: used for the Sequence Steps viewer section
  const [pages, setPages] = React.useState<any[]>([]);
  const [pagesLoaded, setPagesLoaded] = React.useState(false);

  React.useEffect(() => {
    const fetchPages = async () => {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.pages)) {
          setPages(data.pages);
          setPagesLoaded(true);
        }
      } catch { /* keep last */ }
    };
    fetchPages();
    if (typeof window !== 'undefined') {
      const es = new EventSource('/api/events');
      es.addEventListener('data_updated', () => { try { fetchPages(); } catch {} });
      return () => es.close();
    }
  }, []);

  const currentDelay = settings.reply_delay_ms ?? 0;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSettings(prev => ({ ...prev, reply_delay_ms: val }));
  };

  const handleSliderCommit = (e: React.ChangeEvent<HTMLInputElement>) => {
    saveDelay(Number(e.target.value));
  };

  // ---- JSX ----
  const bgCard = theme === 'dark' ? 'bg-[#121216]/95' : 'bg-white';
  const borderCard = theme === 'dark' ? 'border-zinc-800' : 'border-slate-200';
  const textPrimary = theme === 'dark' ? 'text-zinc-100' : 'text-slate-900';
  const textSecondary = theme === 'dark' ? 'text-zinc-400' : 'text-slate-500';

  if (!settings.loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        <span className={`ml-2 ${textSecondary}`}>กำลังโหลดการตั้งค่า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1) Global Reply Delay */}
      <div className={`${bgCard} border ${borderCard} rounded-xl p-6 shadow-sm`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${textPrimary}`}>⏱️ ค่าเริ่มต้นการรอคำตอบ (Global Reply Delay)</h2>
            <p className={`text-sm ${textSecondary}`}>
               milliseconds ที่บอทรอก่อนส่งคำตอบลูกค้า (ใช้เป็น fallback เมื่อเพจไม่มีค่าตัวเอง)
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className={`text-sm font-medium ${textPrimary}`}>
            ค่าปัจจุบัน: <strong className="font-mono">{currentDelay} ms</strong>
          </span>
          <button
            onClick={() => saveDelay(0)}
            disabled={settings.saving || currentDelay === 0}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              currentDelay === 0
                ? 'opacity-50 cursor-default'
                : theme === 'dark'
                ? 'hover:bg-zinc-800 border-zinc-700'
                : 'hover:bg-slate-100 border-slate-300'
            }`}
          >
            รีเซ็ตเป็น 0
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={30000}
          step={100}
          value={currentDelay}
          onChange={handleSliderChange}
          onBlur={handleSliderCommit}
          disabled={settings.saving}
          className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-full appearance-none cursor-pointer slider-thumb"
        />

        <div className="flex justify-between text-xs mt-1">
          <span className={textSecondary}>0 ms (ทันที)</span>
          <span className={textSecondary}>15,000 ms</span>
          <span className={textSecondary}>30,000 ms (30s)</span>
        </div>

        {settings.message && (
          <div className={`mt-3 flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            settings.message.ok
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            {settings.message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{settings.message.text}</span>
          </div>
                )}
      </div>

      {/* 2) Per-Page Reply Delay Override info */}
      <div className={`${bgCard} border ${borderCard} rounded-xl p-6 shadow-sm`}>
        <div className="flex items-center gap-3 mb-2">
          <Globe className="w-5 h-5 text-cyan-500" />
          <h3 className={`text-md font-bold ${textPrimary}`}>ตั้งค่ารายเพจ (Per-Page Override)</h3>
        </div>
        <p className={`text-sm ${textSecondary} mb-3`}>
           แต่ละเพจสามารถตั้งค่า `reply_delay_ms` ของตัวเองได้ในหน้า{' '}
          <strong>Pages Hub ▸ ตั้งค่าเพจ ▸ แท็บ "การตั้งค่าบอท"</strong> — ค่าของเพจจะมา prioritize เหนือค่า Global นี้เสมอ
        </p>
      </div>

      {/* 3) Sequence Steps Viewer (read-only preview of configured sales steps) */}
      <div className={`${bgCard} border ${borderCard} rounded-xl p-6 shadow-sm`}>
        <div className="flex items-center gap-3 mb-4">
          <Layers className="w-5 h-5 text-purple-500" />
          <h3 className={`text-md font-bold ${textPrimary}`}>👁️ ตัวอย่าง Sales Sequence Steps ของทุกเพจ</h3>
        </div>
        {!pagesLoaded ? (
          <p className={`text-sm ${textSecondary}`}>กำลังโหลด...</p>
        ) : pages.length === 0 ? (
          <p className={`text-sm ${textSecondary}`}>ไม่มีเพจ</p>
        ) : (
          <div className="space-y-4">
            {pages.map((page, pi) => {
              const steps = (page.sales_sequence_steps || []).filter(
                (s: any) => s && (String(s?.text_content || '').trim() || String(s?.image_url || '').trim())
              );
              return (
                <div key={page.page_id || pi} className="border border-opacity-30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-sm">{page.page_name || `เพจ ${pi + 1}`}</span>
                    {page.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">ON</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400">OFF</span>
                    )}
                  </div>
                  {steps.length === 0 ? (
                    <p className={`text-xs ${textSecondary}`}>ยังไม่มีขั้นตอนการขาย</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {steps
                        .slice()
                        .sort((a: any, b: any) => (a.step_number || 0) - (b.step_number || 0))
                        .map((s: any) => (
                          <div
                            key={s.step_number || s.id || Math.random()}
                            className={`text-xs rounded-lg p-2 border ${borderCard} ${theme === 'dark' ? 'bg-[#1a1a20]' : 'bg-slate-50'}`}
                          >
                            <span className="font-medium">ขั้นตอน {s.step_number}:</span> {s.text_content?.slice(0, 80) || '(ข้อความว่าง)'}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
