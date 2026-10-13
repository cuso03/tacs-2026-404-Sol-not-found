# ADR 0003: Correcciones de actividades, clima real y estadísticas

- Estado: Aceptado
- Fecha: 2026-10-12
- Alcance: Búsqueda, mensajes de interfaz, participantes, administración de actividades, clima, votaciones y estadísticas
- Registro: Documentación posterior a la implementación y a la revisión de los ocho puntos con el equipo; no representa un proceso de especificación previo al desarrollo.
- Relación: Complementa los [ADR 0001](0001-gestion-de-participantes-en-memoria.md) y [0002](0002-quorum-empate-y-estado-reprogramada.md). Conserva las reglas de quórum y empate del ADR 0002.

## Contexto

La revisión de la aplicación detectó actividades pasadas en el catálogo,
confirmaciones que podían verse como errores, votos que seguían contando tras
una baja y ausencia de controles para modificar o eliminar actividades.

La aplicación utilizaba clima simulado por defecto. El adaptador existente de
Open-Meteo mezclaba unidades de viento y no interpretaba correctamente los
horarios del lugar. También se podían crear votaciones automáticas sin opciones.

El cierre automático conservaba un identificador de votación distinto del que
MongoDB persistía. Además, los contadores de cancelación y reprogramación se
actualizaban después de notificar: un error de notificación podía impedir el
registro de un cambio de estado ya guardado. El panel todavía ofrecía una
simulación y no refrescaba automáticamente sus métricas.

## Decisión

### 1. Catálogo de actividades futuras

La búsqueda pública excluye actividades con fecha y hora anteriores o iguales
al momento de consulta, así como las canceladas y finalizadas. Mantiene el filtro
de cupos. Estas condiciones se aplican en ambos repositorios antes del conteo y
la paginación, incluso si se envía una fecha de filtro pasada a la API.

El selector de fecha impide elegir días anteriores al actual. El dashboard
personal conserva el historial: la exclusión del catálogo no elimina registros.

### 2. Mensajes con significado visual explícito

El componente de alertas distingue errores (rojo), confirmaciones (verde),
información (azul) y advertencias (amarillo), sin combinar estilos de error y
éxito en una misma alerta. Los errores usan `role="alert"`; los demás mensajes
usan `role="status"`.

Inscripción, baja, voto registrado, apertura y reprogramación exitosa usan verde.
El requisito de inscribirse para votar usa azul. La falta de reglas, de horarios
favorables o de cupos, y el cierre que termina cancelando una actividad, usan
amarillo. Los textos explican el resultado sin depender únicamente del color.

### 3. Baja y anulación del voto pendiente

La baja elimina al usuario de participantes y retira sus votos de las votaciones
abiertas en la misma actualización de la actividad. La interfaz invalida las
consultas de resultados para mostrar el nuevo conteo.

Reinscribirse no recupera el voto anterior. Los votos de votaciones cerradas se
conservan como historial. Se mantiene la restricción que impide al organizador
darse de baja de su propia actividad.

### 4. Edición y eliminación por el organizador

Se incorporan operaciones autenticadas y autorizadas en el backend:

- `PUT /api/actividades/:id`: reemplaza título, descripción, tipo, ubicación,
  fecha y cupos. Conserva organizador, participantes y reglas climáticas. Rechaza
  un cupo máximo inferior a los inscriptos, además de las validaciones del payload.
- `DELETE /api/actividades/:id`: elimina físicamente la actividad y sus
  inscripciones y votaciones embebidas. La interfaz exige confirmación.

Editar cierra sin resolver las votaciones abiertas y conserva su historial. Si
la actividad estaba `EN_VOTACION`, vuelve a `PROPUESTA`; los demás estados se
conservan. Se elige invalidar la votación pendiente para que un cierre posterior
no sobrescriba los datos editados. Este cierre no es una cancelación ni una
reprogramación resuelta según el ADR 0002.

Eliminar es distinto de cancelar: registra una eliminación, sin incrementar el
contador de cancelaciones. No se borran los contadores históricos ni se promete
eliminar auditorías independientes. Los trabajos de cierre pendientes no se
retiran de la cola; al ejecutarse, el servicio no resuelve actividades inexistentes
ni votaciones ya cerradas.

### 5. Open-Meteo como proveedor real

La aplicación utiliza `OpenMeteoAdapter` por defecto mediante la interfaz
`IWeatherProvider`, sin API key. Los mocks se inyectan explícitamente en pruebas;
no se usan como respaldo ante errores del proveedor real.

El adaptador consulta hasta 16 días, usa °C y km/h y solicita timestamps Unix.
Convierte los horarios a fechas con offset usando la zona horaria del lugar para
evaluar las franjas de reprogramación. Resuelve ciudades por nombre y país o
código de país, sin aceptar como alternativa una ciudad de otro país.

