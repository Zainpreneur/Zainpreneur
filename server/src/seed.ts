/**
 * Minimal seed: three businesses that between them exercise every rule.
 *
 *   Green Life Nursery   fully owned   Zainpreneur Nominees Ltd at 100%
 *   Great Car Washers    equity        60% Zainpreneur, 40% across three others
 *   ABC Trading          client        no equity, served = true
 *
 * The four-way split is the interesting one: 60% plus three holders summing to 40%
 * is exactly the "several stakeholders, some of them companies" case the dividend
 * work needs, and it is only representable because the 100% rule is exact.
 *
 * Everything here is demo data. Nothing is carried over from the old database.
 */
import { all, closeDb, now, num, one, tx } from "./db/client.js";
import { migrate } from "./db/migrations.js";
import {
  CURRENCIES,
  DISTRIBUTION_KIND_LABEL,
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "@zainpreneur/shared";

const ago = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Month keys counting back from today, newest last. */
function recentMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

const monthEndOf = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, "0")}`;
};

interface Holder {
  name: string;
  kind: "individual" | "company" | "fund" | "trust";
  role?: string;
  equity: number;
  amount: number;
  investedDaysAgo: number;
}

/** The principal. One entity; every figure in the book is measured against it. */
const PRINCIPAL = {
  name: "Zainpreneur Nominees Ltd",
  kind: "company" as const,
  role: "Nominee shareholder",
};

const STAKEHOLDERS: Array<Omit<Holder, "equity" | "amount" | "investedDaysAgo"> & { email?: string; phone?: string }> = [
  { ...PRINCIPAL, email: "info@zainpreneur.com", phone: "+254 700 000 001" },
  { name: "Zain Ahmed", kind: "individual", role: "Founder" },
  { name: "Kenya Growth Partners", kind: "fund", role: "Partner" },
  { name: "Meridian Holdings Ltd", kind: "company", role: "Partner" },
  { name: "Achieng Odhiambo", kind: "individual", role: "Consultant" },
  { name: "Njoroge Family Trust", kind: "trust", role: "Partner" },
  // The owner of a served client, so the client has a real cap table. Without it the
  // holder loop below used to skip this one silently and the business ended up
  // with no shareholders at all.
  { name: "Riverside Holdings Ltd", kind: "company", role: "Owner" },
  { name: "Coastal Freight Holdings Ltd", kind: "company", role: "Owner" },
];

const BUSINESSES: Array<{
  name: string;
  legalForm: string;
  industry: string;
  city: string;
  country: string;
  status: "prospect" | "active" | "inactive" | "closed" | "exited";
relationship: RelationshipType;
    served: boolean;
    /** Absent means the book's own currency — so the default is stated, not implied. */
    reportingCurrency?: string;
    foundedDaysAgo: number;
  holders: Holder[];
  branches: Array<{ name: string; code: string; city: string; holders: Holder[] }>;
}> = [
  {
    name: "Riverside Lodge",
    legalForm: "Ltd",
    industry: "Hospitality",
    city: "Nakuru",
    country: "Kenya",
    status: "active",
    // Served, and not owned by Zainpreneur. This is what a client invoice is *for*:
    // serving a business and holding part of one are separate facts, and only the
    // second is an investment.
    relationship: "client",
    served: true,
    foundedDaysAgo: 640,
    holders: [
      {
        name: "Riverside Holdings Ltd",
        kind: "company",
        role: "Owner",
        equity: 100,
        amount: 0,
        investedDaysAgo: 620,
      },
    ],
    branches: [],
  },
  {
    name: "Coastal Freight Ltd",
    legalForm: "Ltd",
    industry: "Logistics",
    city: "Mombasa",
    country: "Kenya",
    status: "active",
    // Served, invoiced in dollars. The second reporting currency — and the reason a
    // rate has to exist before any total can be produced.
    relationship: "client",
    served: true,
    foundedDaysAgo: 300,
    reportingCurrency: "USD",
    holders: [
      {
        name: "Coastal Freight Holdings Ltd",
        kind: "company",
        role: "Owner",
        equity: 100,
        amount: 0,
        investedDaysAgo: 280,
      },
    ],
    branches: [],
  },
  {
    name: "Green Life Nursery",
    legalForm: "Ltd",
    industry: "Agriculture",
    city: "Nairobi",
    country: "Kenya",
    status: "active",
    relationship: "fully_owned",
    served: true,
    foundedDaysAgo: 900,
    holders: [
      {
        name: PRINCIPAL.name,
        kind: "company",
        role: "Nominee shareholder",
        equity: 100,
        amount: 4_500_000,
        investedDaysAgo: 880,
      },
    ],
    branches: [
      {
        name: "Nairobi Main Nursery",
        code: "GLN-NBO",
        city: "Nairobi",
        holders: [
          {
            name: PRINCIPAL.name,
            kind: "company",
            role: "Nominee shareholder",
            equity: 100,
            amount: 2_000_000,
            investedDaysAgo: 870,
          },
        ],
      },
      {
        name: "Nakuru Satellite",
        code: "GLN-NKR",
        city: "Nakuru",
        holders: [
          {
            name: PRINCIPAL.name,
            kind: "company",
            role: "Nominee shareholder",
            equity: 100,
            amount: 900_000,
            investedDaysAgo: 400,
          },
        ],
      },
    ],
  },
  {
    name: "Great Car Washers",
    legalForm: "Ltd",
    industry: "Hospitality",
    city: "Nairobi",
    country: "Kenya",
    status: "active",
    relationship: "equity",
    served: false,
    foundedDaysAgo: 700,
    holders: [
      {
        name: PRINCIPAL.name,
        kind: "company",
        role: "Nominee shareholder",
        equity: 60,
        amount: 3_000_000,
        investedDaysAgo: 690,
      },
      { name: "Kenya Growth Partners", kind: "fund", role: "Partner", equity: 20, amount: 1_000_000, investedDaysAgo: 690 },
      { name: "Meridian Holdings Ltd", kind: "company", role: "Partner", equity: 15, amount: 750_000, investedDaysAgo: 690 },
      { name: "Njoroge Family Trust", kind: "trust", role: "Partner", equity: 5, amount: 250_000, investedDaysAgo: 690 },
    ],
    branches: [
      {
        name: "Westlands",
        code: "GCW-WST",
        city: "Nairobi",
        holders: [
          {
            name: PRINCIPAL.name,
            kind: "company",
            role: "Nominee shareholder",
            equity: 55,
            amount: 1_100_000,
            investedDaysAgo: 680,
          },
          { name: "Kenya Growth Partners", kind: "fund", role: "Partner", equity: 45, amount: 900_000, investedDaysAgo: 680 },
        ],
      },
      {
        // A branch owned entirely by someone else. Branch cap tables are
        // independent, so this totals 100% without its parent's 100% changing —
        // and the database enforces both separately.
        name: "Mombasa Road",
        code: "GCW-MBA",
        city: "Mombasa",
        holders: [
          { name: "Meridian Holdings Ltd", kind: "company", role: "Partner", equity: 70, amount: 700_000, investedDaysAgo: 300 },
          { name: "Achieng Odhiambo", kind: "individual", role: "Consultant", equity: 30, amount: 300_000, investedDaysAgo: 300 },
        ],
      },
    ],
  },
  {
    name: "ABC Trading",
    legalForm: "Ltd",
    industry: "Retail",
    city: "Mombasa",
    country: "Kenya",
    status: "active",
    relationship: "client",
    served: true,
    foundedDaysAgo: 400,
    holders: [],
    branches: [
      {
        name: "Main Store",
        code: "ABC-MBA",
        city: "Mombasa",
        holders: [
          { name: "Zain Ahmed", kind: "individual", role: "Founder", equity: 70, amount: 0, investedDaysAgo: 390 },
          { name: "Achieng Odhiambo", kind: "individual", role: "Consultant", equity: 30, amount: 0, investedDaysAgo: 390 },
        ],
      },
    ],
  },
];

function pickRelationship(rows: Holder[], served: boolean): RelationshipType {
  const principal = rows.find((h) => h.name === PRINCIPAL.name);
  if (!principal || principal.equity <= 0) return served ? "client" : "client";
  if (principal.equity >= 100 && rows.length === 1) return "fully_owned";
  return "equity";
}

async function seed(): Promise<void> {
  migrate();

  const existing = num("SELECT COUNT(*) FROM businesses WHERE deleted_at IS NULL");
  if (existing > 0) {
    console.log(`seed: ${existing} business(es) already present — nothing to do`);
    return;
  }

  const stakeholderIds = new Map<string, number>();

  // A business naming a holder that was never created used to be skipped in silence,
  // leaving a business with no shareholders at all and no indication why. A seed that
  // quietly drops half its own data is worse than one that stops: the demo book looked
  // complete and was not.
  const requireStakeholder = (name: string): number => {
    const id = stakeholderIds.get(name);
    if (id === undefined) {
      throw new Error(
        `seed: ${name} holds a position but is not in STAKEHOLDERS, so a cap table would be short a holder`,
      );
    }
    return id;
  };

  await tx(async (db) => {
    const ts = now();

    /* stakeholders ------------------------------------------------------- */
    for (const s of STAKEHOLDERS) {
      const cur = db
        .prepare(
          `INSERT INTO stakeholders (name, kind, role, email, phone, notes, created_at, updated_at, rev)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, 1)`,
        )
        .run(s.name, s.kind, s.role ?? "", s.email ?? "", s.phone ?? "", ts, ts);
      stakeholderIds.set(s.name, Number(cur.lastInsertRowid));
    }
    const principalId = stakeholderIds.get(PRINCIPAL.name)!;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
      "principal_stakeholder_id",
      String(principalId),
    );

    /* businesses --------------------------------------------------------- */
    for (const b of BUSINESSES) {
      const relationship = b.relationship ?? pickRelationship(b.holders, b.served);
      const cur = db
        .prepare(
          `INSERT INTO businesses
             (name, legal_name, legal_form, industry, description, email, phone,
              website, city, country, status, relationship_type, served,
              reporting_currency, founded_on, notes, created_at, updated_at, rev)
           VALUES (?, ?, ?, ?, '', '', '', '', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1)`,
        )
        .run(
          b.name, `${b.name} ${b.legalForm}`, b.legalForm, b.industry,
          b.city, b.country, b.status, relationship,
          // `node:sqlite` refuses a JavaScript boolean — it binds null, numbers,
          // strings, bigints and buffers only. Python's sqlite3 accepted them, so
          // this is a genuine difference between the two, not a typo.
          b.served ? 1 : 0,
          // Absent means the book's own currency, so the default is stated in the row
          // rather than left to whichever currency happened to be set on the day.
          b.reportingCurrency ?? "KES",
          ago(b.foundedDaysAgo), ts, ts,
        );
      const businessId = Number(cur.lastInsertRowid);

      /* business-level cap table ---------------------------------------- */
      // Each holding is written together with the round that put it there. An earlier
      // version of this seed wrote only the holding, which left capital at work with
      // no dated record of when it went in — so MOIC, DPI and IRR came back absent,
      // correctly, because there was nothing to compute them from. A cap table has to
      // be a history, and that includes the demo data.
      for (const h of b.holders) {
        const sid = requireStakeholder(h.name);
        const on = ago(h.investedDaysAgo);
        db.prepare(
          `INSERT INTO business_stakeholders
             (business_id, stakeholder_id, relationship, equity, is_equity, role,
              invested_on, amount, created_at, updated_at, rev)
           VALUES (?, ?, 'equity', ?, 1, '', ?, ?, ?, ?, 1)`,
        ).run(businessId, sid, h.equity, on, h.amount, ts, ts);
        db.prepare(
          `INSERT INTO investment_rounds
             (business_id, stakeholder_id, invested_on, amount, equity_acquired, kind,
              note, created_at, rev)
           VALUES (?, ?, ?, ?, ?, 'initial', 'opening position', ?, 1)`,
        ).run(businessId, sid, on, h.amount, h.equity, ts);
      }

      /* branches, each with its own independent cap table ---------------- */
      for (const br of b.branches) {
        const bcur = db
          .prepare(
            `INSERT INTO branches
               (business_id, name, code, city, country, status, is_active, created_at, updated_at, rev)
             VALUES (?, ?, ?, ?, ?, 'active', 1, ?, ?, 1)`,
          )
          .run(businessId, br.name, br.code, br.city, b.country, ts, ts);
        const branchId = Number(bcur.lastInsertRowid);

        for (const h of br.holders) {
          const sid = requireStakeholder(h.name);
          db.prepare(
            `INSERT INTO branch_stakeholders
               (branch_id, stakeholder_id, relationship, equity, is_equity, role,
                invested_on, amount, created_at, updated_at, rev)
             VALUES (?, ?, 'subsidiary', ?, 1, '', ?, ?, ?, ?, 1)`,
          ).run(branchId, sid, h.equity, ago(h.investedDaysAgo), h.amount, ts, ts);
        }
      }
    }
  });

  await seedMoney(stakeholderIds, now());
  await seedCatalogue();
  await seedIntercompany();
  await seedCurrencies();

  const businesses = all<{ name: string; relationship_type: string }>(
    "SELECT name, relationship_type FROM businesses ORDER BY name COLLATE NOCASE",
  );
  console.log(`seed: ${businesses.length} businesses`);
  for (const b of businesses) console.log(`  ${b.name} — ${b.relationship_type}`);
  console.log(`seed: ${STAKEHOLDERS.length} stakeholders, principal = ${PRINCIPAL.name}`);
  console.log(`currencies in use: ${CURRENCIES.slice(0, 3).join(", ")}`);
  console.log(`distribution kinds: ${Object.keys(DISTRIBUTION_KIND_LABEL).length}`);
}

/**
 * Valuations, trading periods, monthly dividends and settlement.
 *
 * Great Car Washers pays its partners monthly, which is the case the whole
 * dividend model exists for: four holders, a monthly cadence, one holder who
 * departed mid-month, and a partial settlement so "declared" and "received" are
 * visibly different numbers.
 */
/**
 * A catalogue and a few invoices.
 *
 * Deliberately includes a quote-required tier with a blank rate. It is the case the
 * original could not represent: a job that is not yet priced, which used to be
 * indistinguishable on screen from a job somebody forgot to price.
 */
async function seedCatalogue(): Promise<void> {
  const { createService, createVariant, defineAttribute, setVariantAttribute, listServices } =
    await import("./domain/catalogue.js");
  const { issueInvoice, recordPayment, listInvoices } = await import("./domain/invoicing.js");

  if (num("SELECT COUNT(*) FROM services") > 0) return;

  const consulting = createService({
    name: "Business Consulting",
    code: "CONS",
    category: "Advisory",
    description: "Monthly advisory retainer",
  });
  const build = createService({
    name: "Custom Software",
    code: "SOFT",
    category: "Build",
    description: "Scoped per project",
  });

  createVariant({
    serviceId: consulting,
    name: "Advisory retainer",
    code: "CONS-STD",
    rate: 450_000,
    pricingModel: "retainer",
    turnaround: "Within 2 days",
    deliveryModel: "internal",
  });
  createVariant({
    serviceId: consulting,
    name: "Hourly advisory",
    code: "CONS-HR",
    rate: 12_000,
    pricingModel: "hourly",
    turnaround: "Same week",
    deliveryModel: "internal",
  });
  createVariant({
    serviceId: build,
    name: "Fixed-scope build",
    code: "SOFT-FIX",
    rate: 6_500_000,
    pricingModel: "fixed",
    turnaround: "8 weeks",
  });
  // No rate, and that is the answer: this one is scoped before it is priced.
  createVariant({
    serviceId: build,
    name: "Custom scope",
    code: "SOFT-CUS",
    pricingModel: "quote_required",
    turnaround: "Varies",
  });

  const docs = defineAttribute({
    name: "Documents required",
    kind: "number",
    originServiceId: consulting,
  });
  const hours = defineAttribute({
    name: "Hours included",
    kind: "number",
    originServiceId: consulting,
  });
  const stack = defineAttribute({
    name: "Target stack",
    kind: "select",
    originServiceId: build,
    choices: ["Django", "Laravel", "Node"],
  });
  const variants = (await import("./domain/catalogue.js")).listVariants(consulting);
  const retainer = variants.find((v) => v.pricingModel === "retainer");
  if (retainer) {
    setVariantAttribute({ variantId: retainer.id, attributeId: docs, value: "2" });
    setVariantAttribute({ variantId: retainer.id, attributeId: hours, value: "20" });
  }

  // Invoices go to businesses Zainpreneur serves *without wholly owning*. The wholly
  // owned one is served too — that is the whole difficulty — and charging for it would
  // be intercompany, which the invoicing layer refuses on purpose.
  const { principalStakeholderId } = await import("./domain/principal.js");
  const principalId = principalStakeholderId();
  const served = all<{ id: number; name: string }>(
    `SELECT id, name FROM businesses
      WHERE served = 1 AND deleted_at IS NULL
        AND id NOT IN (
          SELECT business_id FROM business_stakeholders
           WHERE stakeholder_id = ? AND exited_on IS NULL AND COALESCE(equity, 0) >= 100
        )
      ORDER BY name`,
    [principalId],
  );
  if (served.length === 0) return;

  const abc = served[0];
  if (abc) {
    const id = await issueInvoice({
      number: "INV-2026-001",
      businessId: abc.id,
      currency: "KES",
      issuedOn: ago(150),
      dueOn: ago(120),
      note: "Advisory retainer — three months",
      lines: [
        { description: "Advisory retainer", quantity: 3, unitPrice: 450_000, taxRate: 16 },
      ],
    });
    // Part-paid, so the receivables report has a real arrears figure in it.
    await recordPayment({ invoiceId: id, amount: 675_000, paidOn: ago(140), method: "bank" });
  }
  const second = served[1];
  if (second) {
    // Issued, unpaid, and long past its due date. An arrears report with nothing in
    // arrears in it is the case that hides the bug.
    await issueInvoice({
      number: "INV-2026-002",
      businessId: second.id,
      currency: "KES",
      issuedOn: ago(200),
      dueOn: ago(170),
      note: "Fixed-scope build — milestone 1",
      lines: [
        { description: "Fixed-scope build, milestone 1 of 3", quantity: 1, unitPrice: 2_200_000, discount: 200_000, taxRate: 16 },
      ],
    });
  }
  const third = served[2];
  if (third) {
    // Part-paid: the case where "unpaid" and "not fully paid" have to be told apart.
    const id = await issueInvoice({
      number: "INV-2026-003",
      businessId: third.id,
      currency: "KES",
      issuedOn: ago(60),
      dueOn: ago(30),
      note: "Hourly advisory",
      lines: [{ description: "Hourly advisory", quantity: 30, unitPrice: 12_000, taxRate: 16 }],
    });
    await recordPayment({ invoiceId: id, amount: 200_000, paidOn: ago(55), method: "bank" });
  }

  const invoices = listInvoices();
  console.log(
    `seed: ${listServices().length} services · ${invoices.length} invoices · ` +
      `${invoices.filter((i) => i.status === "issued").length} unpaid`,
  );
}

/**
 * Internal trading.
 *
 * Included deliberately: a management fee from the portfolio owner to the nursery it
 * wholly owns is the case the original had no way to record at all, and the one that
 * quietly turned internal work into apparent group revenue.
 */
async function seedIntercompany(): Promise<void> {
  const { recordCharge, confirmCharge, groupBusinesses, consolidation } =
    await import("./domain/intercompany.js");
  const { principalStakeholderId } = await import("./domain/principal.js");

  if (num("SELECT COUNT(*) FROM intercompany_charges") > 0) return;

  const principal = principalStakeholderId();
  const group = groupBusinesses();
  if (!principal || group.length === 0) return;

  // The group companies need trading of their own, or a consolidation over them says
  // nothing: an internal charge against no performance removes nothing visible.
  const { recordProfitCycle } = await import("./domain/profitCycles.js");
  for (const [i, daysAgo] of [75, 45, 15].entries()) {
    await recordProfitCycle({
      businessId: group[0]!.id,
      periodEnd: ago(daysAgo),
      grossRevenue: [4_200_000, 4_800_000, 5_100_000][i]!,
      operatingExpenses: [3_100_000, 3_500_000, 3_700_000][i]!,
      retained: 0,
    });
  }

  // Two months of management fee, one confirmed and one still only proposed, so the
  // difference between a recognised charge and an intended one is visible.
  for (const [i, daysAgo] of [45, 15].entries()) {
    const chargedOn = ago(daysAgo);
    const id = await recordCharge({
      number: `IC-${String(i + 1).padStart(4, "0")}`,
      businessId: group[0]!.id,
      toStakeholderId: principal,
      amount: 650_000,
      currency: "KES",
      chargedOn,
      basis: "management_fee",
      note: "Portfolio oversight and finance",
    });
    if (i === 0) confirmCharge(id, ago(daysAgo - 5));
  }

  const c = consolidation();
  console.log(
    `seed: ${num("SELECT COUNT(*) FROM intercompany_charges")} intercompany charge(s) · ` +
      `group net ${c.reportedNet.toLocaleString()} · paid to owner ${c.paidToPrincipal.toLocaleString()} · ` +
      `${c.proposed} proposed, not yet recognised`,
  );
}

/**
 * Rates and a second reporting currency.
 *
 * Included because multi-currency with nothing in a second currency is a feature nobody
 * has tested. One client is billed in USD while the book is kept in KES, so the
 * receivables report has to convert — and has to refuse to, if the rate goes missing.
 */
async function seedCurrencies(): Promise<void> {
  const { recordRate, setBookCurrency, currencyPosition, convertExplained } =
    await import("./domain/fx.js");

  setBookCurrency("KES");

  if (num("SELECT COUNT(*) FROM fx_rates") > 0) return;

  // A month of rates, quoted weekly, with a source on each. Enough to show that a
  // conversion carries a date and can be traced back to whoever published the number.
  const pairs: Array<[string, string, number]> = [
    ["USD", "KES", 129.4],
    ["EUR", "KES", 140.2],
    ["GBP", "KES", 165.8],
  ];
  for (const [from, to, rate] of pairs) {
    for (const daysAgo of [21, 14, 7, 2]) {
      recordRate({
        from,
        to,
        // A little drift week to week, so the history shows a rate is a fact about a day
        // rather than a constant somebody set once.
        rate: rate + (4 - daysAgo) * 0.12,
        quotedOn: ago(daysAgo),
        source: "Central Bank of Kenya",
      });
    }
  }

  // One client billed in dollars, to a rate old enough to be worth converting rather
  // than assuming. `unit_price` is in the invoice's own currency, which is the whole
  // reason an invoice names one.
  const usd = one<{ id: number }>(
    "SELECT id FROM businesses WHERE reporting_currency = 'USD' AND deleted_at IS NULL",
  );
  if (usd) {
    const { issueInvoice, recordPayment } = await import("./domain/invoicing.js");
    const { today } = { today: new Date().toISOString().slice(0, 10) };
    const id = await issueInvoice({
      number: "INV-2026-004",
      businessId: Number(usd.id),
      currency: "USD",
      issuedOn: ago(40),
      dueOn: ago(10),
      note: "Systems audit — USD",
      lines: [{ description: "Systems audit", quantity: 1, unitPrice: 4_800, taxRate: 16 }],
    });
    await recordPayment({ invoiceId: id, amount: 2_000, paidOn: ago(30), method: "bank" });
    void today;
  }

  const p = currencyPosition();
  console.log(
    `seed: book currency ${p.bookCurrency} · ${p.inUse.length} currency/currencies in use · ` +
      `${p.rates.length} rate(s) quoted · ${p.stale.length} stale`,
  );
}

async function seedMoney(ids: Map<string, number>, ts: string): Promise<void> {
  const { recordValuation } = await import("./domain/valuations.js");
  const { recordProfitCycle, tradingSummary } = await import("./domain/profitCycles.js");
  const { recordDistribution, settleDividend, entitlements, setSchedule, dividendsReceivable } =
    await import("./domain/dividends.js");

  const carWash = num("SELECT id FROM businesses WHERE name = 'Great Car Washers'");
  const nursery = num("SELECT id FROM businesses WHERE name = 'Green Life Nursery'");
  if (!carWash || !nursery) return;

  /* Marks ---------------------------------------------------------------- */
  for (const [on, value, method, audited] of [
    ["2025-06-30", 14_000_000, "cost", 1],
    ["2025-12-31", 16_500_000, "cost", 1],
    ["2026-06-30", 21_000_000, "earnings", 1],
  ] as const) {
    if (on > new Date().toISOString().slice(0, 10)) continue;
    await recordValuation({ businessId: carWash, valuedOn: on, valuation: value, method, audited: !!audited, note: `${on} mark` });
  }
  await recordValuation({ businessId: nursery, valuedOn: ago(200), valuation: 9_000_000, method: "cost", audited: true });

  /* Monthly trading, a dividend derived from each ------------------------- */
  const months = recentMonths(8);
  for (const [i, key] of months.entries()) {
    const end = monthEndOf(key);
    if (end > new Date().toISOString().slice(0, 10)) continue;
    const revenue = 900_000 + i * 40_000;
    const expenses = 620_000 + i * 25_000;
    // One month retains a share of profit, so the dividend is not the whole net.
    const retained = i === months.length - 2 ? 150_000 : 0;
    await recordProfitCycle({
      businessId: carWash,
      periodEnd: end,
      grossRevenue: revenue,
      operatingExpenses: expenses,
      retained,
      note: `${key} trading`,
    });
  }

  /* A named payment goes to one holder in full -------------------------- */
  const fund = ids.get("Kenya Growth Partners");
  if (fund) {
    const named = await recordDistribution({
      businessId: carWash,
      declaredOn: ago(150),
      amount: 180_000,
      kind: "dividend",
      stakeholderId: fund,
      note: "Distribution to the fund, in full",
    });
    await settleDividend({
      dividendId: named.id,
      stakeholderId: fund,
      amount: 180_000,
      paidOn: ago(148),
      method: "transfer",
    });
  }

  /* A schedule, and a month deliberately left unpaid ---------------------- */
  await setSchedule({ businessId: carWash, frequency: "monthly", dueDay: 31, startsOn: ago(300) });

  /* Part-settle one recent declaration so a receivable exists -------------- */
  const latest = one<{ id: number }>(
    "SELECT id FROM dividends WHERE business_id = ? AND kind = 'dividend' AND stakeholder_id IS NULL ORDER BY declared_on DESC LIMIT 1",
    [carWash],
  );
  const principal = ids.get(PRINCIPAL.name);
  if (latest && principal) {
    const line = entitlements(latest.id).find((l) => l.stakeholderId === principal);
    if (line && line.outstanding > 0) {
      await settleDividend({
        dividendId: latest.id,
        stakeholderId: principal,
        amount: Math.round(line.amount / 2 / 1000) * 1000,
        paidOn: ago(5),
        method: "transfer",
      });
    }
  }

  const receivable = dividendsReceivable(carWash);
  const summary = tradingSummary(carWash);
  console.log(
    `seed: ${months.length} monthly trading periods · declared ${receivable.declared.toLocaleString()} · ` +
      `received ${receivable.paid.toLocaleString()} · outstanding ${receivable.outstanding.toLocaleString()}`,
  );
  console.log(
    `seed: trading net ${summary.net.toLocaleString()} over ${summary.periods} periods · ` +
      `owed to ${receivable.perHolder.length} holder(s)`,
  );
}

seed()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());