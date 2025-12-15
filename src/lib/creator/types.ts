export type ProjectStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "FAILED";

export type FundingCurrency = "USDC";
export type ReleaseModel = "MILESTONE" | "LINEAR" | "MANUAL";

export type Commitment = {
  deliverable: string;
  deadline: string;
  verification: string;
  failureConsequence: string;
};

export type ProjectFunding = {
  currency: FundingCurrency | null;
  target: string | null;
  minimumAllocation: string | null;
  deadline: string | null;
  releaseModel: ReleaseModel | null;
  raised: string | null;
  contractAddress: string | null;
};

export type ProjectCore = {
  title: string | null;
  category: string | null;
  definition: string | null;
  explanation: string | null;
};

export type ProjectRecord = {
  id: string;
  creatorAddress: string;
  status: ProjectStatus;
  core: ProjectCore;
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

