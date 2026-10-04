const request = require('supertest');
const app = require('../app');
const User = require('../models/users');
const { connectTestDb, clearTestDb, closeTestDb, createUser } = require('./helpers');

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(closeTestDb);

const validUser = {
  name: 'Nolan',
  email: 'nolan@test.fr',
  password: 'motdepasse1',
  level: 'Débutant',
  location: 'Lyon',
};

describe('Inscription', () => {
  test('crée un utilisateur avec un mot de passe hashé', async () => {
    const res = await request(app).post('/createUser').send(validUser);

    expect(res.status).toBe(201);
    const user = await User.findOne({ email: validUser.email });
    expect(user.password).not.toBe(validUser.password);
    expect(user.isAdmin).toBe(false);
  });

  test("ignore un isAdmin envoyé par le client", async () => {
    await request(app).post('/createUser').send({ ...validUser, isAdmin: true });

    const user = await User.findOne({ email: validUser.email });
    expect(user.isAdmin).toBe(false);
  });

  test('refuse un email déjà utilisé', async () => {
    await createUser({ email: validUser.email });

    const res = await request(app).post('/createUser').send(validUser);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cet email est déjà utilisé.');
  });

  test.each([
    ['un email invalide', { email: 'pas-un-email' }, 'Email invalide.'],
    ['un mot de passe trop court', { password: 'abc1' }, 'Le mot de passe doit contenir entre 8 et 72 caractères.'],
    ['un mot de passe sans chiffre', { password: 'motdepasse' }, 'Le mot de passe doit contenir au moins un chiffre.'],
    ['un niveau inconnu', { level: 'débutant' }, 'Niveau invalide.'],
  ])('refuse %s', async (_, override, message) => {
    const res = await request(app).post('/createUser').send({ ...validUser, ...override });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
  });
});

describe('Connexion', () => {
  test('renvoie un token et un utilisateur sans mot de passe', async () => {
    await createUser({ email: 'login@test.fr', password: 'motdepasse1' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'login@test.fr', password: 'motdepasse1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('refuse un mauvais mot de passe', async () => {
    await createUser({ email: 'login@test.fr', password: 'motdepasse1' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'login@test.fr', password: 'mauvais1' });

    expect(res.status).toBe(401);
  });

  test("refuse une tentative d'injection NoSQL", async () => {
    await createUser({ email: 'login@test.fr' });

    const res = await request(app)
      .post('/login')
      .send({ email: { $ne: null }, password: 'motdepasse1' });

    expect(res.status).toBe(400);
  });
});
