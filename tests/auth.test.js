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

  test("enregistre l'email en minuscules", async () => {
    const res = await request(app).post('/createUser').send({ ...validUser, email: '  Nolan@Test.FR ' });

    expect(res.status).toBe(201);
    expect(await User.exists({ email: 'nolan@test.fr' })).not.toBeNull();
  });

  test("refuse le même email avec une casse différente", async () => {
    await request(app).post('/createUser').send({ ...validUser, email: 'Nolan@Test.fr' });

    const res = await request(app).post('/createUser').send({ ...validUser, email: 'nolan@test.fr' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cet email est déjà utilisé.');
  });

  test('deux inscriptions simultanées avec le même email : une 201 et une 400', async () => {
    await User.init();

    const responses = await Promise.all([
      request(app).post('/createUser').send(validUser),
      request(app).post('/createUser').send(validUser),
    ]);

    expect(responses.map((res) => res.status).sort()).toEqual([201, 400]);
    expect(await User.countDocuments({ email: validUser.email })).toBe(1);
  });

  test("transforme l'erreur d'index unique en 400", async () => {
    await User.init();
    await createUser({ email: validUser.email });
    jest.spyOn(User, 'exists').mockResolvedValue(null);

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

  test("accepte l'email quelle que soit la casse", async () => {
    await createUser({ email: 'login@test.fr', password: 'motdepasse1' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'Login@Test.FR', password: 'motdepasse1' });

    expect(res.status).toBe(200);
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
