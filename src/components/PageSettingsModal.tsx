import React, { useState } from 'react';
import { AccountingTab } from './AccountingTab';
import {
  X,
  Save,
  Bot,
  Sparkles,
  ExternalLink,
  ShoppingBag,
  Layers,
  Image as ImageIcon,
  MessageSquare,
  ShieldCheck,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Settings,
  Facebook,
  Zap,
  Info,
  Sliders,
  Send,
  AlertCircle,
  Upload,
  FileImage,
  Eye,
  Bell,
  DollarSign,
  AtSign,
  FileText,
  Copy,
  Radio,
  Truck,
  Check,
  Search,
  Filter
} from 'lucide-react';
import { PageConfig, PromotionTier, ProductCategory, ProductDetailedSpecs, CustomSpecItem } from '../types';
import { parseTextToSpecs } from '../utils/aiSpecParser';
import { buildCodSummaryText } from '../utils/codSummary';
import {
  buildShippingDuration,
  normalizeShippingFields,
  COURIER_OPTIONS,
  DELIVERY_DAYS_OPTIONS,
  DEFAULT_COURIER_BRAND,
  DEFAULT_DELIVERY_DAYS
} from '../utils/shippingMatrix';
import { chatWithLocalAi, isLocalAiModel } from '../utils/localAi';
import { getStoredLocalAiModel } from './AiApiSettingsModal';
import { CustomButtonsManager } from './CustomButtonsManager';

interface PageSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: PageConfig;
  onSavePage: (originalId: string, updatedPage: PageConfig) => void;
}

