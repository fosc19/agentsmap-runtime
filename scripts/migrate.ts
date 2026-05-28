import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { pool, closePool } from "../packages/db/src/client.js";

dotenv.config();

async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve("packages/db/src/migrations");
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const id = file;

    const alreadyApplied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1",
      [id]
    );

    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      console.log(`skip ${id}`);
      continue;
    }

    console.log(`apply ${id}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Migrations complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
