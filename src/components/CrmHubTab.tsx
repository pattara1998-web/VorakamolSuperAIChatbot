import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Phone,
  MapPin,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Copy,
  Check,
  PhoneCall,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Layers,
  FileText,
  Clock,
  Send,
  Database,
  X,
  Package,
  SlidersHorizontal,
  Eye,
  EyeOff,
  MoveLeft,
  MoveRight,
  RotateCcw,
  CheckSquare,
  Square,
  Columns,
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Customer, Order, PageConfig, ProductCategory } from '../types';

export type CrmColumnId =
  | 'actions'
  | 'name_tier'
  | 'phone'
  | 'address'
  | 'products_history'
  | 'total_spent'
  | 'order_count'
  | 'tracking_notes';

export interface CrmColumnConfig {
  id: CrmColumnId;
  label: string;
  visible: boolean;
  sortKey?: string;
  align?: 'left' | 'center' | 'right';
  minWidth?: string;
}

const DEFAULT_CRM_COLUMNS: CrmColumnConfig[] = [
  { id: 'actions', label: 'จัดการ', visible: true, minWidth: 'w-24' },
  { id: 'name_tier', label: 'ชื่อลูกค้า & ระดับ', visible: true, sortKey: 'NAME', minWidth: 'min-w-[180px]' },
  { id: 'phone', label: 'เบอร์โทรศัพท์', visible: true, sortKey: 'PHONE', minWidth: 'min-w-[140px]' },
  { id: 'address', label: 'ที่อยู่จัดส่งพัสดุ', visible: true, sortKey: 'ADDRESS', minWidth: 'min-w-[220px]' },
  { id: 'products_history', label: 'สินค้าที่สั่งซื้อ & ประวัติ', visible: true, minWidth: 'min-w-[200px]' },
  { id: 'total_spent', label: 'ยอดสั่งซื้อรวม', visible: true, sortKey: 'SPENT', minWidth: 'min-w-[110px]', align: 'right' },
  { id: 'order_count', label: 'ซื้อซ้ำ', visible: true, sortKey: 'ORDERS', minWidth: 'min-w-[90px]', align: 'center' },
  { id: 'tracking_notes', label: 'เลขพัสดุ & บันทึก', visible: true, sortKey: 'TRACKING', minWidth: 'min-w-[160px]' }
];

interface CrmHubTabProps {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  pages: PageConfig[];
  onSaveToBackend: (collection: string, data: any[]) => void;
}

