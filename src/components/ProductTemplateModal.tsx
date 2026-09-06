import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Sparkles,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  Facebook,
  Tag,
  DollarSign,
  FileText,
  ShieldAlert,
  Info,
  Plus,
  Trash2
} from 'lucide-react';
import {
  ProductAmulet,
  ProductChina,
  ProductOtop,
  ProductAgriculture,
  ProductCategory,
  PageConfig,
  CustomSpecItem
} from '../types';
import { parseTextToSpecs } from '../utils/aiSpecParser';

interface ProductTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PageConfig[];
  category: ProductCategory;
  initialData?: any | null;
  onSave: (category: ProductCategory, productData: any) => void;
}

export const ProductTemplateModal: React.FC<ProductTemplateModalProps> = ({
  isOpen,
  onClose,
  pages,
  category: initialCategory,
  initialData,
  onSave
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(
    initialData?.category_type || initialCategory || 'CHINA'
  );

  const [formData, setFormData] = useState<any>({
    product_id: '',
    page_id: pages[0]?.page_id || 'AMULET_PAGE_ID',
    product_name: '',
    category: '',
    display_price: 0,
    cost_price: 0,
    shipping_cost: 0,
    price_1: 0,
    price_2: 0,
    price_3: 0,
    promotion_detail: '',
    shipping_duration: '',
    image_main: '',
    image_detail: '',
    image_promotion: '',
    image_review: '',
    image_closing: '',
    opening_text: 'สวัสดีค่ะ สนใจสอบถามข้อมูลเพิ่มเติม ทักแชทหาแอดมินได้เลยนะคะ 🙏',
    detail_text: '',
    promotion_text: '',
    review_text: '',
    closing_text: 'แจ้งชื่อ-ที่อยู่ และเบอร์โทรศัพท์ เพื่อให้แอดมินดำเนินการจัดส่งได้เลยนะคะ',
    // Specific defaults
    brand: '',
    description: '',
    features: '',
    material: '',
    size: '',
    weight: '',
    usage: '',
    benefit: '',
    shipping_info: '',
    temple: '',
    master: '',
    year: '',
    edition: '',
    quantity: 1,
    history: '',
    belief_info: '',
    spell: '',
    worship_method: '',
    care_instruction: '',
    warning: '',
    community: '',
    province: '',
    maker: '',
    origin: '',
    story: '',
    production_method: '',
    formula_or_type: '',
    suitable_for: '',
    usage_instructions: '',
    benefits: '',
    registration_number: '',
    package_size: '',
    safety_warning: '',
    custom_specs: []
  });

  const [activeSection, setActiveSection] = useState<'info' | 'pricing' | 'images' | 'scripts'>('info');

  // AI Auto-Key State
  const [aiAutoText, setAiAutoText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiAutoSuccess, setAiAutoSuccess] = useState(false);
  const [showAiAutoBox, setShowAiAutoBox] = useState(true);

  const handleRunAiAutoKey = () => {
    if (!aiAutoText.trim()) {
      alert('กรุณาวางข้อความรายละเอียดสินค้าหรือข้อมูลสเปกในช่องก่อนกด AI Auto-Key ค่ะ');
      return;
    }
    setIsAiParsing(true);
    setTimeout(() => {
      const parsed = parseTextToSpecs(aiAutoText, selectedCategory);
      setFormData((prev: any) => ({
        ...prev,
        ...parsed
      }));
      setIsAiParsing(false);
      setAiAutoSuccess(true);
      setTimeout(() => setAiAutoSuccess(false), 4500);
    }, 400);
  };

  const handleAddCustomSpec = () => {
    const newItem: CustomSpecItem = {
      id: `spec-${Date.now()}`,
      key: '',
      value: ''
    };
    setFormData((prev: any) => ({
      ...prev,
      custom_specs: [...(prev.custom_specs || []), newItem]
    }));
  };

  const handleRemoveCustomSpec = (id: string) => {
    setFormData((prev: any) => ({
      ...prev,
      custom_specs: (prev.custom_specs || []).filter((s: CustomSpecItem) => s.id !== id)
    }));
  };

  const handleUpdateCustomSpec = (id: string, field: 'key' | 'value', val: string) => {
    setFormData((prev: any) => ({
      ...prev,
      custom_specs: (prev.custom_specs || []).map((s: CustomSpecItem) =>
        s.id === id ? { ...s, [field]: val } : s
      )
    }));
  };

  useEffect(() => {
    if (initialData) {
      const specsObj = initialData.specs || {};
      const productObj = initialData.product || {};
      const seqObj = initialData.sequence || {};

      const existingCustom = initialData.custom_specs || specsObj.custom_specs || (
        initialData.attributes
          ? Object.entries(initialData.attributes).map(([k, v], i) => ({ id: `spec-${i}`, key: k, value: String(v) }))
          : []
      );

      setFormData((prev: any) => ({
        ...prev,
        ...specsObj,
        ...productObj,
        ...initialData,
        custom_specs: existingCustom,
        page_id: initialData.page_id || pages[0]?.page_id || 'AMULET_PAGE_ID',
        material: initialData.material || specsObj.material || prev.material || '',
        size: initialData.size || specsObj.dimensions || prev.size || '',
        weight: initialData.weight || specsObj.weight || prev.weight || '',
        shipping_info: initialData.shipping_info || specsObj.warranty || prev.shipping_info || '',
        temple: initialData.temple || specsObj.temple || specsObj.origin_or_temple || prev.temple || '',
        master: initialData.master || specsObj.master || specsObj.master_or_maker || prev.master || '',
        year: initialData.year || specsObj.year || specsObj.ceremony_or_batch || prev.year || '',
        edition: initialData.edition || specsObj.edition || prev.edition || '',
        history: initialData.history || specsObj.history || prev.history || '',
        belief_info: initialData.belief_info || specsObj.belief_info || prev.belief_info || '',
        spell: initialData.spell || specsObj.spell || specsObj.spell_or_instructions || prev.spell || '',
        worship_method: initialData.worship_method || specsObj.worship_method || prev.worship_method || '',
        care_instruction: initialData.care_instruction || specsObj.care_instruction || prev.care_instruction || '',
        warning: initialData.warning || specsObj.warning || prev.warning || '',
        community: initialData.community || specsObj.community || prev.community || '',
        province: initialData.province || specsObj.province || prev.province || '',
        maker: initialData.maker || specsObj.maker || prev.maker || '',
        origin: initialData.origin || specsObj.origin || prev.origin || '',
        story: initialData.story || specsObj.story || prev.story || '',
        production_method: initialData.production_method || specsObj.production_method || prev.production_method || '',
        formula_or_type: initialData.formula_or_type || specsObj.formula_or_type || prev.formula_or_type || '',
        suitable_for: initialData.suitable_for || specsObj.suitable_for || prev.suitable_for || '',
        usage_instructions: initialData.usage_instructions || specsObj.usage_instructions || prev.usage_instructions || '',
        benefits: initialData.benefits || specsObj.benefits || prev.benefits || '',
        registration_number: initialData.registration_number || specsObj.registration_number || prev.registration_number || '',
        package_size: initialData.package_size || specsObj.package_size || prev.package_size || '',
        safety_warning: initialData.safety_warning || specsObj.safety_warning || prev.safety_warning || '',
        brand: initialData.brand || specsObj.brand || prev.brand || '',
        features: initialData.features || specsObj.features || prev.features || '',
        usage: initialData.usage || specsObj.usage || prev.usage || '',
        benefit: initialData.benefit || specsObj.benefit || prev.benefit || '',
        opening_text: initialData.opening_text || seqObj.step1_opening_text || prev.opening_text || '',
        detail_text: initialData.detail_text || productObj.description || prev.detail_text || '',
        promotion_text: initialData.promotion_text || seqObj.step3_promotion_detail || prev.promotion_text || '',
        review_text: initialData.review_text || prev.review_text || '',
        closing_text: initialData.closing_text || seqObj.step6_closing_text || prev.closing_text || ''
      }));
      if (initialData.category_type) {
        setSelectedCategory(initialData.category_type);
      }
    } else {
      // Auto-generate product_id based on category
      const prefix = selectedCategory === 'CHINA' ? 'CHN' : selectedCategory === 'AMULET' ? 'AML' : selectedCategory === 'OTOP' ? 'OTP' : 'AGR';
      const randomNum = Math.floor(100 + Math.random() * 900);
      setFormData((prev: any) => ({
        ...prev,
        product_id: `${prefix}-${randomNum}`,
        page_id: pages[0]?.page_id || 'AMULET_PAGE_ID'
      }));
    }
  }, [initialData, selectedCategory, pages]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((prev: any) => ({ ...prev, [fieldName]: reader.result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!formData.product_name.trim()) {
      alert('กรุณาระบุชื่อสินค้า');
      return;
    }
    onSave(selectedCategory, formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-[#101014] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/80 dark:bg-[#141418]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                {initialData ? 'แก้ไขข้อมูลสินค้าในเทมเพลต' : 'เพิ่มสินค้าใหม่ (เทมเพลตมาตรฐาน Vercel DB)'}
                <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {selectedCategory}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                กรอกข้อมูลภาษาไทยครบทุกฟิลด์ พร้อมเลือกผูกเพจ Facebook เพื่อให้ AI นำไปใช้ปิดการขายทันที
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Selector Tabs */}
        {!initialData && (
          <div className="px-6 py-3 border-b border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-[#0F0F12] flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('CHINA')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedCategory === 'CHINA'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#141418] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>📦</span> PRODUCT_CHINA (สินค้าจีน / ทั่วไป)
            </button>
            <button
              onClick={() => setSelectedCategory('AMULET')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedCategory === 'AMULET'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#141418] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>📿</span> PRODUCT_AMULET (พระเครื่อง / มงคล)
            </button>
            <button
              onClick={() => setSelectedCategory('OTOP')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedCategory === 'OTOP'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#141418] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>🌾</span> PRODUCT_OTOP (สินค้าโอทอปไทย)
            </button>
            <button
              onClick={() => setSelectedCategory('AGRICULTURE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                selectedCategory === 'AGRICULTURE'
                  ? 'bg-lime-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-[#141418] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              <span>🌱</span> PRODUCT_AGRI (การเกษตร / ปุ๋ยยา)
            </button>
          </div>
        )}

        {/* Section Navigation */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-[#0A0A0C] border-b border-slate-200 dark:border-zinc-800/80 flex gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveSection('info')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSection === 'info'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" /> ข้อมูลสินค้า & เพจ
          </button>
          <button
            onClick={() => setActiveSection('pricing')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSection === 'pricing'
                ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> ราคา & โปรโมชั่น (3 ระดับ)
          </button>
          <button
            onClick={() => setActiveSection('images')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSection === 'images'
                ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> รูปภาพ 5 สเต็ป
          </button>
          <button
            onClick={() => setActiveSection('scripts')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSection === 'scripts'
                ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> สคริปต์ 6 สเต็ปปิดการขาย
          </button>
        </div>

        {/* Modal Body Form */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700 dark:text-zinc-300">
          {/* SECTION 1: INFO & BASIC SPECS */}
          {activeSection === 'info' && (
            <div className="space-y-4">
              {/* AI Auto-Key Panel */}
              <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/30 rounded-xl space-y-3 relative overflow-hidden shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5">
                        ✨ AI Auto-Key (วางข้อความยาวๆ ให้ AI อ่าน & กรอกสเปกสินค้าอัตโนมัติ)
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        เอาข้อความรายละเอียดสินค้าจากซัพพลายเออร์หรือรายละเอียดสเปกยาวๆ มาวางในช่องแล้วกดปุ่ม AI Auto Key ข้อมูลจะถูกถอดรหัสกรอกลงช่องทันที!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAiAutoBox(!showAiAutoBox)}
                    className="text-[11px] text-indigo-300 hover:text-white font-bold underline px-2 py-1 rounded bg-indigo-950/60 border border-indigo-800/60"
                  >
                    {showAiAutoBox ? 'ซ่อนช่อง AI Auto-Key' : 'แสดงช่อง AI Auto-Key'}
                  </button>
                </div>

                {showAiAutoBox && (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={3}
                      value={aiAutoText}
                      onChange={e => setAiAutoText(e.target.value)}
                      placeholder="วางข้อความสเปกสินค้า เช่น:&#10;ชื่อสินค้า: พัดลมไอเย็น TurboCool&#10;แบรนด์: Gadget Pro&#10;วัสดุ: พลาสติก ABS หนาทนทาน&#10;ขนาด: 25x30x60 ซม.&#10;น้ำหนัก: 3.5 กก.&#10;คุณสมบัติ: กรองฝุ่น PM2.5 ปรับความเย็น 3 ระดับ..."
                      className="w-full bg-[#0A0A0C]/80 border border-indigo-500/40 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-400 outline-none font-mono"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={handleRunAiAutoKey}
                        disabled={isAiParsing}
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isAiParsing ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            <span>กำลังถอดรหัสและวิเคราะห์สเปก...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>🤖 กดปุ่ม AI Auto-Key (กรอกข้อมูลสเปกอัตโนมัติ)</span>
                          </>
                        )}
                      </button>

                      {aiAutoSuccess && (
                        <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/80 animate-in fade-in">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>✨ ถอดรหัสข้อความและกรอกสเปกสำเร็จแล้ว!</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Identifiers & Page Link */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" /> รหัสสินค้า (product_id)
                  </label>
                  <input
                    type="text"
                    value={formData.product_id || ''}
                    onChange={e => setFormData({ ...formData, product_id: e.target.value })}
                    placeholder="เช่น CHN-101, AML-001, OTP-201"
                    className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-mono font-bold focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1 flex items-center gap-1.5">
                    <Facebook className="w-3.5 h-3.5 text-[#1877F2]" /> ผูกกับเพจ Facebook (page_id)
                  </label>
                  <select
                    value={formData.page_id || ''}
                    onChange={e => setFormData({ ...formData, page_id: e.target.value })}
                    className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-semibold focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {pages.map(p => (
                      <option key={p.page_id} value={p.page_id}>
                        {p.page_name} ({p.page_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* General Product Name & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1">
                    ชื่อสินค้า / วัตถุมงคล (product_name) *
                  </label>
                  <input
                    type="text"
                    value={formData.product_name || ''}
                    onChange={e => setFormData({ ...formData, product_name: e.target.value })}
                    placeholder="ระบุชื่อสินค้าที่ชัดเจน น่าดึงดูด"
                    className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1">
                    หมวดหมู่สินค้า (category)
                  </label>
                  <input
                    type="text"
                    value={formData.category || ''}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="เช่น เครื่องใช้ไฟฟ้า, พระเหรียญ, อาหารแปรรูป"
                    className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* CATEGORY SPECIFIC FIELDS: CHINA */}
              {selectedCategory === 'CHINA' && (
                <div className="p-4 bg-slate-50 dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-zinc-800/80 space-y-3">
                  <h4 className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    📦 ข้อมูลเฉพาะสำหรับ PRODUCT_CHINA (สินค้าจีน / ทั่วไป)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">แบรนด์ / ยี่ห้อ (brand)</label>
                      <input
                        type="text"
                        value={formData.brand || ''}
                        onChange={e => setFormData({ ...formData, brand: e.target.value })}
                        placeholder="เช่น TurboCool TH, Gadget Pro"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วัสดุที่ใช้ผลิต (material)</label>
                      <input
                        type="text"
                        value={formData.material || ''}
                        onChange={e => setFormData({ ...formData, material: e.target.value })}
                        placeholder="เช่น พลาสติก ABS, สแตนเลส 304"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ขนาด (size)</label>
                      <input
                        type="text"
                        value={formData.size || ''}
                        onChange={e => setFormData({ ...formData, size: e.target.value })}
                        placeholder="เช่น 15x20 ซม."
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">น้ำหนัก (weight)</label>
                      <input
                        type="text"
                        value={formData.weight || ''}
                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                        placeholder="เช่น 250 กรัม / 1.2 กก."
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วิธีใช้งาน (usage)</label>
                      <input
                        type="text"
                        value={formData.usage || ''}
                        onChange={e => setFormData({ ...formData, usage: e.target.value })}
                        placeholder="ขั้นตอนการเปิดใช้งานง่ายๆ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ข้อมูลการจัดส่ง (shipping_info)</label>
                      <input
                        type="text"
                        value={formData.shipping_info || ''}
                        onChange={e => setFormData({ ...formData, shipping_info: e.target.value })}
                        placeholder="เช่น จัดส่ง 1-2 วัน รับประกันสินค้า 1 ปี"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">คุณสมบัติ (features)</label>
                      <textarea
                        rows={2}
                        value={formData.features || ''}
                        onChange={e => setFormData({ ...formData, features: e.target.value })}
                        placeholder="คุณสมบัติเด่นที่ทำให้ลูกค้าอยากซื้อ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ประโยชน์ / จุดเด่น (benefit)</label>
                      <textarea
                        rows={2}
                        value={formData.benefit || ''}
                        onChange={e => setFormData({ ...formData, benefit: e.target.value })}
                        placeholder="ผลลัพธ์หรือความคุ้มค่าที่ลูกค้าได้รับ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">รายละเอียดสินค้า (description)</label>
                    <textarea
                      rows={2}
                      value={formData.description || ''}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="คำอธิบายรายละเอียดสินค้าอย่างครบถ้วน"
                      className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* CATEGORY SPECIFIC FIELDS: AMULET */}
              {selectedCategory === 'AMULET' && (
                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/40 space-y-3">
                  <h4 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    📿 ข้อมูลเฉพาะสำหรับ PRODUCT_AMULET (พระเครื่อง / วัตถุมงคล)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">วัด / สำนัก (temple)</label>
                      <input
                        type="text"
                        value={formData.temple || ''}
                        onChange={e => setFormData({ ...formData, temple: e.target.value })}
                        placeholder="เช่น วัดช้างให้ จ.ปัตตานี"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">พระเกจิ / ผู้สร้าง (master)</label>
                      <input
                        type="text"
                        value={formData.master || ''}
                        onChange={e => setFormData({ ...formData, master: e.target.value })}
                        placeholder="เช่น พระอาจารย์ทิม, หลวงปู่ทวด"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ปีที่สร้าง (year)</label>
                      <input
                        type="text"
                        value={formData.year || ''}
                        onChange={e => setFormData({ ...formData, year: e.target.value })}
                        placeholder="เช่น พ.ศ. 2508"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">รุ่น / พิมพ์ (edition)</label>
                      <input
                        type="text"
                        value={formData.edition || ''}
                        onChange={e => setFormData({ ...formData, edition: e.target.value })}
                        placeholder="เช่น รุ่นเลื่อนสมณศักดิ์ พิมพ์นิยม"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">เนื้อวัสดุ (material)</label>
                      <input
                        type="text"
                        value={formData.material || ''}
                        onChange={e => setFormData({ ...formData, material: e.target.value })}
                        placeholder="เช่น เนื้อทองแดงรมดำ, เนื้อผงเกสร"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">จำนวนการสร้าง (quantity)</label>
                      <input
                        type="number"
                        value={formData.quantity || 1}
                        onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">ข้อมูลความเชื่อ (belief_info)</label>
                      <textarea
                        rows={2}
                        value={formData.belief_info || ''}
                        onChange={e => setFormData({ ...formData, belief_info: e.target.value })}
                        placeholder="เช่น เมตตามหานิยม แคล้วคลาด ค้าขายร่ำรวย"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">คาถา / บทสวด (spell)</label>
                      <textarea
                        rows={2}
                        value={formData.spell || ''}
                        onChange={e => setFormData({ ...formData, spell: e.target.value })}
                        placeholder="เช่น นะโม โพธิสัตโต อาคันติมายะ อิติภะคะวา (3 จบ)"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">วิธีบูชา (worship_method)</label>
                      <input
                        type="text"
                        value={formData.worship_method || ''}
                        onChange={e => setFormData({ ...formData, worship_method: e.target.value })}
                        placeholder="เช่น พกติดตัว เลี่ยมกรอบบูชา"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วิธีดูแลรักษา (care_instruction)</label>
                      <input
                        type="text"
                        value={formData.care_instruction || ''}
                        onChange={e => setFormData({ ...formData, care_instruction: e.target.value })}
                        placeholder="เช่น เลี่ยมกรอบกันน้ำ หลีกเลี่ยงสารเคมี"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ข้อควรระวัง (warning)</label>
                      <input
                        type="text"
                        value={formData.warning || ''}
                        onChange={e => setFormData({ ...formData, warning: e.target.value })}
                        placeholder="เช่น ไม่สวมใส่เข้าที่อโคจร"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">ประวัติ (history)</label>
                    <textarea
                      rows={2}
                      value={formData.history || ''}
                      onChange={e => setFormData({ ...formData, history: e.target.value })}
                      placeholder="เช่น จัดสร้างเนื่องในโอกาสบูรณะอุโบสถ พิธีอธิษฐานจิตเข้มขลัง"
                      className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* CATEGORY SPECIFIC FIELDS: OTOP */}
              {selectedCategory === 'OTOP' && (
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                  <h4 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    🌾 ข้อมูลเฉพาะสำหรับ PRODUCT_OTOP (OTOP / สินค้าชุมชน)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">ชุมชน / กลุ่มผู้ผลิต (community)</label>
                      <input
                        type="text"
                        value={formData.community || ''}
                        onChange={e => setFormData({ ...formData, community: e.target.value })}
                        placeholder="เช่น วิสาหกิจชุมชนแปรรูปผลไม้"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">จังหวัด (province)</label>
                      <input
                        type="text"
                        value={formData.province || ''}
                        onChange={e => setFormData({ ...formData, province: e.target.value })}
                        placeholder="เช่น จ.เชียงใหม่, จ.สุรินทร์"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ผู้ผลิต / ผู้ประกอบการ (maker)</label>
                      <input
                        type="text"
                        value={formData.maker || ''}
                        onChange={e => setFormData({ ...formData, maker: e.target.value })}
                        placeholder="เช่น กลุ่มสตรีทอผ้าไหมลายโบราณ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">แหล่งที่มา (origin)</label>
                      <input
                        type="text"
                        value={formData.origin || ''}
                        onChange={e => setFormData({ ...formData, origin: e.target.value })}
                        placeholder="เช่น อำเภอแม่แตง จ.เชียงใหม่"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วัตถุดิบ / วัสดุ (material)</label>
                      <input
                        type="text"
                        value={formData.material || ''}
                        onChange={e => setFormData({ ...formData, material: e.target.value })}
                        placeholder="เช่น ไหมแท้ 100%, สมุนไพรธรรมชาติ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">เรื่องราวสินค้า (story)</label>
                      <textarea
                        rows={2}
                        value={formData.story || ''}
                        onChange={e => setFormData({ ...formData, story: e.target.value })}
                        placeholder="เรื่องราวภูมิปัญญาชาวบ้านที่สืบทอดกันมา"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วิธีการผลิต (production_method)</label>
                      <textarea
                        rows={2}
                        value={formData.production_method || ''}
                        onChange={e => setFormData({ ...formData, production_method: e.target.value })}
                        placeholder="เช่น กรรมวิธีทอมือโบราณ ย้อมสีธรรมชาติ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">ขนาด (size)</label>
                      <input
                        type="text"
                        value={formData.size || ''}
                        onChange={e => setFormData({ ...formData, size: e.target.value })}
                        placeholder="เช่น 100 x 200 ซม."
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">น้ำหนัก (weight)</label>
                      <input
                        type="text"
                        value={formData.weight || ''}
                        onChange={e => setFormData({ ...formData, weight: e.target.value })}
                        placeholder="เช่น 500 กรัม"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วิธีใช้งาน (usage)</label>
                      <input
                        type="text"
                        value={formData.usage || ''}
                        onChange={e => setFormData({ ...formData, usage: e.target.value })}
                        placeholder="เช่น ชงดื่มวันละ 1 แก้ว"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold mb-1">ประโยชน์ / จุดเด่น (benefit)</label>
                      <input
                        type="text"
                        value={formData.benefit || ''}
                        onChange={e => setFormData({ ...formData, benefit: e.target.value })}
                        placeholder="เช่น สินค้าออร์แกนิก 100%"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">วิธีดูแลรักษา (care_instruction)</label>
                      <input
                        type="text"
                        value={formData.care_instruction || ''}
                        onChange={e => setFormData({ ...formData, care_instruction: e.target.value })}
                        placeholder="เช่น ซักมือด้วยน้ำยาซักผ้าไหม"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ข้อควรระวัง (warning)</label>
                      <input
                        type="text"
                        value={formData.warning || ''}
                        onChange={e => setFormData({ ...formData, warning: e.target.value })}
                        placeholder="เช่น ควรเก็บในที่แห้งพ้นแสงแดด"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* CATEGORY SPECIFIC FIELDS: AGRICULTURE */}
              {selectedCategory === 'AGRICULTURE' && (
                <div className="p-4 bg-lime-50/50 dark:bg-lime-950/20 rounded-xl border border-lime-200 dark:border-lime-900/40 space-y-4">
                  <h4 className="font-bold text-lime-700 dark:text-lime-400 flex items-center gap-1.5">
                    🌱 ข้อมูลสเปกสินค้าเกษตร / พืชพันธุ์ ปุ๋ย ยา (PRODUCT_AGRICULTURE)
                  </h4>

                  {/* 1. สายพันธุ์และข้อมูลทั่วไป */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      1. ข้อมูลสายพันธุ์ & ทั่วไป
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">หมวดย่อย (subcategory)</label>
                        <input
                          type="text"
                          value={formData.subcategory || ''}
                          onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                          placeholder="เช่น เมล็ดพันธุ์ผัก / ปุ๋ยชีวภาพ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">สายพันธุ์ / พันธุ์ (variety)</label>
                        <input
                          type="text"
                          value={formData.variety || ''}
                          onChange={e => setFormData({ ...formData, variety: e.target.value })}
                          placeholder="เช่น พริกขี้หนูสวนจินดา F1"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ชนิดพืช (species)</label>
                        <input
                          type="text"
                          value={formData.species || ''}
                          onChange={e => setFormData({ ...formData, species: e.target.value })}
                          placeholder="เช่น พริก (Capsicum annuum)"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">แบรนด์ / ยี่ห้อ (brand)</label>
                        <input
                          type="text"
                          value={formData.brand || ''}
                          onChange={e => setFormData({ ...formData, brand: e.target.value })}
                          placeholder="เช่น GreenAgro Thailand"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">แหล่งที่มา (origin)</label>
                        <input
                          type="text"
                          value={formData.origin || ''}
                          onChange={e => setFormData({ ...formData, origin: e.target.value })}
                          placeholder="เช่น นำเข้าจากเนเธอร์แลนด์"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">จำนวนเมล็ด / ปริมาณสินค้า (seed_quantity)</label>
                        <input
                          type="text"
                          value={formData.seed_quantity || ''}
                          onChange={e => setFormData({ ...formData, seed_quantity: e.target.value })}
                          placeholder="เช่น 500 เมล็ด / ซอง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ขนาด (size)</label>
                        <input
                          type="text"
                          value={formData.size || ''}
                          onChange={e => setFormData({ ...formData, size: e.target.value })}
                          placeholder="เช่น ซอง 5x10 ซม. / ขวด 1 ลิตร"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">น้ำหนัก (weight)</label>
                        <input
                          type="text"
                          value={formData.weight || ''}
                          onChange={e => setFormData({ ...formData, weight: e.target.value })}
                          placeholder="เช่น 50 กรัม / 1.2 กก."
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. การเพาะเมล็ด */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      2. การเพาะเมล็ด
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">การเตรียมเมล็ดพันธุ์ (seed_preparation)</label>
                        <input
                          type="text"
                          value={formData.seed_preparation || ''}
                          onChange={e => setFormData({ ...formData, seed_preparation: e.target.value })}
                          placeholder="เช่น แช่น้ำอุ่น 50°C นาน 6 ชั่วโมง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีเพาะเมล็ด (germination_method)</label>
                        <input
                          type="text"
                          value={formData.germination_method || ''}
                          onChange={e => setFormData({ ...formData, germination_method: e.target.value })}
                          placeholder="เช่น บ่มกระดาษทิชชูชื้น 2-3 วัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ระยะเวลาในการงอก (germination_time)</label>
                        <input
                          type="text"
                          value={formData.germination_time || ''}
                          onChange={e => setFormData({ ...formData, germination_time: e.target.value })}
                          placeholder="เช่น 3 - 5 วัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">อัตราการงอกโดยประมาณ (germination_rate)</label>
                        <input
                          type="text"
                          value={formData.germination_rate || ''}
                          onChange={e => setFormData({ ...formData, germination_rate: e.target.value })}
                          placeholder="เช่น 85% - 90%"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วัสดุที่ใช้เพาะ (germination_medium)</label>
                        <input
                          type="text"
                          value={formData.germination_medium || ''}
                          onChange={e => setFormData({ ...formData, germination_medium: e.target.value })}
                          placeholder="เช่น พีทมอสผสมขุยมะพร้าวละเอียด"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ขั้นตอนการเพาะ (germination_steps)</label>
                        <input
                          type="text"
                          value={formData.germination_steps || ''}
                          onChange={e => setFormData({ ...formData, germination_steps: e.target.value })}
                          placeholder="เช่น 1.หยอดหลุมละ 1 เมล็ด 2.กลบดินบางๆ 3.พรมน้ำพอชื้น"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. การปลูก */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      3. การปลูก
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ฤดู / ช่วงที่เหมาะสำหรับปลูก (planting_season)</label>
                        <input
                          type="text"
                          value={formData.planting_season || ''}
                          onChange={e => setFormData({ ...formData, planting_season: e.target.value })}
                          placeholder="เช่น ตลอดปี / ต้นฤดูฝน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีการปลูก (planting_method)</label>
                        <input
                          type="text"
                          value={formData.planting_method || ''}
                          onChange={e => setFormData({ ...formData, planting_method: e.target.value })}
                          placeholder="เช่น เพาะถาดก่อนย้ายปลูกลงแปลง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ประเภทดินที่เหมาะสม (soil_type)</label>
                        <input
                          type="text"
                          value={formData.soil_type || ''}
                          onChange={e => setFormData({ ...formData, soil_type: e.target.value })}
                          placeholder="เช่น ดินร่วนปนทราย ระบายน้ำดี"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วัสดุปลูกที่เหมาะสม (growing_medium)</label>
                        <input
                          type="text"
                          value={formData.growing_medium || ''}
                          onChange={e => setFormData({ ...formData, growing_medium: e.target.value })}
                          placeholder="เช่น ดินร่วนผสมปุ๋ยคอกและแกลบผุ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ระยะห่างในการปลูก (spacing)</label>
                        <input
                          type="text"
                          value={formData.spacing || ''}
                          onChange={e => setFormData({ ...formData, spacing: e.target.value })}
                          placeholder="เช่น 50 x 50 ซม."
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ขนาดกระถางที่แนะนำ (pot_size)</label>
                        <input
                          type="text"
                          value={formData.pot_size || ''}
                          onChange={e => setFormData({ ...formData, pot_size: e.target.value })}
                          placeholder="เช่น กระถางขนาด 12 นิ้วขึ้นไป"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-semibold mb-1">ขั้นตอนการปลูก (planting_steps)</label>
                      <textarea
                        rows={2}
                        value={formData.planting_steps || ''}
                        onChange={e => setFormData({ ...formData, planting_steps: e.target.value })}
                        placeholder="1. ขุดหลุมกว้าง 30 ซม. 2. ใส่ปุ๋ยรองก้นหลุม 3. ย้ายกล้าลงปลูกตอนเย็น 4. รดน้ำให้ชุ่ม"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* 4. น้ำ แสง และสภาพแวดล้อม */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      4. น้ำ แสง และสภาพแวดล้อม
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ความต้องการแสง (sunlight)</label>
                        <input
                          type="text"
                          value={formData.sunlight || ''}
                          onChange={e => setFormData({ ...formData, sunlight: e.target.value })}
                          placeholder="เช่น แดดจัดเต็มวัน 6-8 ชม."
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">จำนวนชั่วโมงแสงที่เหมาะสม (sunlight_hours)</label>
                        <input
                          type="text"
                          value={formData.sunlight_hours || ''}
                          onChange={e => setFormData({ ...formData, sunlight_hours: e.target.value })}
                          placeholder="เช่น 6 - 10 ชั่วโมงต่อวัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">อุณหภูมิที่เหมาะสม (temperature)</label>
                        <input
                          type="text"
                          value={formData.temperature || ''}
                          onChange={e => setFormData({ ...formData, temperature: e.target.value })}
                          placeholder="เช่น 25 - 35 องศาเซลเซียส"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">วิธีการรดน้ำ (watering)</label>
                        <input
                          type="text"
                          value={formData.watering || ''}
                          onChange={e => setFormData({ ...formData, watering: e.target.value })}
                          placeholder="เช่น รดโคนต้น หลีกเลี่ยงใบเปียกชื้นชุ่มเกิน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ความถี่ในการรดน้ำ (watering_frequency)</label>
                        <input
                          type="text"
                          value={formData.watering_frequency || ''}
                          onChange={e => setFormData({ ...formData, watering_frequency: e.target.value })}
                          placeholder="เช่น วันละ 1-2 ครั้ง เช้า-เย็น"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ปริมาณน้ำโดยประมาณ (watering_amount)</label>
                        <input
                          type="text"
                          value={formData.watering_amount || ''}
                          onChange={e => setFormData({ ...formData, watering_amount: e.target.value })}
                          placeholder="เช่น 500 มล. ต่อต้นต่อครั้ง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ความชื้นที่เหมาะสม (humidity)</label>
                        <input
                          type="text"
                          value={formData.humidity || ''}
                          onChange={e => setFormData({ ...formData, humidity: e.target.value })}
                          placeholder="เช่น 60% - 70% RH"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. ปุ๋ยและธาตุอาหาร */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      5. ปุ๋ยและธาตุอาหาร
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ปุ๋ยที่แนะนำ (fertilizer)</label>
                        <input
                          type="text"
                          value={formData.fertilizer || ''}
                          onChange={e => setFormData({ ...formData, fertilizer: e.target.value })}
                          placeholder="เช่น ปุ๋ยคอกอินทรีย์ + ปุ๋ยเคมีสูตรเสมอ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">สูตรปุ๋ย (fertilizer_formula)</label>
                        <input
                          type="text"
                          value={formData.fertilizer_formula || ''}
                          onChange={e => setFormData({ ...formData, fertilizer_formula: e.target.value })}
                          placeholder="เช่น สูตร 15-15-15 หรือ 16-16-16"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ตารางการให้ปุ๋ย (fertilizer_schedule)</label>
                        <input
                          type="text"
                          value={formData.fertilizer_schedule || ''}
                          onChange={e => setFormData({ ...formData, fertilizer_schedule: e.target.value })}
                          placeholder="เช่น ทุกๆ 15-20 วัน หลังย้ายกล้า"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ปริมาณปุ๋ยที่แนะนำต่อครั้ง (fertilizer_amount)</label>
                        <input
                          type="text"
                          value={formData.fertilizer_amount || ''}
                          onChange={e => setFormData({ ...formData, fertilizer_amount: e.target.value })}
                          placeholder="เช่น 10 - 15 กรัม ต่อต้นต่อครั้ง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีการให้ปุ๋ย (fertilizer_method)</label>
                        <input
                          type="text"
                          value={formData.fertilizer_method || ''}
                          onChange={e => setFormData({ ...formData, fertilizer_method: e.target.value })}
                          placeholder="เช่น โรยรอบโคนต้น ห่างโคน 10 ซม. แล้วพรวนดินกลบ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ธาตุอาหารที่พืชต้องการเป็นพิเศษ (nutrient_requirement)</label>
                        <input
                          type="text"
                          value={formData.nutrient_requirement || ''}
                          onChange={e => setFormData({ ...formData, nutrient_requirement: e.target.value })}
                          placeholder="เช่น ไนโตรเจน (N) เร่งใบ และแคลเซียมโบรอนเร่งขั้วผล"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">อาการขาดธาตุอาหารที่พบบ่อย (nutrient_deficiency)</label>
                        <input
                          type="text"
                          value={formData.nutrient_deficiency || ''}
                          onChange={e => setFormData({ ...formData, nutrient_deficiency: e.target.value })}
                          placeholder="เช่น ขาดไนโตรเจนใบด้านล่างจะเหลือง, ขาดแคลเซียมปลายใบแห้ง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 6. การดูแลและการเก็บเกี่ยว */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      6. การดูแลและการเก็บเกี่ยว
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">วิธีดูแลรักษา (plant_care)</label>
                        <input
                          type="text"
                          value={formData.plant_care || ''}
                          onChange={e => setFormData({ ...formData, plant_care: e.target.value })}
                          placeholder="เช่น หมั่นพรวนดิน กำจัดวัชพืชสม่ำเสมอ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีตัดแต่งกิ่ง (pruning)</label>
                        <input
                          type="text"
                          value={formData.pruning || ''}
                          onChange={e => setFormData({ ...formData, pruning: e.target.value })}
                          placeholder="เช่น เด็ดยอดเพื่อกระตุ้นกิ่งแขนง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">คำแนะนำการย้ายปลูก (transplanting)</label>
                        <input
                          type="text"
                          value={formData.transplanting || ''}
                          onChange={e => setFormData({ ...formData, transplanting: e.target.value })}
                          placeholder="ย้ายกล้าช่วงเย็น หลีกเลี่ยงแสงแดดจัด"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีการขยายพันธุ์ (propagation)</label>
                        <input
                          type="text"
                          value={formData.propagation || ''}
                          onChange={e => setFormData({ ...formData, propagation: e.target.value })}
                          placeholder="เช่น การเพาะเมล็ด และการปักชำกิ่ง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ระยะเวลาเจริญเติบโต (growing_time)</label>
                        <input
                          type="text"
                          value={formData.growing_time || ''}
                          onChange={e => setFormData({ ...formData, growing_time: e.target.value })}
                          placeholder="เช่น 60 - 75 วัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ระยะเวลาเก็บเกี่ยว (harvest_time)</label>
                        <input
                          type="text"
                          value={formData.harvest_time || ''}
                          onChange={e => setFormData({ ...formData, harvest_time: e.target.value })}
                          placeholder="เช่น 80-90 วัน หลังหยอดเมล็ด"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีการเก็บเกี่ยว (harvest_method)</label>
                        <input
                          type="text"
                          value={formData.harvest_method || ''}
                          onChange={e => setFormData({ ...formData, harvest_method: e.target.value })}
                          placeholder="เช่น ใช้กรรไกรคมตัดขั้วผลอย่างระวัง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">ผลผลิตคาดการณ์โดยประมาณ (yield)</label>
                        <input
                          type="text"
                          value={formData.yield || ''}
                          onChange={e => setFormData({ ...formData, yield: e.target.value })}
                          placeholder="เช่น 1.5 - 2 กก. ต่อต้น"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 7. โรคและแมลง */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      7. โรคและแมลง
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">แมลงศัตรูพืชที่ระบาดบ่อย (pests)</label>
                        <input
                          type="text"
                          value={formData.pests || ''}
                          onChange={e => setFormData({ ...formData, pests: e.target.value })}
                          placeholder="เช่น เพลี้ยไฟ, ไรแดง, หนอนเจาะสมอฝ้าย"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">การป้องกันแมลง (pest_prevention)</label>
                        <input
                          type="text"
                          value={formData.pest_prevention || ''}
                          onChange={e => setFormData({ ...formData, pest_prevention: e.target.value })}
                          placeholder="เช่น ปลูกดาวเรืองล้อมแปลง หรือกางมุ้งตาข่ายถี่"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีจัดการเมื่อแมลงระบาด (pest_control)</label>
                        <input
                          type="text"
                          value={formData.pest_control || ''}
                          onChange={e => setFormData({ ...formData, pest_control: e.target.value })}
                          placeholder="ฉีดพ่นชีวภัณฑ์บิวเวอเรีย หรือน้ำส้มควันไม้เข้มข้น"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">โรคพืชที่ระบาดบ่อย (diseases)</label>
                        <input
                          type="text"
                          value={formData.diseases || ''}
                          onChange={e => setFormData({ ...formData, diseases: e.target.value })}
                          placeholder="เช่น โรครากเน่าโคนเน่า, โรคใบจุดแบคทีเรีย, ราน้ำค้าง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">การป้องกันโรคพืช (disease_prevention)</label>
                        <input
                          type="text"
                          value={formData.disease_prevention || ''}
                          onChange={e => setFormData({ ...formData, disease_prevention: e.target.value })}
                          placeholder="คลุกไตรโคเดอร์มาในดินก่อนปลูก หลีกเลี่ยงน้ำขัง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีจัดการเมื่อพืชเป็นโรค (disease_control)</label>
                        <input
                          type="text"
                          value={formData.disease_control || ''}
                          onChange={e => setFormData({ ...formData, disease_control: e.target.value })}
                          placeholder="ตัดแต่งส่วนที่เป็นโรคเผาทำลาย ฉีดไตรโคเดอร์มาซ้ำทุก 7 วัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ปัญหาที่พบกวนใจบ่อย (common_problems)</label>
                        <input
                          type="text"
                          value={formData.common_problems || ''}
                          onChange={e => setFormData({ ...formData, common_problems: e.target.value })}
                          placeholder="เช่น ยอดเหี่ยวเหลือง ปลายใบแห้ง ขอบใบม้วนชี้ฟ้า"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีแก้ปัญหาและรักษาเบื้องต้น (troubleshooting)</label>
                        <input
                          type="text"
                          value={formData.troubleshooting || ''}
                          onChange={e => setFormData({ ...formData, troubleshooting: e.target.value })}
                          placeholder="เช่น ขาดแคลเซียมโบรอน พ่นเสริมช่วงติดดอกทุก 5 วัน"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 8. ข้อมูลเพิ่มเติม */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-lime-800 dark:text-lime-300 border-b border-lime-200 dark:border-lime-800 pb-1">
                      8. ข้อมูลเพิ่มเติม & ประโยชน์สินค้า
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">พืชเพื่อนบ้านที่ปลูกร่วมกันได้ (companion_plants)</label>
                        <input
                          type="text"
                          value={formData.companion_plants || ''}
                          onChange={e => setFormData({ ...formData, companion_plants: e.target.value })}
                          placeholder="เช่น ปลูกคู่กับโหระพา ช่วยขับแมลงและเพิ่มรสชาติ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">พืชที่ไม่ควรปลูกใกล้กัน (combative_plants)</label>
                        <input
                          type="text"
                          value={formData.combative_plants || ''}
                          onChange={e => setFormData({ ...formData, combative_plants: e.target.value })}
                          placeholder="เช่น หลีกเลี่ยงการปลูกใกล้พืชตระกูลมะเขือชนิดอื่น"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีเก็บรักษาเมล็ด/ผลผลิต (storage)</label>
                        <input
                          type="text"
                          value={formData.storage || ''}
                          onChange={e => setFormData({ ...formData, storage: e.target.value })}
                          placeholder="เก็บซองในตู้เย็นพ้นความชื้น ผลผลิตเก็บที่เย็นพ้นแสงแดด"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ข้อควรระวังสำคัญ (warning)</label>
                        <input
                          type="text"
                          value={formData.warning || ''}
                          onChange={e => setFormData({ ...formData, warning: e.target.value })}
                          placeholder="ระวังน้ำยางระคายเคืองผิวหนัง หรือสารเคมีตกค้าง"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">วิธีใช้ / การนำไปใช้งาน (usage)</label>
                        <input
                          type="text"
                          value={formData.usage || ''}
                          onChange={e => setFormData({ ...formData, usage: e.target.value })}
                          placeholder="วิธีนำไปทำอาหาร หรือแปรรูปเพิ่มมูลค่า"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold mb-1">ประโยชน์เด่น / จุดขายสินค้า (benefit)</label>
                        <textarea
                          rows={2}
                          value={formData.benefit || ''}
                          onChange={e => setFormData({ ...formData, benefit: e.target.value })}
                          placeholder="จุดเด่นสินค้า พืชออร์แกนิกโตไว ต้านทานโรคสูง ทรงผลสวย รสชาติหวานกรอบ"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">รายละเอียดสินค้าเพิ่มเติม (description)</label>
                        <textarea
                          rows={2}
                          value={formData.description || ''}
                          onChange={e => setFormData({ ...formData, description: e.target.value })}
                          placeholder="รายละเอียดประวัติ สายพันธุ์ คำโปรย หรือข้อมูลสินค้าทางเทคนิคเสริม"
                          className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-lime-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: PRICING & 3-TIER PROMOTIONS */}
          {activeSection === 'pricing' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40 space-y-3">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> กำหนดระดับราคา 3 ระดับ (3-Tier Pricing) & เก็บเงินปลายทาง (COD)
                </h4>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px]">
                  AI จะใช้แพ็กเกจราคาเหล่านี้ในการเสนอโปรโมชั่นและปิดยอดขายให้ลูกค้าอัตโนมัติ
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1">
                      ราคาแสดงปกติ (display_price)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.display_price || 0}
                        onChange={e => setFormData({ ...formData, display_price: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-rose-700 dark:text-rose-400 mb-1">
                      ต้นทุนสินค้า (cost_price)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-rose-400 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.cost_price || 0}
                        onChange={e => setFormData({ ...formData, cost_price: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-rose-200 dark:border-rose-900 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-rose-700 dark:text-rose-300 focus:border-rose-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-sky-700 dark:text-sky-400 mb-1">
                      ค่าส่งสินค้า (shipping_cost)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-sky-400 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.shipping_cost || 0}
                        onChange={e => setFormData({ ...formData, shipping_cost: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-sky-200 dark:border-sky-900 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-sky-700 dark:text-sky-300 focus:border-sky-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                      โปรโมชั่น 1 ชิ้น (price_1)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-emerald-500 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.price_1 || 0}
                        onChange={e => setFormData({ ...formData, price_1: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-emerald-300 dark:border-emerald-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-indigo-700 dark:text-indigo-400 mb-1">
                      โปรโมชั่น 2 ชิ้น (price_2)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-indigo-500 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.price_2 || 0}
                        onChange={e => setFormData({ ...formData, price_2: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-indigo-300 dark:border-indigo-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-purple-700 dark:text-purple-400 mb-1">
                      โปรโมชั่น 3 ชิ้น (price_3)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-purple-500 font-bold">฿</span>
                      <input
                        type="number"
                        value={formData.price_3 || 0}
                        onChange={e => setFormData({ ...formData, price_3: Number(e.target.value) })}
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-purple-300 dark:border-purple-800 rounded-lg pl-7 pr-3 py-2 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1">
                      รายละเอียดของแถม & โปรโมชั่นพิเศษ (promotion_detail)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.promotion_detail || ''}
                      onChange={e => setFormData({ ...formData, promotion_detail: e.target.value })}
                      placeholder="เช่น ซื้อ 2 ชิ้นแถมฟรีของสมนาคุณ ส่งฟรีเก็บเงินปลายทาง"
                      className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 dark:text-zinc-200 mb-1">
                      ระยะเวลาจัดส่งที่ระบุในบิล (shipping_duration)
                    </label>
                    <input
                      type="text"
                      value={formData.shipping_duration || ''}
                      onChange={e => setFormData({ ...formData, shipping_duration: e.target.value })}
                      placeholder="เช่น จัดส่งด่วน 1-2 วันทำการถึงหน้าบ้าน"
                      className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: 5-STEP IMAGES */}
          {activeSection === 'images' && (
            <div className="space-y-4">
              <p className="text-slate-500 dark:text-zinc-400 text-xs">
                รูปภาพที่ AI จะส่งให้ลูกค้าตามลำดับการสนทนา (รองรับทั้งใส่ URL และกดอัพโหลดรูปจากเครื่อง)
              </p>

              {[
                { key: 'image_main', label: '1. รูปภาพหลักสินค้า (image_main)', color: 'border-indigo-500' },
                { key: 'image_detail', label: '2. รูปภาพรายละเอียด / มวลสาร / สรรพคุณ (image_detail)', color: 'border-blue-500' },
                { key: 'image_promotion', label: '3. รูปภาพโปรโมชั่น / ของแถม (image_promotion)', color: 'border-amber-500' },
                { key: 'image_review', label: '4. รูปภาพรีวิวจากลูกค้าจริง (image_review)', color: 'border-emerald-500' },
                { key: 'image_closing', label: '5. รูปภาพปิดการขาย / ส่งด่วน (image_closing)', color: 'border-rose-500' }
              ].map(img => (
                <div
                  key={img.key}
                  className="p-3 bg-slate-50 dark:bg-[#141418] rounded-xl border border-slate-200 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {formData[img.key] ? (
                      <img
                        src={formData[img.key]}
                        alt={img.label}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-300 dark:border-zinc-700 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1">
                      <span className="font-bold text-slate-800 dark:text-zinc-200 block mb-1">
                        {img.label}
                      </span>
                      <input
                        type="text"
                        value={formData[img.key] || ''}
                        onChange={e => setFormData({ ...formData, [img.key]: e.target.value })}
                        placeholder="https://... URL รูปภาพ"
                        className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs font-mono focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <label className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap self-end sm:self-center">
                    <Upload className="w-3.5 h-3.5" /> อัพโหลดรูป
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => handleFileUpload(e, img.key)}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* SECTION 4: 6-STEP SALES SCRIPTS */}
          {activeSection === 'scripts' && (
            <div className="space-y-3">
              <p className="text-slate-500 dark:text-zinc-400 text-xs">
                ข้อความสคริปต์ที่ AI จะใช้ส่งในแต่ละขั้นตอนการตอบแชทปิดการขาย
              </p>

              <div>
                <label className="block font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                  1. สคริปต์เปิดการขาย / ทักทาย (opening_text)
                </label>
                <textarea
                  rows={2}
                  value={formData.opening_text || ''}
                  onChange={e => setFormData({ ...formData, opening_text: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-blue-600 dark:text-blue-400 mb-1">
                  2. สคริปต์อธิบายสรรพคุณ / พุทธคุณ / Story (detail_text)
                </label>
                <textarea
                  rows={2}
                  value={formData.detail_text || ''}
                  onChange={e => setFormData({ ...formData, detail_text: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                  3. สคริปต์เสนอโปรโมชั่น & ของแถม (promotion_text)
                </label>
                <textarea
                  rows={2}
                  value={formData.promotion_text || ''}
                  onChange={e => setFormData({ ...formData, promotion_text: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-amber-600 dark:text-amber-400 mb-1">
                  4. สคริปต์รีวิวความประทับใจ (review_text)
                </label>
                <textarea
                  rows={2}
                  value={formData.review_text || ''}
                  onChange={e => setFormData({ ...formData, review_text: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-rose-600 dark:text-rose-400 mb-1">
                  5. สคริปต์ปิดการขาย / ขอที่อยู่ COD (closing_text)
                </label>
                <textarea
                  rows={2}
                  value={formData.closing_text || ''}
                  onChange={e => setFormData({ ...formData, closing_text: e.target.value })}
                  className="w-full bg-white dark:bg-[#0A0A0C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-rose-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-[#141418]/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500" />
            <span>บันทึกลง Vercel Database และซิงค์เข้าเพจ Facebook อัตโนมัติ</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-bold transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/25"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกสินค้าลง Vercel DB</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
