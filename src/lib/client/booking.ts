"use client";
import { useEffect, useState } from "react";
export type Service = {
    id: string;
    nombre: string;
    duracionMin: number;
    precioCop: number;
    version: number;
    ilustracionId: string;
    presentacionVersion: number;
};
export type Barber = {
    id: string;
    nombre: string;
    especialidad: string;
    version: number;
};
export type Day = {
    diaSemana: number;
    abre: string | null;
    cierra: string | null;
    cerrado: boolean;
};
export type Catalog = {
    catalogRevision: string;
    servicios: Service[];
    barberos: Barber[];
    habilitaciones: {
        servicioId: string;
        barberoId: string;
    }[];
    jornadas: Day[];
    excepciones: {
        fecha: string;
        barberoId: string | null;
        abre: string | null;
        cierra: string | null;
        cerrado: boolean;
    }[];
    zonaHoraria: string;
};
export type Draft = {
    servicioId: string;
    barberoId: string;
    fecha: string;
    inicioUtc: string;
    nombre: string;
    celular: string;
};
export type Revision = Draft & {
    finUtc: string;
    catalogRevision: string;
    servicioVersion: number;
    barberoVersion: number;
    servicioNombre: string;
    barberoNombre: string;
    duracionMin: number;
    precioCop: number;
    ilustracionId: string;
    presentacionVersion: number;
};
export type Appointment = Omit<Revision, "fecha"> & {
    id: string;
    estado: string;
    version: number;
    creadaEn: string;
    actualizadaEn: string;
};
export type History = {
    id: string;
    fecha: string;
    actor: string;
    accion: string;
    estadoPrevio: string;
    estadoNuevo: string;
    versionPrevia: number | null;
    versionNueva: number;
    anterior?: Appointment | null;
    actual?: Appointment;
};
export type Slot = {
    inicioUtc: string;
    finUtc: string;
    hora: string;
};
export type Availability = {
    slots: Slot[];
    proximaHora: Slot | null;
    jornada: {
        abre: string | null;
        cierra: string | null;
        cerrado: boolean;
    };
    catalogRevision: string;
};
export class ApiError extends Error {
    constructor(message: string, public status = 0, public code = "NETWORK", public fields: Record<string, string> = {}, public current?: unknown) { super(message); }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
        const response = await fetch(`/api/${path}`, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: abort.signal });
        const data = await response.json();
        if (!response.ok || !data.ok)
            throw new ApiError(data.error?.message || "No pudimos completar la consulta. Vuelve a intentarlo.", response.status, data.error?.code, data.error?.fields, data.current);
        return data.data;
    }
    catch (error) {
        if (error instanceof ApiError)
            throw error;
        throw new ApiError("No recibimos la respuesta. Comprueba tu conexión e inténtalo de nuevo.");
    }
    finally {
        clearTimeout(timer);
    }
}
export function useCatalog() { const [data, setData] = useState<Catalog | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0); useEffect(() => { let active = true; Promise.resolve().then(() => { if (!active)
    return; setLoading(true); setError(""); return api<Catalog>("catalogo").then(d => { if (active)
    setData(d); }).catch(e => { if (active)
    setError(e.message); }).finally(() => { if (active)
    setLoading(false); }); }); return () => { active = false; }; }, [retry]); return { data, error, loading, retry: () => setRetry(n => n + 1) }; }
