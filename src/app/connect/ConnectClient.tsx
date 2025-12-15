"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import WalletButton from "@/components/WalletButton";

export default function ConnectClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next) return null;
    if (!next.startsWith("/")) return null;
    return next;
  }, [searchParams]);

  useEffect(() => {
    setErrorLine(null);
  }, [isConnected, address]);

  useEffect(() => {
    if (!isConnected) return;
    if (working) return;
    let active = true;

    async function maybeContinue() {
      try {
        const res = await fetch("/api/creator/overview", { cache: "no-store" });
        if (!active) return;
        if (res.ok) router.replace(nextPath ?? "/creator");
      } catch {
        // ignore
      }
    }

    maybeContinue();
    return () => {
      active = false;
    };
  }, [isConnected, nextPath, router, working]);

  async function signIn() {
    if (!address) return;
    setWorking(true);
    setErrorLine(null);
    try {
      const nonceRes = await fetch(`/api/auth/nonce?address=${encodeURIComponent(address)}`);
      const nonceJson = (await nonceRes.json()) as { nonce?: string };
      const nonce = nonceJson.nonce;
      if (!nonce) throw new Error("NO_NONCE");

      const signature = await signMessageAsync({ message: nonce });
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, signature, nonce }),
      });

      if (!verifyRes.ok) {
        setErrorLine("We could not verify your signature. Try again.");
        return;
      }

      router.replace(nextPath ?? "/creator");
    } catch {
      setErrorLine("We could not verify your signature. Try again.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Interface</span>
          <h1 className="pageTitle">Connect wallet</h1>
          <p className="muted">Connect a wallet to sign and broadcast actions.</p>

          <div className="card" style={{ background: "var(--surface)" }}>
            <p style={{ marginBottom: 0 }}>
              State:{" "}
              <span className={`badge ${isConnected ? "badgeCompleted" : "badgeDraft"}`}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </p>
            <div className="muted" style={{ marginTop: 10 }}>
              Address: <span className="num">{address ?? "—"}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            {!isConnected ? (
              <WalletButton />
            ) : (
              <button
                type="button"
                className="neutralBtn"
                disabled={working}
                onClick={() => signIn()}
              >
                {working ? "Signing…" : "Sign-in (nonce)"}
              </button>
            )}
            <Link className="ghostBtn" href={nextPath ?? "/observe"}>
              Return
            </Link>
          </div>

          {errorLine ? <p className="muted" style={{ marginTop: 14 }}>{errorLine}</p> : null}
        </section>
      </div>
    </main>
  );
}
