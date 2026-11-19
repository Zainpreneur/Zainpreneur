import { Router } from "express";
import { all, one } from "../db/client.js";
import { ALLOCATION_UNITS, money, toUnits } from "@zainpreneur/shared";
import {
  closePosition,
  listRounds,
  listTransfers,
  recordInvestment,
  reopenPosition,
  sellParticipation,
} from "../domain/transfers.js";
import {
  coverageFor,
  dividendsReceivable,
  entitlements,
  declarationById,
  listDeclarations,
  listSchedules,
  missingDividends,
  recordDistribution,
  setSchedule,
  settleDividend,
  whatsDue,
  incomeByKind,
} from "../domain/dividends.js";
import { listCycles, getCycle, recordProfitCycle, tradingSummary } from "../domain/profitCycles.js";
import { holdingPeriods as holdingRows } from "../domain/dividends.js";
import {
  capitalAccount,
  cashFlows,
  irr,
  multiples,
  trackRecord,
} from "../domain/returns.js";
import {
  assignAttributeToService,
  createService,
  createVariant,
  defineAttribute,
  listRequests,
  listServices,
  listVariants,
  repriceVariant,
  serviceAttributes,
  setVariantAttribute,
  variantById,
  changeRequestStatus,
} from "../domain/catalogue.js";
import {
  issueCreditNote,
  issueInvoice,
  listInvoices,
  readInvoice,
  receivableTotals,
  receivables,
  recordPayment,
  voidInvoice,
} from "../domain/invoicing.js";
import {
  chargeById,
  confirmCharge,
  consolidation,
  consolidationReconciles,
  groupBusinesses,
  listCharges,
  recordCharge,
  settleCharge,
} from "../domain/intercompany.js";
import {
  bookCurrency,
  convertExplained,
  currencyAudit,
  currencyPosition,
  recordRate,
  setBookCurrency,
} from "../domain/fx.js";
import { handle, domainInput } from "../lib/http.js";
import {
  currentMark,
  markChanges,
  positionValue,
  recordValuation,
  valuationHistory,
  clearValuation,
  staleMarks,
} from "../domain/valuations.js";

/**
 * Money and events.
 *
 * Every route returns derived figures alongside stored ones, and never a stored
 * derived figure — the reported net on a cycle is worked out on read, and the
 * change between two valuations is computed rather than kept.
 */
export const moneyRoutes = Router();

/** The catalogue and invoicing are their own routers: different ledgers. */
export const catalogueRoutes = Router();
export const invoiceRoutes = Router();
export const intercompanyRoutes = Router();
export const fxRoutes = Router();

/* -- valuations --------------------------------------------------------- */

moneyRoutes.get("/businesses/:id/valuations", (req, res) => {
  const id = Number(req.params.id);
  res.json({
    history: valuationHistory(id),
    current: currentMark(id),
    changes: markChanges(id),
    stale: staleMarks().some((m) => m.id === id),
  });
});

moneyRoutes.post("/businesses/:id/valuations", handle(async (req, res) => {
    const mark = await recordValuation({
      ...domainInput<Record<string, unknown>>(req.body),
      businessId: Number(req.params.id),
    } as Parameters<typeof recordValuation>[0]);
    res.status(201).json({ mark, current: currentMark(Number(req.params.id)) });
  }));

moneyRoutes.delete("/businesses/:id/valuations/:markId", handle(async (req, res) => {
  await clearValuation(Number(req.params.id), Number(req.params.markId));
  res.json({ ok: true, current: currentMark(Number(req.params.id)) });
}));

moneyRoutes.get("/valuations/stale", (_req, res) => {
  res.json({ items: staleMarks() });
});

/* -- profit cycles ------------------------------------------------------ */

moneyRoutes.get("/cycles", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({ items: listCycles(businessId) });
});

moneyRoutes.get("/cycles/:id", (req, res) => {
  const cycle = getCycle(Number(req.params.id));
  if (!cycle) return res.status(404).json({ error: "No such cycle" });
  res.json({ cycle });
});

moneyRoutes.post("/cycles", handle(async (req, res) => {
  const result = await recordProfitCycle(domainInput(req.body));
  res.status(201).json(result);
}));

moneyRoutes.get("/businesses/:id/trading", (req, res) => {
  const id = Number(req.params.id);
  res.json({
    summary: tradingSummary(id),
    cycles: listCycles(id),
    receivable: dividendsReceivable(id),
  });
});

