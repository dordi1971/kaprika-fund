"use client";

import { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { isReownConfigured } from "@/lib/wagmiConfig";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useAppKit();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isConnected && address) {
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button type="button" className="ghostBtn" onClick={() => open()} title="Wallet">
          {shortenAddress(address)}
        </button>
        <button type="button" className="ghostBtn" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="neutralBtn"
      disabled={!isReownConfigured}
      onClick={() => open()}
      title={
        isReownConfigured
          ? "Connect wallet"
          : "Set NEXT_PUBLIC_REOWN_PROJECT_ID to enable wallet connection"
      }
    >
      Connect wallet
    </button>
  );
}

