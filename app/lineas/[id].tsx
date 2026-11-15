import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { Aviso, Horario, Linea, TipoDeDia } from "../../src/tipos/transporte";
import { obtenerLinea } from "../../src/servicios/lineas";
import { cargarAvisos } from "../../src/servicios/avisos";
import { useSesion } from "../../src/contexto/SesionContext";
import { useCatalogo } from "../../src/hooks/useCatalogo";
import { obtenerHorariosCache, obtenerTipoDeDiaCache, obtenerLineaCache, obtenerUltimaSincronizacion } from "../../src/base-datos/db";
import { useEstilos, type Paleta } from "../../src/tema/tema";
import { formatearFecha } from "../../src/utilidades/fechas";
import { vibrarSeleccion } from "../../src/servicios/haptica";
import BannerRed from "../../src/componentes/BannerRed";
import MapaTrazado from "../../src/componentes/MapaTrazado";
import TarjetaAviso from "../../src/componentes/TarjetaAviso";

const NOMBRE_DIA: Record<TipoDeDia, string> = { habil: "Hábil", sabado: "Sábado", domingo: "Domingo", feriado: "Feriado" };
const TIPOS: TipoDeDia[] = ["habil", "sabado", "domingo", "feriado"];

export default function DetalleLineaScreen() {
  const s = useEstilos(crearEstilos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { usuario, alternarLinea } = useSesion();
  const { nombreLinea, nombreParada } = useCatalogo();
  const [linea, setLinea] = useState<Linea | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorFavorito, setErrorFavorito] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [tipoHoy, setTipoHoy] = useState<TipoDeDia>("habil");
  const [tipoDia, setTipoDia] = useState<TipoDeDia | null>(null);
  const [mostrar, setMostrar] = useState(40);
  const [descargaHorarios, setDescargaHorarios] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [avisosViejos, setAvisosViejos] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!id) return;
    setCargando(true);
    (async () => {
      let datos: Linea | null = null;
      try { datos = await obtenerLinea(String(id)); } catch { /* se prueba con lo guardado */ }
      if (!datos) datos = await obtenerLineaCache(db, String(id)).catch(() => null);
      if (vigente) { setLinea(datos); setCargando(false); }
    })();
    // El aviso se ve al abrir la línea afectada, no escondido en otra pantalla.
    cargarAvisos().then(r => { if (vigente) { setAvisos(r.avisos.filter(a => a.lineaIds.includes(String(id)))); setAvisosViejos(r.desactualizado ? r.actualizadoEn : null); } }).catch(() => undefined);
    return () => { vigente = false; };
  }, [id, db]);

  // El tipo de día de hoy (considera feriados) es el que se muestra primero; la persona puede cambiarlo.
  useEffect(() => {
    obtenerTipoDeDiaCache(db).then(hoy => { setTipoHoy(hoy); setTipoDia(previo => previo ?? hoy); }).catch(() => setTipoDia(previo => previo ?? "habil"));
  }, [db]);

  useEffect(() => {
    if (!id || !tipoDia) return;
    let vigente = true;
    setMostrar(40);
    obtenerHorariosCache(db, { lineaId: String(id), tipoDeDia: tipoDia }).then(lista => { if (vigente) setHorarios(lista); }).catch(() => { if (vigente) setHorarios([]); });
    obtenerUltimaSincronizacion(db, `horarios_linea_${id}`).then(d => { if (vigente) setDescargaHorarios(d); }).catch(() => undefined);
    return () => { vigente = false; };
  }, [id, db, tipoDia]);

  if (cargando) return <View style={[s.page, s.centro]}><ActivityIndicator /><Text style={s.sub}>Cargando línea...</Text></View>;
  if (!linea) return <View style={[s.page, s.content]}><Text style={s.text}>No se encontró la línea. Revisá tu conexión o descargá los datos desde la pestaña Líneas.</Text></View>;

  const estado = !linea.activa ? "Servicio suspendido" : avisos.length ? "Con aviso vigente: revisá el desvío" : "Funcionando con normalidad";

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <BannerRed />
    <Text style={s.title}>{nombreLinea(linea.id)}</Text><Text style={s.sub}>{linea.nombre} · {linea.empresa}</Text>
    <Pressable disabled={guardando || !usuario} onPress={async () => {
      setGuardando(true); setErrorFavorito(null);
      try { await alternarLinea(linea.id); vibrarSeleccion(); }
      catch (e) { setErrorFavorito(e instanceof Error ? e.message : "No se pudo actualizar el favorito."); }
      finally { setGuardando(false); }
    }} style={[s.favoriteButton, !usuario && { opacity: 0.55 }]}>
      {guardando ? <ActivityIndicator color="white" /> : <Text style={s.favoriteText}>{usuario?.lineasFavoritas.includes(linea.id) ? "★ Quitar de favoritos" : "☆ Agregar a favoritos"}</Text>}
    </Pressable>
    {!usuario ? <Text style={s.small}>Iniciá sesión o desbloqueá tu cuenta desde la pestaña Yo para guardar esta línea.</Text> : null}
    {errorFavorito ? <Text style={s.error}>{errorFavorito}</Text> : null}
    <View style={[s.banner, { backgroundColor: !linea.activa ? "#A32626" : avisos.length ? "#A85B1B" : linea.color }]}><Text style={s.white}>{estado}</Text></View>

    {avisosViejos ? <Text style={s.viejo}>Sin conexión: estos avisos se descargaron el {formatearFecha(avisosViejos)} y pueden haber cambiado.</Text> : null}
    {avisos.map(a => <TarjetaAviso key={a.id} aviso={a} nombreLinea={nombreLinea} />)}

    <Text style={s.heading}>Recorridos</Text>
    {linea.recorridos.map(r => <View key={r.sentido} style={s.card}>
      <Text style={s.cardTitle}>{r.sentido === "ida" ? "Ida" : "Vuelta"} · {r.destino}</Text>
      <MapaTrazado trazado={r.trazado} color={linea.color} etiquetaInicio={`Inicio (${r.sentido})`} etiquetaFin={`Fin (${r.sentido})`} />
      <Text style={s.subheading}>Paradas en orden</Text>
      {r.paradaIds.length ? r.paradaIds.map((paradaId, i) => <Link key={`${paradaId}-${i}`} href={{ pathname: "/paradas/[id]", params: { id: paradaId } }} asChild>
        <Pressable style={s.stopRow} accessibilityRole="link"><Text style={s.stopNumber}>{i + 1}</Text><Text style={s.stopName}>{nombreParada(paradaId)}</Text><Text style={s.arrow}>›</Text></Pressable>
      </Link>) : <Text style={s.sub}>Este sentido no tiene paradas cargadas.</Text>}
    </View>)}

    <Text style={s.heading}>Horarios</Text>
    <View style={s.pills}>{TIPOS.map(tipo => <Pressable key={tipo} onPress={() => setTipoDia(tipo)} style={[s.pill, tipoDia === tipo && s.pillActiva]} accessibilityRole="button" accessibilityState={{ selected: tipoDia === tipo }}>
      <Text style={[s.pillTexto, tipoDia === tipo && s.pillTextoActiva]}>{NOMBRE_DIA[tipo]}{tipo === tipoHoy ? " (hoy)" : ""}</Text>
    </Pressable>)}</View>
    <Text style={s.sub}>Horarios de tabla guardados en el teléfono{descargaHorarios ? `, descargados el ${formatearFecha(descargaHorarios)}` : ""}. No son llegadas en vivo.</Text>
    {horarios.length ? <>
      <Text style={s.sub}>{horarios.length} horarios para este tipo de día.</Text>
      {horarios.slice(0, mostrar).map(h => <Text key={h.id} style={s.scheduleRow}>{h.hora} · {h.sentido} · {nombreParada(h.paradaId)}</Text>)}
      {horarios.length > mostrar ? <Pressable onPress={() => setMostrar(n => n + 40)} style={s.verMas}><Text style={s.verMasTexto}>Ver más horarios</Text></Pressable> : null}
    </> : <Text style={s.sub}>No hay horarios descargados para esta línea en un día {NOMBRE_DIA[tipoDia ?? "habil"].toLowerCase()}. Con conexión, usá «Descargar / actualizar datos» en la pestaña Líneas.</Text>}
  </ScrollView>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18 }, centro: { alignItems: "center", justifyContent: "center" }, title: { fontSize: 28, fontWeight: "800", color: c.titulo, marginTop: 8 },
  text: { color: c.texto, lineHeight: 21 }, sub: { color: c.suave, marginTop: 5, lineHeight: 20 }, banner: { padding: 14, borderRadius: 12, marginTop: 16 }, white: { color: "white", fontWeight: "700" },
  heading: { fontSize: 20, fontWeight: "800", marginTop: 22, marginBottom: 10, color: c.titulo }, card: { backgroundColor: c.tarjeta, padding: 14, borderRadius: 12, marginBottom: 10 },
  favoriteButton: { backgroundColor: c.primario, padding: 12, borderRadius: 9, alignItems: "center", marginTop: 14 }, favoriteText: { color: "white", fontWeight: "800" }, error: { color: c.error, marginTop: 8 },
  cardTitle: { fontWeight: "800", fontSize: 16, color: c.texto, marginBottom: 2 }, small: { color: c.acento, fontSize: 12, marginTop: 8 },
  subheading: { fontWeight: "800", color: c.texto, marginTop: 14, marginBottom: 4 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.borde }, stopNumber: { width: 24, color: c.suave, fontWeight: "700", textAlign: "right" }, stopName: { flex: 1, color: c.texto }, arrow: { fontSize: 22, color: c.suave },
  scheduleRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.borde, color: c.texto },
  viejo: { color: c.avisoTexto, backgroundColor: c.avisoFondo, borderRadius: 10, padding: 10, marginTop: 12, lineHeight: 18, fontSize: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 }, pill: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: c.borde, backgroundColor: c.tarjeta },
  pillActiva: { backgroundColor: c.primario, borderColor: c.primario }, pillTexto: { color: c.texto, fontWeight: "700", fontSize: 12 }, pillTextoActiva: { color: "white" },
  verMas: { alignSelf: "flex-start", backgroundColor: c.secundario, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 9, marginTop: 12 }, verMasTexto: { color: c.textoSecundario, fontWeight: "700" }
});
