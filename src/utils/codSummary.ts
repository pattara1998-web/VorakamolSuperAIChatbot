import type { PageConfig, Order } from '../types';

export const DEFAULT_COD_TEMPLATE = `📦 [สรุปยอดสั่งซื้อเก็บเงินปลายทาง]
━━━━━━━━━━━━━━━━━━━
👤 ผู้รับ: {customer_name}
📞 เบอร์โทร: {phone_number}
📍 ที่อยู่: {shipping_address}
🛍️ สินค้า: {items}
🚚 การจัดส่ง: {shipping_duration}
💰 ยอดรวม COD: ฿{total_amount}
━━━━━━━━━━━━━━━━━━━
🙏 ขอบคุณที่ไว้วางใจร้านเราค่ะ/ครับ`;

export const DEFAULT_COD_FIELDS = {
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
};

export function buildCodSummaryText(page: Partial<PageConfig>, order: Partial<Order>): string {
  const fields = { ...DEFAULT_COD_FIELDS, ...(page.cod_summary_fields || {}) };
  const template = String(page.cod_summary_template || DEFAULT_COD_TEMPLATE).trim();

  const customerName = order.customer_name || 'คุณลูกค้า (รอระบุ)';
  const phoneNum = order.phone_number || 'รอระบุเบอร์โทร';
  const address = order.shipping_address || 'รอระบุที่อยู่จัดส่ง';
  const itemsStr = order.items || page.product?.product_name || 'สินค้าโปรโมชั่น';
  const totalAmt = Number(order.total_amount || page.product?.display_price || 1000).toLocaleString();
  const shippingDuration = page.product?.shipping_duration || 'จัดส่งด่วน 1-3 วัน (มีบริการเก็บเงินปลายทาง)';

  // If the user has a custom template, substitute variables
  if (page.cod_summary_template) {
    let res = template
      .replace(/\{customer_name\}/g, customerName)
      .replace(/\{phone_number\}/g, phoneNum)
      .replace(/\{shipping_address\}/g, address)
      .replace(/\{items\}/g, itemsStr)
      .replace(/\{total_amount\}/g, totalAmt)
      .replace(/\{shipping_duration\}/g, shippingDuration)
      .replace(/\{order_id\}/g, order.order_id || 'ORD-PREVIEW');
    return res;
  }

  // Otherwise build block-by-block respecting checkbox toggles
  const lines: string[] = [];
  if (fields.include_header) {
    lines.push('📦 [สรุปยอดสั่งซื้อเก็บเงินปลายทาง]');
    lines.push('━━━━━━━━━━━━━━━━━━━');
  }
  if (fields.include_page_name && page.page_name) {
    lines.push(`🏷️ ร้าน/เพจ: ${page.page_name}`);
  }
  if (fields.include_order_id) {
    lines.push(`🔖 เลขที่ออเดอร์: ${order.order_id || 'ORD-PREVIEW'}`);
  }
  if (fields.include_customer_name) {
    lines.push(`👤 ชื่อ-นามสกุล: ${customerName}`);
  }
  if (fields.include_phone) {
    lines.push(`📞 เบอร์โทรศัพท์: ${phoneNum}`);
  }
  if (fields.include_address) {
    lines.push(`📍 ที่อยู่จัดส่ง: ${address}`);
  }
  if (fields.include_items) {
    lines.push(`🛍️ รายการสินค้า: ${itemsStr}`);
  }
  if (fields.include_shipping_duration) {
    lines.push(`🚚 ระยะเวลาจัดส่ง: ${shippingDuration}`);
  }
  if (fields.include_total_amount) {
    lines.push(`💰 ยอดเรียกเก็บปลายทาง: ฿${totalAmt}`);
  }
  if (fields.include_shipping_note) {
    lines.push(`✨ หมายเหตุ: ส่งฟรีไม่มีบวกเพิ่ม เก็บเงินปลายทางพอดีเป๊ะ`);
  }
  if (fields.include_inspection_note) {
    lines.push(`🔍 คำแนะนำ: เมื่อได้รับพัสดุโปรดตรวจสอบความสมบูรณ์ก่อนชำระเงิน`);
  }
  if (fields.include_closing_blessing) {
    lines.push('━━━━━━━━━━━━━━━━━━━');
    lines.push('🙏 ขอบคุณที่อุดหนุน ขอให้เฮงๆ รวยๆ สุขภาพแข็งแรงค่ะ/ครับ');
  }

  return lines.join('\n');
}
