# W&H Cake & Chocolate — نظام إدارة الفواتير
## Invoice & Order Management System — Mobile App

<div align="center">

![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue)
![Framework](https://img.shields.io/badge/Framework-Expo%20%7C%20React%20Native-61DAFB)
![Languages](https://img.shields.io/badge/Languages-AR%20%7C%20EN%20%7C%20UR%20%7C%20HI-green)
![Firebase](https://img.shields.io/badge/Backend-Firebase%20Firestore-orange)

</div>

---

## Overview

Full-featured invoice and order management system for **W&H Cake & Chocolate** — a multi-department bakery/confectionery. Built with **Expo (React Native)** and **Firebase Firestore** as the backend.

---

## Features

### Cashier
- Create customer invoices with full order details
- Multi-department item routing (Halwa / Mawali / Chocolate / Cake / Packaging)
- Product gallery with search & quantity picker (100+ real products)
- Insurance tray tracking
- Delivery order support
- Photo attachment per order
- Employee accountability trail

### Department Screens
Each department (Halwa, Mawali, Chocolate, Cake, Packaging) has:
- Real-time order queue from Firestore
- Swipe to accept / mark in-progress / delivered
- Branch transfer with reason logging

### Archive
- Full order history with search, filter by dept / status / date
- Expandable order cards with all details

### Reports
- Revenue KPIs (total, today, average order value)
- Revenue breakdown by department (bar chart)
- Payment method distribution (cash / card / transfer)
- Top-selling products ranking
- Filterable by: Today / This Week / This Month / All Time

### Customers (CRM)
- Auto-derived from orders — no extra data entry
- Search by name or phone
- Filter: All / Frequent (3+ orders)
- Purchase history modal per customer

### Delivery Tracking
- Tab-based view: All / Pending / Delivered
- Summary cards (pending vs delivered count)
- Full order details per delivery

### Tray Insurance Management
- Tracks all orders with insurance deposits
- Mark tray as returned (local toggle)
- Summary: total / outstanding / returned trays + insurance amounts

### Admin Panel
Six sub-tabs:
1. **Overview** — Financial stats, operations monitor, cashier performance, recent invoices
2. **Products** — Full CRUD, images, category, sort order, availability toggle
3. **Employees** — Add/remove, role assignment, grouped by role
4. **Offers** — Special discount offers per customer phone
5. **Price Requests** — Approve/reject price change requests from staff
6. **Dept Settings** — Enable/disable any department or feature (synced to Firestore)

---

## Languages

| Code | Language | Script | Direction |
|------|----------|--------|-----------|
| `ar` | العربية | Arabic | RTL |
| `en` | English | Latin | LTR |
| `ur` | اردو | Nastaliq | RTL |
| `hi` | हिंदी | Devanagari | LTR |

Toggle button cycles: AR → EN → UR → HI → AR

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK (React Native) |
| Language | TypeScript |
| Navigation | Expo Router v6 (file-based) |
| Database | Firebase Firestore (real-time) |
| State | React Context API |
| UI | Custom components (no UI library) |
| Icons | @expo/vector-icons (Feather) |
| Fonts | Google Fonts (Inter) |
| Storage | AsyncStorage (session/language prefs) |
| Images | expo-image, expo-image-picker |
| Haptics | expo-haptics |

---

## Project Structure

```
artifacts/invoice-app/
├── app/
│   ├── _layout.tsx              # Root layout — all providers
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigator + shared header
│       ├── cashier.tsx          # Invoice creation screen
│       ├── halwa.tsx            # Wedding sweets dept
│       ├── mawali.tsx           # Savory dept
│       ├── chocolate.tsx        # Chocolate dept
│       ├── cake.tsx             # Cake dept
│       ├── packaging.tsx        # Packaging dept
│       ├── archive.tsx          # Order history
│       ├── reports.tsx          # Analytics & reports
│       ├── customers.tsx        # Customer CRM
│       ├── delivery.tsx         # Delivery tracking
│       ├── trays.tsx            # Tray insurance management
│       └── admin.tsx            # Admin dashboard
├── components/
│   ├── AppHeader.tsx
│   ├── DeptOrderCard.tsx
│   ├── OrderCard.tsx
│   ├── PackagingOrderCard.tsx
│   ├── EmployeeSelectorModal.tsx
│   ├── ProductManagerModal.tsx
│   ├── ProductGalleryModal.tsx
│   ├── BranchTransferModal.tsx
│   ├── DevSettingsModal.tsx
│   ├── EmptyState.tsx
│   └── ErrorBoundary.tsx
├── context/
│   ├── LanguageContext.tsx      # 4-language support (AR/EN/UR/HI)
│   ├── OrdersContext.tsx        # Firestore orders CRUD
│   ├── EmployeeContext.tsx      # Firestore employees + session
│   ├── ProductsContext.tsx      # Firestore products catalog
│   ├── OffersContext.tsx        # Customer discount offers
│   ├── TraysInventoryContext.tsx # Tray tracking derived from orders
│   ├── PriceChangeContext.tsx   # Price change requests workflow
│   └── FeaturesContext.tsx      # Feature flags (Firestore synced)
├── constants/
│   ├── colors.ts                # Design system colors
│   └── translations.ts          # All UI strings in 4 languages
├── lib/
│   └── firebase.ts              # Firebase initialization
└── app.json                     # Expo config
```

---

## Firebase Collections

| Collection | Purpose |
|-----------|---------|
| `orders/` | All customer orders |
| `products/` | Product catalog |
| `employees/` | Staff accounts |
| `counters/orders` | Auto-incrementing order numbers |
| `priceChangeRequests/` | Price adjustment requests |
| `devPortalConfig/appFeatures` | Feature flags |

---

## Environment Variables

Create `.env.local` in the project root:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start Expo development server
pnpm run dev

# Build for iOS (requires EAS CLI)
eas build --platform ios

# Build for Android
eas build --platform android
```

---

## Publishing to App Stores

### Google Play (Android)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS
eas build:configure

# Create production build
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### Apple App Store (iOS)

```bash
# Create production build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

### Required before publishing:
1. Create accounts on [Expo](https://expo.dev) and [EAS](https://expo.dev/eas)
2. Update `app.json` with your `bundleIdentifier` (iOS) and `package` (Android)
3. Set up signing certificates via EAS
4. Add real Firebase credentials in `.env.local`

---

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Navy (Primary) | `#1A2744` | Headers, primary actions |
| Gold | `#C9A84C` | Accents, insurance, highlights |
| Halwa | `#8B5CF6` | Wedding sweets dept |
| Mawali | `#F59E0B` | Savory dept |
| Chocolate | `#92400E` | Chocolate dept |
| Cake | `#EC4899` | Cake dept |
| Packaging | `#14B8A6` | Packaging dept |

---

## Brand

This system is part of the **فوترة / FAWTARA** SaaS platform.  
Tenant: **W&H Cake & Chocolate**

---

*Built with ❤️ — Last synced from Replit workspace*
