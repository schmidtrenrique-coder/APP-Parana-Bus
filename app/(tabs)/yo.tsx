import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useSesion } from "../../src/contexto/SesionContext";
import { useCatalogo } from "../../src/hooks/useCatalogo";
import { cancelarRecordatorioLocal, desactivarAvisosPush, listarRecordatoriosLocales, probarNotificacionPush, registrarDispositivoPush, solicitarPermisoNotificaciones } from "../../src/servicios/notificaciones";
import { actualizarMiUsuario, obtenerMiUsuario } from "../../src/servicios/sesion";
import { avisosLocalesActivos, bloqueoBiometricoActivo, guardarAvisosLocales, guardarBloqueoBiometrico, guardarTema, leerTema } from "../../src/servicios/preferencias";
import { biometriaDisponible } from "../../src/servicios/biometria";
import { vibrarError, vibrarExito } from "../../src/servicios/haptica";
import type { RecordatorioLocal } from "../../src/base-datos/db";
import type { Tema } from "../../src/tipos/transporte";
import { useColores, useEstilos, type Paleta } from "../../src/tema/tema";
import BannerRed from "../../src/componentes/BannerRed";

const TEMAS: { valor: Tema; titulo: string }[] = [{ valor: "sistema", titulo: "Como el teléfono" }, { valor: "claro", titulo: "Claro" }, { valor: "oscuro", titulo: "Oscuro" }];

