const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectTestDb, closeTestDb } = require('./helpers');

beforeAll(connectTestDb);
afterAll(closeTestDb);

afterEach(() => {
  delete process.env.RENDER_GIT_COMMIT;
});

describe('GET /health', () => {
  test('renvoie 200 avec le commit déployé quand la base répond', async () => {
    process.env.RENDER_GIT_COMMIT = 'abc123';

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', commit: 'abc123', database: 'up' });
    expect(res.body.uptime).toEqual(expect.any(Number));
  });

  test("indique 'local' hors de Render", async () => {
    const res = await request(app).get('/health');

    expect(res.body.commit).toBe('local');
  });

  test('renvoie 503 quand la base est déconnectée', async () => {
    await mongoose.disconnect();

    const res = await request(app).get('/health');
    await connectTestDb();

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'error', database: 'down' });
  });
});
