import { StyleSheet, Text, View } from "react-native";
import type { Aviso, Gravedad } from "../tipos/transporte";
import { useEstilos, useColores, type Paleta } from "../tema/tema";
import { formatearFecha } from "../utilidades/fechas";
import MapaTrazado from "./MapaTrazado";
import VideoAviso from "./VideoAviso";

const ETIQUETA: Record<Gravedad, string> = { informativo: "INFORMATIVO", desvio: "DESVÍO", suspension: "SUSPENSIÓN" };

/** Un aviso completo: gravedad, texto, líneas afectadas, vigencia, recorrido alternativo en el mapa y video. */
export default function TarjetaAviso({ aviso, nombreLinea }: { aviso: Aviso; nombreLinea: (id: string) => string }) {
  const s = useEstilos(crearEstilos);
  const c = useColores();
  const color = aviso.gravedad === "suspension" ? c.error : aviso.gravedad === "desvio" ? c.desvio : c.acento;
  const trazado = aviso.trazadoAlternativo ?? [];
  return <View style={s.card}>
    <Text style={[s.badge, { color }]}>{ETIQUETA[aviso.gravedad] ?? String(aviso.gravedad).toUpperCase()}</Text>
    <Text style={s.name}>{aviso.titulo}</Text>
    <Text style={s.sub}>{aviso.detalle}</Text>
    {aviso.lineaIds.length ? <Text style={s.small}>Afecta a: {aviso.lineaIds.map(nombreLinea).join(", ")}</Text> : null}
    <Text style={s.small}>Desde {formatearFecha(aviso.desde)}{aviso.hasta ? ` hasta ${formatearFecha(aviso.hasta)}` : ", sin fecha de fin prevista"}</Text>
    {trazado.length > 0 ? <>
      <Text style={s.subheading}>Recorrido alternativo</Text>
      <MapaTrazado trazado={trazado} color={c.desvio} etiquetaInicio="Inicio del desvío" etiquetaFin="Fin del desvío" />
    </> : null}
    {aviso.videoUrl ? <VideoAviso avisoId={aviso.id} url={aviso.videoUrl} /> : null}
  </View>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  card: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 15, marginTop: 10 },
  badge: { fontWeight: "800", fontSize: 11, marginBottom: 8 },
  name: { fontSize: 17, fontWeight: "800", color: c.texto },
  sub: { color: c.suave, marginTop: 6, lineHeight: 20 },
  small: { color: c.suave, marginTop: 6, fontSize: 12 },
  subheading: { fontWeight: "800", color: c.texto, marginTop: 14 },
});
