# Backend

## Autenticación

Todas las rutas protegidas exigen un access token de Auth0 enviado como
`Authorization: Bearer <jwt>`. El middleware valida firma (vía JWKS),
`issuer` (`https://<AUTH0_DOMAIN>/`), `audience` (`AUTH0_AUDIENCE`) y
expiración; el `sub` del token queda disponible como `req.userId`. Los
headers `X-User-Id` y `X-User-Role` ya no se aceptan en ningún endpoint.

El rol admin se lee del claim configurado en `AUTH0_ROLES_CLAIM`
(default `https://solnotfound.app/roles`): `["admin"]` habilita
`GET /api/admin/estadisticas`. La guía completa de configuración del
dashboard de Auth0 y del Action de roles está en el
[README raíz](../README.md).

Variables relevantes en `.env.example`: `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`,
`AUTH0_ROLES_CLAIM` y el opcional `AUTH0_JWKS_URI`.

## Actividades

`POST /api/actividades` crea una actividad con el usuario autenticado
(`sub` del token).

La especificación está disponible en `/openapi.json` y la interfaz Swagger en
`/api-docs`.

`PUT /api/actividades/{id}/reglas` reemplaza las condiciones climáticas y de
reprogramación (PUT idempotente). Solo acepta al mismo usuario que creó la
actividad.

`GET /api/actividades/{id}` recupera una actividad por su id (requiere
token). Permite consultar actividades llenas que no figuran en la búsqueda.

`POST /api/actividades/{id}/participantes` inscribe al usuario autenticado si hay
cupo. `DELETE /api/actividades/{id}/participantes/me` elimina su inscripción. El
organizador se incluye al crear la actividad, ocupa un cupo y no puede darse de
baja mediante este endpoint.

El campo `tipo` acepta `aire_libre`, `techada` o `mixta`. Para `ubicacion` se
acepta una ciudad con país, o coordenadas. Se recomienda coordenadas porque son
exactas y permiten consultar un servicio de clima sin una geocodificación previa.

Ejemplo de request:

```http
POST /api/actividades
Authorization: Bearer <access-token-de-auth0>
Content-Type: application/json

{
  "titulo": "Caminata urbana",
  "descripcion": "Recorrido guiado por el centro",
  "tipo": "aire_libre",
  "ubicacion": {
    "tipo": "coordenadas",
    "latitud": -34.6037,
    "longitud": -58.3816,
    "direccion": "Plaza de Mayo"
  },
  "fecha_horario": "2026-09-10T14:00:00-03:00",
  "min_participantes": 4,
  "max_participantes": 12
}
```

## Usuarios

`GET /api/usuarios/me/actividades` devuelve el dashboard del usuario
autenticado. `POST /api/usuarios/sync` hace un upsert del perfil en Mongo
usando el `sub` del token como `auth0Id` (email y nombre vienen del body); el
frontend lo invoca tras el primer login.

Instalar dependencias con `npm install`, ejecutar los tests con `npm test` y
levantar el servicio con `npm run dev`.

> Los tests usan `mongodb-memory-server`. En Windows, si la descarga del
> binario falla (`spawn EFTYPE`) y MongoDB está instalado localmente, ejecutar:
> `MONGOMS_SYSTEM_BINARY="C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe" npm test`.
