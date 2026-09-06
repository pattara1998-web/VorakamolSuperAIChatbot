import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  Bot,
  User,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  Facebook,
  Phone,
  MapPin,
  RefreshCw,
  Zap,
  Info,
  Play,
  MessageSquare,
  MessageCircle,
  Tag,
  Gift,
  ShieldCheck
} from 'lucide-react';
import { PageConfig, Customer, AnyProduct } from '../types';

interface MessageItem {
  id: string;
  sender: 'customer' | 'bot';
  text: string;
  timestamp: string;
  image?: string;
  sequenceStep?: number;
  isOrder?: boolean;
  orderDetails?: any;
  attachedComment?: string;
}

interface LiveSimulatorTabProps {
  pages: PageConfig[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
  customers: Customer[];
  allProducts: {
    amulet: AnyProduct[];
    china: AnyProduct[];
    otop: AnyProduct[];
    agriculture?: AnyProduct[];
  };
  onOrderCreated: (order: any) => void;
  theme?: 'dark' | 'light';
}

export const LiveSimulatorTab: React.FC<LiveSimulatorTabProps> = ({
  pages,
  selectedPageId,
  setSelectedPageId,
  customers,
  allProducts,
  onOrderCreated,
  theme = 'dark'
}) => {
  const selectedPage = pages.find(p => p.page_id === selectedPageId) || pages[0];
  const [isApiConfigured, setIsApiConfigured] = useState<boolean | null>(null);

  const currentProducts =
    selectedPage.category === 'CHINA'
      ? allProducts.china
      : selectedPage.category === 'OTOP'
      ? allProducts.otop
      : allProducts.amulet;

  const currentPrimaryProduct = currentProducts[0];

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'msg-init-1',
      sender: 'bot',
      text: selectedPage.sequence?.step1_opening_text || 'สวัสดีค่ะ ยินดีต้อนรับสู่ศูนย์บริการลูกค้า มีแอดมินและ AI ผู้ช่วยพร้อมให้คำปรึกษาตลอด 24 ชม. สอบถามข้อมูลสินค้าหรือรับโปรโมชั่นพิเศษแจ้งได้เลยนะคะ 🙏',
      timestamp: new Date().toLocaleTimeString('th-TH')
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [selectedPsid, setSelectedPsid] = useState('PSID_8849201948');
  const [customerName, setCustomerName] = useState('คุณสมชาย ใจดี');
  const [customerPhone, setCustomerPhone] = useState('0812345678');
  const [customerAddress, setCustomerAddress] = useState('123/45 ถนนสุขุมวิท คลองเตย กทม. 10110');
  const [commentContext, setCommentContext] = useState('');

  // Audio Recording State for Gemini Transcription
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check API configuration status
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setIsApiConfigured(!!data.geminiApiKeyConfigured);
        } else {
          setIsApiConfigured(false);
        }
      } catch {
        setIsApiConfigured(false);
      }
    };
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  // When page changes, reset initial message with that page's opening
  useEffect(() => {
    if (selectedPage) {
      const initialMessages: MessageItem[] = [
        {
          id: `msg-init-${Date.now()}`,
          sender: 'bot' as const,
          text: selectedPage.sequence?.step1_opening_text || `${selectedPage.admin_name || 'น้ำหวาน'}: สวัสดีค่ะ ยินดีต้อนรับ สนใจสินค้าตัวไหนสอบถามได้เลยนะคะ 🙏`,
          timestamp: new Date().toLocaleTimeString('th-TH')
        }
      ];
      
      // Add API warning if not configured
      if (!isApiConfigured) {
        initialMessages.push({
          id: `msg-api-warning-${Date.now()}`,
          sender: 'bot' as const,
          text: '⚠️ ระบบยังไม่ได้ตั้งค่า AI API กรุณาไปที่ "ตั้งค่า AI API" ในเมนูด้านบนเพื่อใส่ API Key ก่อนนะคะ',
          timestamp: new Date().toLocaleTimeString('th-TH')
        });
      }
      
      setMessages(initialMessages);
    }
  }, [selectedPageId, isApiConfigured]);

  // Handle Voice Recording via Microphone & Gemini Transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = e => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await handleAudioTranscribe(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      alert('ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้งานไมโครโฟนในเบราว์เซอร์');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const handleAudioTranscribe = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/ai/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: base64Data,
            mimeType: 'audio/webm'
          })
        });
        const data = await res.json();
        setIsTranscribing(false);
        if (data.text) {
          setInputText(data.text);
          handleSendMessage(data.text);
        }
      };
    } catch (err) {
      console.error('Transcription failed:', err);
      setIsTranscribing(false);
    }
  };

  // Execute full 6-step pattern sales sequence
  const handleTriggerFullSequence = async () => {
    if (isAiTyping) return;
    setIsAiTyping(true);

    const seq = selectedPage.sequence;
    const now = () => new Date().toLocaleTimeString('th-TH');

    // Step 1: ข้อความเปิด
    const step1: MessageItem = {
      id: `seq-1-${Date.now()}`,
      sender: 'bot',
      text: seq?.step1_opening_text || 'สวัสดีค่ะ ยินดีต้อนรับค่ะ 🙏',
      timestamp: now(),
      sequenceStep: 1
    };

    // Step 2: รูปสินค้าหลัก
    const step2: MessageItem = {
      id: `seq-2-${Date.now()}`,
      sender: 'bot',
      text: `📸 รูปสินค้า: ${selectedPage.product?.product_name || currentPrimaryProduct?.product_name}`,
      image: seq?.step2_product_image || currentPrimaryProduct?.image_main,
      timestamp: now(),
      sequenceStep: 2
    };

    // Step 3: รายละเอียดโปรโมชั่น
    const step3: MessageItem = {
      id: `seq-3-${Date.now()}`,
      sender: 'bot',
      text: seq?.step3_promotion_detail || 'โปรโมชั่นพิเศษวันนี้ ส่งฟรีเก็บเงินปลายทางค่ะ',
      timestamp: now(),
      sequenceStep: 3
    };

    // Step 4: รูปโปรโมชั่น
    const step4: MessageItem = {
      id: `seq-4-${Date.now()}`,
      sender: 'bot',
      text: '🎁 ภาพโปรโมชั่นและของแถมสุดพิเศษประจำวันนี้:',
      image: seq?.step4_promotion_image || currentPrimaryProduct?.image_promotion,
      timestamp: now(),
      sequenceStep: 4
    };

    // Step 5: รูปรีวิว
    const step5: MessageItem = {
      id: `seq-5-${Date.now()}`,
      sender: 'bot',
      text: '⭐ รีวิวความประทับใจจากลูกค้าจริงที่ได้รับสินค้าเรียบร้อยค่ะ:',
      image: seq?.step5_review_image || currentPrimaryProduct?.image_review,
      timestamp: now(),
      sequenceStep: 5
    };

    // Step 6: ข้อความปิดการขาย
    const step6: MessageItem = {
      id: `seq-6-${Date.now()}`,
      sender: 'bot',
      text: seq?.step6_closing_text || 'คุณพี่รับโปรโมชั่นไหนดีคะ แจ้งชื่อ-ที่อยู่ เบอร์โทร เพื่อรับสิทธิ์ส่งฟรีได้เลยนะคะ 📦',
      timestamp: now(),
      sequenceStep: 6
    };

    // Append sequence with natural slight delays
    setMessages(prev => [...prev, step1]);

    setTimeout(() => {
      setMessages(prev => [...prev, step2]);
    }, 400);

    setTimeout(() => {
      setMessages(prev => [...prev, step3]);
    }, 800);

    setTimeout(() => {
      setMessages(prev => [...prev, step4]);
    }, 1200);

    setTimeout(() => {
      setMessages(prev => [...prev, step5]);
    }, 1600);

    setTimeout(() => {
      setMessages(prev => [...prev, step6]);
      setIsAiTyping(false);
    }, 2000);
  };

  // Send Message & AI Auto-Closing Execution
  const handleSendMessage = async (textToSend?: string) => {
    const rawQuery = textToSend || inputText;
    if (!rawQuery.trim() || isAiTyping) return;

    let fullQuery = rawQuery.trim();
    if (commentContext.trim()) {
      fullQuery = `[ลูกค้ามาจากคอมเมนต์โพสต์: "${commentContext.trim()}"]\n${fullQuery}`;
      setCommentContext('');
    }

    const userMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: 'customer',
      text: fullQuery,
      timestamp: new Date().toLocaleTimeString('th-TH')
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsAiTyping(true);

    try {
      // Simulate real Facebook Webhook endpoint call
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'MESSAGE',
          sender_id: selectedPsid,
          page_id: selectedPageId,
          message_text: fullQuery
        })
      });

      // Prepare response based on configured page product & promotions
      setTimeout(() => {
        const isOrderQuery =
          fullQuery.includes('สั่ง') ||
          fullQuery.includes('เอา') ||
          fullQuery.includes('ส่ง') ||
          fullQuery.includes('ที่อยู่') ||
          fullQuery.includes('08') ||
          fullQuery.includes('09');

        const primaryProdName = selectedPage.product?.product_name || currentPrimaryProduct?.product_name;
        const primaryPrice = selectedPage.product?.display_price || currentPrimaryProduct?.display_price || 990;

        let replyText = '';
        let replyImage = selectedPage.sequence?.step2_product_image || currentPrimaryProduct?.image_main;

        if (isOrderQuery) {
          replyText = `🎉 ขอบพระคุณสำหรับคำสั่งซื้อค่ะ!\n\n📦 สินค้า: ${primaryProdName}\n💰 ยอดรวม: ฿${primaryPrice.toLocaleString()} (${(selectedPage.product?.promotions || []).some((pr: any) => pr.free_shipping === true) ? 'จัดส่งฟรี ' : ''}มีเก็บเงินปลายทาง)\n📍 ที่อยู่จัดส่ง: ${customerAddress || 'บันทึกเรียบร้อย'}\n\nแอดมิน ${selectedPage.admin_name || 'น้ำหวาน'} รับออเดอร์เรียบร้อย และเตรียมจัดส่งรอบบ่ายนี้ค่ะ ขอบคุณค่ะ 🙏`;
          replyImage = selectedPage.sequence?.step4_promotion_image || currentPrimaryProduct?.image_closing;
        } else if (fullQuery.includes('ราคา') || fullQuery.includes('โปร')) {
          replyText = `${selectedPage.sequence?.step3_promotion_detail || currentPrimaryProduct?.promotion_text}\n\n${selectedPage.sequence?.step6_closing_text || currentPrimaryProduct?.closing_text}`;
          replyImage = selectedPage.sequence?.step4_promotion_image || currentPrimaryProduct?.image_promotion;
        } else if (fullQuery.includes('คาถา') && (currentPrimaryProduct as any)?.spell) {
          replyText = `บทสวดบูชา ${primaryProdName}:\n\n"${(currentPrimaryProduct as any).spell}"\n\n📌 พุทธคุณ: ${(currentPrimaryProduct as any).belief_info}\n\nบูชาเพียง ฿${primaryPrice} บาท สั่งซื้อได้เลยนะคะ 🙏`;
          replyImage = currentPrimaryProduct?.image_detail || currentPrimaryProduct?.image_main;
        } else {
          replyText = `สวัสดีค่ะ แอดมิน ${selectedPage.admin_name || 'น้ำหวาน'} ยินดีให้บริการค่ะ\n\n${selectedPage.product?.description || currentPrimaryProduct?.detail_text}\n\n${selectedPage.sequence?.step3_promotion_detail || currentPrimaryProduct?.promotion_text}`;
          replyImage = selectedPage.sequence?.step2_product_image || currentPrimaryProduct?.image_main;
        }

        const botMsg: MessageItem = {
          id: `msg-bot-${Date.now()}`,
          sender: 'bot',
          text: replyText,
          timestamp: new Date().toLocaleTimeString('th-TH'),
          image: replyImage,
          isOrder: isOrderQuery
        };

        setMessages(prev => [...prev, botMsg]);
        setIsAiTyping(false);
      }, 600);
    } catch (err) {
      console.error('Error sending simulated message:', err);
      setIsAiTyping(false);
    }
  };

  const handleSelectCustomer = (psid: string) => {
    const cust = customers.find(c => c.psid === psid);
    if (cust) {
      setSelectedPsid(cust.psid);
      setCustomerName(cust.customer_name);
      setCustomerPhone(cust.phone_number || '0812345678');
      setCustomerAddress(cust.address || '123/45 ถนนสุขุมวิท คลองเตย กทม. 10110');
    }
  };

  const quickPrompts = [
    'สวัสดีครับ สนใจสินค้า มีโปรโมชั่นอะไรบ้างครับ',
    'ขอทราบคาถาบูชา และพุทธคุณแท้ของรุ่นนี้ครับ',
    'เครื่องฟอกอากาศตัวนี้กรองฝุ่น PM2.5 และมีประกันกี่ปีครับ',
    'สั่งซื้อ 1 ชิ้น ส่ง นายสมชาย ใจดี 0812345678 ที่อยู่ 123/45 สุขุมวิท คลองเตย กทม. 10110 เก็บเงินปลายทางครับ',
    'ผ้าไหมสุรินทร์ผืนนี้ทอมือแท้ 100% ย้อมสีธรรมชาติไหมครับ'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 4 Cols: Simulator Controls & Customer Persona */}
      <div className="lg:col-span-4 space-y-4">
        {/* Active Facebook Page Selector & AI Badge */}
        <div className={`border rounded-xl p-4 shadow-sm ${theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800/80' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Facebook className="w-4 h-4 text-indigo-500" /> เพจ Facebook ที่กำลังทดสอบ
            </h3>
            <span className="text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
              {selectedPage.ai_model || 'gemini-3.6-flash'}
            </span>
          </div>

          <select
            value={selectedPageId}
            onChange={e => setSelectedPageId(e.target.value)}
            className={`w-full text-xs rounded-lg p-2.5 font-medium border outline-none ${
              theme === 'dark'
                ? 'bg-[#141418] border-zinc-800 text-zinc-200 focus:ring-1 focus:ring-indigo-500'
                : 'bg-slate-50 border-slate-200 text-zinc-800 focus:ring-1 focus:ring-indigo-500'
            }`}
          >
            {pages.map(p => (
              <option key={p.page_id} value={p.page_id}>
                {p.category === 'AMULET' ? '📿 ' : p.category === 'CHINA' ? '📦 ' : '🌾 '}
                {p.page_name}
              </option>
            ))}
          </select>

          {/* Product & Admin info of this page */}
          <div className={`mt-3 p-3 border rounded-lg ${theme === 'dark' ? 'bg-[#141418] border-zinc-800/60' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-500 font-semibold">สินค้า 1 เพจ 1 สินค้า:</span>
              <span className="text-emerald-500 font-mono font-bold">
                ฿{(selectedPage.product?.display_price || currentPrimaryProduct?.display_price)?.toLocaleString()}
              </span>
            </div>
            <div className="text-xs font-medium mt-1 truncate">
              {selectedPage.product?.product_name || currentPrimaryProduct?.product_name}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center justify-between">
              <span>แอดมิน: <strong className="text-indigo-400">{selectedPage.admin_name || 'น้ำหวาน'}</strong></span>
              <span className="font-mono text-zinc-500">{selectedPage.product?.promotions?.length || 3} โปรโมชั่น</span>
            </div>
          </div>

          {/* API Status Warning */}
          {!isApiConfigured && (
            <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">⚠️ ยังไม่ได้ตั้งค่า AI API</span> - ระบบจะไม่สามารถตอบแชทได้จริง
              </div>
            </div>
          )}

          {/* Trigger 6-Step Pattern Button ("ส่งแพตเทิร์น 6 สเต็ป") */}
          <div className="mt-3">
            <button
              onClick={handleTriggerFullSequence}
              disabled={isAiTyping}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>▶️ ทดสอบส่งแพตเทิร์นขาย 6 สเต็ปครบชุด</span>
            </button>
          </div>
        </div>

        {/* Promotion Tiers Quick Selector */}
        {selectedPage.product?.promotions && (
          <div className={`border rounded-xl p-4 shadow-sm ${theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800/80' : 'bg-white border-slate-200'}`}>
            <h3 className="font-semibold text-xs flex items-center gap-1.5 mb-2.5">
              <Gift className="w-3.5 h-3.5 text-amber-500" /> โปรโมชั่นของสินค้านี้ ({selectedPage.product.promotions.length} ระดับ):
            </h3>
            <div className="space-y-2">
              {selectedPage.product.promotions.map((promo, idx) => (
                <button
                  key={promo.id}
                  onClick={() => {
                    const prompt = `สนใจ ${promo.name} ราคา ฿${promo.price.toLocaleString()} ยังมีของแถม ${promo.free_gifts || 'ไหมครับ'}`;
                    setInputText(prompt);
                    handleSendMessage(prompt);
                  }}
                  className={`w-full text-left p-2 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                    theme === 'dark'
                      ? 'bg-[#141418] border-zinc-800/80 hover:bg-[#1a1a22] text-zinc-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-zinc-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-200">{promo.name}</span>
                    <span className="text-[10px] text-zinc-400 line-clamp-1">{promo.free_gifts || promo.description}</span>
                  </div>
                  <span className="text-emerald-400 font-mono font-bold text-xs shrink-0">
                    ฿{promo.price.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attached Comment Context Simulator */}
        <div className={`border rounded-xl p-4 shadow-sm ${theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800/80' : 'bg-white border-slate-200'}`}>
          <h3 className="font-semibold text-xs flex items-center gap-1.5 mb-2">
            <MessageCircle className="w-3.5 h-3.5 text-indigo-400" /> แนบบริบทคอมเมนต์ (Comment Context):
          </h3>
          <p className="text-[11px] text-zinc-400 mb-2">
            จำลองสถานการณ์ลูกค้าคอมเมนต์บนโพสต์ แล้วระบบดึงเข้าแชท Inbox
          </p>
          <input
            type="text"
            value={commentContext}
            onChange={e => setCommentContext(e.target.value)}
            placeholder="เช่น สนใจโปร 2 ผืนสีฟ้า, ถามเรื่องเก็บเงินปลายทาง..."
            className={`w-full border rounded-lg p-2 text-xs outline-none ${
              theme === 'dark'
                ? 'bg-[#141418] border-zinc-800 text-zinc-200 focus:border-indigo-500'
                : 'bg-slate-50 border-slate-200 text-zinc-800 focus:border-indigo-500'
            }`}
          />
        </div>

        {/* Customer Profile Picker */}
        <div className={`border rounded-xl p-4 shadow-sm ${theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800/80' : 'bg-white border-slate-200'}`}>
          <h3 className="font-semibold text-xs flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-indigo-400" /> ข้อมูลผู้ส่ง (Customer PSID)
          </h3>
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">เลือกลูกค้าจาก CRM:</label>
              <select
                value={selectedPsid}
                onChange={e => handleSelectCustomer(e.target.value)}
                className={`w-full border text-xs rounded-lg p-2 font-mono ${
                  theme === 'dark'
                    ? 'bg-[#141418] border-zinc-800 text-zinc-200'
                    : 'bg-slate-50 border-slate-200 text-zinc-800'
                }`}
              >
                {customers.map(c => (
                  <option key={c.psid} value={c.psid}>
                    {c.customer_name} ({c.psid})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">ชื่อลูกค้า:</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className={`w-full border text-xs rounded-lg p-2 outline-none ${
                  theme === 'dark'
                    ? 'bg-[#141418] border-zinc-800 text-zinc-200 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-zinc-800 focus:border-indigo-500'
                }`}
              />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 block mb-1">ที่อยู่จัดส่ง:</label>
              <textarea
                rows={2}
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                className={`w-full border text-xs rounded-lg p-2 resize-none outline-none ${
                  theme === 'dark'
                    ? 'bg-[#141418] border-zinc-800 text-zinc-200 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-zinc-800 focus:border-indigo-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right 8 Cols: Facebook Messenger Chat Window */}
      <div className={`lg:col-span-8 border rounded-xl flex flex-col h-[680px] overflow-hidden shadow-xl ${
        theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800/80' : 'bg-white border-slate-200'
      }`}>
        {/* Chat Window Header */}
        <div className={`border-b p-3.5 flex items-center justify-between ${
          theme === 'dark' ? 'bg-[#0A0A0C] border-zinc-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm leading-tight">
                  {selectedPage.page_name}
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-zinc-400 flex items-center gap-2">
                <span>แอดมิน: <strong className="text-indigo-400">{selectedPage.admin_name || 'น้ำหวาน'}</strong></span>
                <span>•</span>
                <span>โมเดล: <code className="text-amber-400 font-mono">{selectedPage.ai_model || 'gemini-3.6-flash'}</code></span>
                <span>•</span>
                <span>ตอบกลับใน 0.5s</span>
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setMessages([
                {
                  id: `msg-init-${Date.now()}`,
                  sender: 'bot',
                  text: selectedPage.sequence?.step1_opening_text || 'สวัสดีค่ะ สอบถามข้อมูลสินค้าหรือโปรโมชั่นพิเศษแจ้งได้เลยนะคะ 🙏',
                  timestamp: new Date().toLocaleTimeString('th-TH')
                }
              ])
            }
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60' : 'text-zinc-500 hover:text-zinc-900 hover:bg-slate-200'
            }`}
            title="ล้างประวัติแชทจำลอง"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Chat Message List */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${
          theme === 'dark' ? 'bg-[#0A0A0C]/50' : 'bg-slate-50/70'
        }`}>
          {messages.map(msg => {
            const isBot = msg.sender === 'bot';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isBot ? 'justify-start' : 'justify-end'}`}
              >
                {isBot && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-md rounded-xl p-3.5 text-xs shadow-md ${
                    isBot
                      ? theme === 'dark'
                        ? 'bg-[#141418] text-zinc-200 border border-zinc-800 rounded-tl-none'
                        : 'bg-white text-zinc-800 border border-slate-200 rounded-tl-none'
                      : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}
                >
                  {msg.sequenceStep && (
                    <div className="mb-1.5">
                      <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/30">
                        สเต็ปที่ {msg.sequenceStep} จาก 6
                      </span>
                    </div>
                  )}

                  {msg.image && (
                    <div className="mb-2.5 rounded-lg overflow-hidden border border-zinc-800/80 bg-[#0A0A0C]">
                      <img
                        src={msg.image}
                        alt="Attached product"
                        referrerPolicy="no-referrer"
                        className="w-full h-44 object-cover"
                      />
                    </div>
                  )}

                  <div className="whitespace-pre-line leading-relaxed font-sans">
                    {msg.text}
                  </div>

                  <div
                    className={`text-[10px] mt-1.5 text-right font-mono ${
                      isBot ? 'text-zinc-400' : 'text-indigo-200'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {!isBot && (
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold shrink-0 mt-0.5 text-xs ${
                    theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-200' : 'bg-slate-200 border-slate-300 text-zinc-700'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isAiTyping && (
            <div className="flex items-center gap-2 text-xs text-zinc-400 italic">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <span>แอดมิน AI ({selectedPage.ai_model || 'Gemini 2.5 Flash'}) กำลังวิเคราะห์และเตรียมข้อความปิดการขาย...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar with Voice Transcription Mic Button */}
        <div className={`border-t p-3 flex flex-col gap-2 ${
          theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200'
        }`}>
          {isRecording && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-lg px-3 py-1.5 text-xs text-rose-300 flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                กำลังบันทึกเสียงของคุณ... พูดชื่อสินค้าหรือที่อยู่ได้เลย
              </span>
              <button
                onClick={stopRecording}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-2.5 py-0.5 rounded text-[10px]"
              >
                หยุด & ถอดเสียง
              </button>
            </div>
          )}

          {isTranscribing && (
            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              <span>Gemini AI กำลังถอดเสียงเป็นข้อความภาษาไทย...</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
                isRecording
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40'
                  : theme === 'dark'
                  ? 'bg-[#141418] hover:bg-[#1a1a22] text-zinc-300 border border-zinc-800'
                  : 'bg-slate-100 hover:bg-slate-200 text-zinc-700 border border-slate-200'
              }`}
              title={isRecording ? 'หยุดบันทึกเสียง' : 'กดบันทึกเสียงพูดเพื่อสั่งซื้อ/สอบถาม (Gemini Voice)'}
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-indigo-500" />}
            </button>

            <input
              type="text"
              placeholder="พิมพ์ข้อความสอบถาม สั่งซื้อ หรือส่งที่อยู่..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSendMessage();
              }}
              className={`flex-1 border rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                theme === 'dark'
                  ? 'bg-[#141418] border-zinc-800 text-zinc-100 placeholder-zinc-500'
                  : 'bg-slate-50 border-slate-200 text-zinc-800 placeholder-zinc-400'
              }`}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isAiTyping}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>ส่งแชท</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
