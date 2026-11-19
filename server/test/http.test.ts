import { test } from "node:test";
import assert from "node:assert/strict";
import { handle, errorResponse, ApiError, domainInput } from "../src/lib/http.js";
import { FieldError } from "../src/lib/validate.js";

/**
 * Route plumbing.
 *
 * These exist because of a real outage: every async route was written as a bare
 * `async (req, res) => {}`, and **Express 4 does not catch a rejected promise.** A
 * user typing a bad date into a sale form threw a `FieldError`, nothing handled it,
 * and the whole server died — taking every other request with it.
 *
 * The assertion is that `handle` turns a rejection into a *response*, not a crash.
 */

/** A response object that records what was sent, so nothing has to be a real socket. */
function fakeRes() {
  // Express sends 200 when a handler writes without setting a status, so the
  // double starts there rather than at zero.
  const sent: { status: number; body: unknown } = { status: 200, body: undefined };
  return {
    res: {
      status(code: number) {
        sent.status = code;
        return this;
      },
      json(body: unknown) {
        sent.body = body;
        return this;
      },
      headersSent: false,
    } as never,
    sent,
  };
}

test("a throwing route becomes a 400, not a dead process", async () => {
  const { res, sent } = fakeRes();
  let forwarded: unknown = null;

  const route = handle(async () => {
    throw new FieldError("exited_on", "An exit needs a date as YYYY-MM-DD");
  });

  await route({} as never, res, ((e: unknown) => {
    forwarded = e;
  }) as never);

  assert.ok(forwarded, "the error was swallowed instead of forwarded");
  assert.ok(forwarded instanceof FieldError);
});

test("a validation failure carries its field so a form can point at the input", () => {
  const { status, body } = errorResponse(new FieldError("to_stakeholder_id", "name who bought it"));
  assert.equal(status, 400);
  assert.deepEqual(body, {
    error: "name who bought it",
    field: "to_stakeholder_id",
  });
});

test("an unexpected failure is a 500, and it is logged rather than shown raw", () => {
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...a: unknown[]) => logged.push(a);
  try {
    const { status, body } = errorResponse(new Error("connection reset"));
    assert.equal(status, 500);
    assert.deepEqual(body, { error: "connection reset" });
    assert.equal(logged.length, 1, "a 500 was not logged");
  } finally {
    console.error = original;
  }
});

test("an ApiError carries its own status", () => {
  assert.equal(errorResponse(new ApiError("Business not found", 404)).status, 404);
});

test("a route that succeeds returns its value as JSON", async () => {
  const { res, sent } = fakeRes();
  const route = handle(async () => ({ ok: true }));
  await route({} as never, res, (() => {}) as never);
  assert.equal(sent.status, 200);
  assert.deepEqual(sent.body, { ok: true });
});

test("a route that sends its own response is not written to twice", async () => {
  const { res, sent } = fakeRes();
  const route = handle(async (_req, r) => {
    r.status(201).json({ created: true });
  });
  await route({} as never, res, (() => {}) as never);
  assert.equal(sent.status, 201, "a second write overwrote the first");
  assert.deepEqual(sent.body, { created: true });
});

test("no route in the money module is left unwrapped", async () => {
  // The crash happened because wrapping was opt-in. This reads the source and
  // fails if any async route handler is bare again.
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../src/routes/", import.meta.url).pathname;
  const offenders: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(dir + file, "utf8");
    // Every `async (req, res)` handler must be inside a `handle(`.
    for (const m of source.matchAll(/\.(post|delete|put)\(\s*"[^"]+",\s*async/g)) {
      offenders.push(`${file}: ${m[0].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], "an async route is not wrapped in handle()");
});
/* -------------------------------------------------------------------------- */
/* The wire shape                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Translation between the wire and the domain.
 *
 * This exists because of a bug that every GET hid: the API speaks `snake_case` and the
 * domain takes `camelCase`, and nothing was translating between them. `POST
 * /api/distributions` sent `business_id` to a function reading `businessId`, so every
 * write endpoint failed with "That business is not in the register" while the reads
 * beside them worked perfectly. The domain tests passed throughout — they call the
 * domain directly, in its own language, and were never wrong.
 *
 * So the boundary is tested at the boundary.
 */
/** `domainInput` takes the parsed body itself, not the request around it. */

test("a snake_case body reaches the domain as camelCase", () => {
  assert.deepEqual(domainInput({ business_id: 7, issued_on: "2026-03-31" }), {
    businessId: 7,
    issuedOn: "2026-03-31",
  });
});

test("only the top level is translated", () => {
  // These bodies are flat field lists. Rewriting keys inside a nested object would
  // rename *data* as well as fields, which is worse than the bug being fixed.
  const input = domainInput<{ businessId?: unknown; lines: Array<{ unit_price: number }> }>({
    business_id: 1,
    lines: [{ unit_price: 500 }],
  });
  assert.equal(input.businessId, 1);
  assert.deepEqual(input.lines, [{ unit_price: 500 }], "a data key was renamed");
});

test("a list of field-name records is translated one level deeper, by the caller", () => {
  // Invoice lines are field lists of their own. The helper deliberately does not guess
  // how deep to go, so the route maps them — and a *data* key inside a line keeps its
  // name, which is the whole reason the helper stays shallow.
  const raw = {
    number: "INV-1",
    business_id: 4,
    lines: [{ description: "unit_price advice", unit_price: 450_000, tax_rate: 16 }],
  };
  const input = domainInput<{ businessId?: unknown; lines?: Array<Record<string, unknown>> }>(raw);
  const lines = (input.lines ?? []).map((l) => domainInput<Record<string, unknown>>(l));

  assert.equal(input.businessId, 4);
  assert.equal(lines[0]?.unitPrice, 450_000, "the line's own field names were not translated");
  assert.equal(lines[0]?.taxRate, 16);
  assert.equal(
    lines[0]?.description,
    "unit_price advice",
    "text that happens to contain a field name was rewritten",
  );
});

test("keys that are already camelCase are left alone", () => {
  assert.deepEqual(domainInput({ businessId: 3, quoted_rate: 500 }), {
    businessId: 3,
    quotedRate: 500,
  });
});

test("a missing or non-object body is an empty input, not a crash", () => {
  assert.deepEqual(domainInput(undefined), {});
  assert.deepEqual(domainInput(null), {});
  assert.deepEqual(domainInput("nonsense"), {});
  assert.deepEqual(domainInput([1, 2, 3]), {});
});

test("an id in the URL is not overridden by the same id in the body", () => {
  // The URL identifies the resource. A body carrying its own id must not be able to
  // aim the write somewhere else — the spread goes first and the path parameter last.
  const fromUrl = Number("/api/businesses/2/valuations".split("/")[3]);
  const merged = { ...domainInput<Record<string, unknown>>({ business_id: 99 }), businessId: fromUrl };
  assert.equal(merged.businessId, 2);
});
