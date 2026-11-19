import { all, now, one, run } from "../db/client.js";
import {
  PRICING_MODELS,
  PRICING_MODEL_LABEL,
  PRICING_UNITS,
  RATE_REQUIRED,
  REQUEST_TRANSITIONS,
  money,
  type PricingModel,
  type RequestStatus,
} from "@zainpreneur/shared";
import { fail } from "../lib/validate.js";

/**
 * The catalogue: what is on offer, at what price, and what each tier requires.
 *
 * Three decisions live here rather than in the database:
 *
 *   **The rate belongs to the variant, never to the request.** Raising a price
 *   re-prices everything still to be delivered and rewrites nothing already invoiced.
 *
 *   **`quote_required` is allowed to have no rate, and nothing else is.** The original
 *   stored a null rate for these with nothing to distinguish a deliberately unscoped
 *   job from a forgotten price, so both surfaced as a blank cell that meant nothing.
 *
 *   **An attribute is defined once and asked of many services.** "Documents required"
 *   is one definition appearing on three services, not three copies that drift apart.
 */

const pricingModel = (value: unknown): PricingModel => {
  const model = String(value ?? "fixed");
  if (!(PRICING_MODELS as readonly string[]).includes(model)) {
    fail("pricing_model", `Pick how this is priced: ${PRICING_MODELS.join(", ")}`);
  }
  return model as PricingModel;
};

/**
 * Check a rate against its pricing model.
 *
 * The one asymmetry in the whole catalogue: `quote_required` must have *no* rate, and
 * every other model must have one. A rate on a quote-required tier is as meaningless
 * as a missing rate on a fixed-price one, and both used to be accepted.
 */
function checkedRate(model: PricingModel, raw: unknown): number | null {
  const has = raw !== undefined && raw !== null && raw !== "";
  if (model === "quote_required") {
    if (has) fail("rate", "A quote-required tier is priced after scoping, so it has no rate");
    return null;
  }
  if (!has) fail("rate", `${PRICING_MODEL_LABEL[model]} needs a rate`);
  const rate = money(Number(raw));
  if (!Number.isFinite(rate)) fail("rate", "A rate must be a number");
  if (rate < 0) fail("rate", "A rate cannot be negative");
  return rate;
}

/* -------------------------------------------------------------------------- */
/* Services                                                                     */
/* -------------------------------------------------------------------------- */

export interface ServiceSummary {
  id: number;
  name: string;
  code: string;
  category: string;
  status: string;
  description: string;
  variantCount: number;
  /** Variants that cannot be priced without a quote, so they are not orderable yet. */
  needsQuoteCount: number;
  attributeCount: number;
  active: boolean;
}

export function listServices(): ServiceSummary[] {
  return all<Record<string, unknown>>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM service_variants v WHERE v.service_id = s.id AND v.status = 'active') AS variant_count,
            (SELECT COUNT(*) FROM service_variants v WHERE v.service_id = s.id AND v.pricing_model = 'quote_required') AS needs_quote_count,
            (SELECT COUNT(*) FROM service_attribute_assignments a WHERE a.service_id = s.id) AS attribute_count
       FROM services s
      WHERE s.deleted_at IS NULL
      ORDER BY s.name COLLATE NOCASE`,
  ).map(
    (s): ServiceSummary => ({
      id: Number(s.id),
      name: String(s.name),
      code: String(s.code ?? ""),
      category: String(s.category ?? ""),
      status: String(s.status ?? "active"),
      description: String(s.description ?? ""),
      variantCount: Number(s.variant_count ?? 0),
      needsQuoteCount: Number(s.needs_quote_count ?? 0),
      attributeCount: Number(s.attribute_count ?? 0),
      active: String(s.status ?? "") === "active",
    }),
  );
}

export function createService(data: {
  name: unknown;
  code?: unknown;
  category?: unknown;
  description?: unknown;
  status?: unknown;
}): number {
  const name = String(data.name ?? "").trim();
  if (!name) fail("name", "A service needs a name");
  if (one("SELECT 1 FROM services WHERE name = ? COLLATE NOCASE AND deleted_at IS NULL", [name])) {
    fail("name", `There is already a service called ${name}`);
  }
  const ts = now();
  return Number(
    run(
      `INSERT INTO services (name, code, category, description, status, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name,
        String(data.code ?? ""),
        String(data.category ?? ""),
        String(data.description ?? ""),
        String(data.status ?? "active"),
        ts,
        ts,
      ],
    ).lastInsertRowid,
  );
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                     */
/* -------------------------------------------------------------------------- */

