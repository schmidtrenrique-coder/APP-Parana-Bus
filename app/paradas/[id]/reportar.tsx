import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter, Link } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSQLiteContext } from "expo-sqlite";
import type { MotivoDemora, Parada } from "../../../src/tipos/transporte";
import { obtenerParada } from "../../../src/servicios/paradas";
import { obtenerParadaCache } from "../../../src/base-datos/db";
import { crearReporteDeDemora, prepararNuevoReporte, sincronizarReportesPendientes, contarReportesPendientes } from "../../../src/servicios/reportes";
import { useSesion } from "../../../src/contexto/SesionContext";
import { useCatalogo } from "../../../src/hooks/useCatalogo";
import { guardarFotoReporte } from "../../../src/servicios/archivos";
import { vibrarError, vibrarExito } from "../../../src/servicios/haptica";
import BannerRed from "../../../src/componentes/BannerRed";

import { useEstilos, type Paleta } from "../../../src/tema/tema";
const MOTIVOS: { valor: MotivoDemora; titulo: string }[] = [
  { valor: "no_paso", titulo: "El colectivo no pasó" },
  { valor: "paso_lleno", titulo: "Pasó lleno" },
  { valor: "demorado", titulo: "Está demorado" },
  { valor: "unidad_rota", titulo: "Unidad rota" },
  { valor: "calle_cortada", titulo: "Calle cortada" },
];

