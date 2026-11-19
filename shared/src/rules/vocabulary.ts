/**
 * Vocabularies and their display labels.
 *
 * Every closed set in the book is declared once, here, and imported by both the
 * API and the forms. The original declared relationship types in `db.py`, status
 * vocabularies in `services.py`, and a *second* relationship vocabulary for
 * per-holder links using a different spelling of the same word
 * (`client+equity` against `client_equity`) — then surfaced raw enum values in
 * user-facing errors, so a form said "Client" while the message said "client".
 * One list, one spelling, one label map.
 */

/* -------------------------------------------------------------------------- */
/* Businesses                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The relationship describes *ownership shape only*.
 *
 * Whether Zainpreneur sells to a business is a separate fact (`served`), never a
 * fourth type. A business you serve and hold 40% of is simply `equity` — and it
 * still gets the "Client + Equity" badge, which is derived rather than stored.
 */
export const RELATIONSHIP_TYPES = ["client", "equity", "fully_owned"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  client: "Client",
  equity: "Equity",
  fully_owned: "Fully owned",
};

/** Shown as an eyebrow on a business page. */
export const RELATIONSHIP_DESCRIPTION: Record<RelationshipType, string> = {
  client: "Zainpreneur serves this business and holds no equity.",
  equity: "Zainpreneur holds a part stake.",
  fully_owned: "Wholly owned by Zainpreneur Nominees Ltd.",
};

/** Order used wherever the four are listed. */
export const RELATIONSHIP_ORDER: readonly RelationshipType[] = RELATIONSHIP_TYPES;

export const BUSINESS_STATUSES = [
  "prospect",
  "active",
  "inactive",
  "closed",
  "exited",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  closed: "Closed",
  exited: "Exited",
};

/**
 * `prospect` and `exited` are claims about ownership, so the ledger can prove or
 * disprove them: a prospect holds no equity, and an exited business is one
 * Zainpreneur no longer holds.
 */
export const STATUS_ASSERTED_FROM_OWNERSHIP: readonly BusinessStatus[] = ["prospect", "exited"];

/**
 * The derived portfolio vocabulary. Deliberately the *same words* as
 * `RELATIONSHIP_TYPES` — the original had "venture" here and "fully_owned" there
 * for the same idea, which made the two look like different classifications.
 */
export const PORTFOLIO_TYPES = ["fully_owned", "equity", "client", "none"] as const;
export type PortfolioType = (typeof PORTFOLIO_TYPES)[number];

export const PORTFOLIO_LABEL: Record<PortfolioType, string> = {
  fully_owned: "Fully owned",
  equity: "Equity stake",
  client: "Client",
  none: "No relationship",
};

/**
 * "Client + Equity" is derived, never stored: true when the business has an open
 * Zainpreneur stake *and* Zainpreneur serves it. The original stored it and
 * derived it wrongly — building the test from every stakeholder's links rather
 * than Zainpreneur's — so businesses served at 0% equity were labelled as part
 * owners.
 */
export function portfolioBadge(type: PortfolioType, served: boolean): string {
  if (type === "equity" && served) return "Client + Equity";
  return PORTFOLIO_LABEL[type];
}

/* -------------------------------------------------------------------------- */
/* Stakeholders                                                                  */
/* -------------------------------------------------------------------------- */

export const STAKEHOLDER_KINDS = ["individual", "company", "fund", "trust"] as const;
export type StakeholderKind = (typeof STAKEHOLDER_KINDS)[number];

export const STAKEHOLDER_KIND_LABEL: Record<StakeholderKind, string> = {
  individual: "Person",
  company: "Company",
  fund: "Fund",
  trust: "Trust",
};

/** Kinds that are not people. Used by the fully-owned rule. */
export const NON_PERSON_KINDS: readonly StakeholderKind[] = ["company", "fund", "trust"];

export const PERSON_ROLES = [
  "employee",
  "freelancer",
  "contractor",
  "consultant",
  "specialist",
  "other",
] as const;

export const ORG_ROLES = [
  "partner",
  "vendor",
  "supplier",
  "service_provider",
  "software_company",
  "it_company",
  "hosting_provider",
  "other",
] as const;

export const ROLE_LABEL: Record<string, string> = {
  employee: "Employee",
  freelancer: "Freelancer",
  contractor: "Contractor",
  consultant: "Consultant",
  specialist: "Specialist",
  partner: "Partner",
  vendor: "Vendor",
  supplier: "Supplier",
  service_provider: "Service provider",
  software_company: "Software company",
  it_company: "IT company",
  hosting_provider: "Hosting provider",
  other: "Other",
};

/**
 * A holder's link to a business. `client` means "you serve them, they own it";
 * `equity` means "they hold a stake", whether or not you also serve them.
 */
export const HOLDER_RELATIONSHIPS = ["equity", "client", "supplier", "partner"] as const;
export type HolderRelationship = (typeof HOLDER_RELATIONSHIPS)[number];

