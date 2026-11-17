import { db } from "@/lib/db";
import type { Executor } from "./types";

// Migrations and the expressly requested fictional catalogue are committed together.
// Seeding never overwrites existing rows; corrections use guarded migrations.
const migrations = [
  `CREATE TABLE IF NOT EXISTS nr_schema_migrations (version INTEGER PRIMARY KEY, aplicadaEn TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS nr_seed_marker (id TEXT PRIMARY KEY, creadaEn TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS nr_servicios (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL,
    duracionMin INTEGER NOT NULL CHECK(typeof(duracionMin)='integer' AND duracionMin>0 AND duracionMin%15=0),
    precioCop INTEGER NOT NULL CHECK(typeof(precioCop)='integer' AND precioCop>0),
    version INTEGER NOT NULL CHECK(version>0),
    ilustracionId TEXT NOT NULL, presentacionVersion INTEGER NOT NULL CHECK(presentacionVersion>0))`,
  `CREATE TABLE IF NOT EXISTS nr_barberos (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, especialidad TEXT NOT NULL,
    version INTEGER NOT NULL CHECK(version>0))`,
  `CREATE TABLE IF NOT EXISTS nr_habilitaciones (
    servicioId TEXT NOT NULL REFERENCES nr_servicios(id), barberoId TEXT NOT NULL REFERENCES nr_barberos(id),
    PRIMARY KEY(servicioId,barberoId))`,
  `CREATE TABLE IF NOT EXISTS nr_jornadas (
    diaSemana INTEGER PRIMARY KEY CHECK(diaSemana BETWEEN 1 AND 7),
    abre TEXT, cierra TEXT, cerrado INTEGER NOT NULL CHECK(cerrado IN (0,1)),
    CHECK(cerrado=1 OR (abre IS NOT NULL AND cierra IS NOT NULL AND abre<cierra)))`,
  `CREATE TABLE IF NOT EXISTS nr_excepciones (
    id TEXT PRIMARY KEY, fecha TEXT NOT NULL, barberoId TEXT REFERENCES nr_barberos(id),
    abre TEXT, cierra TEXT, cerrado INTEGER NOT NULL CHECK(cerrado IN (0,1)),
    CHECK(cerrado=1 OR (abre IS NOT NULL AND cierra IS NOT NULL AND abre<cierra)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nr_excepcion_global ON nr_excepciones(fecha) WHERE barberoId IS NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS nr_excepcion_barbero ON nr_excepciones(fecha,barberoId) WHERE barberoId IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS nr_sesiones (
    id TEXT PRIMARY KEY, tokenHash TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL CHECK(rol IN ('visitante','dueno')),
    creadaEn TEXT NOT NULL, expiraEn TEXT NOT NULL, revocadaEn TEXT)`,
  `CREATE TABLE IF NOT EXISTS nr_citas (
    id TEXT PRIMARY KEY, servicioId TEXT NOT NULL REFERENCES nr_servicios(id),
    barberoId TEXT NOT NULL REFERENCES nr_barberos(id),
    servicioNombre TEXT NOT NULL, barberoNombre TEXT NOT NULL,
    duracionMin INTEGER NOT NULL CHECK(typeof(duracionMin)='integer' AND duracionMin>0),
    precioCop INTEGER NOT NULL CHECK(typeof(precioCop)='integer' AND precioCop>0),
    nombre TEXT NOT NULL CHECK(length(nombre) BETWEEN 2 AND 100 AND length(trim(nombre))>0),
    celular TEXT NOT NULL CHECK(length(celular)=10 AND celular GLOB '3[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    inicioUtc TEXT NOT NULL, finUtc TEXT NOT NULL CHECK(finUtc>inicioUtc),
    estado TEXT NOT NULL CHECK(estado IN ('reservada','en atención','completada','cancelada','no asistió')),
    version INTEGER NOT NULL CHECK(typeof(version)='integer' AND version>0),
    catalogRevision TEXT NOT NULL, servicioVersion INTEGER NOT NULL, barberoVersion INTEGER NOT NULL,
    ilustracionId TEXT NOT NULL, presentacionVersion INTEGER NOT NULL,
    creadaEn TEXT NOT NULL, actualizadaEn TEXT NOT NULL,
    codeHash TEXT NOT NULL UNIQUE, ownerSessionId TEXT NOT NULL REFERENCES nr_sesiones(id))`,
  `CREATE INDEX IF NOT EXISTS nr_citas_intervalo ON nr_citas(barberoId,inicioUtc,finUtc)`,
  `CREATE INDEX IF NOT EXISTS nr_citas_propietario ON nr_citas(ownerSessionId)`,
  `CREATE TABLE IF NOT EXISTS nr_session_grants (
    sessionId TEXT NOT NULL REFERENCES nr_sesiones(id), citaId TEXT NOT NULL REFERENCES nr_citas(id),
    creadaEn TEXT NOT NULL, PRIMARY KEY(sessionId,citaId))`,
  `CREATE INDEX IF NOT EXISTS nr_grants_cita ON nr_session_grants(citaId)`,
  `CREATE TABLE IF NOT EXISTS nr_historial (
    id TEXT PRIMARY KEY, citaId TEXT NOT NULL REFERENCES nr_citas(id), fecha TEXT NOT NULL,
    actor TEXT NOT NULL CHECK(actor IN ('visitante','dueno')), accion TEXT NOT NULL,
    estadoPrevio TEXT, estadoNuevo TEXT NOT NULL, versionPrevia INTEGER, versionNueva INTEGER NOT NULL,
    anterior TEXT, actual TEXT NOT NULL, UNIQUE(citaId,versionNueva))`,
  `CREATE INDEX IF NOT EXISTS nr_historial_cita ON nr_historial(citaId,versionNueva)`,
  `CREATE TABLE IF NOT EXISTS nr_idempotencias (
    sessionId TEXT NOT NULL REFERENCES nr_sesiones(id), clave TEXT NOT NULL,
    operacion TEXT NOT NULL CHECK(operacion IN ('crear','reprogramar','cancelar','regenerar-codigo','estado-cita')),
    payloadHash TEXT NOT NULL, citaId TEXT NOT NULL REFERENCES nr_citas(id),
    resultado TEXT NOT NULL, creadaEn TEXT NOT NULL, PRIMARY KEY(sessionId,clave))`,
  `CREATE TABLE IF NOT EXISTS nr_rate_limits (
    clave TEXT PRIMARY KEY, ventana INTEGER NOT NULL, intentos INTEGER NOT NULL CHECK(intentos>=0))`,
];

