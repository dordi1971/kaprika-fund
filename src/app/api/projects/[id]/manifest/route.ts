import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProject } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import { buildProjectManifest } from "@/lib/creator/manifest";
import { readManifestFromDisk, writeManifestToDisk } from "@/lib/creator/persist";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const existing = readManifestFromDisk(id);
  if (existing) return NextResponse.json({ manifest: existing });

  try {
    const manifest = buildProjectManifest(project);
    writeManifestToDisk(id, manifest);
    return NextResponse.json({ manifest });
  } catch {
    return NextResponse.json({ error: "MANIFEST_BUILD_FAILED" }, { status: 400 });
  }
}