export const HOLDER_RELATIONSHIP_LABEL: Record<HolderRelationship, string> = {
  equity: "Equity",
  client: "Client",
  supplier: "Supplier",
  partner: "Partner",
};

export const BRANCH_RELATIONSHIPS = ["subsidiary", "equity", "partner"] as const;
export const BRANCH_RELATIONSHIP_LABEL: Record<string, string> = {
  subsidiary: "Subsidiary",
  equity: "Equity",
  partner: "Partner",
};

/* -------------------------------------------------------------------------- */
/* Locations and documents                                                       */
/* -------------------------------------------------------------------------- */

export const LOCATION_KINDS = [
  "office",
  "site",
  "warehouse",
  "store",
  "factory",
  "branch",
  "registered",
] as const;

export const LOCATION_KIND_LABEL: Record<string, string> = {
  office: "Office",
  site: "Site",
  warehouse: "Warehouse",
  store: "Store",
  factory: "Factory",
  branch: "Branch",
  registered: "Registered address",
};

export const DOCUMENT_KINDS = [
  "incorporation",
  "share_register",
  "licence",
  "lease",
  "contract",
  "financial",
  "tax",
  "insurance",
  "other",
] as const;

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  incorporation: "Incorporation",
  share_register: "Share register",
  licence: "Licence",
  lease: "Lease",
  contract: "Contract",
  financial: "Financial",
  tax: "Tax",
  insurance: "Insurance",
  other: "Other",
};

/* -------------------------------------------------------------------------- */
/* Money and time                                                                */
/* -------------------------------------------------------------------------- */

export const DISTRIBUTION_KINDS = [
  "dividend",
  "distribution",
  "rent",
  "capital_repayment",
  "salary",
  "other",
] as const;
export type DistributionKind = (typeof DISTRIBUTION_KINDS)[number];

export const DISTRIBUTION_KIND_LABEL: Record<DistributionKind, string> = {
  dividend: "Dividend",
  distribution: "Distribution",
  rent: "Rent",
  capital_repayment: "Return of capital",
  salary: "Salary / fee",
  other: "Other",
};

/**
 * Return of capital is not income. Filing it as a dividend inflates every return
 * figure in the book by exactly the amount returned — the defect the original
 * documented and then ignored in its own analytics.
 */
export const RETURN_OF_CAPITAL: DistributionKind = "capital_repayment";
export const INCOME_KINDS: readonly DistributionKind[] = DISTRIBUTION_KINDS.filter(
  (k) => k !== RETURN_OF_CAPITAL,
);

export const DIVIDEND_CADENCES = ["monthly", "quarterly", "annual", "none"] as const;
export type DividendCadence = (typeof DIVIDEND_CADENCES)[number];

export const DIVIDEND_CADENCE_LABEL: Record<DividendCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annually",
  none: "No schedule",
};

/**
 * D5 — the dividend entitlement boundary.
 *
 * Default is record-date ownership: a dividend belongs to whoever held on the
 * declaration date, and a later transfer does not move entitlement for a dividend
 * already declared. `prorated` exists for a shareholders' agreement that grants a
 * departing stakeholder a proportion, and is applied *per dividend* rather than
 * globally — a global switch would silently rewrite what every past dividend
 * meant, which is exactly the kind of drift the derivation audit exists to stop.
 */
export const ENTITLEMENT_MODES = ["record_date", "contractual"] as const;
export type EntitlementMode = (typeof ENTITLEMENT_MODES)[number];

export const ENTITLEMENT_MODE_LABEL: Record<EntitlementMode, string> = {
  record_date: "Record date",
  contractual: "Contractual",
};

export const CONTRACTUAL_BASES = ["explicit", "prorated_days"] as const;
export type ContractualBasis = (typeof CONTRACTUAL_BASES)[number];

export const CONTRACTUAL_BASIS_LABEL: Record<ContractualBasis, string> = {
  explicit: "Recorded amounts",
  prorated_days: "Pro-rated by days",
};

export const ROUND_KINDS = ["initial", "additional", "re_entry"] as const;
export const ROUND_KIND_LABEL: Record<string, string> = {
  initial: "Initial investment",
  additional: "Additional capital",
  re_entry: "Re-entry",
};

export const CURRENCIES = ["KES", "USD", "TZS", "GBP", "EUR"] as const;

/* -------------------------------------------------------------------------- */
/* 24/25. The catalogue                                                         */
/* -------------------------------------------------------------------------- */

/**
 * What a rate means.
 *
 * `quote_required` is the one model with no rate at all, and that is the point: the
 * work is scoped first and priced after, so a missing rate is the *answer* rather than
 * an oversight. The original stored a null rate for these with nothing in the type to
 * say that the null was deliberate, so a forgotten price and an unscoped job looked
 * identical — and both surfaced as a blank cell nobody could interpret.
 */