Si la fecha no está cubierta o los datos están incompletos, no inventa valores.
La consulta de clima informa indisponibilidad; la generación de alternativas
solo utiliza horas válidas disponibles. Las solicitudes tienen timeout y el
panel incluye atribución a [Open-Meteo](https://open-meteo.com/en/docs).

### 6. Estadísticas sin simulación

Se retiran la sección y la acción de simulación del frontend. El panel conserva
la actualización manual y consulta los contadores de uso de la aplicación.

### 7. Contadores históricos y cierre automático

Las estadísticas representan eventos acumulados, no la cantidad actual de
actividades en cada estado. Se registran creación, modificación, eliminación,
cancelación y reprogramación después de persistir la operación correspondiente.
Eliminar no resta creaciones ni otros eventos anteriores.

Cancelación y reprogramación se contabilizan antes de enviar la notificación,
para que una falla de envío no omita esos contadores. Se mantiene la protección
frente a un segundo cierre secuencial de una votación ya resuelta.

MongoDB conserva identificadores públicos estables de votaciones y alternativas,
con compatibilidad para los identificadores existentes. La tarea de cierre se
programa con el identificador devuelto por la persistencia.

El panel de estadísticas refresca cada 15 segundos y al recuperar el foco;
las mutaciones correspondientes invalidan su caché. También se actualizan las
consultas afectadas del catálogo, dashboard, detalle, clima y resultados.

### 8. No abrir votaciones automáticas sin alternativas

Si la generación no encuentra alternativas, no se persiste una votación, no
cambia el estado de la actividad y no se programa un cierre. La apertura por API
responde `409` con un mensaje explicativo.

El monitoreo no anuncia una votación como abierta si no se creó. Omite actividades
pasadas y estados fuera de `PROPUESTA`, `CONFIRMADA` y `REPROGRAMADA`. Al elegir
horas adecuadas se descartan horarios pasados comparando el instante completo,
sin descartar todo el día por una comparación arbitraria al mediodía.

## Consecuencias y límites

- Se separa el catálogo de oportunidades futuras del historial personal.
- La eliminación es irreversible. La edición puede requerir abrir una nueva
  votación, aun cuando existían votos en la anterior.
- La disponibilidad de clima depende del proveedor y de su horizonte de
  pronóstico. Configurar más días de reprogramación no amplía ese horizonte.
- No se migran ni reparan retroactivamente votaciones vacías, trabajos pendientes
  antiguos o contadores históricos que ya fueran incorrectos.
- La persistencia de actividades, métricas y notificaciones sigue siendo una
  secuencia de operaciones, no una transacción conjunta. Este cambio no garantiza
  entrega de notificaciones ni contabilización exactamente una vez ante fallas
  parciales o cierres concurrentes.

## Validación y trazabilidad

| Comportamiento | Evidencia |
| --- | --- |
| Catálogo, baja con voto, autorización para editar/eliminar, cupos y cierre al editar | [Correcciones de actividades](../../backend/tests/integration/actividades/correcciones.test.ts) |
| Votación vacía, id del cierre programado, contador tras fallo de notificación y monitoreo | [Correcciones de actividades](../../backend/tests/integration/actividades/correcciones.test.ts) |
| Unidades, zona horaria, horizonte, datos incompletos y geocodificación | [Adaptador Open-Meteo](../../backend/tests/open-meteo.test.ts) |
| Cancelación, reprogramación y repetición secuencial del cierre | [Métricas de actividades](../../backend/tests/integration/estadisticas/metricas-actividades.test.ts) |
| Inscripción en verde, edición y confirmación de eliminación | [Detalle de actividad](../../frontend/tests/ActivityDetail.test.tsx) |
| Panel sin acción de simulación | [Administración](../../frontend/tests/Admin.test.tsx) |
| Contratos de edición y eliminación | [OpenAPI](../../backend/src/openapi.ts) |

Durante la implementación se verificaron 126 pruebas del backend y 48 del
frontend, compilación de ambos y lint del frontend. Después del ajuste adicional
de colores se volvió a ejecutar compilación y lint. No todos los colores tienen
una aserción automática específica.

También se realizó una consulta real para Buenos Aires: respuesta HTTP 200,
384 horas de pronóstico, unidades esperadas y zona
`America/Argentina/Buenos_Aires`. Esta comprobación puntual no sustituye una
prueba visual de la aplicación completa, que queda pendiente.


## Seguimiento: diagnóstico de clima en producción (2026-10-13)

Se reprodujo HTTP 503 para una actividad del 15 de octubre en Render, mientras
la consulta directa con la misma fecha y coordenadas funcionó desde el entorno
local. Esa comparación confirma cobertura para la fecha, pero no determina el
motivo del fallo desde producción.

Se conserva HTTP 503 y se agrega un código estable y un mensaje específico para
fecha sin cobertura, ubicación no encontrada, límite del proveedor, timeout,
respuesta incompleta o fallo de conexión. La ausencia de clima actual no se
clasifica como fecha fuera de rango. El backend registra el id de actividad,
código, estado HTTP del proveedor y código de red cuando existen, sin registrar
tokens, URLs completas ni cuerpos de respuesta. El frontend deja de atribuir
cualquier error al horizonte de 16 días.

Las pruebas de clima verifican los códigos y mensajes; el frontend comprueba
que no agrega el aviso de 16 días a un error genérico. Esta mejora permite
identificar la causa tras desplegarla; no demuestra que la falla de producción
haya sido resuelta ni introduce un respaldo con datos simulados.


### Límite de consultas confirmado (2026-10-13)

Los logs de Render confirmaron `WEATHER_RATE_LIMITED` con HTTP 429 del proveedor.
Se agrega una caché en memoria de diez minutos por coordenadas (hasta 100
pronósticos) y se comparte la solicitud en curso para consultas simultáneas del
mismo lugar. Clima y generación de alternativas usan esa misma caché. No se sirve
un pronóstico vencido como respaldo.

Ante 429 se respetan los segundos o la fecha de `Retry-After`; si no hay un valor
válido, se pausa un minuto antes de permitir otra consulta. La pausa aplica al
adaptador completo, no solo a una ubicación. El frontend deja de reintentar
automáticamente la consulta fallida y considera fresco el clima durante diez
minutos; conserva la actualización manual.

Estas medidas reducen tráfico y respetan el límite, pero no restablecen una cuota
agotada. La caché y la pausa son locales a cada proceso y se pierden al reiniciar.
No se determinó si la cuota corresponde solo a esta aplicación o a una IP de
salida compartida; se requiere evidencia del proveedor o del hosting.
