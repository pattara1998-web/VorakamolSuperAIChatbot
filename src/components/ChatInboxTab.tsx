import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, User, Bot, Clock, AlertCircle, CheckCircle2, Inbox } from 'lucide-react';
import type { PageConfig } from '../types';

interface ChatInboxTabProps {
  pages: PageConfig[];
  selectedPageId: string;
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

interface Conversation {
  thread_id: string;
  participant: { id: string; name?: string };
  updated_time: string;
  messages: ChatMessage[];
}

export const ChatInboxTab: React.FC<ChatInboxTabProps> = ({ pages, selectedPageId, theme }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentPage = pages.find(p => p.page_id === selectedPageId);

  const fetchInbox = async () => {
    if (!selectedPageId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/facebook/inbox?page_id=${encodeURIComponent(selectedPageId)}`);
      const data = await res.json();
      if (data.success) {
        setConversations(data.conversations || []);
        setLastRefresh(new Date());
        // Auto-select first conversation if none selected
        if (!selectedConvo && data.conversations?.length > 0) {
          setSelectedConvo(data.conversations[0]);
        }
      } else {
        setError(data.message || data.error?.message || 'ไม่สามารถดึงข้อมูลแชทได้');
      }
    } catch (err: any) {
      setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, [selectedPageId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConvo?.messages]);

  const handleSendMessage = async () => {
    if (!replyText.trim() || !selectedConvo || !currentPage) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/facebook/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: selectedPageId,
          recipient_id: selectedConvo.participant.id,
          message: replyText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        // Add message to local state
        const newMsg: ChatMessage = {
          id: data.message_id || `local_${Date.now()}`,
          from: { id: selectedPageId, name: currentPage.page_name },
          message: replyText.trim(),
          created_time: new Date().toISOString(),
          is_from_page: true,
          attachments: []
        };
        setSelectedConvo(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMsg],
          updated_time: new Date().toISOString()
        } : null);
        setReplyText('');
        // Refresh inbox
        setTimeout(fetchInbox, 1000);
      } else {
        setError(`ส่งข้อความไม่สำเร็จ: ${data.message || data.error?.message}`);
      }
    } catch (err: any) {
      setError(`เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  const formatFullTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUnreadCount = (convo: Conversation) => {
    return convo.messages.filter(m => !m.is_from_page).length;
  };

  const isTokenConfigured = currentPage?.page_access_token && currentPage.page_access_token.length > 10;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            theme === 'dark' ? 'bg-indigo-950/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
          }`}>
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-lg font-bold ${theme === 'dark' ? 'text-zinc-100' : 'text-slate-900'}`}>
              แชท Inbox
            </h2>
            <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
              ดูและตอบข้อความจาก Messenger โดยตรง
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
              อัปเดตล่าสุด: {lastRefresh.toLocaleTimeString('th-TH')}
            </span>
          )}
          <button
            onClick={fetchInbox}
            disabled={isLoading}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              isLoading
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'dark'
                ? 'bg-[#141418] text-zinc-300 hover:bg-[#1a1a22] border border-zinc-800'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Token Warning */}
      {!isTokenConfigured && (
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' ? 'bg-amber-950/30 border-amber-800/60' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
            }`} />
            <div>
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-amber-200' : 'text-amber-900'}`}>
                ยังไม่ได้เชื่อมต่อ Page Access Token
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-amber-300/80' : 'text-amber-700'}`}>
                กรุณาเชื่อมต่อ Facebook Page ก่อนใช้งานแชท Inbox
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`p-4 rounded-xl border ${
          theme === 'dark' ? 'bg-red-950/30 border-red-800/60' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${theme === 'dark' ? 'text-red-200' : 'text-red-900'}`}>
                เกิดข้อผิดพลาด
              </p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-red-300/80' : 'text-red-700'}`}>
                {error}
              </p>
            </div>
            <button
              onClick={() => setError(null)}
              className={`text-xs ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px] ${
        theme === 'dark' ? 'text-zinc-100' : 'text-slate-900'
      }`}>
        {/* Conversation List */}
        <div className={`lg:col-span-1 rounded-xl border overflow-hidden ${
          theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          <div className={`px-4 py-3 border-b ${
            theme === 'dark' ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'
          }`}>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              บทสนทนา ({conversations.length})
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[450px]">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className={`w-12 h-12 mx-auto mb-3 ${
                  theme === 'dark' ? 'text-zinc-600' : 'text-slate-300'
                }`} />
                <p className={`text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                  ยังไม่มีบทสนทนา
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-300'}`}>
                  ลูกค้าจะปรากฏที่นี่เมื่อทักเข้ามา
                </p>
              </div>
            ) : (
              conversations.map((convo, idx) => {
                const lastMsg = convo.messages[convo.messages.length - 1];
                const isSelected = selectedConvo?.thread_id === convo.thread_id;
                return (
                  <button
                    key={convo.thread_id || idx}
                    onClick={() => setSelectedConvo(convo)}
                    className={`w-full text-left px-4 py-3 border-b transition-colors ${
                      isSelected
                        ? theme === 'dark' ? 'bg-indigo-950/40 border-zinc-800' : 'bg-indigo-50 border-slate-200'
                        : theme === 'dark' ? 'border-zinc-800/60 hover:bg-[#141418]' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">
                            {convo.participant.name || 'ไม่ทราบชื่อ'}
                          </span>
                          <span className={`text-[10px] shrink-0 ${
                            theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'
                          }`}>
                            {formatTime(convo.updated_time)}
                          </span>
                        </div>
                        {lastMsg && (
                          <p className={`text-xs truncate mt-0.5 ${
                            theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'
                          }`}>
                            {lastMsg.is_from_page && <span className="text-indigo-400">คุณ: </span>}
                            {lastMsg.message || '(รูปภาพ/ไฟล์แนบ)'}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`lg:col-span-2 rounded-xl border overflow-hidden flex flex-col ${
          theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          {selectedConvo ? (
            <>
              {/* Chat Header */}
              <div className={`px-4 py-3 border-b ${
                theme === 'dark' ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    theme === 'dark' ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">
                      {selectedConvo.participant.name || 'ไม่ทราบชื่อ'}
                    </h3>
                    <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                      ID: {selectedConvo.participant.id}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
                {selectedConvo.messages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`flex ${msg.is_from_page ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] ${msg.is_from_page ? 'order-2' : ''}`}>
                      <div className={`px-3.5 py-2.5 rounded-2xl ${
                        msg.is_from_page
                          ? 'bg-indigo-600 text-white rounded-br-md'
                          : theme === 'dark'
                          ? 'bg-[#1a1a22] text-zinc-100 rounded-bl-md border border-zinc-800'
                          : 'bg-slate-100 text-slate-900 rounded-bl-md'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message || '(รูปภาพ/ไฟล์แนบ)'}</p>
                      </div>
                      <p className={`text-[10px] mt-1 ${
                        msg.is_from_page ? 'text-right' : ''
                      } ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-400'}`}>
                        {formatFullTime(msg.created_time)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Input */}
              <div className={`px-4 py-3 border-t ${
                theme === 'dark' ? 'border-zinc-800 bg-[#121216]' : 'border-slate-200 bg-slate-50'
              }`}>
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
                    placeholder="พิมพ์ข้อความตอบกลับ... (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
                    rows={2}
                    className={`flex-1 resize-none rounded-xl px-3.5 py-2.5 text-sm border outline-none transition-colors ${
                      theme === 'dark'
                        ? 'bg-[#0F0F12] border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500'
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
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
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <MessageSquare className={`w-16 h-16 mx-auto mb-4 ${
                  theme === 'dark' ? 'text-zinc-700' : 'text-slate-200'
                }`} />
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-zinc-500' : 'text-slate-400'}`}>
                  เลือกบทสนทนาจากด้านซ้าย
                </p>
                <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-600' : 'text-slate-300'}`}>
                  หรือรอให้ลูกค้าทักเข้ามา
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
