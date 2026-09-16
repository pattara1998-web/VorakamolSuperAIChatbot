# 📋 เอกสารตรวจสอบและแผนอัพเกรดระบบ (Audit & Upgrade Plan)

> โปรเจกต์: Vorakamol SuperAI Chatbot v2.8
> วันที่ตรวจสอบ: 2026-09-02
> อัปเดตล่าสุด: 2026-09-15 — ตรวจสอบซ้ำหลังคอมมิต `11aba92`
> สถานะ: เสร็จแล้ว 5/5 ข้อ — แผน audit เดิมไม่มีงานค้างที่เป็นบั๊ก

---

## 1. ✅ สิ่งที่ "ทำเสร็จแล้ว" (ไม่ต้องทำซ้ำ)

| ฟีเจอร์ | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---|---|
| Database ถาวร (SQLite) | ✅ เสร็จแล้ว | [`database.ts`](src/services/database.ts) มี 49 functions ครบทุกตาราง (pages, products, customers, orders, chat_history, activity_logs, emergency_alerts, settings, custom_buttons, order_dispatch_counter, dispatched_messages) |
| ระบบเชื่อม Memory ↔ DB | ✅ เสร็จแล้ว | [`dbBridge.ts`](src/services/dbBridge.ts) มี `loadFromDatabase()`, `saveToDatabase()`, `migrateFromJsonIfEmpty()` |
| ระบบ Login + ความปลอดภัย | ✅ เสร็จแล้ว | [`auth.ts`](src/services/auth.ts) + [`LoginScreen.tsx`](src/components/LoginScreen.tsx) (ใช้ใน [`App.tsx`](src/App.tsx:19)) มีล็อกการเดา 5 ครั้ง, ล็อก 15 นาที, เซสชัน 24 ชม., บล็อก IP |
| AI ตอบแชทลูกค้า (Gemini) | ✅ เสร็จแล้ว | [`server.ts`](server.ts:644) ใช้ `@google/genai` พร้อมระบบเลือกโมเดลสำรองอัตโนมัติ |
| ความจำลูกค้า + ติดดาว | ✅ เสร็จแล้ว | [`database.ts`](src/services/database.ts:639) มี `getCustomerOrderCount()`, `isReturningCustomer()`, `getCustomerTotalSpent()` |
| ส่งออเดอร์ไป LINE/Telegram + ตัวเลขลำดับ | ✅ เสร็จแล้ว | ตาราง `order_dispatch_counter` + `dispatched_messages` + `incrementDispatchCounter()` |
| ตัดรอบ / ยกเลิกออเดอร์ | ✅ เสร็จแล้ว | `resetDispatchCounter()`, `cancelOrder()`, `markDispatchedMessageCancelled()` |
| Token Facebook ต่ออายุอัตโนมัติ | ✅ เสร็จแล้ว | [`server.ts`](server.ts:4604) มี worker ต่ออายุ token |
| ระบบ Backup อัตโนมัติ | ✅ เสร็จแล้ว | มี `/api/backup/create`, `/api/backup/list` ใน server.ts |
| SSE Backend (ส่งข้อมูลแบบเรียลไทม์) | ✅ เสร็จแล้ว (ฝั่งเซิร์ฟเวอร์) | [`dbBridge.ts`](src/services/dbBridge.ts:245) มี `broadcastSSE()`, `addSSEClient()` + endpoint `/api/events` |
| Deploy บน Render | ✅ เสร็จแล้ว | [`render.yaml`](render.yaml) ทำงานอยู่ที่ https://vorakamol-superai-chatbot.onrender.com/ |

---

## 2. 🗑️ ไฟล์ที่ "ไม่ได้ใช้" — ผลการตรวจสอบซ้ำ (2026-09-15)

ตรวจสอบซ้ำทั้งโปรเจกต์แล้ว: ไฟล์ขยะ 6 รายการตามแผนเดิม **ไม่มีอยู่ในโปรเจกต์แล้ว**
(`src/controllers/facebookController.ts`, `src/components/MessageInput.tsx`, `vercel.json`,
`netlify.toml`, `prisma/schema.prisma`, โฟลเดอร์ `assets/`) — ถูกลบออกไปก่อนหน้านี้
`tsc --noEmit` ผ่าน (exit 0) และ `npm run build` ผ่านทั้ง frontend (Vite) และ backend (esbuild)
จึงไม่ต้องลบอะไรเพิ่มในรอบนี้

| แพ็กเกจ | ผลตรวจซ้ำ |
|---|---|
| `@prisma/client` | ✅ ไม่มีใน `package.json` แล้ว — ไม่ต้องทำอะไร |

> หมายเหตุ: ในแผนเดิม `vercel.json` / `netlify.toml` ถูกระบุว่าพังเพราะอ้างอิงโฟลเดอร์ `api/`
> แต่ปัจจุบันทั้งสองไฟล์ไม่มีอยู่ใน repo แล้ว จึงตัดข้อนี้ออกจากงานค้าง

---

## 3. ⚠️ ปัญหาที่พบ (ต้องแก้)

### 🔴 3.1 ความปลอดภัย: รหัสผ่านเก็บเป็น "ข้อความธรรมดา" — ✅ แก้แล้ว
ใน [`auth.ts`](src/services/auth.ts) เดิมมีรหัส plain text ตรง ๆ
**ผลตรวจซ้ำ:** ปัจจุบันเก็บเฉพาะค่าแฮช SHA-256 (`ADMIN_CREDENTIAL_HASHES`) + เปรียบเทียบแบบ
constant-time (`safeCompare`) + อ่านค่าทับได้จาก env (`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`,
`ADMIN_SECURITY_CODE_HASH`, `ADMIN_PIN_HASH`) — ปิดข้อนี้ได้ เหลือแค่ห้ามคอมมิตไฟล์ `.env` จริง
(มี [`.env.example`](.env.example) เป็นต้นแบบโดยไม่มี secret อยู่แล้ว)

