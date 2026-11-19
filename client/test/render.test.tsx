import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { formatMoney } from "@zainpreneur/shared";
import { BusinessTable } from "../src/components/BusinessTable.js";
import { DividendOverview, Panel } from "../src/components/DividendOverview.js";
import { ResponsiveTable, FigureStrip } from "../src/components/Table.js";
import { DividendPanel } from "../src/components/DividendPanel.js";
import { TrackRecordView } from "../src/components/TrackRecordPanel.js";
import { ReceivablesView } from "../src/components/ReceivablesPanel.js";
import type { Invoice, IntercompanyCharge } from "../src/lib/api.js";
import { IntercompanyView } from "../src/components/IntercompanyPanel.js";
import { CurrencyView } from "../src/components/CurrencyPanel.js";

/**
 * Render smoke tests.
 *
 * A clean `tsc` and a successful `vite build` both say a component *compiles*.
 * Neither says it renders. These mount each one to a string, which is the only
 * way to catch a thrown render without a browser — and a component that throws is
 * a blank page behind a perfectly successful build.
 */

const html = (el: React.ReactElement): string => renderToStaticMarkup(el);

interface Row {
  name: string;
}

const business = {
  id: 2,
  name: "Great Car Washers",
  legal_name: "Great Car Washers Ltd",
  status: "active",
  industry: "Hospitality",
  city: "Nairobi",
  country: "Kenya",
  served: 0,
  relationship_type: "equity",
  portfolio: { type: "equity", principalEquity: 60, served: false, badge: "Equity" },
} as never;

test("BusinessTable renders a row per business", () => {
  const out = html(createElement(BusinessTable, { rows: [business], onSelect: () => {} }));
  assert.ok(out.includes("Great Car Washers"), "the business name is missing");
  assert.ok(out.includes("60%"), "Zainpreneur's own stake is missing");
  assert.ok(out.includes("Equity"), "the relationship badge is missing");
  assert.ok(!out.includes("NaN"), "a figure rendered as NaN");
});

test("a pending panel is a skeleton that announces itself, never a blank gap", () => {
  // Both components fetch on mount. Rendering `null` while waiting produces a blank
  // area with no explanation, which reads the same as a crash — so the pending
  // state has to be visible *and* announced.
  for (const [name, out] of [
    ["DividendOverview", html(createElement(DividendOverview))],
    ["DividendPanel", html(createElement(DividendPanel, { business }))],
  ] as const) {
    assert.ok(out.length > 0, `${name} rendered nothing while pending`);
    assert.ok(out.includes("aria-busy"), `${name} does not mark itself busy`);
    assert.ok(out.includes("Loading"), `${name} does not say what it is doing`);
  }
});

test("a panel is the card; its contents are cells, not cards inside cards", () => {
  const out = html(createElement(Panel, { title: "Dividends" }, createElement("p", null, "x")));
  assert.ok(out.includes("Dividends"));
  const panels = out.match(/<section/g)?.length ?? 0;
  assert.equal(panels, 1, "one panel, not a nested one");
});

/* -------------------------------------------------------------------------- */

test("money survives the round trip through the formatter", () => {
  assert.equal(formatMoney(2_125_000), "2,125,000");
  assert.equal(formatMoney(66_000), "66,000");
  assert.equal(formatMoney(0), "0");
  assert.equal(formatMoney(null), "—", "an unrecorded figure is blank, never a fabricated zero");
});

test("outstanding is declared minus received", () => {
  const declared = 2_125_000;
  const received = 66_000;
  assert.equal(formatMoney(declared - received), "2,059,000");
});

test("a month that retains part of its profit distributes less than its net", () => {
  const net = 370_000;
  const retained = 150_000;
  const distributable = 220_000;
  assert.equal(net - retained, distributable);
  assert.ok(distributable < net, "a retained share must reduce what is shared out");
});
/* -------------------------------------------------------------------------- */
/* Responsive                                                                    */
/* -------------------------------------------------------------------------- */

test("a table is keyboard-reachable when it can scroll", () => {
  // A scroll container that cannot be focused is unreachable by keyboard: the arrow
  // keys do nothing and there is no scrollbar to grab. The original's table wrapper
  // had neither tabindex nor a role.
  const out = html(
    createElement(ResponsiveTable<Row>, {
      caption: "Businesses in the register",
      columns: [{ key: "a", label: "Business", render: (r: Row) => r.name }],
      rows: [{ name: "Acme" }],
      rowKey: (r: Row) => r.name,
    }),
  );
  assert.ok(out.includes('tabindex="0"'), "the scroll region is not focusable");
  assert.ok(out.includes('role="region"'), "the scroll region has no role");
  assert.ok(out.includes("Businesses in the register"), "the region has no accessible name");
  assert.ok(out.includes("<caption"), "no caption for the table");
});

