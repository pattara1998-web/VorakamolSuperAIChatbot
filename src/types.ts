export type ProductCategory = 'AMULET' | 'CHINA' | 'OTOP' | 'AGRICULTURE';

export interface CustomSpecItem {
  id: string;
  key: string;
  value: string;
}

export interface PromotionTier {
  id: string;
  name: string; // e.g. "โปรโมชั่น 1 ชิ้น (ชุดทดลอง)" — กำหนดชื่อเองได้ AI จะเข้าใจตามชื่อนี้
  quantity: number;
  price: number;
  original_price?: number;
  free_gifts?: string; // ชื่อ/รายละเอียดของแถม (ข้อความอิสระ)
  gift_quantity?: number; // จำนวนของแถมต่อแพ็กเกจ (0 หรือเว้นว่าง = ไม่มีของแถม)
  free_shipping?: boolean; // ติ๊กเฉพาะเมื่อส่งฟรีจริงเท่านั้น — AI ห้ามบอกส่งฟรีถ้าไม่ได้ติ๊ก
  description: string;
  is_popular?: boolean;
}

export interface SalesSequenceConfig {
  step1_opening_text: string;
  step2_product_image: string;
  step3_promotion_detail: string;
  step4_promotion_image: string;
  step5_review_image: string;
  step6_closing_text: string;
}

export interface SalesSequenceStep {
  id: string;
  step_number: number;
  type: 'TEXT' | 'IMAGE' | 'BOTH';
  title?: string;
  text_content?: string;
  image_url?: string;
  delay_seconds?: number;
}

export interface ProductDetailedSpecs {
  material?: string; // มวลสาร / วัสดุการผลิต
  dimensions?: string; // ขนาด กว้าง x ยาว x หนา
  weight?: string; // น้ำหนัก
  warranty?: string; // การรับประกันสินค้า / ใบรับรอง
  origin_or_temple?: string; // วัดที่จัดสร้าง / แหล่งผลิต
  master_or_maker?: string; // พระเกจิอาจารย์ / ช่างฝีมือ / แบรนด์
  ceremony_or_batch?: string; // พิธีพุทธาภิเษก / รุ่น / ปีที่สร้าง
  authenticity_cert?: string; // เลขที่ใบรับประกันพระแท้ / มาตรฐาน มอก.
  spell_or_instructions?: string; // พระคาถาบูชา / วิธีการใช้งาน
  box_contents?: string; // รายการอุปกรณ์หรือของแถมในกล่อง
  cod_note?: string; // เงื่อนไขเก็บเงินปลายทาง
  shipping_time?: string; // ระยะเวลาจัดส่งด่วน (1-2 วัน)
  shipping_duration?: string; // ระยะเวลาการจัดส่ง (เช่น 1-2 วันถึง, จัดส่งด่วน Flash/Kerry 1-3 วัน)
  care_instruction?: string; // วิธีการเก็บรักษา
  warning?: string; // ข้อควรระวัง

  // Category specific fields
  brand?: string;
  description?: string;
  features?: string;
  size?: string;
  usage?: string;
  benefit?: string;
  shipping_info?: string;
  temple?: string;
  master?: string;
  year?: string;
  edition?: string;
  quantity?: number;
  quantity_created?: string | number; // จำนวนการสร้าง
  history?: string;
  belief_info?: string;
  spell?: string;
  worship_method?: string;
  community?: string;
  province?: string;
  maker?: string;
  origin?: string;
  story?: string;
  production_method?: string;
  formula_or_type?: string;
  suitable_for?: string;
  usage_instructions?: string;
  benefits?: string;
  registration_number?: string;
  package_size?: string;
  safety_warning?: string;
  courier_brand?: string;
  delivery_days?: string;

