import type { SQLiteDatabase } from "expo-sqlite";
import type { Usuario } from "../tipos/transporte";

export async function inicializarBase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS favoritos_lineas (lineaId TEXT PRIMARY KEY NOT NULL, creadaEn TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS favoritos_paradas (paradaId TEXT PRIMARY KEY NOT NULL, creadaEn TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cola_reportes (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, creadoEn TEXT NOT NULL, sincronizado INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS metadatos (clave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS horarios_cache (
      id TEXT PRIMARY KEY NOT NULL,
      lineaId TEXT NOT NULL,
      paradaId TEXT NOT NULL,
      sentido TEXT NOT NULL,
      tipoDeDia TEXT NOT NULL,
      hora TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_horarios_linea ON horarios_cache(lineaId, tipoDeDia, hora);
    CREATE INDEX IF NOT EXISTS idx_horarios_parada ON horarios_cache(paradaId, tipoDeDia, hora);
    CREATE TABLE IF NOT EXISTS feriados_cache (
      fecha TEXT PRIMARY KEY NOT NULL,
      nombre TEXT NOT NULL,
      anio INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lineas_cache (
      id TEXT PRIMARY KEY NOT NULL,
      datos TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS paradas_cache (
      id TEXT PRIMARY KEY NOT NULL,
      datos TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recordatorios_locales (
      notificationId TEXT PRIMARY KEY NOT NULL,
      paradaId TEXT NOT NULL,
      lineaId TEXT NOT NULL,
      horaServicio TEXT NOT NULL,
      fechaServicio TEXT NOT NULL,
      creadoEn TEXT NOT NULL
    );
  `);
}
export async function guardarFavoritoLinea(db: SQLiteDatabase, lineaId: string): Promise<void> {
  await db.runAsync("INSERT OR IGNORE INTO favoritos_lineas (lineaId, creadaEn) VALUES (?, ?)", lineaId, new Date().toISOString());
}
export async function quitarFavoritoLinea(db: SQLiteDatabase, lineaId: string): Promise<void> {
  await db.runAsync("DELETE FROM favoritos_lineas WHERE lineaId = ?", lineaId);
}
export async function obtenerFavoritosLineas(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ lineaId: string }>("SELECT lineaId FROM favoritos_lineas ORDER BY creadaEn DESC");
  return rows.map(row => row.lineaId);
}
export async function guardarFavoritoParada(db: SQLiteDatabase, paradaId: string): Promise<void> {
  await db.runAsync("INSERT OR IGNORE INTO favoritos_paradas (paradaId, creadaEn) VALUES (?, ?)", paradaId, new Date().toISOString());
}
export async function quitarFavoritoParada(db: SQLiteDatabase, paradaId: string): Promise<void> {
  await db.runAsync("DELETE FROM favoritos_paradas WHERE paradaId = ?", paradaId);
}
export async function obtenerFavoritosParadas(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ paradaId: string }>("SELECT paradaId FROM favoritos_paradas ORDER BY creadaEn DESC");
  return rows.map(row => row.paradaId);
}
export async function guardarUsuarioCache(db: SQLiteDatabase, usuario: Usuario): Promise<void> {
  await db.runAsync("INSERT OR REPLACE INTO metadatos (clave, valor) VALUES ('usuario_cache', ?)", JSON.stringify(usuario));
  await db.runAsync("DELETE FROM favoritos_lineas");
  await db.runAsync("DELETE FROM favoritos_paradas");
  for (const id of usuario.lineasFavoritas ?? []) await guardarFavoritoLinea(db, id);
  for (const id of usuario.paradasFavoritas ?? []) await guardarFavoritoParada(db, id);
}
export async function obtenerUsuarioCache(db: SQLiteDatabase): Promise<Usuario | null> {
  const row = await db.getFirstAsync<{ valor: string }>("SELECT valor FROM metadatos WHERE clave = 'usuario_cache'");
  if (!row) return null;
  try { return JSON.parse(row.valor) as Usuario; } catch { return null; }
}
export async function borrarUsuarioCache(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("DELETE FROM metadatos WHERE clave = 'usuario_cache'");
  await db.runAsync("DELETE FROM favoritos_lineas");
  await db.runAsync("DELETE FROM favoritos_paradas");
}


export async function guardarHorariosLinea(db: SQLiteDatabase, lineaId: string, horarios: import("../tipos/transporte").Horario[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM horarios_cache WHERE lineaId = ?", lineaId);
    for (const h of horarios) {
      await db.runAsync(
        "INSERT OR REPLACE INTO horarios_cache (id, lineaId, paradaId, sentido, tipoDeDia, hora) VALUES (?, ?, ?, ?, ?, ?)",
        h.id, h.lineaId, h.paradaId, h.sentido, h.tipoDeDia, h.hora
      );
    }
    await db.runAsync("INSERT OR REPLACE INTO metadatos (clave, valor) VALUES (?, ?)", `horarios_linea_${lineaId}`, new Date().toISOString());
  });
}

export async function guardarFeriadosAnio(db: SQLiteDatabase, anio: number, feriados: import("../tipos/transporte").Feriado[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM feriados_cache WHERE anio = ?", anio);
    for (const f of feriados) {
      await db.runAsync("INSERT OR REPLACE INTO feriados_cache (fecha, nombre, anio) VALUES (?, ?, ?)", f.fecha, f.nombre, anio);
    }
    await db.runAsync("INSERT OR REPLACE INTO metadatos (clave, valor) VALUES (?, ?)", `feriados_${anio}`, new Date().toISOString());
  });
}

export async function obtenerHorariosCache(
  db: SQLiteDatabase,
  filtros: { lineaId?: string; paradaId?: string; tipoDeDia: import("../tipos/transporte").TipoDeDia }
): Promise<import("../tipos/transporte").Horario[]> {
  if (!filtros.lineaId && !filtros.paradaId) throw new Error("Indicá una línea o una parada para consultar horarios.");
  const condiciones = ["tipoDeDia = ?"];
  const valores: (string | number)[] = [filtros.tipoDeDia];
  if (filtros.lineaId) { condiciones.push("lineaId = ?"); valores.push(filtros.lineaId); }
  if (filtros.paradaId) { condiciones.push("paradaId = ?"); valores.push(filtros.paradaId); }
  const filas = await db.getAllAsync<import("../tipos/transporte").Horario>(
    `SELECT id, lineaId, paradaId, sentido, tipoDeDia, hora FROM horarios_cache WHERE ${condiciones.join(" AND ")} ORDER BY hora ASC`,
    ...valores
  );
  return filas;
}

export async function obtenerTipoDeDiaCache(db: SQLiteDatabase, fecha: Date = new Date()): Promise<import("../tipos/transporte").TipoDeDia> {
  const fechaTexto = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}-${String(fecha.getDate()).padStart(2,"0")}`;
  const feriado = await db.getFirstAsync<{ fecha: string }>("SELECT fecha FROM feriados_cache WHERE fecha = ?", fechaTexto);
  if (feriado) return "feriado";
  const dia = fecha.getDay();
  if (dia === 0) return "domingo";
  if (dia === 6) return "sabado";
  return "habil";
}

export async function obtenerUltimaSincronizacion(db: SQLiteDatabase, clave: string): Promise<string | null> {
  const fila = await db.getFirstAsync<{ valor: string }>("SELECT valor FROM metadatos WHERE clave = ?", clave);
  return fila?.valor ?? null;
}


export async function guardarLineasCache(db: SQLiteDatabase, lineas: import("../tipos/transporte").Linea[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM lineas_cache");
    for (const linea of lineas) {
      await db.runAsync("INSERT OR REPLACE INTO lineas_cache (id, datos) VALUES (?, ?)", linea.id, JSON.stringify(linea));
    }
    await db.runAsync("INSERT OR REPLACE INTO metadatos (clave, valor) VALUES ('lineas_sync', ?)", new Date().toISOString());
  });
}

export async function obtenerLineasCache(db: SQLiteDatabase): Promise<import("../tipos/transporte").Linea[]> {
  const filas = await db.getAllAsync<{ datos: string }>("SELECT datos FROM lineas_cache ORDER BY id");
  return filas.flatMap(f => { try { return [JSON.parse(f.datos) as import("../tipos/transporte").Linea]; } catch { return []; } });
}

export async function obtenerLineaCache(db: SQLiteDatabase, id: string): Promise<import("../tipos/transporte").Linea | null> {
  const fila = await db.getFirstAsync<{ datos: string }>("SELECT datos FROM lineas_cache WHERE id = ?", id);
  if (!fila) return null;
  try { return JSON.parse(fila.datos) as import("../tipos/transporte").Linea; } catch { return null; }
}


export async function guardarParadasCache(db: SQLiteDatabase, paradas: import("../tipos/transporte").Parada[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM paradas_cache");
    for (const parada of paradas) {
      await db.runAsync("INSERT OR REPLACE INTO paradas_cache (id, datos) VALUES (?, ?)", parada.id, JSON.stringify(parada));
    }
    await db.runAsync("INSERT OR REPLACE INTO metadatos (clave, valor) VALUES ('paradas_sync', ?)", new Date().toISOString());
  });
}

export async function obtenerParadasCache(db: SQLiteDatabase): Promise<import("../tipos/transporte").Parada[]> {
  const filas = await db.getAllAsync<{ datos: string }>("SELECT datos FROM paradas_cache ORDER BY id");
  return filas.flatMap(f => { try { return [JSON.parse(f.datos) as import("../tipos/transporte").Parada]; } catch { return []; } });
}

export async function obtenerParadaCache(db: SQLiteDatabase, id: string): Promise<import("../tipos/transporte").Parada | null> {
  const fila = await db.getFirstAsync<{ datos: string }>("SELECT datos FROM paradas_cache WHERE id = ?", id);
  if (!fila) return null;
  try { return JSON.parse(fila.datos) as import("../tipos/transporte").Parada; } catch { return null; }
}


export interface ReportePendienteLocal {
  id: string;
  usuarioId: string;
  lineaId: string;
  paradaId: string;
  motivo: import("../tipos/transporte").MotivoDemora;
  comentario: string | null;
  fotoLocalUri: string | null;
  fotoUri: string | null;
  fotoNombre: string | null;
  fotoTipo: string | null;
  fechaHora: string;
}

export async function guardarReportePendiente(db: SQLiteDatabase, reporte: ReportePendienteLocal): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO cola_reportes (id, payload, creadoEn, sincronizado) VALUES (?, ?, ?, 0)",
    reporte.id, JSON.stringify(reporte), reporte.fechaHora
  );
}

export async function obtenerReportesPendientes(db: SQLiteDatabase): Promise<ReportePendienteLocal[]> {
  const filas = await db.getAllAsync<{ payload: string }>("SELECT payload FROM cola_reportes WHERE sincronizado = 0 ORDER BY creadoEn ASC");
  return filas.flatMap(f => { try { return [JSON.parse(f.payload) as ReportePendienteLocal]; } catch { return []; } });
}

export async function quitarReportePendiente(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM cola_reportes WHERE id = ?", id);
}


export interface RecordatorioLocal {
  notificationId: string;
  paradaId: string;
  lineaId: string;
  horaServicio: string;
  fechaServicio: string;
  creadoEn: string;
}

export async function guardarRecordatorioLocal(db: SQLiteDatabase, recordatorio: RecordatorioLocal): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO recordatorios_locales (notificationId, paradaId, lineaId, horaServicio, fechaServicio, creadoEn) VALUES (?, ?, ?, ?, ?, ?)",
    recordatorio.notificationId, recordatorio.paradaId, recordatorio.lineaId, recordatorio.horaServicio, recordatorio.fechaServicio, recordatorio.creadoEn
  );
}

export async function obtenerRecordatoriosLocales(db: SQLiteDatabase): Promise<RecordatorioLocal[]> {
  return db.getAllAsync<RecordatorioLocal>("SELECT notificationId, paradaId, lineaId, horaServicio, fechaServicio, creadoEn FROM recordatorios_locales ORDER BY fechaServicio ASC, horaServicio ASC");
}

export async function borrarRecordatorioLocal(db: SQLiteDatabase, notificationId: string): Promise<void> {
  await db.runAsync("DELETE FROM recordatorios_locales WHERE notificationId = ?", notificationId);
}