test("every cell carries the label it will show itself as when a row becomes a card", () => {
  // The narrow layout reads `data-label` off each cell. A cell without one is
  // omitted — which is the mistake the original made, painting an empty label on
  // the thirty cells that had none.
  const out = html(
    createElement(ResponsiveTable<Row>, {
      caption: "Test",
      columns: [
        { key: "a", label: "Business", render: (r: { name: string }) => r.name },
        { key: "b", label: "Status", render: () => "active" },
      ],
      rows: [{ name: "Acme" }],
      rowKey: (r: Row) => r.name,
    }),
  );
  // `<t[hd]` would also match `<thead>`, so match the tag name explicitly.
  const cells = out.match(/<(th|td)\b[^>]*>/g) ?? [];
  assert.equal(cells.length, 4, "two headers and two cells");
  for (const cell of cells) {
    assert.ok(cell.includes("data-label="), `a cell is missing its label: ${cell}`);
  }
});

test("the figure strip stacks on a phone rather than squeezing three figures", () => {
  const out = html(
    createElement(FigureStrip, {
      figures: [
        { label: "Declared", value: "2,125,000" },
        { label: "Received", value: "66,000" },
        { label: "Outstanding", value: "2,059,000", tone: "bad" },
      ],
    }),
  );
  // One column by default, three from `sm` up.
  assert.ok(out.includes("grid-cols-1"), "no single-column default for a narrow screen");
  assert.ok(out.includes("sm:grid-cols-3"), "no wide-screen variant");
  // Figures stay tabular so columns of numbers line up.
  assert.ok(out.includes("tabular-nums"));
});

test("figures carry their tone as a colour, never as gold text on light", () => {
  // Gold is a fill, never text on a light card. An outstanding figure in red is
  // fine; a figure in gold would fail the brand rule and the contrast floor.
  const out = html(
    createElement(FigureStrip, {
      figures: [{ label: "Outstanding", value: "100", tone: "bad" }],
    }),
  );
  assert.ok(out.includes("--zp-bad"), "the bad tone is missing");
  assert.ok(!out.includes("color:var(--zp-gold)"), "gold was used as a text colour");
});

/* -------------------------------------------------------------------------- */
/* Failure surfaces                                                             */
/* -------------------------------------------------------------------------- */

test("an unreachable API is reported as unreachable, not as a generic failure", async () => {
  const { ApiFailure, api } = await import("../src/lib/api.js");
  type Failure = InstanceType<typeof ApiFailure>;

  // "Something went wrong" says nothing about *which* of two very different problems
  // happened. A server that is not running needs the server started; a server that
  // refused needs the user to fix what they typed.
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error("fetch failed"))) as never;
  try {
    const err = await api.health().then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof ApiFailure, "a network failure was not an ApiFailure");
    assert.equal((err as Failure).offline, true, "not flagged as offline");
    assert.match((err as Failure).message, /not running/, "the message does not say what to do");
  } finally {
    globalThis.fetch = original;
  }
});

test("a refusal from the server keeps the server's own words and field", async () => {
  const { ApiFailure, api } = await import("../src/lib/api.js");
  type Failure = InstanceType<typeof ApiFailure>;
  const original = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ error: "A sale moves the stake to someone", field: "to_stakeholder_id" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    )) as never;
  try {
    const err = await api.business(1).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof ApiFailure);
    assert.equal((err as Failure).offline, false, "a refusal is not an outage");
    assert.equal((err as Failure).field, "to_stakeholder_id", "the field was lost");
    assert.equal((err as Failure).message, "A sale moves the stake to someone");
  } finally {
    globalThis.fetch = original;
  }
});

/* -------------------------------------------------------------------------- */
/* The track record                                                             */
/* -------------------------------------------------------------------------- */

/**
 * `over` lands at the top level (realised, open); `totals` lands inside the totals.
 * Two arguments because those are two different levels of the response.
 */