/* -- distributions ------------------------------------------------------ */

moneyRoutes.get("/distributions", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  const items = listDeclarations(businessId).map((d) => ({
    ...d,
    entitlements: entitlements(d.id),
  }));
  res.json({ items });
});

moneyRoutes.get("/distributions/:id", (req, res) => {
  const declaration = declarationById(Number(req.params.id));
  if (!declaration) return res.status(404).json({ error: "No such distribution" });
  res.json({ declaration, entitlements: entitlements(declaration.id) });
});

moneyRoutes.post("/distributions", handle(async (req, res) => {
  const declaration = await recordDistribution(domainInput(req.body));
  res.status(201).json({ declaration, entitlements: entitlements(declaration.id) });
}));

moneyRoutes.post("/distributions/:id/payments", handle(async (req, res) => {
  const result = await settleDividend({
    ...domainInput<Record<string, unknown>>(req.body),
    dividendId: Number(req.params.id),
  } as Parameters<typeof settleDividend>[0]);
  res.status(201).json({ ...result, entitlements: entitlements(Number(req.params.id)) });
}));

moneyRoutes.get("/businesses/:id/receivable", (req, res) => {
  res.json(dividendsReceivable(Number(req.params.id)));
});

moneyRoutes.get("/businesses/:id/income", (req, res) => {
  res.json({ byKind: incomeByKind(Number(req.params.id)) });
});

/* -- dividend cadence --------------------------------------------------- */

moneyRoutes.get("/dividend-schedules", (_req, res) => {
  res.json({ items: listSchedules() });
});

moneyRoutes.put("/dividend-schedules", handle(async (req, res) => {
  res.json(await setSchedule(domainInput(req.body)));
}));

moneyRoutes.get("/dividend-schedules/:id/coverage", (req, res) => {
  const report = coverageFor(Number(req.params.id));
  if (!report) return res.status(404).json({ error: "That business has no dividend schedule" });
  res.json(report);
});

moneyRoutes.get("/dividend-schedules/:id/due", (req, res) => {
  res.json({ items: whatsDue(Number(req.params.id)) });
});

/* -- alerts ------------------------------------------------------------- */

moneyRoutes.get("/alerts/missing-dividends", (_req, res) => {
  const items = missingDividends();
  res.json({ items, count: items.length });
});

/* -- the whole book ----------------------------------------------------- */

/**
 * Dividends across every business.
 *
 * The first thing worth knowing about a book that pays monthly is whether what was
 * declared has actually been received. That is three figures, and the gap between
 * the first two is the answer.
 */
moneyRoutes.get("/dividends/overview", (_req, res) => {
  const rows = all<{ id: number; name: string }>(
    "SELECT id, name FROM businesses WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
  );

  let declared = 0;
  let paid = 0;
  const perBusiness = rows.map((b) => {
    const r = dividendsReceivable(b.id);
    declared = Math.round((declared + r.declared) * 100) / 100;
    paid = Math.round((paid + r.paid) * 100) / 100;
    return {
      businessId: b.id,
      businessName: b.name,
      declared: r.declared,
      received: r.paid,
      outstanding: r.outstanding,
      coverage: coverageFor(b.id),
    };
  });

  const alerts = missingDividends();
  const marks = staleMarks();

  res.json({
    declared,
    received: paid,
    outstanding: Math.round((declared - paid) * 100) / 100,
    businesses: perBusiness.filter((b) => b.declared > 0 || b.coverage),
    payingCount: perBusiness.filter((b) => b.declared > 0).length,
    behindCount: alerts.length,
    staleMarkCount: marks.length,
  });
});

/* -- ownership events --------------------------------------------------- */

moneyRoutes.get("/investments", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({ items: listRounds(businessId) });
});

moneyRoutes.post("/investments", handle(async (req, res) => {
  const result = await recordInvestment(domainInput(req.body));
  res.status(201).json({ ...result, rounds: listRounds(result.businessId) });
}));

moneyRoutes.get("/transfers", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({ items: listTransfers(businessId) });
});

/**
 * Full and part sales share one endpoint; the presence of a share decides which.
 * One place to add a rule that applies to every way a stake leaves.
 */
