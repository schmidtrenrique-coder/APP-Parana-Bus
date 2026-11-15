import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Parada, Coordenadas } from "../../src/tipos/transporte";
import { obtenerParadas, obtenerParadasCercanas } from "../../src/servicios/paradas";
import { useSQLiteContext } from "expo-sqlite";
import { obtenerParadasCache } from "../../src/base-datos/db";
import { distanciaMetros } from "../../src/utilidades/geo";
import { obtenerUbicacion } from "../../src/utilidades/ubicacion";
import BannerRed from "../../src/componentes/BannerRed";

import { useEstilos, type Paleta } from "../../src/tema/tema";
export default function ParadasScreen() {
  const db = useSQLiteContext();
  const s = useEstilos(crearEstilos);
  const router = useRouter();
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [buscandoCercanas, setBuscandoCercanas] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState<string | null>(null);
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [modoCercanas, setModoCercanas] = useState(false);

  useEffect(() => {
    if (modoCercanas) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      setCargando(true);
      setError(null);
      try {
        const resultado = await obtenerParadas(busqueda);
        if (vigente) setParadas(resultado);
      } catch (e) {
        const guardadas = await obtenerParadasCache(db);
        const q = busqueda.trim().toLocaleLowerCase("es-AR");
        const filtradas = q ? guardadas.filter(p => p.nombre.toLocaleLowerCase("es-AR").includes(q)) : guardadas;
        if (vigente) { setParadas(filtradas); if (!filtradas.length) setError(e instanceof Error ? e.message : "No se pudieron cargar las paradas."); }
      } finally {
        if (vigente) setCargando(false);
      }
    }, busqueda.trim() ? 300 : 0);
    return () => { vigente = false; clearTimeout(temporizador); };
  }, [busqueda, intento, db, modoCercanas]);

  async function cargarCercanas() {
    setBuscandoCercanas(true);
    setErrorUbicacion(null);
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== "granted") throw new Error("Necesitamos permiso de ubicación para buscar paradas cercanas. También podés seguir buscando por nombre.");
      const coords = await obtenerUbicacion();
      if (!coords) throw new Error("No pudimos obtener tu ubicación. Revisá que esté activada en el teléfono e intentá de nuevo. También podés buscar por nombre.");
      setUbicacion(coords);
      setModoCercanas(true);
      try {
        const cercanas = await obtenerParadasCercanas(coords);
        setParadas(cercanas);
        setBusqueda("");
        if (!cercanas.length) setErrorUbicacion("No encontramos paradas dentro de los 2 km.");
      } catch {
        const guardadas = await obtenerParadasCache(db);
        const cercanas = guardadas
          .filter(p => Number.isFinite(p.coordenadas?.latitud) && Number.isFinite(p.coordenadas?.longitud))
          .map(p => ({ parada: p, distancia: distanciaMetros(coords, p.coordenadas) }))
          .filter(x => x.distancia <= 2000)
          .sort((a, b) => a.distancia - b.distancia)
          .map(x => x.parada);
        setParadas(cercanas);
        setBusqueda("");
        if (!cercanas.length) setErrorUbicacion("No hay paradas cercanas guardadas en el teléfono. Conectate a internet para consultar la API.");
      }
      setMostrarMapa(true);
    } catch (e) {
      setErrorUbicacion(e instanceof Error ? e.message : "No se pudo obtener tu ubicación.");
    } finally {
      setBuscandoCercanas(false);
    }
  }

  const region: Region | undefined = ubicacion ? { latitude: ubicacion.latitud, longitude: ubicacion.longitud, latitudeDelta: 0.025, longitudeDelta: 0.025 } : undefined;

  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Paradas</Text>
    <BannerRed />
    <TextInput value={busqueda} onChangeText={texto => { setModoCercanas(false); setBusqueda(texto); }} placeholder="Buscar por nombre o calle" style={s.input} />
    <View style={s.acciones}>
      <Pressable onPress={cargarCercanas} disabled={buscandoCercanas} style={s.boton}><Text style={s.botonTexto}>{buscandoCercanas ? "Buscando..." : "⌖ Paradas cercanas"}</Text></Pressable>
      <Pressable onPress={() => router.push("/qr")} style={[s.boton, s.botonSecundario]}><Text style={s.botonTextoSecundario}>▦ Escanear QR</Text></Pressable>
    </View>
    {errorUbicacion ? <Text style={s.error}>{errorUbicacion}</Text> : null}
    {ubicacion && <Pressable onPress={() => setMostrarMapa(v => !v)} style={s.mapaToggle}><Text style={s.mapaToggleTexto}>{mostrarMapa ? "Ocultar mapa" : "Ver mapa de paradas"}</Text></Pressable>}
    {mostrarMapa && region && <View style={s.mapaContenedor}>
      <MapView style={s.mapa} initialRegion={region} region={region} showsUserLocation>
        {paradas.filter(p => Number.isFinite(p.coordenadas?.latitud) && Number.isFinite(p.coordenadas?.longitud)).map(p => <Marker key={p.id} coordinate={{ latitude: p.coordenadas.latitud, longitude: p.coordenadas.longitud }} title={p.nombre} description="Tocá para ver horarios" onCalloutPress={() => router.push({ pathname: "/paradas/[id]", params: { id: p.id } })} />)}
      </MapView>
      <Text style={s.sub}>Paradas registradas en la API o guardadas en el teléfono. No se muestra la ubicación de los colectivos.</Text>
    </View>}
    {cargando && <View style={s.estado}><ActivityIndicator /><Text style={s.sub}> Cargando paradas...</Text></View>}
    {!cargando && error && <View style={s.estado}><Text style={s.error}>{error}</Text><Pressable onPress={() => setIntento(n => n + 1)} style={s.retry}><Text style={s.retryText}>Reintentar</Text></Pressable></View>}
    {!cargando && !error && paradas.length > 0 && <Text style={s.sub}>Las paradas guardadas también se muestran si no hay conexión.</Text>}
    {!cargando && !error && paradas.map(p => <Link key={p.id} href={{ pathname: "/paradas/[id]", params: { id: p.id } }} style={s.card}>
      <View style={{ flex: 1 }}><Text style={s.name}>{p.nombre}</Text><Text style={s.sub}>{p.lineaIds.length} líneas · {p.refugio ? "Tiene refugio" : "Sin refugio"}</Text></View><Text style={s.arrow}>›</Text>
    </Link>)}
    {!cargando && !error && paradas.length === 0 && <Text style={s.sub}>No se encontraron paradas.</Text>}
  </ScrollView>;
}
const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 56 }, title: { fontSize: 27, fontWeight: "800", color: c.titulo, marginBottom: 14 },
  input: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: c.borde },
  acciones: { flexDirection: "row", gap: 8, marginBottom: 8 }, boton: { flex: 1, backgroundColor: c.primario, padding: 12, borderRadius: 9, alignItems: "center" }, botonTexto: { color: "white", fontWeight: "700" }, botonSecundario: { backgroundColor: c.tarjeta, borderWidth: 1, borderColor: c.bordeFuerte }, botonTextoSecundario: { color: c.titulo, fontWeight: "700" },
  card: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 14, marginBottom: 9, flexDirection: "row", alignItems: "center" },
  name: { fontWeight: "800", color: c.texto }, sub: { color: c.suave, marginTop: 5, lineHeight: 19 }, arrow: { fontSize: 26, color: c.suave },
  estado: { paddingVertical: 12 }, error: { color: c.error, fontWeight: "600", marginVertical: 7 }, retry: { alignSelf: "flex-start", backgroundColor: c.primario, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 12 }, retryText: { color: "white", fontWeight: "700" },
  mapaToggle: { paddingVertical: 10 }, mapaToggleTexto: { color: c.acento, fontWeight: "800" }, mapaContenedor: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 8, marginBottom: 12 }, mapa: { height: 270, borderRadius: 9 }
});