export default function YoScreen() {
  const s = useEstilos(crearEstilos);
  const c = useColores();
  const { usuario, cargandoSesion, errorSesion, bloqueada, emailBloqueado, desbloquear, desbloquearConContrasena, ingresarCuenta, registrarCuenta, cerrarCuenta, actualizarUsuario } = useSesion();
  const db = useSQLiteContext();
  const { nombreLinea, nombreParada } = useCatalogo();
  const [recordatorios, setRecordatorios] = useState<RecordatorioLocal[]>([]);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [procesandoPush, setProcesandoPush] = useState(false);
  const [probandoPush, setProbandoPush] = useState(false);
  const [mensajePush, setMensajePush] = useState<string | null>(null);
  const [errorPush, setErrorPush] = useState<string | null>(null);

  // Preferencias guardadas en el teléfono (expo-sqlite/kv-store)
  const [tema, setTema] = useState<Tema>(leerTema());
  const [bloqueo, setBloqueo] = useState(bloqueoBiometricoActivo());
  const [avisosLocales, setAvisosLocales] = useState(avisosLocalesActivos());
  const [mensajePref, setMensajePref] = useState<string | null>(null);
  const [hayBiometria, setHayBiometria] = useState(true);
  useEffect(() => { biometriaDisponible().then(setHayBiometria); }, []);

  // Formularios
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [usandoPassword, setUsandoPassword] = useState(false);

  const cargarRecordatorios = useCallback(async () => { setRecordatorios(await listarRecordatoriosLocales(db)); }, [db]);
  useFocusEffect(useCallback(() => { cargarRecordatorios().catch(() => undefined); }, [cargarRecordatorios]));

  async function cambiarTema(nuevo: Tema) {
    setTema(nuevo); guardarTema(nuevo);
    // Si hay sesión, se guarda también en la cuenta (mejor esfuerzo: sin conexión queda solo en el teléfono).
    if (usuario) actualizarMiUsuario({ tema: nuevo }).catch(() => undefined);
  }
  async function cambiarAvisosLocales(activo: boolean) {
    setMensajePref(null);
    if (activo) {
      const permiso = await solicitarPermisoNotificaciones().catch(() => false);
      if (!permiso) { setMensajePref("Para avisarte necesitamos permiso de notificaciones. Podés darlo desde los ajustes del teléfono."); return; }
    }
    guardarAvisosLocales(activo); setAvisosLocales(activo);
  }

  async function alternarAvisosPush() {
    setProcesandoPush(true); setMensajePush(null); setErrorPush(null);
    try {
      if (usuario?.avisosActivos) {
        await desactivarAvisosPush();
        await actualizarUsuario(await obtenerMiUsuario());
        setMensajePush("Avisos push desactivados.");
      } else {
        const resultado = await registrarDispositivoPush();
        if (resultado.registrado) { await actualizarUsuario(await obtenerMiUsuario()); setMensajePush(resultado.mensaje); }
        else setErrorPush(resultado.mensaje);
      }
    } catch (e) { setErrorPush(e instanceof Error ? e.message : "No se pudieron actualizar los avisos."); }
    finally { setProcesandoPush(false); }
  }
  async function probarAvisosPush() {
    setProbandoPush(true); setMensajePush(null); setErrorPush(null);
    try { await probarNotificacionPush(); setMensajePush("La API aceptó la notificación de prueba."); }
    catch (e) { setErrorPush(e instanceof Error ? e.message : "No se pudo enviar la notificación de prueba."); }
    finally { setProbandoPush(false); }
  }
  async function cancelarRecordatorio(id: string) {
    setCancelando(id);
    try { await cancelarRecordatorioLocal(db, id); await cargarRecordatorios(); }
    catch (e) { setErrorPush(e instanceof Error ? e.message : "No se pudo cancelar el recordatorio."); }
    finally { setCancelando(null); }
  }

  async function enviar() {
    setError(null);
    if (!email.trim() || !password) { setError("Completá el email y la contraseña."); return; }
    if (modoRegistro && !nombre.trim()) { setError("Ingresá tu nombre."); return; }
    setProcesando(true);
    try {
      if (modoRegistro) await registrarCuenta(nombre.trim(), email.trim(), password);
      else await ingresarCuenta(email.trim(), password);
      setPassword(""); vibrarExito();
    } catch (e) { vibrarError(); setError(e instanceof Error ? e.message : "No se pudo completar la operación."); }
    finally { setProcesando(false); }
  }
  async function enviarPasswordDeBloqueo() {
    setError(null);
    if (!password) { setError("Ingresá tu contraseña."); return; }
    setProcesando(true);
    try { await desbloquearConContrasena(password); setPassword(""); setUsandoPassword(false); vibrarExito(); }
    catch (e) { vibrarError(); setError(e instanceof Error ? e.message : "No se pudo desbloquear la cuenta."); }
    finally { setProcesando(false); }
  }

  const preferencias = <View style={s.card}>
    <Text style={s.seccionInterna}>Apariencia</Text>
    <View style={s.segmentos}>{TEMAS.map(t => <Pressable key={t.valor} onPress={() => cambiarTema(t.valor)} style={[s.segmento, tema === t.valor && s.segmentoActivo]} accessibilityRole="button" accessibilityState={{ selected: tema === t.valor }}>
      <Text style={[s.segmentoTexto, tema === t.valor && s.segmentoTextoActivo]}>{t.titulo}</Text></Pressable>)}</View>
    <View style={s.filaSwitch}><View style={{ flex: 1 }}><Text style={s.favorite}>Avisarme de avisos nuevos</Text><Text style={s.sub}>Una notificación en este teléfono cuando aparece un aviso en una de tus líneas favoritas.</Text></View>
      <Switch value={avisosLocales} onValueChange={cambiarAvisosLocales} trackColor={{ false: c.bordeFuerte, true: c.acentoFondo }} /></View>
    {usuario ? <View style={s.filaSwitch}><View style={{ flex: 1 }}><Text style={s.favorite}>Pedir huella, rostro o PIN al abrir</Text><Text style={s.sub}>{hayBiometria ? "Protege tu cuenta cuando reabrís la app." : "Este teléfono no tiene huella ni PIN registrados: vas a usar tu contraseña."}</Text></View>
      <Switch value={bloqueo} onValueChange={v => { setBloqueo(v); guardarBloqueoBiometrico(v); }} trackColor={{ false: c.bordeFuerte, true: c.acentoFondo }} /></View> : null}
    {mensajePref ? <Text style={s.warning}>{mensajePref}</Text> : null}
  </View>;

  if (cargandoSesion) return <View style={[s.page, s.center]}><ActivityIndicator size="large" /><Text style={s.sub}>Revisando tu sesión...</Text></View>;

  // Sesión guardada pero protegida: falta confirmar identidad.
  if (bloqueada) return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>Sesión protegida</Text>
    <Text style={s.sub}>Confirmá tu identidad para ver tu cuenta, tus favoritos y tus reportes. Podés seguir consultando líneas, paradas y avisos sin hacerlo.</Text>
    <View style={s.card}>
      {emailBloqueado ? <Text style={s.name}>{emailBloqueado}</Text> : null}
      {hayBiometria ? <Pressable style={s.primaryButton} onPress={() => { desbloquear().then(ok => { if (!ok) setError("No se pudo confirmar tu identidad. Podés intentar de nuevo o usar tu contraseña."); }); }}><Text style={s.primaryText}>Desbloquear con huella, rostro o PIN</Text></Pressable> : null}
      {!usandoPassword ? <Pressable style={s.switchButton} onPress={() => { setUsandoPassword(true); setError(null); }}><Text style={s.switchText}>{hayBiometria ? "Usar mi contraseña" : "Ingresar con mi contraseña"}</Text></Pressable>
        : <>
          <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={c.suave} secureTextEntry style={s.input} />
          <Pressable style={[s.primaryButton, procesando && s.disabled]} disabled={procesando} onPress={enviarPasswordDeBloqueo}>{procesando ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>Desbloquear</Text>}</Pressable>
        </>}
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable style={s.secondaryButton} onPress={() => cerrarCuenta()}><Text style={s.secondaryText}>Cerrar sesión y borrar datos de la cuenta</Text></Pressable>
    </View>
    {preferencias}
  </ScrollView>;

  if (usuario) return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.title}>Mi cuenta</Text>
    <BannerRed />
    <View style={s.card}>
      <Text style={s.name}>{usuario.nombre}</Text>
      <Text style={s.sub}>{usuario.email}</Text>
      <Text style={s.status}>Sesión iniciada</Text>
      {errorSesion ? <Text style={s.warning}>No se pudo actualizar la cuenta desde el servidor. Se muestran los últimos datos guardados.</Text> : null}
      <Pressable style={s.secondaryButton} onPress={() => cerrarCuenta()}><Text style={s.secondaryText}>Cerrar sesión</Text></Pressable>
    </View>
    {preferencias}
    <RecordatoriosPanel recordatorios={recordatorios} cancelar={cancelarRecordatorio} cancelando={cancelando} nombreLinea={nombreLinea} nombreParada={nombreParada} />
    <Text style={s.section}>Mis líneas favoritas</Text>
    <View style={s.card}>
      {usuario.lineasFavoritas.length ? usuario.lineasFavoritas.map(id => <Link key={id} href={{ pathname: "/lineas/[id]", params: { id } }} style={s.favorite}>{nombreLinea(id)}  ›</Link>) : <Text style={s.sub}>Todavía no guardaste líneas favoritas.</Text>}
    </View>
    <Text style={s.section}>Mis paradas favoritas</Text>
    <View style={s.card}>
      {usuario.paradasFavoritas.length ? usuario.paradasFavoritas.map(id => <Link key={id} href={{ pathname: "/paradas/[id]", params: { id } }} style={s.favorite}>{nombreParada(id)}  ›</Link>) : <Text style={s.sub}>Todavía no guardaste paradas favoritas.</Text>}
    </View>
    <Text style={s.section}>Notificaciones push</Text>
    <View style={s.card}>
      <Text style={s.sub}>Las envía el servidor cuando la Dirección publica un aviso en una línea favorita, aunque la app esté cerrada. Necesitan una versión instalada de la app (APK o development build): en Expo Go de Android no están disponibles.</Text>
      <Pressable disabled={procesandoPush} onPress={alternarAvisosPush} style={s.secondaryButton}><Text style={s.secondaryText}>{procesandoPush ? "Procesando..." : usuario.avisosActivos ? "Desactivar avisos push" : "Activar avisos push"}</Text></Pressable>
      {mensajePush ? <Text style={s.success}>{mensajePush}</Text> : null}
      {errorPush ? <Text style={s.error}>{errorPush}</Text> : null}
      {usuario.avisosActivos ? <Pressable disabled={probandoPush} onPress={probarAvisosPush} style={s.switchButton}><Text style={s.switchText}>{probandoPush ? "Enviando prueba..." : "Enviar notificación de prueba"}</Text></Pressable> : null}
    </View>
    <Text style={s.footer}>Tus favoritos se sincronizan con tu cuenta y se conservan en el teléfono para consultarlos sin conexión.</Text>
  </ScrollView>;

  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <Text style={s.title}>{modoRegistro ? "Crear cuenta" : "Ingresar"}</Text>
    <BannerRed />
    <Text style={s.sub}>Iniciá sesión para guardar tus líneas y paradas favoritas.</Text>
    <View style={s.card}>
      {modoRegistro ? <TextInput value={nombre} onChangeText={setNombre} placeholder="Nombre" placeholderTextColor={c.suave} autoCapitalize="words" style={s.input} /> : null}
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.suave} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={s.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={c.suave} secureTextEntry style={s.input} />
      {error ? <Text style={s.error}>{error}</Text> : null}
      {errorSesion ? <Text style={s.error}>{errorSesion}</Text> : null}
      <Pressable style={[s.primaryButton, procesando && s.disabled]} onPress={enviar} disabled={procesando}>
        {procesando ? <ActivityIndicator color="white" /> : <Text style={s.primaryText}>{modoRegistro ? "Crear cuenta" : "Ingresar"}</Text>}
      </Pressable>
      <Pressable onPress={() => { setModoRegistro(v => !v); setError(null); }} style={s.switchButton}>
        <Text style={s.switchText}>{modoRegistro ? "Ya tengo una cuenta · Ingresar" : "No tengo cuenta · Registrarme"}</Text>
      </Pressable>
    </View>
    {preferencias}
    <RecordatoriosPanel recordatorios={recordatorios} cancelar={cancelarRecordatorio} cancelando={cancelando} nombreLinea={nombreLinea} nombreParada={nombreParada} />
    <Text style={s.footer}>Podés consultar líneas, paradas, horarios y avisos sin iniciar sesión.</Text>
  </ScrollView>;
}

