import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Mic,
  MicOff,
  Send,
  X,
  Minimize2,
  Maximize2,
  TrendingUp,
  AlertTriangle,
  PhoneCall,
  Package,
  CheckCircle,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  Volume2
} from 'lucide-react';
import { Customer, Order, PageConfig } from '../types';

interface AiAdminCopilotProps {
  orders: Order[];
  customers: Customer[];
  pages: PageConfig[];
  emergencyAlerts?: any[];
  theme?: 'dark' | 'light';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AiAdminCopilot: React.FC<AiAdminCopilotProps> = ({
  orders,
  customers,
  pages,
  emergencyAlerts = [],
  theme = 'dark'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Chat message history with welcome prompt
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'สวัสดีค่ะท่านเจ้าของธุรกิจ! ดิฉันคือ AI ผู้ช่วยส่วนตัวของ Vorakamol SuperAI ยินดีช่วยเหลือท่านสรุปยอดขายแยกตามหมวดสินค้า ตรวจสอบปัญหาฉุกเฉิน คัดกรองลูกค้า VIP หรือสั่งการงานระบบได้ตลอด 24 ชม. ค่ะ สามารถพิมพ์หรือกดปุ่มไมค์ 🎙️ เพื่อพูดได้เลยนะคะ',
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'th-TH';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Toggle Voice Input
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setMessages(prev => [
        ...prev,
        {
          id: `voice-notice-${Date.now()}`,
          role: 'assistant',
          text: '🎙️ เบราว์เซอร์ปัจจุบันยังไม่รองรับระบบสั่งการด้วยเสียงโดยตรง ท่านสามารถพิมพ์ข้อความหรือคำสั่งในช่องด้านล่างได้เลยนะคะ',
          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Voice start error:', err);
      }
    }
  };

  // Send message to AI backend
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.slice(-4)
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: data.reply || 'ขออภัยค่ะ ไม่สามารถประมวลผลคำตอบได้',
          timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        throw new Error('API response not ok');
      }
    } catch (err) {
      console.error('Copilot error:', err);
      const errorMsg: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        text: 'ขออภัยค่ะ เกิดข้อขัดข้องในการเชื่อมต่อสมองกล AI กรุณาลองใหม่อีกครั้งนะคะ',
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Action Handler
  const handleQuickAction = (promptText: string) => {
    handleSendMessage(promptText);
  };

  // Copy text helper
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const unreadAlertsCount = emergencyAlerts.filter(a => !a.is_resolved).length;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 1. COLLAPSED FLOATING TRIGGER BUTTON */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full shadow-2xl shadow-indigo-600/50 border border-indigo-400/40 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        >
          {/* Glowing pulse ring */}
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-75 blur-sm group-hover:opacity-100 transition duration-300 animate-pulse"></span>

          <div className="relative flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="text-left pr-1 hidden sm:block">
              <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
                <span>AI ผู้ช่วยส่วนตัว</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <div className="text-[10px] text-indigo-200">ถามยอดขาย • ตรวจปัญหา • สั่งการระบบ</div>
            </div>

            {/* Notification Badge if system alerts exist */}
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-slate-900 shadow-sm animate-bounce">
                {unreadAlertsCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* 2. EXPANDED FLOATING CHAT WINDOW */}
      {isOpen && (
        <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-[92vw] sm:w-[420px] h-[560px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-3.5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                  Vorakamol SuperAI — ผู้ช่วยส่วนตัว
                  <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-200 text-[9px] font-mono rounded font-bold border border-indigo-400/30">
                    v2.7 PRO
                  </span>
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[9px] font-mono rounded font-bold">
                    ONLINE
                  </span>
                </h3>
                <p className="text-[10px] text-indigo-200">ผู้ช่วยอัจฉริยะวิเคราะห์ยอดขาย & งานระบบ</p>
              </div>
            </div>

            {/* Minimize / Close Button */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="ย่อขนาด / ซ่อนผู้ช่วย"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Action Shortcut Pills */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#0E0E12] border-b border-slate-200 dark:border-zinc-800/80 overflow-x-auto flex items-center gap-1.5 scrollbar-none shrink-0">
            <button
              onClick={() => handleQuickAction('ช่วยสรุปปิดยอดขายทุกหมวดสินค้าวันนี้ แยกตามชื่อสินค้า ราคา ออเดอร์ COD และสรุปรวมท้ายข้อความ (ยอดเงิน, กี่ออเดอร์, กี่ชิ้น, คนทัก, %ปิดการขาย)')}
              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-300 dark:border-indigo-700/80 rounded-full text-[11px] font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1 whitespace-nowrap transition-all shrink-0 shadow-xs"
            >
              <TrendingUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> 📊 สรุปปิดยอดขาย (แยกหมวด & สถิติครบ)
            </button>
            <button
              onClick={() => handleQuickAction('ช่วยปิดยอดสินค้าของจีน วันนี้ ให้สรุปแยกเสาอากาศ ชุดบล็อก เครื่องฟอกอากาศ ยอดขายรวม กี่ออเดอร์ กี่ชิ้น คนทัก และ %ปิดการขาย')}
              className="px-2.5 py-1 bg-white dark:bg-[#1A1A22] hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-zinc-700/80 rounded-full text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1 whitespace-nowrap transition-all shrink-0"
            >
              🇨🇳 ปิดยอดของจีน
            </button>
            <button
              onClick={() => handleQuickAction('ช่วยปิดยอดหมวดพระเครื่อง วัตถุมงคล วันนี้ สรุปยอดขาย ออเดอร์ และคนทัก')}
              className="px-2.5 py-1 bg-white dark:bg-[#1A1A22] hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-zinc-700/80 rounded-full text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1 whitespace-nowrap transition-all shrink-0"
            >
              🙏 ปิดยอดพระเครื่อง
            </button>
            <button
              onClick={() => handleQuickAction('ช่วยตรวจสอบข้อผิดพลาด วิกฤต หรือการแจ้งเตือนฉุกเฉินในระบบตอนนี้หน่อย')}
              className="px-2.5 py-1 bg-white dark:bg-[#1A1A22] hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-zinc-700/80 rounded-full text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1 whitespace-nowrap transition-all shrink-0"
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" /> ตรวจสอบวิกฤต/แจ้งเตือน
            </button>
            <button
              onClick={() => handleQuickAction('ช่วยคัดรายชื่อลูกค้า VIP ยอดซื้อสะสมสูงสุด 5 อันดับแรกเพื่อโทร Telesales')}
              className="px-2.5 py-1 bg-white dark:bg-[#1A1A22] hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-slate-200 dark:border-zinc-700/80 rounded-full text-[11px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1 whitespace-nowrap transition-all shrink-0"
            >
              <PhoneCall className="w-3 h-3 text-amber-500" /> ลูกค้า VIP Telesales
            </button>
          </div>

          {/* Messages Log Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-100/50 dark:bg-[#0A0A0C]">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`relative group max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                      : 'bg-white dark:bg-[#1A1A22] text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 rounded-bl-none shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                  <div
                    className={`text-[9px] mt-1 text-right ${
                      msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>

                  {/* Copy button */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="คัดลอกข้อความ"
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-[#1A1A22] p-2.5 rounded-2xl w-fit border border-slate-200 dark:border-zinc-800">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> AI กำลังวิเคราะห์ข้อมูลและร่างคำตอบ...
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Voice Listening Active Banner */}
          {isListening && (
            <div className="px-4 py-2 bg-rose-500 text-white text-xs font-bold flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 animate-ping" /> กำลังฟังเสียงพูดของคุณ (พูดภาษาไทยได้เลย)...
              </div>
              <button onClick={toggleVoiceInput} className="underline text-[11px]">
                หยุดพูด
              </button>
            </div>
          )}

          {/* Input Box with Microphone & Send */}
          <div className="p-3 bg-white dark:bg-[#121216] border-t border-slate-200 dark:border-zinc-800">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              {/* Voice Microphone Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-2.5 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-bounce shadow-md shadow-rose-500/30'
                    : 'bg-slate-100 dark:bg-[#1A1A22] text-slate-600 dark:text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-zinc-800'
                }`}
                title={isListening ? 'กำลังบันทึกเสียง (กดเพื่อหยุด)' : 'กดปุ่มไมค์เพื่อสั่งการด้วยเสียง'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder="พิมพ์คำถาม หรือกดไมค์พูดสั่งการ..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none focus:border-indigo-500"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-sm"
                title="ส่งข้อความ"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
