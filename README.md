# Zainpreneur

A personal business-portfolio command center for tracking owned companies, equity stakes and client ventures — with multi-stakeholder cap tables, multi-branch roll-ups and a real-time financial calculation engine.

## Features

- **Business models** — every venture is driven by one of three operating models, each with its own metrics and management view:
  - `project` — milestones, deliverables and project budgets
  - `consulting` — billable hours, retainers, utilization and contracts
  - `equity` — cap table, valuation and dividends
- **Cap tables** — assign multiple owners with equity percentages, roles and a primary holder. Percentages validate live against 100%.
- **Multi-branch operations** — each business can hold many branches (with status, location, revenue, expenses and staff). Headline figures roll up automatically from non-closed branches.
- **Calculation engine** (`src/utils/calculations.ts`) — consolidated financials, enterprise value, user net share, user net asset value, model-specific metrics, owner aggregates and portfolio roll-ups.
- **Owner directory** — cumulative equity, proportional net worth and monthly net share per stakeholder.
- **Financials** — consolidated branch distribution table with your net user share and dividend columns.
- **Dashboard** — portfolio valuation, net worth, net monthly share and revenue-by-category insights.
- **Persistence** — state is stored in `localStorage` (`zainpreneur:data:v3`).
- **Theme** — light/dark mode, currency and notification settings.

## Tech Stack

- React 19 + TypeScript (strict)
- Vite 8
- React Router 7
- Tailwind CSS v4
- Recharts-based charts, lucide-react icons
- Oxlint

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

### Demo login

Authentication is mocked locally. Use any valid email with a password of at least 4 characters, or:

- **Email:** `zain@zainpreneur.io`
- **Password:** `zain123`

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production build |

## Project Structure

```
src/
  components/     UI, layout and business feature components
  context/        Business data store (cap tables, branches, CRUD) + auth
  data/           Seeded businesses, owners, branches, transactions, series
  pages/          Dashboard, Businesses, Business Detail, Owners, Financials, Tasks, Settings
  types/          Domain types (Business, Owner/OwnerShare, Branch, models)
  utils/          calculations engine, formatting, meta maps, stats
```

## Notes

All data is local and resettable from **Settings**. Deleting an owner unassigns them from every cap table; deleting a business cascades to its transactions, tasks and activity.
