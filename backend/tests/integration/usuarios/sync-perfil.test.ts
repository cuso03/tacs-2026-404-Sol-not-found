import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { UsuarioModel } from '../../../src/infrastructure/mongo/usuarioModel';
import { signToken } from '../../helpers/auth/testAuth';
import { authHeader, adminHeader, AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1 } from '../../helpers/fixtures/auth.fixture';

/** Header con un token firmado que incluye los claims `email` y `name`. */
function headerConPerfil(sub: string, email: string, name: string): Record<string, string> {
  return { Authorization: `Bearer ${signToken(sub, { extraClaims: { email, name } })}` };
}

describe('PATCH /api/usuarios/me — perfil desde el token (RF-10)', () => {
  const app = createApp();

  it('responde 401 si no hay token', async () => {
    const response = await request(app)
      .patch('/api/usuarios/me');

    expect(response.status).toBe(401);
  });

  it('devuelve sub, email, nombre y roles tomados del token verificado', async () => {
    const response = await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      sub: AUTH_ORGANIZADOR,
      email: 'organizador@example.com',
      nombre: 'Ana',
      roles: [],
    });
  });

  it('expone los roles del claim de roles, sin aceptarlos del cliente', async () => {
    const response = await request(app)
      .patch('/api/usuarios/me')
      .set(adminHeader())
      .send({ roles: ['admin'] });

    expect(response.status).toBe(200);
    expect(response.body.roles).toEqual(['admin']);
  });

  it('crea el usuario en Mongo con su auth0Id en el primer login', async () => {
    await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana'));

    const usuario = await UsuarioModel.findOne({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuario).not.toBeNull();
    expect(usuario!.email).toBe('organizador@example.com');
    expect(usuario!.nombre).toBe('Ana');
    expect(usuario!.creadoEn).toBeInstanceOf(Date);
    expect(usuario!.ultimoAcceso).toBeInstanceOf(Date);
  });

  it('ignora un body con otro email: la identidad no viene del cliente', async () => {
    const response = await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana'))
      .send({ email: 'atacante@evil.example', nombre: 'Impostor' });

    expect(response.status).toBe(200);
    expect(response.body.email).toBe('organizador@example.com');
    expect(response.body.nombre).toBe('Ana');

    const usuario = await UsuarioModel.findOne({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuario!.email).toBe('organizador@example.com');
    expect(usuario!.nombre).toBe('Ana');
  });

  it('responde null cuando el token no trae email y no pisa el valor ya guardado', async () => {
    const conEmail = await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana'));
    expect(conEmail.status).toBe(200);

    // El mismo sub, ahora con un token sin claims de perfil.
    const sinClaims = await request(app)
      .patch('/api/usuarios/me').set(authHeader(AUTH_ORGANIZADOR));

    expect(sinClaims.status).toBe(200);
    expect(sinClaims.body).toEqual({ sub: AUTH_ORGANIZADOR, email: null, nombre: null, roles: [] });

    const usuario = await UsuarioModel.findOne({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuario!.email).toBe('organizador@example.com');
    expect(usuario!.nombre).toBe('Ana');
  });

  it('es idempotente: un segundo login actualiza el mismo registro sin duplicar', async () => {
    await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana'));
    const segundaVez = await request(app)
      .patch('/api/usuarios/me')
      .set(headerConPerfil(AUTH_ORGANIZADOR, 'organizador@example.com', 'Ana Actualizada'));

    expect(segundaVez.status).toBe(200);

    const usuarios = await UsuarioModel.find({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].nombre).toBe('Ana Actualizada');
  });

  it('cada sub de Auth0 obtiene su propio registro', async () => {
    await request(app)
      .patch('/api/usuarios/me').set(headerConPerfil(AUTH_ORGANIZADOR, 'uno@example.com', 'Uno'));
    await request(app)
      .patch('/api/usuarios/me').set(headerConPerfil(AUTH_PARTICIPANTE_1, 'dos@example.com', 'Dos'));

    const usuarios = await UsuarioModel.find({
      auth0Id: { $in: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1] },
    });

    expect(usuarios).toHaveLength(2);
    expect(usuarios.map((usuario) => usuario.auth0Id).sort()).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1].sort());
  });
});
