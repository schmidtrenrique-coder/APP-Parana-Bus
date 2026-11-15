import { Aviso } from "../tipos/transporte";
import { obtenerLista, obtenerRecurso } from "./api";
import { guardarAvisosCache, leerAvisosCache } from "./preferencias";

export async function obtenerAvisos(estado: "vigentes" | "todos" = "vigentes"): Promise<Aviso[]> {
  return obtenerLista<Aviso>(`/avisos?estado=${estado}&porPagina=100`);
}
export async function obtenerAviso(id: string): Promise<Aviso> {
  return obtenerRecurso<Aviso>(`/avisos/${encodeURIComponent(id)}`);
}

export interface ResultadoAvisos {
  avisos: Aviso[];
  /** true si no hubo conexión y se muestran los últimos avisos guardados. */
  desactualizado: boolean;
  /** Cuándo se descargaron estos avisos (ISO). */
  actualizadoEn: string | null;
}

/**
 * Avisos vigentes. Con conexión los pide a la API y los guarda; sin conexión devuelve los últimos
 * guardados marcados como desactualizados (descartando los que ya vencieron). Si nunca se descargó
 * ninguno, el error de red sube para que la pantalla lo muestre con un botón de reintento.
 */
export async function cargarAvisos(): Promise<ResultadoAvisos> {
  try {
    const avisos = await obtenerAvisos("vigentes");
    const ahora = new Date().toISOString();
    guardarAvisosCache(avisos, ahora);
    return { avisos, desactualizado: false, actualizadoEn: ahora };
  } catch (error) {
    const guardados = leerAvisosCache();
    if (!guardados) throw error;
    const hoy = Date.now();
    const vigentes = guardados.avisos.filter(a => !a.hasta || new Date(a.hasta).getTime() > hoy);
    return { avisos: vigentes, desactualizado: true, actualizadoEn: guardados.guardadoEn };
  }
}
