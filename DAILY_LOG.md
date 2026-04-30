# บันทึกความคืบหน้าโครงการ NeoSupport V2.0 (ล่าสุด 30 เมษายน 2569)

## ✅ สิ่งที่ทำสำเร็จแล้วในวันนี้ (30 เมษายน 2569)

1.  **Dashboard Agent Workload Fix (สำเร็จ):**
    *   ปรับปรุง API Endpoint ของหน้า Dashboard (`/api/dashboard/summary/route.ts`) ในส่วน "ภาระงานเจ้าหน้าที่ (Agent Workload)"
    *   แก้ไขการดึงข้อมูลจากเดิมที่แสดงผลเป็น User UUID ให้ทำการ JOIN ข้อมูลกับตาราง `profiles` เพื่อดึงชื่อจริง (`full_name`) มาแสดงผลแทน
    *   ช่วยให้ผู้บริหารสามารถระบุตัวตนและตรวจสอบปริมาณงานของเจ้าหน้าที่แต่ละคนจากกราฟได้ง่ายขึ้น
2.  **LINE Reporting Hub Transparency (สำเร็จ):**
    *   เพิ่มการแสดงผลชื่อกลุ่ม LINE ที่เป็นเป้าหมายในการส่งรายงานบนหน้า Report Hub
    *   ปรับปรุง API (`/api/reports/hub/preview`) ให้ดึงข้อมูลชื่อกลุ่มจริงมาแสดงผล
3.  **LINE Group Dynamic Configuration (สำเร็จ):**
    *   เพิ่มระบบจัดการ "กลุ่ม LINE ส่งรายงาน" ในหน้าตั้งค่าข้อมูลพื้นฐาน (Master Settings)
    *   อนุญาตให้แอดมินสามารถเพิ่ม, แก้ไข, ลบ, หรือเปิด-ปิด สถานะการส่งรายงานของแต่ละกลุ่มได้เอง
    *   ระบบรายงาน (`cron/daily-summary`) สามารถรองรับการส่งออกหลายกลุ่มพร้อมกันตามที่ตั้งค่าไว้ในฐานข้อมูล

---

## ✅ สิ่งที่ทำสำเร็จแล้วก่อนหน้า (29 เมษายน 2569) - เซสชันที่ 2

1.  **Escalation Portal Localization & UI Fixes (สำเร็จ):**
    *   เพิ่มระบบสลับภาษา (TH/EN) ให้กับหน้า Escalation Portal สำหรับทีมรับช่วงต่อ
    *   แก้ไขข้อผิดพลาดการแสดงผล Translation Key ในหน้า Report Hub (เช่น `previewFor`, `hospitalGrouping`) ให้เป็นข้อความปกติ
    *   ปรับปรุงระบบหน่วยนับใบงาน (Ticket Unit) ในรายงานให้เป็นมาตรฐานเดียวกัน
2.  **Persistent UI State (จดจำการตั้งค่าหน้าจอ):**
    *   พัฒนาระบบจดจำรูปแบบมุมมองล่าสุด (Board/Table) ในหน้าจัดการใบงาน แยกตามรายบุคคล (User ID)
    *   พัฒนาระบบจดจำความกว้างคอลัมน์ (Column Widths) ในหน้าสรุปรายงานประจำวัน ไม่ต้องเสียเวลาปรับใหม่ทุกครั้งที่ใช้งาน
    *   ใช้ระบบ `localStorage` ผูกกับ ID ของผู้ใช้งาน เพื่อให้การตั้งค่ามีความเป็นส่วนตัวและไม่ทับซ้อนกันบนเครื่องส่วนรวม
3.  **Build Stability & Type Safety (สำเร็จ):**
    *   แก้ไขปัญหา Build Error บน Vercel โดยการอัปเดตนิยามโครงสร้างข้อมูล (TypeScript) ให้รองรับการเข้าถึงข้อมูล User ID
    *   ปรับปรุงความถูกต้องของตัวแปรสถานะมุมมอง (`table` vs `list`) ให้ตรงตามมาตรฐานของระบบ
4.  **Internal Ticket Reporting Improvement (สำเร็จ):**
    *   ปรับปรุงระบบ "สร้างใบงานใหม่" โดยพนักงาน ให้ทำการบันทึกชื่อพนักงานผู้สร้างเป็น "ผู้แจ้ง" (Reporter) โดยอัตโนมัติ
    *   ทำให้ชื่อพนักงานผู้สร้างปรากฏในตารางจัดการใบงานและรายงานต่างๆ อย่างถูกต้อง เพื่อความชัดเจนในการตรวจสอบย้อนหลัง (Auditability)

