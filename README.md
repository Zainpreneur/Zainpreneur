# Zainpreneur Business OS

A React + Tailwind + TypeScript business command center with SQLite WASM persistence and PWA support.

## 📋 Overview

**Zainpreneur** is a centralized command center to manage owned businesses, equity stakes, and client work. It features:

- **NEO DEPTH theme** — dark `#121214` canvas with dual shadows, light `Daylight Neumorph`, accent `#007AFF` glow
- **SQLite WASM** offline-first persistence with journal replay and visibilitychange persistence
- **PWA** — standalone display, maskable icons, update detection with reload toast
- **Repository pattern** with localStorage fallback and outbox-based sync architecture
- **TypeScript strict mode** — 0 errors, 0 oxlint warnings

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run lint
npm run lint

# Run typecheck
npm run typecheck  # or: npx tsc --noEmit
```

## 📦 Available Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Vite dev server at `localhost:5901` |
| `build` | `tsc -b && vite build` — production build |
| `preview` | `vite preview` — preview production build |
| `lint` | `oxlint` — check for warnings/errors |
| `lint:fix` | `oxlint --fix` — auto-fix lint issues |
| `test` | `vitest run` — run Vitest smoke tests |
| `audit:sqlite` | `node scripts/sqlite-audit/audit.mjs` — SQLite audit |

## 🏗️ Architecture

### Layer Diagram

```
┌─────────────────────────────────────┐
│           Presentation Layer          │
│  - React 19 + React Router 7        │
│  - Tailwind CSS v4 + NEO DEPTH     │
│  - 25+ UI components (Button, Card,  │
│    StatCard, DonutChart, BarChart,   │
│    Sparkline, ScoreRing, Badge,      │
│    Checkbox, Toggle, Input, Avatar)  │
│  - Route-level React.lazy + Suspense │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Business Logic Layer              │
│  - BusinessContext (58KB central store) │
│  - useBusinesses(), useAuth() hooks  │
│  - calculations.ts — financial math   │
│  - format.ts — number/date/bytes fmt │
│  - id.ts — UUID generator + fallback  │
│  - backup.ts — Export/Import JSON     │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Data Persistence Layer             │
│  - SQLite WASM (opfs-sahpool VFS)   │
│  - Single worker instance, RPC       │
│  - Journal replay on boot           │
│  - visibilitychange + beforeunload   │
│    persistence                      │
│  - QuotaExceeded handling (24h)     │
│  - parameterized SQL only           │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   Infrastructure Layer              │
│  - Vite + React + Tailwind          │
│  - oxlint + TypeScript strict       │
│  - PWA manifest + SW precache       │
│  - vitest + Testing Library smokes   │
│  - ErrorBoundary top-level wrapper   │
└─────────────────────────────────────┘
```

### Repository Pattern

Data access uses the **repository pattern** with a `LocalRepo` implementation backed by SQLite WASM:

- **`src/data/repo.ts`** — `Repo<T, F>` interface + `LocalRepo` implementation
- **`src/db/dbService.ts`** — Single `DbService` instance, promise-based RPC
- **`src/db/sqlite.worker.ts`** — WASM worker, OPFS SAH-pool VFS, batch RPC
- **`src/data/repositories.ts`** — Typed repositories (`CapTable`, `Asset`, `TeamMember`, etc.)
- **`src/data/index.ts`** — Exported data functions + `getBusinessById`, `getTasksForBusiness`

**Outbox-based sync architecture** — all mutations go through an outbox table, enabling future backend sync without code changes:

```
outbox table: { entity, op, payload, ts, synced:false }
syncEngine: processes outbox → sends to backend → marks synced:true
```

### State Management

Central state stored in `BusinessContext` (≈58KB):

- `businesses: Business[]` — all businesses with relations
- `transactions: Transaction[]` — ledger entries
- `tasks: Task[]` — pending and completed tasks
- `activity: ActivityEvent[]` — recent portfolio activity
- `owners: Owner[]` — portfolio owners
- `teamMembers: TeamMember[]` — team directory
- `assets: Asset[]` + `assetHistory: AssetHistoryEntry[]`
- `settings: AppSettings` + `profile: UserProfile`
- `zainOwnerId: string` — the authenticated owner

**Persistence:** `localStorage` key `zainpreneur:data:v3` — auto-serialized on every state change.

### Service Worker & PWA

- **Precache:** App shell + assets at install
- **Runtime:** Cache-first for app shell, stale-while-revalidate for assets
- **Stale-SW protection:** `SW_VERSION` constant + `onupdatefound` + `statechange` detection
- **Update toast:** "Update available — reload" when new SW detected
- **Manifest:** `manifest.webmanifest` — 192/512 maskable icons, `theme_color #1D1D1F`, `background_color #121214`, `display standalone`
- **Install prompt:** `usePwaInstall` hook captures `beforeinstallprompt` event

