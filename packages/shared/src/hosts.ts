const RESERVED_HOSTS = new Set([
  "localhost",
  "example.com",
  "example.org",
  "example.net"
]);

function normalizeRawHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

export function normalizeHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const raw = normalizeRawHost(value);
  if (!raw || raw.includes("{") || raw.includes("}") || raw.includes(" ")) {
    return null;
  }
  if (raw.startsWith("127.") || raw === "0.0.0.0") {
    return null;
  }
  if (RESERVED_HOSTS.has(raw) || raw.endsWith(".local")) {
    return null;
  }
  if (!raw.includes(".")) {
    return null;
  }
  if (!/^[a-z0-9.-]+$/.test(raw)) {
    return null;
  }

  return raw;
}

export function hostFromUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    return normalizeHost(parsed.hostname);
  } catch {
    return null;
  }
}
