import { createPublicClient, formatUnits, http } from "viem";
import { polygon } from "viem/chains";

import { KaprikaProjectAbi, KaprikaProjectFactoryAbi, Erc20Abi } from "@/lib/contracts/abis";
import { KAPRIKA_FACTORY_ADDRESS } from "@/lib/contracts/addresses";
import { isHexAddress } from "@/lib/contracts/helpers";

export type OnchainObserverProject = {
  projectId: string;
  projectAddress: `0x${string}`;
  creator: `0x${string}`;
  state: number;
  stateLabel: string;
  badgeClass: string;

  title: string;
  category: string;
  description: string | null;
  projectURI: string;
  projectGatewayUrl: string | null;

  acceptedToken: `0x${string}`;
  tokenSymbol: string;
  tokenDecimals: number;

  raised: string;
  target: string;
  progressPct: number;
  deadline: string; // YYYY-MM-DD
  timeRemaining: string;
};

function envInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number.parseInt(raw, 10);
  return Number.isFinite(v) ? v : fallback;
}

function polygonRpcUrl() {
  return (
    process.env.POLYGON_RPC_URL ??
    process.env.NEXT_PUBLIC_POLYGON_RPC_URL ??
    "https://polygon-rpc.com"
  );
}

function ipfsToGatewayUrl(uri: string): string | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("ipfs://")) {
    return `https://w3s.link/ipfs/${trimmed.slice("ipfs://".length)}`;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

function trimFormattedUnits(value: string, maxFracDigits: number) {
  if (!value.includes(".")) return value;
  const [i, f] = value.split(".");
  const cut = f.slice(0, Math.max(0, maxFracDigits)).replace(/0+$/, "");
  return cut.length ? `${i}.${cut}` : i;
}

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function stateLabelFor(state: number) {
  // enum State { FUNDING=0, FAILED=1, ACTIVE=2, COMPLETE=3 }
  switch (state) {
    case 0:
      return "Funding Open";
    case 1:
      return "Failed (Refunds)";
    case 2:
      return "Governance / Tranches";
    case 3:
      return "Complete";
    default:
      return "Unknown";
  }
}

function badgeClassForState(state: number) {
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
      return "badgeDraft";
  }
}

function yyyyMmDdFromUnixSeconds(sec: bigint) {
  if (sec <= 0n) return "—";
  const ms = Number(sec) * 1000;
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toISOString().slice(0, 10);
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
  if (mins > 0) return `${mins}m`;
  return "<1m";
}

function manifestDescriptionFromJson(json: any): string | null {
  const direct = cleanText(json?.description);
  if (direct) return direct;

  const definition = cleanText(json?.definition) ?? cleanText(json?.core?.definition);
  const explanation = cleanText(json?.explanation) ?? cleanText(json?.core?.explanation);
  if (definition && explanation) return `${definition}\n\n${explanation}`;
  if (definition) return definition;
  if (explanation) return explanation;

  const summary = cleanText(json?.summary) ?? cleanText(json?.tagline);
  if (summary) return summary;

  return null;
}

