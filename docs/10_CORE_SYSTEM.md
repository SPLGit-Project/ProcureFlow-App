# CORE SYSTEM

> **Purpose**: Provider-agnostic foundation. This document NEVER changes when swapping authentication, deployment, or CI/CD modules.

---

## 1. Application Identity

| Attribute | Value |
|-----------|-------|
| Name | ProcureFlow |
| Type | Progressive Web Application (PWA) |
| Domain | Procurement and Inventory Management |
| Target Users | SPL Services staff |

### Core Capabilities

1. **Purchase Order Workflow**: Create, approve, and track purchase requests through configurable approval chains
2. **Multi-Site Management**: Data isolation per site with user-site assignments
3. **Supplier Integration**: Manage suppliers, catalog items, and auto-mapping between supplier SKUs and internal items
4. **Delivery Tracking**: Record goods receipts against purchase orders
5. **Finance Integration**: Link approved POs to Concur (external finance system)
6. **PWA Features**: Offline capability, installable, push-ready architecture

---

## 2. Technology Stack (Provider-Agnostic View)

### 2.1 Frontend Stack

[OBSERVED: package.json:1-32]

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| UI Framework | React | ^19.2.1 | Component rendering |
| Language | TypeScript | ~5.8.2 | Type safety |
| Build Tool | Vite | ^6.2.0 | Bundling, dev server |
| Router | react-router-dom | ^7.10.1 | Client-side SPA routing |
| Charts | Recharts | ^3.5.1 | Data visualization |
| Icons | lucide-react | ^0.555.0 | Icon library |
| Excel Parser | xlsx | ^0.18.5 | File import/export |
| UUID | uuid | ^13.0.0 | Unique identifiers |
| Drag & Drop | react-dropzone | ^14.3.8 | File upload |

### 2.2 Build Output Contract

[OBSERVED: vite.config.ts:1-90, package.json:6-12]

| Aspect | Value | Evidence |
|--------|-------|----------|
| Output directory | `dist/` | [DERIVED: Vite default] |
| Build command | `npm run build:prod` | [OBSERVED: package.json:9] |
| Build steps | `tsc && vite build --mode production` | [OBSERVED: package.json:11] |
| Chunk strategy | vendor/ui/db splits | [OBSERVED: vite.config.ts:76-80] |
| Cache busting | Content-based hashing | [OBSERVED: vite.config.ts:72-74] |
| Dev server port | 3000 | [OBSERVED: vite.config.ts:54] |

### 2.3 Routing Model

[OBSERVED: App.tsx, package.json:20]

| Aspect | Value |
|--------|-------|
| Type | Client-side SPA |
| Library | React Router DOM v7 |
| Mode | BrowserRouter (HTML5 History API) |
| Lazy loading | Yes, via `React.lazy()` |

---

## 3. Application Architecture

### 3.1 Entry Point Structure

[OBSERVED: App.tsx]

```
AppProvider (Context)
  └── BrowserRouter
        └── Routes
              ├── /login → Login
              ├── /pending-approval → OnboardingWizard
              └── / → RequireAuth → Layout
                    ├── index → Dashboard
                    ├── requests → POList
                    ├── create → POCreate
                    ├── requests/:id → PODetail
                    ├── finance → FinanceView
                    ├── settings → Settings
                    └── ... (other routes)
```

### 3.2 State Management

[OBSERVED: context/AppContext.tsx:1-1943]

Central `AppContext` provides:

| Category | State Items |
|----------|-------------|
| Authentication | `user`, `isAuthenticated`, `isLoadingAuth`, `isPendingApproval` |
| Data | `sites`, `users`, `suppliers`, `items`, `purchaseOrders`, `workflowSteps` |
| UI | `theme`, `branding`, `activeSiteIds` |
| Actions | `login()`, `logout()`, `refreshUsers()`, `refreshItems()`, etc. |

### 3.3 Data Flow

1. **Initial Load**: `AppContext` checks session, fetches user data
2. **Site Selection**: User selects sites, stored in `localStorage` as `activeSiteIds`
3. **Data Filtering**: All data queries filter by `activeSiteIds`
4. **Mutations**: Via `db.ts` functions → Database → Optimistic UI updates

### 3.4 Lazy Loading

[OBSERVED: App.tsx]

Heavy components are lazy-loaded for performance:
```typescript
const Dashboard = lazy(() => import('./components/Dashboard'));
const POList = lazy(() => import('./components/POList'));
// ... etc
```

---

## 4. Repository Structure

```
ProcureFlow-App/
├── .github/
│   └── workflows/                          # CI/CD (module-specific)
├── components/                             # React components (31 files)
│   ├── Layout.tsx                          # Main layout wrapper
│   ├── Login.tsx                           # SSO login page
│   ├── Dashboard.tsx                       # Main dashboard
│   ├── POList.tsx                          # Purchase order list
│   ├── POCreate.tsx                        # Create new PO
│   ├── PODetail.tsx                        # PO detail view
│   ├── Settings.tsx                        # Admin settings panel
│   ├── FinanceView.tsx                     # Finance/Concur linking
│   ├── OnboardingWizard.tsx                # Pending approval state
│   └── ...                                 # Other feature components
├── context/
│   └── AppContext.tsx                      # Global state & auth (1943 lines)
├── lib/
│   └── supabaseClient.ts                   # Database client initialization
├── services/
│   └── db.ts                               # Data access layer (1457 lines)
├── utils/
│   ├── normalization.ts                    # Item code normalization
│   ├── fileParser.ts                       # Excel/CSV parsing
│   ├── hierarchyManager.ts                 # Category hierarchy logic
│   └── ...                                 # Other utilities
├── public/
│   ├── manifest.json                       # PWA manifest
│   ├── sw.js                               # Service worker
│   └── icons/                              # PWA icons
├── supabase/
│   └── migrations/                         # Database migrations
├── App.tsx                                 # Root component & routing
├── main.tsx                                # React entry point
├── index.html                              # HTML entry point
├── types.ts                                # TypeScript interfaces (415 lines)
├── schema.sql                              # Database schema DDL (326 lines)
├── seed.sql                                # Sample data for dev (113 lines)
├── vite.config.ts                          # Vite build configuration
├── tsconfig.json                           # TypeScript configuration
└── package.json                            # Dependencies & scripts
```

