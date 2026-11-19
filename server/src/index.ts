import express from "express";
import type { Request, Response, NextFunction } from "express";
import { migrate } from "./db/migrations.js";
import { closeDb, num, now, one, all } from "./db/client.js";
import {
  moneyRoutes,
  catalogueRoutes,
  invoiceRoutes,
  intercompanyRoutes,
  fxRoutes,
} from "./routes/money.js";
import { ApiError, errorResponse, handle } from "./lib/http.js";
import {
  BUSINESS_STATUSES,
  BUSINESS_STATUS_LABEL,
  RELATIONSHIP_TYPES,
  RELATIONSHIP_LABEL,
  RELATIONSHIP_DESCRIPTION,
  assertAllocation,
  summariseAllocation,
  allocationState,
  type RelationshipType,
} from "@zainpreneur/shared";

/**
 * The API.
 *
 * Two conventions worth stating, both inherited from decisions rather than habit:
 *
 *  - Errors carry a field. A validation failure returns `{ error, field }` so a form
 *    can put the message under the input that caused it. The original had no such
 *    channel: every failure became one flash string at the top of the page, and a
 *    failed save of the 16-field business form lost every value typed.
 *
 *  - `Origin` is checked on writes. Cross-origin writes are refused; a *missing*
 *    Origin is accepted. There is no session cookie, so there is no authority for a
 *    cross-site request to ride, and refusing a missing Origin would break every
 *    non-browser client for no gain.
 */

const PORT = Number(process.env.PORT ?? 5178);
const HOST = process.env.HOST ?? "127.0.0.1";

const app = express();
app.use(express.json({ limit: "4mb" }));

/* -------------------------------------------------------------------------- */
/* Cross-cutting                                                                */
/* -------------------------------------------------------------------------- */

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");

  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.get("origin");
    if (origin) {
      const host = req.get("host");
      const allowed = [`http://${host}`, `https://${host}`];
      if (!allowed.includes(origin)) {
        return res.status(403).json({ error: "That request came from another site." });
      }
    }
  }
  next();
});

/* -------------------------------------------------------------------------- */
/* Health and vocabulary                                                        */
/* -------------------------------------------------------------------------- */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, at: now(), businesses: num("SELECT COUNT(*) FROM businesses") });
});

/**
 * The closed sets, served to the client.
 *
 * The client could import these from `@zainpreneur/shared` directly, and does.
 * This endpoint exists so a form can be validated against the *server's* answer
 * in tests, which is how client/server disagreement gets caught rather than
 * discovered.
 */
app.get("/api/vocabulary", (_req, res) => {
  res.json({
    relationshipTypes: RELATIONSHIP_TYPES.map((type) => ({
      value: type,
      label: RELATIONSHIP_LABEL[type],
      description: RELATIONSHIP_DESCRIPTION[type],
    })),
    businessStatuses: BUSINESS_STATUSES.map((value) => ({
      value,
      label: BUSINESS_STATUS_LABEL[value],
    })),
    allocation: { units: 10_000, tolerance: 0, unit: "hundredths of a percent" },
  });
});

/* -------------------------------------------------------------------------- */
/* Businesses                                                                   */
/* -------------------------------------------------------------------------- */

