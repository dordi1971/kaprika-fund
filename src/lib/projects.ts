import type { ProjectRecord, ProjectState } from "@/lib/types";

export const PROJECTS: ProjectRecord[] = [
  {
    id: "A7F3D1C2",
    numericId: "091",
    title: "Hyper_Local_Logistics",
    category: "Service",
    state: "active",
    createdAt: "2025-11-02",
    creator: "0x9c5A3B2d1F8e0cA4cD2a1b7E0f3a9012Bf3c0a12",
    definition:
      "Define a logistics micro-network across three neighborhoods, with verifiable delivery metrics and escrowed milestone releases.",
    funding: {
      target: 60000,
      raised: 45200,
      currency: "USDC",
      minimumAllocation: 25,
      deadline: "2026-01-14",
      releaseModel: "milestone-based",
      refundConditions:
        "If milestones are not confirmed by the deadline, refunds return to contributors.",
      contract: "0x18d2b9a7e3c0f2a4b8c6d9a1f0e2c4b6d8a0c2e4",
      milestones: ["Pilot route coverage", "Delivery SLA proof", "Public metrics"],
    },
    commitments: [
      {
        deliverable: "Prototype operations runbook",
        deadline: "2026-01-30",
        verification: "Third-party report",
        failureConsequence: "Refund",
      },
      {
        deliverable: "Pilot with 50 deliveries/day",
        deadline: "2026-02-28",
        verification: "On-chain attestations",
        failureConsequence: "Partial refund",
      },
      {
        deliverable: "Quarterly public metrics feed",
        deadline: "2026-03-31",
        verification: "Signed data releases",
        failureConsequence: "Refund",
      },
    ],
    explanation:
      "Local logistics fails when incentives are implicit. This project defines explicit service constraints and releases funds only when those constraints can be verified.\n\nThis is not an attempt to out-market incumbents. It is a structure for accountability.",
    links: [
      { label: "Specification draft", href: "https://example.com/spec" },
      { label: "Verification methodology", href: "https://example.com/verify" },
    ],
    history: [
      { at: "2025-11-02", event: "Project created" },
      { at: "2025-11-04", event: "Funding opened" },
      { at: "2025-11-10", event: "Milestones defined" },
      { at: "2025-11-18", event: "Raised 25%" },
      { at: "2025-11-26", event: "Explanation updated" },
      { at: "2025-12-03", event: "Raised 50%" },
      { at: "2025-12-09", event: "Terms reviewed" },
      { at: "2025-12-12", event: "Raised 75%" },
      { at: "2025-12-13", event: "Observer traffic spike recorded" },
    ],
  },
  {
    id: "0B4E9A11",
    numericId: "090",
    title: "Urban_Sensor_Grid_Protocol",
    category: "Hardware",
    state: "draft",
    createdAt: "2025-12-01",
    creator: "0x6aF0c2b71a2C9dE8F4c1B7A0a9d2E3f4c1B7a0a9",
    definition:
      "Design a public sensor grid with explicit data governance, with funding terms published before deployment begins.",
    funding: {
      target: 150000,
      raised: 0,
      currency: "USDC",
      minimumAllocation: 25,
      deadline: "2026-03-01",
      releaseModel: "milestone-based",
      refundConditions:
        "Funding does not open until commitments and verification are defined.",
      contract: "0x0000000000000000000000000000000000000000",
      milestones: ["Bill of materials", "Pilot deployment", "Governance publish"],
    },
    commitments: [
      {
        deliverable: "Commitments + verification finalized",
        deadline: "2025-12-20",
        verification: "Internal validation rule",
        failureConsequence: "Project cannot go Active",
      },
    ],
    explanation:
      "Drafts are visible. Definitions can be read. Funding does not open without commitments.",
    history: [
      { at: "2025-12-01", event: "Project created" },
      { at: "2025-12-05", event: "Funding structure drafted" },
      { at: "2025-12-08", event: "Milestones drafted" },
    ],
  },
  {
    id: "C2D8F0AA",
    numericId: "089",
    title: "Mesh_Network_Alpha_Node",
    category: "Infrastructure",
    state: "active",
    createdAt: "2025-10-12",
    creator: "0x2a9012Bf3c0a129c5A3B2d1F8e0cA4cD2a1b7E0f",
    definition:
      "Deploy a first alpha node for a mesh network, publishing routing behavior and funding terms as a record, not a pitch.",
    funding: {
      target: 50000,
      raised: 12400,
      currency: "USDC",
      minimumAllocation: 25,
      deadline: "2026-01-02",
      releaseModel: "all-or-nothing",
      refundConditions:
        "If the target is not met by the deadline, funds return automatically.",
      contract: "0x4b6d8a0c2e418d2b9a7e3c0f2a4b8c6d9a1f0e2c",
    },
    commitments: [
      {
        deliverable: "Public routing spec",
        deadline: "2026-01-10",
        verification: "Signed document + hash",
        failureConsequence: "Refund",
      },
      {
        deliverable: "Alpha node deployment",
        deadline: "2026-01-20",
        verification: "Uptime + public endpoint",
        failureConsequence: "Refund",
      },
    ],
    explanation:
      "A mesh node is only useful if its behavior is legible. This record prioritizes specification and auditable terms.",
    history: [
      { at: "2025-10-12", event: "Project created" },
      { at: "2025-10-13", event: "Funding opened" },
      { at: "2025-10-20", event: "Raised 10%" },
      { at: "2025-11-05", event: "Raised 20%" },
      { at: "2025-12-01", event: "Raised 24%" },
    ],
  },
  {
    id: "D9912C0E",
    numericId: "087",
    title: "Zero_Knowledge_Archive_Tool",
    category: "Privacy",
    state: "completed",
    createdAt: "2025-08-18",
    creator: "0x1b7E0f3a9012Bf3c0a129c5A3B2d1F8e0cA4cD2a",
    definition:
      "Deliver a tool for creating verifiable, privacy-preserving archives, with terms recorded before funding.",
    funding: {
      target: 25000,
      raised: 25000,
      currency: "USDC",
      minimumAllocation: 25,
      deadline: "2025-10-01",
      releaseModel: "milestone-based",
      refundConditions:
        "If verification is not met per milestone, refunds return to contributors.",
      contract: "0x9a7e3c0f2a4b8c6d9a1f0e2c4b6d8a0c2e418d2b",
      milestones: ["Core proof generation", "CLI tooling", "Documentation"],
    },
    commitments: [
      {
        deliverable: "Proof generation module",
        deadline: "2025-09-10",
        verification: "Reproducible build hash",
        failureConsequence: "Refund",
      },
      {
        deliverable: "CLI tool release",
        deadline: "2025-09-22",
        verification: "Tagged release + checksums",
        failureConsequence: "Partial refund",
      },
      {
        deliverable: "Docs + examples",
        deadline: "2025-09-30",
        verification: "Public doc snapshot",
        failureConsequence: "Refund",
      },
    ],
    explanation:
      "Completed projects remain visible. The record does not disappear because it succeeded.",
    history: [
      { at: "2025-08-18", event: "Project created" },
      { at: "2025-08-20", event: "Funding opened" },
      { at: "2025-09-05", event: "Raised 60%" },
      { at: "2025-09-12", event: "Raised 100%" },
      { at: "2025-09-30", event: "Milestone #3 confirmed" },
      { at: "2025-10-01", event: "State changed: Completed" },
    ],
  },
  {
    id: "EE41B77A",
    numericId: "088",
    title: "Algorithmic_Poetry_DAO",
    category: "Art / Code",
    state: "failed",
    createdAt: "2025-07-02",
    creator: "0xf4c1B7A0a9d2E3f4c1B7a0a96aF0c2b71a2C9dE8",
    definition:
      "Publish an auditable distribution rule-set for generative poetry grants, including failure conditions and refunds.",
    funding: {
      target: 10000,
      raised: 400,
      currency: "USDC",
      minimumAllocation: 25,
      deadline: "2025-08-01",
      releaseModel: "all-or-nothing",
      refundConditions:
        "If the target is not met, funds return. If rules are not published, the project cannot go Active.",
      contract: "0x0e2c4b6d8a0c2e418d2b9a7e3c0f2a4b8c6d9a1f",
    },
    commitments: [
      {
        deliverable: "Distribution rules published",
        deadline: "2025-07-15",
        verification: "Signed ruleset hash",
        failureConsequence: "Refund",
      },
    ],
    explanation:
      "Failed projects remain visible. No hiding. No shame. Just record.",
    history: [
      { at: "2025-07-02", event: "Project created" },
      { at: "2025-07-05", event: "Funding opened" },
      { at: "2025-07-12", event: "Raised 4%" },
      { at: "2025-08-01", event: "Funding ended: Target not met" },
      { at: "2025-08-02", event: "State changed: Failed" },
    ],
  },
];

export function getProjectById(id: string) {
  const normalized = id.trim();
  return PROJECTS.find((project) => project.id === normalized) ?? null;
}

export function badgeClassForState(state: ProjectState) {
  switch (state) {
    case "active":
      return "badgeActive";
    case "completed":
      return "badgeCompleted";
    case "failed":
      return "badgeFailed";
    case "draft":
      return "badgeDraft";
  }
}

export function stateLabel(state: ProjectState) {
  switch (state) {
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "draft":
      return "Drafting";
  }
}

