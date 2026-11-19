import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The catalogue.
 *
 * The properties worth pinning are the ones about *shape*: a price lives on a tier and
 * nowhere else, a missing rate means something different depending on the pricing
 * model, one attribute definition serves many services, and a request can only be in a
 * state the lifecycle actually allows.
 */
const DB = resolve(process.cwd(), "db/test-catalogue.db");
process.env.ZP_DB = DB;

let client: typeof import("../src/db/client.js");
let C: typeof import("../src/domain/catalogue.js");

before(async () => {
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
  client = await import("../src/db/client.js");
  const { migrate } = await import("../src/db/migrations.js");
  C = await import("../src/domain/catalogue.js");
  migrate();
});

after(() => {
  client.closeDb();
  for (const s of ["", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });
});

const service = (name: string) => C.createService({ name });
const variant = (serviceId: number, name: string, extra: Record<string, unknown> = {}) =>
  C.createVariant({ serviceId, name, ...extra });

/* -------------------------------------------------------------------------- */
/* Pricing models                                                               */
/* -------------------------------------------------------------------------- */

test("every priced model needs a rate", () => {
  const s = service("Needing Rates");
  for (const model of ["fixed", "hourly", "monthly", "retainer", "per_unit"]) {
    assert.throws(
      () => variant(s, `Tier ${model}`, { pricingModel: model }),
      new RegExp("needs a rate"),
      `${model} was accepted with no rate`,
    );
  }
});

test("quote_required is the one model allowed to have no rate", () => {
  const s = service("Quoting");
  const id = variant(s, "Custom build", { pricingModel: "quote_required" });
  const v = C.variantById(id);
  assert.equal(v?.rate, null);
  assert.equal(v?.pricingModel, "quote_required");
  assert.equal(v?.orderable, false, "and it says it cannot simply be invoiced as it stands");
});

test("quote_required is the one model that must not have a rate", () => {
  const s = service("Quoting Strictly");
  assert.throws(
    () => variant(s, "Custom build", { pricingModel: "quote_required", rate: 500_000 }),
    /priced after scoping/,
    "a quote-required tier accepted a rate, which is the mirror-image of the same mistake",
  );
});

test("a price is either the whole fee or a rate something is multiplied by", () => {
  const s = service("Units");
  assert.equal(C.variantById(variant(s, "Fixed", { pricingModel: "fixed", rate: 300_000 }))?.pricingUnit, "total");
  assert.equal(C.variantById(variant(s, "Hourly", { pricingModel: "hourly", rate: 5_000 }))?.pricingUnit, "rate");
  assert.equal(
    C.variantById(variant(s, "Monthly", { pricingModel: "monthly", rate: 250_000 }))?.pricingUnit,
    "total",
  );
});

test("an unknown pricing model is refused by name", () => {
  const s = service("Odd");
  assert.throws(() => variant(s, "Tier", { pricingModel: "guesswork", rate: 100 }), /Pick how this is priced/);
});

test("re-pricing a quote-required tier is how a job becomes orderable", () => {
  const s = service("Scoped Later");
  const id = variant(s, "Custom", { pricingModel: "quote_required" });
  assert.equal(C.variantById(id)?.orderable, false);

  C.repriceVariant({ variantId: id, rate: 1_800_000, pricingModel: "fixed" });
  const after = C.variantById(id);
  assert.equal(after?.rate, 1_800_000);
  assert.equal(after?.orderable, true);
});

test("a tier cannot be switched to a priced model while its rate is blank", () => {
  const s = service("Bad Switch");
  const id = variant(s, "Custom", { pricingModel: "quote_required" });
  assert.throws(() => C.repriceVariant({ variantId: id, pricingModel: "fixed" }), /needs a rate/);
});

test("a negative rate is refused", () => {
  const s = service("Negatives");
  assert.throws(() => variant(s, "Tier", { pricingModel: "fixed", rate: -100 }), /cannot be negative/);
});

/* -------------------------------------------------------------------------- */
/* Services                                                                     */
/* -------------------------------------------------------------------------- */

test("service names are unique among the living ones", () => {
  service("Unique Co");
  assert.throws(() => service("unique co"), /already a service called/);
});

