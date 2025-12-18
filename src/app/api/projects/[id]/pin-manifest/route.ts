import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { requireSessionAddress } from "@/lib/creator/auth";
import { getProject, updateProject } from "@/lib/creator/store";
import { buildProjectManifest } from "@/lib/creator/manifest";
import { pinJsonToIpfs } from "@/lib/ipfs/storacha";
export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const auth = requireSessionAddress(await cookies());
  if (!auth.ok) return auth.response;

  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  if (project.creatorAddress.toLowerCase() !== auth.address.toLowerCase()) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const manifest = buildProjectManifest(project);
    const pinned = await pinJsonToIpfs("project.json", manifest);

    const updated = updateProject(
      id,
      auth.address,
      { funding: { projectURI: pinned.ipfsUri } },
      project.version
    );

    if (!updated.ok) {
      return NextResponse.json({ ok: false, error: "UPDATE_FAILED" }, { status: updated.status });
    }

    return NextResponse.json({
      ok: true,
      project: updated.project,
      projectURI: pinned.ipfsUri,
      cid: pinned.cid,
      gatewayUrl: pinned.gatewayUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "PIN_FAILED";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
