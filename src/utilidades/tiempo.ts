/** Minutos que faltan para una hora de tabla "HH:MM". Si ya pasó hoy, cuenta hasta mañana. */
export function minutosHasta(hora: string, ahora: Date = new Date()): { minutos: number; esManana: boolean } {
  const [h, m] = hora.split(":").map(Number);
  const actual = ahora.getHours() * 60 + ahora.getMinutes();
  const objetivo = h * 60 + m;
  if (objetivo >= actual) return { minutos: objetivo - actual, esManana: false };
  return { minutos: objetivo + 1440 - actual, esManana: true };
}

/**
 * Texto honesto para un horario: la app no tiene GPS en los colectivos, así que siempre aclara
 * que es la hora de la tabla y nunca promete una llegada.
 */
export function describirEspera(hora: string, ahora: Date = new Date()): string {
  const { minutos, esManana } = minutosHasta(hora, ahora);
  if (esManana) return "mañana, según la tabla";
  if (minutos === 0) return "ahora, según la tabla";
  if (minutos < 60) return `en ${minutos} min, según la tabla`;
  return `en ${Math.floor(minutos / 60)} h ${minutos % 60} min, según la tabla`;
}
