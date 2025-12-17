export const PROJECT_CATEGORIES = [
  { value: "SOFTWARE", label: "Software" },
  { value: "HARDWARE", label: "Hardware" },
  { value: "MEDIA", label: "Media (film/music/podcast)" },
  { value: "PUBLISHING", label: "Publishing (book/article/research report)" },
  { value: "GAMES", label: "Games" },
  { value: "EDUCATION", label: "Education" },
  { value: "SCIENCE_TOOLS", label: "Science & Tools (datasets, models, instrumentation, open tools)" },
  { value: "COMMUNITY_PUBLIC_GOODS", label: "Community & Public Goods" },
  { value: "ENVIRONMENT", label: "Environment" },
  { value: "OTHER", label: "Other" },
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]["value"];

export const DELIVERABLE_TYPES = [
  { value: "PROTOTYPE", label: "Prototype" },
  { value: "ALPHA", label: "Alpha release" },
  { value: "BETA", label: "Beta release" },
  { value: "PUBLIC_RELEASE", label: "Public release" },
  { value: "MFG_BATCH", label: "Manufacturing batch" },
  { value: "SHIPMENT", label: "Shipment" },
  { value: "AUDIT_REVIEW", label: "Audit / Review" },
  { value: "EVENT_SCREENING", label: "Event / Screening" },
  { value: "REPORT_DATASET", label: "Report / Dataset" },
  { value: "GOV_ACTION", label: "Governance action (vote, proposal executed)" },
] as const;

export type DeliverableType = (typeof DELIVERABLE_TYPES)[number]["value"];

export const VERIFICATION_METHODS = [
  { value: "PUBLIC_LINK", label: "Public link (repo/tag, release page, published report)" },
  { value: "ONCHAIN_PROOF", label: "On-chain proof (tx / attestation / contract event)" },
  { value: "THIRD_PARTY_DOC", label: "Third-party document (audit, lab test, certification)" },
  { value: "DELIVERY_EVIDENCE", label: "Delivery evidence (tracking numbers / receipts)" },
  { value: "COMMUNITY_VOTE", label: "Community verification vote" },
] as const;

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]["value"];

export const FAILURE_CONSEQUENCES = [
  { value: "FULL_REFUND", label: "Full refund" },
  { value: "PARTIAL_REFUND", label: "Partial refund (X%)" },
  { value: "PAUSE_UNTIL_RESOLVED", label: "Funding pause until resolved" },
  { value: "DEADLINE_EXTENSION_VOTE", label: "Deadline extension requires contributor vote" },
  { value: "OPEN_SOURCE_RELEASE", label: "Convert to open-source / public release of current work" },
  { value: "MILESTONE_REMOVED_ESCROW", label: "Milestone removed → funds return to escrow" },
] as const;

export type FailureConsequence = (typeof FAILURE_CONSEQUENCES)[number]["value"];

export type Commitment = {
  deliverableType: DeliverableType;
  deadline: string; // YYYY-MM-DD
  verificationMethod: VerificationMethod;
  verificationDetails: string; // <=150
  failureConsequence: FailureConsequence;
  refundPercent?: number; // if PARTIAL_REFUND
  voteDurationDays?: number; // if DEADLINE_EXTENSION_VOTE (optional)
  details: string; // <=150, no links, no conditionals
};

export const BANNED_CONDITIONAL_WORDS = [
  "aim",
  "aims",
  "aiming",
  "hope",
  "hopes",
  "hoping",
  "try",
  "tries",
  "trying",
  "plan",
  "plans",
  "planned",
  "planning",
  "intend",
  "intends",
  "intended",
  "intending",
  "maybe",
  "might",
  "likely",
  "approximately",
  "around",
  "soon",
  "later",
] as const;

const CONDITIONAL_RE = new RegExp(`\\b(${BANNED_CONDITIONAL_WORDS.join("|")})\\b`, "i");

export function hasConditionals(text: string) {
  return CONDITIONAL_RE.test(text);
}

const LINK_RE = /(https?:\/\/|\bwww\.)/i;

export function hasLink(text: string) {
  return LINK_RE.test(text);
}

export function isLikelyISODate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.valueOf());
}
