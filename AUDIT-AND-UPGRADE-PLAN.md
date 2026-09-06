# 📋 เอกสารตรวจสอบและแผนอัพเกรดระบบ (Audit & Upgrade Plan)

> โปรเจกต์: Vorakamol SuperAI Chatbot v2.8
> วันที่ตรวจสอบ: 2026-09-02
> สถานะ: รอการยืนยันจากผู้ดูแลก่อนลงมือแก้ไข

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

## 2. 🗑️ ไฟล์ที่ "ไม่ได้ใช้" — แนะนำให้ลบ (ประหยัดพื้นที่)

| ไฟล์ | เหตุผลที่ลบได้ | ความเสี่ยง |
|---|---|---|
| [`facebookController.ts`](src/controllers/facebookController.ts) | ไม่มีไฟล์ไหน import เลย ใช้ Prisma + axios ที่ไม่ได้ติดตั้ง ใช้ Graph API เวอร์ชันเก่า (v19.0) | 🟢 ปลอดภัย 100% |
| [`MessageInput.tsx`](src/components/MessageInput.tsx) | ไม่มีไฟล์ไหน import | 🟢 ปลอดภัย 100% |
| [`vercel.json`](vercel.json) | อ้างอิงโฟลเดอร์ `api/` ที่ถูกลบไปแล้ว → พัง และโปรเจกต์ใช้ Render ไม่ใช่ Vercel | 🟢 ปลอดภัย 100% |
| [`netlify.toml`](netlify.toml) | โปรเจกต์ deploy บน Render ไม่ได้ใช้ Netlify | 🟢 ปลอดภัย 100% |
| [`prisma/schema.prisma`](prisma/schema.prisma) | Prisma ติดตั้งไม่สำเร็จ เปลี่ยนไปใช้ better-sqlite3 แล้ว | 🟢 ปลอดภัย 100% |
| โฟลเดอร์ `assets/` | เป็นโฟลเดอร์ว่างเปล่า ไม่มีไฟล์ข้างใน | 🟢 ปลอดภัย 100% |

### 🟡 ไฟล์ที่ "ไม่ได้ใช้ตอนนี้" แต่ควรเก็บไว้เพื่ออัพเกรด (ดูข้อ 4)

| ไฟล์ | สถานะ | แผน |
|---|---|---|
| [`useSSE.ts`](src/utils/useSSE.ts) | ไม่มีใคร import แต่เป็น Hook ที่เขียนเสร็จแล้ว | ✅ เก็บไว้ → นำไปเชื่อมกับ ChatInboxTab (ข้อ 4.1) |
| [`CustomButtonsManager.tsx`](src/components/CustomButtonsManager.tsx) | ไม่มีใคร import แต่เป็นหน้าจัดการปุ่มที่เขียนเสร็จแล้ว | ✅ เก็บไว้ → นำไปฝังในระบบ (ข้อ 4.2) |

### 📦 Dependency ที่ควรเอาออกจาก [`package.json`](package.json:16)

| แพ็กเกจ | เหตุผล |
|---|---|
| `@prisma/client` | ไม่ได้ใช้แล้ว (ใช้ better-sqlite3 แทน) — กินพื้นที่ติดตั้งมาก |

---

## 3. ⚠️ ปัญหาที่พบ (ต้องแก้)

### 🔴 3.1 ความปลอดภัย: รหัสผ่านเก็บเป็น "ข้อความธรรมดา"
ใน [`auth.ts`](src/services/auth.ts) มี:
```
const ADMIN_CREDENTIALS = {
  id: 'adminpremium',
  password: '18062522',
  security_code: '170962',
  ...
}
```
**ปัญหา:** ใครที่เห็นโค้ด (เช่น ใน GitHub) จะรู้รหัสทันที แม้มี `hashPassword()` อยู่แล้วแต่ไม่ได้ใช้กับค่านี้
**วิธีแก้:** เปลี่ยนเป็นเก็บค่าที่แฮชแล้วแทน และ/หรืออ่านจาก environment variable

### 🔴 3.2 TypeScript Error 134 จุด — ต้นเหตุคือ [`react.d.ts`](src/types/react.d.ts)
ไฟล์นี้คือ "ตัวจำลองชนิด React แบบย่อ" ที่เขียนเอง มีแค่ `useState`, `useEffect`, `useRef` — **ขาด** `useCallback`, `useMemo`, `StrictMode`, `FormEvent` ฯลฯ ทำให้ `tsc` รายงาน error 134 จุด
**หมายเหตุ:** การ build ด้วย Vite ยังผ่าน (Vite ไม่ตรวจชนิด) ระบบยังรันได้ แต่ควรแก้ให้สะอาด
**วิธีแก้:** ขยาย [`react.d.ts`](src/types/react.d.ts) ให้ครบทุกตัวที่ใช้ในโปรเจกต์ (วิธีนี้ปลอดภัยกว่าการติดตั้ง `@types/react` ซึ่งเคยชนกับของเดิม)

