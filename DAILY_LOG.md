# บันทึกความคืบหน้าโครงการ NeoSupport V2.0 (ล่าสุด 16 พฤษภาคม 2569)

## ✅ สิ่งที่ทำสำเร็จแล้วในวันนี้ (16 พฤษภาคม 2569)

1.  **Persistent Notification Settings (สำเร็จ):**
    *   **Per-User Preferences:** พัฒนาระบบบันทึกการตั้งค่าแจ้งเตือนลงฐานข้อมูล (ตาราง `profiles`) แทนการใช้ `localStorage` ทำให้การตั้งค่า (เปิด/ปิดเสียง, โหมดเสียง, ไฟล์เสียง) ติดตัวผู้ใช้งานไปทุกเครื่อง
    *   **Granular Event Toggles:** เพิ่มตัวเลือกให้ผู้ใช้เปิดหรือปิดการแจ้งเตือนแยกตามประเภทเหตุการณ์ได้แก่:
        *   ใบงานใหม่ (New Ticket)
        *   ข้อความใหม่จากลูกค้า (New Message)
        *   ใบงานที่โอนมา (Transferred Ticket)
        *   แจ้งเตือน SLA (SLA Warning/Breach)
    *   **Real-time Synchronization:** ปรับปรุง `useNotifications` Hook ให้ดึงค่าจากฐานข้อมูลและตรวจสอบเงื่อนไขความพึงพอใจก่อนแสดงผล Alert/Sound
    *   **Settings UI Expansion:** เพิ่มส่วน "เหตุการณ์ที่แจ้งเตือน" ในหน้าตั้งค่าพร้อมระบบสลับภาษา TH/EN สมบูรณ์
2.  **Database Migration (สำเร็จ):**
    *   จัดทำและรัน SQL Migration เพิ่มคอลัมน์ตั้งค่าแจ้งเตือน 7 รายการในตาราง `profiles` เพื่อรองรับการเก็บข้อมูลถาวร

---

## ✅ สิ่งที่ทำสำเร็จแล้วเมื่อวาน (15 พฤษภาคม 2569)

1.  **Ticket Board Workspace & UI Optimization (สำเร็จ):**
    *   **Compact Ticket Card:** ออกแบบการ์ดใบงานใหม่ให้มีความกระชับขึ้น (ลดความสูงลง ~40%) เพื่อเพิ่มพื้นที่การมองเห็นใบงานในหนึ่งหน้าจอ
    *   **Icon-based Actions:** ย้ายปุ่ม "รับงาน" และ "เปิดแชท" มาเป็นปุ่มไอคอน (⚡️ และ 💬) ในแถบ Footer ของการ์ด เพื่อประหยัดพื้นที่
    *   **Top Scroll Bar Sync:** เพิ่มแถบเลื่อน (Scroll Bar) ด้านบนของบอร์ดที่ทำงานสัมพันธ์กับด้านล่าง ช่วยให้เลื่อนดูคอลัมน์ต่างๆ ได้ทันที
    *   **Top Pagination:** ย้ายระบบจัดการหน้าใบงาน (Pagination) จากด้านล่างสุดขึ้นมาไว้ด้านบนเพื่อความสะดวก
    *   **Real-time Ticket Age:** เพิ่มตัวนับเวลา (⏱️) แสดงระยะเวลาที่เปิดใบงานแบบเรียลไทม์บนหน้าการ์ด
    *   **Workspace Pagination:** จำกัดการแสดงผล 10 ใบงานต่อหน้า เพื่อความรวดเร็วในการโหลดข้อมูล
2.  **Notification & UX Refinements (สำเร็จ):**
    *   **Toast Relocation:** ย้ายตำแหน่งการแจ้งเตือน (Toast) จากมุมขวาล่างไปไว้ที่มุมขวาบน เพื่อไม่ให้บังปุ่มแชทหรือองค์ประกอบสำคัญอื่นๆ
    *   **Role-based Tooltips:** เพิ่มระบบ Tooltip เมื่อเอาเมาส์ชี้ที่ส่วน "ผู้แจ้งงาน" และ "ผู้รับงาน" เพื่อระบุบทบาทอย่างชัดเจน
    *   **Global Icon Visibility:** ปรับปรุงให้ไอคอนผู้รับงานปรากฏในทุกใบงาน แม้ยังไม่มีผู้รับงาน (แสดงสถานะว่าง) เพื่อความเป็นระเบียบ
