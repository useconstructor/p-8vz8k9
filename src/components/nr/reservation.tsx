"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Copy, ArrowRight } from "lucide-react";
import { api, ApiError, type Revision, type Appointment, type Operation, dayLabel, time, money, readDraft, storeDraft, readOperation, prepareOperation, sendOperation, recoverOperation, currentSaved, rememberSaved, ensureSession, archiveOperation, archivedOperations, recoverArchived, retainReviewFailure } from "@/lib/client/booking";
import { Mirror } from "./art";
import { Notice } from "./shell";
export function Specification({ value }: {
    value: Omit<Revision, "fecha">;
}) { return <dl className="specification"><div className="spec-main"><dt>Servicio</dt><dd>{value.servicioNombre}</dd></div><div className="spec-barber"><dt>Barbero</dt><dd>{value.barberoNombre}</dd></div><div className="spec-date"><dt>Fecha · Bogotá</dt><dd>{dayLabel(value.inicioUtc)}</dd></div><div className="spec-time"><dt>Intervalo · Bogotá</dt><dd>{time(value.inicioUtc)}–{time(value.finUtc)}</dd></div><div className="spec-price"><dt>Duración y precio</dt><dd>{value.duracionMin} min · {money(value.precioCop)}</dd></div><div className="spec-client"><dt>Cliente</dt><dd>{value.nombre}</dd></div><div className="spec-phone"><dt>Celular</dt><dd>{value.celular}</dd></div></dl>; }

