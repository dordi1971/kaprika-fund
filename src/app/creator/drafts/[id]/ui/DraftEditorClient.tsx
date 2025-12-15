"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Commitment, ProjectRecord } from "@/lib/creator/types";
import { validateOpenFunding } from "@/lib/creator/validation";

type Props = {
  id: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
}

function emptyCommitment(): Commitment {
  return { deliverable: "", deadline: "", verification: "", failureConsequence: "" };
}

export default function DraftEditorClient({ id }: Props) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirtyCoreFunding, setDirtyCoreFunding] = useState(false);
  const [dirtyCommitments, setDirtyCommitments] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  const readiness = useMemo(() => {
    if (!project) return { ok: false, errors: [] as string[] };
    return validateOpenFunding(project);
  }, [project]);

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
        setSaveStatus("idle");
        setDirtyCoreFunding(false);
        setDirtyCommitments(false);
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

  useEffect(() => {
    if (!project) return;
    if (!dirtyCoreFunding && !dirtyCommitments) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      save("auto");
    }, 1000);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [dirtyCommitments, dirtyCoreFunding, project]);

  async function save(mode: "auto" | "manual") {
    if (!project) return;
    if (!dirtyCoreFunding && !dirtyCommitments) return;
    setSaveStatus("saving");

    try {
      let next = project;

      if (dirtyCoreFunding) {
        const patchRes = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ifMatchVersion: next.version,
            core: next.core,
            funding: next.funding,
          }),
        });

        if (patchRes.status === 409) {
          setSaveStatus("error");
          return;
        }
        if (!patchRes.ok) throw new Error("FAILED");

        const patchJson = (await patchRes.json()) as { project: ProjectRecord };
        next = patchJson.project;
        setProject(next);
        setDirtyCoreFunding(false);
      }

      if (dirtyCommitments) {
        const commitRes = await fetch(`/api/projects/${encodeURIComponent(id)}/commitments`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ifMatchVersion: next.version,
            items: next.commitments,
          }),
        });

        if (commitRes.status === 409) {
          setSaveStatus("error");
          return;
        }
        if (!commitRes.ok) throw new Error("FAILED");

        const commitJson = (await commitRes.json()) as { project: ProjectRecord };
        next = commitJson.project;
        setProject(next);
        setDirtyCommitments(false);
      }

      setSaveStatus("saved");
      setSavedAt(new Date().toISOString());
      if (mode === "manual") {
        window.setTimeout(() => setSaveStatus("idle"), 800);
      }
    } catch {
      setSaveStatus("error");
    }
  }

  async function openFunding() {
    if (!project) return;
    const ok = window.confirm("Opening funding locks the structure. Explanation may change, structure may not.");
    if (!ok) return;
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}/open-funding`, { method: "POST" });
    if (res.ok) router.push("/creator");
  }

  if (status === "loading") {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <div className="skeletonBlock" style={{ height: 34, width: "60%" }} />
            <div style={{ height: 14 }} />
            <div className="skeletonBlock" style={{ height: 200 }} />
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
            <h1 className="pageTitle">Draft editor</h1>
            <p className="muted">This draft could not be loaded.</p>
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
          <div className="actionLine" style={{ background: "var(--panel)" }}>
            <Link className="ghostBtn" href="/creator">
              ← Back to console
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
              <span className="badge badgeDraft">DRAFT</span>
              <input
                value={project.core.title ?? ""}
                placeholder="Untitled draft"
                onChange={(e) => {
                  setProject({ ...project, core: { ...project.core, title: e.target.value } });
                  setDirtyCoreFunding(true);
                  setSaveStatus("idle");
                }}
                style={{
                  flex: 1,
                  minWidth: 220,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "10px 14px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <span className="muted num" style={{ fontSize: 12 }}>
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved" && savedAt
                    ? `Saved ${formatTime(savedAt)}`
                    : saveStatus === "error"
                      ? "Not saved"
                      : "—"}
              </span>
              {saveStatus === "error" ? (
                <button type="button" className="ghostBtn" onClick={() => save("manual")}>
                  Retry
                </button>
              ) : null}
              {readiness.ok ? (
                <button type="button" className="neutralBtn" onClick={() => openFunding()}>
                  Open funding
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Core</h2>
          <div className="card" style={{ background: "var(--surface)" }}>
            <label className="kvKey">Category</label>
            <input
              value={project.core.category ?? ""}
              placeholder="Category"
              onChange={(e) => {
                setProject({ ...project, core: { ...project.core, category: e.target.value } });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
              } as CSSProperties}
            />

            <div style={{ height: 12 }} />

            <label className="kvKey">Definition (≤ 400)</label>
            <textarea
              value={project.core.definition ?? ""}
              placeholder="One paragraph. No links."
              rows={5}
              onChange={(e) => {
                setProject({ ...project, core: { ...project.core, definition: e.target.value } });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
                resize: "vertical",
              } as CSSProperties}
            />
            <div className="muted num" style={{ marginTop: 8, fontSize: 12 }}>
              {(project.core.definition ?? "").length}/400
            </div>

            <div style={{ height: 12 }} />

            <label className="kvKey">Explanation</label>
            <textarea
              value={project.core.explanation ?? ""}
              placeholder="Optional."
              rows={6}
              onChange={(e) => {
                setProject({ ...project, core: { ...project.core, explanation: e.target.value } });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
                resize: "vertical",
              } as CSSProperties}
            />
          </div>
        </section>

        <section className="section">
          <h2>Funding</h2>
          <div className="card" style={{ background: "var(--surface)" }}>
            <div className="kvGrid">
              <div className="kv">
                <span className="kvKey">Currency</span>
                <input
                  value={project.funding.currency ?? ""}
                  onChange={(e) => {
                    setProject({ ...project, funding: { ...project.funding, currency: e.target.value as any } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                />
              </div>
              <div className="kv">
                <span className="kvKey">Target</span>
                <input
                  value={project.funding.target ?? ""}
                  onChange={(e) => {
                    setProject({ ...project, funding: { ...project.funding, target: e.target.value } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                />
              </div>
              <div className="kv">
                <span className="kvKey">Minimum allocation</span>
                <input
                  value={project.funding.minimumAllocation ?? ""}
                  onChange={(e) => {
                    setProject({ ...project, funding: { ...project.funding, minimumAllocation: e.target.value } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                />
              </div>
              <div className="kv">
                <span className="kvKey">Deadline (YYYY-MM-DD)</span>
                <input
                  value={project.funding.deadline ?? ""}
                  onChange={(e) => {
                    setProject({ ...project, funding: { ...project.funding, deadline: e.target.value } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                />
              </div>
              <div className="kv">
                <span className="kvKey">Release model</span>
                <input
                  value={project.funding.releaseModel ?? ""}
                  onChange={(e) => {
                    setProject({ ...project, funding: { ...project.funding, releaseModel: e.target.value as any } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                  }}
                  style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Commitments (1–5)</h2>
          <div className="card" style={{ background: "var(--surface)" }}>
            {project.commitments.length ? (
              project.commitments.map((c, idx) => (
                <div key={idx} style={{ borderTop: idx === 0 ? "none" : "1px solid var(--border)", paddingTop: idx === 0 ? 0 : 14, marginTop: idx === 0 ? 0 : 14 }}>
                  <div className="muted num" style={{ fontSize: 12, marginBottom: 10 }}>
                    Commitment {idx + 1}
                  </div>
                  <div className="splitGrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div>
                      <label className="kvKey">Deliverable</label>
                      <input
                        value={c.deliverable}
                        onChange={(e) => {
                          const next = project.commitments.slice();
                          next[idx] = { ...next[idx], deliverable: e.target.value };
                          setProject({ ...project, commitments: next });
                          setDirtyCommitments(true);
                          setSaveStatus("idle");
                        }}
                        style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                      />
                    </div>
                    <div>
                      <label className="kvKey">Deadline</label>
                      <input
                        value={c.deadline}
                        onChange={(e) => {
                          const next = project.commitments.slice();
                          next[idx] = { ...next[idx], deadline: e.target.value };
                          setProject({ ...project, commitments: next });
                          setDirtyCommitments(true);
                          setSaveStatus("idle");
                        }}
                        style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                      />
                    </div>
                  </div>
                  <div style={{ height: 10 }} />
                  <label className="kvKey">Verification</label>
                  <input
                    value={c.verification}
                    onChange={(e) => {
                      const next = project.commitments.slice();
                      next[idx] = { ...next[idx], verification: e.target.value };
                      setProject({ ...project, commitments: next });
                      setDirtyCommitments(true);
                      setSaveStatus("idle");
                    }}
                    style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                  />
                  <div style={{ height: 10 }} />
                  <label className="kvKey">Failure consequence</label>
                  <input
                    value={c.failureConsequence}
                    onChange={(e) => {
                      const next = project.commitments.slice();
                      next[idx] = { ...next[idx], failureConsequence: e.target.value };
                      setProject({ ...project, commitments: next });
                      setDirtyCommitments(true);
                      setSaveStatus("idle");
                    }}
                    style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", borderRadius: 999, padding: "10px 12px", color: "var(--text)", fontFamily: "inherit" }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => {
                        const next = project.commitments.slice();
                        next.splice(idx, 1);
                        setProject({ ...project, commitments: next });
                        setDirtyCommitments(true);
                        setSaveStatus("idle");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No commitments yet.</p>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <button
                type="button"
                className="ghostBtn"
                disabled={project.commitments.length >= 5}
                onClick={() => {
                  setProject({ ...project, commitments: [...project.commitments, emptyCommitment()] });
                  setDirtyCommitments(true);
                  setSaveStatus("idle");
                }}
              >
                Add commitment
              </button>
              <button
                type="button"
                className="neutralBtn"
                onClick={() => save("manual")}
                disabled={saveStatus === "saving" || (!dirtyCoreFunding && !dirtyCommitments)}
              >
                Save now
              </button>
            </div>

            <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
              Drafts are private until funding opens.
            </p>
          </div>
        </section>

        {!readiness.ok ? (
          <section className="section">
            <h2>Readiness</h2>
            <div className="card" style={{ background: "var(--surface)" }}>
              <p className="muted" style={{ marginBottom: 0 }}>
                Structure incomplete
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
