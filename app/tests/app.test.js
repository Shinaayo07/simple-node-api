const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

describe('Health & readiness', () => {
  test('GET /health returns 200 and status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  test('GET /ready returns 200 and status ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('Metrics', () => {
  test('GET /metrics exposes prometheus format', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });
});

describe('Request logging / correlation ids', () => {
  test('every response includes an X-Request-Id header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
  });

  test('a caller-supplied X-Request-Id is preserved on the response', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'test-fixed-id-123');
    expect(res.headers['x-request-id']).toBe('test-fixed-id-123');
  });

  test('two separate requests get two different generated ids', async () => {
    const first = await request(app).get('/health');
    const second = await request(app).get('/health');
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });
});

describe('Unknown routes', () => {
  test('returns 404 for unmatched route', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.statusCode).toBe(404);
  });
});