  // Detailed Agriculture Fields
  subcategory?: string;
  variety?: string;
  species?: string;
  plant_type?: string; // ชนิดพืช
  planting_season?: string;
  planting_method?: string;
  seed_preparation?: string;
  germination_method?: string;
  germination_time?: string;
  germination_days?: string;
  germination_rate?: string; // อัตราการงอกโดยประมาณ
  germination_medium?: string; // วัสดุที่ใช้เพาะ
  germination_steps?: string; // ขั้นตอนการเพาะ
  planting_steps?: string;
  soil_type?: string;
  growing_medium?: string;
  plant_spacing?: string; // ระยะห่างในการปลูก
  pot_size?: string;
  sunlight?: string;
  sunlight_requirement?: string; // ความต้องการแสง
  sunlight_hours?: string; // จำนวนชั่วโมงแสงที่เหมาะสม
  temperature?: string;
  suitable_temperature?: string; // อุณหภูมิที่เหมาะสม
  watering?: string;
  watering_method?: string; // วิธีการรดน้ำ
  watering_frequency?: string;
  watering_volume?: string; // ปริมาณน้ำโดยประมาณ
  suitable_humidity?: string; // ความชื้นที่เหมาะสม
  fertilizer?: string;
  recommended_fertilizer?: string; // ปุ๋ยที่แนะนำ
  fertilizer_formula?: string;
  fertilizer_schedule?: string;
  fertilizer_quantity?: string;
  fertilizer_amount?: string; // ปริมาณปุ๋ย
  fertilizer_method?: string; // วิธีการให้ปุ๋ย
  required_nutrients?: string; // ธาตุอาหารที่ต้องการ
  deficiency_symptoms?: string; // อาการขาดธาตุอาหาร
  spacing?: string;
  growing_time?: string;
  growth_duration?: string; // ระยะเวลาเจริญเติบโต
  harvest_time?: string;
  harvest_days?: string; // ระยะเวลาเก็บเกี่ยว
  harvest_method?: string;
  yield?: string;
  expected_yield?: string; // ผลผลิตโดยประมาณ
  plant_care?: string;
  pruning?: string;
  pruning_method?: string; // วิธีตัดแต่ง
  transplanting_method?: string; // การย้ายปลูก
  propagation_method?: string; // การขยายพันธุ์
  pest_control?: string;
  pests?: string; // แมลงศัตรูพืช
  pest_prevention?: string; // การป้องกันแมลง
  pest_management?: string; // วิธีจัดการแมลง
  disease_control?: string;
  common_diseases?: string; // โรคที่พบบ่อย
  disease_prevention?: string; // การป้องกันโรค
  disease_management?: string; // วิธีจัดการโรค
  common_problems?: string;
  troubleshooting?: string;
  compatibility?: string;
  companion_plants?: string; // พืชที่ปลูกร่วมกันได้
  incompatible_plants?: string; // พืชที่ไม่ควรปลูกร่วมกัน
  storage?: string;
  storage_method?: string; // การเก็บรักษา
  seed_quantity?: string;
  package_quantity?: string; // จำนวนเมล็ด / ปริมาณสินค้า

  custom_specs?: CustomSpecItem[];
}

export interface PageProductConfig {
  product_id: string;
  product_name: string;
  category: string;
  base_price: number;
  display_price: number;
  description: string;
  shipping_duration?: string; // ระยะเวลาจัดส่ง ที่ผู้ใช้กดใส่เอง
  specs?: ProductDetailedSpecs;
  promotions: PromotionTier[];
  images: {
    main: string;
    detail: string;
    promotion: string;
    review: string;
    closing: string;
  };
  // Sequence image/text overrides
  image_main?: string;
  image_detail?: string;
  image_promotion?: string;
  image_review?: string;
  image_closing?: string;
  image_step6?: string;
  opening_text?: string;
  detail_text?: string;
  promotion_text?: string;
  review_text?: string;
  closing_text?: string;
  step6_text?: string;
  // Promo prices
  promo_price_1?: number;
  promo_price_2?: number;
  promo_price_3?: number;
  promo_description?: string;
  attributes?: Record<string, string>; // e.g. temple, master, material, size, weight
}

