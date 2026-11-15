import { Horario, Feriado } from "../tipos/transporte";
import { obtenerLista } from "./api";
import { obtenerLineas } from "./lineas";
import { obtenerParadas } from "./paradas";
import { guardarFeriadosAnio, guardarHorariosLinea, guardarLineasCache, guardarParadasCache, obtenerHorariosCache, obtenerTipoDeDiaCache } from "../base-datos/db";
import type { SQLiteDatabase } from "expo-sqlite";

export async function obtenerHorariosDeParada(paradaId: string): Promise<Horario[]> {
  const params = new URLSearchParams({ paradaId, porPagina: "5000" });
  return (await obtenerLista<Horario>(`/horarios?${params.toString()}`)).sort((a, b) => a.hora.localeCompare(b.hora));
}
export async function obtenerHorariosDeLinea(lineaId: string): Promise<Horario[]> {
  const params = new URLSearchParams({ lineaId, porPagina: "5000" });
  return (await obtenerLista<Horario>(`/horarios?${params.toString()}`)).sort((a, b) => a.hora.localeCompare(b.hora));
}
export async function obtenerProximos(paradaId: string, lineaId?: string): Promise<Horario[]> {
  const params = new URLSearchParams();
  if (lineaId) params.set("lineaId", lineaId);
  const query = params.toString();
  return obtenerLista<Horario>(`/paradas/${encodeURIComponent(paradaId)}/proximos${query ? `?${query}` : ""}`);
}

/** Descarga las tablas completas de cada línea y los feriados para consulta sin conexión. */
export async function sincronizarDatosOffline(
  db: SQLiteDatabase,
  alProgresar?: (mensaje: string) => void
): Promise<void> {
  alProgresar?.("Consultando líneas...");
  const lineas = await obtenerLineas();
  if (!lineas.length) throw new Error("La API no devolvió líneas para descargar.");
  await guardarLineasCache(db, lineas);
  alProgresar?.("Descargando paradas...");
  const paradas = await obtenerParadas();
  await guardarParadasCache(db, paradas);

  let descargadas = 0;
  for (const linea of lineas) {
    alProgresar?.(`Descargando horarios: línea ${linea.numero} (${descargadas + 1}/${lineas.length})`);
    const horarios = await obtenerHorariosDeLinea(linea.id);
    await guardarHorariosLinea(db, linea.id, horarios);
    descargadas += 1;
  }

  for (const anio of [2026, 2027]) {
    alProgresar?.(`Descargando feriados de ${anio}...`);
    const feriados = await obtenerLista<Feriado>(`/feriados?anio=${anio}`);
    await guardarFeriadosAnio(db, anio, feriados);
  }
  alProgresar?.("Datos offline actualizados correctamente.");
}


/** Próximos servicios calculados con las tablas locales cuando no hay conexión. */
export async function obtenerProximosOffline(db: SQLiteDatabase, paradaId: string, cantidad = 3): Promise<Horario[]> {
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const tipoHoy = await obtenerTipoDeDiaCache(db, ahora);
  const hoy = await obtenerHorariosCache(db, { paradaId, tipoDeDia: tipoHoy });
  const siguientesHoy = hoy.filter(h => h.hora >= horaActual).sort((a, b) => a.hora.localeCompare(b.hora));
  if (siguientesHoy.length >= cantidad) return siguientesHoy.slice(0, cantidad);

  const manana = new Date(ahora);
  manana.setDate(manana.getDate() + 1);
  const tipoManana = await obtenerTipoDeDiaCache(db, manana);
  const horariosManana = await obtenerHorariosCache(db, { paradaId, tipoDeDia: tipoManana });
  return [...siguientesHoy, ...horariosManana.sort((a, b) => a.hora.localeCompare(b.hora))].slice(0, cantidad);
}
