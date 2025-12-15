import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { polygon } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";

const FALLBACK_REOWN_PROJECT_ID = "00000000000000000000000000000000";

export const reownProjectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? FALLBACK_REOWN_PROJECT_ID;

export const isReownConfigured = reownProjectId !== FALLBACK_REOWN_PROJECT_ID;

export const networks = [polygon];

export const wagmiAdapter = new WagmiAdapter({
  ssr: false,
  projectId: reownProjectId,
  networks,
});

const url =
  typeof window !== "undefined" ? window.location.origin : "https://observer-system.local";

export const metadata = {
  name: "Observer System",
  description: "A restrained crowdfunding interface: structure first, narrative second.",
  url,
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

declare global {
  // eslint-disable-next-line no-var
  var __observerSystemAppKitInitialized: boolean | undefined;
}

if (!globalThis.__observerSystemAppKitInitialized) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [polygon],
    projectId: reownProjectId,
    metadata,
    features: {
      analytics: true,
    },
  });

  globalThis.__observerSystemAppKitInitialized = true;
}
