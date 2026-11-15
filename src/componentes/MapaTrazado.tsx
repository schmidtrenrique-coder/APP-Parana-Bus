import { useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Coordenadas } from "../tipos/transporte";
import { useColores } from "../tema/tema";

interface Props {
  /** Puntos del recorrido, en orden. */
  trazado: Coordenadas[];
  color?: string;
  /** Texto para el marcador del primer punto (por defecto "Inicio"). */
  etiquetaInicio?: string;
  /** Texto para el marcador del último punto (por defecto "Fin"). */
  etiquetaFin?: string;
  alto?: number;
}

const aLatLng = (c: Coordenadas) => ({ latitude: c.latitud, longitude: c.longitud });

/**
 * Vista previa de un trazado sobre el mapa. Es de solo lectura (sin gestos) para no
 * interferir con el scroll de la pantalla donde se muestra.
 */
export default function MapaTrazado({ trazado, color = "#147D92", etiquetaInicio = "Inicio", etiquetaFin = "Fin", alto = 200 }: Props) {
  const c = useColores();
  const mapa = useRef<MapView>(null);
  const puntos = (trazado ?? []).filter(p => Number.isFinite(p.latitud) && Number.isFinite(p.longitud)).map(aLatLng);

  if (puntos.length === 0) {
    return <View style={[s.vacio, { height: 70, backgroundColor: c.secundario }]}><Text style={[s.vacioTexto, { color: c.suave }]}>No hay trazado disponible para mostrar en el mapa.</Text></View>;
  }

  const ajustar = () => {
    if (puntos.length > 1) {
      mapa.current?.fitToCoordinates(puntos, { edgePadding: { top: 30, right: 30, bottom: 30, left: 30 }, animated: false });
    }
  };

  return <View style={[s.contenedor, { height: alto, backgroundColor: c.borde }]}>
    <MapView
      ref={mapa}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...puntos[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      onMapReady={ajustar}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      {puntos.length > 1 ? <Polyline coordinates={puntos} strokeColor={color} strokeWidth={4} /> : null}
      <Marker coordinate={puntos[0]} title={etiquetaInicio} pinColor="green" />
      {puntos.length > 1 ? <Marker coordinate={puntos[puntos.length - 1]} title={etiquetaFin} pinColor="red" /> : null}
    </MapView>
  </View>;
}

const s = StyleSheet.create({
  contenedor: { borderRadius: 10, overflow: "hidden", marginTop: 10 },
  vacio: { borderRadius: 10, marginTop: 10, justifyContent: "center", padding: 12 },
  vacioTexto: { fontSize: 12 },
});
