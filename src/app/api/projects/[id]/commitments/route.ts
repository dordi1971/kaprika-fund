import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProject, updateCommitments } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import type { Commitment } from "@/lib/creator/types";

type Body = {
  ifMatchVersion?: number;
  items?: Commitment[];
};

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  const items = body?.items;
  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: "INVALID_ITEMS" }, { status: 400 });
  }
  if (items.length > 5) return NextResponse.json({ error: "TOO_MANY" }, { status: 400 });

  const result = updateCommitments(id, session.address, items, body?.ifMatchVersion);
  if (!result.ok) {
    if (result.status === 409) return NextResponse.json({ error: "CONFLICT", project: result.project }, { status: 409 });
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: result.status });
  }

  return NextResponse.json({ project: result.project });
}

