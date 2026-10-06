import { describe, expect, it } from 'vitest';
import { openApiDocument } from '../../../src/openapi';

describe('OpenAPI Documentation & Contracts', () => {
  describe('Esquema de autenticación', () => {
    it('declara bearerAuth y no documenta los headers legacy', () => {
      const document = openApiDocument as {
        components: { securitySchemes: Record<string, { type: string; scheme: string; bearerFormat?: string }> };
        security: Array<Record<string, string[]>>;
        paths: Record<string, Record<string, { parameters?: Array<{ name: string }>; security?: Array<Record<string, string[]>> }>>;
      };

      expect(document.components.securitySchemes.bearerAuth).toMatchObject({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
      expect(document.security).toEqual([{ bearerAuth: [] }]);

      const operations = Object.values(document.paths).flatMap((pathItem) => Object.values(pathItem));
      for (const operation of operations) {
        const names = (operation.parameters ?? []).map((parameter) => parameter.name);
        expect(names).not.toContain('X-User-Id');
        expect(names).not.toContain('X-User-Role');
      }
    });

    it('las operaciones públicas anulan la seguridad y las protegidas exigen el bearer', () => {
      const document = openApiDocument as unknown as {
        security: Array<Record<string, string[]>>;
        paths: Record<string, Record<string, { security?: Array<Record<string, string[]>> }>>;
      };
      const paths = document.paths;

      expect(paths['/api/actividades'].get.security).toEqual([]);
      expect(paths['/api/actividades/{id}/clima'].get.security).toEqual([]);

      // Las protegidas no declaran security propio: heredan el de la raíz.
      const effective = (operation: { security?: Array<Record<string, string[]>> }) => operation.security ?? document.security;
      expect(effective(paths['/api/actividades'].post)).toEqual([{ bearerAuth: [] }]);
      expect(effective(paths['/api/usuarios/me/actividades'].get)).toEqual([{ bearerAuth: [] }]);
      expect(effective(paths['/api/usuarios/me'].patch)).toEqual([{ bearerAuth: [] }]);
      expect(effective(paths['/api/admin/estadisticas'].get)).toEqual([{ bearerAuth: [] }]);
    });
  });

  describe('Contratos de Participantes', () => {
    it('documenta rutas, autenticación, respuestas y esquema de participantes', () => {
      const paths = openApiDocument.paths;
      const add = paths['/api/actividades/{id}/participantes'].post;
      const remove = paths['/api/actividades/{id}/participantes/me'].delete;
      const actividad = openApiDocument.components.schemas.Actividad;

      expect(add.security).toBeUndefined();
      expect(Object.keys(add.responses)).toEqual(expect.arrayContaining(['201', '401', '404', '409']));
      expect(remove.security).toBeUndefined();
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
    it('documenta búsqueda, dashboard, perfil y estadísticas', () => {
      const paths = openApiDocument.paths;

      expect(paths['/api/actividades'].get.parameters).toContainEqual(expect.objectContaining({ name: 'page', in: 'query' }));
      expect(paths['/api/actividades'].get.responses).toHaveProperty('200');
      expect(paths['/api/usuarios/me/actividades'].get.parameters).toContainEqual(expect.objectContaining({ name: 'page', in: 'query' }));
      expect(paths['/api/admin/estadisticas'].get.responses).toHaveProperty('403');
    });

    it('el perfil se documenta como PATCH sin body y la simulación de notificaciones ya no existe', () => {
      const paths = openApiDocument.paths;

      // Sin requestBody: la identidad sale del token verificado, no del cliente.
      expect(paths['/api/usuarios/me'].patch).not.toHaveProperty('requestBody');
      expect(paths['/api/usuarios/me'].patch.responses).toHaveProperty('200');
      // Escribe, asi que no puede declararse como GET.
      expect(paths['/api/usuarios/me']).not.toHaveProperty('get');
      expect(paths).not.toHaveProperty('/api/usuarios/sync');
      expect(paths).not.toHaveProperty('/api/notificaciones/simular-inicio');
      expect(openApiDocument.components.schemas).not.toHaveProperty('SimulacionMonitoreoResponse');
      // Un tag sin operaciones es ruido en Swagger.
      expect(openApiDocument.tags.map((tag) => tag.name)).not.toContain('notificaciones');
    });
  });
});