const trackBody = (
  over: Record<string, unknown> = {},
  totals: Record<string, unknown> = {},
) => ({
  stakeholderId: 1,
  realised: [],
  open: [],
  ...over,
  totals: {
    realisedCost: 0,
    realisedProceeds: 0,
    realisedProfit: 0,
    realisedMoic: null,
    openCost: 0,
    openValue: 0,
    distributionsReceived: 0,
    totalReturn: 0,
    totalValue: 0,
    moic: null,
    tvpi: null,
    dpi: null,
    rvpi: null,
    irr: null,
    unmarkedPositions: 0,
    ...totals,
  },
});

const stripTags = (s: string): string => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

test("a multiple with no capital behind it is blank, never 0x", () => {
  const text = stripTags(html(createElement(TrackRecordView, { data: trackBody() as never })));
  assert.ok(!/\b0\.00x\b/.test(text), `a missing multiple was printed as zero: ${text}`);
  assert.match(text, /MOIC/, "the figure is still labelled");
  assert.match(text, /\u2014/, "and shown as absent rather than invented");
});

test("an unmarked holding says it is shown at cost", () => {
  const text = stripTags(
    html(
      createElement(TrackRecordView, {
        data: trackBody(
          {
            open: [
              {
                businessId: 1,
                businessName: "Unmarked Co",
                cost: 800000,
                equity: 100,
                value: 800000,
                basis: "cost",
                markedOn: null,
                distributionsReceived: 0,
              },
            ],
          },
          { unmarkedPositions: 1 },
        ) as never,
      }),
    ),
  );
  assert.match(text, /at cost/, "a cost is not allowed to look like a valuation");
  assert.match(text, /no valuation on record/i, "and the book says why it is at cost");
});

test("IRR reads as a rate while multiples read as multiples", () => {
  const text = stripTags(
    html(createElement(TrackRecordView, { data: trackBody({}, { irr: 0.264, moic: 2.4 }) as never })),
  );
  assert.match(text, /26\.4%/, "an annual rate is a percentage");
  assert.match(text, /2\.40x/, "a multiple is a multiple, never a percentage");
});

test("a sold position reports profit as a signed figure", () => {
  const text = stripTags(
    html(
      createElement(TrackRecordView, {
        data: trackBody({
          realised: [
            {
              businessId: 2,
              businessName: "Sold Co",
              cost: 1000000,
              proceeds: 1500000,
              profit: 500000,
              moic: 1.5,
              daysHeld: 365,
              yearsHeld: 1,
              closedOn: "2025-01-01",
            },
          ],
        }) as never,
      }),
    ),
  );
  assert.match(text, /Sold Co/);
  assert.match(text, /1\.50x/);
});

test("IRR beside TVPI is explained, not left to look like a contradiction", () => {
  const text = stripTags(
    html(
      createElement(TrackRecordView, {
        data: trackBody({ open: [], realised: [] }, { irr: -0.6019, tvpi: 3.05, dpi: 0.17, openCost: 7_500_000 }) as never,
      }),
    ),
  );
  assert.match(text, /counts only cash that has actually moved/i, "the gap between IRR and TVPI is unexplained");
  assert.match(text, /TVPI counts what is still held/i);
});

/* -------------------------------------------------------------------------- */
/* Client receivables                                                           */
/* -------------------------------------------------------------------------- */

const invoice = (over: Record<string, unknown> = {}): Invoice => ({
  id: 1,
  number: "INV-1",
  businessId: 1,
  businessName: "Client Co",
  currency: "KES",
  issuedOn: "2026-01-31",
  dueOn: "2026-03-01",
  note: "",
  voidedOn: null,
  lines: [],
  tax: 0,
  total: 100000,
  paid: 0,
  credited: 0,
  outstanding: 100000,
  overpaid: 0,
  movements: [],
  daysOverdue: null,
  status: "issued",
  ...over,
} as Invoice);

const clientRow = (over: Record<string, unknown> = {}) => ({
  businessId: 1,
  businessName: "Client Co",
  issued: 100000,
  paid: 0,
  credited: 0,
  outstanding: 100000,
  overdue: 0,
  oldestOverdueDays: null,
  currency: "KES",
  ...over,
});

test("overdue is reported apart from outstanding", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [clientRow({ outstanding: 100000, overdue: 100000, oldestOverdueDays: 90 })],
        invoices: [],
      }),
    ),
  );
  assert.match(text, /100,000 of the 100,000 outstanding is past its/, "owed and late are lumped together");
  assert.match(text, /90d/);
});

