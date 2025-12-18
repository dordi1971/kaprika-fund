import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@storacha/client",
    "multiformats",
    "@ipld/car",
    "@ucanto/client",
    "@ucanto/transport",
    "@ucanto/transport/car",
  ],
};

export default nextConfig;
