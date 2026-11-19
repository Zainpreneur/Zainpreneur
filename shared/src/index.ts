/**
 * Rules shared by the API and the client.
 *
 * The point of this package is that there is exactly one answer to every question
 * both sides need to agree on — the 100% rule, the relationship vocabulary, the
 * status vocabularies, the display labels. In the original these lived in
 * `db.py` and `services.py` with no shared source, and the 100% rule ended up
 * stated three different ways across three files.
 */
export * from "./rules/allocation.js";
export * from "./rules/entitlement.js";
export * from "./rules/period.js";
export * from "./rules/vocabulary.js";