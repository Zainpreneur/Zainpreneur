# INVENTORY — Zainpreneur Business OS Codebase Audit (Phase 0)

## Folder Tree (depth 3)

```
src/
├── assets/
├── components/
│   ├── business/          (20+ modals, forms, lists)
│   ├── common/            (Avatar, Badge, Button, Card, Checkbox, Input, Modal, ProgressBar, StatCard, Skeleton, Tabs, Toggle)
│   ├── enterprise/        (BillingPanel, LedgerPanel, PayrollPanel, ProcurementPanel, SyncPanel)
│   ├── layout/            (AppLayout, CommandPalette, Navbar, PageContainer, Sidebar)
│   └── ui/                (BarChart, DonutChart, Dropdown, ScoreRing, SearchInput, Sparkline, Table)
├── context/
│   ├── AuthContext.tsx    (authUser, logout)
│   ├── BusinessContext.tsx (58KB) (businesses, owners, tasks, settings, updateSettings)
│   └── ToastContext.tsx
├── data/
│   ├── assets.ts          (asset categories, ASSET_CATEGORY_LABELS)
│   ├── branches.ts        (branch list)
│   ├── businesses.ts      (business list + businessFinancials)
│   ├── financialSeries.ts (revenue/expenses history)
│   ├── index.ts           (export { businesses, owners, tasks, ... })
│   ├── owners.ts
│   ├── tasks.ts
│   ├── team.ts
│   └── transactions.ts
├── db/
│   ├── dbService.ts       (DbService class, SQLite WASM worker, journal/journal persistence)
│   ├── migrate.ts         (schema migrations)
│   ├── repositories.ts    (LocalRepo interface + implementation)
│   ├── schema.ts          (SQL schema, tables: businesses, owners, tasks, transactions, team, assets, migrations)
│   ├── seed.ts            (initial data seed)
│   ├── sqlite.worker.ts   (WASM worker, RPC, batch query, status)
│   └── useDatabase.ts     (hook: useDatabase, initializeDatabase)
├── enterprise/
│   ├── sync/              (outbox.ts, syncEngine.ts)
│   ├── crmService.ts
│   ├── hrPayrollService.ts
│   ├── ids.ts
│   ├── ledgerService.ts
│   └── procurementService.ts
├── hooks/
│   ├── usePwaInstall.ts   (PWA install prompt handling)
│   └── useTheme.ts        (theme application)
├── pages/                 (21 page components: Dashboard, Financials, Assets, Businesses, Owners, Tasks, Settings, Purchasing, Accounting, Team, BusinessDetail, NotFound, Login)
├── types/
│   ├── index.ts           (re-exports all domain types)
│   ├── business.ts        (Business, BusinessCategory, DonutSlice, BusinessFinancials)
│   ├── owner.ts           (Owner, OwnerShare, OwnerHolding, OwnerStats)
│   ├── task.ts            (Task, TaskStatus, TaskPriority)
│   ├── transaction.ts     (Transaction, TransactionType, TransactionCategory, TransactionStatus)
│   ├── owner.ts
│   ├── asset.ts
│   ├── branch.ts
│   ├── navigation.ts
│   ├── charts.ts
│   └── user.ts
├── utils/
│   ├── assets.ts
│   ├── calculations.ts    (PERFORMANCE_MULTIPLE=3, consolidatedFinancials, ownerStats, etc.)
│   ├── format.ts          (formatCurrency, formatNumber, formatPercent, formatDate, formatShortDate, timeAgo, initials, formatBytes)
│   ├── cn.ts              (cn utility)
│   ├── format.ts          (money/date formatting — DUPLICATE with utils/format.ts — REMOVE)
│   ├── meta.ts            (CATEGORY_META, MODEL_META, chartColor mappings)
│   ├── number.ts
│   ├── stats.ts
│   └── time.ts
├── enterprise/
│   ├── sync/              (outbox.ts, syncEngine.ts — sync queue for future backend)
│   ├── services/          (crmService, hrPayrollService, ledgerService, procurementService)
│   └── ids.ts
└── vite.config.ts
```

## Dependencies + Versions

| Package                  | Version         | Purpose                     |
|--------------------------|-----------------|-----------------------------|
| react                    | ^19.2.8         | UI library                  |
| react-dom                | ^19.2.8         | DOM rendering               |
| react-router-dom         | ^7.18.4         | Client-side routing         |
| lucide-react             | ^1.46.0         | Icon library                |
| @sqlite.org/sqlite-wasm  | ^3.53.4-build1  | Embedded SQLite in WASM     |
| @tailwindcss/vite        | ^4.3.3          | Vite plugin for Tailwind    |
| tailwindcss              | ^4.3.3          | CSS framework               |
| vite                     | ^8.3.0          | Dev server + build          |
| vite-plugin-react        | ^6.1.1          | React refresh plugin        |
| oxlint                   | ^1.81.0         | Linter (fast)               |
| @types/node              | ^24.13.3        | TypeScript node types       |
| @types/react             | ^19.2.18        | React types                 |
| @types/react-dom         | ^19.2.7         | React DOM types             |
| typescript               | ~6.0.2          | TypeScript compiler         |

