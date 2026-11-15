import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import * as Location from "expo-location";
import type { Aviso, Coordenadas, Horario, Parada } from "../../src/tipos/transporte";
import { cargarAvisos } from "../../src/servicios/avisos";
import { obtenerParada } from "../../src/servicios/paradas";
import { obtenerProximos, obtenerProximosOffline } from "../../src/servicios/horarios";
import { obtenerParadaCache } from "../../src/base-datos/db";
import { notificarAvisosNuevos } from "../../src/servicios/notificaciones";
import { useSesion } from "../../src/contexto/SesionContext";
import { useCatalogo } from "../../src/hooks/useCatalogo";
import { useEstilos, type Paleta } from "../../src/tema/tema";
import { describirEspera } from "../../src/utilidades/tiempo";
import { formatearFecha } from "../../src/utilidades/fechas";
import { distanciaMetros, formatearDistancia } from "../../src/utilidades/geo";
import { obtenerUbicacion } from "../../src/utilidades/ubicacion";
import BannerRed from "../../src/componentes/BannerRed";
import MapaParadasCercanas from "../../src/componentes/MapaParadasCercanas";

export default function InicioScreen() {
  const s = useEstilos(crearEstilos);
  const { usuario } = useSesion();
  const { lineas, paradas, nombreLinea, colorLinea } = useCatalogo();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [avisosViejos, setAvisosViejos] = useState<string | null>(null);
  const [cargandoAvisos, setCargandoAvisos] = useState(true);
  const [errorAvisos, setErrorAvisos] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setErrorAvisos(null);
    try {
      const r = await cargarAvisos();
      setAvisos(r.avisos);
      setAvisosViejos(r.desactualizado ? r.actualizadoEn : null);
      if (usuario) notificarAvisosNuevos(r.avisos, usuario.lineasFavoritas, nombreLinea).catch(() => undefined);
    } catch (e) {
      setErrorAvisos(e instanceof Error ? e.message : "No se pudieron cargar los avisos.");
    } finally { setCargandoAvisos(false); }
  }, [usuario, nombreLinea]);
  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));


  // Paradas cercanas: solo se usa la ubicación si la persona ya dio permiso o lo pide con el botón; si la niega, la app sigue igual.
  const [permisoUbicacion, setPermisoUbicacion] = useState<"desconocido" | "concedido" | "denegado">("desconocido");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  const [sinUbicacion, setSinUbicacion] = useState(false);

  const leerUbicacion = useCallback(async () => {
    setBuscandoUbicacion(true);
    setSinUbicacion(false);
    const coords = await obtenerUbicacion();
    if (coords) setUbicacion(coords); else setSinUbicacion(true);
    setBuscandoUbicacion(false);
  }, []);

  useFocusEffect(useCallback(() => {
    Location.getForegroundPermissionsAsync().then(p => {
      if (p.granted) { setPermisoUbicacion("concedido"); leerUbicacion(); }
      else if (p.status === "denied" && !p.canAskAgain) setPermisoUbicacion("denegado");
    }).catch(() => undefined);
  }, [leerUbicacion]));

  async function pedirUbicacion() {
    const p = await Location.requestForegroundPermissionsAsync().catch(() => null);
    if (p?.granted) { setPermisoUbicacion("concedido"); await leerUbicacion(); } else setPermisoUbicacion("denegado");
  }

  const cercanas = useMemo(() => ubicacion
    ? paradas.map(parada => ({ parada, metros: distanciaMetros(ubicacion, parada.coordenadas) })).filter(x => x.metros <= 2000).sort((a, b) => a.metros - b.metros).slice(0, 5)
    : [], [ubicacion, paradas]);

  const lineasFavoritas = usuario ? lineas.filter(l => usuario.lineasFavoritas.includes(l.id)) : [];
  const paradasFavoritas = usuario ? usuario.paradasFavoritas.slice(0, 3) : [];

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={s.encabezado}>
      <Image source={require("../../assets/icon.png")} style={s.logo} accessibilityLabel="Logo de Paraná Bus" />
      <View>
        <Text style={s.brand}>Paraná Bus</Text>
        <Text style={s.subtitle}>Tu ciudad, mejor conectada</Text>
      </View>
    </View>
    <BannerRed />

    {usuario ? <>
      <Text style={s.heading}>Tus favoritos</Text>
      {paradasFavoritas.map(id => <ParadaFavorita key={id} id={id} nombreLinea={nombreLinea} />)}
      {lineasFavoritas.map(l => <Link key={l.id} href={{ pathname: "/lineas/[id]", params: { id: l.id } }} asChild>
        <Pressable style={s.card}>
          <View style={[s.dot, { backgroundColor: l.color }]} />
          <View style={{ flex: 1 }}><Text style={s.cardTitle}>Línea {l.numero}</Text><Text style={s.muted}>{l.nombre}</Text></View>
          <Text style={s.arrow}>›</Text>
        </Pressable>
      </Link>)}
      {!paradasFavoritas.length && !lineasFavoritas.length ? <Text style={s.muted}>Todavía no marcaste favoritos. Entrá a una línea o una parada y tocá «Agregar a favoritos».</Text> : null}
    </> : <View style={s.notice}><Text style={s.noticeTitle}>Guardá tus líneas y paradas</Text><Text style={s.noticeText}>Iniciá sesión desde la pestaña Yo para ver acá primero tus favoritos y sus próximos horarios.</Text></View>}

    <Text style={s.heading}>Avisos de hoy</Text>
    {avisosViejos ? <Text style={s.viejo}>Sin conexión. Se muestran los avisos descargados el {formatearFecha(avisosViejos)}; pueden haber cambiado.</Text> : null}
    {cargandoAvisos ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
    {errorAvisos && !avisos.length ? <View>
      <Text style={s.error}>{errorAvisos}</Text>
      <Pressable onPress={() => { setCargandoAvisos(true); cargar(); }} style={s.reintentar}><Text style={s.reintentarTexto}>Reintentar</Text></Pressable>
    </View> : null}
    {!cargandoAvisos && !errorAvisos && !avisos.length ? <Text style={s.muted}>No hay avisos vigentes. Todas las líneas funcionan con normalidad.</Text> : null}
    {avisos.map(a => <Link key={a.id} href="/(tabs)/avisos" asChild>
      <Pressable style={s.alert}>
        <Text style={s.cardTitle}>{a.titulo}</Text>
        <Text style={s.alertText}>{a.detalle}</Text>
        <Text style={s.alertLinea}>Afecta a: {a.lineaIds.map(nombreLinea).join(", ")}</Text>
      </Pressable>
    </Link>)}

    <Text style={s.heading}>Paradas cerca tuyo</Text>
    {permisoUbicacion !== "concedido" ? <View style={s.infoBox}>
      <Text style={s.infoText}>{permisoUbicacion === "denegado" ? "No tenemos permiso para usar tu ubicación. Podés buscar una parada por nombre en la pestaña Paradas." : "Mostramos las paradas más cercanas y cuándo pasa el próximo colectivo según la tabla."}</Text>
      {permisoUbicacion === "denegado"
        ? <Link href="/(tabs)/paradas" style={s.more}>Buscar una parada por nombre →</Link>
        : <Pressable onPress={pedirUbicacion} style={s.reintentar}><Text style={s.reintentarTexto}>Ver paradas cerca de mí</Text></Pressable>}
    </View> : null}
    {permisoUbicacion === "concedido" && buscandoUbicacion && !ubicacion ? <ActivityIndicator style={{ marginVertical: 10 }} /> : null}
    {permisoUbicacion === "concedido" && sinUbicacion && !ubicacion ? <View style={s.infoBox}>
      <Text style={s.infoText}>No pudimos obtener tu ubicación. Revisá que esté activada en el teléfono. Mientras tanto, podés buscar una parada por nombre en la pestaña Paradas.</Text>
      <Pressable onPress={leerUbicacion} style={s.reintentar}><Text style={s.reintentarTexto}>Reintentar</Text></Pressable>
    </View> : null}
    {ubicacion && cercanas.length ? <>
      <MapaParadasCercanas ubicacion={ubicacion} paradas={cercanas.map(x => x.parada)} />
      {cercanas.slice(0, 2).map(({ parada, metros }) => <ParadaFavorita key={`cerca-${parada.id}`} id={parada.id} nombreLinea={nombreLinea} distancia={formatearDistancia(metros)} />)}
    </> : null}
    {ubicacion && !cercanas.length ? <Text style={s.muted}>No encontramos paradas a menos de 2 km de tu ubicación. Podés buscar una por nombre en la pestaña Paradas.</Text> : null}

    <Text style={s.heading}>Líneas</Text>
    {!lineas.length ? <Text style={s.muted}>Las líneas aparecen acá cuando se descargan los datos. Con conexión, entrá a la pestaña Líneas y tocá «Descargar / actualizar datos».</Text> : null}
    {lineas.slice(0, 5).map(l => <Link key={l.id} href={{ pathname: "/lineas/[id]", params: { id: l.id } }} asChild>
      <Pressable style={s.card}>
        <View style={[s.dot, { backgroundColor: colorLinea(l.id) }]} />
        <View style={{ flex: 1 }}><Text style={s.cardTitle}>Línea {l.numero}</Text><Text style={s.muted}>{l.nombre}</Text></View>
        <Text style={s.arrow}>›</Text>
      </Pressable>
    </Link>)}
    {lineas.length > 5 ? <Link href="/(tabs)/lineas" style={s.more}>Ver las {lineas.length} líneas →</Link> : null}
    <Text style={s.footer}>Los horarios son los de la tabla: la API no informa la posición en vivo de los colectivos.</Text>
  </ScrollView>;
}