export function VersionDetails({ value }: {
    value: Revision | Appointment;
}) { return <details className="version-details"><summary>Versiones de la reserva y su referencia</summary><dl>{"version" in value && <><dt>Versión de la cita</dt><dd>{value.version}</dd></>}<dt>Servicio</dt><dd>{value.servicioVersion}</dd><dt>Barbero</dt><dd>{value.barberoVersion}</dd><dt>Catálogo</dt><dd>{value.catalogRevision}</dd><dt>Referencia visual</dt><dd data-illustration-id={value.ilustracionId}>{value.servicioNombre} · versión {value.presentacionVersion}</dd></dl></details>; }
export function useDurable(onSaved: (result: {
    cita: Appointment;
    codigo?: string;
}) => void) { const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [pending, setPending] = useState<Operation | null>(null), [absent, setAbsent] = useState(false), [current, setCurrent] = useState<Appointment | null>(null), [archived, setArchived] = useState<Operation[]>([]); const saved = useRef(onSaved); useEffect(() => { saved.current = onSaved; }, [onSaved]); useEffect(() => { queueMicrotask(() => { setPending(readOperation()); setArchived(archivedOperations()); }); }, []); async function execute(op: Operation) { setBusy(true); setMessage(""); setAbsent(false); try {
    const result = await sendOperation<{
        cita: Appointment;
        codigo?: string;
    }>(op);
    setPending(null);
    saved.current(result);
}
catch (e) {
    setPending(readOperation());
    setMessage(readOperation() ? `No pudimos confirmar el resultado. ${(e as Error).message}` : (e as Error).message);
    if (e instanceof ApiError && e.current)
        setCurrent(e.current as Appointment);
}
finally {
    setBusy(false);
} } async function begin(operation: string, payload: Record<string, unknown>) { try {
    await execute(prepareOperation(operation, payload));
}
catch (e) {
    setMessage((e as Error).message);
    setPending(readOperation());
} } async function recover() { setBusy(true); setMessage(""); try {
    const result = await recoverOperation();
    if (result.estado === "guardada" && result.cita) {
        setPending(null);
        saved.current({ cita: result.cita });
    }
    else {
        setAbsent(true);
        setMessage("Aún no se encontró un resultado guardado. Puedes consultar otra vez o reenviar exactamente la intención original.");
    }
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } async function startNew() { archiveOperation(); setPending(null); setArchived(archivedOperations()); setMessage("La intención original sigue disponible para consultar. Edita y revisa explícitamente la nueva selección; recibirá otra clave al enviarse."); } async function recoverPrevious(op: Operation) { setBusy(true); try {
    const result = await recoverArchived(op);
    setArchived(archivedOperations());
    if (result.estado === "guardada" && result.cita)
        saved.current({ cita: result.cita });
    else
        setMessage("La intención anterior aún no tiene un resultado confirmado. Su consulta sigue disponible.");
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} } return { busy, message, pending, absent, current, archived, startNew, recoverPrevious, begin, recover, retry: () => pending ? execute(pending) : Promise.resolve(), setMessage }; }
export function Recovery({ mutation }: {
    mutation: ReturnType<typeof useDurable>;
}) { return <>{mutation.message && !mutation.pending && <Notice>{mutation.message}</Notice>}{mutation.pending && <div className="uncertain-result" role="alert"><p role="status"><strong>Resultado pendiente de confirmar.</strong></p><p>Tu solicitud original está pendiente de confirmar. Recupera su resultado antes de reservar de nuevo.</p>{mutation.message && <details className="recovery-detail"><summary>Detalle de la consulta</summary><p>{mutation.message}</p></details>}<div className="session-tools"><button type="button" className="button" onClick={mutation.recover} disabled={mutation.busy}>{typeof window !== "undefined" && window.location.pathname === "/reservar" ? "Recuperar solicitud original" : "Recuperar resultado original"}</button>{mutation.absent && <button type="button" className="button secondary" onClick={mutation.retry} disabled={mutation.busy}>Reintentar intención original</button>}<button type="button" className="text-button" onClick={mutation.startNew} disabled={mutation.busy}>Iniciar otra solicitud</button></div></div>}{mutation.archived.length > 0 && <Notice kind="status"><p>Hay intenciones anteriores cuyo resultado todavía puedes consultar. Podrían haberse guardado aunque no recibieras la respuesta.</p>{mutation.archived.map((op, i) => <button className="text-button" type="button" key={op.clave} disabled={mutation.busy} onClick={() => mutation.recoverPrevious(op)}>{i === 0 ? "Recuperar solicitud original" : `Recuperar solicitud anterior ${i + 1}`}</button>)}</Notice>}{mutation.current?.id && <Notice>La cita ha cambiado en otra vista. Estado actual: {mutation.current.estado}, versión {mutation.current.version}. Actualiza la cita antes de volver a intentar.</Notice>}</>; }
export function ReviewPage() { const router = useRouter(), [revision, setRevision] = useState<Revision | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [stale, setStale] = useState<Revision | null>(null), [retry, setRetry] = useState(0), [ready, setReady] = useState(false); const mutation = useDurable(result => { rememberSaved(result.cita, result.codigo); router.push("/reserva/confirmacion"); }); const [mountedPreview, setMountedPreview] = useState(false); useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; const stored = readDraft(); if (stored?.revision) setRevision(stored.revision); setMountedPreview(true); }); return () => { active = false; }; }, []); useEffect(() => { let active = true; Promise.resolve().then(() => { if (!active)
    return; if (!mountedPreview) return; const stored = readDraft(); const op = readOperation(); if (op?.operacion === "crear") {
    setRevision(op.payload.revision as Revision);
    setLoading(false);
    return;
} if (!stored?.revision) {
    setLoading(false);
    return;
} setRevision(stored.revision); setLoading(true); setReady(false); setError(""); ensureSession().then(() => api<{
    revision: Revision;
}>("reservas/revisar", { ...stored.draft, catalogRevision: stored.revision!.catalogRevision })).then(result => { if (active) {
    setRevision(result.revision);
    storeDraft(stored.draft, result.revision);
    setReady(true);
} }).catch(e => { if (active) {
    setError(e.message);
    if (e instanceof ApiError) { retainReviewFailure(e); router.replace("/reservar"); }
} }).finally(() => { if (active)
    setLoading(false); }); }); return () => { active = false; }; }, [retry, mountedPreview, router]); async function acceptStale() { if (!stale)
    return; const stored = readDraft(); if (!stored)
    return; storeDraft(stored.draft, stale); setStale(null); setRetry(n => n + 1); } return <main id="contenido" tabIndex={-1} className="page-width interior flow-page compact-flow"><div className="flow-heading"><h1>Revisa tu cita.</h1></div>{loading && <Notice kind="status">Revalidando tu selección con la disponibilidad actual…</Notice>}{error && <Notice retry={() => setRetry(n => n + 1)}>{error}</Notice>}{!revision && !loading ? <div className="recovery-frame"><div className="recovery-message"><p>Necesitas una selección válida para revisar la cita.</p></div><div className="recovery-edge"><Link href="/reservar" className="text-link">Volver a Reservar</Link></div></div> : revision && <div className="review-layout"><Mirror compact service={revision}><div className={`review-spec ${mutation.pending ? "review-pending" : ""}`}><Specification value={revision}/><div className="commit-region">{mutation.pending ? <><Recovery mutation={mutation}/><Link href="/reservar" className="text-link">Editar selección</Link></> : <><button className="button" disabled={!ready || loading || mutation.busy || !!mutation.pending || !!stale} onClick={() => mutation.begin("crear", { revision })}>{mutation.busy ? "Guardando…" : "Reservar cita de ejemplo"}<ArrowRight size={18}/></button><Link href="/reservar" className="text-link">Editar selección</Link><p className="small">No representa atención real ni pago.</p></>}</div></div></Mirror></div>}{stale && <div className="receipt-tools"><Notice>Los datos han cambiado. Revisa la selección actual antes de confirmarla.</Notice><h2>Datos actuales</h2><Specification value={stale}/><button className="button secondary" onClick={acceptStale}>Aceptar datos actuales y revisar de nuevo</button></div>}{!mutation.pending && <div className="receipt-tools"><Recovery mutation={mutation}/></div>}</main>; }