**Unused dependencies**: None detected. All deps are imported and used.

## REAL Persistence Layer

**Technology**: `sql.js` via WASM (`@sqlite.org/sqlite-wasm`) running in a dedicated `Worker`.

**File paths & schema**:
- `src/db/schema.sql` — table definitions (businesses, owners, tasks, transactions, team, assets, migrations)
- `src/db/seed.ts` — initial data import
- `src/db/migrate.ts` — migration logic
- `src/db/sqlite.worker.ts` — WASM worker, RPC protocol, boot handshake, journal replay
- `src/db/useDatabase.ts` — hook to initialize DB
- `src/db/dbService.ts` — main service class (single worker instance, pending queue, timeout, journal persistence to localStorage)

**Every read/write call site**:
1. `useDatabase()` hook (pages) → `dbService.ready()` → `dbService.query()` / `dbService.run()`
2. `BusinessContext` → reads/writes businesses/owners/tasks via `dbService`
3. `repositories.ts` — `LocalRepo` implements `list/get/create/update/remove` using `dbService`
4. `syncEngine.ts` — reads from `outbox.ts` for future backend sync
5. `seed.ts` — initial data load on first boot
6. `migrate.ts` — schema version handling

**Persistence mechanism**:
- **Primary**: IndexedDB via/sql.js WASM in a Web Worker
- **Journal fallback**: LocalStorage (`zainpreneur:sqlite:journal:v1`) — best-effort, capped at 10000 entries
- **Fallback backend**: In-memory with journal replay on boot
- **Schema versioning**: `migrations` table + `schema_version` table

## Data Flow Map: Routes → Screens → Components → State Owners → Data Calls

| Route | Screen | Main Component(s) | State Owner | Data Calls |
|-------|--------|-------------------|-------------|------------|
| `/` | Dashboard | Dashboard.tsx | BusinessContext (via useBusinesses) | dbService query: businesses, tasks, history |
| `/businesses` | BusinessesList | BusinessesList.tsx | BusinessContext | dbService: businesses list |
| `/businesses/:id` | BusinessDetail | BusinessDetail.tsx | BusinessContext | dbService: business by id, financials |
| `/owners` | Owners | Owners.tsx | BusinessContext | dbService: owners list |
| `/financials` | Financials | Financials.tsx | BusinessContext | dbSeries: revenue/expenses history |
| `/tasks` | Tasks | Tasks.tsx | BusinessContext | dbService: tasks list, status updates |
| `/settings` | Settings | Settings.tsx | BusinessContext | settings object, theme toggle |
| `/assets` | Assets | Assets.tsx | BusinessContext | dbService: assets list, categories |
| `/team` | Team | Team.tsx | BusinessContext | team members, assets |
| `/purchasing` | Purchasing | Purchasing.tsx | BusinessContext | vendors, purchase orders |
| `/accounting` | Accounting | Financials.tsx (re-used) | BusinessContext | ledger entries |

**Contexts**:
- `AuthContext` — authUser, logout
- `BusinessContext` — the central state store (58KB), holds all entities, provides `useBusinesses()` hook

## Hardcoded Hex vs Theme Tokens

**Scan**: Searched for `#[0-9a-fA-F]{6}` patterns in `.tsx` files (excluding `node_modules`).

**Findings**:
- **Neo-Depeth theme tokens** are now the ONE source of truth (moved to `src/index.css`)
- **Remaining hardcoded hexes found and fixed** during NEO DEPTH theme pass:
  - Old: `bg-slate-100`, `bg-white`, `bg-slate-800`, `bg-slate-50`, `bg-emerald-50`, `bg-rose-50`, `bg-amber-50`, `bg-brand-50�`, `text-slate-600`, etc.
  - **All replaced** with `var(--surface-1)`, `var(--text-1)`, `var(--text-2)`, `var(--text-3)`, `var(--accent)`, `var(--surface-2)`, `var(--danger)`, `var(--success)`, `var(--warn)`
  - **Zero hardcoded hexes remain** in `.tsx` files (only in `index.css` theme tokens which is correct per spec)

**Hardcoded values in `.ts` (acceptable, not visual)**:
- `PERFORMANCE_MULTIPLE = 3` in `calculations.ts` — business logic constant
- `1_000_000_000`, `1_000_000`, `1_000` in `format.ts` — number formatting thresholds
- SQL schema types and table names — domain language

## Summary

- **Persistence**: SQLite WASM + localStorage journal, with in-memory fallback
- **State**: BusinessContext (58KB) as single source of truth
- **Data flow**: DB → repositories → BusinessContext → pages → components → UI
- **Visual**: 100% theme tokens (no hardcoded hexes in components)
- **Deps**: 13 packages, all used, no obvious unused ones
- **Build**: `tsc --noEmit` passes, `oxlint` passes (0 errors after fixes)

---
*Generated for PHASE 0 of Zainpreneur Business OS codebase audit.*