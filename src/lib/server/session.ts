import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError, hash } from "./http";
import type { Executor, Session } from "./types";

export const SESSION_COOKIE = "nr-sesion";
const lifetimeSeconds = 60 * 60 * 24 * 30;

function tokenFrom(request: Request): string | null {
  const cookies = (request.headers.get("cookie") || "").split(";").map(c => c.trim());
  const matches = cookies.filter(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function findSession(executor: Executor, request: Request): Promise<Session | null> {
  const token = tokenFrom(request);
  if (!token) return null;
  const rows = await executor.execute({
    sql: "SELECT id,rol,expiraEn FROM nr_sesiones WHERE tokenHash=? AND revocadaEn IS NULL AND expiraEn>?",
    args: [hash(token), new Date().toISOString()],
  });
  if (!rows.rows.length) return null;
  return rows.rows[0] as unknown as Session;
}
export async function requireSession(executor: Executor, request: Request, owner = false): Promise<Session> {
  const session = await findSession(executor, request);
  if (!session) throw new ApiError(401, "UNAUTHORIZED", "Recupera el acceso para consultar tu cita.");
  if (owner && session.rol !== "dueno") throw new ApiError(403, "FORBIDDEN", "Este acceso requiere autorización del dueño.");
  return session;
}
export function sessionCookie(token: string, origin: string, clear = false) {
  const secure = new URL(origin).protocol === "https:";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Max-Age=${clear ? 0 : lifetimeSeconds}; ${secure ? "Secure; SameSite=None; Partitioned" : "SameSite=Lax"}`;
}
export async function initializeSession(request: Request, origin: string) {
  const tx = await db.transaction("write");
  try {
    const existing = await findSession(tx, request);
    if (existing) {
      await tx.commit();
      return { session: existing, cookie: undefined };
    }
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const session: Session = {
      id: randomUUID(), rol: "visitante",
      expiraEn: new Date(now.getTime() + lifetimeSeconds * 1000).toISOString(),
    };
    await tx.execute({
      sql: "INSERT INTO nr_sesiones(id,tokenHash,rol,creadaEn,expiraEn) VALUES (?,?,?,?,?)",
      args: [session.id, hash(token), session.rol, now.toISOString(), session.expiraEn],
    });
    await tx.commit();
    return { session, cookie: sessionCookie(token, origin) };
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
}
export function secretsEqual(supplied: string, expected: string) {
  return timingSafeEqual(Buffer.from(hash(supplied), "hex"), Buffer.from(hash(expected), "hex"));
}

// Persistent limits are committed separately from login failure. A rejected code
// must not roll back its own attempt counter. A global bucket also bounds attempts
// made by repeatedly acquiring fresh anonymous sessions; no untrusted IP header.
export async function limitCodeAttempts(session: Session, purpose: "owner" | "reservation") {
  const tx = await db.transaction("write");
  let limited = false;
  try {
    const now = Date.now();
    const window = Math.floor(now / 900000);
    const buckets = [
      { key: `${purpose}:session:${session.id}`, limit: 10 },
      { key: `${purpose}:global`, limit: 100 },
    ];
    for (const bucket of buckets) {
      const result = await tx.execute({
        sql: `INSERT INTO nr_rate_limits(clave,ventana,intentos) VALUES (?,?,1)
          ON CONFLICT(clave) DO UPDATE SET ventana=excluded.ventana,
          intentos=CASE WHEN nr_rate_limits.ventana=excluded.ventana THEN nr_rate_limits.intentos+1 ELSE 1 END
          RETURNING intentos`,
        args: [bucket.key, window],
      });
      if (Number(result.rows[0].intentos) > bucket.limit) limited = true;
    }
    await tx.commit();
  } catch (error) {
    if (!tx.closed) await tx.rollback();
    throw error;
  } finally { tx.close(); }
  if (limited) throw new ApiError(429, "RATE_LIMITED", "Se alcanzó el límite de intentos. Vuelve a intentarlo en 15 minutos.");
}
