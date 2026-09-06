import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Save, Check, Loader2, X } from 'lucide-react';

interface ReminderPage {
  page_id: string;
  page_name: string;
  orders_today: number;
  revenue_today: number;
  chats_today: number;
  filled: boolean;
  ad_spend: number;
  shipping_cost: number;
  other_cost: number;
}

interface ExpenseReminderModalProps {
  onClose: () => void;
  onSaved: () => void;
  theme: 'dark' | 'light';
}

/** เด้งรายวัน: กรอกค่าแอด/ค่าส่ง/ค่าใช้จ่าย — เฉพาะเพจที่มีแชทหรือออเดอร์เข้าวันนี้ */
export const ExpenseReminderModal: React.FC<ExpenseReminderModalProps> = ({ onClose, onSaved, theme }) => {
  const dark = theme === 'dark';
  const [pages, setPages] = useState<ReminderPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string>('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/expenses/reminder')
      .then(r => r.json())
      .then(d => { if (d.success) setPages(d.pages || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateField = (pid: string, field: 'ad_spend' | 'shipping_cost' | 'other_cost', val: string) => {
    setPages(prev => prev.map(p => p.page_id === pid ? { ...p, [field]: Number(val) || 0 } : p));
  };

  const saveOne = async (page: ReminderPage) => {
    setSavingId(page.page_id);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: page.page_id,
          expense_date: new Date().toISOString().slice(0, 10),
          ad_spend: page.ad_spend || 0,
          shipping_cost: page.shipping_cost || 0,
          other_cost: page.other_cost || 0
        })
      });
      const r = await res.json();
      if (r.success) {
        setSavedIds(prev => new Set(prev).add(page.page_id));
        setPages(prev => prev.map(p => p.page_id === page.page_id ? { ...p, filled: true } : p));
        onSaved();
      }
    } catch { /* ignore */ }
    finally { setSavingId(''); }
  };

  const pendingCount = pages.filter(p => !p.filled && !savedIds.has(p.page_id)).length;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`rounded-3xl border w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${dark ? 'bg-[#121216] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200 text-slate-900'}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${dark ? 'border-zinc-800 bg-[#16161C]' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                กรอกค่าใช้จ่ายวันนี้
                {pendingCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">{pendingCount} เพจรอกรอก</span>}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                แสดงเฉพาะเพจที่มีลูกค้าทักเข้า หรือ มีออเดอร์เข้าวันนี้ — กรอกงบแอด/ค่าส่งเพื่อคำนวณกำไรจริง
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-xs text-center py-8 text-slate-400 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังสแกนเพจที่มีกิจกรรมวันนี้...</p>
          ) : pages.length === 0 ? (
            <p className="text-xs text-center py-8 text-slate-400">วันนี้ยังไม่มีเพจไหนมีแชทหรือออเดอร์เข้า — ไม่ต้องกรอก</p>
          ) : pages.map(p => {
            const done = p.filled || savedIds.has(p.page_id);
            return (
              <div key={p.page_id} className={`rounded-xl border p-3 space-y-2.5 ${done ? (dark ? 'bg-emerald-950/10 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200') : dark ? 'bg-[#16161C] border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    {done && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                    {p.page_name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    แชท {p.chats_today} • ออเดอร์ {p.orders_today} • ฿{p.revenue_today.toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'ad_spend' as const, label: 'งบแอด' },
                    { key: 'shipping_cost' as const, label: 'ค่าส่งที่จ่าย' },
                    { key: 'other_cost' as const, label: 'อื่น ๆ' }
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[9px] font-bold text-slate-400 block mb-1">{f.label} (฿)</label>
                      <input
                        type="number" min={0}
                        value={p[f.key] || ''}
                        onChange={e => updateField(p.page_id, f.key, e.target.value)}
                        placeholder="0"
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono border outline-none ${dark ? 'bg-[#0F0F12] border-zinc-800 text-zinc-100 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => saveOne(p)}
                  disabled={savingId === p.page_id}
                  className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50 ${
                    done ? (dark ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-100 text-emerald-700 border border-emerald-200') : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                >
                  {savingId === p.page_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {done ? 'บันทึกแล้ว — แก้ไข/บันทึกซ้ำ' : 'บันทึกค่าใช้จ่ายเพจนี้'}
                </button>
              </div>
            );
          })}
        </div>

        <div className={`px-5 py-3 border-t flex items-center justify-between ${dark ? 'border-zinc-800' : 'border-slate-200'}`}>
          <span className={`text-[10px] flex items-center gap-1 ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
            <AlertTriangle className="w-3 h-3" /> ตัวเลขเหล่านี้ไปคำนวณกำไรในแดชบอร์ดทันที
          </span>
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold">
            เสร็จแล้ว
          </button>
        </div>
      </div>
    </div>
  );
};