export const PRICING_MODELS = [
  "fixed",
  "hourly",
  "monthly",
  "retainer",
  "per_unit",
  "quote_required",
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_MODEL_LABEL: Record<PricingModel, string> = {
  fixed: "Fixed price",
  hourly: "Hourly",
  monthly: "Monthly",
  retainer: "Retainer",
  per_unit: "Per unit",
  quote_required: "Quote required",
};

/** Only `quote_required` is allowed to have no rate. Everything else must have one. */
export const RATE_REQUIRED: readonly PricingModel[] = PRICING_MODELS.filter(
  (m) => m !== "quote_required",
);

/** Whether a price is a one-off total or a rate something is multiplied by. */
export const PRICING_UNITS: Record<PricingModel, "total" | "rate"> = {
  fixed: "total",
  hourly: "rate",
  monthly: "total",
  retainer: "total",
  per_unit: "rate",
  quote_required: "total",
};

/** How the work is delivered, and who turns up to do it. */
export const DELIVERY_MODELS = ["internal", "outsourced", "hybrid"] as const;
export type DeliveryModel = (typeof DELIVERY_MODELS)[number];

export const DELIVERY_MODEL_LABEL: Record<DeliveryModel, string> = {
  internal: "Internal",
  outsourced: "Outsourced",
  hybrid: "Hybrid",
};

export const REQUEST_STATUSES = [
  "requested",
  "reviewing",
  "accepted",
  "in_progress",
  "on_hold",
  "delivered",
  "completed",
  "rejected",
  "cancelled",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  reviewing: "Under review",
  accepted: "Accepted",
  in_progress: "In progress",
  on_hold: "On hold",
  delivered: "Delivered",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

/** Work that stops without ever being delivered. */
export const REQUEST_ENDED_WITHOUT_DELIVERY: readonly RequestStatus[] = [
  "rejected",
  "cancelled",
];

/**
 * The lifecycle a request actually walks, rather than a list of states.
 *
 * A set of states is not a process. `on_hold` is somewhere you can return from and
 * nowhere you can only enter once, `completed` is the end, and the original treated the
 * whole vocabulary as one undifferentiated list — so it could mark a request
 * "completed" and then move it back to "requested" with nothing to object.
 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  requested: ["reviewing", "accepted", "rejected", "cancelled"],
  reviewing: ["accepted", "rejected", "cancelled", "on_hold"],
  accepted: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["delivered", "on_hold", "cancelled"],
  on_hold: ["in_progress", "cancelled"],
  delivered: ["completed", "in_progress"],
  completed: [],
  rejected: ["requested"],
  cancelled: ["requested"],
};

/** The statuses that stop a request for good. */
export const TERMINAL_REQUEST_STATUSES: readonly RequestStatus[] = REQUEST_STATUSES.filter(
  (s) => REQUEST_TRANSITIONS[s].length === 0,
);

/* -------------------------------------------------------------------------- */
/* 27. Intercompany                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Why one group company is charging another.
 *
 * There is no `interest`. The group runs no interest-bearing instruments, so listing
 * it would put a choice in front of someone who already decided not to have one — and
 * a "management fee" quietly carrying interest in it is how a zero-interest group ends
 * up paying interest.
 */
export const INTERCOMPANY_BASES = ["management_fee", "service", "cost_recharge"] as const;
export type IntercompanyBasis = (typeof INTERCOMPANY_BASES)[number];

export const INTERCOMPANY_BASIS_LABEL: Record<IntercompanyBasis, string> = {
  management_fee: "Management fee",
  service: "Internal service",
  cost_recharge: "Cost recharge",
};

/** The two sides of an internal charge. Never one without the other. */
export const INTERCOMPANY_ROLES = ["debtor", "creditor"] as const;
export type IntercompanyRole = (typeof INTERCOMPANY_ROLES)[number];

export const INTERCOMPANY_CHARGE_STATUSES = ["proposed", "confirmed", "settled"] as const;
export type IntercompanyChargeStatus = (typeof INTERCOMPANY_CHARGE_STATUSES)[number];

export const INTERCOMPANY_STATUS_LABEL: Record<IntercompanyChargeStatus, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  settled: "Settled",
};

/* -------------------------------------------------------------------------- */
/* 28. Exchange rates                                                           */
/* -------------------------------------------------------------------------- */

/**
 * How old a rate may be before it is flagged.
 *
 * A stale rate is a warning, not a refusal. A conversion for *last year* is supposed
 * to use last year's rate however old it now looks; refusing it would make historical
 * reporting impossible, and quietly substituting today's rate would restate the past.
 */
export const STALE_RATE_DAYS = 14;

/** The one thing that must never happen in this system. */
export const NO_IMPLICIT_RATE =
  "No exchange rate was given for this conversion, and treating two currencies as equal is not an option — record the rate for that date.";
