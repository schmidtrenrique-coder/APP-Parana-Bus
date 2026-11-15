import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { Parada, Horario, ReporteDeDemora } from "../../src/tipos/transporte";
import { obtenerParada } from "../../src/servicios/paradas";
import { obtenerProximos, obtenerProximosOffline } from "../../src/servicios/horarios";
import { useSesion } from "../../src/contexto/SesionContext";
import { useCatalogo } from "../../src/hooks/useCatalogo";
import { obtenerParadaCache } from "../../src/base-datos/db";
import { confirmarReporteDeDemora, obtenerReportesDeParada } from "../../src/servicios/reportes";
import { programarRecordatorioHorario } from "../../src/servicios/notificaciones";
import { vibrarError, vibrarExito, vibrarSeleccion } from "../../src/servicios/haptica";
import { useEstilos, type Paleta } from "../../src/tema/tema";
import { describirEspera, minutosHasta } from "../../src/utilidades/tiempo";
import BannerRed from "../../src/componentes/BannerRed";
import FlechaParada from "../../src/componentes/FlechaParada";

export default function DetalleParadaScreen() {
  const s = useEstilos(crearEstilos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { usuario, alternarParada } = useSesion();
  const { nombreLinea, colorLinea } = useCatalogo();
  const [parada, setParada] = useState<Parada | null>(null);
  const [guardandoFavorito, setGuardandoFavorito] = useState(false);
  const [errorFavorito, setErrorFavorito] = useState<string | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [reportes, setReportes] = useState<ReporteDeDemora[]>([]);
  const [errorReportes, setErrorReportes] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [mensajeReporte, setMensajeReporte] = useState<string | null>(null);
  const [recordatorioEnCurso, setRecordatorioEnCurso] = useState<string | null>(null);
  const [mensajeRecordatorio, setMensajeRecordatorio] = useState<string | null>(null);
  const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!id) return;
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerParada(String(id)).catch(async () => obtenerParadaCache(db, String(id))),
      obtenerProximos(String(id)).catch(async () => obtenerProximosOffline(db, String(id), 3))
    ])
      .then(([p, h]) => { if (vigente) { setParada(p); setHorarios(h.slice(0, 10)); } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar la información."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [id, intento, db]);

  useFocusEffect(useCallback(() => {
    let vigente = true;
    if (id) {
      setErrorReportes(null);
      obtenerReportesDeParada(String(id))
        .then(lista => { if (vigente) setReportes(lista); })
        .catch(() => { if (vigente) setErrorReportes("Los reportes de otros pasajeros requieren conexión. Ahora no se pueden mostrar."); });
    }
    return () => { vigente = false; };
  }, [id]));

  async function recordar(h: Horario) {
    const clave = `${h.lineaId}-${h.hora}`;
    setRecordatorioEnCurso(clave); setMensajeRecordatorio(null); setErrorRecordatorio(null);
    try {
      await programarRecordatorioHorario(db, { paradaId: String(id), lineaId: h.lineaId, hora: h.hora });
      vibrarExito();
      setMensajeRecordatorio(`Te avisaremos 10 minutos antes del servicio de las ${h.hora}. Podés administrar tus recordatorios desde la pestaña Yo.`);
    } catch (e) { vibrarError(); setErrorRecordatorio(e instanceof Error ? e.message : "No se pudo programar el recordatorio."); }
    finally { setRecordatorioEnCurso(null); }
  }

  async function confirmar(idReporte: string) {
    setConfirmando(idReporte); setErrorReportes(null); setMensajeReporte(null);
    try {
      const actualizado = await confirmarReporteDeDemora(idReporte);
      setReportes(lista => lista.map(r => r.id === actualizado.id ? actualizado : r));
      vibrarExito();
      setMensajeReporte("Confirmación registrada. ¡Gracias!");
    } catch (e) {
      vibrarError();
      setErrorReportes(e instanceof Error ? e.message : "No se pudo confirmar el reporte.");
    } finally { setConfirmando(null); }
  }

  if (cargando) return <View style={[s.page, s.center]}><ActivityIndicator /><Text style={s.sub}>Cargando parada...</Text></View>;
  if (error) return <View style={[s.page, s.content]}><Text style={s.error}>{error}</Text><Pressable onPress={() => setIntento(n => n + 1)} style={s.retry}><Text style={s.retryText}>Reintentar</Text></Pressable></View>;
  if (!parada) return <View style={[s.page, s.content]}><Text style={s.text}>No se encontró la parada. Revisá tu conexión o descargá los datos desde la pestaña Líneas.</Text></View>;

  const ahora = new Date();
  const terminoHoy = horarios.length > 0 && horarios.every(h => minutosHasta(h.hora, ahora).esManana);

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <BannerRed />
    <Text style={s.title}>{parada.nombre}</Text><Text style={s.sub}>Código: {parada.id} · {parada.refugio ? "Tiene refugio" : "Sin refugio"}</Text>
    <Pressable disabled={guardandoFavorito || !usuario} onPress={async () => {
      setGuardandoFavorito(true); setErrorFavorito(null);
      try { await alternarParada(parada.id); vibrarSeleccion(); }
      catch (e) { setErrorFavorito(e instanceof Error ? e.message : "No se pudo actualizar el favorito."); }
      finally { setGuardandoFavorito(false); }
    }} style={[s.retry, !usuario && { opacity: 0.55 }]}>
      <Text style={s.retryText}>{guardandoFavorito ? "Guardando..." : usuario?.paradasFavoritas.includes(parada.id) ? "★ Quitar de favoritos" : "☆ Agregar a favoritos"}</Text>
    </Pressable>
    {!usuario ? <Text style={s.sub}>Iniciá sesión o desbloqueá tu cuenta desde la pestaña Yo para guardar esta parada.</Text> : null}
    {errorFavorito ? <Text style={s.error}>{errorFavorito}</Text> : null}

    <FlechaParada destino={parada.coordenadas} nombre={parada.nombre} />

    <View style={s.card}><Text style={s.heading}>Líneas que paran aquí</Text>
      {parada.lineaIds.length ? <View style={s.chips}>{parada.lineaIds.map(lineaId => <Link key={lineaId} href={{ pathname: "/lineas/[id]", params: { id: lineaId } }} asChild>
        <Pressable style={[s.chip, { backgroundColor: colorLinea(lineaId) }]}><Text style={s.chipText}>{nombreLinea(lineaId)}</Text></Pressable>
      </Link>)}</View> : <Text style={s.text}>No hay líneas asociadas.</Text>}
    </View>

    <View style={s.card}><Text style={s.heading}>Próximos servicios</Text>
      {terminoHoy ? <Text style={s.fin}>Ya pasó el último servicio de hoy. El próximo es mañana a las {[...horarios].sort((a, b) => a.hora.localeCompare(b.hora))[0].hora}.</Text> : null}
      {horarios.length ? horarios.map((h, i) => <View key={`${h.lineaId}-${h.hora}-${i}`} style={s.scheduleItem}>
        <View style={{ flex: 1 }}>
          <Text style={s.time}>{nombreLinea(h.lineaId)} · {h.hora}</Text>
          <Text style={s.when}>{describirEspera(h.hora, ahora)} · {h.sentido}</Text>
        </View>
        <Pressable disabled={recordatorioEnCurso === `${h.lineaId}-${h.hora}`} onPress={() => recordar(h)} style={s.reminderButton}><Text style={s.reminderButtonText}>{recordatorioEnCurso === `${h.lineaId}-${h.hora}` ? "..." : "Recordarme"}</Text></Pressable>
      </View>) : <Text style={s.text}>No hay más servicio para esta parada hoy ni mañana.</Text>}
      {mensajeRecordatorio ? <Text style={s.reportSuccess}>{mensajeRecordatorio}</Text> : null}
      {errorRecordatorio ? <Text style={s.errorSuave}>{errorRecordatorio}</Text> : null}
      <Text style={s.sub}>Horarios de tabla: no son llegadas en vivo, porque los colectivos no tienen GPS.</Text>
    </View>

    <Link href={{ pathname: "/paradas/[id]/reportar", params: { id: parada.id } }} asChild>
      <Pressable style={s.reportButton}><Text style={s.reportButtonText}>＋ Reportar una demora</Text></Pressable>
    </Link>
    <View style={s.card}><Text style={s.heading}>Reportes recientes</Text>
      {errorReportes ? <Text style={s.errorSuave}>{errorReportes}</Text> : null}
      {mensajeReporte ? <Text style={s.reportSuccess}>{mensajeReporte}</Text> : null}
      {reportes.length ? reportes.map(r => <View key={r.id} style={s.reportItem}>
        <Text style={s.reportTitle}>{nombreLinea(r.lineaId)} · {r.motivo.replaceAll("_", " ")}</Text>
        {r.comentario ? <Text style={s.sub}>{r.comentario}</Text> : null}
        {r.fotoUri ? <Image source={{ uri: r.fotoUri }} style={s.reportPhoto} resizeMode="cover" /> : null}
        <Text style={s.sub}>{new Date(r.fechaHora).toLocaleString("es-AR")} · {r.confirmaciones} confirmación(es)</Text>
        {r.usuarioId === usuario?.id ? <Text style={s.reportOwn}>Tu reporte</Text> : usuario ? <Pressable disabled={confirmando === r.id} onPress={() => confirmar(r.id)} style={s.confirmButton}><Text style={s.confirmText}>{confirmando === r.id ? "Confirmando..." : "Confirmar que también ocurre"}</Text></Pressable> : <Text style={s.sub}>Iniciá sesión para confirmar este reporte.</Text>}
      </View>) : !errorReportes ? <Text style={s.sub}>No hay reportes recientes para esta parada.</Text> : null}
      <Text style={s.sub}>Solo se muestran reportes de los últimos 90 minutos.</Text>
    </View>
  </ScrollView>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingBottom: 40 }, center: { alignItems: "center", justifyContent: "center" }, title: { fontSize: 26, fontWeight: "800", color: c.titulo, marginTop: 8 },
  text: { color: c.texto, lineHeight: 21 }, sub: { color: c.suave, marginTop: 6, lineHeight: 20 }, card: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 15, marginTop: 14 },
  heading: { fontWeight: "800", fontSize: 17, marginBottom: 10, color: c.texto },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 }, chipText: { color: "white", fontWeight: "800" },
  reportButton: { backgroundColor: c.acentoFondo, borderRadius: 9, padding: 13, alignItems: "center", marginTop: 16 }, reportButtonText: { color: "white", fontWeight: "800" },
  reportItem: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.borde }, reportPhoto: { width: 112, height: 84, borderRadius: 8, marginTop: 8 }, reportTitle: { color: c.texto, fontWeight: "800" }, reportOwn: { color: c.suave, fontWeight: "700", marginTop: 8 },
  confirmButton: { alignSelf: "flex-start", backgroundColor: c.secundario, padding: 9, borderRadius: 8, marginTop: 8 }, confirmText: { color: c.textoSecundario, fontWeight: "700" }, reportSuccess: { color: c.exito, marginBottom: 8, lineHeight: 19 },
  fin: { color: c.avisoTexto, backgroundColor: c.avisoFondo, borderRadius: 9, padding: 10, marginBottom: 8, lineHeight: 19 },
  time: { paddingTop: 8, color: c.texto, fontWeight: "700" }, when: { color: c.suave, paddingBottom: 8, fontSize: 12 },
  scheduleItem: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: c.borde, gap: 8 },
  reminderButton: { backgroundColor: c.secundario, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 7 }, reminderButtonText: { color: c.textoSecundario, fontWeight: "700", fontSize: 12 },
  error: { color: c.error, fontWeight: "700", marginTop: 18 }, errorSuave: { color: c.error, marginBottom: 8, lineHeight: 19 },
  retry: { alignSelf: "flex-start", backgroundColor: c.primario, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 14 }, retryText: { color: "white", fontWeight: "700" }
});
