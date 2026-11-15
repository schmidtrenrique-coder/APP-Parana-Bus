import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import type { Coordenadas } from "../tipos/transporte";
import { abrirEnMapas, distanciaMetros, formatearDistancia, puntoCardinal, rumboHacia } from "../utilidades/geo";
import { useEstilos, useColores, type Paleta } from "../tema/tema";

type EstadoUbicacion = "pidiendo" | "denegada" | "lista";

/**
 * "¿Para qué lado queda la parada?": una flecha que apunta hacia ella usando la ubicación y la
 * brújula (magnetómetro). Si no hay brújula, dice el punto cardinal; si se niega la ubicación,
 * igual ofrece abrir la app de mapas. Gira el teléfono hasta que la flecha apunte hacia arriba.
 */
export default function FlechaParada({ destino, nombre }: { destino: Coordenadas; nombre: string }) {
  const s = useEstilos(crearEstilos);
  const c = useColores();
  const [estado, setEstado] = useState<EstadoUbicacion>("pidiendo");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [rumbo, setRumbo] = useState<number | null>(null);
  const [hayBrujula, setHayBrujula] = useState(true);
  const suavizado = useRef<number | null>(null);
  const [demora, setDemora] = useState(false);
  useEffect(() => { const temporizador = setTimeout(() => setDemora(true), 10000); return () => clearTimeout(temporizador); }, []);

  useEffect(() => {
    let activo = true;
    let suscripcion: Location.LocationSubscription | null = null;
    (async () => {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (!activo) return;
      if (permiso.status !== "granted") { setEstado("denegada"); return; }
      setEstado("lista");
      try {
        const actual = await Location.getLastKnownPositionAsync();
        if (actual && activo) setUbicacion({ latitud: actual.coords.latitude, longitud: actual.coords.longitude });
        suscripcion = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 5 }, pos => {
          if (activo) setUbicacion({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
        });
      } catch { /* sin posición: se muestra solo el botón del mapa */ }
    })();
    return () => { activo = false; suscripcion?.remove(); };
  }, []);

  useEffect(() => {
    let activo = true;
    let suscripcion: { remove: () => void } | null = null;
    (async () => {
      try {
        if (!(await Magnetometer.isAvailableAsync())) { if (activo) setHayBrujula(false); return; }
        Magnetometer.setUpdateInterval(250);
        suscripcion = Magnetometer.addListener(({ x, y }) => {
          // Con el teléfono horizontal, el norte magnético queda en atan2(y, x) = 90° cuando la parte de arriba apunta al norte.
          let grados = Math.atan2(y, x) * 180 / Math.PI - 90;
          if (grados < 0) grados += 360;
          // Se promedia con la lectura anterior para que la flecha no tiemble.
          const previo = suavizado.current;
          if (previo !== null) {
            let delta = grados - previo;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            grados = (previo + delta * 0.3 + 360) % 360;
          }
          suavizado.current = grados;
          if (activo) setRumbo(grados);
        });
      } catch { if (activo) setHayBrujula(false); }
    })();
    return () => { activo = false; suscripcion?.remove(); };
  }, []);

  const rumboParada = ubicacion ? rumboHacia(ubicacion, destino) : null;
  const metros = ubicacion ? distanciaMetros(ubicacion, destino) : null;
  const giro = rumboParada !== null && rumbo !== null ? (rumboParada - rumbo + 360) % 360 : null;

  return <View style={s.card}>
    <Text style={s.heading}>¿Para qué lado queda?</Text>
    {estado === "denegada" ? <Text style={s.sub}>Para mostrarte hacia dónde queda la parada necesitamos tu ubicación. Podés seguir usando la app y abrir el mapa del teléfono.</Text> : null}
    {estado === "pidiendo" || (estado === "lista" && !ubicacion) ? <Text style={s.sub}>{demora ? "Todavía no recibimos tu ubicación. Revisá que esté activada en el teléfono; mientras tanto podés abrir el mapa." : "Buscando tu ubicación..."}</Text> : null}
    {ubicacion && rumboParada !== null && metros !== null ? <View style={s.fila}>
      {hayBrujula && giro !== null
        ? <View accessible accessibilityLabel={`La parada queda hacia el ${puntoCardinal(rumboParada)}`}><Ionicons name="arrow-up-circle" size={64} color={c.acento} style={{ transform: [{ rotate: `${giro}deg` }] }} /></View>
        : <Ionicons name="compass-outline" size={52} color={c.acento} />}
      <View style={{ flex: 1 }}>
        <Text style={s.distancia}>A {formatearDistancia(metros)}</Text>
        <Text style={s.sub}>Queda hacia el {puntoCardinal(rumboParada)}.{hayBrujula && giro !== null ? " Girá el teléfono hasta que la flecha apunte hacia arriba." : ""}</Text>
      </View>
    </View> : null}
    <Pressable onPress={() => abrirEnMapas(destino, nombre)} style={s.boton} accessibilityRole="button"><Text style={s.botonTexto}>Abrir en la app de mapas</Text></Pressable>
  </View>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  card: { backgroundColor: c.tarjeta, borderRadius: 12, padding: 15, marginTop: 14 },
  heading: { fontWeight: "800", fontSize: 17, marginBottom: 8, color: c.texto },
  sub: { color: c.suave, lineHeight: 20, marginTop: 2 },
  fila: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 6 },
  distancia: { fontSize: 20, fontWeight: "800", color: c.titulo },
  boton: { backgroundColor: c.secundario, padding: 11, borderRadius: 9, alignItems: "center", marginTop: 12 },
  botonTexto: { color: c.textoSecundario, fontWeight: "700" },
});
