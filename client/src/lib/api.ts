/**
 * The API client.
 *
 * Errors arrive as `{ error, field? }`. The `field` is what lets a form put the
 * message under the input that caused it — the original had no such channel, so
 * every failure was one flash string at the top of the page and a failed save
 * lost every value typed.
 */

export class ApiFailure extends Error {
  readonly status: number;
  readonly field: string | null;
  /** True when the server was never reached, as opposed to refusing. */
  readonly offline: boolean;
  constructor(message: string, status: number, field: string | null, offline = false) {
    super(message);
    this.name = "ApiFailure";
    this.status = status;
    this.field = field;
    this.offline = offline;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    // The server was never reached. That is a different fact from a refusal, and
    // "Something went wrong" says nothing about which one happened — so say it.
    throw new ApiFailure(
      "The API is not running. Start it with `npm run dev` (it serves on port 5178).",
      0,
      null,
      true,
    );
  }

  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiFailure(
        `The API replied with something that was not JSON (${res.status}).`,
        res.status,
        null,
      );
    }
  }

  if (!res.ok) {
    throw new ApiFailure(
      typeof body.error === "string" ? body.error : `The API replied ${res.status}.`,
      res.status,
      typeof body.field === "string" ? body.field : null,
    );
  }
  return body as T;
}

export interface Portfolio {
  type: "fully_owned" | "equity" | "client" | "none";
  principalEquity: number;
  served: boolean;
  badge: string;
}

export interface BusinessRow {
  id: number;
  name: string;
  legal_name: string;
  status: string;
  industry: string;
  city: string;
  country: string;
  served: number;
  relationship_type: string;
  portfolio: Portfolio;
}

export interface BusinessList {
  total: number;
  limit: number;
  offset: number;
  items: BusinessRow[];
}

export interface BusinessDetail {
  business: Record<string, unknown>;
  portfolio: Portfolio;
  relationships: Array<Record<string, unknown>>;
  allocation: {
    state: "empty" | "partial" | "full" | "over";
    totalPercent: number;
    isExact: boolean;
    deltaPercent: number;
  };
  branches: Array<Record<string, unknown>>;
}

export const api = {
  health: () => request<{ ok: boolean; at: string; businesses: number }>("/api/health"),
  businesses: (limit = 50, offset = 0) =>
    request<BusinessList>(`/api/businesses?limit=${limit}&offset=${offset}`),
  business: (id: number) => request<BusinessDetail>(`/api/businesses/${id}`),

  /* money and events */
  receivable: (id: number) =>
    request<{
      declared: number;
      paid: number;
      outstanding: number;
      perHolder: Array<{ name: string; outstanding: number }>;
    }>(`/api/businesses/${id}/receivable`),

  coverage: (id: number) =>
    request<{
      frequency: string;
      expected: number;
      paid: number;
      missing: string[];
      lastDeclared: string | null;
    }>(`/api/dividend-schedules/${id}/coverage`),

  trading: (id: number) =>
    request<{
      cycles: Array<{
        id: number;
        periodLabel: string;
        net: number;
        retained: number;
        distributable: number;
      }>;
    }>(`/api/businesses/${id}/trading`),

  dividendsOverview: () => request<DividendOverview>("/api/dividends/overview"),

  valuations: (id: number) =>
    request<{
      history: Array<{ valuedOn: string; valuation: number | null; method: string; audited: boolean }>;
      changes: Array<{
        from: string;
        to: string;
        change: number;
        changePct: number | null;
        direction: string;
        writeDown: boolean;
      }>;
    }>(`/api/businesses/${id}/valuations`),
};
export interface DividendOverview {
  declared: number;
  received: number;
  outstanding: number;
  payingCount: number;
  behindCount: number;
  staleMarkCount: number;
  businesses: Array<{
    businessId: number;
    businessName: string;
    declared: number;
    received: number;
    outstanding: number;
    coverage: {
      frequency: string;
      expected: number;
      paid: number;
      missing: string[];
    } | null;
  }>;
}

