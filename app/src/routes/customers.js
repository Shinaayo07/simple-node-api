const express = require('express');
const store = require('../store');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidCustomerPayload(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
  }
  if (!partial || body.email !== undefined) {
    if (typeof body.email !== 'string' || !EMAIL_RE.test(body.email)) {
      errors.push('email is required and must be a valid email address');
    }
  }
  return errors;
}

router.get('/', (req, res) => {
  const { search } = req.query;
  let results = store.customers.all();

  if (search) {
    const term = String(search).toLowerCase();
    results = results.filter(
      (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
    );
  }

  res.json({ count: results.length, data: results });
});

router.get('/:id', (req, res) => {
  const customer = store.customers.get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = isValidCustomerPayload(body);
  if (errors.length) return res.status(400).json({ errors });

  const emailExists = store.customers.all().some((c) => c.email === body.email);
  if (emailExists) return res.status(409).json({ error: 'Email already in use' });

  const customer = store.customers.create({ name: body.name, email: body.email });
  res.status(201).json(customer);
});

router.put('/:id', (req, res) => {
  const body = req.body || {};
  const errors = isValidCustomerPayload(body);
  if (errors.length) return res.status(400).json({ errors });

  const updated = store.customers.update(req.params.id, { name: body.name, email: body.email });
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json(updated);
});

router.patch('/:id', (req, res) => {
  const body = req.body || {};
  const errors = isValidCustomerPayload(body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const updated = store.customers.update(req.params.id, body);
  if (!updated) return res.status(404).json({ error: 'Customer not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const existed = store.customers.delete(req.params.id);
  if (!existed) return res.status(404).json({ error: 'Customer not found' });
  res.status(204).send();
});

module.exports = router;
