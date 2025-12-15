import { notFound } from "next/navigation";
import CopyButton from "@/components/CopyButton";
import ActionThreshold from "@/components/ActionThreshold";
import { formatPercent, formatUsdc, shortAddress, shortId } from "@/lib/format";
import { badgeClassForState, getProjectById, stateLabel } from "@/lib/projects";
import { timeRemainingLabel } from "@/lib/time";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProjectRecordPage({ params }: Props) {
  const { id } = await params;
  const project = getProjectById(id);
  if (!project) notFound();

  const ratio =
    project.funding.target === 0 ? 0 : project.funding.raised / project.funding.target;
  const percent = formatPercent(ratio);
  const timeLabel = timeRemainingLabel(project.state, project.funding.deadline);
  const connectHref = `/connect?next=${encodeURIComponent(`/projects/${project.id}`)}`;

  const explanationParts = (project.explanation ?? "")
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const historyPreview = project.history.slice(0, 8);
  const historyRest = project.history.slice(8);

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <span className="metaLabel">Project Record</span>

          <h1 className="pageTitle">{project.title}</h1>
          <p className="muted">
            {project.category} · {stateLabel(project.state)} ·{" "}
            <span className="num">{timeLabel}</span>
          </p>

          <div className="card" style={{ background: "var(--surface)" }}>
            <div className="kvGrid">
              <div className="kv">
                <span className="kvKey">Project ID</span>
                <span className="kvValue num">{project.id}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Creator</span>
                <span className="kvValue num">{shortAddress(project.creator)}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Date created</span>
                <span className="kvValue num">{project.createdAt}</span>
              </div>
              <div className="kv">
                <span className="kvKey">Current state</span>
                <span className="kvValue">
                  <span className={`badge ${badgeClassForState(project.state)}`}>
                    {stateLabel(project.state)}
                  </span>
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <CopyButton value={project.id} label="project id" />
              <CopyButton value={project.creator} label="creator address" />
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Project Definition</h2>
          <p>{project.definition}</p>
          <p className="muted">Constraint: plain text · one paragraph · no links.</p>
        </section>

        <section className="section">
          <h2>Funding Structure</h2>
          <div className="kvGrid">
            <div className="kv">
              <span className="kvKey">Target</span>
              <span className="kvValue num">
                {formatUsdc(project.funding.target)} {project.funding.currency}
              </span>
            </div>
            <div className="kv">
              <span className="kvKey">Raised</span>
              <span className="kvValue num">
                {formatUsdc(project.funding.raised)} {project.funding.currency} ({percent}%)
              </span>
              <div className="bar" aria-hidden="true">
                <div
                  className={`barFill ${
                    project.state === "active" ? "barFillActive" : ""
                  } ${
                    project.state === "completed" ? "barFillCompleted" : ""
                  }`}
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round(ratio * 100)))}%`,
                  }}
                />
              </div>
            </div>
            <div className="kv">
              <span className="kvKey">Minimum allocation</span>
              <span className="kvValue num">
                {formatUsdc(project.funding.minimumAllocation)} {project.funding.currency}
              </span>
            </div>
            <div className="kv">
              <span className="kvKey">Deadline</span>
              <span className="kvValue num">{project.funding.deadline}</span>
            </div>
            <div className="kv">
              <span className="kvKey">Release model</span>
              <span className="kvValue">{project.funding.releaseModel}</span>
              {project.funding.milestones?.length ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  Milestones: {project.funding.milestones.join(" · ")}
                </div>
              ) : null}
            </div>
            <div className="kv">
              <span className="kvKey">Refund conditions</span>
              <span className="kvValue">{project.funding.refundConditions}</span>
            </div>
            <div className="kv">
              <span className="kvKey">Contract</span>
              <span className="kvValue num">{shortId(project.funding.contract)}</span>
            </div>
            <div className="kv">
              <span className="kvKey">Contract (view)</span>
              <details className="details">
                <summary>Open</summary>
                <div className="detailsContent">
                  <div className="muted">Contract address</div>
                  <div className="num" style={{ marginBottom: 10 }}>
                    {project.funding.contract}
                  </div>
                  <div className="muted">
                    Explorer integration comes later. The record remains readable without it.
                  </div>
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Fund Flow</h2>
          <ol className="listPlain" style={{ color: "var(--text)" }}>
            <li>1) Funds enter escrow.</li>
            <li>2) Milestone confirmation unlocks release.</li>
            <li>3) Releases occur per milestone.</li>
            <li>4) If conditions are unmet → refunds return to contributors.</li>
          </ol>
          <div style={{ marginTop: 14 }}>
            <details className="details">
              <summary>Show details</summary>
              <div className="detailsContent">
                <p className="muted" style={{ marginBottom: 0 }}>
                  The system does not rely on persuasion. It relies on explicit, inspectable
                  conditions.
                </p>
              </div>
            </details>
          </div>
        </section>

        <section className="section">
          <h2>Creator Commitments</h2>
          <table className="commitTable">
            <thead>
              <tr>
                <th>Commitment</th>
                <th>Deadline</th>
                <th>Verification</th>
                <th>Failure consequence</th>
              </tr>
            </thead>
            <tbody>
              {project.commitments.map((c) => (
                <tr key={`${c.deliverable}-${c.deadline}`}>
                  <td>{c.deliverable}</td>
                  <td className="num">{c.deadline}</td>
                  <td>{c.verification}</td>
                  <td>{c.failureConsequence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="section">
          <h2>Explanation</h2>
          {explanationParts.length ? (
            explanationParts.map((part) => <p key={part}>{part}</p>)
          ) : (
            <p className="muted">No explanation provided.</p>
          )}
          {project.links?.length ? (
            <>
              <div className="hr" />
              <p className="muted" style={{ marginBottom: 10 }}>
                Links (if any):
              </p>
              <ul className="listPlain">
                {project.links.map((link) => (
                  <li key={link.href}>
                    <a className="highlight" href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                    <span className="muted"> — {link.href}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="section">
          <h2>Evidence &amp; Media</h2>
          <p className="muted">No media provided.</p>
        </section>

        <section className="section" id="history">
          <h2>Project History</h2>
          <ul className="listPlain" style={{ color: "var(--text)" }}>
            {historyPreview.map((h) => (
              <li key={`${h.at}-${h.event}`}>
                <span className="num muted">{h.at}</span> <span>{h.event}</span>
              </li>
            ))}
          </ul>
          {historyRest.length ? (
            <div style={{ marginTop: 14 }}>
              <details className="details">
                <summary>Show full history</summary>
                <div className="detailsContent">
                  <ul className="listPlain" style={{ color: "var(--text)" }}>
                    {historyRest.map((h) => (
                      <li key={`${h.at}-${h.event}`}>
                        <span className="num muted">{h.at}</span> <span>{h.event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          ) : null}
        </section>

        <section className="section">
          <h2>Action Threshold</h2>
          <ActionThreshold state={project.state} connectHref={connectHref} />
          <p className="muted" style={{ marginTop: 14 }}>
            No “support” language. The verb is Allocate.
          </p>
        </section>
      </div>
    </main>
  );
}