/** Una parada favorita con sus próximos horarios por línea, con la hora de tabla y cuánto falta. */
function ParadaFavorita({ id, nombreLinea, distancia }: { id: string; nombreLinea: (id: string) => string; distancia?: string }) {
  const s = useEstilos(crearEstilos);
  const db = useSQLiteContext();
  const [parada, setParada] = useState<Parada | null>(null);
  const [horarios, setHorarios] = useState<Horario[] | null>(null);

  useEffect(() => {
    let vigente = true;
    (async () => {
      const p = await obtenerParada(id).catch(() => obtenerParadaCache(db, id)).catch(() => null);
      const h = await obtenerProximos(id).catch(() => obtenerProximosOffline(db, id, 6)).catch(() => []);
      if (vigente) { setParada(p); setHorarios(h); }
    })();
    return () => { vigente = false; };
  }, [id, db]);

  const porLinea = new Map<string, Horario[]>();
  for (const h of horarios ?? []) { const lista = porLinea.get(h.lineaId) ?? []; if (lista.length < 3) lista.push(h); porLinea.set(h.lineaId, lista); }

  return <Link href={{ pathname: "/paradas/[id]", params: { id } }} asChild>
    <Pressable style={s.card}>
      <View style={{ flex: 1 }}>
        <Text style={s.cardTitle}>{parada?.nombre ?? `Parada ${id.replace("par-", "")}`}</Text>
        {distancia ? <Text style={s.muted}>A {distancia}</Text> : null}
        {horarios === null ? <Text style={s.muted}>Buscando próximos horarios...</Text> : null}
        {horarios !== null && !porLinea.size ? <Text style={s.muted}>No hay más servicio para esta parada por ahora.</Text> : null}
        {[...porLinea.entries()].map(([lineaId, lista]) => <Text key={lineaId} style={s.horarios}>
          {nombreLinea(lineaId)}: {lista.map(h => h.hora).join("  ")}  ({describirEspera(lista[0].hora)})
        </Text>)}
      </View>
      <Text style={s.arrow}>›</Text>
    </Pressable>
  </Link>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 56, paddingBottom: 36 },
  encabezado: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 }, logo: { width: 52, height: 52, borderRadius: 12 },
  brand: { fontSize: 28, fontWeight: "800", color: c.titulo }, subtitle: { fontSize: 14, color: c.suave, marginTop: 2 },
  notice: { backgroundColor: c.avisoFondo, borderRadius: 12, padding: 12, marginBottom: 6 }, noticeTitle: { fontWeight: "700", marginBottom: 4, color: c.avisoTexto }, noticeText: { color: c.avisoTexto, lineHeight: 19 },
  heading: { fontSize: 19, fontWeight: "700", color: c.titulo, marginTop: 16, marginBottom: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: c.tarjeta, borderRadius: 12, marginBottom: 9 },
  dot: { width: 13, height: 42, borderRadius: 7 }, cardTitle: { fontWeight: "700", color: c.texto, marginBottom: 3 },
  muted: { color: c.suave, lineHeight: 20 }, arrow: { fontSize: 26, color: c.suave }, more: { color: c.acento, fontWeight: "700", padding: 8 },
  horarios: { color: c.texto, marginTop: 4, lineHeight: 19 },
  alert: { backgroundColor: c.alertaFondo, borderRadius: 12, padding: 14, marginBottom: 8 }, alertText: { color: c.texto, lineHeight: 19 }, alertLinea: { color: c.suave, fontSize: 12, marginTop: 4 },
  viejo: { color: c.avisoTexto, backgroundColor: c.avisoFondo, borderRadius: 10, padding: 10, marginBottom: 10, lineHeight: 18, fontSize: 12 },
  error: { color: c.error, lineHeight: 20 }, reintentar: { alignSelf: "flex-start", backgroundColor: c.primario, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, marginTop: 10 }, reintentarTexto: { color: "white", fontWeight: "700" },
  infoBox: { backgroundColor: c.cajaInfo, borderRadius: 12, padding: 12, marginBottom: 6 }, infoText: { color: c.texto, lineHeight: 19 },
  footer: { color: c.suave, fontSize: 12, marginTop: 18, lineHeight: 18 }
});
