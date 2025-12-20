import type { OnchainObserverProject } from "@/lib/observe/onchainIndex";

export type DeskPosition = {
  isCreator: boolean;
  blueBalance: string; // integer string
  blueLocked: string;  // integer string
};

export type DeskLatestProposal = {
  id: string;
  kind: number; // 0=RELEASE, 1=SET_PARAM
  trancheIndex: number;
  to: `0x${string}`;
  startTime: string;
  endTime: string;
  forVotes: string;
  againstVotes: string;
  executed: boolean;
  paramKey: number;
  paramValue: string;
};

export type DeskProject = OnchainObserverProject & {
  position: DeskPosition;
  latestProposal?: DeskLatestProposal;

  // Desk-only field (Phase 1 notifications)
  nextProposalId?: string; // "0", "1", ...
};

