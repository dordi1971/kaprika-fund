"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

import DeskProjectsTable from "@/components/DeskProjectsTable";
import type { DeskProject } from "@/lib/desk/types";

type ApiResponse = {
  wallet: string;
  projects: DeskProject[];
  error?: string;
};

type SeenState = {
  states: Record<string, number | undefined>;
  proposals: Record<string, string | undefined>;
};

const LS_KEY = "kaprika.desk.seen.v1";

function readSeen(): SeenState {
  if (typeof window === "undefined") return { states: {}, proposals: {} };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { states: {}, proposals: {} };
    const parsed = JSON.parse(raw) as any;
    return {
      states: (parsed?.states && typeof parsed.states === "object" ? parsed.states : {}) as Record<string, number | undefined>,
      proposals: (parsed?.proposals && typeof parsed.proposals === "object" ? parsed.proposals : {}) as Record<string, string | undefined>,
    };
  } catch {
    return { states: {}, proposals: {} };
  }
}

function writeSeen(next: SeenState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

type DeskNotification = {
  id: string;
  isNew: boolean;
  title: string;
  body: string;
  href: string;
  priority: number; // lower = more important
  projectId: number;
};


function proposalKindLabel(kind: number, paramKey: number) {
  if (kind === 0) return "Release";
  if (kind === 1) {
    if (paramKey === 1) return "Change vote duration";
    if (paramKey === 2) return "Change quorum";
    return "Param change";
  }
  return "Proposal";
}

function fmtDateTime(secStr: string) {
  const sec = Number(secStr);
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const d = new Date(sec * 1000);
  return d.toLocaleString();
}

function stateLabel(state: number) {
  switch (state) {
    case 0:
      return "Funding Open";
    case 1:
      return "Failed";
    case 2:
      return "Governance";
    case 3:
      return "Complete";
    default:
      return `State ${state}`;
  }
}

export default function DeskClient() {
  const { address, isConnected } = useAccount();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<DeskProject[]>([]);
  const [seen, setSeen] = useState<SeenState>({ states: {}, proposals: {} });

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isConnected || !address) {
        setProjects([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/desk?wallet=${encodeURIComponent(address)}`);
        const json = (await res.json().catch(() => null)) as ApiResponse | null;
        if (cancelled) return;

        if (!res.ok) {
          setError(json?.error ?? "DESK_LOAD_FAILED");
          setProjects([]);
        } else {
          setProjects(Array.isArray(json?.projects) ? json!.projects : []);
        }
      } catch {
        if (!cancelled) {
          setError("DESK_LOAD_FAILED");
          setProjects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  const notifications = useMemo(() => {
    const out: DeskNotification[] = [];
    const nowSec = Math.floor(Date.now() / 1000);
    const safeBigInt = (v: string | undefined) => {
    try {
        return BigInt(v ?? "0");
    } catch {
        return 0n;
    }
    };

for (const p of projects) {
    const pid = parseInt(p.projectId, 10) || 0;
    const addr = p.projectAddress.toLowerCase();
  const prevState = seen.states[addr];
  const prevProp = seen.proposals[addr];

  let hasActionNotification = false;

  // 1) State change (only if we have a baseline)
  if (typeof prevState === "number" && prevState !== p.state) {
    out.push({
    id: `state:${addr}`,
    isNew: true,
    title: `STATE CHANGED // ${p.title}`,
    body: `${stateLabel(prevState)} → ${p.stateLabel}`,
    href: `/onchain/${p.projectAddress}`,
    priority: 2,
    projectId: pid,
    });

    hasActionNotification = true;
  }

  // 2) Active vote
  const lp = p.latestProposal;
  let voteIsActive = false;

  if (lp) {
    const end = Number(lp.endTime);
    voteIsActive = !lp.executed && Number.isFinite(end) && nowSec < end;

    const isNew = prevProp ? BigInt(lp.id) > BigInt(prevProp) : false;

    if (voteIsActive) {
        out.push({
        id: `vote:${addr}:${lp.id}`,
        isNew,
        title: `VOTE ACTIVE // ${p.title}`,
        body: `${proposalKindLabel(lp.kind, lp.paramKey)} — ends ${fmtDateTime(lp.endTime)}`,
        href: `/onchain/${p.projectAddress}`,
        priority: 1,
        projectId: pid,
        });

      hasActionNotification = true;
    }
  }

  // 3) Low-priority hint (Phase 1):
  // If governance is active, no proposals ever created, and user is creator OR has locked BLUE,
  // show a quiet "nothing to vote on" message.
  const isGovernance = p.state === 2; // ACTIVE
  const nextPid = p.nextProposalId ?? "0";
  const hasNeverHadProposal = nextPid === "0";
  const locked = safeBigInt(p.position?.blueLocked);

  const shouldSeeHint = p.position?.isCreator || locked > 0n;

  if (isGovernance && hasNeverHadProposal && shouldSeeHint && !hasActionNotification && !voteIsActive) {
    out.push({
    id: `govhint:${addr}`,
    isNew: false,
    title: `GOVERNANCE ACTIVE // ${p.title}`,
    body: `No votes currently open.`,
    href: `/onchain/${p.projectAddress}`,
    priority: 5,
    projectId: pid,
    });

  }
}

    out.sort((a, b) => {
    const newDiff = Number(b.isNew) - Number(a.isNew);
    if (newDiff) return newDiff;

    const pr = a.priority - b.priority;
    if (pr) return pr;

    return (b.projectId || 0) - (a.projectId || 0);
    });

