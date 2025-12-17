import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appendEvent, getProject, setProjectStatus, updateProject } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import { validateOpenFunding } from "@/lib/creator/validation";
import { buildProjectManifest } from "@/lib/creator/manifest";
import { writeManifestToDisk } from "@/lib/creator/persist";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;

  const project = getProject(id);
  if (!project) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Prevent reopening / double publish
  if (project.status !== "DRAFT") {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATE", message: "Funding can only be opened from DRAFT." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | {
        contractAddress?: string;
        chainId?: number;
        onchainProjectId?: number;
        txHash?: string;
        acceptedToken?: string;
        projectURI?: string;
        stampURI?: string;
      }
    | null;

  if (!body || typeof body.contractAddress !== "string") {
    return NextResponse.json({ ok: false, error: "MISSING_CONTRACT" }, { status: 400 });
  }

  // Basic sanity checks only (MVP). The creator wallet does the real deployment.
  if (!/^0x[a-fA-F0-9]{40}$/.test(body.contractAddress)) {
    return NextResponse.json({ ok: false, error: "BAD_CONTRACT_ADDRESS" }, { status: 400 });
  }

  // Persist on-chain metadata into the record before we lock it.
  const patch = updateProject(id, session.address, {
    funding: {
      contractAddress: body.contractAddress,
      chainId: typeof body.chainId === "number" ? body.chainId : null,
      onchainProjectId: typeof body.onchainProjectId === "number" ? body.onchainProjectId : null,
      openedTxHash: typeof body.txHash === "string" ? body.txHash : null,
      acceptedToken: typeof body.acceptedToken === "string" ? body.acceptedToken : null,
      projectURI: typeof body.projectURI === "string" ? body.projectURI : null,
      stampURI: typeof body.stampURI === "string" ? body.stampURI : null,
    },
  });

  if (!patch.ok) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  // Validate draft ready (using the updated record)
  const result = validateOpenFunding(patch.project);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400 });
  }

  // Open funding (lock moment)
  const publishedAt = new Date().toISOString();
  const statusResult = setProjectStatus(id, session.address, "ACTIVE", { publishedAt });

  if (!statusResult.ok) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  appendEvent(id, "FUNDING_OPENED", session.address);

  // Generate and persist the immutable IPFS manifest snapshot.
  let manifest: unknown = null;
  try {
    manifest = buildProjectManifest(statusResult.project);
    writeManifestToDisk(id, manifest);
  } catch {
    // non-fatal for MVP
  }

  return NextResponse.json({
    ok: true,
    status: statusResult.project.status,
    contract: statusResult.project.funding?.contractAddress ?? null,
    manifest,
  });
}