test("a service reports how many tiers it cannot price without a quote", () => {
  const s = service("Mixed Catalogue");
  variant(s, "Basic", { pricingModel: "fixed", rate: 100_000 });
  variant(s, "Custom", { pricingModel: "quote_required" });
  const row = C.listServices().find((x) => x.name === "Mixed Catalogue");
  assert.equal(row?.variantCount, 2);
  assert.equal(row?.needsQuoteCount, 1, "so a reader knows one tier is not orderable as it stands");
});

/* -------------------------------------------------------------------------- */
/* Attributes                                                                   */
/* -------------------------------------------------------------------------- */

test("one attribute definition is asked of many services", () => {
  const a = service("Consulting");
  const b = service("Website Build");
  const docs = C.defineAttribute({ name: "Documents required", kind: "number", originServiceId: a });

  C.assignAttributeToService(docs, b);

  assert.equal(C.serviceAttributes(a).some((x) => x.id === docs), true);
  assert.equal(C.serviceAttributes(b).some((x) => x.id === docs), true);
  // And of neither of the services it means nothing for.
  assert.equal(
    C.serviceAttributes(service("Unrelated")).some((x) => x.id === docs),
    false,
  );
  // Defined once: one row, two services — not a copy per service.
  assert.equal(client.num("SELECT COUNT(*) FROM service_attributes WHERE id = ?", [docs]), 1);
  assert.equal(client.num("SELECT COUNT(*) FROM service_attribute_assignments WHERE attribute_id = ?", [docs]), 2);
});

test("a select attribute's options are rows, not a comma-separated string", () => {
  const s = service("Hosting");
  const region = C.defineAttribute({
    name: "Region",
    kind: "select",
    originServiceId: s,
    choices: ["Nairobi", "Mombasa", "Kisumu"],
  });
  const def = C.serviceAttributes(s).find((x) => x.id === region);
  assert.deepEqual(def?.choices, ["Nairobi", "Mombasa", "Kisumu"]);
  assert.equal(client.num("SELECT COUNT(*) FROM attribute_values WHERE attribute_id = ?", [region]), 3);
});

test("a choice attribute needs options, and an option must be one of the choices", () => {
  const s = service("Regions");
  assert.throws(() => C.defineAttribute({ name: "Region", kind: "select", originServiceId: s }), /at least one option/);

  const region = C.defineAttribute({ name: "Area", kind: "select", originServiceId: s, choices: ["Nairobi"] });
  const tier = variant(s, "Tier", { pricingModel: "fixed", rate: 1000 });

  assert.throws(
    () => C.setVariantAttribute({ variantId: tier, attributeId: region, value: "Timbuktu" }),
    /Pick one of/,
    "an answer that is not one of the options was accepted",
  );
  C.setVariantAttribute({ variantId: tier, attributeId: region, value: "Nairobi" });
  assert.equal(C.variantById(tier)?.attributes[0]?.value, "Nairobi");
});

test("a required attribute cannot be left blank", () => {
  const s = service("Strict");
  const docs = C.defineAttribute({ name: "Documents", kind: "number", required: true, originServiceId: s });
  const tier = variant(s, "Tier", { pricingModel: "fixed", rate: 1000 });
  assert.throws(() => C.setVariantAttribute({ variantId: tier, attributeId: docs, value: "" }), /is required/);
});

test("re-answering an attribute overwrites rather than accumulating", () => {
  const s = service("Repeats");
  const docs = C.defineAttribute({ name: "Documents", kind: "number", originServiceId: s });
  const tier = variant(s, "Tier", { pricingModel: "fixed", rate: 1000 });

  C.setVariantAttribute({ variantId: tier, attributeId: docs, value: "3" });
  C.setVariantAttribute({ variantId: tier, attributeId: docs, value: "6" });

  assert.equal(client.num("SELECT COUNT(*) FROM service_variant_attributes WHERE variant_id = ? AND attribute_id = ?", [tier, docs]), 1);
  assert.equal(C.variantById(tier)?.attributes[0]?.value, "6");
});

/* -------------------------------------------------------------------------- */
/* The request lifecycle                                                        */
/* -------------------------------------------------------------------------- */

