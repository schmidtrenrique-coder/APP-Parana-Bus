# Paraná Bus

Aplicación móvil para consultar el transporte público de Paraná. Base desarrollada con React Native, Expo Router y TypeScript.

## Requisitos
- Node.js LTS compatible con Expo SDK 54.
- npm.
- API de Transporte Público de la cátedra en ejecución o publicada.

## Configurar la API
1. Copiar `.env.example` como `.env`.
2. Definir `EXPO_PUBLIC_API_URL` con la dirección de la API.
   - Emulador Android: normalmente `http://10.0.2.2:3000`.
   - Teléfono físico: `http://IP_DE_TU_PC:3000` (ambos en la misma Wi-Fi).
   - API publicada: usar su dirección `https://`.
3. Comprobar que `GET /salud` responda correctamente desde el navegador del dispositivo.

No usar `localhost` desde un teléfono físico: apuntaría al propio teléfono.

## Ejecutar
```bash
npm install
npx expo install --fix
npx expo start
```

## APK de prueba
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

## Estado de implementación
- [x] Navegación principal y pantallas de líneas, paradas, avisos y perfil.
- [x] Cliente HTTP común con manejo de errores de la API.
- [x] Servicios conectados a líneas, paradas, horarios y avisos.
- [x] Inicio de sesión y registro preparados con token en SecureStore.
- [x] Base SQLite inicial para favoritos y cola de reportes.
- [x] Completar autenticación y sincronización de favoritos con la API.
- [x] Persistir líneas, paradas, horarios y feriados sin conexión (descarga manual desde la pestaña Líneas).
- [x] Escanear QR de paradas y abrir su detalle.
- [x] Buscar paradas cercanas con permiso de ubicación y mostrarlas en mapa.
- [x] Crear reportes de demora, adjuntar foto y confirmar reportes recientes.
- [x] Guardar reportes sin conexión y permitir su sincronización manual posterior.
- [x] Programar recordatorios locales 10 minutos antes de los próximos servicios y administrarlos desde la pestaña Yo.
- [x] Preparar el registro de tokens Expo y la preferencia de avisos push en el cliente móvil (requiere backend de notificaciones habilitado).
- [x] Mostrar el trazado de cada recorrido (ida y vuelta) en el mapa desde el detalle de línea.
- [x] Avisos con recorrido alternativo en mapa, video (si la API lo provee) y fechas/líneas legibles.
- [x] Pruebas funcionales en Expo Go y en APK de prueba instalada en el emulador Pixel 8.

Los mocks originales se conservan como material de referencia, pero los servicios de las pantallas principales ya consultan la API. No se debe presentar la información como real hasta configurar y probar una instancia accesible de la API.


## Horarios sin conexión

Desde la pestaña **Líneas** se puede descargar la tabla de horarios de cada línea y los feriados de 2026 y 2027. Los datos quedan guardados en SQLite y el detalle de línea consulta la tabla local según el tipo de día. La clasificación prioriza feriado, domingo, sábado y día hábil. En el detalle de parada, si falla la consulta de próximos servicios, se calculan localmente los siguientes servicios usando el tipo de día de hoy y, si hace falta, el de mañana. La descarga inicial requiere conexión.

## Cuenta y favoritos

La pestaña **Yo** permite ingresar o crear una cuenta de pasajero. El token de sesión se guarda con `expo-secure-store`; al abrir la app se consulta `/yo` para recuperar los datos de la cuenta. Si no hay conexión, se muestran los últimos datos de perfil y favoritos guardados en SQLite.

Desde el detalle de una línea o parada se puede agregarla o quitarla de favoritos. Los cambios se envían a la API y luego se actualiza la copia local. Para usar estas funciones se necesita conexión y una cuenta.


## QR, ubicación y mapa

En la pestaña **Paradas** se puede escanear el QR de una parada. La app consulta el endpoint de resolución de QR y contempla el formato `PARANA:<paradaId>` como alternativa para abrir el recurso por su identificador.

La opción **Paradas cercanas** solicita permiso de ubicación mientras se usa la app y consulta la API con latitud, longitud, radio de 2 km y orden por distancia. Si la API no está disponible, intenta filtrar las paradas guardadas localmente usando sus coordenadas. Los resultados se muestran en un mapa con la ubicación del dispositivo y marcadores de paradas; al tocar un marcador se puede abrir el detalle. No se realiza seguimiento de colectivos.

La disponibilidad de cámara debe validarse en un dispositivo o emulador compatible. Para mostrar Google Maps en un APK Android de producción, configurar una clave de Google Maps en `android.config.googleMaps.apiKey` dentro de `app.json` antes de compilar (no incluir claves privadas en el repositorio público). Las coordenadas mostradas dependen de los datos reales devueltos por la API.


## Reportes de demoras

