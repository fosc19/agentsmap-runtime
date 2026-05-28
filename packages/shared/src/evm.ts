export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
export const USDC_DECIMALS = 6;
export const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-f]{40}$/i.test(value.trim());
}

export function isZeroAddress(value: string): boolean {
  return normalizeAddress(value) === ZERO_ADDRESS;
}

export function padAddressTopic(address: string): string {
  return `0x${normalizeAddress(address).replace(/^0x/, "").padStart(64, "0")}`;
}

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

export function bigIntToDecimal(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const integer = value / base;
  const fraction = value % base;
  const fractionString = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionString.length > 0 ? `${integer.toString()}.${fractionString}` : integer.toString();
}

export function canonicalChain(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (value === "base" || value === "eip155:8453" || value === "base-mainnet") {
    return "base-mainnet";
  }
  if (value === "base-sepolia") {
    return "base-sepolia";
  }
  return null;
}
