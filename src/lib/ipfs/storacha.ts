// Server-only helper to pin JSON snapshots to IPFS via Storacha.
//
// This follows the "bring your own delegations" flow:
// - STORACHA_KEY (or KEY): agent private key (ed25519)
// - STORACHA_PROOF (or PROOF): base64 delegation proof
//
// References:
// - w3up server usage example (KEY + PROOF + StoreMemory)
// - Storacha docs show the same pattern and that in Node you can create File from Buffer.

import path from "node:path";
import fs from "node:fs/promises";
import { Blob } from "buffer";

export type PinResult = {
  cid: string;
  ipfsUri: string; // ipfs://<cid>
  gatewayUrl?: string; // https://<cid>.ipfs.<gateway>
};

let storachaClientPromise: Promise<import("@storacha/client").Client> | null = null;

async function resolveProofString(): Promise<string> {
  const fromEnv = process.env.STORACHA_PROOF ?? process.env.PROOF;
  if (fromEnv?.trim()) return fromEnv.trim();

  const fromEnvPath = process.env.STORACHA_PROOF_PATH ?? process.env.PROOF_PATH;
  const cwd = process.cwd();
  const candidatePaths = [
    fromEnvPath,
    path.join(cwd, "storacha-proof.txt"),
    // Monorepo convenience: cover both "run from repo root" and "run from app dir".
    path.join(cwd, "kaprika-id-ui", "storacha-proof.txt"),
    path.join(cwd, "observer-system", "storacha-proof.txt"),
    path.join(cwd, "..", "kaprika-id-ui", "storacha-proof.txt"),
    path.join(cwd, "..", "observer-system", "storacha-proof.txt"),
  ].filter((p): p is string => Boolean(p && p.trim()));

  const tried: string[] = [];
  for (const proofPath of candidatePaths) {
    tried.push(proofPath);
    try {
      const proofStr = (await fs.readFile(proofPath, "utf8")).trim();
      if (proofStr) return proofStr;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? (err as any).code : null;
      if (code !== "ENOENT") throw err;
    }
  }

  throw new Error(
    `Missing STORACHA_PROOF/PROOF. Set it as an env var, set STORACHA_PROOF_PATH, or create storacha-proof.txt (tried: ${tried.join(
      ", "
    )}).`
  );
}

async function getStorachaClient() {
  if (storachaClientPromise) return storachaClientPromise;

  // Dynamic imports keep the client bundle clean and let the repo compile
  // even if someone hasn't installed Storacha yet (route will error at runtime).
  storachaClientPromise = (async () => {
    const Client = await import("@storacha/client");
    const { StoreMemory } = await import("@storacha/client/stores/memory");
    const Proof = await import("@storacha/client/proof");
    const { Signer } = await import("@storacha/client/principal/ed25519");

    const key = (process.env.STORACHA_KEY ?? process.env.KEY)?.trim();
    if (!key) throw new Error("Missing STORACHA_KEY (or KEY)");

    const proofStr = await resolveProofString();

    const principal = Signer.parse(key);
    const store = new StoreMemory();
    const client = await Client.create({ principal, store });

    const proof = await Proof.parse(proofStr);
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    return client;
  })();

  return storachaClientPromise;
}

export async function pinJsonToIpfs(filename: string, data: unknown): Promise<PinResult> {
  const client = await getStorachaClient();

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([Buffer.from(json)], { type: "application/json" });

  const cid = String(await client.uploadFile(blob as any));
  const ipfsUri = `ipfs://${cid}`;

  const gatewayHost = process.env.STORACHA_GATEWAY_HOST?.trim();
  const gatewayUrl = gatewayHost ? `https://${cid}.ipfs.${gatewayHost}` : undefined;

  return { cid, ipfsUri, gatewayUrl };
}
