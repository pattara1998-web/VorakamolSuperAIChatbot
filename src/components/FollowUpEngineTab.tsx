import React, { useState, useEffect } from 'react';
import {
  Clock,
  Play,
  CheckCircle2,
  AlertCircle,
  Users,
  Send,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Edit3,
  Plus,
  Trash2,
  Save,
  BookOpen,
  Check,
  MessageSquare
} from 'lucide-react';
import { Customer } from '../types';

interface FollowUpStepItem {
  id: string;
  name: string;
  time: string;
  desc: string;
  message: string;
  is_active: boolean;
}

interface FollowUpEngineTabProps {
  customers: Customer[];
  onRefreshData: () => void;
}

const DEFAULT_STEPS: FollowUpStepItem[] = [
  {
    id: 'fu-1',
    name: 'สเต็ปที่ 1 (หลังคุย 5 นาที)',
    time: '5 นาที',
    desc: 'สอบถามความสนใจเพิ่มเติมหลังส่งรายละเอียดสินค้า เสนอส่วนลดหรือสิทธิ์ส่งฟรี',
    message: 'สวัสดีค่ะ คุณพี่มีข้อสงสัยเกี่ยวกับสินค้าหรือโปรโมชั่นเพิ่มเติมไหมคะ แอดมินยินดีดูแลและมอบส่วนลดพิเศษให้นะคะ 😊🙏',
    is_active: true
  },
  {
    id: 'fu-2',
    name: 'สเต็ปที่ 2 (หลังคุย 50 นาที)',
    time: '50 นาที',
    desc: 'แจ้งเตือนจำนวนสินค้าเหลือน้อย หรือของแถมประจำวันใกล้หมด',
    message: 'แจ้งเตือนสิทธิ์ของแถมและส่งฟรีเก็บเงินปลายทางวันนี้ สินค้ามีจำนวนจำกัดนะคะ สนใจรับสิทธิ์แจ้งชื่อ-ที่อยู่ไว้ได้เลยค่า ⚡📦',
    is_active: true
  },
  {
    id: 'fu-3',
    name: 'สเต็ปที่ 3 (ช่วงค่ำ 21:00 น.)',
    time: '21:00 น.',
    desc: 'สรุปยอดเตรียมแพ็คของรอบเช้าวันถัดไป กระตุ้นการตัดสินใจก่อนปิดรับออเดอร์',
    message: 'โปรโมชั่นรอบพิเศษวันนี้ใกล้จะหมดแล้วนะคะ หากคุณพี่ต้องการให้จัดส่งรอบเช้าพรุ่งนี้ แจ้งชื่อ ที่อยู่ เบอร์โทร ได้เลยนะคะ 🌙',
    is_active: true
  },
  {
    id: 'fu-4',
    name: 'สเต็ปที่ 4 (เช้าวันถัดไป 09:00 น.)',
    time: 'เช้า 09:00 น.',
    desc: 'ทักทายสวัสดีตอนเช้า พร้อมแจ้งเปิดรับรอบส่งด่วนพิเศษของวัน',
    message: 'สวัสดีตอนเช้าค่ะ วันนี้มีรอบส่งด่วน Flash Express ถึงหน้าบ้านใน 1-2 วัน หากสนใจรับสินค้าแจ้งแอดมินให้ล็อกคิวส่งให้ได้เลยนะคะ ☀️📦',
    is_active: true
  }
];

