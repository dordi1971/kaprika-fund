"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { KaprikaProjectAbi, ERC20Abi } from "@/lib/contracts/abis";
import { POLYGON_CHAIN_ID } from "@/lib/contracts/addresses";
import { isHexAddress } from "@/lib/contracts/helpers";

type Props = { address: string };

function humanState(s: bigint | number | undefined) {
  // enum State { FUNDING, ACTIVE, FAILED, COMPLETED }
  switch (Number(s ?? -1)) {
    case 0:
      return "FUNDING";
    case 1:
      return "ACTIVE";
    case 2:
      return "FAILED";
    case 3:
      return "COMPLETED";
    default:
      return "UNKNOWN";
  }
}

export default function OnchainProjectClient({ address }: Props) {
  const projectAddress = useMemo(() => (isHexAddress(address) ? address : null), [address]);
  const chainId = useChainId();
  const { address: user, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [buyAmount, setBuyAmount] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = !!projectAddress;

  const { data: acceptedToken } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "acceptedToken",
    query: { enabled },
  });

  const { data: stampPrice } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "stampPrice",
    query: { enabled },
  });

  const { data: targetAmount } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "targetAmount",
    query: { enabled },
  });

  const { data: raised } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "raised",
    query: { enabled },
  });

  const { data: state } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "state",
    query: { enabled },
  });

  const { data: tokenDecimals } = useReadContract({
    address: (acceptedToken as `0x${string}` | undefined) ?? undefined,
    abi: ERC20Abi,
    functionName: "decimals",
    query: { enabled: !!acceptedToken && isHexAddress(String(acceptedToken)) },
  });

  const { data: tokenSymbol } = useReadContract({
    address: (acceptedToken as `0x${string}` | undefined) ?? undefined,
    abi: ERC20Abi,
    functionName: "symbol",
    query: { enabled: !!acceptedToken && isHexAddress(String(acceptedToken)) },
  });

  const { data: allowance } = useReadContract({
    address: (acceptedToken as `0x${string}` | undefined) ?? undefined,
    abi: ERC20Abi,
    functionName: "allowance",
    args: user && projectAddress ? [user, projectAddress] : undefined,
    query: { enabled: !!user && !!projectAddress && !!acceptedToken },
  });

  const decimals = Number(tokenDecimals ?? 18n);
  const symbol = (tokenSymbol as string | undefined) ?? "TOKEN";

  const buyCost = useMemo(() => {
    const a = Number.parseInt(buyAmount, 10);
    if (!stampPrice || !Number.isFinite(a) || a <= 0) return null;
    return stampPrice * BigInt(a);
  }, [buyAmount, stampPrice]);

  async function approveAndBuy() {
    setError(null);
    if (!publicClient) return;
    if (!projectAddress) return;
    if (!isConnected || !user) {
      setError("Connect your wallet first.");
      return;
    }
    if (chainId !== POLYGON_CHAIN_ID) {
      setError(`Wrong network (need Polygon / ${POLYGON_CHAIN_ID}).`);
      return;
    }
    if (!acceptedToken || !isHexAddress(String(acceptedToken))) {
      setError("acceptedToken() not available yet.");
      return;
    }
    const amt = Number.parseInt(buyAmount, 10);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be a positive integer.");
      return;
    }
    if (!buyCost) {
      setError("Cannot compute cost.");
      return;
    }

    try {
      // 1) Approve if needed
      if (!allowance || allowance < buyCost) {
        setBusy("Approving token spend…");
        const hash1 = await writeContractAsync({
          address: acceptedToken,
          abi: ERC20Abi,
          functionName: "approve",
          args: [projectAddress, buyCost],
        });
        setLastHash(hash1);
        await publicClient.waitForTransactionReceipt({ hash: hash1 });
      }

      // 2) Buy
      setBusy("Buying Blue stamps…");
      const hash2 = await writeContractAsync({
        address: projectAddress,
        abi: KaprikaProjectAbi,
        functionName: "buyBlue",
        args: [BigInt(amt)],
      });
      setLastHash(hash2);
      await publicClient.waitForTransactionReceipt({ hash: hash2 });
      setBusy(null);
    } catch (e: any) {
      setBusy(null);
      setError(e?.shortMessage || e?.message || "Transaction failed.");
    }
  }

  if (!projectAddress) {
    return (
      <div className="container" style={{ maxWidth: 980, padding: "40px 18px" }}>
        <h1 className="h1">On-chain project</h1>
        <p className="muted">Invalid address: {address}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 980, padding: "40px 18px" }}>
      <h1 className="h1">On-chain project</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        Contract: <span className="mono">{projectAddress}</span>
      </p>

      {chainId !== POLYGON_CHAIN_ID ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="cardInner">
            <div className="small">Wrong network</div>
            <div className="muted">Switch to Polygon (chainId {POLYGON_CHAIN_ID}).</div>
          </div>
        </div>
      ) : null}

      <div className="grid2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="cardInner">
            <div className="small">State</div>
            <div className="h2" style={{ marginTop: 8 }}>
              {humanState(state)}
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              Accepted token: <span className="mono">{String(acceptedToken ?? "…")}</span>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Stamp price: <span className="mono">{stampPrice ? formatUnits(stampPrice, decimals) : "…"}</span> {symbol}
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Raised / Target: <span className="mono">{raised ? formatUnits(raised, decimals) : "…"}</span> /{" "}
              <span className="mono">{targetAmount ? formatUnits(targetAmount, decimals) : "…"}</span> {symbol}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardInner">
            <div className="small">Buy Blue stamps</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Amount (stamps)
            </div>
            <input
              className="input"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              inputMode="numeric"
              style={{ marginTop: 8 }}
            />
            <div className="muted" style={{ marginTop: 10 }}>
              Cost: <span className="mono">{buyCost ? formatUnits(buyCost, decimals) : "…"}</span> {symbol}
            </div>

            <button
              className="neutralBtn"
              style={{ marginTop: 14, width: "100%" }}
              onClick={approveAndBuy}
              disabled={!isConnected || !!busy}
            >
              {busy ?? "Approve & Buy"}
            </button>

            {error ? (
              <div className="muted" style={{ marginTop: 12, color: "#ff9b9b" }}>
                {error}
              </div>
            ) : null}

            {lastHash ? (
              <div className="muted" style={{ marginTop: 12 }}>
                Last tx: <span className="mono">{lastHash}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
