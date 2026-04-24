# 🛑 Handover & Do Not Touch List (NeoSupport)

**Update Date:** April 24, 2026
**Primary Author:** Lead Developer / Antigravity Assistant

เอกสารฉบับนี้รวบรวมส่วนงานที่มีการปรับปรุงความเสถียรและรีดประสิทธิภาพ (Optimization) อย่างละเอียดในวันนี้ **ขอความร่วมมือทีมงานอย่าแก้ไขทับ (Do Not Touch)** ในจุดเหล่านี้โดยไม่ได้ปรึกษาทีมก่อน เพื่อป้องกัน Regression

---

## 🎨 1. UI Architecture & Theme Picker
มีการเปลี่ยนโครงสร้าง Layout หลักเพื่อความโปร่งและทันสมัย
*   **Inline Datetime:** ย้ายจากกล่องลอยมาเป็นส่วนหนึ่งของ Top Bar เพื่อลดภาระการ Render
*   **Card-based Theme Picker:** ปรับปรุง UI ให้เป็นแบบการ์ดที่อ่านง่ายและคลิกสะดวก
*   **Files:** `src/app/(dashboard)/layout.tsx`
*   **Commits:** `ee2bc25`, `58c17d9`

## 🛠️ 2. Build Pipeline & SSR Integrity
แก้ไขปัญหาที่เป็นคอขวดในการ Deploy
*   **Prerender Fix:** แก้ไขปัญหา SSR Crash ในหน้า `/reports/hub` ที่เกิดจาก `localStorage` (ใช้ `useEffect` หรือ `dynamic import` แทน)
*   **Localization Fix:** แก้ไข `Cannot find name 't'` ใน `ResolveTicketModal`
*   **Commit:** `f924d4c`

## 💬 3. Realtime Messaging Stability
ปรับปรุงการรับส่งข้อความให้มีความแม่นยำสูง (High Fidelity)
*   **Customer Portal:** เพิ่มระบบ Fallback Polling ร่วมกับ Realtime เพื่อให้ข้อความไม่หลุดหาย
*   **Staff Inbox:** แก้ไขปัญหาข้อความซ้ำ (Ghost Messages) โดยใช้ระบบ Reconcile ระหว่าง Temporary ID ของฝั่ง Client กับ Server ID
*   **Files:** `portal/tickets/[id]/page.tsx`, `useInboxConversation.ts`
*   **Commit:** `c6daaaf`

## ✅ 4. Robust Resolution Workflow
แก้ไขปัญหา UX ในขั้นตอนสำคัญที่สุดของการบริการ
*   **Pre-fail Recheck:** ระบบจะทำการ Re-check สถานะจาก DB จริงก่อนที่จะแสดง Error ในขั้นตอนการ Resolve
*   **State Auto-close:** ปิด Session ใน State ทันทีเมื่อ API ตอบกลับสำเร็จ (ลด Latency การรอนาน)
*   **Contextual Buttons:** ซ่อนปุ่ม "End Chat" อัตโนมัติหาก Ticket อยู่ในสถานะที่แก้ไขไม่ได้แล้ว
*   **Commit:** `1d474e0`

## ⚡ 5. Performance & Resource Management
รีดประสิทธิภาพการโหลดครั้งแรก (First Contentful Paint)
*   **Lazy Loading:** แยก Bundle สำหรับ Component ที่มีขนาดใหญ่ (Editor, Viewer, Modal)
*   **Payload Reduction:** ตัดการใช้ `SELECT *` ใน Query สำคัญ เปลี่ยนเป็นระบุคอลัมน์เฉพาะที่จำเป็น
*   **Silent Refresh:** ปรับระบบ Refresh ใน Inbox ให้ทำงานเบื้องหลังโดยไม่มี Loading Overlay รบกวนเจ้าหน้าที่
*   **Commit:** `4aa06ec`

## 📥 6. Inbox Stability & Lifecycle Management
แก้ไขปัญหาเรื่องสถานะการสนทนาและการแสดงผลที่ค้างหลังจบงาน
*   **Freeze Fix:** แก้ไขปัญหา "จบการสนทนาแล้วหน้าค้าง" โดยปรับ Logic การ Sync `selectedChat` เพื่อป้องกัน Re-render Loop จาก Realtime Payload
*   **Status Clarity:** 
    *   **Header:** แสดง "Active Session" หรือ "Closed Session" ตามจริง
    *   **Sidebar:** แยกสีจุดสถานะและเปลี่ยนข้อความเป็น "กำลังสนทนา" หรือ "ปิดการสนทนาแล้ว" ให้ชัดเจน
*   **Smart Filtering:** ปรับระบบ Fallback ให้กรองเฉพาะแชทที่เป็น Active-like ก่อนแสดงผล เพื่อความแม่นยำ
*   **Files:** `inbox/page.tsx`, `ChatWindow.tsx`, `InboxSidebar.tsx`, `useRealtimeInbox.ts`
*   **Commit:** `e03c1af`

---
*หมายเหตุสำหรับ AntiGravity: ชุดที่ 6 นี้มีการจูนเรื่อง Sync/Fallback ไว้ละเอียดมาก ขอความร่วมมือเลี่ยงการ Revert หรือแก้ไข Logic ใน 4 ไฟล์ข้างต้นครับ*

## 🖼️ 7. Portal Image UX & Drawing Accuracy
ปรับปรุงระบบจัดการรูปภาพฝั่งลูกค้าให้รองรับการใช้งานบนมือถือได้สมบูรณ์แบบ
*   **ImageViewer Improvements:** ย้ายปุ่มปิดไปซ้ายบนแยกจากปุ่มแก้ไข และปรับ Toolbar ให้ Scroll แนวนอนได้บนมือถือเพื่อป้องกันปุ่มเบียดกัน
*   **Mobile Editor Fix:** ปรับ Header/Bottom Toolbar ของ Editor ให้เป็น Responsive + Wrap และเพิ่มระบบล็อก Body Scroll ขณะเปิด Modal
*   **Precision Drawing:** เปลี่ยนระบบวาดภาพไปใช้ **Pointer Events** ร่วมกับ `touch-action: none` และปรับพิกัดการวาดจาก Canvas Rect โดยตรง ทำให้การแตะ/ลากบนมือถือแม่นยำขึ้น 100%
*   **Files:** `ImageViewerModal.tsx`, `ImageEditorModal.tsx`
*   **Commit:** `8837cc5`

---
*หมายเหตุ: งานทั้งหมดได้ผ่านการทดสอบและ Push ขึ้นสาขา Main เรียบร้อยแล้ว*
