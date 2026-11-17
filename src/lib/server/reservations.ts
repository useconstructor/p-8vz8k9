import { randomBytes, randomUUID } from "node:crypto";
import type { InValue } from "@libsql/client";
import { db } from "@/lib/db";
import { ApiError, exactKeys, hash, invalid, key, object, payloadHash, string, version } from "./http";
import { buildRevision, checkCatalogRevision, checkFullRevision, DRAFT_KEYS, getCatalog } from "./catalog";
import { requireSession } from "./session";
import type { Cita, Estado, Executor, Historial, JsonObject, Revision, Session } from "./types";

// This closed whitelist is the only serializer for public appointment snapshots.
export const CITA_COLUMNS = [
  "id", "servicioId", "barberoId", "servicioNombre", "barberoNombre", "duracionMin", "precioCop",
  "nombre", "celular", "inicioUtc", "finUtc", "estado", "version", "catalogRevision",
  "servicioVersion", "barberoVersion", "ilustracionId", "presentacionVersion", "creadaEn", "actualizadaEn",
] as const;
export function citaFrom(row: Record<string, unknown>): Cita {
  const value: Record<string, unknown> = {};
  for (const field of CITA_COLUMNS) value[field] = row[field];
  return value as Cita;
}
// Both private read paths use the same closed appointment serializer. Neither
// history snapshots nor an owner read may expose stored credential/ownership fields.
export function historialFrom(row: Record<string, unknown>): Historial {
  return {
    id: String(row.id), fecha: String(row.fecha), actor: row.actor as Session["rol"],
    accion: String(row.accion), estadoPrevio: row.estadoPrevio as Estado | null,
    estadoNuevo: row.estadoNuevo as Estado,
    versionPrevia: row.versionPrevia === null ? null : Number(row.versionPrevia),
    versionNueva: Number(row.versionNueva),
    anterior: row.anterior === null ? null : citaFrom(JSON.parse(String(row.anterior))),
    actual: citaFrom(JSON.parse(String(row.actual))),
  };
}
export async function ownedCita(executor: Executor, session: Session, id: string, ownerAccess = false): Promise<Cita> {
  const result = await executor.execute({
    sql: `SELECT c.* FROM nr_citas c WHERE c.id=? AND
      (?=1 OR EXISTS(SELECT 1 FROM nr_session_grants g WHERE g.citaId=c.id AND g.sessionId=?))`,
    args: [id, ownerAccess && session.rol === "dueno" ? 1 : 0, session.id],
  });
  // Foreign and nonexistent IDs have precisely the same status and envelope.
  if (!result.rows.length) throw new ApiError(403, "FORBIDDEN", "No tienes acceso a esta cita.");
  return citaFrom(result.rows[0]);
}
export function currentVersion(current: Cita, expected: unknown) {
  if (version(expected) !== current.version) {
    throw new ApiError(409, "VERSION_CONFLICT", "La cita cambió. Revisa su estado actual antes de continuar.", undefined, current);
  }
}
export function visitorChangeAllowed(current: Cita) {
  if (current.estado !== "reservada" || new Date(current.inicioUtc).getTime() <= Date.now()) {
    throw new ApiError(409, "STATE_CONFLICT", "Solo puedes cambiar o cancelar una cita reservada que todavía no haya comenzado.", undefined, current);
  }
}
async function history(executor: Executor, session: Session, action: string, before: Cita | null, after: Cita) {
  await executor.execute({
    sql: `INSERT INTO nr_historial(id,citaId,fecha,actor,accion,estadoPrevio,estadoNuevo,versionPrevia,versionNueva,anterior,actual)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [randomUUID(), after.id, after.actualizadaEn, session.rol, action, before?.estado || null, after.estado,
      before?.version || null, after.version, before ? JSON.stringify(before) : null, JSON.stringify(after)],
  });
}
async function insertCita(executor: Executor, session: Session, revision: Revision, codeHash: string) {
  const now = new Date().toISOString();
  const cita = citaFrom({ ...revision, id: randomUUID(), estado: "reservada", version: 1, creadaEn: now, actualizadaEn: now });
  const columns = [...CITA_COLUMNS, "codeHash", "ownerSessionId"];
  await executor.execute({
    sql: `INSERT INTO nr_citas(${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    args: [...CITA_COLUMNS.map(field => cita[field] as InValue), codeHash, session.id],
  });
  await executor.execute({
    sql: "INSERT INTO nr_session_grants(sessionId,citaId,creadaEn) VALUES (?,?,?)",
    args: [session.id, cita.id, now],
  });
  await history(executor, session, "crear", null, cita);
  return cita;
}
async function updateCita(executor: Executor, session: Session, action: string, before: Cita, after: Cita, codeHash?: string) {
  const editable = CITA_COLUMNS.filter(field => field !== "id" && field !== "creadaEn");
  const result = await executor.execute({
    sql: `UPDATE nr_citas SET ${editable.map(field => `${field}=?`).join(",")}${codeHash ? ",codeHash=?" : ""} WHERE id=? AND version=?`,
    args: [...editable.map(field => after[field] as InValue), ...(codeHash ? [codeHash] : []), before.id, before.version],
  });
  if (result.rowsAffected !== 1) throw new ApiError(409, "VERSION_CONFLICT", "La cita cambió. Vuelve a consultarla.");
  await history(executor, session, action, before, after);
}

export const OPERATIONS = ["crear", "reprogramar", "cancelar", "regenerar-codigo", "estado-cita"] as const;
export type Operation = typeof OPERATIONS[number];
const operationKeys: Record<Operation, string[]> = {
  crear: ["revision"],
  reprogramar: ["id", "version", "revision"],
  cancelar: ["id", "version"],
  "regenerar-codigo": ["id", "version"],
  "estado-cita": ["id", "version", "estado"],
};
function extractPayload(body: JsonObject, operation: Operation) {
  exactKeys(body, ["clave", ...operationKeys[operation]]);
  const payload: JsonObject = {};
  for (const field of operationKeys[operation]) {
    if (body[field] === undefined) invalid({ [field]: "Este campo es obligatorio." });
    payload[field] = body[field];
  }
  return payload;
}
async function previousResult(executor: Executor, session: Session, clave: string, operation: Operation, digest: string) {
  const result = await executor.execute({
    sql: "SELECT operacion,payloadHash,resultado,citaId FROM nr_idempotencias WHERE sessionId=? AND clave=?",
    args: [session.id, clave],
  });
  if (!result.rows.length) return null;
  const row = result.rows[0];
  if (row.operacion !== operation || row.payloadHash !== digest) {
    throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "Esta solicitud ya se utilizó con otros datos. Recupera el resultado original.");
  }
  await ownedCita(executor, session, String(row.citaId), operation === "estado-cita");
  return JSON.parse(String(row.resultado)) as Cita;
}
async function saveResult(executor: Executor, session: Session, clave: string, operation: Operation, digest: string, cita: Cita) {
  await executor.execute({
    sql: "INSERT INTO nr_idempotencias(sessionId,clave,operacion,payloadHash,citaId,resultado,creadaEn) VALUES (?,?,?,?,?,?,?)",
    args: [session.id, clave, operation, digest, cita.id, JSON.stringify(cita), new Date().toISOString()],
  });
}
function ownerTransition(cita: Cita, input: unknown): Estado {
  const estado = string(input, "estado", 20);
  if (!["reservada", "en atención", "completada", "cancelada", "no asistió"].includes(estado)) invalid({ estado: "El estado no es válido." });
  const now = Date.now(), start = Date.parse(cita.inicioUtc), end = Date.parse(cita.finUtc);
  const permitted = (cita.estado === "reservada" && (
    estado === "cancelada" ||
    (estado === "en atención" && now >= start && now < end) ||
    (estado === "no asistió" && now > end)
  )) || (cita.estado === "en atención" && estado === "completada" && now >= end);
  if (!permitted) throw new ApiError(409, "STATE_CONFLICT", "Ese cambio de estado no está permitido en este momento.", undefined, cita);
  return estado as Estado;
}

export async function mutate(request: Request, operation: Operation, body: JsonObject) {
  const clave = key(body.clave);
  const payload = extractPayload(body, operation);
  const digest = payloadHash(operation, payload);
  const tx = await db.transaction("write");
  try {
    const session = await requireSession(tx, request, operation === "estado-cita");
    const previous = await previousResult(tx, session, clave, operation, digest);
    if (previous) {
      await tx.commit();
      return { status: 200, data: { ok: true, cita: previous, codigoDisponible: false } };
    }
    let cita: Cita;
    let codigo: string | undefined;
    if (operation === "crear") {
      const submitted = object(payload.revision, "revision");
      const catalog = await getCatalog(tx);
      const reviewed = await buildRevision(tx, catalog, submitted);
      checkFullRevision(submitted, reviewed);
      codigo = randomBytes(32).toString("base64url");
      cita = await insertCita(tx, session, reviewed, hash(codigo));
    } else {
      const before = await ownedCita(tx, session, string(payload.id, "id", 100), operation === "estado-cita");
      currentVersion(before, payload.version);
      cita = { ...before, version: before.version + 1, actualizadaEn: new Date().toISOString() };
      if (operation === "reprogramar") {
        visitorChangeAllowed(before);
        const submitted = object(payload.revision, "revision");
        if (submitted.nombre !== before.nombre || submitted.celular !== before.celular) {
          invalid({
            ...(submitted.nombre !== before.nombre ? { nombre: "La reprogramación conserva el nombre de la cita." } : {}),
            ...(submitted.celular !== before.celular ? { celular: "La reprogramación conserva el celular de la cita." } : {}),
          });
        }
        const catalog = await getCatalog(tx);
        const reviewed = await buildRevision(tx, catalog, submitted, before.id);
        checkFullRevision(submitted, reviewed);
        cita = citaFrom({ ...cita, ...reviewed });
      } else if (operation === "cancelar") {
        visitorChangeAllowed(before);
        cita.estado = "cancelada";
      } else if (operation === "estado-cita") {
        cita.estado = ownerTransition(before, payload.estado);
      } else {
        codigo = randomBytes(32).toString("base64url");
      }
      await updateCita(tx, session, operation, before, cita, codigo ? hash(codigo) : undefined);
    }
    await saveResult(tx, session, clave, operation, digest, cita);
    await tx.commit();
    return { status: operation === "crear" ? 201 : 200, data: { ok: true, cita, ...(codigo ? { codigo } : {}) } };
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
}

export async function review(executor: Executor, request: Request, body: JsonObject, change = false) {
  exactKeys(body, [...DRAFT_KEYS, "catalogRevision", ...(change ? ["id", "version"] : [])]);
  const session = await requireSession(executor, request);
  let citaActual: Cita | undefined;
  if (change) {
    citaActual = await ownedCita(executor, session, string(body.id, "id", 100));
    currentVersion(citaActual, body.version);
    visitorChangeAllowed(citaActual);
    if (body.nombre !== citaActual.nombre || body.celular !== citaActual.celular) {
      invalid({
        ...(body.nombre !== citaActual.nombre ? { nombre: "La reprogramación conserva el nombre de la cita." } : {}),
        ...(body.celular !== citaActual.celular ? { celular: "La reprogramación conserva el celular de la cita." } : {}),
      });
    }
  }
  const catalog = await getCatalog(executor);
  const revision = await buildRevision(executor, catalog, body, citaActual?.id);
  checkCatalogRevision(body, revision);
  return { ok: true, revision, ...(citaActual ? { citaActual } : {}) };
}
export async function consult(executor: Executor, request: Request, body: JsonObject) {
  exactKeys(body, ["id"]);
  const session = await requireSession(executor, request);
  if (body.id !== undefined) {
    const cita = await ownedCita(executor, session, string(body.id, "id", 100));
    const result = await executor.execute({
      sql: `SELECT id,fecha,actor,accion,estadoPrevio,estadoNuevo,versionPrevia,versionNueva,anterior,actual
        FROM nr_historial WHERE citaId=? ORDER BY versionNueva`,
      args: [cita.id],
    });
    const historial = result.rows.map(historialFrom);
    return { ok: true, cita, historial };
  }
  const result = await executor.execute({
    sql: `SELECT c.* FROM nr_citas c JOIN nr_session_grants g ON g.citaId=c.id
      WHERE g.sessionId=? ORDER BY c.creadaEn DESC,c.id`,
    args: [session.id],
  });
  return { ok: true, citas: result.rows.map(citaFrom) };
}
export async function recover(executor: Executor, request: Request, body: JsonObject) {
  exactKeys(body, ["clave", "operacion", "payload"]);
  const session = await requireSession(executor, request);
  const clave = key(body.clave);
  const operation = string(body.operacion, "operacion", 30);
  if (!(OPERATIONS as readonly string[]).includes(operation)) invalid({ operacion: "La operación no es válida." });
  const payload = object(body.payload, "payload");
  // Validate the frozen envelope, but never revalidate old availability or versions:
  // a committed original result remains recoverable after subsequent changes.
  extractPayload({ ...payload, clave }, operation as Operation);
  exactKeys(payload, operationKeys[operation as Operation]);
  if (operation === "estado-cita" && session.rol !== "dueno") throw new ApiError(403, "FORBIDDEN", "Este acceso requiere autorización del dueño.");
  const cita = await previousResult(executor, session, clave, operation as Operation, payloadHash(operation, payload));
  return cita ? { ok: true, estado: "guardada", cita, codigoDisponible: false } : { ok: true, estado: "no_encontrada" };
}
