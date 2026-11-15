import { Linking, Platform } from "react-native";
import type { Coordenadas } from "../tipos/transporte";

const rad = (n: number) => n * Math.PI / 180;

/** Distancia en metros entre dos puntos (fórmula del semiverseno). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Rumbo inicial de `a` hacia `b`, en grados desde el norte (0–360, sentido horario). */
export function rumboHacia(a: Coordenadas, b: Coordenadas): number {
  const dLon = rad(b.longitud - a.longitud);
  const y = Math.sin(dLon) * Math.cos(rad(b.latitud));
  const x = Math.cos(rad(a.latitud)) * Math.sin(rad(b.latitud)) - Math.sin(rad(a.latitud)) * Math.cos(rad(b.latitud)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const PUNTOS = ["norte", "noreste", "este", "sureste", "sur", "suroeste", "oeste", "noroeste"];
export function puntoCardinal(rumbo: number): string { return PUNTOS[Math.round(rumbo / 45) % 8]; }

export function formatearDistancia(metros: number): string {
  return metros < 1000 ? `${Math.round(metros / 10) * 10} m` : `${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Abre la app de mapas del teléfono en la ubicación de la parada. */
export function abrirEnMapas(destino: Coordenadas, nombre: string): void {
  const { latitud, longitud } = destino;
  const etiqueta = encodeURIComponent(nombre);
  const url = Platform.OS === "ios" ? `maps:0,0?q=${etiqueta}@${latitud},${longitud}` : `geo:${latitud},${longitud}?q=${latitud},${longitud}(${etiqueta})`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`).catch(() => undefined));
}