export const PageSettingsModal: React.FC<PageSettingsModalProps> = ({
  isOpen,
  onClose,
  page,
  onSavePage
}) => {
  const originalPageIdRef = React.useRef(page?.page_id);

  const [activeSubTab, setActiveSubTab] = useState<
    'ai_persona' | 'sales_sequence' | 'comments' | 'followup' | 'detailed_specs' | 'product_promos' | 'cod_summary' | 'notifications' | 'facebook' | 'bot_settings' | 'chat_buttons'
  >('ai_persona');

  // Detect current theme from <html> class (App.tsx syncs it with the theme state)
  const currentTheme: 'dark' | 'light' =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  // AI Auto-Key State
  const [aiAutoText, setAiAutoText] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiAutoSuccess, setAiAutoSuccess] = useState(false);
  const [showAiAutoBox, setShowAiAutoBox] = useState(true);
  const [aiAutoError, setAiAutoError] = useState('');
  const [aiAutoSource, setAiAutoSource] = useState('');

  /**
   * AI Auto-Key (ใช้ AI จริง):
   * 1) ถ้าเลือก Local AI ไว้ (Ollama/LM Studio) → ส่งให้โมเดลในเครื่องแยกข้อมูล
   * 2) ถ้าไม่ได้เลือก หรือ Local AI ล้มเหลว → ใช้เซิร์ฟเวอร์ Gemini (/api/ai/parse-specs)
   * 3) ถ้าทั้งสองทางล้มเหลว → ถอยกลับไปที่ parser แบบกฎในเครื่อง (ดีกว่าไม่ได้อะไร)
   */
  const applyParsedSpecs = (parsed: Record<string, any>) => {
    setFormData((prev: PageConfig) => ({
      ...prev,
      product: {
        ...prev.product,
        product_name: parsed.product_name || prev.product.product_name,
        description: parsed.description || prev.product.description,
        specs: {
          ...prev.product.specs,
          ...parsed,
          custom_specs: [
            ...(prev.product.specs?.custom_specs || []),
            ...(Array.isArray(parsed.custom_specs) ? parsed.custom_specs : [])
          ]
        }
      }
    }));
  };

  const parseWithLocalAi = async (text: string, cat: ProductCategory): Promise<Record<string, any> | null> => {
    const localModel = getStoredLocalAiModel();
    if (!isLocalAiModel(localModel)) return null;
    const systemPrompt =
      'คุณคือผู้เชี่ยวชาญการกรอกข้อมูลสินค้า อ่านข้อความรายละเอียดสินค้าแล้วตอบเป็น JSON เท่านั้น โดยแยกข้อมูลลงฟิลด์: product_name, description, features, benefit, usage, material, size, weight, brand, shipping_info, temple, master, year, edition, quantity, history, belief_info, spell, worship_method, care_instruction, warning, community, province, maker, origin, story, production_method, subcategory, variety, species, seed_quantity, planting_season, planting_method, soil_type, sunlight, watering, fertilizer, harvest_time, usage_instructions, benefits และ custom_specs เป็น array ของ {key, value} สำหรับข้อมูลที่ไม่มีฟิลด์ตรง ห้ามเดาข้อมูลที่ไม่อยู่ในข้อความ ตอบเป็น JSON ล้วน ๆ ไม่มีคำอธิบายอื่น';
    try {
      const reply = await chatWithLocalAi(localModel, systemPrompt, text.slice(0, 8000));
      const match = reply.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]);
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v !== null && v !== undefined && String(v).trim() !== '') clean[k] = v;
      }
      return Object.keys(clean).length > 0 ? clean : null;
    } catch {
      return null;
    }
  };

  const parseWithServerAi = async (text: string, cat: ProductCategory): Promise<Record<string, any> | null> => {
    try {
      const res = await fetch('/api/ai/parse-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: text, category: cat })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.success && data.specs ? data.specs : null;
    } catch {
      return null;
    }
  };

  const handleRunAiAutoKeyForPageSettings = async (cat: ProductCategory) => {
    if (!aiAutoText.trim()) {
      alert('กรุณาวางข้อความรายละเอียดสินค้าหรือข้อมูลสเปกในช่องก่อนกด AI Auto-Key ค่ะ');
      return;
    }
    setIsAiParsing(true);
    setAiAutoError('');

    // 1) ลอง Local AI ก่อน (ถ้าผู้ใช้เลือกไว้)
    let parsed = await parseWithLocalAi(aiAutoText, cat);
    let parseSource = 'Local AI ในเครื่อง';

    // 2) ถ้าไม่ได้ → ใช้ Gemini บนเซิร์ฟเวอร์
    if (!parsed || Object.keys(parsed).length === 0) {
      parsed = await parseWithServerAi(aiAutoText, cat);
      parseSource = 'Gemini AI (เซิร์ฟเวอร์)';
    }

    // 3) ถอยกลับไปใช้ parser แบบกฎในเครื่อง
    if (!parsed || Object.keys(parsed).length === 0) {
      parsed = parseTextToSpecs(aiAutoText, cat) as Record<string, any>;
      parseSource = 'โหมดพื้นฐาน (ไม่พบ AI)';
      setAiAutoError('⚠️ ใช้ AI จริงไม่ได้ (ต้องเปิด Local AI หรือตั้ง Gemini API Key) จึงใช้โหมดแยกข้อความพื้นฐานแทน');
    }

    if (parsed && Object.keys(parsed).length > 0) {
      applyParsedSpecs(parsed);
      setAiAutoSource(parseSource);
      setAiAutoSuccess(true);
      setTimeout(() => setAiAutoSuccess(false), 6000);
    } else {
      setAiAutoError('❌ ไม่สามารถแยกข้อมูลจากข้อความนี้ได้ กรุณาลองใหม่ด้วยข้อความที่มีรายละเอียดมากขึ้น');
    }
    setIsAiParsing(false);
  };

  // Shipping Matrix: ทำให้ค่าขนส่งของหน้าเพจตรงกับฐานข้อมูลสินค้าเสมอ
  // (อ่านจาก product.shipping_duration / product.specs และค่าที่ซิงก์มาจากเทมเพลตสินค้า)
  const initialShipping = normalizeShippingFields(
    {
      courier_brand: page?.product?.specs?.courier_brand,
      delivery_days: page?.product?.specs?.delivery_days,
      shipping_duration: page?.product?.shipping_duration || page?.product?.specs?.shipping_duration
    },
    {
      courier_brand: (page?.product as any)?.courier_brand,
      delivery_days: (page?.product as any)?.delivery_days,
      shipping_duration: (page?.product as any)?.shipping_duration
    }
  );

  const [formData, setFormData] = useState<PageConfig>(() => ({
    ...(page || ({} as PageConfig)),
    sales_sequence_steps: page?.sales_sequence_steps?.length
      ? page.sales_sequence_steps
      : [
          { id: 'step-1', step_number: 1, type: 'BOTH', title: 'Step 1: ภาพหน้าปก & ทักทายเปิดเรื่องราว', text_content: page?.product?.opening_text || page?.product?.description || 'สวัสดีค่ะ ยินดีต้อนรับสู่เพจของเรานะคะ 🙏✨ สอบถามรายละเอียดหรือโปรโมชั่นพิเศษทักแชทได้เลยค่ะ', image_url: page?.product?.image_main || page?.product?.images?.main || '' },
          { id: 'step-2', step_number: 2, type: 'BOTH', title: 'Step 2: ภาพจุดเด่น / รายละเอียดสินค้า', text_content: page?.product?.detail_text || 'สินค้าคุณภาพเกรดพรีเมียม รับประกันของแท้ 100% มีใบรับรองมาตรฐานค่ะ', image_url: page?.product?.image_detail || page?.product?.images?.detail || '' },
          { id: 'step-3', step_number: 3, type: 'BOTH', title: 'Step 3: ภาพโปรโมชั่น / ของแถมพิเศษ', text_content: page?.product?.promotion_text || 'โปรโมชั่นเปิดตัวพิเศษ ซื้อวันนี้ส่งฟรีเก็บเงินปลายทาง COD ไม่บวกเพิ่มค่ะ', image_url: page?.product?.image_promotion || page?.product?.images?.promotion || '' },
          { id: 'step-4', step_number: 4, type: 'BOTH', title: 'Step 4: ภาพรีวิวจากลูกค้าจริง', text_content: page?.product?.review_text || 'การันตีรีวิวจากผู้ใช้งานจริงทั่วประเทศ ส่งจริง ได้รับของชัวร์ 100% ค่ะ', image_url: page?.product?.image_review || page?.product?.images?.review || '' },
          { id: 'step-5', step_number: 5, type: 'BOTH', title: 'Step 5: ภาพสรุปโปรโมชั่นเร่งปิดการขาย', text_content: page?.product?.closing_text || 'สนใจรับสิทธิ์โปรโมชั่น พิมพ์แจ้งชื่อ ที่อยู่ เบอร์โทรศัพท์ ไว้ในแชทได้เลยนะคะ', image_url: page?.product?.image_closing || page?.product?.images?.closing || '' },
          { id: 'step-6', step_number: 6, type: 'BOTH', title: 'Step 6: ภาพขอบพระคุณ & บริการหลังการขาย', text_content: page?.product?.step6_text || 'ขอบพระคุณลูกค้ามากๆ ค่ะ ทางร้านจะจัดส่งสินค้าและแจ้งเลขพัสดุให้นะคะ', image_url: page?.product?.image_step6 || '' }
        ],
    notification_channel: page?.notification_channel || 'BOTH',
    telegram_bot_token: page?.telegram_bot_token || '',
    telegram_chat_id: page?.telegram_chat_id || '',
    comment_reply_template:
      page?.comment_reply_template ||
      'ขอบพระคุณที่สนใจสินค้าค่ะคุณ @customer_name แอดมินทัก Inbox ส่งรายละเอียดโปรโมชั่นพิเศษและของแถมให้เรียบร้อยแล้วนะคะ 🙏✨',
    comment_auto_tag_customer: page?.comment_auto_tag_customer !== false,
    comment_reply_images: page?.comment_reply_images || [
      'https://images.unsplash.com/photo-1609743522653-52354461eb27?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600&q=80'
    ],
    followup_enabled: page?.followup_enabled === true,
    followup_messages: page?.followup_messages?.length
      ? page.followup_messages
      : [
          { interval: '15 นาที', message: 'สวัสดีค่ะคุณลูกค้า สนใจรับโปรโมชั่นชุดไหนดีคะ แจ้งแอดมินได้เลยนะคะ 🙏' },
          { interval: '2 ชั่วโมง', message: 'โปรโมชั่นส่งฟรีเก็บเงินปลายทางวันนี้เหลือโควตาอีก 3 สิทธิ์สุดท้ายนะคะ 😊' },
          { interval: '24 ชั่วโมง', message: 'สิทธิ์ส่วนลดพิเศษของคุณลูกค้ากำลังจะหมดอายุในอีก 2 ชั่วโมงค่ะ สั่งซื้อตอนนี้รับของแถมทันทีค่ะ' }
        ],
    cod_summary_fields: page?.cod_summary_fields || {
      include_header: true,
      include_page_name: true,
      include_order_id: true,
      include_customer_name: true,
      include_phone: true,
      include_address: true,
      include_items: true,
      include_shipping_duration: true,
      include_total_amount: true,
      include_shipping_note: true,
      include_inspection_note: true,
      include_closing_blessing: true
    },
    cod_summary_template:
      page?.cod_summary_template ||
      `📦 สรุปยอดคำสั่งซื้อ (เก็บเงินปลายทาง):\nคุณ{customer_name}\n{shipping_address}\n{phone_number}\n***{items}\nยอดเรียกเก็บปลายทาง: ฿{total_amount} (จัดส่งฟรี ไม่บวกเพิ่ม)\n🚚 ระยะเวลาจัดส่ง: {shipping_duration}`,
    product: {
      ...page?.product,
      shipping_duration: initialShipping.shipping_duration,
      courier_brand: initialShipping.courier_brand,
      delivery_days: initialShipping.delivery_days,
      specs: {
        ...page?.product?.specs,
        courier_brand: initialShipping.courier_brand,
        delivery_days: initialShipping.delivery_days,
        material: page?.product?.specs?.material || 'วัสดุเกรดพรีเมียม / เนื้อมวลสารบริสุทธิ์แท้',
        dimensions: page?.product?.specs?.dimensions || 'ขนาดมาตรฐาน',
        weight: page?.product?.specs?.weight || 'น้ำหนักเบา พกพาสะดวก',
        warranty: page?.product?.specs?.warranty || 'รับประกันความแท้ 100% เปลี่ยนคืนใน 7 วัน',
        origin_or_temple: page?.product?.specs?.origin_or_temple || 'แหล่งผลิต/วัดของแท้',
        master_or_maker: page?.product?.specs?.master_or_maker || 'อาจารย์/ช่างฝีมือชั้นครู',
        ceremony_or_batch: page?.product?.specs?.ceremony_or_batch || 'รุ่นมงคลยอดนิยม',
        authenticity_cert: page?.product?.specs?.authenticity_cert || 'มีใบรับรองมาตรฐาน',
        spell_or_instructions: page?.product?.specs?.spell_or_instructions || 'วิธีการใช้งานหรือบทสวดบูชาตามคำแนะนำ',
        box_contents: page?.product?.specs?.box_contents || 'ตัวสินค้า + ของแถม + ใบรับประกัน',
        cod_note: page?.product?.specs?.cod_note || 'บริการเก็บเงินปลายทาง (COD) ไม่ต้องโอนก่อน',
        shipping_time: page?.product?.specs?.shipping_time || 'จัดส่ง 1-3 วันถึง',
        shipping_duration: initialShipping.shipping_duration,
        brand: page?.product?.specs?.brand || '',
        features: page?.product?.specs?.features || '',
        usage: page?.product?.specs?.usage || '',
        benefit: page?.product?.specs?.benefit || '',
        shipping_info: page?.product?.specs?.shipping_info || '',
        temple: page?.product?.specs?.temple || '',
        master: page?.product?.specs?.master || '',
        year: page?.product?.specs?.year || '',
        edition: page?.product?.specs?.edition || '',
        history: page?.product?.specs?.history || '',
        belief_info: page?.product?.specs?.belief_info || '',
        spell: page?.product?.specs?.spell || '',
        worship_method: page?.product?.specs?.worship_method || '',
        community: page?.product?.specs?.community || '',
        province: page?.product?.specs?.province || '',
        maker: page?.product?.specs?.maker || '',
        origin: page?.product?.specs?.origin || '',
        story: page?.product?.specs?.story || '',
        production_method: page?.product?.specs?.production_method || '',
        formula_or_type: page?.product?.specs?.formula_or_type || '',
        suitable_for: page?.product?.specs?.suitable_for || '',
        usage_instructions: page?.product?.specs?.usage_instructions || '',
        benefits: page?.product?.specs?.benefits || '',
        registration_number: page?.product?.specs?.registration_number || '',
        package_size: page?.product?.specs?.package_size || '',
        safety_warning: page?.product?.specs?.safety_warning || '',
        care_instruction: page?.product?.specs?.care_instruction || '',
        warning: page?.product?.specs?.warning || ''
      },
      promotions: page?.product?.promotions?.length
        ? page.product.promotions
        : [
            {
              id: 'promo-1',
              name: 'โปรโมชั่น 1 ชิ้น (ชุดทดลอง)',
              quantity: 1,
              price: page?.product?.display_price || 990,
              original_price: page?.product?.base_price || 1590,
              free_gifts: 'ส่งฟรีเก็บเงินปลายทาง',
              description: 'เหมาะสำหรับผู้เริ่มต้น',
              is_popular: false
            },
            {
              id: 'promo-2',
              name: 'โปรโมชั่น 2 ชิ้น (ชุดสุดคุ้มยอดนิยม)',
              quantity: 2,
              price: Math.round((page?.product?.display_price || 990) * 1.8),
              original_price: (page?.product?.base_price || 1590) * 2,
              free_gifts: 'ของแถมพรีเมียม + ส่งฟรี COD',
              description: 'ประหยัดเพิ่มขึ้น 20%',
              is_popular: true
            },
            {
              id: 'promo-3',
              name: 'โปรโมชั่น 3 ชิ้น (ชุดเหมาสุดคุ้ม)',
              quantity: 3,
              price: Math.round((page?.product?.display_price || 990) * 2.5),
              original_price: (page?.product?.base_price || 1590) * 3,
              free_gifts: 'ของแถมพรีเมียม 2 เท่า + ส่งฟรีด่วนพิเศษ',
              description: 'คุ้มค่าที่สุดสำหรับครอบครัวหรือแจกญาติมิตร',
              is_popular: false
            }
          ]
    }
  }));

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testNotificationStatus, setTestNotificationStatus] = useState<{ ok: boolean; message: string; results?: string[]; deepLinks?: { telegram?: string; line?: string } } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [specsCategoryFilter, setSpecsCategoryFilter] = useState<'AUTO' | ProductCategory>('AUTO');

  // NOTE: Google deprecated the gemini-2.5-* series for new API keys
  // (NOT_FOUND). The server validates with gemini-3.6-flash first and
  // auto-fallbacks deprecated selections via resolveAiModel().
  const geminiModels = [
    {
      id: 'gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      desc: 'ตอบสนองเร็วทันใจ ปิดการขายไว โมเดลล่าสุดที่ Google แนะนำ (ฟรี)',
      badge: 'แนะนำ • เร็วสูงสุด'
    },
    {
      id: 'gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      desc: 'เหมาะกับงานที่ต้องวิเคราะห์หลายขั้นตอนและตอบตามข้อมูลสินค้าซับซ้อน',
      badge: 'ใหม่ • ฉลาดสูง'
    }
  ];

  // Courier Options (ใช้ค่ากลางจาก utils/shippingMatrix เพื่อให้ตรงกับเมนูฐานข้อมูลสินค้า)
  const courierOptions = COURIER_OPTIONS.map(c => ({
    id: c.value,
    name: c.label,
    desc: c.hint || 'จัดส่งทั่วประเทศ มีบริการเก็บเงินปลายทาง'
  }));

  // Delivery Duration Options
  const deliveryDaysOptions = DELIVERY_DAYS_OPTIONS.map(d => ({
    id: d.value,
    name: d.label,
    desc: d.value === DEFAULT_DELIVERY_DAYS
      ? 'มาตรฐานจัดส่งด่วน (ยอดนิยม)'
      : d.value === '2-4 วัน'
        ? 'พื้นที่ห่างไกลหรือสินค้าสั่งทำ'
        : 'สินค้าชิ้นใหญ่หรือส่งข้ามภาค'
  }));

  /**
   * Update courier & duration helper
   * เขียนค่าลง 3 ที่พร้อมกัน: product.shipping_duration, product.courier_brand/delivery_days
   * และ product.specs.* เพื่อให้เมนูฐานข้อมูลสินค้า (ซึ่งอ่านจาก catalog row / specs)
   * เห็นค่าเดียวกันกับ Shipping Matrix เสมอ
   */
  const applyShippingMatrix = (brand: string, days: string) => {
    const durationText = buildShippingDuration(brand, days);
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        shipping_duration: durationText,
        courier_brand: brand,
        delivery_days: days,
        specs: {
          ...prev.product.specs,
          courier_brand: brand,
          delivery_days: days,
          shipping_duration: durationText
        }
      }
    }));
  };

  const handleSelectCourier = (brand: string) => {
    applyShippingMatrix(brand, formData.product.specs?.delivery_days || DEFAULT_DELIVERY_DAYS);
  };

  const handleSelectDeliveryDays = (days: string) => {
    applyShippingMatrix(formData.product.specs?.courier_brand || DEFAULT_COURIER_BRAND, days);
  };

  // Image Upload helper
  const handleImageFileUpload = (e: React.ChangeEvent<any>, onComplete: (dataUrl: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onComplete(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddSequenceStep = () => {
    setFormData(prev => {
      const currentSteps = prev.sales_sequence_steps || [];
      const newStepNumber = currentSteps.length + 1;
      const newStep = {
        id: `step-${Date.now()}`,
        step_number: newStepNumber,
        type: 'BOTH' as const,
        title: `Step ${newStepNumber}: ข้อความและรูปภาพปิดการขายเพิ่มเติม`,
        text_content: '',
        image_url: ''
      };
      return {
        ...prev,
        sales_sequence_steps: [...currentSteps, newStep]
      };
    });
  };

  const handleRemoveSequenceStep = (index: number) => {
    setFormData(prev => {
      const currentSteps = prev.sales_sequence_steps || [];
      if (currentSteps.length <= 1) {
        alert('ต้องมีอย่างน้อย 1 สเต็ปในการปิดการขายค่ะ');
        return prev;
      }
      const updated = currentSteps
        .filter((_, i) => i !== index)
        .map((st, i) => ({
          ...st,
          step_number: i + 1,
          title: st.title ? st.title.replace(/Step \d+/, `Step ${i + 1}`) : `Step ${i + 1}: ข้อความปิดการขาย`
        }));
      return {
        ...prev,
        sales_sequence_steps: updated
      };
    });
  };

  const handleUpdateSequenceStep = (index: number, key: string, value: any) => {
    setFormData(prev => {
      const currentSteps = [...(prev.sales_sequence_steps || [])];
      if (currentSteps[index]) {
        currentSteps[index] = { ...currentSteps[index], [key]: value };
      }
      return {
        ...prev,
        sales_sequence_steps: currentSteps
      };
    });
  };

  const handleSave = async () => {
    if (formData.is_active && formData.auto_reply) {
      try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        if (!response.ok || !settings.geminiApiKeyConfigured) {
          alert('ต้องตั้งค่า Gemini API Key ที่ปุ่มตั้งค่า AI ด้านบนให้ผ่านก่อน จึงจะเปิด Auto-reply สำหรับเพจนี้ได้');
          return;
        }
      } catch {
        alert('ไม่สามารถยืนยันสถานะ AI กับเซิร์ฟเวอร์ได้ จึงยังไม่อนุญาตให้เปิด Auto-reply');
        return;
      }
    }
    onSavePage(originalPageIdRef.current, formData);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 700);
  };

  // Promotion helpers
  const handleAddPromotion = () => {
    const newPromo: PromotionTier = {
      id: `promo-${Date.now()}`,
      name: `โปรโมชั่น ${formData.product.promotions.length + 1} ชิ้น`,
      quantity: formData.product.promotions.length + 1,
      price: Math.round((formData.product.display_price || 990) * (formData.product.promotions.length + 1) * 0.9),
      original_price: Math.round((formData.product.base_price || 1590) * (formData.product.promotions.length + 1)),
      free_gifts: '',
      gift_quantity: 0,
      free_shipping: false,
      description: '',
      is_popular: false
    };
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        promotions: [...prev.product.promotions, newPromo]
      }
    }));
  };

  const handleRemovePromotion = (id: string) => {
    if (formData.product.promotions.length <= 1) {
      alert('ต้องมีโปรโมชั่นอย่างน้อย 1 รายการ');
      return;
    }
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        promotions: prev.product.promotions.filter(p => p.id !== id)
      }
    }));
  };

  const handleUpdatePromotion = (id: string, field: keyof PromotionTier, value: any) => {
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        promotions: prev.product.promotions.map(p =>
          p.id === id ? { ...p, [field]: value } : p
        )
      }
    }));
  };

  // Comment reply image handlers (up to 6 images)
  const handleAddCommentImage = (url: string) => {
    const current = formData.comment_reply_images || [];
    if (current.length >= 6) {
      alert('สามารถแนบรูปภาพตอบกลับคอมเมนต์ได้สูงสุด 6 รูปภาพ');
      return;
    }
    setFormData(prev => ({
      ...prev,
      comment_reply_images: [...current, url]
    }));
  };

  const handleRemoveCommentImage = (index: number) => {
    const current = [...(formData.comment_reply_images || [])];
    current.splice(index, 1);
    setFormData(prev => ({
      ...prev,
      comment_reply_images: current
    }));
  };

  // Test Notification Dispatch — sends a REAL test message with the values in
  // the form (saved or not) and reports the genuine per-channel result. The
  // server also auto-detects the Telegram Chat ID (getUpdates) when missing.
  const handleTestNotification = async (channel: 'LINE' | 'TELEGRAM') => {
    setTestNotificationStatus({ ok: true, message: `กำลังส่งข้อความทดสอบไปยัง ${channel}...` });
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          page_id: formData.page_id,
          page_name: formData.page_name,
          line_token: formData.line_notify_token,
          line_group_id: formData.line_group_id,
          telegram_token: formData.telegram_bot_token,
          telegram_chat_id: formData.telegram_chat_id,
          sample_order: {
            customer_name: 'คุณวิชัย วันดี',
            address: 'โตโยต้าชัวร์ ทีบีเอ็น (ติดหมู่บ้านทาวพลัส) 318/4 ถ.ลาดกระบัง แขวงลาดกระบัง เขตลาดกระบัง กทม 10520',
            phone: '0927015995',
            item: `${formData.product.product_name} 1 ชุด`,
            total: formData.product.display_price
          }
        })
      });
      const data = await res.json();

      // Auto-fill the Telegram Chat ID when the server detected it, so the
      // admin only has to press save — no manual lookup needed.
      if (channel === 'TELEGRAM' && data.telegram?.detected_chat_id && !formData.telegram_chat_id) {
        setFormData(prev => ({ ...prev, telegram_chat_id: data.telegram.detected_chat_id }));
      }

      setTestNotificationStatus({
        ok: Boolean(data.success),
        message: data.message || (data.success ? `ส่งการแจ้งเตือน ${channel} สำเร็จแล้ว!` : `ส่งการแจ้งเตือน ${channel} ไม่สำเร็จ`),
        results: Array.isArray(data.results) ? data.results : [],
        deepLinks: data.deepLinks || undefined
      });
      if (data.success) {
        setTimeout(() => setTestNotificationStatus(null), 6000);
      }
    } catch (err: any) {
      setTestNotificationStatus({ ok: false, message: `ส่งล้มเหลว: ${err.message}` });
    }
  };

  // Helper for updating specs fields
  const handleUpdateSpec = (field: keyof ProductDetailedSpecs, value: string) => {
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        specs: {
          ...prev.product.specs,
          [field]: value
        }
      }
    }));
  };

  const handleAddCustomSpec = () => {
    const newItem: CustomSpecItem = {
      id: `spec-${Date.now()}`,
      key: '',
      value: ''
    };
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        specs: {
          ...prev.product.specs,
          custom_specs: [...(prev.product.specs?.custom_specs || []), newItem]
        }
      }
    }));
  };

  const handleRemoveCustomSpec = (id: string) => {
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        specs: {
          ...prev.product.specs,
          custom_specs: (prev.product.specs?.custom_specs || []).filter((s: CustomSpecItem) => s.id !== id)
        }
      }
    }));
  };

  const handleUpdateCustomSpec = (id: string, field: 'key' | 'value', val: string) => {
    setFormData(prev => ({
      ...prev,
      product: {
        ...prev.product,
        specs: {
          ...prev.product.specs,
          custom_specs: (prev.product.specs?.custom_specs || []).map((s: CustomSpecItem) =>
            s.id === id ? { ...s, [field]: val } : s
          )
        }
      }
    }));
  };

  // Determine which category specs to show based on filter or auto
  const effectiveCategory = specsCategoryFilter === 'AUTO' ? formData.category : specsCategoryFilter;

  // Smart preset loader for detailed specs
  const handleLoadSmartPreset = (cat: ProductCategory) => {
    if (cat === 'AMULET') {
      setFormData(prev => ({
        ...prev,
        product: {
          ...prev.product,
          specs: {
            ...prev.product.specs,
            temple: prev.product.specs?.temple || 'วัดช้างให้ จ.ปัตตานี',
            master: prev.product.specs?.master || 'พระอาจารย์ทิม ธมฺมธโร',
            year: prev.product.specs?.year || '2508',
            edition: prev.product.specs?.edition || 'รุ่นเลื่อนสมณศักดิ์',
            material: prev.product.specs?.material || 'เนื้อทองแดงรมดำ ตอกโค้ดและหมายเลขกำกับ',
            belief_info: prev.product.specs?.belief_info || 'แคล้วคลาดปลอดภัย เมตตามหานิยม เลื่อนยศเลื่อนตำแหน่ง ค้าขายร่ำรวย',
            spell: prev.product.specs?.spell || 'ตั้งนะโม 3 จบ: "นะโม โพธิสัตโต อาคันติมายะ อิติภะคะวา" 3 จบ',
            worship_method: prev.product.specs?.worship_method || 'อาราธนาติดตัว เลี่ยมกรอบกันน้ำ สวดบูชาทุกเช้าค่ำ',
            warranty: prev.product.specs?.warranty || 'รับประกันพระแท้ตลอดชีพ สากลนิยม เก๊ยินดีคืนเงิน 100%',
            care_instruction: prev.product.specs?.care_instruction || 'เก็บรักษาในกล่องกำมะหยี่ หลีกเลี่ยงความชื้นและสารเคมี',
            warning: prev.product.specs?.warning || 'ห้ามสวมใส่เข้าที่อโคจร มีสติอยู่ในศีลธรรม'
          }
        }
      }));
    } else if (cat === 'CHINA') {
      setFormData(prev => ({
        ...prev,
        product: {
          ...prev.product,
          specs: {
            ...prev.product.specs,
            brand: prev.product.specs?.brand || 'SuperAir Smart Life',
            features: prev.product.specs?.features || 'กรองฝุ่น PM2.5, ดักจับขนสัตว์, ฆ่าเชื้อ UV-C, ทำงานเงียบสนิท 25dB, ควบคุมผ่านแอป',
            material: prev.product.specs?.material || 'พลาสติก ABS เกรดวิศวกรรม ทนความร้อนสูง ไส้กรอง HEPA H13 แท้',
            dimensions: prev.product.specs?.dimensions || '24 x 24 x 52 ซม.',
            weight: prev.product.specs?.weight || '3.5 กิโลกรัม',
            usage: prev.product.specs?.usage || 'เสียบปลั๊กกดปุ่มเปิดเครื่อง หรือสั่งงานผ่านสมาร์ทโฟน',
            benefit: prev.product.specs?.benefit || 'อากาศสะอาดสดชื่น หายใจโล่ง บรรเทาภูมิแพ้ ประหยัดไฟเพียงวันละ 1.5 บาท',
            warranty: prev.product.specs?.warranty || 'รับประกันศูนย์ไทย 1 ปีเต็ม เปลี่ยนเครื่องใหม่ใน 30 วัน',
            box_contents: prev.product.specs?.box_contents || 'ตัวเครื่อง + ไส้กรอง HEPA 1 ชุด + สายไฟ + คู่มือภาษาไทย'
          }
        }
      }));
    } else if (cat === 'OTOP') {
      setFormData(prev => ({
        ...prev,
        product: {
          ...prev.product,
          specs: {
            ...prev.product.specs,
            community: prev.product.specs?.community || 'วิสาหกิจชุมชนทอผ้ายกทองโบราณบ้านท่าสว่าง',
            province: prev.product.specs?.province || 'จังหวัดสุรินทร์',
            maker: prev.product.specs?.maker || 'ครูช่างศิลปหัตถกรรมแห่งชาติ',
            material: prev.product.specs?.material || 'เส้นไหมแท้ 100% ย้อมสีธรรมชาติจากเปลือกไม้และครั่ง',
            production_method: prev.product.specs?.production_method || 'ทอมือโบราณกี่กระตุก ลายโบราณชั้นสูง ละเอียดประณีต',
            dimensions: prev.product.specs?.dimensions || 'หน้ากว้าง 100 ซม. ความยาว 200 ซม. (2 หลา)',
            warranty: prev.product.specs?.warranty || 'รับรองมาตรฐาน OTOP 5 ดาว และตรานกยูงพระราชทานสีทอง',
            care_instruction: prev.product.specs?.care_instruction || 'ซักแห้งหรือซักมือด้วยน้ำยาซักผ้าไหม รีดด้วยไฟอ่อน'
          }
        }
      }));
    } else if (cat === 'AGRICULTURE') {
      setFormData(prev => ({
        ...prev,
        product: {
          ...prev.product,
          specs: {
            ...prev.product.specs,
            brand: prev.product.specs?.brand || 'กรีนฟาร์ม โกรทพลัส (GreenFarm Growth+)',
            formula_or_type: prev.product.specs?.formula_or_type || 'อะมิโนไคโตซานเข้มข้น + ธาตุอาหารรองครบถ้วน',
            suitable_for: prev.product.specs?.suitable_for || 'นาข้าว, ยางพารา, ทุเรียน, ไม้ผล, พืชผักสวนครัวทุกชนิด',
            usage_instructions: prev.product.specs?.usage_instructions || 'ผสมน้ำ 20-30 ซีซี ต่อน้ำ 20 ลิตร ฉีดพ่นทางใบช่วงเช้าแดดอ่อน ทุก 7-10 วัน',
            benefits: prev.product.specs?.benefits || 'เร่งราก แตกกอ ใบเขียวเข้ม เพิ่มน้ำหนักผลผลิต ต้านทานโรคพืช',
            registration_number: prev.product.specs?.registration_number || 'รส. 2145/2566 กรมวิชาการเกษตร',
            package_size: prev.product.specs?.package_size || '1,000 มล. (1 ลิตร)',
            safety_warning: prev.product.specs?.safety_warning || 'ปลอดภัยต่อผู้ใช้ สัตว์เลี้ยง และสิ่งแวดล้อม เก็บในที่ร่มพ้นมือเด็ก'
          }
        }
      }));
    }
  };

  if (!isOpen || !page) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0C0C0E] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#121216] border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  ตั้งค่าเพจเฉพาะบุคคล: {formData.page_name}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60">
                  1 เพจ = 1 สินค้าอิสระ
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-medium">
                  หมวดหมู่: {formData.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                ปรับแต่งบุคลิก AI, แบรนด์ขนส่ง & วันจัดส่ง, สเปกสินค้าละเอียด, รูปภาพ 6 สเต็ป, ตอบกลับคอมเมนต์ และแบบฟอร์ม COD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800 bg-slate-100/60 dark:bg-[#0E0E11] px-6 overflow-x-auto gap-2 shrink-0">
          {[
            { id: 'ai_persona', label: '1. บุคลิก AI & โมเดล Gemini', icon: Bot },
            { id: 'sales_sequence', label: '2. แพตเทิร์น 6 สเต็ป + รูปภาพ', icon: Layers },
            { id: 'comments', label: '3. ตอบคอมเมนต์ + รูป 6 ใบ', icon: MessageSquare },
            { id: 'followup', label: '4. ปรับเวลาติดตามออเดอร์', icon: Clock },
            { id: 'detailed_specs', label: '5. ข้อมูลสินค้าละเอียด & ขนส่ง 🚚', icon: FileText },
            { id: 'product_promos', label: '6. แพ็กเกจโปรโมชั่น (ราคา/แถม)', icon: ShoppingBag },
            { id: 'cod_summary', label: '7. ระบบสรุปยอดลูกค้า (COD)', icon: Copy },
            { id: 'notifications', label: '8. ส่งสรุปไป Telegram / LINE', icon: Bell },
            { id: 'facebook', label: '9. เชื่อมต่อ Facebook API 🔌', icon: Facebook },
            { id: 'bot_settings', label: '10. ตั้งค่าบอท ⚙️', icon: Settings },
            { id: 'chat_buttons', label: '11. ปุ่มแชทลูกค้า 💬', icon: MessageSquare }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'border-indigo-600 dark:border-indigo-500 font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#141418]'
                    : 'border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-500'}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-[#0A0A0C]/70">
          {/* TAB 1: AI MODEL & PERSONA */}
          {activeSubTab === 'ai_persona' && (
            <div className="space-y-6">
              {/* Gemini Models */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" /> เลือกโมเดล AI Gemini สำหรับเพจนี้
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {geminiModels.map(model => (
                    <div
                      key={model.id}
                      onClick={() => setFormData(prev => ({ ...prev, ai_model: model.id }))}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        formData.ai_model === model.id
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-[#16161C] border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-zinc-100">{model.name}</span>
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">{model.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Persona & Tone */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> กำหนดบุคลิกแอดมินและการตอบ
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                      ชื่อแอดมิน (แสดงในบทสนทนา):
                    </label>
                    <input
                      type="text"
                      value={formData.admin_name || ''}
                      onChange={e => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
                      placeholder="ค่าเริ่มต้น: น้ำหวาน (แก้ไขได้ทุกเพจ)"
                      className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                      โทนและสไตล์การพูด:
                    </label>
                    <select
                      value={formData.ai_tone}
                      onChange={e => setFormData(prev => ({ ...prev, ai_tone: e.target.value as any }))}
                      className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                    >
                      <option value="FRIENDLY">😊 อ่อนหวาน เป็นกันเอง น่ารัก (สุภาพเรียบร้อย)</option>
                      <option value="FAST_CLOSING">⚡ รวดเร็ว ฉับไว เน้นปิดการขาย Flash Sale</option>
                      <option value="SACRED">📿 สายมู ศรัทธาเข้มขลัง พุทธคุณแท้</option>
                      <option value="PROFESSIONAL">👔 มืออาชีพ น่าเชื่อถือ ข้อมูลทางเทคนิคแน่น</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800/80 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 block">เปิดใช้งาน AI อัตโนมัติสำหรับเพจนี้</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">เมื่อปิด เพจนี้จะไม่ตอบข้อความ Inbox โดยอัตโนมัติ</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC SALES SEQUENCE STEPS & IMAGES */}
          {activeSubTab === 'sales_sequence' && (
            <div className="space-y-6">
              <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-900 dark:text-indigo-300 space-y-1">
                    <p className="font-bold">ลำดับการส่งภาพและข้อความปิดการขาย (ตั้งค่าสเต็ปการส่งได้อิสระ)</p>
                    <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                      คุณสามารถเลือกว่าแต่ละสเต็ปจะส่ง <strong>ข้อความอย่างเดียว</strong>, <strong>รูปภาพอย่างเดียว</strong> หรือ <strong>ทั้งข้อความและรูปภาพ</strong> พร้อมกดเพิ่มหรือลดสเต็ปได้ตามต้องการค่ะ
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddSequenceStep}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer shrink-0 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มสเต็ปปิดการขาย</span>
                </button>
              </div>

              {/* Dynamic Steps List */}
              <div className="space-y-4">
                {(formData.sales_sequence_steps || []).map((step, idx) => {
                  const stepType = step.type || 'BOTH';

                  return (
                    <div
                      key={step.id || idx}
                      className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-xs relative"
                    >
                      {/* Step Header */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={step.title || `Step ${idx + 1}: สเต็ปปิดการขาย`}
                            onChange={e => handleUpdateSequenceStep(idx, 'title', e.target.value)}
                            className="bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none w-64 sm:w-80"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Type Selector */}
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#181820] p-1 rounded-lg border border-slate-200 dark:border-zinc-800 text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleUpdateSequenceStep(idx, 'type', 'TEXT')}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                stepType === 'TEXT'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                              }`}
                            >
                              💬 ข้อความอย่างเดียว
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSequenceStep(idx, 'type', 'IMAGE')}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                stepType === 'IMAGE'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                              }`}
                            >
                              🖼️ รูปภาพอย่างเดียว
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSequenceStep(idx, 'type', 'BOTH')}
                              className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                                stepType === 'BOTH'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                              }`}
                            >
                              💬🖼️ ข้อความ & รูปภาพ
                            </button>
                          </div>

                          {/* Delete Step Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSequenceStep(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                            title="ลบสเต็ปนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Step Content according to type */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pt-1">
                        {/* Image Column (Shown if IMAGE or BOTH) */}
                        {(stepType === 'IMAGE' || stepType === 'BOTH') && (
                          <div className={stepType === 'IMAGE' ? 'lg:col-span-12 space-y-2' : 'lg:col-span-5 space-y-2'}>
                            <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block">
                              รูปภาพประจำสเต็ป {idx + 1}:
                            </label>
                            <div className="h-36 rounded-xl bg-slate-100 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 relative overflow-hidden flex items-center justify-center group">
                              {step.image_url ? (
                                <img
                                  src={step.image_url}
                                  alt={`Step ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="text-center p-3 text-slate-400 dark:text-zinc-500">
                                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                                  <span className="text-[11px]">ยังไม่ได้แนบรูปภาพ</span>
                                </div>
                              )}

                              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white cursor-pointer transition-opacity">
                                <Upload className="w-5 h-5 mb-1" />
                                <span className="text-[11px] font-medium">คลิกอัปโหลดรูปภาพ</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e =>
                                    handleImageFileUpload(e, url =>
                                      handleUpdateSequenceStep(idx, 'image_url', url)
                                    )
                                  }
                                />
                              </label>
                            </div>

                            <input
                              type="text"
                              value={step.image_url || ''}
                              onChange={e => handleUpdateSequenceStep(idx, 'image_url', e.target.value)}
                              placeholder="หรือวาง URL รูปภาพที่นี่..."
                              className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                            />
                          </div>
                        )}

                        {/* Text Script Column (Shown if TEXT or BOTH) */}
                        {(stepType === 'TEXT' || stepType === 'BOTH') && (
                          <div className={stepType === 'TEXT' ? 'lg:col-span-12 space-y-1.5' : 'lg:col-span-7 space-y-1.5'}>
                            <label className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium block">
                              ข้อความบทพูดประจำสเต็ป {idx + 1}:
                            </label>
                            <textarea
                              rows={stepType === 'TEXT' ? 3 : 4}
                              value={step.text_content || ''}
                              onChange={e => handleUpdateSequenceStep(idx, 'text_content', e.target.value)}
                              placeholder={`ระบุข้อความสำหรับสเต็ป ${idx + 1}...`}
                              className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none leading-relaxed"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Add Step Button */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleAddSequenceStep}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all inline-flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ เพิ่มสเต็ปการส่งปิดการขาย (สเต็ปที่ {(formData.sales_sequence_steps || []).length + 1})</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: COMMENTS & 6 IMAGES */}
          {activeSubTab === 'comments' && (
            <div className="space-y-6">
              {/* Comment Auto Reply */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ระบบตอบกลับคอมเมนต์อัตโนมัติ (Comment Auto-Reply)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      เมื่อลูกค้าคอมเมนต์สนใจใต้โพสต์ ระบบจะตอบกลับพร้อมแท็กชื่อ และดึงเข้า Inbox ทันที
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.comment_auto_tag_customer !== false}
                      onChange={e => setFormData(prev => ({ ...prev, comment_auto_tag_customer: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div>
                  <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                    ข้อความตอบกลับใต้คอมเมนต์ (ใช้ @customer_name เพื่อแท็กชื่อลูกค้า):
                  </label>
                  <textarea
                    rows={3}
                    value={formData.comment_reply_template || ''}
                    onChange={e => setFormData(prev => ({ ...prev, comment_reply_template: e.target.value }))}
                    placeholder="ขอบพระคุณที่สนใจค่ะคุณ @customer_name แอดมินทัก Inbox ส่งรายละเอียดโปรโมชั่นให้แล้วนะคะ 🙏"
                    className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 6 Comment Reply Images */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      รูปภาพแนบสำหรับตอบกลับคอมเมนต์ (สูงสุด 6 รูป)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      ระบบจะสุ่มหรือส่งรูปภาพเซ็ตนี้ตอบกลับไปพร้อมข้อความคอมเมนต์เพื่อดึงดูดสายตา
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                    {(formData.comment_reply_images || []).length} / 6 รูป
                  </span>
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {(formData.comment_reply_images || []).map((imgUrl, idx) => (
                    <div
                      key={idx}
                      className="h-28 rounded-xl bg-slate-100 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 relative overflow-hidden group shadow-xs"
                    >
                      <img
                        src={imgUrl}
                        alt={`Comment Reply ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCommentImage(idx)}
                        className="absolute top-1.5 right-1.5 p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="ลบรูปนี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {(formData.comment_reply_images || []).length < 6 && (
                    <label className="h-28 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors">
                      <Plus className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold">เพิ่มรูปภาพ</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e =>
                          handleImageFileUpload(e, url => handleAddCommentImage(url))
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FOLLOW-UP ENGINE */}
          {activeSubTab === 'followup' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ตั้งค่าเวลาและข้อความติดตามลูกค้า (Follow-Up Stages)
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  ระบบจะส่งข้อความสะกิดลูกค้าที่เงียบหายไปตามช่วงเวลาที่กำหนดโดยอัตโนมัติ และหยุดทันทีเมื่อปิดการขายสำเร็จ
                </p>

                {/* Master switch — the smart follow-up tick skips pages where this is off */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-200">เปิดระบบติดตามอัตโนมัติ (Follow-Up Engine)</p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                      ระบบจะตรวจทุก 10 นาที แล้วส่งข้อความตามสเต็ปด้านล่างให้ลูกค้าที่เงียบหายไป (หยุดเองเมื่อลูกค้าซื้อ/ถูกบล็อก)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={formData.followup_enabled === true}
                      onChange={e => setFormData(prev => ({ ...prev, followup_enabled: e.target.checked }))}
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-zinc-700 peer-checked:bg-indigo-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                  </label>
                </div>

                <div className="space-y-4 pt-2">
                  {(formData.followup_messages || []).map((f, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-200">รอบที่ {idx + 1}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-500 dark:text-zinc-400">หลังเงียบ</label>
                          <input
                            type="text"
                            value={f.interval}
                            onChange={e => setFormData(prev => ({
                              ...prev,
                              followup_messages: (prev.followup_messages || []).map((m, i) => i === idx ? { ...m, interval: e.target.value } : m)
                            }))}
                            placeholder="เช่น 15 นาที / 2 ชั่วโมง / 21:00 น."
                            className="w-40 bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none"
                          />
                          {(formData.followup_messages || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                followup_messages: (prev.followup_messages || []).filter((_, i) => i !== idx)
                              }))}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                              title="ลบสเต็ปนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        value={f.message}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          followup_messages: (prev.followup_messages || []).map((m, i) => i === idx ? { ...m, message: e.target.value } : m)
                        }))}
                        placeholder="ข้อความติดตามลูกค้ารอบนี้..."
                        className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none resize-none"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      followup_messages: [
                        ...(prev.followup_messages || []),
                        { interval: `${(prev.followup_messages?.length || 0) + 1} ชั่วโมง`, message: '' }
                      ]
                    }))}
                    className="w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-slate-500 dark:text-zinc-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    + เพิ่มสเต็ปติดตาม
                  </button>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    💡 กด "บันทึกการตั้งค่าเพจนี้" ด้านล่างเพื่อให้มีผลจริง — ระบบจะส่งข้อความที่ตั้งไว้ตามเวลา (รองรับ "นาที", "ชั่วโมง", "วัน" และเวลาแบบ "21:00 น.")
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DETAILED SPECS & SHIPPING COURIER */}
          {activeSubTab === 'detailed_specs' && (
            <div className="space-y-6">
              {/* SHIPPING COURIER & DURATION MATRIX */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      🚚 ตัวเลือกแบรนด์ขนส่ง & ระยะเวลาจัดส่ง (Shipping Matrix)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      เลือกแบรนด์ขนส่งและระยะเวลาจัดส่ง ระบบจะสร้างข้อความมาตรฐานให้ AI ตอบลูกค้าโดยอัตโนมัติ
                    </p>
                  </div>
                </div>

                {/* 1. Courier Brand Buttons */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-700 dark:text-zinc-300 font-bold block">
                    1. เลือกแบรนด์ขนส่งพาร์ทเนอร์:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {courierOptions.map(c => {
                      const isSelected = (formData.product.specs?.courier_brand || 'Flash Express') === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCourier(c.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                              : 'bg-slate-50 dark:bg-[#16161C] border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">{c.name}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">{c.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Delivery Duration Buttons (3 Choices) */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800/80">
                  <label className="text-xs text-slate-700 dark:text-zinc-300 font-bold block">
                    2. เลือกระยะเวลาจัดส่ง (Delivery Days):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {deliveryDaysOptions.map(d => {
                      const isSelected = (formData.product.specs?.delivery_days || '1-3 วัน') === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => handleSelectDeliveryDays(d.id)}
                          className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500'
                              : 'bg-slate-50 dark:bg-[#16161C] border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs">{d.name}</span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">{d.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Standard Shipping Text Preview */}
                <div className="p-3.5 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800/80 rounded-xl space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                    ข้อความการจัดส่งมาตรฐานที่ AI จะนำไปใช้ตอบลูกค้า:
                  </span>
                  <input
                    type="text"
                    value={formData.product.shipping_duration || ''}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        product: {
                          ...prev.product,
                          shipping_duration: e.target.value,
                          specs: { ...prev.product.specs, shipping_duration: e.target.value }
                        }
                      }))
                    }
                    className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* DETAILED SPECS ACCORDING TO CATEGORY */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      📋 ข้อมูลสเปกสินค้าแบบละเอียด (Detailed Product Specifications)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      ข้อมูลละเอียดนี้ช่วยให้ AI ตอบคำถามเชิงลึก เช่น มวลสาร, คาถา, วิธีใช้, ขนาด, และใบรับประกัน
                    </p>
                  </div>

                  {/* Preset Quick Loader */}
                  <button
                    type="button"
                    onClick={() => handleLoadSmartPreset(effectiveCategory)}
                    className="px-3.5 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>โหลดตัวอย่างสเปก {effectiveCategory}</span>
                  </button>
                </div>

                {/* AI Auto-Key Panel for Page Settings */}
                <div className="p-4 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/30 rounded-xl space-y-3 relative overflow-hidden shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black shadow-sm">
                        <Sparkles className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-indigo-300 text-xs flex items-center gap-1.5">
                          ✨ AI Auto-Key (ถอดรหัสข้อความสเปกและกรอกช่องอัตโนมัติ)
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          วางข้อความรายละเอียดสเปกสินค้าจากซัพพลายเออร์ แล้วกดปุ่ม AI Auto Key ข้อมูลจะถูกถอดรหัสกรอกลงสเปก {effectiveCategory} อัตโนมัติ!
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
                        placeholder="วางข้อความรายละเอียดสินค้า เช่น:&#10;ชื่อสินค้า: พระสมเด็จวัดระฆัง&#10;วัด: วัดระฆังโฆสิตาราม&#10;พระเกจิ: สมเด็จพระพุฒาจารย์ (โต พรหมรังสี)&#10;ปี: พ.ศ. 2411&#10;พุทธคุณ: เมตตามหานิยม โชคลาภ แคล้วคลาด..."
                        className="w-full bg-[#0A0A0C]/80 border border-indigo-500/40 rounded-lg p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-400 outline-none font-mono"
                      />
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleRunAiAutoKeyForPageSettings(effectiveCategory)}
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
                              <span>🤖 กดปุ่ม AI Auto-Key (กรอกข้อมูลสเปก {effectiveCategory} อัตโนมัติ)</span>
                            </>
                          )}
                        </button>

                        {aiAutoSuccess && (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/80 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>✨ AI กรอกสเปกตรงช่องสำเร็จแล้ว! ({aiAutoSource})</span>
                          </div>
                        )}

                        {aiAutoError && (
                          <div className="flex items-start gap-1.5 text-amber-300 font-medium text-[11px] bg-amber-950/60 px-3 py-1.5 rounded-lg border border-amber-800/80 animate-in fade-in leading-relaxed">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                            <span>{aiAutoError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Category Filter Tabs for Specs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-xl text-xs overflow-x-auto">
                  {[
                    { id: 'AUTO', label: `อัตโนมัติตามเพจ (${formData.category})` },
                    { id: 'AMULET', label: '📿 พระเครื่อง' },
                    { id: 'CHINA', label: '🏮 สินค้านำเข้า/ไอที' },
                    { id: 'OTOP', label: '🌿 OTOP 5 ดาว' },
                    { id: 'AGRICULTURE', label: '🌾 สินค้าการเกษตร' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSpecsCategoryFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                        specsCategoryFilter === f.id
                          ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-zinc-700'
                          : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Fields for AMULET */}
                {effectiveCategory === 'AMULET' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วัด / สำนัก (temple):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.temple || ''}
                        onChange={e => handleUpdateSpec('temple', e.target.value)}
                        placeholder="เช่น วัดช้างให้ จ.ปัตตานี"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">พระเกจิ / ผู้สร้าง (master):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.master || ''}
                        onChange={e => handleUpdateSpec('master', e.target.value)}
                        placeholder="เช่น พระอาจารย์ทิม, หลวงปู่ทวด"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ปีที่สร้าง (year):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.year || ''}
                        onChange={e => handleUpdateSpec('year', e.target.value)}
                        placeholder="เช่น พ.ศ. 2508"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">รุ่น / พิมพ์ (edition):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.edition || ''}
                        onChange={e => handleUpdateSpec('edition', e.target.value)}
                        placeholder="เช่น รุ่นเลื่อนสมณศักดิ์ พิมพ์นิยม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">เนื้อวัสดุ (material):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.material || ''}
                        onChange={e => handleUpdateSpec('material', e.target.value)}
                        placeholder="เช่น เนื้อทองแดงรมดำ ตอกโค้ดกำกับ"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">จำนวนการสร้าง (quantity):</label>
                      <input
                        type="number"
                        value={formData.product.specs?.quantity || 1}
                        onChange={e => handleUpdateSpec('quantity', e.target.value)}
                        placeholder="เช่น 999 องค์"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ข้อมูลความเชื่อ (belief_info):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.belief_info || ''}
                        onChange={e => handleUpdateSpec('belief_info', e.target.value)}
                        placeholder="เช่น แคล้วคลาดปลอดภัย เมตตามหานิยม มหาอุด เลื่อนยศเลื่อนตำแหน่ง ค้าขายร่ำรวย"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">คาถา / บทสวด (spell):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.spell || ''}
                        onChange={e => handleUpdateSpec('spell', e.target.value)}
                        placeholder="เช่น ตั้งนะโม 3 จบ ตามด้วยบทสวดเฉพาะ..."
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีบูชา (worship_method):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.worship_method || ''}
                        onChange={e => handleUpdateSpec('worship_method', e.target.value)}
                        placeholder="เช่น พกติดตัว เลี่ยมกรอบบูชา"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีดูแลรักษา (care_instruction):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.care_instruction || ''}
                        onChange={e => handleUpdateSpec('care_instruction', e.target.value)}
                        placeholder="เช่น เลี่ยมกรอบกันน้ำ หลีกเลี่ยงสารเคมี"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ข้อควรระวัง (warning):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.warning || ''}
                        onChange={e => handleUpdateSpec('warning', e.target.value)}
                        placeholder="เช่น ไม่สวมใส่เข้าที่อโคจร"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ประวัติ (history):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.history || ''}
                        onChange={e => handleUpdateSpec('history', e.target.value)}
                        placeholder="เช่น จัดสร้างเนื่องในโอกาสบูรณะอุโบสถ พิธีอธิษฐานจิตเข้มขลัง"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Fields for CHINA / TECH */}
                {effectiveCategory === 'CHINA' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">แบรนด์ / ยี่ห้อ (brand):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.brand || ''}
                        onChange={e => handleUpdateSpec('brand', e.target.value)}
                        placeholder="เช่น TurboCool TH"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วัสดุ (material):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.material || ''}
                        onChange={e => handleUpdateSpec('material', e.target.value)}
                        placeholder="เช่น พลาสติก ABS, สแตนเลส 304"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ขนาด (size):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.size || ''}
                        onChange={e => handleUpdateSpec('size', e.target.value)}
                        placeholder="เช่น 15 x 20 ซม."
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">น้ำหนัก (weight):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.weight || ''}
                        onChange={e => handleUpdateSpec('weight', e.target.value)}
                        placeholder="เช่น 250 กรัม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีใช้งาน (usage):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.usage || ''}
                        onChange={e => handleUpdateSpec('usage', e.target.value)}
                        placeholder="เช่น เสียบปลั๊กเปิดใช้งานได้ทันที"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ข้อมูลการจัดส่ง (shipping_info):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.shipping_info || ''}
                        onChange={e => handleUpdateSpec('shipping_info', e.target.value)}
                        placeholder="เช่น จัดส่งด่วน 1-2 วัน มีประกัน 1 ปี"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">คุณสมบัติ (features):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.features || ''}
                        onChange={e => handleUpdateSpec('features', e.target.value)}
                        placeholder="เช่น กรองฝุ่น PM2.5, ควบคุมผ่านแอป"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ประโยชน์ / จุดเด่น (benefit):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.benefit || ''}
                        onChange={e => handleUpdateSpec('benefit', e.target.value)}
                        placeholder="เช่น อากาศสดชื่น ประหยัดไฟ"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">รายละเอียดสินค้า (description):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.description || ''}
                        onChange={e => handleUpdateSpec('description', e.target.value)}
                        placeholder="รายละเอียดสินค้าฉบับเต็ม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Fields for OTOP */}
                {effectiveCategory === 'OTOP' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ชุมชน / กลุ่มผู้ผลิต (community):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.community || ''}
                        onChange={e => handleUpdateSpec('community', e.target.value)}
                        placeholder="เช่น วิสาหกิจชุมชนทอผ้ายกทองโบราณ"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">จังหวัด (province):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.province || ''}
                        onChange={e => handleUpdateSpec('province', e.target.value)}
                        placeholder="เช่น จ.สุรินทร์"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ผู้ผลิต / ผู้ประกอบการ (maker):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.maker || ''}
                        onChange={e => handleUpdateSpec('maker', e.target.value)}
                        placeholder="เช่น กลุ่มสตรีทอผ้าไหม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">แหล่งที่มา (origin):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.origin || ''}
                        onChange={e => handleUpdateSpec('origin', e.target.value)}
                        placeholder="เช่น อ.แม่แตง จ.เชียงใหม่"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วัตถุดิบ / วัสดุ (material):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.material || ''}
                        onChange={e => handleUpdateSpec('material', e.target.value)}
                        placeholder="เช่น ไหมแท้ 100%"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ขนาด & น้ำหนัก (size / weight):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.size || ''}
                        onChange={e => handleUpdateSpec('size', e.target.value)}
                        placeholder="เช่น 100 x 200 ซม. / 500 กรัม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">เรื่องราวสินค้า (story):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.story || ''}
                        onChange={e => handleUpdateSpec('story', e.target.value)}
                        placeholder="เรื่องราวภูมิปัญญาชาวบ้าน"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีการผลิต (production_method):</label>
                      <textarea
                        rows={2}
                        value={formData.product.specs?.production_method || ''}
                        onChange={e => handleUpdateSpec('production_method', e.target.value)}
                        placeholder="เช่น ทอมือโบราณ ย้อมสีธรรมชาติ"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีดูแลรักษา (care_instruction):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.care_instruction || ''}
                        onChange={e => handleUpdateSpec('care_instruction', e.target.value)}
                        placeholder="เช่น ซักมือด้วยน้ำยาซักผ้าไหม"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1">ข้อควรระวัง (warning):</label>
                      <input
                        type="text"
                        value={formData.product.specs?.warning || ''}
                        onChange={e => handleUpdateSpec('warning', e.target.value)}
                        placeholder="เช่น ควรเก็บในที่แห้งพ้นแสงแดด"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Fields for AGRICULTURE */}
                {effectiveCategory === 'AGRICULTURE' && (
                  <div className="space-y-5">
                    {/* Section 1: ข้อมูลพืช & เมล็ดพันธุ์ */}
                    <div className="bg-slate-50 dark:bg-[#14141A] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">🌱 ข้อมูลพืช & เมล็ดพันธุ์ (Plant & Seed Basics)</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">หมวดย่อย (subcategory):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.subcategory || ''}
                            onChange={e => handleUpdateSpec('subcategory', e.target.value)}
                            placeholder="เช่น เมล็ดพันธุ์ผัก / ปุ๋ยชีวภาพ"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">สายพันธุ์ / พันธุ์ (variety):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.variety || ''}
                            onChange={e => handleUpdateSpec('variety', e.target.value)}
                            placeholder="เช่น พริกขี้หนูสวนจินดา F1"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ชนิดพืช (species / plant_type):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.species || formData.product.specs?.plant_type || ''}
                            onChange={e => handleUpdateSpec('species', e.target.value)}
                            placeholder="เช่น พริก, ทุเรียน, นาข้าว"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">แบรนด์ / ยี่ห้อ (brand):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.brand || ''}
                            onChange={e => handleUpdateSpec('brand', e.target.value)}
                            placeholder="เช่น GreenFarm Growth+"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">แหล่งที่มา (origin):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.origin || ''}
                            onChange={e => handleUpdateSpec('origin', e.target.value)}
                            placeholder="เช่น นำเข้าจากเนเธอร์แลนด์"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">จำนวนเมล็ด / ปริมาณ (seed_quantity):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.seed_quantity || ''}
                            onChange={e => handleUpdateSpec('seed_quantity', e.target.value)}
                            placeholder="เช่น 500 เมล็ด / 1,000 มล."
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: การเพาะ & การปลูก */}
                    <div className="bg-slate-50 dark:bg-[#14141A] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">🌾 การเพาะ & การปลูก (Germination & Planting)</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ฤดูที่เหมาะสำหรับปลูก (planting_season):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.planting_season || ''}
                            onChange={e => handleUpdateSpec('planting_season', e.target.value)}
                            placeholder="เช่น ปลูกได้ตลอดทั้งปี / ต้นฤดูฝน"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ระยะเวลาเพาะงอก (germination_days):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.germination_days || ''}
                            onChange={e => handleUpdateSpec('germination_days', e.target.value)}
                            placeholder="เช่น 3 - 5 วัน"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">อัตราการงอก (germination_rate):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.germination_rate || ''}
                            onChange={e => handleUpdateSpec('germination_rate', e.target.value)}
                            placeholder="เช่น 85% - 90%"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีการปลูก (planting_method):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.planting_method || ''}
                            onChange={e => handleUpdateSpec('planting_method', e.target.value)}
                            placeholder="เช่น เพาะถาดก่อนย้ายปลูกลงแปลง"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ระยะห่างในการปลูก (plant_spacing):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.plant_spacing || ''}
                            onChange={e => handleUpdateSpec('plant_spacing', e.target.value)}
                            placeholder="เช่น 50 x 50 ซม."
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ประเภทดิน / วัสดุปลูก (soil_type):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.soil_type || ''}
                            onChange={e => handleUpdateSpec('soil_type', e.target.value)}
                            placeholder="เช่น ดินร่วนปนทราย ระบายน้ำดี"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 3: แสง อุณหภูมิ & การรดน้ำ */}
                    <div className="bg-slate-50 dark:bg-[#14141A] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400 block">☀️ แสง อุณหภูมิ & การรดน้ำ (Light & Water)</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ความต้องการแสง (sunlight_requirement):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.sunlight_requirement || formData.product.specs?.sunlight || ''}
                            onChange={e => handleUpdateSpec('sunlight_requirement', e.target.value)}
                            placeholder="เช่น แดดจัดเต็มวัน 6-8 ชั่วโมง"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">อุณหภูมิที่เหมาะสม (suitable_temperature):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.suitable_temperature || ''}
                            onChange={e => handleUpdateSpec('suitable_temperature', e.target.value)}
                            placeholder="เช่น 25°C - 35°C"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">การรดน้ำ & ความถี่ (watering_method):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.watering_method || formData.product.specs?.watering || ''}
                            onChange={e => handleUpdateSpec('watering_method', e.target.value)}
                            placeholder="เช่น รดน้ำวันละ 1-2 ครั้ง เช้า-เย็น"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 4: ปุ๋ย & คำแนะนำการใช้งาน */}
                    <div className="bg-slate-50 dark:bg-[#14141A] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block">🧪 ปุ๋ย อัตราการใช้ & ประโยชน์ (Fertilizer & Usage)</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีใช้งาน / อัตราใช้ (usage_instructions):</label>
                          <textarea
                            rows={2}
                            value={formData.product.specs?.usage_instructions || ''}
                            onChange={e => handleUpdateSpec('usage_instructions', e.target.value)}
                            placeholder="เช่น ผสม 20-30 ซีซี ต่อน้ำ 20 ลิตร ฉีดพ่นทางใบช่วงเช้า"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ประโยชน์และผลลัพธ์ (benefits):</label>
                          <textarea
                            rows={2}
                            value={formData.product.specs?.benefits || ''}
                            onChange={e => handleUpdateSpec('benefits', e.target.value)}
                            placeholder="เช่น เร่งราก แตกกอ ใบเขียวเข้ม เพิ่มน้ำหนักผลผลิต"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 5: การเก็บเกี่ยว & การดูแลรักษา */}
                    <div className="bg-slate-50 dark:bg-[#14141A] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3">
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">📦 ผลผลิต การเก็บเกี่ยว & ข้อควรระวัง (Harvest & Care)</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ระยะเวลาเก็บเกี่ยว (harvest_days / harvest_time):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.harvest_time || formData.product.specs?.harvest_days || ''}
                            onChange={e => handleUpdateSpec('harvest_time', e.target.value)}
                            placeholder="เช่น 60 - 75 วัน หลังย้ายปลูก"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">ผลผลิตคาดการณ์ (expected_yield):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.expected_yield || ''}
                            onChange={e => handleUpdateSpec('expected_yield', e.target.value)}
                            placeholder="เช่น 2 - 3 ตัน / ไร่"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium block mb-1">วิธีเก็บรักษา (storage_method):</label>
                          <input
                            type="text"
                            value={formData.product.specs?.storage_method || ''}
                            onChange={e => handleUpdateSpec('storage_method', e.target.value)}
                            placeholder="เช่น เก็บในที่แห้งเย็น พ้นแสงแดด"
                            className="w-full bg-white dark:bg-[#181820] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs focus:border-indigo-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* TAB 6: PROMOTION TIERS */}
          {activeSubTab === 'product_promos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    แพ็กเกจโปรโมชั่นของสินค้านี้ (Promotion Packages)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    กำหนดราคาโปรโมชั่น จำนวนชิ้น และของแถม AI จะนำไปปิดการขายอัตโนมัติ
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddPromotion}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มแพ็กเกจโปร</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.product.promotions || []).map((promo, idx) => (
                  <div
                    key={promo.id}
                    className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-300 flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        {promo.name}
                      </span>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={promo.is_popular}
                            onChange={e => handleUpdatePromotion(promo.id, 'is_popular', e.target.checked)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-amber-600 dark:text-amber-400 font-bold">ติดป้ายยอดนิยม ⭐</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleRemovePromotion(promo.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors"
                          title="ลบโปรโมชั่นนี้"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">ชื่อแพ็กเกจ (ตั้งเองได้ AI เข้าใจตามชื่อนี้):</label>
                        <input
                          type="text"
                          value={promo.name}
                          onChange={e => handleUpdatePromotion(promo.id, 'name', e.target.value)}
                          placeholder="เช่น ชุดบูชาคู่บ้าน"
                          className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">จำนวนชิ้น:</label>
                        <input
                          type="number"
                          value={promo.quantity}
                          onChange={e => handleUpdatePromotion(promo.id, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">ราคาขายโปรโมชั่น (บาท):</label>
                        <input
                          type="number"
                          value={promo.price}
                          onChange={e => handleUpdatePromotion(promo.id, 'price', Number(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">ชื่อของแถม (เว้นว่าง = ไม่มีของแถม):</label>
                        <input
                          type="text"
                          value={promo.free_gifts || ''}
                          onChange={e => handleUpdatePromotion(promo.id, 'free_gifts', e.target.value)}
                          placeholder="เช่น เชือกถักคอ + กล่องกำมะหยี่"
                          className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-100 dark:border-zinc-800/60 mt-1">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={promo.free_shipping === true}
                          onChange={e => handleUpdatePromotion(promo.id, 'free_shipping', e.target.checked)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">🚚 ส่งฟรี (ติ๊กเมื่อส่งฟรีจริงเท่านั้น — AI ห้ามบอกส่งฟรีถ้าไม่ได้ติ๊ก)</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-slate-500 dark:text-zinc-400">จำนวนของแถมต่อแพ็ก:</label>
                        <input
                          type="number"
                          min={0}
                          value={promo.gift_quantity ?? 0}
                          onChange={e => handleUpdatePromotion(promo.id, 'gift_quantity', Math.max(0, Number(e.target.value)))}
                          className="w-16 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                        />
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500">(0 = ไม่แถม)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: COD SUMMARY CUSTOMIZER */}
          {activeSubTab === 'cod_summary' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Copy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ปรับแต่งแบบฟอร์มสรุปยอดปิดการขายเก็บเงินปลายทาง (COD Form)
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  เลือกข้อมูลที่ต้องการให้ปรากฏในข้อความสรุปยอดที่ส่งให้ลูกค้าตรวจเช็กก่อนจัดส่ง
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                  {[
                    { key: 'include_header', label: 'หัวข้อสรุปยอด' },
                    { key: 'include_page_name', label: 'ชื่อเพจ' },
                    { key: 'include_customer_name', label: 'ชื่อลูกค้า' },
                    { key: 'include_phone', label: 'เบอร์โทรศัพท์' },
                    { key: 'include_address', label: 'ที่อยู่จัดส่ง' },
                    { key: 'include_items', label: 'รายการสินค้าที่สั่ง' },
                    { key: 'include_shipping_duration', label: 'ระยะเวลาจัดส่ง' },
                    { key: 'include_total_amount', label: 'ยอดเงินที่ต้องชำระปลายทาง' },
                    { key: 'include_shipping_note', label: 'หมายเหตุส่งฟรี' },
                    { key: 'include_inspection_note', label: 'แจ้งเปิดเช็กของก่อนจ่าย' },
                    { key: 'include_closing_blessing', label: 'คำอวยพรปิดท้าย' }
                  ].map(f => (
                    <label
                      key={f.key}
                      className="p-3 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center gap-2.5 cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={(formData.cod_summary_fields as any)?.[f.key] !== false}
                        onChange={e =>
                          setFormData(prev => ({
                            ...prev,
                            cod_summary_fields: {
                              ...prev.cod_summary_fields,
                              [f.key]: e.target.checked
                            } as PageConfig['cod_summary_fields']
                          }))
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-800 dark:text-zinc-200 font-medium">{f.label}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-2">
                  <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                    เทมเพลตข้อความสรุปยอด (Template Variables: {'{customer_name}, {shipping_address}, {phone_number}, {items}, {total_amount}, {shipping_duration}'}):
                  </label>
                  <textarea
                    rows={6}
                    value={formData.cod_summary_template || ''}
                    onChange={e => setFormData(prev => ({ ...prev, cod_summary_template: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-3 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none leading-relaxed"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs text-slate-700 dark:text-zinc-300 font-medium block mb-1.5">
                    ตัวอย่างข้อความที่จะส่งจริง (อัปเดตทันทีเมื่อติ๊กเลือก/เอาหัวข้อออก หรือแก้เทมเพลต):
                  </label>
                  <pre className="whitespace-pre-wrap bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-lg p-3 text-xs text-indigo-900 dark:text-indigo-200 font-mono leading-relaxed">
                    {buildCodSummaryText(formData, {
                      order_id: 'ORD-PREVIEW',
                      customer_name: 'คุณวิชัย วันดี',
                      phone_number: '092-xxx-xxxx',
                      shipping_address: 'ที่อยู่ตัวอย่าง ถ.ลาดกระบัง กรุงเทพฯ 10520',
                      items: `${formData.product?.product_name || 'สินค้า'} 1 ชุด`,
                      total_amount: Number(formData.product?.display_price || 990)
                    })}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: NOTIFICATIONS (TELEGRAM / LINE) */}
          {activeSubTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ส่งสรุปยอดออเดอร์ไป Telegram Bot & LINE Notify
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      เมื่อ AI ปิดการขายและได้ที่อยู่ครบ ระบบจะส่งข้อมูลออเดอร์แจ้งเตือนทันที
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Telegram Box */}
                  <div className="p-4 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                        <Send className="w-4 h-4" /> Telegram Bot
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTestNotification('TELEGRAM')}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-medium transition-colors"
                      >
                        ทดสอบส่ง
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Bot Token:</label>
                      <input
                        type="text"
                        value={formData.telegram_bot_token || ''}
                        onChange={e => setFormData(prev => ({ ...prev, telegram_bot_token: e.target.value }))}
                        placeholder="เช่น 789123456:AAFlk..."
                        className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Chat ID / Group Chat ID:</label>
                      <input
                        type="text"
                        value={formData.telegram_chat_id || ''}
                        onChange={e => setFormData(prev => ({ ...prev, telegram_chat_id: e.target.value }))}
                        placeholder="เช่น -10023456789 หรือ @mychannel"
                        className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* LINE Box */}
                  <div className="p-4 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4" /> LINE Notify / LINE Bot
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTestNotification('LINE')}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium transition-colors"
                      >
                        ทดสอบส่ง
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">LINE Notify Token:</label>
                      <input
                        type="text"
                        value={formData.line_notify_token || ''}
                        onChange={e => setFormData(prev => ({ ...prev, line_notify_token: e.target.value }))}
                        placeholder="เช่น ln_token_amulet_99"
                        className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">ชื่อกลุ่ม LINE / Group ID:</label>
                      <input
                        type="text"
                        value={formData.line_group_id || ''}
                        onChange={e => setFormData(prev => ({ ...prev, line_group_id: e.target.value }))}
                        placeholder="เช่น LINE_AMULET_SALES_ROOM"
                        className="w-full bg-white dark:bg-[#111114] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {testNotificationStatus && (
                  <div className={`p-3 rounded-lg border text-xs font-medium space-y-2 ${testNotificationStatus.ok ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'}`}>
                    <div className="flex items-center gap-2">
                      {testNotificationStatus.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                      <span>{testNotificationStatus.message}</span>
                    </div>
                    {(testNotificationStatus.results || []).length > 0 && (
                      <ul className="pl-5 list-disc space-y-0.5 font-normal">
                        {(testNotificationStatus.results || []).map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    💡 เปิดแอปเลือกปลายทาง: Telegram ให้ทักหาบอทของคุณ 1 ข้อความ แล้วกด "ทดสอบส่ง" ระบบจะหา Chat ID ให้อัตโนมัติ
                  </span>
                  <a
                    href={testNotificationStatus?.deepLinks?.telegram || 'https://t.me/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-[11px] font-medium hover:bg-sky-200 dark:hover:bg-sky-900/60 transition-colors inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> เปิด Telegram
                  </a>
                  <a
                    href="line://"
                    className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-[11px] font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> เปิดแอป LINE
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: FACEBOOK API INTEGRATION */}
          {activeSubTab === 'facebook' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-[#1877F2]" />
                    เชื่อมต่อ Facebook Page จริงของคุณ (Real Integration)
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    ตั้งค่า Facebook Page ID และ Page Access Token เพื่อให้ระบบสามารถรับสาย Webhook และใช้ AI ตอบแชทในเพจจริงได้ทันที
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                        1. Facebook Page ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.page_id || ''}
                        onChange={e => setFormData(prev => ({ ...prev, page_id: e.target.value }))}
                        placeholder="เช่น 1028347823948"
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none"
                      />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-1">
                        *สำคัญมาก: ต้องตรงกับไอดีเพจบน Facebook จริงของคุณ เพื่อให้ระบบแยกแยะกล่องข้อความได้ถูกต้อง
                      </span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                        2. Page Access Token (ตระกูล EAAQ...) *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={formData.page_access_token || ''}
                        onChange={e => setFormData(prev => ({ ...prev, page_access_token: e.target.value }))}
                        placeholder="EAAQ..."
                        className="w-full bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-zinc-100 font-mono focus:border-indigo-500 outline-none leading-relaxed"
                      />
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block mt-1">
                        *รับโทเค็นจาก Meta Developer Portal (สิทธิ์: pages_messaging, pages_read_engagement)
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50/50 dark:bg-zinc-900/50 border border-blue-100 dark:border-zinc-800 rounded-xl space-y-3 text-xs">
                    <h5 className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                      <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      คำแนะนำการตั้งค่า Webhook บน Meta Developers
                    </h5>
                    
                    <div className="space-y-2 text-slate-600 dark:text-zinc-400 leading-relaxed text-[11px]">
                      <p>
                        <strong>ขั้นตอนที่ 1:</strong> ไปที่ <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-semibold">Meta Developers <ExternalLink className="w-3 h-3" /></a> แล้วสร้าง App และเพิ่มผลิตภัณฑ์ Webhook / Messenger
                      </p>
                      <p>
                        <strong>ขั้นตอนที่ 2:</strong> นำข้อมูล Callback URL และ Verify Token ด้านล่างนี้ไปตั้งค่าในช่อง Webhook Setup ของ Facebook App
                      </p>
                      
                      <div className="bg-white dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2 mt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Callback URL:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300 break-all text-[10px] select-all">
                            {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/facebook` : 'https://your-domain.app/api/webhook/facebook'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Verify Token (รหัสตรวจสอบ):</span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[10px] select-all">
                            {formData.verify_token || 'FB_AI_SALES_TOKEN_2026'}
                          </span>
                        </div>
                      </div>

                      <p>
                        <strong>ขั้นตอนที่ 3:</strong> สมัครรับข้อมูล (Subscribe) สำหรับช่อง <strong>messages</strong>, <strong>messaging_postbacks</strong> และ <strong>feed</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 10: BOT SETTINGS - Reply Delay, Bot Control, Rate Limit, Quick Replies, Sales Sequence Auto-Trigger */}
          {activeSubTab === 'bot_settings' && (
            <div className="space-y-6">
              {/* Reply Delay Setting */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ตั้งค่าเวลาตอบกลับ (Reply Delay)
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  กำหนดเวลารอก่อนส่งข้อความตอบกลับ (0 = ตอบทันที, 500 = 0.5 วินาที, 1500 = 1.5 วินาที)
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="5000"
                      step="100"
                      value={formData.reply_delay_ms ?? 1500}
                      onChange={e => setFormData(prev => ({ ...prev, reply_delay_ms: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="30000"
                        step="100"
                        value={formData.reply_delay_ms ?? 0}
                        onChange={e => setFormData(prev => ({ ...prev, reply_delay_ms: Number(e.target.value) }))}
                        className="w-20 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none text-center font-mono"
                      />
                      <span className="text-xs text-slate-500 dark:text-zinc-400">ms</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    <span>0ms (ทันที)</span>
                    <span>1500ms (1.5 วิ)</span>
                    <span>5000ms (5 วิ)</span>
                  </div>
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-lg">
                    <span className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                      ⏱️ ปัจจุบัน: {((formData.reply_delay_ms ?? 0) / 1000)} วินาที
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot Control */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ควบคุมบอท (Bot Control)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      หยุด/เปิดใช้งานบอทตอบข้อความอัตโนมัติ (หรือใช้คำสั่ง /stop, /start ในแชท)
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!formData.bot_stopped}
                      onChange={e => setFormData(prev => ({ ...prev, bot_stopped: !e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                <div className={`p-3 rounded-lg border ${
                  formData.bot_stopped
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                }`}>
                  <span className={`text-xs font-medium ${
                    formData.bot_stopped
                      ? 'text-red-900 dark:text-red-200'
                      : 'text-emerald-900 dark:text-emerald-200'
                  }`}>
                    {formData.bot_stopped
                      ? '⏹️ บอทถูกหยุด - ระบบจะไม่ตอบข้อความอัตโนมัติ'
                      : '▶️ บอทกำลังทำงาน - ระบบจะตอบข้อความอัตโนมัติ'}
                  </span>
                </div>
              </div>

              {/* Rate Limiting */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  จำกัดการตอบกลับ (Rate Limiting)
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  จำกัดจำนวนข้อความตอบกลับต่อลูกค้าต่อชั่วโมง (ป้องกันบอทตอบมากเกินไปหรือตอบมั่ว)
                </p>

                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={formData.rate_limit_per_hour ?? 30}
                      onChange={e => setFormData(prev => ({ ...prev, rate_limit_per_hour: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        step="1"
                        value={formData.rate_limit_per_hour ?? 30}
                        onChange={e => setFormData(prev => ({ ...prev, rate_limit_per_hour: Number(e.target.value) }))}
                        className="w-20 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none text-center font-mono"
                      />
                      <span className="text-xs text-slate-500 dark:text-zinc-400">ครั้ง/ชม.</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    <span>5 ครั้ง/ชม.</span>
                    <span>30 ครั้ง/ชม.</span>
                    <span>100 ครั้ง/ชม.</span>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                    <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      🚫 เมื่อเกิน {formData.rate_limit_per_hour ?? 30} ครั้ง/ชั่วโมง บอทจะหยุดตอบและส่งข้อความแจ้งเตือนลูกค้า
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Reply Buttons */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      ปุ่มลัด Messenger (Quick Reply Buttons)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      ปุ่มลัดที่แสดงให้ลูกค้ากดเมื่อทักเข้ามาครั้งแรก (สูงสุด 13 ปุ่ม)
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                    {(formData.quick_replies || []).length} / 50 ปุ่ม
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-500 mt-1">
                   Facebook Messenger รองรับสูงสุด 13 ปุ่มต่อข้อความ ระบบจะสุ่มเลือก 13 ปุ่มจากทั้งหมดที่ตั้งค่าไว้
                </p>

                <div className="space-y-2">
                  {(formData.quick_replies || []).map((qr, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500 w-6 text-right">#{idx + 1}</span>
                      <input
                        type="text"
                        placeholder="ชื่อปุ่ม (สูงสุด 20 ตัวอักษร)"
                        value={qr.title}
                        onChange={e => {
                          const newReplies = [...(formData.quick_replies || [])];
                          newReplies[idx] = { ...newReplies[idx], title: e.target.value };
                          setFormData(prev => ({ ...prev, quick_replies: newReplies }));
                        }}
                        maxLength={20}
                        className="flex-1 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Payload (ข้อความที่ส่งเมื่อกด)"
                        value={qr.payload}
                        onChange={e => {
                          const newReplies = [...(formData.quick_replies || [])];
                          newReplies[idx] = { ...newReplies[idx], payload: e.target.value };
                          setFormData(prev => ({ ...prev, quick_replies: newReplies }));
                        }}
                        className="flex-1 bg-slate-50 dark:bg-[#16161C] border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-zinc-100 focus:border-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newReplies = (formData.quick_replies || []).filter((_, i) => i !== idx);
                          setFormData(prev => ({ ...prev, quick_replies: newReplies }));
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        title="ลบปุ่มนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {(formData.quick_replies || []).length < 50 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newReplies = [...(formData.quick_replies || []), { title: '', payload: '' }];
                        setFormData(prev => ({ ...prev, quick_replies: newReplies }));
                      }}
                      className="w-full py-2.5 border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 text-slate-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>เพิ่มปุ่มลัด</span>
                    </button>
                  )}
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-lg">
                  <span className="text-xs text-indigo-900 dark:text-indigo-200 font-medium">
                    💡 ตัวอย่าง: "สนใจสินค้า", "ขอดูโปรโมชั่น", "สอบถามราคา", "ติดต่อแอดมิน"
                  </span>
                </div>
              </div>

              {/* Sales Sequence Auto-Trigger */}
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Sales Sequence Auto-Trigger
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      ส่งลำดับการขายทันทีเมื่อลูกค้าทักครั้งแรกหรือพูดว่า "สนใจ"
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.sales_sequence_auto_trigger || false}
                      onChange={e => setFormData(prev => ({ ...prev, sales_sequence_auto_trigger: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className={`p-3 rounded-lg border ${
                  formData.sales_sequence_auto_trigger
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-slate-50 dark:bg-[#16161C] border-slate-200 dark:border-zinc-800'
                }`}>
                  <span className={`text-xs font-medium ${
                    formData.sales_sequence_auto_trigger
                      ? 'text-emerald-900 dark:text-emerald-200'
                      : 'text-slate-700 dark:text-zinc-300'
                  }`}>
                    {formData.sales_sequence_auto_trigger
                      ? '🚀 เปิดใช้งาน - ระบบจะส่ง Sales Sequence ทั้งหมดทันทีเมื่อลูกค้าทักครั้งแรกหรือพูดว่า "สนใจ"'
                      : '⏸️ ปิดใช้งาน - ระบบจะส่ง Sales Sequence ตามขั้นตอนที่ AI กำหนด'}
                  </span>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg">
                  <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                    ⚠️ คำเตือน: การเปิดใช้งานนี้จะส่งข้อความ Sales Sequence ทั้งหมด (6 ขั้นตอน) ติดต่อกัน อาจทำให้ลูกค้ารู้สึกว่ารบกวน
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: CUSTOM CHAT BUTTONS (persisted in DB via /api/buttons) */}
          {activeSubTab === 'chat_buttons' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 shadow-xs">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  จัดการปุ่มแชทของเพจนี้ (บันทึกถาวรในฐานข้อมูล)
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  ปุ่มเหล่านี้ถูกเก็บแยกตามเพจในตาราง custom_buttons และอัปเดตเรียลไทม์ผ่าน SSE —
                  ต่างจาก "ปุ่มลัด Messenger" ในแท็บ 10 ที่เก็บรวมในการตั้งค่าเพจ
                </p>
                <CustomButtonsManager pageId={formData.page_id} theme={currentTheme} />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#121216] border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
            <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>การตั้งค่าจะมีผลทันทีต่อระบบ AI, Webhook, ขนส่ง และระบบสรุปยอด COD</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-semibold transition-colors border border-slate-200 dark:border-zinc-700"
            >
              ยกเลิก
            </button>

            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-md text-white hover:opacity-90 active:scale-95 bg-indigo-600 hover:bg-indigo-700"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>บันทึกสำเร็จเรียบร้อย!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>บันทึกการตั้งค่าเพจนี้</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
