"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight, Clock3, ArrowRight, Check } from "lucide-react";
import { useCatalog, contextHref, money, type Catalog, type Service } from "@/lib/client/booking";
import { Mirror, Bust, RitualArt, Reveal } from "./art";
import { BookingLink, Notice } from "./shell";
function safeDecode(value: string) { try {
    return decodeURIComponent(value);
}
catch {
    return value;
} }
function useSelection(data: Catalog | null) { const [raw, setRaw] = useState<string | null>(null), [barber, setBarber] = useState<string | undefined>(), [loaded, setLoaded] = useState(false), [focusTick, setFocusTick] = useState(0); useEffect(() => { const read = (focus = false) => { const url = new URL(window.location.href); const value = url.pathname === "/servicios" && url.hash && url.hash !== "#contenido" ? safeDecode(url.hash.slice(1)) : url.searchParams.get("servicio"); setRaw(value); setBarber(url.searchParams.get("barbero") || undefined); setLoaded(true); if (focus || url.hash)
    setFocusTick(n => n + 1); }; read(); const onChange = () => read(true); window.addEventListener("hashchange", onChange); window.addEventListener("popstate", onChange); return () => { window.removeEventListener("hashchange", onChange); window.removeEventListener("popstate", onChange); }; }, []); const chosen = data?.servicios.find(s => s.id === (raw === null ? "corte" : raw)); const validBarber = data?.barberos.some(b => b.id === barber) ? barber : undefined; const choose = (id: string) => { setFocusTick(0); setRaw(id); const url = new URL(window.location.href); if (url.pathname === "/servicios")
    url.hash = id;
else
    url.searchParams.set("servicio", id); window.history.pushState({}, "", url); window.dispatchEvent(new Event("nr-context-change")); }; return { chosen, choose, raw, barber: validBarber, loaded, focusTick }; }
