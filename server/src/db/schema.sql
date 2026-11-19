PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stakeholders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  kind        TEXT    NOT NULL DEFAULT 'individual',
  -- 14. The role this party plays - an employee, a freelancer, a supplier, a
  -- hosting provider. Optional, and validated against the kind: a vocabulary
  -- for people and a different one for organizations.
  role        TEXT    NOT NULL DEFAULT '',
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- The business entity. There is deliberately no single owner column: a business
-- has as many owners as it has stakeholders, and they live in
-- business_stakeholders with a relationship and a percentage each. A one-field
-- "owner" is the mistake this schema exists to avoid.
CREATE TABLE IF NOT EXISTS businesses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,          -- the trading name
  legal_name  TEXT    NOT NULL DEFAULT '',      -- the registered entity
  -- The legal form: Ltd, PLC, LLP, sole trader.
  -- Renamed from `business_type` because that name was also the query parameter
  -- for a *relationship* filter, so one identifier meant two things. A free-text
  -- column and a filter over a closed vocabulary now have different names.
  legal_form  TEXT    NOT NULL DEFAULT '',
  industry    TEXT    NOT NULL DEFAULT '',      -- was "sector"
  reg_no      TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  website     TEXT    NOT NULL DEFAULT '',
  -- Kept alongside business_locations so a list row can show somewhere without
  -- a join; the primary location is the one that is mirrored here.
  city        TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  -- Five states, and two of them are claims about ownership that are checked on
  -- save: a prospect holds no equity, and an exited business holds none for the
  -- portfolio owner. See check_business_status.
  status      TEXT    NOT NULL DEFAULT 'prospect'
                CHECK (status IN ('prospect','active','inactive','closed','exited')),
  -- The declared kind of relationship: ownership shape only.
  -- Whether Zainpreneur *serves* this business is the separate `served` flag
  -- below. There is deliberately no 'client_equity': a business you serve and
  -- hold part of is simply 'equity', and the "Client + Equity" badge is derived
  -- at read time rather than stored. The original stored that label and derived
  -- it wrongly -- from every stakeholder's links rather than Zainpreneur's -- so
  -- businesses served at 0% equity were reported as part owners.
  relationship_type TEXT NOT NULL DEFAULT 'equity'
                CHECK (relationship_type IN ('client','equity','fully_owned')),
  -- Zainpreneur serves this business. A recorded fact, not a derivation: it is
  -- true whether or not a service request exists this month, which is precisely
  -- why it cannot be derived from requests.
  served       INTEGER NOT NULL DEFAULT 0,
  -- The currency this business's own figures are reported in. Blank until set;
  -- no monetary column is ever silently added across currencies.
  reporting_currency TEXT NOT NULL DEFAULT '',
  -- Latest mark of the company's equity value, and when it was struck.
  -- NULL means "no current mark": an open holding is then reported at cost
  -- rather than being given a value nobody can support.
  valuation   REAL,
  valued_on   TEXT,
  founded_on  TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  -- F3. Parked rather than thrown away: NULL is a live row, a timestamp is one
  -- waiting in Trash to be restored or taken the rest of the way out.
  deleted_at  TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- Where a business is. A separate table because "Nairobi, Kenya" as one field
-- cannot say whether it is an office, a warehouse or a leased site, and a car
-- wash has a site long before it has an office.
CREATE TABLE IF NOT EXISTS business_locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'site',
  address     TEXT    NOT NULL DEFAULT '',
  city        TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  is_primary  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- The paperwork. Typed, because "the incorporation certificate" and "the lease
-- for the Mombasa site" are different things and one of them expires.
CREATE TABLE IF NOT EXISTS business_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'other',
  reference   TEXT    NOT NULL DEFAULT '',
  notes       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- Business <-> Stakeholder relationship (business level, kept separate from branches)
-- A closed position is kept, not deleted: a sale must stay distinguishable
-- from never having invested. `exited_on IS NULL` is the single definition of
-- "current", so there is no second flag that can disagree with it.
-- invested_on / exited_on are ISO dates. amount is capital contributed (cost
-- basis) and proceeds is what came back on a sale, so a realised multiple can
-- be derived rather than typed in twice. Percentages remain authoritative for
-- ownership - money is not a share.
CREATE TABLE IF NOT EXISTS business_stakeholders (
  business_id     INTEGER NOT NULL REFERENCES businesses(id)   ON DELETE CASCADE,
  stakeholder_id  INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  relationship    TEXT    NOT NULL,
  equity          REAL    NOT NULL DEFAULT 0,
  is_equity       INTEGER NOT NULL DEFAULT 0,
  role            TEXT    NOT NULL DEFAULT '',
  invested_on     TEXT,
  exited_on       TEXT,
  transferred_to  INTEGER REFERENCES stakeholders(id),
  amount          REAL,
  proceeds        REAL,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,
  rev             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS branches (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL DEFAULT '',
  city        TEXT    NOT NULL DEFAULT '',
  country     TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'active',
  -- Branch lifecycle. Closing freezes the branch: it stops counting as active
  -- and remembers when it closed, but its stakeholders, its equity and any
  -- closed periods are all left exactly as they were.
  is_active   INTEGER NOT NULL DEFAULT 1,
  closed_at   TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id, name)
);

