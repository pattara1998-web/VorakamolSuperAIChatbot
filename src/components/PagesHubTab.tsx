import React, { useState } from 'react';
import {
  Facebook,
  Search,
  Plus,
  Settings,
  MessageSquare,
  Power,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Users,
  LayoutGrid,
  List,
  Filter,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Zap,
  MoreVertical,
  Layers,
  ArrowUpRight,
  Bot,
  Tag
} from 'lucide-react';
import { PageConfig, Order, Customer, ProductCategory } from '../types';

// แท็กหมวดหมู่ของเพจ (Feature: แท็กเพจว่าง / เพจไม่ได้ใช้แล้ว)
const PAGE_TAG_META: Record<'NORMAL' | 'EMPTY' | 'RETIRED', { label: string; emoji: string; classes: string }> = {
  NORMAL: { label: 'ใช้งานปกติ', emoji: '🏷️', classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' },
  EMPTY: { label: 'เพจว่าง', emoji: '📭', classes: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60' },
  RETIRED: { label: 'ไม่ได้ใช้แล้ว', emoji: '🗄️', classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60' }
};

const NEXT_PAGE_TAG: Record<'NORMAL' | 'EMPTY' | 'RETIRED', 'NORMAL' | 'EMPTY' | 'RETIRED'> = {
  NORMAL: 'EMPTY',
  EMPTY: 'RETIRED',
  RETIRED: 'NORMAL'
};

interface PagesHubTabProps {
  pages: PageConfig[];
  orders: Order[];
  customers: Customer[];
  onOpenPageSettings: (pageId: string) => void;
  onSelectPageAndChat: (pageId: string) => void;
  onTogglePageStatus: (pageId: string, isActive: boolean) => void;
  onBulkToggle: (enable: boolean) => void;
  onOpenConnectModal: () => void;
  onAddNewPage: (newPage: PageConfig) => void;
  onUpdatePageTag: (pageId: string, tag: 'NORMAL' | 'EMPTY' | 'RETIRED') => void;
}

export const PagesHubTab: React.FC<PagesHubTabProps> = ({
  pages,
  orders,
  customers,
  onOpenPageSettings,
  onSelectPageAndChat,
  onTogglePageStatus,
  onBulkToggle,
  onOpenConnectModal,
  onAddNewPage,
  onUpdatePageTag
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [selectedTag, setSelectedTag] = useState<'ALL' | 'NORMAL' | 'EMPTY' | 'RETIRED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Page form state
  const [newPageName, setNewPageName] = useState('');
  const [newPageCategory, setNewPageCategory] = useState<ProductCategory>('AMULET');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newAdminName, setNewAdminName] = useState('น้ำหวาน');

  const copyPageId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Calculate metrics per page
  const pageStats = pages.map(p => {
    const pageOrders = orders.filter(o => {
      if (o.page_id) return o.page_id === p.page_id;
      if (p.category === 'AMULET' && (o.items?.includes('AML') || o.items?.includes('หลวงปู่ทวด'))) return true;
      if (p.category === 'CHINA' && (o.items?.includes('CHN') || o.items?.includes('ฟอกอากาศ'))) return true;
      if (p.category === 'OTOP' && (o.items?.includes('OTP') || o.items?.includes('ผ้าไหม'))) return true;
      if (p.category === 'AGRICULTURE' && (o.items?.includes('AGR') || o.items?.includes('ปุ๋ย') || o.items?.includes('เกษตร'))) return true;
      return false;
    });

    const revenue = pageOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const orderCount = pageOrders.length;
    const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : (p.product?.display_price || 0);
    const inquiries = p.inquiries_count !== undefined ? p.inquiries_count : orderCount;
    const conversion = inquiries > 0 ? Math.min(100, Math.round((orderCount / inquiries) * 100)) : (orderCount > 0 ? 100 : 0);

    return {
      page: p,
      revenue,
      orderCount,
      inquiries,
      conversion,
      avgTicket,
      topProduct: p.product?.product_name || p.page_name,
      hasProductData: Boolean(p.product?.product_name && (p.product?.display_price > 0 || p.product?.description)),
      adminName: p.admin_name || 'น้ำหวาน',
      model: p.ai_model || 'gemini-3.6-flash',
      // รูปโปรไฟล์จริงจาก Facebook ผ่าน server proxy — ใช้กับทุกเพจที่มี token
      // (เพจ FB รุ่นใหม่ ID เป็นตัวอักษรด้วย) onError จะ fallback ให้เอง
      avatar: (p.page_access_token || '').startsWith('EAA')
        ? `/api/pages/${p.page_id}/avatar`
        : (p.page_avatar || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80'),
      cover: p.page_cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
      followers: p.follower_count || 0,
      likes: p.likes_count || 0
    };
  });

  // Filter pages
  // เพจที่เปิดใช้งานอยู่ขึ้นบนก่อน — เพจที่ปิดใช้งานเรียงไปด้านล่างสุด
  const sortedPageStats = [...pageStats].sort((a, b) =>
    (a.page.is_active === b.page.is_active) ? 0 : (a.page.is_active ? -1 : 1)
  );
  const disabledPageCount = pages.filter(p => !p.is_active).length;

  const filteredPages = sortedPageStats.filter(item => {
    const p = item.page;
    const matchesSearch =
      p.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.page_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.product?.product_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.admin_name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'ACTIVE' && p.is_active) ||
      (selectedStatus === 'PAUSED' && !p.is_active);
    const pageTag = p.page_tag || 'NORMAL';
    const matchesTag = selectedTag === 'ALL' || pageTag === selectedTag;

    return matchesSearch && matchesCategory && matchesStatus && matchesTag;
  });

  const totalActivePages = pages.filter(p => p.is_active).length;
  const totalRevenueAll = pageStats.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrdersAll = pageStats.reduce((sum, p) => sum + p.orderCount, 0);
  const totalInquiriesAll = pageStats.reduce((sum, p) => sum + p.inquiries, 0);

  const handleCreateNewPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageName.trim()) return;

    const generatedId = `PAGE_${Date.now().toString().slice(-6)}`;
    const newPage: PageConfig = {
      page_id: generatedId,
      page_name: newPageName,
      category: newPageCategory,
      page_avatar:
        newPageCategory === 'AMULET'
          ? 'https://images.unsplash.com/photo-1609743522653-52354461eb27?auto=format&fit=crop&w=200&h=200&q=80'
          : newPageCategory === 'CHINA'
          ? 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=200&h=200&q=80'
          : 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=200&h=200&q=80',
      page_cover: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
      follower_count: 12000,
      likes_count: 10500,
      inquiries_count: 15,
      page_access_token: `EAAQ_${generatedId}_TOKEN`,
      verify_token: 'FB_AI_SALES_TOKEN_2026',
      is_active: true,
      auto_reply: true,
      auto_close_ai: true,
      ai_model: 'gemini-3.6-flash',
      admin_name: newAdminName || 'น้ำหวาน',
      ai_tone: newPageCategory === 'AMULET' ? 'SACRED' : newPageCategory === 'CHINA' ? 'FAST_CLOSING' : 'FRIENDLY',
      ai_custom_instructions: 'ตอบลูกค้าด้วยความสุภาพ แนะนำโปรโมชั่นและเก็บเงินปลายทางทันที',
      ai_brevity_mode: true,
      product: {
        product_id: `PROD-${Date.now().toString().slice(-4)}`,
        product_name: newProductName || `${newPageName} - รุ่นพิเศษ`,
        category: newPageCategory,
        base_price: Number(newProductPrice) || 0,
        display_price: Number(newProductPrice) || 0,
        shipping_duration: 'จัดส่ง 1-2 วันถึงหน้าบ้าน',
        description: `สินค้าพรีเมียมประจำเพจ ${newPageName}`,
        promotions: [
          {
            id: `promo-1-${Date.now()}`,
            name: 'โปรโมชั่น 1 ชิ้น (ชุดมาตรฐาน)',
            quantity: 1,
            price: Number(newProductPrice) || 0,
            original_price: (Number(newProductPrice) || 0) + 500,
            description: 'จัดส่งฟรี มีเก็บเงินปลายทาง',
            is_popular: false
          },
          {
            id: `promo-2-${Date.now()}`,
            name: 'โปรโมชั่นพิเศษ 2 ชิ้น (เซ็ตสุดคุ้ม)',
            quantity: 2,
            price: Math.round((Number(newProductPrice) || 0) * 1.8),
            original_price: (Number(newProductPrice) || 0) * 2 + 800,
            description: 'ประหยัดสุดคุ้ม จัดส่งฟรี',
            is_popular: true
          }
        ],
        images: {
          main: 'https://images.unsplash.com/photo-1609743522653-52354461eb27?auto=format&fit=crop&w=800&q=80',
          detail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
          promotion: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
          review: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
          closing: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=800&q=80'
        }
      },
      sequence: {
        step1_opening_text: `สวัสดีค่ะ ยินดีต้อนรับสู่ ${newPageName} แอดมินยินดีดูแลค่ะ 🙏`,
        step2_product_image: 'https://images.unsplash.com/photo-1609743522653-52354461eb27?auto=format&fit=crop&w=800&q=80',
        step3_promotion_detail: `🔥 โปรโมชั่นพิเศษวันนี้ 1 ชิ้นเพียง ${newProductPrice}.- จัดส่งฟรีเก็บเงินปลายทางค่ะ`,
        step4_promotion_image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80',
        step5_review_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80',
        step6_closing_text: '📦 แจ้งชื่อ-ที่อยู่ และเบอร์โทรศัพท์ เพื่อรับโปรส่งฟรีได้เลยนะคะ'
      },
      scrape_comments_enabled: true,
      auto_inbox_with_comment_context: true,
      hide_toxic_comments: true,
      toxic_keywords: ['โกง', 'หลอก', 'แย่', 'ปลอม'],
      purchase_keywords: ['สนใจ', 'ราคา', 'สั่ง', 'กี่บาท'],
      comment_reply_template: 'ขอบพระคุณที่สนใจค่ะคุณ @customer_name แอดมินทัก Inbox ส่งรูปและโปรโมชั่นพิเศษให้แล้วนะคะ 🙏✨',
      comment_auto_tag_customer: true,
      followup_enabled: true,
      followup_messages: [
        { interval: '5 นาที', message: 'คุณพี่สนใจรับสิทธิ์โปรโมชั่นรอบส่งวันนี้ไหมคะ จัดส่งฟรีค่ะ 📦' },
        { interval: '30 นาที', message: 'รอบส่งเช้าวันพรุ่งนี้พร้อมจัดส่งนะคะ แจ้งชื่อที่อยู่ไว้ได้เลยค่ะ 🙏' }
      ]
    };

    onAddNewPage(newPage);
    setIsAddModalOpen(false);
    setNewPageName('');
    setNewProductName('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Hub Header */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Title & Info */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                <Facebook className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  ศูนย์จัดการเพจ Facebook (Pages Window Hub)
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    {pages.length} เพจที่เชื่อมต่อ
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  หน้าต่างควบคุมเพจ รองรับการจัดการเพจแบบ 1 เพจ = 1 สินค้า พร้อมระบบ AI ปิดการขายอัตโนมัติ
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">AI กำลังทำงาน</span>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {totalActivePages} / {pages.length} เพจ
                </span>
              </div>
            </div>

            <div className={`border rounded-xl px-4 py-2.5 flex items-center gap-3 ${disabledPageCount > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60' : 'bg-slate-50 dark:bg-[#141418] border-slate-200 dark:border-zinc-800'}`}>
              <Power className={`w-4 h-4 ${disabledPageCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">เพจที่ปิดการใช้งาน</span>
                <span className={`text-sm font-black font-mono ${disabledPageCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                  {disabledPageCount} หน้า
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">ลูกค้าทักเข้ารวม</span>
                <span className="text-sm font-black font-mono text-indigo-700 dark:text-indigo-300">
                  {totalInquiriesAll} คน
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">ออเดอร์ปิดยอด</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-zinc-100">
                  {totalOrdersAll} ออเดอร์
                </span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">ยอดขายรวมทุกเพจ</span>
                <span className="text-sm font-black font-mono text-slate-900 dark:text-zinc-100">
                  ฿{totalRevenueAll.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-pages-hub"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อเพจ, รหัสเพจ, สินค้า หรือชื่อแอดมิน..."
                className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedCategory === 'ALL' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setSelectedCategory('AMULET')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedCategory === 'AMULET' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                📿 พระเครื่อง
              </button>
              <button
                onClick={() => setSelectedCategory('CHINA')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedCategory === 'CHINA' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                📦 สินค้านำเข้า
              </button>
              <button
                onClick={() => setSelectedCategory('OTOP')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedCategory === 'OTOP' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                🌾 โอทอป OTOP
              </button>
              <button
                onClick={() => setSelectedCategory('AGRICULTURE')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedCategory === 'AGRICULTURE' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                }`}
              >
                🌱 การเกษตร
              </button>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value as any)}
              className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="ACTIVE">🟢 เปิดใช้งาน AI</option>
              <option value="PAUSED">⚪ พักชั่วคราว</option>
            </select>

            {/* Page Tag Filter (แท็กเพจ) */}
            <select
              value={selectedTag}
              onChange={e => setSelectedTag(e.target.value as any)}
              className="bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
              title="กรองตามแท็กของเพจ"
            >
              <option value="ALL">แท็กทั้งหมด</option>
              <option value="NORMAL">🏷️ ใช้งานปกติ</option>
              <option value="EMPTY">📭 เพจว่าง</option>
              <option value="RETIRED">🗄️ เพจไม่ได้ใช้แล้ว</option>
            </select>
          </div>

          {/* View Mode & Quick Bulk Controls */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl p-1 flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองหน้าต่างการ์ด (Window Grid)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="มุมมองตารางรายการ (Compact Table)"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Bulk Toggle AI */}
            <button
              onClick={() => onBulkToggle(true)}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
              title="เปิดระบบ AI ปิดการขายอัตโนมัติทุกเพจพร้อมกัน"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">เปิด AI ทุกเพจ</span>
            </button>

            {/* 1-Click Connect / Add Page Buttons */}
            <button
              onClick={onOpenConnectModal}
              className="px-3.5 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#1877F2]/20 transition-all"
            >
              <Facebook className="w-3.5 h-3.5" />
              <span>ซิงค์ Facebook</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ เพิ่มเพจใหม่</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pages Content Area */}
      {filteredPages.length === 0 ? (
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">ไม่พบเพจที่ตรงกับเงื่อนไขการค้นหา</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            ลองปรับคำค้นหา หรือรีเซ็ตตัวกรองหมวดหมู่ เพื่อแสดงเพจทั้งหมด
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setSelectedStatus('ALL');
              setSelectedTag('ALL');
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* WINDOW GRID CARDS (หน้าต่างการ์ดเรียงสวย สบายตา สีขาว สะอาดตา) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPages.map(item => {
            const p = item.page;
            const isActive = p.is_active;

            return (
              <React.Fragment key={p.page_id}>
              {/* ป้ายกำกับก่อนกลุ่มเพจที่ปิดการใช้งาน */}
              {!isActive && (filteredPages.find(x => !x.page.is_active)?.page.page_id === p.page_id) && (
                <div className="col-span-full flex items-center gap-3 py-2">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Power className="w-3.5 h-3.5" /> เพจที่ปิดการใช้งาน ({disabledPageCount} หน้า) — บอทไม่ตอบแชทเหล่านี้
                  </span>
                  <span className="flex-1 h-px bg-amber-200 dark:bg-amber-900/40" />
                </div>
              )}
              <div
                className={`group bg-white dark:bg-[#0F0F12] border rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col ${
                  isActive ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-200/60 opacity-80'
                }`}
              >
                {/* Window Card Cover Banner */}
                <div className="h-24 w-full relative bg-slate-100 dark:bg-zinc-900 overflow-hidden">
                  <img
                    src={item.cover}
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'; }}
                    alt={p.page_name}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />

                  {/* Category Pill & Page Tag on top-left */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold backdrop-blur-md bg-white/95 text-slate-900 border border-slate-200/80 flex items-center gap-1 shadow-xs">
                      {p.category === 'AMULET' ? '📿 พระเครื่อง' : p.category === 'CHINA' ? '🏮 สินค้านำเข้า/ไอที' : p.category === 'AGRICULTURE' ? '🌾 สินค้าการเกษตร' : '🌿 OTOP 5 ดาว'}
                    </span>
                    <button
                      onClick={() => onUpdatePageTag(p.page_id, NEXT_PAGE_TAG[p.page_tag || 'NORMAL'])}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold backdrop-blur-md border flex items-center gap-1 shadow-xs transition-all hover:scale-105 ${PAGE_TAG_META[p.page_tag || 'NORMAL'].classes}`}
                      title="คลิกเพื่อเปลี่ยนแท็กเพจ (ใช้งานปกติ → เพจว่าง → ไม่ได้ใช้แล้ว)"
                    >
                      <Tag className="w-3 h-3" />
                      {PAGE_TAG_META[p.page_tag || 'NORMAL'].emoji} {PAGE_TAG_META[p.page_tag || 'NORMAL'].label}
                    </button>
                  </div>

                  {/* Status Indicator & Power Toggle on top-right */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border flex items-center gap-1 shadow-xs ${
                      isActive ? 'bg-emerald-500/90 text-white border-emerald-600' : 'bg-slate-800/90 text-zinc-300 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
                      {isActive ? 'AI Online' : 'ปิดอยู่'}
                    </span>
                    {/* Toggle switch เปิด/ปิดการใช้งานเพจ */}
                    <button
                      onClick={() => onTogglePageStatus(p.page_id, !isActive)}
                      className={`w-11 h-6 rounded-full relative transition-colors shadow-xs border ${
                        isActive ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-400 dark:bg-zinc-600 border-slate-500 dark:border-zinc-500'
                      }`}
                      title={isActive ? 'ปิดใช้งานเพจนี้ — บอทจะไม่ตอบแชท' : 'เปิดใช้งานเพจนี้ — บอทกลับมาตอบแชท'}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isActive ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                {/* Page Avatar & Profile Header */}
                <div className="px-5 pt-0 pb-4 relative -mt-8 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-end justify-between">
                      {/* Avatar Image */}
                      <div className="relative">
                        <img
                          src={item.avatar}
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80'; }}
                          alt={p.page_name}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-white dark:border-zinc-800 shadow-md bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1877F2] border-2 border-white flex items-center justify-center text-white text-[10px]">
                          <Facebook className="w-3 h-3" />
                        </div>
                      </div>

                      {/* AI Model Badge */}
                      <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1 shadow-xs">
                        <Bot className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        {item.model}
                      </span>
                    </div>

                    {/* Page Name & ID */}
                    <div className="mt-3">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={p.page_name}>
                        {p.page_name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono flex items-center gap-1">
                          ID: {p.page_id}
                        </span>
                        <button
                          onClick={() => copyPageId(p.page_id)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                          title="คัดลอก Page ID"
                        >
                          {copiedId === p.page_id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Product & Persona Details Box */}
                    <div className="mt-3.5 bg-slate-50 dark:bg-[#141418] border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-3 space-y-2">
                      {/* Product Tied to this page */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block">
                          สินค้าประจำเพจ (1 เพจ = 1 สินค้า)
                        </span>
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 line-clamp-1 mt-0.5">
                          {item.topProduct}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 dark:border-zinc-800/60 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">แอดมิน AI:</span>
                          {p.admin_name ? (
                            <span className="font-bold truncate block text-indigo-700 dark:text-indigo-400">
                              {item.adminName}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                              ยังไม่ได้ตั้งค่า
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">ราคาขาย:</span>
                          {item.hasProductData ? (
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                              ฿{(p.product?.display_price || 0).toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                              ⚠️ ยังไม่มีข้อมูล
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sales Performance Snapshot (Inbound Inquiries & Conversion Rate) */}
                    <div className="mt-3 grid grid-cols-4 gap-1.5 bg-slate-100/70 dark:bg-[#0A0A0C] border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-2.5 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">ยอดขาย</span>
                        <span className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                          ฿{item.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">ออเดอร์</span>
                        <span className="text-xs font-black font-mono text-slate-800 dark:text-zinc-200">
                          {item.orderCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">ทักเข้า</span>
                        <span className="text-xs font-black font-mono text-slate-700 dark:text-zinc-200">
                          {item.inquiries} คน
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-purple-600 block">% ปิดขาย</span>
                        <span className="text-xs font-black font-mono text-purple-600 dark:text-purple-400">
                          {item.conversion}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Window Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-2">
                    <button
                      onClick={() => onOpenPageSettings(p.page_id)}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:opacity-90 active:scale-95"
                      title="ตั้งค่าสินค้า, โปรโมชั่น, สเปก, บุคลิก AI, ขนส่ง, และแบบฟอร์ม COD"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>ตั้งค่าเพจนี้</span>
                    </button>

                    <button
                      onClick={() => onSelectPageAndChat(p.page_id)}
                      className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-center gap-1 transition-all"
                      title="เปิดห้องแชทจำลองทดสอบ AI ปิดการขาย"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>แชท AI</span>
                    </button>
                  </div>
                </div>
              </div>
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        /* COMPACT TABLE VIEW */
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-[#141418] text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 uppercase font-mono text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 font-bold">เพจ Facebook</th>
                  <th className="py-3.5 px-4 font-bold">หมวดหมู่</th>
                  <th className="py-3.5 px-4 font-bold">สินค้าหลัก</th>
                  <th className="py-3.5 px-4 font-bold">แอดมิน AI & โมเดล</th>
                  <th className="py-3.5 px-4 text-center font-bold">สถานะ AI</th>
                  <th className="py-3.5 px-4 text-center font-bold">ลูกค้าทักเข้า</th>
                  <th className="py-3.5 px-4 text-center font-bold">% ปิดการขาย</th>
                  <th className="py-3.5 px-4 text-right font-bold">ออเดอร์</th>
                  <th className="py-3.5 px-4 text-right font-bold">ยอดขายรวม</th>
                  <th className="py-3.5 px-4 text-center font-bold">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-sans">
                {filteredPages.map(item => {
                  const p = item.page;

                  return (
                    <tr key={p.page_id} className="hover:bg-slate-50/80 dark:hover:bg-[#141418]/60 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.avatar}
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=200&h=200&q=80'; }}
                            alt={p.page_name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 bg-slate-100 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-zinc-100 block">{p.page_name}</span>
                            <span className="text-[11px] text-slate-500 font-mono">ID: {p.page_id}</span>
                            <button
                              onClick={() => onUpdatePageTag(p.page_id, NEXT_PAGE_TAG[p.page_tag || 'NORMAL'])}
                              className={`mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition-all hover:scale-105 ${PAGE_TAG_META[p.page_tag || 'NORMAL'].classes}`}
                              title="คลิกเพื่อเปลี่ยนแท็กเพจ (ใช้งานปกติ → เพจว่าง → ไม่ได้ใช้แล้ว)"
                            >
                              <Tag className="w-3 h-3" />
                              {PAGE_TAG_META[p.page_tag || 'NORMAL'].emoji} {PAGE_TAG_META[p.page_tag || 'NORMAL'].label}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {p.category === 'AMULET' ? '📿 พระเครื่อง' : p.category === 'CHINA' ? '📦 สินค้านำเข้า' : '🌾 OTOP'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300">
                        <span className="truncate block max-w-xs font-medium">{item.topProduct}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-slate-800 dark:text-zinc-200 font-bold block">{item.adminName}</span>
                        <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400">{item.model}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onTogglePageStatus(p.page_id, !p.is_active)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all inline-flex items-center gap-1 ${
                            p.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {p.is_active ? 'Online' : 'Paused'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                        {item.inquiries} คน
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-black text-purple-600">
                        {item.conversion}%
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-slate-800 dark:text-zinc-200">
                        {item.orderCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                        ฿{item.revenue.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenPageSettings(p.page_id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-xs"
                          >
                            <Settings className="w-3 h-3" /> ตั้งค่า
                          </button>
                          <button
                            onClick={() => onSelectPageAndChat(p.page_id)}
                            className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-all"
                            title="เปิดแชทจำลอง"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add New Page Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base">เพิ่มเพจใหม่สำหรับให้ AI ปิดการขาย</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">สร้างเพจใหม่พร้อมสินค้าหลักและ AI Persona ใน 1 นาที</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewPage} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-300 block mb-1">
                  1. ชื่อเพจ Facebook *
                </label>
                <input
                  type="text"
                  required
                  value={newPageName}
                  onChange={e => setNewPageName(e.target.value)}
                  placeholder="เช่น พระเครื่องเมืองสยาม หรือ Smart Home Gadget"
                  className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-300 block mb-1">
                    2. หมวดหมู่สินค้า
                  </label>
                  <select
                    value={newPageCategory}
                    onChange={e => setNewPageCategory(e.target.value as ProductCategory)}
                    className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="AMULET">📿 พระเครื่อง & วัตถุมงคล</option>
                    <option value="CHINA">📦 สินค้านำเข้า & ไอที</option>
                    <option value="OTOP">🌾 สินค้าโอทอป OTOP</option>
                    <option value="AGRICULTURE">🌱 สินค้าการเกษตร & ปุ๋ยยา</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-300 block mb-1">
                    3. ชื่อแอดมิน AI ประจำเพจ
                  </label>
                  <input
                    type="text"
                    value={newAdminName}
                    onChange={e => setNewAdminName(e.target.value)}
                    placeholder="เช่น แอดมินน้องพลอย"
                    className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-300 block mb-1">
                  4. ชื่อสินค้าหลัก (1 เพจ = 1 สินค้า)
                </label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  placeholder="เช่น เหรียญท้าวเวสสุวรรณ หรือ เครื่องฟอกอากาศพกพา"
                  className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-300 block mb-1">
                  5. ราคาขายเริ่มต้น (บาท)
                </label>
                <input
                  type="number"
                  value={newProductPrice}
                  onChange={e => setNewProductPrice(e.target.value)}
                  placeholder="990"
                  className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                >
                  บันทึกและสร้างเพจทันที
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
