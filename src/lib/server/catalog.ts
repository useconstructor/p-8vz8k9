import { ApiError, canonical, exactKeys, hash, invalid, string } from "./http";
import type { Barbero, Catalogo, Executor, Jornada, JsonObject, Revision, Servicio, Slot } from "./types";

export const DRAFT_KEYS = ["servicioId", "barberoId", "fecha", "inicioUtc", "nombre", "celular"] as const;
export const REVISION_KEYS = [
  ...DRAFT_KEYS, "finUtc", "catalogRevision", "servicioVersion", "barberoVersion",
  "servicioNombre", "barberoNombre", "duracionMin", "precioCop", "ilustracionId", "presentacionVersion",
] as const;

function jornada(row: Record<string, unknown>): Jornada {
  return { abre: row.abre as string | null, cierra: row.cierra as string | null, cerrado: !!row.cerrado };
}
export async function getCatalog(executor: Executor): Promise<Catalogo> {
  const services = await executor.execute(`SELECT id,nombre,duracionMin,precioCop,version,ilustracionId,presentacionVersion
    FROM nr_servicios ORDER BY CASE id WHEN 'corte' THEN 1 WHEN 'barba' THEN 2 WHEN 'corte-barba' THEN 3 WHEN 'afeitado-toalla' THEN 4 ELSE 5 END,id`);
  const barbers = await executor.execute(`SELECT id,nombre,especialidad,version FROM nr_barberos
    ORDER BY CASE id WHEN 'tomas' THEN 1 WHEN 'julian' THEN 2 WHEN 'samuel' THEN 3 ELSE 4 END,id`);
  const skills = await executor.execute("SELECT servicioId,barberoId FROM nr_habilitaciones ORDER BY servicioId,barberoId");
  const weekly = await executor.execute("SELECT diaSemana,abre,cierra,cerrado FROM nr_jornadas ORDER BY diaSemana");
  const exceptions = await executor.execute("SELECT fecha,barberoId,abre,cierra,cerrado FROM nr_excepciones ORDER BY fecha,barberoId");
  const data = {
    servicios: services.rows as unknown as Servicio[],
    barberos: barbers.rows as unknown as Barbero[],
    habilitaciones: skills.rows as unknown as Catalogo["habilitaciones"],
    jornadas: weekly.rows.map(row => ({ diaSemana: Number(row.diaSemana), ...jornada(row) })),
    excepciones: exceptions.rows.map(row => ({ fecha: String(row.fecha), barberoId: row.barberoId === null ? null : String(row.barberoId), ...jornada(row) })),
    zonaHoraria: "America/Bogota" as const,
  };
  return { catalogRevision: hash(canonical(data)), ...data };
}
export function dateValue(value: unknown) {
  const date = string(value, "fecha", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) invalid({ fecha: "Indica una fecha válida." });
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) invalid({ fecha: "Indica una fecha válida." });
  return date;
}
export function bogotaDate(utc: string) {
  return new Date(new Date(utc).getTime() - 5 * 3600000).toISOString().slice(0, 10);
}
export function effectiveJornada(catalog: Catalogo, fecha: string, barberoId?: string): Jornada {
  const specific = barberoId ? catalog.excepciones.find(x => x.fecha === fecha && x.barberoId === barberoId) : undefined;
  const global = catalog.excepciones.find(x => x.fecha === fecha && x.barberoId === null);
  const day = new Date(`${fecha}T12:00:00.000Z`).getUTCDay() || 7;
  const result = specific || global || catalog.jornadas.find(x => x.diaSemana === day);
  return result ? { abre: result.abre, cierra: result.cierra, cerrado: result.cerrado } : { abre: null, cierra: null, cerrado: true };
}
function entities(catalog: Catalogo, serviceId: unknown, barberId: unknown) {
  const servicioId = string(serviceId, "servicioId", 100);
  const barberoId = string(barberId, "barberoId", 100);
  const service = catalog.servicios.find(x => x.id === servicioId);
  if (!service) invalid({ servicioId: "Elige un servicio válido." });
  const barber = catalog.barberos.find(x => x.id === barberoId);
  if (!barber) invalid({ barberoId: "Elige un barbero válido." });
  if (!catalog.habilitaciones.some(x => x.servicioId === servicioId && x.barberoId === barberoId)) {
    invalid({ barberoId: "Este barbero no está habilitado para el servicio." });
  }
  return { service, barber };
}
function minutes(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new ApiError(503, "UNAVAILABLE", "El horario necesita revisión.");
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) throw new ApiError(503, "UNAVAILABLE", "El horario necesita revisión.");
  return h * 60 + m;
}
export async function availability(executor: Executor, catalog: Catalogo, input: JsonObject, excludeId?: string) {
  exactKeys(input, ["servicioId", "barberoId", "fecha"]);
  const { service, barber } = entities(catalog, input.servicioId, input.barberoId);
  const fecha = dateValue(input.fecha);
  const day = effectiveJornada(catalog, fecha, barber.id);
  const slots: Slot[] = [];
  if (!day.cerrado && day.abre && day.cierra) {
    const midnight = new Date(`${fecha}T00:00:00.000-05:00`).getTime();
    const opening = minutes(day.abre);
    const closing = minutes(day.cierra);
    const occupied = await executor.execute({
      sql: `SELECT inicioUtc,finUtc FROM nr_citas WHERE barberoId=? AND estado<>'cancelada'
        AND inicioUtc<? AND finUtc>? AND id<>?`,
      args: [barber.id, new Date(midnight + closing * 60000).toISOString(),
        new Date(midnight + opening * 60000).toISOString(), excludeId || ""],
    });
    const now = Date.now();
    for (let start = Math.ceil(opening / 15) * 15; start + service.duracionMin <= closing; start += 15) {
      const instant = midnight + start * 60000;
      if (instant <= now) continue;
      const inicioUtc = new Date(instant).toISOString();
      const finUtc = new Date(instant + service.duracionMin * 60000).toISOString();
      if (occupied.rows.some(x => String(x.inicioUtc) < finUtc && String(x.finUtc) > inicioUtc)) continue;
      slots.push({ inicioUtc, finUtc, hora: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}` });
    }
  }
  return {
    servicioId: service.id, barberoId: barber.id, fecha,
    catalogRevision: catalog.catalogRevision, slots, proximaHora: slots[0] || null, jornada: day,
  };
}

export async function buildRevision(
  executor: Executor, catalog: Catalogo, input: JsonObject, excludeId?: string,
): Promise<Revision> {
  const { service, barber } = entities(catalog, input.servicioId, input.barberoId);
  const fecha = dateValue(input.fecha);
  const fields: Record<string, string> = {};
  if (typeof input.nombre !== "string" || input.nombre.length < 2 || input.nombre.length > 100 || !input.nombre.trim()) {
    fields.nombre = "Escribe un nombre de 2 a 100 caracteres.";
  }
  if (typeof input.celular !== "string" || !/^3[0-9]{9}$/.test(input.celular)) {
    fields.celular = "Escribe 10 dígitos comenzando por 3.";
  }
  if (Object.keys(fields).length) invalid(fields);
  const inicioUtc = string(input.inicioUtc, "inicioUtc", 24);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(inicioUtc)) invalid({ inicioUtc: "Elige una hora válida." });
  const instant = new Date(inicioUtc);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== inicioUtc || bogotaDate(inicioUtc) !== fecha) {
    invalid({ inicioUtc: "La hora debe corresponder a la fecha elegida en Bogotá." });
  }
  const result: Revision = {
    servicioId: service.id, barberoId: barber.id, fecha, inicioUtc,
    nombre: input.nombre as string, celular: input.celular as string,
    finUtc: new Date(instant.getTime() + service.duracionMin * 60000).toISOString(),
    catalogRevision: catalog.catalogRevision, servicioVersion: service.version, barberoVersion: barber.version,
    servicioNombre: service.nombre, barberoNombre: barber.nombre, duracionMin: service.duracionMin,
    precioCop: service.precioCop, ilustracionId: service.ilustracionId, presentacionVersion: service.presentacionVersion,
  };
  // A changed duration or schedule can itself make an old selection invalid.
  // Return the new authoritative facts first so it is explicitly reviewed.
  checkCatalogRevision(input, result);
  if (instant.getUTCMinutes() % 15 !== 0 || instant.getTime() <= Date.now()) {
    invalid({ inicioUtc: "Elige una hora futura en intervalos de 15 minutos." });
  }
  const day = effectiveJornada(catalog, fecha, barber.id);
  const localMinutes = ((instant.getUTCHours() + 19) % 24) * 60 + instant.getUTCMinutes();
  if (day.cerrado || !day.abre || !day.cierra || localMinutes < minutes(day.abre) || localMinutes + service.duracionMin > minutes(day.cierra)) {
    invalid({ inicioUtc: "El servicio completo debe quedar dentro de la jornada." });
  }
  const occupied = await executor.execute({
    sql: `SELECT id FROM nr_citas WHERE barberoId=? AND estado<>'cancelada'
      AND inicioUtc<? AND finUtc>? AND id<>? LIMIT 1`,
    args: [barber.id, result.finUtc, inicioUtc, excludeId || ""],
  });
  if (occupied.rows.length) {
    const available = await availability(executor, catalog, { servicioId: service.id, barberoId: barber.id, fecha }, excludeId);
    throw new ApiError(409, "SLOT_CONFLICT", "Ese horario ya está ocupado. Conservamos tu selección para que elijas otra hora.", undefined, {
      revision: result, disponibilidad: available,
    });
  }
  return result;
}

export function checkCatalogRevision(input: JsonObject, current: Revision) {
  string(input.catalogRevision, "catalogRevision", 128);
  if (input.catalogRevision !== current.catalogRevision) {
    throw new ApiError(409, "STALE_REVIEW", "La información cambió. Revisa los valores actuales antes de confirmar.", undefined, current);
  }
}
export function checkFullRevision(input: JsonObject, current: Revision) {
  exactKeys(input, REVISION_KEYS);
  const fields: Record<string, string> = {};
  for (const field of REVISION_KEYS) {
    if (input[field] === undefined) fields[field] = "Este campo es obligatorio.";
    else if (typeof input[field] !== typeof current[field]) fields[field] = "El tipo de valor no es válido.";
  }
  if (Object.keys(fields).length) invalid(fields);
  checkCatalogRevision(input, current);
  // With the same catalogue digest, differing facts are tampering, not a stale catalogue.
  for (const field of REVISION_KEYS) {
    if (input[field] !== current[field]) fields[field] = "El valor no coincide con la revisión autorizada.";
  }
  if (Object.keys(fields).length) invalid(fields);
}
