import type { SQLiteDatabase } from "expo-sqlite";
import type { MotivoDemora, ReporteDeDemora } from "../tipos/transporte";
import { obtenerToken } from "./sesion";
import { ApiError, obtenerLista, pedir, type RespuestaUno } from "./api";
import {
  guardarReportePendiente,
  obtenerReportesPendientes,
  quitarReportePendiente,
  type ReportePendienteLocal,
} from "../base-datos/db";

export interface NuevoReporteDeDemora {
  id: string;
  usuarioId: string;
  lineaId: string;
  paradaId: string;
  motivo: MotivoDemora;
  comentario: string | null;
  fotoLocalUri: string | null;
  fotoNombre: string | null;
  fotoTipo: string | null;
  fechaHora: string;
}

function nuevoIdReporte(): string {
  return `rep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function prepararNuevoReporte(datos: Omit<NuevoReporteDeDemora, "id" | "fechaHora">): NuevoReporteDeDemora {
  return { ...datos, id: nuevoIdReporte(), fechaHora: new Date().toISOString() };
}

async function subirFoto(uri: string, nombre: string | null, tipo: string | null, token: string): Promise<string> {
  const form = new FormData();
  const archivo = {
    uri,
    name: nombre || `reporte-${Date.now()}.jpg`,
    type: tipo || "image/jpeg",
  };
  form.append("archivo", archivo as unknown as Blob);
  const respuesta = await pedir<RespuestaUno<{ url: string; tipo: "imagen" | "audio" | "video"; bytes: number }>>(
    "/archivos", { method: "POST", body: form }, token
  );
  return respuesta.datos.url;
}

async function enviarReporte(reporte: ReportePendienteLocal, token: string): Promise<ReporteDeDemora> {
  let fotoUri = reporte.fotoUri;
  if (!fotoUri && reporte.fotoLocalUri) {
    fotoUri = await subirFoto(reporte.fotoLocalUri, reporte.fotoNombre, reporte.fotoTipo, token);
    reporte.fotoUri = fotoUri;
    reporte.fotoLocalUri = null;
  }
  const cuerpo = {
    id: reporte.id,
    lineaId: reporte.lineaId,
    paradaId: reporte.paradaId,
    motivo: reporte.motivo,
    comentario: reporte.comentario,
    fotoUri,
    fechaHora: reporte.fechaHora,
  };
  const respuesta = await pedir<RespuestaUno<ReporteDeDemora>>("/reportes-demora", {
    method: "POST",
    body: JSON.stringify(cuerpo),
  }, token);
  return respuesta.datos;
}

export async function crearReporteDeDemora(db: SQLiteDatabase, datos: NuevoReporteDeDemora): Promise<{ reporte: ReporteDeDemora | null; pendiente: boolean }> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para enviar un reporte de demora.");
  const pendiente: ReportePendienteLocal = {
    id: datos.id,
    usuarioId: datos.usuarioId,
    lineaId: datos.lineaId,
    paradaId: datos.paradaId,
    motivo: datos.motivo,
    comentario: datos.comentario,
    fotoLocalUri: datos.fotoLocalUri,
    fotoUri: null,
    fotoNombre: datos.fotoNombre,
    fotoTipo: datos.fotoTipo,
    fechaHora: datos.fechaHora,
  };
  await guardarReportePendiente(db, pendiente);
  try {
    const reporte = await enviarReporte(pendiente, token);
    await quitarReportePendiente(db, pendiente.id);
    return { reporte, pendiente: false };
  } catch (error) {
    if (error instanceof ApiError && (error.estado === 0 || error.estado >= 500 || error.estado === 401)) {
      await guardarReportePendiente(db, pendiente);
      if (error.estado === 0 || error.estado >= 500) return { reporte: null, pendiente: true };
      throw error;
    }
    await quitarReportePendiente(db, pendiente.id);
    throw error;
  }
}

export async function obtenerReportesDeParada(paradaId: string): Promise<ReporteDeDemora[]> {
  const params = new URLSearchParams({ paradaId });
  return obtenerLista<ReporteDeDemora>(`/reportes-demora?${params.toString()}`);
}

export async function obtenerReportesDeLinea(lineaId: string): Promise<ReporteDeDemora[]> {
  const params = new URLSearchParams({ lineaId });
  return obtenerLista<ReporteDeDemora>(`/reportes-demora?${params.toString()}`);
}

export async function confirmarReporteDeDemora(id: string): Promise<ReporteDeDemora> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para confirmar un reporte.");
  const respuesta = await pedir<RespuestaUno<ReporteDeDemora>>(`/reportes-demora/${encodeURIComponent(id)}/confirmaciones`, { method: "POST" }, token);
  return respuesta.datos;
}

export async function sincronizarReportesPendientes(db: SQLiteDatabase, usuarioId: string): Promise<{ enviados: number; pendientes: number }> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para sincronizar tus reportes pendientes.");
  const pendientes = (await obtenerReportesPendientes(db)).filter(reporte => reporte.usuarioId === usuarioId);
  let enviados = 0;
  for (const reporte of pendientes) {
    try {
      await enviarReporte(reporte, token);
      await quitarReportePendiente(db, reporte.id);
      enviados += 1;
    } catch (error) {
      // Si la foto ya se subió, conservar su URL evita volver a subirla al reintentar.
      if (error instanceof ApiError && error.estado !== 0 && error.estado < 500 && error.estado !== 401) {
        await quitarReportePendiente(db, reporte.id);
        throw error;
      }
      await guardarReportePendiente(db, reporte);
      if (error instanceof ApiError && error.estado === 401) throw error;
      break;
    }
  }
  const restantes = (await obtenerReportesPendientes(db)).filter(reporte => reporte.usuarioId === usuarioId).length;
  return { enviados, pendientes: restantes };
}

export async function contarReportesPendientes(db: SQLiteDatabase, usuarioId: string): Promise<number> {
  return (await obtenerReportesPendientes(db)).filter(reporte => reporte.usuarioId === usuarioId).length;
}