function principalId(): number | null {
  const row = one<{ value: string }>(
    "SELECT value FROM settings WHERE key='principal_stakeholder_id'",
  );
  if (!row?.value) return null;
  const n = Number(row.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The 100% rule, re-asserted from the database rather than trusted from the payload. */
function assertBusinessRule(businessId: number, type: RelationshipType, name: string): void {
  const rows = all<{ stakeholder_id: number; equity: number }>(
    `SELECT x.stakeholder_id, x.equity
       FROM business_stakeholders x
       JOIN stakeholders s ON s.id = x.stakeholder_id
      WHERE x.business_id = ? AND x.exited_on IS NULL`,
    [businessId],
  );
  assertAllocation(
    rows.map((r) => ({ stakeholderId: r.stakeholder_id, percent: r.equity })),
    type,
    name,
  );
}

/**
 * Where a business sits in Zainpreneur's book.
 *
 * Derived from the cap table, never stored: a stored flag could contradict the
 * percentages. `served` is a separate recorded fact — it is true whether or not a
 * request exists this month, which is exactly why it is not derived from requests.
 */
function portfolioTypeOf(businessId: number): {
  type: "fully_owned" | "equity" | "client" | "none";
  principalEquity: number;
  served: boolean;
  badge: string;
} {
  const pid = principalId();
  const mine = pid
    ? num(
        `SELECT COALESCE(SUM(equity), 0) FROM business_stakeholders
          WHERE business_id = ? AND stakeholder_id = ? AND exited_on IS NULL`,
        [businessId, pid],
      )
    : 0;
  const served = num("SELECT served FROM businesses WHERE id = ?", [businessId]) > 0;

  const type =
    mine >= 100 ? "fully_owned" : mine > 0 ? "equity" : served ? "client" : "none";

  let badge: string;
  if (type === "equity" && served) badge = "Client + Equity";
  else badge = RELATIONSHIP_LABEL[type as RelationshipType] ?? "No relationship";

  return { type, principalEquity: mine, served, badge };
}

app.get(
  "/api/businesses",
  handle((req) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const rows = all<Record<string, unknown>>(
      `SELECT id, name, legal_name, status, industry, city, country, served,
              relationship_type, created_at
         FROM businesses
        WHERE deleted_at IS NULL
        ORDER BY name COLLATE NOCASE
        LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    const total = num("SELECT COUNT(*) FROM businesses WHERE deleted_at IS NULL");

    return {
      total,
      limit,
      offset,
      items: rows.map((r) => ({ ...r, portfolio: portfolioTypeOf(Number(r.id)) })),
    };
  }),
);

app.get(
  "/api/businesses/:id",
  handle((req) => {
    const id = Number(req.params.id);
    const business = one<Record<string, unknown>>(
      "SELECT * FROM businesses WHERE id = ? AND deleted_at IS NULL",
      [id],
    );
    if (!business) throw new ApiError("Business not found", 404);

    const rows = all<Record<string, unknown>>(
      `SELECT x.stakeholder_id, s.name, s.kind, x.relationship, x.equity,
              x.amount, x.invested_on, x.exited_on, x.transferred_to, x.proceeds
         FROM business_stakeholders x
         JOIN stakeholders s ON s.id = x.stakeholder_id
        WHERE x.business_id = ?
        ORDER BY x.exited_on IS NOT NULL, x.equity DESC, s.name COLLATE NOCASE`,
      [id],
    );

    const open = rows.filter((r) => !r.exited_on);
    const allocation = summariseAllocation(
      open.map((r) => ({ stakeholderId: Number(r.stakeholder_id), percent: r.equity as number })),
    );

    return {
      business,
      portfolio: portfolioTypeOf(id),
      relationships: rows,
      allocation: {
        state: allocationState(
          open.map((r) => ({ stakeholderId: Number(r.stakeholder_id), percent: r.equity as number })),
        ),
        totalPercent: allocation.totalUnits / 100,
        isExact: allocation.isExact,
        deltaPercent: allocation.deltaUnits / 100,
      },
      branches: all(
        "SELECT id, name, code, city, country, is_active FROM branches WHERE business_id = ? ORDER BY name",
        [id],
      ),
    };
  }),
);

/* -------------------------------------------------------------------------- */
/* Money and events                                                             */
/* -------------------------------------------------------------------------- */

app.use("/api", moneyRoutes);
app.use("/api", catalogueRoutes);
app.use("/api", invoiceRoutes);
app.use("/api", intercompanyRoutes);
app.use("/api", fxRoutes);

/* -------------------------------------------------------------------------- */
/* Errors                                                                       */
/* -------------------------------------------------------------------------- */

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const { status, body } = errorResponse(err);
  res.status(status).json(body);
});

/* -------------------------------------------------------------------------- */
/* Boot                                                                         */
/* -------------------------------------------------------------------------- */

const result = migrate();
console.log(
  `zainpreneur api · schema v${result.version} · ${result.created} table(s) created · ${now()}`,
);

const server = app.listen(PORT, HOST, () => {
  console.log(`listening on http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}

export { app, portfolioTypeOf, assertBusinessRule };