export interface CodSummaryFieldsConfig {
  include_header: boolean; // หัวข้อ สรุปยอดคำสั่งซื้อ
  include_page_name: boolean; // ชื่อเพจ/ร้านค้า
  include_order_id: boolean; // รหัสคำสั่งซื้อ
  include_customer_name: boolean; // ชื่อ-นามสกุล ผู้รับ
  include_phone: boolean; // เบอร์โทรศัพท์
  include_address: boolean; // ที่อยู่จัดส่งพัสดุ
  include_items: boolean; // รายการสินค้าและจำนวน
  include_shipping_duration: boolean; // ระยะเวลาจัดส่ง (เช่น 1-2 วันถึง)
  include_total_amount: boolean; // ยอดเรียกเก็บเงินปลายทาง
  include_shipping_note: boolean; // หมายเหตุเก็บเงินปลายทาง/พนักงานจะโทรแจ้ง
  include_inspection_note: boolean; // ข้อความตรวจสอบกล่องพัสดุก่อนรับ
  include_closing_blessing: boolean; // ข้อความขอบคุณ / ขอให้เฮงๆรวยๆ
}

export interface PageConfig {
  page_id: string;
  page_name: string;
  category: ProductCategory;
  theme_color?: string; // สีธีมประจำเพจ เช่น #4f46e5 (Indigo), #d97706 (Amber), #059669 (Emerald), #dc2626 (Red), #0284c7 (Sky), #9333ea (Purple)
  page_access_token: string;
  verify_token: string;
  is_active: boolean;
  auto_reply: boolean;
  auto_close_ai: boolean;

  page_avatar?: string;
  page_cover?: string;
  inquiries_count?: number; // จำนวนลูกค้าทักเข้ามา (เปลี่ยนแทน ผู้ติดตาม)
  follower_count?: number;
  likes_count?: number;
  unread_messages?: number;

  // Notification target & credentials (LINE / Telegram)
  notification_channel?: 'LINE' | 'TELEGRAM' | 'BOTH';
  line_notify_token?: string;
  line_group_id?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;

  google_sheet_url?: string;

  // Page tag for organization in Pages Hub:
  // 'NORMAL' = ใช้งานปกติ, 'EMPTY' = เพจว่าง, 'RETIRED' = เพจไม่ได้ใช้แล้ว
  page_tag?: 'NORMAL' | 'EMPTY' | 'RETIRED';

  // AI Model & Persona settings
  ai_model: string; // e.g. 'gemini-3.6-flash', 'gemini-3.7-flash', 'ollama:<model>', 'lmstudio:<model>'
  admin_name: string; // e.g. 'แอดมินน้ำผึ้ง', 'แอดมินปลา'
  ai_tone: 'FRIENDLY' | 'PROFESSIONAL' | 'SACRED' | 'FAST_CLOSING';
  ai_custom_instructions: string;
  ai_brevity_mode: boolean;

  // 1 Page = 1 Product with Multi-tier promotions & comprehensive specs
  product: PageProductConfig;

  // 6-Step Pattern Sequence
  sequence: SalesSequenceConfig;
  sales_sequence_steps?: SalesSequenceStep[];

  // Comment Scraper, Moderation & Auto-Reply with up to 6 images & customer tag
  scrape_comments_enabled: boolean;
  auto_inbox_with_comment_context: boolean;
  hide_toxic_comments: boolean;
  toxic_keywords: string[];
  purchase_keywords: string[];
  comment_reply_template?: string; // ข้อความตอบกลับคอมเมนต์ เช่น "สวัสดีค่ะคุณ @customer_name {text}"
  comment_reply_images?: string[]; // รูปภาพตอบกลับคอมเมนต์สูงสุด 6 รูป
  comment_auto_tag_customer?: boolean; // แท็กชื่อลูกค้าอัตโนมัติ

  // Follow-up settings (Customizable intervals: 5 นาที, 30 นาที, 21:00 น., etc.)
  followup_enabled: boolean;
  followup_messages: {
    interval: string;
    message: string;
  }[];

  // Reply delay (ms) — per-page configurable. 0 = instant, 500 = 0.5s, 1500 = 1.5s
  reply_delay_ms?: number;

  // Bot control: /stop command pauses auto-reply for this page
  bot_stopped?: boolean;

  // Rate limiting: max replies per sender per hour (prevents spam/nonsense)
  rate_limit_per_hour?: number; // default 30

