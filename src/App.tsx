import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { PagesHubTab } from './components/PagesHubTab';
import { SalesDashboardTab } from './components/SalesDashboardTab';
import { CrmHubTab } from './components/CrmHubTab';
import { DatabaseSheetTab } from './components/DatabaseSheetTab';
import { LiveSimulatorTab } from './components/LiveSimulatorTab';
import { CommentModerationTab } from './components/CommentModerationTab';
import { FollowUpEngineTab } from './components/FollowUpEngineTab';
import { OrdersAndLineTab } from './components/OrdersAndLineTab';
import { SystemDocsTab } from './components/SystemDocsTab';
import { ChatInboxTab } from './components/ChatInboxTab';
import { FacebookConnectModal } from './components/FacebookConnectModal';
import { PageSettingsModal } from './components/PageSettingsModal';
import { AiApiSettingsModal } from './components/AiApiSettingsModal';
import { SelfTestModal } from './components/SelfTestModal';
import { AiAdminCopilot } from './components/AiAdminCopilot';
import { SecurityLockScreen } from './components/SecurityLockScreen';
import { LoginScreen } from './components/LoginScreen';
import {
  ProductAmulet,
  ProductChina,
  ProductOtop,
  ProductAgriculture,
  Order,
  Customer,
  PageConfig,
  ActivityLog
} from './types';
import {
  INITIAL_PAGES,
  INITIAL_AMULET,
  INITIAL_CHINA,
  INITIAL_OTOP,
  INITIAL_AGRICULTURE,
  INITIAL_CUSTOMERS,
  INITIAL_ORDERS
} from './data/initialDatabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('pages_hub');
  const [selectedPageId, setSelectedPageId] = useState<string>('AMULET_PAGE_ID');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isPageSettingsOpen, setIsPageSettingsOpen] = useState(false);
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const [isSelfTestOpen, setIsSelfTestOpen] = useState(false);
  const [settingsPageId, setSettingsPageId] = useState<string>('AMULET_PAGE_ID');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('fb_chatbot_unlocked') !== 'true';
  });

  // Browser cache is only an offline convenience. The server remains the source of truth.
  const loadLocal = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;
    try {
      const item = localStorage.getItem('fb_chatbot_' + key);
      if (!item) return fallback;
      return JSON.parse(item) as T;
    } catch {
      return fallback;
    }
  };

  const saveLocal = (key: string, data: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('fb_chatbot_' + key, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage save error:', e);
    }
  };

  const [pages, setPages] = useState<PageConfig[]>(() => loadLocal('pages', INITIAL_PAGES));
  const [amulet, setAmulet] = useState<ProductAmulet[]>(() => loadLocal('amulet', INITIAL_AMULET));
  const [china, setChina] = useState<ProductChina[]>(() => loadLocal('china', INITIAL_CHINA));
  const [otop, setOtop] = useState<ProductOtop[]>(() => loadLocal('otop', INITIAL_OTOP));
  const [agriculture, setAgriculture] = useState<ProductAgriculture[]>(() => loadLocal('agriculture', INITIAL_AGRICULTURE));
  const [customers, setCustomers] = useState<Customer[]>(() => loadLocal('customers', INITIAL_CUSTOMERS));
  const [orders, setOrders] = useState<Order[]>(() => loadLocal('orders', INITIAL_ORDERS));
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [isFacebookConnected, setIsFacebookConnected] = useState(false);

  // Check Facebook connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/api/facebook/connection-status');
        if (res.ok) {
          const data = await res.json();
          setIsFacebookConnected(data.connected && data.count > 0);
        }
      } catch (err) {
        console.error('Failed to check connection status:', err);
      }
    };
    checkConnection();
    const interval = setInterval(checkConnection, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleImportPages = async (newPages: PageConfig[]) => {
    setPages(newPages);
    saveLocal('pages', newPages);

    if (newPages.length > 0) {
      setSelectedPageId(newPages[0].page_id);
      try {
        await fetch('/api/data/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: 'pages', data: newPages })
        });
      } catch (err) {
        console.warn('Backend offline, saved locally to browser storage');
      }
    }
  };

  // Reset all demo/mock data - clears orders, customers, and product catalogs
  const handleResetDemoData = () => {
    if (!window.confirm('⚠️ คุณต้องการล้างข้อมูลจำลองทั้งหมด (ออเดอร์, ลูกค้า, สินค้าตัวอย่าง) หรือไม่?\n\nข้อมูลเพจจริงและการเชื่อมต่อจะยังอยู่ครบ เพื่อให้คุณเพิ่มสินค้าจริงด้วยตนเอง')) return;
    setOrders([]);
    saveLocal('orders', []);
    setCustomers([]);
    saveLocal('customers', []);
    setAmulet([]);
    saveLocal('amulet', []);
    setChina([]);
    saveLocal('china', []);
    setOtop([]);
    saveLocal('otop', []);
    setAgriculture([]);
    saveLocal('agriculture', []);
    setLogs([]);
    setEmergencyAlerts([]);
    alert('🧹 ล้างข้อมูลจำลองทั้งหมดเรียบร้อย! ระบบสะอาด 100% พร้อมให้คุณเพิ่มสินค้าจริงและรับออเดอร์จริงแล้วครับ');
  };

  // Lock the system
  const handleLockSystem = () => {
    localStorage.removeItem('fb_chatbot_unlocked');
    setIsLocked(true);
  };

  // Listen for Client-Side Facebook OAuth Implicit Callback (#access_token=...)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const userAccessToken = hashParams.get('access_token');
      if (userAccessToken) {
        (async () => {
          try {
            let allAccounts: any[] = [];
            let nextUrl: string | null = `https://graph.facebook.com/v19.0/me/accounts?limit=250&fields=id,name,access_token,category,picture{url},cover{source},followers_count,fan_count&access_token=${encodeURIComponent(userAccessToken)}`;

            while (nextUrl && allAccounts.length < 1000) {
              const res = await fetch(nextUrl);
              const data = await res.json();
              if (data.data && Array.isArray(data.data)) {
                allAccounts = [...allAccounts, ...data.data];
              }
              nextUrl = data.paging?.next || null;
            }

            if (allAccounts.length > 0) {
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
                toxic_keywords: [],
                purchase_keywords: [],
                followup_enabled: false,
                followup_messages: [],
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

              // Clear mock data and import real pages
              handleImportPages(imported);
              setOrders([]);
              saveLocal('orders', []);
              setCustomers([]);
              saveLocal('customers', []);
              alert(`🎉 เชื่อมต่อเพจ Facebook สำเร็จทั้งหมด ${imported.length} เพจ! ข้อมูลจำลองถูกล้างเรียบร้อย`);
            } else {
              alert('⚠️ ไม่พบเพจ Facebook ในบัญชีนี้ หรือยังไม่ได้ให้สิทธิ์จัดการเพจ');
            }
          } catch (e: any) {
            console.error('Failed to import accounts from token:', e);
            alert(`❌ ไม่สามารถดึงรายชื่อเพจได้: ${e.message}`);
          } finally {
            window.history.replaceState(null, '', window.location.pathname);
          }
        })();
      }
    }
  }, []);

  // Sync theme with HTML document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Fetch live state from backend
  // Feature: ระบบจำค่าที่ตั้งไว้ — if the server restarted and lost its data
  // (ephemeral disk on free hosting), restore from the browser's saved copy
  // instead of letting the empty server response wipe everything the user set.
  const hasRestoredFromLocal = React.useRef(false);
  const fetchBackendData = async () => {
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        const serverCollectionsEmpty = ['pages', 'customers', 'orders', 'amulet', 'china', 'otop', 'agriculture'].filter(
          key => !Array.isArray(data[key]) || data[key].length === 0
        );
        // Deploy resilience: after a redeploy the server's data file may be
        // gone. ANY empty collection is restored from the browser's saved copy
        // (self-heal), not just pages — so pages, page settings, products,
        // customers and orders all survive a redeploy.
        if (serverCollectionsEmpty.length > 0 && !hasRestoredFromLocal.current) {
          hasRestoredFromLocal.current = true;
          let restored = 0;
          for (const key of serverCollectionsEmpty) {
            const localData = loadLocal<any[]>(key, []);
            if (localData.length > 0) {
              restored += localData.length;
              try {
                await fetch('/api/data/update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ collection: key, data: localData })
                });
              } catch {
                // Server still offline — keep using local data
              }
            }
          }
          if (restored > 0) {
            console.info(`🛡️ กู้คืนข้อมูลที่ตั้งไว้ทั้งหมด (${restored} รายการ) จากเครื่องนี้กลับสู่เซิร์ฟเวอร์แล้ว`);
            // Pull the merged state back down (server may have re-encrypted tokens etc.)
            try {
              const reRes = await fetch('/api/data');
              const reData = await reRes.json();
              if (reData.pages) { setPages(reData.pages); saveLocal('pages', reData.pages); }
              if (reData.amulet) { setAmulet(reData.amulet); saveLocal('amulet', reData.amulet); }
              if (reData.china) { setChina(reData.china); saveLocal('china', reData.china); }
              if (reData.otop) { setOtop(reData.otop); saveLocal('otop', reData.otop); }
              if (reData.agriculture) { setAgriculture(reData.agriculture); saveLocal('agriculture', reData.agriculture); }
              if (reData.customers) { setCustomers(reData.customers); saveLocal('customers', reData.customers); }
              if (reData.orders) { setOrders(reData.orders); saveLocal('orders', reData.orders); }
              if (reData.logs) setLogs(reData.logs);
              if (reData.emergencyAlerts) setEmergencyAlerts(reData.emergencyAlerts);
            } catch {
              // ignore
            }
            return;
          }
        }
        if (data.pages) { setPages(data.pages); saveLocal('pages', data.pages); }
        if (data.amulet) { setAmulet(data.amulet); saveLocal('amulet', data.amulet); }
        if (data.china) { setChina(data.china); saveLocal('china', data.china); }
        if (data.otop) { setOtop(data.otop); saveLocal('otop', data.otop); }
        if (data.agriculture) { setAgriculture(data.agriculture); saveLocal('agriculture', data.agriculture); }
        if (data.customers) { setCustomers(data.customers); saveLocal('customers', data.customers); }
        if (data.orders) { setOrders(data.orders); saveLocal('orders', data.orders); }
        if (data.logs) setLogs(data.logs);
        if (data.emergencyAlerts) setEmergencyAlerts(data.emergencyAlerts);
      }
    } catch (err) {
      // Offline fallback
    }
  };

  useEffect(() => {
    fetchBackendData();
    const interval = setInterval(fetchBackendData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Enforce AI setup: if no Gemini API key is configured on the server,
  // automatically open the settings modal on startup so it cannot be
  // forgotten — chat auto-reply is completely silent without the key.
  useEffect(() => {
    fetch('/api/settings')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        if (!data.geminiApiKeyConfigured) setIsAiSettingsOpen(true);
      })
      .catch(() => {
        // Server unreachable — do not force the modal
      });
  }, []);

  const handleSaveToBackend = async (collection: string, data: any[]) => {
    saveLocal(collection, data);
    try {
      await fetch('/api/data/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, data })
      });
      fetchBackendData();
    } catch (err) {
      // Offline fallback (saved locally)
    }
  };

  const handleSavePageConfig = (originalId: string, updatedPage: PageConfig) => {
    const updatedPages = pages.map(p => (p.page_id === originalId ? updatedPage : p));
    setPages(updatedPages);
    handleSaveToBackend('pages', updatedPages);

    if (selectedPageId === originalId) {
      setSelectedPageId(updatedPage.page_id);
    }

    // Bidirectional sync: also update or insert into the respective category table to ensure database products are linked to pages
    if (updatedPage.product) {
      const prod = updatedPage.product;
      const cat = updatedPage.category;

      // Honest promotion summary built ONLY from real values (Feature 8):
      // gifts are mentioned only when named, "ส่งฟรี" only when checked.
      const promotionPerkSummary = (prod.promotions || [])
        .map((pr: any) => {
          const perks: string[] = [];
          if (pr.free_gifts && String(pr.free_gifts).trim()) {
            perks.push(`แถม ${String(pr.free_gifts).trim()}${pr.gift_quantity ? ` ${pr.gift_quantity} ชิ้น` : ''}`);
          }
          if (pr.free_shipping === true) perks.push('ส่งฟรี');
          return perks.length ? `${pr.name || `${pr.quantity || 1} ชิ้น`}: ${perks.join(' + ')}` : '';
        })
        .filter(Boolean)
        .join(' | ');

      if (cat === 'CHINA') {
        const existingIdx = china.findIndex(c => c.page_id === updatedPage.page_id || c.product_id === prod.product_id);
        const item: ProductChina = {
          product_id: prod.product_id || `CHN-${Math.floor(100 + Math.random() * 900)}`,
          page_id: updatedPage.page_id,
          product_name: prod.product_name,
          brand: prod.specs?.brand || (prod.specs as any)?.brand || '',
          category: prod.category || 'CHINA',
          description: prod.description || '',
          features: prod.specs?.features || (prod.specs as any)?.features || prod.description || '',
          material: prod.specs?.material || '',
          size: prod.specs?.size || prod.specs?.dimensions || '',
          weight: prod.specs?.weight || '',
          usage: prod.specs?.usage || (prod.specs as any)?.usage || '',
          benefit: prod.specs?.benefit || (prod.specs as any)?.benefit || '',
          shipping_info: prod.specs?.shipping_info || prod.shipping_duration || '',
          display_price: prod.display_price || prod.base_price || 990,
          price_1: prod.promotions?.[0]?.price || prod.display_price || 990,
          price_2: prod.promotions?.[1]?.price ?? 0,
          price_3: prod.promotions?.[2]?.price ?? 0,
          promotion_detail: promotionPerkSummary || prod.promotions?.[1]?.description || '',
          shipping_duration: prod.shipping_duration,
          image_main: prod.images?.main || '',
          image_detail: prod.images?.detail || '',
          image_promotion: prod.images?.promotion || '',
          image_review: prod.images?.review || '',
          image_closing: prod.images?.closing || '',
          opening_text: updatedPage.sequence?.step1_opening_text || '',
          detail_text: prod.description || '',
          promotion_text: updatedPage.sequence?.step3_promotion_detail || '',
          review_text: (existingIdx >= 0 ? china[existingIdx]?.review_text : '') || '',
          closing_text: updatedPage.sequence?.step6_closing_text || '',
          // Preserve every raw field (for example brand) entered in the product editor.
          ...(prod.specs || {}),
          custom_specs: prod.specs?.custom_specs,
          // Round-trip the real promotion tiers (names, prices, free shipping, gift qty)
          ...(prod.promotions?.length ? { promotions: prod.promotions } : {})
        };
        let newChina: ProductChina[];
        if (existingIdx >= 0) {
          newChina = [...china];
          newChina[existingIdx] = { ...newChina[existingIdx], ...item };
        } else {
          newChina = [item, ...china];
        }
        setChina(newChina);
        handleSaveToBackend('china', newChina);
      } else if (cat === 'AMULET') {
        const existingIdx = amulet.findIndex(a => a.page_id === updatedPage.page_id || a.product_id === prod.product_id);
        const item: ProductAmulet = {
          product_id: prod.product_id || `AML-${Math.floor(100 + Math.random() * 900)}`,
          page_id: updatedPage.page_id,
          product_name: prod.product_name,
          category: prod.category || 'AMULET',
          temple: prod.specs?.temple || prod.specs?.origin_or_temple || '',
          master: prod.specs?.master || prod.specs?.master_or_maker || '',
          year: prod.specs?.year || prod.specs?.ceremony_or_batch || '',
          edition: prod.specs?.edition || prod.specs?.ceremony_or_batch || '',
          material: prod.specs?.material || '',
          quantity: Number(prod.specs?.quantity) || 0,
          history: prod.specs?.history || (prod.specs as any)?.history || '',
          belief_info: prod.specs?.belief_info || (prod.specs as any)?.belief_info || '',
          spell: prod.specs?.spell || prod.specs?.spell_or_instructions || '',
          worship_method: prod.specs?.worship_method || (prod.specs as any)?.worship_method || '',
          care_instruction: prod.specs?.care_instruction || (prod.specs as any)?.care_instruction || '',
          warning: prod.specs?.warning || (prod.specs as any)?.warning || '',
          display_price: prod.display_price || prod.base_price || 990,
          price_1: prod.promotions?.[0]?.price || prod.display_price || 990,
          price_2: prod.promotions?.[1]?.price ?? 0,
          price_3: prod.promotions?.[2]?.price ?? 0,
          promotion_detail: promotionPerkSummary || prod.promotions?.[1]?.description || '',
          shipping_duration: prod.shipping_duration,
          image_main: prod.images?.main || '',
          image_detail: prod.images?.detail || '',
          image_promotion: prod.images?.promotion || '',
          image_review: prod.images?.review || '',
          image_closing: prod.images?.closing || '',
          opening_text: updatedPage.sequence?.step1_opening_text || '',
          detail_text: prod.description || '',
          promotion_text: updatedPage.sequence?.step3_promotion_detail || '',
          review_text: (existingIdx >= 0 ? amulet[existingIdx]?.review_text : '') || '',
          closing_text: updatedPage.sequence?.step6_closing_text || '',
          ...(prod.specs || {}),
          custom_specs: prod.specs?.custom_specs,
          // Round-trip the real promotion tiers (names, prices, free shipping, gift qty)
          ...(prod.promotions?.length ? { promotions: prod.promotions } : {})
        };
        let newAmulet: ProductAmulet[];
        if (existingIdx >= 0) {
          newAmulet = [...amulet];
          newAmulet[existingIdx] = { ...newAmulet[existingIdx], ...item };
        } else {
          newAmulet = [item, ...amulet];
        }
        setAmulet(newAmulet);
        handleSaveToBackend('amulet', newAmulet);
      } else if (cat === 'OTOP') {
        const existingIdx = otop.findIndex(o => o.page_id === updatedPage.page_id || o.product_id === prod.product_id);
        const item: ProductOtop = {
          product_id: prod.product_id || `OTP-${Math.floor(100 + Math.random() * 900)}`,
          page_id: updatedPage.page_id,
          product_name: prod.product_name,
          category: prod.category || 'OTOP',
          community: prod.specs?.community || (prod.specs as any)?.community || '',
          province: prod.specs?.province || (prod.specs as any)?.province || '',
          maker: prod.specs?.maker || prod.specs?.master_or_maker || '',
          origin: prod.specs?.origin || prod.specs?.origin_or_temple || '',
          story: prod.specs?.story || (prod.specs as any)?.story || '',
          production_method: prod.specs?.production_method || (prod.specs as any)?.production_method || '',
          material: prod.specs?.material || '',
          size: prod.specs?.size || prod.specs?.dimensions || '',
          weight: prod.specs?.weight || '',
          usage: prod.specs?.usage || (prod.specs as any)?.usage || '',
          benefit: prod.specs?.benefit || (prod.specs as any)?.benefit || '',
          care_instruction: prod.specs?.care_instruction || (prod.specs as any)?.care_instruction || '',
          warning: prod.specs?.warning || (prod.specs as any)?.warning || '',
          display_price: prod.display_price || prod.base_price || 990,
          price_1: prod.promotions?.[0]?.price || prod.display_price || 990,
          price_2: prod.promotions?.[1]?.price ?? 0,
          price_3: prod.promotions?.[2]?.price ?? 0,
          promotion_detail: promotionPerkSummary || prod.promotions?.[1]?.description || '',
          shipping_duration: prod.shipping_duration,
          image_main: prod.images?.main || '',
          image_detail: prod.images?.detail || '',
          image_promotion: prod.images?.promotion || '',
          image_review: prod.images?.review || '',
          image_closing: prod.images?.closing || '',
          opening_text: updatedPage.sequence?.step1_opening_text || '',
          detail_text: prod.description || '',
          promotion_text: updatedPage.sequence?.step3_promotion_detail || '',
          review_text: (existingIdx >= 0 ? otop[existingIdx]?.review_text : '') || '',
          closing_text: updatedPage.sequence?.step6_closing_text || '',
          ...(prod.specs || {}),
          custom_specs: prod.specs?.custom_specs,
          // Round-trip the real promotion tiers (names, prices, free shipping, gift qty)
          ...(prod.promotions?.length ? { promotions: prod.promotions } : {})
        };
        let newOtop: ProductOtop[];
        if (existingIdx >= 0) {
          newOtop = [...otop];
          newOtop[existingIdx] = { ...newOtop[existingIdx], ...item };
        } else {
          newOtop = [item, ...otop];
        }
        setOtop(newOtop);
        handleSaveToBackend('otop', newOtop);
      } else if (cat === 'AGRICULTURE') {
        const existingIdx = (agriculture || []).findIndex(a => a.page_id === updatedPage.page_id || a.product_id === prod.product_id);
        const item: ProductAgriculture = {
          product_id: prod.product_id || `AGR-${Math.floor(100 + Math.random() * 900)}`,
          page_id: updatedPage.page_id,
          product_name: prod.product_name,
          category: prod.category || 'AGRICULTURE',
          subcategory: prod.specs?.subcategory || '',
          variety: prod.specs?.variety || '',
          germination_rate: prod.specs?.germination_rate || '',
          planting_season: prod.specs?.planting_season || '',
          germination_days: prod.specs?.germination_days || '',
          planting_method: prod.specs?.planting_method || '',
          plant_spacing: prod.specs?.plant_spacing || '',
          soil_type: prod.specs?.soil_type || '',
          sunlight_requirement: prod.specs?.sunlight_requirement || '',
          suitable_temperature: prod.specs?.suitable_temperature || '',
          watering_method: prod.specs?.watering_method || '',
          usage_instructions: prod.specs?.usage_instructions || prod.specs?.spell_or_instructions || '',
          benefits: prod.specs?.benefits || (prod.specs as any)?.benefits || '',
          harvest_time: prod.specs?.harvest_time || '',
          expected_yield: prod.specs?.expected_yield || '',
          storage_method: prod.specs?.storage_method || '',
          seed_quantity: prod.specs?.seed_quantity || '',
          brand: prod.specs?.brand || (prod.specs as any)?.brand || '',
          formula_or_type: prod.specs?.formula_or_type || (prod.specs as any)?.formula_or_type || '',
          suitable_for: prod.specs?.suitable_for || (prod.specs as any)?.suitable_for || '',
          registration_number: prod.specs?.registration_number || (prod.specs as any)?.registration_number || '',
          package_size: prod.specs?.package_size || prod.specs?.dimensions || '',
          safety_warning: prod.specs?.safety_warning || (prod.specs as any)?.safety_warning || '',
          display_price: prod.display_price || prod.base_price || 990,
          price_1: prod.promotions?.[0]?.price || prod.display_price || 990,
          price_2: prod.promotions?.[1]?.price ?? 0,
          price_3: prod.promotions?.[2]?.price ?? 0,
          promotion_detail: promotionPerkSummary || prod.promotions?.[1]?.description || '',
          shipping_duration: prod.shipping_duration,
          image_main: prod.images?.main || '',
          image_detail: prod.images?.detail || '',
          image_promotion: prod.images?.promotion || '',
          image_review: prod.images?.review || '',
          image_closing: prod.images?.closing || '',
          opening_text: updatedPage.sequence?.step1_opening_text || '',
          detail_text: prod.description || '',
          promotion_text: updatedPage.sequence?.step3_promotion_detail || '',
          review_text: (existingIdx >= 0 ? (agriculture || [])[existingIdx]?.review_text : '') || '',
          closing_text: updatedPage.sequence?.step6_closing_text || '',
          ...(prod.specs || {}),
          custom_specs: prod.specs?.custom_specs,
          // Round-trip the real promotion tiers (names, prices, free shipping, gift qty)
          ...(prod.promotions?.length ? { promotions: prod.promotions } : {})
        };
        let newAgri: ProductAgriculture[];
        if (existingIdx >= 0) {
          newAgri = [...agriculture];
          newAgri[existingIdx] = { ...newAgri[existingIdx], ...item };
        } else {
          newAgri = [item, ...(agriculture || [])];
        }
        setAgriculture(newAgri);
        handleSaveToBackend('agriculture', newAgri);
      }
    }
  };

  const handleTogglePageStatus = async (pageId: string, isActive: boolean) => {
    // Optimistic update, then the lightweight dedicated endpoint (1 page, 1 field)
    setPages(prev => prev.map(p => (p.page_id === pageId ? { ...p, is_active: isActive } : p)));
    try {
      const res = await fetch('/api/pages/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId, field: 'is_active', value: isActive })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
    } catch {
      // Fallback to the full-collection save so the toggle never silently fails
      const updatedPages = pages.map(p => (p.page_id === pageId ? { ...p, is_active: isActive } : p));
      setPages(updatedPages);
      handleSaveToBackend('pages', updatedPages);
    }
  };

  const handleBulkToggle = (enable: boolean) => {
    const updatedPages = pages.map(p => ({ ...p, is_active: enable }));
    setPages(updatedPages);
    handleSaveToBackend('pages', updatedPages);
  };

  const handleUpdatePageTag = (pageId: string, tag: 'NORMAL' | 'EMPTY' | 'RETIRED') => {
    const updatedPages = pages.map(p => (p.page_id === pageId ? { ...p, page_tag: tag } : p));
    setPages(updatedPages);
    handleSaveToBackend('pages', updatedPages);
  };

  const handleAddNewPage = (newPage: PageConfig) => {
    const updatedPages = [newPage, ...pages];
    setPages(updatedPages);
    setSelectedPageId(newPage.page_id);
    handleSaveToBackend('pages', updatedPages);
  };

  const handleOpenPageSettings = (pageId: string) => {
    markPageUsage(pageId);
    setSettingsPageId(pageId);
    setIsPageSettingsOpen(true);
  };

  const handleSelectPageAndChat = (pageId: string) => {
    markPageUsage(pageId);
    setSelectedPageId(pageId);
    setActiveTab('simulator');
  };

  // Record when a page was last used (for "เรียงตามใช้งานล่าสุด" sorting in Pages Hub)
  const markPageUsage = (pageId: string) => {
    if (typeof window === 'undefined') return;
    try {
      const usage = JSON.parse(localStorage.getItem('fb_chatbot_page_usage') || '{}');
      usage[pageId] = Date.now();
      localStorage.setItem('fb_chatbot_page_usage', JSON.stringify(usage));
    } catch {
      // ignore
    }
  };

  const handleSimulateWebhook = async (type: string, message: string) => {
    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: type,
          sender_id: `PSID_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          page_id: selectedPageId,
          message_text: message
        })
      });
      fetchBackendData();
    } catch (err) {
      console.error('Simulation trigger failed:', err);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Bug fix: the 3-second backend poll replaces `pages` wholesale. If the open
  // page is momentarily missing (cold start, partial sync), the modal's `page`
  // prop becomes undefined and PageSettingsModal unmounts ("เด้งออก").
  // Keep the last-known page for the same page_id so the modal stays stable.
  const lastModalPageRef = React.useRef<PageConfig | null>(null);
  const resolvedModalPage = pages.find(p => p.page_id === settingsPageId);
  if (resolvedModalPage) lastModalPageRef.current = resolvedModalPage;
  const currentPageForModal =
    resolvedModalPage ||
    (lastModalPageRef.current?.page_id === settingsPageId ? lastModalPageRef.current : null) ||
    pages[0];

  // If system is locked - show login screen
  if (isLocked) {
    return (
      <LoginScreen
        onLoginSuccess={(sessionData) => {
          setIsLocked(false);
          localStorage.setItem('fb_chatbot_unlocked', 'true');
        }}
        theme={theme}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 overflow-x-hidden max-w-full ${
        theme === 'dark'
          ? 'bg-[#09090B] bg-grid-pattern text-zinc-100 selection:bg-indigo-600 selection:text-white'
          : 'bg-slate-50 text-zinc-900 selection:bg-indigo-500 selection:text-white'
      }`}
    >
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pages={pages}
        selectedPageId={selectedPageId}
        setSelectedPageId={setSelectedPageId}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenPageSettings={handleOpenPageSettings}
        onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          onOpenSelfTest={() => setIsSelfTestOpen(true)}
        totalOrders={orders.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLockSystem={handleLockSystem}
        onResetDemoData={handleResetDemoData}
        isFacebookConnected={isFacebookConnected}
        connectedPageCount={pages.filter(p => {
          const token = p.page_access_token || '';
          return token.startsWith('EAA') || token.startsWith('enc:') || (token.length > 10 && !token.includes('••'));
        }).length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'pages_hub' && (
          <PagesHubTab
            pages={pages}
            orders={orders}
            customers={customers}
            onOpenPageSettings={handleOpenPageSettings}
            onSelectPageAndChat={handleSelectPageAndChat}
            onTogglePageStatus={handleTogglePageStatus}
            onBulkToggle={handleBulkToggle}
            onOpenConnectModal={() => setIsConnectModalOpen(true)}
            onAddNewPage={handleAddNewPage}
            onUpdatePageTag={handleUpdatePageTag}
          />
        )}

        {activeTab === 'chat_inbox' && (
          <ChatInboxTab
            pages={pages}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            theme={theme}
          />
        )}

        {activeTab === 'crm' && (
          <CrmHubTab
            customers={customers}
            setCustomers={setCustomers}
            orders={orders}
            setOrders={setOrders}
            pages={pages}
            onSaveToBackend={handleSaveToBackend}
          />
        )}

        {activeTab === 'dashboard' && (
          <SalesDashboardTab
            orders={orders}
            pages={pages}
            customers={customers}
            onOpenPageSettings={handleOpenPageSettings}
            onSelectPageAndChat={handleSelectPageAndChat}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseSheetTab
            amulet={amulet}
            setAmulet={setAmulet}
            china={china}
            setChina={setChina}
            otop={otop}
            setOtop={setOtop}
            agriculture={agriculture}
            setAgriculture={setAgriculture}
            orders={orders}
            setOrders={setOrders}
            customers={customers}
            setCustomers={setCustomers}
            pages={pages}
            setPages={setPages}
            onSaveToBackend={handleSaveToBackend}
          />
        )}

        {/* Live Simulator Tab - Hidden when Facebook is connected (use real chat instead) */}
        {activeTab === 'simulator' && !isFacebookConnected && (
          <LiveSimulatorTab
            pages={pages}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            customers={customers}
            allProducts={{
              amulet,
              china,
              otop,
              agriculture
            }}
            onOrderCreated={newOrder => {
              const updated = [newOrder, ...orders];
              setOrders(updated);
              handleSaveToBackend('orders', updated);
            }}
            theme={theme}
          />
        )}
        
        {/* Alert when simulator is accessed but Facebook is connected */}
        {activeTab === 'simulator' && isFacebookConnected && (
          <div className={`rounded-xl border p-8 text-center ${
            theme === 'dark' ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200'
          }`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-zinc-100' : 'text-slate-900'}`}>
              จำลองแชทปิดการใช้งาน
            </h3>
            <p className={`text-sm max-w-md mx-auto ${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
              ระบบจำลองแชทถูกปิดใช้งานเพราะคุณเชื่อมต่อ Facebook Page แล้ว
              บอทจะตอบข้อความจริงจากลูกค้าอัตโนมัติ คุณสามารถดูและตอบแชทได้ที่แท็บ "แชท Inbox 💬"
            </p>
            <button
              onClick={() => setActiveTab('chat_inbox')}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              ไปที่แชท Inbox 💬
            </button>
          </div>
        )}

        {activeTab === 'comments' && (
          <CommentModerationTab
            pages={pages}
            selectedPageId={selectedPageId}
          />
        )}

        {activeTab === 'followup' && (
          <FollowUpEngineTab
            customers={customers}
            onRefreshData={fetchBackendData}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersAndLineTab
            orders={orders}
            setOrders={setOrders}
            pages={pages}
            onSaveOrders={updated => handleSaveToBackend('orders', updated)}
          />
        )}

        {activeTab === 'system_docs' && (
          <SystemDocsTab
            pages={pages}
            selectedPageId={selectedPageId}
            theme={theme}
          />
        )}

        {activeTab === 'webhook' && (
          <div className="bg-[#0F0F12] border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
            <FacebookConnectModal
              isOpen={true}
              onClose={() => setActiveTab('pages_hub')}
              pages={pages}
              selectedPageId={selectedPageId}
              onImportPages={handleImportPages}
              onGoToInbox={() => { setActiveTab('chat_inbox'); }}
            />
          </div>
        )}
      </main>

      {/* Persistent Facebook Setup Modal */}
      <FacebookConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        pages={pages}
        selectedPageId={selectedPageId}
        onImportPages={handleImportPages}
        onGoToInbox={() => { setIsConnectModalOpen(false); setActiveTab('chat_inbox'); }}
      />

      {/* Global AI API Settings Modal */}
      <AiApiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        theme={theme}
      />

      {/* Self-Test Modal (ปุ่ม 🧪 Test) */}
      <SelfTestModal
        isOpen={isSelfTestOpen}
        onClose={() => setIsSelfTestOpen(false)}
        theme={theme}
      />

      {/* Dedicated Per-Page Settings Modal ("ปุ่มตั้งค่าเพจ") */}
      <PageSettingsModal
        isOpen={isPageSettingsOpen}
        onClose={() => setIsPageSettingsOpen(false)}
        page={currentPageForModal}
        onSavePage={handleSavePageConfig}
      />

      {/* Floating Collapsible AI Admin Copilot with Voice Input */}
      <AiAdminCopilot
        orders={orders}
        customers={customers}
        pages={pages}
        emergencyAlerts={emergencyAlerts}
        theme={theme}
      />

      {/* Floating Modern Version Badge at top-right corner */}
      <div 
        id="app-version-badge"
        className="fixed top-[4.5rem] right-4 z-50 flex items-center gap-1.5 px-2.5 py-1 bg-white/90 dark:bg-[#121216]/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-full shadow-xs select-none transition-all duration-300 hover:scale-105 hover:shadow-md group"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold tracking-wider font-mono text-slate-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          v2.8-PROD
        </span>
      </div>
    </div>
  );
}
