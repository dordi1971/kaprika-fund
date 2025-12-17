import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProject } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import { validateOpenFunding } from "@/lib/creator/validation";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const result = validateOpenFunding(project);

  if (!result.ok) {
    // Keep validate endpoint 200 so the client can call it freely.
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
