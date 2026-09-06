import React, { useState, useRef } from 'react';
import {
  Upload,
  Database,
  Plus,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Edit,
  CheckCircle2,
  Layers,
  Facebook,
  ExternalLink,
  Tag,
  Check,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import {
  ProductAmulet,
  ProductChina,
  ProductOtop,
  ProductAgriculture,
  Order,
  Customer,
  PageConfig,
  ProductCategory
} from '../types';
import { ProductTemplateModal } from './ProductTemplateModal';

interface DatabaseSheetTabProps {
  amulet: ProductAmulet[];
  setAmulet: (data: ProductAmulet[]) => void;
  china: ProductChina[];
  setChina: (data: ProductChina[]) => void;
  otop: ProductOtop[];
  setOtop: (data: ProductOtop[]) => void;
  agriculture: ProductAgriculture[];
  setAgriculture: (data: ProductAgriculture[]) => void;
  orders: Order[];
  setOrders: (data: Order[]) => void;
  customers: Customer[];
  setCustomers: (data: Customer[]) => void;
  pages: PageConfig[];
  setPages: (data: PageConfig[]) => void;
  onSaveToBackend: (collection: string, data: any[]) => void;
}

export const DatabaseSheetTab: React.FC<DatabaseSheetTabProps> = ({
  amulet,
  setAmulet,
  china,
  setChina,
  otop,
  setOtop,
  agriculture,
  setAgriculture,
  orders,
  setOrders,
  customers,
  setCustomers,
  pages,
  setPages,
  onSaveToBackend
}) => {
  const [activeSheet, setActiveSheet] = useState<
    'china' | 'amulet' | 'otop' | 'agriculture' | 'orders' | 'customers' | 'pages'
  >('china');
  const [searchTerm, setSearchTerm] = useState('');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<ProductCategory>('CHINA');
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewingSpecsProduct, setViewingSpecsProduct] = useState<{ item: any; category: ProductCategory } | null>(null);

  // PostgreSQL Cloud DB — สถานะอัตโนมัติ (อ่านจากเซิร์ฟเวอร์ ไม่ต้องตั้งค่าเอง)
  const [isCloudConfigModalOpen, setIsCloudConfigModalOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [dbStatusLoading, setDbStatusLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const openDbStatus = () => {
    setIsCloudConfigModalOpen(true);
    setDbStatusLoading(true);
    fetch('/api/database/status')
      .then(r => r.json())
      .then(d => setDbStatus(d.success ? d : null))
      .catch(() => setDbStatus(null))
      .finally(() => setDbStatusLoading(false));
  };

  const handleImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed.data || parsed;
        const summary = [
          data.pages?.length ? `เพจ ${data.pages.length}` : '',
          data.customers?.length ? `ลูกค้า ${data.customers.length}` : '',
          data.orders?.length ? `ออเดอร์ ${data.orders.length}` : '',
          data.amulet?.length ? `พระ ${data.amulet.length}` : '',
          data.china?.length ? `สินค้าจีน ${data.china.length}` : '',
          data.otop?.length ? `OTOP ${data.otop.length}` : '',
          data.agriculture?.length ? `เกษตร ${data.agriculture.length}` : ''
        ].filter(Boolean).join(', ');
        if (!summary) { alert('ไฟล์นี้ไม่มีข้อมูลที่ระบบรู้จัก'); return; }
        if (!window.confirm('นำเข้าข้อมูล: ' + summary + '\n\nระบบจะรวมแบบกันซ้ำ (มีอยู่แล้ว = อัปเดตทับ ไม่สร้างซ้ำ)\nยืนยันนำเข้า?')) return;
        setImporting(true);
        const res = await fetch('/api/backup/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, mode: 'merge' })
        });
        const r = await res.json();
        if (r.success) {
          if (r.applied.pages) setPages(r.applied.pages);
          if (r.applied.customers) setCustomers(r.applied.customers);
          if (r.applied.orders) setOrders(r.applied.orders);
          if (r.applied.amulet) setAmulet(r.applied.amulet);
          if (r.applied.china) setChina(r.applied.china);
          if (r.applied.otop) setOtop(r.applied.otop);
          if (r.applied.agriculture) setAgriculture(r.applied.agriculture);
          const parts = Object.entries(r.result || {}).map(([k, v]: any) => k + ': เพิ่มใหม่ ' + v.added + ' / อัปเดต ' + v.updated);
          setSyncStatus('✅ นำเข้าสำเร็จ (กันซ้ำแล้ว) — ' + parts.join(' | '));
          setTimeout(() => setSyncStatus(null), 8000);
        } else {
          alert('นำเข้าไม่สำเร็จ: ' + (r.message || 'ไม่ทราบสาเหตุ'));
        }
      } catch (err: any) {
        alert('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง: ' + err.message);
      } finally { setImporting(false); }
    };
    reader.readAsText(file);
  };

  const sheetsMeta = [
    {
      id: 'china',
      name: 'PRODUCT_CHINA',
      thaiName: 'สินค้านำเข้าจีน / ทั่วไป',
      count: china.length,
      icon: '📦',
      catType: 'CHINA' as ProductCategory
    },
    {
      id: 'amulet',
      name: 'PRODUCT_AMULET',
      thaiName: 'พระเครื่อง & วัตถุมงคล',
      count: amulet.length,
      icon: '📿',
      catType: 'AMULET' as ProductCategory
    },
    {
      id: 'otop',
      name: 'PRODUCT_OTOP',
      thaiName: 'สินค้าโอทอปไทย',
      count: otop.length,
      icon: '🌾',
      catType: 'OTOP' as ProductCategory
    },
    {
      id: 'agriculture',
      name: 'PRODUCT_AGRI',
      thaiName: 'สินค้าการเกษตร & ปุ๋ยยา',
      count: (agriculture || []).length,
      icon: '🌱',
      catType: 'AGRICULTURE' as ProductCategory
    },
    {
      id: 'orders',
      name: 'Orders',
      thaiName: 'คำสั่งซื้อ',
      count: orders.length,
      icon: '📋'
    },
    {
      id: 'customers',
      name: 'Customers',
      thaiName: 'ลูกค้า (CRM)',
      count: customers.length,
      icon: '👥'
    },
    {
      id: 'pages',
      name: 'PAGE_CONFIG',
      thaiName: 'ตั้งค่าเพจ & การเชื่อมต่อ',
      count: pages.length,
      icon: '⚙️'
    }
  ];

  const currentSheetMeta = sheetsMeta.find(s => s.id === activeSheet)!;

  // Feature 8: single source of truth for promotion tiers shared by Pages Hub & database editor.
  // Prefer the real tiers already stored (custom names, free_shipping, gift_quantity); only fall
  // back to plain price tiers derived from legacy price_1/2/3 columns — never invent gift/shipping claims.
  const resolvePromotionTiers = (incoming: any, fallback: any, priceSource: any): any[] => {
    // Propagate price_1/2/3 edits from the database sheet onto the matching tiers so both
    // editors stay identical (the columns are derived from tier prices, so this is idempotent).
    const applyPriceOverrides = (tiers: any[]) =>
      tiers.map((t: any, i: number) => {
        const edited = Number(priceSource?.[`price_${i + 1}`]);
        return Number.isFinite(edited) && edited > 0 ? { ...t, price: edited } : t;
      });
    if (Array.isArray(incoming) && incoming.length) return applyPriceOverrides(incoming);
    if (Array.isArray(fallback) && fallback.length) return applyPriceOverrides(fallback);
    return [
      { id: 'tier-1', name: '1 ชิ้น', quantity: 1, price: Number(priceSource?.price_1 ?? priceSource?.display_price ?? 0), description: '' },
      { id: 'tier-2', name: '2 ชิ้น', quantity: 2, price: Number(priceSource?.price_2 ?? 0), description: String(priceSource?.promotion_detail || '') },
      { id: 'tier-3', name: '3 ชิ้น', quantity: 3, price: Number(priceSource?.price_3 ?? 0), description: '' }
    ];
  };

  // Keep the real promotion tiers already saved on the catalog row when the template form
  // doesn't carry them, so editing the database never destroys Pages Hub promotion settings.
  const mergeCatalogRow = (existing: any, incoming: any) => ({
    ...existing,
    ...incoming,
    promotions:
      Array.isArray(incoming?.promotions) && incoming.promotions.length
        ? incoming.promotions
        : existing?.promotions
  });

  const handleSyncVercelDB = () => {
    setSyncStatus('กำลังซิงค์และดึงข้อมูลล่าสุดจาก Vercel Cloud Database & KV Storage...');
    
    // Sync database products with pages
    const syncDatabaseWithPages = () => {
      // For each page, ensure it has the correct product data from database
      pages.forEach(page => {
        let productData: any = null;
        
        if (page.category === 'CHINA') {
          productData = china.find(c => c.page_id === page.page_id);
        } else if (page.category === 'AMULET') {
          productData = amulet.find(a => a.page_id === page.page_id);
        } else if (page.category === 'OTOP') {
          productData = otop.find(o => o.page_id === page.page_id);
        } else if (page.category === 'AGRICULTURE') {
          productData = agriculture.find(a => a.page_id === page.page_id);
        }
        
        if (productData) {
          // Update page with product data
          const updatedPages = pages.map(p => {
            if (p.page_id === page.page_id) {
              return {
                ...p,
                product: {
                  ...p.product,
                  product_id: productData.product_id,
                  product_name: productData.product_name,
                  category: productData.category,
                  base_price: productData.display_price,
                  display_price: productData.display_price,
                  description: productData.description || productData.detail_text,
                  shipping_duration: productData.shipping_duration,
                  images: {
                    main: productData.image_main || '',
                    detail: productData.image_detail || '',
                    promotion: productData.image_promotion || '',
                    review: productData.image_review || '',
                    closing: productData.image_closing || ''
                  },
                  promotions: resolvePromotionTiers(productData.promotions, p.product?.promotions, productData),
                  specs: productData
                },
                sequence: {
                  ...p.sequence,
                  step1_opening_text: productData.opening_text || p.sequence?.step1_opening_text,
                  step3_promotion_detail: productData.promotion_text || p.sequence?.step3_promotion_detail,
                  step6_closing_text: productData.closing_text || p.sequence?.step6_closing_text
                }
              };
            }
            return p;
          });
          setPages(updatedPages);
          onSaveToBackend('pages', updatedPages);
        }
      });
    };
    
    syncDatabaseWithPages();
    
    // เขียนข้อมูลทั้งหมดลง PostgreSQL จริง (ไม่ใช่แค่หน้าจอ)
    fetch('/api/database/sync', { method: 'POST' })
      .then(r => r.json())
      .then(r => {
        setSyncStatus(r.success
          ? `✅ ซิงค์ลง PostgreSQL สำเร็จ (${r.durationMs}ms) — เพจ ${r.counts.pages} / ลูกค้า ${r.counts.customers} / ออเดอร์ ${r.counts.orders} / สินค้า ${r.counts.products}`
          : '❌ ' + (r.message || 'ซิงค์ไม่สำเร็จ'));
        setTimeout(() => setSyncStatus(null), 5000);
      })
      .catch(() => {
        setSyncStatus('❌ เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
        setTimeout(() => setSyncStatus(null), 5000);
      });
  };

  const handleExportCSV = () => {
    let dataToExport: any[] = [];
    if (activeSheet === 'amulet') dataToExport = amulet;
    else if (activeSheet === 'china') dataToExport = china;
    else if (activeSheet === 'otop') dataToExport = otop;
    else if (activeSheet === 'agriculture') dataToExport = agriculture;
    else if (activeSheet === 'orders') dataToExport = orders;
    else if (activeSheet === 'customers') dataToExport = customers;
    else if (activeSheet === 'pages') dataToExport = pages;

    if (dataToExport.length === 0) return;

    const headers = Object.keys(dataToExport[0]).join(',');
    const rows = dataToExport.map(row =>
      Object.values(row)
        .map(val => `"${String(val || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentSheetMeta.name}_vercel_db_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportBackupJSON = () => {
    const fullBackup = {
      exported_at: new Date().toISOString(),
      provider: 'PostgreSQL Cloud Database',
      data: {
        china,
        amulet,
        otop,
        agriculture,
        orders,
        customers,
        pages
      }
    };
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `superai_postgres_backup_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Template Modal for Adding New
  const handleOpenAddTemplate = (cat: ProductCategory) => {
    setEditingProduct(null);
    setModalCategory(cat);
    setIsTemplateModalOpen(true);
  };

  // Open Template Modal for Editing
  const handleOpenEditTemplate = (item: any, cat: ProductCategory) => {
    setEditingProduct({ ...item, category_type: cat });
    setModalCategory(cat);
    setIsTemplateModalOpen(true);
  };

  // Handle Save from Template Modal with bidirectional Facebook Page sync
  const handleSaveProductTemplate = (cat: ProductCategory, productData: any) => {
    // 1. Update respective product array
    if (cat === 'CHINA') {
      const existingIdx = china.findIndex(p => p.product_id === productData.product_id);
      let updated: ProductChina[];
      if (existingIdx >= 0) {
        updated = [...china];
        updated[existingIdx] = mergeCatalogRow(china[existingIdx], productData);
      } else {
        updated = [mergeCatalogRow({}, productData), ...china];
      }
      setChina(updated);
      onSaveToBackend('china', updated);
    } else if (cat === 'AMULET') {
      const existingIdx = amulet.findIndex(p => p.product_id === productData.product_id);
      let updated: ProductAmulet[];
      if (existingIdx >= 0) {
        updated = [...amulet];
        updated[existingIdx] = mergeCatalogRow(amulet[existingIdx], productData);
      } else {
        updated = [mergeCatalogRow({}, productData), ...amulet];
      }
      setAmulet(updated);
      onSaveToBackend('amulet', updated);
    } else if (cat === 'OTOP') {
      const existingIdx = otop.findIndex(p => p.product_id === productData.product_id);
      let updated: ProductOtop[];
      if (existingIdx >= 0) {
        updated = [...otop];
        updated[existingIdx] = mergeCatalogRow(otop[existingIdx], productData);
      } else {
        updated = [mergeCatalogRow({}, productData), ...otop];
      }
      setOtop(updated);
      onSaveToBackend('otop', updated);
    } else if (cat === 'AGRICULTURE') {
      const existingIdx = (agriculture || []).findIndex(p => p.product_id === productData.product_id);
      let updated: ProductAgriculture[];
      if (existingIdx >= 0) {
        updated = [...agriculture];
        updated[existingIdx] = mergeCatalogRow(agriculture[existingIdx], productData);
      } else {
        updated = [mergeCatalogRow({}, productData), ...(agriculture || [])];
      }
      setAgriculture(updated);
      onSaveToBackend('agriculture', updated);
    }

    // 2. Bidirectional sync with Facebook Page (pages state)
    if (productData.page_id) {
      const targetPage = pages.find(p => p.page_id === productData.page_id);
      if (targetPage) {
        const updatedPages = pages.map(p => {
          if (p.page_id === productData.page_id) {
            return {
              ...p,
              category: cat,
              product: {
                ...p.product,
                product_id: productData.product_id,
                product_name: productData.product_name,
                category: productData.category || cat,
                display_price: Number(productData.display_price ?? productData.price_1 ?? p.product.display_price ?? 0),
                base_price: Number(productData.display_price ?? p.product.base_price ?? 0),
                shipping_duration: productData.shipping_duration || p.product.shipping_duration || '',
                description: productData.description || productData.detail_text || productData.belief_info || '',
                images: {
                  main: productData.image_main || p.product.images.main,
                  detail: productData.image_detail || p.product.images.detail,
                  promotion: productData.image_promotion || p.product.images.promotion,
                  review: productData.image_review || p.product.images.review,
                  closing: productData.image_closing || p.product.images.closing
                },
                // Feature 8: reuse the SAME real promotion tiers (custom names, free_shipping,
                // gift_quantity) instead of fabricating prices/gift/shipping claims.
                promotions: resolvePromotionTiers(productData.promotions, p.product.promotions, productData),
                specs: {
                  ...p.product.specs,
                  ...productData,
                  material: productData.material || p.product.specs?.material,
                  dimensions: productData.size || p.product.specs?.dimensions,
                  weight: productData.weight || p.product.specs?.weight,
                  warranty: productData.shipping_info || productData.warning || p.product.specs?.warranty,
                  temple: productData.temple || p.product.specs?.temple,
                  master: productData.master || p.product.specs?.master,
                  year: productData.year || p.product.specs?.year,
                  edition: productData.edition || p.product.specs?.edition,
                  history: productData.history || p.product.specs?.history,
                  belief_info: productData.belief_info || p.product.specs?.belief_info,
                  spell: productData.spell || p.product.specs?.spell,
                  worship_method: productData.worship_method || p.product.specs?.worship_method,
                  care_instruction: productData.care_instruction || p.product.specs?.care_instruction,
                  warning: productData.warning || p.product.specs?.warning,
                  community: productData.community || p.product.specs?.community,
                  province: productData.province || p.product.specs?.province,
                  maker: productData.maker || p.product.specs?.maker,
                  origin: productData.origin || p.product.specs?.origin,
                  story: productData.story || p.product.specs?.story,
                  production_method: productData.production_method || p.product.specs?.production_method,
                  formula_or_type: productData.formula_or_type || p.product.specs?.formula_or_type,
                  suitable_for: productData.suitable_for || p.product.specs?.suitable_for,
                  usage_instructions: productData.usage_instructions || p.product.specs?.usage_instructions,
                  benefits: productData.benefits || p.product.specs?.benefits,
                  registration_number: productData.registration_number || p.product.specs?.registration_number,
                  package_size: productData.package_size || p.product.specs?.package_size,
                  safety_warning: productData.safety_warning || p.product.specs?.safety_warning,
                  brand: productData.brand || p.product.specs?.brand,
                  features: productData.features || p.product.specs?.features,
                  usage: productData.usage || p.product.specs?.usage,
                  benefit: productData.benefit || p.product.specs?.benefit,
                  shipping_info: productData.shipping_info || p.product.specs?.shipping_info,
                  custom_specs: productData.custom_specs || p.product.specs?.custom_specs || []
                }
              },
              sequence: {
                ...p.sequence,
                step1_opening_text: productData.opening_text || p.sequence.step1_opening_text,
                step2_product_image: productData.image_detail || productData.image_main || p.sequence.step2_product_image,
                step3_promotion_detail: productData.promotion_text || productData.promotion_detail || p.sequence.step3_promotion_detail,
                step4_promotion_image: productData.image_promotion || p.sequence.step4_promotion_image,
                step5_review_image: productData.image_review || p.sequence.step5_review_image,
                step6_closing_text: productData.closing_text || p.sequence.step6_closing_text
              }
            };
          }
          return p;
        });

        setPages(updatedPages);
        onSaveToBackend('pages', updatedPages);
      }
    }
  };

  const handleDeleteItem = (index: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้ออกจากฐานข้อมูล?')) return;
    if (activeSheet === 'amulet') {
      const updated = amulet.filter((_, i) => i !== index);
      setAmulet(updated);
      onSaveToBackend('amulet', updated);
    } else if (activeSheet === 'china') {
      const updated = china.filter((_, i) => i !== index);
      setChina(updated);
      onSaveToBackend('china', updated);
    } else if (activeSheet === 'otop') {
      const updated = otop.filter((_, i) => i !== index);
      setOtop(updated);
      onSaveToBackend('otop', updated);
    } else if (activeSheet === 'agriculture') {
      const updated = agriculture.filter((_, i) => i !== index);
      setAgriculture(updated);
      onSaveToBackend('agriculture', updated);
    } else if (activeSheet === 'orders') {
      const updated = orders.filter((_, i) => i !== index);
      setOrders(updated);
      onSaveToBackend('orders', updated);
    } else if (activeSheet === 'customers') {
      const updated = customers.filter((_, i) => i !== index);
      setCustomers(updated);
      onSaveToBackend('customers', updated);
    }
  };

  // Helper to get Page Name by page_id
  const getPageName = (pageId: string) => {
    const p = pages.find(page => page.page_id === pageId);
    return p ? p.page_name : pageId;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Vercel Cloud Database Status */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/60 shadow-xs">
                <Database className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-lg flex items-center gap-2">
                  ระบบฐานข้อมูลคลาวด์ PostgreSQL (ซิงค์อัตโนมัติ)
                  <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                    POSTGRES ACTIVE
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  จัดการสินค้าด้วยเทมเพลตภาษาไทยละเอียดตามหมวดหมู่ เชื่อมต่อ PostgreSQL อัตโนมัติ (ตั้ง DATABASE_URL บนคลาวด์ หรือรัน local แบบ embedded) พร้อมสำรอง/นำเข้า JSON แบบกันข้อมูลซ้ำ
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={openDbStatus}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>⚙️ สถานะฐานข้อมูล (อัตโนมัติ)</span>
            </button>
            <button
              onClick={handleSyncVercelDB}
              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-[#141418] dark:hover:bg-[#181820] text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700/80 transition-all flex items-center gap-2 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${syncStatus ? 'animate-spin' : ''}`} />
              <span>ซิงค์ข้อมูล → PostgreSQL</span>
            </button>
            <button
              onClick={handleExportBackupJSON}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-500" />
              <span>สำรองฐานข้อมูล (JSON)</span>
            </button>
            <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportBackup(f); e.target.value = ''; }} />
            <button
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs disabled:opacity-50"
            >
              <Upload className={`w-3.5 h-3.5 ${importing ? 'animate-pulse' : ''}`} />
              <span>{importing ? 'กำลังนำเข้า...' : 'นำเข้าฐานข้อมูล (JSON)'}</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/40 rounded-xl text-xs font-mono text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{syncStatus}</span>
          </div>
        )}
      </div>

      {/* Sheets Navigation Tabs */}
      <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {sheetsMeta.map(sheet => {
          const isActive = activeSheet === sheet.id;
          return (
            <button
              key={sheet.id}
              onClick={() => {
                setActiveSheet(sheet.id as any);
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white dark:bg-[#0F0F12] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-[#141418] border border-slate-200 dark:border-zinc-800'
              }`}
            >
              <span>{sheet.icon}</span>
              <span className="font-mono">{sheet.name}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                  isActive ? 'bg-indigo-700/80 text-white' : 'bg-slate-100 dark:bg-[#141418] text-slate-500 dark:text-zinc-500'
                }`}
              >
                {sheet.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls Bar: Search & Add via Template & Export */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder={`ค้นหาในตาราง ${currentSheetMeta.name}...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          {activeSheet === 'china' && (
            <button
              onClick={() => handleOpenAddTemplate('CHINA')}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4" /> กรอกเทมเพลตเพิ่มสินค้าจีน
            </button>
          )}
          {activeSheet === 'amulet' && (
            <button
              onClick={() => handleOpenAddTemplate('AMULET')}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-amber-600/20"
            >
              <Plus className="w-4 h-4" /> กรอกเทมเพลตเพิ่มพระเครื่อง
            </button>
          )}
          {activeSheet === 'otop' && (
            <button
              onClick={() => handleOpenAddTemplate('OTOP')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" /> กรอกเทมเพลตเพิ่มสินค้าโอทอป
            </button>
          )}
          {activeSheet === 'agriculture' && (
            <button
              onClick={() => handleOpenAddTemplate('AGRICULTURE')}
              className="px-4 py-2.5 bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-lime-600/20"
            >
              <Plus className="w-4 h-4" /> กรอกเทมเพลตเพิ่มสินค้าการเกษตร
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-[#141418] dark:hover:bg-[#181820] text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700/80 flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> ส่งออก CSV
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          {/* 1. PRODUCT_CHINA TABLE */}
          {activeSheet === 'china' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">product_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เพจที่ผูก (page_id)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[200px]">ชื่อสินค้า (product_name)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">แบรนด์ (brand)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">หมวดหมู่ (category)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ราคา 1 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">โปร 2 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">โปร 3 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">จุดเด่น (features)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รูปภาพ 5 สเต็ป</th>
                  <th className="p-3.5 min-w-[200px]">สคริปต์ปิดการขาย (closing_text)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {china
                  .filter(
                    p =>
                      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map((item, idx) => (
                    <tr key={item.product_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingSpecsProduct({ item, category: 'CHINA' })}
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                            title="ดูสเปกสินค้าแบบละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditTemplate(item, 'CHINA')}
                            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-lg"
                            title="แก้ไขในเทมเพลต"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                        {item.product_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1">
                          <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> {getPageName(item.page_id)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">{item.page_id}</span>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.product_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap font-medium text-slate-600 dark:text-zinc-300">
                        {item.brand || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap text-slate-500">
                        {item.category || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.price_1?.toLocaleString() || item.display_price?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        ฿{item.price_2?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        ฿{item.price_3?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300">
                        {item.features || item.description || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                          {item.image_main && (
                            <img
                              src={item.image_main}
                              alt="Main"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_main)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปหลัก"
                            />
                          )}
                          {item.image_promotion && (
                            <img
                              src={item.image_promotion}
                              alt="Promo"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_promotion)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปโปรโมชั่น"
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 dark:text-zinc-400">
                        <div className="line-clamp-2">{item.closing_text}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 2. PRODUCT_AMULET TABLE */}
          {activeSheet === 'amulet' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">product_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เพจที่ผูก (page_id)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[200px]">ชื่อวัตถุมงคล (product_name)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">วัด (temple)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เกจิ (master)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ปี / รุ่น (year / edition)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">มวลสาร (material)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ราคาบูชา 1 องค์</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">พุทธคุณแท้ (belief_info)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[180px]">คาถาบูชา (spell)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รูปภาพ 5 สเต็ป</th>
                  <th className="p-3.5 min-w-[200px]">สคริปต์ปิดยอดบูชา (closing_text)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {amulet
                  .filter(
                    p =>
                      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.temple.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={item.product_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingSpecsProduct({ item, category: 'AMULET' })}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                            title="ดูสเปกสินค้าแบบรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditTemplate(item, 'AMULET')}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-zinc-800 rounded-lg"
                            title="แก้ไขในเทมเพลต"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-amber-600 dark:text-amber-400 font-bold whitespace-nowrap">
                        {item.product_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1">
                          <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> {getPageName(item.page_id)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">{item.page_id}</span>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.product_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-amber-700 dark:text-amber-300/90 whitespace-nowrap font-medium">
                        {item.temple}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap font-medium">
                        {item.master}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {item.year} ({item.edition})
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                        {item.material}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.price_1?.toLocaleString() || item.display_price?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300">
                        {item.belief_info}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs font-mono text-indigo-700 dark:text-indigo-300">
                        {item.spell}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                          {item.image_main && (
                            <img
                              src={item.image_main}
                              alt="Main"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_main)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปหลัก"
                            />
                          )}
                          {item.image_promotion && (
                            <img
                              src={item.image_promotion}
                              alt="Promo"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_promotion)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปโปรโมชั่น"
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 dark:text-zinc-400">
                        <div className="line-clamp-2">{item.closing_text}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 3. PRODUCT_OTOP TABLE */}
          {activeSheet === 'otop' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">product_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เพจที่ผูก (page_id)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[200px]">ชื่อสินค้า OTOP (product_name)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">วิสาหกิจชุมชน (community)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จังหวัด (province)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ผู้ผลิต (maker)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ราคา 1 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">โปร 2 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">เรื่องราว (story)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รูปภาพ 5 สเต็ป</th>
                  <th className="p-3.5 min-w-[200px]">สคริปต์ปิดการขาย (closing_text)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {otop
                  .filter(
                    p =>
                      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.province.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={item.product_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingSpecsProduct({ item, category: 'OTOP' })}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                            title="ดูสเปกสินค้าแบบรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditTemplate(item, 'OTOP')}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-lg"
                            title="แก้ไขในเทมเพลต"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                        {item.product_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1">
                          <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> {getPageName(item.page_id)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">{item.page_id}</span>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.product_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                        {item.community}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-emerald-700 dark:text-emerald-400 whitespace-nowrap font-medium">
                        {item.province}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-500 whitespace-nowrap">
                        {item.maker}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.price_1?.toLocaleString() || item.display_price?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        ฿{item.price_2?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300">
                        {item.story}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                          {item.image_main && (
                            <img
                              src={item.image_main}
                              alt="Main"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_main)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปหลัก"
                            />
                          )}
                          {item.image_promotion && (
                            <img
                              src={item.image_promotion}
                              alt="Promo"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_promotion)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปโปรโมชั่น"
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 dark:text-zinc-400">
                        <div className="line-clamp-2">{item.closing_text}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 4. PRODUCT_AGRICULTURE TABLE */}
          {activeSheet === 'agriculture' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">product_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เพจที่ผูก (page_id)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[200px]">ชื่อสินค้าการเกษตร (product_name)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">แบรนด์ (brand)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">สูตร / ชนิด</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ราคา 1 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">โปร 2 ชิ้น</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">วิธีใช้ (usage_instructions)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รูปภาพ 5 สเต็ป</th>
                  <th className="p-3.5 min-w-[200px]">สคริปต์ปิดการขาย (closing_text)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {(agriculture || [])
                  .filter(
                    p =>
                      p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.product_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.brand.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={item.product_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingSpecsProduct({ item, category: 'AGRICULTURE' })}
                            className="p-1.5 text-lime-600 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                            title="ดูสเปกสินค้าแบบรายละเอียด"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditTemplate(item, 'AGRICULTURE')}
                            className="p-1.5 text-lime-600 dark:text-lime-400 hover:bg-lime-50 dark:hover:bg-zinc-800 rounded-lg"
                            title="แก้ไขในเทมเพลต"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            title="ลบแถว"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-lime-600 dark:text-lime-400 font-bold whitespace-nowrap">
                        {item.product_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1">
                          <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> {getPageName(item.page_id)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">{item.page_id}</span>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.product_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap font-medium text-slate-700 dark:text-zinc-300">
                        {item.brand}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-500 whitespace-nowrap">
                        {item.formula_or_type}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.price_1?.toLocaleString() || item.display_price?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                        ฿{item.price_2?.toLocaleString() || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs text-slate-600 dark:text-zinc-300">
                        {item.usage_instructions}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60">
                        <div className="flex items-center gap-1.5">
                          {item.image_main && (
                            <img
                              src={item.image_main}
                              alt="Main"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_main)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปหลัก"
                            />
                          )}
                          {item.image_promotion && (
                            <img
                              src={item.image_promotion}
                              alt="Promo"
                              referrerPolicy="no-referrer"
                              onClick={() => setSelectedImagePreview(item.image_promotion)}
                              className="w-8 h-8 rounded-lg object-cover cursor-pointer border border-slate-200 dark:border-zinc-700 hover:border-indigo-500"
                              title="รูปโปรโมชั่น"
                            />
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 dark:text-zinc-400">
                        <div className="line-clamp-2">{item.closing_text}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 5. ORDERS TABLE */}
          {activeSheet === 'orders' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">order_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ลูกค้า</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เบอร์โทร</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">ที่อยู่จัดส่งพัสดุ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รายการสินค้า</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ยอดรวม COD</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">สถานะ</th>
                  <th className="p-3.5">วันที่สั่งซื้อ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {orders
                  .filter(
                    o =>
                      o.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      o.phone_number.includes(searchTerm)
                  )
                  .map((item, idx) => (
                    <tr key={item.order_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                          title="ลบแถว"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                        {item.order_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.customer_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono">
                        {item.phone_number}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs">
                        {item.shipping_address}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-medium">
                        {item.items}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.total_amount?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {item.payment_status}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 6. CUSTOMERS TABLE */}
          {activeSheet === 'customers' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จัดการ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">customer_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ชื่อลูกค้า</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">เบอร์โทร</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[220px]">ที่อยู่</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">หมวดหมู่ที่ชอบ</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ยอดซื้อรวม (LTV)</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">จำนวนออเดอร์</th>
                  <th className="p-3.5">ระดับลูกค้า (Tier)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {customers
                  .filter(
                    c =>
                      c.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      c.phone_number.includes(searchTerm) ||
                      c.customer_id.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={item.customer_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                          title="ลบแถว"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                        {item.customer_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.customer_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono">
                        {item.phone_number}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-xs">
                        {item.address}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-semibold">
                        {item.category_preference}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ฿{item.total_spent?.toLocaleString()}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono font-bold text-center">
                        {item.order_count}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.tier === 'VIP'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                          }`}
                        >
                          {item.tier || 'NORMAL'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* 7. PAGES TABLE */}
          {activeSheet === 'pages' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">page_id</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[200px]">ชื่อเพจ Facebook</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">หมวดหมู่</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">สินค้าหลักที่ผูก</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">โมเดล AI</th>
                  <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">สถานะตอบบอท</th>
                  <th className="p-3.5">ช่องทางแจ้งเตือน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {pages
                  .filter(
                    p =>
                      p.page_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.page_id.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((item, idx) => (
                    <tr key={item.page_id || idx} className="hover:bg-slate-50 dark:hover:bg-[#141418] transition-colors">
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                        {item.page_id}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-bold text-slate-900 dark:text-zinc-100">
                        {item.page_name}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-semibold whitespace-nowrap">
                        {item.category}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 text-slate-700 dark:text-zinc-300">
                        {item.product?.product_name || '-'}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 font-mono text-indigo-600 whitespace-nowrap">
                        {item.ai_model}
                      </td>
                      <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800/60 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.auto_reply
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.auto_reply ? 'เปิดใช้งาน (ACTIVE)' : 'ปิดใช้งาน'}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-mono text-slate-500">
                        {item.notification_channel || 'BOTH'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Product Template Modal (Add / Edit) */}
      <ProductTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        pages={pages}
        category={modalCategory}
        initialData={editingProduct}
        onSave={handleSaveProductTemplate}
      />

      {/* Detailed Product Specifications Modal Viewer */}
      {viewingSpecsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-[#0A0A0C] shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                    📋 ข้อมูลสเปกสินค้าแบบรายละเอียด (Detailed Product Specifications)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {viewingSpecsProduct.item.product_name} ({viewingSpecsProduct.item.product_id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingSpecsProduct(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Product Header Card */}
              <div className="p-4 bg-slate-50 dark:bg-[#14141A] rounded-xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                    {viewingSpecsProduct.category}
                  </span>
                  <h4 className="font-extrabold text-slate-900 dark:text-zinc-100 text-base mt-1">
                    {viewingSpecsProduct.item.product_name}
                  </h4>
                  <p className="text-slate-500 dark:text-zinc-400 text-xs">
                    ผูกกับเพจ: {getPageName(viewingSpecsProduct.item.page_id)} ({viewingSpecsProduct.item.page_id})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-mono">ราคาตั้งต้น / โปร 1</span>
                  <span className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ฿{(viewingSpecsProduct.item.price_1 || viewingSpecsProduct.item.display_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Category Detailed Specs Grid */}
              {viewingSpecsProduct.category === 'AMULET' && (
                <div className="space-y-3">
                  <h5 className="font-bold text-amber-600 dark:text-amber-400 text-xs border-b border-amber-200 dark:border-amber-900/40 pb-1">
                    📿 ข้อมูลเฉพาะสเปกพระเครื่อง & วัตถุมงคล (PRODUCT_AMULET)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-amber-50/30 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/30">
                    <div><strong className="text-slate-700 dark:text-zinc-300">วัด / สำนัก:</strong> {viewingSpecsProduct.item.temple || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">พระเกจิ / ผู้สร้าง:</strong> {viewingSpecsProduct.item.master || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ปีที่สร้าง:</strong> {viewingSpecsProduct.item.year || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">รุ่น / พิมพ์:</strong> {viewingSpecsProduct.item.edition || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">เนื้อวัสดุ / มวลสาร:</strong> {viewingSpecsProduct.item.material || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">จำนวนการสร้าง:</strong> {viewingSpecsProduct.item.quantity || viewingSpecsProduct.item.quantity_created || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">ข้อมูลความเชื่อ (พุทธคุณ):</strong> {viewingSpecsProduct.item.belief_info || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">คาถาบทสวด:</strong> <span className="font-mono text-indigo-600 dark:text-indigo-400">{viewingSpecsProduct.item.spell || '-'}</span></div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">วิธีบูชา:</strong> {viewingSpecsProduct.item.worship_method || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">การดูแลรักษา:</strong> {viewingSpecsProduct.item.care_instruction || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ข้อควรระวัง:</strong> {viewingSpecsProduct.item.warning || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">ประวัติจัดสร้าง:</strong> {viewingSpecsProduct.item.history || '-'}</div>
                  </div>
                </div>
              )}

              {viewingSpecsProduct.category === 'CHINA' && (
                <div className="space-y-3">
                  <h5 className="font-bold text-indigo-600 dark:text-indigo-400 text-xs border-b border-indigo-200 dark:border-indigo-900/40 pb-1">
                    📦 ข้อมูลสเปกสินค้านำเข้าจีน / ไอที (PRODUCT_CHINA)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-indigo-50/30 dark:bg-indigo-950/10 p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/30">
                    <div><strong className="text-slate-700 dark:text-zinc-300">แบรนด์ / ยี่ห้อ:</strong> {viewingSpecsProduct.item.brand || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">วัสดุ:</strong> {viewingSpecsProduct.item.material || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ขนาด:</strong> {viewingSpecsProduct.item.size || viewingSpecsProduct.item.dimensions || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">น้ำหนัก:</strong> {viewingSpecsProduct.item.weight || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">วิธีใช้งาน:</strong> {viewingSpecsProduct.item.usage || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ข้อมูลจัดส่ง & การรับประกัน:</strong> {viewingSpecsProduct.item.shipping_info || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">คุณสมบัติเด่น:</strong> {viewingSpecsProduct.item.features || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">ประโยชน์ / จุดเด่น:</strong> {viewingSpecsProduct.item.benefit || '-'}</div>
                  </div>
                </div>
              )}

              {viewingSpecsProduct.category === 'OTOP' && (
                <div className="space-y-3">
                  <h5 className="font-bold text-emerald-600 dark:text-emerald-400 text-xs border-b border-emerald-200 dark:border-emerald-900/40 pb-1">
                    🌿 ข้อมูลสเปกสินค้า OTOP ภูมิปัญญาไทย (PRODUCT_OTOP)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-emerald-50/30 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/30">
                    <div><strong className="text-slate-700 dark:text-zinc-300">ชุมชน / กลุ่มผู้ผลิต:</strong> {viewingSpecsProduct.item.community || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">จังหวัด:</strong> {viewingSpecsProduct.item.province || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ผู้ผลิต / ผู้ประกอบการ:</strong> {viewingSpecsProduct.item.maker || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">แหล่งที่มา:</strong> {viewingSpecsProduct.item.origin || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">วัตถุดิบ / วัสดุ:</strong> {viewingSpecsProduct.item.material || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ขนาด & น้ำหนัก:</strong> {viewingSpecsProduct.item.size} {viewingSpecsProduct.item.weight}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">เรื่องราวสินค้า (Story):</strong> {viewingSpecsProduct.item.story || '-'}</div>
                    <div className="md:col-span-2"><strong className="text-slate-700 dark:text-zinc-300">วิธีการผลิตโบราณ:</strong> {viewingSpecsProduct.item.production_method || '-'}</div>
                  </div>
                </div>
              )}

              {viewingSpecsProduct.category === 'AGRICULTURE' && (
                <div className="space-y-3">
                  <h5 className="font-bold text-lime-600 dark:text-lime-400 text-xs border-b border-lime-200 dark:border-lime-900/40 pb-1">
                    🌱 ข้อมูลสเปกสินค้าการเกษตร ปุ๋ย ยา พืชพันธุ์ (PRODUCT_AGRICULTURE)
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-lime-50/30 dark:bg-lime-950/10 p-4 rounded-xl border border-lime-200/60 dark:border-lime-900/30">
                    <div><strong className="text-slate-700 dark:text-zinc-300">ข้อมูลพืช & หมวดย่อย:</strong> {viewingSpecsProduct.item.subcategory} ({viewingSpecsProduct.item.species || 'พืชพันธุ์'})</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">สายพันธุ์ F1 / พันธุ์:</strong> {viewingSpecsProduct.item.variety || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">อัตราการงอก:</strong> {viewingSpecsProduct.item.germination_rate || viewingSpecsProduct.item.germination_days || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">การเพาะ & การปลูก:</strong> {viewingSpecsProduct.item.germination_method || viewingSpecsProduct.item.planting_method || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ระยะห่างแปลง:</strong> {viewingSpecsProduct.item.spacing || viewingSpecsProduct.item.plant_spacing || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">แสง & อุณหภูมิ:</strong> {viewingSpecsProduct.item.sunlight || viewingSpecsProduct.item.sunlight_requirement} {viewingSpecsProduct.item.temperature}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">การรดน้ำ:</strong> {viewingSpecsProduct.item.watering || viewingSpecsProduct.item.watering_frequency || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ปุ๋ย & อัตราการใช้:</strong> {viewingSpecsProduct.item.fertilizer || viewingSpecsProduct.item.fertilizer_formula || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ระยะเวลาเก็บเกี่ยว:</strong> {viewingSpecsProduct.item.harvest_time || viewingSpecsProduct.item.harvest_days || '-'}</div>
                    <div><strong className="text-slate-700 dark:text-zinc-300">ผลผลิตคาดการณ์:</strong> {viewingSpecsProduct.item.yield || viewingSpecsProduct.item.expected_yield || '-'}</div>
                  </div>
                </div>
              )}

              {/* Step 1 - Step 6 Sales Closing Info */}
              <div className="p-4 bg-slate-50 dark:bg-[#14141A] rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
                <h6 className="font-bold text-slate-800 dark:text-zinc-200">💬 สคริปต์เปิด & ปิดการขาย 6 สเต็ป</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-400">Step 1 ข้อความเปิดทัก:</span> <p className="font-mono text-slate-700 dark:text-zinc-300">{viewingSpecsProduct.item.opening_text || '-'}</p></div>
                  <div><span className="text-slate-400">Step 6 ข้อความปิดสรุปยอด:</span> <p className="font-mono text-slate-700 dark:text-zinc-300">{viewingSpecsProduct.item.closing_text || '-'}</p></div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0A0A0C] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setViewingSpecsProduct(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-xs"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = viewingSpecsProduct.item;
                  const cat = viewingSpecsProduct.category;
                  setViewingSpecsProduct(null);
                  handleOpenEditTemplate(item, cat);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-600/20"
              >
                <Edit className="w-4 h-4" /> ✏️ แก้ไขสเปกนี้ในเทมเพลต Vercel DB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div className="relative max-w-2xl w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
            <img
              src={selectedImagePreview}
              alt="Preview"
              referrerPolicy="no-referrer"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black text-white rounded-full transition-colors"
            >
              <Trash2 className="w-5 h-5 text-transparent" />
              <span className="text-white font-bold text-sm">✕</span>
            </button>
          </div>
        </div>
      )}
      {/* Vercel / Cloud DB Connection Settings Modal */}
      {isCloudConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121318] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-100 dark:border-indigo-800/60">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base">
                    สถานะฐานข้อมูล PostgreSQL
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    เชื่อมต่ออัตโนมัติ — ไม่ต้องตั้งค่าอะไรเอง (ระบบอ่านจาก DATABASE_URL บนเซิร์ฟเวอร์)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCloudConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm p-1.5"
              >
                ✕
              </button>
            </div>

            {dbStatusLoading ? (
              <p className="text-xs text-slate-500 dark:text-zinc-400 text-center py-6">กำลังตรวจสอบสถานะ...</p>
            ) : dbStatus ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  เชื่อมต่อสำเร็จ: {dbStatus.engine} ({dbStatus.mode})
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181920] border border-slate-200 dark:border-zinc-800">
                    <div className="text-slate-500 dark:text-zinc-400 text-[10px]">เซิร์ฟเวอร์</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-zinc-100 break-all">{dbStatus.host}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181920] border border-slate-200 dark:border-zinc-800">
                    <div className="text-slate-500 dark:text-zinc-400 text-[10px]">ชื่อฐานข้อมูล</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-zinc-100">{dbStatus.database}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181920] border border-slate-200 dark:border-zinc-800">
                    <div className="text-slate-500 dark:text-zinc-400 text-[10px]">เพจ / ลูกค้า / ออเดอร์</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-zinc-100">{dbStatus.counts.pages} / {dbStatus.counts.customers} / {dbStatus.counts.orders}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#181920] border border-slate-200 dark:border-zinc-800">
                    <div className="text-slate-500 dark:text-zinc-400 text-[10px]">สินค้า / เซิร์ฟเวอร์รันมาแล้ว</div>
                    <div className="font-mono font-bold text-slate-800 dark:text-zinc-100">{dbStatus.counts.products} ชิ้น / {Math.floor(dbStatus.uptimeSec / 60)} นาที</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-500 text-center py-6">ตรวจสอบสถานะไม่สำเร็จ — ลองเปิดใหม่อีกครั้ง</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsCloudConfigModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