export const money = (n: number) => `$${new Intl.NumberFormat("es-CO").format(n)} COP`;
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const time = (date: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(date));
export const dayLabel = (date: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
export function contextHref(path: string, service?: string, barber?: string) { const p = new URLSearchParams(); if (service)
    p.set("servicio", service); if (barber)
    p.set("barbero", barber); return `${path}${p.size ? `?${p}` : ""}`; }
export function trackBooking() { (window as Window & {
    constructorTrack?: (event: string) => void;
}).constructorTrack?.("Booking started"); }
export type DraftStore = {
    draft: Draft;
    revision?: Revision;
    edit?: {
        id: string;
        draft: Draft;
        revision?: Revision;
    };
};
export function readDraft(): DraftStore | null { try {
    return JSON.parse(sessionStorage.getItem("nr-borrador") || "null");
}
catch {
    return null;
} }
export function storeDraft(draft: Draft, revision?: Revision) { sessionStorage.setItem("nr-borrador", JSON.stringify({ ...readDraft(), draft, revision })); }
let reviewFailure: ApiError | null = null;
export function retainReviewFailure(error: ApiError) { reviewFailure = error; }
export function consumeReviewFailure() { const error = reviewFailure; reviewFailure = null; return error; }
function marker() {
    if (window.top === window) return "nr-sesion-directa";
    const ancestors = Array.from(window.location.ancestorOrigins || []);
    return `nr-sesion-iframe:${ancestors.length ? ancestors.join("|") : "contexto-no-observable"}`;
}
export async function coordinated<T>(action: () => Promise<T>): Promise<T> { if (!navigator.locks)
    throw new ApiError("Este navegador no permite coordinar las vistas. Abre una sola ventana en un navegador compatible para continuar."); return navigator.locks.request("nr-sesion", action); }
export async function ensureSession(explicitRecovery = false) {
    return coordinated(async () => {
        try {
            await api("sesion/consultar", {});
            sessionStorage.setItem(marker(), "1");
            return;
        }
        catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401)
                throw e;
            if ((sessionStorage.getItem(marker()) || (window.top !== window && sessionStorage.getItem("nr-sesion-iframe"))) && !explicitRecovery)
                throw new ApiError("La sesión ha caducado o las cookies están bloqueadas. Recupera el acceso con tu código o restablece la sesión antes de continuar.", 401, "SESSION_LOST");
        }
        await api("sesion", {});
        try {
            await api("sesion/consultar", {});
            sessionStorage.setItem(marker(), "1");
        }
        catch {
            throw new ApiError("No se pudo verificar la sesión. Permite las cookies de este sitio y pulsa Restablecer sesión.", 401, "COOKIES_BLOCKED");
        }
    });
}
export type Operation = {
    operacion: string;
    clave: string;
    payload: Record<string, unknown>;
};
export function readOperation(): Operation | null { try {
    const stored = JSON.parse(sessionStorage.getItem("nr-operacion") || "null");
    return stored?.operacion ? { operacion: stored.operacion, clave: stored.clave, payload: stored.payload } : null;
}
catch {
    return null;
} }
export function archivedOperations(): Operation[] { try {
    return JSON.parse(sessionStorage.getItem("nr-operacion") || "null")?.anteriores || [];
}
catch {
    return [];
} }
export function clearOperation() { const anteriores = archivedOperations(); if (anteriores.length)
    sessionStorage.setItem("nr-operacion", JSON.stringify({ anteriores }));
else
    sessionStorage.removeItem("nr-operacion"); }
export function archiveOperation() { const op = readOperation(); if (op)
    sessionStorage.setItem("nr-operacion", JSON.stringify({ anteriores: [...archivedOperations(), op] })); }
export async function recoverArchived(op: Operation) { const result = await coordinated(() => api<{
    estado: string;
    cita?: Appointment;
}>("reservas/recuperar", op)); if (result.estado === "guardada") {
    const anteriores = archivedOperations().filter(item => item.clave !== op.clave);
    const current = readOperation();
    if (current || anteriores.length)
        sessionStorage.setItem("nr-operacion", JSON.stringify({ ...current, anteriores }));
    else
        sessionStorage.removeItem("nr-operacion");
} return result; }
export function prepareOperation(operacion: string, payload: Record<string, unknown>) { const previous = readOperation(); if (previous)
    throw new ApiError("Hay una operación sin resolver. Recupera su resultado original antes de enviar otra selección.", 409, "PENDING_OPERATION"); const op = { operacion, payload, clave: crypto.randomUUID() }; sessionStorage.setItem("nr-operacion", JSON.stringify({ ...op, anteriores: archivedOperations() })); return op; }
export async function sendOperation<T>(op: Operation): Promise<T> { return coordinated(async () => { try {
    const result = await api<T>(`reservas/${op.operacion}`, { ...op.payload, clave: op.clave });
    clearOperation();
    return result;
}
catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500)
        clearOperation();
    throw e;
} }); }
export async function recoverOperation() { const op = readOperation(); if (!op)
    throw new ApiError("No hay una operación pendiente."); const result = await coordinated(() => api<{
    estado: string;
    cita?: Appointment;
}>("reservas/recuperar", op)); if (result.estado === "guardada")
    clearOperation(); return result; }
let deliveredCode = "";
let savedId = "";
export function rememberSaved(cita: Appointment, codigo?: string) { savedId = cita.id; deliveredCode = codigo || ""; }
export function currentSaved() { return { id: savedId, codigo: deliveredCode }; }
export function resetPrivateMemory() { savedId = ""; deliveredCode = ""; sessionStorage.removeItem("nr-borrador"); sessionStorage.removeItem(marker()); }
export function useClock() { const [now, setNow] = useState(() => Date.now()); useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []); return now; }
export function storeEdit(id: string, draft: Draft, revision?: Revision) { sessionStorage.setItem("nr-borrador", JSON.stringify({ ...readDraft(), edit: { id, draft, revision } })); }
export function clearEdit() { const stored = readDraft(); if (stored) {
    delete stored.edit;
    sessionStorage.setItem("nr-borrador", JSON.stringify(stored));
} }