export function PublicPage({ mode }: {
    mode: "home" | "services" | "barbers" | "visit";
}) {
    const catalog = useCatalog(), selection = useSelection(catalog.data);
    const titleRef = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => { if (!selection.focusTick || catalog.loading)
        return; (selection.chosen ? titleRef.current : errorRef.current)?.focus(); }, [selection.focusTick, catalog.loading, selection.chosen]);
    const service = selection.chosen, data = catalog.data, index = data?.servicios.findIndex(s => s.id === service?.id) || 0;
    const recovery = catalog.loading ? <Notice kind="status">Cargando el catálogo…</Notice> : catalog.error ? <Notice retry={catalog.retry}>{catalog.error}</Notice> : !data?.servicios.length ? <Notice retry={catalog.retry}>El catálogo está vacío. No hay servicios disponibles para elegir.</Notice> : !service ? <div ref={errorRef} tabIndex={-1}><Notice>Esta referencia no corresponde a un servicio. Elige una opción de la carta para continuar.</Notice></div> : null;
    const carta = <Carta data={data} service={service} choose={selection.choose} barber={selection.barber}/>;
    if (mode === "home")
        return <main id="contenido" tabIndex={-1}><section className="hero page-width" aria-labelledby="hero-title"><div className="hero-kicker"><span>Barbería clásica</span><span>Bogotá, Colombia</span></div><h1 id="hero-title">El oficio se nota</h1><p className="hero-intro">El corte preciso. La pausa necesaria. Tu propio carácter.</p><Mirror chair index={Math.max(0, index)}><div className="hero-edge-copy"><span>Un momento para ti.</span><p>{service ? `${service.nombre} · ${service.duracionMin} min · ${money(service.precioCop)}` : "Elige el ritual que va contigo."}</p></div><BookingLink service={service?.id || selection.raw || undefined} barber={selection.barber}/></Mirror><div className="hero-foot"><span>El cuidado está en los detalles.</span><span>Servicios y precios de ejemplo</span></div></section><section className="section page-width" aria-labelledby="carta-title"><div className="section-heading"><div><span className="eyebrow">La carta</span><h2 id="carta-title">A tu medida.</h2></div><p>Cuatro maneras de cuidar tu estilo.<br />Un mismo respeto por el oficio.</p></div>{recovery}<div className="carta-composition"><div className="carta-reference"><Mirror service={service} index={Math.max(0, index)} compact><ServiceEdge service={service}/></Mirror></div>{carta}</div><Link className="text-link" href={contextHref("/servicios", service?.id, selection.barber)}>Explorar los servicios <ArrowRight size={18}/></Link></section><Ritual /><section className="section page-width" aria-labelledby="team-title"><div className="section-heading"><div><span className="eyebrow">Las manos del oficio</span><h2 id="team-title">Tres estilos. Una misma atención.</h2></div><Link href={contextHref("/barberos", service?.id)} className="text-link">Conocer al equipo <ArrowUpRight size={18}/></Link></div><Team data={data} error={catalog.error} loading={catalog.loading} retry={catalog.retry} service={service?.id || selection.raw || undefined}/></section><Visit data={data} service={service?.id || selection.raw || undefined} barber={selection.barber} compact error={catalog.error} loading={catalog.loading} retry={catalog.retry}/></main>;
    if (mode === "services")
        return <main id="contenido" tabIndex={-1} className="page-width interior"><div className="page-heading"><span className="eyebrow">La carta de ejemplo</span><h1 ref={titleRef} tabIndex={-1}>Un ritual, tu estilo.</h1><p>Precisión en el corte. Intención en cada detalle.</p></div>{recovery}<div className="services-layout"><Mirror service={service} index={Math.max(0, index)} catalogue={<Carta data={catalog.data} service={service} choose={selection.choose} barber={selection.barber} hideAction/>}><ServiceEdge service={service}/>{service && <BookingLink service={service.id} barber={selection.barber}>Reservar este servicio</BookingLink>}</Mirror></div><p className="service-note">Todos nuestros barberos atienden los cuatro servicios. Duraciones y precios ilustrativos en pesos colombianos.</p><Ritual compact/></main>;
    if (mode === "barbers")
        return <main id="contenido" tabIndex={-1} className="page-width interior"><div className="page-heading"><span className="eyebrow">Equipo ficticio</span><h1>Las manos del oficio.</h1><p>Tres especialidades, una forma de entender el cuidado.</p></div><Team data={data} error={catalog.error} loading={catalog.loading} retry={catalog.retry} service={service?.id || selection.raw || undefined}/><div className="team-bottom"><p>Tomás, Julián y Samuel atienden los cuatro servicios.<br />Elige a tu barbero y consulta sus horas disponibles.</p><Link className="text-link" href={contextHref("/servicios", service?.id)}>Volver a la carta <ArrowRight size={18}/></Link></div></main>;
    return <main id="contenido" tabIndex={-1} className="interior"><Visit data={data} service={service?.id || selection.raw || undefined} barber={selection.barber} error={catalog.error} loading={catalog.loading} retry={catalog.retry}/></main>;
}
export function ServiceEdge({ service }: {
    service?: Service | null;
}) { return <div className="service-edge-copy"><h3>{service?.nombre || "Tu próxima elección"}</h3>{service && <p><span>{service.duracionMin} min</span><span>{money(service.precioCop)}</span></p>}</div>; }
function Carta({ data, service, choose, barber, hideAction = false }: {
    data: Catalog | null;
    hideAction?: boolean;
    service?: Service;
    choose: (id: string) => void;
    barber?: string;
}) { return <div className="carta"><div role="group" aria-label="Elegir servicio">{data?.servicios.map((s, i) => <div key={s.id} className={`carta-row ${s.id === service?.id ? "active" : ""}`}><button type="button" aria-pressed={s.id === service?.id} onClick={() => choose(s.id)}><span className="service-number">{String(i + 1).padStart(2, "0")}</span><span className="carta-name">{s.nombre}<small><Clock3 size={13}/>{s.duracionMin} min</small></span><span className="carta-price">{money(s.precioCop)}<span className="selection-mark" aria-hidden="true">{s.id === service?.id && <Check size={16}/>}</span></span></button></div>)}</div><p className="sr-only" role="status">{service ? `${service.nombre}, ${service.duracionMin} minutos, ${money(service.precioCop)} seleccionado.` : "Elige un servicio"}</p>{service && !hideAction && <BookingLink className="text-link carta-cta" service={service.id} barber={barber}>Reservar {service.nombre.toLowerCase()}</BookingLink>}</div>; }
function Ritual({ compact = false }: {
    compact?: boolean;
}) { return <section className={`ritual ${compact ? "ritual-compact" : ""}`} aria-labelledby={`ritual-${compact ? "compact" : "full"}`}><Reveal><div className="page-width"><div className="section-heading"><div><span className="eyebrow">Sin prisa. Con intención.</span><h2 id={`ritual-${compact ? "compact" : "full"}`}>El ritual también importa.</h2></div><p>Escuchar, dar forma y afinar.<br />Lo clásico vive en la atención al detalle.</p></div><RitualArt /><div className="ritual-captions"><p><span>Escuchar</span>Tu estilo marca el comienzo.</p><p><span>Dar forma</span>Precisión en cada movimiento.</p><p><span>Afinar</span>El detalle que hace la diferencia.</p></div></div></Reveal></section>; }
function Team({ data, service, error, loading, retry }: {
    data: Catalog | null;
    service?: string;
    error: string;
    loading: boolean;
    retry: () => void;
}) { if (loading)
    return <Notice kind="status">Cargando el equipo: Tomás, Julián y Samuel…</Notice>; if (error)
    return <Notice retry={retry}>{error}</Notice>; if (!data?.barberos.length)
    return <Notice retry={retry}>El equipo no está disponible. Vuelve a consultar.</Notice>; return <div className="team-gallery">{data.barberos.map(b => <article className="team-person" key={b.id}><div className="portrait"><Bust person={b.id}/></div><div className="team-caption"><h2>{b.nombre}</h2><p>{b.especialidad}</p><BookingLink className="text-link" service={service} barber={b.id}>Reservar con {b.nombre}</BookingLink></div></article>)}</div>; }
