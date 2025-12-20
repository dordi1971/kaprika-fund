import type { ProjectRecord } from "./types";
import { PROJECT_CATEGORIES, hasConditionals, hasLink, isLikelyISODate } from "@/lib/commitments";

export type PublishValidationError =
  | "MISSING_TITLE"
  | "MISSING_CATEGORY"
  | "DEFINITION_EMPTY"
  | "DEFINITION_TOO_LONG"
  | "DEFINITION_HAS_LINKS"
  | "OTHER_DEFINITION_TOO_LONG"
  | "OTHER_DELIVERABLE_EXAMPLE_REQUIRED"
  | "OTHER_DELIVERABLE_EXAMPLE_INVALID"
  | "FUNDING_INCOMPLETE"
  | "MILESTONE_COMMITMENTS_REQUIRED"
  | "MISSING_COMMITMENTS"
  | "COMMITMENTS_TOO_MANY"
  | "COMMITMENTS_INVALID"
  | "COMMITMENTS_DEADLINE_INVALID"
  | "COMMITMENTS_HAVE_CONDITIONALS"
  | "COMMITMENTS_DETAILS_HAS_LINKS"
  | "COMMITMENTS_REFUND_INVALID"
  | "DEADLINE_INVALID"
  | "PROJECT_URI_UPLOAD_FAILED"
  | "MISSING_TOKEN_ADDRESS"
  | "TOKEN_DECIMALS_INVALID";

export function validateOpenFunding(project: ProjectRecord) {
  const errors: PublishValidationError[] = [];
  const pushOnce = (code: PublishValidationError) => {
    if (!errors.includes(code)) errors.push(code);
  };

  if (!project.core.title?.trim()) errors.push("MISSING_TITLE");

  const allowedCategories = new Set(PROJECT_CATEGORIES.map((c) => c.value));
  const category = project.core.category;
  if (!category?.trim() || !allowedCategories.has(category)) {
    errors.push("MISSING_CATEGORY");
  }

  const definition = project.core.definition?.trim() ?? "";
  if (!definition) errors.push("DEFINITION_EMPTY");
  if (hasLink(definition)) errors.push("DEFINITION_HAS_LINKS");

  if (category === "OTHER") {
    if (definition.length > 200) errors.push("OTHER_DEFINITION_TOO_LONG");

    const example = project.core.deliverableExample?.trim() ?? "";
    if (!example) {
      errors.push("OTHER_DELIVERABLE_EXAMPLE_REQUIRED");
    } else {
      if (example.length > 150) errors.push("OTHER_DELIVERABLE_EXAMPLE_INVALID");
      if (hasLink(example) || hasConditionals(example)) errors.push("OTHER_DELIVERABLE_EXAMPLE_INVALID");
    }
  } else {
    if (definition.length > 400) errors.push("DEFINITION_TOO_LONG");
  }

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

  if (funding.releaseModel === "MILESTONE") {
    const milestoneCount = funding.milestonePlan?.milestones?.length ?? 0;
    if (milestoneCount > 0 && project.commitments.length < milestoneCount) {
      errors.push("MILESTONE_COMMITMENTS_REQUIRED");
    }
  }

  if (!project.commitments.length) errors.push("MISSING_COMMITMENTS");
  if (project.commitments.length > 5) errors.push("COMMITMENTS_TOO_MANY");

  if (project.commitments.length) {
    for (const c of project.commitments) {
      if (
        !c.deliverableType ||
        !c.deadline?.trim() ||
        !c.verificationMethod ||
        !c.verificationDetails?.trim() ||
        !c.failureConsequence ||
        !c.details?.trim()
      ) {
        pushOnce("COMMITMENTS_INVALID");
      }

      if (c.verificationDetails?.trim()) {
        if (c.verificationDetails.trim().length > 150) pushOnce("COMMITMENTS_INVALID");
        if (hasConditionals(c.verificationDetails)) pushOnce("COMMITMENTS_HAVE_CONDITIONALS");
      }

      if (c.details?.trim()) {
        const details = c.details.trim();
        if (details.length > 150) pushOnce("COMMITMENTS_INVALID");
        if (hasConditionals(details)) pushOnce("COMMITMENTS_HAVE_CONDITIONALS");
        if (hasLink(details)) pushOnce("COMMITMENTS_DETAILS_HAS_LINKS");
      }

      if (c.deadline?.trim() && !isLikelyISODate(c.deadline.trim())) {
        pushOnce("COMMITMENTS_DEADLINE_INVALID");
      }

      if (c.failureConsequence === "PARTIAL_REFUND") {
        const pct = c.refundPercent;
        if (!Number.isInteger(pct) || (pct as number) < 1 || (pct as number) > 100) {
          pushOnce("COMMITMENTS_REFUND_INVALID");
        }
      }

      if (c.failureConsequence === "DEADLINE_EXTENSION_VOTE" && c.voteDurationDays != null) {
        const days = c.voteDurationDays;
        if (!Number.isInteger(days) || (days as number) < 1 || (days as number) > 14) {
          pushOnce("COMMITMENTS_INVALID");
        }
      }
    }
  }

  if (funding.deadline) {
    if (!isLikelyISODate(funding.deadline)) errors.push("DEADLINE_INVALID");
  }

  // NOTE: projectURI is generated automatically from the draft and pinned to IPFS
  // at the moment funding is opened (so we don't block the creator with manual CIDs).

  const currency = (funding.currency ?? "").trim().toUpperCase();
  const tokenAddr = (funding.tokenAddress ?? "").trim();
  const looksLikeAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v);

  // If the currency isn't USDC, require an explicit ERC-20 token address.
  if (currency && currency !== "USDC") {
    if (!tokenAddr || !looksLikeAddress(tokenAddr)) errors.push("MISSING_TOKEN_ADDRESS");
    const dec = funding.tokenDecimals;
    if (!Number.isInteger(dec) || (dec as number) < 0 || (dec as number) > 30) {
      errors.push("TOKEN_DECIMALS_INVALID");
    }
  } else {
    // For USDC we'll allow tokenAddress to be empty (app can inject a default from env).
    if (tokenAddr && !looksLikeAddress(tokenAddr)) errors.push("MISSING_TOKEN_ADDRESS");
  }

  return { ok: errors.length === 0, errors };
}