---

## 5. Module Boundaries

### 5.1 AUTH Module Interface

The core system expects an authentication provider that:
- Establishes user sessions
- Provides user identity (email, name, ID)
- Integrates with the `users` table for authorization
- Enforces domain restrictions

See: `11_CORE_DATA_CONTRACT.md` Section 2 (users table)

### 5.2 DEPLOY Module Interface

The core system produces:
- Static `dist/` directory with SPA bundle
- `version.json` file with git hash

The deploy module MUST:
- Serve static files from `dist/`
- Handle SPA routing (fallback to `index.html`)
- Expose port 8080 (or configure appropriately)

### 5.3 CICD Module Interface

The core system requires:
- Build command: `npm run build` (runs `tsc && vite build --mode production`)
- Artifact: `dist/` directory
- Environment variables: See Section 6

### 5.4 PWA Module Interface

The core system provides hooks for:
- Service worker registration in `App.tsx`
- Manifest in `public/manifest.json`
- Version file generation in `vite.config.ts`

---

## 6. Environment Variable Contract

### 6.1 Required Variables

| Variable | Purpose | Consumed By |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | Database API endpoint | `lib/supabaseClient.ts` |
| `VITE_SUPABASE_ANON_KEY` | Database public key | `lib/supabaseClient.ts` |

[OBSERVED: lib/supabaseClient.ts:4-5]

### 6.2 Optional Variables

| Variable | Purpose | Consumed By |
|----------|---------|-------------|
| `GEMINI_API_KEY` | AI mapping features | `vite.config.ts` (build-time) |

[OBSERVED: vite.config.ts:59-61]

### 6.3 Injection Contract

| Context | Method |
|---------|--------|
| Local Dev | `.env` / `.env.local` via Vite loadEnv |
| Build | Environment variables at build time |
| Runtime | Baked into JS bundle via `import.meta.env.*` |

**CRITICAL INVARIANT**: Variables are baked into the bundle at build time. NOT runtime-configurable.

### 6.4 Template: .env.local

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GEMINI_API_KEY=AIza... (optional)
```

---

## 7. Business Logic: PO Status Workflow

[OBSERVED: types.ts, context/AppContext.tsx]

```
DRAFT → PENDING → APPROVED → APPROVED_PENDING_CONCUR → ACTIVE → COMPLETED
                ↘ REJECTED
```

| Status | Meaning |
|--------|---------|
| `DRAFT` | Saved but not submitted |
| `PENDING` | Awaiting approval |
| `APPROVED` | Approved, awaiting Concur link |
| `APPROVED_PENDING_CONCUR` | Approved, Concur PO number pending |
| `ACTIVE` | Concur linked, ready for delivery |
| `COMPLETED` | All items delivered |
| `REJECTED` | Approval denied |

---

## 8. Business Logic: Mapping Engine

[OBSERVED: services/db.ts]

The auto-mapping system (`db.runAutoMapping`) matches supplier SKUs to internal items.

### Scoring Components

| Type | Max Score | Criteria |
|------|-----------|----------|
| ID_MATCH_NORM | 1.0 | Exact normalized code match |
| ID_MATCH_SKU | 1.0 | Exact SKU match |
| ID_MATCH_ALT | 0.9 | Alternate code match |
| TEXT_SIMILARITY | 0.5 | Jaccard similarity on names |
| ATTR_CATEGORY | 0.2 | Category match |
| FINANCE_PROXIMITY | 0.1 | Price within 10% |
| GLOBAL_CONSENSUS | 0.5 | Confirmed by other suppliers |

### Thresholds

| Score | Result |
|-------|--------|
| ≥ 1.2 | `CONFIRMED` (auto-approved) |
| > 0.4 | `PROPOSED` (needs review) |

### Item Code Normalization

[OBSERVED: utils/normalization.ts]

1. Trim whitespace
2. Convert to uppercase
3. Remove spaces, hyphens, underscores
4. Generate alternate form (strip leading 'R' if applicable)

---

## 9. Core Invariants

These MUST remain true regardless of module swaps:

| # | Invariant | Verification |
|---|-----------|--------------|
| 1 | Build produces `dist/` directory | `ls dist/` after build |
| 2 | `version.json` included in `dist/` | `ls dist/version.json` |
| 3 | SPA routing requires fallback | All routes return `index.html` |
| 4 | Environment variables baked at build | `import.meta.env.*` works |
| 5 | Users table stores site assignments | `users.site_ids` column exists |
| 6 | Multi-site filtering is app-level | No RLS on sites yet |
| 7 | Session stored in localStorage | `sb-*-auth-token` key |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-02-08 |
| Source | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md`, `REPLICATION_BLUEPRINT.md` |
| Canonical Truth | `SYSTEM_ARCHITECTURE_COMPLETION_v3.md` |
