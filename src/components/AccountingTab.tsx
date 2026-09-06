import React, { useEffect } from 'react';
import { DollarSign, Truck, Megaphone, Receipt, Save } from 'lucide-react';

interface AccountingTabProps {
  pageId: string;
  pageName: string;
  expenseForm: { ad_spend: string; shipping_cost: string; other_cost: string };
  setExpenseForm: (f: { ad_spend: string; shipping_cost: string; other_cost: string }) => void;
  onSave: () => void;
  saving: boolean;
  saved: string;
  onOpen: (pageId: string) => void;
}

/** แท็บบัญชีรายวัน: กรอกงบยิงแอด / ค่าส่งที่จ่ายวันนี้ / ค่าใช้จ่ายอื่น — ใช้คำนวณกำไรในแดชบอร์ด */
export const AccountingTab: React.FC<AccountingTabProps> = ({
  pageId, pageName, expenseForm, setExpenseForm, onSave, saving, saved, onOpen
}) => {
  useEffect(() => {
    if (pageId) onOpen(pageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const fields = [
    { key: 'ad_spend' as const, label: 'งบยิงแอดวันนี้', icon: Megaphone, color: 'text-orange-600 dark:text-orange-400', border: 'focus:border-orange-500' },
    { key: 'shipping_cost' as const, label: 'ค่าส่งสินค้าที่จ่ายวันนี้', icon: Truck, color: 'text-sky-600 dark:text-sky-400', border: 'focus:border-sky-500' },
    { key: 'other_cost' as const, label: 'ค่าใช้จ่ายอื่นวันนี้', icon: Receipt, color: 'text-slate-600 dark:text-zinc-300', border: 'focus:border-indigo-500' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ค่าใช้จ่ายวันนี้ — {pageName}
          </h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            กรอกทุกวัน (หรือเปลี่ยนค่าได้ตลอด) — แดชบอร์ดจะนำไปหักจากยอดขายเพื่อคำนวณกำไรขาดทุนจริง
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                <f.icon className={`w-3.5 h-3.5 ${f.color}`} /> {f.label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold text-xs">฿</span>
                <input
                  type="number"
                  min={0}
                  value={expenseForm[f.key]}
                  onChange={e => setExpenseForm({ ...expenseForm, [f.key]: e.target.value })}
                  placeholder="0"
                  className={`w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 outline-none ${f.border}`}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกค่าใช้จ่ายวันนี้'}
        </button>

        {saved && (
          <p className={`text-xs font-medium ${saved.startsWith('✅') ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>{saved}</p>
        )}
      </div>

      <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
        💡 สูตรกำไรที่แดชบอร์ดใช้: <b>กำไร = ยอดขาย − ต้นทุนสินค้า (ต่อชิ้นจากข้อมูลสินค้า) − งบแอด − ค่าส่งที่จ่าย − ค่าใช้จ่ายอื่น</b>
      </div>
    </div>
  );
};
