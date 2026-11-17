"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RefreshCw } from "lucide-react";
import { api, ApiError, useCatalog, type Draft, type Revision, type Appointment, type Availability, type Service, readDraft, storeDraft, storeEdit, today, ensureSession, readOperation, money, dayLabel, consumeReviewFailure, rememberSaved } from "@/lib/client/booking";
import { Mirror } from "./art";
import { ServiceEdge } from "./public-pages";
import { Notice } from "./shell";
import { Recovery, useDurable } from "./reservation";
const emptyDraft = (): Draft => ({ servicioId: "", barberoId: "", fecha: today(), inicioUtc: "", nombre: "", celular: "" });
export function BookingPage() { return <main id="contenido" tabIndex={-1} className="page-width interior flow-page"><div className="flow-heading"><h1>Tu momento, a tu medida.</h1><p>Reserva de ejemplo · Hora de Bogotá</p></div><BookingForm /></main>; }
export function BookingForm({ appointment, initialDraft, onReview }: {
    appointment?: Appointment;
    initialDraft?: Draft;
    onReview?: (revision: Revision) => void;
}) {
    const catalog = useCatalog(), router = useRouter();
    const mutation = useDurable(result => { rememberSaved(result.cita, result.codigo); router.push("/reserva/confirmacion"); });
    const [draft, setDraft] = useState<Draft>(emptyDraft), [ready, setReady] = useState(false), [errors, setErrors] = useState<Record<string, string>>({}), [focusKey, setFocusKey] = useState({ key: "", tick: 0 }), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [availability, setAvailability] = useState<Availability | null>(null), [availError, setAvailError] = useState(""), [availBusy, setAvailBusy] = useState(false), [retry, setRetry] = useState(0), [stale, setStale] = useState<Revision | null>(null), [sessionFailed, setSessionFailed] = useState(false), [dirty, setDirty] = useState(false);
    const [slotsOpen, setSlotsOpen] = useState(false);
    const noSlots = !availBusy && !availError && !!availability && !availability.slots.length;
    const refs = useRef<Record<string, HTMLElement | null>>({}), initialized = useRef(false);
    const service = catalog.data?.servicios.find(s => s.id === draft.servicioId);
    const validBarber = catalog.data?.barberos.find(b => b.id === draft.barberoId);
    const revision = catalog.data?.catalogRevision;
    const [previousService, setPreviousService] = useState<Service | undefined>();
    const serviceValid = !!service, barberValid = !!validBarber;
    useEffect(() => { if (!catalog.data || initialized.current)
        return; initialized.current = true; const stored = readDraft()?.draft; const query = new URLSearchParams(window.location.search); const d: Draft = appointment ? { ...((initialDraft || readDraft()?.edit?.id === appointment.id && readDraft()?.edit?.draft) || { servicioId: appointment.servicioId, barberoId: appointment.barberoId, fecha: appointment.inicioUtc.slice(0, 10), inicioUtc: appointment.inicioUtc, nombre: appointment.nombre, celular: appointment.celular }) } : stored ? { ...stored } : emptyDraft(); if (!appointment) {
        if (query.has("servicio"))
            d.servicioId = query.get("servicio")!;
        else if (!d.servicioId)
            d.servicioId = "corte";
        if (query.has("barbero"))
            d.barberoId = query.get("barbero")!;
        else if (!d.barberoId)
            d.barberoId = "tomas";
    } setDraft({ servicioId: d.servicioId, barberoId: d.barberoId, fecha: d.fecha, inicioUtc: d.inicioUtc, nombre: d.nombre, celular: d.celular }); setSlotsOpen(Boolean(d.inicioUtc)); setPreviousService(catalog.data.servicios.find(s => s.id === d.servicioId)); setReady(true); const failure = consumeReviewFailure(); if (failure) queueMicrotask(() => { setMessage(failure.message); reject(failure.fields); if (failure.code === "STALE_REVIEW") setStale(failure.current as Revision); }); }, [catalog.data, appointment, initialDraft]);
    useEffect(() => { if (ready) {
        try {
            if (appointment)
                storeEdit(appointment.id, draft);
            else
                storeDraft(draft);
        }
        catch {
            queueMicrotask(() => setMessage("No se puede conservar el borrador en este navegador. Habilita el almacenamiento antes de continuar."));
        }
    } }, [draft, ready, appointment]);
    useEffect(() => { if (!dirty)
        return; const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
    useEffect(() => { let active = true; Promise.resolve().then(() => { if (!active)
        return; if (!ready || !serviceValid || !barberValid || !draft.fecha) {
        setAvailability(null);
        setAvailBusy(false);
        return;
    } setAvailBusy(true); setAvailError(""); setAvailability(null); const p = new URLSearchParams({ servicioId: draft.servicioId, barberoId: draft.barberoId, fecha: draft.fecha }); api<Availability>(`disponibilidad?${p}`).then(d => { if (active)
        setAvailability(d); }).catch(e => { if (active)
        setAvailError(e.message); }).finally(() => { if (active)
        setAvailBusy(false); }); }); return () => { active = false; }; }, [ready, draft.servicioId, draft.barberoId, draft.fecha, revision, serviceValid, barberValid, retry]);
    useLayoutEffect(() => {
        const field = refs.current[focusKey.key];
        if (field) {
            field.focus({ preventScroll: true });
            field.scrollIntoView({ behavior: "instant", block: "center" });
        }
    }, [focusKey]);
    function edit(key: keyof Draft, value: string) { setDirty(true); if (key === "servicioId") {
        const selected = catalog.data?.servicios.find(s => s.id === value);
        if (selected)
            setPreviousService(selected);
    } setDraft(d => ({ ...d, [key]: value })); setErrors(e => ({ ...e, [key]: "" })); setStale(null); setMessage(""); }
    function reject(fields: Record<string, string>) { setErrors(fields); const first = ["servicioId", "barberoId", "fecha", "inicioUtc", "nombre", "celular"].find(k => fields[k]); if (first)
        setFocusKey(v => ({ key: first, tick: v.tick + 1 })); }
    async function submit(e: React.FormEvent) { e.preventDefault(); setMessage(""); setSessionFailed(false); const fields: Record<string, string> = {}; if (!service)
        fields.servicioId = "Elige un servicio válido de la carta."; if (!validBarber || !catalog.data?.habilitaciones.some(h => h.servicioId === draft.servicioId && h.barberoId === draft.barberoId))
        fields.barberoId = "Elige un barbero habilitado para este servicio."; if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.fecha) || draft.fecha < today())
        fields.fecha = "Elige una fecha válida desde hoy."; if (!draft.inicioUtc || !availability?.slots.some(s => s.inicioUtc === draft.inicioUtc))
        fields.inicioUtc = "Elige una de las horas disponibles para esta selección."; if (draft.nombre.length < 2 || draft.nombre.length > 100 || !draft.nombre.trim())
        fields.nombre = "Escribe un nombre de 2 a 100 caracteres."; if (!/^3\d{9}$/.test(draft.celular))
        fields.celular = "Escribe 10 dígitos, comenzando por 3."; if (Object.keys(fields).length) {
        reject(fields);
        setMessage("Revisa los campos indicados. Tu selección sigue aquí.");
        return;
    } if (readOperation()) {
        setMessage("Hay una operación pendiente. Recupera su resultado original desde Revisar reserva antes de enviar otra selección.");
        return;
    } setBusy(true); try {
        await ensureSession();
        const payload = { ...draft, catalogRevision: revision, ...(appointment ? { id: appointment.id, version: appointment.version } : {}) };
        const result = appointment ? await api<{ revision: Revision }>("reservas/revisar-cambio", payload) : { revision: { ...draft, catalogRevision: revision!, finUtc: availability!.slots.find(slot => slot.inicioUtc === draft.inicioUtc)!.finUtc, servicioVersion: service!.version, barberoVersion: validBarber!.version, servicioNombre: service!.nombre, barberoNombre: validBarber!.nombre, duracionMin: service!.duracionMin, precioCop: service!.precioCop, ilustracionId: service!.ilustracionId, presentacionVersion: service!.presentacionVersion } };
        setDirty(false);
        if (onReview) {
            if (appointment)
                storeEdit(appointment.id, draft, result.revision);
            onReview(result.revision);
        }
        else {
            storeDraft(draft, result.revision);
            router.push("/reservar/revisar");
        }
    }
    catch (e) {
        if (e instanceof ApiError) {
            setMessage(e.message);
            if (e.fields)
                reject(e.fields);
            if (e.code === "STALE_REVIEW" && e.current)
                setStale(e.current as Revision);
            if (["SESSION_LOST", "COOKIES_BLOCKED", "UNAUTHORIZED"].includes(e.code) || e.status === 401)
                setSessionFailed(true);
        }
        else
            setMessage("No pudimos revisar la cita. Conservamos tus datos.");
    }
    finally {
        setBusy(false);
    } }
    async function resetSession() { setBusy(true); try {
        await ensureSession(true);
        setSessionFailed(false);
        setMessage("Sesión verificada. Ya puedes revisar la cita.");
    }
    catch (e) {
        setMessage((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    if (catalog.loading && !catalog.data)
        return <Notice kind="status">Cargando servicios y barberos…</Notice>;
    if (catalog.error && !catalog.data)
        return <Notice retry={catalog.retry}>{catalog.error}</Notice>;
    if (!catalog.data?.servicios.length || !catalog.data.barberos.length)
        return <Notice retry={catalog.retry}>No hay servicios o barberos disponibles para reservar.</Notice>;
    // Mount native fields only after URL context and the retained draft agree.
    // A disabled, empty select still exposes the wrong value on arrival.
    if (!ready)
        return <Notice kind="status">Cargando tu selección de servicio y barbero…</Notice>;
    const desc = (key: string) => errors[key] ? `${key}-error` : undefined;
    return <form className="booking-form" onSubmit={submit} noValidate aria-label={appointment ? "Propuesta de reprogramación" : "Configurar cita"} aria-busy={busy}><div className="booking-workstation"><div className="booking-preview"><Mirror compact service={service || previousService} index={Math.max(0, catalog.data.servicios.findIndex(s => s.id === draft.servicioId))}><ServiceEdge service={service || previousService}/></Mirror>{!service && ready && <Notice>La referencia recibida no es válida. Elige un servicio para continuar.</Notice>}</div><div className="booking-fields initial-fields"><div className="field"><label htmlFor="servicioId">Servicio</label><select ref={el => { refs.current.servicioId = el; }} id="servicioId" value={draft.servicioId} onChange={e => edit("servicioId", e.target.value)} disabled={busy || !ready} aria-invalid={!!errors.servicioId} aria-describedby={desc("servicioId")}>{!service && <option value={draft.servicioId}>{draft.servicioId ? "Referencia desconocida" : "Elige servicio"}</option>}{catalog.data.servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select><FieldError field="servicioId" errors={errors}/></div><div className="field"><label htmlFor="barberoId">Barbero</label><select ref={el => { refs.current.barberoId = el; }} id="barberoId" value={draft.barberoId} onChange={e => edit("barberoId", e.target.value)} disabled={busy || !ready} aria-invalid={!!errors.barberoId} aria-describedby={desc("barberoId")}>{!validBarber && <option value={draft.barberoId}>{draft.barberoId ? "Referencia desconocida" : "Elige barbero"}</option>}{catalog.data.barberos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}</select><FieldError field="barberoId" errors={errors}/></div></div><div className="appointment-fields"><div className="field"><label htmlFor="fecha">Fecha</label><input ref={el => { refs.current.fecha = el; }} id="fecha" type="date" value={draft.fecha} min={today()} onChange={e => edit("fecha", e.target.value)} disabled={busy || !ready} aria-invalid={!!errors.fecha} aria-describedby={[desc("fecha"), "fecha-readable"].filter(Boolean).join(" ")}/><FieldError field="fecha" errors={errors}/></div><div className="next-slot" aria-live="polite"><span>Próxima hora disponible</span>{!availBusy && availability?.proximaHora && !slotsOpen ? <button type="button" className="next-time" aria-pressed={draft.inicioUtc === availability.proximaHora.inicioUtc} disabled={busy} onClick={() => edit("inicioUtc", availability.proximaHora!.inicioUtc)}>{availability.proximaHora.hora}<ArrowRight size={16}/></button> : <strong>{availBusy ? "Consultando…" : availError ? "No se pudo consultar" : availability?.proximaHora?.hora || "Sin hora disponible"}</strong>}</div>{draft.fecha && <p className="date-readable" id="fecha-readable">{dayLabel(`${draft.fecha}T12:00:00Z`)}</p>}{noSlots && <div className="empty-slot-actions"><button type="button" className="text-button" onClick={() => setFocusKey({ key: "fecha", tick: Date.now() })}>Elegir otra fecha</button><button type="button" className="text-button" disabled={busy} onClick={() => setRetry(n => n + 1)}>Actualizar disponibilidad</button></div>}</div></div><fieldset className="slot-section" ref={el => { refs.current.inicioUtc = el; }} tabIndex={-1} aria-invalid={!!errors.inicioUtc} aria-describedby={desc("inicioUtc")} disabled={busy}><legend>Hora · Bogotá</legend>{availError ? <Notice retry={() => setRetry(n => n + 1)}>{availError}</Notice> : availBusy ? <p role="status">Consultando todos los horarios…</p> : availability?.slots.length ? <details className="slot-disclosure" open={slotsOpen} onToggle={e => setSlotsOpen(e.currentTarget.open)}><summary>Ver todos los horarios <span>{draft.inicioUtc && availability.slots.find(s => s.inicioUtc === draft.inicioUtc)?.hora ? `Elegida: ${availability.slots.find(s => s.inicioUtc === draft.inicioUtc)!.hora}` : `${availability.slots.length} opciones`}</span></summary><div role="group" aria-label="Horas disponibles">{[{ label: "Mañana", slots: availability.slots.filter(s => s.hora < "12:00") }, { label: "Tarde", slots: availability.slots.filter(s => s.hora >= "12:00") }].filter(group => group.slots.length).map(group => <div className="slot-period" key={group.label}><h3>{group.label}</h3><div className="slots">{group.slots.map(slot => <button className="slot" type="button" key={slot.inicioUtc} aria-pressed={draft.inicioUtc === slot.inicioUtc} onClick={() => edit("inicioUtc", slot.inicioUtc)}>{slot.hora}</button>)}</div></div>)}</div></details> : noSlots ? <p role="status">No hay horas disponibles para esta selección.</p> : null}{draft.inicioUtc && !availability?.slots.some(s => s.inicioUtc === draft.inicioUtc) && !availBusy && <p className="field-error">La hora que habías elegido no está disponible en esta consulta. Elige otra explícitamente.</p>}<FieldError field="inicioUtc" errors={errors}/>{!noSlots && <div className="slot-toolbar">{slotsOpen && draft.inicioUtc && availability?.slots.some(s => s.inicioUtc === draft.inicioUtc) && !appointment && <button type="button" className="text-button" onClick={() => { setSlotsOpen(false); setFocusKey({ key: "nombre", tick: Date.now() }); }}>Continuar con mis datos</button>}<button type="button" className="text-button" disabled={availBusy || busy} onClick={() => setRetry(n => n + 1)}><RefreshCw size={15}/>Actualizar disponibilidad</button></div>}</fieldset><div className="personal-fields"><div className="field"><label htmlFor="nombre">Nombre</label><input ref={el => { refs.current.nombre = el; }} id="nombre" name="nombre" autoComplete="name" value={draft.nombre} onChange={e => edit("nombre", e.target.value)} disabled={busy || !!appointment} aria-invalid={!!errors.nombre} aria-describedby={desc("nombre")}/><FieldError field="nombre" errors={errors}/></div><div className="field"><label htmlFor="celular">Celular</label><input ref={el => { refs.current.celular = el; }} id="celular" name="celular" type="tel" inputMode="tel" autoComplete="tel-national" value={draft.celular} onChange={e => edit("celular", e.target.value)} disabled={busy || !!appointment} aria-invalid={!!errors.celular} aria-describedby={errors.celular ? "celular-error" : "celular-hint"}/><p id="celular-hint" className="hint">10 dígitos, comenzando por 3. Sin espacios.</p><FieldError field="celular" errors={errors}/></div></div>{message && <div className="flow-notice"><Notice>{message}</Notice>{sessionFailed && <button type="button" className="button secondary" onClick={resetSession} disabled={busy}>Restablecer sesión</button>}</div>}{stale && <div className="flow-notice"><Notice>Los datos han cambiado. Tu selección local: {service?.nombre}, {service?.duracionMin} min, {service && money(service.precioCop)}. Datos actuales: {stale.servicioNombre}, {stale.duracionMin} min, {money(stale.precioCop)}.<button type="button" className="text-button" onClick={() => { setStale(null); catalog.retry(); setRetry(n => n + 1); setMessage("Catálogo actualizado. Revisa otra vez tu selección antes de guardar."); }}>Actualizar datos y revisar de nuevo</button></Notice></div>}<div className="flow-notice"><Recovery mutation={mutation}/></div><div className="form-actions"><p>Esta reserva de demostración se guardará al confirmar en el siguiente paso. No implica un pago ni atención real.</p><button type="submit" className="button" disabled={busy || !ready || !!stale}>{busy ? "Revisando…" : appointment ? "Revisar reprogramación" : "Revisar la cita de ejemplo"}<ArrowRight size={18}/></button></div></form>;
}
function FieldError({ field, errors }: {
    field: string;
    errors: Record<string, string>;
}) { return errors[field] ? <p id={`${field}-error`} className="field-error">{errors[field]}</p> : null; }
