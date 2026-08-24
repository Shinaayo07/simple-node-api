const express = require('express');
const { trace } = require('@opentelemetry/api');
const store = require('../store');

const router = express.Router();
const tracer = trace.getTracer('customer-api.orders');

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

const ALLOWED_TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

function computeTotal(items) {
  return tracer.startActiveSpan('compute_order_total', (span) => {
    try {
      const total = items.reduce((sum, item) => {
        const product = store.products.get(item.productId);
        return sum + product.price * item.quantity;
      }, 0);
      span.setAttribute('order.item_count', items.length);
      span.setAttribute('order.total', total);
      return total;
    } finally {
      span.end();
    }
  });
}

function validateOrderPayload(body) {
  return tracer.startActiveSpan('validate_order_payload', (span) => {
    try {
      const errors = [];

      if (!body.customerId || typeof body.customerId !== 'string') {
        errors.push('customerId is required and must be a string');
      } else if (!store.customers.get(body.customerId)) {
        errors.push(`customer with id ${body.customerId} does not exist`);
      }

      if (!Array.isArray(body.items) || body.items.length === 0) {
        errors.push('items must be a non-empty array of { productId, quantity }');
      } else {
        body.items.forEach((item, idx) => {
          if (!item.productId || typeof item.productId !== 'string') {
            errors.push(`items[${idx}].productId is required`);
          } else if (!store.products.get(item.productId)) {
            errors.push(`items[${idx}]: product with id ${item.productId} does not exist`);
          }
          if (typeof item.quantity !== 'number' || item.quantity <= 0) {
            errors.push(`items[${idx}].quantity must be a positive number`);
          }
        });
      }

      span.setAttribute('validation.error_count', errors.length);
      return errors;
    } finally {
      span.end();
    }
  });
}

router.get('/', (req, res) => {
  const { status, customerId } = req.query;
  let results = store.orders.all();

  if (status) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }
    results = results.filter((o) => o.status === status);
  }
  if (customerId) {
    results = results.filter((o) => o.customerId === customerId);
  }

  res.json({ count: results.length, data: results });
});

router.get('/:id', (req, res) => {
  const order = store.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = validateOrderPayload(body);
  if (errors.length) return res.status(400).json({ errors });

  const total = computeTotal(body.items);
  const order = store.orders.create({
    customerId: body.customerId,
    items: body.items,
    status: 'pending',
    total: Number(total.toFixed(2)),
    createdAt: new Date().toISOString(),
  });

  res.status(201).json(order);
});

router.patch('/:id/status', (req, res) => {
  const order = store.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowedNext.includes(status)) {
    return res.status(409).json({
      error: `cannot transition order from '${order.status}' to '${status}'`,
      allowedNext,
    });
  }

  const updated = store.orders.update(req.params.id, { status });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const order = store.orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status === 'shipped') {
    return res.status(409).json({ error: 'cannot delete an order that has already shipped' });
  }

  store.orders.delete(req.params.id);
  res.status(204).send();
});

module.exports = router;
