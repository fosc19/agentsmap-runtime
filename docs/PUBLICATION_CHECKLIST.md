# Publication checklist

Before making this repository public, verify:

- [ ] `.env` is not committed.
- [ ] No private RPC URLs, tokens or API keys are present.
- [ ] No private server/IP/deployment-specific scripts are present.
- [ ] No raw production datasets are present.
- [ ] Demo data is synthetic.
- [ ] Production worker logic is not included.
- [ ] `npm install` completes locally.
- [ ] `npm run typecheck` passes locally.
- [ ] `npm run build` passes locally.
- [ ] `npm run db:up && npm run db:migrate && npm run seed:demo` works.

Recommended GitHub description:

> Source-available portfolio demo for real-time agent-economy observability: PostgreSQL data model, Fastify API, synthetic activity worker and React 3D network map.

Recommended topics:

`ai-agents`, `agent-economy`, `x402`, `fastify`, `postgresql`, `typescript`, `react`, `vite`, `data-pipelines`, `observability`, `automation`, `sse`, `web3`.
