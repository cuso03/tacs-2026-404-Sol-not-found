import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app';
import { UsuarioModel } from '../../../src/infrastructure/mongo/usuarioModel';
import { authHeader, AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1 } from '../../helpers/fixtures/auth.fixture';

describe('POST /api/usuarios/sync — persistencia del usuario (RF-10)', () => {
  const app = createApp();

  it('responde 401 si no hay token', async () => {
    const response = await request(app).post('/api/usuarios/sync').send({ email: 'ana@example.com' });

    expect(response.status).toBe(401);
  });

  it('crea el usuario en Mongo con su auth0Id en el primer login', async () => {
    const response = await request(app)
      .post('/api/usuarios/sync')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ email: 'organizador@example.com', nombre: 'Ana' });

    expect(response.status).toBe(200);

    const usuario = await UsuarioModel.findOne({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuario).not.toBeNull();
    expect(usuario!.email).toBe('organizador@example.com');
    expect(usuario!.nombre).toBe('Ana');
    expect(usuario!.creadoEn).toBeInstanceOf(Date);
    expect(usuario!.ultimoAcceso).toBeInstanceOf(Date);
  });

  it('es idempotente: un segundo login actualiza el mismo registro sin duplicar', async () => {
    await request(app)
      .post('/api/usuarios/sync')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ email: 'organizador@example.com', nombre: 'Ana' });
    const segundaVez = await request(app)
      .post('/api/usuarios/sync')
      .set(authHeader(AUTH_ORGANIZADOR))
      .send({ email: 'organizador@example.com', nombre: 'Ana Actualizada' });

    expect(segundaVez.status).toBe(200);

    const usuarios = await UsuarioModel.find({ auth0Id: AUTH_ORGANIZADOR });
    expect(usuarios).toHaveLength(1);
    expect(usuarios[0].nombre).toBe('Ana Actualizada');
  });

  it('cada sub de Auth0 obtiene su propio registro', async () => {
    await request(app).post('/api/usuarios/sync').set(authHeader(AUTH_ORGANIZADOR)).send({ email: 'uno@example.com', nombre: 'Uno' });
    await request(app).post('/api/usuarios/sync').set(authHeader(AUTH_PARTICIPANTE_1)).send({ email: 'dos@example.com', nombre: 'Dos' });

    const usuarios = await UsuarioModel.find({
      auth0Id: { $in: [AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1] },
    });

    expect(usuarios).toHaveLength(2);
    expect(usuarios.map((usuario) => usuario.auth0Id).sort()).toEqual([AUTH_ORGANIZADOR, AUTH_PARTICIPANTE_1].sort());
  });
});
