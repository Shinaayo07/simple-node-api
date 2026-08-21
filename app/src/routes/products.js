const express = require('express');
const store = require('../store');

const router = express.Router();

function isValidProductPayload(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      errors.push('name is required and must be a non-empty string');
    }
  }
  if (!partial || body.price !== undefined) {
    if (typeof body.price !== 'number' || body.price < 0) {
      errors.push('price is required and must be a non-negative number');
    }
  }
  if (body.stock !== undefined && (typeof body.stock !== 'number' || body.stock < 0)) {
    errors.push('stock must be a non-negative number');
  }
  return errors;
}

// GET /api/products?search=widget&minPrice=5&maxPrice=20
router.get('/', (req, res) => {
  const { search, minPrice, maxPrice } = req.query;
  let results = store.products.all();

  if (search) {
    const term = String(search).toLowerCase();
    results = results.filter((p) => p.name.toLowerCase().includes(term));
  }
  if (minPrice !== undefined) {
    const min = Number(minPrice);
    if (Number.isNaN(min)) {
      return res.status(400).json({ error: 'minPrice must be a number' });
    }
    results = results.filter((p) => p.price >= min);
  }
  if (maxPrice !== undefined) {
    const max = Number(maxPrice);
    if (Number.isNaN(max)) {
      return res.status(400).json({ error: 'maxPrice must be a number' });
    }
    results = results.filter((p) => p.price <= max);
  }

  res.json({ count: results.length, data: results });
});

router.get('/:id', (req, res) => {
  const product = store.products.get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = isValidProductPayload(body);
  if (errors.length) return res.status(400).json({ errors });

  const product = store.products.create({
    name: body.name,
    price: body.price,
    stock: body.stock ?? 0,
  });
  res.status(201).json(product);
});

// PUT = full replace, requires all required fields
router.put('/:id', (req, res) => {
  const body = req.body || {};
  const errors = isValidProductPayload(body);
  if (errors.length) return res.status(400).json({ errors });

  const updated = store.products.update(req.params.id, {
    name: body.name,
    price: body.price,
    stock: body.stock ?? 0,
  });
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

// PATCH = partial update, only validates fields that are present
router.patch('/:id', (req, res) => {
  const body = req.body || {};
  const errors = isValidProductPayload(body, { partial: true });
  if (errors.length) return res.status(400).json({ errors });

  const updated = store.products.update(req.params.id, body);
  if (!updated) return res.status(404).json({ error: 'Product not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const existed = store.products.delete(req.params.id);
  if (!existed) return res.status(404).json({ error: 'Product not found' });
  res.status(204).send();
});

module.exports = router;
