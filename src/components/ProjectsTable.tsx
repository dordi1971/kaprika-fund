"use client";

import { useRouter } from "next/navigation";
import { badgeClassForState, stateLabel } from "@/lib/projects";
import { formatPercent, formatUsdc } from "@/lib/format";
import { timeRemainingLabel } from "@/lib/time";
import type { ProjectRecord } from "@/lib/types";

type Props = {
  projects: ProjectRecord[];
};

export default function ProjectsTable({ projects }: Props) {
  const router = useRouter();

  return (
    <table className="dataTable" role="grid">
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
          const progressRatio =
            project.funding.target === 0
              ? 0
              : project.funding.raised / project.funding.target;
          const progress = formatPercent(progressRatio);
          const timeLabel = timeRemainingLabel(project.state, project.funding.deadline);
          const rowHref = `/projects/${project.id}`;

          const barWidth =
            project.state === "completed"
              ? 100
              : project.state === "failed"
                ? 0
                : Math.max(0, Math.min(100, Math.round(progressRatio * 100)));

          const barClass =
            project.state === "completed"
              ? "barFillCompleted"
              : project.state === "active"
                ? "barFillActive"
                : "";

          return (
            <tr
              key={project.id}
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
              <td className="colId num">{project.numericId}</td>
              <td>
                <span className="projectTitle">{project.title}</span>
                <span className="projectCat">{project.category}</span>
              </td>
              <td>
                <span className={`badge ${badgeClassForState(project.state)}`}>
                  {stateLabel(project.state)}
                </span>
              </td>
              <td className="num">
                {formatUsdc(project.funding.raised)} / {formatUsdc(project.funding.target)}{" "}
                {project.funding.currency}{" "}
                <span className="muted">({progress}%)</span>
                <div className="bar" aria-hidden="true">
                  <div
                    className={`barFill ${barClass}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </td>
              <td className="rightAlign muted num">{timeLabel}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

