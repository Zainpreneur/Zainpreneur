# Zainpreneur Business OS

Full-stack business command center — React 19 + Hono + PostgreSQL.

## Overview

**Zainpreneur** is a centralized command center to manage owned businesses, equity stakes, and client work.

- **Server:** Hono + Prisma + PostgreSQL — REST API with JWT auth
- **Web:** React 19 + React Query + Tailwind CSS — SPA with lazy-loaded routes
- **Shared:** Types + Zod validation schemas
- **Monorepo:** pnpm workspaces + Turborepo

## Quick Start

```bash
# Prerequisites
# - Node.js 20+
# - PostgreSQL 16+ (or use Docker)

# Install dependencies
pnpm install

# Start PostgreSQL
docker compose up -d postgres

# Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Run migrations + seed
pnpm db:migrate
pnpm db:seed

# Start development servers
pnpm dev
# → API: http://localhost:3000
# → Web: http://localhost:5900
# → Docs: http://localhost:3000/api/docs
```

## Architecture

```
zainpreneur/
├── packages/
│   ├── shared/        Types + Zod validation schemas
│   ├── server/        Hono API + Prisma ORM + PostgreSQL
│   └── web/           React 19 + React Query + Tailwind CSS
├── Dockerfile         Multi-stage Alpine production build
├── docker-compose.yml PostgreSQL + server
└── .github/workflows/ CI pipeline (typecheck + build + test)
```

### packages/server

| Layer | Description |
|-------|-------------|
| Routes (14 modules) | auth, businesses, branches, owners, tasks, transactions, team, assets, procurement, hr, ledger, invoices, dashboard, settings |
| Middleware | JWT auth, error handler, rate limiter, request logger, validation |
| DB | Prisma ORM with 24 models |
| Docs | OpenAPI 3.1 + Swagger UI at /api/docs |
| Tests | Vitest integration tests (48 test cases) |

### packages/web

| Layer | Description |
|-------|-------------|
| Pages (13) | Login, Dashboard, Businesses, BusinessDetail, Owners, Tasks, Team, Assets, Financials, Accounting, Purchasing, Settings, NotFound |
| Components (96) | Common UI, Business forms, Enterprise panels (Billing, Payroll, Procurement, Ledger) |
| State | React Query for server state, AuthContext for JWT auth |
| API Client | Typed fetch wrappers for all 14 API modules |

### packages/shared

- TypeScript types for all entities (User, Business, Owner, Task, Transaction, etc.)
- Zod validation schemas for all API inputs

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | POST /login, POST /register, GET /me |
| Businesses | CRUD + nested branches |
| Owners | CRUD with counts |
| Tasks | CRUD + filters (status, priority, business) |
| Transactions | CRUD + filters (date, category) |
| Team | CRUD |
| Assets | CRUD + deploy/return/status |
| Procurement | Vendors + Purchase Orders |
| HR | Contracts + Timesheets + Payroll |
| Ledger | Trial Balance + P&L + Depreciation |
| Invoices | CRUD + payments + aging report |
| Dashboard | KPI summary |
| Settings | Profile + preferences + data reset |

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start both API and web dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run server integration tests |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |

## Docker

```bash
# Production
docker compose up

# Development (just PostgreSQL)
docker compose up -d postgres
```

## Testing

```bash
# Requires PostgreSQL running with test database
docker compose up -d postgres
psql -U zainpreneur -c "CREATE DATABASE zainpreneur_test;"

DATABASE_URL=postgresql://zainpreneur:zainpreneur_dev@localhost:5432/zainpreneur_test \
  pnpm --filter @zainpreneur/server test
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Server:** Hono 4.7
- **ORM:** Prisma 6.6
- **Database:** PostgreSQL 16
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Frontend:** React 19 + React Router 7
- **Data Fetching:** TanStack React Query 5
- **Styling:** Tailwind CSS 4
- **Build:** Vite 8 + Turborepo
- **Testing:** Vitest 5

## License

Private — Zainpreneur Business OS
