import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, RefreshCw, User, Clock, AlertCircle, Inbox,
  Star, Ban, MailOpen, Bot, Power, Search
} from 'lucide-react';
import type { PageConfig } from '../types';
import { useSSE } from '../utils/useSSE';

interface ChatInboxTabProps {
  pages: PageConfig[];
  selectedPageId: string;
  setSelectedPageId?: (id: string) => void;
  theme: 'dark' | 'light';
}

interface ChatMessage {
  id: string;
  from: { id: string; name?: string };
  message: string;
  created_time: string;
  is_from_page: boolean;
  attachments: any[];
}

interface ConversationSummary {
  thread_id: string;
  participant: { id: string; name?: string };
  updated_time: string;
  preview: string;
  last_role?: string;
  unread: boolean;
  unread_count: number;
  starred: boolean;
  blocked: boolean;
  source: string;
}

type FilterKey = 'ALL' | 'UNREAD' | 'STARRED' | 'BLOCKED';

export const ChatInboxTab: React.FC<ChatInboxTabProps> = ({ pages, selectedPageId, setSelectedPageId, theme }) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<ConversationSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [aiReplyOn, setAiReplyOn] = useState<boolean>(false);
  const [pageActive, setPageActive] = useState<boolean>(true);
  const [messagesEndRef] = [useRef<HTMLDivElement>(null)];

  const currentPage = pages.find(p => p.page_id === selectedPageId);
  const dark = theme === 'dark';
  const cardCls = dark ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200';
  const subtle = dark ? 'text-zinc-400' : 'text-slate-500';

  // ── Load conversation list (local Postgres + Graph merge) ───────────────
  const fetchConversations = useCallback(async (silent = false) => {
    if (!selectedPageId) return;
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inbox/conversations?page_id=${encodeURIComponent(selectedPageId)}`);
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        setAiReplyOn(Boolean(data.auto_reply));
        setPageActive(Boolean(data.is_active));
        setLastRefresh(new Date());
        setSelectedConvo(prev => {
          if (!prev) return (data.conversations || [])[0] || null;
          const updated = (data.conversations || []).find((c: ConversationSummary) => c.thread_id === prev.thread_id);
          return updated || prev;
        });
      } else if (!silent) {
        setError(data.message || 'ไม่สามารถดึงรายการแชทได้');
      }
    } catch (err: any) {
      if (!silent) setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedPageId]);

  // ── Load messages of the selected conversation ──────────────────────────
  const fetchMessages = useCallback(async (convo: ConversationSummary, silent = false) => {
    if (!selectedPageId || !convo) return;
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/inbox/messages?page_id=${encodeURIComponent(selectedPageId)}&sender_id=${encodeURIComponent(convo.thread_id)}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages || []);
        // Opening a conversation clears its unread badge locally
        setConversations(prev => prev.map(c => c.thread_id === convo.thread_id ? { ...c, unread: false, unread_count: 0 } : c));
      }
    } catch { /* keep previous messages */ }
    finally { if (!silent) setIsLoadingMessages(false); }
  }, [selectedPageId]);

  const openConversation = (convo: ConversationSummary) => {
    setSelectedConvo(convo);
    setMessages([]);
    fetchMessages(convo);
  };

  // Real-time via SSE + 30s polling fallback
  const { connected: sseConnected } = useSSE({
    pageId: selectedPageId,
    enabled: !!selectedPageId,
    onNewMessage: (data) => {
      if (!selectedPageId || data.page_id !== selectedPageId) return;
      fetchConversations(true);
      if (selectedConvo && data.sender_id === selectedConvo.thread_id) {
        fetchMessages(selectedConvo, true);
      }
    },
    onDataUpdated: (data) => {
      if (data.collection === 'chat_history' || data.collection === 'pages') fetchConversations(true);
    }
  });

  useEffect(() => {
    setSelectedConvo(null);
    setMessages([]);
    fetchConversations();
    const interval = setInterval(() => fetchConversations(true), 30000);
    return () => clearInterval(interval);
  }, [selectedPageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const togglePageField = async (field: 'is_active' | 'auto_reply') => {
    const next = field === 'is_active' ? !pageActive : !aiReplyOn;
    try {
      const res = await fetch('/api/pages/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selectedPageId, field, value: next })
      });
      const data = await res.json();
      if (data.success) {
        if (field === 'is_active') setPageActive(next);
        else setAiReplyOn(next);
      } else {
        setError(data.message || 'สลับสถานะไม่สำเร็จ');
      }
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    }
  };

  const updateConvoState = async (patch: { is_starred?: boolean; is_blocked?: boolean; mark_read?: boolean; mark_unread?: boolean }) => {
    if (!selectedConvo) return;
    try {
      const res = await fetch('/api/inbox/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selectedPageId, sender_id: selectedConvo.thread_id, ...patch })
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.map(c => c.thread_id === selectedConvo.thread_id ? {
          ...c,
          starred: patch.is_starred !== undefined ? patch.is_starred : c.starred,
          blocked: patch.is_blocked !== undefined ? patch.is_blocked : c.blocked,
          unread: patch.mark_unread ? true : (patch.mark_read ? false : c.unread),
          unread_count: patch.mark_read ? 0 : (patch.mark_unread ? Math.max(1, c.unread_count) : c.unread_count)
        } : c));
        setSelectedConvo(prev => prev ? {
          ...prev,
          starred: patch.is_starred !== undefined ? patch.is_starred : prev.starred,
          blocked: patch.is_blocked !== undefined ? patch.is_blocked : prev.blocked
        } : prev);
        if (patch.is_blocked) setFilter('ALL');
      }
    } catch { /* non-critical */ }
  };

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedConvo || !currentPage) return;
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/facebook/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: selectedPageId,
          recipient_id: selectedConvo.thread_id,
          message: replyText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setReplyText('');
        // Optimistic append, then refresh list (preview + ordering)
        setMessages(prev => [...prev, {
          id: data.message_id || `local_${Date.now()}`,
          from: { id: selectedPageId, name: currentPage.page_name },
          message: replyText.trim(),
          created_time: new Date().toISOString(),
          is_from_page: true,
          attachments: []
        }]);
        setTimeout(() => { fetchConversations(true); fetchMessages(selectedConvo, true); }, 800);
      } else {
        setError(`ส่งไม่สำเร็จ: ${data.message || data.error?.message || 'ไม่ทราบสาเหตุ'}`);
      }
    } catch (err: any) {
      setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────
  const counts = {
    ALL: conversations.filter(c => !c.blocked).length,
    UNREAD: conversations.filter(c => c.unread && !c.blocked).length,
    STARRED: conversations.filter(c => c.starred && !c.blocked).length,
    BLOCKED: conversations.filter(c => c.blocked).length
  };
  const visibleConversations = conversations.filter(c => {
    if (filter === 'UNREAD' && (!c.unread || c.blocked)) return false;
    if (filter === 'STARRED' && (!c.starred || c.blocked)) return false;
    if (filter === 'BLOCKED' && !c.blocked) return false;
    if (filter === 'ALL' && c.blocked) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (c.participant.name || '').toLowerCase().includes(q) || c.thread_id.includes(q) || (c.preview || '').toLowerCase().includes(q);
    }
    return true;
  });

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} น.`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ชม.`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} วัน`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };
  const formatFullTime = (timeStr: string) => new Date(timeStr).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const chip = (key: FilterKey, label: string, count: number) => (
    <button
      onClick={() => setFilter(key)}
      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1.5 ${
        filter === key
          ? 'bg-indigo-600 text-white'
          : dark ? 'bg-[#16161C] text-zinc-300 border border-zinc-800 hover:border-indigo-500' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-400'
      }`}
    >
      {label}
      <span className={`text-[10px] px-1.5 rounded-full ${filter === key ? 'bg-white/20' : dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>{count}</span>
    </button>
  );

  const toggleSwitch = (on: boolean, onClick: () => void, onLabel: string, offLabel: string, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={on ? onLabel : offLabel}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${
        on
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
          : dark ? 'bg-zinc-800/60 border-zinc-700 text-zinc-400' : 'bg-slate-100 border-slate-200 text-slate-400'
      }`}
    >
      <span className={`w-7 h-4 rounded-full relative transition-colors ${on ? 'bg-emerald-500' : dark ? 'bg-zinc-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
      </span>
      {on ? onLabel : offLabel}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>แชท Inbox</h2>
            <p className={`text-xs ${subtle}`}>จัดการแชทแบบ Meta Business Suite — ตอบกลับ ติดดาว บล็อก ได้ในที่เดียว</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page switcher (fix: กดสลับเพจได้แล้ว — App ส่ง setSelectedPageId มาแล้ว) */}
          <select
            value={selectedPageId}
            onChange={e => setSelectedPageId?.(e.target.value)}
            className={`text-xs font-medium rounded-lg px-2.5 py-2 border outline-none cursor-pointer max-w-[180px] sm:max-w-[260px] truncate ${
              dark ? 'bg-[#141418] text-zinc-200 border-zinc-800 focus:border-indigo-500' : 'bg-white text-zinc-800 border-slate-200 focus:border-indigo-500'
            }`}
            title="เลือกเพจเพื่อดูแชทของเพจนั้น"
          >
            {pages.map(p => (
              <option key={p.page_id} value={p.page_id}>{p.page_name}{p.is_active === false ? ' (ปิดใช้งาน)' : ''}</option>
            ))}
          </select>

          {/* AI auto-reply toggle for the current page */}
          {toggleSwitch(aiReplyOn, () => togglePageField('auto_reply'), 'AI ตอบอัตโนมัติ', 'AI ปิดอยู่', !pageActive)}
          {/* Page on/off toggle */}
          {toggleSwitch(pageActive, () => togglePageField('is_active'), 'เพจเปิดใช้งาน', 'เพจปิดอยู่')}

          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${
            sseConnected ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-amber-400' : 'text-amber-600')
          }`} title={sseConnected ? 'เชื่อมต่อเรียลไทม์ (SSE)' : 'โหมดสำรอง — ตรวจสอบทุก 30 วินาที'}>
            <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {sseConnected ? 'เรียลไทม์' : 'โหมดสำรอง'}
          </span>
          {lastRefresh && <span className={`text-[10px] ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>อัปเดต {lastRefresh.toLocaleTimeString('th-TH')}</span>}
          <button
            onClick={() => fetchConversations()}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              isLoading ? 'opacity-50 cursor-not-allowed' : dark ? 'bg-[#141418] text-zinc-300 hover:bg-[#1a1a22] border border-zinc-800' : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Page disabled banner */}
      {!pageActive && (
        <div className={`p-3 rounded-xl border flex items-center gap-3 ${dark ? 'bg-amber-950/30 border-amber-800/60' : 'bg-amber-50 border-amber-200'}`}>
          <Power className="w-4 h-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className={`text-sm font-bold ${dark ? 'text-amber-200' : 'text-amber-900'}`}>เพจนี้ถูกปิดใช้งานอยู่</p>
            <p className={`text-xs ${dark ? 'text-amber-300/80' : 'text-amber-700'}`}>บอทจะไม่ตอบแชทเพจนี้ — กดสวิตช์ "เพจปิดอยู่" ด้านบนเพื่อเปิดใช้งานอีกครั้ง</p>
          </div>
        </div>
      )}

      {/* AI off banner */}
      {pageActive && !aiReplyOn && (
        <div className={`p-3 rounded-xl border flex items-center gap-3 ${dark ? 'bg-indigo-950/30 border-indigo-800/60' : 'bg-indigo-50 border-indigo-200'}`}>
          <Bot className="w-4 h-4 text-indigo-500 shrink-0" />
          <div className="flex-1">
            <p className={`text-sm font-bold ${dark ? 'text-indigo-200' : 'text-indigo-900'}`}>AI ตอบอัตโนมัติปิดอยู่</p>
            <p className={`text-xs ${dark ? 'text-indigo-300/80' : 'text-indigo-700'}`}>ข้อความใหม่จะเข้า Inbox ให้แอดมินตอบเอง — กดสวิตช์ "AI ปิดอยู่" เพื่อเปิด AI</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`p-4 rounded-xl border ${dark ? 'bg-red-950/30 border-red-800/60' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <p className={`text-sm font-bold ${dark ? 'text-red-200' : 'text-red-900'}`}>เกิดข้อผิดพลาด</p>
              <p className={`text-xs mt-1 ${dark ? 'text-red-300/80' : 'text-red-700'}`}>{error}</p>
            </div>
            <button onClick={() => setError(null)} className={`text-xs ${dark ? 'text-red-400' : 'text-red-600'}`}>✕</button>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[540px] ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
        {/* Conversation list */}
        <div className={`lg:col-span-1 rounded-xl border overflow-hidden flex flex-col ${cardCls}`}>
          <div className={`px-4 py-3 border-b ${dark ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> แชท ({counts.ALL})</h3>
              <div className={`relative w-28 sm:w-36`}>
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ค้นหา..."
                  className={`w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] border outline-none ${dark ? 'bg-[#0F0F12] border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'}`}
                />
              </div>
            </div>
            {/* Meta-style filters */}
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              {chip('ALL', 'ทั้งหมด', counts.ALL)}
              {chip('UNREAD', 'ยังไม่ได้อ่าน', counts.UNREAD)}
              {chip('STARRED', 'ติดดาว', counts.STARRED)}
              {chip('BLOCKED', 'บล็อก', counts.BLOCKED)}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[480px] flex-1">
            {visibleConversations.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className={`w-12 h-12 mx-auto mb-3 ${dark ? 'text-zinc-600' : 'text-slate-300'}`} />
                <p className={`text-sm ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  {filter === 'ALL' ? 'ยังไม่มีบทสนทนา' : 'ไม่มีรายการในหมวดนี้'}
                </p>
                <p className={`text-xs mt-1 ${dark ? 'text-zinc-600' : 'text-slate-300'}`}>ลูกค้าจะปรากฏที่นี่เมื่อทักเข้ามา</p>
              </div>
            ) : visibleConversations.map((convo, idx) => {
              const isSelected = selectedConvo?.thread_id === convo.thread_id;
              return (
                <button
                  key={convo.thread_id || idx}
                  onClick={() => openConversation(convo)}
                  className={`w-full text-left px-4 py-3 border-b transition-colors ${
                    isSelected
                      ? dark ? 'bg-indigo-950/40 border-zinc-800' : 'bg-indigo-50 border-slate-200'
                      : dark ? 'border-zinc-800/60 hover:bg-[#141418]' : 'border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative ${dark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-500'}`}>
                      <User className="w-4 h-4" />
                      {convo.unread && convo.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                          {convo.unread_count > 99 ? '99+' : convo.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${convo.unread ? 'font-bold' : 'font-medium'} flex items-center gap-1.5`}>
                          {convo.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                          {convo.blocked && <Ban className="w-3 h-3 text-rose-400 shrink-0" />}
                          {convo.participant.name}
                        </span>
                        <span className={`text-[10px] shrink-0 flex items-center gap-1 ${subtle}`}>
                          <Clock className="w-2.5 h-2.5" />{formatTime(convo.updated_time)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${convo.unread ? (dark ? 'text-zinc-200 font-semibold' : 'text-slate-800 font-semibold') : subtle}`}>
                        {convo.last_role !== 'customer' && <span className="text-indigo-400">คุณ: </span>}
                        {convo.preview || '(ไม่มีข้อความ)'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chat area */}
        <div className={`lg:col-span-2 rounded-xl border overflow-hidden flex flex-col ${cardCls}`}>
          {selectedConvo ? (
            <>
              {/* Chat header + actions */}
              <div className={`px-4 py-3 border-b ${dark ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${dark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-500'}`}>
                      <User className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold truncate flex items-center gap-1.5">
                        {selectedConvo.starred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        {selectedConvo.blocked && <Ban className="w-3 h-3 text-rose-400" />}
                        {selectedConvo.participant.name}
                      </h3>
                      <p className={`text-[10px] ${subtle}`}>
                        ID: {selectedConvo.participant.id} • ที่มา: {selectedConvo.source === 'graph' ? 'Messenger' : 'ระบบ'}
                      </p>
                    </div>
                  </div>
                  {/* Meta-like actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateConvoState({ is_starred: !selectedConvo.starred })}
                      title={selectedConvo.starred ? 'เอาติดดาวออก' : 'ติดดาวบทสนทนานี้'}
                      className={`p-2 rounded-lg transition-colors ${selectedConvo.starred ? 'text-amber-400 bg-amber-500/10' : dark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      <Star className={`w-4 h-4 ${selectedConvo.starred ? 'fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => updateConvoState(selectedConvo.unread ? { mark_read: true } : { mark_unread: true })}
                      title={selectedConvo.unread ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'ทำเครื่องหมายว่ายังไม่ได้อ่าน'}
                      className={`p-2 rounded-lg transition-colors ${dark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      <MailOpen className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateConvoState({ is_blocked: !selectedConvo.blocked })}
                      title={selectedConvo.blocked ? 'ปลดบล็อก — ให้ AI ตอบแชทได้' : 'บล็อก — AI จะไม่ตอบลูกค้าคนนี้'}
                      className={`p-2 rounded-lg transition-colors ${selectedConvo.blocked ? 'text-rose-400 bg-rose-500/10' : dark ? 'text-zinc-400 hover:bg-zinc-800' : 'text-slate-500 hover:bg-slate-100'}`}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {selectedConvo.blocked && (
                  <p className={`text-[10px] mt-2 px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-500`}>
                    ลูกค้ารายนี้ถูกบล็อก — ระบบจะไม่ตอบแชทอัตโนมัติให้ (แอดมินยังส่งข้อความได้)
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[420px]">
                {isLoadingMessages ? (
                  <p className={`text-xs text-center ${subtle}`}>กำลังโหลดข้อความ...</p>
                ) : messages.length === 0 ? (
                  <p className={`text-xs text-center ${subtle}`}>ยังไม่มีข้อความในบทสนทนานี้</p>
                ) : messages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`flex ${msg.is_from_page ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${msg.is_from_page ? 'order-2' : ''}`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl ${
                        msg.is_from_page
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : dark ? 'bg-[#1a1a22] text-zinc-100 rounded-bl-md border border-zinc-800' : 'bg-slate-100 text-slate-900 rounded-bl-md'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message || '(รูปภาพ/ไฟล์แนบ)'}</p>
                      </div>
                      <p className={`text-[10px] mt-1 ${msg.is_from_page ? 'text-right' : ''} ${dark ? 'text-zinc-600' : 'text-slate-400'}`}>
                        {formatFullTime(msg.created_time)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className={`px-4 py-3 border-t ${dark ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="พิมพ์ข้อความตอบกลับ... (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                    rows={2}
                    className={`flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm border outline-none transition-colors ${
                      dark ? 'bg-[#0F0F12] border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                    }`}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!replyText.trim() || isSending}
                    className={`p-2.5 rounded-xl transition-all ${
                      !replyText.trim() || isSending
                        ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-zinc-800'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-[10px] mt-1.5 ${subtle}`}>
                  ตอบกลับผ่าน Messenger API — Facebook อนุญาตให้ตอบได้ภายใน 24 ชม. หลังลูกค้าทักมาครั้งล่าสุด
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${dark ? 'text-zinc-700' : 'text-slate-200'}`} />
                <p className={`text-sm font-medium ${dark ? 'text-zinc-500' : 'text-slate-400'}`}>เลือกบทสนทนาจากด้านซ้าย</p>
                <p className={`text-xs mt-1 ${dark ? 'text-zinc-600' : 'text-slate-300'}`}>หรือรอให้ลูกค้าทักเข้ามา</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
