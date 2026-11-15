import * as Location from "expo-location";
import type { Coordenadas } from "../tipos/transporte";

function conLimite<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promesa, new Promise<null>(resolver => setTimeout(() => resolver(null), ms))]);
}

/**
 * Ubicación actual de la persona, con límite de tiempo. Si el teléfono no logra una posición a tiempo
 * (ubicación apagada, sin señal, emulador sin ubicación fijada) devuelve la última conocida, y si no hay,
 * null. Así una pantalla nunca queda cargando para siempre.
 */
export async function obtenerUbicacion(limiteMs = 7000): Promise<Coordenadas | null> {
  const actual = await conLimite(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), limiteMs).catch(() => null);
  if (actual) return { latitud: actual.coords.latitude, longitud: actual.coords.longitude };
  try {
    const ultima = await Location.getLastKnownPositionAsync();
    if (ultima) return { latitud: ultima.coords.latitude, longitud: ultima.coords.longitude };
  } catch { /* sin posición guardada */ }
  return null;
}