/* -- returns --------------------------------------------------------------- */

export interface RealisedPosition {
  businessId: number;
  businessName: string;
  cost: number;
  proceeds: number;
  profit: number;
  moic: number | null;
  daysHeld: number;
  yearsHeld: number;
  closedOn: string;
}

export interface OpenPosition {
  businessId: number;
  businessName: string;
  cost: number;
  equity: number;
  value: number;
  basis: "mark" | "cost";
  markedOn: string | null;
  distributionsReceived: number;
}

export interface TrackRecord {
  stakeholderId: number | null;
  note?: string;
  realised: RealisedPosition[];
  open: OpenPosition[];
  totals: {
    realisedCost: number;
    realisedProceeds: number;
    realisedProfit: number;
    realisedMoic: number | null;
    openCost: number;
    openValue: number;
    distributionsReceived: number;
    totalReturn: number;
    totalValue: number;
    moic: number | null;
    tvpi: number | null;
    dpi: number | null;
    rvpi: number | null;
    irr: number | null;
    unmarkedPositions: number;
  } | null;
}

/**
 * `null` means "no such figure", never zero.
 *
 * A missing multiple is not a multiple of nought, and the UI is built to say which
 * figures are absent rather than printing 0x beside them.
 */
export type Multiple = number | null;

export const returnsApi = {
  track: (stakeholderId?: number) =>
    request<TrackRecord>(
      stakeholderId ? `/api/returns?stakeholder_id=${stakeholderId}` : "/api/returns",
    ),
  position: (stakeholderId: number, businessId: number) =>
    request<{
      businessId: number;
      stakeholderId: number;
      account: {
        contributed: number;
        returnedOfCapital: number;
        distributed: number;
        realised: number;
        netInvested: number;
        capitalAtWork: number;
      };
      multiples: {
        moic: Multiple;
        cashOnCash: Multiple;
        dpi: Multiple;
        tvpi: Multiple;
        rvpi: Multiple;
      };
      flows: Array<{ on: string; amount: number; kind: string; label: string; ref: string }>;
      atCost: boolean;
    }>(`/api/returns/${stakeholderId}/${businessId}`),
  flows: (stakeholderId: number, businessId?: number) =>
    request<{
      flows: Array<{ on: string; amount: number; kind: string; label: string; ref: string }>;
      irr: number | null;
    }>(
      `/api/returns/${stakeholderId}/flows${businessId ? `?business_id=${businessId}` : ""}`,
    ),
};

/* -- catalogue and invoicing ------------------------------------------------- */

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "part_paid"
  | "paid"
  | "overpaid"
  | "credited"
  | "void";

export interface InvoiceLine {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number | null;
  pricingModel: string;
  discount: number;
  taxRate: number | null;
  taxAmount: number | null;
  subtotal: number;
  total: number;
}

export interface Invoice {
  id: number;
  number: string;
  businessId: number;
  businessName: string;
  currency: string;
  issuedOn: string;
  dueOn: string | null;
  note: string;
  voidedOn: string | null;
  lines: InvoiceLine[];
  tax: number;
  total: number;
  paid: number;
  credited: number;
  outstanding: number;
  /** Paid more than owed. Not a negative bill. */
  overpaid: number;
  movements: Array<{ on: string; amount: number; kind: "payment" | "credit" }>;
  daysOverdue: number | null;
  status: InvoiceStatus;
}

export interface ReceivableRow {
  businessId: number;
  businessName: string;
  issued: number;
  paid: number;
  credited: number;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number | null;
  currency: string;
}

export interface ServiceSummary {
  id: number;
  name: string;
  category: string;
  status: string;
  description: string;
  variantCount: number;
  needsQuoteCount: number;
  attributeCount: number;
}

