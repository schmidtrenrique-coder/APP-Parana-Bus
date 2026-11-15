import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { Coordenadas } from "../tipos/transporte";
import { useColores } from "../tema/tema";

interface Props {
  /** Puntos del recorrido, en orden. */
  trazado: Coordenadas[];
  color?: string;
  /** Texto para el marcador del primer punto. */
  etiquetaInicio?: string;
  /** Texto para el marcador del último punto. */
  etiquetaFin?: string;
  alto?: number;
}

export default function MapaTrazado({
  trazado,
  color = "#147D92",
  etiquetaInicio = "Inicio",
  etiquetaFin = "Fin",
  alto = 200,
}: Props) {
  const c = useColores();
  const [errorMapa, setErrorMapa] = useState(false);

  const puntos = (trazado ?? []).filter(
    p =>
      Number.isFinite(p.latitud) &&
      Number.isFinite(p.longitud) &&
      p.latitud >= -90 &&
      p.latitud <= 90 &&
      p.longitud >= -180 &&
      p.longitud <= 180
  );

  const html = useMemo(() => {
    // Solo se interpolan coordenadas numéricas y textos serializados como JSON.
    const coordenadas = JSON.stringify(puntos.map(p => [p.latitud, p.longitud]));
    const inicio = JSON.stringify(etiquetaInicio).replace(/</g, "\\u003c");
    const fin = JSON.stringify(etiquetaFin).replace(/</g, "\\u003c");
    const trazo = JSON.stringify(/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#147D92");

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
    body { overflow: hidden; }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${coordenadas};
    const startLabel = ${inicio};
    const endLabel = ${fin};
    const routeColor = ${trazo};
    const map = L.map('map', { zoomControl: false, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    const line = L.polyline(points, { color: routeColor, weight: 5, opacity: 0.9 }).addTo(map);
    L.marker(points[0]).addTo(map).bindPopup(startLabel);
    if (points.length > 1) {
      L.marker(points[points.length - 1]).addTo(map).bindPopup(endLabel);
      map.fitBounds(line.getBounds(), { padding: [24, 24] });
    } else {
      map.setView(points[0], 15);
    }
  </script>
</body>
</html>`;
  }, [puntos, color, etiquetaInicio, etiquetaFin]);

  if (puntos.length === 0) {
    return (
      <View style={[s.vacio, { height: 70, backgroundColor: c.secundario }]}>
        <Text style={[s.vacioTexto, { color: c.suave }]}>
          No hay trazado disponible para mostrar en el mapa.
        </Text>
      </View>
    );
  }

  if (errorMapa) {
    return (
      <View style={[s.fallback, { height: alto, backgroundColor: c.secundario }]}>
        <Text style={[s.fallbackTitulo, { color: c.texto }]}>No se pudo cargar el mapa</Text>
        <Text style={[s.vacioTexto, { color: c.suave }]}>
          Revisá tu conexión a internet para visualizar el recorrido.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.contenedor, { height: alto, backgroundColor: c.borde }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={s.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        onError={() => setErrorMapa(true)}
        onHttpError={event => {
          if (event.nativeEvent.statusCode >= 400) setErrorMapa(true);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  contenedor: { borderRadius: 10, overflow: "hidden", marginTop: 10 },
  webview: { flex: 1, backgroundColor: "transparent" },
  vacio: { borderRadius: 10, marginTop: 10, justifyContent: "center", padding: 12 },
  vacioTexto: { fontSize: 12 },
  fallback: { borderRadius: 10, marginTop: 10, justifyContent: "center", alignItems: "center", padding: 16 },
  fallbackTitulo: { fontSize: 14, fontWeight: "800", marginBottom: 5 },
});