Desde el detalle de una parada se puede crear un reporte para una de las líneas que pasan por allí. Se elige el motivo, se puede agregar un comentario y adjuntar una foto JPG, PNG o WEBP de hasta 5 MB. La foto se copia al almacenamiento privado de la app para conservarla si el reporte queda pendiente sin conexión. Para reportar se necesita una sesión iniciada.

Cuando hay conexión, la app sube primero la foto a `POST /archivos` y luego crea el reporte con `POST /reportes-demora`. Si no hay conexión o el servidor no responde, guarda el reporte en SQLite con un identificador generado en el teléfono. Desde la pantalla de reporte se puede usar **Sincronizar ahora** para enviar la cola pendiente cuando vuelva la conexión. El mismo identificador se reutiliza en los reintentos para evitar duplicados. La cola conserva el identificador de la cuenta que creó cada reporte, para no enviarlo accidentalmente desde otra cuenta.

En el detalle de parada se consultan los reportes recientes (ventana de 90 minutos). Un pasajero puede confirmar reportes de otras personas; el servidor impide confirmar el propio, confirmar reportes vencidos o repetir reportes de la misma línea y parada dentro de 15 minutos. Estas reglas se validan definitivamente en la API.


## Notificaciones y recordatorios

Desde el detalle de una parada se puede programar un recordatorio local para cada uno de los próximos servicios. La app solicita permiso para notificar y agenda un aviso 10 minutos antes del horario de tabla. Los recordatorios se guardan en SQLite y se pueden cancelar desde la pestaña **Yo**. Son locales: no necesitan cuenta ni conexión una vez programados. Si faltan menos de 10 minutos para el servicio, no se permite crear el recordatorio porque la hora de aviso ya pasó.

La pestaña **Yo** también permite intentar activar avisos push para líneas favoritas. El cliente obtiene un token Expo, lo registra en `POST /dispositivos` y actualiza `avisosActivos` en `/yo`. El backend de la cátedra deja a cargo del alumno el módulo `src/student-notifications/`: el ZIP complementario `parana-bus-backend-notificaciones.zip` incorpora el almacenamiento de tokens y el envío a Expo. Para recibir avisos reales, hay que desplegar esa versión del backend y configurar `NOTIFICACIONES=expo`; si el servidor sigue respondiendo `501 NO_IMPLEMENTADO`, está ejecutando una versión anterior o incompleta. Para obtener el token Expo se necesita un `projectId` de EAS configurado en `extra.eas.projectId` (se puede generar con `eas build:configure`) y probar en un dispositivo con una development/preview build compatible; Expo Go no sirve para validar push en SDK 54. Las notificaciones locales sí funcionan sin ese backend.


## Avisos, desvíos y recorridos en mapa (Ajustes 08)

El detalle de línea dibuja el trazado de cada sentido con un mapa de solo lectura (marcador verde al inicio, rojo al final). La visualización de recorridos y desvíos utiliza Leaflet dentro de `react-native-webview`, con cartografía de OpenStreetMap, para evitar la dependencia de una clave de Google Maps en esos mapas. La pestaña **Avisos** consulta los avisos vigentes, muestra el nombre de las líneas afectadas, las fechas de vigencia y, si el aviso trae `trazadoAlternativo`, dibuja el desvío en el mapa. Si trae `videoUrl`, aparece el botón «Ver video del aviso»; el reproductor se crea recién al tocarlo. Se puede actualizar deslizando hacia abajo. La actualización de avisos requiere conexión; la app puede mostrar la última copia guardada.

Validación actualizada en **Ajustes 12**: la aplicación se compiló e instaló como APK de prueba y se verificaron las pestañas principales en el emulador Pixel 8. La reproducción de videos depende de que la API proporcione una URL válida.

## Corrección de paginación (Ajustes 08)

La API limita `porPagina` a 100 en `/lineas` y `/avisos` (1000 en paradas y 5000 en horarios). La app pedía 5000 en líneas y avisos, y la API respondía 400. Se corrigió en `src/servicios/lineas.ts` y `src/servicios/avisos.ts`. El `.env.example` ahora apunta a `10.0.2.2` para el emulador de Android.

## Ajustes 09: cumplimiento de la consigna y del PRD

**Identidad (requisito 10).** Ícono propio de 1024×1024 en PNG sin transparencias (`assets/icon.png`), ícono adaptativo de Android, pantalla de presentación configurada con `expo-splash-screen` y nombre «Paraná Bus». Expo Go no muestra el splash propio ni el ícono: se ven en un build instalado.

**Autenticación y reingreso (requisito 2).** El token de sesión vive en `expo-secure-store`. Al reabrir la app, si había una sesión guardada, se pide huella, rostro o PIN con `expo-local-authentication` (se consulta antes si hay lector y algo registrado). El camino alternativo es la contraseña, que se vuelve a validar contra la API. Se puede desactivar desde la pestaña Yo.