return out;

  }, [projects, seen]);

  function markAllSeen() {
    const next: SeenState = { states: { ...seen.states }, proposals: { ...seen.proposals } };
    for (const p of projects) {
      const addr = p.projectAddress.toLowerCase();
      next.states[addr] = p.state;
      if (p.latestProposal?.id) next.proposals[addr] = p.latestProposal.id;
    }
    setSeen(next);
    writeSeen(next);
  }

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">DESK // LOCAL VIEW</span>
          <h1 className="pageTitle">Your Desk</h1>
          <p className="muted">Only what belongs to your connected wallet. Nothing else.</p>
        </section>

        {!isConnected || !address ? (
          <section className="section">
            <div className="card">
              <div className="cardBody">
                <div className="muted">Connect a wallet to open your Desk.</div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="section">
              <div className="indexMeta">
                <div>My Assets</div>
                <div className="num">{loading ? "Scanning…" : `${projects.length} found`}</div>
              </div>

              {error ? (
                <div className="card">
                  <div className="cardBody">
                    <div className="muted">Error: {error}</div>
                  </div>
                </div>
              ) : projects.length ? (
                <DeskProjectsTable projects={projects} />
              ) : (
                <div className="card">
                  <div className="cardBody">
                    <div className="muted">No on-chain assets detected for this wallet.</div>
                  </div>
                </div>
              )}
            </section>

            <section className="section">
              <div className="indexMeta">
                <div>Notifications</div>
                <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                  <div className="num">{notifications.filter((n) => n.isNew).length} new</div>
                  <button type="button" className="ghostBtn" onClick={markAllSeen}>
                    Mark seen
                  </button>
                </div>
              </div>

              {notifications.length ? (
                <div className="card">
                  <div className="cardBody">
                    <ul className="listPlain" style={{ margin: 0 }}>
                      {notifications.map((n) => (
                        <li key={n.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                          <a href={n.href} style={{ textDecoration: "none" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                                  <span className="projectTitle">{n.title}</span>
                                  {n.isNew && <span className="badge badgeActive">New</span>}
                                </div>
                                <div className="muted" style={{ marginTop: 4 }}>
                                  {n.body}
                                </div>
                              </div>
                              <div className="muted" style={{ whiteSpace: "nowrap" }}>
                                Open
                              </div>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="cardBody">
                    <div className="muted">No notifications right now.</div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
