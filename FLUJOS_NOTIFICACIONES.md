# Documentación de Pruebas: Notificaciones

Este documento detalla los procedimientos para validar los flujos de notificaciones asíncronas y síncronas integrados con RabbitMQ, Telegram y el orquestador de tareas. 

## Flujo 1: Monitoreo Asíncrono (Alerta de Mal Clima)

Este flujo valida que el sistema detecte proactivamente condiciones climáticas desfavorables y envíe alertas automáticas a los participantes mediante la cola de mensajes.

### 1. Configuración del Entorno (Modificación del Cron)
Por defecto, el monitoreo se ejecuta cada hora (`0 * * * *`). Para agilizar la prueba, se debe modificar el intervalo a un minuto.
1. Abre el archivo `src/cronJobs/CronSetup.ts`.
2. Modifica la expresión del cron a: `cron.schedule('* * * * *', async () => {`.
3. Guarda el archivo y permite que el contenedor de Docker se reinicie (`docker-compose up --build` si es necesario).

### 2. Creación de la Actividad
Se requiere instanciar una actividad base en el repositorio en memoria.

**Endpoint:** `POST http://localhost:3000/api/actividades`  
**Headers:**
* `X-User-Id`: `user-123`
* `Content-Type`: `application/json`

**Body:**
```json
{
  "titulo": "Prueba clima malo",
  "descripcion": "Actividad de prueba para forzar alerta por mal clima.",
  "tipo": "aire_libre",
  "ubicacion": {
    "tipo": "ciudad",
    "ciudad": "Buenos Aires",
    "pais": "AR"
  },
  "fecha_horario": "2026-09-10T14:00:00-03:00",
  "min_participantes": 2,
  "max_participantes": 6
}

```

*Nota: Guarda el `id` generado en la respuesta para el siguiente paso.*

### 3. Configuración de Reglas Climáticas Restrictivas

Para garantizar que el pronóstico falle y se dispare la alerta, se aplican reglas climáticas extremas e imposibles de cumplir.

**Endpoint:** `POST http://localhost:3000/api/actividades/:id/reglas`

**Headers:**

* `X-User-Id`: `user-123`
* `Content-Type`: `application/json`

**Body:**

```json
{
  "probabilidad_lluvia_max": 0,
  "temperatura_min": 0,
  "temperatura_max": 5,
  "viento_max": 0,
  "horas_anticipacion": 24,
  "dias_max_reprogramacion": 3,
  "rango_horario": {
    "horario_min": "10:00",
    "horario_max": "20:00"
  }
}

```

### 4. Verificación

* Aguarda a que el reloj del sistema cambie de minuto.
* **Logs de Docker:** Verifica la aparición del mensaje `[CronJob] Iniciando evaluación periódica de clima...` seguido de la confirmación de encolado en RabbitMQ.
* **Telegram:** El bot debe enviar el mensaje indicando que el pronóstico no cumple las condiciones.
* **Limpieza:** Una vez validado, revierte la expresión en `CronSetup.ts` a `0 * * * *`.

---

## Flujo 2: Integración Total (Notificaciones Síncronas por Votación)

Este flujo valida la conexión entre la resolución de conflictos (Feature 6) y el motor de eventos (`ActividadEventNotifier`), confirmando que los cambios de estado (reprogramación o cancelación) sean notificados inmediatamente.

### 1. Creación de la Actividad

Repite el paso de creación de actividad detallado en el Flujo 1 para generar un nuevo registro limpio y guarda su `id`.

### 2. Apertura de Votación Forzada

Inicia un proceso de votación manual enviando alternativas de reprogramación.

**Endpoint:** `POST http://localhost:3000/api/actividades/:id/votaciones`

**Headers:**

* `X-User-Id`: `user-123`
* `Content-Type`: `application/json`

**Body:**

```json
{
  "duracion_horas": 24,
  "alternativas": [
    {
      "fecha_horario": "2026-09-12T14:00:00-03:00"
    },
    {
      "fecha_horario": "2026-09-13T16:00:00-03:00"
    },
    {
      "fecha_horario": "2026-09-14T18:00:00-03:00"
    }
  ]
}

```

*Nota: Guarda el `votacionId` (dentro del array `votaciones` en la respuesta) para el cierre manual.*

### 3. Resolución de la Votación

Para validar este flujo, existen dos alternativas de ejecución:

**Opción A: Cierre Manual (Recomendado para testing rápido)**
Fuerza la expiración inmediata de la votación mediante el endpoint de eliminación.

**Endpoint:** `DELETE http://localhost:3000/api/actividades/:id/votaciones/:votacionId`

**Headers:**

* `X-User-Id`: `user-123`

**Opción B: Cierre Automático (Requiere ajuste de tiempo)**
Si se desea probar la expiración automática gestionada por la cola de trabajos (`votingJobQueue`), es necesario configurar el tiempo de duración en el CronJob/JobQueue a **minutos** en lugar de horas (modificando la lógica temporal en el servicio de creación de votaciones o enviando una fracción en `duracion_horas` si el DTO lo permite), y aguardar la ejecución en segundo plano.

### 4. Verificación

* Al ejecutarse el cierre (ya sea manual o automático), el orquestador de votaciones evaluará el quórum.
* **Logs de Docker:** El `RabbitMQNotifier` registrará el encolado de un nuevo mensaje.
* **Telegram:** El bot entregará de forma instantánea uno de los dos posibles mensajes de resolución:
* *Reprogramación:* `La actividad "..." ha sido REPROGRAMADA para el día...`
* *Cancelación:* `Lamentamos informarte que la actividad "..." ha sido CANCELADA.`