let requestSeq = 0;
function newRequest(): number {
  // A distinct service per request: names are unique, and reusing one made every
  // lifecycle test fail on the *second* call rather than on what it was checking.
  const s = service(`Work ${++requestSeq}`);
  const b = Number(
    client
      .run(
        `INSERT INTO businesses (name, status, relationship_type, served, created_at, updated_at, rev)
         VALUES (?, 'active', 'client', 1, '', '', 1)`,
        [`Client Co ${++requestSeq}`],
      ).lastInsertRowid,
  );
  return Number(
    client
      .run(
        `INSERT INTO service_requests (business_id, service_id, status, created_at, updated_at, rev)
         VALUES (?, ?, 'requested', '', '', 1)`,
        [b, s],
      ).lastInsertRowid,
  );
}

test("a request walks the lifecycle, and illegal jumps are refused", () => {
  const id = newRequest();
  assert.equal(C.changeRequestStatus({ requestId: id, status: "reviewing" }).to, "reviewing");
  assert.equal(C.changeRequestStatus({ requestId: id, status: "accepted" }).to, "accepted");
  assert.equal(C.changeRequestStatus({ requestId: id, status: "in_progress" }).to, "in_progress");
});

test("completed cannot be dragged back into progress", () => {
  // The original had every state in a Python comment and nothing enforcing the order,
  // so a finished job could be reopened with no objection from anywhere.
  const id = newRequest();
  C.changeRequestStatus({ requestId: id, status: "reviewing" });
  C.changeRequestStatus({ requestId: id, status: "accepted" });
  C.changeRequestStatus({ requestId: id, status: "in_progress" });
  C.changeRequestStatus({ requestId: id, status: "delivered" });
  C.changeRequestStatus({ requestId: id, status: "completed" });

  assert.throws(
    () => C.changeRequestStatus({ requestId: id, status: "in_progress" }),
    /can only go to nowhere — it is finished/,
  );
});

test("on_hold is somewhere you can come back from", () => {
  const id = newRequest();
  C.changeRequestStatus({ requestId: id, status: "reviewing" });
  C.changeRequestStatus({ requestId: id, status: "accepted" });
  C.changeRequestStatus({ requestId: id, status: "on_hold" });
  assert.equal(C.changeRequestStatus({ requestId: id, status: "in_progress" }).to, "in_progress");
});

test("a rejected request may be raised again, because that is what rejecting means", () => {
  const id = newRequest();
  C.changeRequestStatus({ requestId: id, status: "rejected" });
  assert.equal(C.changeRequestStatus({ requestId: id, status: "requested" }).to, "requested");
});

test("a state that is not part of the lifecycle is refused", () => {
  const id = newRequest();
  assert.throws(() => C.changeRequestStatus({ requestId: id, status: "thinking_about_it" }), /not a state/);
});

test("finishing a request dates it, because 'when did it end' is a fact", () => {
  const id = newRequest();
  C.changeRequestStatus({ requestId: id, status: "reviewing" });
  C.changeRequestStatus({ requestId: id, status: "accepted" });
  C.changeRequestStatus({ requestId: id, status: "in_progress" });
  C.changeRequestStatus({ requestId: id, status: "delivered" });
  // `scalar`, not `num`: num() coerces a NULL to 0, which would make this pass
  // for the wrong reason.
  assert.equal(client.scalar("SELECT completed_on FROM service_requests WHERE id = ?", [id]), null);
  C.changeRequestStatus({ requestId: id, status: "completed" });
  assert.ok(client.scalar("SELECT completed_on FROM service_requests WHERE id = ?", [id]), "completed was not dated");
});

test("progress is recorded, not just the current state", () => {
  const id = newRequest();
  C.changeRequestStatus({ requestId: id, status: "reviewing", note: "checking capacity" });
  C.changeRequestStatus({ requestId: id, status: "accepted", note: "go ahead" });
  const events = client.all("SELECT status, note FROM service_request_events WHERE request_id = ?", [id]);
  assert.equal(events.length, 2, "only the current status survives, so the history is gone");
});

/* -------------------------------------------------------------------------- */
/* Audit                                                                        */
/* -------------------------------------------------------------------------- */

test("no rate is stored on a request", () => {
  // The rate lives on the tier, so changing a price re-prices work still to be done.
  // The one deliberate exception is an issued invoice line, which must keep saying what
  // it said; that table is not in the list this check looks at.
  assert.deepEqual(C.ratesAreNotStoredOnRequests(), []);
});