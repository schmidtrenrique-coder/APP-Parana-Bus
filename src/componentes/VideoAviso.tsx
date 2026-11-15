import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { borrarVideo, descargarVideo, videoGuardado } from "../servicios/archivos";
import { useSinConexion } from "./BannerRed";
import { useColores } from "../tema/tema";

function Reproductor({ fuente }: { fuente: string }) {
  const player = useVideoPlayer(fuente, p => { p.loop = false; });
  return <VideoView player={player} style={s.video} nativeControls allowsFullscreen contentFit="contain" />;
}

/**
 * Botón «Ver video». El reproductor se crea recién al tocarlo, para no preparar varios videos a la
 * vez en la lista de avisos. Se puede guardar el video en el teléfono (expo-file-system) y entonces
 * se reproduce desde el archivo local, sin gastar datos ni necesitar conexión.
 */
export default function VideoAviso({ avisoId, url }: { avisoId: string; url: string }) {
  const c = useColores();
  const sinConexion = useSinConexion();
  const [visible, setVisible] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { try { setLocal(videoGuardado(avisoId)); } catch { setLocal(null); } }, [avisoId]);

  async function guardar() {
    setDescargando(true); setError(null);
    try { setLocal(await descargarVideo(avisoId, url)); }
    catch { setError("No se pudo guardar el video. Revisá tu conexión e intentá de nuevo."); }
    finally { setDescargando(false); }
  }
  function quitar() { try { borrarVideo(avisoId); } catch { /* ya no estaba */ } setLocal(null); setVisible(false); }

  if (!visible) {
    return <Pressable onPress={() => setVisible(true)} style={[s.boton, { backgroundColor: c.acentoFondo }]} accessibilityRole="button">
      <Text style={s.botonTexto}>▶ Ver video del aviso{local ? " (guardado)" : ""}</Text>
    </Pressable>;
  }
  return <View>
    {!local && sinConexion ? <Text style={[s.nota, { color: c.avisoTexto }]}>Sin conexión: este video no está guardado en el teléfono. Guardalo cuando tengas internet para verlo sin conexión.</Text> : null}
    <Reproductor key={local ?? url} fuente={local ?? url} />
    <View style={s.fila}>
      <Pressable onPress={() => setVisible(false)}><Text style={[s.enlace, { color: c.acento }]}>Ocultar video</Text></Pressable>
      {local
        ? <Pressable onPress={quitar}><Text style={[s.enlace, { color: c.error }]}>Borrar del teléfono</Text></Pressable>
        : <Pressable disabled={descargando || sinConexion} onPress={guardar}>
            {descargando ? <ActivityIndicator /> : <Text style={[s.enlace, { color: c.acento, opacity: sinConexion ? 0.4 : 1 }]}>Guardar para ver sin conexión</Text>}
          </Pressable>}
    </View>
    {local ? <Text style={[s.nota, { color: c.exito }]}>Video guardado en el teléfono.</Text> : null}
    {error ? <Text style={[s.nota, { color: c.error }]}>{error}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  boton: { paddingVertical: 10, borderRadius: 9, alignItems: "center", marginTop: 12 },
  botonTexto: { color: "white", fontWeight: "800" },
  video: { width: "100%", height: 200, borderRadius: 10, backgroundColor: "black", marginTop: 12 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  enlace: { fontWeight: "700", fontSize: 12 },
  nota: { fontSize: 12, lineHeight: 17, marginTop: 8 },
});
