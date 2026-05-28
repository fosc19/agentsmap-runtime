import { Pool } from "pg";

const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/agentmap";

export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export const pool = new Pool({
  connectionString: getDatabaseUrl()
});

export async function closePool(): Promise<void> {
  await pool.end();
}
