import { useMemo } from "react";
import { useColorScheme } from "react-native";

/** Colores semánticos de la app. Cada pantalla pide estos nombres, nunca un hexadecimal suelto. */
export interface Paleta {
  fondo: string; tarjeta: string;
  titulo: string; texto: string; suave: string;
  acento: string; acentoFondo: string;
  primario: string; secundario: string; textoSecundario: string;
  borde: string; bordeFuerte: string;
  error: string; exito: string; desvio: string;
  avisoFondo: string; avisoTexto: string; alertaFondo: string; cajaInfo: string;
}

export const CLARO: Paleta = {
  fondo: "#F4F7F8", tarjeta: "#FFFFFF",
  titulo: "#12333B", texto: "#18343B", suave: "#64767C",
  acento: "#147D92", acentoFondo: "#147D92",
  primario: "#12333B", secundario: "#EAF1F2", textoSecundario: "#12333B",
  borde: "#E5ECEE", bordeFuerte: "#B9C9CE",
  error: "#A32626", exito: "#147D58", desvio: "#A85B1B",
  avisoFondo: "#FFF2D8", avisoTexto: "#80520B", alertaFondo: "#FCE8E6", cajaInfo: "#E7F0F2",
};

export const OSCURO: Paleta = {
  fondo: "#0F1A1D", tarjeta: "#18272B",
  titulo: "#E6F1F3", texto: "#D5E3E6", suave: "#9DB2B8",
  acento: "#5CC6DD", acentoFondo: "#147D92",
  primario: "#1E7F94", secundario: "#26393F", textoSecundario: "#E6F1F3",
  borde: "#2B4047", bordeFuerte: "#46616A",
  error: "#FF8A80", exito: "#6FD3A8", desvio: "#E8A15A",
  avisoFondo: "#3A2F14", avisoTexto: "#F2C87A", alertaFondo: "#3B1F1F", cajaInfo: "#1B2F35",
};

/** Paleta según el modo claro u oscuro vigente (el del teléfono o el que eligió la persona). */
export function useColores(): Paleta {
  return useColorScheme() === "dark" ? OSCURO : CLARO;
}

/** Arma los estilos de una pantalla con la paleta vigente y los recalcula solo si cambia el modo. */
export function useEstilos<T>(crear: (c: Paleta) => T): T {
  const c = useColores();
  return useMemo(() => crear(c), [c, crear]);
}
