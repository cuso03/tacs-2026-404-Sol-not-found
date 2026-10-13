# ADR 0004: Visual Crossing como proveedor de clima

- Estado: Aceptado
- Fecha: 2026-10-13
- Alcance: Clima actual, pronóstico por actividad y alternativas de reprogramación
- Relación: Reemplaza la elección de Open-Meteo y su horizonte de 16 días del [ADR 0003](0003-correcciones-actividades-clima-y-estadisticas.md). Mantiene las demás reglas de negocio.

## Contexto

Producción devolvió HTTP 429 desde Open-Meteo incluso para una fecha con cobertura.
El diagnóstico confirmó el límite del proveedor, sin determinar si correspondía
al tráfico propio o a una IP compartida. El equipo eligió Visual Crossing y
proporcionó una API key. La prueba directa devolvió HTTP 200, clima actual y
15 días de pronóstico para Buenos Aires, con costo de una unidad.

## Decisión

- `VisualCrossingAdapter` implementa `IWeatherProvider` y es el proveedor por
  defecto tanto de la aplicación como del constructor de rutas. Se utiliza
  para la consulta de clima, el monitoreo y las alternativas de votación.
- La API key se lee de `VISUAL_CROSSING_API_KEY`, exclusivamente en el backend.
  En local se configura en `backend/.env`; en Render, en las variables del
  servicio. El archivo de ejemplo solo contiene el nombre vacío.
- Se consulta Timeline sin fechas adicionales, solicitando `current,days,hours`
  y `unitGroup=metric`. Esto obtiene el horizonte normal de 15 días, sin
  solicitar estadísticas climáticas de fechas más lejanas.
- Se selecciona la hora por `datetimeEpoch` y se conserva el offset de la zona
  del lugar para las franjas horarias. Temperatura y viento se mantienen en
  °C y km/h; la probabilidad de precipitación se conserva como porcentaje.
- Las condiciones se traducen a los estados existentes del dominio mediante
  los iconos del proveedor. Nieve, niebla y viento usan el estado genérico
  `NUBLADO` porque el contrato actual no tiene categorías específicas.
- No se reemplazan datos faltantes con ceros. La consulta puntual falla si sus
  valores obligatorios son inválidos; la búsqueda de alternativas omite horas
  incompletas. No hay respaldo automático con Open-Meteo ni datos simulados.
- Se conserva una caché de diez minutos por ubicación, limitada a cien entradas,
  compartida por consultas de clima y alternativas. Las solicitudes simultáneas
  al mismo lugar comparten una única llamada. La caché es por proceso.
- Ante 429 se respeta `Retry-After`; si falta un valor válido, se pausa un minuto.
  El frontend no reintenta automáticamente la consulta fallida.
- Falta de clave o rechazo HTTP 401/403 produce `WEATHER_CONFIGURATION_ERROR`.
  Se mantienen códigos para timeout, límite, datos inválidos y fecha sin cobertura.
  Los errores de red se reemplazan por mensajes seguros antes de propagarse,
  para evitar registrar URLs que contengan la API key.
- La interfaz atribuye los datos a Visual Crossing y anuncia hasta 15 días.

## Consecuencias

La integración requiere configurar la clave también en producción; copiar el
código o mergearlo no transmite el `.env` local. Visual Crossing tiene cuota:
la caché reduce consumo, pero no garantiza disponibilidad ni elimina sus límites.
Reiniciar borra la caché y la pausa. No se sirve información vencida como respaldo.

Los adaptadores anteriores permanecen en el repositorio para compatibilidad,
pero no se eligen por defecto ni se consultan cuando Visual Crossing falla.
Los tests pueden seguir inyectando proveedores determinísticos explícitos.

## Validación

[Las pruebas del adaptador](../../backend/tests/visual-crossing.test.ts) verifican
conversión de datos, hora local, cuota, caché y vencimiento, consultas concurrentes,
credenciales, respuestas incompletas y sanitización de errores. Se complementan
con las pruebas existentes de clima, votaciones y frontend.

Referencia: [Timeline Weather API](https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/).