test("a voided invoice is not shown as money anyone owes", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [clientRow()],
        invoices: [invoice({ voidedOn: "2026-02-01", status: "void", outstanding: 0, total: 100000 })],
      }),
    ),
  );
  assert.ok(!text.includes("Unpaid"), "a voided invoice was still listed as unpaid");
});

test("being in credit reads as a credit, not a negative bill", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [clientRow({ outstanding: 0, paid: 150000 })],
        invoices: [
          invoice({ outstanding: 0, overpaid: 50000, paid: 150000, status: "overpaid" }),
        ],
      }),
    ),
  );
  assert.match(text, /50,000 credit/);
  assert.match(text, /In credit/);
});

test("a part-paid invoice says part paid, not paid", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [clientRow({ issued: 100000, paid: 40000, outstanding: 60000 })],
        invoices: [invoice({ paid: 40000, outstanding: 60000, status: "part_paid" })],
      }),
    ),
  );
  assert.match(text, /Part paid/);
  assert.ok(!text.includes("Paid Unpaid"), "a part payment was reported as settled");
});

test("nothing invoiced says so, rather than showing an empty table", () => {
  const text = stripTags(html(createElement(ReceivablesView, { rows: [], invoices: [] })));
  assert.match(text, /Nothing has been invoiced yet/);
});

/* -------------------------------------------------------------------------- */
/* Intercompany                                                                  */
/* -------------------------------------------------------------------------- */

const charge = (over: Record<string, unknown> = {}): IntercompanyCharge =>
  ({
    id: 1,
    number: "IC-0001",
    businessName: "Green Life Nursery",
    amount: 650000,
    currency: "KES",
    chargedOn: "2026-03-31",
    basisLabel: "Management fee",
    status: "confirmed",
    confirmedOn: "2026-04-02",
    sides: [
      { role: "debtor", businessId: 1, stakeholderId: null, name: "Green Life Nursery" },
      { role: "creditor", businessId: null, stakeholderId: 1, name: "Zainpreneur Nominees Ltd" },
    ],
    ...over,
  }) as IntercompanyCharge;

const consolidation = (over: Record<string, unknown> = {}) => ({
  rows: [
    {
      businessId: 1,
      businessName: "Green Life Nursery",
      reportedNet: 3800000,
      chargedToGroup: 0,
      chargedByGroup: 0,
      chargedByPrincipal: 650000,
      chargedToPrincipal: 0,
      standaloneNet: 3800000,
    },
  ],
  groupBusinesses: 1,
  reportedNet: 3800000,
  eliminatedWithinGroup: 0,
  standaloneTotal: 3800000,
  paidToPrincipal: 650000,
  proposed: 0,
  proposedAmount: 0,
  reconciles: true,
  problems: [],
  ...over,
});

test("a group that does not reconcile says so, loudly", () => {
  const text = stripTags(
    html(
      createElement(IntercompanyView, {
        charges: [],
        consolidation: consolidation({
          reconciles: false,
          problems: ["eliminating internal trading moved the group total by 650,000"],
        }) as never,
      }),
    ),
  );
  assert.match(text, /does not reconcile/);
  assert.match(text, /moved the group total by 650,000/, "the reason was swallowed");
});

test("internal trading that does not change the total is stated, not implied", () => {
  // Two companies, so the wording is the one about trading between them. The
  // single-company case says something different and equally true: there is nothing
  // inside the group to eliminate.
  const base = consolidation();
  const text = stripTags(
    html(
      createElement(IntercompanyView, {
        charges: [],
        consolidation: consolidation({
          groupBusinesses: 2,
          rows: [
            { ...base.rows[0]! },
            {
              businessId: 2,
              businessName: "Riverside Lodge",
              reportedNet: 500000,
              chargedToGroup: 300000,
              chargedByGroup: 0,
              chargedByPrincipal: 0,
              chargedToPrincipal: 0,
              standaloneNet: 200000,
            },
          ],
          reportedNet: 4300000,
          standaloneTotal: 4300000,
        }) as never,
      }),
    ),
  );
  assert.match(text, /does not change the group total/);
  assert.match(text, /moved the total by 0/);
});

test("a group of one says there is nothing to eliminate, rather than showing an empty table", () => {
  const text = stripTags(
    html(createElement(IntercompanyView, { charges: [], consolidation: consolidation() as never })),
  );
  assert.match(text, /nothing inside the group to eliminate/);
  assert.match(text, /never added back/);
});

