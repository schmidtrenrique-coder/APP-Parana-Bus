import { Tabs } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useColores } from "../../src/tema/tema";

export default function TabLayout() {
  const c = useColores();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: c.acento, tabBarInactiveTintColor: c.suave, tabBarStyle: { backgroundColor: c.tarjeta, borderTopColor: c.borde } }}>
    <Tabs.Screen name="index" options={{ title: "Inicio", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="lineas" options={{ title: "Líneas", tabBarIcon: ({ color, size }) => <Ionicons name="bus-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="paradas" options={{ title: "Paradas", tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="avisos" options={{ title: "Avisos", tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="yo" options={{ title: "Yo", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
  </Tabs>;
}
