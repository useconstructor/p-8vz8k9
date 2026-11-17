import { db } from "@/lib/db";
import { ApiError, exactKeys, failure, hash, invalid, json, readBody, requireOrigin, string } from "./http";
import { availability, dateValue, effectiveJornada, getCatalog } from "./catalog";
import { ensureBookingSchema } from "./schema";
import { findSession, initializeSession, limitCodeAttempts, requireSession, secretsEqual, sessionCookie } from "./session";
import { citaFrom, consult, historialFrom, mutate, ownedCita, recover, review, type Operation } from "./reservations";
import type { Executor, Historial, JsonObject } from "./types";

const readPaths = new Set(["/api/catalogo", "/api/disponibilidad"]);
const postPaths = new Set([
  "/api/sesion", "/api/sesion/consultar", "/api/sesion/salir",
  "/api/reservas/revisar", "/api/reservas/crear", "/api/reservas/recuperar",
  "/api/reservas/consultar", "/api/reservas/acceder", "/api/reservas/regenerar-codigo",
  "/api/reservas/revisar-cambio", "/api/reservas/reprogramar", "/api/reservas/cancelar",
  "/api/dueno/estado", "/api/dueno/acceder", "/api/dueno/agenda", "/api/dueno/estado-cita",
]);

async function readSnapshot<T>(action: (executor: Executor) => Promise<T>): Promise<T> {
  const tx = await db.transaction("read");
  try {
    const result = await action(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
}
async function codeAccess(request: Request, body: JsonObject, owner: boolean) {
  exactKeys(body, ["codigo"]);
  const codigo = string(body.codigo, "codigo", 1024);
  const priorSession = await requireSession(db, request);
  await limitCodeAttempts(priorSession, owner ? "owner" : "reservation");
  const tx = await db.transaction("write");
  try {
    // Session expiry and revocation are checked again inside the grant transaction.
    const session = await requireSession(tx, request);
    if (owner) {
      const configuredCode = process.env.OWNER_ACCESS_CODE;
      if (!configuredCode) throw new ApiError(503, "UNAVAILABLE", "El acceso del dueño no está disponible.");
      if (!secretsEqual(codigo, configuredCode)) throw new ApiError(401, "UNAUTHORIZED", "No se pudo verificar el código.");
      await tx.execute({ sql: "UPDATE nr_sesiones SET rol='dueno' WHERE id=?", args: [session.id] });
      await tx.commit();
      return { ok: true, rol: "dueno" };
    }
    const result = await tx.execute({ sql: "SELECT id FROM nr_citas WHERE codeHash=?", args: [hash(codigo)] });
    if (!result.rows.length) throw new ApiError(401, "UNAUTHORIZED", "No se pudo verificar el código.");
    const id = String(result.rows[0].id);
    await tx.execute({
      sql: "INSERT INTO nr_session_grants(sessionId,citaId,creadaEn) VALUES (?,?,?) ON CONFLICT DO NOTHING",
      args: [session.id, id, new Date().toISOString()],
    });
    const cita = await ownedCita(tx, session, id);
    await tx.commit();
    return { ok: true, cita };
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
}
async function agenda(executor: Executor, request: Request, body: JsonObject) {
  exactKeys(body, ["fecha"]);
  await requireSession(executor, request, true);
  const fecha = dateValue(body.fecha);
  const catalog = await getCatalog(executor);
  const start = new Date(`${fecha}T00:00:00.000-05:00`);
  const end = new Date(start.getTime() + 86400000);
  const result = await executor.execute({
    sql: "SELECT * FROM nr_citas WHERE inicioUtc>=? AND inicioUtc<? ORDER BY inicioUtc,id",
    args: [start.toISOString(), end.toISOString()],
  });
  // Read the complete audit trail for this day's records in the same authorized
  // database snapshot as the agenda. No per-appointment requests or record grants
  // are needed, and cancelled/completed records retain their full history.
  const history = await executor.execute({
    sql: `SELECT h.citaId,h.id,h.fecha,h.actor,h.accion,h.estadoPrevio,h.estadoNuevo,
        h.versionPrevia,h.versionNueva,h.anterior,h.actual
      FROM nr_historial h JOIN nr_citas c ON c.id=h.citaId
      WHERE c.inicioUtc>=? AND c.inicioUtc<? ORDER BY h.citaId,h.versionNueva`,
    args: [start.toISOString(), end.toISOString()],
  });
  const byAppointment = new Map<string, Historial[]>();
  for (const row of history.rows) {
    const id = String(row.citaId);
    const entries = byAppointment.get(id) || [];
    entries.push(historialFrom(row));
    byAppointment.set(id, entries);
  }
  const citas = result.rows.map(row => ({
    ...citaFrom(row), historial: byAppointment.get(String(row.id)) || [],
  }));
  return {
    ok: true, fecha, jornada: effectiveJornada(catalog, fecha),
    barberos: catalog.barberos.map(barber => ({
      id: barber.id, nombre: barber.nombre, citas: citas.filter(c => c.barberoId === barber.id),
    })),
  };
}

export async function handleGet(request: Request) {
  try {
    const url = new URL(request.url);
    if (!readPaths.has(url.pathname)) return json({ ok: false, error: { code: "NOT_FOUND", message: "Ruta no disponible." } }, 404);
    const input: JsonObject = {};
    for (const [name, value] of url.searchParams) {
      if (Object.hasOwn(input, name)) invalid({ [name]: "No repitas este parámetro." });
      Object.defineProperty(input, name, { value, enumerable: true, configurable: true });
    }
    exactKeys(input, url.pathname === "/api/catalogo" ? [] : ["servicioId", "barberoId", "fecha"]);
    await ensureBookingSchema();
    return json(await readSnapshot(async tx => {
      const catalog = await getCatalog(tx);
      return url.pathname === "/api/catalogo" ? { ok: true, ...catalog } : { ok: true, ...await availability(tx, catalog, input) };
    }));
  } catch (error) { return failure(error); }
}
export async function handlePost(request: Request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!postPaths.has(path)) return json({ ok: false, error: { code: "NOT_FOUND", message: "Ruta no disponible." } }, 404);
    const origin = requireOrigin(request);
    if (url.search) invalid({ query: "Envía los datos privados solo en el cuerpo de la solicitud." });
    const body = await readBody(request);
    if (path === "/api/dueno/estado" && !process.env.OWNER_ACCESS_CODE) {
      exactKeys(body, []);
      return json({ ok: true, disponible: false, autenticado: false });
    }
    if (path === "/api/dueno/acceder" && !process.env.OWNER_ACCESS_CODE) {
      throw new ApiError(503, "UNAVAILABLE", "El acceso del dueño no está disponible.");
    }
    await ensureBookingSchema();
    if (path === "/api/sesion") {
      exactKeys(body, []);
      const { session, cookie } = await initializeSession(request, origin);
      return json({ ok: true, rol: session.rol }, 200, cookie);
    }
    if (path === "/api/sesion/consultar") {
      exactKeys(body, []);
      const session = await requireSession(db, request);
      return json({ ok: true, rol: session.rol });
    }
    if (path === "/api/sesion/salir") {
      exactKeys(body, []);
      const tx = await db.transaction("write");
      try {
        const session = await requireSession(tx, request);
        await tx.execute({
          sql: "UPDATE nr_sesiones SET revocadaEn=? WHERE id=?",
          args: [new Date().toISOString(), session.id],
        });
        await tx.commit();
      } catch (error) {
        if (!tx.closed) await tx.rollback();
        throw error;
      } finally { tx.close(); }
      return json({ ok: true }, 200, sessionCookie("", origin, true));
    }
    if (path === "/api/dueno/estado") {
      exactKeys(body, []);
      const session = await findSession(db, request);
      return json({ ok: true, disponible: true, autenticado: session?.rol === "dueno" });
    }
    if (path === "/api/dueno/acceder" || path === "/api/reservas/acceder") {
      return json(await codeAccess(request, body, path === "/api/dueno/acceder"));
    }
    if (path === "/api/dueno/agenda") return json(await readSnapshot(tx => agenda(tx, request, body)));
    if (path === "/api/reservas/revisar" || path === "/api/reservas/revisar-cambio") {
      return json(await readSnapshot(tx => review(tx, request, body, path === "/api/reservas/revisar-cambio")));
    }
    if (path === "/api/reservas/consultar") return json(await readSnapshot(tx => consult(tx, request, body)));
    if (path === "/api/reservas/recuperar") return json(await readSnapshot(tx => recover(tx, request, body)));
    const operation = path.slice(path.lastIndexOf("/") + 1) as Operation;
    const result = await mutate(request, operation, body);
    return json(result.data, result.status);
  } catch (error) { return failure(error); }
}
