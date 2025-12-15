import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { appendEvent, getProject, setProjectStatus } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import { validateOpenFunding } from "@/lib/creator/validation";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (project.status !== "DRAFT") {
    return NextResponse.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }

  const validation = validateOpenFunding(project);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, errors: validation.errors }, { status: 400 });
  }

  const publishedAt = new Date().toISOString();
  const result = setProjectStatus(id, session.address, "ACTIVE", { publishedAt });
  if (!result.ok) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  appendEvent(id, "FUNDING_OPENED", session.address);
  return NextResponse.json({
    ok: true,
    status: result.project.status,
    contract: result.project.funding.contractAddress,
  });
}