-- Branch <-> Stakeholder relationship (independent allocation per branch)
CREATE TABLE IF NOT EXISTS branch_stakeholders (
  branch_id      INTEGER NOT NULL REFERENCES branches(id)       ON DELETE CASCADE,
  stakeholder_id INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  relationship   TEXT    NOT NULL DEFAULT 'subsidiary',
  equity         REAL    NOT NULL DEFAULT 0,
  is_equity      INTEGER NOT NULL DEFAULT 0,
  role           TEXT    NOT NULL DEFAULT '',
  invested_on    TEXT,
  exited_on      TEXT,
  transferred_to INTEGER REFERENCES stakeholders(id),
  amount         REAL,
  proceeds       REAL,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  rev            INTEGER NOT NULL DEFAULT 1
);

-- --------------------------------------------------------------------------- #
-- The service module: a reusable catalogue, configurable variants, and the
-- requests raised against them. Kept in its own block so it can be read (and
-- removed) as one unit - nothing in the ownership ledger depends on it.
--
-- A request always belongs to a business in the book, which is what makes a
-- pure client - a business that holds no equity at all - worth recording.
-- "ref" is not stored: it is SR-<id>, derived at render time.
-- --------------------------------------------------------------------------- #

-- What you offer. Reusable across every business you serve.
CREATE TABLE IF NOT EXISTS services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL DEFAULT '',
  category    TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'active',
  deleted_at  TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- The tiers of a service, each optionally priced. The rate lives on the
-- variant, never on the request, so changing a price re-prices the pipeline
-- instead of rewriting history.
CREATE TABLE IF NOT EXISTS service_variants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  code        TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  rate        REAL,
  -- 24/25. What the rate means, and what the tier needs to be delivered.
  -- pricing_model 'quote_required' is the one model with no rate at all:
  -- the work is scoped first and priced after, so a NULL rate is the answer.
  pricing_model   TEXT NOT NULL DEFAULT 'fixed',
  required_skills TEXT NOT NULL DEFAULT '',
  resources       TEXT NOT NULL DEFAULT '',
  availability    TEXT NOT NULL DEFAULT '',
  delivery_model  TEXT NOT NULL DEFAULT '',
  turnaround  TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'active',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- Work raised against a business. "delivery" records *how* it is delivered and
-- the two people behind it: an internal owner, an outsourced provider, or both
-- (which is what makes 'hybrid' mean something rather than being a label).
-- 26/27: `status` walks the lifecycle in spec 27 (requested -> reviewing ->
-- accepted -> in_progress <-> on_hold -> delivered -> completed, with
-- rejected/cancelled as the two ways it ends without delivery; the vocabulary
-- and the legal steps live in services.py). `priority` is how urgent it is,
-- `budget` what the client has said they can spend - both reported from the
-- row, never derived. No CHECK constraint: the states are data, and a lookup
-- table is allowed to grow.
CREATE TABLE IF NOT EXISTS service_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id       INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id        INTEGER NOT NULL REFERENCES services(id),
  variant_id        INTEGER REFERENCES service_variants(id),
  delivery          TEXT    NOT NULL DEFAULT 'internal',
  internal_owner_id INTEGER REFERENCES stakeholders(id),
  provider_id       INTEGER REFERENCES stakeholders(id),
  status            TEXT    NOT NULL DEFAULT 'requested',
  priority          TEXT    NOT NULL DEFAULT 'normal',
  budget            REAL,
  deleted_at        TEXT,
  requested_on      TEXT,
  due_on            TEXT,
  completed_on      TEXT,
  notes             TEXT    NOT NULL DEFAULT '',
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  rev               INTEGER NOT NULL DEFAULT 1
);

