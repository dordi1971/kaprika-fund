import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteDraftProject, getProject, updateProject } from "@/lib/creator/store";
import { requireSessionAddress } from "@/lib/creator/auth";
import { ExternalLinksDraftSchema } from "@/lib/creator/schemas";
import type { ProjectRecord } from "@/lib/creator/types";

type PatchBody = {
  ifMatchVersion?: number;
  core?: Partial<ProjectRecord["core"]>;
  funding?: Partial<ProjectRecord["funding"]>;
  externalLinks?: ProjectRecord["externalLinks"];
};

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

  return NextResponse.json({ project });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ error: "NOT_EDITABLE" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

  let externalLinks: ProjectRecord["externalLinks"] | undefined;
  if (body.externalLinks) {
    const parsed = ExternalLinksDraftSchema.safeParse(body.externalLinks);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_EXTERNAL_LINKS" }, { status: 400 });
    }
    externalLinks = parsed.data.map((l) => ({
      ...l,
      label: l.label.trim(),
      url: l.url.trim(),
    }));
  }

  const result = updateProject(
    id,
    session.address,
    { core: body.core ?? {}, funding: body.funding ?? {}, ...(externalLinks ? { externalLinks } : {}) },
    body.ifMatchVersion,
  );

  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json({ error: "CONFLICT", project: result.project }, { status: 409 });
    }
    return NextResponse.json({ error: "NOT_FOUND" }, { status: result.status });
  }

  return NextResponse.json({ project: result.project });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (project.creatorAddress !== session.address) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = deleteDraftProject(id, session.address);
  if (!result.ok) return NextResponse.json({ error: "NOT_ALLOWED" }, { status: result.status });
  return new NextResponse(null, { status: 204 });
}