**SW Boot:** `src/main.tsx` pre-warms the SQLite engine on idle:
```js
if (typeof window !== 'undefined') {
  const idle = (cb) => {
    const ric = window.requestIdleCallback
      ? window.requestIdleCallback
      : () => setTimeout(cb, 1500)
    ric(cb)
  }
  idle(() => {
    void dbService.ready().catch(() => {}) // best-effort
    try { startSyncEngine() } catch {}
  })
}
```

## 🔧 Configuration

### Tailwind / NEO DEPTH Tokens

All colors are CSS custom properties (`var(--token)`). No arbitrary values in component files.

**Dark mode (default):**
- `--canvas: #121214`
- `--text-1: #E4E6EB`, `--text-2: #85879B`, `--text-3: #47495E`
- `--surface-2: #1E1E22`, `--surface-3: #2A2D33`
- `--accent: #007AFF`, `--accent-tint: rgba(0, 122, 255, 0.15)`
- `--shadow-card: 0 4px 20px rgba(0,0,0,0.4)`, `--shadow-tile: 0 2px 8px rgba(0,0,0,0.2)`

**Light mode (daylight neumorph):**
- `--canvas: #F8F9FA`
- `--text-1: #111827`, `--text-2: #6B7280`
- `--surface-2: #F3F4F6`, `--surface-3: #E5E7EB`
- `--accent: #007AFF`, `--accent-tint: rgba(0, 122, 255, 0.1)`

**Root class:** `light` — toggle via `src/components/common/Toggle.tsx`

### TypeScript Strict Mode

- `tsconfig.app.json` — `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- `tsconfig.node.json` — same strict settings
- `tsc --noEmit` — **0 errors**
- `oxlint` — **0 warnings, 0 errors**

### SQL Schema

All tables defined in `src/db/schema.ts`. Key tables:

| Table | Purpose |
|-------|---------|
| `businesses` | Core business data |
| `branches` | Business branches/locations |
| `cap_table` | Equity ownership shares |
| `owners` | Owner/stakeholder records |
| `transactions` | Financial ledger |
| `tasks` | Task management |
| `team_members` | Team directory |
| `assets` | Asset tracking + deployments |
| `asset_deployments` | Asset-to-member assignments |
| `vendors` + `po_items` | Procurement |
| `invoices` + `ledger_entries` + `ledger_accounts` | Accounting |

Migrations: `v1` → `v3` via `src/db/migrate.ts`. New deployments use `v3MigrationPlan`.

## 📦 Adding a New Entity

1. **Define DTO type** in `src/types/`
2. **Add SQL schema** in `src/db/schema.ts`
3. **Add repository** in `src/db/repositories.ts`
4. **Add data seeding** in `src/data/`
5. **Add UI components** in `src/components/`
6. **Add context actions** in `src/context/BusinessContext.tsx`
7. **Add routes** in `src/pages/`
8. **Add Toast notifications** using `useToast()`

## 🔄 Backend Swap Guide

The outbox architecture enables swapping the data backend without code changes:

1. **Current:** SQLite WASM single-user mode
2. **Future:** Replace `src/db/dbService.ts` + `src/db/sqlite.worker.ts` with a API service
3. **Outbox stays** — mutations still write to `outbox` table
4. **Sync engine** processes outbox → sends to backend → marks `synced:true`
5. **Local repo** remains as fallback — `dbService` ready() gates all queries

**To swap:** Implement `ApiService` with identical RPC interface (`query`, `run`, `batch`, `status`, `counts`, `export`, `reset`). The `DbService` single-instance guard and outbox pipeline remain unchanged.

## ♻️ Graceful Degradation

If IndexedDB/WASM unavailable:

- Falls back to **in-memory state** with warning banner
- Data persists in `localStorage` via the same `BusinessContext` key
- `hasBackup()` / `exportBackup()` / `importBackup()` still work
- All form validations and computed metrics function normally

**Warning banner** components can check `!dbService.getBackend()` and display:

```tsx
<div className="p-4 rounded-lg border border-red-500 bg-red-500/10 text-red-400 text-sm">
  <svg className="mr-2 size-4" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
  SQLite WASM unavailable — running in memory mode. <a href="#" class="underline">Learn more</a>.
