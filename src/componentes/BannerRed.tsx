import { StyleSheet, Text, View } from "react-native";
import { NetworkStateType, useNetworkState } from "expo-network";
import { useColores } from "../tema/tema";

/** true cuando se sabe que no hay internet. isInternetReachable es el dato que importa: un Wi-Fi que pide iniciar sesión da isConnected true y no pasa ningún dato. */
export function useSinConexion(): boolean {
  const red = useNetworkState();
  return red.isInternetReachable === false || red.isConnected === false;
}

/** Franja que avisa el estado de la red, para que se entienda por qué se ven datos guardados. */
export default function BannerRed() {
  const c = useColores();
  const red = useNetworkState();
  const sinConexion = red.isInternetReachable === false || red.isConnected === false;
  if (sinConexion) {
    return <View style={[s.franja, { backgroundColor: c.avisoFondo }]} accessibilityRole="alert">
      <Text style={[s.texto, { color: c.avisoTexto }]}>Sin conexión. Vas a ver los datos guardados en el teléfono; pueden estar desactualizados.</Text>
    </View>;
  }
  if (red.type === NetworkStateType.CELLULAR) {
    return <View style={[s.franja, { backgroundColor: c.cajaInfo }]}>
      <Text style={[s.texto, { color: c.suave }]}>Estás usando datos móviles.</Text>
    </View>;
  }
  return null;
}
const s = StyleSheet.create({
  franja: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  texto: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
});
