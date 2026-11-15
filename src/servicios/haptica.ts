import * as Haptics from "expo-haptics";

/** Vibración corta que confirma que algo salió bien (reporte enviado, QR leído, confirmación registrada). */
export function vibrarExito(): void { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); }
/** Vibración de advertencia para un error. Nunca es la única señal: siempre hay también un mensaje en pantalla. */
export function vibrarError(): void { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined); }
/** Toque sutil al cambiar una selección (agregar o quitar un favorito). */
export function vibrarSeleccion(): void { Haptics.selectionAsync().catch(() => undefined); }
