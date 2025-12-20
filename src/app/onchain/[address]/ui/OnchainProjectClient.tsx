"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { KaprikaProjectAbi, ERC20Abi } from "@/lib/contracts/abis";
import { POLYGON_CHAIN_ID } from "@/lib/contracts/addresses";
import { isHexAddress } from "@/lib/contracts/helpers";
import { DELIVERABLE_TYPES, FAILURE_CONSEQUENCES, VERIFICATION_METHODS } from "@/lib/commitments";

type Props = { address: string };

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function labelFor(items: ReadonlyArray<{ value: string; label: string }>, value: unknown) {
  const v = typeof value === "string" ? value : null;
  if (!v) return null;
  return items.find((i) => i.value === v)?.label ?? null;
}

function ipfsToGatewayUrl(uri: unknown): string | null {
  const trimmed = cleanText(uri);
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) {
    return `https://w3s.link/ipfs/${trimmed.slice("ipfs://".length)}`;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

function yyyyMmDdFromUnixSeconds(sec: unknown) {
  try {
    const s = typeof sec === "bigint" ? sec : typeof sec === "number" ? BigInt(sec) : null;
    if (!s || s <= 0n) return null;
    const ms = Number(s) * 1000;
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function humanState(s: bigint | number | undefined) {
  // enum State { FUNDING=0, FAILED=1, ACTIVE=2, COMPLETE=3 }
  switch (Number(s ?? -1)) {
    case 0:
      return "Funding Open";
    case 1:
      return "Failed (Refunds)";
    case 2:
      return "Governance / Tranches";
    case 3:
      return "Complete";
    default:
      return "UNKNOWN";
  }
}

function truncateMiddle(value: string, head = 6, tail = 4) {
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
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
  const [copyValue, setCopyValue] = useState<string | null>(null);

  const enabled = !!projectAddress;

  const { data: creator } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "creator",
    query: { enabled },
  });

  const { data: projectURI } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "projectURI",
    query: { enabled },
  });

  const { data: stampURI } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "stampURI",
    query: { enabled },
  });

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

  const { data: deadlineSec } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "deadline",
    query: { enabled },
  });

  const { data: raised } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "raised",
    query: { enabled },
  });

  const { data: released } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "released",
    query: { enabled },
  });

  const { data: blueMinted } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "blueMinted",
    query: { enabled },
  });

  const { data: state } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "state",
    query: { enabled },
  });

  const { data: maxBlueSupply } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "maxBlueSupply",
    query: { enabled },
  });

  const { data: trancheCount } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "trancheCount",
    query: { enabled },
  });

  const { data: nextTrancheIndex } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "nextTrancheIndex",
    query: { enabled },
  });

  const { data: voteDurationSec } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "voteDuration",
    query: { enabled },
  });

  const { data: quorumBps } = useReadContract({
    address: projectAddress ?? undefined,
    abi: KaprikaProjectAbi,
    functionName: "quorumBps",
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

  const projectGatewayUrl = useMemo(() => ipfsToGatewayUrl(projectURI), [projectURI]);
  const stampGatewayUrl = useMemo(() => ipfsToGatewayUrl(stampURI), [stampURI]);
  const deadline = useMemo(() => yyyyMmDdFromUnixSeconds(deadlineSec), [deadlineSec]);

  const [manifest, setManifest] = useState<any | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);

  useEffect(() => {
    if (!copyValue) return undefined;
    const timer = window.setTimeout(() => setCopyValue(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copyValue]);

  useEffect(() => {
    if (!projectGatewayUrl) {
      setManifest(null);
      setManifestError(null);
      setManifestLoading(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    setManifestLoading(true);
    setManifestError(null);

    fetch(projectGatewayUrl, { method: "GET", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP_${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!alive) return;
        setManifest(json);
      })
      .catch((err: any) => {
        if (!alive) return;
        if (err?.name === "AbortError") return;
        setManifest(null);
        setManifestError(err?.message || "Failed to load manifest.");
      })
      .finally(() => {
        if (!alive) return;
        setManifestLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, [projectGatewayUrl]);

  const manifestTitle = cleanText(manifest?.title) ?? cleanText(manifest?.name);
  const manifestCategory = cleanText(manifest?.category) ?? cleanText(manifest?.core?.category);
  const manifestDefinition = cleanText(manifest?.definition) ?? cleanText(manifest?.core?.definition);
  const manifestDeliverableExample =
    cleanText(manifest?.deliverableExample) ?? cleanText(manifest?.core?.deliverableExample);
  const manifestExplanation = cleanText(manifest?.explanation) ?? cleanText(manifest?.core?.explanation);

  const manifestCommitments: any[] = Array.isArray(manifest?.commitments) ? manifest.commitments : [];
  const manifestExternalLinks: any[] = Array.isArray(manifest?.externalLinks) ? manifest.externalLinks : [];
  const manifestFunding = manifest && typeof manifest === "object" ? (manifest as any).funding : null;
  const manifestMilestonePlan = manifestFunding && typeof manifestFunding === "object" ? (manifestFunding as any).milestonePlan : null;

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
    if (Number(state ?? -1) !== 0) {
      setError("Funding is not open for this project.");
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
      <div className="container onchainPage">
        <h1 className="h1">On-chain project</h1>
        <p className="muted">Invalid address: {address}</p>
      </div>
    );
  }

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setCopyValue(value);
        return;
      }
    } catch {
      // ignore and fall back
    }

    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopyValue(value);
    } catch {
      // ignore
    }
  };

  const renderCopyValue = (value: string | null) => {
    const raw = (value ?? "").trim();
    const display = raw ? truncateMiddle(raw) : "---";
    return (
      <span className="onchainInfoValue">
        <span className="mono onchainTruncate" title={raw || undefined}>
          {display}
        </span>
        {raw ? (
          <button type="button" className="copyBtn" onClick={() => void copyText(raw)}>
            {copyValue === raw ? "Copied" : "Copy"}
          </button>
        ) : null}
      </span>
    );
  };

  const renderCopyRow = (label: string, value: string | null) => {
    const raw = (value ?? "").trim();
    return (
      <div className="muted onchainInfoRow">
        <span>{label}</span>
        {renderCopyValue(raw ? raw : null)}
      </div>
    );
  };

  return (
    <div className="container onchainPage">
      <h1 className="h1">On-chain project</h1>
      <div style={{ marginTop: 6 }}>{renderCopyRow("Contract", projectAddress)}</div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardInner">
          <div className="muted num" style={{ fontSize: 12, marginBottom: 10 }}>
            Project manifest (IPFS)
          </div>

          {projectGatewayUrl ? (
            <div className="muted" style={{ marginBottom: 10 }}>
              <a className="highlight" href={projectGatewayUrl} target="_blank" rel="noreferrer">
                Open manifest JSON
              </a>
            </div>
          ) : (
            <div className="muted" style={{ marginBottom: 10 }}>
              No `projectURI` available yet.
            </div>
          )}

          {manifestLoading ? <div className="muted">Loading…</div> : null}
          {manifestError ? (
            <div className="muted" style={{ color: "#ff9b9b" }}>
              Failed to load manifest: {manifestError}
            </div>
          ) : null}

          {projectGatewayUrl && !manifestLoading && !manifestError && manifest ? (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>{manifestTitle ?? "Untitled project"}</h2>
              <div className="projectCat" style={{ marginBottom: 14 }}>
                {manifestCategory ?? "UNKNOWN"}
              </div>

              {manifestDefinition ? (
                <div style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>{manifestDefinition}</div>
              ) : (
                <div className="muted" style={{ marginBottom: 14 }}>
                  No definition in manifest.
                </div>
              )}

              {manifestDeliverableExample ? (
                <div className="callout" style={{ whiteSpace: "pre-wrap", marginBottom: 14 }}>
                  <span className="kvKey" style={{ marginBottom: 6 }}>
                    Example deliverable
                  </span>
                  {manifestDeliverableExample}
                </div>
              ) : null}

              {manifestExplanation ? (
                <details className="details">
                  <summary>Explanation</summary>
                  <div className="detailsContent" style={{ whiteSpace: "pre-wrap" }}>
                    {manifestExplanation}
                  </div>
                </details>
              ) : null}

              {manifestExternalLinks.length ? (
                <div style={{ marginTop: 16 }}>
                  <div className="kvKey" style={{ marginBottom: 10 }}>
                    External links
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {manifestExternalLinks.map((l, idx) => {
                      const url = cleanText(l?.url);
                      const label = cleanText(l?.label) ?? url ?? "Link";
                      const type = cleanText(l?.type);
                      if (!url) return null;
                      return (
                        <div key={`${url}-${idx}`} className="muted">
                          {type ? <span className="projectCat">{type}</span> : null}{" "}
                          <a className="highlight" href={url} target="_blank" rel="noreferrer">
                            {label}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {manifestFunding ? (
                <div style={{ marginTop: 18 }}>
                  <div className="kvKey" style={{ marginBottom: 10 }}>
                    Funding snapshot (manifest)
                  </div>
                  <div className="kvGrid">
                    <div className="kv">
                      <span className="kvKey">Target</span>
                      <span className="kvValue">{cleanText(manifestFunding?.target) ?? "—"}</span>
                    </div>
                    <div className="kv">
                      <span className="kvKey">Deadline</span>
                      <span className="kvValue">{cleanText(manifestFunding?.deadline) ?? "—"}</span>
                    </div>

                    <div className="kv">
                      <span className="kvKey">Release model</span>
                      <span className="kvValue">{cleanText(manifestFunding?.releaseModel) ?? "—"}</span>
                    </div>
                  </div>
                  {manifestMilestonePlan && Array.isArray(manifestMilestonePlan?.milestones) ? (
                    <div style={{ marginTop: 12 }}>
                      <div className="kvKey" style={{ marginBottom: 6 }}>
                        Milestone plan
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                        Initial tranche: {Number(manifestMilestonePlan?.initialPercent ?? 0)}%
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {manifestMilestonePlan.milestones.map((m: any, idx: number) => (
                          <div key={`${idx}-${String(m?.name ?? "")}`} className="muted">
                            {idx + 1}. {cleanText(m?.name) ?? `Milestone ${idx + 1}`} — {Number(m?.percent ?? 0)}%
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {manifestCommitments.length ? (
                <div style={{ marginTop: 18 }}>
                  <div className="kvKey" style={{ marginBottom: 10 }}>
                    Commitments
                  </div>
                  <table className="commitTable onchainCommitTable">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Deliverable</th>
                        <th>Deadline</th>
                        <th>Verification</th>
                        <th>If it fails</th>
                      </tr>
                    </thead>
                    <tbody>
                      {manifestCommitments.map((c, idx) => {
                        const deliverableLabel =
                          labelFor(DELIVERABLE_TYPES, c?.deliverableType) ?? cleanText(c?.deliverableType) ?? "—";
                        const details = cleanText(c?.details);

                        const verifyLabel =
                          labelFor(VERIFICATION_METHODS, c?.verificationMethod) ??
                          cleanText(c?.verificationMethod) ??
                          "—";
                        const verifyDetails = cleanText(c?.verificationDetails);

                        const failLabel =
                          labelFor(FAILURE_CONSEQUENCES, c?.failureConsequence) ??
                          cleanText(c?.failureConsequence) ??
                          "—";

                        const refundPercent =
                          typeof c?.refundPercent === "number" && Number.isFinite(c.refundPercent) ? c.refundPercent : null;
                        const voteDurationDays =
                          typeof c?.voteDurationDays === "number" && Number.isFinite(c.voteDurationDays)
                            ? c.voteDurationDays
                            : null;

                        return (
                          <tr key={`${idx}-${deliverableLabel}`}>
                            <td className="muted num" data-label="#">
                              {idx + 1}
                            </td>
                            <td data-label="Deliverable">
                              {deliverableLabel}
                              {details ? <div className="muted" style={{ marginTop: 6 }}>{details}</div> : null}
                            </td>
                            <td className="num" data-label="Deadline">
                              {cleanText(c?.deadline) ?? "—"}
                            </td>
                            <td data-label="Verification">
                              {verifyLabel}
                              {verifyDetails ? (
                                <div className="muted" style={{ marginTop: 6 }}>
                                  {verifyDetails}
                                </div>
                              ) : null}
                            </td>
                            <td data-label="If it fails">
                              {failLabel}
                              {cleanText(c?.failureConsequence) === "PARTIAL_REFUND" && refundPercent != null ? (
                                <div className="muted" style={{ marginTop: 6 }}>
                                  Refund: {refundPercent}%
                                </div>
                              ) : null}
                              {cleanText(c?.failureConsequence) === "DEADLINE_EXTENSION_VOTE" && voteDurationDays != null ? (
                                <div className="muted" style={{ marginTop: 6 }}>
                                  Vote duration: {voteDurationDays} days
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {chainId !== POLYGON_CHAIN_ID ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="cardInner">
            <div className="small">Wrong network</div>
            <div className="muted">Switch to Polygon (chainId {POLYGON_CHAIN_ID}).</div>
          </div>
        </div>
      ) : null}

      <div className="grid2 onchainBottom" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="cardInner">
            <div className="small">State</div>
            <div className="h2" style={{ marginTop: 8 }}>
              {humanState(state)}
            </div>
            <div className="kvGrid onchainStats" style={{ marginTop: 12 }}>
              <div className="kv">
                <span className="kvKey">Accepted token</span>
                <div className="kvValue muted">
                  {renderCopyValue(typeof acceptedToken === "string" ? acceptedToken : null)}
                </div>
              </div>
              <div className="kv">
                <span className="kvKey">Stamp price</span>
                <span className="kvValue muted">
                  <span className="mono">{stampPrice ? formatUnits(stampPrice, decimals) : "…"}</span> {symbol}
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Raised / Target</span>
                <span className="kvValue muted">
                  <span className="mono">{raised ? formatUnits(raised, decimals) : "…"}</span> /{" "}
                  <span className="mono">{targetAmount ? formatUnits(targetAmount, decimals) : "…"}</span> {symbol}
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Creator</span>
                <div className="kvValue muted">{renderCopyValue(typeof creator === "string" ? creator : null)}</div>
              </div>
              <div className="kv">
                <span className="kvKey">Deadline</span>
                <span className="kvValue muted">
                  <span className="mono">{deadline ?? "…"}</span>
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Released</span>
                <span className="kvValue muted">
                  <span className="mono">{released ? formatUnits(released, decimals) : "…"}</span> {symbol}
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Blue minted / Max</span>
                <span className="kvValue muted">
                  <span className="mono">{String(blueMinted ?? "…")}</span> /{" "}
                  <span className="mono">{String(maxBlueSupply ?? "…")}</span>
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Tranches (next / total)</span>
                <span className="kvValue muted">
                  <span className="mono">{String(nextTrancheIndex ?? "…")}</span> /{" "}
                  <span className="mono">{String(trancheCount ?? "…")}</span>
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Vote duration</span>
                <span className="kvValue muted">
                  <span className="mono">{String(voteDurationSec ?? "…")}</span> sec
                </span>
              </div>
              <div className="kv">
                <span className="kvKey">Quorum</span>
                <span className="kvValue muted">
                  <span className="mono">{String(quorumBps ?? "…")}</span> bps
                </span>
              </div>
            </div>
            {stampGatewayUrl ? (
              <div className="muted" style={{ marginTop: 10 }}>
                <a className="highlight" href={stampGatewayUrl} target="_blank" rel="noreferrer">
                  Open stamp JSON
                </a>
              </div>
            ) : null}
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
              disabled={!isConnected || !!busy || Number(state ?? -1) !== 0}
            >
              {busy ?? "Approve & Buy"}
            </button>

            {error ? (
              <div className="muted" style={{ marginTop: 12, color: "#ff9b9b" }}>
                {error}
              </div>
            ) : null}

            {lastHash ? (
              <div style={{ marginTop: 12 }}>{renderCopyRow("Last tx", lastHash)}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