  // Messenger Quick Reply buttons (3-4 buttons shown to customer on first message)
  quick_replies?: {
    title: string;    // Button label (max 20 chars)
    payload: string;  // Payload sent when tapped
  }[];

  // Sales Sequence auto-trigger: fire immediately on first message or "สนใจ"
  sales_sequence_auto_trigger?: boolean;

  // COD Order Summary Format & Selected Fields
  cod_summary_template?: string;
  cod_summary_fields?: CodSummaryFieldsConfig;
}

export interface EmergencyAlert {
  id: string;
  timestamp: string;
  type: 'PAGE_DISCONNECTED' | 'SYSTEM_OUTAGE' | 'LEGAL_THREAT' | 'SAKOB_POLICE_THREAT' | 'SEVERE_COMPLAINT';
  severity: 'HIGH' | 'CRITICAL';
  source: 'WEBHOOK' | 'CHAT_SENTINEL' | 'COMMENT' | 'SYSTEM_MONITOR';
  page_id: string;
  sender_id?: string;
  customer_name?: string;
  phone_number?: string;
  threat_text: string;
  detected_keywords: string[];
  is_resolved: boolean;
  notified_channels: ('LINE' | 'TELEGRAM')[];
}

export interface ProductAmulet {
  product_id: string;
  page_id: string;
  product_name: string;
  category: string;
  temple: string;
  master: string;
  year: string;
  edition: string;
  material: string;
  quantity: number;
  history: string;
  belief_info: string;
  spell: string;
  worship_method: string;
  care_instruction: string;
  warning: string;
  display_price: number;
  price_1: number;
  price_2: number;
  price_3: number;
  promotion_detail: string;
  shipping_duration?: string;
  image_main: string;
  image_detail: string;
  image_promotion: string;
  image_review: string;
  image_closing: string;
  opening_text: string;
  detail_text: string;
  promotion_text: string;
  review_text: string;
  closing_text: string;
  custom_specs?: CustomSpecItem[];
}

export interface ProductChina {
  product_id: string;
  page_id: string;
  product_name: string;
  brand: string;
  category: string;
  description: string;
  features: string;
  material: string;
  size: string;
  weight: string;
  usage: string;
  benefit: string;
  shipping_info: string;
  display_price: number;
  price_1: number;
  price_2: number;
  price_3: number;
  promotion_detail: string;
  shipping_duration?: string;
  image_main: string;
  image_detail: string;
  image_promotion: string;
  image_review: string;
  image_closing: string;
  opening_text: string;
  detail_text: string;
  promotion_text: string;
  review_text: string;
  closing_text: string;
  custom_specs?: CustomSpecItem[];
}

export interface ProductOtop {
  product_id: string;
  page_id: string;
  product_name: string;
  category: string;
  community: string;
  province: string;
  maker: string;
  origin: string;
  story: string;
  production_method: string;
  material: string;
  size: string;
  weight: string;
  usage: string;
  benefit: string;
  care_instruction: string;
  warning: string;
  display_price: number;
  price_1: number;
  price_2: number;
  price_3: number;
  promotion_detail: string;
  shipping_duration?: string;
  image_main: string;
  image_detail: string;
  image_promotion: string;
  image_review: string;
  image_closing: string;
  opening_text: string;
  detail_text: string;
  promotion_text: string;
  review_text: string;
  closing_text: string;
  custom_specs?: CustomSpecItem[];
}

