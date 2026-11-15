import { Parada, Coordenadas } from "../tipos/transporte";
import { obtenerLista, obtenerRecurso } from "./api";

export async function obtenerParadas(busqueda?: string): Promise<Parada[]> {
  const params = new URLSearchParams({ porPagina: "1000" });
  const q = busqueda?.trim();
  if (q) params.set("q", q);
  return obtenerLista<Parada>(`/paradas?${params.toString()}`);
}

export async function obtenerParadasCercanas(coordenadas: Coordenadas, radioMetros = 2000): Promise<Parada[]> {
  const params = new URLSearchParams({
    latitud: String(coordenadas.latitud),
    longitud: String(coordenadas.longitud),
    radioMetros: String(radioMetros),
    orden: "distancia",
    porPagina: "1000",
  });
  return obtenerLista<Parada>(`/paradas?${params.toString()}`);
}

export async function obtenerParada(id: string): Promise<Parada | null> {
  try {
    return await obtenerRecurso<Parada>(`/paradas/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof Error && "estado" in error && (error as { estado: number }).estado === 404) return null;
    throw error;
  }
}

export async function resolverQr(codigo: string): Promise<Parada> {
  return obtenerRecurso<Parada>(`/paradas/qr/${encodeURIComponent(codigo)}`);
}
