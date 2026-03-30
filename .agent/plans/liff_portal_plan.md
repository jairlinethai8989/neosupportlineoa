# Implementation Plan: LIFF Customer Status Portal

This plan outlines the steps to create a customer-facing portal using LINE LIFF (LINE Front-end Framework).

## 📊 Objective
To reduce LINE Messaging API quota consumption by providing customers with a self-service portal to check ticket status and manage their profile, integrated directly into the LINE Rich Menu.

## 🛠️ Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase
- **Mobile SDK**: @line/liff
- **Design**: Premium Glassmorphism (consistent with Agent Dashboard)

---

## 📅 Roadmap

### Phase 1: Setup & Authentication
- [ ] Install `@line/liff` dependency.
- [ ] Create `src/hooks/useLiff.ts` for LIFF initialization and profile mapping.
- [ ] Create `src/app/portal/auth-check.tsx` to ensure users are identified via LINE.

### Phase 2: Design & Routing
- [ ] Create `src/app/portal/layout.tsx`: Mobile-first layout with customer branding.
- [ ] Create `src/app/portal/page.tsx`: The "My Support" dashboard.
- [ ] Create `src/app/portal/tickets/[id]/page.tsx`: Detailed ticket tracking.

### Phase 3: Core Features
- [ ] **Live Ticket Status**: Visual progress bar for tickets (Pending -> Assigned -> Resolved).
- [ ] **Agent Assignment**: Show which agent is handling the request (with avatar).
- [ ] **History**: View past resolved tickets.
- [ ] **Profile Update**: Allow users to sync/update their display name.

### Phase 4: Rich Menu Integration
- [ ] Instructions for setting up the LIFF URL in LINE Developers Console.
- [ ] Template for the Rich Menu button design.

---

## 🎨 Design Reference
- **Theme**: Dark mode, Glassmorphism.
- **Color Palette**: Primary (#00F2FE), Success (#00FF87), Danger (#FF4D4D).
- **Typography**: Inter / Outfit.

## ⚠️ Known Constraints
- LIFF must be accessed via a mobile device or LINE Desktop for full functionality.
- Requires `LIFF_ID` to be configured in `.env.local`.

---

## 🚀 Execution (Step 1)
I will start by installing the LIFF SDK and creating the authentication hook.
