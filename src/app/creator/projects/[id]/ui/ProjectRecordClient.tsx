"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectRecord } from "@/lib/creator/types";

type Props = {
  id: string;
};

function shortAddress(address: string | null) {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function ProjectRecordClient({ id }: Props) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("FAILED");
        const json = (await res.json()) as { project: ProjectRecord };
        if (!active) return;
        setProject(json.project);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <div className="skeletonBlock" style={{ height: 34, width: "50%" }} />
            <div style={{ height: 14 }} />
            <div className="skeletonBlock" style={{ height: 140 }} />
          </section>
        </div>
      </main>
    );
  }

  if (status === "error" || !project) {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <h1 className="pageTitle">Project record</h1>
            <p className="muted">This record could not be loaded.</p>
            <Link className="ghostBtn" href="/creator">
              Back to console
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <div className="indexMeta">
            <span>Record</span>
            <span className="num">{project.id.slice(0, 8)}</span>
          </div>

          <h1 className="pageTitle">{project.core.title?.trim() || "Untitled draft"}</h1>
          <p className="muted num">
            Status: <span className={`badge ${project.status === "DRAFT" ? "badgeDraft" : "badgeActive"}`}>{project.status}</span>{" "}
            · Updated: {formatWhen(project.updatedAt)}
          </p>

          <div className="card" style={{ background: "var(--surface)" }}>
            <div className="kvGrid">
              <div className="kv">
                <span className="kvKey">Creator</span>
                <span className="kvValue num">{shortAddress(project.creatorAddress)}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Created</span>
                <span className="kvValue num">{formatWhen(project.createdAt)}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Published</span>
                <span className="kvValue num">{formatWhen(project.publishedAt)}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Contract</span>
                <span className="kvValue num">{shortAddress(project.funding.contractAddress)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link className="ghostBtn" href="/creator">
              Back to console
            </Link>
            {project.status === "DRAFT" ? (
              <Link className="neutralBtn" href={`/creator/drafts/${encodeURIComponent(project.id)}`}>
                Edit
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