export function CodeTools({ appointment, code, onRegenerate }: {
    appointment: Appointment;
    code: string;
    onRegenerate: (cita: Appointment, codigo: string) => void;
}) { const [copy, setCopy] = useState(""), input = useRef<HTMLInputElement>(null); const mutation = useDurable(result => { onRegenerate(result.cita, result.codigo || ""); setCopy(result.codigo ? "Nuevo código generado. El anterior ya no permite acceso." : "El resultado se recuperó sin código. Puedes generar uno nuevo explícitamente."); }); async function copyCode() { try {
    if (!navigator.clipboard)
        throw Error();
    await navigator.clipboard.writeText(code);
    setCopy("Código copiado.");
}
catch {
    setCopy("No se pudo copiar. Selecciona el código y cópialo manualmente.");
    input.current?.focus();
    input.current?.select();
} } return <div className="code-panel">{code ? <><label htmlFor="reservation-code">Tu código de reserva</label><input id="reservation-code" ref={input} value={code} readOnly aria-describedby="code-help"/><button className="button secondary" type="button" onClick={copyCode}><Copy size={17}/>Copiar código</button><p id="code-help">Conserva el código en un lugar privado. Permite consultar y gestionar esta cita.</p></> : <><p>Puedes gestionar tu cita desde aquí. Si necesitas otro código, genera uno nuevo; el anterior dejará de funcionar.</p><button className="button secondary" disabled={mutation.busy || !!mutation.pending} onClick={() => mutation.begin("regenerar-codigo", { id: appointment.id, version: appointment.version })}>Generar nuevo código</button></>}{copy && <p role="status">{copy}</p>}<div className="wide"><Recovery mutation={mutation}/></div></div>; }
export function ConfirmationPage() { const [cita, setCita] = useState<Appointment | null>(null), [code, setCode] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState(""), [needsAccess, setNeedsAccess] = useState(false), [retry, setRetry] = useState(0); useEffect(() => { let active = true; Promise.resolve().then(() => { if (!active)
    return; setLoading(true); setError(""); setNeedsAccess(false); const saved = currentSaved(); api<{
    cita?: Appointment;
    citas?: Appointment[];
}>("reservas/consultar", saved.id ? { id: saved.id } : {}).then(result => { if (active) {
    const found = result.cita || result.citas?.slice().sort((a, b) => b.creadaEn.localeCompare(a.creadaEn))[0];
    if (!found) { setCita(null); setCode(""); setNeedsAccess(true); return; }
    setCita(found);
    setCode(saved.id === found.id ? saved.codigo : "");
} }).catch(e => { if (active) { setCita(null); setCode(""); if (e instanceof ApiError && [401, 403].includes(e.status)) setNeedsAccess(true); else setError(e.message); } }).finally(() => { if (active)
    setLoading(false); }); }); return () => { active = false; }; }, [retry]); return <main id="contenido" tabIndex={-1} className="page-width interior flow-page compact-flow"><div className="flow-heading"><h1>{cita && !loading && !error ? "Un momento reservado." : "Consulta tu reserva."}</h1><p>Confirmación</p></div>{loading ? <Notice kind="status">Consultando la cita guardada…</Notice> : needsAccess ? <div className="recovery-frame"><div className="recovery-message"><p>Introduce tu código de reserva para consultar la cita guardada.</p></div><div className="recovery-edge"><Link href="/mi-cita" className="button">Acceder con mi código</Link></div></div> : error ? <div className="recovery-frame"><div className="recovery-message"><Notice retry={() => setRetry(n => n + 1)}>{error}</Notice></div><div className="recovery-edge"><Link href="/mi-cita" className="text-link">Acceder con mi código</Link></div></div> : cita && <><div className="saved-layout"><Mirror compact service={cita} outcome={<><h2 className="saved-heading">Cita de ejemplo guardada</h2><span className="state-tag">{cita.estado}</span></>}><div className="review-spec"><Specification value={cita}/><p className="small">No representa atención real ni pago.</p></div></Mirror></div><div className="management-actions"><Link className="button" href="/mi-cita">Gestionar mi cita <ArrowRight size={18}/></Link><Link className="button secondary" href="/">Volver al inicio</Link></div><div className="receipt-tools"><CodeTools appointment={cita} code={code} onRegenerate={(c, codigo) => { setCita(c); setCode(codigo); rememberSaved(c, codigo); }}/><VersionDetails value={cita}/></div></>}</main>; }