const FOLLOWUP_TEMPLATES = [
  {
    title: '🎁 โปรลดด่วนจำกัดเวลา (Flash Sale)',
    badge: 'กระตุ้นยอดขาย',
    message: '💥 โปรโมชั่น Flash Sale พิเศษเฉพาะรอบวันนี้! สั่งซื้อตอนนี้รับส่วนลดทันที พร้อมของสมนาคุณพิเศษและจัดส่งฟรี COD แจ้งชื่อ-ที่อยู่เพื่อรับสิทธิ์ได้เลยนะคะ ⚡'
  },
  {
    title: '⚡ แจ้งเตือนของแถมใกล้หมดสต็อก',
    badge: 'เร่งการตัดสินใจ',
    message: '⚠️ แจ้งเตือนสิทธิ์พิเศษนะคะ ของแถมพรีเมียมประจำวันเหลือเพียง 3 ชุดสุดท้ายแล้วค่ะ หากคุณพี่ต้องการรับแจ้งแอดมินล็อกสิทธิ์ไว้ให้ได้เลยนะคะ 🙏'
  },
  {
    title: '📦 แจ้งตัดรอบส่งด่วนประจำวัน',
    badge: 'แจ้งรอบส่ง',
    message: '📦 ทางร้านกำลังจะตัดรอบแพ็คสินค้าจัดส่งด่วนรอบบ่ายนี้ค่ะ จัดส่งฟรี มีเก็บเงินปลายทาง ตรวจเช็คของก่อนจ่ายเงินได้ แจ้งที่อยู่จัดส่งได้เลยนะคะ ✨'
  },
  {
    title: '🌙 สรุปยอดเตรียมส่งเช้าวันถัดไป (รอบค่ำ)',
    badge: 'รอบค่ำ 21:00',
    message: 'สวัสดีรอบค่ำค่ะ แอดมินกำลังสรุปยอดออเดอร์สำหรับจัดส่งรอบเช้าวันพรุ่งนี้ คุณพี่รับสินค้ากี่ชุดดีคะ แจ้งชื่อ-เบอร์โทรไว้ได้เลยนะคะ หลับฝันดีค่ะ 🌙'
  },
  {
    title: '🌾 สอบถามความต้องการ / ยินดีให้คำปรึกษา',
    badge: 'บริการลูกค้า',
    message: 'สวัสดีค่ะ คุณพี่ยังติดขัดเรื่องข้อมูลสินค้า วิธีการใช้งาน หรือโปรโมชั่นจุดไหน สอบถามแอดมินได้ตลอด 24 ชม. เลยนะคะ ยินดีบริการค่ะ 😊'
  },
  {
    title: '🌟 โปรโมชั่น 2 ชิ้นสุดคุ้ม (Up-sell)',
    badge: 'เพิ่มมูลค่าบิล',
    message: 'พิเศษสุดๆ แนะนำโปรเซ็ต 2 ชิ้นสุดคุ้ม ประหยัดเพิ่มขึ้นทันที พร้อมของแถมดับเบิ้ลเซ็ต ส่งฟรีถึงหน้าบ้าน สนใจรับแจ้งได้เลยนะคะ 🎁'
  }
];

