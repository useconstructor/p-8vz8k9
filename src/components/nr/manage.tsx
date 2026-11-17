"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RefreshCw, ArrowRight } from "lucide-react";
import { api, ApiError, type Appointment, type Revision, type History, ensureSession, currentSaved, rememberSaved, dayLabel, time, resetPrivateMemory, useClock, readDraft, clearEdit } from "@/lib/client/booking";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mirror } from "./art";
import { Notice, trapTab } from "./shell";
import { BookingForm } from "./booking-form";
import { Specification, VersionDetails, CodeTools, useDurable, Recovery } from "./reservation";
export function ManagePage() {
    const [cita, setCita] = useState<Appointment | null>(null), [list, setList] = useState<Appointment[]>([]), [history, setHistory] = useState<History[]>([]), [loading, setLoading] = useState(true), [authorized, setAuthorized] = useState(false), [error, setError] = useState(""), [code, setCode] = useState(""), [accessBusy, setAccessBusy] = useState(false), [accessError, setAccessError] = useState(""), [cancelOpen, setCancelOpen] = useState(false), [editing, setEditing] = useState(false), [proposal, setProposal] = useState<Revision | null>(null), [delivered, setDelivered] = useState(""), [editDraft, setEditDraft] = useState<Revision | null>(null), [focusTick, setFocusTick] = useState(0);
    const codeRef = useRef<HTMLInputElement>(null), dialogRef = useRef<HTMLDivElement>(null), dialogCancelRef = useRef<HTMLButtonElement>(null), changeHeading = useRef<HTMLHeadingElement>(null);
    const reads = useRef({ version: 0 });
    const [accessFocusTick, setAccessFocusTick] = useState(0);
    useLayoutEffect(() => {
        if (accessError && !accessBusy && codeRef.current) {
            codeRef.current.focus({ preventScroll: true });
            codeRef.current.scrollIntoView({ behavior: "instant", block: "center" });
        }
    }, [accessError, accessBusy, accessFocusTick]);
    async function load(id?: string) { const version = ++reads.current.version; setLoading(true); setError(""); try {
        const result = await api<{
            cita?: Appointment;
            citas?: Appointment[];
            historial?: History[];
        }>("reservas/consultar", id ? { id } : {});
        if (version !== reads.current.version) return;
        setAuthorized(true);
        if (result.cita) {
            setCita(result.cita);
            setHistory(result.historial || []);
        }
        else {
            setList(result.citas || []);
            const saved = currentSaved();
            const owned = result.citas?.find(c => c.id === saved.id) || (result.citas?.length === 1 ? result.citas[0] : null);
            if (owned) {
                const detail = await api<{
                    cita: Appointment;
                    historial: History[];
                }>("reservas/consultar", { id: owned.id });
                if (version !== reads.current.version) return;
                setCita(detail.cita);
                setHistory(detail.historial);
                const retained = readDraft()?.edit;
                if (retained?.id === detail.cita.id) {
                    setEditing(true);
                    if (retained.revision) {
                        setProposal(retained.revision);
                        setEditDraft(retained.revision);
                    }
                }
                setDelivered(saved.id === owned.id ? saved.codigo : "");
            }
            else {
                setCita(null);
                setHistory([]);
                setDelivered("");
                setEditing(false);
                setProposal(null);
                setEditDraft(null);
            }
        }
    }
    catch (e) {
        if (version !== reads.current.version) return;
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            setAuthorized(false);
            setEditing(false);
            setProposal(null);
            setEditDraft(null);
            setCita(null);
            setList([]);
            setHistory([]);
            setDelivered("");
        }
        else
            setError((e as Error).message);
    }
    finally {
        if (version === reads.current.version) setLoading(false);
    } }
    useEffect(() => {
        const currentReads = reads.current;
        let active = true;
        void Promise.resolve().then(() => { if (active) return load(); });
        return () => { active = false; currentReads.version++; };
    }, []);
    useLayoutEffect(() => { if (editing)
        changeHeading.current?.focus(); }, [editing, focusTick]);
    const mutation = useDurable(result => { rememberSaved(result.cita); setCita(result.cita); setCancelOpen(false); setEditing(false); setProposal(null); setEditDraft(null); clearEdit(); void load(result.cita.id); });
    async function access(e: React.FormEvent) { e.preventDefault(); setAccessError(""); if (!code) {
        setAccessError("Escribe tu código de reserva.");
        setAccessFocusTick(n => n + 1);
        return;
    } setAccessBusy(true); try {
        await ensureSession(true);
        const result = await api<{
            cita: Appointment;
        }>("reservas/acceder", { codigo: code });
        setCode("");
        setCita(result.cita);
        setAuthorized(true);
        await load(result.cita.id);
    }
    catch (e) {
        setAccessError((e as Error).message);
        setAccessFocusTick(n => n + 1);
    }
    finally {
        setAccessBusy(false);
    } }
    async function logout() { ++reads.current.version; setLoading(false); setAccessBusy(true); try {
        await api("sesion/salir", {});
        resetPrivateMemory();
        setEditing(false);
        setProposal(null);
        setEditDraft(null);
        setCita(null);
        setList([]);
        setHistory([]);
        setAuthorized(false);
        setDelivered("");
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setAccessBusy(false);
    } }
    const now = useClock();
    const canEdit = cita?.estado === "reservada" && new Date(cita.inicioUtc).getTime() > now;
    return <main id="contenido" tabIndex={-1} className="page-width interior flow-page compact-flow"><div className="flow-heading"><h1>Tu cita, en tus manos.</h1><p>Gestión privada</p></div>{loading && <Notice kind="status">Consultando tus citas…</Notice>}{error && <Notice retry={() => load(cita?.id)}>{error}</Notice>}{!loading && !authorized && <form className="access-form" onSubmit={access} noValidate><h2>Accede con tu código.</h2><p>Introduce tu código para consultar, reprogramar o cancelar la cita. Consérvalo en un lugar privado.</p><div className="field"><label htmlFor="access-code">Código de reserva</label><input id="access-code" ref={codeRef} type="password" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} aria-invalid={!!accessError} aria-describedby={accessError ? "access-error" : undefined} disabled={accessBusy}/></div>{accessError && <p id="access-error" className="field-error" role="alert">{accessError}</p>}<button className="button" disabled={accessBusy}>{accessBusy ? "Consultando…" : "Consultar mi cita"}<ArrowRight size={18}/></button><Link href="/reservar" className="text-link">Crear una reserva de ejemplo</Link></form>}{authorized && !cita && !loading && !error && <><h2>Tus citas autorizadas</h2>{!list.length ? <Notice kind="status">Aún no hay citas en esta sesión.<Link href="/reservar" className="text-link">Reservar una cita de ejemplo</Link></Notice> : <div className="appointment-list">{list.map(c => <button className="appointment-choice" key={c.id} onClick={() => load(c.id)}><span>{c.servicioNombre}<br />{dayLabel(c.inicioUtc)} · {time(c.inicioUtc)}</span><span>{c.estado}<ArrowRight size={20}/></span></button>)}</div>}</>}{authorized && cita && !loading && !error && <><div className="saved-layout"><Mirror compact service={cita} outcome={<div className="current-heading"><h2>{cita.estado === "cancelada" ? "Cita cancelada" : cita.estado === "reservada" ? "Cita vigente" : "Tu cita guardada"}</h2><span className="state-tag">{cita.estado}</span>{!canEdit && <p className="small">Esta cita ya no admite reprogramación ni cancelación desde la gestión del visitante.</p>}</div>}><div className="review-spec"><Specification value={cita}/><div className="management-actions">{canEdit && <><button type="button" className="button secondary" disabled={!canEdit || mutation.busy || !!mutation.pending} onClick={() => { setEditing(true); setProposal(null); setFocusTick(n => n + 1); }}>Reprogramar</button><Dialog open={cancelOpen} onOpenChange={value => { if (!mutation.busy)
        setCancelOpen(value); }}><DialogTrigger className="button secondary" disabled={!canEdit || mutation.busy || !!mutation.pending}>Cancelar cita</DialogTrigger><DialogContent ref={dialogRef} className="nr-dialog" showCloseButton={false} initialFocus={dialogCancelRef} onKeyDown={e => trapTab(e, dialogRef.current)}><DialogTitle>¿Cancelar esta cita?</DialogTitle><DialogDescription>Se cancelará tu reserva de {cita.servicioNombre} con {cita.barberoNombre}, el {dayLabel(cita.inicioUtc)} a las {time(cita.inicioUtc)}. La cita y su historial se conservarán.</DialogDescription><div className="dialog-actions"><button ref={dialogCancelRef} type="button" className="button secondary" disabled={mutation.busy} onClick={() => setCancelOpen(false)}>Volver sin cambios</button><button type="button" className="button" disabled={mutation.busy || !!mutation.pending} onClick={() => mutation.begin("cancelar", { id: cita.id, version: cita.version })}>{mutation.busy ? "Cancelando…" : "Confirmar cancelación"}</button></div><Recovery mutation={mutation}/></DialogContent></Dialog></>}<button type="button" className="text-button" disabled={loading || mutation.busy} onClick={() => load(cita.id)}><RefreshCw size={16}/>Actualizar mi cita</button></div></div></Mirror></div>{!cancelOpen && <div className="receipt-tools"><Recovery mutation={mutation}/></div>}{editing && <section className="change-proposal" aria-labelledby="change-title"><h2 id="change-title" ref={changeHeading} tabIndex={-1}>Propuesta de nuevo horario</h2><p className="small">La cita vigente se mantiene hasta guardar esta propuesta.</p>{!proposal ? <BookingForm appointment={cita} initialDraft={editDraft || undefined} onReview={r => { setProposal(r); setEditDraft(r); }}/> : <><div className="review-layout"><Mirror compact service={proposal}><div className="review-spec"><h3>Tu propuesta</h3><Specification value={proposal}/><button className="button" disabled={mutation.busy || !!mutation.pending} onClick={() => mutation.begin("reprogramar", { id: cita.id, version: cita.version, revision: proposal })}>{mutation.busy ? "Guardando…" : "Guardar reprogramación"}</button><button type="button" className="text-button" onClick={() => setProposal(null)} disabled={mutation.busy}>Editar propuesta</button></div></Mirror></div></>}<button type="button" className="text-button" disabled={mutation.busy} onClick={() => { setEditing(false); setProposal(null); setEditDraft(null); clearEdit(); }}>Volver sin cambios</button></section>}<CodeTools appointment={cita} code={delivered} onRegenerate={(value, codigo) => { setCita(value); setDelivered(codigo); rememberSaved(value, codigo); void load(value.id); }}/><VersionDetails value={cita}/><section className="history"><h2>Historial de tu cita</h2><ol>{history.map(h => <li key={h.id}><strong>{{ crear: "Reserva creada", cancelar: "Cita cancelada", reprogramar: "Horario actualizado", "regenerar-codigo": "Código de acceso renovado", "estado-cita": "Estado actualizado" }[h.accion] || h.accion.replaceAll("-", " ")}</strong> · {dayLabel(h.fecha)}, {time(h.fecha)} · {h.actor}<br />{h.estadoNuevo} · versión {h.versionNueva}{h.accion === "reprogramar" && h.anterior && h.actual && <><p>Antes: {dayLabel(h.anterior.inicioUtc)}, {time(h.anterior.inicioUtc)}–{time(h.anterior.finUtc)}</p><p>Ahora: {dayLabel(h.actual.inicioUtc)}, {time(h.actual.inicioUtc)}–{time(h.actual.finUtc)}</p></>}{h.actual && <HistorySnapshot movement={h}/>}</li>)}</ol>{!history.length && <p>No hay movimientos disponibles.</p>}</section></>}{authorized && <div className="session-tools"><button className="text-button" onClick={logout} disabled={accessBusy || mutation.busy}>Cerrar sesión</button><Link href="/" className="text-link">Volver al inicio</Link></div>}</main>;
}

function HistorySnapshot({ movement }: { movement: History }) {
    const [open, setOpen] = useState(false);
    return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Datos guardados de este movimiento</summary>{open && <>{movement.anterior && <><h3>Antes · versión {movement.versionPrevia}</h3><Specification value={movement.anterior}/></>}{movement.actual && <><h3>Después · versión {movement.versionNueva}</h3><Specification value={movement.actual}/></>}</>}</details>;
}
