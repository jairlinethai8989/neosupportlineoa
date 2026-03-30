# NEO Support V2.0.0 - แพลตฟอร์มการสนับสนุนแบบ Omnichannel

NEO Support คือแดชบอร์ดการสนับสนุนระดับองค์กรสำหรับ **LINE Official Accounts** ขับเคลื่อนด้วย Next.js 14, Supabase และระบบการออกแบบ Glassmorphism ระดับพรีเมียม

## 🚀 ฟีเจอร์หลัก
- **กล่องข้อความสด (Live Inbox)**: แชทระหว่างเจ้าหน้าที่และลูกค้าแบบเรียลไทม์ พร้อมการรวมข้อมูลกับ Supabase
- **กระบวนการจัดการตั๋ว (Ticketing Workflow)**: ระบบรับงาน (Claim), โอนย้าย (Transfer), และปิดงาน (Resolve) พร้อมบันทึกประวัติการตรวจสอบ (Audit logs) อย่างครบถ้วน
- **การวิเคราะห์ข้อมูลระดับผู้บริหาร (Executive Analytics)**: ติตามค่า KPI แบบเรียลไทม์, กำหนดกฎ SLA, และออกรายงาน (Excel/PDF)
- **พอร์ทัลลูกค้า LIFF (LIFF Customer Portal)**: บริการตนเองแบบ Mobile-first สำหรับติดตามสถานะตั๋วภายในแอป LINE (ดูรายละเอียดเพิ่มเติมที่ [TECHNICAL_LIFF_PORTAL.md](./TECHNICAL_LIFF_PORTAL.md))
- **แบบสำรวจความพึงพอใจ (CSAT Survey)**: ระบบรับข้อเสนอแนะจากลูกค้าอัตโนมัติทันทีที่ปิดงานตั๋ว

---

## 🛠️ เริ่มต้นใช้งาน

### 1. การติดตั้ง
```bash
npm install
```

### 2. การตั้งค่าสภาพแวดล้อม (Environment Setup)
สร้างไฟล์ `.env.local` และเพิ่มค่าดังนี้:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_token
LINE_CHANNEL_SECRET=your_secret
NEXT_PUBLIC_LINE_BOT_ID=@your_line_oa_id

# LIFF
NEXT_PUBLIC_LIFF_ID=your_liff_id
```

### 3. รันเซิร์ฟเวอร์สำหรับการพัฒนา
```bash
npm run dev
```

---

## 📘 เอกสารประกอบ
- [สถานะการส่งมอบโครงการ (Project Handover Status)](./PROJECT_V2_HANDOVER.md)
- [คู่มือทางเทคนิค: LIFF Portal](./TECHNICAL_LIFF_PORTAL.md)
- [ภาพรวมสถาปัตยกรรม (Architecture Overview)](./.agent/ARCHITECTURE.md)

## 🎨 ระบบการออกแบบ (Design System)
โปรเจกต์นี้ใช้โครงสร้าง CSS แบบ Glassmorphism ที่เน้นจุดเด่นดังนี้:
- **สีหลัก (Primary Color)**: `#00F2FE` (Cyan Glow)
- **สีรอง (Secondary Color)**: `#7367F0` (Purple Accents)
- **พื้นหลัง (Background)**: `#0a0e14` (Deep Space)

---
พัฒนาโดย **Antigravity AI**
