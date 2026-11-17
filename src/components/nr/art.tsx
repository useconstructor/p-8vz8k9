"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { ProfileV2, EditorialBust, WorkshopChair } from "./art-current";
import type { Service } from "@/lib/client/booking";
export const Chair = WorkshopChair;
function ProfileV1({ id, version = 1 }: {
    id: string;
    version?: number;
}) { const kind = id.replace(/^perfil-/, ""); if (version !== 1 || !["corte", "barba", "corte-barba", "afeitado-toalla"].includes(kind))
    return <div className="reference-unavailable profile-art"><p>Referencia visual no disponible</p><p>Los datos del servicio siguen disponibles.</p><button type="button" className="text-button" onClick={() => window.location.reload()}>Reintentar referencia</button></div>; const beard = kind === "barba" || kind === "corte-barba", hair = kind === "corte" || kind === "corte-barba", towel = kind === "afeitado-toalla"; return <svg className="profile-art" viewBox="0 0 480 280" role="img" aria-label={`Referencia ${kind.replaceAll("-", " ")}, versión ${version}`} data-profile={kind}><path d="M0 0H480V280H0Z" fill="#DEDCD2"/><path d="M48 36H432V244H48Z" fill="none" stroke="#A5AEAA"/><circle cx="240" cy="141" r="101" fill="none" stroke="#725039" opacity=".3"/><g transform={towel ? "translate(99 -15) rotate(25 230 160)" : "translate(0 0)"}><path d="M177 254 194 205V174L182 143Q171 108 188 77Q207 48 245 54Q284 55 293 88L290 119 308 148 289 158 287 178Q284 196 253 202V224L282 254Z" fill="#C9B49C" stroke="#201D1B" strokeWidth="3" strokeLinejoin="round"/><path d="M249 201 218 192M272 163H288M277 143H287" fill="none" stroke="#725039" strokeWidth="3"/><path d="M194 146Q203 134 211 147V167Q195 174 195 158" fill="#C9B49C" stroke="#725039" strokeWidth="3"/>{hair ? <><path d="M183 146Q160 106 184 72Q213 39 252 50Q277 47 298 73L290 102Q261 84 231 106L211 139 203 133 196 148Z" fill="#201D1B"/><path d="M186 97Q230 52 282 74M188 110Q230 68 273 86" fill="none" stroke="#A5AEAA" strokeWidth="3"/></> : <path d="M181 134Q165 78 211 57Q256 36 291 75L294 93Q254 67 221 96L200 133Z" fill="#725039"/>}{beard && <><path d="M211 153 229 173 258 181 288 164V188L263 218 233 214 213 194 202 169Z" fill="#201D1B"/><path d="M255 161Q271 150 288 161L289 168 270 166 259 170Z" fill="#201D1B"/><path d="M225 190 238 202M240 192 251 203M256 195 267 190" stroke="#A5AEAA" strokeWidth="2"/></>}{towel && <><path d="M174 115Q211 101 247 113L281 131 277 151Q211 123 180 140Z" fill="#F2EFE8" stroke="#A5AEAA" strokeWidth="3"/><path d="M166 226 198 197Q224 218 259 218L288 254H163Z" fill="#F2EFE8" stroke="#A5AEAA" strokeWidth="3"/><path d="M181 231 262 247M184 220 278 253" stroke="#A5AEAA" strokeWidth="2"/></>}{!towel && <path d="M177 254 193 213 230 232 255 220 284 254Z" fill="#743746"/>}</g><path d="M58 141H92M75 124V158M388 141H422M405 124V158" stroke="#725039" opacity=".5"/></svg>; }