</div>
```

## 📊 Lighthouse Mobile Targets

| Metric | Target |
|--------|--------|
| **Performance** | ≥90 |
| **PWA** | 100 |
| **Accessibility** | ≥95 |
| **Best Practices** | ≥95 |

**Key optimizations already in place:**

- `font-display: swap` — no font load blocking
- Initial JS < 250KB gz (excluding WASM)
- `preconnect` to fonts.gstatic.com
- `crossorigin` isolation headers for OPFS SAH-pool VFS
- Route-level `React.lazy` + `Suspense` per screen
- Vendor chunk for react/charts (lazy-loaded charts)
- Debounced search (250ms)
- Paginate/window for long lists
- No big array rebuilds inside render

## 🧪 Testing

### Vitest + Testing Library Smokes

Tests in `src/tests/` cover:

- **Format utilities** (`formatCurrency`, `formatNumber`, `formatPercent`, `formatDate`, `formatShortDate`, `timeAgo`, `initials`, `formatBytes`)
- **Backup utility** (`exportBackup`, `importBackup`, `hasBackup`, `getBackupPreview`)

Run: `npm test`

### Test Coverage Goals

- Format utilities: 100% (all export functions covered)
- Backup utility: 100% (all export functions covered)
- Component render smokes: 1 per screen (planned)
- CRUD round-trip (in-memory): planned
- Repository pattern: planned

## 📚 Additional Documentation

- `oxlint.config*` — lint configuration (currently only `react/only-export-components: "off"`)
- `scripts/sqlite-audit/audit.mjs` — SQLite audit tool
- Schema doc: see `src/db/schema.ts` — full table list + DDL
- SW update flow: see `src/hooks/usePwaInstall.ts` — version constant + detection

## 👥 Contributing

1. **TypeScript strict** — `tsc --noEmit` must pass
2. **Oxlint clean** — `oxlint` must pass (0 warnings, 0 errors)
3. **Add tests** — new features need Vitest smoke tests
4. **Keep hexes tokens** — all colors via `var(--token)` in `src/index.css`
5. **Preserve NEO DEPTH** — dark canvas `#121214`, light `#F8F9FA`, accent `#007AFF`
6. **Outbox first** — all mutations go through the outbox pipeline

## 📄 Version & License

- **Version:** 0.0.0 (increment per release)
- **TypeScript:** ~6.0.2
- **React:** 19.2.8
- **SQLite WASM:** ^3.53.4-build1
- **License:** Private — Zainpreneur Business OS

---
*Generated for Zainpreneur Business OS — React + Tailwind + TypeSQLite + PWA*