export interface Variant {
  id: number;
  name: string;
  rate: number | null;
  pricingModel: string;
  pricingModelLabel: string;
  pricingUnit: "total" | "rate";
  /** False for a quote-required tier: a blank rate there is an answer, not an oversight. */
  orderable: boolean;
  turnaround: string;
  attributes: Array<{ attributeId: number; name: string; value: string; required: boolean }>;
}

export const invoicingApi = {
  receivables: () =>
    request<{
      rows: ReceivableRow[];
      /**
       * One entry per currency. There is no unconditional `issued`/`outstanding`
       * grand total on the wire, because the API refuses to add currencies together.
       */
      byCurrency: Array<{
        currency: string;
        issued: number;
        paid: number;
        credited: number;
        outstanding: number;
        overdue: number;
      }>;
      /** Present only when every currency has a rate into the book's currency. */
      bookTotal: {
        currency: string;
        issued: number;
        paid: number;
        outstanding: number;
        overdue: number;
      } | null;
      bookCurrency: string;
      cannotTotal: string | null;
    }>("/api/receivables"),
  invoices: (businessId?: number) =>
    request<{ invoices: Invoice[] }>(
      `/api/invoices${businessId ? `?business_id=${businessId}` : ""}`,
    ),
  services: () => request<{ services: ServiceSummary[] }>("/api/services"),
  service: (id: number) =>
    request<{ service: ServiceSummary; variants: Variant[] }>(`/api/services/${id}`),
};

/* -- intercompany ----------------------------------------------------------- */

export interface ChargeSide {
  role: "debtor" | "creditor";
  businessId: number | null;
  stakeholderId: number | null;
  name: string;
}

export interface IntercompanyCharge {
  id: number;
  number: string;
  businessName: string;
  amount: number;
  currency: string;
  chargedOn: string;
  basisLabel: string;
  status: "proposed" | "confirmed" | "settled";
  confirmedOn: string | null;
  sides: [ChargeSide, ChargeSide];
}

export interface ConsolidationRow {
  businessId: number;
  businessName: string;
  reportedNet: number;
  chargedToGroup: number;
  chargedByGroup: number;
  chargedByPrincipal: number;
  chargedToPrincipal: number;
  standaloneNet: number;
}

export const intercompanyApi = {
  charges: () =>
    request<{ charges: IntercompanyCharge[]; group: Array<{ id: number; name: string }> }>(
      "/api/intercompany-charges",
    ),
  consolidation: () =>
    request<{
      rows: ConsolidationRow[];
      groupBusinesses: number;
      reportedNet: number;
      eliminatedWithinGroup: number;
      standaloneTotal: number;
      paidToPrincipal: number;
      earnedFromPrincipal: number;
      proposed: number;
      proposedAmount: number;
      reconciles: boolean;
      problems: string[];
    }>("/api/consolidation"),
};

/* -- currencies ------------------------------------------------------------- */

export interface RateQuote {
  from: string;
  to: string;
  rate: number;
  quotedOn: string;
  source: string;
  ageDays: number;
  stale: boolean;
}

export const fxApi = {
  position: () =>
    request<{
      bookCurrency: string;
      inUse: Array<{ currency: string; businesses: number; invoices: number }>;
      rates: RateQuote[];
      stale: Array<{ from: string; to: string; quotedOn: string; ageDays: number }>;
    }>("/api/currencies"),
  rates: () =>
    request<{
      rates: Array<{ from: string; to: string; rate: number; quotedOn: string; source: string }>;
    }>("/api/fx-rates"),
  audit: () =>
    request<{
      tables: string[];
      offenders: string[];
      brokenDeclarations: string[];
      inherited: number;
      owned: number;
    }>("/api/currency-audit"),
  convert: (amount: number, from: string, to: string, on: string) =>
    request<{ amount: number; quote: RateQuote }>(
      `/api/convert?amount=${amount}&from=${from}&to=${to}&on=${on}`,
    ),
};
