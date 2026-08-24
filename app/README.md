# Customer API

A simple, production-styled REST API for managing **products**, **customers**, and **orders**, built with Express. It ships with structured logging, Prometheus metrics, and OpenTelemetry distributed tracing out of the box — designed as a realistic reference/assessment app rather than a toy CRUD example.

Data is stored in-memory (no database setup required), but the store module is written behind simple function signatures so it could be swapped for a real database later without changing the route code.

## Features

- **REST resources**: `products`, `customers`, `orders` with full CRUD (where it makes sense)
- **Order lifecycle rules**: orders move through `pending → paid → shipped` or `cancelled`, with invalid transitions rejected (`409 Conflict`)
- **Validation**: required fields, types, and referential checks (e.g. an order can't reference a customer or product that doesn't exist)
- **Structured logging** via [pino](https://getpino.io/), with per-request IDs and pretty-printing in development
- **Prometheus metrics** at `/metrics` (request counts, durations, default Node.js metrics)
- **OpenTelemetry tracing**, exportable to a collector such as Grafana Tempo, with custom spans around key business logic (order validation, total calculation)
- **Health/readiness endpoints** (`/health`, `/ready`) for container orchestrators
- **Graceful shutdown** on `SIGTERM`/`SIGINT`
- Test suite with [Jest](https://jestjs.io/) + [Supertest](https://github.com/ladjs/supertest)

## Requirements

- Node.js **20+**
- npm

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy the example env file and adjust as needed:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description | Default |
   |---|---|---|
   | `PORT` | Port the server listens on | `3000` |
   | `NODE_ENV` | `development`, `production`, or `test` | `development` |
   | `LOG_LEVEL` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `silent` | `info` |
   | `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP HTTP endpoint traces are sent to (e.g. a Tempo collector) | `http://localhost:4318/v1/traces` |
   | `OTEL_SERVICE_NAME` | Service name reported in traces and logs | `customer-api` |
   | `OTEL_TRACES_EXPORTER` | Set to `console` to print spans to stdout instead of exporting them | unset |

   Tracing exporting only requires a reachable OTLP endpoint if you want traces sent somewhere; the app runs fine without one (it will just log an export error, which is harmless locally).

3. **Run the app**

   ```bash
   npm start
   ```

   For local development with auto-restart on file changes:

   ```bash
   npm run dev
   ```

   The server logs its listening port on startup, e.g.:
   ```
   customer-api listening { port: 3000, env: 'development' }
   ```

4. **Verify it's running**

   ```bash
   curl http://localhost:3000/health
   ```

## Running Tests

```bash
npm test
```

This runs the Jest suite with coverage enabled (`jest --coverage`).

## Linting

```bash
npm run lint
```

## API Overview

All resource routes are mounted under `/api`. Responses are JSON.

### Health & Observability

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check — process uptime and status |
| GET | `/ready` | Readiness check |
| GET | `/metrics` | Prometheus metrics in exposition format |

### Products (`/api/products`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List products; supports `?search=`, `?minPrice=`, `?maxPrice=` |
| GET | `/:id` | Get a single product |
| POST | `/` | Create a product (`name`, `price`, optional `stock`) |
| PUT | `/:id` | Full update (all required fields must be provided) |
| PATCH | `/:id` | Partial update |
| DELETE | `/:id` | Delete a product |

### Customers (`/api/customers`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List customers; supports `?search=` (matches name or email) |
| GET | `/:id` | Get a single customer |
| POST | `/` | Create a customer (`name`, `email`) — rejects duplicate emails |
| PUT | `/:id` | Full update |
| PATCH | `/:id` | Partial update |
| DELETE | `/:id` | Delete a customer |

### Orders (`/api/orders`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | List orders; supports `?status=` and `?customerId=` |
| GET | `/:id` | Get a single order |
| POST | `/` | Create an order (`customerId`, `items: [{ productId, quantity }]`) |
| PATCH | `/:id/status` | Transition order status |
| DELETE | `/:id` | Delete an order (blocked once `shipped`) |

**Order status transitions:**

```
pending → paid → shipped
pending → cancelled
paid    → cancelled
```
Any other transition returns `409 Conflict` along with the allowed next statuses.

### Example requests

Create a customer:
```bash
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name": "Ada Lovelace", "email": "ada@example.com"}'
```

Create an order:
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId": "1", "items": [{"productId": "1", "quantity": 2}]}'
```

Advance an order's status:
```bash
curl -X PATCH http://localhost:3000/api/orders/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "paid"}'
```

## Project Structure

```
.
├── src/
│   ├── app.js            # Express app: middleware, routes, metrics, error handling
│   ├── server.js          # Entry point: starts the server, handles graceful shutdown
│   ├── tracing.js         # OpenTelemetry SDK setup (must load before app/express)
│   ├── logger.js          # Pino logger configuration
│   ├── httpLogger.js       # Per-request HTTP logging middleware
│   ├── routes/
│   │   ├── products.js
│   │   ├── customers.js
│   │   └── orders.js
│   └── store/
│       └── index.js       # In-memory data store (seeded with sample data)
├── tests/                 # Jest + Supertest test suites
├── .env.example
├── package.json
└── package-lock.json
```

## Observability Notes

- **Logs** are structured JSON in production (pretty-printed in development), with `trace_id`/`span_id` automatically attached when a request occurs inside a traced span — making it possible to jump from a log line to the corresponding trace.
- **Metrics** are exposed at `/metrics` in Prometheus format, including default Node.js process metrics plus custom `http_request_duration_seconds` and `http_requests_total` counters labeled by method, route, and status code.
- **Traces** are exported via OTLP HTTP (e.g. to Grafana Tempo) and include manual spans around order validation and total calculation, in addition to auto-instrumented HTTP/Express spans.
- Health-check and metrics-scrape traffic (`/health`, `/ready`, `/metrics`) is deliberately excluded from request logs and traces to avoid drowning out real traffic.

## Notes

- Data resets on every process restart since storage is in-memory only — this is intentional for a self-contained assessment app, not a production data layer.
- `NODE_ENV=test` disables OpenTelemetry initialization and silences logging by default, keeping test output clean.

####