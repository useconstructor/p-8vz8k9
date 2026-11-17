"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api, ApiError, type Appointment, type History, today, dayLabel, time, ensureSession, coordinated, resetPrivateMemory, readOperation, prepareOperation, clearOperation, useClock } from "@/lib/client/booking";
import { Notice } from "./shell";
type Agenda = {
    fecha: string;
    jornada: {
        abre: string;
        cierra: string;
        cerrado: boolean;
    };
    barberos: {
        id: string;
        nombre: string;
        citas: (Appointment & { historial: History[] })[];
    }[];
};
export function OwnerPage() {
    const [available, setAvailable] = useState<boolean | null>(null), [authenticated, setAuthenticated] = useState(false), [code, setCode] = useState(""), [date, setDate] = useState(today), [agenda, setAgenda] = useState<Agenda | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
    const codeRef = useRef<HTMLInputElement>(null);
    useLayoutEffect(() => { if (error && !busy && !authenticated && codeRef.current) { codeRef.current.focus({ preventScroll: true }); codeRef.current.scrollIntoView({ behavior: "instant", block: "center" }); } }, [error, busy, authenticated]);
    useEffect(() => { let active = true; api<{
        disponible: boolean;
        autenticado: boolean;
    }>("dueno/estado", {}).then(r => { if (active) {
        setAvailable(r.disponible);
        setAuthenticated(r.autenticado);
    } }).catch(e => { if (active)
        setError(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [retry]);
    async function loadAgenda() { setLoading(true); setError(""); try {
        const result = await api<Agenda>("dueno/agenda", { fecha: date });
        setAgenda(result);
    }
    catch (e) {
        if (e instanceof ApiError && e.status === 401) {
            setAuthenticated(false);
            setAgenda(null);
        }
        setError((e as Error).message);
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { if (!authenticated)
        return; let active = true; Promise.resolve().then(() => { if (!active)
        return; setLoading(true); setError(""); setAgenda(null); return api<Agenda>("dueno/agenda", { fecha: date }).then(r => { if (active)
        setAgenda(r); }).catch(e => { if (active) {
        setError(e.message);
        if (e.status === 401) {
            setAuthenticated(false);
            setAgenda(null);
        }
    } }).finally(() => { if (active)
        setLoading(false); }); }); return () => { active = false; }; }, [date, authenticated]);
    async function login(e: React.FormEvent) { e.preventDefault(); if (!code) {
        setError("Escribe el código privado del dueño.");
        codeRef.current?.focus();
        return;
    } setBusy(true); setError(""); try {
        await ensureSession(true);
        await coordinated(() => api("dueno/acceder", { codigo: code }));
        setCode("");
        setAuthenticated(true);
    }
    catch (e) {
        setError((e as Error).message);
        codeRef.current?.focus();
    }
    finally {
        setBusy(false);
    } }
    async function logout() { setBusy(true); try {
        await api("sesion/salir", {});
        resetPrivateMemory();
        setAuthenticated(false);
        setAgenda(null);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <main id="contenido" tabIndex={-1} className={`page-width interior owner-page ${!authenticated ? "compact-flow" : ""}`}><div className="flow-heading"><h1>La agenda del oficio.</h1><p>Acceso privado del dueño</p></div>{error && <div id="owner-access-error"><Notice retry={() => authenticated ? loadAgenda() : setRetry(n => n + 1)}>{error}</Notice></div>}{loading && !authenticated ? <Notice kind="status">Comprobando acceso privado…</Notice> : available === false ? <Notice kind="status">El acceso del dueño no está disponible. No hay un código de acceso configurado.</Notice> : !authenticated && <form className="access-form" onSubmit={login} noValidate><h2>Bienvenido a tu agenda.</h2><p>Consulta la jornada y organiza la atención de cada barbero con tu código privado.</p><div className="field"><label htmlFor="owner-code">Código del dueño</label><input ref={codeRef} id="owner-code" type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} disabled={busy} aria-invalid={!!error} aria-describedby={error ? "owner-access-error" : undefined}/></div><button type="submit" className="button" disabled={busy}>{busy ? "Accediendo…" : "Acceder a la agenda"}</button></form>}{authenticated && <><div className="owner-toolbar"><div className="field"><label htmlFor="agenda-date">Fecha de la agenda</label><input id="agenda-date" type="date" value={date} onChange={e => setDate(e.target.value)}/></div><button className="text-button" onClick={loadAgenda} disabled={loading}><RefreshCw size={16}/>Actualizar agenda</button><button className="text-button" onClick={logout} disabled={busy}>Cerrar sesión</button></div>{loading ? <Notice kind="status">Consultando la agenda del día…</Notice> : agenda && <><p className="small">{dayLabel(`${date}T12:00:00Z`)} · {agenda.jornada?.cerrado ? "Jornada cerrada" : agenda.jornada ? `${agenda.jornada.abre}–${agenda.jornada.cierra}` : "Jornada consultada"} · Hora de Bogotá</p><nav className="barber-navigation" aria-label="Ir a la agenda de un barbero">{agenda.barberos.map(b => <a key={b.id} href={`#agenda-${b.id}`} onClick={event => { event.preventDefault(); const heading = document.getElementById(`agenda-${b.id}`); window.history.pushState({}, "", `#agenda-${b.id}`); heading?.focus(); }}><span>{b.nombre}</span><span>{b.citas.filter(isActionable).length} por atender</span></a>)}</nav><div className="agenda-counts" aria-label="Resumen de estados">{["reservada", "en atención", "completada", "cancelada", "no asistió"].map(state => <span key={state}><strong>{agenda.barberos.flatMap(b => b.citas).filter(c => c.estado === state).length}</strong> {state}</span>)}</div><div className="owner-groups">{agenda.barberos.map(b => <section className="owner-group" key={b.id}><h2 id={`agenda-${b.id}`} tabIndex={-1}>{b.nombre}</h2>{b.citas.length ? <>{b.citas.filter(isActionable).length ? b.citas.filter(isActionable).map(c => <AgendaEntry key={`${c.id}-${c.version}`} cita={c} refresh={loadAgenda} onExpire={() => { setAuthenticated(false); setAgenda(null); }}/>) : <p className="owner-empty">Sin citas por atender.</p>}{b.citas.some(c => !isActionable(c)) && <details className="closed-appointments"><summary>Citas finalizadas <span>{b.citas.filter(c => !isActionable(c)).length}</span><small>Canceladas, completadas y ausencias</small></summary>{b.citas.filter(c => !isActionable(c)).map(c => <AgendaEntry key={`${c.id}-${c.version}`} cita={c} refresh={loadAgenda} onExpire={() => { setAuthenticated(false); setAgenda(null); }}/>)}</details>}</> : <p className="owner-empty">Sin citas para este día.</p>}</section>)}</div></>}</>}</main>;
}
function isActionable(cita: Appointment) { return cita.estado === "reservada" || cita.estado === "en atención"; }
function AgendaEntry({ cita, refresh, onExpire }: {
    cita: Appointment;
    refresh: () => Promise<void>;
    onExpire: () => void;
}) {
    const [state, setState] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [uncertain, setUncertain] = useState(false);
    useEffect(() => { queueMicrotask(() => { const op = readOperation(); if (op?.operacion === "estado-cita" && op.payload.id === cita.id)
        setUncertain(true); }); }, [cita.id]);
    const now = useClock(), start = new Date(cita.inicioUtc).getTime(), end = new Date(cita.finUtc).getTime();
    const options = cita.estado === "reservada" ? [{ value: "en atención", enabled: now >= start && now < end }, { value: "cancelada", enabled: true }, { value: "no asistió", enabled: now >= end }] : cita.estado === "en atención" ? [{ value: "completada", enabled: now >= end }] : [];
    async function update() { if (!options.some(o => o.value === state && o.enabled)) {
        setMessage("Ese cambio no está disponible para el horario y estado actual.");
        return;
    } setBusy(true); setMessage(""); try {
        const op = prepareOperation("estado-cita", { id: cita.id, version: cita.version, estado: state });
        try {
            await coordinated(() => api("dueno/estado-cita", { ...op.payload, clave: op.clave }));
            clearOperation();
            await refresh();
        }
        catch (e) {
            if (e instanceof ApiError && e.status >= 400 && e.status < 500)
                clearOperation();
            else
                setUncertain(true);
            if (e instanceof ApiError && e.status === 401)
                onExpire();
            throw e;
        }
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function recover() { setBusy(true); try {
        const op = readOperation();
        if (!op)
            throw new Error("No hay una operación pendiente.");
        const result = await api<{
            estado: string;
        }>("reservas/recuperar", op);
        if (result.estado === "guardada") {
            clearOperation();
            setUncertain(false);
            await refresh();
        }
        else {
            setMessage("Aún no hay resultado. Reintenta exactamente el cambio original.");
        }
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    async function retryOriginal() { const op = readOperation(); if (!op)
        return; setBusy(true); try {
        await coordinated(() => api("dueno/estado-cita", { ...op.payload, clave: op.clave }));
        clearOperation();
        setUncertain(false);
        await refresh();
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <article className="agenda-entry"><div className="agenda-identity"><span className="agenda-time">{time(cita.inicioUtc)}–{time(cita.finUtc)}</span><h3>{cita.servicioNombre}</h3><p>{cita.nombre}</p><p>{cita.celular}</p></div><div className="agenda-state"><span className="state-tag">{cita.estado}</span>{options.length > 0 && <div className="state-editor"><label className="sr-only" htmlFor={`state-${cita.id}`}>Nuevo estado de la cita de {cita.nombre}</label><select id={`state-${cita.id}`} value={state} onChange={e => setState(e.target.value)} disabled={busy || uncertain}><option value="">Cambiar estado</option>{options.map(o => <option value={o.value} disabled={!o.enabled} key={o.value}>{o.value}{!o.enabled ? " · Aún no disponible" : ""}</option>)}</select>{state && <button type="button" className="button secondary" onClick={update} disabled={!state || busy || uncertain}>{busy ? "Guardando…" : "Guardar estado"}</button>}</div>}{message && <p role="alert">{message}</p>}{uncertain && <><button className="text-button" onClick={recover} disabled={busy}>Recuperar resultado original</button><button className="text-button" onClick={retryOriginal} disabled={busy}>Reintentar intención original</button></>}</div><AgendaHistory cita={cita} onExpire={onExpire}/></article>;
}

function AgendaHistory({ cita, onExpire }: { cita: Appointment; onExpire: () => void }) {
    const [history, setHistory] = useState<History[] | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    async function load() {
        setLoading(true); setError(""); setHistory(null);
        try {
            const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(cita.inicioUtc));
            const result = await api<Agenda>("dueno/agenda", { fecha });
            const current = result.barberos.flatMap(barber => barber.citas).find(item => item.id === cita.id);
            if (!current) throw new Error("La cita cambió de jornada. Actualiza la agenda para consultar su historial.");
            if (mounted.current) setHistory(current.historial);
        }
        catch (error) { if (mounted.current) { setError((error as Error).message); if (error instanceof ApiError && error.status === 401) onExpire(); } }
        finally { if (mounted.current) setLoading(false); }
    }
    return <details className="agenda-history" onToggle={e => { if (e.currentTarget.open && !history && !loading && !error) void load(); }}><summary>Historial de esta cita</summary>{loading ? <p role="status">Consultando historial…</p> : error ? <Notice retry={load}>{error}</Notice> : history && <ol>{history.map(item => <li key={item.id}><strong>{({ crear: "Reserva creada", cancelar: "Cita cancelada", reprogramar: "Horario actualizado", "regenerar-codigo": "Código renovado", "estado-cita": "Estado actualizado" } as Record<string, string>)[item.accion] || item.accion.replaceAll("-", " ")}</strong><br/>{dayLabel(item.fecha)}, {time(item.fecha)} · {item.actor}<br/>{item.estadoNuevo} · versión {item.versionNueva}</li>)}</ol>}</details>;
}
