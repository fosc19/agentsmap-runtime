import { createHash } from "node:crypto";

export function stableId(prefix: string, source: string): string {
  const digest = createHash("sha1").update(source).digest("hex").slice(0, 16);
  return `${prefix}_${digest}`;
}