async function seed(tx: Executor) {
  const seeded = await tx.execute("SELECT id FROM nr_seed_marker WHERE id='catalogo-demo-v1'");
  if (seeded.rows.length) return;
  const services = [
    ["corte", "Corte", 45, 45000, "perfil-corte"],
    ["barba", "Barba", 30, 30000, "perfil-barba"],
    ["corte-barba", "Corte + barba", 75, 65000, "perfil-corte-barba"],
    ["afeitado-toalla", "Afeitado con toalla caliente", 45, 40000, "perfil-afeitado-toalla"],
  ] as const;
  const barbers = [
    ["tomas", "Tomás", "cortes clásicos"],
    ["julian", "Julián", "diseño de barba"],
    ["samuel", "Samuel", "afeitado tradicional"],
  ] as const;
  for (const [id, nombre, duracion, precio, ilustracion] of services) {
    await tx.execute({
      sql: `INSERT INTO nr_servicios(id,nombre,duracionMin,precioCop,version,ilustracionId,presentacionVersion)
        VALUES (?,?,?,?,1,?,1) ON CONFLICT(id) DO NOTHING`,
      args: [id, nombre, duracion, precio, ilustracion],
    });
  }
  for (const [id, nombre, especialidad] of barbers) {
    await tx.execute({
      sql: "INSERT INTO nr_barberos(id,nombre,especialidad,version) VALUES (?,?,?,1) ON CONFLICT(id) DO NOTHING",
      args: [id, nombre, especialidad],
    });
    for (const [servicioId] of services) {
      await tx.execute({
        sql: "INSERT INTO nr_habilitaciones(servicioId,barberoId) VALUES (?,?) ON CONFLICT DO NOTHING",
        args: [servicioId, id],
      });
    }
  }
  for (let day = 1; day <= 7; day++) {
    await tx.execute({
      sql: "INSERT INTO nr_jornadas(diaSemana,abre,cierra,cerrado) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
      args: [day, day === 7 ? null : "09:00", day === 7 ? null : "19:00", day === 7 ? 1 : 0],
    });
  }
  await tx.execute({
    sql: "INSERT INTO nr_seed_marker(id,creadaEn) VALUES ('catalogo-demo-v1',?)",
    args: [new Date().toISOString()],
  });
}

let ready: Promise<void> | undefined;
async function restoreCatalogPresentation(tx: Executor) {
  const applied = await tx.execute("SELECT version FROM nr_schema_migrations WHERE version=3");
  if (applied.rows.length) return;
  // Correct only the unchanged demo rows promoted by migration 2. Fresh seeds
  // already use the required presentation 1. Keep service versions monotonic
  // so stale reviews are rejected; saved bookings/history retain both renderers.
  for (const [id, nombre, duracion, precio, ilustracion] of [
    ["corte", "Corte", 45, 45000, "perfil-corte"],
    ["barba", "Barba", 30, 30000, "perfil-barba"],
    ["corte-barba", "Corte + barba", 75, 65000, "perfil-corte-barba"],
    ["afeitado-toalla", "Afeitado con toalla caliente", 45, 40000, "perfil-afeitado-toalla"],
  ] as const) {
    await tx.execute({
      sql: `UPDATE nr_servicios SET presentacionVersion=1,version=version+1
        WHERE id=? AND nombre=? AND duracionMin=? AND precioCop=?
        AND ilustracionId=? AND presentacionVersion=2 AND version=2
        AND EXISTS (SELECT 1 FROM nr_schema_migrations WHERE version=2)`,
      args: [id, nombre, duracion, precio, ilustracion],
    });
  }
  await tx.execute({
    sql: "INSERT INTO nr_schema_migrations(version,aplicadaEn) VALUES (3,?)",
    args: [new Date().toISOString()],
  });
}
export function ensureBookingSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const tx = await db.transaction("write");
      try {
        for (const sql of migrations) await tx.execute(sql);
        await seed(tx);
        await tx.execute({
          sql: "INSERT INTO nr_schema_migrations(version,aplicadaEn) VALUES (1,?) ON CONFLICT DO NOTHING",
          args: [new Date().toISOString()],
        });
        await restoreCatalogPresentation(tx);
        await tx.commit();
      } catch (error) {
        if (!tx.closed) await tx.rollback();
        throw error;
      } finally {
        tx.close();
      }
    })().catch((error) => { ready = undefined; throw error; });
  }
  return ready;
}
