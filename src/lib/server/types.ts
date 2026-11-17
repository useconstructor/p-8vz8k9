import type { Client } from "@libsql/client";

export type Executor = Pick<Client, "execute">;
export type JsonObject = Record<string, unknown>;
export type Estado = "reservada" | "en atención" | "completada" | "cancelada" | "no asistió";
export type Session = { id: string; rol: "visitante" | "dueno"; expiraEn: string };
export type Servicio = {
  id: string; nombre: string; duracionMin: number; precioCop: number; version: number;
  ilustracionId: string; presentacionVersion: number;
};
export type Barbero = { id: string; nombre: string; especialidad: string; version: number };
export type Jornada = { abre: string | null; cierra: string | null; cerrado: boolean };
export type Catalogo = {
  catalogRevision: string; servicios: Servicio[]; barberos: Barbero[];
  habilitaciones: { servicioId: string; barberoId: string }[];
  jornadas: (Jornada & { diaSemana: number })[];
  excepciones: (Jornada & { fecha: string; barberoId: string | null })[];
  zonaHoraria: "America/Bogota";
};
export type Draft = {
  servicioId: string; barberoId: string; fecha: string; inicioUtc: string;
  nombre: string; celular: string;
};
export type Revision = Draft & {
  finUtc: string; catalogRevision: string; servicioVersion: number; barberoVersion: number;
  servicioNombre: string; barberoNombre: string; duracionMin: number; precioCop: number;
  ilustracionId: string; presentacionVersion: number;
};
export type Cita = Omit<Revision, "fecha"> & {
  id: string; estado: Estado; version: number; creadaEn: string; actualizadaEn: string;
};
export type Historial = {
  id: string; fecha: string; actor: Session["rol"]; accion: string;
  estadoPrevio: Estado | null; estadoNuevo: Estado;
  versionPrevia: number | null; versionNueva: number;
  anterior: Cita | null; actual: Cita;
};
export type Slot = { inicioUtc: string; finUtc: string; hora: string };
