import { Directory, File, Paths } from "expo-file-system";

/** Carpeta dentro de Paths.document: permanente, sobrevive a reinicios y actualizaciones. */
function carpeta(nombre: string): Directory {
  const dir = new Directory(Paths.document, nombre);
  if (!dir.exists) dir.create();
  return dir;
}

/**
 * La cámara y la galería devuelven una URI en la caché, que el sistema puede vaciar.
 * Se copia a una carpeta permanente para que la foto de un reporte pendiente no se pierda.
 */
export function guardarFotoReporte(uriTemporal: string, idReporte: string, extension: string): string {
  const destino = new File(carpeta("reportes"), `${idReporte}.${extension}`);
  if (destino.exists) destino.delete();
  new File(uriTemporal).copy(destino);
  return destino.uri;
}

function archivoDeVideo(avisoId: string): File {
  return new File(carpeta("videos"), `${avisoId.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`);
}

/** URI del video del aviso si ya está guardado en el teléfono, o null. */
export function videoGuardado(avisoId: string): string | null {
  const archivo = archivoDeVideo(avisoId);
  return archivo.exists ? archivo.uri : null;
}

/** Descarga el video del aviso para verlo sin conexión. Devuelve la URI local. */
export async function descargarVideo(avisoId: string, url: string): Promise<string> {
  const destino = archivoDeVideo(avisoId);
  if (destino.exists) destino.delete();
  const bajado = await File.downloadFileAsync(url, destino);
  return bajado.uri;
}

export function borrarVideo(avisoId: string): void {
  const archivo = archivoDeVideo(avisoId);
  if (archivo.exists) archivo.delete();
}
