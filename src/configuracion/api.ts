/**
 * Dirección de la API de Transporte Público.
 * En el teléfono debe ser la IP de la PC en la misma Wi-Fi, no localhost.
 * Ejemplo: EXPO_PUBLIC_API_URL=http://192.168.0.25:3000
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
