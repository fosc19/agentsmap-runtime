import process from "node:process";
import dotenv from "dotenv";
import Fastify from "fastify";
import { z } from "zod";
import { pool, closePool } from "../../../packages/db/src/client.js";

dotenv.config();

const PORT = Number(process.env.API_PORT ?? "8080");
const HOST = process.env.API_HOST ?? "0.0.0.0";

const app = Fastify({ logger: true });

const LimitQuery = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100)
});

function asNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getSummary() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM sellers)::int AS sellers,
      (SELECT COUNT(*) FROM resources)::int AS resources,
      (SELECT COUNT(*) FROM payto_attribution WHERE valid_to IS NULL)::int AS attributions,
      (SELECT COUNT(*) FROM payment_event)::int AS events,
      (SELECT MAX(observed_at) FROM payment_event) AS last_event_at
  `);
  return result.rows[0] ?? { sellers: 0, resources: 0, attributions: 0, events: 0, last_event_at: null };
}

app.get("/health", async () => {
  const summary = await getSummary();
  return {
    ok: true,
    service: "agentsmap-runtime-demo",
    mode: "synthetic-demo",
    summary
  };
});

app.get("/registry/sellers", async () => {
  const result = await pool.query(`
    SELECT
      s.id,
      s.host,
      s.created_at,
      COUNT(DISTINCT r.id)::int AS resources,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM sellers s
    LEFT JOIN resources r ON r.seller_id = s.id
    LEFT JOIN payment_event pe ON pe.seller_id = s.id
    GROUP BY s.id, s.host, s.created_at
    ORDER BY events DESC, resources DESC, s.host ASC
  `);
  return { sellers: result.rows };
});

app.get("/registry/resources", async () => {
  const result = await pool.query(`
    SELECT
      r.id,
      r.method,
      r.resource_url,
      r.network_raw,
      r.asset_address,
      s.id AS seller_id,
      s.host AS seller_host,
      p.payto,
      p.confidence,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM resources r
    JOIN sellers s ON s.id = r.seller_id
    LEFT JOIN payto_attribution p ON p.resource_id = r.id AND p.valid_to IS NULL
    LEFT JOIN payment_event pe ON pe.resource_id = r.id
    GROUP BY r.id, s.id, s.host, p.payto, p.confidence
    ORDER BY events DESC, r.resource_url ASC
  `);
  return { resources: result.rows };
});

app.get("/live/feed", async (request) => {
  const query = LimitQuery.parse(request.query);
  const result = await pool.query(
    `
      SELECT
        pe.id,
        pe.chain,
        pe.tx_hash,
        pe.payer,
        pe.payto,
        pe.amount_decimal::float AS amount,
        pe.confidence::float AS confidence,
        pe.observed_at,
        s.host AS seller_host,
        r.resource_url,
        r.method,
        pe.metadata
      FROM payment_event pe
      LEFT JOIN sellers s ON s.id = pe.seller_id
      LEFT JOIN resources r ON r.id = pe.resource_id
      ORDER BY pe.observed_at DESC, pe.id DESC
      LIMIT $1
    `,
    [query.limit]
  );
  return { events: result.rows };
});

app.get("/live/nodes", async () => {
  const sellers = await pool.query(`
    SELECT
      'seller:' || s.id AS id,
      s.host AS label,
      'seller' AS type,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM sellers s
    LEFT JOIN payment_event pe ON pe.seller_id = s.id
    GROUP BY s.id, s.host
  `);

  const resources = await pool.query(`
    SELECT
      'resource:' || r.id AS id,
      regexp_replace(r.resource_url, '^https?://', '') AS label,
      'resource' AS type,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM resources r
    LEFT JOIN payment_event pe ON pe.resource_id = r.id
    GROUP BY r.id, r.resource_url
  `);

  const payers = await pool.query(`
    SELECT
      'payer:' || pe.payer AS id,
      left(pe.payer, 10) || '…' AS label,
      'payer' AS type,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM payment_event pe
    GROUP BY pe.payer
  `);

  return { nodes: [...sellers.rows, ...resources.rows, ...payers.rows] };
});

app.get("/live/edges", async () => {
  const sellerResource = await pool.query(`
    SELECT
      'seller:' || s.id AS source,
      'resource:' || r.id AS target,
      'offers' AS type,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM resources r
    JOIN sellers s ON s.id = r.seller_id
    LEFT JOIN payment_event pe ON pe.resource_id = r.id
    GROUP BY s.id, r.id
  `);

  const payerResource = await pool.query(`
    SELECT
      'payer:' || pe.payer AS source,
      'resource:' || pe.resource_id AS target,
      'paid' AS type,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume
    FROM payment_event pe
    WHERE pe.resource_id IS NOT NULL
    GROUP BY pe.payer, pe.resource_id
  `);

  return { edges: [...sellerResource.rows, ...payerResource.rows] };
});

app.get("/map/islands", async () => {
  const result = await pool.query(`
    SELECT
      s.id,
      s.host AS label,
      COUNT(DISTINCT r.id)::int AS resources,
      COUNT(pe.id)::int AS events,
      COALESCE(SUM(pe.amount_decimal), 0)::float AS volume,
      MAX(pe.observed_at) AS last_seen
    FROM sellers s
    LEFT JOIN resources r ON r.seller_id = s.id
    LEFT JOIN payment_event pe ON pe.seller_id = s.id
    GROUP BY s.id, s.host
    ORDER BY events DESC, resources DESC
  `);
  return { islands: result.rows };
});

app.get("/charts/overview", async () => {
  const summary = await getSummary();
  const recent = await pool.query(`
    SELECT date_trunc('minute', observed_at) AS bucket, COUNT(*)::int AS events
    FROM payment_event
    WHERE observed_at > NOW() - INTERVAL '1 hour'
    GROUP BY bucket
    ORDER BY bucket ASC
  `);
  return { summary, recent: recent.rows };
});

app.get("/live/stream", async (request, reply) => {
  const query = z.object({ sinceId: z.coerce.number().int().nonnegative().default(0) }).parse(request.query);
  let sinceId = query.sinceId;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const send = async () => {
    const result = await pool.query(
      `
        SELECT id, tx_hash, payer, payto, amount_decimal::float AS amount, observed_at
        FROM payment_event
        WHERE id > $1
        ORDER BY id ASC
        LIMIT 50
      `,
      [sinceId]
    );

    for (const row of result.rows) {
      sinceId = Math.max(sinceId, asNumber(row.id));
      reply.raw.write(`event: payment\n`);
      reply.raw.write(`data: ${JSON.stringify(row)}\n\n`);
    }
  };

  await send();
  const interval = setInterval(() => {
    send().catch((error) => app.log.error(error));
  }, 3000);

  request.raw.on("close", () => {
    clearInterval(interval);
  });
});

function renderOpsHtml(summary: Record<string, unknown>): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AgentsMap Runtime Demo Ops</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 40px; color: #0f172a; background: #f8fafc; }
    main { max-width: 920px; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }
    .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
    .label { color: #64748b; font-size: 13px; }
    .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>AgentsMap Runtime Demo Ops</h1>
    <p>Portfolio-safe runtime using synthetic local activity only.</p>
    <div class="grid">
      ${Object.entries(summary).map(([key, value]) => `<div class="card"><div class="label">${key}</div><div class="value">${value ?? "—"}</div></div>`).join("")}
    </div>
    <p>Try <code>/live/feed</code>, <code>/live/nodes</code>, <code>/live/edges</code> and <code>/registry/resources</code>.</p>
  </main>
</body>
</html>`;
}

app.get("/ops/map/view", async (_, reply) => {
  const summary = await getSummary();
  reply.type("text/html").send(renderOpsHtml(summary));
});

app.get("/ops/activity/view", async (_, reply) => {
  const summary = await getSummary();
  reply.type("text/html").send(renderOpsHtml(summary));
});

async function start(): Promise<void> {
  await app.listen({ host: HOST, port: PORT });
}

const shutdown = async () => {
  await app.close();
  await closePool();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

start().catch(async (error) => {
  app.log.error(error);
  await closePool();
  process.exit(1);
});
