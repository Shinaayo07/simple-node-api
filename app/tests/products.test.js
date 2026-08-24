const request = require('supertest');
const createApp = require('../src/app');
const store = require('../src/store');

const app = createApp();

beforeEach(() => {
  store.reset();
});

describe('GET /api/products', () => {
  test('returns seeded products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(2);
  });

  test('filters by search term', async () => {
    const res = await request(app).get('/api/products?search=widget');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toMatch(/Widget/i);
  });

  test('filters by price range', async () => {
    const res = await request(app).get('/api/products?minPrice=15');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every((p) => p.price >= 15)).toBe(true);
  });

  test('rejects a non-numeric minPrice', async () => {
    const res = await request(app).get('/api/products?minPrice=abc');
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/products/:id', () => {
  test('returns a single product', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe('1');
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/products/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/products', () => {
  test('creates a new product', async () => {
    const res = await request(app).post('/api/products').send({ name: 'New Item', price: 5, stock: 10 });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('New Item');
  });

  test('rejects missing required fields', async () => {
    const res = await request(app).post('/api/products').send({ name: 'No Price' });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('rejects negative price', async () => {
    const res = await request(app).post('/api/products').send({ name: 'Bad', price: -5 });
    expect(res.statusCode).toBe(400);
  });
});

describe('PUT /api/products/:id', () => {
  test('fully replaces a product', async () => {
    const res = await request(app).put('/api/products/1').send({ name: 'Updated Widget', price: 12 });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated Widget');
    expect(res.body.price).toBe(12);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/products/999').send({ name: 'X', price: 1 });
    expect(res.statusCode).toBe(404);
  });

  test('rejects incomplete payload', async () => {
    const res = await request(app).put('/api/products/1').send({ name: 'Only Name' });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/products/:id', () => {
  test('partially updates a product', async () => {
    const res = await request(app).patch('/api/products/1').send({ price: 15 });
    expect(res.statusCode).toBe(200);
    expect(res.body.price).toBe(15);
    expect(res.body.name).toBe('Sample Widget');
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).patch('/api/products/999').send({ price: 1 });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/products/:id', () => {
  test('deletes a product', async () => {
    const res = await request(app).delete('/api/products/1');
    expect(res.statusCode).toBe(204);

    const getRes = await request(app).get('/api/products/1');
    expect(getRes.statusCode).toBe(404);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/api/products/999');
    expect(res.statusCode).toBe(404);
  });
});