### 🟡 3.3 SSE ฝั่งหน้าเว็บ "ยังไม่ได้เชื่อม"
- ฝั่งเซิร์ฟเวอร์: มี [`broadcastSSE()`](src/services/dbBridge.ts:245) + `/api/events` พร้อมแล้ว
- ฝั่งหน้าเว็บ: [`ChatInboxTab.tsx`](src/components/ChatInboxTab.tsx:100) ยังใช้วิธี "ถามเซิร์ฟเวอร์ทุก 5 วินาที" (polling) และไม่มีไฟล์ไหนใช้ [`useSSE.ts`](src/utils/useSSE.ts) เลย
**ผลกระทบ:** ข้อความใหม่ช้าสุด 5 วินาที + สิ้นเปลือง request ตลอดเวลา (โฮสต์ฟรีมีจำกัด)
**วิธีแก้:** เชื่อม `useSSE` เข้ากับ ChatInboxTab ให้รับข้อความแบบทันที (เรียลไทม์) และลดการถามซ้ำเหลือเฉพาะกรณี SSE หลุด

---

## 4. 🚀 แผนอัพเกรดให้เป็น "เวอร์ชันที่ดีกว่า"

### ระยะที่ 1: ทำความสะอาด (ลบของไม่ใช้) — ใช้เวลาสั้น ประโยชน์ทันที
1. ลบไฟล์ 6 รายการตามข้อ 2
2. เอา `@prisma/client` ออกจาก [`package.json`](package.json)
3. Build ทดสอบว่าระบบยังรันได้ปกติ

### ระยะที่ 2: แก้ความปลอดภัย
1. แก้รหัสผ่านธรรมดาใน [`auth.ts`](src/services/auth.ts) → ใช้ค่าแฮช
2. ย้ายค่าความลับไปอ่านจาก env (มี [`.env.example`](.env.example) รองรับอยู่แล้ว)

### ระยะที่ 3: เชื่อม SSE เรียลไทม์ (อัพเกรดใหญ่สุด)
1. นำ [`useSSE.ts`](src/utils/useSSE.ts) ไปใช้ใน [`ChatInboxTab.tsx`](src/components/ChatInboxTab.tsx) — รับข้อความใหม่/ออเดอร์ใหม่ทันทีโดยไม่ต้องรอ 5 วินาที
2. มีระบบ "สำรอง" ถ้า SSE หลุดจะกลับไปถามทุก 30 วินาทีแทน (ประหยัดกว่าเดิม)

### ระยะที่ 4: เปิดใช้หน้าจัดการปุ่ม
1. ฝัง [`CustomButtonsManager.tsx`](src/components/CustomButtonsManager.tsx) เข้าไปในหน้าตั้งค่าเพจ (มี API ฝั่งเซิร์ฟเวอร์รองรับครบแล้ว)

### ระยะที่ 5: แก้ TypeScript Errors
1. ขยาย [`react.d.ts`](src/types/react.d.ts) ให้ครบ → ลด error จาก 134 ให้เหลือน้อยที่สุด

---

## 5. 📌 สรุปสิ่งที่ "ไม่ต้องทำ" เพราะมีอยู่แล้ว

- ❌ ไม่ต้องเขียนระบบ Database ใหม่ (มีครบแล้ว 11 ตาราง)
- ❌ ไม่ต้องเขียนระบบ Login ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบ AI ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบความจำลูกค้าใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องเขียนระบบส่ง LINE/Telegram ใหม่ (มีครบแล้ว)
- ❌ ไม่ต้องตั้งค่า Deploy ใหม่ (render.yaml ใช้งานได้)

## 6. 🎯 สิ่งที่ต้องทำจริง (เรียงลำดับความสำคัญ)

1. **ลบไฟล์ขยะ 6 รายการ** → ประหยัดพื้นที่ทันที (ความต้องการหลักของคุณ)
2. **แก้รหัสผ่านธรรมดา** → ความปลอดภัย
3. **เชื่อม SSE** → แชทเรียลไทม์ + ประหยัดโฮสต์ฟรี
4. **ฝังหน้าจัดการปุ่ม** → ใช้ฟีเจอร์ที่ทำไว้แล้วให้ครบ
5. **แก้ TypeScript** → โค้ดสะอาด ตรวจสอบได้ง่ายขึ้น
