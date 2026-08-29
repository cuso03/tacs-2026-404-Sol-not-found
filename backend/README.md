# Backend

## Actividades

`POST /api/actividades` crea una actividad. Durante esta etapa el creador se
recibe mediante el header temporal `X-User-Id`; el adaptador está aislado en
`src/middleware/authenticatedUser.ts` para sustituirlo por la validación JWT de
Auth0 antes de un despliegue productivo.

La especificación está disponible en `/openapi.json` y la interfaz Swagger en
`/api-docs`.

`POST /api/actividades/{id}/reglas` configura las condiciones climáticas y de
reprogramación. Solo acepta al mismo `X-User-Id` que creó la actividad.

El campo `tipo` acepta `aire_libre`, `techada` o `mixta`. Para `ubicacion` se
acepta una ciudad con país, o coordenadas. Se recomienda coordenadas porque son
exactas y permiten consultar un servicio de clima sin una geocodificación previa.

Ejemplo de request:

```http
POST /api/actividades
X-User-Id: auth0|usuario-123
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

Instalar dependencias con `npm install`, ejecutar los tests con `npm test` y
levantar el servicio con `npm run dev`.
