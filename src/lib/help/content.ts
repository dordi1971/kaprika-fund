export type HelpSection = { title: string; bullets: string[] };

export type HelpEntry = {
  title: string;
  summary: string;
  sections: HelpSection[];
};

export const HELP_CONTENT: Record<string, HelpEntry> = {
  home: {
    title: "Kaprika // What is happening here",
    summary: "Kaprika is crowdfunding + governance. The chain enforces money and rules. IPFS explains meaning.",
    sections: [
      {
        title: "Hard vs Soft",
        bullets: [
          "Hard terms live on-chain (funds, rules, votes).",
          "Soft terms live in the manifest (story, commitments, context).",
        ],
      },
    ],
  },

  observe: {
    title: "Observe // Index of projects",
    summary: "This list is global. It does not care who you are.",
    sections: [
      {
        title: "What you can do",
        bullets: [
          "Open any project and inspect its current state.",
          "If funding is open, you can acquire STAMP for that project.",
        ],
      },
      {
        title: "What the numbers mean",
        bullets: [
          "Raised/Target is enforced on-chain.",
          "Descriptions come from the project manifest (IPFS).",
        ],
      },
    ],
  },

  desk: {
    title: "Desk // Your assets and signals",
    summary: "This list is filtered by your wallet: creator, STAMP holder, or locked STAMP.",
    sections: [
      {
        title: "What counts as 'mine'",
        bullets: ["You are the creator, OR", "You hold STAMP, OR", "You have STAMP locked for voting."],
      },
      {
        title: "Notifications",
        bullets: ["Votes appear when active.", "State-change signals appear after you’ve seen an earlier state."],
      },
    ],
  },

  propose: {
    title: "Propose // Draft → Manifest → On-chain",
    summary: "You build a draft off-chain, pin a manifest to IPFS, then open funding on-chain.",
    sections: [
      {
        title: "Flow",
        bullets: ["Draft (editable) → Pin manifest (frozen text) → Open funding (hard terms)."],
      },
      {
        title: "Immutability",
        bullets: [
          "After funding opens, structure should be treated as immutable.",
          "If you change meaning, create a new project instead.",
        ],
      },
    ],
  },

  onchainProject: {
    title: "Project // Funding and governance",
    summary: "This page shows the enforceable state of a single project, plus the manifest context.",
    sections: [
      {
        title: "Funding",
        bullets: ["If Funding Open: you can acquire STAMP.", "When target is met: governance phase begins."],
      },
      {
        title: "Governance",
        bullets: ["Votes exist only when proposals exist.", "Locked STAMP determines voting weight."],
      },
    ],
  },
};