3.  **Stability & Build Fixes (สำเร็จ):**
    *   **Syntax & Build Protection:** แก้ไขปัญหา Syntax ใน `TicketsBoard.tsx` และปรับปรุง TypeScript Type ในส่วนของ Scroll Sync ให้รองรับ Null-safety
    *   **CI/CD Alignment:** ยืนยันความสำเร็จของการ Build บน Production (Vercel) หลังการแก้ไข Type mismatch

---

## ✅ สิ่งที่ทำสำเร็จแล้วก่อนหน้า (1 พฤษภาคม 2569)

1.  **Customer Meta UI & Inbox Sidebar Polish (โดย Codex - Commit fd1778e, dc7df1b):**
    *   **Enhanced Profile Display:** เพิ่มการแสดงผลรูปโปรไฟล์, Display Name, LINE ID และข้อมูลสังกัด (รพ., แผนก, ตำแหน่ง) ในหน้า Inbox Sidebar
    *   **Optimized Two-Column Layout:** ปรับปรุงโครงสร้าง Grid จาก Auto-fit เป็น Fixed/Flexible structure เพื่อป้องกันคอลัมน์ยุบผิดรูปในหน้าจอที่แคบ
    *   **Skeleton Loading:** เพิ่มสถานะการโหลดข้อมูลลูกค้าให้ดูพรีเมียมและลดการกระตุกของ UI
    *   **Localization Alignment:** แก้ไขปัญหาตัวอักษรเพี้ยนและปรับให้ Label รองรับการสลับภาษา TH/EN อย่างถูกต้อง
2.  **Type Debt & API Hardening (โดย Codex - Commit 8c97e8c):**
    *   **Refactor API Routes:** ปรับปรุงไฟล์ใน `src/app/api/*` (ยกเว้นก้อน reports) จากการใช้ `any` เป็น `unknown` เพื่อความปลอดภัยของข้อมูล (Type-safety)
    *   **Standardized Error Handling:** นำแพตเทิร์นการจัดการ Error มาตรฐานมาใช้ใน API ทุกจุดที่ปรับปรุง
    *   **Hooks Regression Protection:** ปรับปรุง `useInboxConversation`, `useRealtimeInbox` และ `useTicketWorkspace` เพื่อให้ระบบแชทและจัดการใบงานมีความเสถียรสูงสุด
    *   **Lint Debt Cleanup:** เคลียร์ปัญหา Lint ใน `src/lib/*` และ `src/hooks/*` เพื่อลด Technical Debt
    *   **Build Integrity:** ยืนยันความถูกต้องผ่าน `npm run build` และ `eslint` สำเร็จครบถ้วน

---

## ✅ สิ่งที่ทำสำเร็จแล้วก่อนหน้า (30 เมษายน 2569)

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
4.  **UI/UX Refinements in Ticket Workspace (สำเร็จ):**
    *   ปรับปรุงขนาดปุ่ม "สนทนา" (Chat) ในโหมดตาราง (Table View) ให้มีขนาดใหญ่ขึ้นและโดดเด่นเทียบเท่าโหมดบอร์ด
    *   ลดขนาดฟอนต์ของ "เลขใบงาน" ในโหมดตารางเพื่อให้ดูสบายตาขึ้น
    *   เพิ่มความสามารถให้เจ้าหน้าที่แต่ละคนตั้งค่า "สีประจำตัว" (Theme Color) ได้จากเมนู "ตั้งค่าข้อมูลส่วนตัว" (Profile Settings)
    *   แสดงแถบสีพื้นหลังพร้อมชื่อของเจ้าหน้าที่ที่รับงานในโหมดตาราง ตามสีที่เจ้าหน้าที่คนนั้นตั้งค่าไว้

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
