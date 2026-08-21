// Simple in-memory data store.
//
// This exists to keep the app self-contained for the assessment (no DB setup
// required to run it). In a real production app, this module would be swapped
// for a real database client (Postgres/Mongo/etc.) behind the same function
// signatures, so routes wouldn't need to change.

let products;
let customers;
let orders;
let nextProductId;
let nextCustomerId;
let nextOrderId;

function seed() {
  products = new Map([
    ['1', { id: '1', name: 'Sample Widget', price: 9.99, stock: 100 }],
    ['2', { id: '2', name: 'Sample Gadget', price: 19.99, stock: 50 }],
  ]);

  customers = new Map([
    ['1', { id: '1', name: 'Ada Lovelace', email: 'ada@example.com' }],
    ['2', { id: '2', name: 'Grace Hopper', email: 'grace@example.com' }],
  ]);

  orders = new Map();

  nextProductId = 3;
  nextCustomerId = 3;
  nextOrderId = 1;
}

// Initialize on first load
seed();

module.exports = {
  products: {
    all: () => Array.from(products.values()),
    get: (id) => products.get(id),
    create: (data) => {
      const id = String(nextProductId++);
      const product = { id, ...data };
      products.set(id, product);
      return product;
    },
    update: (id, data) => {
      if (!products.has(id)) return null;
      const updated = { ...products.get(id), ...data, id };
      products.set(id, updated);
      return updated;
    },
    delete: (id) => products.delete(id),
  },
  customers: {
    all: () => Array.from(customers.values()),
    get: (id) => customers.get(id),
    create: (data) => {
      const id = String(nextCustomerId++);
      const customer = { id, ...data };
      customers.set(id, customer);
      return customer;
    },
    update: (id, data) => {
      if (!customers.has(id)) return null;
      const updated = { ...customers.get(id), ...data, id };
      customers.set(id, updated);
      return updated;
    },
    delete: (id) => customers.delete(id),
  },
  orders: {
    all: () => Array.from(orders.values()),
    get: (id) => orders.get(id),
    create: (data) => {
      const id = String(nextOrderId++);
      const order = { id, ...data };
      orders.set(id, order);
      return order;
    },
    update: (id, data) => {
      if (!orders.has(id)) return null;
      const updated = { ...orders.get(id), ...data, id };
      orders.set(id, updated);
      return updated;
    },
    delete: (id) => orders.delete(id),
  },
  // Used by tests to reset state between test files/suites so tests don't
  // leak data into one another.
  reset: seed,
};
