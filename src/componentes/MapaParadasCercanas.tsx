import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import type { Coordenadas, Parada } from "../tipos/transporte";
import { useColores } from "../tema/tema";

/** Mapa chico, de solo lectura, con la ubicación de la persona y las paradas más cercanas. */
export default function MapaParadasCercanas({ ubicacion, paradas, alto = 220 }: { ubicacion: Coordenadas; paradas: Parada[]; alto?: number }) {
  const c = useColores();
  const mapa = useRef<MapView>(null);
  const puntos = [ubicacion, ...paradas.map(p => p.coordenadas)].map(p => ({ latitude: p.latitud, longitude: p.longitud }));

  const ajustar = () => {
    if (puntos.length > 1) mapa.current?.fitToCoordinates(puntos, { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: false });
  };

  return <View style={[s.contenedor, { height: alto, backgroundColor: c.borde }]}>
    <MapView
      ref={mapa}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: ubicacion.latitud, longitude: ubicacion.longitud, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
      onMapReady={ajustar}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      showsUserLocation
    >
      {paradas.map(p => <Marker key={p.id} coordinate={{ latitude: p.coordenadas.latitud, longitude: p.coordenadas.longitud }} title={p.nombre} />)}
    </MapView>
  </View>;
}

const s = StyleSheet.create({ contenedor: { borderRadius: 12, overflow: "hidden", marginBottom: 10 } });
