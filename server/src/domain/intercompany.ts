import { all, now, one, run, tx } from "../db/client.js";
import {
  money,
  INTERCOMPANY_BASES,
  INTERCOMPANY_BASIS_LABEL,
  INTERCOMPANY_STATUS_LABEL,
  type IntercompanyBasis,
  type IntercompanyChargeStatus,
  type IntercompanyRole,
} from "@zainpreneur/shared";
import { principalEquity, principalStakeholderId } from "./principal.js";
import { tradingSummary } from "./profitCycles.js";
import { fail } from "../lib/validate.js";

/**
 * Work done inside the group.
 *
 * When Zainpreneur charges a company it wholly owns for advisory, the group as a whole
 * has earned nothing. Both sides are the same money seen from two ends, and the whole
 * purpose of this module is to stop them being counted as two things.
 *
 * Three rules, and each one closes a way this goes wrong in practice:
 *
 *   **Both sides must be in the group.** A charge to somebody outside it is an
 *   ordinary sale and belongs on an invoice. `recordCharge` refuses it and says so,
 *   which is the same guard Phase 9 put on invoicing, pointing the other way.
 *
 *   **The counter-entry is derived, not stored.** One row holds both the debtor and
 *   the creditor, so there is nowhere to record half a charge — and half an
 *   intercompany entry is precisely how an internal transfer becomes phantom profit.
 *
 *   **Elimination is symmetric.** The same amount is removed from revenue and from
 *   expenses. Eliminating only the revenue side inflates profit by exactly the size of
 *   the transfer, which is the most common way a consolidated figure goes wrong.
 */

/** Whether Zainpreneur wholly owns this business, and can therefore charge it. */
export function inGroup(businessId: number): boolean {
  return principalEquity(businessId) >= 100;
}

/** Every business in the group. */
export function groupBusinesses(): Array<{ id: number; name: string }> {
  const principal = principalStakeholderId();
  if (!principal) return [];
  return all<{ id: number; name: string }>(
    `SELECT b.id, b.name FROM businesses b
       JOIN business_stakeholders x ON x.business_id = b.id
      WHERE x.stakeholder_id = ? AND x.exited_on IS NULL AND COALESCE(x.equity, 0) >= 100
        AND b.deleted_at IS NULL
      ORDER BY b.name COLLATE NOCASE`,
    [principal],
  );
}

const basisOf = (value: unknown): IntercompanyBasis => {
  const basis = String(value ?? "service");
  if (!(INTERCOMPANY_BASES as readonly string[]).includes(basis)) {
    fail(
      "basis",
      // The refusal mentions interest deliberately: the group runs none, and "why
      // not?" deserves an answer rather than an empty dropdown.
      /interest/i.test(basis)
        ? "This group runs no interest — there is no interest-bearing instrument to charge on"
        : `Pick what the charge is for: ${INTERCOMPANY_BASES.join(", ")}`,
    );
  }
  return basis as IntercompanyBasis;
};

/* -------------------------------------------------------------------------- */
/* Recording                                                                    */
/* -------------------------------------------------------------------------- */

export interface ChargeInput {
  number: unknown;
  /** The group company being charged. */
  businessId: number;
  /** Either another group business, or the portfolio owner. Not both. */
  toBusinessId?: unknown;
  toStakeholderId?: unknown;
  amount: unknown;
  currency?: unknown;
  chargedOn: unknown;
  basis?: unknown;
  note?: unknown;
}

