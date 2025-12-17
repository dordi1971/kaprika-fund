export type ProjectStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "FAILED";

/**
 * Display label only.
 *
 * On-chain we use `funding.tokenAddress` + `funding.tokenDecimals`.
 * Keeping this as `string` lets you use labels like "USDC", "KPFT", etc.
 */
export type FundingCurrency = string;
export type ReleaseModel = "MILESTONE" | "LINEAR" | "MANUAL";

import type { Commitment, ProjectCategory } from "@/lib/commitments";

export type { Commitment, ProjectCategory };

export type ProjectFunding = {
  currency: FundingCurrency | null;
  /** ERC-20 token accepted by the project contract (optional if currency is USDC and app has a default USDC address). */
  tokenAddress: string | null;
  /** Decimals for `tokenAddress` (6 for USDC, 18 for most ERC-20). */
  tokenDecimals: number | null;
  target: string | null;
  minimumAllocation: string | null;
  deadline: string | null;
  releaseModel: ReleaseModel | null;
  raised: string | null;

  /** Immutable URIs written into the on-chain project contract. */
  projectURI: string | null;
  stampURI: string | null;

  /** On-chain deployment details (set once funding is opened). */
  contractAddress: string | null;
  chainId: number | null;
  onchainProjectId: number | null;
  openedTxHash: string | null;

  /** Resolved accepted token address actually used in the contract init (useful when currency label is "USDC"). */
  acceptedToken: string | null;

  /** Governance defaults (mirrors on-chain init params). */
  voteDurationDays: number | null;
  quorumBps: number | null;
};

export type ProjectCore = {
  title: string | null;
  category: ProjectCategory | null;
  definition: string | null;
  deliverableExample: string | null;
  explanation: string | null;
};

export type ExternalLinkType =
  | "website"
  | "docs"
  | "media"
  | "repo"
  | "audit"
  | "social"
  | "other";

export type ExternalLink = {
  /** Stable ID for React keys + reordering. */
  id: string;
  type: ExternalLinkType;
  label: string;
  url: string;
};

export type ProjectRecord = {
  id: string;
  creatorAddress: string;
  status: ProjectStatus;
  core: ProjectCore;
  externalLinks: ExternalLink[];
  funding: ProjectFunding;
  commitments: Commitment[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  closedAt: string | null;
  version: number;
};

export type ProjectEventType =
  | "CREATED"
  | "EDITED"
  | "COMMITMENTS_UPDATED"
  | "FUNDING_OPENED"
  | "STATUS_CHANGED";

export type ProjectEvent = {
  id: string;
  projectId: string;
  type: ProjectEventType;
  timestamp: string;
  actorAddress: string;
  payload?: Record<string, unknown>;
};

export type PublishReadiness = "INCOMPLETE" | "READY";