export interface ProductAgriculture {
  product_id: string;
  page_id: string;
  product_name: string;
  category: string;
  subcategory?: string;
  variety?: string;
  species?: string;
  description?: string;
  brand?: string;
  origin?: string;
  planting_season?: string;
  planting_method?: string;
  seed_preparation?: string;
  germination_method?: string;
  germination_time?: string;
  planting_steps?: string;
  soil_type?: string;
  growing_medium?: string;
  sunlight?: string;
  temperature?: string;
  watering?: string;
  watering_frequency?: string;
  fertilizer?: string;
  fertilizer_formula?: string;
  fertilizer_schedule?: string;
  fertilizer_quantity?: string;
  spacing?: string;
  pot_size?: string;
  growing_time?: string;
  harvest_time?: string;
  harvest_method?: string;
  yield?: string;
  plant_care?: string;
  pruning?: string;
  pest_control?: string;
  disease_control?: string;
  common_problems?: string;
  troubleshooting?: string;
  compatibility?: string;
  usage?: string;
  benefit?: string;
  warning?: string;
  storage?: string;
  seed_quantity?: string;
  size?: string;
  weight?: string;
  germination_rate?: string;
  germination_days?: string;
  plant_spacing?: string;
  sunlight_requirement?: string;
  suitable_temperature?: string;
  watering_method?: string;
  expected_yield?: string;
  storage_method?: string;
  formula_or_type?: string;
  suitable_for?: string;
  usage_instructions?: string;
  benefits?: string;
  germination_medium?: string;
  germination_steps?: string;
  sunlight_hours?: string;
  watering_amount?: string;
  humidity?: string;
  fertilizer_amount?: string;
  fertilizer_method?: string;
  nutrient_requirement?: string;
  nutrient_deficiency?: string;
  transplanting?: string;
  propagation?: string;
  pests?: string;
  pest_prevention?: string;
  diseases?: string;
  disease_prevention?: string;
  companion_plants?: string;
  combative_plants?: string;
  registration_number?: string;
  package_size?: string;
  safety_warning?: string;
  display_price: number;
  price_1: number;
  price_2: number;
  price_3: number;
  promotion_detail: string;
  shipping_duration?: string;
  image_main: string;
  image_detail: string;
  image_promotion: string;
  image_review: string;
  image_closing: string;
  opening_text: string;
  detail_text: string;
  promotion_text: string;
  review_text: string;
  closing_text: string;
  custom_specs?: CustomSpecItem[];
}

export type AnyProduct = (ProductAmulet | ProductChina | ProductOtop | ProductAgriculture) & {
  category_type?: ProductCategory;
};

export interface Order {
  order_id: string;
  psid: string;
  customer_name: string;
  phone_number: string;
  shipping_address: string;
  items: string; // product_id or description
  quantity?: number;
  total_amount: number;
  payment_status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  created_at: string;
  tracking_number: string;
  page_id?: string;
  category?: ProductCategory | string;
  notes?: string;
}

export interface Customer {
  psid: string;
  customer_name: string;
  phone_number: string;
  address: string;
  category_preference?: string; // AMULET, CHINA, OTOP, AGRICULTURE
  total_spent?: number; // ยอดสั่งซื้อสะสม
  total_items_count?: number; // จำนวนชิ้นสะสม
  tier?: 'NORMAL' | 'SILVER' | 'GOLD' | 'VIP' | 'SUPER_VIP';
  first_interaction: string;
  last_interaction: string;
  last_order_date?: string;
  last_order_items?: string;
  last_tracking_number?: string;
  status: 'NEW_CUSTOMER' | 'OLD_CUSTOMER' | 'ORDER_COMPLETED' | 'INTERESTED' | 'FOLLOW_UP_SENT';
  notes: string;
  order_count: number;
  last_product_id?: string;
  source_comment?: string; // Attached comment context
  page_id?: string;
  tags?: string[];
  telesales_status?: 'NOT_CONTACTED' | 'CALLED_INTERESTED' | 'CALLED_BUSY' | 'CALLED_REJECTED' | 'ORDER_MADE';
  telesales_note?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'MESSAGE' | 'COMMENT' | 'ORDER' | 'LINE_ALERT' | 'FOLLOW_UP' | 'AI_REPLY' | 'COMMENT_HIDDEN' | 'INFO' | 'SYSTEM';
  sender_id: string;
  page_id: string;
  content: string;
  status: 'SUCCESS' | 'WARNING' | 'INFO' | 'ERROR';
  details?: Record<string, any>;
}

export interface IntentResult {
  intent: 'QUESTION' | 'ORDER' | 'GREETING' | 'FOLLOW_UP' | 'UNCLEAR';
  confidence: number;
  extractedOrder?: {
    customer_name?: string;
    phone_number?: string;
    address?: string;
    product_id?: string;
    quantity?: number;
    price?: number;
    total_amount?: number;
  };
  replyText?: string;
  sequenceStep?: number;
}