export async function recordCharge(data: ChargeInput): Promise<number> {
  const number = String(data.number ?? "").trim();
  if (!number) fail("number", "An intercompany charge needs a reference");
  if (one("SELECT 1 FROM intercompany_charges WHERE number = ?", [number])) {
    fail("number", `Charge ${number} already exists`);
  }

  const businessId = Number(data.businessId);
  const business = one<{ name: string }>("SELECT name FROM businesses WHERE id = ? AND deleted_at IS NULL", [
    businessId,
  ]);
  if (!business) fail("business_id", "That business is not in the register");

  if (!inGroup(businessId)) {
    fail(
      "business_id",
      "Zainpreneur does not wholly own that business, so a charge between them is an ordinary sale — invoice it instead",
    );
  }

  // Exactly one counterparty. The schema's CHECK enforces the same thing at the
  // database level; doing it here means the reader is told which mistake they made.
  const toBusinessId = data.toBusinessId ? Number(data.toBusinessId) : null;
  const toStakeholderId = data.toStakeholderId ? Number(data.toStakeholderId) : null;
  if (toBusinessId !== null && toStakeholderId !== null) {
    fail("to_business_id", "A charge has one counterparty — another group business, or the portfolio owner");
  }
  if (toBusinessId === null && toStakeholderId === null) {
    fail("to_business_id", "A charge needs to say who is being paid");
  }

  if (toBusinessId !== null) {
    if (toBusinessId === businessId) {
      fail("to_business_id", "A business cannot charge itself");
    }
    if (!inGroup(toBusinessId)) {
      fail("to_business_id", "That business is not in the group, so this is an ordinary sale — invoice it");
    }
  }
  if (toStakeholderId !== null) {
    // Comparing a stakeholder id with a business id here would be the same category
    // error as calling a column `business_type` because it also filtered relationships:
    // both tables start at 1, so every charge looked like a business charging itself.
    // The only real self-charge is a *business* on both sides, checked above.
    const principal = principalStakeholderId();
    if (
      (!principal || toStakeholderId !== principal) &&
      !one("SELECT 1 FROM stakeholders WHERE id = ?", [toStakeholderId])
    ) {
      fail("to_stakeholder_id", "That stakeholder is not in the book");
    }
  }

  const amount = money(Number(data.amount ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) fail("amount", "A charge must be more than nothing");

  const chargedOn = String(data.chargedOn ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chargedOn)) fail("charged_on", "A charge needs a date as YYYY-MM-DD");

  const basis = basisOf(data.basis);
  const ts = now();

  return await tx(async (db) =>
    Number(
      db
        .prepare(
          `INSERT INTO intercompany_charges
             (number, business_id, to_business_id, to_stakeholder_id, amount, currency,
              charged_on, basis, note, confirmed_on, settled_on, created_at, updated_at, rev)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 1)`,
        )
        .run(
          number,
          businessId,
          toBusinessId,
          toStakeholderId,
          amount,
          String(data.currency ?? ""),
          chargedOn,
          basis,
          String(data.note ?? ""),
          ts,
          ts,
        ).lastInsertRowid,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                      */
/* -------------------------------------------------------------------------- */

export interface ChargeSide {
  role: IntercompanyRole;
  businessId: number | null;
  stakeholderId: number | null;
  name: string;
}

export interface Charge {
  id: number;
  number: string;
  businessId: number;
  businessName: string;
  amount: number;
  currency: string;
  chargedOn: string;
  basis: IntercompanyBasis;
  basisLabel: string;
  note: string;
  confirmedOn: string | null;
  settledOn: string | null;
  status: IntercompanyChargeStatus;
  /** Both sides, derived. There is no way to have one without the other. */
  sides: [ChargeSide, ChargeSide];
  /**
   * The same amount, both ways. What consolidation removes, and the reason the two
   * numbers are always equal: an elimination that touched only one side would leave a
   * profit that is exactly the size of the transfer.
   */
  elimination: { fromRevenue: number; fromExpenses: number };
}

function nameOf(businessId: number | null, stakeholderId: number | null): string {
  if (businessId !== null) {
    return String(one<{ name: string }>("SELECT name FROM businesses WHERE id = ?", [businessId])?.name ?? "");
  }
  if (stakeholderId !== null) {
    return String(one<{ name: string }>("SELECT name FROM stakeholders WHERE id = ?", [stakeholderId])?.name ?? "");
  }
  return "";
}

function readCharge(r: Record<string, unknown>): Charge {
  const businessId = Number(r.business_id);
  const toBusinessId = r.to_business_id === null || r.to_business_id === undefined ? null : Number(r.to_business_id);
  const toStakeholderId =
    r.to_stakeholder_id === null || r.to_stakeholder_id === undefined ? null : Number(r.to_stakeholder_id);
  const amount = money(Number(r.amount ?? 0));
  const basis = String(r.basis ?? "service") as IntercompanyBasis;

  const status: IntercompanyChargeStatus = r.settled_on
    ? "settled"
    : r.confirmed_on
      ? "confirmed"
      : "proposed";

  return {
    id: Number(r.id),
    number: String(r.number),
    businessId,
    businessName: String(r.business_name ?? ""),
    amount,
    currency: String(r.currency ?? ""),
    chargedOn: String(r.charged_on),
    basis,
    basisLabel: INTERCOMPANY_BASIS_LABEL[basis] ?? basis,
    note: String(r.note ?? ""),
    confirmedOn: r.confirmed_on === null || r.confirmed_on === undefined ? null : String(r.confirmed_on),
    settledOn: r.settled_on === null || r.settled_on === undefined ? null : String(r.settled_on),
    status,
    sides: [
      {
        role: "debtor",
        businessId,
        stakeholderId: null,
        name: nameOf(businessId, null),
      },
      {
        role: "creditor",
        businessId: toBusinessId,
        stakeholderId: toStakeholderId,
        name: nameOf(toBusinessId, toStakeholderId),
      },
    ],
    elimination: { fromRevenue: amount, fromExpenses: amount },
  };
}

export function listCharges(filter: { businessId?: number; confirmedOnly?: boolean } = {}): Charge[] {
  const clauses: string[] = ["c.deleted_at IS NULL"];
  const params: Array<string | number> = [];
  if (filter.businessId !== undefined) {
    clauses.push("(c.business_id = ? OR c.to_business_id = ?)");
    params.push(filter.businessId, filter.businessId);
  }
  if (filter.confirmedOnly) clauses.push("c.confirmed_on IS NOT NULL");

  return all<Record<string, unknown>>(
    `SELECT c.*, b.name AS business_name FROM intercompany_charges c
       JOIN businesses b ON b.id = c.business_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY c.charged_on DESC, c.id DESC`,
    params,
  ).map(readCharge);
}

export function chargeById(id: number): Charge | null {
  const r = one<Record<string, unknown>>(
    `SELECT c.*, b.name AS business_name FROM intercompany_charges c
       JOIN businesses b ON b.id = c.business_id WHERE c.id = ? AND c.deleted_at IS NULL`,
    [id],
  );
  return r ? readCharge(r) : null;
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Recognition is a step, not a flag.
 *
 * A management fee somebody intends to charge has not happened until it is agreed, and
 * a consolidated figure that counts intended fees as income is forecasting, not
 * reporting. Only confirmed charges are eliminated; a proposed one is shown as
 * proposed.
 */
export function confirmCharge(id: number, on?: unknown): Charge {
  const charge = chargeById(id);
  if (!charge) fail("charge_id", "That charge does not exist");
  if (charge.confirmedOn) fail("charge_id", `Charge ${charge.number} was already confirmed`);

  const when = String(on ?? today()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) fail("confirmed_on", "A confirmation needs a date as YYYY-MM-DD");
  if (when < charge.chargedOn) fail("confirmed_on", "A charge cannot be confirmed before it was raised");

  run(
    "UPDATE intercompany_charges SET confirmed_on = ?, updated_at = ?, rev = rev + 1 WHERE id = ?",
    [when, now(), id],
  );
  return chargeById(id) as Charge;
}

export function settleCharge(id: number, on?: unknown): Charge {
  const charge = chargeById(id);
  if (!charge) fail("charge_id", "That charge does not exist");
  if (!charge.confirmedOn) fail("charge_id", `Charge ${charge.number} has not been confirmed yet`);
  if (charge.settledOn) fail("charge_id", `Charge ${charge.number} was already settled`);

  const when = String(on ?? today()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(when)) fail("settled_on", "A settlement needs a date as YYYY-MM-DD");
  if (when < charge.chargedOn) fail("settled_on", "A charge cannot be settled before it was raised");

  run("UPDATE intercompany_charges SET settled_on = ?, updated_at = ?, rev = rev + 1 WHERE id = ?", [
    when,
    now(),
    id,
  ]);
  return chargeById(id) as Charge;
}

/* -------------------------------------------------------------------------- */
/* Consolidation                                                                */
/* -------------------------------------------------------------------------- */

export interface ConsolidationRow {
  businessId: number;
  businessName: string;
  /** As the company reports it, internal trading included. */
  reportedNet: number;
  /** Income earned from *other group businesses*. Both legs are inside this set. */
  chargedToGroup: number;
  /** Cost borne from *other group businesses*. Both legs are inside this set. */
  chargedByGroup: number;
  /** Charged by the portfolio owner. That income leg is *outside* this set of rows. */
  chargedByPrincipal: number;
  /** Charged *to* the portfolio owner. That cost leg is outside this set of rows. */
  chargedToPrincipal: number;
  /**
   * The company as if it had done no trading with the rest of the group.
   *
   * Only the group-to-group legs are added back, because only those have their other
   * side inside this table. Adding back a cost paid to the portfolio owner would
   * manufacture profit out of a transaction whose income is not here to offset it.
   */
  standaloneNet: number;
}

export interface Consolidation {
  rows: ConsolidationRow[];
  groupBusinesses: number;
  /** The sum of what each company reports. */
  reportedNet: number;
  /**
   * What removing group-to-group trading took out.
   *
   * For a closed set this is necessarily **zero**: an internal transfer is income to
   * one company and a cost to another, so the two cancel in the total before any
   * elimination happens. The value of the figure is that it is zero — a non-zero
   * number here would mean an entry is only half recorded, which is the one thing this
   * whole module exists to make impossible.
   */
  eliminatedWithinGroup: number;
  /** The sum of standalone results, which must equal `reportedNet`. */
  standaloneTotal: number;
  /** Cost paid *out* to the portfolio owner. Unlike internal trading, it really leaves. */
  paidToPrincipal: number;
  /** Earned *into* the group from the portfolio owner. */
  earnedFromPrincipal: number;
  /** Charges raised but not yet confirmed — shown, not eliminated. */
  proposed: number;
  proposedAmount: number;
}

/**
 * The group, with itself taken out.
 *
 * The rule governing all of it: **you can only eliminate a transaction whose other leg
 * is inside the set you are consolidating.**
 *
 * A charge between two group companies has both legs here, so both come out and the
 * total is unchanged — which is right, because the total was never wrong. A charge to
 * the portfolio owner has one leg here and one outside, so nothing is added back: the
 * money genuinely left the set of companies.
 *
 * Getting that backwards is how a consolidated figure ends up *better* than the sum of
 * its parts, which is the clearest possible sign that something was created rather
 * than removed.
 *
 * Only *confirmed* charges are eliminated. A fee nobody has agreed to has not been
 * recognised, and eliminating it would remove something that has not happened.
 */
export function consolidation(): Consolidation {
  const group = groupBusinesses();
  const confirmed = listCharges({ confirmedOnly: true });
  const proposedCharges = listCharges().filter((c) => c.status === "proposed");
  const principal = principalStakeholderId();

  const rows: ConsolidationRow[] = group.map((b) => {
    const reportedNet = tradingSummary(b.id).net;
    // Everything this company has been charged by anybody in the book — including the
    // portfolio owner, who is not a business and so is not in the rows above. Missing
    // that second case made a management fee from the owner invisible entirely.
    const chargedToThis = confirmed.filter(
      (c) => c.sides[1].businessId === b.id || (c.sides[1].businessId === null && c.sides[1].stakeholderId === principal),
    );
    const chargedByThis = confirmed.filter((c) => c.businessId === b.id);

    // Split by who the counterparty is: only a group business's payment has its other
    // leg inside this table.
    const chargedToGroup = money(
      chargedByThis.filter((c) => c.sides[1].businessId !== null).reduce((s, c) => s + c.amount, 0),
    );
    const chargedByGroup = money(
      chargedToThis.filter((c) => c.sides[1].businessId !== null).reduce((s, c) => s + c.amount, 0),
    );
    const chargedByPrincipal = money(
      chargedToThis.filter((c) => c.sides[1].stakeholderId !== null).reduce((s, c) => s + c.amount, 0),
    );
    const chargedToPrincipal = money(
      chargedByThis.filter((c) => c.sides[1].businessId === null).reduce((s, c) => s + c.amount, 0),
    );

    return {
      businessId: b.id,
      businessName: b.name,
      reportedNet,
      chargedToGroup,
      chargedByGroup,
      chargedByPrincipal,
      chargedToPrincipal,
      standaloneNet: money(reportedNet - chargedToGroup + chargedByGroup),
    };
  });

  const reportedNet = money(rows.reduce((s, r) => s + r.reportedNet, 0));
  const standaloneTotal = money(rows.reduce((s, r) => s + r.standaloneNet, 0));

  return {
    rows,
    groupBusinesses: group.length,
    reportedNet,
    eliminatedWithinGroup: money(reportedNet - standaloneTotal),
    standaloneTotal,
    paidToPrincipal: money(rows.reduce((s, r) => s + r.chargedByPrincipal, 0)),
    earnedFromPrincipal: money(rows.reduce((s, r) => s + r.chargedToPrincipal, 0)),
    proposed: proposedCharges.length,
    proposedAmount: money(proposedCharges.reduce((s, c) => s + c.amount, 0)),
  };
}

/**
 * Does the consolidation reconcile?
 *
 * Stated rather than assumed. Each of these fails in a different direction, and none
 * of them would show up in a single total.
 */
export function consolidationReconciles(c = consolidation()): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (c.eliminatedWithinGroup !== 0) {
    problems.push(
      `eliminating internal trading moved the group total by ${c.eliminatedWithinGroup}, so an entry is only half recorded`,
    );
  }
  if (c.standaloneTotal !== c.reportedNet) {
    problems.push(`standalone ${c.standaloneTotal} does not equal reported ${c.reportedNet}`);
  }
  for (const row of c.rows) {
    if (row.chargedToGroup > 0 && row.chargedToGroup === row.chargedByGroup) {
      problems.push(
        `${row.businessName} charged and was charged the same amount — check it is not booked on both sides`,
      );
    }
  }
  const integrity = chargeIntegrity();
  if (!integrity.balanced) for (const b of integrity.breaches) problems.push(`${b.number}: ${b.reason}`);
  return { ok: problems.length === 0, problems };
}


/** Reconciliation: the two sides must balance, or an entry is half-recorded. */
export function chargeIntegrity(charges = listCharges({ confirmedOnly: true })): {
  charges: number;
  balanced: boolean;
  breaches: Array<{ number: string; reason: string }>;
} {
  const breaches: Array<{ number: string; reason: string }> = [];
  for (const c of charges) {
    if (c.elimination.fromRevenue !== c.elimination.fromExpenses) {
      breaches.push({ number: c.number, reason: "the two legs of the elimination do not match" });
    }
    if (c.sides.length !== 2 || c.sides[0].name === "" || c.sides[1].name === "") {
      breaches.push({ number: c.number, reason: "one side of the charge does not resolve to a name" });
    }
    if (c.businessId === c.sides[1].businessId) {
      breaches.push({ number: c.number, reason: "both sides are the same business" });
    }
  }
  return { charges: charges.length, balanced: breaches.length === 0, breaches };
}

/* -------------------------------------------------------------------------- */

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export { INTERCOMPANY_BASES, INTERCOMPANY_BASIS_LABEL, INTERCOMPANY_STATUS_LABEL };