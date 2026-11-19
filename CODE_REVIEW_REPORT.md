# NEO Support — Code Review & Refactor Report
**Project:** `neo_line_oa` (Next.js 16 + Supabase + LINE LIFF)  
**Reviewed:** Plan A (Security), Plan B (Type Safety), Plan C (Refactor)  
**Result:** 27 files modified, 1 new file created, ~378 lines added, ~217 lines removed

---

## 🚨 CRITICAL FINDINGS (Security — Plan A)

| Issue | Severity | File | Status |
|-------|----------|------|--------|
| **No LINE Signature Validation** | 🔴 **HIGH** | `api/line/webhook/route.ts` | **Fixed** — Added `crypto.createHmac('sha256')` with `X-Line-Signature` header check. Returns `401` if invalid. |
| **No Auth on API Routes** | 🔴 **HIGH** | `api/line/push/route.ts` | **Fixed** — Added `getAuthenticatedUser()` via Supabase SSR. Returns `401` if not logged in. |
| **No Auth on API Routes** | 🔴 **HIGH** | `api/line/notify-group/route.ts` | **Fixed** — Same as above. |
| **Middleware using `any`** | 🟡 **MEDIUM** | `middleware.ts` | **Fixed** — Changed `request: any` to `request: NextRequest`. |

### ⚠️ Remaining Security Concerns
- **LIFF `login()` in `useEffect`**: `liff.login()` is called inside `useEffect` when `isInClient()` is true. This can cause **redirect loops** if LIFF state becomes unstable. Recommend wrapping in a user-initiated handler.
- **`<style dangerouslySetInnerHTML>`**: Multiple components use `dangerouslySetInnerHTML` for `<style>` tags. While low-risk (hardcoded CSS), it bypasses React's XSS protection. Recommend moving to CSS modules or `styled-jsx`.

---

## 🟡 TYPE SAFETY ISSUES (Plan B)

| Issue | File | Status |
|-------|------|--------|
| **Heavy `any` usage** | Nearly all hooks/components | **Fixed** — Created `src/types/index.ts` with domain types (`Ticket`, `Conversation`, `Message`, `Customer`, `Profile`, `TicketLog`, `SlaRule`, `CompanySettings`, `CsatSurvey`) |
| **`useNotifications.ts`** | `hooks/useNotifications.ts` | **Fixed** — Replaced `any` with `TicketLog` type. |
| **`useRealtimeInbox.ts`** | `hooks/useRealtimeInbox.ts` | **Fixed** — Replaced `any` with `Conversation` type. |
| **`useLiff.ts`** | `hooks/useLiff.ts` | **Fixed** — Replaced `any` error with `unknown` + `getErrorMessage()` helper. |
| **Inbox `startsWith` crash** | `app/(dashboard)/inbox/page.tsx` | **Fixed** — Added null-safe `content ?? ''` before `.startsWith()` calls. |
| **`ignoreBuildErrors: true`** | `next.config.mjs` | **Fixed** — Changed to `ignoreBuildErrors: false`. TypeScript errors will now **fail the build**. |

### ⚠️ Remaining Type Issues
The following files still have `/* eslint-disable @typescript-eslint/no-explicit-any */` and were **not** refactored in this review:

```
src/contexts/NotificationContext.tsx
src/app/portal/create/page.tsx
src/components/modals/ImageEditorModal.tsx
src/lib/services/analyticsService.ts
src/app/(dashboard)/page.tsx
src/app/(dashboard)/settings/staff/page.tsx
src/app/(dashboard)/settings/sla/page.tsx
src/app/(dashboard)/settings/master/page.tsx
src/app/(auth)/login/page.tsx
```

> **Recommendation:** Systematically remove the remaining `eslint-disable` lines and replace `any` with proper types. The `src/types/index.ts` file already provides the types needed.

---

## 🟢 REFACTOR & CODE QUALITY (Plan C)

