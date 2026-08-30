import React, { useState } from 'react';
import {
  ShoppingBag,
  BellRing,
  Send,
  CheckCircle2,
  Truck,
  Clock,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Search,
  Filter,
  Check,
  Copy,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { Order, PageConfig } from '../types';

interface OrdersAndLineTabProps {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  pages: PageConfig[];
  onSaveOrders: (orders: Order[]) => void;
}

export const OrdersAndLineTab: React.FC<OrdersAndLineTabProps> = ({
  orders,
  setOrders,
  pages,
  onSaveOrders
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'SHIPPED'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);
  const [notificationTestStatus, setNotificationTestStatus] = useState<string | null>(null);

  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.order_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.phone_number.includes(searchTerm) ||
      o.items.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = (orderId: string, newStatus: Order['payment_status']) => {
    const updated = orders.map(o => (o.order_id === orderId ? { ...o, payment_status: newStatus } : o));
    setOrders(updated);
    onSaveOrders(updated);
    if (selectedOrder && selectedOrder.order_id === orderId) {
      setSelectedOrder({ ...selectedOrder, payment_status: newStatus });
    }
  };

  const handleSendTestNotification = async (order: Order, channel: 'LINE' | 'TELEGRAM') => {
    setNotificationTestStatus(`กำลังส่งแจ้งเตือนเข้า ${channel}...`);
    try {
      const orderPage = pages.find(p => p.page_id === order.page_id) || pages[0];
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          page_id: orderPage.page_id,
          page_name: orderPage.page_name,
          sample_order: {
            customer_name: order.customer_name,
            address: order.shipping_address,
            phone: order.phone_number,
            item: order.items,
            total: order.total_amount
          }
        })
      });
      const data = await res.json();
      setNotificationTestStatus(data.message || `ส่งการแจ้งเตือน ${channel} สำเร็จแล้ว! 🔔`);
      setTimeout(() => setNotificationTestStatus(null), 3500);
    } catch (err: any) {
      setNotificationTestStatus(`ไม่สามารถส่งแจ้งเตือนได้: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-lg flex items-center gap-2">
                คำสั่งซื้อ & ระบบส่งสรุปยอด COD ไปยัง Telegram / LINE ทันที
                <span className="text-xs bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-mono font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                  Auto-Push 24/7
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                เมื่อ AI หรือแอดมินปิดการขายสำเร็จ ออเดอร์จะถูกจัดรูปแบบสรุปยอดตามฟอร์ม COD และยิงส่งเข้า Telegram และกลุ่ม LINE อัตโนมัติ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3.5 py-2 bg-slate-50 dark:bg-[#141418] rounded-xl text-xs text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 flex items-center gap-2 font-mono font-medium">
              <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Dispatcher: <strong className="text-emerald-700 dark:text-emerald-400 font-bold">Telegram + LINE Active</strong></span>
            </div>
          </div>
        </div>

        {notificationTestStatus && (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{notificationTestStatus}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Orders Table & Dispatch Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Orders Table */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls: Search & Status Tabs */}
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="ค้นหารหัสออเดอร์, ชื่อลูกค้า, เบอร์โทร..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#141418] border border-slate-200 dark:border-zinc-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#141418] p-1 rounded-xl border border-slate-200 dark:border-zinc-800 w-full sm:w-auto">
              {(['ALL', 'PENDING', 'PAID', 'SHIPPED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {st === 'ALL' ? 'ทั้งหมด' : st === 'PENDING' ? 'รอชำระ' : st === 'PAID' ? 'ชำระแล้ว' : 'ส่งแล้ว'}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List Card */}
          <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px] scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-[#0A0A0C] text-slate-600 dark:text-zinc-400 sticky top-0 z-10 border-b border-slate-200 dark:border-zinc-800 font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">รหัสออเดอร์</th>
                    <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ลูกค้า / เบอร์</th>
                    <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800 min-w-[140px]">รายการสินค้า</th>
                    <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">ยอดรวม</th>
                    <th className="p-3.5 border-r border-slate-200 dark:border-zinc-800">สถานะ</th>
                    <th className="p-3.5">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                        ไม่พบข้อมูลคำสั่งซื้อ
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const isSelected = selectedOrder?.order_id === order.order_id;
                      return (
                        <tr
                          key={order.order_id}
                          onClick={() => setSelectedOrder(order)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/20 border-l-4 border-indigo-600'
                              : 'hover:bg-slate-50 dark:hover:bg-[#141418]'
                          }`}
                        >
                          <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800 font-mono text-indigo-600 dark:text-indigo-400 font-bold whitespace-nowrap">
                            {order.order_id}
                          </td>
                          <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-zinc-100">{order.customer_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">{order.phone_number}</div>
                          </td>
                          <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-300">
                            {order.items}
                          </td>
                          <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            ฿{order.total_amount?.toLocaleString()}
                          </td>
                          <td className="p-3.5 border-r border-slate-200 dark:border-zinc-800 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                order.payment_status === 'PAID'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                  : order.payment_status === 'SHIPPED'
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                              }`}
                            >
                              {order.payment_status}
                            </span>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleUpdateStatus(order.order_id, 'PAID')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors shadow-xs"
                              >
                                ชำระแล้ว
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(order.order_id, 'SHIPPED')}
                                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-colors shadow-xs"
                              >
                                ส่งแล้ว
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Order Details & Real-Time COD Summary Format Dispatch Preview */}
        <div className="lg:col-span-5 space-y-4">
          {selectedOrder ? (
            <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h4 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">รายละเอียดออเดอร์ & แบบฟอร์มสรุปยอด</h4>
                <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">{selectedOrder.order_id}</span>
              </div>

              {/* Exact COD Order Summary Format Requested by User */}
              <div className="bg-emerald-50/60 dark:bg-[#141418] border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Copy className="w-3.5 h-3.5 text-emerald-600" /> รูปแบบข้อความสรุปยอด (COD Summary):
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
                    Auto-Formatted
                  </span>
                </div>

                <div className="bg-white dark:bg-[#0A0A0C] p-3.5 rounded-xl text-xs font-mono text-slate-900 dark:text-zinc-200 leading-relaxed border border-emerald-100 dark:border-zinc-800/80 whitespace-pre-wrap select-all shadow-xs">
{selectedOrder.customer_name}
{selectedOrder.shipping_address}
{selectedOrder.phone_number}
***{selectedOrder.items}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-600 dark:text-zinc-400 font-mono">ยอดเรียกเก็บปลายทาง:</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold text-base">฿{selectedOrder.total_amount?.toLocaleString()} บาท</span>
                </div>
              </div>

              {/* Dispatch Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  onClick={() => handleSendTestNotification(selectedOrder, 'TELEGRAM')}
                  className="py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/20"
                >
                  <Send className="w-3.5 h-3.5" /> ส่งเข้า Telegram
                </button>

                <button
                  onClick={() => handleSendTestNotification(selectedOrder, 'LINE')}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> ส่งเข้า LINE กลุ่ม
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0F0F12] border border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
              เลือกออเดอร์จากตารางเพื่อดูรายละเอียดและการแจ้งเตือน
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