-- 19/20/21. An attribute is a reusable field definition, not a column on one
-- service: which services it applies to lives in the assignments table below,
-- so "Frontend Stack" is defined once and asked of every service that needs it
-- - and of no service that does not. Values live on the variant, because a
-- tier is what differs ("Documents required: 3" on Basic, "6" on Premium).
--
-- `service_id` is the service the definition was created under (its origin, and
-- where the unique-name index applies); applicability is the assignments table.
-- `choices` is the first release's comma-separated option list: the rows in
-- attribute_values are the live source, and a migration copies these across.
CREATE TABLE IF NOT EXISTS service_attributes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id    INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  kind          TEXT    NOT NULL DEFAULT 'text',
  choices       TEXT    NOT NULL DEFAULT '',
  required      INTEGER NOT NULL DEFAULT 0,
  multiple      INTEGER NOT NULL DEFAULT 0,
  default_value TEXT    NOT NULL DEFAULT '',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 1
);

-- The options of a select, in the order they were given. One row each, so an
-- option can be reordered or read on its own rather than split out of a string.
CREATE TABLE IF NOT EXISTS attribute_values (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  attribute_id INTEGER NOT NULL REFERENCES service_attributes(id) ON DELETE CASCADE,
  value        TEXT    NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
);

-- 21. Which services an attribute asks for. The same attribute on Custom
-- Software and on Website Development, and on neither of the ones it means
-- nothing for - which is what keeps the request form relevant.
CREATE TABLE IF NOT EXISTS service_attribute_assignments (
  attribute_id INTEGER NOT NULL REFERENCES service_attributes(id) ON DELETE CASCADE,
  service_id   INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (attribute_id, service_id)
);

CREATE TABLE IF NOT EXISTS service_variant_attributes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id   INTEGER NOT NULL REFERENCES service_variants(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES service_attributes(id) ON DELETE CASCADE,
  value        TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
);

-- 22/23/26. What a request has to say before the work behind it can start.
-- The fields live on the service (the assignments table above), so this table
-- only records the answers: one row per field the service asked of *this*
-- request, keyed by attribute rather than by column, so the form can grow a
-- field without the schema growing with it. A request keeps its own answers
-- even if the service later changes shape - the row is what was answered.
CREATE TABLE IF NOT EXISTS service_request_configurations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id   INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  attribute_id INTEGER NOT NULL REFERENCES service_attributes(id) ON DELETE CASCADE,
  value        TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
);

-- A status timeline. Progress is history, so it is recorded rather than
-- inferred: only the current status lives on the request itself.
CREATE TABLE IF NOT EXISTS service_request_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  status     TEXT    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  at         TEXT    NOT NULL
);

-- 28/29. Who is actually doing the work. A job can have several people on it -
-- that is the hybrid case the spec has in view - so the team is recorded as
-- rows rather than squeezed into the two lead fields on the request. Those two
-- fields stay exactly where they are (every chip, count and workload figure
-- reads them), and are kept as the first internal and the first external row
-- recorded here. One person joins a job once, so a stakeholder is unique per
-- request rather than per side.
CREATE TABLE IF NOT EXISTS delivery_resources (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id     INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  stakeholder_id INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  role           TEXT    NOT NULL DEFAULT 'internal',
  allocation     REAL,
  cost           REAL,
  start          TEXT,
  end            TEXT,
  status         TEXT    NOT NULL DEFAULT 'planned',
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  rev            INTEGER NOT NULL DEFAULT 1
);

-- 30. The work behind one job, as rows rather than prose in the notes: what
-- has to be done, what has to arrive, what has been spent, and the paperwork
-- it produced. All four hang off the request, because a workspace is one
-- request's own book - nothing here is shared with the business or the
-- service, and deleting the request clears the lot. Tasks may name whoever is
-- doing them (the team above), and drop the name rather than the task when
-- that person leaves the book.
CREATE TABLE IF NOT EXISTS delivery_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  assignee_id INTEGER REFERENCES stakeholders(id) ON DELETE SET NULL,
  status      TEXT    NOT NULL DEFAULT 'todo',
  due_on      TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- What the job promises to hand over, and whether it has. `delivered_on` is
-- stamped when the status says delivered and cleared when it is sent back, so
-- the date and the status can never tell different stories.
CREATE TABLE IF NOT EXISTS delivery_deliverables (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id   INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  kind         TEXT    NOT NULL DEFAULT 'other',
  status       TEXT    NOT NULL DEFAULT 'pending',
  due_on       TEXT,
  delivered_on TEXT,
  notes        TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
);

-- What the job has actually cost, recorded as it is spent. The budget on the
-- request is what the client said; this is what went out - compared, never
-- merged, so an over-run is visible instead of quietly rewriting the budget.
CREATE TABLE IF NOT EXISTS delivery_costs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  label       TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'other',
  amount      REAL    NOT NULL DEFAULT 0,
  spent_on    TEXT,
  notes       TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);

