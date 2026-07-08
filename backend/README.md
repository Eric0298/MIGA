# Miga · Backend

ASP.NET Core (.NET 10) por capas: `Miga.Api`, `Miga.Application`, `Miga.Contracts`, `Miga.Domain`, `Miga.Infrastructure`. Tests con xUnit + Shouldly.

## Requisitos

- .NET SDK 10
- Docker (para PostgreSQL local)

## Arrancar en local

```bash
docker compose up -d
cd backend
dotnet run --project src/Miga.Api
```

- `GET /api/health`
- `GET /api/health/db`
- `GET /api/materials/youtube-metadata?url=<url>`

## Configuración de secretos

Ninguna clave se guarda en Git. Para desarrollo local se usan
[user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets):

```bash
cd backend/src/Miga.Api
dotnet user-secrets init
dotnet user-secrets set "YouTubeApi:ApiKey" "AIzaSy..."
```

En producción se inyectan como variables de entorno:

```
YOUTUBEAPI__APIKEY=AIzaSy...
```

## Obtener la API key de YouTube

1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la **YouTube Data API v3**.
3. Genera una API key en Credentials.
4. Restringe la key por IP (backend) o por HTTP referrer si se sirviera desde otro origen.
5. Comprueba la cuota: 10 000 unidades/día por defecto. Con la caché de 24 h por `videoId`,
   `videos.list` cuesta 1 unidad, más que suficiente para uso normal.

## Seguridad aplicada

- **API key** solo en env var / user-secrets. Nunca en el bundle del cliente ni en logs.
- **CORS estricto** al origen del frontend (configurable en `Cors:AllowedOrigins`).
- **Rate limiting** con `Microsoft.AspNetCore.RateLimiting`:
  - Global: 60 req/min por IP.
  - Endpoint `youtube-metadata`: 20 req/min por IP.
- **Security headers** middleware: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- **HSTS + HTTPS** forzados en producción (`UseHsts` + `UseHttpsRedirection`).
- **Validación de URLs de YouTube**: whitelist de hosts + regex del `videoId` (`^[A-Za-z0-9_-]{11}$`).
  Solo `http:` / `https:` aceptados. `javascript:` u otros esquemas son rechazados.
- **EF Core parametriza** todas las queries. No se usa `FromSqlRaw` con inputs.
- **Logs sanitizados**: Serilog registra solo `videoId`, nunca la URL cruda ni la API key.
- **Timeout de 5 s** en la llamada saliente a YouTube.

## Scripts

```bash
dotnet build
dotnet test
```