function Visit({ data, service, barber, compact = false, error, loading, retry }: {
    data: Catalog | null;
    service?: string;
    barber?: string;
    compact?: boolean;
    error: string;
    loading: boolean;
    retry: () => void;
}) { const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; return <section className={`visit ${compact ? "visit-home" : ""}`}><div className="page-width"><div className="city-frame"><span className="eyebrow">El lugar del encuentro</span>{compact ? <h2>Bogotá.</h2> : <h1>Nos inspira Bogotá.</h1>}<div className="city-baseline"><p>Carácter de ciudad.<br />Calma de barbería.</p><BookingLink service={service} barber={barber}>Consultar disponibilidad y reservar</BookingLink></div></div><div className="visit-details"><div><h2>Una barbería de ejemplo.</h2><p>Este es un negocio ficticio inspirado en el oficio clásico. No hay una dirección visitable publicada.</p><Link href={contextHref("/barberos", service, barber)} className="text-link">Conoce al equipo ilustrativo <ArrowUpRight size={18}/></Link></div><div><h2>Horario demostrativo</h2>{loading ? <Notice kind="status">Consultando horarios…</Notice> : error ? <Notice retry={retry}>{error}</Notice> : !data?.jornadas.length ? <Notice retry={retry}>No hay horarios publicados.</Notice> : <table className="hours"><caption className="sr-only">Horario semanal de ejemplo, hora de Bogotá</caption><tbody>{data.jornadas.map(d => <tr key={d.diaSemana}><th scope="row">{days[d.diaSemana - 1]}</th><td>{d.cerrado ? "Cerrado" : `${d.abre}–${d.cierra}`}</td></tr>)}</tbody></table>}<p className="small">Hora de Bogotá. La disponibilidad de citas se consulta por fecha.</p></div></div></div></section>; }
