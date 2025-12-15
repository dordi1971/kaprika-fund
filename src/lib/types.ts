export type ProjectState = "draft" | "active" | "completed" | "failed";

export type ReleaseModel = "milestone-based" | "all-or-nothing";

export type LinkItem = {
  label: string;
  href: string;
};

export type Commitment = {
  deliverable: string;
  deadline: string;
  verification: string;
  failureConsequence: string;
};

export type HistoryEvent = {
  at: string; // YYYY-MM-DD
  event: string;
};

export type FundingStructure = {
  target: number;
  raised: number;
  currency: "USDC";
  minimumAllocation: number;
  deadline: string; // YYYY-MM-DD
  releaseModel: ReleaseModel;
  refundConditions: string;
  contract: string; // 0x...
  milestones?: string[];
};

export type ProjectRecord = {
  id: string; // short hash-like ID
  numericId: string; // table-friendly
  title: string;
  category: string;
  state: ProjectState;
  createdAt: string; // YYYY-MM-DD
  creator: string; // 0x...
  definition: string;
  explanation?: string;
  links?: LinkItem[];
  funding: FundingStructure;
  commitments: Commitment[];
  history: HistoryEvent[];
};