async function fetchManifestMeta(projectURI: string) {
  const gatewayUrl = ipfsToGatewayUrl(projectURI);
  if (!gatewayUrl) {
    return {
      title: "Untitled project",
      category: "UNKNOWN",
      description: null as string | null,
      gatewayUrl: null as string | null,
    };
  }

  try {
    const res = await fetch(gatewayUrl, {
      method: "GET",
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const json: any = await res.json();
    const title = cleanText(json?.title) ?? "Untitled project";
    const category =
      cleanText(json?.category) ?? cleanText(json?.core?.category) ?? cleanText(json?.attributes?.category) ?? "UNKNOWN";
    const description = manifestDescriptionFromJson(json);
    return { title, category, description, gatewayUrl };
  } catch {
    return { title: "Untitled project", category: "UNKNOWN", description: null as string | null, gatewayUrl };
  }
}

export async function getOnchainObserverIndex(): Promise<OnchainObserverProject[]> {
  const factory = KAPRIKA_FACTORY_ADDRESS;
  if (!isHexAddress(factory) || factory === ("0x0000000000000000000000000000000000000000" as const)) {
    return [];
  }

  const limit = Math.max(1, envInt("KAPRIKA_OBSERVER_LIMIT", 50));
  const client = createPublicClient({ chain: polygon, transport: http(polygonRpcUrl()) });

  const nextProjectId = await client.readContract({
    address: factory,
    abi: KaprikaProjectFactoryAbi,
    functionName: "nextProjectId",
  });

  const n = Number(nextProjectId ?? 0n);
  if (!Number.isFinite(n) || n <= 0) return [];

  const start = Math.max(1, n - limit + 1);
  const ids = Array.from({ length: n - start + 1 }, (_, i) => BigInt(start + i));

  const projectAddrResults = await client.multicall({
    allowFailure: true,
    contracts: ids.map((id) => ({
      address: factory,
      abi: KaprikaProjectFactoryAbi,
      functionName: "projectById" as const,
      args: [id] as const,
    })),
  });

  const idAddressPairs: Array<{ id: bigint; address: `0x${string}` }> = [];
  for (let i = 0; i < ids.length; i++) {
    const r = projectAddrResults[i];
    if (r.status !== "success") continue;
    const a = r.result as unknown;
    if (!isHexAddress(String(a))) continue;
    const addr = a as `0x${string}`;
    if (addr === ("0x0000000000000000000000000000000000000000" as const)) continue;
    idAddressPairs.push({ id: ids[i], address: addr });
  }

  if (!idAddressPairs.length) return [];

  const projectContracts = idAddressPairs.flatMap(({ address }) => {
    const base = { address, abi: KaprikaProjectAbi } as const;
    return [
      { ...base, functionName: "state" as const },
      { ...base, functionName: "creator" as const },
      { ...base, functionName: "acceptedToken" as const },
      { ...base, functionName: "targetAmount" as const },
      { ...base, functionName: "raised" as const },
      { ...base, functionName: "deadline" as const },
      { ...base, functionName: "projectURI" as const },
    ];
  });

  const projectResults = await client.multicall({
    allowFailure: true,
    contracts: projectContracts,
  });

  const FIELDS = 7;
  const rawRows: Array<{
    projectId: bigint;
    projectAddress: `0x${string}`;
    state: number;
    creator: `0x${string}`;
    acceptedToken: `0x${string}`;
    targetAmount: bigint;
    raised: bigint;
    deadline: bigint;
    projectURI: string;
  }> = [];

  for (let i = 0; i < idAddressPairs.length; i++) {
    const baseIndex = i * FIELDS;
    const rState = projectResults[baseIndex + 0];
    const rCreator = projectResults[baseIndex + 1];
    const rToken = projectResults[baseIndex + 2];
    const rTarget = projectResults[baseIndex + 3];
    const rRaised = projectResults[baseIndex + 4];
    const rDeadline = projectResults[baseIndex + 5];
    const rUri = projectResults[baseIndex + 6];

    if (
      rState.status !== "success" ||
      rCreator.status !== "success" ||
      rToken.status !== "success" ||
      rTarget.status !== "success" ||
      rRaised.status !== "success" ||
      rDeadline.status !== "success" ||
      rUri.status !== "success"
    ) {
      continue;
    }

    const creator = rCreator.result as unknown;
    const token = rToken.result as unknown;
    const uri = rUri.result as unknown;

    if (!isHexAddress(String(creator))) continue;
    if (!isHexAddress(String(token))) continue;
    if (typeof uri !== "string") continue;

    rawRows.push({
      projectId: idAddressPairs[i].id,
      projectAddress: idAddressPairs[i].address,
      state: Number(rState.result as any),
      creator: creator as `0x${string}`,
      acceptedToken: token as `0x${string}`,
      targetAmount: BigInt(rTarget.result as any),
      raised: BigInt(rRaised.result as any),
      deadline: BigInt(rDeadline.result as any),
      projectURI: uri,
    });
  }

  const uniqueTokens = Array.from(new Set(rawRows.map((r) => r.acceptedToken.toLowerCase()))).map(
    (a) => a as `0x${string}`
  );

  const tokenResults = await client.multicall({
    allowFailure: true,
    contracts: uniqueTokens.flatMap((token) => [
      { address: token, abi: Erc20Abi, functionName: "symbol" as const },
      { address: token, abi: Erc20Abi, functionName: "decimals" as const },
    ]),
  });

  const tokenMeta = new Map<string, { symbol: string; decimals: number }>();
  for (let i = 0; i < uniqueTokens.length; i++) {
    const rSym = tokenResults[i * 2 + 0];
    const rDec = tokenResults[i * 2 + 1];
    const symbol = rSym.status === "success" && typeof rSym.result === "string" ? rSym.result : "TOKEN";
    const decimalsRaw = rDec.status === "success" ? rDec.result : 18;
    tokenMeta.set(uniqueTokens[i].toLowerCase(), {
      symbol,
      decimals: Number(decimalsRaw ?? 18),
    });
  }

  const manifestMeta = await Promise.all(rawRows.map((r) => fetchManifestMeta(r.projectURI)));

  const out: OnchainObserverProject[] = rawRows
    .map((r, idx) => {
      const meta = tokenMeta.get(r.acceptedToken.toLowerCase()) ?? { symbol: "TOKEN", decimals: 18 };
      const decimals = Number.isFinite(meta.decimals) ? meta.decimals : 18;
      const symbol = meta.symbol;

      const raisedFmt = trimFormattedUnits(formatUnits(r.raised, decimals), 2);
      const targetFmt = trimFormattedUnits(formatUnits(r.targetAmount, decimals), 2);
      const progressPct =
        r.targetAmount <= 0n
          ? 0
          : Math.max(
              0,
              Math.min(100, Number((r.raised * 10000n) / (r.targetAmount === 0n ? 1n : r.targetAmount)) / 100)
            );

      const stateLabel = stateLabelFor(r.state);
      const badgeClass = badgeClassForState(r.state);
      const deadline = yyyyMmDdFromUnixSeconds(r.deadline);
      const timeRemaining = r.state === 0 ? timeRemainingLabelFromUnixSeconds(r.deadline) : "—";

      const manifest = manifestMeta[idx];

      return {
        projectId: r.projectId.toString(),
        projectAddress: r.projectAddress,
        creator: r.creator,
        state: r.state,
        stateLabel,
        badgeClass,

        title: manifest.title,
        category: manifest.category,
        description: manifest.description,
        projectURI: r.projectURI,
        projectGatewayUrl: manifest.gatewayUrl,

        acceptedToken: r.acceptedToken,
        tokenSymbol: symbol,
        tokenDecimals: decimals,

        raised: raisedFmt,
        target: targetFmt,
        progressPct,
        deadline,
        timeRemaining,
      };
    })
    .sort((a, b) => Number(b.projectId) - Number(a.projectId));

  return out;
}
