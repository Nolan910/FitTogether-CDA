const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');
const { clientKey } = require('../Middleware/limiter');

const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(rateLimit({ windowMs: 60 * 1000, max: 2, keyGenerator: clientKey }));
  app.get('/', (req, res) => res.json({ ok: true }));
  return app;
};

describe('clientKey', () => {
  test("utilise l'IP transmise par Cloudflare quand elle est présente", () => {
    const req = { get: (name) => (name === 'cf-connecting-ip' ? '198.51.100.1' : undefined), ip: '10.0.0.1' };

    expect(clientKey(req)).toBe('198.51.100.1');
  });

  test("se rabat sur req.ip sans Cloudflare", () => {
    const req = { get: () => undefined, ip: '10.0.0.1' };

    expect(clientKey(req)).toBe('10.0.0.1');
  });

  test('un même client garde le même compteur, même si le proxy intermédiaire change', async () => {
    const app = buildApp();
    const fromClient = (proxyIp) => request(app)
      .get('/')
      .set('CF-Connecting-IP', '198.51.100.1')
      .set('X-Forwarded-For', `198.51.100.1, ${proxyIp}`);

    expect((await fromClient('172.64.0.1')).status).toBe(200);
    expect((await fromClient('172.64.0.2')).status).toBe(200);
    expect((await fromClient('172.64.0.3')).status).toBe(429);
  });

  test('deux clients différents ont des compteurs séparés', async () => {
    const app = buildApp();
    const fromClient = (ip) => request(app).get('/').set('CF-Connecting-IP', ip);

    await fromClient('198.51.100.1');
    await fromClient('198.51.100.1');

    expect((await fromClient('198.51.100.1')).status).toBe(429);
    expect((await fromClient('198.51.100.2')).status).toBe(200);
  });
});