function RecordatoriosPanel({ recordatorios, cancelar, cancelando, nombreLinea, nombreParada }: { recordatorios: RecordatorioLocal[]; cancelar: (id: string) => void; cancelando: string | null; nombreLinea: (id: string) => string; nombreParada: (id: string) => string }) {
  const s = useEstilos(crearEstilos);
  return <View style={s.card}>
    <Text style={s.seccionInterna}>Mis recordatorios</Text>
    {recordatorios.length ? recordatorios.map(r => <View key={r.notificationId} style={s.reminderRow}>
      <View style={{ flex: 1 }}><Text style={s.favoriteSinBorde}>{nombreLinea(r.lineaId)} · {r.horaServicio}</Text><Text style={s.sub}>{r.fechaServicio} · {nombreParada(r.paradaId)}</Text></View>
      <Pressable disabled={cancelando === r.notificationId} onPress={() => cancelar(r.notificationId)}><Text style={s.switchText}>{cancelando === r.notificationId ? "..." : "Cancelar"}</Text></Pressable>
    </View>) : <Text style={s.sub}>Todavía no programaste recordatorios. Podés crearlos desde los próximos servicios de una parada.</Text>}
  </View>;
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.fondo }, content: { padding: 18, paddingTop: 56, paddingBottom: 36 }, center: { alignItems: "center", justifyContent: "center" },
  title: { fontSize: 27, fontWeight: "800", color: c.titulo, marginBottom: 5 }, sub: { color: c.suave, lineHeight: 20, marginTop: 4 },
  card: { backgroundColor: c.tarjeta, padding: 15, borderRadius: 12, marginTop: 14 }, name: { fontSize: 20, fontWeight: "800", color: c.texto }, status: { color: c.acento, fontWeight: "700", marginTop: 8 },
  section: { fontSize: 19, fontWeight: "800", color: c.titulo, marginTop: 22 }, seccionInterna: { fontSize: 17, fontWeight: "800", color: c.titulo, marginBottom: 6 },
  favorite: { color: c.acento, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.borde, fontWeight: "700" }, favoriteSinBorde: { color: c.acento, fontWeight: "700" },
  input: { backgroundColor: c.fondo, borderWidth: 1, borderColor: c.borde, borderRadius: 9, padding: 12, marginBottom: 10, marginTop: 12, color: c.texto },
  primaryButton: { backgroundColor: c.primario, padding: 13, borderRadius: 9, alignItems: "center", marginTop: 12 }, primaryText: { color: "white", fontWeight: "800" }, disabled: { opacity: 0.6 },
  secondaryButton: { backgroundColor: c.secundario, padding: 11, borderRadius: 9, alignItems: "center", marginTop: 14 }, secondaryText: { color: c.textoSecundario, fontWeight: "700" },
  switchButton: { padding: 12, alignItems: "center" }, switchText: { color: c.acento, fontWeight: "700" },
  error: { color: c.error, marginTop: 10, lineHeight: 19 }, warning: { color: c.avisoTexto, marginTop: 10, lineHeight: 19 }, success: { color: c.exito, marginTop: 8, lineHeight: 19 },
  reminderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.borde },
  segmentos: { flexDirection: "row", gap: 8, marginBottom: 6 }, segmento: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center", borderWidth: 1, borderColor: c.borde },
  segmentoActivo: { backgroundColor: c.primario, borderColor: c.primario }, segmentoTexto: { color: c.texto, fontWeight: "700", fontSize: 12 }, segmentoTextoActivo: { color: "white" },
  filaSwitch: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, marginTop: 8, borderTopWidth: 1, borderTopColor: c.borde },
  footer: { color: c.suave, fontSize: 12, marginTop: 16, lineHeight: 18 }
});
