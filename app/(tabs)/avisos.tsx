import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import type { Aviso } from "../../src/tipos/transporte";
import { cargarAvisos } from "../../src/servicios/avisos";
import { notificarAvisosNuevos } from "../../src/servicios/notificaciones";
import { useSesion } from "../../src/contexto/SesionContext";
import { useCatalogo } from "../../src/hooks/useCatalogo";
import { useEstilos, type Paleta } from "../../src/tema/tema";
import { formatearFecha } from "../../src/utilidades/fechas";
import BannerRed from "../../src/componentes/BannerRed";
import TarjetaAviso from "../../src/componentes/TarjetaAviso";

export default function AvisosScreen() {
  const s = useEstilos(crearEstilos);
  const { usuario } = useSesion();
  const { nombreLinea } = useCatalogo();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [viejos, setViejos] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await cargarAvisos();
      setAvisos(r.avisos);
      setViejos(r.desactualizado ? r.actualizadoEn : null);
      if (usuario) notificarAvisosNuevos(r.avisos, usuario.lineasFavoritas, nombreLinea).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los avisos.");
    }
  }, [usuario, nombreLinea]);

  useFocusEffect(useCallback(() => { cargar().finally(() => setCargando(false)); }, [cargar]));

  return <ScrollView style={s.page} contentContainerStyle={s.content}
    refreshControl={<RefreshControl refreshing={refrescando} onRefresh={async () => { setRefrescando(true); await cargar(); setRefrescando(false); }} />}>
    <Text style={s.title}>Avisos de servicio</Text>
    <Text style={s.sub}>Comunicados vigentes de la Dirección de Transporte. Deslizá hacia abajo para actualizar.</Text>
    <BannerRed />
    {viejos ? <Text style={s.viejo}>Mostrando los avisos descargados el {formatearFecha(viejos)}. Sin conexión no podemos saber si hay novedades.</Text> : null}
    {cargando ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
    {error && !avisos.length ? <>
      <Text style={s.error}>{error}</Text>
      <Pressable onPress={() => { setCargando(true); cargar().finally(() => setCargando(false)); }} style={s.reintentar}><Text style={s.reintentarTexto}>Reintentar</Text></Pressable>
    </> : null}
    {avisos.map(a => <TarjetaAviso key={a.id} aviso={a} nombreLinea={nombreLinea} />)}
    {!cargando && !error && avisos.length === 0 ? <Text style={s.sub}>No hay avisos vigentes. Todas las líneas funcionan con normalidad.</Text> : null}
  </ScrollView>;
}
const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 56, paddingBottom: 40 }, title: { fontSize: 27, fontWeight: "800", color: c.titulo },
  sub: { color: c.suave, marginTop: 6, marginBottom: 10, lineHeight: 20 },
  viejo: { color: c.avisoTexto, backgroundColor: c.avisoFondo, borderRadius: 10, padding: 10, lineHeight: 18, fontSize: 12 },
  error: { color: c.error, marginTop: 12, lineHeight: 20 }, reintentar: { alignSelf: "flex-start", backgroundColor: c.primario, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 12 }, reintentarTexto: { color: "white", fontWeight: "700" }
});
