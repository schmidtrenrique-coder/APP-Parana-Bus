# Publica en la API un aviso de prueba con VIDEO REAL y recorrido alternativo, como si fueras la Dirección.
# Con el backend corriendo (pnpm dev), en PowerShell:
#   .\crear-aviso-con-video.ps1 -Video "C:\ruta\a\video-de-prueba-desvio.mp4"
# El aviso queda guardado en la base local hasta que corras "pnpm db:reiniciar" (ahí se borra y hay que volver a correr este script).
param(
  [Parameter(Mandatory = $true)][string]$Video,
  [string]$Api = "http://localhost:3000",
  [string]$Linea = "lin-05"
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $Video)) { throw "No encuentro el video: $Video" }
$Video = (Resolve-Path $Video).Path

# Devuelve el JSON como bytes UTF-8. La coma inicial evita que PowerShell "desarme" el arreglo de bytes al devolverlo.
function ComoJson($objeto) {
  $json = $objeto | ConvertTo-Json -Depth 6 -Compress
  return ,([System.Text.Encoding]::UTF8.GetBytes($json))
}

try {
  Write-Host "1/3 Ingresando como la Direccion de Transporte..."
  $login = Invoke-RestMethod -Method Post -Uri "$Api/auth/ingreso" -ContentType "application/json; charset=utf-8" `
    -Body ([byte[]](ComoJson @{ email = "transporte@parana.demo.ar"; contrasena = "demo1234" }))
  $token = $login.datos.token
  if (-not $token) { throw "No se obtuvo el token de sesion." }

  Write-Host "2/3 Subiendo el video..."
  $respuesta = & curl.exe -s -X POST "$Api/archivos" -H "Authorization: Bearer $token" -F "archivo=@$Video;type=video/mp4"
  $subida = $respuesta | ConvertFrom-Json
  if (-not $subida.datos.url) { throw "La API no acepto el video. Respuesta: $respuesta" }
  Write-Host "    Video subido: $($subida.datos.url)"

  Write-Host "3/3 Publicando el aviso..."
  $desde = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd") + "T00:00:00-03:00"
  $aviso = @{
    titulo             = "Desvío de prueba con video"
    detalle            = "La línea 5 desvía temporalmente. Mirá el video para ver por dónde pasa ahora."
    lineaIds           = @($Linea)
    desde              = $desde
    hasta              = $null
    gravedad           = "desvio"
    trazadoAlternativo = @(
      @{ latitud = -31.7345; longitud = -60.5230 },
      @{ latitud = -31.7360; longitud = -60.5215 },
      @{ latitud = -31.7380; longitud = -60.5200 }
    )
    videoUrl           = $subida.datos.url
  }
  $creado = Invoke-RestMethod -Method Post -Uri "$Api/avisos" -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json; charset=utf-8" -Body ([byte[]](ComoJson $aviso))
  Write-Host ""
  Write-Host "Listo. Aviso creado con id: $($creado.datos.id)"
  Write-Host "En la app, abri la pestana Avisos (o desliza hacia abajo para actualizar)."
}
catch {
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message -ForegroundColor Red }
  exit 1
}