export default function ReportarDemoraScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const s = useEstilos(crearEstilos);
  const { usuario } = useSesion();
  const { nombreLinea } = useCatalogo();
  const [parada, setParada] = useState<Parada | null>(null);
  const [lineaId, setLineaId] = useState("");
  const [motivo, setMotivo] = useState<MotivoDemora>("demorado");
  const [comentario, setComentario] = useState("");
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let vigente = true;
    if (!id) return;
    (async () => {
      try {
        const p = await obtenerParada(String(id)).catch(() => obtenerParadaCache(db, String(id)));
        if (vigente) {
          setParada(p);
          if (p?.lineaIds.length) setLineaId(p.lineaIds[0]);
        }
      } catch (e) {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar la parada.");
      } finally { if (vigente) setCargando(false); }
    })();
    if (usuario) contarReportesPendientes(db, usuario.id).then(n => { if (vigente) setPendientes(n); });
    else setPendientes(0);
    return () => { vigente = false; };
  }, [id, db, usuario]);

  const puedeEnviar = useMemo(() => Boolean(usuario && parada && lineaId && parada.lineaIds.includes(lineaId) && !enviando), [usuario, parada, lineaId, enviando]);

  async function seleccionarFoto() {
    setError(null);
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (resultado.canceled || !resultado.assets[0]) return;
    const asset = resultado.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError("La foto supera el límite de 5 MB. Elegí una imagen más liviana.");
      return;
    }
    const extension = asset.fileName?.split(".").pop()?.toLowerCase();
    const tipo = asset.mimeType ?? (extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg");
    if (!["image/jpeg", "image/png", "image/webp"].includes(tipo)) {
      setError("La foto debe estar en formato JPG, PNG o WEBP.");
      return;
    }
    setFoto(asset);
  }

  async function enviar() {
    if (!parada || !usuario || !lineaId) return;
    setError(null); setMensaje(null); setEnviando(true);
    try {
      const datos = prepararNuevoReporte({
        usuarioId: usuario.id,
        lineaId,
        paradaId: parada.id,
        motivo,
        comentario: comentario.trim() || null,
        fotoLocalUri: foto?.uri ?? null,
        fotoNombre: foto?.fileName ?? null,
        fotoTipo: foto?.mimeType ?? (foto?.fileName?.toLowerCase().endsWith(".png") ? "image/png" : foto?.fileName?.toLowerCase().endsWith(".webp") ? "image/webp" : foto ? "image/jpeg" : null),
      });
      if (foto) {
        // La URI de la cámara o la galería está en la caché: se copia a una carpeta permanente (API nueva de expo-file-system).
        const extension = foto.fileName?.split(".").pop()?.toLowerCase() || "jpg";
        datos.fotoLocalUri = guardarFotoReporte(foto.uri, datos.id, extension);
      }
      const resultado = await crearReporteDeDemora(db, datos);
      if (resultado.pendiente) {
        vibrarExito();
        setMensaje("No hay conexión. Guardamos el reporte en este teléfono. Cuando recuperes internet, podés tocar “Sincronizar ahora” para enviarlo.");
        setPendientes(n => n + 1);
      } else {
        vibrarExito();
        setMensaje("¡Reporte enviado! Gracias por ayudar a otros pasajeros.");
      }
      setComentario(""); setFoto(null);
    } catch (e) {
      vibrarError();
      setError(e instanceof Error ? e.message : "No se pudo enviar el reporte.");
    } finally { setEnviando(false); }
  }

  async function sincronizar() {
    setError(null); setMensaje(null); setEnviando(true);
    try {
      const resultado = await sincronizarReportesPendientes(db, usuario?.id ?? "");
      setPendientes(resultado.pendientes);
      setMensaje(`Se enviaron ${resultado.enviados} reporte(s). Quedan ${resultado.pendientes} pendiente(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron sincronizar los reportes.");
    } finally { setEnviando(false); }
  }

  if (cargando) return <View style={[s.page, s.center]}><ActivityIndicator /><Text style={s.sub}>Cargando parada...</Text></View>;
  if (!parada) return <View style={s.page}><Text style={s.error}>{error ?? "No se encontró la parada."}</Text></View>;

  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <BannerRed />
    <Text style={s.title}>Reportar demora</Text>
    <Text style={s.sub}>{parada.nombre}</Text>
    {!usuario ? <View style={s.card}><Text style={s.text}>Para enviar un reporte necesitás iniciar sesión.</Text><Link href="/(tabs)/yo" style={s.link}>Ir a Mi cuenta</Link></View> : null}
    <View style={s.card}>
      <Text style={s.heading}>¿Qué línea estás esperando?</Text>
      <View style={s.options}>{parada.lineaIds.map(linea => <Pressable key={linea} onPress={() => setLineaId(linea)} style={[s.option, lineaId === linea && s.optionSelected]}><Text style={[s.optionText, lineaId === linea && s.optionTextSelected]}>{nombreLinea(linea)}</Text></Pressable>)}</View>
      <Text style={s.heading}>¿Qué está pasando?</Text>
      {MOTIVOS.map(item => <Pressable key={item.valor} onPress={() => setMotivo(item.valor)} style={s.choice}><View style={[s.radio, motivo === item.valor && s.radioActive]} /> <Text style={s.text}>{item.titulo}</Text></Pressable>)}
      <Text style={s.heading}>Comentario (opcional)</Text>
      <TextInput value={comentario} onChangeText={setComentario} placeholder="Agregá algún detalle..." multiline maxLength={300} style={s.input} />
      <Text style={s.heading}>Foto (opcional)</Text>
      <Pressable style={s.secondaryButton} onPress={seleccionarFoto}><Text style={s.secondaryText}>{foto ? "Cambiar foto" : "Adjuntar foto"}</Text></Pressable>
      {foto ? <View style={s.photoRow}><Image source={{ uri: foto.uri }} style={s.photo} /><Pressable onPress={() => setFoto(null)}><Text style={s.remove}>Quitar</Text></Pressable></View> : null}
      <Text style={s.hint}>Imágenes JPG, PNG o WEBP de hasta 5 MB. Si no hay conexión, el reporte y la foto quedan guardados en el teléfono.</Text>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {mensaje ? <Text style={s.success}>{mensaje}</Text> : null}
      <Pressable disabled={!puedeEnviar} onPress={enviar} style={[s.primaryButton, !puedeEnviar && s.disabled]}>{enviando ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>Enviar reporte</Text>}</Pressable>
    </View>
    {usuario && pendientes > 0 ? <View style={s.card}><Text style={s.heading}>Reportes pendientes: {pendientes}</Text><Text style={s.sub}>Podés intentar enviarlos cuando tengas conexión.</Text><Pressable disabled={enviando} onPress={sincronizar} style={s.secondaryButton}><Text style={s.secondaryText}>{enviando ? "Sincronizando..." : "Sincronizar ahora"}</Text></Pressable></View> : null}
    <Pressable onPress={() => router.back()} style={s.back}><Text style={s.link}>Volver a la parada</Text></Pressable>
  </ScrollView>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 54, paddingBottom: 36 }, center: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 27, fontWeight: "800", color: c.titulo }, sub: { color: c.suave, marginTop: 6, lineHeight: 20 }, card: { backgroundColor: c.tarjeta, padding: 15, borderRadius: 12, marginTop: 14 },
  heading: { fontSize: 16, fontWeight: "800", color: c.texto, marginTop: 12, marginBottom: 9 }, text: { color: c.texto, lineHeight: 21 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { borderWidth: 1, borderColor: c.borde, borderRadius: 9, padding: 10 }, optionSelected: { backgroundColor: c.primario, borderColor: c.primario }, optionText: { color: c.texto, fontWeight: "700" }, optionTextSelected: { color: "white" },
  choice: { flexDirection: "row", alignItems: "center", paddingVertical: 9, gap: 10 }, radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.bordeFuerte }, radioActive: { borderColor: c.acentoFondo, backgroundColor: c.acentoFondo },
  input: { minHeight: 82, textAlignVertical: "top", backgroundColor: c.fondo, borderWidth: 1, borderColor: c.borde, borderRadius: 9, padding: 12, color: c.texto }, secondaryButton: { backgroundColor: c.secundario, padding: 12, borderRadius: 9, alignItems: "center" }, secondaryText: { color: c.titulo, fontWeight: "700" }, photoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 10 }, photo: { width: 84, height: 84, borderRadius: 8 }, remove: { color: c.error, fontWeight: "700" }, hint: { color: c.suave, fontSize: 12, lineHeight: 18, marginTop: 10 },
  primaryButton: { backgroundColor: c.primario, padding: 14, borderRadius: 9, alignItems: "center", marginTop: 16 }, primaryText: { color: "white", fontWeight: "800" }, disabled: { opacity: 0.5 }, error: { color: c.error, marginTop: 10, lineHeight: 19 }, success: { color: c.exito, marginTop: 10, lineHeight: 19 }, link: { color: c.acento, fontWeight: "800", marginTop: 8 }, back: { alignSelf: "flex-start", paddingVertical: 12 },
});
