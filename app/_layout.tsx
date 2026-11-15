import { Stack, useRouter } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import * as Notifications from "expo-notifications";
import { inicializarBase } from "../src/base-datos/db";
import { SesionProvider } from "../src/contexto/SesionContext";
import { prepararCanalNotificaciones } from "../src/servicios/notificaciones";
import { aplicarTema } from "../src/servicios/preferencias";
import { OSCURO, useColores } from "../src/tema/tema";

// Antes de dibujar nada: aplica el modo claro/oscuro que la persona eligió (o el del teléfono).
aplicarTema();

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

export default function RootLayout() {
  const router = useRouter();
  const c = useColores();
  const oscuro = c === OSCURO;
  useEffect(() => {
    prepararCanalNotificaciones().catch(() => undefined);
    const suscripcion = Notifications.addNotificationResponseReceivedListener(respuesta => {
      const datos = respuesta.notification.request.content.data;
      if (typeof datos?.paradaId === "string") router.push({ pathname: "/paradas/[id]", params: { id: datos.paradaId } });
      else if (typeof datos?.lineaId === "string") router.push({ pathname: "/lineas/[id]", params: { id: datos.lineaId } });
    });
    return () => suscripcion.remove();
  }, [router]);
  return (
    <SQLiteProvider databaseName="parana-bus.db" onInit={inicializarBase}>
      <SesionProvider>
        <StatusBar barStyle={oscuro ? "light-content" : "dark-content"} backgroundColor={c.fondo} />
        <Stack screenOptions={{ headerShown: false, headerStyle: { backgroundColor: c.tarjeta }, headerTintColor: c.titulo, contentStyle: { backgroundColor: c.fondo } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lineas/[id]" options={{ headerShown: true, title: "Detalle de línea" }} />
          <Stack.Screen name="paradas/[id]" options={{ headerShown: true, title: "Detalle de parada" }} />
          <Stack.Screen name="paradas/[id]/reportar" options={{ headerShown: true, title: "Reportar demora" }} />
          <Stack.Screen name="qr" options={{ headerShown: true, title: "Escanear QR" }} />
        </Stack>
      </SesionProvider>
    </SQLiteProvider>
  );
}