moneyRoutes.post("/exits", handle(async (req, res) => {
  const body = domainInput<{ percentage?: unknown; equity?: unknown }>(req.body);
  const hasShare =
    (body.percentage !== undefined && body.percentage !== null && body.percentage !== "") ||
    (body.equity !== undefined && body.equity !== null && body.equity !== "");
  const result = hasShare ? await sellParticipation(domainInput(req.body)) : await closePosition(domainInput(req.body));
  res.status(201).json(result);
}));

moneyRoutes.post("/exits/reopen", handle(async (req, res) => {
  res.json(await reopenPosition(domainInput(req.body)));
}));

moneyRoutes.get("/businesses/:id/cap-table", (req, res) => {
  const id = Number(req.params.id);
  const rows = holdingRows(id);
  const open = rows.filter((r) => r.exitedOn === null);
  const total = open.reduce((sum, r) => sum + toUnits(r.equity), 0);
  res.json({
    rows,
    openTotal: total / 100,
    isWhole: total === ALLOCATION_UNITS,
    // Branch cap tables are independent: a branch can total 100% through entirely
    // different people from its parent, and this book lets that happen.
    branches: all(
      `SELECT b.id, b.name, b.code, b.is_active,
              (SELECT COALESCE(SUM(equity),0) FROM branch_stakeholders x
                WHERE x.branch_id = b.id AND x.exited_on IS NULL) AS equity_total
         FROM branches b WHERE b.business_id = ? ORDER BY b.name`,
      [id],
    ),
    transfers: listTransfers(id),
    rounds: listRounds(id),
  });
});

/* -------------------------------------------------------------------------- */
/* Errors                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The portfolio owner, worked out rather than hard-coded.
 *
 * Named in settings; falling back to the largest holder is a guess, and a guess in a
 * figure that ends up on the front page is worse than an honest empty state.
 */
function defaultStakeholderId(): number {
  const named = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    "principal_stakeholder_id",
  ]);
  if (named?.value) {
    const id = Number(named.value);
    if (Number.isFinite(id) && id > 0 && one("SELECT 1 FROM stakeholders WHERE id = ?", [id])) return id;
  }
  return 0;
}

/* -- position value ----------------------------------------------------- */

moneyRoutes.get("/businesses/:id/value", (req, res) => {
  const id = Number(req.params.id);
  const equity = Number(req.query.equity ?? 100);
  res.json(positionValue(id, equity));
});
/* -- returns ------------------------------------------------------------ */

/**
 * The book-level track record.
 *
 * Defaults to the portfolio owner. This is the one screen a reader comes to first, so
 * it answers the only two questions that matter: what has come back, and what is the
 * capital still doing.
 */
moneyRoutes.get("/returns", (req, res) => {
  const id = Number(req.query.stakeholder_id ?? 0);
  const stakeholderId = id > 0 ? id : defaultStakeholderId();
  if (!stakeholderId) {
    res.status(200).json({
      stakeholderId: null,
      note: "No stakeholder is recorded yet, so there is no track record to report.",
      realised: [],
      open: [],
      totals: null,
    });
    return;
  }
  res.json({ stakeholderId, ...trackRecord(stakeholderId) });
});

/** A single position, for the detail view. */
moneyRoutes.get("/returns/:stakeholderId/:businessId", (req, res) => {
  const stakeholderId = Number(req.params.stakeholderId);
  const businessId = Number(req.params.businessId);
  const open = trackRecord(stakeholderId).open.find((p) => p.businessId === businessId);
  const realised = trackRecord(stakeholderId).realised.find((p) => p.businessId === businessId);
  const account = capitalAccount(stakeholderId, businessId);
  const residual = open !== undefined && open.basis === "mark" ? open.value : 0;
  res.json({
    businessId,
    stakeholderId,
    account,
    multiples: multiples(account, residual),
    open: open ?? null,
    realised: realised ?? null,
    flows: cashFlows(stakeholderId, businessId),
    // A mark is the only thing that can value an open position; saying so is better
    // than quoting a cost as though it were a valuation.
    atCost: open !== undefined && open.basis === "cost",
  });
});

/** The dated series behind the IRR, so a reader can see what produced it. */
moneyRoutes.get("/returns/:stakeholderId/flows", (req, res) => {
  const stakeholderId = Number(req.params.stakeholderId);
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  const flows = cashFlows(stakeholderId, businessId);
  res.json({ flows, irr: irr(flows) });
});

/* -- catalogue ------------------------------------------------------------ */

