"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { OnchainObserverProject } from "@/lib/observe/onchainIndex";

type Props = {
  projects: OnchainObserverProject[];
};

function descriptionPreview(v: string | null, maxLen = 160) {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  if (!t.length) return null;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

export default function OnchainProjectsTable({ projects }: Props) {
  const router = useRouter();

  return (
    <table className="dataTable observeTable" role="grid">
      <thead>
        <tr>
          <th className="colId">ID</th>
          <th>Project / Structure</th>
          <th>State</th>
          <th>Capital Logic</th>
          <th className="rightAlign">Time Rem.</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => {
          const rowHref = `/onchain/${project.projectAddress}`;
          const barWidth = Math.max(0, Math.min(100, Math.round(project.progressPct)));
          const barClass =
            project.state === 3 ? "barFillCompleted" : project.state === 0 ? "barFillActive" : "";
          const descPreview = descriptionPreview(project.description);

          return (
            <tr
              key={`${project.projectId}-${project.projectAddress}`}
              className="tableRow"
              tabIndex={0}
              role="row"
              aria-label={`Open project ${project.title}`}
              onClick={() => router.push(rowHref)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(rowHref);
                }
              }}
            >
              <td className="colId num" data-label="ID">
                {project.projectId}
              </td>
              <td data-label="Project / Structure">
                <span className="projectTitle">
                  <Link className="highlight" href={rowHref}>
                    {project.title}
                  </Link>
                </span>
                <span className="projectCat">{project.category}</span>
                {descPreview ? (
                  <div className="muted projectDesc" title={project.description ?? undefined}>
                    {descPreview}
                  </div>
                ) : null}

              </td>
              <td data-label="State">
                <span className={`badge ${project.badgeClass}`}>{project.stateLabel}</span>
              </td>
              <td className="num" data-label="Capital Logic">
                {project.raised} / {project.target} {project.tokenSymbol}{" "}
                <span className="muted">({Math.round(project.progressPct)}%)</span>
                <div className="bar" aria-hidden="true">
                  <div className={`barFill ${barClass}`} style={{ width: `${barWidth}%` }} />
                </div>
              </td>
              <td className="rightAlign muted num" data-label="Time Rem.">
                {project.timeRemaining}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
