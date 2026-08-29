/** Especificación OpenAPI expuesta junto con la interfaz Swagger. */
export const openApiDocument = {
  openapi: '3.0.3', info: { title: 'TACS API', version: '1.0.0' },
  paths: {
    '/api/actividades': {
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
      Actividad: { allOf: [{ $ref: '#/components/schemas/CrearActividad' }], type: 'object', required: ['id', 'creadorId', 'creadaEn'], properties: { id: { type: 'string', format: 'uuid' }, creadorId: { type: 'string' }, creadaEn: { type: 'string', format: 'date-time' }, reglasClima: { $ref: '#/components/schemas/ReglasClima' } } },
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
    },
  },
} as const;
