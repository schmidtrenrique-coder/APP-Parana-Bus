import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import type { SQLiteDatabase } from "expo-sqlite";
import { guardarRecordatorioLocal, obtenerRecordatoriosLocales, borrarRecordatorioLocal, type RecordatorioLocal } from "../base-datos/db";
import { ApiError, pedir, type RespuestaUno } from "./api";
import { obtenerToken } from "./sesion";
import type { Aviso, Usuario } from "../tipos/transporte";
import { avisosLocalesActivos, guardarAvisosVistos, leerAvisosVistos } from "./preferencias";

const CLAVE_TOKEN_EXPO = "parana_bus_token_expo";

export interface ResultadoPush { tokenExpo: string; registrado: boolean; mensaje: string; }

export async function prepararCanalNotificaciones(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Avisos de Paraná Bus",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function solicitarPermisoNotificaciones(): Promise<boolean> {
  await prepararCanalNotificaciones();
  const actual = await Notifications.getPermissionsAsync();
  if (actual.granted) return true;
  const solicitado = await Notifications.requestPermissionsAsync();
  return solicitado.granted;
}

function obtenerProjectIdEas(): string {
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("Falta configurar el projectId de EAS. Ejecutá eas build:configure y agregá el ID del proyecto para habilitar notificaciones push.");
  return projectId;
}

export async function obtenerTokenExpo(): Promise<string> {
  const projectId = obtenerProjectIdEas();
  const resultado = await Notifications.getExpoPushTokenAsync({ projectId });
  return resultado.data;
}

export async function registrarDispositivoPush(): Promise<ResultadoPush> {
  const tokenSesion = await obtenerToken();
  if (!tokenSesion) throw new Error("Iniciá sesión para activar los avisos.");
  obtenerProjectIdEas();
  const permiso = await solicitarPermisoNotificaciones();
  if (!permiso) throw new Error("No se concedió permiso para mostrar notificaciones.");
  const tokenExpo = await obtenerTokenExpo();
  await SecureStore.setItemAsync(CLAVE_TOKEN_EXPO, tokenExpo);
  try {
    await pedir<unknown>("/dispositivos", {
      method: "POST",
      body: JSON.stringify({ tokenExpo, plataforma: Platform.OS === "ios" ? "ios" : "android" }),
    }, tokenSesion);
  } catch (error) {
    if (error instanceof ApiError && error.estado === 501) {
      return { tokenExpo, registrado: false, mensaje: "El teléfono obtuvo su token, pero el servidor respondió 501 en /dispositivos. Verificá que esté desplegada la versión del backend que incluye el módulo de notificaciones push." };
    }
    throw error;
  }
  const usuario = await pedir<RespuestaUno<Usuario>>("/yo", {
    method: "PATCH", body: JSON.stringify({ avisosActivos: true }),
  }, tokenSesion);
  return { tokenExpo, registrado: true, mensaje: `Avisos activados para ${usuario.datos.nombre}.` };
}

export async function probarNotificacionPush(): Promise<void> {
  const tokenSesion = await obtenerToken();
  if (!tokenSesion) throw new Error("Iniciá sesión para probar las notificaciones.");
  await pedir<unknown>("/dispositivos/prueba", { method: "POST" }, tokenSesion);
}

export async function desactivarAvisosPush(): Promise<void> {
  const tokenSesion = await obtenerToken();
  if (!tokenSesion) throw new Error("Iniciá sesión para modificar los avisos.");
  await pedir<RespuestaUno<Usuario>>("/yo", { method: "PATCH", body: JSON.stringify({ avisosActivos: false }) }, tokenSesion);
  const tokenExpo = await SecureStore.getItemAsync(CLAVE_TOKEN_EXPO);
  if (tokenExpo) {
    try {
      await pedir<unknown>(`/dispositivos/${encodeURIComponent(tokenExpo)}`, { method: "DELETE" }, tokenSesion);
      await SecureStore.deleteItemAsync(CLAVE_TOKEN_EXPO);
    } catch (error) {
      // La preferencia queda desactivada aunque el servidor desplegado todavía no permita dar de baja el token.
      if (!(error instanceof ApiError && error.estado === 501)) throw error;
    }
  }
}

