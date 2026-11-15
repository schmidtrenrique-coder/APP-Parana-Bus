import Storage from "expo-sqlite/kv-store";
import { Appearance } from "react-native";
import type { Aviso, Tema } from "../tipos/transporte";

/**
 * Preferencias y datos livianos en expo-sqlite/kv-store.
 * El token de sesión NO va acá: se guarda en expo-secure-store (ver servicios/sesion.ts).
 */
const CLAVES = {
  tema: "pref_tema",
  bloqueo: "pref_bloqueo_biometrico",
  avisosLocales: "pref_avisos_locales",
  avisosVistos: "avisos_vistos",
  avisosCache: "avisos_cache",
} as const;

export function leerTema(): Tema {
  const valor = Storage.getItemSync(CLAVES.tema);
  return valor === "claro" || valor === "oscuro" ? valor : "sistema";
}
/** Le dice a React Native qué modo usar: null = seguir al teléfono. */
export function aplicarTema(tema: Tema = leerTema()): void {
  Appearance.setColorScheme(tema === "sistema" ? null : tema === "claro" ? "light" : "dark");
}
export function guardarTema(tema: Tema): void {
  Storage.setItemSync(CLAVES.tema, tema);
  aplicarTema(tema);
}

/** Pedir huella, rostro o PIN al reabrir la app. Viene activado salvo que la persona lo apague. */
export function bloqueoBiometricoActivo(): boolean { return Storage.getItemSync(CLAVES.bloqueo) !== "0"; }
export function guardarBloqueoBiometrico(activo: boolean): void { Storage.setItemSync(CLAVES.bloqueo, activo ? "1" : "0"); }

/** Avisar en este teléfono cuando aparece un aviso nuevo en una línea favorita. */
export function avisosLocalesActivos(): boolean { return Storage.getItemSync(CLAVES.avisosLocales) !== "0"; }
export function guardarAvisosLocales(activo: boolean): void { Storage.setItemSync(CLAVES.avisosLocales, activo ? "1" : "0"); }

/** Ids de avisos que la app ya conocía. null = todavía no se guardó ninguno (primer uso). */
export function leerAvisosVistos(): string[] | null {
  const crudo = Storage.getItemSync(CLAVES.avisosVistos);
  if (!crudo) return null;
  try { const lista = JSON.parse(crudo); return Array.isArray(lista) ? lista.map(String) : null; } catch { return null; }
}
export function guardarAvisosVistos(ids: string[]): void { Storage.setItemSync(CLAVES.avisosVistos, JSON.stringify(ids)); }

/** Últimos avisos vigentes que se pudieron descargar, para mostrarlos (marcados como viejos) sin conexión. */
export interface AvisosGuardados { guardadoEn: string; avisos: Aviso[]; }
export function guardarAvisosCache(avisos: Aviso[], guardadoEn: string): void {
  Storage.setItemSync(CLAVES.avisosCache, JSON.stringify({ guardadoEn, avisos } satisfies AvisosGuardados));
}
export function leerAvisosCache(): AvisosGuardados | null {
  const crudo = Storage.getItemSync(CLAVES.avisosCache);
  if (!crudo) return null;
  try {
    const datos = JSON.parse(crudo) as AvisosGuardados;
    return Array.isArray(datos.avisos) && typeof datos.guardadoEn === "string" ? datos : null;
  } catch { return null; }
}
