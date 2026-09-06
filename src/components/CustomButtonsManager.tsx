import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, GripVertical } from 'lucide-react';

interface CustomButton {
  id?: string;
  title: string;
  payload: string;
  button_type?: string;
  sort_order?: number;
}

interface CustomButtonsManagerProps {
  pageId: string;
  theme: 'dark' | 'light';
}

export const CustomButtonsManager: React.FC<CustomButtonsManagerProps> = ({ pageId, theme }) => {
  const [buttons, setButtons] = useState<CustomButton[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPayload, setNewPayload] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPayload, setEditPayload] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchButtons = async () => {
    try {
      const res = await fetch(`/api/buttons?page_id=${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setButtons(data.buttons || []);
      }
    } catch (err) {
      console.error('Failed to fetch buttons:', err);
    }
  };

  useEffect(() => {
    fetchButtons();
  }, [pageId]);

  const addButton = async () => {
    if (!newTitle.trim() || newTitle.length > 20) return;
    setLoading(true);
    try {
      const res = await fetch('/api/buttons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          title: newTitle.trim(),
          payload: newPayload.trim() || newTitle.trim(),
          sort_order: buttons.length
        })
      });
      if (res.ok) {
        setNewTitle('');
        setNewPayload('');
        await fetchButtons();
      }
    } catch (err) {
      console.error('Failed to add button:', err);
    }
    setLoading(false);
  };

  const deleteButton = async (id: string) => {
    setLoading(true);
    try {
      await fetch(`/api/buttons/${id}?page_id=${pageId}`, { method: 'DELETE' });
      await fetchButtons();
    } catch (err) {
      console.error('Failed to delete button:', err);
    }
    setLoading(false);
  };

  const startEdit = (btn: CustomButton) => {
    setEditingId(btn.id || null);
    setEditTitle(btn.title);
    setEditPayload(btn.payload);
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim() || editTitle.length > 20) return;
    setLoading(true);
    try {
      await fetch(`/api/buttons/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          title: editTitle.trim(),
          payload: editPayload.trim() || editTitle.trim()
        })
      });
      setEditingId(null);
      await fetchButtons();
    } catch (err) {
      console.error('Failed to update button:', err);
    }
    setLoading(false);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#121216] border-zinc-800' : 'bg-white border-slate-200'}`}>
      <h3 className={`text-sm font-bold mb-3 ${isDark ? 'text-zinc-200' : 'text-slate-800'}`}>
        ปุ่มตอบกลับอัตโนมัติ (Quick Reply Buttons)
      </h3>
      <p className={`text-xs mb-3 ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
        สร้างปุ่มที่ส่งให้ลูกค้าในแชท Messenger (ชื่อปุ่มไม่เกิน 20 ตัวอักษร, สูงสุด 13 ปุ่ม)
      </p>

      {/* Add New Button */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value.slice(0, 20))}
          placeholder="ชื่อปุ่ม (เช่น: สนใจ, ราคา, สั่งซื้อ)"
          maxLength={20}
          className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
            isDark
              ? 'bg-[#0A0A0C] border-zinc-800 text-zinc-200 placeholder-zinc-600'
              : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
          }`}
        />
        <input
          type="text"
          value={newPayload}
          onChange={e => setNewPayload(e.target.value)}
          placeholder="Payload (ส่งให้ AI, เว้นว่าง=ใช้ชื่อปุ่ม)"
          className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
            isDark
              ? 'bg-[#0A0A0C] border-zinc-800 text-zinc-200 placeholder-zinc-600'
              : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
          }`}
        />
        <button
          onClick={addButton}
          disabled={!newTitle.trim() || loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> เพิ่ม
        </button>
      </div>
      <div className={`text-[10px] mb-2 ${newTitle.length > 15 ? 'text-amber-500' : isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
        {newTitle.length}/20 ตัวอักษร
      </div>

      {/* Button List */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {buttons.length === 0 && (
          <div className={`text-xs text-center py-4 ${isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
            ยังไม่มีปุ่ม — เพิ่มปุ่มด้านบนเพื่อเริ่มใช้งาน
          </div>
        )}
        {buttons.map((btn, idx) => (
          <div
            key={btn.id || idx}
            className={`flex items-center gap-2 p-2.5 rounded-lg border ${
              isDark ? 'bg-[#0A0A0C] border-zinc-800/60' : 'bg-slate-50 border-slate-100'
            }`}
          >
            <GripVertical className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-zinc-700' : 'text-slate-300'}`} />
            {editingId === btn.id ? (
              <>
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value.slice(0, 20))}
                  maxLength={20}
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    isDark ? 'bg-[#121216] border-zinc-700 text-zinc-200' : 'bg-white border-slate-200'
                  }`}
                />
                <input
                  type="text"
                  value={editPayload}
                  onChange={e => setEditPayload(e.target.value)}
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    isDark ? 'bg-[#121216] border-zinc-700 text-zinc-200' : 'bg-white border-slate-200'
                  }`}
                />
                <button onClick={saveEdit} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-zinc-500 hover:bg-zinc-500/10 rounded-lg">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>
                    {btn.title}
                  </div>
                  {btn.payload && btn.payload !== btn.title && (
                    <div className={`text-[10px] truncate ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                      payload: {btn.payload}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-slate-200 text-slate-500'}`}>
                  {btn.title.length}/20
                </span>
                <button onClick={() => startEdit(btn)} className="p-1.5 text-indigo-500 hover:bg-indigo-500/10 rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => btn.id && deleteButton(btn.id)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {buttons.length > 0 && (
        <div className={`mt-3 text-[10px] ${buttons.length >= 13 ? 'text-red-500' : isDark ? 'text-zinc-600' : 'text-slate-400'}`}>
          {buttons.length}/13 ปุ่ม (Facebook จำกัดสูงสุด 13 ปุ่มต่อข้อความ)
        </div>
      )}
    </div>
  );
};
