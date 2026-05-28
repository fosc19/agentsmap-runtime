# Data pipeline

The public portfolio version uses a synthetic local pipeline that mirrors the shape of the production architecture without publishing the production core.

## 1. Demo resource seed

`data/demo/rows-demo.tsv` defines synthetic sellers, resources, payment addresses and amounts.

`npm run seed:demo` inserts those rows into PostgreSQL as sellers, resources and attribution records.

## 2. Synthetic activity generation

`npm run dev:worker` starts `apps/worker/src/demo_activity_worker.ts`.

The worker periodically inserts synthetic payment events against the demo resources. This makes the API and frontend useful without external services.

## 3. API projection

The Fastify API reads PostgreSQL and exposes:

- live feed endpoints;
- map-ready nodes and edges;
- registry data;
- operational views;
- SSE streams.

## 4. Visualization

The React/Vite frontend consumes API endpoints and renders an activity map.

## Production note

The real production pipeline would include external discovery, on-chain indexing, correlation, classification and enrichment. Those implementation details are intentionally excluded from this public portfolio repository.