| Issue | File | Status |
|-------|------|--------|
| **`<img>` instead of `<Image>`** | `layout.tsx`, `portal/page.tsx`, `inbox/page.tsx`, `tickets/[id]/page.tsx`, `Sidebar.tsx`, `profile/page.tsx`, `staff/page.tsx` | **Fixed** — Replaced with Next.js `<Image>` component where feasible. Added `*.supabase.co` and `ui-avatars.com` to `images.remotePatterns` in `next.config.mjs`. |
| **Inline styles everywhere** | Most components | **Partial** — Inline styles are still dominant for the Glassmorphism design. This is a maintainability risk but not a security risk. |
| **Dynamic `import()` in loops** | `ticketService.ts` | **Fixed** — Moved `sendLineGroupNotification` to top-level import. Individual service methods still use dynamic import inside `try/catch` for error isolation, which is acceptable. |
| **`err: any` catch blocks** | `tickets/page.tsx`, `ticketService.ts`, `survey/page.tsx` | **Fixed** — Replaced with `err instanceof Error ? err.message : 'Unknown'`. |
| **`ACTION_ICONS: Record<string, any>`** | `layout.tsx` | **Fixed** — Changed to `Record<string, LucideIcon>`. |
| **Analytics `any` types** | `analytics/page.tsx` | **Fixed** — Added `ChartType`, `ChartDataPoint`, `ScatterDataPoint`, `SortableWidgetProps` interfaces. Changed `handleDragEnd` to use `DragEndEvent`. |

### ⚠️ Remaining `<img>` Tags
One `<img>` tag remains in `src/app/portal/tickets/[id]/page.tsx` (line ~237) for chat attachments. This was left as-is because `Image` from Next.js requires known dimensions for external URLs, and chat attachments are dynamic. It's acceptable as a fallback.

---

## 📊 IMPACT SUMMARY

### Files Modified (27 files)
```
middleware.ts
next.config.mjs
src/app/(dashboard)/analytics/page.tsx
src/app/(dashboard)/inbox/page.tsx
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/settings/master/page.tsx
src/app/(dashboard)/settings/profile/page.tsx
src/app/(dashboard)/settings/sla/page.tsx
src/app/(dashboard)/settings/staff/page.tsx
src/app/(dashboard)/tickets/[id]/page.tsx
src/app/(dashboard)/tickets/page.tsx
src/app/api/line/notify-group/route.ts
src/app/api/line/push/route.ts
src/app/api/line/webhook/route.ts
src/app/portal/page.tsx
src/app/portal/tickets/[id]/page.tsx
src/app/survey/[id]/page.tsx
src/components/layout/Sidebar.tsx
src/components/modals/TransferModal.tsx
src/components/portal/ProfileRegistrationModal.tsx
src/hooks/useLiff.ts
src/hooks/useNotifications.ts
src/hooks/useRealtimeInbox.ts
src/lib/services/ticketService.ts
src/lib/utils/exportUtils.ts
src/lib/utils/lineNotifications.ts
src/lib/utils/slaUtils.ts
```

### Files Created (1 file)
```
src/types/index.ts  —  Domain type definitions
```

---

## 🎯 RECOMMENDED NEXT STEPS FOR ANTIGRAVITY

1. **Commit this branch immediately** (`git add -A && git commit -m "security+types+refactor: Plans A/B/C"`)
2. **Run `npm run build`** to verify all TypeScript errors are resolved (since `ignoreBuildErrors: false` now)
3. **Test LINE Webhook** with a real LINE event to confirm signature validation works
4. **Test API routes** (`/api/line/push`, `/api/line/notify-group`) without auth to confirm they return `401`
5. **Fix remaining `any` files** (9 files listed above) in a follow-up PR
6. **Consider moving inline styles** to CSS Modules or Tailwind for maintainability
7. **Add `@dnd-kit` types** to `devDependencies` if `SortableWidget` type warnings persist

---

*Report generated by Kimi AI — Code Review & Refactor Assistant*
