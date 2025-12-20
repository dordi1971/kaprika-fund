import type { Commitment } from "@/lib/commitments";
import type { ExternalLink, ProjectRecord, ProjectStatus } from "./types";
import { ExternalLinksPublishSchema } from "./schemas";

export type ProjectManifestV1 = {
  schema: "kaprika.project.v1";
  projectId: string;
  status: Exclude<ProjectStatus, "DRAFT"> | "DRAFT";

  creator: string;
  createdAt: string;
  publishedAt: string | null;

  title: string;
  category: string;
  definition: string;
  deliverableExample: string | null;
  explanation: string | null;

  funding: {
    currency: string;
    tokenAddress: string | null;
    tokenDecimals: number | null;
    acceptedToken: string | null;
    target: string;
    minimumAllocation: string;
    deadline: string;
    releaseModel: string;
    milestonePlan:
      | {
          initialPercent: number;
          milestones: Array<{
            name: string;
            percent: number;
          }>;
        }
      | null;
    projectURI: string | null;
    stampURI: string | null;
    contractAddress: string | null;
    chainId: number | null;
    onchainProjectId: number | null;
  };

  commitments: Commitment[];

  externalLinks: Array<Pick<ExternalLink, "type" | "label" | "url">>;

  // Convenience fields for NFT marketplaces / explorers (optional).
  name: string;
  description: string;
  attributes: Array<{ trait_type: string; value: string }>;
};

function cleanText(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function buildDescription(project: ProjectRecord) {
  const def = cleanText(project.core.definition) ?? "";
  const exp = cleanText(project.core.explanation);
  return exp ? `${def}\n\n${exp}` : def;
}

/**
 * Build the *immutable* snapshot intended to be pinned to IPFS.
 *
 * IMPORTANT: don't include dynamic fields (like raised) here.
 */
export function buildProjectManifest(project: ProjectRecord): ProjectManifestV1 {
  // Filter out empty draft rows before validation.
  const externalLinksCandidate = (project.externalLinks ?? [])
    .map((l) => ({ ...l, label: l.label?.trim?.() ?? "", url: l.url?.trim?.() ?? "" }))
    .filter((l) => l.label.length || l.url.length);

  const parsedLinks = ExternalLinksPublishSchema.safeParse(externalLinksCandidate);
  if (!parsedLinks.success) {
    const msg = parsedLinks.error.issues.map((i) => i.message).join("; ");
    throw new Error(`INVALID_EXTERNAL_LINKS: ${msg}`);
  }

  const title = cleanText(project.core.title) ?? "Untitled project";
  const category = cleanText(project.core.category) ?? "UNKNOWN";
  const definition = cleanText(project.core.definition) ?? "";

  const currency = project.funding.currency ?? "USDC";
  const tokenAddress = cleanText(project.funding.tokenAddress);
  const tokenDecimals = project.funding.tokenDecimals ?? null;
  const acceptedToken = cleanText(project.funding.acceptedToken);
  const target = cleanText(project.funding.target) ?? "";
  const minimumAllocation = cleanText(project.funding.minimumAllocation) ?? "";
  const deadline = cleanText(project.funding.deadline) ?? "";
  const releaseModel = cleanText(project.funding.releaseModel) ?? "";
  const milestonePlan = project.funding.milestonePlan
    ? {
        initialPercent: Number(project.funding.milestonePlan.initialPercent ?? 0),
        milestones: (project.funding.milestonePlan.milestones ?? []).map((m, idx) => ({
          name: cleanText(m.name) ?? `Milestone ${idx + 1}`,
          percent: Number(m.percent ?? 0),
        })),
      }
    : null;
  const projectURI = cleanText(project.funding.projectURI);
  const stampURI = cleanText(project.funding.stampURI);

  const attributes: ProjectManifestV1["attributes"] = [
    { trait_type: "Category", value: category },
    { trait_type: "Currency", value: String(currency) },
    { trait_type: "Release model", value: releaseModel || "" },
  ].filter((a) => a.value.trim().length > 0);

  return {
    schema: "kaprika.project.v1",
    projectId: project.id,
    status: project.status,
    creator: project.creatorAddress,
    createdAt: project.createdAt,
    publishedAt: project.publishedAt,

    title,
    category,
    definition,
    deliverableExample: cleanText(project.core.deliverableExample),
    explanation: cleanText(project.core.explanation),

    funding: {
      currency: String(currency),
      tokenAddress,
      tokenDecimals,
      acceptedToken,
      target,
      minimumAllocation,
      deadline,
      releaseModel,
      milestonePlan,
      projectURI,
      stampURI,
      contractAddress: project.funding.contractAddress ?? null,
      chainId: project.funding.chainId ?? null,
      onchainProjectId: project.funding.onchainProjectId ?? null,
    },

    commitments: project.commitments ?? [],
    externalLinks: parsedLinks.data.map(({ type, label, url }) => ({ type, label, url })),

    // NFT-friendly convenience
    name: title,
    description: buildDescription(project),
    attributes,
  };
}
