import { createHash } from "node:crypto";
import type { JsonObject } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public current?: unknown,
  ) { super(message); }
}
export function invalid(fields: Record<string, string>): never {
  throw new ApiError(400, "VALIDATION", "Revisa los campos indicados.", fields);
}
export function exactKeys(body: JsonObject, allowed: readonly string[]) {
  const fields: Record<string, string> = Object.create(null);
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fields[key] = "Campo no permitido.";
  if (Object.keys(fields).length) invalid(fields);
}
export function object(value: unknown, field = "body"): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid({ [field]: "Se requiere un objeto." });
  return value as JsonObject;
}
export function string(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || !value.length || value.length > max) invalid({ [field]: "Valor requerido o no válido." });
  return value as string;
}
export function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) invalid({ version: "La versión debe ser un entero positivo." });
  return value as number;
}
export function key(value: unknown): string {
  const result = string(value, "clave", 128);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(result)) invalid({ clave: "La clave debe tener entre 16 y 128 caracteres seguros." });
  return result;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function hash(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
export function payloadHash(operacion: string, payload: unknown) {
  return hash(canonical({ operacion, payload }));
}
function configuredOrigins(): Set<string> {
  const origins = new Set<string>();
  const values = [process.env.APP_ORIGIN, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined];
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) origins.add(url.origin);
    } catch { /* Invalid trusted configuration does not grant access. */ }
  }
  return origins;
}
export function requireOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (!origin || !configuredOrigins().has(origin)) {
    throw new ApiError(403, "ORIGIN_FORBIDDEN", "No se pudo verificar el origen de la solicitud.");
  }
  return origin;
}
export async function readBody(request: Request): Promise<JsonObject> {
  if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
    invalid({ body: "Envía un objeto JSON." });
  }
  const reader = request.body?.getReader();
  if (!reader) invalid({ body: "Envía un objeto JSON." });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 16384) {
        await reader.cancel();
        throw new ApiError(413, "VALIDATION", "La solicitud supera el tamaño permitido.", { body: "Máximo 16 KiB." });
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { invalid({ body: "El JSON no es válido." }); }
  return object(parsed);
}
export function json(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Vary": "Origin, Cookie",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  const value = data as Record<string, unknown>;
  const { ok, ...payload } = value;
  return Response.json(ok === true ? { ok: true, data: payload } : data, { status, headers });
}
export function failure(error: unknown) {
  if (error instanceof ApiError) {
    const response = json({
      ok: false,
      error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
      ...(error.current === undefined ? {} : { current: error.current }),
    }, error.status);
    if (error.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
  // No SQL, raw requests, personal details or credentials enter logs or responses.
  return json({ ok: false, error: { code: "UNAVAILABLE", message: "No pudimos consultar la información. Intenta de nuevo." } }, 503);
}
