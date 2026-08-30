import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  EyeOff,
  MessageSquare,
  Sparkles,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Facebook,
  Heart,
  CornerDownRight,
  Sliders,
  Info,
  AtSign,
  Image as ImageIcon
} from 'lucide-react';
import { PageConfig } from '../types';

interface CommentReply {
  replyText: string;
  images: string[];
  taggedCustomer: string;
}

interface CommentItem {
  id: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string;
  status: 'NORMAL' | 'HIDDEN' | 'INBOX_SENT' | 'REPLIED';
  hiddenReason?: string;
  reply?: CommentReply;
}

interface CommentModerationTabProps {
  pages: PageConfig[];
  selectedPageId: string;
}

export const CommentModerationTab: React.FC<CommentModerationTabProps> = ({
  pages,
  selectedPageId
}) => {
  const selectedPage = pages.find(p => p.page_id === selectedPageId) || pages[0] || {
    page_id: '',
    page_name: 'ยังไม่ได้เลือกเพจ',
    category: 'CHINA',
    is_active: false,
    auto_reply: true,
    auto_close_ai: true,
    notification_channel: 'BOTH'
  };

  const defaultReplyImages = selectedPage.comment_reply_images?.length
    ? selectedPage.comment_reply_images
    : [];

  const [comments, setComments] = useState<CommentItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fb_chatbot_comments');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          // fallback
        }
      }
    }
    return [];
  });

  const [inputComment, setInputComment] = useState('');
  const [authorName, setAuthorName] = useState('');

  const saveComments = (newComments: CommentItem[]) => {
    setComments(newComments);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fb_chatbot_comments', JSON.stringify(newComments));
    }
  };

  const handlePostComment = async () => {
    if (!inputComment.trim()) return;

    const text = inputComment.trim();
    const hideKeywords = selectedPage.toxic_keywords || ['โกง', 'หลอก', 'แย่', 'ฟ้อง', 'ระวัง', 'ปลอม', 'โกงเงิน', 'มิจฉาชีพ'];
    const intentKeywords = selectedPage.purchase_keywords || ['สนใจ', 'ราคา', 'ซื้อ', 'เอา', 'รายละเอียด', 'สั่ง', 'เท่าไหร่', 'ขอราคา', 'จอง'];

    const shouldHide = hideKeywords.some(w => text.includes(w));
    const hasIntent = intentKeywords.some(w => text.includes(w));

    let status: CommentItem['status'] = 'NORMAL';
    let hiddenReason: string | undefined = undefined;
    let replyData: CommentReply | undefined = undefined;

    if (shouldHide && selectedPage.hide_toxic_comments !== false) {
      status = 'HIDDEN';
      const matched = hideKeywords.filter(w => text.includes(w));
      hiddenReason = `ตรวจพบคำต้องห้ามของเพจ (${matched.join(', ')})`;
    } else if (hasIntent && selectedPage.auto_reply !== false) {
      status = 'REPLIED';
      const customerTag = authorName.trim() ? `@${authorName.trim()}` : '@ลูกค้า';
      replyData = {
        taggedCustomer: customerTag,
        replyText: (selectedPage.comment_reply_template || 'ขอบพระคุณที่สนใจค่ะคุณ @customer_name แอดมินทัก Inbox ส่งรูปและโปรโมชั่นพิเศษให้แล้วนะคะ 🙏✨').replace('@customer_name', customerTag),
        images: defaultReplyImages.slice(0, 6)
      };
    }

    const newCmt: CommentItem = {
      id: `cmt-${Date.now()}`,
      userName: authorName.trim() || 'ลูกค้าผู้ใช้งานจริง',
      userAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
      text,
      timestamp: 'เมื่อสักครู่',
      status,
      hiddenReason,
      reply: replyData
    };

    saveComments([newCmt, ...comments]);
    setInputComment('');

    // Trigger backend simulate
    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'COMMENT',
          sender_id: `PSID_CMT_${Date.now()}`,
          page_id: selectedPageId,
          message_text: text,
          customer_name: authorName.trim() || 'ลูกค้าผู้ใช้งานจริง'
        })
      });
    } catch {
      // Local fallback
    }
  };

  const handleClearComments = () => {
    if (!window.confirm('คุณต้องการล้างประวัติคอมเมนต์ทั้งหมดใช่หรือไม่?')) return;
    saveComments([]);
  };

  return (
    <div className="space-y-6">
      {/* Banner with Active Page Details */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-lg">
                  ระบบคัดกรองคอมเมนต์ & ตอบกลับพร้อมแนบรูปภาพ: {selectedPage.page_name}
                </h3>
                <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-bold">
                  Real-time Active
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                ตอบคอมเมนต์อัตโนมัติพร้อมแท็กชื่อลูกค้า @Name และแนบรูปภาพสินค้า/โปรโมชั่นสูงสุด 6 รูป พร้อมดึงเข้า Messenger ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-mono bg-slate-50 dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-800">
              ดูดคอมเมนต์อัตโนมัติ: <strong className="text-emerald-600 dark:text-emerald-400">{selectedPage.scrape_comments_enabled !== false ? 'เปิด ✅' : 'ปิด ❌'}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Config & Live Simulator */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Settings Summary */}
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" /> การตั้งค่าตอบคอมเมนต์ของเพจนี้
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl space-y-2">
                <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-indigo-600" /> รูปแบบตอบกลับ & แท็กชื่อลูกค้า
                </span>
                <p className="text-slate-800 dark:text-zinc-200 text-xs leading-relaxed italic bg-white dark:bg-black/40 p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-500/20">
                  &quot;{selectedPage.comment_reply_template || 'ขอบพระคุณที่สนใจค่ะคุณ @customer_name...'}&quot;
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1">
                  <span>แท็กชื่อ @Customer: <strong className="text-slate-700 dark:text-zinc-200">{selectedPage.comment_auto_tag_customer !== false ? 'เปิด ✅' : 'ปิด ❌'}</strong></span>
                  <span>รูปแนบคอมเมนต์: <strong className="text-indigo-600 dark:text-emerald-400 font-mono">{(selectedPage.comment_reply_images || []).length} / 6 รูป</strong></span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/70 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-800/30 rounded-xl">
                <span className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5 mb-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-rose-600" /> ซ่อนคอมเมนต์สแปม/คำหยาบ (Auto-Hide)
                </span>
                <p className="text-slate-700 dark:text-zinc-300 text-xs leading-relaxed">
                  คำต้องห้าม: {selectedPage.toxic_keywords?.map(k => (
                    <code key={k} className="text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-[#0A0A0C] px-2 py-0.5 rounded-md font-mono mr-1 text-[11px] border border-rose-200 dark:border-rose-900/40">
                      &quot;{k}&quot;
                    </code>
                  ))}
                </p>
              </div>
            </div>
          </div>

          {/* Test Comment Box */}
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> ทดสอบพิมพ์คอมเมนต์ใต้โพสต์:
            </h4>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">ชื่อลูกค้าที่คอมเมนต์:</label>
              <input
                type="text"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 text-xs rounded-xl p-2.5 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">ข้อความคอมเมนต์:</label>
              <textarea
                rows={3}
                placeholder="ลองพิมพ์คำว่า 'สนใจรับ 1 ชุดครับ' หรือ 'ขอราคาและโปรโมชั่นหน่อยครับ'..."
                value={inputComment}
                onChange={e => setInputComment(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 text-xs rounded-xl p-2.5 resize-none focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
              />
            </div>

            <button
              onClick={handlePostComment}
              disabled={!inputComment.trim()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-600/20"
            >
              <Send className="w-3.5 h-3.5" /> โพสต์คอมเมนต์ทดสอบ
            </button>
          </div>
        </div>

        {/* Right 7 Cols: Simulated Facebook Post & Comments Feed */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          {/* Post Header */}
          <div className="p-4.5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-[#0A0A0C]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-100 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                <Facebook className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">
                  โพสต์ทางการประจำเพจ ({selectedPage.page_name})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  {selectedPage.product?.product_name || 'เปิดรับจองสินค้าโปรโมชั่นพิเศษประจำวันนี้'}
                </p>
              </div>
            </div>
          </div>

          {/* Comments List */}
          <div className="p-5 space-y-4 flex-1 overflow-y-auto max-h-[600px]">
            {comments.map(c => (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border text-xs transition-all space-y-3 ${
                  c.status === 'HIDDEN'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 opacity-80'
                    : c.status === 'REPLIED' || c.status === 'INBOX_SENT'
                    ? 'bg-indigo-50/40 dark:bg-[#141418] border-indigo-200 dark:border-indigo-500/30'
                    : 'bg-slate-50 dark:bg-[#141418] border-slate-200 dark:border-zinc-800'
                }`}
              >
                {/* Customer Comment Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={c.userAvatar}
                      alt={c.userName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-zinc-700 shadow-xs"
                    />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{c.userName}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 ml-2 font-mono">{c.timestamp}</span>
                    </div>
                  </div>

                  {c.status === 'HIDDEN' && (
                    <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300 px-2.5 py-0.5 rounded-full font-mono font-bold border border-rose-200 dark:border-rose-500/30 flex items-center gap-1">
                      <EyeOff className="w-3 h-3 text-rose-600" /> ถูกซ่อนแล้ว
                    </span>
                  )}
                  {(c.status === 'REPLIED' || c.status === 'INBOX_SENT') && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-mono font-bold border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ตอบกลับ + ส่ง Inbox แล้ว
                    </span>
                  )}
                </div>

                <p className="text-slate-800 dark:text-zinc-200 pl-10 font-sans leading-relaxed text-xs">
                  {c.text}
                </p>

                {c.status === 'HIDDEN' && (
                  <div className="ml-10 p-2.5 bg-rose-100/70 dark:bg-rose-950/40 rounded-xl text-[11px] text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                    🛡️ <strong>เหตุผลที่ซ่อน:</strong> {c.hiddenReason}
                  </div>
                )}

                {/* Automated Reply Box with Tag and up to 6 Images */}
                {c.reply && (
                  <div className="ml-10 mt-2 p-3.5 bg-white dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 rounded-xl space-y-2.5 shadow-xs">
                    <div className="flex items-center gap-2 text-[11px]">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                        AI
                      </div>
                      <span className="font-bold text-indigo-700 dark:text-indigo-300">
                        {selectedPage.page_name} (ตอบกลับอัตโนมัติ)
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-mono">เมื่อสักครู่</span>
                    </div>

                    <p className="text-slate-800 dark:text-zinc-200 text-xs pl-7 leading-relaxed font-sans">
                      {c.reply.replyText}
                    </p>

                    {/* Up to 6 reply images */}
                    {c.reply.images && c.reply.images.length > 0 && (
                      <div className="pl-7 pt-1">
                        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                          <ImageIcon className="w-3 h-3 text-indigo-500" />
                          <span>รูปภาพแนบในคอมเมนต์ ({c.reply.images.length} รูป):</span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {c.reply.images.map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt={`Reply Attachment ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full aspect-square rounded-lg object-cover border border-slate-200 dark:border-indigo-500/30 hover:scale-105 transition-transform bg-slate-100"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
