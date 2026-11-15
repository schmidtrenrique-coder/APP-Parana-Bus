import { Linea } from "../tipos/transporte";
import { obtenerLista, obtenerRecurso } from "./api";

export async function obtenerLineas(): Promise<Linea[]> {
  return obtenerLista<Linea>("/lineas?porPagina=100");
}
export async function obtenerLinea(id: string): Promise<Linea | null> {
  try { return await obtenerRecurso<Linea>(`/lineas/${encodeURIComponent(id)}`); }
  catch (error) { if (error instanceof Error && "estado" in error && (error as { estado: number }).estado === 404) return null; throw error; }
}
