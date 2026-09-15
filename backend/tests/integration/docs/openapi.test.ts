import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../../../src/openapi';

describe('OpenAPI Documentation & Contracts', () => {
  describe('Contratos de Participantes', () => {
    it('documenta rutas, autenticación, respuestas y esquema de participantes', () => {
      const paths = openApiDocument.paths;
      const add = paths['/api/actividades/{id}/participantes'].post;
      const remove = paths['/api/actividades/{id}/participantes/me'].delete;
      const actividad = openApiDocument.components.schemas.Actividad;

      expect(add.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Id', required: true }));
      expect(Object.keys(add.responses)).toEqual(expect.arrayContaining(['201', '401', '404', '409']));
      expect(remove.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Id', required: true }));
      expect(Object.keys(remove.responses)).toEqual(expect.arrayContaining(['200', '401', '404', '409']));
      expect(actividad.required).toContain('participantes');
      expect(actividad.properties.participantes).toMatchObject({
        type: 'array',
        uniqueItems: true,
        items: { type: 'string' },
      });
    });
  });

  describe('Contratos de Rutas Generales y Métricas', () => {
    it('documenta búsqueda, dashboard, estadísticas y simulación de notificaciones', () => {
      const paths = openApiDocument.paths;

      expect(paths['/api/actividades'].get.parameters).toContainEqual(expect.objectContaining({ name: 'page', in: 'query' }));
      expect(paths['/api/actividades'].get.responses).toHaveProperty('200');
      expect(paths['/api/usuarios/me/actividades'].get.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Id', required: true }));
      expect(paths['/api/admin/estadisticas'].get.parameters).toContainEqual(expect.objectContaining({ name: 'X-User-Role', required: true }));
      expect(paths['/api/notificaciones/simular-inicio'].post.responses).toHaveProperty('200');
    });
  });
});
