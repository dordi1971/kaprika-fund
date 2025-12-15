"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Overview = {
  wallet: string;
  drafts: Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    readiness: "INCOMPLETE" | "READY";
  }>;
  active: Array<{
    id: string;
    title: string | null;
    raised: string;
    target: string;
    deadline: string | null;
    contract: string | null;
  }>;
  archive: Array<{
    id: string;
    title: string | null;
    outcome: "COMPLETED" | "FAILED";
    closedAt: string | null;
  }>;
};

function shortAddress(address: string) {
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

export default function CreatorConsoleClient() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/overview", { cache: "no-store" });
      if (res.status === 401) {
        setOverview(null);
        setError("UNAUTHORIZED");
        return;
      }
      if (!res.ok) throw new Error("FAILED");
      const json = (await res.json()) as Overview;
      setOverview(json);
    } catch {
      setError("FAILED");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const resumeDraft = useMemo(() => {
    if (!overview?.drafts.length) return null;
    return overview.drafts[0];
  }, [overview]);

  const hasAnything = Boolean(
    overview && (overview.drafts.length || overview.active.length || overview.archive.length),
  );

  async function newDraft() {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      if (res.status === 401) {
        router.push("/connect?next=/creator");
        return;
      }
      if (!res.ok) throw new Error("FAILED");
      const json = (await res.json()) as { id: string };
      router.push(`/creator/drafts/${encodeURIComponent(json.id)}`);
    } finally {
      setCreating(false);
    }
  }

  async function deleteDraft(id: string) {
    const ok = window.confirm("Delete this draft?\n\nThis cannot be undone.");
    if (!ok) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <div className="skeletonBlock" style={{ height: 34, width: "55%" }} />
            <div style={{ height: 14 }} />
            <div className="skeletonBlock" style={{ height: 92 }} />
          </section>
        </div>
      </main>
    );
  }

  if (error === "UNAUTHORIZED") {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <h1 className="pageTitle">Creator Console</h1>
            <p className="muted">Connect a wallet to continue.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <Link className="neutralBtn" href="/connect?next=/creator">
                Connect wallet
              </Link>
              <Link className="ghostBtn" href="/observe">
                Return
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <h1 className="pageTitle">Creator Console</h1>
            <p className="muted">The console could not be loaded.</p>
            <button type="button" className="neutralBtn" onClick={() => load()}>
              Retry
            </button>
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
            <span>Creator Console</span>
            <span className="num">Wallet: {shortAddress(overview.wallet)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="neutralBtn" disabled={creating} onClick={() => newDraft()}>
              {creating ? "Creating…" : "New draft"}
            </button>
          </div>
        </section>

        {!hasAnything ? (
          <section className="section">
            <h2>Desk</h2>
            <p className="muted">Nothing exists under this wallet yet.</p>
            <button type="button" className="neutralBtn" disabled={creating} onClick={() => newDraft()}>
              {creating ? "Creating…" : "New draft"}
            </button>
          </section>
        ) : null}

        {resumeDraft ? (
          <section className="section">
            <h2>Resume</h2>
            <div className="card" style={{ background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div className="projectTitle">{resumeDraft.title?.trim() || "Untitled draft"}</div>
                  <div className="muted num">Last edited: {formatWhen(resumeDraft.updatedAt)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span className="badge badgeDraft">DRAFT</span>
                  <Link className="neutralBtn" href={`/creator/drafts/${encodeURIComponent(resumeDraft.id)}`}>
                    Resume
                  </Link>
                  <Link className="ghostBtn" href={`/creator/projects/${encodeURIComponent(resumeDraft.id)}`}>
                    View record
                  </Link>
                </div>
              </div>
              <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
                Drafts are private until funding opens.
              </p>
            </div>
          </section>
        ) : null}

        <section className="section">
          <h2>Drafts ({overview.drafts.length})</h2>
          {overview.drafts.length ? (
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Updated</th>
                  <th>Completion</th>
                  <th className="rightAlign">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.drafts.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="projectTitle">{d.title?.trim() || "Untitled draft"}</span>
                      <span className="projectCat num">{d.id.slice(0, 8)}</span>
                    </td>
                    <td className="num">{formatWhen(d.updatedAt)}</td>
                    <td className="muted">
                      {d.readiness === "READY" ? "Ready to publish" : "Structure incomplete"}
                    </td>
                    <td className="rightAlign">
                      <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Link className="ghostBtn" href={`/creator/drafts/${encodeURIComponent(d.id)}`}>
                          Edit
                        </Link>
                        <Link className="ghostBtn" href={`/creator/projects/${encodeURIComponent(d.id)}`}>
                          View record
                        </Link>
                        <button type="button" className="ghostBtn" onClick={() => deleteDraft(d.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card" style={{ background: "var(--surface)" }}>
              <h3 style={{ marginTop: 0 }}>No drafts</h3>
              <p className="muted">
                When you start a project, it begins here. Quietly.
              </p>
              <button type="button" className="neutralBtn" disabled={creating} onClick={() => newDraft()}>
                {creating ? "Creating…" : "New draft"}
              </button>
            </div>
          )}
        </section>

        <section className="section">
          <h2>Active ({overview.active.length})</h2>
          {overview.active.length ? (
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Raised / Target</th>
                  <th>Time remaining</th>
                  <th>Contract</th>
                  <th className="rightAlign">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.active.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title?.trim() || "Untitled project"}</td>
                    <td className="num">{p.raised} / {p.target}</td>
                    <td className="num">{p.deadline ? formatWhen(p.deadline) : "—"}</td>
                    <td className="num">{p.contract ? shortAddress(p.contract) : "—"}</td>
                    <td className="rightAlign">
                      <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Link className="ghostBtn" href={`/creator/projects/${encodeURIComponent(p.id)}`}>
                          View record
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card" style={{ background: "var(--surface)" }}>
              <h3 style={{ marginTop: 0 }}>No active projects</h3>
              <p className="muted">
                Funding begins only when a draft becomes a structure you are willing to lock.
              </p>
            </div>
          )}
        </section>

        <section className="section">
          <h2>Archive</h2>
          {overview.archive.length ? (
            <table className="dataTable">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Final outcome</th>
                  <th>Closed</th>
                  <th className="rightAlign">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.archive.map((p) => (
                  <tr key={p.id}>
                    <td>{p.title?.trim() || "Untitled project"}</td>
                    <td>
                      <span className={`badge ${p.outcome === "COMPLETED" ? "badgeCompleted" : "badgeFailed"}`}>
                        {p.outcome}
                      </span>
                    </td>
                    <td className="num">{formatWhen(p.closedAt)}</td>
                    <td className="rightAlign">
                      <Link className="ghostBtn" href={`/creator/projects/${encodeURIComponent(p.id)}`}>
                        View record
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="card" style={{ background: "var(--surface)" }}>
              <h3 style={{ marginTop: 0 }}>Nothing in the archive</h3>
              <p className="muted">Not yet.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
