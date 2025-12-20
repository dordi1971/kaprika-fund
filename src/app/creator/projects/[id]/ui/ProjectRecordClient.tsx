"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProjectRecord } from "@/lib/creator/types";

type Props = {
  id: string;
};

function truncateMiddle(value: string, head = 6, tail = 4) {
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
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
  const [copyValue, setCopyValue] = useState<string | null>(null);

  useEffect(() => {
    if (!copyValue) return undefined;
    const timer = window.setTimeout(() => setCopyValue(null), 1200);
    return () => window.clearTimeout(timer);
  }, [copyValue]);

  const copyText = async (value: string) => {
    if (!value) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setCopyValue(value);
        return;
      }
    } catch {
      // ignore and fall back
    }

    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopyValue(value);
    } catch {
      // ignore
    }
  };

  const renderCopyValue = (value: string | null) => {
    const raw = (value ?? "").trim();
    const display = raw ? truncateMiddle(raw) : "---";
    return (
      <span className="onchainInfoValue">
        <span className="mono onchainTruncate" style={{ maxWidth: "100%" }} title={raw || undefined}>
          {display}
        </span>
        {raw ? (
          <button type="button" className="copyBtn" onClick={() => void copyText(raw)}>
            {copyValue === raw ? "Copied" : "Copy"}
          </button>
        ) : null}
      </span>
    );
  };

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
                <div className="kvValue muted">{renderCopyValue(project.creatorAddress)}</div>
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
                <div className="kvValue muted">{renderCopyValue(project.funding.contractAddress)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <Link className="ghostBtn" href="/creator">
              Back to console
            </Link>
            {project.funding.contractAddress ? (
              <Link className="ghostBtn" href={`/onchain/${encodeURIComponent(project.funding.contractAddress)}`}>
                Open on-chain view
              </Link>
            ) : null}
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
