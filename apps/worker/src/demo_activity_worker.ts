import process from "node:process";
import dotenv from "dotenv";
import { pool, closePool } from "../../../packages/db/src/client.js";

dotenv.config();

type DemoTarget = {
  seller_id: string;
  resource_id: string;
  token_address: string;
  payto: string;
  amount_raw: string | null;
};

const POLL_MS = Number(process.env.DEMO_WORKER_POLL_MS ?? "5000");
const PAYERS = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xcccccccccccccccccccccccccccccccccccccccc",
  "0xdddddddddddddddddddddddddddddddddddddddd"
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomTxHash(): string {
  const suffix = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `0x${suffix}`;
}

async function loadTargets(): Promise<DemoTarget[]> {
  const result = await pool.query<DemoTarget>(
    `
      SELECT
        s.id AS seller_id,
        r.id AS resource_id,
        COALESCE(r.asset_address, '0x0000000000000000000000000000000000000000') AS token_address,
        p.payto,
        p.evidence->>'amountRaw' AS amount_raw
      FROM resources r
      JOIN sellers s ON s.id = r.seller_id
      JOIN payto_attribution p ON p.resource_id = r.id
      WHERE p.valid_to IS NULL
      ORDER BY r.created_at ASC
    `
  );
  return result.rows;
}

async function insertDemoPayment(target: DemoTarget): Promise<void> {
  const amountRaw = target.amount_raw ?? String(1000 + Math.floor(Math.random() * 10000));
  const amountDecimal = Number(amountRaw) / 1_000_000;
  const blockNumber = 1000000 + Math.floor(Date.now() / 1000);

  await pool.query(
    `
      INSERT INTO payment_event (
        chain,
        block_number,
        block_hash,
        tx_hash,
        log_index,
        token_address,
        payer,
        payto,
        amount_raw,
        amount_decimal,
        seller_id,
        resource_id,
        assertion_scope,
        confidence,
        observed_at,
        metadata
      )
      VALUES (
        'base',
        $1,
        $2,
        $3,
        0,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        'resource',
        0.800,
        NOW(),
        $11::jsonb
      )
      ON CONFLICT (chain, tx_hash, log_index) DO NOTHING
    `,
    [
      blockNumber,
      randomTxHash(),
      randomTxHash(),
      target.token_address,
      randomItem(PAYERS),
      target.payto,
      amountRaw,
      amountDecimal,
      target.seller_id,
      target.resource_id,
      JSON.stringify({ source: "demo_activity_worker", demo: true })
    ]
  );
}

async function tick(): Promise<void> {
  const targets = await loadTargets();
  if (targets.length === 0) {
    console.log("No demo resources found. Run `npm run seed:demo` first.");
    return;
  }

  const target = randomItem(targets);
  await insertDemoPayment(target);
  console.log(`Inserted synthetic demo payment for resource=${target.resource_id}`);
}

async function main(): Promise<void> {
  console.log(`Starting synthetic demo activity worker. Interval=${POLL_MS}ms`);
  console.log("This worker uses local synthetic data only. It does not call RPC, discovery registries or external production services.");

  await tick();
  const timer = setInterval(() => {
    tick().catch((error) => {
      console.error("Demo worker tick failed", error);
    });
  }, POLL_MS);

  const shutdown = async () => {
    clearInterval(timer);
    await closePool();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