**Persistencia y conectividad (requisito 7).** SQLite guarda recorridos, horarios, usuario y cola de reportes. `expo-sqlite/kv-store` guarda preferencias y datos livianos (tema, bloqueo, avisos ya vistos y la última copia de los avisos); el token no va ahí, por pedido del PRD. `expo-network` (`useNetworkState`) muestra una franja cuando no hay internet, y los avisos descargados se muestran marcados como viejos. Toda llamada a la API se corta a los 12 segundos para que una red colgada no deje la pantalla en un spinner.

**Archivos (requisito 4).** Con la API nueva de `expo-file-system` (`File`, `Directory`, `Paths`): las fotos de los reportes se copian de la caché a `Paths.document` y los videos de los avisos se pueden guardar para verlos sin conexión.

**Sensores y háptica (requisito 8).** En el detalle de una parada, una flecha apunta hacia ella con la ubicación y el magnetómetro (sin brújula, indica el punto cardinal). Hay vibración al confirmar o enviar un reporte, al leer un QR y al marcar un favorito, y siempre acompaña a un mensaje en pantalla.

**Notificaciones (requisito 6).** Locales: recordatorios de horario y un aviso cuando, al descargar los avisos, aparece uno nuevo en una línea favorita. Push remoto: lo envía la parte de la API de `src/student-notifications` y necesita un build instalado.

**PRD.** El aviso se ve al abrir la línea afectada; el detalle de línea lista las paradas por nombre y en orden; los próximos servicios dicen «según la tabla» y cuánto falta; si terminó el servicio de hoy se informa el primero de mañana; el inicio muestra primero los favoritos con sus próximos horarios; la parada se puede abrir en la app de mapas del teléfono; y hay modo claro, oscuro o el del teléfono (el mapa se mantiene claro).

### Qué no se pudo verificar
Esta versión pasó una revisión estática (sin nombres indefinidos ni imports rotos), pero no se ejecutó. Falta correr `npm run typecheck` y probarla en el emulador.

## Ajustes 10: horarios por día y paradas cercanas en el inicio

- **Horarios de una línea por tipo de día.** El detalle de línea tiene un selector Hábil / Sábado / Domingo / Feriado. Arranca en el tipo de hoy (considera los feriados descargados) y funciona sin conexión, porque las tablas completas están en SQLite.
- **Inicio con paradas cercanas.** Si la persona ya dio permiso de ubicación (o lo pide con el botón «Ver paradas cerca de mí»), el inicio muestra un mapa con las paradas más cercanas y los próximos horarios de las dos primeras, siempre «según la tabla». Si niega el permiso, aparece un enlace para buscar por nombre y el resto de la app sigue igual.

## Ajustes 11: ubicación robusta e ingreso manual del QR

- **Ubicación con límite de tiempo** (`src/utilidades/ubicacion.ts`). Si el teléfono no logra una posición en 7 segundos se usa la última conocida, y si no hay, se avisa con un botón de reintento, en lugar de dejar la pantalla cargando. En Inicio solo se muestran paradas a menos de 2 km.
- **QR con alternativa.** `app/qr.tsx` suma un campo para escribir el código de la parada (por ejemplo `PARANA:par-101`), útil si no hay cámara o se niega el permiso. Pasa por la misma función `procesarQr` que el escaneo.


## Ajustes 12: mapas de recorridos con OpenStreetMap y validación de APK

- **Mapas de recorridos sin clave de Google Maps.** Se reemplazó la implementación nativa de `MapaTrazado` por una vista `react-native-webview` que carga Leaflet y utiliza los mapas de OpenStreetMap. Se conservan el trazado, los marcadores de inicio y fin y el ajuste de encuadre. El cambio se aplica a los recorridos de las líneas y a los desvíos de los avisos. Los mapas nativos de la pestaña **Paradas** y el mapa de paradas cercanas se conservaron.
- **Dependencia.** Se incorporó `react-native-webview`, instalada con `npx expo install react-native-webview` para mantener compatibilidad con Expo SDK 54.
- **Conectividad de mapas.** Leaflet y los mapas de OpenStreetMap pueden necesitar conexión para descargar recursos y zonas que todavía no se visualizaron. Durante las pruebas, los mapas previamente cargados siguieron visibles en modo avión gracias a los recursos disponibles en caché; esto no garantiza que cualquier zona nueva pueda abrirse sin conexión.
- **Validación.** `npm run typecheck` finalizó sin errores. Se probó la navegación por Inicio, Líneas, Avisos y Paradas en Expo Go y luego en una APK de prueba instalada en el emulador Pixel 8. También se comprobó el reingreso con PIN y el acceso a los datos y mapas previamente disponibles al activar el modo avión.
- **Build de prueba.** Generada con `eas build --platform android --profile preview` (EAS Build ID: `2823732b-4fed-416a-b7eb-5d16ba319e81`). Esta compilación fue instalada y validada en el emulador.
