import * as LocalAuthentication from "expo-local-authentication";

/**
 * ¿Se puede pedir huella, rostro o PIN del teléfono? Hay que preguntar antes de usarlo:
 * no todos los teléfonos tienen lector ni la persona siempre tiene algo registrado.
 */
export async function biometriaDisponible(): Promise<boolean> {
  try {
    const hayLector = await LocalAuthentication.hasHardwareAsync();
    const hayHuellas = await LocalAuthentication.isEnrolledAsync();
    if (hayLector && hayHuellas) return true;
    // Sin huella registrada, el PIN o patrón del teléfono también sirve para confirmar identidad.
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    return nivel !== LocalAuthentication.SecurityLevel.NONE;
  } catch { return false; }
}

/** Abre el diálogo del sistema. Devuelve true solo si la persona se autenticó. */
export async function pedirBiometria(mensaje: string): Promise<boolean> {
  try {
    if (!(await biometriaDisponible())) return false;
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: mensaje, cancelLabel: "Cancelar" });
    return r.success;
  } catch { return false; }
}
