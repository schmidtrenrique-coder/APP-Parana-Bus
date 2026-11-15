import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Linea } from "../../src/tipos/transporte";
import { obtenerLineas } from "../../src/servicios/lineas";
import { sincronizarDatosOffline } from "../../src/servicios/horarios";
import { obtenerLineasCache, obtenerUltimaSincronizacion } from "../../src/base-datos/db";
import BannerRed from "../../src/componentes/BannerRed";

import { useEstilos, type Paleta } from "../../src/tema/tema";
export default function LineasScreen() {
  const db = useSQLiteContext();
  const s = useEstilos(crearEstilos);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [estadoSync, setEstadoSync] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const datos = await obtenerLineas();
        if (vigente) setLineas(datos);
      } catch (e) {
        const guardadas = await obtenerLineasCache(db);
        if (vigente) {
          setLineas(guardadas);
          if (!guardadas.length) setError(e instanceof Error ? e.message : "No se pudieron cargar las líneas.");
        }
      } finally { if (vigente) setCargando(false); }
    })();
    obtenerUltimaSincronizacion(db, "feriados_2027").then(v => { if (vigente) setUltimaSync(v); }).catch(() => {});
    return () => { vigente = false; };
  }, [db]);

  const descargar = async () => {
    setSincronizando(true); setError(null); setEstadoSync("Preparando descarga...");
    try {
      await sincronizarDatosOffline(db, setEstadoSync);
      setUltimaSync(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron descargar los datos.");
    } finally { setSincronizando(false); }
  };

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.title}>Líneas de colectivos</Text>
    <Text style={s.sub}>Elegí una línea para consultar sus recorridos y horarios.</Text>
    <BannerRed />
    <View style={s.offlineBox}>
      <Text style={s.offlineTitle}>Horarios sin conexión</Text>
      <Text style={s.sub}>Descargá las tablas de horarios y los feriados para poder consultarlos aunque no tengas internet.</Text>
      <Pressable disabled={sincronizando} onPress={descargar} style={[s.syncButton, sincronizando && { opacity: 0.7 }]}>
        {sincronizando ? <ActivityIndicator color="white" /> : <Text style={s.syncText}>Descargar / actualizar datos</Text>}
      </Pressable>
      {sincronizando ? <Text style={s.small}>{estadoSync}</Text> : null}
      {ultimaSync ? <Text style={s.small}>Última descarga: {new Date(ultimaSync).toLocaleString("es-AR")}</Text> : <Text style={s.small}>Todavía no hay una descarga guardada.</Text>}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
    {cargando ? <ActivityIndicator /> : null}
    {!cargando && error && !lineas.length ? <Text style={s.error}>No se pudieron cargar las líneas. Revisá la conexión y volvé a intentarlo.</Text> : null}
    {lineas.map(l => <Link key={l.id} href={{ pathname: "/lineas/[id]", params: { id: l.id } }} style={s.card}>
      <View style={[s.stripe, { backgroundColor: l.color }]} />
      <View style={{ flex: 1 }}><Text style={s.name}>Línea {l.numero}</Text><Text style={s.sub}>{l.nombre}</Text><Text style={s.small}>{l.activa ? "Servicio habilitado" : "Servicio suspendido"}</Text></View>
      <Text style={s.arrow}>›</Text>
    </Link>)}
  </ScrollView>;
}
const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 56 },
  title: { fontSize: 27, fontWeight: "800", color: c.titulo }, sub: { color: c.suave, marginTop: 4, marginBottom: 12 },
  offlineBox: { backgroundColor: c.cajaInfo, padding: 14, borderRadius: 12, marginBottom: 18 }, offlineTitle: { color: c.titulo, fontWeight: "800", fontSize: 17 },
  syncButton: { backgroundColor: c.primario, padding: 12, borderRadius: 9, alignItems: "center", marginVertical: 8 }, syncText: { color: "white", fontWeight: "800" },
  card: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 13, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 12 },
  stripe: { width: 8, height: 54, borderRadius: 5 }, name: { fontWeight: "800", fontSize: 16, color: c.texto },
  small: { color: c.acento, fontSize: 12, marginTop: 4 }, arrow: { fontSize: 26, color: c.suave }, error: { color: c.error, marginTop: 8 }
});
