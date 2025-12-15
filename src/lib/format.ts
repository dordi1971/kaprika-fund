export function formatUsdc(amount: number) {
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
}

export function formatPercent(ratio: number) {
  const value = Math.max(0, Math.min(1, ratio)) * 100;
  return value.toFixed(2);
}

export function shortAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function shortId(id: string) {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-2)}`;
}