-- The paperwork this job produced, or a pointer at paperwork the business
-- already keeps: one of the two, never both. Linking pulls the name, kind and
-- reference across, so the same certificate is not described twice; unlinking
-- the business row leaves the request's own record standing.
CREATE TABLE IF NOT EXISTS request_documents (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id           INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  business_document_id INTEGER REFERENCES business_documents(id) ON DELETE SET NULL,
  name                 TEXT    NOT NULL,
  kind                 TEXT    NOT NULL DEFAULT 'other',
  reference            TEXT    NOT NULL DEFAULT '',
  notes                TEXT    NOT NULL DEFAULT '',
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL,
  rev                  INTEGER NOT NULL DEFAULT 1
);

-- Which stakeholder the portfolio is measured against. Kept as data rather
-- than a constant so it can point at a person or a holding company, and so
-- "my ventures / my holdings / my clients" is derived, never stored.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_bs_one_current
  ON business_stakeholders(business_id, stakeholder_id) WHERE exited_on IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_brs_one_current
  ON branch_stakeholders(branch_id, stakeholder_id) WHERE exited_on IS NULL;
CREATE INDEX IF NOT EXISTS idx_bs_business ON business_stakeholders(business_id);
CREATE INDEX IF NOT EXISTS idx_bs_stake    ON business_stakeholders(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_br_business  ON branches(business_id);
CREATE INDEX IF NOT EXISTS idx_brs_branch   ON branch_stakeholders(branch_id);
CREATE INDEX IF NOT EXISTS idx_brs_stake    ON branch_stakeholders(stakeholder_id);
CREATE INDEX IF NOT EXISTS idx_biz_status   ON businesses(status);

-- Case-insensitive uniqueness. The UNIQUE constraints declared inside the
-- tables use BINARY collation ("Acme" and "Acme " / "acme" would both slip
-- through); these indexes are applied on every startup so existing databases
-- pick them up too, and they match the COLLATE NOCASE checks in db.py.
-- A valuation series: one row per mark, never overwritten, so the move between
-- rounds stays visible. A void row records that a mark was deliberately
-- withdrawn, which is different from never having had one - and it keeps
-- "clearing a mark" from having to destroy history.
CREATE TABLE IF NOT EXISTS valuations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  valued_on   TEXT    NOT NULL,
  valuation   REAL,
  note        TEXT    NOT NULL DEFAULT '',
  voided      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_valuations_business_date
  ON valuations(business_id, valued_on);
CREATE INDEX IF NOT EXISTS idx_val_business ON valuations(business_id, valued_on);

-- Cash paid out of a business to its equity holders. One row is the whole
-- declaration; each holder's receipt is derived from their percentage rather
-- than stored, so a dividend can never disagree with the cap table.
CREATE TABLE IF NOT EXISTS dividends (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  declared_on TEXT    NOT NULL,
  amount      REAL    NOT NULL,
  note        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dividends_business_date
  ON dividends(business_id, declared_on);
CREATE INDEX IF NOT EXISTS idx_div_business ON dividends(business_id, declared_on);

-- A profit cycle: one period's trading for a venture. Revenue less operating
-- expenses gives the net distributable, which is what actually gets shared out.
-- Recording the cycle is what makes the number auditable - a dividend typed in
-- by hand cannot be traced back to trading.
CREATE TABLE IF NOT EXISTS profit_cycles (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id        INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_label       TEXT    NOT NULL,
  period_start       TEXT,
  period_end         TEXT    NOT NULL,
  gross_revenue      REAL    NOT NULL DEFAULT 0,
  operating_expenses REAL    NOT NULL DEFAULT 0,
  note               TEXT    NOT NULL DEFAULT '',
  created_at         TEXT    NOT NULL,
  rev                INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_cycle_business_period
  ON profit_cycles(business_id, period_label);

-- --------------------------------------------------------------------------- #
-- 11. Dividends, monthly.
--
-- A business that pays its partners monthly needs three things the original did
-- not have: a cadence to compare against, a record of what each holder was
-- actually *paid* (as opposed to what they were entitled to), and an exception
-- for the contractual final dividend.
--
-- `dividends` keeps exactly one row per declaration — the business-wide amount.
-- What each holder receives is derived from the cap table on the declaration date,
-- so a dividend can never disagree with the ownership that produced it.
-- --------------------------------------------------------------------------- #

-- The cadence a business is expected to pay on. Per business, because a holding
-- that pays monthly and a service client that never pays are both normal.
CREATE TABLE IF NOT EXISTS dividend_schedules (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  frequency    TEXT    NOT NULL DEFAULT 'monthly'
                 CHECK (frequency IN ('monthly','quarterly','annual','none')),
  due_day      INTEGER NOT NULL DEFAULT 31,
  starts_on    TEXT    NOT NULL DEFAULT '',
  ends_on      TEXT,
  note         TEXT    NOT NULL DEFAULT '',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dividend_schedule_business
  ON dividend_schedules(business_id);
CREATE INDEX IF NOT EXISTS idx_dividend_schedule_active
  ON dividend_schedules(frequency) WHERE frequency <> 'none';

-- Settlements against a declaration, per holder.
--
-- A business-wide dividend fans out to N holders, and each may be paid separately,
-- late, or partly. That makes settlement inherently per-holder, so it cannot be a
-- status on the declaration: "paid" is a different fact for every recipient.
CREATE TABLE IF NOT EXISTS dividend_payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  dividend_id    INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
  stakeholder_id INTEGER NOT NULL REFERENCES stakeholders(id),
  amount         REAL    NOT NULL,
  paid_on        TEXT    NOT NULL,
  method         TEXT    NOT NULL DEFAULT 'cash'
                   CHECK (method IN ('cash','transfer','offset','writeoff')),
  reference      TEXT    NOT NULL DEFAULT '',
  note           TEXT    NOT NULL DEFAULT '',
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  rev            INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dividend_payment
  ON dividend_payments(dividend_id, stakeholder_id, paid_on);
CREATE INDEX IF NOT EXISTS idx_dividend_payment_holder
  ON dividend_payments(stakeholder_id, paid_on);

-- Contractual entitlements, for the one case the record-date rule does not cover.
--
-- A shareholders' agreement can grant a departing stakeholder a proportion of a
-- dividend despite the normal rule. Those amounts are *recorded* rather than
-- derived, and are immutable once the declaration is confirmed — which is why
-- the exception lives on the declaration instead of in a global policy that would
-- silently rewrite what every past dividend meant.
--
-- Rows here exist only when `dividends.entitlement_mode = 'contractual'`. The two
-- representations may not be mixed.
CREATE TABLE IF NOT EXISTS dividend_entitlements (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  dividend_id    INTEGER NOT NULL REFERENCES dividends(id) ON DELETE CASCADE,
  stakeholder_id INTEGER NOT NULL REFERENCES stakeholders(id),
  amount         REAL    NOT NULL,
  basis_note     TEXT    NOT NULL DEFAULT '',
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  rev            INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dividend_entitlement
  ON dividend_entitlements(dividend_id, stakeholder_id);

-- Coverage: which months a business has paid. Derived on read rather than
-- written, for the same reason alerts carry no table — a row that remembers what
-- a dividend *should* have been can disagree with what was recorded.
CREATE INDEX IF NOT EXISTS idx_dividend_declared
  ON dividends(business_id, declared_on);

CREATE UNIQUE INDEX IF NOT EXISTS ux_stakeholders_name
  ON stakeholders(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS ux_businesses_name
  ON businesses(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS ux_branches_business_name
  ON branches(business_id, name COLLATE NOCASE);

-- --------------------------------------------------------------------------- #
-- The service module's own indexes. Split out for the same reason the tables
-- are: the catalogue is read constantly and written rarely.
CREATE INDEX IF NOT EXISTS ix_svc_variant_service ON service_variants(service_id, status);
CREATE INDEX IF NOT EXISTS ix_svc_variant_name    ON service_variants(service_id, name);
CREATE INDEX IF NOT EXISTS ix_svc_req_business     ON service_requests(business_id, status);
CREATE INDEX IF NOT EXISTS ix_svc_req_service      ON service_requests(service_id, status);
CREATE INDEX IF NOT EXISTS ix_svc_req_status       ON service_requests(status, due_on);
CREATE INDEX IF NOT EXISTS ix_svc_req_delivery     ON service_requests(delivery, status);
CREATE INDEX IF NOT EXISTS ix_svc_req_owner        ON service_requests(internal_owner_id, status);
CREATE INDEX IF NOT EXISTS ix_svc_req_provider     ON service_requests(provider_id, status);
CREATE INDEX IF NOT EXISTS ix_svc_req_event        ON service_request_events(request_id, at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_svc_code ON services(code) WHERE code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS ux_svc_attr_name
  ON service_attributes(service_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS ux_svc_variant_attr
  ON service_variant_attributes(variant_id, attribute_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_attr_value
  ON attribute_values(attribute_id, value);
CREATE INDEX IF NOT EXISTS ix_attr_assign_service
  ON service_attribute_assignments(service_id, attribute_id);
CREATE INDEX IF NOT EXISTS ix_svc_attr_service
  ON service_attributes(service_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS ux_req_config
  ON service_request_configurations(request_id, attribute_id);
CREATE INDEX IF NOT EXISTS ix_req_config_attr
  ON service_request_configurations(attribute_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_req_resource_person
  ON delivery_resources(request_id, stakeholder_id);
CREATE INDEX IF NOT EXISTS ix_svc_req_resource
  ON delivery_resources(request_id, role);
CREATE INDEX IF NOT EXISTS ix_task_request
  ON delivery_tasks(request_id, position);
CREATE INDEX IF NOT EXISTS ix_deliv_request
  ON delivery_deliverables(request_id, due_on);
CREATE INDEX IF NOT EXISTS ix_cost_request
  ON delivery_costs(request_id, spent_on);
CREATE INDEX IF NOT EXISTS ix_req_doc_request
  ON request_documents(request_id);

CREATE INDEX IF NOT EXISTS ix_biz_industry ON businesses(industry);
CREATE INDEX IF NOT EXISTS ix_biz_status   ON businesses(status);
CREATE INDEX IF NOT EXISTS ix_biz_loc      ON business_locations(business_id, is_primary);
CREATE INDEX IF NOT EXISTS ix_biz_doc      ON business_documents(business_id, kind);
CREATE UNIQUE INDEX IF NOT EXISTS ux_biz_loc_primary
  ON business_locations(business_id) WHERE is_primary = 1;

-- --------------------------------------------------------------------------- #
-- 10. Investment lifecycle.
--
-- A holding says "they own 30%". It does not say how they got there: one round
-- or four, one cheque or several, and whether any of it was a return to a
-- business they had already left. This table records each acquisition as its
-- own row, so the lifecycle is a list rather than a single overwritten number.
--
-- Nothing here duplicates the holding. Status, exit date and proceeds are
-- derived from the holding period and the exits recorded against it, because a
-- stored status is a second opinion that will eventually disagree.
-- --------------------------------------------------------------------------- #
CREATE TABLE IF NOT EXISTS investment_rounds (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stakeholder_id INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  invested_on   TEXT NOT NULL,
  amount        REAL NOT NULL DEFAULT 0,
  -- the stake this round bought, in points. A later round may buy more, and a
  -- part sale may sell some of it back, so this is not the stake they hold now.
  equity_acquired REAL NOT NULL DEFAULT 0,
  -- initial | additional | re_entry. The distinction is worth keeping: money
  -- that came back into a business someone had already left is a different fact
  -- from money that went in the first time.
  kind          TEXT NOT NULL DEFAULT 'initial',
  note          TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT '',
  rev           INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_round_one_per_day
  ON investment_rounds(business_id, stakeholder_id, invested_on, kind);
CREATE INDEX IF NOT EXISTS idx_round_business
  ON investment_rounds(business_id, invested_on);
CREATE INDEX IF NOT EXISTS idx_round_holder
  ON investment_rounds(stakeholder_id, invested_on);

-- --------------------------------------------------------------------------- #
-- 12. Distributions.
--
-- A distribution is cash leaving a business, and it is a fact about a *holder*
-- at a moment in time, not about the business in general. The three columns
-- below are what make that possible:
--
--   kind            what the money actually was - a dividend, interest, rent,
--                   a repayment of capital. These are not interchangeable, and
--                   calling them all "dividend" hides a return of capital.
--   stakeholder_id  who received it. Left empty, the row is a declaration by the
--                   business as a whole and each holder's share is derived from
--                   their stake on the day.
--   The holding period a receipt belongs to is not stored: it is derived from
--   the cap table as it stood on the declaration date, so it stays right even
--   after a later part sale changes the ownership.
-- --------------------------------------------------------------------------- #
-- The three new dividend columns are added by db._EXTRA_COLS rather than by an
-- ALTER here: this script is executed on every start, and SQLite has no
-- `ADD COLUMN IF NOT EXISTS`, so an unguarded ALTER would break the second
-- launch of the app.

-- --------------------------------------------------------------------------- #
-- 13. Ownership transfers.
--
-- A sale written down as the event it was: who sold, who bought, how much of
-- it changed hands, on what day, and for how much. The cap table records the
-- *periods* - what somebody held between two dates - and this records the
-- moments between them, so the two can be read against each other.
--
-- The holding's `exited_on` is stamped from this row, never the other way
-- round: a position closes because it was sold, not because a date was typed.
-- A period closed by a larger purchase (nobody bought it - the holder simply
-- holds more) has no transfer, which is what keeps a purchase out of the sale
-- report.
--
--   level/owner   a branch is sold too, so the owner is either a business or
--                 one of its branches; business_id is filled either way, so
--                 deleting the business takes its branch's history with it.
--   percentage    the stake that moved, in points. A whole close moves the
--                 whole holding; a part sale moves the slice that left. A
--                 client link has no equity, so it closes at 0 - a
--                 relationship ends, and the ledger says so plainly.
--   proceeds      what came back. Blank means "not priced", which is a
--                 different fact from zero and must stay that way.
-- --------------------------------------------------------------------------- #
CREATE TABLE IF NOT EXISTS ownership_transfers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  level        TEXT    NOT NULL DEFAULT 'business',
  business_id  INTEGER REFERENCES businesses(id)   ON DELETE CASCADE,
  branch_id    INTEGER REFERENCES branches(id)     ON DELETE CASCADE,
  seller_id    INTEGER NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
  buyer_id     INTEGER REFERENCES stakeholders(id) ON DELETE CASCADE,
  percentage   REAL    NOT NULL,
  date         TEXT    NOT NULL,
  proceeds     REAL,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1,
  CHECK (level IN ('business', 'branch'))
);
CREATE INDEX IF NOT EXISTS idx_transfers_business
  ON ownership_transfers(business_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_branch
  ON ownership_transfers(branch_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_seller
  ON ownership_transfers(seller_id, date);

-- --------------------------------------------------------------------------- #
-- 26. Invoicing.
-- --------------------------------------------------------------------------- #
-- Money owed *to* Zainpreneur, which is the mirror image of everything above and
-- must never be added to it. A dividend received and an invoice paid are two
-- different ledgers, and the original had a `revenue` column that could be set on
-- any business regardless of whether a single invoice had ever been raised.

-- The numbers a client is billed on. `number` is the human reference; there is
-- no sequence generated here, because a gap in an invoice series is a fact an
-- auditor asks about and a silent auto-number hides.
CREATE TABLE IF NOT EXISTS invoices (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number      TEXT    NOT NULL,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- The work being billed. Optional: a retainer invoice or a one-off charge need
  -- not correspond to a single request, and forcing one would mean inventing a
  -- request row for work that was never "requested".
  request_id  INTEGER REFERENCES service_requests(id) ON DELETE SET NULL,
  currency    TEXT    NOT NULL DEFAULT '',
  issued_on   TEXT    NOT NULL,
  due_on      TEXT,
  note        TEXT    NOT NULL DEFAULT '',
  -- An issue date is an event, so it is recorded rather than inferred from the
  -- row's existence. A draft has none, and is not yet owed by anyone.
  voided_on   TEXT,
  void_note   TEXT    NOT NULL DEFAULT '',
  deleted_at  TEXT,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_invoice_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_invoice_business ON invoices(business_id, issued_on);
CREATE INDEX IF NOT EXISTS idx_invoice_request ON invoices(request_id);

-- One row per thing billed. The rate is *copied onto the line* rather than joined
-- back to the variant: raising a price tomorrow must re-price the pipeline, not
-- rewrite the invoices already out the door. This is the same reason a dividend's
-- entitlement is derived from the cap table on the declaration date — the figure
-- a document asserted stays on the document.
CREATE TABLE IF NOT EXISTS invoice_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id  INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  variant_id  INTEGER REFERENCES service_variants(id) ON DELETE SET NULL,
  description TEXT    NOT NULL DEFAULT '',
  -- What was charged, and what it was charged per. Both kept: after the fact
  -- "300,000 for the month" and "50,000 x 6 hours" are different statements, and
  -- flattening them to a subtotal loses which one was a rate.
  quantity    REAL    NOT NULL DEFAULT 1,
  unit_price  REAL,
  -- The catalogue's model, copied for the same reason as unit_price.
  pricing_model TEXT  NOT NULL DEFAULT 'fixed',
  -- Discount as an amount, not a percentage: 10% of what, applied when? A
  -- percentage line total is not reproducible once the rate changes.
  discount    REAL    NOT NULL DEFAULT 0,
  tax_rate    REAL,
  -- Stored rather than derived, because a tax rate is a fact of the period the
  -- invoice belongs to and can change without notice.
  tax_amount  REAL,
  subtotal    REAL    NOT NULL DEFAULT 0,
  total       REAL    NOT NULL DEFAULT 0,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL,
  rev         INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_line_invoice ON invoice_lines(invoice_id, position);

-- Money in. A payment is an event with a date and a method, so it is recorded
-- rather than netted against the invoice -- netting makes the day the money
-- arrived unrecoverable, which is the one fact a cash-flow forecast needs.
CREATE TABLE IF NOT EXISTS invoice_payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  paid_on    TEXT    NOT NULL,
  amount     REAL    NOT NULL,
  method     TEXT    NOT NULL DEFAULT 'cash',
  reference  TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_payment_invoice ON invoice_payments(invoice_id, paid_on);

-- A credit note reduces what a client owes, and is not a negative payment: it has
-- its own number and its own reason, because "we billed you twice" and "you
-- overpaid" call for different paperwork and different corrections.
CREATE TABLE IF NOT EXISTS credit_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  number     TEXT    NOT NULL,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  issued_on  TEXT    NOT NULL,
  amount     REAL    NOT NULL,
  reason     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_credit_number ON credit_notes(number);
CREATE INDEX IF NOT EXISTS idx_credit_invoice ON credit_notes(invoice_id);

-- --------------------------------------------------------------------------- #
-- 27. Intercompany.
-- --------------------------------------------------------------------------- #
-- Work done inside the group. The point of this table is that it is *not* revenue:
-- when Zainpreneur charges a company it wholly owns for advisory, the group as a
-- whole has earned nothing, and adding the two sides together is how an internal
-- transfer gets reported as growth.
--
-- The debtor and the creditor live on the same row, deliberately. The alternative —
-- a charge and a matching credit as two rows — makes it possible to record one
-- without the other, and half an intercompany entry is exactly how an internal
-- transfer leaks into group results. Stored once, the counter-entry is derived and
-- there is nowhere to put only one side.

CREATE TABLE IF NOT EXISTS intercompany_charges (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  number        TEXT    NOT NULL,
  -- Who is charged: always a group business, because a charge to somebody outside
  -- the group is an ordinary sale and belongs on an invoice.
  business_id   INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- Who provides it. Either the portfolio owner itself, or another group business —
  -- which is the case that needs a second leg and the one nobody models.
  to_business_id    INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
  to_stakeholder_id INTEGER REFERENCES stakeholders(id) ON DELETE CASCADE,
  amount       REAL    NOT NULL,
  currency     TEXT    NOT NULL DEFAULT '',
  charged_on   TEXT    NOT NULL,
  -- management_fee | service | cost_recharge. Deliberately no interest: the group
  -- runs no interest-bearing instruments, and offering the option would put a
  -- choice in front of someone who already decided not to have one.
  basis        TEXT    NOT NULL DEFAULT 'service',
  note         TEXT    NOT NULL DEFAULT '',
  -- A proposed charge is not yet recognised. Recognition is a step, because a
  -- management fee someone intends to charge has not happened until it is agreed.
  confirmed_on TEXT,
  settled_on   TEXT,
  deleted_at   TEXT,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL,
  rev          INTEGER NOT NULL DEFAULT 1,
  CHECK (
    (to_business_id IS NOT NULL AND to_stakeholder_id IS NULL) OR
    (to_business_id IS NULL AND to_stakeholder_id IS NOT NULL)
  ),
  CHECK (to_business_id IS NULL OR to_business_id <> business_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_intercompany_number ON intercompany_charges(number);
CREATE INDEX IF NOT EXISTS idx_intercompany_business ON intercompany_charges(business_id, charged_on);
CREATE INDEX IF NOT EXISTS idx_intercompany_to_business ON intercompany_charges(to_business_id, charged_on);

-- --------------------------------------------------------------------------- #
-- 28. Exchange rates.
-- --------------------------------------------------------------------------- #
-- One row per pair per day. A rate is a fact about a day, and a conversion that does
-- not say which day it used is not reproducible: the same figure converted twice with
-- the same inputs would give two answers.
--
-- `rate` is how many units of `to_code` one unit of `from_code` buys. Stated here
-- because the inverse is the other way round, and getting it backwards halves every
-- figure in the book without any error being raised.
CREATE TABLE IF NOT EXISTS fx_rates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_code  TEXT    NOT NULL,
  to_code    TEXT    NOT NULL,
  rate       REAL    NOT NULL,
  quoted_on  TEXT    NOT NULL,
  -- Where the number came from. A rate nobody can trace is a rate nobody can defend
  -- when the converted figure is questioned.
  source     TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1,
  CHECK (from_code <> to_code),
  CHECK (rate > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fx_pair_day ON fx_rates(from_code, to_code, quoted_on);
CREATE INDEX IF NOT EXISTS idx_fx_lookup ON fx_rates(from_code, to_code, quoted_on DESC);
