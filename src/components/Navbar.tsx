import React, { useState, useRef, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Bot,
  Facebook,
  Database,
  Radio,
  FileSpreadsheet,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  BellRing,
  Clock,
  ExternalLink,
  Sparkles,
  Layers,
  Settings,
  Trophy,
  Sun,
  Moon,
  LayoutGrid,
  LayoutDashboard,
  MessageCircle,
  Users,
  BookOpen,
  Terminal,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Inbox
} from 'lucide-react';
import { PageConfig } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pages: PageConfig[];
  selectedPageId: string;
  setSelectedPageId: (id: string) => void;
  onOpenConnectModal: () => void;
  onOpenPageSettings: (pageId: string) => void;
  onOpenAiSettings: () => void;
  totalOrders: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onLockSystem?: () => void;
  onResetDemoData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  pages,
  selectedPageId,
  setSelectedPageId,
  onOpenConnectModal,
  onOpenPageSettings,
  onOpenAiSettings,
  totalOrders,
  theme,
  onToggleTheme,
  onLockSystem,
  onResetDemoData
}) => {
  const selectedPage = pages.find(p => p.page_id === selectedPageId) || pages[0];
  const [isApiConfigured, setIsApiConfigured] = useState<boolean | null>(null);

  const isConnected = pages && pages.length > 0 && !pages[0].page_access_token.includes('mock');

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
  
  
  const navItems: Array<{id: string, label: string, icon: any, badge?: string, count?: number, iconColor?: string}> = [
    { id: 'pages_hub', label: 'ศูนย์รวมเพจ (Pages Hub)', icon: Layers, iconColor: 'text-blue-500' },
    { id: 'chat_inbox', label: 'แชท Inbox 💬', icon: Inbox, iconColor: 'text-cyan-500' },
    { id: 'dashboard', label: 'แดชบอร์ด & ยอดขาย', icon: LayoutDashboard, badge: 'PRO', iconColor: 'text-indigo-500' },
    { id: 'simulator', label: 'จำลองแชท AI ปิดการขาย', icon: MessageSquare, badge: 'TEST', iconColor: 'text-emerald-500' },
    { id: 'orders', label: 'ออเดอร์ & ขนส่ง (COD)', icon: ShoppingBag, count: totalOrders, iconColor: 'text-amber-500' },
    { id: 'crm', label: 'ฐานข้อมูลลูกค้า CRM', icon: Users, iconColor: 'text-purple-500' },
    { id: 'comments', label: 'จัดการคอมเมนต์ & โพสต์', icon: MessageCircle, iconColor: 'text-sky-500' },
    { id: 'followup', label: 'ระบบตามติด (Follow-up)', icon: BellRing, iconColor: 'text-rose-500' },
    { id: 'database', label: 'แก้ไขฐานข้อมูล (Database)', icon: Database, iconColor: 'text-teal-500' },
    { id: 'system_docs', label: 'คู่มือระบบเชิงลึก & แก้ไข AI', icon: BookOpen, badge: 'DEV', iconColor: 'text-violet-500' }
  ];

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollState = () => {
    if (tabsContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScrollState();
    const handleResize = () => checkScrollState();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const slideLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -280, behavior: 'smooth' });
    }
  };

  const slideRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 280, behavior: 'smooth' });
    }
  };

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (tabsContainerRef.current && e.deltaY !== 0) {
      tabsContainerRef.current.scrollLeft += e.deltaY * 0.8;
    }
  };

  return (
    <header className={`${theme === 'dark' ? 'bg-[#0C0C0E] text-zinc-100 border-zinc-800/80' : 'bg-white text-zinc-900 border-slate-200 shadow-sm'} border-b sticky top-0 z-40`}>
      {/* Top Banner Bar - Responsive with scroll */}
      <div className={`${theme === 'dark' ? 'bg-[#121216] border-zinc-800/60 text-zinc-300' : 'bg-slate-100 border-slate-200 text-zinc-700'} border-b px-3 py-1.5 text-xs flex items-center justify-between font-mono overflow-x-auto`}>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium whitespace-nowrap">
            ENGINE STATUS: <span className="text-emerald-500 font-semibold">ONLINE</span> •
            {isApiConfigured ? (
              <span className="text-emerald-500 font-semibold"> AI พร้อม</span>
            ) : (
              <span className="text-amber-500 font-semibold flex items-center gap-1 whitespace-nowrap">
                <AlertCircle className="w-3 h-3 shrink-0" /> ใส่ API AI
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <button
            onClick={onOpenAiSettings}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer text-xs whitespace-nowrap ${
              isApiConfigured
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}
          >
            <Settings className="w-3 h-3 shrink-0" />
            <span className="hidden sm:inline">{isApiConfigured ? 'AI พร้อม' : 'ใส่ API AI'}</span>
          </button>
          <span className="hidden md:flex items-center gap-1.5 text-indigo-400 whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5" /> จัดการ 100+ เพจ
          </span>
          <button
            onClick={onOpenConnectModal}
            className="hover:text-indigo-400 flex items-center gap-1 font-semibold transition-colors text-zinc-600 dark:text-zinc-300 cursor-pointer text-xs whitespace-nowrap"
          >
            <span className="hidden sm:inline">FB ซิงค์</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </button>
        </div>
      </div>

      {/* Main Nav Header - Responsive layout */}
      <div className="w-full max-w-[1700px] mx-auto px-3 sm:px-4 lg:px-6 shrink-0">
        <div className="flex items-center justify-between h-14 gap-2">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${theme === 'dark' ? 'bg-[#141419] border-indigo-500/30 text-indigo-400 shadow-indigo-950' : 'bg-gradient-to-tr from-indigo-600 to-purple-600 border-indigo-500 text-white shadow-indigo-100'} shadow-md shrink-0`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base md:text-lg leading-tight tracking-tight flex items-center gap-1.5 text-slate-900 dark:text-zinc-100">
                  Vorakamol SuperAI <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold">v2.8 PRO</span>
                </h1>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">ระบบแชทบอท & ปิดการขายอัจฉริยะ ซิงค์ Vercel Database พระเครื่อง • จีน • OTOP • การเกษตร</p>
            </div>
          </div>

          {/* Active Page Selector & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Page Selector Dropdown */}
            <div className={`hidden sm:flex items-center border rounded-xl p-1 ${theme === 'dark' ? 'bg-[#141418] border-zinc-800' : 'bg-slate-100 border-slate-200'}`}>
              <span className="text-xs text-zinc-400 px-2 font-medium flex items-center gap-1.5 shrink-0">
                <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> เพจ:
              </span>
              <select
                id="page-selector"
                value={selectedPageId}
                onChange={e => setSelectedPageId(e.target.value)}
                className={`text-xs font-medium rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-[#0A0A0C] text-zinc-200 border-zinc-800/80 focus:border-indigo-500'
                    : 'bg-white text-zinc-800 border-slate-200 focus:border-indigo-500'
                }`}
              >
                {pages.map(p => (
                  <option key={p.page_id} value={p.page_id}>
                    {p.category === 'AMULET' ? '📿 ' : p.category === 'CHINA' ? '📦 ' : '🌾 '}
                    {p.page_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Page Settings Button ("ปุ่มตั้งค่าเพจ") */}
            <button
              id="btn-page-settings"
              onClick={() => onOpenPageSettings(selectedPageId)}
              className="px-3.5 py-2 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 hover:text-white text-xs font-bold rounded-xl border border-indigo-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
              title="ตั้งค่าสินค้า, โปรโมชั่น, AI บุคลิก, และ สเต็ปของเพจนี้"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">ตั้งค่าเพจนี้</span>
            </button>

            {/* Reset Demo Data Button */}
            {onResetDemoData && (
              <button
                id="btn-reset-demo"
                onClick={onResetDemoData}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  theme === 'dark'
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title="ล้างข้อมูลออเดอร์และลูกค้าจำลอง ให้เริ่มต้นเป็น 0 เพื่อรอรับของจริง"
              >
                <span>🧹 ล้างข้อมูลจำลอง</span>
              </button>
            )}

            {/* Security Lock Button */}
            {onLockSystem && (
              <button
                id="btn-lock-system"
                onClick={onLockSystem}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0"
                title="ล็อคระบบความปลอดภัย (ต้องใส่ PIN เพื่อเข้าใช้งาน)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">ล็อคระบบ</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              id="btn-theme-toggle"
              onClick={onToggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                theme === 'dark'
                  ? 'bg-[#141418] border-zinc-800 text-amber-400 hover:bg-zinc-800'
                  : 'bg-slate-100 border-slate-200 text-zinc-700 hover:bg-slate-200'
              }`}
              title={theme === 'dark' ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Facebook Connect Modal Button */}
            <button
              id="btn-quick-connect"
              onClick={onOpenConnectModal}
              className="px-3.5 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-[#1877F2]/25 cursor-pointer shrink-0"
            >
              <Facebook className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">เชื่อมต่อ FB</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation with Horizontal Slider Bar */}
        <div className={`relative flex items-center border-t ${theme === 'dark' ? 'border-zinc-800/60' : 'border-slate-200'} pt-1 pb-1 shrink-0`}>
          {/* Slide Left Button */}
          {canScrollLeft && (
            <button
              onClick={slideLeft}
              className={`absolute left-0 z-20 h-9 w-7 flex items-center justify-center rounded-r-lg shadow-md transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-zinc-900/95 text-zinc-300 hover:bg-zinc-800 border-r border-y border-zinc-700/80'
                  : 'bg-white/95 text-slate-700 hover:bg-slate-100 border-r border-y border-slate-300'
              }`}
              title="เลื่อนแท็บเมนูไปทางซ้าย"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Scrollable Container with Custom Horizontal Slider */}
          <div
            ref={tabsContainerRef}
            onScroll={checkScrollState}
            onWheel={handleTabsWheel}
            className="flex space-x-1.5 overflow-x-auto pb-1.5 pt-0.5 horizontal-tabs-scrollbar scroll-smooth w-full px-1"
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`tab-btn-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                    isActive
                      ? theme === 'dark'
                        ? 'bg-[#181820] text-zinc-100 border border-indigo-500/40 shadow-xs font-bold ring-1 ring-indigo-500/20'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs font-bold ring-1 ring-indigo-500/10'
                      : theme === 'dark'
                      ? 'text-zinc-400 hover:text-zinc-200 hover:bg-[#141418] border border-transparent'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${isActive ? (theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600') : item.iconColor || 'text-zinc-400'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 font-bold'
                        : theme === 'dark'
                        ? 'bg-[#121216] text-zinc-400 border-zinc-800'
                        : 'bg-slate-200 text-zinc-600 border-slate-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] font-mono bg-emerald-500 text-zinc-950 font-bold px-1.5 py-0.2 rounded">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Slide Right Button */}
          {canScrollRight && (
            <button
              onClick={slideRight}
              className={`absolute right-0 z-20 h-9 w-7 flex items-center justify-center rounded-l-lg shadow-md transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-zinc-900/95 text-zinc-300 hover:bg-zinc-800 border-l border-y border-zinc-700/80'
                  : 'bg-white/95 text-slate-700 hover:bg-slate-100 border-l border-y border-slate-300'
              }`}
              title="เลื่อนแท็บเมนูไปทางขวา"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
