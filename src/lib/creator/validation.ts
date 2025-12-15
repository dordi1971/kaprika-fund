import type { ProjectRecord } from "./types";

export type PublishValidationError =
  | "MISSING_TITLE"
  | "MISSING_CATEGORY"
  | "DEFINITION_EMPTY"
  | "DEFINITION_TOO_LONG"
  | "FUNDING_INCOMPLETE"
  | "MISSING_COMMITMENTS"
  | "COMMITMENTS_INCOMPLETE"
  | "DEADLINE_INVALID";

export function validateOpenFunding(project: ProjectRecord) {
  const errors: PublishValidationError[] = [];

  if (!project.core.title?.trim()) errors.push("MISSING_TITLE");
  if (!project.core.category?.trim()) errors.push("MISSING_CATEGORY");

  const definition = project.core.definition?.trim() ?? "";
  if (!definition) errors.push("DEFINITION_EMPTY");
  if (definition.length > 400) errors.push("DEFINITION_TOO_LONG");

  const funding = project.funding;
  if (
    !funding.currency ||
    !funding.target ||
    !funding.minimumAllocation ||
    !funding.deadline ||
    !funding.releaseModel
  ) {
    errors.push("FUNDING_INCOMPLETE");
  }

  if (!project.commitments.length) errors.push("MISSING_COMMITMENTS");
  if (project.commitments.length) {
    const hasIncomplete = project.commitments.some((c) => {
      return (
        !c.deliverable.trim() ||
        !c.deadline.trim() ||
        !c.verification.trim() ||
        !c.failureConsequence.trim()
      );
    });
    if (hasIncomplete) errors.push("COMMITMENTS_INCOMPLETE");
  }

  if (funding.deadline) {
    const date = new Date(funding.deadline);
    if (Number.isNaN(date.valueOf())) errors.push("DEADLINE_INVALID");
  }

  return { ok: errors.length === 0, errors };
}

