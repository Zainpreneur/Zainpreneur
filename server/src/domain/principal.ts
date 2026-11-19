import { one } from "../db/client.js";

/**
 * Who the book belongs to.
 *
 * Worked out from `settings` rather than hard-coded, and never guessed: a fallback to
 * "the largest holder" would put a figure belonging to somebody else on the front page
 * the first time the real principal was not the largest. An unresolvable principal
 * returns 0, and callers say so rather than substituting anyone.
 */
export function principalStakeholderId(): number {
  const named = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [
    "principal_stakeholder_id",
  ]);
  if (named?.value) {
    const id = Number(named.value);
    if (Number.isFinite(id) && id > 0 && one("SELECT 1 FROM stakeholders WHERE id = ?", [id])) return id;
  }
  const fallback = one<{ id: number }>(
    "SELECT id FROM stakeholders WHERE kind = 'company' AND name LIKE '%Zainpreneur%' LIMIT 1",
  );
  return fallback ? Number(fallback.id) : 0;
}

/** What Zainpreneur holds of a business, right now. */
export function principalEquity(businessId: number): number {
  const principal = principalStakeholderId();
  if (!principal) return 0;
  const row = one<{ equity: number }>(
    `SELECT COALESCE(equity, 0) AS equity FROM business_stakeholders
      WHERE business_id = ? AND stakeholder_id = ? AND exited_on IS NULL`,
    [businessId, principal],
  );
  return Number(row?.equity ?? 0);
}
