const request = require('supertest');
const createApp = require('../src/app');
const store = require('../src/store');

const app = createApp();

beforeEach(() => {
  store.reset();
});

describe('GET /api/customers', () => {
  test('returns seeded customers', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(2);
  });

  test('filters by search term matching name or email', async () => {
    const res = await request(app).get('/api/customers?search=ada');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toMatch(/Ada/i);
  });
});

describe('GET /api/customers/:id', () => {
  test('returns a single customer', async () => {
    const res = await request(app).get('/api/customers/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('1');
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/customers/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/customers', () => {
  test('creates a new customer', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'New User', email: 'new@example.com' });
    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe('new@example.com');
  });

  test('rejects an invalid email', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });

  test('rejects a duplicate email', async () => {
    const res = await request(app).post('/api/customers').send({ name: 'Dup', email: 'ada@example.com' });
    expect(res.statusCode).toBe(409);
  });
});

describe('PUT /api/customers/:id', () => {
  test('fully replaces a customer', async () => {
    const res = await request(app)
      .put('/api/customers/1')
      .send({ name: 'Ada L.', email: 'ada.l@example.com' });
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('ada.l@example.com');
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/customers/999').send({ name: 'X', email: 'x@example.com' });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /api/customers/:id', () => {
  test('partially updates a customer', async () => {
    const res = await request(app).patch('/api/customers/1').send({ name: 'Ada Updated' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Ada Updated');
    expect(res.body.email).toBe('ada@example.com'); // unchanged
  });
});

describe('DELETE /api/customers/:id', () => {
  test('deletes a customer', async () => {
    const res = await request(app).delete('/api/customers/1');
    expect(res.statusCode).toBe(204);

    const getRes = await request(app).get('/api/customers/1');
    expect(getRes.statusCode).toBe(404);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/customers/999');
    expect(res.statusCode).toBe(404);
  });
});
