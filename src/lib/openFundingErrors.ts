export type OpenFundingError = {
  code: string;
  message: string;
  field?: string;
};

export function normalizeOpenFundingErrors(data: unknown): OpenFundingError[] {
  if (!data || typeof data !== "object") return [{ code: "UNKNOWN", message: "Validation failed." }];

  const errors = (data as { errors?: unknown }).errors;

  // Structured format: errors as objects
  if (Array.isArray(errors) && errors.length && errors[0] && typeof errors[0] === "object") {
    return errors.map((raw) => {
      const obj = raw as Record<string, unknown>;
      return {
        code: String(obj.code ?? "UNKNOWN"),
        message: String(obj.message ?? "Validation failed."),
        field: obj.field ? String(obj.field) : undefined,
      };
    });
  }

  // Legacy format: errors as string codes
  if (Array.isArray(errors) && typeof errors[0] === "string") {
    return errors.map((code) => ({
      code,
      message: humanizeErrorCode(code),
      field: fieldFromCode(code),
    }));
  }

  return [{ code: "UNKNOWN", message: "Validation failed." }];
}

function humanizeErrorCode(code: string): string {
  const map: Record<string, string> = {
    MISSING_TITLE: "Title is required.",
    MISSING_CATEGORY: "Category is required.",
    DEFINITION_TOO_LONG: "Project definition exceeds the limit.",
    DEFINITION_HAS_LINKS: "Project definition must not contain links.",
    OTHER_DEFINITION_TOO_LONG: "For Other, definition must be 200 characters or less.",
    OTHER_DELIVERABLE_EXAMPLE_REQUIRED: "For Other, an example deliverable is required.",
    OTHER_DELIVERABLE_EXAMPLE_INVALID: "Example deliverable must be 150 characters or less and not contain links or conditionals.",
    MISSING_FUNDING: "Funding structure is incomplete.",
    FUNDING_INCOMPLETE: "Funding structure is incomplete.",
    DEADLINE_INVALID: "Deadline is invalid.",
    MISSING_COMMITMENTS: "At least one commitment is required.",
    COMMITMENTS_TOO_MANY: "At most 5 commitments are allowed.",
    COMMITMENTS_INVALID: "Some commitments are invalid or incomplete.",
    COMMITMENTS_DEADLINE_INVALID: "Some commitment deadlines are invalid.",
    COMMITMENTS_HAVE_CONDITIONALS: "Commitments must not contain conditionals (aim/hope/try/plan/etc).",
    COMMITMENTS_DETAILS_HAS_LINKS: "Commitment details must not contain links.",
    COMMITMENTS_REFUND_INVALID: "Partial refund commitments must include a percent (1–100).",
    MISSING_PROJECT_URI: "Project URI (IPFS) is required for on-chain deployment.",
    MISSING_TOKEN_ADDRESS: "Accepted token address is required (or must be a valid 0x address).",
    TOKEN_DECIMALS_INVALID: "Token decimals must be a reasonable integer.",
  };
  return map[code] ?? "Some required parts are missing.";
}

function fieldFromCode(code: string): string | undefined {
  const map: Record<string, string> = {
    MISSING_TITLE: "title",
    MISSING_CATEGORY: "category",
    DEFINITION_TOO_LONG: "definition",
    DEFINITION_HAS_LINKS: "definition",
    OTHER_DEFINITION_TOO_LONG: "definition",
    OTHER_DELIVERABLE_EXAMPLE_REQUIRED: "definition",
    OTHER_DELIVERABLE_EXAMPLE_INVALID: "definition",
    MISSING_FUNDING: "funding",
    FUNDING_INCOMPLETE: "funding",
    DEADLINE_INVALID: "funding",
    MISSING_COMMITMENTS: "commitments",
    COMMITMENTS_TOO_MANY: "commitments",
    COMMITMENTS_INVALID: "commitments",
    COMMITMENTS_DEADLINE_INVALID: "commitments",
    COMMITMENTS_HAVE_CONDITIONALS: "commitments",
    COMMITMENTS_DETAILS_HAS_LINKS: "commitments",
    COMMITMENTS_REFUND_INVALID: "commitments",
    MISSING_PROJECT_URI: "funding",
    MISSING_TOKEN_ADDRESS: "funding",
    TOKEN_DECIMALS_INVALID: "funding",
  };
  return map[code];
}