catalogueRoutes.get("/services", (_req, res) => {
  res.json({ services: listServices() });
});

catalogueRoutes.post("/services", handle(async (req, res) => {
  res.status(201).json({ serviceId: createService(domainInput(req.body) as never) });
}));

catalogueRoutes.get("/services/:id", (req, res) => {
  const id = Number(req.params.id);
  const summary = listServices().find((s) => s.id === id);
  if (!summary) {
    res.status(404).json({ error: "That service is not in the catalogue", field: "service_id" });
    return;
  }
  res.json({
    service: summary,
    variants: listVariants(id),
    attributes: serviceAttributes(id),
  });
});

catalogueRoutes.post("/services/:id/variants", handle(async (req, res) => {
  res.status(201).json({
    variantId: createVariant({ ...domainInput<Record<string, unknown>>(req.body), serviceId: Number(req.params.id) } as never),
  });
}));

catalogueRoutes.put("/variants/:id/price", handle(async (req, res) => {
  repriceVariant({ ...domainInput<Record<string, unknown>>(req.body), variantId: Number(req.params.id) } as never);
  res.json(variantById(Number(req.params.id)));
}));

catalogueRoutes.get("/variants/:id", (req, res) => {
  const v = variantById(Number(req.params.id));
  if (!v) {
    res.status(404).json({ error: "That tier does not exist", field: "variant_id" });
    return;
  }
  res.json(v);
});

catalogueRoutes.post("/attributes", handle(async (req, res) => {
  res.status(201).json({ attributeId: defineAttribute(domainInput(req.body) as never) });
}));

catalogueRoutes.post("/attributes/:id/assign", handle(async (req, res) => {
  assignAttributeToService(Number(req.params.id), Number(domainInput<{ serviceId?: unknown }>(req.body).serviceId));
  res.json({ ok: true });
}));

catalogueRoutes.put("/variants/:id/attributes", handle(async (req, res) => {
  const body = domainInput<{ attributeId?: unknown; value?: unknown }>(req.body);
  setVariantAttribute({
    variantId: Number(req.params.id),
    attributeId: Number(body.attributeId),
    value: body.value,
  });
  res.json(variantById(Number(req.params.id)));
}));

catalogueRoutes.get("/requests", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({ requests: listRequests(businessId) });
});

catalogueRoutes.put("/requests/:id/status", handle(async (req, res) => {
  res.json(changeRequestStatus({ ...domainInput<Record<string, unknown>>(req.body), requestId: Number(req.params.id) } as never));
}));

/* -- invoicing ------------------------------------------------------------ */

invoiceRoutes.get("/invoices", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({ invoices: listInvoices(businessId) });
});

invoiceRoutes.post("/invoices", handle(async (req, res) => {
  // The lines are translated one level deeper, explicitly. `domainInput` only rewrites
  // top-level keys on purpose — it must not rename *data* — and each line is a list of
  // field names of its own, so the route says so rather than the helper guessing how
  // deep to go. Guessing is how a product description called "unit_price" would end up
  // renamed to unitPrice and saved in the wrong column.
  const input = domainInput<{ lines?: Array<Record<string, unknown>> }>(req.body);
  const lines = (input.lines ?? []).map((line) => domainInput<Record<string, unknown>>(line));
  const id = await issueInvoice({ ...input, lines } as never);
  res.status(201).json(readInvoice(id));
}));

invoiceRoutes.get("/invoices/:id", (req, res) => {
  const inv = readInvoice(Number(req.params.id));
  if (!inv) {
    res.status(404).json({ error: "That invoice does not exist", field: "invoice_id" });
    return;
  }
  res.json(inv);
});

invoiceRoutes.post("/invoices/:id/payments", handle(async (req, res) => {
  res.json(await recordPayment({
      ...domainInput<Record<string, unknown>>(req.body),
      invoiceId: Number(req.params.id),
    } as Parameters<typeof recordPayment>[0]));
}));

invoiceRoutes.post("/invoices/:id/credit-notes", handle(async (req, res) => {
  res.json(await issueCreditNote({
      ...domainInput<Record<string, unknown>>(req.body),
      invoiceId: Number(req.params.id),
    } as Parameters<typeof issueCreditNote>[0]));
}));

invoiceRoutes.post("/invoices/:id/void", handle(async (req, res) => {
  res.json(await voidInvoice({
      ...domainInput<Record<string, unknown>>(req.body),
      invoiceId: Number(req.params.id),
    } as Parameters<typeof voidInvoice>[0]));
}));