export interface Variant {
  id: number;
  serviceId: number;
  serviceName: string;
  name: string;
  code: string;
  description: string;
  rate: number | null;
  pricingModel: PricingModel;
  pricingModelLabel: string;
  /** 'total' or 'rate': whether the price is the whole fee or a multiplier. */
  pricingUnit: "total" | "rate";
  /**
   * Whether this tier can be invoiced as it stands. A quote-required tier has a
   * deliberate blank rate and is *not* orderable until it is quoted — saying so is
   * different from showing a blank and leaving the reader to guess.
   */
  orderable: boolean;
  requiredSkills: string;
  resources: string;
  availability: string;
  deliveryModel: string;
  turnaround: string;
  status: string;
  attributes: Array<{ attributeId: number; name: string; value: string; required: boolean }>;
}

export function listVariants(serviceId: number): Variant[] {
  return all<Record<string, unknown>>(
    `SELECT v.*, s.name AS service_name FROM service_variants v
       JOIN services s ON s.id = v.service_id
      WHERE v.service_id = ? ORDER BY v.name COLLATE NOCASE`,
    [serviceId],
  ).map(readVariant);
}

export function variantById(id: number): Variant | null {
  const v = one<Record<string, unknown>>(
    `SELECT v.*, s.name AS service_name FROM service_variants v
       JOIN services s ON s.id = v.service_id WHERE v.id = ?`,
    [id],
  );
  return v ? readVariant(v) : null;
}

function readVariant(v: Record<string, unknown>): Variant {
  const model = pricingModelOrDefault(v.pricing_model);
  return {
    id: Number(v.id),
    serviceId: Number(v.service_id),
    serviceName: String(v.service_name ?? ""),
    name: String(v.name),
    code: String(v.code ?? ""),
    description: String(v.description ?? ""),
    rate: v.rate === null || v.rate === undefined ? null : money(Number(v.rate)),
    pricingModel: model,
    pricingModelLabel: PRICING_MODEL_LABEL[model],
    pricingUnit: PRICING_UNITS[model],
    orderable: model !== "quote_required" && v.rate !== null && v.rate !== undefined,
    requiredSkills: String(v.required_skills ?? ""),
    resources: String(v.resources ?? ""),
    availability: String(v.availability ?? ""),
    deliveryModel: String(v.delivery_model ?? ""),
    turnaround: String(v.turnaround ?? ""),
    status: String(v.status ?? "active"),
    attributes: variantAttributes(Number(v.id)),
  };
}

function pricingModelOrDefault(value: unknown): PricingModel {
  const model = String(value ?? "fixed");
  return (PRICING_MODELS as readonly string[]).includes(model) ? (model as PricingModel) : "fixed";
}

export function createVariant(data: {
  serviceId: number;
  name: unknown;
  code?: unknown;
  description?: unknown;
  rate?: unknown;
  pricingModel?: unknown;
  requiredSkills?: unknown;
  resources?: unknown;
  availability?: unknown;
  deliveryModel?: unknown;
  turnaround?: unknown;
}): number {
  const serviceId = Number(data.serviceId);
  if (!one("SELECT 1 FROM services WHERE id = ? AND deleted_at IS NULL", [serviceId])) {
    fail("service_id", "That service is not in the catalogue");
  }
  const name = String(data.name ?? "").trim();
  if (!name) fail("name", "A tier needs a name");

  const model = pricingModel(data.pricingModel);
  const rate = checkedRate(model, data.rate);
  const ts = now();
  return Number(
    run(
      `INSERT INTO service_variants
         (service_id, name, code, description, rate, pricing_model, required_skills,
          resources, availability, delivery_model, turnaround, status, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)`,
      [
        serviceId,
        name,
        String(data.code ?? ""),
        String(data.description ?? ""),
        rate,
        model,
        String(data.requiredSkills ?? ""),
        String(data.resources ?? ""),
        String(data.availability ?? ""),
        String(data.deliveryModel ?? ""),
        String(data.turnaround ?? ""),
        ts,
        ts,
      ],
    ).lastInsertRowid,
  );
}

