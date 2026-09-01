/** Especificación OpenAPI expuesta junto con la interfaz Swagger. */
export const openApiDocument = {
  openapi: '3.0.3', info: { title: 'TACS API', version: '1.0.0' },
  paths: {
    '/api/actividades': {
      get: {
        summary: 'Lista actividades con filtros y paginación',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['aire_libre', 'techada', 'mixta'] } },
          { name: 'fecha_desde', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'ubicacion', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Página de actividades', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginaActividades' } } } },
          '400': { description: 'Parámetros de búsqueda inválidos' },
        },
      },
      post: {
        summary: 'Crea una actividad',
        parameters: [{ name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CrearActividad' } } } },
        responses: {
          '201': { description: 'Actividad creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': { description: 'Body inválido' }, '401': { description: 'Usuario no autenticado' },
        },
      },
    },
    '/api/actividades/{id}/reglas': {
      post: {
        summary: 'Configura las reglas climáticas y de reprogramación de una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReglasClima' } } } },
        responses: {
          '200': { description: 'Reglas configuradas', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': { description: 'Reglas inválidas' }, '401': { description: 'Usuario no autenticado' },
          '403': { description: 'El usuario no es el organizador' }, '404': { description: 'Actividad inexistente' },
        },
      },
    },
    '/api/actividades/{id}/clima': {
      get: {
        summary: 'Consulta el clima actual y pronóstico para una actividad',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Clima obtenido', content: { 'application/json': { schema: { $ref: '#/components/schemas/WeatherForecast' } } } },
          '404': { description: 'Actividad inexistente' },
          '503': { description: 'Servicio de clima no disponible' },
        },
      },
    },
    '/api/actividades/{id}/participantes': {
      post: {
        summary: 'Inscribe al usuario en una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '201': { description: 'Participante inscripto', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': { description: 'Usuario ya inscripto o actividad sin cupo' },
          '401': { description: 'Usuario no autenticado' },
          '404': { description: 'Actividad inexistente' },
        },
      },
    },
    '/api/actividades/{id}/participantes/me': {
      delete: {
        summary: 'Da de baja al usuario de una actividad',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Participante dado de baja', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': { description: 'Usuario no inscripto o baja del organizador' },
          '401': { description: 'Usuario no autenticado' },
          '404': { description: 'Actividad inexistente' },
        },
      },
    },
    '/api/actividades/{id}/fechas-disponibles': {
      get: {
        summary: 'Obtiene fechas con clima adecuado para reprogramación',
        description: 'Retorna fechas futuras que tienen pronóstico disponible y cumplen las reglas climáticas de la actividad.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Fechas disponibles',
            content: { 'application/json': { schema: { type: 'object', properties: { fechas: { type: 'array', items: { type: 'string', format: 'date' } } } } } },
          },
          '400': { description: 'La actividad no tiene reglas climáticas configuradas' },
          '401': { description: 'Usuario no autenticado' },
          '404': { description: 'Actividad inexistente' },
        },
      },
    },
    '/api/actividades/{id}/votaciones': {
      post: {
        summary: 'Abre una votación de reprogramación',
        description: 'Si el body viene vacío, el sistema genera las alternativas automáticamente basándose en el pronóstico. Si se proveen alternativas, se usan las provistas por el organizador.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AbrirVotacion' } } } },
        responses: {
          '201': { description: 'Votación abierta', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '400': { description: 'Datos inválidos o sin reglas climáticas' },
          '401': { description: 'Usuario no autenticado' },
          '403': { description: 'El usuario no es el organizador' },
          '404': { description: 'Actividad inexistente' },
          '409': { description: 'Ya existe una votación activa' },
        },
      },
    },
    '/api/actividades/{id}/votaciones/{votacionId}/alternativas/{alternativaId}/votar': {
      post: {
        summary: 'Registra un voto en la votación indicada',
        description: 'El usuario debe ser un participante inscrito. Si ya votó, se sobreescribe su voto anterior.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'alternativaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '200': { description: 'Voto registrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Votacion' } } } },
          '400': { description: 'Alternativa inválida' },
          '401': { description: 'Usuario no autenticado' },
          '403': { description: 'El usuario no es participante inscrito' },
          '404': { description: 'Actividad o votación inexistente' },
          '409': { description: 'La votación no está abierta' },
        },
      },
    },
    '/api/actividades/{id}/votaciones/{votacionId}': {
      get: {
        summary: 'Resultados parciales de la votación indicada',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Resultados parciales',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ResultadosVotacion' } } },
          },
          '404': { description: 'Actividad o votación inexistente' },
        },
      },
      delete: {
        summary: 'Cierra manualmente una votación de reprogramación',
        description: 'Solo el organizador puede cerrar la votación. Se resuelve la reprogramación según los votos recibidos.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'votacionId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Votación cerrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Actividad' } } } },
          '401': { description: 'Usuario no autenticado' },
          '403': { description: 'El usuario no es el organizador' },
          '404': { description: 'Actividad o votación inexistente' },
          '409': { description: 'La votación ya está cerrada' },
        },
      },
    },
    '/api/usuarios/me/actividades': {
      get: {
        summary: 'Obtiene el dashboard de actividades del usuario autenticado',
        parameters: [
          { name: 'X-User-Id', in: 'header', required: true, schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
        ],
        responses: {
          '200': { description: 'Página del dashboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginaDashboardUsuario' } } } },
          '400': { description: 'Parámetros de paginación inválidos' },
          '401': { description: 'Usuario no autenticado' },
        },
      },
    },
    '/api/admin/estadisticas': {
      get: {
        summary: 'Consulta métricas acumuladas de la aplicación',
        parameters: [{ name: 'X-User-Role', in: 'header', required: true, schema: { type: 'string', enum: ['admin'] } }],
        responses: {
          '200': { description: 'Métricas disponibles', content: { 'application/json': { schema: { $ref: '#/components/schemas/Estadisticas' } } } },
          '403': { description: 'Se requiere rol administrador' },
          '500': { description: 'Error al obtener las estadísticas' },
        },
      },
    },
    '/api/notificaciones/simular-inicio': {
      post: {
        summary: 'Ejecuta una simulación del monitoreo climático y notificaciones',
        responses: {
          '200': { description: 'Simulación ejecutada', content: { 'application/json': { schema: { $ref: '#/components/schemas/SimulacionMonitoreo' } } } },
          '500': { description: 'Error al ejecutar la simulación' },
        },
      },
    },
  },
  components: {
    schemas: {
      CrearActividad: {
        type: 'object', required: ['titulo', 'descripcion', 'tipo', 'ubicacion', 'fecha_horario', 'min_participantes', 'max_participantes'],
        properties: {
          titulo: { type: 'string', example: 'Caminata urbana' }, descripcion: { type: 'string', example: 'Recorrido por el centro' },
          tipo: { type: 'string', enum: ['aire_libre', 'techada', 'mixta'], example: 'aire_libre' },
          ubicacion: { oneOf: [{ $ref: '#/components/schemas/UbicacionCoordenadas' }, { $ref: '#/components/schemas/UbicacionCiudad' }] },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-10T14:00:00-03:00' },
          min_participantes: { type: 'integer', minimum: 1, example: 4 }, max_participantes: { type: 'integer', minimum: 1, example: 12 },
        },
      },
      Actividad: {
        allOf: [{ $ref: '#/components/schemas/CrearActividad' }],
        type: 'object',
        required: ['id', 'creadorId', 'creadaEn', 'estado', 'participantes'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          creadorId: { type: 'string' },
          creadaEn: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['PROPUESTA', 'EN_VOTACION', 'CONFIRMADA', 'REPROGRAMADA', 'CANCELADA', 'FINALIZADA'], example: 'PROPUESTA' },
          participantes: { type: 'array', uniqueItems: true, items: { type: 'string' }, example: ['auth0|user-1', 'auth0|user-2'] },
          reglasClima: { $ref: '#/components/schemas/ReglasClima' },
          votaciones: { type: 'array', items: { $ref: '#/components/schemas/Votacion' }, description: 'Historial de votaciones de reprogramación' },
        },
      },
      ReglasClima: {
        type: 'object', required: ['probabilidad_lluvia_max', 'temperatura_min', 'temperatura_max', 'viento_max', 'horas_anticipacion', 'dias_max_reprogramacion', 'rango_horario'],
        properties: {
          probabilidad_lluvia_max: { type: 'number', minimum: 0, maximum: 100, example: 40 },
          temperatura_min: { type: 'number', example: 12 }, temperatura_max: { type: 'number', example: 28 },
          viento_max: { type: 'number', minimum: 0, example: 35 }, horas_anticipacion: { type: 'integer', minimum: 1, example: 24 },
          dias_max_reprogramacion: { type: 'integer', minimum: 1, example: 3 },
          rango_horario: { type: 'object', required: ['horario_min', 'horario_max'], properties: { horario_min: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '10:00' }, horario_max: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$', example: '20:00' } } },
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
          id: { type: 'string', format: 'uuid' },
          abiertaEn: { type: 'string', format: 'date-time' },
          cierraEn: { type: 'string', format: 'date-time' },
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
          id: { type: 'string', format: 'uuid' },
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
        type: 'object', required: ['tipo', 'latitud', 'longitud'], properties: {
          tipo: { type: 'string', enum: ['coordenadas'] }, latitud: { type: 'number', minimum: -90, maximum: 90, example: -34.6037 },
          longitud: { type: 'number', minimum: -180, maximum: 180, example: -58.3816 }, direccion: { type: 'string', example: 'Plaza de Mayo' },
        },
      },
      UbicacionCiudad: {
        type: 'object', required: ['tipo', 'ciudad', 'pais'], properties: {
          tipo: { type: 'string', enum: ['ciudad'] }, ciudad: { type: 'string', example: 'Buenos Aires' }, pais: { type: 'string', example: 'AR' },
        },
      },
      WeatherForecast: {
        type: 'object',
        required: ['ubicacion', 'fecha_horario', 'probabilidad_lluvia', 'temperatura', 'viento', 'condicion'],
        properties: {
          ubicacion: { type: 'string', example: 'Buenos Aires' },
          fecha_horario: { type: 'string', format: 'date-time', example: '2026-09-05T13:00:00' },
          probabilidad_lluvia: { type: 'number', minimum: 0, maximum: 100, example: 70 },
          temperatura: { type: 'number', example: 16 },
          viento: { type: 'number', example: 22 },
          condicion: { type: 'string', enum: ['SOLEADO', 'NUBLADO', 'PARCIALMENTE_NUBLADO', 'LLUVIA', 'TORMENTA'], example: 'LLUVIA' },
        },
      },
      PaginacionMeta: {
        type: 'object', required: ['total', 'page', 'limit', 'totalPages'],
        properties: {
          total: { type: 'integer', minimum: 0, example: 25 },
          page: { type: 'integer', minimum: 1, example: 1 },
          limit: { type: 'integer', minimum: 1, example: 10 },
          totalPages: { type: 'integer', minimum: 0, example: 3 },
        },
      },
      PaginaActividades: {
        type: 'object', required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Actividad' } },
          meta: { $ref: '#/components/schemas/PaginacionMeta' },
        },
      },
      ActividadDashboard: {
        type: 'object', required: ['id', 'titulo', 'fecha_horario', 'rol', 'estado', 'votacion_abierta'],
        properties: {
          id: { type: 'string', format: 'uuid' }, titulo: { type: 'string' }, fecha_horario: { type: 'string', format: 'date-time' },
          rol: { type: 'string', enum: ['organizador', 'participante'] },
          estado: { type: 'string', enum: ['PROPUESTA', 'EN_VOTACION', 'CONFIRMADA', 'REPROGRAMADA', 'CANCELADA', 'FINALIZADA'] },
          votacion_abierta: { type: 'boolean' },
        },
      },
      PaginaDashboardUsuario: {
        type: 'object', required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/ActividadDashboard' } },
          meta: { $ref: '#/components/schemas/PaginacionMeta' },
        },
      },
      Estadisticas: {
        type: 'object',
        description: 'Mapa de métricas a sus contadores. Puede ser vacío cuando todavía no se registraron eventos.',
        additionalProperties: { type: 'integer', minimum: 0 },
        example: { Actividad_Creada: 12, Actividad_Reprogramada: 3, consultas_clima: 18, alertas_mal_clima: 4 },
      },
      SimulacionMonitoreo: {
        type: 'object', required: ['mensaje', 'actividadEvaluada'],
        properties: { mensaje: { type: 'string' }, actividadEvaluada: { type: 'string' } },
      },
    },
  },
} as const;
