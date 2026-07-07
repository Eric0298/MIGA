# MIGA — Security Rules

## 1. Principio general

La seguridad debe diseñarse desde el principio, no añadirse al final.

MIGA manejará datos personales, objetivos, sesiones, materiales y en fases posteriores archivos. Por tanto, debe evitar diseños inseguros desde la base.

## 2. Principios principales

Aplicar:

- mínimo privilegio;
- validación de entrada;
- control de propiedad de recursos;
- no confiar en el cliente;
- errores seguros;
- logs sin datos sensibles;
- CORS restrictivo;
- rate limiting;
- paginación;
- límites de tamaño;
- headers de seguridad;
- defensa contra XSS;
- defensa contra CSRF si se usan cookies;
- protección contra fuerza bruta;
- subida de archivos segura.

## 3. Control de propiedad

Todo recurso del backend que tenga `userId` debe comprobar que pertenece al usuario autenticado.

Esto aplica a:

- metas;
- actividades;
- sesiones;
- materiales;
- archivos;
- simulacros;
- preguntas;
- recordatorios.

Nunca confiar solo en el ID recibido por URL.

Ejemplo de riesgo:

```text
GET /api/goals/{id}
```

Debe comprobar:

```text
goal.UserId == currentUser.Id
```

## 4. Validación

Frontend:

- Zod;
- validación UX;
- mensajes claros.

Backend:

- validación obligatoria;
- DTOs;
- límites de longitud;
- tipos correctos;
- rangos numéricos;
- fechas coherentes.

El backend es la autoridad final.

## 5. XSS

Evitar renderizar HTML introducido por usuario.

Notas, títulos y descripciones deben tratarse como texto.

No usar `dangerouslySetInnerHTML` salvo caso excepcional y con sanitización estricta.

## 6. CSRF

Si la autenticación usa cookies:

- usar `HttpOnly`;
- usar `Secure`;
- usar `SameSite`;
- añadir protección antiforgery si procede.

Si se usan tokens Bearer:

- no guardar secretos sensibles en localStorage sin evaluar riesgos;
- considerar estrategia segura antes de implementar auth.

La decisión final de auth se tomará en Fase 4.

## 7. Rate limiting

Aplicar rate limiting especialmente a:

- login;
- registro;
- recuperación de contraseña;
- subida de archivos;
- endpoints pesados;
- importación masiva;
- sincronización.

## 8. CORS

Configurar CORS de forma restrictiva.

No usar:

```text
AllowAnyOrigin
```

salvo en desarrollo controlado y nunca en producción.

## 9. Headers de seguridad

Configurar cuando proceda:

- Content-Security-Policy;
- X-Content-Type-Options: nosniff;
- Referrer-Policy;
- Permissions-Policy;
- Strict-Transport-Security en producción HTTPS.

## 10. Errores seguros

En producción:

- no exponer stack traces;
- no devolver detalles internos;
- usar mensajes claros pero genéricos;
- registrar internamente el error con seguridad.

## 11. Subida segura de archivos

La subida de archivos no forma parte de Fase 1.

Cuando se implemente, debe tener un diseño seguro.

Requisitos:

- límite de tamaño por archivo;
- límite de almacenamiento por usuario;
- allowlist de MIME types;
- validación de extensión;
- detección real del MIME en backend;
- no confiar en `Content-Type` del cliente;
- renombrar archivos con identificadores seguros;
- no usar nombres originales como ruta real;
- almacenar fuera del webroot;
- usar almacenamiento privado;
- servir mediante endpoint autorizado o URL firmada;
- calcular hash SHA-256;
- rate limiting;
- cuotas;
- logs de subida;
- eliminación segura;
- comprobación de propiedad;
- evitar path traversal;
- evitar ejecución de archivos subidos;
- cabeceras correctas al descargar;
- Content-Disposition seguro.

## 12. MIME types iniciales permitidos

MVP futuro de archivos:

| Tipo | MIME |
|---|---|
| PDF | `application/pdf` |
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| WebP | `image/webp` |
| TXT | `text/plain` |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| MP4 | `video/mp4` |
| WebM | `video/webm` |

## 13. Contraseñas

Si se implementa auth propia:

- usar hashing seguro;
- nunca guardar contraseña en claro;
- no registrar contraseñas;
- proteger login con rate limiting;
- valorar bloqueo temporal tras intentos repetidos.

## 14. Secretos

Nunca guardar secretos en frontend.

Usar variables de entorno para:

- cadenas de conexión;
- claves JWT;
- claves de storage;
- secretos de email;
- claves de servicios externos.

Mantener `.env.example` sin valores reales.

## 15. Tests de seguridad mínimos

Probar:

- usuario A no accede a recurso de usuario B;
- archivo no permitido se rechaza;
- archivo demasiado grande se rechaza;
- import JSON inválido se rechaza;
- endpoint listado aplica paginación;
- errores no exponen stack trace;
- inputs con HTML no se ejecutan.