export function Profile({ id, version = 1 }: { id: string; version?: number }) {
    const kind = id.replace(/^perfil-/, "");
    if (version === 2 && ["corte", "barba", "corte-barba", "afeitado-toalla"].includes(kind)) return <ProfileV2 kind={kind}/>;
    return <ProfileV1 id={id} version={version}/>;
}
export function Mirror({ children, service, chair = false, compact = false, index, catalogue, outcome }: {
    children?: ReactNode;
    service?: (Pick<Service, "ilustracionId" | "presentacionVersion"> & { id?: string; servicioId?: string }) | null;
    catalogue?: ReactNode;
    outcome?: ReactNode;
    chair?: boolean;
    compact?: boolean;
    index?: number;
}) { const selectedIndex = index ?? Math.max(0, ["corte", "barba", "corte-barba", "afeitado-toalla"].indexOf(service?.servicioId || service?.id || "")); return <div className={`mirror ${compact ? "mirror-compact" : ""} ${outcome ? "mirror-result" : ""}`} data-mirror><div className="mirror-scene">{chair ? <Chair /> : service ? <Profile id={service.ilustracionId} version={service.presentacionVersion}/> : <div className="reference-pending">Elige tu servicio</div>}</div>{catalogue && <div className="mirror-catalogue">{catalogue}</div>}<div className="mirror-edge" data-working-edge><span className="edge-track" aria-hidden="true"><span data-selection-indicator style={{ transform: `translateX(${selectedIndex * 100}%)` }}/></span>{outcome && <div className="mirror-outcome">{outcome}</div>}{children}</div></div>; }
export const Bust = EditorialBust;
export function RitualArt() { return <svg viewBox="0 0 1100 240" role="img" aria-label="Tres estaciones del ritual: escuchar con el peine, dar forma con tijeras y afinar con brocha y navaja">
    <path d="M0 194H1100V238H0Z" fill="#725039"/><path d="M0 194H1100M0 220H1100" stroke="#A5AEAA" strokeWidth="2"/>
    <path d="M20 230Q155 224 302 231T609 231T934 231H1080" fill="none" stroke="#B09176" strokeWidth="1.5"/>
    <g stroke="#201D1B" strokeWidth="2.5" strokeLinejoin="round">
        <g transform="translate(51 70) rotate(-8 120 55)">
            <path d="M12 12 21 5H256L265 14V34H12Z" fill="#F2EFE8"/>
            <path d="M20 34V91M33 34V91M46 34V91M59 34V91M72 34V91M85 34V91M98 34V91M111 34V91M124 34V91M137 34V91M150 34V91M163 34V91M176 34V91M189 34V91M202 34V91M215 34V91M228 34V91M241 34V91M254 34V91" stroke="#F2EFE8" strokeWidth="6"/>
            <path d="M24 17H251" fill="none" stroke="#A5AEAA" strokeWidth="1.5"/>
        </g>
        <g transform="translate(374 6)">
            <path d="M100 124 175 30Q187 56 164 84L120 133Z" fill="#A5AEAA"/>
            <path d="M142 126 68 30Q57 54 80 83L121 137Z" fill="#F2EFE8"/>
            <path d="M98 120Q60 107 54 137Q49 163 77 171Q108 178 116 148L123 136 135 148Q142 178 172 172Q200 165 194 141Q188 110 147 122L123 133Z" fill="#A5AEAA"/>
            <ellipse cx="83" cy="145" rx="18" ry="15" fill="#201D1B"/><ellipse cx="165" cy="147" rx="18" ry="15" fill="#201D1B"/>
            <circle cx="123" cy="133" r="5" fill="#725039"/><path d="M73 45 118 110" stroke="#A5AEAA" strokeWidth="1.5"/>
        </g>
        <g transform="translate(706 7)">
            <path d="M19 176 26 133H86L93 176 85 187H27Z" fill="#743746"/>
            <path d="M26 132 19 102Q-1 67 31 45Q56 31 82 45Q114 67 94 102L86 132Z" fill="#F2EFE8"/>
            <path d="M28 108 26 64M41 113 42 51M56 114V47M71 113 70 52M83 107 87 67" fill="none" stroke="#A5AEAA" strokeWidth="1.5"/>
            <path d="M25 126H87V142H25Z" fill="#A5AEAA"/><path d="M33 153H80" stroke="#AE7881" strokeWidth="1.5"/>
        </g>
        <g transform="translate(843 63)">
            <path d="M16 90 96 28 112 42 41 117Q25 125 15 114Z" fill="#743746"/>
            <path d="M96 28 207 8 218 35 112 45Z" fill="#F2EFE8"/>
            <path d="M113 38 211 24" fill="none" stroke="#A5AEAA" strokeWidth="2"/>
            <circle cx="100" cy="37" r="4" fill="#A5AEAA"/><path d="M27 108 85 58" stroke="#AE7881" strokeWidth="1.5"/>
        </g>
    </g>
    <path d="M64 186H326M439 186H591M722 186H805M862 186H1080" stroke="#A5AEAA" strokeWidth="2"/>
</svg>; }
export function Reveal({ children }: {
    children: ReactNode;
}) { const ref = useRef<HTMLDivElement>(null); useEffect(() => { if (!ref.current)
    return; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) {
    entry.target.classList.add("is-visible");
    observer.disconnect();
} }, { threshold: .1 }); observer.observe(ref.current); return () => observer.disconnect(); }, []); return <div ref={ref} className="reveal">{children}</div>; }