export const FollowUpEngineTab: React.FC<FollowUpEngineTabProps> = ({
  customers,
  onRefreshData
}) => {
  const [steps, setSteps] = useState<FollowUpStepItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fb_chatbot_followup_steps');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // fallback
        }
      }
    }
    return DEFAULT_STEPS;
  });

  const [editingStep, setEditingStep] = useState<FollowUpStepItem | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [targetStepForTemplate, setTargetStepForTemplate] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const saveSteps = (newSteps: FollowUpStepItem[]) => {
    setSteps(newSteps);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fb_chatbot_followup_steps', JSON.stringify(newSteps));
    }
    setSaveToast('✅ บันทึกลำดับข้อความติดตามลูกค้าสำเร็จแล้ว');
    setTimeout(() => setSaveToast(null), 3000);
  };

  const handleUpdateStepMessage = (id: string, newMsg: string) => {
    const updated = steps.map(s => (s.id === id ? { ...s, message: newMsg } : s));
    saveSteps(updated);
  };

  const handleSaveEditedStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    const updated = steps.map(s => (s.id === editingStep.id ? editingStep : s));
    saveSteps(updated);
    setEditingStep(null);
  };

  const handleApplyTemplate = (templateMsg: string) => {
    if (targetStepForTemplate) {
      const updated = steps.map(s => (s.id === targetStepForTemplate ? { ...s, message: templateMsg } : s));
      saveSteps(updated);
    } else if (editingStep) {
      setEditingStep({ ...editingStep, message: templateMsg });
    }
    setIsTemplateModalOpen(false);
    setTargetStepForTemplate(null);
  };

  const handleAddNewStep = () => {
    const newId = `fu-${Date.now()}`;
    const newStep: FollowUpStepItem = {
      id: newId,
      name: `สเต็ปที่ ${steps.length + 1} (กำหนดเอง)`,
      time: '2 ชั่วโมง',
      desc: 'ข้อความติดตามลูกค้าเพิ่มเติม',
      message: 'สวัสดีค่ะ คุณพี่สนใจรับโปรโมชั่นพิเศษนี้อยู่ไหมคะ สอบถามเพิ่มเติมแจ้งแอดมินได้เลยนะคะ 🙏',
      is_active: true
    };
    saveSteps([...steps, newStep]);
  };

  const handleDeleteStep = (id: string) => {
    if (!window.confirm('คุณต้องการลบสเต็ปติดตามนี้ใช่หรือไม่?')) return;
    const updated = steps.filter(s => s.id !== id);
    saveSteps(updated);
  };

  const pendingCustomers = customers.filter(c => c.status !== 'ORDER_COMPLETED');

  const handleRunFollowUp = async (intervalName: string) => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/followup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalName })
      });
      const data = await res.json();
      setRunResult(data);
      setIsRunning(false);
      onRefreshData();
    } catch (err) {
      console.error(err);
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-lg flex items-center gap-2">
                ระบบส่งข้อความติดตามลูกค้าอัตโนมัติ (Automated Follow-Up Sequence)
                <span className="text-[10px] font-mono bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-500/20">
                  EDITABLE & TEMPLATES
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                ปรับแต่งข้อความและเลือกระยะเวลาที่จะให้ AI ส่งหาลูกค้าที่ยังไม่ปิดการขาย พร้อมคลังเทมเพลตคำพูดปิดการขายสำเร็จรูป
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNewStep}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>+ เพิ่มสเต็ปใหม่</span>
            </button>
            <span className="text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-mono font-bold px-3.5 py-2 rounded-xl border border-amber-200 dark:border-amber-500/30">
              รอดำเนินการ {pendingCustomers.length} รายการ
            </span>
          </div>
        </div>

        {saveToast && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{saveToast}</span>
          </div>
        )}

        {runResult && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>ส่งข้อความติดตามสำเร็จ {runResult.processedCount || 0} รายการเรียบร้อยแล้ว</span>
            </div>
            <button onClick={() => setRunResult(null)} className="text-xs font-bold underline text-emerald-700 dark:text-emerald-400">
              ปิด
            </button>
          </div>
        )}
      </div>

      {/* Steps Timeline Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between group hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2.5">
                <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                  ⏱️ {step.time}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setTargetStepForTemplate(step.id);
                      setIsTemplateModalOpen(true);
                    }}
                    title="เลือกจากเทมเพลตสำเร็จรูป"
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingStep(step)}
                    title="แก้ไขสเต็ปนี้"
                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {steps.length > 1 && (
                    <button
                      onClick={() => handleDeleteStep(step.id)}
                      title="ลบสเต็ปนี้"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-1">{step.name}</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3 leading-relaxed">{step.desc}</p>

              {/* Editable Message Box */}
              <div className="relative mb-4">
                <textarea
                  value={step.message}
                  onChange={e => handleUpdateStepMessage(step.id, e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-slate-800 dark:text-zinc-200 focus:outline-none transition-colors resize-none font-sans leading-relaxed"
                  placeholder="พิมพ์ข้อความที่ต้องการให้ AI ส่งหาลูกค้า..."
                />
                <button
                  onClick={() => {
                    setTargetStepForTemplate(step.id);
                    setIsTemplateModalOpen(true);
                  }}
                  className="absolute right-2 bottom-2 text-[10px] bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 shadow-xs hover:bg-indigo-50 cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>เทมเพลต</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => handleRunFollowUp(step.name)}
              disabled={isRunning || pendingCustomers.length === 0}
              className="w-full py-2.5 bg-slate-50 hover:bg-indigo-600 hover:text-white dark:bg-[#141418] dark:hover:bg-indigo-600 disabled:opacity-50 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 hover:border-indigo-600 dark:border-zinc-800 dark:hover:border-indigo-500 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> สั่งรันส่งข้อความสเต็ปนี้
            </button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121318] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base">
                    แก้ไขสเต็ปข้อความติดตามลูกค้า
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    กำหนดช่วงเวลาและข้อความที่ต้องการให้ AI ตอบหาลูกค้า
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingStep(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm p-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedStep} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  ชื่อสเต็ปติดตาม:
                </label>
                <input
                  type="text"
                  value={editingStep.name}
                  onChange={e => setEditingStep({ ...editingStep, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#181920] border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  ช่วงเวลาที่จะส่ง (Interval):
                </label>
                <input
                  type="text"
                  placeholder="เช่น 5 นาที, 30 นาที, 21:00 น., เช้า 09:00 น."
                  value={editingStep.time}
                  onChange={e => setEditingStep({ ...editingStep, time: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#181920] border border-slate-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-zinc-300">
                    ข้อความที่จะส่งหาลูกค้า:
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>เลือกจากเทมเพลต</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={editingStep.message}
                  onChange={e => setEditingStep({ ...editingStep, message: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#181920] border border-slate-300 dark:border-zinc-700 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setEditingStep(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Templates Library Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121318] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/60">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base">
                    คลังเทมเพลตข้อความติดตามลูกค้า (High-Converting Templates)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    เลือกเทมเพลตสำเร็จรูปเพื่อนำไปใช้ในสเต็ปติดตามได้ในคลิกเดียว
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsTemplateModalOpen(false);
                  setTargetStepForTemplate(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm p-1.5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 scrollbar-thin flex-1">
              {FOLLOWUP_TEMPLATES.map((tpl, i) => (
                <div
                  key={i}
                  className="p-4 bg-slate-50 dark:bg-[#181920] border border-slate-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h5 className="font-bold text-slate-900 dark:text-zinc-100 text-xs flex items-center gap-2">
                        {tpl.title}
                      </h5>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">
                        {tpl.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed font-sans">
                      &quot;{tpl.message}&quot;
                    </p>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl.message)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm shadow-indigo-600/20 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>ใช้เทมเพลตนี้</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Customers Queue Table */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> คิวลูกค้าที่อยู่ในระบบ Follow-Up (ยังไม่สั่งซื้อ)
          </h4>
          <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
            เงื่อนไข: status != &apos;ORDER_COMPLETED&apos;
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">PSID</th>
                <th className="p-3.5">ชื่อลูกค้า</th>
                <th className="p-3.5">เบอร์โทรศัพท์</th>
                <th className="p-3.5">สถานะปัจจุบัน</th>
                <th className="p-3.5">สนทนาล่าสุด</th>
                <th className="p-3.5">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
              {pendingCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                    ไม่มีลูกค้าที่ค้างอยู่ในระบบติดตาม (ลูกค้าทุกคนสั่งซื้อเรียบร้อยแล้ว 🎉)
                  </td>
                </tr>
              ) : (
                pendingCustomers.map(cust => (
                  <tr key={cust.psid} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                    <td className="p-3.5 font-mono text-indigo-600 dark:text-indigo-400 font-bold">{cust.psid}</td>
                    <td className="p-3.5 font-bold text-slate-900 dark:text-zinc-100">{cust.customer_name}</td>
                    <td className="p-3.5 text-slate-600 dark:text-zinc-400 font-mono">{cust.phone_number || '-'}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                        {cust.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 dark:text-zinc-500 text-[11px] font-mono">
                      {new Date(cust.last_interaction).toLocaleString('th-TH')}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleRunFollowUp('Follow-Up เฉพาะบุคคล')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm shadow-indigo-600/20 cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> ส่งทันที
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
