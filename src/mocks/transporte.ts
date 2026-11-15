import { Aviso, Horario, Linea, Parada } from "../tipos/transporte";

const destinos = [
  "Puerto Viejo — San Agustín", "Centro — Bajada Grande", "Terminal — Parque", "Centro — El Brete",
  "Hospital — Centro", "Costanera — San Agustín", "Terminal — Thompson", "Centro — Acceso Norte",
  "Parque — Bajada Grande", "Centro — La Floresta", "Terminal — Puerto Viejo", "Centro — Anacleto Medina",
  "Costanera — Hospital", "Bajada Grande — Centro"
];
const colores = ["#1B6CA8", "#C65D32", "#37805A", "#8156A8", "#D29A24", "#277D86", "#B84D65"];
export const lineasMock: Linea[] = destinos.map((nombre, i) => ({
  id: `lin-${String(i + 1).padStart(2, "0")}`, numero: String(i + 1), nombre, color: colores[i % colores.length],
  empresa: "Empresa de ejemplo", activa: i !== 8,
  recorridos: [
    { sentido: "ida", destino: `hacia ${nombre.split(" — ")[0]}`, trazado: [{ latitud: -31.7333, longitud: -60.5290 }, { latitud: -31.735 + i * 0.0002, longitud: -60.520 + i * 0.0002 }], paradaIds: ["par-101", "par-102"] },
    { sentido: "vuelta", destino: `hacia ${nombre.split(" — ")[1]}`, trazado: [{ latitud: -31.735, longitud: -60.520 }, { latitud: -31.738 + i * 0.0001, longitud: -60.531 }], paradaIds: ["par-102", "par-101"] }
  ]
}));
export const paradasMock: Parada[] = [
  { id: "par-101", nombre: "Alameda y Urquiza", coordenadas: { latitud: -31.7333, longitud: -60.5241 }, lineaIds: ["lin-05", "lin-14"], sentido: "ida", refugio: true, codigoQr: "PARANA:par-101" },
  { id: "par-102", nombre: "Plaza 1º de Mayo", coordenadas: { latitud: -31.731, longitud: -60.529 }, lineaIds: ["lin-01", "lin-05", "lin-07"], sentido: "vuelta", refugio: false, codigoQr: "PARANA:par-102" },
  { id: "par-103", nombre: "Terminal de Ómnibus", coordenadas: { latitud: -31.740, longitud: -60.516 }, lineaIds: ["lin-02", "lin-11"], sentido: "ida", refugio: true, codigoQr: null },
  { id: "par-104", nombre: "Costanera", coordenadas: { latitud: -31.727, longitud: -60.526 }, lineaIds: ["lin-06", "lin-13"], sentido: "vuelta", refugio: true, codigoQr: "PARANA:par-104" }
];
export const horariosMock: Horario[] = [
  { id: "hor-001", lineaId: "lin-05", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "10:42" },
  { id: "hor-002", lineaId: "lin-05", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "11:02" },
  { id: "hor-003", lineaId: "lin-05", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "11:22" },
  { id: "hor-004", lineaId: "lin-14", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "10:51" },
  { id: "hor-005", lineaId: "lin-14", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "11:21" },
  { id: "hor-006", lineaId: "lin-14", paradaId: "par-101", sentido: "ida", tipoDeDia: "habil", hora: "11:51" },
  { id: "hor-007", lineaId: "lin-01", paradaId: "par-102", sentido: "vuelta", tipoDeDia: "sabado", hora: "12:10" }
];
export const avisosMock: Aviso[] = [
  { id: "avi-001", titulo: "Desvío por obras en calle Corrientes", detalle: "Aviso ficticio: las líneas 2, 7 y 9 usan un recorrido alternativo.", lineaIds: ["lin-02", "lin-07", "lin-09"], desde: "2026-09-14T00:00:00-03:00", hasta: null, gravedad: "desvio", trazadoAlternativo: [{ latitud: -31.7345, longitud: -60.5230 }], videoUrl: null },
  { id: "avi-002", titulo: "Información de servicio", detalle: "Aviso ficticio sin video ni recorrido alternativo.", lineaIds: ["lin-05"], desde: "2026-09-16T08:00:00-03:00", hasta: null, gravedad: "informativo", trazadoAlternativo: null, videoUrl: null }
];
