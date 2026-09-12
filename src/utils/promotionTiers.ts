import type { PromotionTier } from '../types';

/**
 * Promotion Packages — single source of truth for promotion tiers.
 *
 * Why this file exists:
 *   "แพ็กเกจโปรโมชั่นของสินค้านี้ (Promotion Packages)" is edited in two places
 *   (PageSettingsModal TAB 6 and the product database menu / ProductTemplateModal)
 *   and is persisted in three shapes:
 *     - `page.product.promotions`  → PromotionTier[] (rich: name/free_shipping/gifts)
 *     - `catalogRow.promotions`    → PromotionTier[] or JSON string (Postgres TEXT column)
 *     - `catalogRow.price_1/2/3`   → legacy bare price columns
 *   Each screen used to convert between those shapes on its own, so tiers kept
 *   disappearing (the AI then only saw 3 bare prices and invented promotions).
 *   Everything now goes through these helpers.
 */

/** แปลงค่า promotions ที่อาจเป็น array หรือ JSON string (จากคอลัมน์ TEXT ของ Postgres) ให้เป็น array */
export function parsePromotionTiers(raw: any): PromotionTier[] {
  if (Array.isArray(raw)) return raw as PromotionTier[];
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PromotionTier[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** tier ที่ไม่มีการตั้งราคาเลยถือเป็น tier เปล่า — ห้ามส่งต่อให้ AI */
function isUsableTier(tier: any): boolean {
  return !!tier && (Number(tier.price) > 0 || Number(tier.quantity) > 0 || !!String(tier.name || '').trim());
}

/**
 * สร้าง tier มาตรฐาน 3 ระดับจากคอลัมน์ราคาแบบเก่า (price_1/2/3)
 * คืนค่า [] เมื่อไม่มีราคาจริงเลย เพื่อไม่ให้ระบบสร้างโปรโมชั่นปลอมราคา ฿0
 */
export function buildTiersFromPriceColumns(priceSource: any): PromotionTier[] {
  const price1 = Number(priceSource?.price_1 ?? 0);
  const price2 = Number(priceSource?.price_2 ?? 0);
  const price3 = Number(priceSource?.price_3 ?? 0);
  const displayPrice = Number(priceSource?.display_price ?? 0);
  if (!(price1 > 0 || price2 > 0 || price3 > 0 || displayPrice > 0)) return [];

  const tiers: PromotionTier[] = [
    {
      id: 'tier-1',
      name: 'โปรโมชั่น 1 ชิ้น',
      quantity: 1,
      price: price1 > 0 ? price1 : displayPrice,
      description: ''
    }
  ];
  if (price2 > 0) {
    tiers.push({
      id: 'tier-2',
      name: 'โปรโมชั่น 2 ชิ้น',
      quantity: 2,
      price: price2,
      description: String(priceSource?.promotion_detail || '')
    });
  }
  if (price3 > 0) {
    tiers.push({
      id: 'tier-3',
      name: 'โปรโมชั่น 3 ชิ้น',
      quantity: 3,
      price: price3,
      description: ''
    });
  }
  return tiers;
}

/**
 * แก้ราคาใน tier ให้ตรงกับ price_1/2/3 ที่แก้จากตารางฐานข้อมูล
 * (คอลัมน์ราคาถูก derive มาจากราคา tier ดังนั้นการทำแบบนี้จึง idempotent)
 */
export function applyTierPriceOverrides(tiers: PromotionTier[], priceSource: any): PromotionTier[] {
  return (tiers || []).map((tier, index) => {
    const edited = Number(priceSource?.[`price_${index + 1}`]);
    return Number.isFinite(edited) && edited > 0 ? { ...tier, price: edited } : tier;
  });
}

/**
 * เลือก tier ที่ควรใช้จริง:
 *   1) tier ที่ส่งเข้ามาใหม่ (จากฟอร์ม)
 *   2) tier ที่เคยบันทึกไว้ (ห้ามให้ฟอร์มเปล่าล้างของเดิม)
 *   3) สร้างจาก price_1/2/3 เป็นทางเลือกสุดท้าย
 */
export function resolvePromotionTiers(incoming: any, fallback: any, priceSource: any): PromotionTier[] {
  const fromIncoming = parsePromotionTiers(incoming).filter(isUsableTier);
  if (fromIncoming.length) return applyTierPriceOverrides(fromIncoming, priceSource);

  const fromFallback = parsePromotionTiers(fallback).filter(isUsableTier);
  if (fromFallback.length) return applyTierPriceOverrides(fromFallback, priceSource);

  return buildTiersFromPriceColumns(priceSource);
}

/**
 * เขียนราคา tier กลับลงคอลัมน์ price_1/2/3 + promotion_detail
 * ใช้ตอนบันทึกสินค้า เพื่อให้ตารางฐานข้อมูลและหน้าตั้งค่าเพจแสดงราคาเดียวกันเสมอ
 */
export function syncTierPricesToColumns(tiers: PromotionTier[]): {
  price_1: number;
  price_2: number;
  price_3: number;
  promotion_detail: string;
} {
  const list = (tiers || []).filter(isUsableTier);
  const priceAt = (index: number) => Number(list[index]?.price ?? 0) || 0;
  const detail = list.find(t => String(t.description || '').trim())?.description
    || list.find(t => String(t.free_gifts || '').trim())?.free_gifts
    || '';
  return {
    price_1: priceAt(0),
    price_2: priceAt(1),
    price_3: priceAt(2),
    promotion_detail: String(detail || '')
  };
}

/** สร้าง tier เปล่า 1 ระดับสำหรับปุ่ม "+ เพิ่มแพ็กเกจ" */
export function createEmptyTier(existing: PromotionTier[], displayPrice = 0): PromotionTier {
  const list = existing || [];
  const index = list.length + 1;
  const prevQuantity = Number(list[list.length - 1]?.quantity ?? 0);
  return {
    id: `promo-${Date.now()}`,
    name: `โปรโมชั่น ${index} ชิ้น`,
    quantity: prevQuantity > 0 ? prevQuantity + 1 : index,
    price: displayPrice > 0 ? displayPrice : 0,
    original_price: displayPrice > 0 ? displayPrice : undefined,
    free_gifts: '',
    gift_quantity: 0,
    free_shipping: false,
    description: '',
    is_popular: false
  };
}