---

## ✅ สิ่งที่ทำสำเร็จแล้วในเซสชันเช้า (29 เมษายน 2569)
1.  **Inbox Chat Security & Filtering (สำเร็จ):**
    *   ปรับปรุง `webhook/route.ts` ให้รับเฉพาะข้อความ LINE OA ที่ผ่าน ticket-flow ของระบบเท่านั้น เพื่อป้องกันแชท "No Ticket" ไหลเข้าเองโดยไม่ตั้งใจ
2.  **Stable Message Sending (สำเร็จ):**
    *   แก้ไขปัญหา Server-action เด้ง Error ใน Production โดยปรับปรุงการส่งข้อความพนักงานให้มีความเสถียรมากขึ้น
    *   ปรับปรุงการแสดงผล Error ให้ละเอียดขึ้น (Detailed Error Display) แทนการค้างที่ "Unknown error"
3.  **Media Schema Hotfix (สำเร็จ):**
    *   แก้ไขปัญหา `media_mime_type` missing (PGRST204)
    *   เพิ่มระบบ Fallback สำหรับไฟล์และรูปภาพในกรณีที่ Schema ฐานข้อมูลยังไม่อัปเดต (`media_path` fallback)
    *   ลดการส่งฟิลด์ `media` ที่ไม่จำเป็นสำหรับข้อความประเภท Text
4.  **Staff Sender Constraint (สำเร็จ):**
    *   แก้ไขปัญหา `chk_message_sender` (23514) โดยบังคับส่ง `staff_id` ทุกครั้งที่ `sender_type='agent'`
    *   ตรวจสอบและเติม `staffId` ให้ครบทุกจุดที่มีการเรียกใช้ (Send message, Upload file, Editor save)
5.  **Database Cleanup (สำเร็จ):**
    *   จัดทำ SQL Script (`cleanup_no_ticket_chat_backlog.sql`) สำหรับทำความสะอาดข้อมูลแชทค้างที่ไม่มีใบงาน (Backlog cleanup)

---

## ✅ สิ่งที่ทำสำเร็จแล้วก่อนหน้า (28 เมษายน 2569)
1.  **CSAT Mismatch Standardization (สำเร็จ):**
    *   ปรับปรุง `analyticsService.ts` ให้ดึงข้อมูล CSAT จากตาราง `csat_surveys` อย่างถูกต้อง (Fix missing join)
    *   Standardize การใช้ฟิลด์ `score` เป็นค่าหลัก (Canonical) แทน `rating` ในหน้า Analytics, Survey และ Portal
    *   รองรับข้อมูลเก่าโดยใช้ `rating` เป็น fallback
2.  **Role-Based Access for Audit Logs (สำเร็จ):**
    *   จำกัดสิทธิ์การเข้าถึงและการล้าง Log (Clear Logs) ให้เฉพาะผู้ที่มีบทบาทเป็น `Administrator` เท่านั้น
    *   ปรับปรุง UI ในหน้า `settings/audit` ให้ซ่อนปุ่มจัดการสำหรับเจ้าหน้าที่ทั่วไป
3.  **Customer Normalization (สำเร็จ):**
    *   ปรับโครงสร้างตาราง `customers` ให้เป็นมาตรฐาน
    *   แก้ไข Logic การรับข้อมูลจาก LINE ให้บันทึกข้อมูลเข้าตาราง `customers` อย่างถูกต้อง
4.  **Message Polymorphism (สำเร็จ):**
    *   แยกฟิลด์ `media_path` และ `media_mime_type` ออกจาก `content` เพื่อความยืดหยุ่นในการเก็บข้อมูลสื่อ
    *   ปรับปรุง Chat UI ใน `ChatWindow.tsx` และ `TicketChat.tsx` ให้รองรับการแสดงผลสื่อจากฟิลด์ใหม่โดยอัตโนมัติ
5.  **Module Permission Removal (สำเร็จ):**
    *   นำการกำหนดสิทธิ์แยกตามโมดูล (โมดูล: ห้องทำงานแพทย์, ฯลฯ) ออกจากระบบ Staff Management เนื่องจากไม่จำเป็นต้องใช้
