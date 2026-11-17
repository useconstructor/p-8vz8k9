"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import branding from "../../../branding.json";
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { contextHref, trackBooking } from "@/lib/client/booking";
const links = [["/", "Inicio"], ["/servicios", "Servicios"], ["/barberos", "Barberos"], ["/visitanos", "Visítanos"], ["/mi-cita", "Mi cita"]];
export function Brand() { const parts = branding.logoText.split(" & "); return <Link href="/" className="brand" aria-label={`${branding.logoText}, inicio`}><img data-brand-logo src={branding.logoImageUrl || "/brand-mark.svg"} alt="" width="40" height="40"/><span>{parts.length === 2 ? <>{parts[0]} <svg className="wordmark-ampersand" viewBox="0 0 28 38" aria-hidden="true"><path d="M24 31 9 11Q4 3 12 3Q21 3 17 11L6 24Q1 34 11 35Q20 36 26 20M8 22 20 35" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="bevel"/></svg> {parts[1]}</> : branding.logoText}</span></Link>; }
export function Header() { const path = usePathname(), [open, setOpen] = useState(false); const panel = useRef<HTMLDivElement>(null); const [context, setContext] = useState<{
    service?: string;
    barber?: string;
}>({}); useEffect(() => { const read = () => { const u = new URL(window.location.href); setContext({ service: u.pathname === "/servicios" && u.hash ? u.hash.slice(1) : u.searchParams.get("servicio") || undefined, barber: u.searchParams.get("barbero") || undefined }); }; read(); window.addEventListener("popstate", read); window.addEventListener("hashchange", read); window.addEventListener("nr-context-change", read); return () => { window.removeEventListener("popstate", read); window.removeEventListener("hashchange", read); window.removeEventListener("nr-context-change", read); }; }, [path]); useEffect(() => { queueMicrotask(() => setOpen(false)); }, [path]); return <><a href="#contenido" className="skip-link">Saltar al contenido</a><header className="site-header"><Brand /><nav className="desktop-nav" aria-label="Navegación principal">{links.slice(1).map(([href, label]) => <Link key={href} href={contextHref(href, context.service, context.barber)} aria-current={path === href ? "page" : undefined}>{label}</Link>)}</nav><Link href={contextHref("/reservar", context.service, context.barber)} className="button header-book" onClick={trackBooking}>Reservar <ArrowUpRight size={17}/></Link><Dialog open={open} onOpenChange={setOpen}><DialogTrigger className="menu-trigger" aria-label="Abrir menú"><Menu size={23}/></DialogTrigger><DialogContent ref={panel} className="mobile-menu" showCloseButton={false} onKeyDown={e => trapTab(e, panel.current)}><div className="menu-top"><DialogTitle>Explorar el oficio</DialogTitle><DialogClose className="icon-button" aria-label="Cerrar menú"><X /></DialogClose></div><nav aria-label="Navegación móvil">{links.map(([href, label]) => <Link key={href} href={contextHref(href, context.service, context.barber)} aria-current={path === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}<ArrowUpRight size={22}/></Link>)}<Link href={contextHref("/reservar", context.service, context.barber)} onClick={() => { trackBooking(); setOpen(false); }}>Reservar<ArrowUpRight size={22}/></Link></nav><p>Bogotá · Barbería de ejemplo</p></DialogContent></Dialog></header></>; }
export function trapTab(e: React.KeyboardEvent, root: HTMLElement | null) { if (e.key !== "Tab" || !root)
    return; const items = Array.from(root.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el => el.getClientRects().length); const first = items[0], last = items[items.length - 1]; if (!first)
    return; if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
}
else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
} }
export function Footer() { return <footer className="site-footer"><div className="footer-top"><Brand /><p>Precisión. Ritual. Carácter.</p><Link href="/dueno">Acceso del dueño <ArrowUpRight size={16}/></Link></div><p className="disclaimer">Negocio ficticio de ejemplo. Equipo, servicios, precios, horarios e imágenes ilustrativos</p></footer>; }
export function BookingLink({ service, barber, children = "Reservar ahora", className = "button" }: {
    service?: string;
    barber?: string;
    children?: React.ReactNode;
    className?: string;
}) { return <Link href={contextHref("/reservar", service, barber)} className={className} onClick={trackBooking}>{children}<ArrowUpRight size={18}/></Link>; }
export function Notice({ children, retry, kind = "error" }: {
    children: React.ReactNode;
    retry?: () => void;
    kind?: "error" | "status";
}) { return <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}{retry && <button type="button" className="text-button" onClick={retry}>Reintentar</button>}</div>; }
