import { ProductCategory } from '../types';

export interface ParsedSpecResult {
  product_name?: string;
  category?: string;
  brand?: string;
  description?: string;
  features?: string;
  material?: string;
  size?: string;
  weight?: string;
  usage?: string;
  benefit?: string;
  shipping_info?: string;
  // AMULET
  temple?: string;
  master?: string;
  year?: string;
  edition?: string;
  quantity?: number;
  history?: string;
  belief_info?: string;
  spell?: string;
  worship_method?: string;
  care_instruction?: string;
  warning?: string;
  // OTOP
  community?: string;
  province?: string;
  maker?: string;
  origin?: string;
  story?: string;
  production_method?: string;
  // AGRICULTURE
  subcategory?: string;
  variety?: string;
  species?: string;
  seed_quantity?: string;
  planting_season?: string;
  planting_method?: string;
  soil_type?: string;
  sunlight?: string;
  watering?: string;
  harvest_time?: string;
  usage_instructions?: string;
  benefits?: string;
}

/**
 * AI Auto-Key Smart Parser
 * Extracts structured product parameters from long-form text/spec paste.
 */
export function parseTextToSpecs(rawText: string, category: ProductCategory): ParsedSpecResult {
  if (!rawText || !rawText.trim()) return {};

  const result: ParsedSpecResult = {};
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // Helper regex search
  const findValue = (keywords: string[]): string | undefined => {
    for (const line of lines) {
      for (const kw of keywords) {
        // match "Keyword: value" or "Keyword - value" or "Keyword value"
        const regex = new RegExp(`^(?:${kw})\\s*[:=\\-\\s]+\\s*(.+)`, 'i');
        const match = line.match(regex);
        if (match && match[1]?.trim()) {
          return match[1].trim();
        }
      }
    }
    return undefined;
  };

  // Product Name (Look for header or first non-colon line)
  const nameFromKeyword = findValue(['ชื่อสินค้า', 'ชื่อวัตถุมงคล', 'ชื่อรายการ', 'ชื่อพืช', 'สินค้า', 'ชื่อ']);
  if (nameFromKeyword) {
    result.product_name = nameFromKeyword;
  } else if (lines.length > 0 && !lines[0].includes(':')) {
    result.product_name = lines[0].slice(0, 100);
  }

  // Common fields
  result.brand = findValue(['แบรนด์', 'ยี่ห้อ', 'Brand', 'brand']);
  result.category = findValue(['หมวดหมู่', 'หมวด', 'Category']);
  result.material = findValue(['วัสดุ', 'เนื้อวัสดุ', 'เนื้อ', 'ส่วนประกอบ', 'ทำจาก']);
  result.size = findValue(['ขนาด', 'มิติ', 'ความกว้าง', 'ความยาว', 'ความสูง', 'ขนาดบรรจุ']);
  result.weight = findValue(['น้ำหนัก', 'Weight', 'น้ำหนักรวม']);
  result.shipping_info = findValue(['การจัดส่ง', 'ข้อมูลจัดส่ง', 'จัดส่ง']);

  // Category specific matching
  if (category === 'AMULET') {
    result.temple = findValue(['วัด', 'สำนัก', 'วัด/สำนัก', 'อาราม']);
    result.master = findValue(['พระเกจิ', 'ผู้สร้าง', 'หลวงพ่อ', 'หลวงปู่', 'พระอาจารย์', 'อาจารย์', 'ปลุกเสกโดย']);
    result.year = findValue(['ปีที่สร้าง', 'ปี', 'พ.ศ.', 'สร้างปี']);
    result.edition = findValue(['รุ่น', 'พิมพ์', 'รุ่น/พิมพ์', 'ชื่อรุ่น']);
    
    const qtyStr = findValue(['จำนวนสร้าง', 'จำนวนการสร้าง', 'จำนวนผลิต', 'จำนวน']);
    if (qtyStr) {
      const parsedQty = parseInt(qtyStr.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedQty)) result.quantity = parsedQty;
    }

    result.belief_info = findValue(['พุทธคุณ', 'ข้อมูลความเชื่อ', 'ความเชื่อ', 'เน้นทาง']);
    result.spell = findValue(['คาถา', 'บทสวด', 'คาถาบูชา', 'บทสวดมนต์']);
    result.worship_method = findValue(['วิธีบูชา', 'การบูชา']);
    result.care_instruction = findValue(['วิธีดูแลรักษา', 'การเก็บรักษา', 'วิธีรักษา']);
    result.warning = findValue(['ข้อควรระวัง', 'คำเตือน']);
    result.history = findValue(['ประวัติ', 'ความเป็นมา', 'ประวัติการสร้าง']);
  } else if (category === 'OTOP') {
    result.community = findValue(['ชุมชน', 'กลุ่มผู้ผลิต', 'กลุ่มวิสาหกิจ', 'วิสาหกิจชุมชน']);
    result.province = findValue(['จังหวัด', 'จ.', 'จังหวัดผู้ผลิต']);
    result.maker = findValue(['ผู้ผลิต', 'ผู้ประกอบการ', 'ทำโดย']);
    result.origin = findValue(['แหล่งที่มา', 'ต้นกำเนิด']);
    result.story = findValue(['เรื่องราวสินค้า', 'สตอรี่', 'ภูมิปัญญา', 'เรื่องราว']);
    result.production_method = findValue(['วิธีการผลิต', 'กรรมวิธี', 'ขั้นตอนผลิต']);
  } else if (category === 'AGRICULTURE') {
    result.subcategory = findValue(['หมวดย่อย', 'ประเภทสินค้า', 'ประเภทพืช']);
    result.variety = findValue(['สายพันธุ์', 'พันธุ์', 'ชื่อพันธุ์']);
    result.species = findValue(['ชนิดพืช', 'ชนิด']);
    result.seed_quantity = findValue(['จำนวนเมล็ด', 'ปริมาณบรรจุ', 'ปริมาณ']);
    result.planting_season = findValue(['ฤดูที่เหมาะสำหรับปลูก', 'ฤดูปลูก', 'ช่วงเวลาปลูก']);
    result.planting_method = findValue(['วิธีการปลูก', 'วิธีปลูก', 'การเพาะเมล็ด']);
    result.soil_type = findValue(['ประเภทดิน', 'ดินที่เหมาะสม']);
    result.sunlight = findValue(['ความต้องการแสง', 'แสงแดด', 'แสง']);
    result.watering = findValue(['การรดน้ำ', 'ความถี่รดน้ำ', 'การให้น้ำ']);
    result.harvest_time = findValue(['ระยะเวลาเก็บเกี่ยว', 'อายุเก็บเกี่ยว']);
    result.usage_instructions = findValue(['วิธีใช้งาน', 'อัตราใช้', 'วิธีใช้']);
    result.benefits = findValue(['ประโยชน์และผลลัพธ์', 'ประโยชน์', 'ผลลัพธ์']);
  }

  // Generic fallback matching for description & features if missing
  const descVal = findValue(['รายละเอียดสินค้า', 'รายละเอียด', 'ข้อมูลเพิ่มเติม', 'Description']);
  if (descVal) {
    result.description = descVal;
  } else {
    // Collect non-matched lines for description
    const summaryText = lines.filter(l => !l.includes(':')).join('\n');
    if (summaryText) result.description = summaryText.slice(0, 500);
  }

  const featVal = findValue(['คุณสมบัติ', 'จุดเด่น', 'คุณสมบัติเด่น', 'Features']);
  if (featVal) result.features = featVal;

  const benVal = findValue(['ประโยชน์', 'จุดเด่น/ประโยชน์', 'Benefits']);
  if (benVal) result.benefit = benVal;

  const useVal = findValue(['วิธีใช้งาน', 'วิธีใช้', 'ขั้นตอนการใช้']);
  if (useVal) result.usage = useVal;

  return result;
}