export const CrmHubTab: React.FC<CrmHubTabProps> = ({
  customers,
  setCustomers,
  orders,
  setOrders,
  pages,
  onSaveToBackend
}) => {
  // Column Selection & Ordering State
  const [columns, setColumns] = useState<CrmColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem('superai_crm_columns_v3');
      if (saved) {
        const parsed: CrmColumnConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // filter out removed columns like birthday
          const validParsed = parsed.filter(p => p.id !== ('birthday' as any));
          const merged = validParsed.map(p => {
            const def = DEFAULT_CRM_COLUMNS.find(d => d.id === p.id);
            return def ? { ...def, ...p } : p;
          });
          DEFAULT_CRM_COLUMNS.forEach(def => {
            if (!merged.some(m => m.id === def.id)) {
              merged.push(def);
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.warn('Column config load note:', e);
    }
    return DEFAULT_CRM_COLUMNS;
  });

  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);

  // Save column config on change
  useEffect(() => {
    try {
      localStorage.setItem('superai_crm_columns_v3', JSON.stringify(columns));
    } catch (e) {
      // ignore
    }
  }, [columns]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('RECENT_DESC'); // 'NAME_ASC' | 'NAME_DESC' | 'PHONE_ASC' | 'PHONE_DESC' | 'ADDRESS_ASC' | 'ADDRESS_DESC' | 'SPENT_DESC' | 'SPENT_ASC' | 'ORDERS_DESC' | 'ORDERS_ASC' | 'TRACKING_ASC' | 'TRACKING_DESC' | 'RECENT_DESC' | 'RECENT_ASC'
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [viewCustomerDetail, setViewCustomerDetail] = useState<Customer | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManualAddModalOpen, setIsManualAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Import State
  const [importTab, setImportTab] = useState<'TEXT' | 'EXCEL'>('TEXT');
  const [rawTextImport, setRawTextImport] = useState('');
  const [isParsingAi, setIsParsingAi] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseProgressMessage, setParseProgressMessage] = useState('');
  const [parsedPreviewList, setParsedPreviewList] = useState<any[]>([]);
  const [duplicateResolutionMode, setDuplicateResolutionMode] = useState<'MERGE' | 'SKIP' | 'CREATE_NEW'>('MERGE');

  // Manual New Customer Form
  const [newCustomerForm, setNewCustomerForm] = useState<Partial<Customer>>({
    customer_name: '',
    phone_number: '',
    address: '',
    notes: '',
    category_preference: 'AMULET',
    tier: 'NORMAL',
    status: 'NEW_CUSTOMER'
  });

  // Calculate Customer Aggregations (Total spent, item frequency)
  const enrichedCustomers = useMemo(() => {
    return customers.map(c => {
      const customerOrders = orders.filter(
        o =>
          (c.psid && o.psid === c.psid) ||
          (c.phone_number && o.phone_number && c.phone_number.replace(/\D/g, '') === o.phone_number.replace(/\D/g, '')) ||
          (c.customer_name && o.customer_name && c.customer_name.trim().toLowerCase() === o.customer_name.trim().toLowerCase())
      );

      const calculatedTotalSpent = customerOrders.reduce(
        (sum, o) => sum + (o.payment_status !== 'CANCELLED' ? o.total_amount : 0),
        0
      );
      const calculatedItemsCount = customerOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const orderCount = Math.max(c.order_count || 0, customerOrders.length);

      // Derive Tier
      let derivedTier: Customer['tier'] = c.tier || 'NORMAL';
      if (calculatedTotalSpent >= 10000 || orderCount >= 5) {
        derivedTier = 'SUPER_VIP';
      } else if (calculatedTotalSpent >= 3000 || orderCount >= 3) {
        derivedTier = 'VIP';
      } else if (calculatedTotalSpent >= 1500 || orderCount >= 2) {
        derivedTier = 'GOLD';
      } else if (orderCount >= 1) {
        derivedTier = 'SILVER';
      }

      // Last Order items & tracking
      const latestOrder = customerOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

      return {
        ...c,
        total_spent: c.total_spent !== undefined ? c.total_spent : calculatedTotalSpent,
        total_items_count: calculatedItemsCount,
        order_count: orderCount,
        tier: derivedTier,
        last_order_items: latestOrder?.items || c.last_order_items || '',
        last_order_date: latestOrder?.created_at || c.last_order_date || c.last_interaction,
        last_tracking_number: latestOrder?.tracking_number || c.last_tracking_number || ''
      };
    });
  }, [customers, orders]);

  // Filtered & Sorted Customers
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(cust => {
      // 1. Search Query (Name, Phone, Address, Notes, Items, Tracking)
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchName = cust.customer_name.toLowerCase().includes(q);
        const matchPhone = cust.phone_number.includes(q);
        const matchAddress = cust.address.toLowerCase().includes(q);
        const matchNotes = (cust.notes || '').toLowerCase().includes(q);
        const matchItems = (cust.last_order_items || '').toLowerCase().includes(q);
        const matchTracking = (cust.last_tracking_number || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAddress && !matchNotes && !matchItems && !matchTracking) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'ALL') {
        const pref = cust.category_preference || '';
        const items = cust.last_order_items || '';
        const isMatchCat =
          pref === categoryFilter ||
          (categoryFilter === 'AMULET' && (items.includes('AML') || items.includes('พระ') || items.includes('หลวงปู่'))) ||
          (categoryFilter === 'CHINA' && (items.includes('CHN') || items.includes('ฟอก') || items.includes('แอร์'))) ||
          (categoryFilter === 'OTOP' && (items.includes('OTP') || items.includes('ไหม') || items.includes('กาแฟ'))) ||
          (categoryFilter === 'AGRICULTURE' && (items.includes('AGR') || items.includes('ปุ๋ย') || items.includes('เกษตร')));
        if (!isMatchCat) return false;
      }

      // 3. Tier Filter
      if (tierFilter !== 'ALL') {
        if (tierFilter === 'VIP' && cust.tier !== 'VIP' && cust.tier !== 'SUPER_VIP') return false;
        if (tierFilter === 'SUPER_VIP' && cust.tier !== 'SUPER_VIP') return false;
        if (tierFilter === 'REPEAT' && (cust.order_count || 0) < 2) return false;
        if (tierFilter === 'NEW' && (cust.order_count || 0) > 1) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NAME_ASC') return a.customer_name.localeCompare(b.customer_name, 'th');
      if (sortBy === 'NAME_DESC') return b.customer_name.localeCompare(a.customer_name, 'th');
      if (sortBy === 'PHONE_ASC' || sortBy === 'PHONE') return a.phone_number.localeCompare(b.phone_number);
      if (sortBy === 'PHONE_DESC') return b.phone_number.localeCompare(a.phone_number);
      if (sortBy === 'ADDRESS_ASC') return (a.address || '').localeCompare(b.address || '', 'th');
      if (sortBy === 'ADDRESS_DESC') return (b.address || '').localeCompare(a.address || '', 'th');
      if (sortBy === 'SPENT_DESC') return (b.total_spent || 0) - (a.total_spent || 0);
      if (sortBy === 'SPENT_ASC') return (a.total_spent || 0) - (b.total_spent || 0);
      if (sortBy === 'ORDERS_DESC') return (b.order_count || 0) - (a.order_count || 0);
      if (sortBy === 'ORDERS_ASC') return (a.order_count || 0) - (b.order_count || 0);
      if (sortBy === 'TRACKING_ASC') return (a.last_tracking_number || '').localeCompare(b.last_tracking_number || '');
      if (sortBy === 'TRACKING_DESC') return (b.last_tracking_number || '').localeCompare(a.last_tracking_number || '');
      if (sortBy === 'RECENT_ASC') return new Date(a.last_interaction || 0).getTime() - new Date(b.last_interaction || 0).getTime();
      return new Date(b.last_interaction || 0).getTime() - new Date(a.last_interaction || 0).getTime();
    });
  }, [enrichedCustomers, searchTerm, categoryFilter, tierFilter, sortBy]);

  // Column Toggle & Reordering helpers
  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visible);
  }, [columns]);

  const handleToggleColumn = (id: CrmColumnId) => {
    setColumns(prev =>
      prev.map(col => {
        if (col.id === id) {
          const activeCount = prev.filter(c => c.visible).length;
          if (col.visible && activeCount <= 1) {
            return col; // prevent hiding all
          }
          return { ...col, visible: !col.visible };
        }
        return col;
      })
    );
  };

  const handleMoveColumn = (index: number, direction: 'UP' | 'DOWN') => {
    setColumns(prev => {
      const newCols = [...prev];
      const targetIndex = direction === 'UP' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newCols.length) return prev;
      const temp = newCols[index];
      newCols[index] = newCols[targetIndex];
      newCols[targetIndex] = temp;
      return newCols;
    });
  };

  const handleResetColumns = () => {
    setColumns(DEFAULT_CRM_COLUMNS);
  };

  const handleSelectAllColumns = () => {
    setColumns(prev => prev.map(c => ({ ...c, visible: true })));
  };

  const handleApplyPreset = (preset: 'ALL' | 'CONTACT' | 'SALES' | 'LOGISTICS') => {
    if (preset === 'ALL') {
      setColumns(prev => prev.map(c => ({ ...c, visible: true })));
    } else if (preset === 'CONTACT') {
      const visibleIds: CrmColumnId[] = ['actions', 'name_tier', 'phone', 'address', 'tracking_notes'];
      setColumns(prev => prev.map(c => ({ ...c, visible: visibleIds.includes(c.id) })));
    } else if (preset === 'SALES') {
      const visibleIds: CrmColumnId[] = ['actions', 'name_tier', 'phone', 'products_history', 'total_spent', 'order_count'];
      setColumns(prev => prev.map(c => ({ ...c, visible: visibleIds.includes(c.id) })));
    } else if (preset === 'LOGISTICS') {
      const visibleIds: CrmColumnId[] = ['actions', 'name_tier', 'phone', 'address', 'tracking_notes'];
      setColumns(prev => prev.map(c => ({ ...c, visible: visibleIds.includes(c.id) })));
    }
  };

  const handleHeaderSort = (sortKey?: string) => {
    if (!sortKey) return;
    if (sortKey === 'NAME') {
      setSortBy(prev => (prev === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC'));
    } else if (sortKey === 'PHONE') {
      setSortBy(prev => (prev === 'PHONE_ASC' ? 'PHONE_DESC' : 'PHONE_ASC'));
    } else if (sortKey === 'ADDRESS') {
      setSortBy(prev => (prev === 'ADDRESS_ASC' ? 'ADDRESS_DESC' : 'ADDRESS_ASC'));
    } else if (sortKey === 'SPENT') {
      setSortBy(prev => (prev === 'SPENT_DESC' ? 'SPENT_ASC' : 'SPENT_DESC'));
    } else if (sortKey === 'ORDERS') {
      setSortBy(prev => (prev === 'ORDERS_DESC' ? 'ORDERS_ASC' : 'ORDERS_DESC'));
    } else if (sortKey === 'TRACKING') {
      setSortBy(prev => (prev === 'TRACKING_ASC' ? 'TRACKING_DESC' : 'TRACKING_ASC'));
    }
  };

  // Copy phone helper
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // AI Smart Parser execution
  const handleRunAiSmartParser = async () => {
    if (!rawTextImport.trim()) return;
    setIsParsingAi(true);
    setParseProgress(15);
    setParseProgressMessage('กำลังเชื่อมต่อสมองกล AI Gemini...');

    try {
      setParseProgress(40);
      setParseProgressMessage('AI กำลังสกัดชื่อ ที่อยู่ เบอร์โทร วันเกิด รายการสินค้า และเลขพัสดุ...');

      const res = await fetch('/api/ai/parse-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: rawTextImport })
      });

      setParseProgress(80);
      setParseProgressMessage('กำลังตรวจสอบความถูกต้องและค้นหารายการซ้ำ...');

      if (res.ok) {
        const result = await res.json();
        const extracted = result.customers || [];
        setParsedPreviewList(extracted);
        setParseProgress(100);
        setParseProgressMessage(`สกัดข้อมูลสำเร็จเรียบร้อย ${extracted.length} รายการ!`);
      } else {
        throw new Error('AI parse returned error status');
      }
    } catch (err: any) {
      console.error('Parse error:', err);
      // Fallback simple line-by-line regex parser
      const lines = rawTextImport.split('\n').filter(l => l.trim().length > 3);
      const fallbackList = lines.map((line, idx) => {
        const phoneMatch = line.match(/(0\d{8,9})/);
        const phone = phoneMatch ? phoneMatch[1] : `08${Math.floor(10000000 + Math.random() * 90000000)}`;
        const cleanName = line.split(/[,\t|0-9]/)[0].trim() || `ลูกค้าท่านที่ ${idx + 1}`;
        return {
          customer_name: cleanName,
          phone_number: phone,
          address: line.replace(cleanName, '').replace(phone, '').trim() || 'กรุงเทพมหานคร',
          items: 'สินค้าทั่วไป',
          quantity: 1,
          total_amount: 990,
          category: 'AMULET'
        };
      });
      setParsedPreviewList(fallbackList);
      setParseProgress(100);
      setParseProgressMessage(`นำเข้าแบบด่วน ${fallbackList.length} รายการ (Local Fallback Mode)`);
    } finally {
      setIsParsingAi(false);
    }
  };

  // Excel File Upload Handler
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        setIsParsingAi(true);
        setParseProgress(30);
        setParseProgressMessage(`อ่านไฟล์ Excel สำเร็จ ${data.length} แถว -> กำลังส่งให้ AI จัดระเบียบ...`);

        const res = await fetch('/api/ai/parse-crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rowsData: data })
        });

        if (res.ok) {
          const result = await res.json();
          setParsedPreviewList(result.customers || []);
          setParseProgress(100);
          setParseProgressMessage(`สกัดข้อมูลจาก Excel สำเร็จ ${result.customers?.length || data.length} รายการ!`);
        } else {
          // Direct mapping
          const mapped = data.map((row: any, idx) => ({
            customer_name: row['ชื่อ'] || row['ชื่อลูกค้า'] || row['Name'] || row['customer_name'] || `ลูกค้า ${idx + 1}`,
            phone_number: String(row['เบอร์โทร'] || row['เบอร์'] || row['Phone'] || row['phone_number'] || '').replace(/\D/g, '') || '0800000000',
            address: row['ที่อยู่'] || row['Address'] || row['address'] || '',
            items: row['สินค้า'] || row['รายการ'] || row['Items'] || 'สินค้า',
            quantity: Number(row['จำนวน'] || row['Qty'] || 1),
            total_amount: Number(row['ยอดรวม'] || row['ราคา'] || row['Total'] || 0),
            tracking_number: row['เลขพัสดุ'] || row['Tracking'] || ''
          }));
          setParsedPreviewList(mapped);
          setParseProgress(100);
          setParseProgressMessage(`นำเข้าจากไฟล์ Excel ${mapped.length} รายการ`);
        }
      } catch (err) {
        console.error('Excel parse error:', err);
      } finally {
        setIsParsingAi(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Confirm Import & Save to CRM database
  const handleCommitImport = () => {
    if (!parsedPreviewList.length) return;

    let updatedCustList = [...customers];
    let newOrdersList = [...orders];
    let insertedCount = 0;
    let mergedCount = 0;

    parsedPreviewList.forEach(item => {
      const cleanPhone = (item.phone_number || '').replace(/\D/g, '');
      const existingIdx = updatedCustList.findIndex(
        c =>
          (cleanPhone && c.phone_number && c.phone_number.replace(/\D/g, '') === cleanPhone) ||
          (c.customer_name && item.customer_name && c.customer_name.trim().toLowerCase() === item.customer_name.trim().toLowerCase())
      );

      const customerPsid = existingIdx >= 0 ? updatedCustList[existingIdx].psid : `PSID_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      if (existingIdx >= 0) {
        if (duplicateResolutionMode === 'MERGE') {
          updatedCustList[existingIdx] = {
            ...updatedCustList[existingIdx],
            customer_name: item.customer_name || updatedCustList[existingIdx].customer_name,
            address: item.address || updatedCustList[existingIdx].address,
            notes: item.notes ? `${updatedCustList[existingIdx].notes || ''} | ${item.notes}` : updatedCustList[existingIdx].notes,
            last_interaction: new Date().toISOString(),
            order_count: (updatedCustList[existingIdx].order_count || 1) + 1
          };
          mergedCount++;
        } else if (duplicateResolutionMode === 'SKIP') {
          return; // skip
        }
      } else {
        const newCust: Customer = {
          psid: customerPsid,
          customer_name: item.customer_name || 'ลูกค้าใหม่',
          phone_number: item.phone_number || '',
          address: item.address || '',
          first_interaction: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          status: 'ORDER_COMPLETED',
          notes: item.notes || 'นำเข้าจากระบบ Bulk CRM Import',
          order_count: 1,
          category_preference: item.category || 'AMULET'
        };
        updatedCustList.unshift(newCust);
        insertedCount++;
      }

      // If item has order info, create order
      if (item.items || item.total_amount) {
        const newOrd: Order = {
          order_id: `ORD-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          psid: customerPsid,
          customer_name: item.customer_name,
          phone_number: item.phone_number,
          shipping_address: item.address || '',
          items: item.items || 'สินค้าทั่วไป',
          quantity: item.quantity || 1,
          total_amount: item.total_amount || 990,
          payment_status: 'PAID',
          created_at: item.order_date || new Date().toISOString(),
          tracking_number: item.tracking_number || `TH${Math.floor(1000000000 + Math.random() * 9000000000)}FL`,
          page_id: pages[0]?.page_id || 'AMULET_PAGE_ID'
        };
        newOrdersList.unshift(newOrd);
      }
    });

    setCustomers(updatedCustList);
    setOrders(newOrdersList);
    onSaveToBackend('customers', updatedCustList);
    onSaveToBackend('orders', newOrdersList);

    setIsImportModalOpen(false);
    setParsedPreviewList([]);
    setRawTextImport('');
    setParseProgress(0);
  };

  // Export for Telesales formatted CSV
  const handleExportTelesales = () => {
    const listToExport = selectedCustomerIds.length > 0
      ? enrichedCustomers.filter(c => selectedCustomerIds.includes(c.psid))
      : filteredCustomers;

    const exportRows = listToExport.map((c, idx) => ({
      ลำดับ: idx + 1,
      ชื่อลูกค้า: c.customer_name,
      เบอร์โทรศัพท์: c.phone_number,
      ที่อยู่จัดส่ง: c.address,
      ระดับลูกค้า: c.tier || 'NORMAL',
      หมวดสินค้าที่ชอบ: c.category_preference || 'พระเครื่อง',
      ยอดสั่งซื้อสะสม: c.total_spent || 0,
      จำนวนครั้งที่ซื้อ: c.order_count || 1,
      รายการสินค้าล่าสุด: c.last_order_items || '-',
      เลขพัสดุล่าสุด: c.last_tracking_number || '-',
      วันที่สั่งล่าสุด: c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('th-TH') : '-',
      สถานะโทรเทเลเซล: c.telesales_status || 'ยังไม่ได้โทร',
      บันทึกของแอดมิน: c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Telesales_Leads');
    XLSX.writeFile(wb, `Telesales_Customers_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Full Database Backup Download
  const handleDownloadFullBackup = async () => {
    try {
      const res = await fetch('/api/backup/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SuperAI_CRM_Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error('Backup download error:', err);
    }
  };

  // Full Database Restore Upload
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>, mode: 'overwrite' | 'merge') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const text = evt.target?.result as string;
        const backupJson = JSON.parse(text);
        const res = await fetch('/api/backup/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: backupJson.data || backupJson, mode })
        });
        if (res.ok) {
          window.location.reload();
        }
      } catch (err) {
        alert('รูปแบบไฟล์ Backup ไม่ถูกต้อง กรุณาเลือกไฟล์ JSON ที่สำรองไว้');
      }
    };
    reader.readAsText(file);
  };

  // Manual Add Customer Form Submit
  const handleAddManualCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerForm.customer_name || !newCustomerForm.phone_number) {
      alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    const newCust: Customer = {
      psid: `PSID_${Date.now()}`,
      customer_name: newCustomerForm.customer_name,
      phone_number: newCustomerForm.phone_number,
      address: newCustomerForm.address || '',
      category_preference: newCustomerForm.category_preference || 'AMULET',
      first_interaction: new Date().toISOString(),
      last_interaction: new Date().toISOString(),
      status: 'ORDER_COMPLETED',
      notes: newCustomerForm.notes || 'เพิ่มข้อมูลด้วยตนเอง',
      order_count: 1,
      tier: (newCustomerForm.tier as any) || 'NORMAL'
    };

    const updated = [newCust, ...customers];
    setCustomers(updated);
    onSaveToBackend('customers', updated);
    setIsManualAddModalOpen(false);
    setNewCustomerForm({
      customer_name: '',
      phone_number: '',
      address: '',
      notes: '',
      category_preference: 'AMULET',
      tier: 'NORMAL'
    });
  };

  // Edit Customer Submit
  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    const updated = customers.map(c => (c.psid === editingCustomer.psid ? editingCustomer : c));
    setCustomers(updated);
    onSaveToBackend('customers', updated);
    setIsEditModalOpen(false);
    setEditingCustomer(null);
  };

  // Delete Customer
  const handleDeleteCustomer = (psid: string) => {
    if (confirm('ยืนยันลบข้อมูลลูกค้ารายนี้?')) {
      const updated = customers.filter(c => c.psid !== psid);
      setCustomers(updated);
      onSaveToBackend('customers', updated);
    }
  };

  // Batch Delete
  const handleBatchDelete = () => {
    if (selectedCustomerIds.length === 0) return;
    if (confirm(`ยืนยันการลบลูกค้าที่เลือก ${selectedCustomerIds.length} รายการ?`)) {
      const updated = customers.filter(c => !selectedCustomerIds.includes(c.psid));
      setCustomers(updated);
      onSaveToBackend('customers', updated);
      setSelectedCustomerIds([]);
    }
  };

  // Select all checkbox
  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.psid));
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & METRICS BAR */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 rounded-full text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" /> CRM ENGINE PRO 2026
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-bold">
                AI Auto-Extraction & Deduplication Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              ระบบศูนย์ข้อมูลลูกค้า & CRM
            </h1>
            <p className="text-indigo-200 text-xs sm:text-sm mt-1 max-w-2xl">
              จัดการฐานข้อมูลลูกค้า นำเข้ารายชื่อทีละเยอะๆ ด้วย AI สกัดออโต้ ป้องกันข้อมูลซ้ำ คัดกรองระดับลูกค้า VIP พร้อมส่งออกเทเลเซลและสำรองข้อมูลครบวงจร
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
            >
              <Upload className="w-4 h-4" /> นำเข้ารายชื่อด่วน & ก็อปวาง (AI)
            </button>
            <button
              onClick={() => setIsManualAddModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" /> เพิ่มลูกค้า
            </button>
            <button
              onClick={handleExportTelesales}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm rounded-xl border border-white/20 flex items-center gap-2 transition-all"
              title="ส่งออกรายชื่อสำหรับเทเลเซลพร้อมประวัติการสั่งซื้อและเบอร์โทร"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" /> ส่งออก Telesales
            </button>
            <button
              onClick={() => setIsBackupRestoreModalOpen(true)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm rounded-xl border border-white/20 flex items-center gap-2 transition-all"
              title="สำรองข้อมูลทั้งหมดหรือกู้คืนไฟล์ Backup"
            >
              <Database className="w-4 h-4 text-indigo-300" /> แบ็กอัป/กู้คืน
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mt-6 pt-6 border-t border-indigo-700/50">
          <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] text-indigo-300 font-medium flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> ลูกค้าทั้งหมด
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 font-mono text-white">
              {customers.length.toLocaleString()} <span className="text-xs font-normal text-indigo-300">คน</span>
            </div>
          </div>

          <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] text-amber-300 font-medium flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> ลูกค้า VIP / ซื้อซ้ำ
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 font-mono text-amber-300">
              {enrichedCustomers.filter(c => (c.order_count || 0) >= 2 || c.tier === 'VIP' || c.tier === 'SUPER_VIP').length} <span className="text-xs font-normal text-indigo-300">คน</span>
            </div>
          </div>

          <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] text-purple-300 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> ซื้อซ้ำเฉลี่ย
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 font-mono text-purple-300">
              {customers.length > 0 ? (orders.length / customers.length).toFixed(1) : '0'} <span className="text-xs font-normal text-indigo-300">ออเดอร์/คน</span>
            </div>
          </div>

          <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-xs">
            <div className="text-[11px] text-emerald-300 font-medium flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" /> ยอดคำสั่งซื้อรวม
            </div>
            <div className="text-xl sm:text-2xl font-black mt-1 font-mono text-emerald-300">
              ฿{orders.reduce((sum, o) => sum + (o.payment_status !== 'CANCELLED' ? o.total_amount : 0), 0).toLocaleString()}
            </div>
          </div>

          <div className="bg-indigo-950/50 border border-indigo-700/40 rounded-2xl p-3.5 backdrop-blur-xs col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="text-[11px] text-indigo-300 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> ระบบกันข้อมูลซ้ำ
            </div>
            <div className="text-sm font-bold mt-1 text-emerald-400 flex items-center gap-1">
              Active (เช็คเบอร์ & ชื่อ)
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH, FILTERS & CONTROLS TOOLBAR */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Row 1: Search and Category Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อลูกค้า, เบอร์โทรศัพท์, ที่อยู่, เลขพัสดุ, สินค้าที่สั่ง..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none focus:border-indigo-500 transition-colors"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-100 dark:bg-[#1A1A22] rounded-xl border border-slate-200/80 dark:border-zinc-800 shrink-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'AMULET', label: '📿 พระเครื่อง' },
              { id: 'CHINA', label: '📦 สินค้าจีน' },
              { id: 'OTOP', label: '🌾 โอทอป' },
              { id: 'AGRICULTURE', label: '🌱 การเกษตร' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                  categoryFilter === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Dropdowns (Tier, Sort, Bulk actions) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* VIP Tier Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">ระดับ:</span>
              <select
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-zinc-200 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="ALL">ทุกลำดับชั้น</option>
                <option value="VIP">👑 VIP (สั่งซื้อ ≥ ฿3,000 หรือ ≥ 3 ครั้ง)</option>
                <option value="SUPER_VIP">💎 Super VIP (สั่งซื้อ ≥ ฿10,000)</option>
                <option value="REPEAT">🔁 ลูกค้าซื้อซ้ำ (≥ 2 ครั้ง)</option>
                <option value="NEW">👤 ลูกค้าใหม่</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">เรียงตาม:</span>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:text-zinc-200 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="RECENT_DESC">🕒 กิจกรรมล่าสุด (ใหม่ไปเก่า)</option>
                <option value="RECENT_ASC">🕒 กิจกรรมแรกเริ่ม (เก่าไปใหม่)</option>
                <option value="SPENT_DESC">💰 ยอดสั่งซื้อรวมสูงสุด</option>
                <option value="SPENT_ASC">💰 ยอดสั่งซื้อรวมน้อยสุด</option>
                <option value="ORDERS_DESC">📦 จำนวนครั้งสั่งซื้อมากสุด (ซื้อซ้ำ)</option>
                <option value="ORDERS_ASC">📦 จำนวนครั้งสั่งซื้อน้อยสุด</option>
                <option value="NAME_ASC">🔤 ชื่อลูกค้า ก - ฮ</option>
                <option value="NAME_DESC">🔤 ชื่อลูกค้า ฮ - ก</option>
                <option value="PHONE_ASC">📞 เบอร์โทรศัพท์</option>
                <option value="ADDRESS_ASC">📍 ที่อยู่จัดส่ง</option>
                <option value="TRACKING_ASC">🚚 เลขพัสดุ</option>
              </select>
            </div>

            {/* Customize Columns Button */}
            <button
              onClick={() => setIsColumnModalOpen(true)}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
              title="เลือกเปิด/ปิด และจัดเรียงคอลัมน์ตารางตามต้องการ"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>เลือกคอลัมน์แสดงผล ({visibleColumns.length}/{columns.length})</span>
            </button>
          </div>

          {/* Batch Selection Controls */}
          {selectedCustomerIds.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                เลือกไว้ {selectedCustomerIds.length} คน
              </span>
              <button
                onClick={handleExportTelesales}
                className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
              >
                ส่งออก {selectedCustomerIds.length} รายการ
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. CUSTOMER DATA TABLE */}
      <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-[#141418] border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <span>แสดงรายชื่อ {filteredCustomers.length} จากทั้งหมด {customers.length} รายการ</span>
            {searchTerm && <span className="text-indigo-600 dark:text-indigo-400 font-normal">(กรองจากคำค้น: "{searchTerm}")</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsColumnModalOpen(true)}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
            >
              <Columns className="w-3.5 h-3.5" /> ปรับแต่งคอลัมน์ ({visibleColumns.length}/{columns.length})
            </button>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <button
              onClick={handleToggleSelectAll}
              className="text-xs text-slate-600 dark:text-zinc-400 font-bold hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              {selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0 ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 w-10 text-center border-r border-slate-200 dark:border-zinc-800">
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.length > 0 && selectedCustomerIds.length === filteredCustomers.length}
                    onChange={handleToggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                {visibleColumns.map((col, idx) => {
                  const isSortable = !!col.sortKey;
                  const isActiveSort = col.sortKey && sortBy.startsWith(col.sortKey);
                  const isAsc = col.sortKey && sortBy === `${col.sortKey}_ASC`;
                  const isDesc = col.sortKey && sortBy === `${col.sortKey}_DESC`;
                  const isLast = idx === visibleColumns.length - 1;

                  return (
                    <th
                      key={col.id}
                      className={`p-3.5 ${!isLast ? 'border-r border-slate-200 dark:border-zinc-800' : ''} ${col.minWidth || ''} ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      } ${isSortable ? 'cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors' : ''}`}
                      onClick={() => isSortable && handleHeaderSort(col.sortKey)}
                    >
                      <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                        <span>{col.label}</span>
                        {isSortable && (
                          <span className="shrink-0">
                            {isActiveSort ? (
                              isAsc ? (
                                <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 1} className="p-12 text-center text-slate-400 dark:text-zinc-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <div className="font-bold text-sm text-slate-700 dark:text-zinc-300">ไม่พบข้อมูลลูกค้าตามเงื่อนไขที่ระบุ</div>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "นำเข้ารายชื่อด่วน" ด้านบน</p>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(item => {
                  const isSelected = selectedCustomerIds.includes(item.psid);

                  return (
                    <tr
                      key={item.psid}
                      className={`hover:bg-slate-50 dark:hover:bg-[#15151B] transition-colors ${
                        isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center border-r border-slate-200 dark:border-zinc-800/60">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (isSelected) {
                              setSelectedCustomerIds(prev => prev.filter(id => id !== item.psid));
                            } else {
                              setSelectedCustomerIds(prev => [...prev, item.psid]);
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Dynamic Columns */}
                      {visibleColumns.map((col, idx) => {
                        const isLast = idx === visibleColumns.length - 1;
                        const borderClass = !isLast ? 'border-r border-slate-200 dark:border-zinc-800/60' : '';

                        if (col.id === 'actions') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} whitespace-nowrap`}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setViewCustomerDetail(item)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                                  title="ดูประวัติการสั่งซื้อทั้งหมด & ข้อมูลเชิงลึก"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCustomer(item);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                                  title="แก้ไขข้อมูลลูกค้า"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(item.psid)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                                  title="ลบรายชื่อ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'name_tier') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                  {item.customer_name.slice(0, 1)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                                    <span>{item.customer_name}</span>
                                    {item.tier === 'SUPER_VIP' && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500 text-zinc-950 rounded font-mono">
                                        💎 Super VIP
                                      </span>
                                    )}
                                    {item.tier === 'VIP' && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 rounded font-mono">
                                        👑 VIP
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">PSID: {item.psid}</div>
                                </div>
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'phone') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} whitespace-nowrap`}>
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${item.phone_number}`}
                                  className="font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" /> {item.phone_number || 'ไม่ระบุเบอร์'}
                                </a>
                                {item.phone_number && (
                                  <button
                                    onClick={() => handleCopyPhone(item.phone_number)}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
                                    title="คัดลอกเบอร์โทร"
                                  >
                                    {copiedPhone === item.phone_number ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'address') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} text-slate-600 dark:text-zinc-300 text-xs`}>
                              <div className="line-clamp-2 max-w-xs" title={item.address}>
                                {item.address || <span className="text-slate-400 italic">ยังไม่มีที่อยู่จัดส่ง</span>}
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'products_history') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass}`}>
                              <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 line-clamp-1">
                                {item.last_order_items || item.notes || 'สินค้าทั่วไป'}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                หมวด: {item.category_preference || 'พระเครื่อง'} • ซื้อ {item.total_items_count || 1} ชิ้น
                              </div>
                            </td>
                          );
                        }

                        if (col.id === 'total_spent') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} text-right whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400`}>
                              ฿{(item.total_spent || 0).toLocaleString()}
                            </td>
                          );
                        }

                        if (col.id === 'order_count') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} text-center whitespace-nowrap`}>
                              <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                                (item.order_count || 1) >= 3
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                  : (item.order_count || 1) >= 2
                                  ? 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                              }`}>
                                {item.order_count || 1} ครั้ง
                              </span>
                            </td>
                          );
                        }

                        if (col.id === 'tracking_notes') {
                          return (
                            <td key={col.id} className={`p-3.5 ${borderClass} text-xs`}>
                              {item.last_tracking_number && (
                                <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold text-[11px] flex items-center gap-1">
                                  <Package className="w-3 h-3" /> {item.last_tracking_number}
                                </div>
                              )}
                              <div className="text-slate-500 dark:text-zinc-400 text-[11px] line-clamp-1 mt-0.5">
                                {item.notes || 'ไม่มีบันทึก'}
                              </div>
                            </td>
                          );
                        }

                        return null;
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: AI SMART BULK IMPORTER (COPY-PASTE RAW TEXT & EXCEL) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-400" /> นำเข้ารายชื่อด่วน & AI สกัดข้อมูลอัจฉริยะ
                </h2>
                <p className="text-xs text-indigo-200">
                  ก็อปปี้ข้อความดิบมาวาง หรืออัปโหลดไฟล์ Excel/CSV ระบบ AI จะสกัดชื่อ ที่อยู่ เบอร์โทร รายการสินค้า และเลขพัสดุให้แบบออโต้
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs: Copy-Paste vs Excel File */}
            <div className="px-6 pt-4 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-4 bg-slate-50 dark:bg-[#0E0E12]">
              <button
                onClick={() => setImportTab('TEXT')}
                className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  importTab === 'TEXT'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <FileText className="w-4 h-4" /> 1. ก็อปปี้ข้อความมาวาง (Copy & Paste Raw Text)
              </button>
              <button
                onClick={() => setImportTab('EXCEL')}
                className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${
                  importTab === 'EXCEL'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" /> 2. อัปโหลดไฟล์ Excel (.xlsx / .csv)
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {importTab === 'TEXT' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                    วางข้อความรายชื่อลูกค้าทั้งหมดลงในช่องนี้ (ไม่จำกัดรูปแบบ):
                  </label>
                  <textarea
                    rows={7}
                    value={rawTextImport}
                    onChange={e => setRawTextImport(e.target.value)}
                    placeholder={`ตัวอย่างเช่น:\nคุณสมศักดิ์ วันดี 0812345678 12/4 ถ.ลาดพร้าว แขวงจอมพล จตุจักร กทม 10900 สั่งเสาอากาศ 4 ชิ้น 1036 บาท\nสมหญิง รวยทรัพย์ 0898887777 99 หมู่ 3 ต.ในเมือง อ.เมือง ขอนแก่น 40000 ชุดบล็อก 7 กล่อง 1813.- COD เลขพัสดุ TH889977FL\nวิชัย เกษตรก้าวหน้า 0861112233 ปุ๋ยน้ำ 4 ขวด 2290 บาท จัดส่งด่วน กาญจนบุรี`}
                    className="w-full p-3.5 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-mono text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none focus:border-indigo-500 leading-relaxed"
                  />
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
                    <span>* AI รองรับข้อความดิบจากแชท, ไลน์, หรือโพสต์ ได้ทุกแบบ</span>
                    <button
                      onClick={handleRunAiSmartParser}
                      disabled={isParsingAi || !rawTextImport.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                    >
                      {isParsingAi ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังประมวลผล...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" /> ให้ AI วิเคราะห์ & กรอกออโต้
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl p-8 text-center bg-slate-50 dark:bg-[#0A0A0C]">
                  <FileSpreadsheet className="w-12 h-12 text-indigo-500 mx-auto mb-3" />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                    เลือกหรือลากไฟล์ Excel / CSV มาวางที่นี่
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 mb-4">
                    รองรับไฟล์ .xlsx, .xls, .csv พร้อมระบบแปลงหัวตารางอัตโนมัติ
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelFileUpload}
                    className="text-xs font-medium file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  />
                </div>
              )}

              {/* Progress Indicator with Percentage */}
              {isParsingAi && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <span>{parseProgressMessage}</span>
                    <span className="font-mono text-sm">{parseProgress}%</span>
                  </div>
                  <div className="w-full bg-indigo-200 dark:bg-indigo-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${parseProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Parsed Preview Table & Duplicate Resolution */}
              {parsedPreviewList.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> ตรวจพบข้อมูล {parsedPreviewList.length} รายการ (ตรวจสอบก่อนบันทึก):
                    </div>

                    {/* Deduplication Strategy */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 font-medium">เมื่อพบข้อมูลซ้ำ:</span>
                      <select
                        value={duplicateResolutionMode}
                        onChange={e => setDuplicateResolutionMode(e.target.value as any)}
                        className="bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none"
                      >
                        <option value="MERGE">🔄 อัปเดตข้อมูลเดิม (Merge / สะสมยอด)</option>
                        <option value="SKIP">⏭️ ข้ามรายการซ้ำ (Skip Duplicates)</option>
                        <option value="CREATE_NEW">➕ บันทึกแยกเป็นรายการใหม่</option>
                      </select>
                    </div>
                  </div>

                  <div className="border border-slate-200 dark:border-zinc-800 rounded-xl max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 font-mono text-[10px]">
                        <tr>
                          <th className="p-2 border-r border-slate-200 dark:border-zinc-800">ชื่อลูกค้า</th>
                          <th className="p-2 border-r border-slate-200 dark:border-zinc-800">เบอร์โทร</th>
                          <th className="p-2 border-r border-slate-200 dark:border-zinc-800">ที่อยู่</th>
                          <th className="p-2 border-r border-slate-200 dark:border-zinc-800">สินค้า</th>
                          <th className="p-2 border-r border-slate-200 dark:border-zinc-800 text-right">ยอดเงิน</th>
                          <th className="p-2">เลขพัสดุ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                        {parsedPreviewList.map((row, idx) => {
                          const isDup = customers.some(
                            c =>
                              (row.phone_number && c.phone_number && c.phone_number.replace(/\D/g, '') === String(row.phone_number).replace(/\D/g, '')) ||
                              (c.customer_name && row.customer_name && c.customer_name.trim().toLowerCase() === String(row.customer_name).trim().toLowerCase())
                          );

                          return (
                            <tr key={idx} className={isDup ? 'bg-amber-500/10' : ''}>
                              <td className="p-2 border-r border-slate-200 dark:border-zinc-800/60 font-bold flex items-center gap-1">
                                {row.customer_name}
                                {isDup && (
                                   <span className="px-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[9px] rounded font-bold">
                                    ซ้ำในระบบ
                                  </span>
                                )}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 dark:text-indigo-400">
                                {row.phone_number}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-zinc-800/60 max-w-xs truncate">
                                {row.address}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-zinc-800/60">
                                {row.items}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-zinc-800/60 text-right font-mono font-bold text-emerald-600">
                                ฿{Number(row.total_amount || 0).toLocaleString()}
                              </td>
                              <td className="p-2 font-mono text-[10px]">
                                {row.tracking_number || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E0E12] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2.5 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCommitImport}
                disabled={parsedPreviewList.length === 0}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-emerald-600/20"
              >
                <Check className="w-4 h-4" /> บันทึกนำเข้าสู่ฐานข้อมูล ({parsedPreviewList.length} รายการ)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: MANUAL ADD CUSTOMER */}
      {isManualAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-300" /> เพิ่มข้อมูลลูกค้าใหม่
              </h3>
              <button onClick={() => setIsManualAddModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddManualCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">ชื่อ - นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.customer_name}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, customer_name: e.target.value })}
                  placeholder="เช่น คุณสมศักดิ์ วันดี"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">เบอร์โทรศัพท์ *</label>
                <input
                  type="tel"
                  required
                  value={newCustomerForm.phone_number}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, phone_number: e.target.value })}
                  placeholder="เช่น 0812345678"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">ที่อยู่จัดส่งพัสดุ</label>
                <textarea
                  rows={2}
                  value={newCustomerForm.address}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
                  placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">หมวดสินค้าที่สนใจ</label>
                <select
                  value={newCustomerForm.category_preference}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, category_preference: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                >
                  <option value="AMULET">📿 พระเครื่อง</option>
                  <option value="CHINA">📦 สินค้าจีน/ไอที</option>
                  <option value="OTOP">🌾 สินค้าโอทอป</option>
                  <option value="AGRICULTURE">🌱 สินค้าการเกษตร</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">บันทึกเพิ่มเติม</label>
                <input
                  type="text"
                  value={newCustomerForm.notes}
                  onChange={e => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  placeholder="เช่น ลูกค้าเก่า โอนไว ชอบแถมของ"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  บันทึกลูกค้า
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: EDIT CUSTOMER */}
      {isEditModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-300" /> แก้ไขข้อมูลลูกค้า: {editingCustomer.customer_name}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">ชื่อ - นามสกุล</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.customer_name}
                  onChange={e => setEditingCustomer({ ...editingCustomer, customer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="tel"
                  required
                  value={editingCustomer.phone_number}
                  onChange={e => setEditingCustomer({ ...editingCustomer, phone_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">ที่อยู่จัดส่ง</label>
                <textarea
                  rows={2}
                  value={editingCustomer.address}
                  onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">ระดับลูกค้า</label>
                <select
                  value={editingCustomer.tier || 'NORMAL'}
                  onChange={e => setEditingCustomer({ ...editingCustomer, tier: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="SILVER">Silver</option>
                  <option value="GOLD">Gold</option>
                  <option value="VIP">VIP</option>
                  <option value="SUPER_VIP">Super VIP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">บันทึกแอดมิน</label>
                <input
                  type="text"
                  value={editingCustomer.notes || ''}
                  onChange={e => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: CUSTOMER DETAIL & PURCHASE HISTORY DRAWER */}
      {viewCustomerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 to-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 text-white font-bold flex items-center justify-center text-base">
                  {viewCustomerDetail.customer_name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    {viewCustomerDetail.customer_name}
                    {viewCustomerDetail.tier && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 text-zinc-950 rounded-full">
                        {viewCustomerDetail.tier}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-indigo-200 font-mono">PSID: {viewCustomerDetail.psid} • โทร: {viewCustomerDetail.phone_number}</p>
                </div>
              </div>
              <button onClick={() => setViewCustomerDetail(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Customer Profile Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">ยอดสั่งซื้อรวม</div>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ฿{(viewCustomerDetail.total_spent || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">จำนวนออเดอร์</div>
                  <div className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {viewCustomerDetail.order_count || 1} ครั้ง
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-3 rounded-xl">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">หมวดสินค้าที่ชอบ</div>
                  <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                    {viewCustomerDetail.category_preference || 'ทั่วไป'}
                  </div>
                </div>
              </div>

              {/* Address & Contact Details */}
              <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">ที่อยู่จัดส่ง: </span>
                    <span className="text-slate-600 dark:text-zinc-300">{viewCustomerDetail.address || 'ยังไม่มีที่อยู่'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">เบอร์โทร: </span>
                    <a href={`tel:${viewCustomerDetail.phone_number}`} className="font-mono text-indigo-600 dark:text-indigo-400 font-bold underline">
                      {viewCustomerDetail.phone_number}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">ทักเข้ามาครั้งแรก: </span>
                    <span className="text-slate-500">{new Date(viewCustomerDetail.first_interaction || Date.now()).toLocaleString('th-TH')}</span>
                  </div>
                </div>
              </div>

              {/* Order History Timeline */}
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-indigo-500" /> ประวัติคำสั่งซื้อของลูกค้ารายนี้ ({
                    orders.filter(o => o.phone_number === viewCustomerDetail.phone_number || o.psid === viewCustomerDetail.psid).length
                  } ออเดอร์)
                </h4>

                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {orders
                    .filter(o => o.phone_number === viewCustomerDetail.phone_number || o.psid === viewCustomerDetail.psid)
                    .map((ord, idx) => (
                      <div
                        key={ord.order_id || idx}
                        className="bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            <span>{ord.items}</span>
                            <span className="px-1.5 py-0.2 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] rounded font-bold">
                              {ord.payment_status}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            รหัส: {ord.order_id} • วันที่: {new Date(ord.created_at).toLocaleDateString('th-TH')}
                            {ord.tracking_number && ` • พัสดุ: ${ord.tracking_number}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            ฿{ord.total_amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400">{ord.quantity || 1} ชิ้น</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E0E12] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <a
                href={`tel:${viewCustomerDetail.phone_number}`}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                <PhoneCall className="w-3.5 h-3.5" /> โทรหาลูกค้า
              </a>
              <button
                onClick={() => setViewCustomerDetail(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL: BACKUP & RESTORE */}
      {isBackupRestoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" /> สำรองข้อมูล & กู้คืนระบบ (Backup & Restore)
              </h3>
              <button onClick={() => setIsBackupRestoreModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs">
              {/* Export Full Backup Section */}
              <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-500" /> 1. ส่งออกและสำรองข้อมูลทั้งหมด (Download Full Backup)
                </h4>
                <p className="text-slate-500">
                  ดาวน์โหลดข้อมูลลูกค้าทั้งหมด, ออเดอร์, สินค้า 4 หมวด, และการตั้งค่าเพจเป็นไฟล์ JSON สำหรับเก็บไว้ภายนอก
                </p>
                <button
                  onClick={handleDownloadFullBackup}
                  className="mt-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20"
                >
                  <Download className="w-4 h-4" /> ดาวน์โหลดไฟล์ Backup (.json)
                </button>
              </div>

              {/* Restore Backup Section */}
              <div className="bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl space-y-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-500" /> 2. นำเข้าไฟล์กู้คืน (Restore from Backup)
                </h4>
                <p className="text-slate-500">
                  เลือกไฟล์ Backup (.json) ที่เคยสำรองไว้ เพื่อกู้คืนรายชื่อลูกค้าและประวัติการสั่งซื้อกลับคืนมา
                </p>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                      กู้คืนแบบรวมข้อมูล (Merge - แนะนำ ไม่ลบข้อมูลเดิม):
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => handleRestoreBackupFile(e, 'merge')}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <label className="block text-rose-600 dark:text-rose-400 font-bold mb-1">
                      กู้คืนแบบเขียนทับทั้งหมด (Overwrite):
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      onChange={e => handleRestoreBackupFile(e, 'overwrite')}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-rose-600 file:text-white hover:file:bg-rose-700 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E0E12] border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setIsBackupRestoreModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL: COLUMN CUSTOMIZER & REORDER */}
      {isColumnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/50 rounded-xl border border-indigo-400/30">
                  <SlidersHorizontal className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <h3 className="font-bold text-base">ปรับแต่ง & จัดเรียงคอลัมน์ตาราง CRM</h3>
                  <p className="text-indigo-200 text-xs mt-0.5">เลือกเปิด/ปิดคอลัมน์ที่ต้องการดู และปรับลำดับก่อน-หลังตามต้องการ</p>
                </div>
              </div>
              <button
                onClick={() => setIsColumnModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Bar */}
            <div className="p-4 bg-slate-50 dark:bg-[#0E0E12] border-b border-slate-200 dark:border-zinc-800 shrink-0">
              <div className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-2">ชุดคอลัมน์แนะนำ (Presets):</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('ALL')}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#181820] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-zinc-700 hover:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 text-center transition-all"
                >
                  🌟 แสดงทั้งหมด (9/9)
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('CONTACT')}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#181820] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-zinc-700 hover:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 text-center transition-all"
                >
                  📞 ติดต่อ & จัดส่ง
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('SALES')}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#181820] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-zinc-700 hover:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 text-center transition-all"
                >
                  💰 ยอดขาย & ซื้อซ้ำ
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('LOGISTICS')}
                  className="px-2.5 py-1.5 bg-white dark:bg-[#181820] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-zinc-700 hover:border-indigo-400 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 text-center transition-all"
                >
                  🚚 พัสดุ & ขนส่ง
                </button>
              </div>
            </div>

            {/* Column List with Toggles and Move Up/Down */}
            <div className="p-6 overflow-y-auto space-y-2.5 divide-y divide-slate-100 dark:divide-zinc-800/60">
              {columns.map((col, index) => {
                const isFirst = index === 0;
                const isLast = index === columns.length - 1;

                return (
                  <div
                    key={col.id}
                    className={`pt-2.5 first:pt-0 flex items-center justify-between gap-3 p-3 rounded-2xl transition-all ${
                      col.visible
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40'
                        : 'bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 opacity-60'
                    }`}
                  >
                    {/* Left: Position badge, checkbox, column label */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 font-mono text-[10px] font-bold text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={() => handleToggleColumn(col.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100">
                            {col.label}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {col.visible ? '✓ กำลังแสดงผล' : '✗ ซ่อนคอลัมน์นี้'}
                            {col.sortKey ? ' • รองรับการจัดเรียง' : ''}
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Right: Reorder Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveColumn(index, 'UP')}
                        className="p-1.5 bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-600 dark:text-zinc-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="เลื่อนขึ้นไปทางซ้าย"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveColumn(index, 'DOWN')}
                        className="p-1.5 bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-zinc-700 rounded-lg text-slate-600 dark:text-zinc-300 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="เลื่อนลงไปทางขวา"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#0E0E12] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleResetColumns}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> รีเซ็ตเป็นค่าเริ่มต้น
              </button>
              <button
                type="button"
                onClick={() => setIsColumnModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
              >
                บันทึก & ใช้งาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
