const http = require('http');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');
const app = require('../app');
const { initSocket, closeSocket } = require('../realtime/socket');
const {
  connectTestDb,
  clearTestDb,
  closeTestDb,
  createUser,
  tokenFor,
  authHeader,
  makePartners,
} = require('./helpers');

let server;
let url;
let clients = [];

beforeAll(async () => {
  await connectTestDb();
  server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterEach(async () => {
  clients.forEach((client) => client.close());
  clients = [];
  await clearTestDb();
});

afterAll(async () => {
  await closeSocket();
  await closeTestDb();
});

const connect = (token) => new Promise((resolve, reject) => {
  const client = ioClient(url, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  clients.push(client);
  client.on('connect', () => resolve(client));
  client.on('connect_error', reject);
});

const nextEvent = (client, event, timeout = 1000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Aucun événement ${event}`)), timeout);
  client.once(event, (payload) => {
    clearTimeout(timer);
    resolve(payload);
  });
});

const expectNoEvent = (client, event, delay = 300) => new Promise((resolve, reject) => {
  const handler = () => reject(new Error(`Événement ${event} reçu à tort`));
  client.once(event, handler);
  setTimeout(() => {
    client.off(event, handler);
    resolve();
  }, delay);
});

describe('Connexion WebSocket', () => {
  test('refuse une connexion sans token', async () => {
    await expect(connect()).rejects.toThrow('Veuillez vous connecter.');
  });

  test('refuse un token signé avec un autre secret', async () => {
    const user = await createUser();
    const forged = jwt.sign({ userId: user._id }, 'mauvais-secret');

    await expect(connect(forged)).rejects.toThrow('Session invalide ou expirée.');
  });

  test("refuse le token d'un compte supprimé", async () => {
    const user = await createUser();
    const token = tokenFor(user);
    await user.deleteOne();

    await expect(connect(token)).rejects.toThrow('Utilisateur introuvable.');
  });

  test('accepte un token valide', async () => {
    const user = await createUser();

    const client = await connect(tokenFor(user));

    expect(client.connected).toBe(true);
  });
});

describe('Messages en temps réel', () => {
  test('le destinataire reçoit le message dès son envoi', async () => {
    const sender = await createUser();
    const recipient = await createUser();
    await makePartners(sender, recipient);
    const recipientClient = await connect(tokenFor(recipient));

    const received = nextEvent(recipientClient, 'message:new');
    await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ to: recipient._id.toString(), content: 'Séance demain ?' })
      .expect(201);

    const message = await received;
    expect(message).toMatchObject({
      from: sender._id.toString(),
      to: recipient._id.toString(),
      content: 'Séance demain ?',
    });
  });

  test("l'expéditeur le reçoit aussi, pour ses autres onglets", async () => {
    const sender = await createUser();
    const recipient = await createUser();
    await makePartners(sender, recipient);
    const otherTab = await connect(tokenFor(sender));

    const received = nextEvent(otherTab, 'message:new');
    await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ to: recipient._id.toString(), content: 'Salut' })
      .expect(201);

    expect((await received).content).toBe('Salut');
  });

  test("un autre utilisateur ne reçoit rien", async () => {
    const sender = await createUser();
    const recipient = await createUser();
    const stranger = await createUser();
    await makePartners(sender, recipient);
    const strangerClient = await connect(tokenFor(stranger));

    const nothing = expectNoEvent(strangerClient, 'message:new');
    await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ to: recipient._id.toString(), content: 'Privé' })
      .expect(201);

    await nothing;
  });

  test("un message refusé (pas partenaires) n'est pas diffusé", async () => {
    const sender = await createUser();
    const stranger = await createUser();
    const strangerClient = await connect(tokenFor(stranger));

    const nothing = expectNoEvent(strangerClient, 'message:new');
    await request(app)
      .post('/messages')
      .set(authHeader(sender))
      .send({ to: stranger._id.toString(), content: 'Spam' })
      .expect(403);

    await nothing;
  });
});
