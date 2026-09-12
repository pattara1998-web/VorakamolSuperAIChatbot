import React, { useState, useMemo } from 'react';
import { ExpenseReminderModal } from './ExpenseReminderModal';
import {
  Bell,
  Loader2,
  Save,
  Trophy,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Crown,
  Users,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Settings,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Truck,
  FileSpreadsheet,
  PieChart,
  Activity,
  ArrowDownRight,
  Target,
  Percent,
  Calculator,
  Wallet,
  Printer,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Flame,
  Check,
  FileText,
  Copy
} from 'lucide-react';
import { Order, PageConfig, Customer } from '../types';

interface SalesDashboardTabProps {
  orders: Order[];
  pages: PageConfig[];
  customers: Customer[];
  onOpenPageSettings: (pageId: string) => void;
  onSelectPageAndChat: (pageId: string) => void;
  theme?: 'dark' | 'light';
}

export const SalesDashboardTab: React.FC<SalesDashboardTabProps> = ({
  orders,
  pages,
  customers,
  onOpenPageSettings,
  onSelectPageAndChat,
  theme = 'light'
}) => {
  // Active view mode: 'overview' | 'calendar' | 'charts' | 'calculator'
  const [dashboardView, setDashboardView] = useState<'calendar' | 'charts' | 'calculator' | 'overview'>('calendar');

  // Calendar State (Dynamic Current Date)
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayOrders, setSelectedDayOrders] = useState<Order[] | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().split('T')[0]);

  // Business Parameters & Simulation Controls
  const [monthlySalesGoal, setMonthlySalesGoal] = useState<number>(50000);
  const [adSpendInput, setAdSpendInput] = useState<number>(0);
  const [cogsPercent, setCogsPercent] = useState<number>(35); // ต้นทุนสินค้าเฉลี่ย 35%
  const [shippingPerOrder, setShippingPerOrder] = useState<number>(45); // ค่าส่งเฉลี่ย 45 บาท
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders' | 'profit'>('revenue');

  // AI Sales Closing Summary State
  const [isAiSummaryModalOpen, setIsAiSummaryModalOpen] = useState<boolean>(false);
  const [summaryCategory, setSummaryCategory] = useState<'ALL' | 'CHINA' | 'AMULET' | 'OTOP' | 'AGRICULTURE'>('ALL');
  const [summaryDateScope, setSummaryDateScope] = useState<'selected' | 'today' | 'all'>('selected');
  const [summaryText, setSummaryText] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [summaryStats, setSummaryStats] = useState<any>(null);
  const [sendNotifyStatus, setSendNotifyStatus] = useState<string | null>(null);

  // Time filter for stats
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'month' | 'week'>('all');

  // Filtered orders based on timeFilter
  const filteredOrders = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (timeFilter === 'today') {
      return orders.filter(o => o.created_at?.startsWith(todayStr));
    }
    if (timeFilter === 'week') {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orders.filter(o => {
        if (!o.created_at) return false;
        const d = new Date(o.created_at);
        return d >= oneWeekAgo && d <= now;
      });
    }
    if (timeFilter === 'month') {
      const currentMonth = new Date().toISOString().slice(0, 7);
      return orders.filter(o => o.created_at?.startsWith(currentMonth));
    }
    return orders;
  }, [orders, timeFilter]);

  // Core Financial & Operational Calculations (Strictly Real Data)
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;
  const totalItemsSold = filteredOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  const avgItemsPerOrder = totalOrdersCount > 0 ? (totalItemsSold / totalOrdersCount).toFixed(1) : '0.0';

  // Inbound customer inquiries count across pages
  const totalInquiries = pages.reduce((sum, p) => sum + (p.inquiries_count || 0), 0);
  const conversionRatePercent = totalInquiries > 0
    ? Math.min(100, Number(((totalOrdersCount / totalInquiries) * 100).toFixed(1)))
    : (totalOrdersCount > 0 ? 100 : 0);

  // Advanced Business Calculations
  const estimatedCOGS = totalRevenue > 0 ? Math.round(totalRevenue * (cogsPercent / 100)) : 0;
  const estimatedShippingCost = totalOrdersCount * shippingPerOrder;
  const grossProfit = totalRevenue > 0 ? Math.max(0, totalRevenue - estimatedCOGS - estimatedShippingCost) : 0;

  // ── สรุปบัญชีจริง: ยอดขาย - ต้นทุนสินค้า - ค่าแอด - ค่าใช้จ่าย (จากข้อมูลจริงทุกตัว) ──
  const [accSummary, setAccSummary] = useState<any>(null);
  const [accLoading, setAccLoading] = useState(false);
  const fetchAccounting = React.useCallback(() => {
    setAccLoading(true);
    fetch('/api/accounting/summary')
      .then(r => r.json())
      .then(d => { if (d.success) setAccSummary(d); })
      .catch(() => {})
      .finally(() => setAccLoading(false));
  }, []);
  React.useEffect(() => { fetchAccounting(); }, [fetchAccounting]);
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? true : false;

  // ── เด้งเตือนกรอกค่าใช้จ่ายรายวัน (ครั้งเดียว/วัน + ปุ่มเปิดเองได้) ──
  const todayKey = new Date().toISOString().slice(0, 10);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expensePendingCount, setExpensePendingCount] = useState<number | null>(null);

  const fetchExpenseReminder = React.useCallback(() => {
    fetch('/api/expenses/reminder')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const pending = (d.pages || []).filter((p: any) => !p.filled);
          setExpensePendingCount(pending.length);
          // เด้งอัตโนมัติวันละครั้ง เมื่อมีเพจรอกรอก
          if (pending.length > 0 && localStorage.getItem('superai_expense_reminder_' + todayKey) !== 'done') {
            setExpenseModalOpen(true);
          }
        }
      })
      .catch(() => {});
  }, [todayKey]);

  React.useEffect(() => { fetchExpenseReminder(); }, [fetchExpenseReminder]);

  const closeExpenseModal = (dismissForToday = false) => {
    if (dismissForToday) {
      try { localStorage.setItem('superai_expense_reminder_' + todayKey, 'done'); } catch { /* noop */ }
    }
    setExpenseModalOpen(false);
    fetchExpenseReminder();
    fetchAccounting();
  };

  // ── ตั้งค่ารายงานอัตโนมัติ (ผู้บริหารรายวัน + รายงานย่อทุก N ชม.) ──
  const [schedule, setSchedule] = useState<any>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportStatus, setReportStatus] = useState('');

  React.useEffect(() => {
    fetch('/api/reports/schedule')
      .then(r => r.json())
      .then(d => { if (d.success) setSchedule(d.schedule); })
      .catch(() => {});
  }, []);

  const saveSchedule = async () => {
    setScheduleSaving(true); setScheduleSaved('');
    try {
      const res = await fetch('/api/reports/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule)
      });
      const r = await res.json();
      setScheduleSaved(r.success ? '✅ บันทึกตารางรายงานแล้ว — ระบบจะส่งตามเวลาที่ตั้ง (เวลาไทย)' : '❌ ' + (r.message || 'บันทึกไม่สำเร็จ'));
    } catch { setScheduleSaved('❌ เชื่อมต่อไม่สำเร็จ'); }
    finally { setScheduleSaving(false); setTimeout(() => setScheduleSaved(''), 5000); }
  };

  const sendReportNow = async (scope: 'daily' | 'interval') => {
    setReportSending(true); setReportStatus('กำลังส่ง...');
    try {
      const cfg = {
        daily: { enabled: true, time: schedule?.daily?.time || '00:00' },
        interval: { enabled: true, every_hours: schedule?.interval?.every_hours || 3 }
      };
      await fetch('/api/reports/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
      // บังคับส่งทันที: ตั้ง last sent เป็นค่าว่าง/0 แล้วสั่งรอบตรวจทำงานผ่าน endpoint ใหม่
      const res = await fetch('/api/reports/send-now', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
      const r = await res.json();
      setReportStatus(r.success ? `✅ ${r.message}` : '❌ ' + (r.message || 'ส่งไม่สำเร็จ'));
    } catch { setReportStatus('❌ เชื่อมต่อไม่สำเร็จ'); }
    finally { setReportSending(false); setTimeout(() => setReportStatus(''), 6000); }
  };
  const grossProfitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Real growth: ช่วงปัจจุบัน vs ช่วงก่อนหน้าที่ยาวเท่ากัน (คำนวณจากออเดอร์จริง)
  // คืน null เมื่อไม่มีข้อมูลพอเปรียบเทียบ — UI จะแสดง "—" แทน % ปลอมที่เดิม hardcode +28.4%
  const realGrowthPercent = (() => {
    const now = new Date();
    let curStart: Date;
    if (timeFilter === 'today') curStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (timeFilter === 'week') curStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (timeFilter === 'month') curStart = new Date(now.getFullYear(), now.getMonth(), 1);
    else curStart = new Date(0);
    const curRev = orders
      .filter(o => o.created_at && new Date(o.created_at) >= curStart)
      .reduce((s, o) => s + (o.total_amount || 0), 0);
    if (curRev <= 0) return null;
    const spanMs = now.getTime() - curStart.getTime();
    if (spanMs <= 0) return null;
    const prevRev = orders.filter(o => {
      if (!o.created_at) return false;
      const d = new Date(o.created_at).getTime();
      return d < curStart.getTime() && d >= curStart.getTime() - spanMs;
    }).reduce((s, o) => s + (o.total_amount || 0), 0);
    if (prevRev <= 0) return null;
    return Number((((curRev - prevRev) / prevRev) * 100).toFixed(1));
  })();

  // Ad Spend & ROAS Metrics (Real Calculations)
  const roasMultiplier = adSpendInput > 0 ? (totalRevenue / adSpendInput).toFixed(2) : (totalRevenue > 0 ? '∞' : '0.00');
  const netProfitAfterAds = totalRevenue > 0 ? (grossProfit - adSpendInput) : (adSpendInput > 0 ? -adSpendInput : 0);
  const costPerAcquisition = totalOrdersCount > 0 ? Math.round(adSpendInput / totalOrdersCount) : 0;
  const breakEvenROAS = grossProfitMargin !== '0.0' ? (100 / parseFloat(grossProfitMargin)).toFixed(2) : '0.0';

  // Target Progress & Projection
  const goalProgressPercent = Math.min(100, Math.round((totalRevenue / monthlySalesGoal) * 100));
  const remainingGoal = Math.max(0, monthlySalesGoal - totalRevenue);
  const daysInAugust = 31;
  const currentDayInAugust = 22;
  const remainingDays = daysInAugust - currentDayInAugust;
  const dailyRunRateNeeded = remainingDays > 0 ? Math.round(remainingGoal / remainingDays) : 0;
  const projectedMonthRevenue = Math.round((totalRevenue / currentDayInAugust) * daysInAugust);

  // COD and Payment Fulfillment
  const paidOrders = filteredOrders.filter(o => o.payment_status === 'PAID');
  const codOrders = filteredOrders.filter(o => o.payment_status === 'COD' || !o.payment_status);
  const shippedOrders = filteredOrders.filter(o => o.payment_status === 'SHIPPED');
  const paidRevenue = paidOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const codInTransitRevenue = codOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) +
                              shippedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Per-page stats calculation
  const pageRankings = useMemo(() => {
    return pages.map(p => {
      const pageOrders = orders.filter(o => {
        if (o.page_id) return o.page_id === p.page_id;
        if (p.category === 'AMULET' && (o.items?.includes('AML') || o.items?.includes('หลวงปู่ทวด'))) return true;
        if (p.category === 'CHINA' && (o.items?.includes('CHN') || o.items?.includes('ฟอกอากาศ'))) return true;
        if (p.category === 'OTOP' && (o.items?.includes('OTP') || o.items?.includes('ผ้าไหม'))) return true;
        return false;
      });

      const revenue = pageOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const orderCount = pageOrders.length;
      const avgTicket = orderCount > 0 ? Math.round(revenue / orderCount) : p.product?.display_price || 990;
      const pageInquiries = p.inquiries_count || (orderCount > 0 ? Math.round(orderCount / 0.9) : 10);
      const pageConversionRate = pageInquiries > 0
        ? Math.min(100, Math.round((orderCount / pageInquiries) * 100))
        : 90;

      const pageCOGS = Math.round(revenue * 0.35);
      const pageProfit = Math.max(0, revenue - pageCOGS - (orderCount * 45));

      return {
        page: p,
        revenue,
        orderCount,
        inquiriesCount: pageInquiries,
        conversionRate: pageConversionRate,
        avgTicket,
        profit: pageProfit,
        topProduct: p.product?.product_name || p.page_name,
        model: p.ai_model || 'gemini-3.6-flash',
        adminName: p.admin_name || 'น้ำหวาน'
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [pages, orders]);

  // Category revenue split
  const categorySplit = useMemo(() => {
    let amuletRev = 0, chinaRev = 0, otopRev = 0;
    orders.forEach(o => {
      const amt = o.total_amount || 0;
      if (o.items?.includes('AML') || o.items?.includes('หลวงปู่ทวด') || o.page_id === 'AMULET_PAGE_ID') {
        amuletRev += amt;
      } else if (o.items?.includes('CHN') || o.items?.includes('ฟอกอากาศ') || o.page_id === 'CHINA_PAGE_ID') {
        chinaRev += amt;
      } else {
        otopRev += amt;
      }
    });
    return {
      amulet: amuletRev,
      china: chinaRev,
      otop: otopRev,
      total: totalRevenue || 1
    };
  }, [orders, totalRevenue]);

  // Calendar generation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed (7 = Aug)

  const monthNamesThai = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Map orders by date string YYYY-MM-DD
  const ordersByDate = useMemo(() => {
    const map: Record<string, { orders: Order[]; totalAmount: number; count: number }> = {};
    orders.forEach(o => {
      if (!o.created_at) return;
      const dateKey = o.created_at.split('T')[0]; // "2026-08-22"
      if (!map[dateKey]) {
        map[dateKey] = { orders: [], totalAmount: 0, count: 0 };
      }
      map[dateKey].orders.push(o);
      map[dateKey].totalAmount += o.total_amount || 0;
      map[dateKey].count += 1;
    });
    return map;
  }, [orders]);

  // Select day in calendar
  const handleSelectDay = (day: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    const dateKey = `${year}-${formattedMonth}-${formattedDay}`;
    setSelectedDateStr(dateKey);
    setSelectedDayOrders(ordersByDate[dateKey]?.orders || []);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleJumpToday = () => {
    setCurrentDate(new Date(2026, 7, 22));
    handleSelectDay(22);
  };

  // Default active selected day orders on load
  React.useEffect(() => {
    if (!selectedDayOrders && ordersByDate['2026-08-22']) {
      setSelectedDayOrders(ordersByDate['2026-08-22'].orders);
    }
  }, [ordersByDate, selectedDayOrders]);

  // Daily timeline data for charts (1 Aug - 22 Aug)
  const dailyTimeline = useMemo(() => {
    const list: { day: number; dateStr: string; label: string; revenue: number; orders: number; profit: number }[] = [];
    for (let d = 1; d <= 22; d++) {
      const formattedMonth = String(month + 1).padStart(2, '0');
      const formattedDay = String(d).padStart(2, '0');
      const key = `${year}-${formattedMonth}-${formattedDay}`;
      const dayData = ordersByDate[key];
      const rev = dayData ? dayData.totalAmount : 0;
      const count = dayData ? dayData.count : 0;
      const prof = Math.max(0, Math.round(rev * 0.65 - count * 45));
      list.push({
        day: d,
        dateStr: key,
        label: `${d} ส.ค.`,
        revenue: rev,
        orders: count,
        profit: prof
      });
    }
    return list;
  }, [month, year, ordersByDate]);

  const maxDailyRevenue = Math.max(...dailyTimeline.map(d => d.revenue), 4000);

  // Selected Day Calculations
  const selectedDayTotal = (selectedDayOrders || []).reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const selectedDayProfit = Math.max(0, Math.round(selectedDayTotal * 0.65 - (selectedDayOrders?.length || 0) * 45));

  // Generate Sales Summary function (Categorized + Price tier + Grand Total)
  const handleGenerateSummary = async (
    targetCat: 'ALL' | 'CHINA' | 'AMULET' | 'OTOP' | 'AGRICULTURE' = summaryCategory,
    targetScope: 'selected' | 'today' | 'all' = summaryDateScope
  ) => {
    setIsGeneratingSummary(true);
    setSummaryCategory(targetCat);
    setSummaryDateScope(targetScope);

    try {
      let dateFilterParam: string | undefined = undefined;
      let dateTitleThai = '';

      if (targetScope === 'selected') {
        dateFilterParam = selectedDateStr; // e.g. "2026-08-22"
        const [y, m, d] = selectedDateStr.split('-');
        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        dateTitleThai = `${parseInt(d, 10)} ${thaiMonths[parseInt(m, 10) - 1]} ${String(parseInt(y, 10) + 543).slice(-2)}`;
      } else if (targetScope === 'today') {
        dateFilterParam = '2026-08-22';
        dateTitleThai = '22 ส.ค. 69 (วันนี้)';
      } else {
        dateFilterParam = 'ALL';
        dateTitleThai = 'ภาพรวมยอดขายสะสมทั้งหมด';
      }

      const res = await fetch('/api/ai/sales-summary-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateStr: dateFilterParam,
          category: targetCat,
          customDateTitle: dateTitleThai,
          customOrders: orders
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSummaryText(data.summaryText || '');
        setSummaryStats(data.stats || null);
      } else {
        throw new Error('API request failed');
      }
    } catch (err) {
      console.error('Summary error:', err);
      // Fallback local generator with exact requested pattern
      let targetList = orders;
      if (targetScope === 'selected') {
        targetList = orders.filter(o => o.created_at?.startsWith(selectedDateStr));
      } else if (targetScope === 'today') {
        targetList = orders.filter(o => o.created_at?.startsWith('2026-08-22'));
      }

      if (targetCat !== 'ALL') {
        targetList = targetList.filter(o => {
          if (targetCat === 'CHINA') return o.page_id === 'CHINA_PAGE_ID' || o.items?.includes('CHN') || o.items?.includes('ฟอกอากาศ') || o.items?.includes('เสาอากาศ') || o.items?.includes('ชุดบล็อก');
          if (targetCat === 'AMULET') return o.page_id === 'AMULET_PAGE_ID' || o.items?.includes('AML') || o.items?.includes('หลวงปู่ทวด');
          if (targetCat === 'OTOP') return o.page_id === 'OTOP_PAGE_ID' || o.items?.includes('OTP') || o.items?.includes('ผ้าไหม');
          if (targetCat === 'AGRICULTURE') return o.page_id === 'AGRI_PAGE_ID' || o.items?.includes('AGR') || o.items?.includes('ปุ๋ย');
          return true;
        });
      }

      const categoryNameTh = targetCat === 'CHINA' ? 'ของจีน' : targetCat === 'AMULET' ? 'พระเครื่อง' : targetCat === 'OTOP' ? 'โอทอป' : targetCat === 'AGRICULTURE' ? 'สินค้าเกษตร' : 'ทุกหมวดสินค้า';
      let dateTitleTh = targetScope === 'selected' ? selectedDateStr : '22 ส.ค. 69';

      const itemsGroup: Record<string, { prices: Record<string, number>; subtotal: number; count: number; units: number }> = {};
      let totalRev = 0;
      let totalUnits = 0;

      targetList.forEach(o => {
        const amt = o.total_amount || 0;
        const qty = o.quantity || 1;
        totalRev += amt;
        totalUnits += qty;
        const itemName = o.items || 'สินค้าทั่วไป';
        if (!itemsGroup[itemName]) {
          itemsGroup[itemName] = { prices: {}, subtotal: 0, count: 0, units: 0 };
        }
        const tier = `(${amt.toLocaleString()}.-) ${o.payment_status === 'PAID' ? 'โอน' : 'COD'}`;
        itemsGroup[itemName].prices[tier] = (itemsGroup[itemName].prices[tier] || 0) + 1;
        itemsGroup[itemName].subtotal += amt;
        itemsGroup[itemName].count += 1;
        itemsGroup[itemName].units += qty;
      });

      const totalInq = targetCat !== 'ALL'
        ? (pages.find(p => p.category === targetCat)?.inquiries_count || (targetList.length > 0 ? Math.round(targetList.length / 0.85) : 12))
        : pages.reduce((sum, p) => sum + (p.inquiries_count || 12), 0);
      const convRate = totalInq > 0 ? ((targetList.length / totalInq) * 100).toFixed(1) : '85.5';

      let out = `ปิดยอด${categoryNameTh} ${dateTitleTh}\n\n`;
      Object.keys(itemsGroup).forEach(k => {
        out += `${k}\n`;
        Object.keys(itemsGroup[k].prices).forEach(tier => {
          out += `${tier.replace(' COD', '')} ${itemsGroup[k].prices[tier]} ออเดอร์ COD\n`;
        });
        out += `ยอดขาย${k} ${itemsGroup[k].subtotal.toLocaleString()} บาท\n\n`;
      });
      out += `━━━━━━━━━━━━━━━━━━━━\n`;
      out += `📊 สรุปรวมผลประกอบการทั้งหมด\n`;
      out += `💰 ยอดเงินรวม: ${totalRev.toLocaleString()} บาท\n`;
      out += `📦 จำนวนออเดอร์: ${targetList.length} ออเดอร์\n`;
      out += `🛍️ จำนวนสินค้า: ${totalUnits} ชิ้น\n`;
      out += `👥 จำนวนคนทัก: ${totalInq} คน\n`;
      out += `🎯 เปอร์เซ็นต์ปิดการขาย: ${convRate}%\n`;

      setSummaryText(out.trim());
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleOpenSummaryModal = (cat: 'ALL' | 'CHINA' | 'AMULET' | 'OTOP' | 'AGRICULTURE' = 'ALL') => {
    setIsAiSummaryModalOpen(true);
    handleGenerateSummary(cat, summaryDateScope);
  };

  const handleCopySummaryText = () => {
    if (!summaryText) return;
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  const handleSendSummaryToNotify = async (channel: 'LINE' | 'TELEGRAM') => {
    setSendNotifyStatus(`กำลังส่งสรุปยอดเข้า ${channel}...`);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          page_id: pages[0]?.page_id || 'AMULET_PAGE_ID',
          page_name: 'สรุปปิดยอดประจำวัน Vorakamol AI Hub',
          custom_message: summaryText
        })
      });
      const data = await res.json();
      setSendNotifyStatus(data.message || `ส่งสรุปยอดเข้า ${channel} เรียบร้อยแล้ว! 🚀`);
      setTimeout(() => setSendNotifyStatus(null), 4000);
    } catch (err: any) {
      setSendNotifyStatus(`ส่งไม่สำเร็จ: ${err.message}`);
      setTimeout(() => setSendNotifyStatus(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── สรุปบัญชีจริง (ต้นทุนสินค้า + งบแอด + ค่าใช้จ่าย + กำไร) ── */}
      <div className="bg-white dark:bg-[#0F0F12] border-2 border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            💰 สรุปบัญชีจริง — กำไรขาดทุนจากตัวเลขที่กรอกเอง
          </h3>
          <button onClick={fetchAccounting} disabled={accLoading} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${accLoading ? 'animate-spin' : ''}`} /> รีเฟรช
          </button>
        </div>
        {accSummary ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              {[
                { label: 'ยอดขายวันนี้', val: accSummary.today.revenue, cls: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'ต้นทุนสินค้า', val: accSummary.today.productCost, cls: 'text-rose-600 dark:text-rose-400' },
                { label: 'งบแอดวันนี้', val: accSummary.today.adSpend, cls: 'text-orange-600 dark:text-orange-400' },
                { label: 'ค่าใช้จ่ายอื่น', val: accSummary.today.otherCost, cls: 'text-slate-500 dark:text-zinc-400' },
                { label: 'ออเดอร์วันนี้', val: accSummary.today.orders, cls: 'text-indigo-600 dark:text-indigo-400' },
                { label: '💰 กำไรสุทธิวันนี้', val: accSummary.today.profit, cls: accSummary.today.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' }
              ].map(item => (
                <div key={item.label} className="rounded-xl bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 p-3 text-center">
                  <div className={`text-lg font-black font-mono ${item.cls}`}>{typeof item.val === 'number' && item.label !== 'ออเดอร์วันนี้' ? '฿' : ''}{typeof item.val === 'number' ? item.val.toLocaleString() : item.val}</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mt-0.5">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'ยอดขายรวมทั้งหมด', val: accSummary.all.revenue },
                { label: 'ต้นทุนรวมทั้งหมด', val: accSummary.all.productCost },
                { label: 'ค่าส่งรวม (ต่อชิ้น)', val: accSummary.all.shipping },
                { label: 'กำไรรวมทั้งหมด', val: accSummary.all.profit }
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">{item.label}</span>
                  <span className="font-mono font-black text-slate-800 dark:text-zinc-100">฿{item.val.toLocaleString()}</span>
                </div>
              ))}
            </div>
            {accSummary.perPage.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">รายเพจ (วันนี้ — เฉพาะเพจที่มียอด/งบ):</p>
                {accSummary.perPage.map((p: any) => (
                  <div key={p.page_id} className="flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-[#16161C]">
                    <span className="truncate flex-1 font-medium text-slate-700 dark:text-zinc-200">{p.page_name}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">ขาย ฿{p.revenue.toLocaleString()}</span>
                    <span className="font-mono text-orange-500">แอด ฿{p.adSpend.toLocaleString()}</span>
                    <span className={`font-mono font-bold ${p.profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>กำไร ฿{p.profit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-3">
              กรอกงบแอด/ค่าส่ง/ค่าใช้จ่ายของแต่ละเพจได้ที่: ตั้งค่าเพจ → แท็บ "12. บัญชี & กำไรรายวัน 💰" | ต้นทุนสินค้ากรอกได้ที่ฐานข้อมูลสินค้า
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500 dark:text-zinc-400">กำลังโหลดข้อมูลบัญชี...</p>
        )}
      </div>
      {/* ── ปุ่มกรอกค่าใช้จ่ายรายวัน + ตั้งค่ารายงานอัตโนมัติ ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5" /> ค่าใช้จ่ายวันนี้ (งบแอด/ค่าส่ง)
              {expensePendingCount !== null && expensePendingCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white">{expensePendingCount} เพจรอกรอก</span>
              )}
            </p>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              แสดงเฉพาะเพจที่มีแชท/ออเดอร์เข้าวันนี้ — เพจที่เงียบจะไม่ถูกเด้ง
            </p>
          </div>
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
          >
            กรอกค่าใช้จ่ายวันนี้
          </button>
        </div>

        <div className={`rounded-2xl p-4 border ${dark ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-500" /> รายงานอัตโนมัติ → Telegram/LINE
            </p>
            {scheduleSaved && <span className="text-[10px] font-bold text-emerald-500">{scheduleSaved}</span>}
          </div>
          {schedule ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={schedule.daily.enabled} onChange={e => setSchedule({ ...schedule, daily: { ...schedule.daily, enabled: e.target.checked } })} className="accent-indigo-600" />
                  <b>รายงานผู้บริหาร</b> เวลา
                </label>
                <input type="time" value={schedule.daily.time} onChange={e => setSchedule({ ...schedule, daily: { ...schedule.daily, time: e.target.value } })} className={`rounded-lg px-2 py-1 border text-xs outline-none ${dark ? 'bg-[#16161C] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'}`} />
                <span className="text-slate-400">(เวลาไทย — default เที่ยงคืน)</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={schedule.interval.enabled} onChange={e => setSchedule({ ...schedule, interval: { ...schedule.interval, enabled: e.target.checked } })} className="accent-indigo-600" />
                  <b>รายงานย่อทุก</b>
                </label>
                <input type="number" min={1} max={24} value={schedule.interval.every_hours} onChange={e => setSchedule({ ...schedule, interval: { ...schedule.interval, every_hours: Number(e.target.value) || 3 } })} className={`w-14 rounded-lg px-2 py-1 border text-xs outline-none ${dark ? 'bg-[#16161C] border-zinc-800 text-zinc-100' : 'bg-white border-slate-200'}`} />
                <span className="text-slate-400">ชั่วโมง</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={saveSchedule} disabled={scheduleSaving} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold disabled:opacity-50 flex items-center gap-1.5">
                  {scheduleSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} บันทึกตาราง
                </button>
                <button onClick={() => sendReportNow('daily')} disabled={reportSending} className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-50">
                  ส่งรายงานเดี๋ยวนี้
                </button>
                {reportStatus && <span className="text-[10px] font-medium text-emerald-500">{reportStatus}</span>}
              </div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500">ส่งเข้า Telegram/LINE ของแต่ละเพจตามที่ตั้งไว้ในแท็บ 8. ส่งสรุปไป Telegram/LINE</p>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">กำลังโหลดตารางรายงาน...</p>
          )}
        </div>
      </div>

      {expenseModalOpen && (
        <ExpenseReminderModal
          theme={theme}
          onClose={() => closeExpenseModal(true)}
          onSaved={() => { fetchAccounting(); }}
        />
      )}

      {/* SECTION 1: EXECUTIVE FINANCIAL & OPERATIONAL KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Gross Revenue & Profit */}
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">ยอดขายรวมสุทธิ</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-zinc-100">
              ฿{totalRevenue.toLocaleString()}
            </span>
            <span className={`text-xs font-bold flex items-center ${
              realGrowthPercent !== null && realGrowthPercent < 0
                ? 'text-rose-500'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {realGrowthPercent !== null && realGrowthPercent < 0
                ? <ArrowDownRight className="w-3.5 h-3.5" />
                : <ArrowUpRight className="w-3.5 h-3.5" />}
              {realGrowthPercent !== null
                ? `${realGrowthPercent > 0 ? '+' : ''}${realGrowthPercent}%`
                : '—'}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-zinc-400">กำไรประมาณการ (GP):</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              ฿{grossProfit.toLocaleString()} ({grossProfitMargin}%)
            </span>
          </div>
        </div>

        {/* 2. Inbound Leads & Closing Conversion */}
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">ลูกค้าทักเข้า & ปิดการขาย</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-zinc-100">
              {totalInquiries} <span className="text-xs font-normal text-slate-500">คน</span>
            </span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full">
              ปิดได้ {totalOrdersCount} บิล
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-zinc-400">% ปิดการขาย SuperAI:</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">
              {conversionRatePercent}% อัตโนมัติ
            </span>
          </div>
        </div>

        {/* 3. Average Order Value (AOV) & Basket Size */}
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">ยอดเฉลี่ยต่อบิล (AOV)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-zinc-100">
              ฿{avgOrderValue.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              เฉลี่ย {avgItemsPerOrder} ชิ้น/ออเดอร์
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-zinc-400">สินค้าขายดี:</span>
            <span className="font-medium text-slate-700 dark:text-zinc-300">
              {totalOrdersCount > 0 ? `${totalItemsSold} ชิ้นที่ปิดการขายได้` : '-'}
            </span>
          </div>
        </div>

        {/* 4. ROAS & Ad Efficiency Simulator */}
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">ผลตอบแทนค่าโฆษณา (ROAS)</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-purple-600 dark:text-purple-300">
              {roasMultiplier}x
            </span>
            <span className={`text-xs font-bold ${
              netProfitAfterAds > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : netProfitAfterAds < 0
                ? 'text-rose-500'
                : 'text-slate-500 dark:text-zinc-400'
            }`}>
              กำไรสุทธิ ฿{netProfitAfterAds.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-zinc-400">ต้นทุนต่อบิล (CPA):</span>
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">฿{costPerAcquisition} / ออเดอร์</span>
          </div>
        </div>
      </div>

      {/* SECTION 2: BUSINESS TARGET VS ACTUAL GOAL PROGRESS BANNER */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-300" />
                เป้าหมายประจำเดือน (Monthly Sales Goal)
              </span>
              <span className="text-xs text-indigo-200 font-mono">
                {goalProgressPercent}% บรรลุแล้ว
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
              ยอดขายปัจจุบัน ฿{totalRevenue.toLocaleString()} / เป้า ฿{monthlySalesGoal.toLocaleString()}
            </h3>
            <p className="text-xs text-indigo-200 leading-relaxed">
              เหลืออีก <strong className="text-emerald-300 font-mono">฿{remainingGoal.toLocaleString()}</strong> ภายใน {remainingDays} วัน • ต้องทำยอดเฉลี่ยวันละ <strong className="text-amber-300 font-mono">฿{dailyRunRateNeeded.toLocaleString()}</strong> เพื่อพิชิตเป้า (คาดการณ์สิ้นเดือน ฿{projectedMonthRevenue.toLocaleString()})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-2 flex items-center gap-2 text-xs">
              <span className="text-indigo-200">ปรับเป้า:</span>
              <select
                value={monthlySalesGoal}
                onChange={e => setMonthlySalesGoal(Number(e.target.value))}
                className="bg-slate-900 text-white font-mono font-bold text-xs rounded-lg px-2.5 py-1 outline-none border border-white/20 cursor-pointer"
              >
                <option value={30000}>฿30,000</option>
                <option value={50000}>฿50,000</option>
                <option value={100000}>฿100,000</option>
                <option value={200000}>฿200,000</option>
                <option value={500000}>฿500,000</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="mt-4 w-full bg-black/30 h-3 rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-700 shadow-sm"
            style={{ width: `${goalProgressPercent}%` }}
          />
        </div>
      </div>

      {/* SECTION 3: MAIN VIEW SWITCHER & CONTROLS TOOLBAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              ศูนย์รวมการวิเคราะห์ธุรกิจ & แดชบอร์ดปฏิทินอัจฉริยะ
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              สลับมุมมองระหว่างปฏิทินรายวัน, กราฟสถิติยอดขาย, เครื่องคำนวณกำไร/ROAS, และตารางจัดอันดับเพจ
            </p>
          </div>
        </div>

        {/* View Mode Navigation Pills & AI Summary Trigger */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenSummaryModal('ALL')}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all hover:scale-105 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>✨ AI สรุปปิดยอดขายแยกหมวด</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 p-1.5 rounded-xl text-xs">
            <button
              onClick={() => setDashboardView('calendar')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                dashboardView === 'calendar'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>ปฏิทินออเดอร์ (Calendar)</span>
            </button>

            <button
              onClick={() => setDashboardView('charts')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                dashboardView === 'charts'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>กราฟธุรกิจ (Sales Charts)</span>
            </button>

            <button
              onClick={() => setDashboardView('calculator')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                dashboardView === 'calculator'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>คำนวณกำไร & ROAS</span>
            </button>

            <button
              onClick={() => setDashboardView('overview')}
              className={`px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                dashboardView === 'overview'
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm border border-slate-200 dark:border-transparent'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              <span>แร้งกิ้งเพจขายดี</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE CALENDAR VIEW WITH EMBEDDED REVENUE GRAPH */}
      {dashboardView === 'calendar' && (
        <div className="space-y-6">
          {/* Mini Embedded Daily Revenue Bar Chart on Top of Calendar */}
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  กราฟแท่งยอดขายรายวันตลอดเดือนสิงหาคม (Daily Sales Heatmap)
                </h4>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                เฉลี่ยวันละ ฿{Math.round(totalRevenue / 22).toLocaleString()} / วัน
              </span>
            </div>

            {/* Micro Bar Timeline (Clickable to jump to day) */}
            <div className="h-28 flex items-end justify-between gap-1.5 pt-4 pb-1">
              {dailyTimeline.map((item, idx) => {
                const heightPercent = Math.max(8, Math.round((item.revenue / maxDailyRevenue) * 100));
                const isSelected = selectedDateStr === item.dateStr;
                const hasSales = item.revenue > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectDay(item.day)}
                    className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer"
                  >
                    {/* Hover Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-9 bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20 font-mono font-bold">
                      {item.day} ส.ค.: ฿{item.revenue.toLocaleString()} ({item.orders} บิล)
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-[#141418] rounded-t-md h-20 flex items-end p-0.5">
                      <div
                        className={`w-full rounded-t transition-all duration-300 ${
                          isSelected
                            ? 'bg-indigo-600 shadow-sm'
                            : hasSales
                            ? 'bg-emerald-500 hover:bg-emerald-600'
                            : 'bg-slate-300 dark:bg-zinc-800'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-mono ${isSelected ? 'font-bold text-indigo-600' : 'text-slate-500'}`}>
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main 2-Column Calendar & Day Detail Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Columns: Monthly Calendar Grid */}
            <div className="lg:col-span-8 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              {/* Month Navigation Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      {monthNamesThai[month]} {year + 543}
                      <span className="text-xs font-mono font-normal text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
                        {orders.length} ออเดอร์ทั้งระบบ
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      คลิกวันที่เพื่อเปิดดูสรุปยอดและออเดอร์ลูกค้าของวันนั้น
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleJumpToday}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#141418] dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                  >
                    วันนี้ (22 ส.ค.)
                  </button>
                  <button
                    onClick={handlePrevMonth}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#141418] dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-all"
                    title="เดือนก่อนหน้า"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#141418] dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl transition-all"
                    title="เดือนถัดไป"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 dark:text-zinc-400 py-1">
                <div className="text-rose-500">อา.</div>
                <div>จ.</div>
                <div>อ.</div>
                <div>พ.</div>
                <div>พฤ.</div>
                <div>ศ.</div>
                <div className="text-indigo-600">ส.</div>
              </div>

              {/* Month Days Grid Cells */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells before month starts */}
                {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="h-20 sm:h-24 bg-slate-50 dark:bg-[#0A0A0C]/40 border border-slate-100 dark:border-zinc-900 rounded-xl opacity-40"
                  />
                ))}

                {/* Actual month day cells */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const day = idx + 1;
                  const formattedMonth = String(month + 1).padStart(2, '0');
                  const formattedDay = String(day).padStart(2, '0');
                  const dateKey = `${year}-${formattedMonth}-${formattedDay}`;
                  const dayData = ordersByDate[dateKey];
                  const hasOrders = Boolean(dayData && dayData.count > 0);
                  const isSelected = selectedDateStr === dateKey;
                  const isToday = day === 22 && month === 7 && year === 2026;

                  return (
                    <div
                      key={`day-${day}`}
                      onClick={() => handleSelectDay(day)}
                      className={`h-20 sm:h-24 p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500 shadow-md ring-2 ring-indigo-400'
                          : hasOrders
                          ? 'bg-white dark:bg-[#141418] border-emerald-200 dark:border-zinc-800 hover:border-emerald-400 hover:shadow-sm'
                          : 'bg-slate-50/50 dark:bg-[#0A0A0C] border-slate-200/60 dark:border-zinc-900/80 hover:border-slate-300'
                      }`}
                    >
                      {/* Top Date Header */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold font-mono rounded-md w-6 h-6 flex items-center justify-center ${
                            isToday
                              ? 'bg-indigo-600 text-white font-black'
                              : isSelected
                              ? 'bg-indigo-200 dark:bg-indigo-500 text-indigo-900 dark:text-white'
                              : 'text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          {day}
                        </span>

                        {hasOrders && (
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                            {dayData.count}
                          </span>
                        )}
                      </div>

                      {/* Bottom Daily Revenue Total */}
                      {hasOrders ? (
                        <div className="mt-1">
                          <span className="text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400 block truncate">
                            ฿{dayData.totalAmount.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-zinc-400 hidden sm:block">
                            {dayData.count} ออเดอร์
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 dark:text-zinc-600">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 4 Columns: Selected Day Deep Dive Drawer */}
            <div className="lg:col-span-4 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                {/* Header for Selected Day */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                      รายละเอียดประจำวัน
                    </span>
                    <h4 className="text-base font-black font-mono text-slate-900 dark:text-zinc-100 mt-0.5 flex items-center gap-1.5">
                      📅 {selectedDateStr}
                    </h4>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                    {selectedDayOrders?.length || 0} รายการ
                  </span>
                </div>

                {/* Day Financial Snapshot Box */}
                <div className="mt-3.5 bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">ยอดขายรวมของวันนี้:</span>
                    <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                      ฿{selectedDayTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400">กำไรประมาณการ (GP):</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300">
                      ฿{selectedDayProfit.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Orders List for this Day */}
                <div className="mt-4 space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {!selectedDayOrders || selectedDayOrders.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
                      <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
                      <p className="text-xs font-medium">ไม่มีคำสั่งซื้อในวันที่เลือก</p>
                      <p className="text-[11px] text-slate-400">
                        ลองคลิกวันที่ที่มีแถบสีเขียว เช่น 22, 21, 20, 19 ส.ค.
                      </p>
                    </div>
                  ) : (
                    selectedDayOrders.map((order, idx) => (
                      <div
                        key={order.order_id || idx}
                        className="bg-white dark:bg-[#141418] border border-slate-200 dark:border-zinc-800/80 rounded-xl p-3.5 space-y-2 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {order.customer_name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                              order.payment_status === 'PAID'
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                : order.payment_status === 'SHIPPED'
                                ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                                : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30'
                            }`}
                          >
                            {order.payment_status === 'PAID' ? 'ชำระแล้ว (PAID)' : order.payment_status === 'SHIPPED' ? 'จัดส่งแล้ว (SHIPPED)' : 'เก็บเงินปลายทาง (COD)'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium line-clamp-1">
                          📦 {order.items}
                        </p>

                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                          📍 {order.shipping_address}
                        </p>

                        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                            📞 {order.phone_number}
                          </span>
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            ฿{(order.total_amount || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bottom Quick Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2">
                <button
                  onClick={() => {
                    setSummaryDateScope('selected');
                    handleOpenSummaryModal('ALL');
                  }}
                  disabled={!selectedDayOrders || selectedDayOrders.length === 0}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>🤖 สรุปปิดยอดวันที่ {selectedDateStr} (แยกหมวด & สถิติ)</span>
                </button>

                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  disabled={!selectedDayOrders || selectedDayOrders.length === 0}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ใบสรุปออเดอร์ประจำวัน ({selectedDayOrders?.length || 0} รายการ)</span>
                </button>

                <button
                  onClick={() => onSelectPageAndChat(pages[0]?.page_id || 'AMULET_PAGE_ID')}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>ทดสอบรับออเดอร์ใหม่ผ่านแชทจำลอง</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: EXECUTIVE SALES CHARTS & MULTI-METRIC VISUALIZATIONS */}
      {dashboardView === 'charts' && (
        <div className="space-y-6">
          {/* Metric Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">ดูกราฟสถิติ:</span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setChartMetric('revenue')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    chartMetric === 'revenue' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  ยอดขาย (Revenue ฿)
                </button>
                <button
                  onClick={() => setChartMetric('orders')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    chartMetric === 'orders' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  จำนวนบิล (Orders)
                </button>
                <button
                  onClick={() => setChartMetric('profit')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    chartMetric === 'profit' ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  กำไรสุทธิ (Profit GP)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> ยอดจริง
              </span>
              <span className="flex items-center gap-1 text-indigo-600 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> ปิดด้วย AI 100%
              </span>
            </div>
          </div>

          {/* Main Chart Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Sales Trend Bar / Column Chart (8 Cols) */}
            <div className="lg:col-span-8 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                      แนวโน้มยอดขายรายวัน (Daily Revenue Trajectory)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    สถิติคำสั่งซื้อจริงจากการปิดการขายอัตโนมัติ 24 ชม.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  +34.2% MoM
                </span>
              </div>

              {/* Chart Visual Bars */}
              <div className="h-64 flex items-end justify-between gap-2 pt-6 pb-2 px-2">
                {dailyTimeline.map((item, idx) => {
                  const val = chartMetric === 'revenue' ? item.revenue : chartMetric === 'orders' ? item.orders * 400 : item.profit;
                  const maxVal = chartMetric === 'revenue' ? maxDailyRevenue : chartMetric === 'orders' ? 10 * 400 : maxDailyRevenue * 0.7;
                  const heightPercent = Math.max(6, Math.round((val / maxVal) * 100));
                  const isLatest = idx >= 15;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                      {/* Tooltip on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] px-2.5 py-1 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20 font-mono font-bold">
                        {item.label}: {chartMetric === 'orders' ? `${item.orders} บิล` : `฿${val.toLocaleString()}`}
                      </div>

                      {/* Bar Column */}
                      <div className="w-full bg-slate-100 dark:bg-[#141418] rounded-t-lg h-48 flex items-end p-1">
                        <div
                          className={`w-full rounded-md transition-all duration-500 ${
                            isLatest
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400 group-hover:brightness-110'
                              : 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:brightness-110'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      {/* X Axis Label */}
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono whitespace-nowrap">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category Revenue Distribution & Share (4 Cols) */}
            <div className="lg:col-span-4 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-zinc-800/80 pb-4">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    สัดส่วนรายได้ตามหมวดหมู่
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  การกระจายยอดขายแยกตามประเภทสินค้า 3 ตาราง
                </p>
              </div>

              {/* Progress Bars for Categories */}
              <div className="space-y-4 pt-2">
                {/* Amulet */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      📿 พระเครื่อง & วัตถุมงคล
                    </span>
                    <span className="font-mono font-bold text-amber-600">
                      ฿{categorySplit.amulet.toLocaleString()} ({Math.round((categorySplit.amulet / categorySplit.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${Math.round((categorySplit.amulet / categorySplit.total) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* China */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      📦 สินค้านำเข้า & ไอที
                    </span>
                    <span className="font-mono font-bold text-indigo-600">
                      ฿{categorySplit.china.toLocaleString()} ({Math.round((categorySplit.china / categorySplit.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.round((categorySplit.china / categorySplit.total) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* OTOP */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                      🌾 สินค้าชุมชน OTOP
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      ฿{categorySplit.otop.toLocaleString()} ({Math.round((categorySplit.otop / categorySplit.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{ width: `${Math.round((categorySplit.otop / categorySplit.total) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Peak Sales Time Analysis */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50 dark:bg-[#141418] rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-600" /> ช่วงเวลาที่ลูกค้าสั่งซื้อมากที่สุด (Golden Hours)
                </span>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-600 dark:text-zinc-400">19:00 - 23:00 น. (ช่วงค่ำ)</span>
                  <span className="text-purple-600 font-bold">58% ของยอดขาย</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-600 h-full rounded-full w-[58%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: HEAVY-DUTY BUSINESS PROFIT & ROAS CALCULATOR SUITE ("ฟังชันแบบธุรกิจจัดหนักมาเลย คำนวนทั้งหมดแบบล้ำๆ") */}
      {dashboardView === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Simulation Inputs (5 Cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Calculator className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  เครื่องจำลองโมเดลธุรกิจ & ค่าโฆษณา (ROAS Simulator)
                </h3>
                <p className="text-xs text-slate-500">ปรับค่าพารามิเตอร์เพื่อคำนวณกำไรสุทธิและจุดคุ้มทุน</p>
              </div>
            </div>

            {/* Input 1: Monthly Ad Spend */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">งบโฆษณา Facebook Ads (บาท/เดือน):</label>
                <span className="font-mono font-bold text-purple-600">฿{adSpendInput.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={50000}
                step={500}
                value={adSpendInput}
                onChange={e => setAdSpendInput(Number(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
              <div className="flex gap-2">
                {[3000, 5000, 10000, 20000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setAdSpendInput(amt)}
                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-all"
                  >
                    ฿{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 2: Product COGS % */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">ต้นทุนสินค้าเฉลี่ย (COGS %):</label>
                <span className="font-mono font-bold text-indigo-600">{cogsPercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={70}
                step={5}
                value={cogsPercent}
                onChange={e => setCogsPercent(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Input 3: Shipping Cost Per Parcel */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800">ค่าขนส่งเฉลี่ยต่อพัสดุ (บาท/กล่อง):</label>
                <span className="font-mono font-bold text-emerald-600">฿{shippingPerOrder}</span>
              </div>
              <input
                type="range"
                min={25}
                max={100}
                step={5}
                value={shippingPerOrder}
                onChange={e => setShippingPerOrder(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Right Column: Dynamic Financial Statement & Calculated Insights (7 Cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  งบกำไรขาดทุนจำลอง (Projected P&L Statement)
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                ROAS: {roasMultiplier} เท่า
              </span>
            </div>

            {/* P&L Statement Table */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600 font-sans">1. รายรับยอดขายรวม (Gross Revenue)</span>
                <span className="font-bold text-slate-900 text-sm">฿{totalRevenue.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-rose-600">
                <span className="font-sans">2. หัก ต้นทุนสินค้า ({cogsPercent}%)</span>
                <span className="font-bold">-฿{estimatedCOGS.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-rose-600">
                <span className="font-sans">3. หัก ค่าจัดส่งพัสดุ ({totalOrdersCount} กล่อง × ฿{shippingPerOrder})</span>
                <span className="font-bold">-฿{estimatedShippingCost.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100 text-purple-600">
                <span className="font-sans">4. หัก ค่าโฆษณา Facebook Ads</span>
                <span className="font-bold">-฿{adSpendInput.toLocaleString()}</span>
              </div>

              {/* Bottom Line Net Profit */}
              <div className="flex items-center justify-between p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 rounded-xl text-emerald-800 dark:text-emerald-300">
                <div>
                  <span className="font-bold font-sans text-sm block">กำไรสุทธิคงเหลือจริง (Net Profit)</span>
                  <span className="text-[11px] text-emerald-600 font-sans">หลังหักสินค้า ค่าส่ง และค่าแอด</span>
                </div>
                <span className="text-xl font-black font-mono">
                  ฿{netProfitAfterAds.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Business KPI Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block font-sans">CPA (ต้นทุนต่อบิล)</span>
                <span className="text-sm font-bold font-mono text-purple-600">฿{costPerAcquisition}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block font-sans">Break-Even ROAS</span>
                <span className="text-sm font-bold font-mono text-indigo-600">{breakEvenROAS}x</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] text-slate-500 block font-sans">อัตรากำไรขั้นต้น (GP%)</span>
                <span className="text-sm font-bold font-mono text-emerald-600">{grossProfitMargin}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: PAGE LEADERBOARD RANKING (3 Podium Cards + Detailed Table) */}
      {dashboardView === 'overview' && (
        <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold">
                  <Crown className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  ตารางจัดอันดับเพจขายดีที่สุด (Page Sales Leaderboard)
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                เปรียบเทียบยอดขายรวม, จำนวนออเดอร์, และประสิทธิภาพของโมเดล AI ในแต่ละเพจ
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">ช่วงเวลา:</span>
              <div className="bg-slate-100 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-lg p-1 flex gap-1 text-xs">
                <button
                  onClick={() => setTimeFilter('all')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    timeFilter === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setTimeFilter('today')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    timeFilter === 'today' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  วันนี้
                </button>
              </div>
            </div>
          </div>

          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {pageRankings.slice(0, 3).map((item, index) => {
              const rank = index + 1;
              const isTop1 = rank === 1;
              const isTop2 = rank === 2;

              return (
                <div
                  key={item.page.page_id}
                  className={`rounded-2xl p-5 border relative overflow-hidden transition-all ${
                    isTop1
                      ? 'bg-amber-50/60 border-amber-300 shadow-sm ring-1 ring-amber-400/40'
                      : isTop2
                      ? 'bg-slate-50 border-slate-300 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Rank Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${
                          isTop1
                            ? 'bg-amber-400 text-zinc-950 shadow-amber-400/30'
                            : isTop2
                            ? 'bg-slate-300 text-zinc-950'
                            : 'bg-amber-700 text-white'
                        }`}
                      >
                        #{rank}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isTop1 ? 'text-amber-700' : isTop2 ? 'text-slate-700' : 'text-amber-800'
                        }`}
                      >
                        {isTop1 ? '🥇 อันดับ 1 ยอดขายสูงสุด' : isTop2 ? '🥈 อันดับ 2' : '🥉 อันดับ 3'}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-slate-600 bg-slate-200 px-2 py-0.5 rounded border border-slate-300">
                      {item.model}
                    </span>
                  </div>

                  {/* Page Name & Product */}
                  <h4 className="font-bold text-sm text-slate-900 line-clamp-1 mb-1">
                    {item.page.page_name}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mb-4 flex items-center gap-1.5">
                    <span className="text-indigo-600 font-medium">สินค้า:</span> {item.topProduct}
                  </p>

                  {/* Revenue & Orders Counter */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">ยอดขายรวม:</span>
                      <span className="text-base font-black font-mono text-emerald-600">
                        ฿{item.revenue.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="text-slate-500">ลูกค้าทัก / ปิดยอด:</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {item.inquiriesCount} คน → {item.orderCount} บิล ({item.conversionRate}%)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <span className="text-slate-500">กำไรสุทธิ (Est.):</span>
                      <span className="font-mono font-bold text-emerald-600">
                        ฿{item.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectPageAndChat(item.page.page_id)}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      เปิดแชท
                    </button>
                    <button
                      onClick={() => onOpenPageSettings(item.page.page_id)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-lg transition-all"
                      title="ตั้งค่าเพจนี้"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRINT/EXPORT DAY ORDERS SUMMARY MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  ใบสรุปรายการคำสั่งซื้อประจำวัน (Manifest / Order Summary)
                </h3>
                <p className="text-xs text-slate-500">วันที่ {selectedDateStr} • Vorakamol SuperAI Chatbot Hub</p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Printable Manifest Preview */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 font-mono text-xs max-h-96 overflow-y-auto">
              <div className="border-b border-slate-200 pb-2 flex justify-between font-bold text-slate-800">
                <span>ลำดับ / ชื่อลูกค้า</span>
                <span>สินค้า / ยอดชำระ</span>
              </div>
              {(selectedDayOrders || []).map((o, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-slate-200/60">
                  <div>
                    <span className="font-bold">{idx + 1}. {o.customer_name}</span>
                    <span className="block text-[11px] text-slate-500">{o.phone_number} • {o.shipping_address}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-600">฿{(o.total_amount || 0).toLocaleString()}</span>
                    <span className="block text-[10px] text-slate-500">{o.payment_status}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 flex justify-between font-bold text-sm text-slate-900 border-t-2 border-slate-300">
                <span>ยอดรวมทั้งสิ้น ({selectedDayOrders?.length} รายการ):</span>
                <span className="text-emerald-600">฿{selectedDayTotal.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> พิมพ์เอกสาร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI SALES CLOSING SUMMARY MODAL (หมวดสินค้า + ราคา + คนทัก + % ปิดการขาย) */}
      {isAiSummaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-[#111116] rounded-2xl max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-zinc-800 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    AI สรุปปิดยอดขาย & วิเคราะห์ผลประกอบการ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    สรุปแยกทุกหมวดสินค้า รายการราคา ออเดอร์ COD และสรุปรวมท้ายข้อความ (ยอดรวม/ออเดอร์/ชิ้น/คนทัก/อัตราปิด)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiSummaryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Filter Pills Controls */}
            <div className="space-y-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl p-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 dark:text-zinc-400 font-bold mr-1">หมวดสินค้า:</span>
                  <button
                    onClick={() => handleGenerateSummary('ALL', summaryDateScope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryCategory === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    🌟 ทุกหมวดรวม
                  </button>
                  <button
                    onClick={() => handleGenerateSummary('CHINA', summaryDateScope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryCategory === 'CHINA'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    🇨🇳 ของจีน (เสาอากาศ/ชุดบล็อก/เครื่องฟอก)
                  </button>
                  <button
                    onClick={() => handleGenerateSummary('AMULET', summaryDateScope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryCategory === 'AMULET'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    🙏 พระเครื่อง
                  </button>
                  <button
                    onClick={() => handleGenerateSummary('OTOP', summaryDateScope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryCategory === 'OTOP'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    🌾 โอทอป
                  </button>
                  <button
                    onClick={() => handleGenerateSummary('AGRICULTURE', summaryDateScope)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryCategory === 'AGRICULTURE'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    🌱 เกษตร
                  </button>
                </div>

                {/* Date Scope Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-500 dark:text-zinc-400 font-bold mr-1">ช่วงเวลา:</span>
                  <button
                    onClick={() => handleGenerateSummary(summaryCategory, 'selected')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryDateScope === 'selected'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    📅 วันที่ {selectedDateStr}
                  </button>
                  <button
                    onClick={() => handleGenerateSummary(summaryCategory, 'today')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryDateScope === 'today'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    ⚡ วันนี้ (22 ส.ค.)
                  </button>
                  <button
                    onClick={() => handleGenerateSummary(summaryCategory, 'all')}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      summaryDateScope === 'all'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100'
                    }`}
                  >
                    📊 ยอดสะสมทั้งหมด
                  </button>
                </div>
              </div>
            </div>

            {/* Notification alert banner if any */}
            {sendNotifyStatus && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{sendNotifyStatus}</span>
              </div>
            )}

            {/* Formatted Text Preview Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  ข้อความสรุปยอด (พร้อมคัดลอกลง LINE / Telegram / Facebook Messenger):
                </label>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                  {isGeneratingSummary ? '⚡ กำลังประมวลผล...' : '✏️ สามารถพิมพ์แก้ไขเพิ่มเติมได้'}
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={summaryText}
                  onChange={e => setSummaryText(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-900 text-emerald-400 font-mono text-xs sm:text-[13px] leading-relaxed p-4 rounded-xl border border-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none select-text resize-none"
                  placeholder="กำลังคำนวณสรุปยอด..."
                />

                {isGeneratingSummary && (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 rounded-xl text-white text-xs font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                    <span>AI กำลังดึงข้อมูลและจัดหมวดหมู่ปิดยอด...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerateSummary(summaryCategory, summaryDateScope)}
                  disabled={isGeneratingSummary}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
                  <span>คำนวณใหม่</span>
                </button>

                <button
                  onClick={() => handleSendSummaryToNotify('LINE')}
                  className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>🟢 ส่งเข้า LINE</span>
                </button>

                <button
                  onClick={() => handleSendSummaryToNotify('TELEGRAM')}
                  className="px-3 py-2 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-700/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <span>✈️ ส่งเข้า Telegram</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAiSummaryModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  onClick={handleCopySummaryText}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all hover:scale-105 cursor-pointer"
                >
                  {copiedSummary ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>คัดลอกข้อความสำเร็จแล้ว! ✅</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span>📋 คัดลอกข้อความสรุปยอด</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
