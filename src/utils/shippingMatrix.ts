/**
 * Shipping Matrix — single source of truth for courier brand / delivery duration.
 *
 * Why this file exists:
 *   The "🚚 ตัวเลือกแบรนด์ขนส่ง & ระยะเวลาจัดส่ง (Shipping Matrix)" panel lives in
 *   PageSettingsModal (TAB 5) while the same data is edited from the product
 *   database menu (ProductTemplateModal). Both used to build the
 *   `shipping_duration` string independently, so the two screens disagreed
 *   ("Shipping Matrix ไม่ตรงกับเมนูฐานข้อมูลสินค้า"). Everything now goes through
 *   these helpers so the value is byte-identical on both sides.
 */

export const DEFAULT_COURIER_BRAND = 'Flash Express';
export const DEFAULT_DELIVERY_DAYS = '1-3 วัน';

/** แบรนด์ขนส่งที่ระบบรองรับ (ต้องตรงกับ PageSettingsModal TAB 5) */
export const COURIER_OPTIONS: Array<{ value: string; label: string; hint?: string }> = [
  { value: 'Flash Express', label: 'Flash Express', hint: 'ทั่วประเทศ 1-3 วัน' },
  { value: 'J&T Express', label: 'J&T Express', hint: 'ทั่วประเทศ 1-3 วัน' },
  { value: 'ไปรษณีย์ไทย (EMS)', label: 'ไปรษณีย์ไทย (EMS)', hint: 'มีเลขติดตามพัสดุ' },
  { value: 'Kerry Express', label: 'Kerry Express', hint: 'ทั่วประเทศ 1-3 วัน' }
];

/** ระยะเวลาจัดส่งมาตรฐาน (ต้องตรงกับ PageSettingsModal TAB 5) */
export const DELIVERY_DAYS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1-3 วัน', label: '1-3 วันทำการ' },
  { value: '2-4 วัน', label: '2-4 วันทำการ' },
  { value: '3-5 วัน', label: '3-5 วันทำการ' }
];

/**
 * สร้างข้อความ "ระยะเวลาจัดส่ง" มาตรฐานจากแบรนด์ขนส่ง + จำนวนวัน
 * ใช้ร่วมกันทั้ง PageSettingsModal และ ProductTemplateModal
 */
export function buildShippingDuration(brand: string, days: string): string {
  const b = String(brand || DEFAULT_COURIER_BRAND).trim();
  const d = String(days || DEFAULT_DELIVERY_DAYS).trim();
  return `จัดส่งโดย ${b} ถึงภายใน ${d} ทำการ (มีบริการเก็บเงินปลายทาง COD)`;
}

/**
 * เดาค่าแบรนด์ขนส่ง + ระยะเวลาจัดส่งกลับจากข้อความ shipping_duration เดิม
 * (สำหรับข้อมูลเก่าที่บันทึกไว้ก่อนมี Shipping Matrix)
 */
export function parseShippingDuration(text: string | undefined | null): {
  courier_brand: string;
  delivery_days: string;
} {
  const raw = String(text || '').trim();
  if (!raw) return { courier_brand: DEFAULT_COURIER_BRAND, delivery_days: DEFAULT_DELIVERY_DAYS };

  const brandMatch = COURIER_OPTIONS.find(c => raw.includes(c.value));
  const daysMatch = DELIVERY_DAYS_OPTIONS.find(d => raw.includes(d.value));

  // Fallback: ดึงตัวเลขช่วงวันจากข้อความอิสระ เช่น "จัดส่งด่วน 1-2 วันทำการ"
  const rangeMatch = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s*วัน/.exec(raw);
  const days = daysMatch?.value || (rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]} วัน` : DEFAULT_DELIVERY_DAYS);

  return {
    courier_brand: brandMatch?.value || DEFAULT_COURIER_BRAND,
    delivery_days: days
  };
}

/**
 * รวมค่า Shipping Matrix จากหลายแหล่ง โดยไม่ยอมให้ค่าว่างทับค่าที่มีอยู่
 * ลำดับความสำคัญ: ค่าจากหน้าเพจ (ใหม่สุด) → ค่าจากฐานข้อมูลสินค้า → ค่าเดิม
 */
export function mergeShippingFields(
  primary: { courier_brand?: string; delivery_days?: string; shipping_duration?: string } | undefined | null,
  fallback: { courier_brand?: string; delivery_days?: string; shipping_duration?: string } | undefined | null
): { courier_brand: string; delivery_days: string; shipping_duration: string } {
  const pick = (a?: string, b?: string) => (String(a || '').trim() ? String(a).trim() : String(b || '').trim());

  const courierBrand = pick(primary?.courier_brand, fallback?.courier_brand) || DEFAULT_COURIER_BRAND;
  const deliveryDays = pick(primary?.delivery_days, fallback?.delivery_days) || DEFAULT_DELIVERY_DAYS;
  const shippingDuration = pick(primary?.shipping_duration, fallback?.shipping_duration)
    || buildShippingDuration(courierBrand, deliveryDays);

  return { courier_brand: courierBrand, delivery_days: deliveryDays, shipping_duration: shippingDuration };
}

/**
 * ทำให้ค่า Shipping Matrix สอดคล้องกันเสมอ (ใช้ตอนเปิดหน้าจอตั้งค่า)
 *
 * - ถ้าข้อความเดิมเป็นรูปแบบที่ระบบสร้าง ("จัดส่งโดย ...") หรือว่างเปล่า
 *   → สร้างใหม่จากแบรนด์/ระยะเวลาที่เลือก เพื่อให้หน้าเพจกับฐานข้อมูลสินค้าตรงกัน
 * - ถ้าผู้ใช้พิมพ์ข้อความอิสระไว้เอง → คงข้อความนั้นไว้ แล้วเดาแบรนด์/ระยะเวลากลับมา
 *   เพื่อแสดงตัวเลือกให้ตรง (ไม่ทำลายข้อมูลเดิม)
 */
export function normalizeShippingFields(
  primary: { courier_brand?: string; delivery_days?: string; shipping_duration?: string } | undefined | null,
  fallback: { courier_brand?: string; delivery_days?: string; shipping_duration?: string } | undefined | null
): { courier_brand: string; delivery_days: string; shipping_duration: string } {
  const merged = mergeShippingFields(primary, fallback);
  const parsed = parseShippingDuration(merged.shipping_duration);

  const courierBrand = COURIER_OPTIONS.some(c => c.value === merged.courier_brand)
    ? merged.courier_brand
    : parsed.courier_brand;
  const deliveryDays = DELIVERY_DAYS_OPTIONS.some(d => d.value === merged.delivery_days)
    ? merged.delivery_days
    : parsed.delivery_days;

  const isSystemGenerated = !merged.shipping_duration || merged.shipping_duration.startsWith('จัดส่งโดย');

  return {
    courier_brand: courierBrand,
    delivery_days: deliveryDays,
    shipping_duration: isSystemGenerated
      ? buildShippingDuration(courierBrand, deliveryDays)
      : merged.shipping_duration
  };
}