### 🔴 3.2 TypeScript Error 134 จุด — ✅ แก้แล้ว
ต้นเหตุเดิมคือ [`react.d.ts`](src/types/react.d.ts) ที่เป็น shim แบบย่อ
**ผลตรวจซ้ำ:** ปัจจุบันไฟล์นี้ถูกอัปเกรดเป็น v3 (รองรับ `useCallback`/`useMemo`/`StrictMode`/
`FormEvent`/functional updater ฯลฯ) และ `npm run lint` (tsc --noEmit) **ผ่าน exit 0 แล้ว** —
เหลือแค่ build warning เรื่อง chunk ใหญ่ (~1.48 MB) ซึ่งเป็นเรื่อง optimization ไม่ใช่ error

### 🟡 3.3 SSE ฝั่งหน้าเว็บ "ยังไม่ได้เชื่อม" — ✅ แก้แล้ว
- ฝั่งเซิร์ฟเวอร์: มี [`broadcastSSE()`](src/services/dbBridge.ts:245) + `/api/events` พร้อมแล้ว
- ฝั่งหน้าเว็บ: [`ChatInboxTab.tsx`](src/components/ChatInboxTab.tsx:100) **เชื่อม `useSSE` แล้ว**
  (รับ `new_message` / `data_updated` แบบเรียลไทม์) และเหลือ polling ทุก 30 วินาทีเป็น fallback
  กรณี SSE หลุด — ตรงตามแผนที่วางไว้ ปิดข้อนี้ได้

---

## 4. 🚀 แผนอัพเกรด — สถานะล่าสุด (2026-09-15)

### ระยะที่ 1: ทำความสะอาด — ✅ เสร็จแล้ว (ไม่มีไฟล์ขยะเหลือให้ลบ)
ไฟล์ 6 รายการ + `@prisma/client` ถูกจัดการไปก่อนหน้านี้ — ตรวจซ้ำไม่พบงานค้าง

### ระยะที่ 2: แก้ความปลอดภัย — ✅ เสร็จแล้ว
รหัส plain text ใน `auth.ts` ถูกแทนด้วยค่าแฮช + env override + Trusted Device/PIN Gate
(ดู [`auth.ts`](src/services/auth.ts:35) และ [`.env.example`](.env.example:25))

### ระยะที่ 3: เชื่อม SSE เรียลไทม์ — ✅ เสร็จแล้ว
[`ChatInboxTab.tsx`](src/components/ChatInboxTab.tsx:133) ใช้ `useSSE` แล้ว (SSE หลัก +
polling 30s สำรอง) — ตรงตามแผน ไม่ต้องแก้เพิ่ม

### ระยะที่ 4: เปิดใช้หน้าจัดการปุ่ม — ✅ เสร็จแล้ว
[`CustomButtonsManager.tsx`](src/components/CustomButtonsManager.tsx) **ถูกฝังใน
[`PageSettingsModal.tsx`](src/components/PageSettingsModal.tsx:52) แล้ว**
(API เซิร์ฟเวอร์ `/api/buttons` มีครบ) — ปิดข้อนี้ได้

### ระยะที่ 5: แก้ TypeScript Errors — ✅ เสร็จแล้ว
`react.d.ts` อัปเกรดเป็น v3 แล้ว + `npm run lint` ผ่าน exit 0

### งานที่อาจทำต่อ (optional — ไม่ใช่บั๊ก)
1. ลดขนาด bundle หน้าเว็บ (~1.48 MB → code-split หน้า tab หนัก ๆ)
2. หมุนรหัสจริง (เปลี่ยน password/security code ใหม่ แล้วใส่เฉพาะค่าแฮชใน env ของ Render)

---

## 5. 📌 สรุปสิ่งที่ "ไม่ต้องทำ" เพราะมีอยู่แล้ว

- ❌ ไม่ต้องเขียนระบบ Database ใหม่ (มีครบแล้ว 11 ตาราง)
- ❌ ไม่ต้องเขียนระบบ Login ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบ AI ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบความจำลูกค้าใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบส่ง LINE/Telegram ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องตั้งค่า Deploy ใหม่ (render.yaml ใช้งานได้)

## 6. 🎯 สิ่งที่ต้องทำจริง (เรียงลำดับความสำคัญ) — อัปเดต 2026-09-15

1. ~~**ลบไฟล์ขยะ 6 รายการ**~~ → ✅ เสร็จแล้ว (ไฟล์ไม่อยู่ใน repo แล้ว)
2. ~~**แก้รหัสผ่านธรรมดา**~~ → ✅ เสร็จแล้ว (เก็บเฉพาะแฮช + env)
3. ~~**เชื่อม SSE**~~ → ✅ เสร็จแล้ว (ChatInboxTab ใช้ useSSE + fallback 30s)
4. ~~**ฝังหน้าจัดการปุ่ม**~~ → ✅ เสร็จแล้ว (ฝังใน PageSettingsModal แล้ว)
5. ~~**แก้ TypeScript**~~ → ✅ เสร็จแล้ว (`npm run lint` ผ่าน exit 0, `npm run build` ผ่าน)

**สรุป: แผน audit เดิมเสร็จครบทั้ง 5 ข้อ — ไม่มีงานค้างที่เป็นบั๊ก**
งานที่เหลือเป็น optional (ลดขนาด bundle / หมุนรหัสจริงบน Render) — ทำเมื่อพร้อมได้
