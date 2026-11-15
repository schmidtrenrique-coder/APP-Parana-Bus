import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSQLiteContext } from "expo-sqlite";
import { obtenerParadaCache } from "../src/base-datos/db";
import { obtenerParada, resolverQr } from "../src/servicios/paradas";
import { vibrarError, vibrarExito } from "../src/servicios/haptica";

import { useColores, useEstilos, type Paleta } from "../src/tema/tema";
export default function EscanerQrScreen() {
  const router = useRouter();
  const s = useEstilos(crearEstilos);
  const c = useColores();
  const [codigoManual, setCodigoManual] = useState("");
  const db = useSQLiteContext();
  const [permiso, solicitarPermiso] = useCameraPermissions();
  const [procesando, setProcesando] = useState(false);
  const [escaneado, setEscaneado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function procesarQr(valor: string) {
    if (procesando) return;
    setProcesando(true);
    setEscaneado(true);
    setError(null);
    try {
      let parada;
      try {
        parada = await resolverQr(valor);
      } catch (e) {
        const coincidencia = valor.trim().match(/^PARANA:(.+)$/i);
        if (!coincidencia) throw e;
        parada = await obtenerParada(coincidencia[1]).catch(() => obtenerParadaCache(db, coincidencia[1]));
      }
      if (!parada) throw new Error("El QR no corresponde a una parada registrada.");
      vibrarExito();
      router.replace({ pathname: "/paradas/[id]", params: { id: parada.id } });
    } catch (e) {
      vibrarError();
      setError(e instanceof Error ? e.message : "No pudimos identificar el código QR. Si no es un QR de Paraná Bus, probá con otro o buscá la parada por nombre.");
      setProcesando(false);
    }
  }

  // Alternativa al escaneo: escribir el código impreso o compartido de la parada (por ejemplo, si no hay cámara o se negó el permiso).
  const ingresoManual = <View style={s.manual}>
    <Text style={s.manualTitulo}>¿No podés escanear?</Text>
    <Text style={s.text}>Escribí el código de la parada. Por ejemplo: PARANA:par-101</Text>
    <TextInput value={codigoManual} onChangeText={setCodigoManual} placeholder="PARANA:par-101" placeholderTextColor={c.suave} autoCapitalize="none" autoCorrect={false} style={s.input} />
    <Pressable style={s.boton} disabled={procesando || !codigoManual.trim()} onPress={() => { const v = codigoManual.trim(); procesarQr(/^PARANA:/i.test(v) ? v : `PARANA:${v}`); }}>
      <Text style={s.botonTexto}>Abrir parada con este código</Text>
    </Pressable>
  </View>;

  if (!permiso) return <View style={s.page}><ActivityIndicator /></View>;
  if (!permiso.granted) return <ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Escanear QR</Text>
    <Text style={s.text}>Necesitamos permiso para usar la cámara y leer el código QR de una parada.</Text>
    <Pressable style={s.boton} onPress={solicitarPermiso}><Text style={s.botonTexto}>Permitir cámara</Text></Pressable>
    {ingresoManual}
    {error ? <Text style={s.error}>{error}</Text> : null}
    <Pressable style={s.volver} onPress={() => router.back()}><Text style={s.volverTexto}>Volver</Text></Pressable>
  </ScrollView>;

  return <ScrollView style={s.page} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Escanear QR de una parada</Text>
    <Text style={s.text}>Apuntá la cámara al código QR identificado como Paraná Bus.</Text>
    <View style={s.camaraContenedor}>
      <CameraView style={s.camara} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={procesando || escaneado ? undefined : ({ data }) => procesarQr(data)} />
    </View>
    {procesando ? <View style={s.estado}><ActivityIndicator /><Text style={s.text}>Consultando parada...</Text></View> : null}
    {error ? <><Text style={s.error}>{error}</Text><Pressable style={s.boton} onPress={() => { setError(null); setEscaneado(false); }}><Text style={s.botonTexto}>Volver a escanear</Text></Pressable></> : null}
    {ingresoManual}
    <Pressable style={s.volver} onPress={() => router.back()}><Text style={s.volverTexto}>Volver a paradas</Text></Pressable>
  </ScrollView>;
}
const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo, padding: 20, paddingTop: 58 }, title: { color: c.titulo, fontSize: 24, fontWeight: "800", marginBottom: 10 }, text: { color: c.suave, lineHeight: 21, marginBottom: 14 },
  camaraContenedor: { height: 390, overflow: "hidden", borderRadius: 16, backgroundColor: "#17282D" }, camara: { flex: 1 }, estado: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }, error: { color: c.error, marginTop: 14, fontWeight: "600" },
  boton: { backgroundColor: c.primario, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 }, botonTexto: { color: "white", fontWeight: "700" }, volver: { padding: 14, alignItems: "center", marginTop: 10 }, volverTexto: { color: c.acento, fontWeight: "800" },
  manual: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 14, marginTop: 18 }, manualTitulo: { color: c.titulo, fontWeight: "800", fontSize: 16, marginBottom: 4 },
  input: { backgroundColor: c.fondo, borderWidth: 1, borderColor: c.borde, borderRadius: 9, padding: 12, color: c.texto }
});