test("a proposed charge is not presented as recognised", () => {
  const text = stripTags(
    html(
      createElement(IntercompanyView, {
        charges: [charge({ status: "proposed", confirmedOn: null })],
        consolidation: consolidation({ proposed: 1, proposedAmount: 650000 }) as never,
      }),
    ),
  );
  assert.match(text, /proposed only/);
  assert.match(text, /has not been recognised/);
});

test("a charge shows both parties, so it is never just a number", () => {
  const text = stripTags(
    html(
      createElement(IntercompanyView, {
        charges: [charge()],
        consolidation: consolidation() as never,
      }),
    ),
  );
  assert.match(text, /Green Life Nursery → Zainpreneur Nominees Ltd/);
});

/* -------------------------------------------------------------------------- */
/* Currencies                                                                   */
/* -------------------------------------------------------------------------- */

const position = (over: Record<string, unknown> = {}) => ({
  bookCurrency: "KES",
  inUse: [
    { currency: "KES", businesses: 4, invoices: 3 },
    { currency: "USD", businesses: 1, invoices: 1 },
  ],
  rates: [{ from: "USD", to: "KES", rate: 129.64, quotedOn: "2026-10-01", source: "CBK", ageDays: 2, stale: false }],
  stale: [],
  ...over,
});

test("the no-rate rule is stated on the page, not left to be discovered", () => {
  // A reader who does not know that a conversion needs a rate will assume one did not
  // happen, which is how a figure in another currency quietly becomes a local one.
  const text = stripTags(
    html(createElement(CurrencyView, position() as never)),
  );
  assert.match(text, /there is no default/i);
  assert.match(text, /a missing rate stops the figure/i);
});

test("a currency in use with no rate is called out, not averaged in", () => {
  const text = stripTags(
    html(
      createElement(CurrencyView, {
        ...position(),
        rates: [
          { from: "USD", to: "KES", rate: 0, quotedOn: "", source: "missing", ageDays: 0, stale: true },
        ],
      }) as never,
    ),
  );
  assert.match(text, /No rate recorded/);
  assert.match(text, /none recorded/);
  assert.match(text, /cannot be converted into KES/);
});

test("a converted figure shows the rate and the day it used", () => {
  const text = stripTags(html(createElement(CurrencyView, position() as never)));
  assert.match(text, /129\.6400/);
  assert.match(text, /2026-10-01/);
  assert.match(text, /can be checked rather than taken on trust/);
});

test("an old rate is flagged but still usable, because that is the rate for the day", () => {
  const text = stripTags(
    html(
      createElement(CurrencyView, {
        ...position(),
        rates: [
          { from: "USD", to: "KES", rate: 129, quotedOn: "2020-01-01", source: "old", ageDays: 2000, stale: true },
        ],
        stale: [{ from: "USD", to: "KES", quotedOn: "2020-01-01", ageDays: 2000 }],
      }) as never,
    ),
  );
  assert.match(text, /2000d old/);
  assert.match(text, /still convert/i);
  assert.match(text, /last quoted 2020-01-01/);
});

test("receivables across currencies are shown per currency, never summed", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [
          { ...clientRow({ issued: 100000, outstanding: 100000, businessId: 1, businessName: "Kes Co" }), currency: "KES" },
          {
            ...clientRow({ issued: 500, paid: 200, outstanding: 300, businessId: 2, businessName: "Dollar Co" }),
            currency: "USD",
          },
        ] as never,
        invoices: [],
        byCurrency: [
          { currency: "KES", issued: 100000, paid: 0, credited: 0, outstanding: 100000, overdue: 0 },
          { currency: "USD", issued: 500, paid: 200, credited: 0, outstanding: 300, overdue: 0 },
        ],
        bookTotal: null,
        cannotTotal: "No KES total is shown: no rate for TZS on 2026-10-02",
      }),
    ),
  );
  assert.match(text, /100,000 KES/, "each currency is labelled");
  assert.match(text, /500 USD/);
  assert.ok(!/100,500/.test(text), "the two currencies were added together");
  assert.match(text, /left in their own currencies rather than added together/);
});

test("when every rate exists, one labelled book total is given", () => {
  const text = stripTags(
    html(
      createElement(ReceivablesView, {
        rows: [clientRow()] as never,
        invoices: [],
        bookTotal: { currency: "KES", issued: 622272, paid: 200000, outstanding: 422272, overdue: 0 },
        cannotTotal: null,
      }),
    ),
  );
  assert.match(text, /Outstanding, KES/);
  assert.match(text, /422,272/);
});
