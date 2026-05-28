import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { pool, closePool } from "../packages/db/src/client.js";
import { canonicalChain, normalizeAddress } from "../packages/shared/src/evm.js";
import { stableId } from "../packages/shared/src/ids.js";

dotenv.config();

type RawRow = {
  host: string;
  method: string;
  resourceUrl: string;
  networkRaw: string;
  assetAddress: string;
  payto: string;
  amountRaw: string;
};

async function discoverRowsFile(): Promise<string> {
  const demoDir = path.resolve("data/demo");
  const files = (await readdir(demoDir))
    .filter((name) => /^(rows-demo|rows-\d{4}-\d{2}-\d{2})\.tsv$/.test(name))
    .sort((a, b) => a.localeCompare(b));
  if (files.length === 0) {
    throw new Error(`No rows-demo.tsv or rows-YYYY-MM-DD.tsv found in ${demoDir}`);
  }
  return path.join(demoDir, files[files.length - 1]);
}

function parseRows(tsvContent: string): RawRow[] {
  return tsvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [host, method, resourceUrl, networkRaw, assetAddress, payto, amountRaw] = line.split("\t");
      if (!host || !method || !resourceUrl || !networkRaw || !assetAddress || !payto || !amountRaw) {
        throw new Error(`Invalid row format: ${line}`);
      }
      return {
        host,
        method,
        resourceUrl,
        networkRaw,
        assetAddress,
        payto,
        amountRaw
      };
    });
}

async function main(): Promise<void> {
  const rowsFile = process.argv[2] ?? (await discoverRowsFile());
  const rowsContent = await readFile(rowsFile, "utf8");
  const rows = parseRows(rowsContent);

  const filtered = rows.filter((row) => canonicalChain(row.networkRaw) === "base-mainnet");

  const sellers = new Map<string, { id: string; host: string }>();
  const resources = new Map<
    string,
    {
      id: string;
      sellerId: string;
      method: string;
      resourceUrl: string;
      networkRaw: string;
      assetAddress: string;
    }
  >();
  const attributions = new Map<
    string,
    {
      payto: string;
      sellerId: string;
      resourceId: string;
      evidence: Record<string, unknown>;
    }
  >();

  for (const row of filtered) {
    const sellerId = stableId("sel", row.host);
    const resourceId = stableId("res", `${row.method.toUpperCase()} ${row.resourceUrl}`);

    sellers.set(row.host, { id: sellerId, host: row.host });
    resources.set(row.resourceUrl, {
      id: resourceId,
      sellerId,
      method: row.method.toUpperCase(),
      resourceUrl: row.resourceUrl,
      networkRaw: row.networkRaw,
      assetAddress: normalizeAddress(row.assetAddress)
    });

    const payto = normalizeAddress(row.payto);
    const attributionKey = `${payto}|${sellerId}|${resourceId}`;
    attributions.set(attributionKey, {
      payto,
      sellerId,
      resourceId,
      evidence: {
        seededFrom: path.basename(rowsFile),
        amountRaw: row.amountRaw,
        networkRaw: row.networkRaw,
        resourceUrl: row.resourceUrl,
        method: row.method.toUpperCase()
      }
    });
  }

  console.log(
    `Seeding from ${path.relative(process.cwd(), rowsFile)} -> sellers=${sellers.size}, resources=${resources.size}, attributions=${attributions.size}`
  );

  await pool.query("BEGIN");
  try {
    for (const seller of sellers.values()) {
      await pool.query(
        `
          INSERT INTO sellers (id, host)
          VALUES ($1, $2)
          ON CONFLICT (host)
          DO UPDATE SET
            id = EXCLUDED.id,
            updated_at = NOW()
        `,
        [seller.id, seller.host]
      );
    }

    for (const resource of resources.values()) {
      await pool.query(
        `
          INSERT INTO resources (id, seller_id, method, resource_url, network_raw, asset_address)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (resource_url)
          DO UPDATE SET
            seller_id = EXCLUDED.seller_id,
            method = EXCLUDED.method,
            network_raw = EXCLUDED.network_raw,
            asset_address = EXCLUDED.asset_address,
            updated_at = NOW()
        `,
        [
          resource.id,
          resource.sellerId,
          resource.method,
          resource.resourceUrl,
          resource.networkRaw,
          resource.assetAddress
        ]
      );
    }

    for (const item of attributions.values()) {
      await pool.query(
        `
          INSERT INTO payto_attribution (
            payto,
            seller_id,
            resource_id,
            owner_type,
            confidence,
            source,
            evidence
          )
          SELECT $1, $2, $3, 'stable', 0.800, 'demo_seed', $4::jsonb
          WHERE NOT EXISTS (
            SELECT 1
            FROM payto_attribution
            WHERE payto = $1
              AND seller_id = $2
              AND resource_id = $3
              AND source = 'demo_seed'
              AND valid_to IS NULL
          )
        `,
        [item.payto, item.sellerId, item.resourceId, JSON.stringify(item.evidence)]
      );
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
