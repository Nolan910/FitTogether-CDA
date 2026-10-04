const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/users');
const { connectTestDb, clearTestDb, closeTestDb, createUser, tokenFor } = require('./helpers');

const protectedRoute = () => `/messages/${new mongoose.Types.ObjectId()}`;

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

describe('verifyToken', () => {
  test('refuse une requête sans en-tête Authorization', async () => {
    const res = await request(app).get(protectedRoute());

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Veuillez vous connecter.');
  });

  test("refuse un en-tête qui n'utilise pas le schéma Bearer", async () => {
    const user = await createUser();

    const res = await request(app)
      .get(protectedRoute())
      .set('x-access-token', tokenFor(user))
      .set('Authorization', tokenFor(user));

    expect(res.status).toBe(401);
  });

  test('refuse un token signé avec un autre secret', async () => {
    const user = await createUser();
    const forged = jwt.sign({ userId: user._id }, 'mauvais-secret');

    const res = await request(app)
      .get(protectedRoute())
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Session invalide ou expirée.');
  });

  test('refuse un token expiré', async () => {
    const user = await createUser();
    const expired = tokenFor(user, { expiresIn: -10 });

    const res = await request(app)
      .get(protectedRoute())
      .set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  test("refuse le token d'un compte supprimé", async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await User.findByIdAndDelete(user._id);

    const res = await request(app)
      .get(protectedRoute())
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Utilisateur introuvable.');
  });

  test('laisse passer un token valide', async () => {
    const user = await createUser();

    const res = await request(app)
      .get(protectedRoute())
      .set('Authorization', `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
