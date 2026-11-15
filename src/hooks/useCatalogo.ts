import { useCallback, useEffect, useMemo, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import type { Linea, Parada } from "../tipos/transporte";
import { obtenerLineas } from "../servicios/lineas";
import { obtenerParadas } from "../servicios/paradas";
import { obtenerLineasCache, obtenerParadasCache } from "../base-datos/db";

// Se guardan en memoria para no pedir dos veces lo mismo mientras la app está abierta.
let memoLineas: Linea[] | null = null;
let memoParadas: Parada[] | null = null;

/**
 * Líneas y paradas para mostrar nombres legibles ("Línea 5", "Alameda y Urquiza") en lugar de
 * identificadores ("lin-05", "par-101"). Primero usa lo guardado en el teléfono y después intenta
 * actualizar con la API, así funciona sin conexión.
 */
export function useCatalogo() {
  const db = useSQLiteContext();
  const [lineas, setLineas] = useState<Linea[]>(memoLineas ?? []);
  const [paradas, setParadas] = useState<Parada[]>(memoParadas ?? []);

  useEffect(() => {
    let vigente = true;
    (async () => {
      if (!memoLineas) {
        const guardadas = await obtenerLineasCache(db).catch(() => []);
        if (vigente && guardadas.length) setLineas(guardadas);
        try { memoLineas = await obtenerLineas(); if (vigente) setLineas(memoLineas); } catch { /* se queda con lo guardado */ }
      }
      if (!memoParadas) {
        let lista = await obtenerParadasCache(db).catch(() => []);
        if (!lista.length) lista = await obtenerParadas().catch(() => []);
        if (lista.length) memoParadas = lista;
        if (vigente) setParadas(lista);
      }
    })();
    return () => { vigente = false; };
  }, [db]);

  const lineaPorId = useMemo(() => new Map(lineas.map(l => [l.id, l])), [lineas]);
  const paradaPorId = useMemo(() => new Map(paradas.map(p => [p.id, p])), [paradas]);

  const nombreLinea = useCallback((id: string) => {
    const linea = lineaPorId.get(id);
    return linea ? `Línea ${linea.numero}` : `Línea ${id.replace("lin-", "").replace(/^0+/, "")}`;
  }, [lineaPorId]);
  const colorLinea = useCallback((id: string) => lineaPorId.get(id)?.color ?? "#147D92", [lineaPorId]);
  const nombreParada = useCallback((id: string) => paradaPorId.get(id)?.nombre ?? `Parada ${id.replace("par-", "")}`, [paradaPorId]);

  return { lineas, paradas, nombreLinea, colorLinea, nombreParada };
}
