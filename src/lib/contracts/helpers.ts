import { parseUnits } from "viem";

export function isHexAddress(v: string | null | undefined): v is `0x${string}` {
  return typeof v === "string" && /^0x[a-fA-F0-9]{40}$/.test(v);
}

/**
 * Interpret a YYYY-MM-DD date as the end of that day in UTC (23:59:59).
 */
export function dateToDeadlineUnixSeconds(isoDate: string): bigint {
  // Expecting "YYYY-MM-DD".
  const [y, m, d] = isoDate.split("-").map((x) => Number(x));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) throw new Error("INVALID_DATE");
  const ms = Date.UTC(y, m - 1, d, 23, 59, 59, 0);
  if (!Number.isFinite(ms)) throw new Error("INVALID_DATE");
  return BigInt(Math.floor(ms / 1000));
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

export function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("DIV_BY_ZERO");
  return (a + b - 1n) / b;
}

/**
 * Default release schedule:
 * - 20% immediately
 * - the rest split across commitments (milestones)
 *
 * Returns basis points that sum to 10000.
 */
export function defaultReleaseBps(commitmentsCount: number): number[] {
  const n = Math.max(0, Math.min(5, commitmentsCount));
  if (n === 0) return [10000];

  const first = 2000;
  const remaining = 10000 - first;
  const base = Math.floor(remaining / n);
  const out = [first];
  let acc = first;
  for (let i = 0; i < n; i++) {
    const v = i === n - 1 ? 10000 - acc : base;
    out.push(v);
    acc += v;
  }
  return out;
}

export function daysToSeconds(days: number): bigint {
  const d = Math.max(1, Math.floor(days));
  return BigInt(d) * 86400n;
}
