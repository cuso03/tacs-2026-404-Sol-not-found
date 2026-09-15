/** Especificación OpenAPI expuesta junto con la interfaz Swagger. */
export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'TACS API', version: '1.0.0' },
  tags: [
    { name: 'actividades', description: 'Gestión de actividades' },
    { name: 'votaciones', description: 'Votaciones de reprogramación' },
    { name: 'clima', description: 'Consultas climáticas' },
    { name: 'admin', description: 'Métricas y administración' },
    { name: 'notificaciones', description: 'Simulación de notificaciones' },
    { name: 'usuarios', description: 'Dashboard de usuario' },
  ],
  paths: {
    '/api/actividades': {
      get: {
        tags: ['actividades'],
        operationId: 'buscarActividades',
        summary: 'Busca actividades con filtros y paginación',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 }, description: 'Número de página' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }, description: 'Cantidad de resultados por página' },
          { name: 'tipo', in: 'query', required: false, schema: { type: 'string', enum: ['aire_libre', 'techada', 'mixta'] }, description: 'Filtrar por tipo de actividad' },
          { name: 'fecha_desde', in: 'query', required: false, schema: { type: 'string', format: 'date-time' }, description: 'Filtrar actividades con fecha posterior (ISO 8601 con offset, ej: 2026-09-10T14:00:00-03:00)' },
          { name: 'ubicacion', in: 'query', required: false, schema: { type: 'string', minLength: 1 }, description: 'Filtrar por ubicación (texto libre, case-insensitive)' },
        ],
        responses: {
          '200': {
            description: 'Lista de actividades paginada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'meta'],
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Actividad' } },
                    meta: { $ref: '#/components/schemas/PaginacionMeta' },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Parámetros de búsqueda inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      post: {
        tags: ['actividades'],
        operationId: 'crearActividad',
        summary: 'Crea una actividad',
        parameters: [{ name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CrearActividad' } } } },
        responses: {
          '201': { description: 'Actividad creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': {
            description: 'Body inválido',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/reglas': {
      post: {
        tags: ['actividades'],
        operationId: 'configurarReglas',
        summary: 'Configura las reglas climáticas y de reprogramación de una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReglasClima' } } } },
        responses: {
          '200': { description: 'Reglas configuradas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': {
            description: 'Reglas inválidas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'El usuario no es el organizador',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/clima': {
      get: {
        tags: ['clima'],
        operationId: 'consultarClima',
        summary: 'Consulta el pronóstico para la hora de la actividad',
        description: 'Retorna el pronóstico climático (probabilidad de lluvia, temperatura, viento y condición) para la fecha y ubicación de la actividad.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Clima obtenido', content: { 'application/json': { schema: { $ref: '#/components/schemas/WeatherForecast' } } } },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '503': {
            description: 'Servicio de clima no disponible',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/participantes': {
      post: {
        tags: ['actividades'],
        operationId: 'inscribirParticipante',
        summary: 'Inscribe al usuario en una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'Participante inscripto', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': {
            description: 'Usuario ya inscripto o actividad sin cupo',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/participantes/me': {
      delete: {
        tags: ['actividades'],
        operationId: 'darDeBajaParticipante',
        summary: 'Da de baja al usuario de una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Participante dado de baja', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': {
            description: 'Usuario no inscripto o baja del organizador',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/fechas-disponibles': {
      get: {
        tags: ['votaciones'],
        operationId: 'obtenerFechasDisponibles',
        summary: 'Obtiene fechas con clima adecuado para reprogramación',
        description: 'Retorna fechas futuras que tienen pronóstico disponible y cumplen las reglas climáticas de la actividad.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Fechas disponibles',
            content: { 'application/json': { schema: { type: 'object', properties: { fechas: { type: 'array', items: { type: 'string', format: 'date-time' } } } } } },
          },
          '400': {
            description: 'La actividad no tiene reglas climáticas configuradas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/votaciones': {
      post: {
        tags: ['votaciones'],
        operationId: 'abrirVotacion',
        summary: 'Abre una votación de reprogramación',
        description: 'Si el body viene vacío, el sistema genera las alternativas automáticamente basándose en el pronóstico. Si se proveen alternativas, se usan las provistas por el organizador.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AbrirVotacion' } } } },
        responses: {
          '201': { description: 'Votación abierta', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': {
            description: 'Datos inválidos o sin reglas climáticas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'El usuario no es el organizador',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'Ya existe una votación activa',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/votaciones/{votacionId}/alternativas/{alternativaId}/votar': {
      post: {
        tags: ['votaciones'],
        operationId: 'votar',
        summary: 'Registra un voto en la votación indicada',
        description: 'El usuario debe ser un participante inscrito. Si ya votó, se sobreescribe su voto anterior. La alternativa se indica en la URL.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'alternativaId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Voto registrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Votacion' } } } },
          '400': {
            description: 'Alternativa inválida',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'El usuario no es participante inscrito',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad o votación inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'La votación no está abierta',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/actividades/{id}/votaciones/{votacionId}': {
      get: {
        tags: ['votaciones'],
        operationId: 'obtenerResultadosVotacion',
        summary: 'Resultados parciales de la votación indicada',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Resultados parciales',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ResultadosVotacion' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad o votación inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
      delete: {
        tags: ['votaciones'],
        operationId: 'cerrarVotacion',
        summary: 'Cierra manualmente una votación de reprogramación',
        description: 'Solo el organizador puede cerrar la votación. Se resuelve la reprogramación según los votos recibidos.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Votación cerrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'El usuario no es el organizador',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '404': {
            description: 'Actividad o votación inexistente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '409': {
            description: 'La votación ya está cerrada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/admin/estadisticas': {
      get: {
        tags: ['admin'],
        operationId: 'obtenerEstadisticas',
        summary: 'Obtiene las estadísticas del sistema',
        description: 'Devuelve todas las métricas registradas en el sistema. Requiere permisos de administrador.',
        parameters: [
          { name: 'X-User-Role', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Estadísticas obtenidas correctamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Estadisticas' },
                example: {
                  actividad_creada: 25,
                  usuario_registrado: 48,
                  actividad_finalizada: 12,
                  actividad_cancelada: 3,
                },
              },
            },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '403': {
            description: 'El usuario no tiene permisos de administrador',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '500': {
            description: 'Error interno al obtener las estadísticas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/notificaciones/simular-inicio': {
      post: {
        tags: ['notificaciones'],
        operationId: 'simularMonitoreo',
        summary: 'Simula el monitoreo climático de una actividad',
        description: 'Ejecuta manualmente una simulación del monitoreo climático utilizando servicios mock de clima y notificaciones.',
        responses: {
          '200': {
            description: 'Monitoreo simulado correctamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SimulacionMonitoreoResponse' },
                example: {
                  mensaje: 'Monitoreo simulado ejecutado. Revisa la consola de Docker para ver las notificaciones.',
                  actividadEvaluada: 'Partido de Futbol 5',
                },
              },
            },
          },
          '500': {
            description: 'Error al ejecutar la simulación',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/api/usuarios/me/actividades': {
      get: {
        tags: ['usuarios'],
        operationId: 'obtenerDashboardUsuario',
        summary: 'Obtiene las actividades del usuario autenticado',
        description: 'Devuelve las actividades asociadas al usuario autenticado utilizando paginación.',
        parameters: [
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' }, description: 'Identificador del usuario autenticado.' },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1, example: 1 }, description: 'Número de página.' },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 10, example: 10 }, description: 'Cantidad máxima de actividades por página.' },
        ],
        responses: {
          '200': {
            description: 'Dashboard obtenido correctamente',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardUsuario' },
                example: {
                  data: [],
                  meta: { total: 25, page: 1, limit: 10, totalPages: 3 },
                },
              },
            },
          },
          '400': {
            description: 'Parámetros de paginación inválidos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          '401': {
            description: 'Usuario no autenticado',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CrearActividad: {
        type: 'object',
        required: ['titulo', 'descripcion', 'tipo', 'ubicacion', 'fecha_horario', 'min_participantes', 'max_participantes'],
        properties: {
          titulo: { type: 'string', example: 'Caminata urbana' },
          descripcion: { type: 'string', example: 'Recorrido por el centro' },
          tipo: { type: 'string', enum: ['aire_libre', 'techada', 'mixta'], example: 'aire_libre' },
          ubicacion: { oneOf: [{ $ref: '#/components/schemas/UbicacionCoordenadas' }, { $ref: '#/components/schemas/UbicacionCiudad' }] },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          min_participantes: { type: 'integer', minimum: 1, example: 4 },
          max_participantes: { type: 'integer', minimum: 1, example: 12 },
        },
      },
      Actividad: {
        allOf: [{ $ref: '#/components/schemas/CrearActividad' }],
        type: 'object',
        required: ['id', 'creadorId', 'creadaEn', 'estado', 'participantes'],
        properties: {
          id: { type: 'string' },
          creadorId: { type: 'string' },
          creadaEn: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          estado: { type: 'string', enum: ['PROPUESTA', 'EN_VOTACION', 'CONFIRMADA', 'REPROGRAMADA', 'CANCELADA', 'FINALIZADA'], example: 'PROPUESTA' },
          participantes: { type: 'array', uniqueItems: true, items: { type: 'string' }, example: ['auth0|user-1', 'auth0|user-2'] },
          reglasClima: { $ref: '#/components/schemas/ReglasClima' },
          votaciones: { type: 'array', items: { $ref: '#/components/schemas/Votacion' }, description: 'Historial de votaciones de reprogramación' },
        },
      },
      ReglasClima: {
        type: 'object',
        required: ['probabilidad_lluvia_max', 'temperatura_min', 'temperatura_max', 'viento_max', 'horas_anticipacion', 'dias_max_reprogramacion', 'rango_horario'],
        properties: {
          probabilidad_lluvia_max: { type: 'number', minimum: 0, maximum: 100, example: 40 },
          temperatura_min: { type: 'number', example: 12 },
          temperatura_max: { type: 'number', example: 28 },
          viento_max: { type: 'number', minimum: 0, example: 35 },
          horas_anticipacion: { type: 'integer', minimum: 1, example: 24 },
          dias_max_reprogramacion: { type: 'integer', minimum: 1, example: 3 },
          rango_horario: {
            type: 'object',
            required: ['horario_min', 'horario_max'],
            properties: {
              horario_min: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '10:00' },
              horario_max: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '20:00' },
            },
          },
        },
      },
      AbrirVotacion: {
        type: 'object',
        properties: {
          alternativas: {
            type: 'array',
            items: { type: 'object', required: ['fecha_horario'], properties: { fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-12T14:00:00-03:00' } } },
            description: 'Opcional. Si se omite, el sistema genera alternativas automáticamente.',
          },
          duracion_horas: { type: 'integer', minimum: 1, maximum: 168, default: 24, example: 24, description: 'Horas que permanecerá abierta la votación.' },
        },
      },
      Votacion: {
        type: 'object',
        required: ['id', 'abiertaEn', 'cierraEn', 'duracionHoras', 'automatica', 'alternativas', 'votos'],
        properties: {
          id: { type: 'string' },
          abiertaEn: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          cierraEn: { type: 'string', format: 'date-time', example: '2026-09-11T14:00:00-03:00' },
          duracionHoras: { type: 'integer', example: 24 },
          automatica: { type: 'boolean', example: false, description: 'Si las alternativas fueron generadas automáticamente por el sistema' },
          alternativas: { type: 'array', items: { $ref: '#/components/schemas/Alternativa' } },
          votos: { type: 'object', additionalProperties: { type: 'string' }, description: 'Mapa userId → alternativaId' },
        },
      },
      Alternativa: {
        type: 'object',
        required: ['id', 'fecha_horario'],
        properties: {
          id: { type: 'string' },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-12T14:00:00-03:00' },
        },
      },
      ResultadosVotacion: {
        type: 'object',
        required: ['votacion', 'conteo', 'totalVotos'],
        properties: {
          votacion: { $ref: '#/components/schemas/Votacion' },
          conteo: { type: 'object', additionalProperties: { type: 'integer' }, description: 'Mapa alternativaId → cantidad de votos' },
          totalVotos: { type: 'integer', example: 3 },
        },
      },
      UbicacionCoordenadas: {
        type: 'object',
        required: ['tipo', 'latitud', 'longitud'],
        properties: {
          tipo: { type: 'string', enum: ['coordenadas'] },
          latitud: { type: 'number', minimum: -90, maximum: 90, example: -34.6037 },
          longitud: { type: 'number', minimum: -180, maximum: 180, example: -58.3816 },
          direccion: { type: 'string', example: 'Plaza de Mayo' },
        },
      },
      UbicacionCiudad: {
        type: 'object',
        required: ['tipo', 'ciudad', 'pais'],
        properties: {
          tipo: { type: 'string', enum: ['ciudad'] },
          ciudad: { type: 'string', example: 'Buenos Aires' },
          pais: { type: 'string', example: 'AR' },
        },
      },
      WeatherForecast: {
        type: 'object',
        required: ['ubicacion', 'fecha_horario', 'probabilidad_lluvia', 'temperatura', 'viento', 'condicion'],
        properties: {
          ubicacion: { type: 'string', example: 'Buenos Aires, AR' },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          probabilidad_lluvia: { type: 'number', minimum: 0, maximum: 100, example: 70 },
          temperatura: { type: 'number', example: 16 },
          viento: { type: 'number', example: 22 },
          condicion: { type: 'string', enum: ['SOLEADO', 'NUBLADO', 'PARCIALMENTE_NUBLADO', 'LLUVIA', 'TORMENTA'], example: 'LLUVIA' },
        },
      },
      Estadisticas: {
        type: 'object',
        description: 'Mapa de métricas del sistema. Cada clave representa una métrica y su valor es el contador asociado.',
        additionalProperties: { type: 'number' },
        example: {
          actividad_creada: 25,
          usuario_registrado: 48,
          actividad_finalizada: 12,
          actividad_cancelada: 3,
        },
      },
      SimulacionMonitoreoResponse: {
        type: 'object',
        required: ['mensaje', 'actividadEvaluada'],
        properties: {
          mensaje: { type: 'string', example: 'Monitoreo simulado ejecutado. Revisa la consola de Docker para ver las notificaciones.' },
          actividadEvaluada: { type: 'string', example: 'Partido de Futbol 5' },
        },
      },
      DashboardUsuario: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: {
            type: 'array',
            description: 'Resumen de actividades correspondientes al usuario autenticado.',
            items: { $ref: '#/components/schemas/ActividadResumenUsuario' },
          },
          meta: { $ref: '#/components/schemas/PaginacionMeta' },
        },
      },
      PaginacionMeta: {
        type: 'object',
        required: ['total', 'page', 'limit', 'totalPages'],
        properties: {
          total: { type: 'integer', minimum: 0, example: 25, description: 'Cantidad total de actividades.' },
          page: { type: 'integer', minimum: 1, example: 1, description: 'Página actual.' },
          limit: { type: 'integer', minimum: 1, example: 10, description: 'Cantidad de elementos solicitados por página.' },
          totalPages: { type: 'integer', minimum: 0, example: 3, description: 'Cantidad total de páginas.' },
        },
      },
      ActividadResumenUsuario: {
        type: 'object',
        required: ['id', 'titulo', 'fecha_horario', 'rol', 'estado', 'votacion_abierta'],
        properties: {
          id: { type: 'string', example: 'abc123' },
          titulo: { type: 'string', example: 'Caminata urbana' },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          rol: { type: 'string', enum: ['organizador', 'participante'], example: 'organizador' },
          estado: { type: 'string', enum: ['PROPUESTA', 'EN_VOTACION', 'CONFIRMADA', 'REPROGRAMADA', 'CANCELADA', 'FINALIZADA'], example: 'PROPUESTA' },
          votacion_abierta: { type: 'boolean', example: false },
        },
      },
      Error: {
        type: 'object',
        required: ['code', 'error'],
        properties: {
          code: { type: 'integer', description: 'Código HTTP del error', example: 404 },
          error: { type: 'string', description: 'Identificador del tipo de error', example: 'RESOURCE_NOT_FOUND' },
          message: { type: 'string', description: 'Descripción legible del error', example: 'Actividad no encontrada' },
          details: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
            description: 'Detalles de errores de validación (solo 400)',
          },
        },
      },
    },
  },
} as const;