/**
 * What every client owes.
 *
 * A separate ledger to the dividends above, and deliberately not merged with them:
 * money owed to Zainpreneur is not money received from it, and the original's
 * settable `revenue` column is exactly the merge that made that unreadable.
 */
invoiceRoutes.get("/receivables", (req, res) => {
  // Per currency, plus one book-currency total *if* every rate exists. There is no
  // unconditional grand total, because adding currencies together produces a number
  // that is wrong without ever raising anything.
  const on = req.query.on ? String(req.query.on) : undefined;
  res.json({ rows: receivables(), ...receivableTotals(on) });
});

/* -- intercompany --------------------------------------------------------- */

intercompanyRoutes.get("/intercompany-charges", (req, res) => {
  const businessId = req.query.business_id ? Number(req.query.business_id) : undefined;
  res.json({
    charges: listCharges({ businessId }),
    group: groupBusinesses(),
  });
});

intercompanyRoutes.post("/intercompany-charges", handle(async (req, res) => {
  const id = await recordCharge(domainInput(req.body) as never);
  res.status(201).json(chargeById(id));
}));

intercompanyRoutes.post("/intercompany-charges/:id/confirm", handle(async (req, res) => {
  res.json(confirmCharge(Number(req.params.id), domainInput<{ on?: unknown }>(req.body).on));
}));

intercompanyRoutes.post("/intercompany-charges/:id/settle", handle(async (req, res) => {
  res.json(settleCharge(Number(req.params.id), domainInput<{ on?: unknown }>(req.body).on));
}));

/**
 * The group, consolidated.
 *
 * `eliminatedWithinGroup` should be zero, and `reconciles` says so explicitly. A
 * non-zero figure there means a charge was recorded with only one leg, which is the
 * single failure mode this endpoint exists to make visible.
 */
intercompanyRoutes.get("/consolidation", (_req, res) => {
  const c = consolidation();
  const check = consolidationReconciles(c);
  res.json({
    ...c,
    reconciles: check.ok,
    problems: check.problems,
  });
});

/* -- currencies ------------------------------------------------------------ */

fxRoutes.get("/currencies", (_req, res) => {
  res.json(currencyPosition());
});

fxRoutes.get("/fx-rates", (req, res) => {
  const from = req.query.from ? String(req.query.from).toUpperCase() : "";
  const to = req.query.to ? String(req.query.to).toUpperCase() : "";
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (from) {
    clauses.push("from_code = ?");
    params.push(from);
  }
  if (to) {
    clauses.push("to_code = ?");
    params.push(to);
  }
  const rows = all<Record<string, unknown>>(
    `SELECT from_code, to_code, rate, quoted_on, source FROM fx_rates
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY quoted_on DESC, from_code, to_code`,
    params,
  ).map((r) => ({
    from: String(r.from_code),
    to: String(r.to_code),
    rate: Number(r.rate),
    quotedOn: String(r.quoted_on),
    source: String(r.source ?? ""),
  }));
  res.json({ rates: rows });
});

fxRoutes.post("/fx-rates", handle(async (req, res) => {
  res.status(201).json({ id: recordRate(domainInput<Parameters<typeof recordRate>[0]>(req.body)) });
}));

fxRoutes.put("/book-currency", handle(async (req, res) => {
  res.json({ bookCurrency: setBookCurrency(domainInput<{ bookCurrency?: unknown }>(req.body).bookCurrency) });
}));

/**
 * Convert one amount, and say which rate did it.
 *
 * Returns the quote alongside the figure on purpose: a converted number without its
 * rate is a number nobody can defend when somebody asks how it was arrived at.
 */
fxRoutes.get("/convert", (req, res) => {
  const amount = Number(req.query.amount ?? 0);
  const { amount: converted, quote } = convertExplained(
    amount,
    req.query.from,
    req.query.to,
    req.query.on,
  );
  res.json({ amount: converted, quote });
});

/**
 * The audit, as an endpoint.
 *
 * `inherited` is reported rather than hidden: those columns take their currency from a
 * related row, which is a weaker guarantee than owning one, and the count is how many
 * places would need revisiting if the book gained a third currency.
 */
fxRoutes.get("/currency-audit", (_req, res) => {
  res.json(currencyAudit());
});
