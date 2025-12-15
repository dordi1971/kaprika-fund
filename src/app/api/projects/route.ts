import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createDraftProject } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";

type Body = {
  status?: "DRAFT";
};

export async function POST(request: Request) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => null)) as Body | null;
  if (body?.status && body.status !== "DRAFT") {
    return NextResponse.json({ error: "STATUS_NOT_ALLOWED" }, { status: 400 });
  }

  const project = createDraftProject(session.address);
  return NextResponse.json({ id: project.id });
}

