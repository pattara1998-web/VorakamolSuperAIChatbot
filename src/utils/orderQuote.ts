export interface OrderPricing {
  sale: number;
  packs: Array<{ quantity: number; price: number; free_shipping: boolean }>;
}

/** Shipping must be explicit. Never turn an unset or ambiguous fee into free delivery. */
export function parseShippingFee(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const text = String(value ?? '').trim();
  if (/^(?:ฟรี|ส่งฟรี|จัดส่งฟรี|free)$/i.test(text)) return 0;
  if (!/^(?:฿\s*)?\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:บาท)?$/.test(text)) return null;
  return Number(text.replace(/[^\d.]/g, ''));
}

export function calculateOrderQuote(pricing: OrderPricing, quantity: number, shippingFee: unknown): {
  subtotal: number; shipping: number; total: number;
} | null {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const matches = pricing.packs.filter(p => p.quantity === quantity);
  // Two offers for the same quantity need an explicit selection, not an arbitrary price.
  if (matches.length > 1) return null;
  const pack = matches[0];
  // With a configured ladder, don't infer a price for an unconfigured quantity.
  const subtotal = pack?.price ?? (pricing.packs.length === 0 ? pricing.sale * quantity : 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return null;
  const shipping = pack?.free_shipping ? 0 : parseShippingFee(shippingFee);
  if (shipping === null) return null;
  return { subtotal, shipping, total: Math.round((subtotal + shipping) * 100) / 100 };
}
