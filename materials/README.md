# Materiales de prueba - Paraná Bus

Esta carpeta contiene recursos utilizados durante el desarrollo y las pruebas de la aplicación Paraná Bus.

## Códigos QR

- `hoja-de-qr-para-probar.png`: hoja de códigos QR para realizar pruebas.
- `qr-par-101-alameda-y-urquiza.png`: código QR de prueba de la parada 101.
- `qr-par-102-almafuerte-y-newbery.png`: código QR de prueba de la parada 102.
- `qr-par-103-bajada-grande.png`: código QR de prueba de la parada 103.
- `qr-NO-es-de-parana-bus.png`: código externo para comprobar el rechazo de QR ajenos al sistema.

## Geolocalización

- `ubicacion-parana.gpx`: recorrido de prueba en la zona de Alameda y Urquiza, Paraná.

## Avisos con video

- `video-de-prueba-desvio.mp4`: video utilizado para probar avisos de desvíos.
- `crear-aviso-con-video.ps1`: script PowerShell que automatiza la carga del video y la creación de un aviso mediante la API.

### Uso del script

1. Iniciar el backend localmente.
2. Abrir PowerShell desde la carpeta raíz del repositorio.
3. Ejecutar el siguiente comando:

    `.\materials\crear-aviso-con-video.ps1 -Video ".\materials\video-de-prueba-desvio.mp4"`

El script utiliza por defecto la API local `http://localhost:3000` y una cuenta de demostración configurada en el backend.

## Imagen adicional

- `images.jpg`: imagen de apoyo incluida entre los materiales del proyecto.

## Consideraciones

Estos archivos son recursos complementarios para las pruebas y la documentación. No son necesarios para instalar o ejecutar el frontend de manera independiente.
