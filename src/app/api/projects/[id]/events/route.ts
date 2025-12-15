import { NextResponse } from "next/server";
import { getProject, listEvents } from "@/lib/creator/store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const project = getProject(id);
  if (!project) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const events = listEvents(id);
  if (!project.publishedAt) return NextResponse.json({ events: [] });

  const publishedAtMs = new Date(project.publishedAt).valueOf();
  const publicEvents = events.filter((e) => new Date(e.timestamp).valueOf() >= publishedAtMs);
  return NextResponse.json({ events: publicEvents });
}

