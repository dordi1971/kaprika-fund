import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listProjectsByCreator } from "@/lib/creator/store";
import { validateOpenFunding } from "@/lib/creator/validation";
import { requireSessionAddress } from "@/lib/creator/auth";

export async function GET() {
  const cookieJar = await cookies();
  const session = requireSessionAddress(cookieJar);
  if (!session.ok) return session.response;

  const projects = listProjectsByCreator(session.address).sort((a, b) => {
    return new Date(b.updatedAt).valueOf() - new Date(a.updatedAt).valueOf();
  });

  const drafts = projects
    .filter((p) => p.status === "DRAFT")
    .map((p) => {
      const { ok } = validateOpenFunding(p);
      return {
        id: p.id,
        title: p.core.title,
        updatedAt: p.updatedAt,
        readiness: ok ? ("READY" as const) : ("INCOMPLETE" as const),
        version: p.version,
      };
    });

  const active = projects
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({
      id: p.id,
      title: p.core.title,
      raised: p.funding.raised ?? "0",
      target: p.funding.target ?? "0",
      deadline: p.funding.deadline,
      contract: p.funding.contractAddress,
    }));

  const archive = projects
    .filter((p) => p.status === "COMPLETED" || p.status === "FAILED")
    .map((p) => ({
      id: p.id,
      title: p.core.title,
      outcome: p.status,
      closedAt: p.closedAt,
    }));

  return NextResponse.json({
    wallet: session.address,
    drafts,
    active,
    archive,
  });
}