/**
 * Re-price a tier.
 *
 * The model's new price is optional: a quote-required tier being *given* a rate is a
 * real transition (the job has now been scoped), and the two constraints above are
 * checked against whichever model ends up stored rather than the one being replaced.
 */
export function repriceVariant(data: {
  variantId: number;
  rate?: unknown;
  pricingModel?: unknown;
}): number {
  const variant = one<Record<string, unknown>>("SELECT * FROM service_variants WHERE id = ?", [
    Number(data.variantId),
  ]);
  if (!variant) fail("variant_id", "That tier does not exist");

  const model = pricingModel(data.pricingModel ?? variant.pricing_model);
  // An explicit null means "no rate", which only quote_required may hold.
  const raw = data.rate === null ? null : data.rate === undefined ? variant.rate : data.rate;
  const rate = checkedRate(model, raw);

  run("UPDATE service_variants SET rate = ?, pricing_model = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", [
    rate,
    model,
    now(),
    Number(data.variantId),
  ]);
  return Number(data.variantId);
}

/* -------------------------------------------------------------------------- */
/* Attributes                                                                   */
/* -------------------------------------------------------------------------- */

export interface AttributeDef {
  id: number;
  name: string;
  kind: string;
  required: boolean;
  multiple: boolean;
  choices: string[];
  services: Array<{ id: number; name: string }>;
}

