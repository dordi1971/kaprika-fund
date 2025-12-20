import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";

import { KaprikaProjectAbi, KaprikaProjectFactoryAbi, Erc20Abi } from "@/lib/contracts/abis";
import { KAPRIKA_FACTORY_ADDRESS } from "@/lib/contracts/addresses";
import { isHexAddress } from "@/lib/contracts/helpers";

import type { DeskLatestProposal, DeskProject, DeskPosition } from "@/lib/desk/types";

const BLUE_ID = 1n;

function envInt(key: string, fallback: number) {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function ipfsToGatewayUrl(uri: unknown): string | null {
  const trimmed = cleanText(uri);
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) return `https://w3s.link/ipfs/${trimmed.slice("ipfs://".length)}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}


function timeRemainingLabelFromUnixSeconds(deadlineSec: bigint) {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const delta = deadlineSec - nowSec;
  if (delta <= 0n) return "Ended";

  const total = Number(delta);
  if (!Number.isFinite(total)) return "—";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  const mins = Math.floor((total % 3600) / 60);
  return `${mins}m`;
}

function badgeClassForState(state: number): string {
  // enum State { FUNDING=0, FAILED=1, ACTIVE=2, COMPLETE=3 }
  switch (state) {
    case 0:
      return "badgeActive";
    case 1:
      return "badgeFailed";
    case 2:
      return "badgeActive";
    case 3:
      return "badgeCompleted";
    default:
      return "";
  }
}

function labelForState(state: number): string {
  switch (state) {
    case 0:
      return "Funding Open";
    case 1:
      return "Failed";
    case 2:
      return "Governance";
    case 3:
      return "Complete";
    default:
      return "UNKNOWN";
  }
}

function trimFormattedUnits(v: bigint, decimals: number): string {
  const s = formatUnits(v, decimals);
  const [a, b] = s.split(".");
  if (!b) return a;
  const t = b.replace(/0+$/, "");
  return t.length ? `${a}.${t}` : a;
}

function formatTimeRemaining(deadlineSec: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadlineSec <= now) return "0s";
  const diff = deadlineSec - now;
  const days = diff / 86400n;
  const hrs = (diff % 86400n) / 3600n;
  if (days > 0n) return `${days}d ${hrs}h`;
  const mins = (diff % 3600n) / 60n;
  if (hrs > 0n) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function yyyyMmDdFromUnixSeconds(sec: bigint) {
  if (sec <= 0n) return "—";
  const ms = Number(sec) * 1000;
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchManifestMeta(projectURI: string | null) {
  const url = ipfsToGatewayUrl(projectURI);
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "GET",
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const title = cleanText(json?.title) ?? cleanText(json?.name) ?? null;
    const category = cleanText(json?.category) ?? cleanText(json?.core?.category) ?? null;
    const description = cleanText(json?.description) ?? cleanText(json?.core?.explanation) ?? null;
    return { title, category, description };
  } catch {
    return null;
  }
}

/**
 * Desk data loader (Phase 1)
 * 1) Enumerate all project IDs from the factory
 * 2) Membership scan (creator, balanceOf(BLUE), lockedBlue)
 * 3) For owned projects only: read table fields + latest proposal info
 */
export async function getOnchainDeskProjects(wallet: string): Promise<DeskProject[]> {
  const factory = KAPRIKA_FACTORY_ADDRESS;
  if (!isHexAddress(factory) || !isHexAddress(wallet)) return [];

  const rpcUrl = process.env.POLYGON_RPC_URL ?? process.env.NEXT_PUBLIC_POLYGON_RPC_URL;
  const client = createPublicClient({
    chain: polygon,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });

  const multicallProjectsPerBatch = envInt("KAPRIKA_DESK_PROJECT_BATCH", 120);
  const listBatch = envInt("KAPRIKA_DESK_LIST_BATCH", 250);

  // 1) enumerate project addresses
  let n = 0;
  try {
    const nextId = (await client.readContract({
      address: factory,
      abi: KaprikaProjectFactoryAbi,
      functionName: "nextProjectId",
    })) as bigint;
    n = Number(nextId ?? 0n);
  } catch {
    return [];
  }
  if (!Number.isFinite(n) || n <= 0) return [];

  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const pairs: Array<{ projectId: number; projectAddress: `0x${string}` }> = [];

  for (const idChunk of chunk(ids, listBatch)) {
    const calls = idChunk.map((projectId) => ({
      address: factory,
      abi: KaprikaProjectFactoryAbi,
      functionName: "projectById" as const,
      args: [projectId] as const,
    }));
    const res = await client.multicall({ contracts: calls, allowFailure: true });
    res.forEach((r, idx) => {
      const addr = (r.status === "success" ? (r.result as any) : null) as `0x${string}` | null;
      if (!addr || !isHexAddress(addr) || addr === "0x0000000000000000000000000000000000000000") return;
      pairs.push({ projectId: Number(idChunk[idx]), projectAddress: addr });
    });
  }

  if (!pairs.length) return [];

  const walletLc = wallet.toLowerCase();

  // 2) membership scan
  const owned: Array<{
    projectId: number;
    projectAddress: `0x${string}`;
    creator: `0x${string}`;
    balance: bigint;
    locked: bigint;
  }> = [];

  for (const pChunk of chunk(pairs, multicallProjectsPerBatch)) {
    const calls = pChunk.flatMap((p) => [
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "creator" as const },
      {
        address: p.projectAddress,
        abi: KaprikaProjectAbi,
        functionName: "balanceOf" as const,
        args: [wallet as `0x${string}`, BLUE_ID] as const,
      },
      {
        address: p.projectAddress,
        abi: KaprikaProjectAbi,
        functionName: "lockedBlue" as const,
        args: [wallet as `0x${string}`] as const,
      },
    ]);

    const res = await client.multicall({ contracts: calls, allowFailure: true });
    for (let i = 0; i < pChunk.length; i++) {
      const creator = res[i * 3 + 0]?.status === "success" ? (res[i * 3 + 0].result as any) : null;
      const balance = res[i * 3 + 1]?.status === "success" ? (res[i * 3 + 1].result as any) : 0n;
      const locked = res[i * 3 + 2]?.status === "success" ? (res[i * 3 + 2].result as any) : 0n;

      const c =
        typeof creator === "string" && isHexAddress(creator)
          ? (creator as `0x${string}`)
          : ("0x0000000000000000000000000000000000000000" as const);
      const b = typeof balance === "bigint" ? balance : BigInt(balance ?? 0);
      const l = typeof locked === "bigint" ? locked : BigInt(locked ?? 0);

      const isCreator = c.toLowerCase() === walletLc;
      if (!isCreator && b <= 0n && l <= 0n) continue;

      owned.push({
        projectId: pChunk[i].projectId,
        projectAddress: pChunk[i].projectAddress,
        creator: c,
        balance: b,
        locked: l,
      });
    }
  }

  if (!owned.length) return [];

  // 3) fetch table fields for owned projects
  const detailsBatch = envInt("KAPRIKA_DESK_DETAILS_BATCH", 100);

  const details: Array<{
    projectId: number;
    projectAddress: `0x${string}`;
    creator: `0x${string}`;
    position: DeskPosition;
    state: number;
    acceptedToken: `0x${string}`;
    targetAmount: bigint;
    raised: bigint;
    deadline: bigint;
    projectURI: string;
    nextProposalId: bigint;
  }> = [];

  for (const oChunk of chunk(owned, detailsBatch)) {
    const calls = oChunk.flatMap((p) => [
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "state" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "acceptedToken" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "targetAmount" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "raised" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "deadline" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "projectURI" as const },
      { address: p.projectAddress, abi: KaprikaProjectAbi, functionName: "nextProposalId" as const },
    ]);
    const res = await client.multicall({ contracts: calls, allowFailure: true });

    for (let i = 0; i < oChunk.length; i++) {
      const offset = i * 7;
      const state = res[offset + 0]?.status === "success" ? Number(res[offset + 0].result as any) : -1;
      const acceptedToken = res[offset + 1]?.status === "success" ? (res[offset + 1].result as any) : null;
      const targetAmount = res[offset + 2]?.status === "success" ? (res[offset + 2].result as any) : 0n;
      const raised = res[offset + 3]?.status === "success" ? (res[offset + 3].result as any) : 0n;
      const deadline = res[offset + 4]?.status === "success" ? (res[offset + 4].result as any) : 0n;
      const projectURI = res[offset + 5]?.status === "success" ? (res[offset + 5].result as any) : "";
      const nextProposalId = res[offset + 6]?.status === "success" ? (res[offset + 6].result as any) : 0n;

      const tokenAddr =
        typeof acceptedToken === "string" && isHexAddress(acceptedToken)
          ? (acceptedToken as `0x${string}`)
          : ("0x0000000000000000000000000000000000000000" as const);

      details.push({
        projectId: oChunk[i].projectId,
        projectAddress: oChunk[i].projectAddress,
        creator: oChunk[i].creator,
        position: {
          isCreator: oChunk[i].creator.toLowerCase() === walletLc,
          blueBalance: oChunk[i].balance.toString(),
          blueLocked: oChunk[i].locked.toString(),
        },
        state,
        acceptedToken: tokenAddr,
        targetAmount: typeof targetAmount === "bigint" ? targetAmount : BigInt(targetAmount ?? 0),
        raised: typeof raised === "bigint" ? raised : BigInt(raised ?? 0),
        deadline: typeof deadline === "bigint" ? deadline : BigInt(deadline ?? 0),
        projectURI: typeof projectURI === "string" ? projectURI : "",
        nextProposalId: typeof nextProposalId === "bigint" ? nextProposalId : BigInt(nextProposalId ?? 0),
      });
    }
  }

  // 4) token meta
  const uniqueTokens = Array.from(new Set(details.map((d) => d.acceptedToken))).filter((a) => isHexAddress(a));
  const tokenMeta = new Map<string, { symbol: string; decimals: number }>();

  for (const tChunk of chunk(uniqueTokens, 60)) {
    const calls = tChunk.flatMap((token) => [
      { address: token, abi: Erc20Abi, functionName: "symbol" as const },
      { address: token, abi: Erc20Abi, functionName: "decimals" as const },
    ]);
    const res = await client.multicall({ contracts: calls, allowFailure: true });
    for (let i = 0; i < tChunk.length; i++) {
      const symbol = res[i * 2 + 0]?.status === "success" ? (res[i * 2 + 0].result as any) : null;
      const decimals = res[i * 2 + 1]?.status === "success" ? Number(res[i * 2 + 1].result as any) : 18;
      tokenMeta.set(tChunk[i], {
        symbol: typeof symbol === "string" && symbol.trim() ? symbol : "TOKEN",
        decimals: Number.isFinite(decimals) ? decimals : 18,
      });
    }
  }

  // 5) latest proposal details
  const proposalTargets = details
    .filter((d) => d.nextProposalId > 0n)
    .map((d) => ({ address: d.projectAddress, id: d.nextProposalId }));

  const latestByProject = new Map<string, DeskLatestProposal>();
  for (const pChunk of chunk(proposalTargets, 120)) {
    const calls = pChunk.map((p) => ({
      address: p.address,
      abi: KaprikaProjectAbi,
      functionName: "proposals" as const,
      args: [p.id] as const,
    }));
    const res = await client.multicall({ contracts: calls, allowFailure: true });
    for (let i = 0; i < pChunk.length; i++) {
      const r = res[i];
      if (r.status !== "success") continue;

      const tup = r.result as any;
      const kind = Number(tup?.[0] ?? tup?.kind ?? 0);
      const trancheIndex = Number(tup?.[1] ?? tup?.trancheIndex ?? 0);
      const to = (tup?.[2] ?? tup?.to ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
      const startTime = BigInt(tup?.[3] ?? tup?.startTime ?? 0);
      const endTime = BigInt(tup?.[4] ?? tup?.endTime ?? 0);
      const forVotes = BigInt(tup?.[5] ?? tup?.forVotes ?? 0);
      const againstVotes = BigInt(tup?.[6] ?? tup?.againstVotes ?? 0);
      const executed = Boolean(tup?.[7] ?? tup?.executed ?? false);
      const paramKey = Number(tup?.[8] ?? tup?.paramKey ?? 0);
      const paramValue = BigInt(tup?.[9] ?? tup?.paramValue ?? 0);

      latestByProject.set(pChunk[i].address, {
        id: pChunk[i].id.toString(),
        kind,
        trancheIndex,
        to,
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        forVotes: forVotes.toString(),
        againstVotes: againstVotes.toString(),
        executed,
        paramKey,
        paramValue: paramValue.toString(),
      });
    }
  }

  // 6) enrich
  const enriched: DeskProject[] = [];
  for (const d of details) {
    const meta = await fetchManifestMeta(d.projectURI);
    const token = tokenMeta.get(d.acceptedToken) ?? { symbol: "TOKEN", decimals: 18 };

    const raisedFmt = trimFormattedUnits(d.raised, token.decimals);
    const targetFmt = trimFormattedUnits(d.targetAmount, token.decimals);


    const progressPct =
    d.targetAmount <= 0n
        ? 0
        : Math.max(
            0,
            Math.min(100, Number((d.raised * 10000n) / (d.targetAmount === 0n ? 1n : d.targetAmount)) / 100)
        );

    const deadline = yyyyMmDdFromUnixSeconds(d.deadline);
    const timeRemaining = d.state === 0 ? timeRemainingLabelFromUnixSeconds(d.deadline) : "—";

    enriched.push({
    projectId: String(d.projectId),
    projectAddress: d.projectAddress,
    creator: d.creator,
    state: d.state,
    stateLabel: labelForState(d.state),
    badgeClass: badgeClassForState(d.state),

    title: meta?.title ?? `Project ${d.projectId}`,
    category: meta?.category ?? "Uncategorized",
    description: meta?.description ?? null,
    projectURI: d.projectURI,
    projectGatewayUrl: ipfsToGatewayUrl(d.projectURI),

    acceptedToken: d.acceptedToken,
    tokenSymbol: token.symbol,
    tokenDecimals: token.decimals,

    raised: raisedFmt,
    target: targetFmt,
    progressPct,
    deadline,
    timeRemaining,

    position: d.position,
    latestProposal: latestByProject.get(d.projectAddress),
    nextProposalId: d.nextProposalId.toString(),    
    });

  }

  enriched.sort((a, b) => (parseInt(b.projectId, 10) || 0) - (parseInt(a.projectId, 10) || 0));
  return enriched;
}
