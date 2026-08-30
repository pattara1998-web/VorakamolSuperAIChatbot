# Production Environment Configuration for Vorakamol SuperAI Chatbot v2.8

## 🔑 CRITICAL: Required Environment Variables

### 1. GEMINI API KEY (Required for AI functionality)
```
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
```
วิธีหา API Key: https://makersuite.google.com/app/apikey

### 2. APP URL (Required for OAuth callbacks and webhooks)
```
APP_URL="https://your-domain.com"
```
ตั้งค่าเป็น URL ของ production server ของคุณ

### 3. FACEBOOK/META CONFIGURATION (Required for Facebook integration)
```
FACEBOOK_APP_ID="YOUR_FACEBOOK_APP_ID"
FACEBOOK_APP_SECRET="YOUR_FACEBOOK_APP_SECRET"
META_APP_ID="YOUR_META_APP_ID"
META_APP_SECRET="YOUR_META_APP_SECRET"
```
วิธีหา App ID/Secret: https://developers.facebook.com/apps

### 4. SECURITY SETTINGS (Required for encryption)
```
ENCRYPTION_SECRET_KEY="YOUR_LONG_RANDOM_ENCRYPTION_KEY_HERE"
```
ใช้ key ที่ยาวๆ และสุ่มเพื่อความปลอดภัย

## 📋 Additional Configuration

### 5. DATA STORAGE PATH
```
DATA_FILE="./data/superai-v2.8.json"
```
ตั้งค่า path สำหรับเก็บข้อมูลถ้าต้องการ custom location

### 6. META GRAPH API VERSION
```
META_GRAPH_API_VERSION="v24.0"
```

### 7. FACEBOOK WEBHOOK TOKEN
```
FACEBOOK_VERIFY_TOKEN="FB_AI_SALES_TOKEN_2026"
```
Must match frontend configuration

## 📊 Optional Integrations

### 8. GOOGLE SHEETS (Optional)
```
GOOGLE_SHEET_ID=""
```

### 9. LINE MESSAGING API (Optional)
```
LINE_CHANNEL_ACCESS_TOKEN=""
LINE_GROUP_ID=""
```

### 10. VITE FACEBOOK APP ID
```
VITE_FACEBOOK_APP_ID="YOUR_FACEBOOK_APP_ID"
```

## 🚀 Server Configuration
```
PORT=3000
NODE_ENV=production
```

## 📝 Deployment Instructions

1. สร้างไฟล์ `.env` ในโฟลเดอร์ root ของโปรเจกต์
2. คัดลอกค่า config จากไฟล์นี้ไปใส่ใน `.env`
3. แก้ไขค่าต่างๆ ให้เป็นค่าจริงของคุณ
4. รันคำสั่ง: `npm start` หรือ `node dist/server.cjs`

## ⚠️ สิ่งสำคัญก่อน Deploy

1. **ต้องใส่ GEMINI_API_KEY** - ไม่มี API Key ระบบจะไม่สามารถตอบแชทได้
2. **ต้องตั้งค่า Facebook App** - เพื่อให้ Webhook ทำงานได้
3. **ต้องตั้งค่า ENCRYPTION_SECRET_KEY** - เพื่อความปลอดภัยของข้อมูล
4. **ต้องตั้งค่า APP_URL** - เพื่อให้ OAuth callback ทำงานได้