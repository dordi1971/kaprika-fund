"use client";

import { useRouter } from "next/navigation";
import type { DeskProject } from "@/lib/desk/types";

function fmtPos(p: DeskProject["position"]) {
  const parts: string[] = [];
  if (p.isCreator) parts.push("Creator");
  const bal = BigInt(p.blueBalance || "0");
  const locked = BigInt(p.blueLocked || "0");
  if (bal > 0n) parts.push(`Blue: ${bal.toString()}`);
  if (locked > 0n) parts.push(`Locked: ${locked.toString()}`);
  return parts.join(" · ") || "—";
}

export default function DeskProjectsTable({ projects }: { projects: DeskProject[] }) {
  const router = useRouter();

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="dataTable observeTable">
        <thead>
          <tr>
            <th className="colId">ID</th>
            <th>Project / Structure</th>
            <th>State</th>

            <th>Capital Logic</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const href = `/onchain/${p.projectAddress}`;
            return (
              <tr
                key={p.projectAddress}
                className="tableRow"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") router.push(href);
                }}
              >
                <td className="colId num">{p.projectId}</td>
                <td>
                  <span className="projectTitle">{p.title}</span>
                  <span className="projectCat">{p.category}</span>
                </td>
                <td>
                  <span className={`badge ${p.badgeClass}`}>{p.stateLabel}</span>
                </td>

                <td>
                  <div className="muted">
                    <span className="num">{p.raised}</span> / <span className="num">{p.target}</span> {p.tokenSymbol}
                  </div>
                  <div className="bar">
                    <div className="barFill" style={{ width: `${Math.min(100, Math.max(0, p.progressPct))}%` }} />
                  </div>
                </td>
                <td className="muted num">{p.timeRemaining}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