export function defineAttribute(data: {
  name: unknown;
  kind?: unknown;
  required?: unknown;
  multiple?: unknown;
  choices?: unknown[];
  /** The service it was created under. Applicability is the assignments below. */
  originServiceId?: unknown;
}): number {
  const name = String(data.name ?? "").trim();
  if (!name) fail("name", "An attribute needs a name");
  const kind = String(data.kind ?? "text");
  if (!["text", "number", "select", "boolean"].includes(kind)) {
    fail("kind", "An attribute is text, a number, a choice, or true/false");
  }
  const choices = (data.choices ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (kind === "select" && choices.length === 0) {
    fail("choices", "A choice attribute needs at least one option");
  }

  const origin = data.originServiceId ? Number(data.originServiceId) : null;
  if (origin !== null && !one("SELECT 1 FROM services WHERE id = ?", [origin])) {
    fail("origin_service_id", "That service is not in the catalogue");
  }

  const ts = now();
  const id = Number(
    run(
      `INSERT INTO service_attributes
         (service_id, name, kind, choices, required, multiple, default_value, position, created_at, updated_at, rev)
       VALUES (?, ?, ?, ?, ?, ?, '', 0, ?, ?, 1)`,
      [
        origin,
        name,
        kind,
        // Kept for compatibility with the original's comma-separated column, but the
        // rows below are the live source: an option can be reordered or renamed
        // without rewriting a string that other things are matching against.
        choices.join(","),
        data.required ? 1 : 0,
        data.multiple ? 1 : 0,
        ts,
        ts,
      ],
    ).lastInsertRowid,
  );

  choices.forEach((value, i) => {
    run(
      "INSERT INTO attribute_values (attribute_id, value, position, created_at, updated_at, rev) VALUES (?, ?, ?, ?, ?, 1)",
      [id, value, i, ts, ts],
    );
  });

  // Created under a service, it applies to it. That is the one implication, and it is
  // what stops "Documents required" becoming a question asked of every service.
  if (origin !== null) {
    run("INSERT OR IGNORE INTO service_attribute_assignments (attribute_id, service_id, created_at) VALUES (?, ?, ?)", [
      id,
      origin,
      ts,
    ]);
  }
  return id;
}

export function assignAttributeToService(attributeId: number, serviceId: number): void {
  if (!one("SELECT 1 FROM service_attributes WHERE id = ?", [attributeId])) {
    fail("attribute_id", "That attribute is not defined");
  }
  if (!one("SELECT 1 FROM services WHERE id = ? AND deleted_at IS NULL", [serviceId])) {
    fail("service_id", "That service is not in the catalogue");
  }
  run("INSERT OR IGNORE INTO service_attribute_assignments (attribute_id, service_id, created_at) VALUES (?, ?, ?)", [
    attributeId,
    serviceId,
    now(),
  ]);
}

/** What a service asks of a request — assigned, not inferred from the catalogue. */
export function serviceAttributes(serviceId: number): AttributeDef[] {
  return all<Record<string, unknown>>(
    `SELECT a.* FROM service_attributes a
       JOIN service_attribute_assignments x ON x.attribute_id = a.id
      WHERE x.service_id = ?
      ORDER BY a.position, a.name COLLATE NOCASE`,
    [serviceId],
  ).map(readAttribute);
}

function readAttribute(a: Record<string, unknown>): AttributeDef {
  const id = Number(a.id);
  return {
    id,
    name: String(a.name),
    kind: String(a.kind ?? "text"),
    required: Number(a.required ?? 0) === 1,
    multiple: Number(a.multiple ?? 0) === 1,
    choices: all<{ value: string }>(
      "SELECT value FROM attribute_values WHERE attribute_id = ? ORDER BY position, id",
      [id],
    ).map((c) => String(c.value)),
    services: all<{ id: number; name: string }>(
      `SELECT s.id, s.name FROM services s
         JOIN service_attribute_assignments x ON x.service_id = s.id
        WHERE x.attribute_id = ? ORDER BY s.name COLLATE NOCASE`,
      [id],
    ),
  };
}

function variantAttributes(variantId: number): Variant["attributes"] {
  return all<{ attribute_id: number; name: string; value: string; required: number }>(
    `SELECT v.attribute_id, a.name, v.value, a.required
       FROM service_variant_attributes v
       JOIN service_attributes a ON a.id = v.attribute_id
      WHERE v.variant_id = ? ORDER BY a.position, a.name COLLATE NOCASE`,
    [variantId],
  ).map((r) => ({
    attributeId: Number(r.attribute_id),
    name: String(r.name),
    value: String(r.value ?? ""),
    required: Number(r.required ?? 0) === 1,
  }));
}

/**
 * Answer an attribute on a tier.
 *
 * Required attributes cannot be left blank, and a `select` cannot be given a value
 * that is not one of its options. Both checks happen here rather than in the database,
 * because a CHECK constraint cannot see another table — which is precisely why the
 * original ended up able to store an answer that meant nothing.
 */
export function setVariantAttribute(data: {
  variantId: number;
  attributeId: number;
  value: unknown;
}): void {
  const variantId = Number(data.variantId);
  if (!one("SELECT 1 FROM service_variants WHERE id = ?", [variantId])) {
    fail("variant_id", "That tier does not exist");
  }
  const attribute = one<Record<string, unknown>>("SELECT * FROM service_attributes WHERE id = ?", [
    Number(data.attributeId),
  ]);
  if (!attribute) fail("attribute_id", "That attribute is not defined");

  const value = String(data.value ?? "").trim();
  const required = Number(attribute.required ?? 0) === 1;
  if (required && !value) fail("value", `${attribute.name} is required on this tier`);

  if (String(attribute.kind) === "select" && value) {
    const ok = one("SELECT 1 FROM attribute_values WHERE attribute_id = ? AND value = ?", [
      Number(attribute.id),
      value,
    ]);
    if (!ok) {
      const options = all<{ value: string }>(
        "SELECT value FROM attribute_values WHERE attribute_id = ? ORDER BY position",
        [Number(attribute.id)],
      ).map((o) => String(o.value));
      fail("value", `Pick one of: ${options.join(", ")}`);
    }
  }

  run(
    `INSERT INTO service_variant_attributes (variant_id, attribute_id, value, created_at, updated_at, rev)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT (variant_id, attribute_id)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, rev = rev + 1`,
    [variantId, Number(attribute.id), value, now(), now()],
  );
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Is this a legal move for a request?
 *
 * The original had `status` as a bare text column with every state spelled out in a
 * Python comment, so "completed" could be dragged back to "requested" and nothing
 * objected. The lifecycle is a table in `shared`, so the client and the API agree.
 */
export function transitionAllowed(from: RequestStatus, to: RequestStatus): boolean {
  return (REQUEST_TRANSITIONS[from] ?? []).includes(to);
}

export function changeRequestStatus(data: { requestId: number; status: unknown; note?: unknown }) {
  const requestId = Number(data.requestId);
  const request = one<Record<string, unknown>>(
    "SELECT * FROM service_requests WHERE id = ? AND deleted_at IS NULL",
    [requestId],
  );
  if (!request) fail("request_id", "That request does not exist");

  const to = String(data.status ?? "") as RequestStatus;
  const from = String(request.status ?? "requested") as RequestStatus;
  if (!(REQUEST_TRANSITIONS[to] ?? undefined)) fail("status", `${to} is not a state a request can be in`);

  if (!transitionAllowed(from, to)) {
    const allowed = (REQUEST_TRANSITIONS[from] ?? []).join(", ") || "nowhere — it is finished";
    fail("status", `A request that is ${labelFor(from)} can only go to ${allowed}`);
  }

  const ts = now();
  // Progress is history, so the transition is recorded rather than inferred: only the
  // current status lives on the request itself.
  run("INSERT INTO service_request_events (request_id, status, note, at) VALUES (?, ?, ?, ?)", [
    requestId,
    to,
    String(data.note ?? ""),
    ts,
  ]);
  run(
    `UPDATE service_requests
        SET status = ?,
            completed_on = CASE WHEN ? IN ('completed','rejected','cancelled') THEN ? ELSE completed_on END,
            updated_at = ?, rev = rev + 1
      WHERE id = ?`,
    [to, to, ts, ts, requestId],
  );
  return { requestId, from, to };
}

const STATUS_LABEL: Record<string, string> = {
  requested: "requested",
  reviewing: "under review",
  accepted: "accepted",
  in_progress: "in progress",
  on_hold: "on hold",
  delivered: "delivered",
  completed: "completed",
  rejected: "rejected",
  cancelled: "cancelled",
};

function labelFor(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function listRequests(businessId?: number) {
  const rows = businessId
    ? all<Record<string, unknown>>(
        `SELECT r.*, s.name AS service_name, v.name AS variant_name, b.name AS business_name
           FROM service_requests r
           JOIN businesses b ON b.id = r.business_id
           LEFT JOIN services s ON s.id = r.service_id
           LEFT JOIN service_variants v ON v.id = r.variant_id
          WHERE r.business_id = ? AND r.deleted_at IS NULL
          ORDER BY r.created_at DESC, r.id DESC`,
        [businessId],
      )
    : all<Record<string, unknown>>(
        `SELECT r.*, s.name AS service_name, v.name AS variant_name, b.name AS business_name
           FROM service_requests r
           JOIN businesses b ON b.id = r.business_id
           LEFT JOIN services s ON s.id = r.service_id
           LEFT JOIN service_variants v ON v.id = r.variant_id
          WHERE r.deleted_at IS NULL
          ORDER BY r.created_at DESC, r.id DESC`,
      );

  return rows.map((r) => {
    const from = String(r.status ?? "requested") as RequestStatus;
    return {
      id: Number(r.id),
      businessId: Number(r.business_id),
      businessName: String(r.business_name ?? ""),
      serviceId: Number(r.service_id),
      serviceName: String(r.service_name ?? ""),
      variantId: r.variant_id === null ? null : Number(r.variant_id),
      variantName: r.variant_name === null ? null : String(r.variant_name),
      status: from,
      // What this request may do next, worked out rather than left for the client to
      // know: a state list is not a process.
      allowedNext: REQUEST_TRANSITIONS[from] ?? [],
      priority: String(r.priority ?? "normal"),
      delivery: String(r.delivery ?? "internal"),
      requestedOn: r.requested_on === null ? null : String(r.requested_on),
      dueOn: r.due_on === null ? null : String(r.due_on),
      budget: r.budget === null ? null : money(Number(r.budget)),
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * No rate is stored on a request or a line-of-work; the rate belongs to the tier.
 *
 * The invoice line copies a rate on purpose — an issued document must keep saying what
 * it said — but a *request* must not, or changing a price would change what was
 * already agreed.
 */
export function ratesAreNotStoredOnRequests(): string[] {
  const offenders: string[] = [];
  for (const t of all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  )) {
    for (const c of all<{ name: string }>(`PRAGMA table_info(${t.name})`)) {
      const col = String(c.name).toLowerCase();
      if (col === "rate" || col === "price" || col === "amount" || col === "fee") {
        if (["service_requests", "service_request_configurations", "service_request_events"].includes(t.name)) {
          offenders.push(`${t.name}.${col}`);
        }
      }
    }
  }
  return offenders;
}

export { RATE_REQUIRED, PRICING_MODELS, REQUEST_TRANSITIONS };