6.  **SLA Infrastructure & E2E Testing (สำเร็จ):**
    *   เพิ่มคอลัมน์ `sla_due_at` ในตาราง `tickets` และรัน Migration สำเร็จ
    *   ทดสอบ E2E Flow (LINE -> Ticket -> Resolve -> Survey) สำเร็จ 100%
    *   ตรวจสอบ Toaster Notification สำหรับ SLA Warning ทำงานได้ถูกต้องบน UI จริง
7.  **Performance & Cache Optimization (โดย Codex - Commit fde2887):**
    *   **Analytics PDF Export:** ย้ายการ Export ออกจาก Client-side ไปยัง API (`/api/reports/analytics/export-pdf`) เพื่อลดภาระ Main-thread และป้องกัน UI ค้าง
    *   **Standardized Cache Policy:** วางระบบ Cache Policy (TTL) และ Live Cache Utility (`src/lib/cache/policy.ts`, `liveCache.ts`)
    *   **Cache Invalidation:** ผูกระบบล้าง Cache หลัง Mutation สำคัญ (Tickets, Messages, Webhook) เพื่อป้องกันข้อมูลค้าง
    *   **Optimized Routes:** ปรับปรุง `/api/dashboard/summary` และ Report Preview ให้ใช้ Policy ใหม่

---

## 🚀 สิ่งที่ยังเหลือ (Next Actions)
- Tickets/Inbox list query optimization (Select เฉพาะฟิลด์ + Pagination)
- ตรวจสอบ Export path อื่นๆ ที่ยังเป็น Client-heavy
- Dashboard/report widget cleanup (Lazy loading/Bundle cleanup)
- วัดผล Performance หลัง Optimize รอบถัดไป

---

## บันทึกก่อนหน้า (27 เมษายน 2569)
1. **Hospital Abbreviation System (CRUD):**
   * ปรับปรุงฐานข้อมูลเพิ่มฟิลด์ `abbreviation` (ตัวย่อ) ให้กับข้อมูลโรงพยาบาล
   * พัฒนาหน้าจอจัดการข้อมูล (Master Settings) ให้สามารถ **เพิ่ม/แก้ไข/ลบ** ตัวย่อได้ เพื่อใช้สำหรับดึงข้อมูลลงรายงาน (Report Hub) ให้มีความสั้นกระชับ
2. **Secure Audit Log Clearing (Administrator Only):**
   * เพิ่มปุ่ม **"ล้างข้อมูลบันทึกทั้งหมด" (Clear Logs)** สำหรับผู้ดูแลระบบ (Administrator) เพื่อล้างข้อมูลบันทึกระบบและบันทึกใบงานที่เก่าแล้ว
   * พัฒนา **Server Actions** (`clearSystemLogsAction`, `clearTicketLogsAction`) พร้อมระบบตรวจสอบสิทธิ์ที่เข้มงวดเพื่อความปลอดภัยสูงสุด
   * จัดทำระบบแจ้งเตือนยืนยันการลบ (Confirmation) และระบบแปลภาษา (i18n) รองรับทั้งไทยและอังกฤษ
3. **Light Theme Visibility & Accessibility Polish:**
   * แก้ไขปัญหา "ฟอนต์สีขาวมองไม่เห็น" ในโหมดธีมสว่าง (Light Theme) ทั่วทั้งระบบ
   * ปรับปรุง Contrast ของช่อง Search, Select Box และ Modal ต่างๆ ให้มีความชัดเจนและเป็นมืออาชีพ
   * ปรับปรุง **Global Scrollbar** ให้มีความโปร่งใสและมองเห็นได้ชัดเจนในทุกสีพื้นหลัง
   * ปรับแต่งสีของปุ่ม Send และสถานะ Live Session ในหน้าแชทให้มีความสม่ำเสมอ
4. **Enhanced Ticket Date & Time Visibility:**
   * เพิ่มคอลัมน์ใหม่ **"วันที่แจ้งงาน"** ในรูปแบบ List View เพื่อให้เห็นวันที่และเวลาแยกกันอย่างชัดเจน และรองรับการจัดเรียง (Sorting)
   * ปรับปรุงการแสดงผลบนบัตรใบงาน (Board View) ให้แสดงทั้งวันที่และเวลา (เช่น `27 เม.ย. 69 • 17:37 น.`)
   * ปรับปรุงหน้าจอรายละเอียดย่อยเพื่อรองรับการแสดงผลข้อมูลที่ครบถ้วนขึ้น
