const request = require('supertest');
const createApp = require('../src/app');
const store = require('../src/store');

const app = createApp();

beforeEach(() => {
  store.reset();
});

describe('POST /api/orders', () => {
  test('creates an order and computes the total from product prices', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 2 }] });
    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.total).toBe(19.98);
  });

  test('rejects an order for a non-existent customer', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerId: '999', items: [{ productId: '1', quantity: 1 }] });
    expect(res.statusCode).toBe(400);
  });

  test('rejects an order referencing a non-existent product', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '999', quantity: 1 }] });
    expect(res.statusCode).toBe(400);
  });

  test('rejects an order with no items', async () => {
    const res = await request(app).post('/api/orders').send({ customerId: '1', items: [] });
    expect(res.statusCode).toBe(400);
  });

  test('rejects a non-positive quantity', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 0 }] });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/orders', () => {
  test('filters by status', async () => {
    await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 1 }] });

    const res = await request(app).get('/api/orders?status=pending');
    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
  });

  test('rejects an invalid status filter', async () => {
    const res = await request(app).get('/api/orders?status=not-a-status');
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  async function createOrder() {
    const res = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 1 }] });
    return res.body;
  }

  test('allows a valid transition (pending -> paid)', async () => {
    const order = await createOrder();
    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ status: 'paid' });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('paid');
  });

  test('rejects an invalid transition (pending -> shipped)', async () => {
    const order = await createOrder();
    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ status: 'shipped' });
    expect(res.statusCode).toBe(409);
    expect(res.body.allowedNext).toEqual(['paid', 'cancelled']);
  });

  test('rejects an unknown status value', async () => {
    const order = await createOrder();
    const res = await request(app).patch(`/api/orders/${order.id}/status`).send({ status: 'bogus' });
    expect(res.statusCode).toBe(400);
  });

  test('returns 404 for a non-existent order', async () => {
    const res = await request(app).patch('/api/orders/999/status').send({ status: 'paid' });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/orders/:id', () => {
  test('deletes a pending order', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 1 }] });

    const res = await request(app).delete(`/api/orders/${createRes.body.id}`);
    expect(res.statusCode).toBe(204);
  });

  test('refuses to delete a shipped order', async () => {
    const createRes = await request(app)
      .post('/api/orders')
      .send({ customerId: '1', items: [{ productId: '1', quantity: 1 }] });
    const orderId = createRes.body.id;

    await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'paid' });
    await request(app).patch(`/api/orders/${orderId}/status`).send({ status: 'shipped' });

    const res = await request(app).delete(`/api/orders/${orderId}`);
    expect(res.statusCode).toBe(409);
  });

  test('returns 404 for a non-existent order', async () => {
    const res = await request(app).delete('/api/orders/999');
    expect(res.statusCode).toBe(404);
  });
});
