# ADR 0001: Gestión de participantes en memoria

- Estado: Aceptado
- Fecha: 2026-08-29
- Alcance: Feature 4, Entrega 1

## Contexto

La Feature 4 permite que un usuario se inscriba o se dé de baja de una actividad
respetando su cupo máximo. La Entrega 1 exige resolver participantes en memoria;
la persistencia NoSQL y Auth0 real corresponden a entregas posteriores.

La implementación debe extender la arquitectura existente de actividades:
controlador, servicio y `ActividadInMemoryRepository`. La identidad temporal se
obtiene mediante el middleware existente que exige el header `X-User-Id`.

## Decisión

### Modelo y persistencia

- `Actividad` tendrá `participantes: string[]` con identificadores únicos.
- Al crear una actividad, `participantes` se inicializará con `creadorId`.
- El organizador se incorpora inicialmente como participante, cuenta para
  `max_participantes` y no puede darse de baja mediante el endpoint de baja de
  participantes.
- Los datos vivirán en la instancia de `ActividadInMemoryRepository` y se perderán
  al reiniciar el proceso.
- `ActividadRepository` expondrá operaciones específicas de alta y baja. Cada
  operación validará y modificará el estado como una única operación para evitar
  superar el cupo por dos inscripciones concurrentes.
- El repositorio continuará devolviendo copias; ningún consumidor podrá modificar
  directamente el array almacenado.

Resultados de negocio esperados:

```ts
type InscribirParticipanteResult =
  | { status: 'created'; actividad: Actividad }
  | { status: 'not_found' }
  | { status: 'already_participating' }
  | { status: 'full' };

type RemoverParticipanteResult =
  | { status: 'removed'; actividad: Actividad }
  | { status: 'not_found' }
  | { status: 'not_participating' }
  | { status: 'organizer_cannot_leave' };
```

### Contrato HTTP

Ambas rutas usan `requireAuthenticatedUser`. No reciben un `userId` por body o
path: siempre operan sobre el usuario de `X-User-Id`.

#### Inscripción

```http
POST /api/actividades/{id}/participantes
X-User-Id: auth0|usuario-123
```

No requiere body.

| Estado | Condición | Respuesta |
| --- | --- | --- |
| `201 Created` | Inscripción exitosa | Actividad actualizada |
| `400 Bad Request` | Usuario ya inscripto | `ALREADY_PARTICIPATING` |
| `400 Bad Request` | Cupo completo | `ACTIVITY_FULL` |
| `401 Unauthorized` | Falta `X-User-Id` | Error de autenticación |
| `404 Not Found` | Actividad inexistente | `ACTIVITY_NOT_FOUND` |

#### Baja propia

```http
DELETE /api/actividades/{id}/participantes/me
X-User-Id: auth0|usuario-123
```

| Estado | Condición | Respuesta |
| --- | --- | --- |
| `200 OK` | Baja exitosa | Actividad actualizada |
| `400 Bad Request` | Usuario no inscripto | `NOT_PARTICIPATING` |
| `400 Bad Request` | El usuario es el organizador | `ORGANIZER_CANNOT_LEAVE` |
| `401 Unauthorized` | Falta `X-User-Id` | Error de autenticación |
| `404 Not Found` | Actividad inexistente | `ACTIVITY_NOT_FOUND` |

Los errores tendrán forma estable:

```json
{
  "error": "ACTIVITY_FULL",
  "message": "La actividad alcanzó su cupo máximo."
}
```

### OpenAPI

`openapi.ts` documentará ambas rutas, el header requerido, todos los estados
anteriores y `participantes` dentro del esquema `Actividad`.

## Plan de implementación

1. Extender `Actividad` y `NuevaActividad` para inicializar participantes.
2. Agregar al contrato y al repositorio las operaciones atómicas de alta y baja.
3. Exponer los casos de uso desde `ActividadesService`.
4. Mapear resultados de negocio a HTTP en `createActividadesController`.
5. Registrar las dos rutas con `requireAuthenticatedUser`.
6. Actualizar OpenAPI y el README del backend.
7. Implementar y ejecutar los tests definidos abajo.

## Tests requeridos

Los tests de integración usarán Vitest y Supertest sobre `createApp`, recorriendo
controlador, servicio y repositorio. El aislamiento de copias se probará
directamente sobre el repositorio.

### Creación y repositorio

1. Una actividad nueva contiene al organizador como único participante.
2. El organizador consume uno de los lugares del cupo máximo.
3. Las copias devueltas por el repositorio no permiten alterar los participantes
   almacenados.
4. Una inscripción exitosa queda persistida en la misma instancia del repositorio.
5. Una baja exitosa queda persistida y libera un cupo.

### `POST /api/actividades/:id/participantes`

1. Inscribe a un usuario y responde `201` con la actividad actualizada.
2. Permite ocupar exactamente el último cupo disponible.
3. Rechaza con `400/ALREADY_PARTICIPATING` una segunda inscripción del mismo
   usuario y no duplica su identificador.
4. Rechaza con `400/ALREADY_PARTICIPATING` la inscripción del organizador.
5. Rechaza con `400/ACTIVITY_FULL` una inscripción cuando el cupo está completo y
   no modifica la actividad.
6. Responde `404/ACTIVITY_NOT_FOUND` para un ID inexistente.
7. Responde `401` cuando falta `X-User-Id` y no modifica la actividad.

### `DELETE /api/actividades/:id/participantes/me`

1. Elimina al usuario autenticado y responde `200` con la actividad actualizada.
2. Elimina solamente al usuario autenticado; conserva los demás participantes.
3. Después de una baja permite que otro usuario ocupe el cupo liberado.
4. Rechaza con `400/NOT_PARTICIPATING` a un usuario no inscripto y no modifica la
   actividad.
5. Rechaza con `400/ORGANIZER_CANNOT_LEAVE` la baja del organizador y conserva su
   inscripción.
6. Responde `404/ACTIVITY_NOT_FOUND` para un ID inexistente.
7. Responde `401` cuando falta `X-User-Id` y no modifica la actividad.

### Contrato OpenAPI

1. La especificación contiene las dos rutas y sus métodos correctos.
2. Ambas operaciones documentan `X-User-Id` como requerido.
3. El esquema `Actividad` incluye `participantes` como array de strings.
4. Se documentan todos los estados `200`, `201`, `400`, `401` y `404` aplicables.

## Consecuencias

- La Feature 4 puede probarse sin base de datos ni Auth0.
- Reiniciar el backend elimina actividades e inscripciones; es intencional en la
  Entrega 1.
- En la Entrega 2 se reemplazará el repositorio en memoria sin cambiar los casos
  de uso ni los contratos HTTP.
- La eventual cancelación manual de una actividad es un caso de uso diferente y
  queda fuera del alcance de este ADR y de la Feature 4.