5. **Conversation Lifecycle Fix (Stuck Chat):**
   - **Conversation Lifecycle Integrity (COMPLETE)**: Automated closure on Escalate/Pending.
   - **Old Ticket Accessibility Fix (COMPLETE)**: Resolved "Ticket Not Found" by removing non-existent `avatar_url` and `department` columns from the `tickets/[id]` query.
   - **Reporting Time Visibility (COMPLETE)**: Added timestamps to Board/List/Detail views.
   * ปรับปรุง Server Actions ให้ทำการปิดการสนทนา (Close Conversation) และล้างความเชื่อมโยงกับใบงาน (Clear `current_ticket_id`) โดยอัตโนมัติเมื่อใบงานถูกเปลี่ยนสถานะเป็น Resolved, Escalated หรือ Pending
   * ครอบคลุมทั้งการเปลี่ยนสถานะปกติและการใช้ฟังก์ชัน Transfer Ticket
6. **Vercel Build Stability:**
   * แก้ไขข้อผิดพลาดทางเทคนิค (Missing Loader2 Import) ที่ทำให้ระบบ Build บน Vercel ไม่ผ่าน จนปัจจุบันระบบกลับมา Online พร้อมใช้งาน 100%
7. **Ticket Data Integrity & Retrieval (Preventing Ticket Loss):**
   * **Fix Database Schema**: รัน SQL เพิ่มคอลัมน์ `resolved_at`, `assigned_at`, `resolution_summary` ในตาราง `tickets` เพื่อป้องกันข้อมูลหายขณะปิดงาน
   * **Ticket Guard**: เพิ่ม Unique Index บน `conversations(current_ticket_id)` เฉพาะสถานะ `active` เพื่อป้องกัน 1 ใบงานถูกผูกกับหลายแชท (Data Inconsistency)
   * **Retrieval Fix**: แก้ไข Bug ใน API Query ที่เรียกใช้คอลัมน์ที่ไม่มีอยู่จริง ทำให้ใบงานเก่าๆ แสดงผลเป็น "Ticket Not Found"
8. **Login Security & Access Control:**
   * **Disable Public Registration**: ยกเลิกระบบสมัครสมาชิกใหม่หน้าเว็บ เพื่อให้ Admin เป็นผู้สร้างบัญชีให้เท่านั้น
   * **Disable LINE Login**: ถอดปุ่ม LINE Login ออกจากหน้าหลัก เพื่อใช้ระบบ Internal Account เป็นหลักในการเข้าถึงระบบหลังบ้าน
   * **Rebranding**: เปลี่ยนชื่อระบบเป็น "Neo Support Intelligence" (ระบบ support NeoHos) และเพิ่ม Footer "Powered by NeoNetwork v2.1.2"

---

## บันทึกก่อนหน้า (23 เมษายน 2569)
1. **Secure Escalation (Magic Link v2.0):** ระบบ Unique Token ป้องกันความปลอดภัยขั้นสูง
2. **Dashboard 30-Day Limit:** เพิ่มประสิทธิภาพการโหลดข้อมูลโดยจำกัดประวัติย้อนหลัง
3. **Unified Layout:** ย้ายเมนูธีมและโปรไฟล์ไปไว้ที่มุมขวาบนเพื่อความสะอาดตา
4. **Multi-Chat Architecture:** ปรับปรุงระบบแชทให้แยกตาม Ticket ID (1 Ticket : 1 Chat) อย่างสมบูรณ์

---

## บันทึกก่อนหน้า (21 เมษายน 2569)
1. **Escalation Portal V1:** ระบบ Magic Link ป้องกันด้วย PIN และมินิบอร์ดสำหรับทีมช่าง
2. **Workflow Integrity:** บังคับจบการสนทนาก่อนปิดงาน และปรับปรุงระบบดักจับสถานะที่เสถียรขึ้น
3. **New UI Standard:** ใช้ธีม Neo-Medical Teal เพื่อพรีเมี่ยมและความสบายตา

---

## บันทึกก่อนหน้า (12 เมษายน 2569)
1. **Atomic Sequence:** ระบบรันเลขใบงานแบบป้องกันเลขซ้ำ Duplicate Key 100%
2. **Automated Reporting:** ส่งรายงาน LINE Flex Message ตามสีวันและปีพ.ศ. ไทย
