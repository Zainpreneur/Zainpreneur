import type { Request, Response, NextFunction } from "express";
import { FieldError } from "./validate.js";

/**
 * Route plumbing.
 *
 * `handle()` exists for one reason: **Express 4 does not catch a rejected promise.**
 * A bare `async (req, res) => {}` route that throws takes the whole process down —
 * a user typing a bad date into a sale form would stop the server. Every async
 * handler is wrapped, so a validation failure becomes a 400 with a field and the
 * process keeps serving.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly field: string | null;
  constructor(message: string, status = 400, field: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = field;
  }
}

export const handle =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const out = await fn(req, res);
      if (out !== undefined && !res.headersSent) res.json(out);
    } catch (err) {
      next(err);
    }
  };

/** Turn any thrown value into the one error shape the client understands. */
export function errorResponse(err: unknown): { status: number; body: Record<string, unknown> } {
  const status = err instanceof ApiError ? err.status : err instanceof FieldError ? 400 : 500;
  const field = err instanceof ApiError ? err.field : err instanceof FieldError ? err.field : null;
  if (status >= 500) console.error(err);
  return {
    status,
    body: {
      error: err instanceof Error ? err.message : "Something went wrong",
      ...(field ? { field } : {}),
    },
  };
}
/**
 * Translate a request body from the wire's shape to the domain's.
 *
 * The API speaks `snake_case` in its JSON — every response, every query parameter —
 * and the domain functions take `camelCase`. Something has to do that translation,
 * and doing it per route meant 24 call sites that quietly did not: `POST
 * /api/distributions` sent `business_id` to a function reading `businessId`, so every
 * write endpoint in the API failed with "That business is not in the register" while
 * the GETs beside them worked perfectly.
 *
 * Only the **top level** is converted. These bodies are flat — a list of field names —
 * and rewriting keys inside nested objects would rename data as well as fields, which
 * is a far worse failure than the one being fixed here.
 */
export function domainInput<T>(body: unknown): T {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {} as T;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  // `T` is inferred from the domain function this is passed to, so the shape is still
  // checked against that function's parameter. The *values* are deliberately `unknown`
  // all the way down — every field is validated by the domain, which is what gives its
  // refusals their field names.
  return out as T;
}
