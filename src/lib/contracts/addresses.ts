// Client-safe chain configuration (NEXT_PUBLIC_* env vars only)

export const POLYGON_CHAIN_ID = 137;

export const KAPRIKA_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_KAPRIKA_FACTORY_ADDRESS as `0x${string}` | undefined) ??
  ("" as `0x${string}`);

export const DEFAULT_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_KAPRIKA_USDC_ADDRESS as `0x${string}` | undefined) ??
  ("" as `0x${string}`);

export const DEFAULT_STAMP_URI = process.env.NEXT_PUBLIC_KAPRIKA_STAMP_URI ?? "";
