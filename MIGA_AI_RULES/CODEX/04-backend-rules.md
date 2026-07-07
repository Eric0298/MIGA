# MIGA — Backend Rules

## 1. Stack backend

Usar:

- ASP.NET Core;
- PostgreSQL;
- Entity Framework Core;
- REST API;
- OpenAPI/Swagger solo en desarrollo o protegido;
- Docker;
- xUnit;
- logging estructurado;
- health checks.

## 2. Rol del backend en MIGA

El backend no debe bloquear el uso inicial de la app.

MIGA debe poder funcionar en modo invitado/local-first sin backend.

El backend será necesario para:

- cuenta opcional;
- sincronización;
- backup;
- subida de archivos;
- recuperación entre dispositivos;
- Web Push futuro;
- endpoints de portfolio/demo si procede.

## 3. Arquitectura backend

Usar modular monolith / clean architecture ligera.

Estructura recomendada:

```text
backend/
├── src/
│   ├── Miga.Api/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   ├── Extensions/
│   │   ├── Program.cs
│   │   └── appsettings.json
│   ├── Miga.Application/
│   │   ├── Common/
│   │   ├── Goals/
│   │   ├── Activities/
│   │   ├── Sessions/
│   │   ├── Materials/
│   │   ├── Files/
│   │   ├── Exams/
│   │   ├── ReviewQuestions/
│   │   └── Dashboard/
│   ├── Miga.Domain/
│   │   ├── Entities/
│   │   ├── Enums/
│   │   ├── ValueObjects/
│   │   └── Errors/
│   ├── Miga.Infrastructure/
│   │   ├── Persistence/
│   │   ├── FileStorage/
│   │   ├── Auth/
│   │   ├── Notifications/
│   │   └── Logging/
│   └── Miga.Contracts/
│       ├── Requests/
│       └── Responses/
├── tests/
│   ├── Miga.UnitTests/
│   └── Miga.IntegrationTests/
├── docker/
├── .env.example
├── docker-compose.yml
└── README.md
```

## 4. Reglas de arquitectura

- `Domain` no debe depender de infraestructura.
- `Application` contiene casos de uso y reglas de aplicación.
- `Infrastructure` contiene EF Core, storage, auth, servicios externos.
- `Api` expone endpoints y middleware.
- `Contracts` contiene DTOs de request/response.
- No poner lógica de negocio importante directamente en controllers.
- No devolver entidades EF directamente como respuestas públicas.

## 5. Entidades principales

- User;
- Goal;
- Activity;
- TimeSession;
- TimerState;
- Material;
- StoredFile;
- ExamAttempt;
- ReviewQuestion;
- Reminder;
- AuditLog.

## 6. Endpoints iniciales Fase 1

En Fase 1 solo implementar endpoints mínimos:

```text
GET /api/health
GET /api/health/db
```

No empezar creando todo el CRUD si todavía no toca.

## 7. Endpoints futuros

Principales grupos:

```text
/api/auth
/api/goals
/api/activities
/api/sessions
/api/dashboard
/api/stats
/api/materials
/api/files
/api/exams
/api/review-questions
```

## 8. Base de datos

Usar PostgreSQL.

Aplicar:

- migraciones;
- constraints;
- índices;
- timestamps;
- claves foráneas;
- paginación;
- límites de consulta.

## 9. Entity Framework Core

Reglas:

- Configurar entidades de forma explícita.
- Definir longitudes máximas cuando aplique.
- Usar índices para consultas frecuentes.
- No hacer queries sin límites en listados públicos.
- Evitar `Include` excesivos sin necesidad.
- Evitar N+1.

## 10. Health checks

Fase 1 debe incluir:

- health básico de API;
- health de base de datos.

Estos endpoints permiten comprobar que el entorno funciona antes de construir más módulos.

## 11. Swagger/OpenAPI

Swagger puede estar activo en desarrollo.

En producción:

- desactivarlo;
- o protegerlo;
- o limitarlo a entornos internos.

## 12. Logging

Usar logging estructurado.

No registrar:

- contraseñas;
- tokens;
- cookies;
- datos sensibles;
- contenido completo de archivos;
- información privada innecesaria.

## 13. Testing backend

Usar xUnit.

Probar:

- servicios de dominio;
- cálculos de progreso;
- autorización por propiedad;
- validaciones;
- endpoints principales;
- subida de archivos cuando llegue;
- errores seguros.
