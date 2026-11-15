import * as SecureStore from "expo-secure-store";
import { pedir, RespuestaUno } from "./api";
import { Usuario } from "../tipos/transporte";

const CLAVE_TOKEN = "parana_bus_token";
export interface Sesion { token: string; usuario: Usuario; }

export async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CLAVE_TOKEN, token);
}
export async function obtenerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CLAVE_TOKEN);
}
export async function cerrarSesionLocal(): Promise<void> {
  await SecureStore.deleteItemAsync(CLAVE_TOKEN);
}
export async function ingresar(email: string, password: string): Promise<Sesion> {
  const r = await pedir<RespuestaUno<Sesion>>("/auth/ingreso", {
    method: "POST", body: JSON.stringify({ email, contrasena: password }),
  });
  await guardarToken(r.datos.token);
  return r.datos;
}
export async function registrarse(nombre: string, email: string, password: string): Promise<Sesion> {
  const r = await pedir<RespuestaUno<Sesion>>("/auth/registro", {
    method: "POST", body: JSON.stringify({ nombre, email, contrasena: password }),
  });
  await guardarToken(r.datos.token);
  return r.datos;
}
export async function obtenerMiUsuario(): Promise<Usuario> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  const r = await pedir<RespuestaUno<Usuario>>("/yo", {}, token);
  return r.datos;
}
export async function actualizarMiUsuario(cambios: Partial<Pick<Usuario, "nombre" | "avisosActivos" | "tema">>): Promise<Usuario> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  const r = await pedir<RespuestaUno<Usuario>>("/yo", { method: "PATCH", body: JSON.stringify(cambios) }, token);
  return r.datos;
}
export async function agregarLineaFavorita(lineaId: string): Promise<Usuario> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  const r = await pedir<RespuestaUno<Usuario>>(`/yo/lineas-favoritas/${encodeURIComponent(lineaId)}`, { method: "PUT" }, token);
  return r.datos;
}
export async function quitarLineaFavorita(lineaId: string): Promise<void> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  await pedir<unknown>(`/yo/lineas-favoritas/${encodeURIComponent(lineaId)}`, { method: "DELETE" }, token);
}
export async function agregarParadaFavorita(paradaId: string): Promise<Usuario> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  const r = await pedir<RespuestaUno<Usuario>>(`/yo/paradas-favoritas/${encodeURIComponent(paradaId)}`, { method: "PUT" }, token);
  return r.datos;
}
export async function quitarParadaFavorita(paradaId: string): Promise<void> {
  const token = await obtenerToken();
  if (!token) throw new Error("Iniciá sesión para continuar.");
  await pedir<unknown>(`/yo/paradas-favoritas/${encodeURIComponent(paradaId)}`, { method: "DELETE" }, token);
}
