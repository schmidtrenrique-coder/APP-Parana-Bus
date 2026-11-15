import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSQLiteContext } from "expo-sqlite";
import { Usuario } from "../tipos/transporte";
import { ApiError } from "../servicios/api";
import { agregarLineaFavorita, agregarParadaFavorita, cerrarSesionLocal, ingresar, obtenerMiUsuario, obtenerToken, quitarLineaFavorita, quitarParadaFavorita, registrarse } from "../servicios/sesion";
import { borrarUsuarioCache, guardarUsuarioCache, obtenerUsuarioCache } from "../base-datos/db";
import { bloqueoBiometricoActivo } from "../servicios/preferencias";
import { pedirBiometria } from "../servicios/biometria";

type SesionContexto = {
  usuario: Usuario | null;
  cargandoSesion: boolean;
  errorSesion: string | null;
  /** Hay una sesión guardada pero falta confirmar la identidad (huella, rostro, PIN o contraseña). */
  bloqueada: boolean;
  /** Email de la cuenta guardada, para el camino alternativo con contraseña. */
  emailBloqueado: string | null;
  desbloquear: () => Promise<boolean>;
  desbloquearConContrasena: (password: string) => Promise<void>;
  ingresarCuenta: (email: string, password: string) => Promise<void>;
  registrarCuenta: (nombre: string, email: string, password: string) => Promise<void>;
  cerrarCuenta: () => Promise<void>;
  alternarLinea: (id: string) => Promise<void>;
  alternarParada: (id: string) => Promise<void>;
  actualizarUsuario: (usuario: Usuario) => Promise<void>;
};
const Contexto = createContext<SesionContexto | null>(null);

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [errorSesion, setErrorSesion] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [emailBloqueado, setEmailBloqueado] = useState<string | null>(null);
  const intentoAutomatico = useRef(false);

  const actualizarUsuario = useCallback(async (nuevo: Usuario) => {
    setUsuario(nuevo);
    await guardarUsuarioCache(db, nuevo);
  }, [db]);

  const refrescar = useCallback(async () => {
    const token = await obtenerToken();
    if (!token) { setUsuario(null); return; }
    try {
      await actualizarUsuario(await obtenerMiUsuario());
      setErrorSesion(null);
    } catch (e) {
      if (e instanceof ApiError && e.estado === 401) {
        await cerrarSesionLocal();
        await borrarUsuarioCache(db);
        setUsuario(null);
      } else {
        const cache = await obtenerUsuarioCache(db);
        if (cache) setUsuario(cache);
        setErrorSesion(e instanceof Error ? e.message : "No se pudo actualizar la cuenta.");
      }
    }
  }, [actualizarUsuario, db]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        // Si había una sesión guardada, el reingreso pide confirmar identidad antes de mostrar la cuenta.
        const token = await obtenerToken();
        const guardado = token ? await obtenerUsuarioCache(db) : null;
        if (token && guardado && bloqueoBiometricoActivo()) {
          if (activo) { setEmailBloqueado(guardado.email); setBloqueada(true); }
          return;
        }
        await refrescar();
      } finally {
        if (activo) setCargandoSesion(false);
      }
    })();
    return () => { activo = false; };
  }, [refrescar, db]);

  const desbloquear = useCallback(async (): Promise<boolean> => {
    const confirmado = await pedirBiometria("Desbloqueá Paraná Bus para ver tu cuenta");
    if (confirmado) { setBloqueada(false); await refrescar(); }
    return confirmado;
  }, [refrescar]);

  /** Camino alternativo para teléfonos sin huella/PIN o cuando falla la biometría: volver a validar la contraseña con la API. */
  const desbloquearConContrasena = useCallback(async (password: string) => {
    if (!emailBloqueado) throw new Error("No hay una cuenta guardada en este teléfono.");
    const sesion = await ingresar(emailBloqueado, password);
    await actualizarUsuario(sesion.usuario);
    setErrorSesion(null);
    setBloqueada(false);
  }, [emailBloqueado, actualizarUsuario]);

  // Al abrir la app con la sesión bloqueada se pide la huella una vez, sin que la persona tenga que buscar nada.
  useEffect(() => {
    if (bloqueada && !intentoAutomatico.current) {
      intentoAutomatico.current = true;
      desbloquear().catch(() => undefined);
    }
  }, [bloqueada, desbloquear]);

  const ingresarCuenta = useCallback(async (email: string, password: string) => {
    setErrorSesion(null);
    const sesion = await ingresar(email, password);
    await actualizarUsuario(sesion.usuario);
  }, [actualizarUsuario]);
  const registrarCuenta = useCallback(async (nombre: string, email: string, password: string) => {
    setErrorSesion(null);
    const sesion = await registrarse(nombre, email, password);
    await actualizarUsuario(sesion.usuario);
  }, [actualizarUsuario]);
  const cerrarCuenta = useCallback(async () => {
    await cerrarSesionLocal();
    await borrarUsuarioCache(db);
    setUsuario(null);
    setErrorSesion(null);
    setBloqueada(false);
    setEmailBloqueado(null);
  }, [db]);
  const alternarLinea = useCallback(async (id: string) => {
    if (!usuario) throw new Error("Iniciá sesión para guardar favoritos.");
    if (usuario.lineasFavoritas.includes(id)) {
      await quitarLineaFavorita(id);
      await actualizarUsuario(await obtenerMiUsuario());
    } else await actualizarUsuario(await agregarLineaFavorita(id));
  }, [actualizarUsuario, usuario]);
  const alternarParada = useCallback(async (id: string) => {
    if (!usuario) throw new Error("Iniciá sesión para guardar favoritos.");
    if (usuario.paradasFavoritas.includes(id)) {
      await quitarParadaFavorita(id);
      await actualizarUsuario(await obtenerMiUsuario());
    } else await actualizarUsuario(await agregarParadaFavorita(id));
  }, [actualizarUsuario, usuario]);

  const valor = useMemo(() => ({ usuario, cargandoSesion, errorSesion, bloqueada, emailBloqueado, desbloquear, desbloquearConContrasena, ingresarCuenta, registrarCuenta, cerrarCuenta, alternarLinea, alternarParada, actualizarUsuario }), [usuario, cargandoSesion, errorSesion, bloqueada, emailBloqueado, desbloquear, desbloquearConContrasena, ingresarCuenta, registrarCuenta, cerrarCuenta, alternarLinea, alternarParada, actualizarUsuario]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
export function useSesion() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useSesion debe usarse dentro de SesionProvider.");
  return contexto;
}
