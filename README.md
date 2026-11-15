Paraná Bus es una aplicación para celular que hice para el Trabajo Integrador de Desarrollo para Móviles (UNER, 2026). La pidió Silvina Ferreyra, directora de Transporte de la Municipalidad de Paraná, para que la gente pueda ver las líneas de colectivo, dónde están las paradas, a qué hora pasa cada uno y si ese día hay algún desvío. También permite avisar cuando un colectivo se demora. Hice el trabajo de forma individual.

Está hecha con React Native y Expo (SDK 54), con TypeScript, y usa la API que nos dio la cátedra.

## Qué entrego

- **Este repositorio**, con el código de la app (`app/`, `src/`, `assets/`, `app.json` y `eas.json`) y la parte de la API que programé (`back/`).
- **El APK** de la app, generado con `eas build --platform android --profile preview`: [página del build](https://expo.dev/accounts/schmidtrenrique/projects/parana-bus/builds/2823732b-4fed-416a-b7eb-5d16ba319e81).
- **El video** de la defensa, en el enlace de Drive que figura en la entrega.

## Qué tiene cada pestaña

- **Inicio:** muestra primero mis favoritos con los próximos horarios, después los avisos de hoy, las paradas cercanas en un mapa y las líneas.
- **Líneas:** la lista de las 14 líneas. Al entrar a una se ve si funciona normal o tiene un aviso, el recorrido de ida y de vuelta en el mapa, las paradas en orden y los horarios de hábil, sábado, domingo y feriado. Desde esta pestaña se descargan los datos para poder usar la app sin conexión.
- **Paradas:** un mapa con las paradas cercanas, un buscador por nombre y el lector de códigos QR. Al entrar a una parada se ven las líneas que pasan, los próximos horarios, una flecha que indica para qué lado queda, un botón para abrirla en la app de mapas del celular, recordatorios y los reportes de otros pasajeros.
- **Avisos:** los avisos vigentes, con las líneas que afectan, el recorrido alternativo en el mapa y un video corto que se puede guardar para verlo sin conexión.
- **Yo:** para registrarse e ingresar, ver los favoritos y los recordatorios, y elegir opciones como el modo claro u oscuro.

La app no dice en cuántos minutos llega un colectivo porque no tienen GPS. Por eso siempre muestra el horario de la tabla.

## Cómo probarla

La app necesita que la API esté funcionando para mostrar datos. Hay dos formas de abrirla.

**Lo que hace falta en los dos casos:** Node.js 24 o más nuevo, Android Studio con un emulador de Android (usé un Pixel 8 con Android 14) y la API de la cátedra funcionando.

### 1. Levantar la API
La API está en la carpeta `back/`, con mi parte implementada. Dentro de la carpeta de la API se ejecuta `pnpm install`, `pnpm db:reiniciar` y `pnpm dev`. Para ver si anda, abrir `http://localhost:3000/salud` en el navegador.

### 2. Opción A: instalar el APK
Descargar el `.apk` desde la página del build y arrastrarlo a la ventana del emulador. La app se instala como «Paraná Bus» y se abre desde el menú de aplicaciones, sin Expo Go. El APK apunta a `http://10.0.2.2:3000` (desde el emulador, la computadora se llama `10.0.2.2`), así que funciona con la API corriendo en la misma computadora del emulador.

### 2. Opción B: ejecutar el código con Expo Go
1. Copiar `.env.example` con el nombre `.env`. Para el emulador tiene que decir `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.
2. Ejecutar `npm install`, `npx expo install --fix` y `npx expo start -c`.
3. En Expo Go (compatible con SDK 54) tocar *Enter URL manually* y escribir `exp://10.0.2.2:8081`. No usar la tecla `a` de la terminal, porque intenta reinstalar Expo Go y da error.

El archivo `.npmrc` está para evitar un problema de versiones de React al instalar.

**Cuentas de prueba** (son las de los datos de ejemplo de la API):

| Para | Email | Contraseña |
|---|---|---|
| Entrar como pasajero | `julian@mail.com` | `demo1234` |
| Entrar como la Dirección de Transporte | `transporte@parana.demo.ar` | `demo1234` |

## Cómo está organizado

| Carpeta | Qué hay |
|---|---|
| `app/` | Las pantallas (pestañas, detalle de línea y de parada, reporte y QR) |
| `src/tipos/` | Los datos que maneja la app (línea, parada, horario, aviso, reporte y usuario), como los pide el pedido del cliente |
| `src/servicios/` | Todo lo que habla con la API y con el celular: el servicio principal (`api.ts`), la sesión, los avisos, los horarios, los reportes y las notificaciones |
| `src/base-datos/db.ts` | La base de datos del celular (SQLite) |
| `src/contexto/` | La sesión del usuario |
| `src/componentes/` | Partes que se repiten: los mapas, la tarjeta de aviso, el video, la flecha y el cartel de «sin conexión» |
| `src/hooks/`, `src/tema/`, `src/utilidades/` | Nombres de líneas y paradas, modo oscuro, y cuentas de distancia, horarios y ubicación |
| `src/mocks/` | Datos de ejemplo que usé al principio, antes de tener la API |
| `assets/` | El ícono, el ícono de Android y la pantalla de inicio |
| `back/` | La API de la cátedra, con la parte que programé en `src/student-notifications/` |
| `materials/` | Códigos QR, un video y un script para probar (ver el final) |

## Cómo cumple lo que pide la consigna

| # | Lo que pide | Dónde está |
|---|---|---|
| 1 | Pantallas y navegación | Carpeta `app/`, con Expo Router |
| 2 | Registro e ingreso, sesión guardada y huella | La sesión se guarda de forma segura con `expo-secure-store` (`sesion.ts`). Al volver a abrir la app pide huella, rostro o PIN con `expo-local-authentication` (`biometria.ts`); si el celular no tiene nada de eso, se puede usar la contraseña |
| 3 | Usar la API con carga, vacío y error | `src/servicios/` y las pantallas: muestran un indicador de carga, mensajes cuando no hay datos y un botón «Reintentar» cuando hay un error |
| 4 | Cámara y archivos | `expo-camera` para leer el QR (`app/qr.tsx`), `expo-image-picker` para la foto del reporte y `expo-file-system` para guardar fotos y videos en el celular (`archivos.ts`) |
| 5 | Ubicación y mapas | `expo-location` para la ubicación. Los mapas (recorridos, desvíos, paradas y paradas cercanas) usan Leaflet con OpenStreetMap dentro de `react-native-webview`, así que no necesitan una clave de Google Maps. Si no se da el permiso de ubicación, la app sigue funcionando y se puede buscar por nombre |
| 6 | Notificaciones locales | Un recordatorio 10 minutos antes de un horario, y un aviso cuando aparece un aviso nuevo en una línea favorita (`notificaciones.ts`) |
| 7 | Datos guardados y estado de la red | `expo-sqlite` para los datos, `expo-sqlite/kv-store` para las preferencias (`preferencias.ts`) y `expo-network` para avisar cuando no hay internet |
| 8 | Sensor o vibración | La flecha de la parada usa la brújula del celular (`FlechaParada.tsx`), y el celular vibra con `expo-haptics` al enviar un reporte, leer un QR o marcar un favorito |
| 9 | Video | `expo-video` con los controles a la vista (`VideoAviso.tsx`) |
| 10 | Ícono y pantalla de inicio | Nombre «Paraná Bus», ícono y pantalla de inicio propios en `assets/`, configurados en `app.json` |

## Cómo lo pensé

- **Todo pasa por los servicios.** Las pantallas no hablan directo con la API: piden los datos a `src/servicios/`. Así, si cambia la API, solo hay que tocar esa carpeta. Además puse un tiempo máximo de espera, para que una pantalla no se quede cargando para siempre si no hay buena conexión.
- **Se puede usar sin conexión.** Los recorridos, paradas, horarios y feriados se descargan una vez y se guardan en el celular. Los avisos y los reportes sí necesitan internet: sin conexión se muestran los últimos avisos descargados y la app aclara que pueden estar desactualizados, y los reportes quedan guardados hasta que vuelva la red.
- **La sesión está protegida.** Guardé el token en `expo-secure-store` y nunca en `kv-store`, porque es lo que pide el cliente. Para volver a entrar, la app pide huella o PIN, y siempre hay una alternativa con contraseña.
- **No invento horarios.** Todo lo que dice cuánto falta aclara «según la tabla».
- **Modo claro y oscuro.** Armé dos paletas de colores (`src/tema/tema.ts`) y desde la pestaña Yo se puede elegir una o usar la del celular.

## La parte de la API que me tocó

La guía de la cátedra deja a cargo de los alumnos guardar los tokens de las notificaciones y enviarlas. Eso lo hice en `src/student-notifications/` de la API, que está en la carpeta `back/`. Son cuatro archivos: uno define la tabla de tokens, otro los guarda y los busca, otro envía los mensajes a Expo (de a 100, y descarta los tokens que ya no sirven) y otro conecta todo con el resto de la API. Los tests de la cátedra se corren con `pnpm test:notificaciones`. No modifiqué nada más de la API.

## Qué probé

Probé la app en un emulador Pixel 8 con Android 14, primero con Expo Go y después con el APK instalado, conectada a la API en mi computadora. Revisé que funcionen:

- los mapas en el APK instalado;
- moverme por las pestañas (Inicio, Líneas, Paradas y Avisos) y entrar al detalle de líneas y paradas;
- registrarme e ingresar, y que al volver a abrir la app me pida el PIN;
- el mapa y la ubicación;
- descargar los datos y usar la app con el modo avión;
- los favoritos y los avisos;
- los horarios de hábil, sábado, domingo y feriado;
- el modo oscuro.

También publiqué un aviso de prueba con el script de `materials/`. Ejecuté `npm run typecheck` y no dio errores.

## Lo que no pude hacer o quedó pendiente

- **Notificaciones push desde el servidor.** Expo Go de Android no las recibe (desde el SDK 53), así que solo se pueden ver con la app instalada. Con Expo Go se ven las notificaciones locales. La parte del servidor está hecha.
- **Vibración y cámara en el emulador.** El emulador no vibra y no tiene una cámara real. Para probar el flujo del QR agregué un campo donde se puede escribir el código de la parada, que hace lo mismo que el escaneo.
- **Mapas sin conexión.** Usan OpenStreetMap, así que las zonas que no se vieron antes necesitan internet para cargarse.
- **Mapa en modo oscuro.** El mapa sigue claro.
- **La dirección de la API en el APK.** Quedó grabada como `http://10.0.2.2:3000`, que sirve para el emulador. Para usarlo en un celular de verdad habría que cambiarla en `eas.json` y generar el APK de nuevo.
- **iPhone.** No lo probé.

## Material de prueba

La carpeta `materials/` tiene cosas que usé para probar:

- Códigos QR: tres son de paradas de verdad (`par-101`, `par-102` y `par-103`) y uno no es de Paraná Bus, para ver que la app avisa sin romperse. `hoja-de-qr-para-probar.png` los junta a todos.
- `video-de-prueba-desvio.mp4` y `crear-aviso-con-video.ps1`: el video que trae la API de ejemplo no tiene imagen, así que este script (de PowerShell, con la API funcionando) sube un video real y publica un aviso en la Línea 5 con un recorrido alternativo. Se ejecuta con `powershell -ExecutionPolicy Bypass -File .\crear-aviso-con-video.ps1 -Video .\video-de-prueba-desvio.mp4`. Si se reinicia la base con `pnpm db:reiniciar`, el aviso se borra y hay que volver a ejecutarlo.
