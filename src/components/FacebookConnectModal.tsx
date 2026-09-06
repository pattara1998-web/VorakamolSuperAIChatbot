import React, { useState, useEffect } from 'react';
import {
  Facebook,
  X,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  Key,
  PlusCircle,
  Settings
} from 'lucide-react';
import { PageConfig } from '../types';

interface FacebookConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageConfig[];
  selectedPageId: string;
  onImportPages?: (newPages: PageConfig[]) => void;
  onGoToInbox?: () => void;
}

export const FacebookConnectModal: React.FC<FacebookConnectModalProps> = ({
  isOpen,
  onClose,
  pages,
  selectedPageId,
  onImportPages,
  onGoToInbox
}) => {
  const [activeTab, setActiveTab] = useState<'direct_page' | 'oneclick' | 'webhook'>('direct_page');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isConnectingFb, setIsConnectingFb] = useState(false);
  const [verifyingPageId, setVerifyingPageId] = useState<string | null>(null);
  const [pageHealthStatus, setPageHealthStatus] = useState<Record<string, any>>({});
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    count: number;
    pages: { page_id: string; page_name: string; is_active: boolean; auto_reply: boolean; bot_stopped: boolean }[];
  } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const [directPageId, setDirectPageId] = useState('');
  const [directPageToken, setDirectPageToken] = useState('');
  const [customAppId, setCustomAppId] = useState('');
  const [showCustomAppConfig, setShowCustomAppConfig] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.app';
  const webhookUrl = `${currentOrigin}/api/webhook/facebook`;
  const verifyToken = 'FB_AI_SALES_TOKEN_2026';

  // Helper function to refresh connection status
  const refreshConnectionStatus = () => {
    setIsCheckingStatus(true);
    fetch('/api/facebook/connection-status')
      .then(res => res.json())
      .then(data => {
        setConnectionStatus(data);
        setIsCheckingStatus(false);
      })
      .catch(err => {
        console.error('Error checking connection status:', err);
        setIsCheckingStatus(false);
      });
  };

  // Check connection status when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshConnectionStatus();
    }
  }, [isOpen]);

  // Listen for OAuth completion from popup or URL params
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Allow messages from valid origins
      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        setIsConnectingFb(false);
        const count = event.data.count || (event.data.pages ? event.data.pages.length : 0);
        setTestResult(`🎉 เชื่อมต่อบัญชี Facebook และซิงค์เพจจริงสำเร็จ ${count} เพจ! ระบบเปิดใช้งาน Webhook และ AI พร้อมตอบลูกค้าอัตโนมัติทันที`);
        
        if (event.data.pages && onImportPages) {
          onImportPages(event.data.pages);
        } else {
          // Fetch updated data from API
          fetch('/api/data')
            .then(res => res.json())
            .then(data => {
              if (data.pages && onImportPages) {
                onImportPages(data.pages);
              }
            })
            .catch(e => console.error('Error fetching data after oauth:', e));
        }
        // Refresh connection status after successful OAuth
        setTimeout(() => refreshConnectionStatus(), 500);
      } else if (event.data?.type === 'FB_AUTH_ERROR') {
        setIsConnectingFb(false);
        setTestResult(`❌ การเชื่อมต่อ Facebook ไม่สำเร็จ: ${event.data.error || event.data.message || 'Unknown error'}`);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback: Check URL search params if redirected directly
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.has('fb_connected')) {
        const count = searchParams.get('count') || '0';
        setTestResult(`🎉 เชื่อมต่อบัญชี Facebook และซิงค์เพจจริงสำเร็จ ${count} เพจ! ระบบเปิดใช้งาน Webhook และ AI พร้อมตอบลูกค้าอัตโนมัติทันที`);
        
        fetch('/api/data')
          .then(res => res.json())
          .then(data => {
            if (data.pages && onImportPages) {
              onImportPages(data.pages);
            }
          })
          .catch(e => console.error('Fetch data after fb_connected error:', e));

        // Refresh connection status after successful OAuth via URL params
        setTimeout(() => refreshConnectionStatus(), 500);

        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (searchParams.has('fb_error')) {
        const errorMsg = searchParams.get('fb_error') || 'Unknown error';
        setTestResult(`❌ การเชื่อมต่อ Facebook ไม่สำเร็จ: ${errorMsg}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onImportPages]);

  // Run live verification on page health
  const verifyPageHealth = async (pageId: string) => {
    setVerifyingPageId(pageId);
    try {
      const res = await fetch(`/api/facebook/verify-page?page_id=${encodeURIComponent(pageId)}`);
      const data = await res.json();
      setPageHealthStatus(prev => ({ ...prev, [pageId]: data }));
      if (data.success) {
        setTestResult(`🟢 เพจ "${data.page_name}" พร้อมใช้งานจริง: Webhook Active, Messenger Ready, AI ปิดการขายอัตโนมัติ`);
      } else {
        setTestResult(`⚠️ ${data.message || data.error_message || 'ไม่สามารถยืนยันสถานะเพจได้'}`);
      }
    } catch (err: any) {
      setTestResult(`❌ เกิดข้อผิดพลาดในการตรวจสอบเพจ: ${err.message}`);
    } finally {
      setVerifyingPageId(null);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // 1-Click Facebook OAuth Login via Direct Facebook Dialog (Requires registered Meta App ID)
  const handleOneClickFacebookAuth = () => {
    setIsConnectingFb(true);
    setTestResult(null);
    // OAuth always starts on our backend: the app secret and returned tokens never enter the browser.
    const connectUrl = `/api/facebook/connect?redirect_origin=${encodeURIComponent(currentOrigin)}`;

    try {
      const width = 650;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        connectUrl,
        'facebook_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=yes,status=no`
      );

      if (popup) {
        const checkTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkTimer);
            setIsConnectingFb(false);
          }
        }, 1000);
      } else {
        window.location.href = connectUrl;
      }
    } catch (err: any) {
      console.error('Facebook OAuth Start Error:', err);
      setIsConnectingFb(false);
      window.location.href = connectUrl;
    }
  };

  // Batch import ALL pages using a User Access Token (from Graph API Explorer)
  const handleBatchImportPages = async (tokenToUse: string) => {
    const cleanToken = tokenToUse.trim();
    if (!cleanToken) {
      setTestResult('⚠️ กรุณาระบุ Access Token');
      return;
    }

    setIsConnectingFb(true);
    setTestResult(null);

    try {
      let allAccounts: any[] = [];
      let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?limit=250&fields=id,name,access_token,category,picture{url},cover{source},followers_count,fan_count&access_token=${encodeURIComponent(cleanToken)}`;

      while (nextUrl && allAccounts.length < 1000) {
        const res = await fetch(nextUrl);
        const data = await res.json();

        if (data.error) {
          throw new Error(`Meta Error (${data.error.code}): ${data.error.message}`);
        }

        if (data.data && Array.isArray(data.data)) {
          allAccounts = [...allAccounts, ...data.data];
        }
        nextUrl = data.paging?.next || null;
      }

      if (allAccounts.length === 0) {
        throw new Error('ไม่พบเพจที่บัญชีนี้เป็นแอดมิน กรุณาตรวจสอบสิทธิ์ pages_show_list ใน Token');
      }

      const imported: PageConfig[] = allAccounts.map((item: any) => ({
        page_id: item.id,
        page_name: item.name,
        category: item.category || 'GENERAL',
        page_access_token: item.access_token,
        verify_token: 'FB_AI_SALES_TOKEN_2026',
        is_active: true,
        auto_reply: true,
        auto_close_ai: true,
        page_avatar: item.picture?.data?.url || '',
        page_cover: item.cover?.source || '',
        follower_count: item.followers_count || item.fan_count || 0,
        likes_count: item.fan_count || item.followers_count || 0,
        inquiries_count: 0,
        unread_messages: 0,
        ai_model: 'gemini-3.6-flash',
        admin_name: 'น้ำหวาน',
        ai_tone: 'FRIENDLY',
        ai_custom_instructions: '',
        ai_brevity_mode: false,
        scrape_comments_enabled: true,
        auto_inbox_with_comment_context: true,
        hide_toxic_comments: true,
        toxic_keywords: ['หลอกลวง', 'โกง', 'สคบ', 'แจ้งความ', 'ของปลอม'],
        purchase_keywords: ['สนใจ', 'สั่งซื้อ', 'ราคา', 'รับ', 'เอา'],
        followup_enabled: true,
        followup_messages: [
          { interval: '5 นาที', message: 'คุณพี่ยังสนใจรับโปรโมชั่นพิเศษนี้อยู่ไหมคะ ยินดีดูแลนะคะ 🙏' },
          { interval: '30 นาที', message: 'แจ้งชื่อ-ที่อยู่จัดส่งไว้ได้เลยนะคะ ทางร้านจัดส่งด่วนรอบบ่ายนี้ค่ะ 📦' },
          { interval: '21:00 น.', message: 'สวัสดีรอบค่ำค่ะ สินค้าใกล้หมดสต็อกแล้วนะคะ หากรับแจ้งแอดมินได้เลยค่า ⚡' }
        ],
        product: {
          product_id: `PROD-${item.id.slice(-4)}`,
          product_name: `สินค้าประจำเพจ ${item.name}`,
          category: item.category || 'GENERAL',
          base_price: 0,
          display_price: 0,
          description: 'กรุณาตั้งค่าข้อมูลสินค้าในหน้า "แก้ไขฐานข้อมูล"',
          promotions: [],
          images: {
            main: item.picture?.data?.url || '',
            detail: '',
            promotion: '',
            review: '',
            closing: ''
          }
        },
        sequence: {
          step1_opening_text: `สวัสดีค่ะ ยินดีต้อนรับสู่เพจ ${item.name} สอบถามข้อมูลสินค้าแจ้งได้เลยนะคะ 🙏`,
          step2_product_image: '',
          step3_promotion_detail: 'กรุณาตั้งค่าโปรโมชั่นในหน้า "แก้ไขฐานข้อมูล"',
          step4_promotion_image: '',
          step5_review_image: '',
          step6_closing_text: 'คุณพี่รับกี่ชุดดีคะ แจ้งชื่อ ที่อยู่ และเบอร์โทร สำหรับจัดส่งได้เลยนะคะ 📦'
        }
      }));

      if (onImportPages) {
        onImportPages(imported);
      }
      setTestResult(`🎉 ดึงเพจสำเร็จทั้งหมด ${imported.length} เพจเรียบร้อย! คุณสามารถเลือกเปิด/ปิดการทำงาน AI ของแต่ละเพจได้ที่หน้า ศูนย์รวมเพจ (Pages Hub)`);
      setDirectPageToken('');
      // Refresh connection status after successful batch import
      setTimeout(() => refreshConnectionStatus(), 500);
    } catch (err: any) {
      setTestResult(`❌ ข้อผิดพลาดในการดึงเพจ: ${err.message}`);
    } finally {
      setIsConnectingFb(false);
    }
  };

  // Sync single page directly with token (Supports backend & client-side Graph API for Netlify)
  const handleSyncSinglePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directPageToken.trim()) {
      setTestResult('⚠️ กรุณาระบุ Access Token');
      return;
    }

    // If no Page ID is entered, automatically run Batch Import for ALL pages!
    if (!directPageId.trim()) {
      await handleBatchImportPages(directPageToken.trim());
      return;
    }

    setIsConnectingFb(true);
    setTestResult(null);

    try {
      let importedPages: PageConfig[] = [];

      // 1. Try Backend Sync endpoint first
      try {
        const response = await fetch('/api/facebook/sync-pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            singlePageId: directPageId.trim(),
            pageAccessToken: directPageToken.trim()
          })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.pages && data.pages.length > 0) {
            importedPages = data.pages;
          }
        }
      } catch (beErr) {
        console.warn('Backend sync unavailable, using direct client Graph API fallback...');
      }

      // 2. Client-Side Graph API fallback (for Netlify / Static hosting)
      if (importedPages.length === 0) {
        const cleanToken = directPageToken.trim();
        const pageId = directPageId.trim();

        const graphUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}?fields=id,name,picture{url},category,followers_count,fan_count&access_token=${encodeURIComponent(cleanToken)}`;
        const res = await fetch(graphUrl);
        const fbData = await res.json();

        if (fbData.error) {
          throw new Error(`Meta Error (${fbData.error.code}): ${fbData.error.message}`);
        }

        const newPage: PageConfig = {
          page_id: fbData.id || pageId,
          page_name: fbData.name || `เพจ Facebook (${pageId})`,
          category: 'AMULET',
          page_access_token: cleanToken,
          verify_token: 'FB_AI_SALES_TOKEN_2026',
          is_active: true,
          auto_reply: true,
          auto_close_ai: true,
          page_avatar: fbData.picture?.data?.url || '',
          follower_count: fbData.followers_count || fbData.fan_count || 1200,
          likes_count: fbData.fan_count || fbData.followers_count || 1200,
          ai_model: 'gemini-3.6-flash',
          admin_name: 'น้ำหวาน',
          ai_tone: 'FRIENDLY',
          ai_custom_instructions: '',
          ai_brevity_mode: false,
          scrape_comments_enabled: true,
          auto_inbox_with_comment_context: true,
          hide_toxic_comments: true,
          toxic_keywords: ['หลอกลวง', 'โกง', 'สคบ', 'แจ้งความ', 'ของปลอม'],
          purchase_keywords: ['สนใจ', 'สั่งซื้อ', 'ราคา', 'รับ', 'เอา'],
          followup_enabled: true,
          followup_messages: [
            { interval: '5 นาที', message: 'คุณพี่ยังสนใจรับโปรโมชั่นพิเศษนี้อยู่ไหมคะ ยินดีดูแลนะคะ 🙏' },
            { interval: '30 นาที', message: 'แจ้งชื่อ-ที่อยู่จัดส่งไว้ได้เลยนะคะ ทางร้านจัดส่งด่วนรอบบ่ายนี้ค่ะ 📦' },
            { interval: '21:00 น.', message: 'สวัสดีรอบค่ำค่ะ สินค้าใกล้หมดสต็อกแล้วนะคะ หากรับแจ้งแอดมินได้เลยค่า ⚡' }
          ],
          product: {
            product_id: `PROD-${pageId.slice(-4)}`,
            product_name: `สินค้าประจำเพจ ${fbData.name || pageId}`,
            category: 'AMULET',
            base_price: 990,
            display_price: 990,
            description: 'สินค้าคุณภาพสูง จัดส่งฟรี มีบริการเก็บเงินปลายทาง',
            promotions: [
              { id: 'p1', name: '1 ชุด (ชุดทดลอง)', quantity: 1, price: 990, description: 'จัดส่งฟรี มีเก็บเงินปลายทาง' },
              { id: 'p2', name: '2 ชุด (สุดคุ้มยอดนิยม)', quantity: 2, price: 1800, free_gifts: 'ของสมนาคุณพิเศษ 1 ชิ้น', description: 'แถมฟรีของสมนาคุณ จัดส่งฟรี COD', is_popular: true },
              { id: 'p3', name: '3 ชุด (ชุดครอบครัว)', quantity: 3, price: 2500, free_gifts: 'ของสมนาคุณพรีเมียม 2 ชิ้น', description: 'แถมฟรีชุดพรีเมียม จัดส่งฟรี COD' }
            ],
            images: {
              main: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
              detail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
              promotion: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
              review: 'https://images.unsplash.com/photo-1556742049-0a67e55722c3?w=800',
              closing: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800'
            }
          },
          sequence: {
            step1_opening_text: `สวัสดีค่ะ ยินดีต้อนรับสู่เพจ ${fbData.name || 'ทางร้าน'} สนใจสินค้าตัวไหนสอบถามได้เลยค่ะ 🙏`,
            step2_product_image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
            step3_promotion_detail: 'โปรโมชั่นพิเศษวันนี้ 1 ชุด ฿990 / 2 ชุด ฿1,800 แถมฟรีของสมนาคุณ ส่งฟรี COD',
            step4_promotion_image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
            step5_review_image: 'https://images.unsplash.com/photo-1556742049-0a67e55722c3?w=800',
            step6_closing_text: 'คุณพี่รับกี่ชุดดีคะ แจ้งชื่อ ที่อยู่ และเบอร์โทร สำหรับจัดส่งได้เลยนะคะ 📦'
          }
        };

        importedPages = [newPage];
      }

      if (importedPages.length > 0) {
        if (onImportPages) {
          onImportPages(importedPages);
        }
        setTestResult(`🎉 เชื่อมต่อเพจ "${importedPages[0].page_name}" สำเร็จเรียบร้อย! ข้อมูลถูกบันทึกแล้ว`);
        setDirectPageId('');
        setDirectPageToken('');
      }
    } catch (err: any) {
      setTestResult(`❌ ข้อผิดพลาด: ${err.message}`);
    } finally {
      setIsConnectingFb(false);
    }
  };

  const handleTestWebhookPing = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhook/facebook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_ping_challenge_12345`);
      const text = await res.text();
      setIsTesting(false);
      if (text === 'test_ping_challenge_12345') {
        setTestResult('✅ ทดสอบ Webhook สำเร็จ 100%! Endpoint และ Verify Token ถูกต้อง พร้อมรับ Event จริงจาก Facebook');
      } else {
        setTestResult('⚠️ ผลลัพธ์: ' + text);
      }
    } catch (err: any) {
      setIsTesting(false);
      setTestResult('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
    }
  };

  // Pull real comments from every active page right now (Graph API poll).
  const handleScrapeRealComments = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/facebook/scrape-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setIsTesting(false);
      setTestResult(data.message || '❌ ไม่สามารถดูดคอมเมนต์ได้');
    } catch (err: any) {
      setIsTesting(false);
      setTestResult('❌ เกิดข้อผิดพลาดในการดูดคอมเมนต์: ' + err.message);
    }
  };

  // Pull real inbox messages from every active page right now (Graph API poll).
  const handlePollRealInbox = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/facebook/poll-inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setIsTesting(false);
      setTestResult(data.message || '❌ ไม่สามารถดึงข้อความได้');
    } catch (err: any) {
      setIsTesting(false);
      setTestResult('❌ เกิดข้อผิดพลาดในการดึงข้อความ: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-900 dark:text-zinc-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white shadow-lg shadow-[#1877F2]/25">
              <Facebook className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-lg flex items-center gap-2">
                เชื่อมต่อเพจ Facebook
                <span className="text-[10px] font-mono uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 font-bold">
                  Active
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                นำ Page ID และ Page Access Token มาใส่ เพื่อให้ AI ผู้ช่วยตอบแชทและปิดการขายแทนคุณ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-[#141418] rounded-2xl border border-slate-200 dark:border-zinc-800 mb-5 text-xs">
          <button
            onClick={() => { setActiveTab('direct_page'); setTestResult(null); }}
            className={`py-2 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'direct_page'
                ? 'bg-[#1877F2] text-white shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="truncate">🚀 Auto Connect (แนะนำ)</span>
          </button>

          <button
            onClick={() => { setActiveTab('webhook'); setTestResult(null); }}
            className={`py-2 px-2 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'webhook'
                ? 'bg-slate-800 text-white dark:bg-zinc-700 shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="truncate">สถานะ Webhook & Manual</span>
          </button>
        </div>

        {/* Connection Status Indicator */}
        {connectionStatus && (
          <div className={`mb-5 p-4 rounded-2xl border ${
            connectionStatus.connected
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
          }`}>
            <div className="flex items-center gap-3">
              {connectionStatus.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${
                    connectionStatus.connected
                      ? 'text-emerald-900 dark:text-emerald-200'
                      : 'text-amber-900 dark:text-amber-200'
                  }`}>
                    {connectionStatus.connected ? '✅ เชื่อมต่อแล้ว' : '⚠️ ยังไม่ได้เชื่อมต่อ'}
                  </span>
                  {connectionStatus.connected && (
                    <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                      {connectionStatus.count} เพจ
                    </span>
                  )}
                </div>
                {connectionStatus.connected && connectionStatus.pages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {connectionStatus.pages.slice(0, 3).map(p => (
                      <div key={p.page_id} className="flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span className="font-medium">{p.page_name}</span>
                        {p.bot_stopped && (
                          <span className="text-[9px] bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded font-bold">
                            หยุดบอท
                          </span>
                        )}
                      </div>
                    ))}
                    {connectionStatus.pages.length > 3 && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 italic">
                        และอีก {connectionStatus.pages.length - 3} เพจ...
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: ONE-CLICK AUTO CONNECT (LIKE KAOJAO) */}
        {activeTab === 'direct_page' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* ALREADY CONNECTED: green status panel instead of pushing reconnect */}
            {connectionStatus?.connected && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-base text-emerald-900 dark:text-emerald-200">
                      เชื่อมต่อเรียบร้อยแล้ว ({connectionStatus.count} เพจ)
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      บอทกำลังตอบแชทและปิดการขายให้อัตโนมัติ — ไม่ต้องเชื่อมต่อซ้ำ
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {onGoToInbox && (
                    <button
                      onClick={onGoToInbox}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      💬 ไปที่แชท Inbox
                    </button>
                  )}
                  <button
                    onClick={handleOneClickFacebookAuth}
                    disabled={isConnectingFb}
                    className="flex-1 py-3 bg-white dark:bg-[#141418] hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isConnectingFb ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span>เชื่อมต่อใหม่ / ซิงค์เพจเพิ่ม</span>
                  </button>
                </div>
              </div>
            )}

            {/* NOT CONNECTED: main auto-connect block */}
            {!connectionStatus?.connected && (
            <div className="bg-gradient-to-r from-[#1877F2]/10 to-indigo-500/10 dark:from-[#1877F2]/20 dark:to-indigo-500/20 border border-[#1877F2]/30 dark:border-[#1877F2]/40 rounded-2xl p-6 text-center space-y-4">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-2xl bg-[#1877F2] flex items-center justify-center text-white shadow-lg shadow-[#1877F2]/30">
                  <Facebook className="w-8 h-8 fill-current" />
                </div>
                <div className="text-left">
                  <h3 className="font-black text-lg text-slate-900 dark:text-zinc-100">
                    เชื่อมต่อ Facebook อัตโนมัติ
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    กดปุ่มเดียว เชื่อมต่อทุกอย่างพร้อมใช้งาน
                  </p>
                </div>
              </div>

              <button
                onClick={handleOneClickFacebookAuth}
                disabled={isConnectingFb}
                className="w-full py-4 bg-[#1877F2] hover:bg-[#166fe5] active:scale-95 text-white text-sm font-black rounded-2xl shadow-lg shadow-[#1877F2]/30 flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                {isConnectingFb ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Facebook className="w-5 h-5 fill-current" />
                )}
                <span>{isConnectingFb ? 'กำลังเชื่อมต่อ...' : '🚀 เชื่อมต่อ Facebook ทั้งหมดด้วย 1 คลิก'}</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                <ShieldCheck className="w-3 h-3" />
                <span>ระบบจะดึงเพจทั้งหมด • เชื่อมต่อ Webhook • ตั้งค่า AI อัตโนมัติ</span>
              </div>
            </div>
            )}

            {/* Manual Connection Option */}
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-4">
              <button
                onClick={() => setActiveTab('webhook')}
                className="text-xs text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>ตั้งค่าเชื่อมต่อแบบ Manual (ใส่ Token เอง)</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ADVANCED WEBHOOK SETTINGS & MANUAL CONNECT */}
        {activeTab === 'webhook' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Manual Connection Options */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300">
                <Key className="w-4 h-4" />
                <span>🔧 การเชื่อมต่อแบบ Manual (ใส่ Token เอง)</span>
              </div>
              
              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="วาง Access Token (ขึ้นต้นด้วย EAAB...)"
                  value={directPageToken}
                  onChange={(e) => setDirectPageToken(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a1a20] border border-amber-300 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />

                <button
                  type="button"
                  onClick={() => handleBatchImportPages(directPageToken)}
                  disabled={isConnectingFb || !directPageToken.trim()}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  {isConnectingFb ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  <span>{isConnectingFb ? 'กำลังดึงเพจทั้งหมดจาก Meta...' : '📥 ดึงเพจทั้งหมดด้วย Token'}</span>
                </button>
              </div>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-[#0A0A0C] rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> ข้อมูล Webhook & Subscribed Apps อัตโนมัติ
              </h4>

              {/* Field 1: Webhook Callback URL */}
              <div>
                <label className="text-[11px] text-slate-600 dark:text-zinc-400 block mb-1 font-medium">
                  1. Callback URL (Webhook URL):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-white dark:bg-[#141418] border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-indigo-600 dark:text-indigo-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(webhookUrl, 'url')}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-medium flex items-center gap-1 shrink-0 transition-colors shadow-xs cursor-pointer"
                  >
                    {copiedField === 'url' ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedField === 'url' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>

              {/* Field 2: Verify Token */}
              <div>
                <label className="text-[11px] text-slate-600 dark:text-zinc-400 block mb-1 font-medium">
                  2. Verify Token (รหัสยืนยันความปลอดภัย):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={verifyToken}
                    className="flex-1 bg-white dark:bg-[#141418] border border-slate-300 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-indigo-600 dark:text-indigo-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(verifyToken, 'token')}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-[#141418] dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    {copiedField === 'token' ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedField === 'token' ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                  </button>
                </div>
              </div>

              {/* Field 3: Subscription Fields */}
              <div>
                <label className="text-[11px] text-slate-600 dark:text-zinc-400 block mb-1 font-medium">
                  3. Subscription Fields ที่ผูกอัตโนมัติ:
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-500/30 font-mono">
                    messages (รับ-ส่งข้อความ)
                  </span>
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-500/30 font-mono">
                    messaging_postbacks (ปุ่มกดด่วน)
                  </span>
                  <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/30 font-mono">
                    feed (ดักจับคอมเมนต์ & ดึงเข้า Inbox)
                  </span>
                </div>
              </div>
            </div>

            {/* Diagnostic Test Ping Button */}
            <div className="p-4 bg-slate-50 dark:bg-[#0A0A0C] rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">ทดสอบการตอบสนองของ Webhook (Self-Test)</h5>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">ตรวจสอบว่าระบบพร้อมรับ Request จาก Meta Facebook หรือไม่</p>
              </div>
              <button
                onClick={handleTestWebhookPing}
                disabled={isTesting}
                className="px-4 py-2 bg-white hover:bg-slate-100 dark:bg-[#141418] dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-medium border border-slate-300 dark:border-zinc-700 transition-all flex items-center gap-2 shrink-0 shadow-xs cursor-pointer"
              >
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{isTesting ? 'กำลังทดสอบ...' : 'ทดสอบ Ping Webhook'}</span>
              </button>
            </div>

            {/* Real Comment Scraper + Inbox Poll Buttons */}
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">ดูดคอมเมนต์จริง & ดึงข้อความจริงจากเพจ</h5>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  ระบบจะดึงคอมเมนต์และข้อความจริงจาก Graph API ทุก 60-90 วินาทีอยู่แล้ว กดปุ่มนี้เพื่อดึงทันที
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleScrapeRealComments}
                  disabled={isTesting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>🧲 ดูดคอมเมนต์จริง</span>
                </button>
                <button
                  onClick={handlePollRealInbox}
                  disabled={isTesting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  <span>📥 ดึงข้อความจริง</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status / Message Display */}
        {testResult && (
          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-medium text-slate-800 dark:text-zinc-200 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{testResult}</div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 dark:border-zinc-800 pt-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            เสร็จสิ้น & ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