function fechaDelServicio(hora: string): Date {
  const [horas, minutos] = hora.split(":").map(Number);
  const ahora = new Date();
  const servicio = new Date(ahora);
  servicio.setHours(horas, minutos, 0, 0);
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  const horaServicio = horas * 60 + minutos;
  if (horaServicio <= horaActual) servicio.setDate(servicio.getDate() + 1);
  return servicio;
}

export async function programarRecordatorioHorario(
  db: SQLiteDatabase,
  datos: { paradaId: string; lineaId: string; hora: string }
): Promise<RecordatorioLocal> {
  const servicio = fechaDelServicio(datos.hora);
  const fechaServicioTexto = `${servicio.getFullYear()}-${String(servicio.getMonth()+1).padStart(2,"0")}-${String(servicio.getDate()).padStart(2,"0")}`;
  const existentes = await obtenerRecordatoriosLocales(db);
  const repetido = existentes.find(r => r.paradaId === datos.paradaId && r.lineaId === datos.lineaId && r.horaServicio === datos.hora && r.fechaServicio === fechaServicioTexto);
  if (repetido) return repetido;
  const permiso = await solicitarPermisoNotificaciones();
  if (!permiso) throw new Error("Necesitás permitir las notificaciones para crear un recordatorio.");
  const aviso = new Date(servicio.getTime() - 10 * 60 * 1000);
  if (aviso.getTime() <= Date.now()) throw new Error("Faltan menos de 10 minutos para ese servicio. Elegí un horario posterior.");
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Recordatorio de Paraná Bus",
      body: `La línea ${datos.lineaId.replace("lin-", "")} pasa por tu parada a las ${datos.hora}.`,
      data: { paradaId: datos.paradaId },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: aviso },
  });
  const fechaServicio = fechaServicioTexto;
  const recordatorio: RecordatorioLocal = {
    notificationId, paradaId: datos.paradaId, lineaId: datos.lineaId,
    horaServicio: datos.hora, fechaServicio, creadoEn: new Date().toISOString(),
  };
  await guardarRecordatorioLocal(db, recordatorio);
  return recordatorio;
}

export async function listarRecordatoriosLocales(db: SQLiteDatabase): Promise<RecordatorioLocal[]> {
  const recordatorios = await obtenerRecordatoriosLocales(db);
  const ahora = Date.now();
  const vigentes: RecordatorioLocal[] = [];
  for (const r of recordatorios) {
    const fechaServicio = new Date(`${r.fechaServicio}T${r.horaServicio.slice(0, 5)}:00`);
    if (fechaServicio.getTime() <= ahora) await borrarRecordatorioLocal(db, r.notificationId);
    else vigentes.push(r);
  }
  return vigentes;
}

export async function cancelarRecordatorioLocal(db: SQLiteDatabase, notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
  await borrarRecordatorioLocal(db, notificationId);
}

/**
 * Notificación local por un hecho real de la app: al descargar los avisos aparece uno que la app
 * todavía no conocía y afecta a una línea favorita. Solo avisa si la persona dio permiso y dejó
 * activado el interruptor de la pestaña Yo. La primera vez solo registra los avisos existentes,
 * para no llenar de notificaciones por avisos viejos.
 */
export async function notificarAvisosNuevos(avisos: Aviso[], lineasFavoritas: string[], nombreLinea: (id: string) => string): Promise<void> {
  const vistos = leerAvisosVistos();
  const ids = avisos.map(a => a.id);
  if (vistos === null) { guardarAvisosVistos(ids); return; }
  const nuevos = avisos.filter(a => !vistos.includes(a.id));
  if (!nuevos.length) return;
  guardarAvisosVistos(Array.from(new Set([...vistos, ...ids])));
  if (!avisosLocalesActivos()) return;
  const permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted) return;
  for (const aviso of nuevos) {
    const afectadas = aviso.lineaIds.filter(id => lineasFavoritas.includes(id));
    if (!afectadas.length) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: `Aviso en ${afectadas.map(nombreLinea).join(", ")}`, body: aviso.titulo, data: { lineaId: afectadas[0] } },
      trigger: null,
    });
  }
}
