import { API_URL } from "../configuracion/api";

export interface MetaPaginacion { total: number; pagina: number; porPagina: number; }
export interface RespuestaLista<T> { datos: T[]; meta: MetaPaginacion; }
export interface RespuestaUno<T> { datos: T; meta: null; }
export interface RespuestaError { error: { codigo: string; mensaje: string }; }

const TIEMPO_MAXIMO_MS = 12000;
const TIEMPO_SUBIDA_MS = 40000;

export class ApiError extends Error {
  codigo: string;
  estado: number;
  constructor(mensaje: string, codigo: string, estado: number) {
    super(mensaje); this.name = "ApiError"; this.codigo = codigo; this.estado = estado;
  }
}

export async function pedir<T>(ruta: string, opciones: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(opciones.headers);
  if (opciones.body && !(opciones.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Si la red está colgada (por ejemplo, un Wi-Fi que pide iniciar sesión), se corta y se trata como sin conexión.
  const controlador = new AbortController();
  const limite = setTimeout(() => controlador.abort(), opciones.body instanceof FormData ? TIEMPO_SUBIDA_MS : TIEMPO_MAXIMO_MS);
  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, { ...opciones, headers, signal: controlador.signal });
  } catch {
    throw new ApiError(`No pudimos conectarnos con Paraná Bus. Verificá tu conexión a internet (${API_URL}).`, "SIN_CONEXION", 0);
  } finally {
    clearTimeout(limite);
  }

  const contenido = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = (contenido as RespuestaError).error;
    throw new ApiError(error?.mensaje ?? "Ocurrió un error al consultar el servicio.", error?.codigo ?? "ERROR_HTTP", respuesta.status);
  }
  return contenido as T;
}

export async function obtenerLista<T>(ruta: string): Promise<T[]> {
  const respuesta = await pedir<RespuestaLista<T>>(ruta);
  return respuesta.datos ?? [];
}

export async function obtenerRecurso<T>(ruta: string): Promise<T> {
  const respuesta = await pedir<RespuestaUno<T>>(ruta);
  return respuesta.datos;
}
