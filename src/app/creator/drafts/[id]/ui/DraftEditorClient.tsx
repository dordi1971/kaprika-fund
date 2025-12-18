"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { decodeEventLog } from "viem";
import type { Commitment, ProjectRecord } from "@/lib/creator/types";
import { validateOpenFunding, type PublishValidationError } from "@/lib/creator/validation";
import ExternalLinksEditor from "./ExternalLinksEditor";
import { ERC20Abi, KaprikaProjectFactoryAbi } from "@/lib/contracts/abis";
import { DEFAULT_STAMP_URI, DEFAULT_USDC_ADDRESS, KAPRIKA_FACTORY_ADDRESS, POLYGON_CHAIN_ID } from "@/lib/contracts/addresses";
import {
  ceilDiv,
  dateToDeadlineUnixSeconds,
  defaultReleaseBps,
  daysToSeconds,
  isHexAddress,
  parseTokenAmount,
} from "@/lib/contracts/helpers";
import {
  DELIVERABLE_TYPES,
  FAILURE_CONSEQUENCES,
  PROJECT_CATEGORIES,
  VERIFICATION_METHODS,
  hasConditionals,
  hasLink,
  isLikelyISODate,
  type DeliverableType,
  type FailureConsequence,
  type ProjectCategory,
  type VerificationMethod,
} from "@/lib/commitments";

type Props = {
  id: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type IssueField = "title" | "core" | "funding" | "commitments";

const FIELD_ANCHOR: Record<IssueField, string> = {
  title: "section-title",
  core: "section-core",
  funding: "section-funding",
  commitments: "section-commitments",
};

const pillFieldStyle: CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 999,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "inherit",
};

const pillFieldDisabledStyle: CSSProperties = {
  ...pillFieldStyle,
  color: "var(--muted)",
  background: "rgba(255,255,255,0.02)",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return iso;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(d);
}

type CommitmentDraft = {
  deliverableType: DeliverableType | "";
  deadline: string;
  verificationMethod: VerificationMethod | "";
  verificationDetails: string;
  failureConsequence: FailureConsequence | "";
  refundPercent: string;
  voteDurationDays: string;
  details: string;
};

function emptyCommitmentDraft(): CommitmentDraft {
  return {
    deliverableType: "",
    deadline: "",
    verificationMethod: "",
    verificationDetails: "",
    failureConsequence: "",
    refundPercent: "",
    voteDurationDays: "",
    details: "",
  };
}

function parseIntOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function distributePercents(total: number, n: number) {
  const count = Math.max(0, Math.trunc(n));
  if (count === 0) return [];
  const base = Math.floor(total / count);
  const out = Array.from({ length: count }, () => base);
  let acc = base * count;
  // Put the remainder on the last milestone for stability.
  out[count - 1] += total - acc;
  return out;
}

function addDaysToISODate(iso: string, days: number) {
  if (!isLikelyISODate(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.valueOf())) return null;
  d.setUTCDate(d.getUTCDate() + Math.max(0, Math.trunc(days)));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function milestoneSumPercent(project: ProjectRecord) {
  const plan = project.funding.milestonePlan;
  if (!plan) return null;
  const initial = Number(plan.initialPercent ?? 0);
  const milestones = plan.milestones ?? [];
  const sum = milestones.reduce((acc, m) => acc + Number(m.percent ?? 0), initial);
  return Number.isFinite(sum) ? sum : null;
}

function commitmentErrors(draft: CommitmentDraft): string[] {
  const errors: string[] = [];

  if (!draft.deliverableType) errors.push("Deliverable Type is required.");
  if (!draft.deadline.trim()) errors.push("Deadline is required.");
  if (draft.deadline.trim() && !isLikelyISODate(draft.deadline.trim())) errors.push("Deadline must be a valid date.");

  if (!draft.verificationMethod) errors.push("Verification Method is required.");
  if (!draft.verificationDetails.trim()) errors.push("Verification Details are required.");
  if (draft.verificationDetails.trim().length > 150) errors.push("Verification Details must be 150 characters or less.");
  if (hasConditionals(draft.verificationDetails)) errors.push("Verification Details must not contain conditionals.");

  if (!draft.failureConsequence) errors.push("Failure Consequence is required.");
  if (draft.failureConsequence === "PARTIAL_REFUND") {
    const pct = parseIntOrNull(draft.refundPercent);
    if (pct == null || !Number.isInteger(pct) || pct < 1 || pct > 100) {
      errors.push("Partial refund requires a percent (1–100).");
    }
  }

  if (draft.failureConsequence === "DEADLINE_EXTENSION_VOTE") {
    const days = parseIntOrNull(draft.voteDurationDays);
    if (days != null && (!Number.isInteger(days) || days < 1 || days > 14)) {
      errors.push("Vote duration must be 1–14 days (or left blank).");
    }
  }

  if (!draft.details.trim()) errors.push("Details are required.");
  if (draft.details.trim().length > 150) errors.push("Details must be 150 characters or less.");
  if (hasConditionals(draft.details)) errors.push("Details must not contain conditionals.");
  if (hasLink(draft.details)) errors.push("Details must not contain links (links belong in Verification Details).");

  return errors;
}

function toCommitment(draft: CommitmentDraft): Commitment | null {
  const errs = commitmentErrors(draft);
  if (errs.length) return null;

  const commitment: Commitment = {
    deliverableType: draft.deliverableType as DeliverableType,
    deadline: draft.deadline.trim(),
    verificationMethod: draft.verificationMethod as VerificationMethod,
    verificationDetails: draft.verificationDetails.trim(),
    failureConsequence: draft.failureConsequence as FailureConsequence,
    details: draft.details.trim(),
  };

  if (commitment.failureConsequence === "PARTIAL_REFUND") {
    commitment.refundPercent = parseIntOrNull(draft.refundPercent) ?? undefined;
  }

  if (commitment.failureConsequence === "DEADLINE_EXTENSION_VOTE") {
    const days = parseIntOrNull(draft.voteDurationDays);
    if (days != null) commitment.voteDurationDays = days;
  }

  return commitment;
}

function labelFor(items: ReadonlyArray<{ value: string; label: string }>, value: string | null | undefined) {
  if (!value) return "";
  return items.find((i) => i.value === value)?.label ?? value;
}

type CommitmentExample = {
  deliverableType: DeliverableType;
  deadline: string;
  verificationMethod: VerificationMethod;
  verificationDetails: string;
  failureConsequence: FailureConsequence;
  refundPercent?: number;
  details: string;
};

const COMMITMENT_EXAMPLES: Record<ProjectCategory, CommitmentExample[]> = {
  SOFTWARE: [
    {
      deliverableType: "BETA",
      deadline: "2026-03-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "github.com/org/repo/releases/tag/v0.9",
      failureConsequence: "PARTIAL_REFUND",
      refundPercent: 30,
      details: "Web app beta with auth + payment flow.",
    },
    {
      deliverableType: "PUBLIC_RELEASE",
      deadline: "2026-04-15",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Release page + tagged source + checksums",
      failureConsequence: "FULL_REFUND",
      details: "Public v1 release with install instructions.",
    },
  ],
  HARDWARE: [
    {
      deliverableType: "PROTOTYPE",
      deadline: "2026-02-10",
      verificationMethod: "THIRD_PARTY_DOC",
      verificationDetails: "Lab test report uploaded",
      failureConsequence: "PAUSE_UNTIL_RESOLVED",
      details: "Prototype unit passing basic functional test.",
    },
    {
      deliverableType: "MFG_BATCH",
      deadline: "2026-05-01",
      verificationMethod: "DELIVERY_EVIDENCE",
      verificationDetails: "Invoices + receipts for batch production",
      failureConsequence: "PARTIAL_REFUND",
      refundPercent: 25,
      details: "First manufacturing batch of 100 units.",
    },
  ],
  MEDIA: [
    {
      deliverableType: "EVENT_SCREENING",
      deadline: "2026-02-20",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Screening page with date/time",
      failureConsequence: "FULL_REFUND",
      details: "Public screening event with recording.",
    },
    {
      deliverableType: "PUBLIC_RELEASE",
      deadline: "2026-03-10",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Published episode/track link",
      failureConsequence: "PARTIAL_REFUND",
      refundPercent: 20,
      details: "Published episode with credits and transcript.",
    },
  ],
  PUBLISHING: [
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-01-31",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Public PDF + checksum",
      failureConsequence: "FULL_REFUND",
      details: "Research report v1 with references.",
    },
    {
      deliverableType: "PUBLIC_RELEASE",
      deadline: "2026-03-31",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Public manuscript snapshot",
      failureConsequence: "PAUSE_UNTIL_RESOLVED",
      details: "Book draft with table of contents.",
    },
  ],
  GAMES: [
    {
      deliverableType: "ALPHA",
      deadline: "2026-02-15",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Playable build download page",
      failureConsequence: "FULL_REFUND",
      details: "Playable alpha with 1 level and controls.",
    },
    {
      deliverableType: "BETA",
      deadline: "2026-04-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Beta build + patch notes",
      failureConsequence: "PARTIAL_REFUND",
      refundPercent: 30,
      details: "Beta with core loop and save system.",
    },
  ],
  EDUCATION: [
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-02-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Course materials page",
      failureConsequence: "FULL_REFUND",
      details: "Lesson set with exercises and solutions.",
    },
    {
      deliverableType: "PUBLIC_RELEASE",
      deadline: "2026-03-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Video archive + syllabus link",
      failureConsequence: "PAUSE_UNTIL_RESOLVED",
      details: "Published lectures with timestamps.",
    },
  ],
  SCIENCE_TOOLS: [
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-02-28",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Dataset release page + DOI",
      failureConsequence: "FULL_REFUND",
      details: "Dataset v1 with schema + license.",
    },
    {
      deliverableType: "PUBLIC_RELEASE",
      deadline: "2026-04-30",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Open tool release page",
      failureConsequence: "PARTIAL_REFUND",
      refundPercent: 20,
      details: "Open tool v1 with reproducible setup.",
    },
  ],
  COMMUNITY_PUBLIC_GOODS: [
    {
      deliverableType: "GOV_ACTION",
      deadline: "2026-01-20",
      verificationMethod: "ONCHAIN_PROOF",
      verificationDetails: "Transaction hash proving proposal executed",
      failureConsequence: "MILESTONE_REMOVED_ESCROW",
      details: "Proposal executed to fund the public good.",
    },
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-02-20",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Public transparency report link",
      failureConsequence: "FULL_REFUND",
      details: "Monthly report of spend and outcomes.",
    },
  ],
  ENVIRONMENT: [
    {
      deliverableType: "AUDIT_REVIEW",
      deadline: "2026-02-05",
      verificationMethod: "THIRD_PARTY_DOC",
      verificationDetails: "Certification/audit report published",
      failureConsequence: "FULL_REFUND",
      details: "Third-party audit of measurement method.",
    },
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-03-05",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Published measurements report",
      failureConsequence: "PAUSE_UNTIL_RESOLVED",
      details: "Public report with measurement data.",
    },
  ],
  OTHER: [
    {
      deliverableType: "PROTOTYPE",
      deadline: "2026-02-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Public artifact link",
      failureConsequence: "FULL_REFUND",
      details: "Concrete prototype artifact with instructions.",
    },
    {
      deliverableType: "REPORT_DATASET",
      deadline: "2026-03-01",
      verificationMethod: "PUBLIC_LINK",
      verificationDetails: "Published report link",
      failureConsequence: "PAUSE_UNTIL_RESOLVED",
      details: "Public report describing what was delivered.",
    },
  ],
};

function errorInfo(code: PublishValidationError): { message: string; field: IssueField } {
  switch (code) {
    case "MISSING_TITLE":
      return { message: "Title is required.", field: "title" };
    case "MISSING_CATEGORY":
      return { message: "Category is required.", field: "core" };
    case "DEFINITION_EMPTY":
      return { message: "Definition is required.", field: "core" };
    case "DEFINITION_TOO_LONG":
      return { message: "Definition exceeds 400 characters.", field: "core" };
    case "DEFINITION_HAS_LINKS":
      return { message: "Definition must not contain links.", field: "core" };
    case "OTHER_DEFINITION_TOO_LONG":
      return { message: "For Other, definition must be 200 characters or less.", field: "core" };
    case "OTHER_DELIVERABLE_EXAMPLE_REQUIRED":
      return { message: "For Other, an example deliverable is required.", field: "core" };
    case "OTHER_DELIVERABLE_EXAMPLE_INVALID":
      return { message: "Example deliverable must be ≤150 chars and not contain links or conditionals.", field: "core" };
    case "FUNDING_INCOMPLETE":
      return { message: "Funding structure is incomplete.", field: "funding" };
    case "DEADLINE_INVALID":
      return { message: "Deadline is invalid.", field: "funding" };
    case "PROJECT_URI_UPLOAD_FAILED":
      return {
        message:
          "Couldn't pin the project snapshot to IPFS (Storacha). Check STORACHA_KEY and provide STORACHA_PROOF (or STORACHA_PROOF_PATH / storacha-proof.txt).",
        field: "funding",
      };
    case "MISSING_TOKEN_ADDRESS":
      return { message: "Accepted token address is required (or must be a valid 0x address).", field: "funding" };
    case "TOKEN_DECIMALS_INVALID":
      return { message: "Token decimals must be a reasonable integer (0–30).", field: "funding" };
    case "MISSING_COMMITMENTS":
      return { message: "At least one commitment is required.", field: "commitments" };
    case "COMMITMENTS_TOO_MANY":
      return { message: "At most 5 commitments are allowed.", field: "commitments" };
    case "COMMITMENTS_INVALID":
      return { message: "Some commitments are invalid or incomplete.", field: "commitments" };
    case "COMMITMENTS_DEADLINE_INVALID":
      return { message: "Some commitment deadlines are invalid.", field: "commitments" };
    case "COMMITMENTS_HAVE_CONDITIONALS":
      return { message: "Commitments must not contain conditionals (aim/hope/try/plan/etc).", field: "commitments" };
    case "COMMITMENTS_DETAILS_HAS_LINKS":
      return { message: "Commitment details must not contain links.", field: "commitments" };
    case "COMMITMENTS_REFUND_INVALID":
      return { message: "Partial refund commitments must include a percent (1–100).", field: "commitments" };
    default:
      return { message: "Some required parts are missing.", field: "core" };
  }
}

function scrollToField(field: IssueField) {
  const id = FIELD_ANCHOR[field];
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function DraftEditorClient({ id }: Props) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirtyCoreFunding, setDirtyCoreFunding] = useState(false);
  const [dirtyCommitments, setDirtyCommitments] = useState(false);
  const saveTimerRef = useRef<number | null>(null);

  // Commitment builder
  const [commitmentDraft, setCommitmentDraft] = useState<CommitmentDraft>(() => emptyCommitmentDraft());
  const [editingCommitmentIndex, setEditingCommitmentIndex] = useState<number | null>(null);

  // Open funding UX
  const [openFundingErrors, setOpenFundingErrors] = useState<PublishValidationError[]>([]);
  const [openingFunding, setOpeningFunding] = useState(false);
  const [pinningManifest, setPinningManifest] = useState(false);

  // On-chain
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tokenMeta, setTokenMeta] = useState<
    { status: "idle" } | { status: "loading" } | { status: "ok" } | { status: "error"; message: string }
  >({ status: "idle" });
  const lastDetectedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project) return;

    const tokenAddress = (project.funding.tokenAddress ?? "").trim();
    if (!tokenAddress || !isHexAddress(tokenAddress)) {
      lastDetectedTokenRef.current = null;
      setTokenMeta({ status: "idle" });
      return;
    }

    // Auto-detect only on the active chain (wallet network).
    if (!publicClient || chainId !== POLYGON_CHAIN_ID) {
      setTokenMeta({ status: "idle" });
      return;
    }

    if (lastDetectedTokenRef.current === tokenAddress) return;

    let canceled = false;
    setTokenMeta({ status: "loading" });

    (async () => {
      const [symbolRaw, decimalsRaw] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: ERC20Abi, functionName: "symbol" }),
        publicClient.readContract({ address: tokenAddress, abi: ERC20Abi, functionName: "decimals" }),
      ]);

      const symbol = String(symbolRaw ?? "").trim();
      const decimals = Number(decimalsRaw as any);
      if (!symbol) throw new Error("TOKEN_SYMBOL_EMPTY");
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) throw new Error("TOKEN_DECIMALS_INVALID");

      if (canceled) return;
      lastDetectedTokenRef.current = tokenAddress;
      setTokenMeta({ status: "ok" });

      setProject((prev) => {
        if (!prev) return prev;
        if (prev.id !== project.id) return prev;

        const nextFunding = { ...prev.funding };
        let changed = false;

        if ((nextFunding.currency ?? "") !== symbol) {
          nextFunding.currency = symbol;
          changed = true;
        }
        if (nextFunding.tokenDecimals !== decimals) {
          nextFunding.tokenDecimals = decimals;
          changed = true;
        }

        return changed ? { ...prev, funding: nextFunding } : prev;
      });

      setDirtyCoreFunding(true);
      setSaveStatus("idle");
      if (openFundingErrors.length) setOpenFundingErrors([]);
    })().catch((err) => {
      if (canceled) return;
      setTokenMeta({ status: "error", message: err instanceof Error ? err.message : String(err) });
    });

    return () => {
      canceled = true;
    };
  }, [chainId, openFundingErrors.length, project, publicClient]);

  function hasIssue(field: IssueField) {
    return openFundingErrors.some((code) => errorInfo(code).field === field);
  }

  const readiness = useMemo(() => {
    if (!project) return { ok: false, errors: [] as PublishValidationError[] };
    return validateOpenFunding(project);
  }, [project]);

  const commitmentDraftErrors = useMemo(() => commitmentErrors(commitmentDraft), [commitmentDraft]);
  const commitmentDraftValue = useMemo(() => toCommitment(commitmentDraft), [commitmentDraft]);

  const duplicateCommitmentWarning = useMemo(() => {
    if (!project) return null;
    if (!commitmentDraftValue) return null;

    const same = project.commitments.findIndex((c, idx) => {
      if (editingCommitmentIndex != null && idx === editingCommitmentIndex) return false;
      return (
        c.deliverableType === commitmentDraftValue.deliverableType &&
        c.deadline === commitmentDraftValue.deadline &&
        c.details === commitmentDraftValue.details
      );
    });

    return same === -1 ? null : `Looks like a duplicate of Commitment ${same + 1}.`;
  }, [commitmentDraftValue, editingCommitmentIndex, project]);

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error("FAILED");
        const json = (await res.json()) as { project: ProjectRecord };
        if (!active) return;
        setProject(json.project);
        setCommitmentDraft(emptyCommitmentDraft());
        setEditingCommitmentIndex(null);
        setStatus("ready");
        setSaveStatus("idle");
        setDirtyCoreFunding(false);
        setDirtyCommitments(false);
        setOpenFundingErrors([]);
      } catch {
        if (!active) return;
        setStatus("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!project) return;
    if (!dirtyCoreFunding && !dirtyCommitments) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void save("auto");
    }, 1000);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [dirtyCommitments, dirtyCoreFunding, project]);

  async function save(mode: "auto" | "manual"): Promise<boolean> {
    if (!project) return false;
    if (!dirtyCoreFunding && !dirtyCommitments) return true;

    setSaveStatus("saving");

    try {
      let next = project;

      if (dirtyCoreFunding) {
        const patchRes = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ifMatchVersion: next.version,
            core: next.core,
            funding: next.funding,
            externalLinks: next.externalLinks,
          }),
        });

        if (patchRes.status === 409) {
          setSaveStatus("error");
          return false;
        }
        if (!patchRes.ok) throw new Error("FAILED");

        const patchJson = (await patchRes.json()) as { project: ProjectRecord };
        next = patchJson.project;
        setProject(next);
        setDirtyCoreFunding(false);
      }

      if (dirtyCommitments) {
        const commitRes = await fetch(`/api/projects/${encodeURIComponent(id)}/commitments`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ifMatchVersion: next.version,
            items: next.commitments,
          }),
        });

        if (commitRes.status === 409) {
          setSaveStatus("error");
          return false;
        }
        if (!commitRes.ok) throw new Error("FAILED");

        const commitJson = (await commitRes.json()) as { project: ProjectRecord };
        next = commitJson.project;
        setProject(next);
        setDirtyCommitments(false);
      }

      setSaveStatus("saved");
      setSavedAt(new Date().toISOString());
      if (mode === "manual") window.setTimeout(() => setSaveStatus("idle"), 800);
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  async function pinManifestNow() {
    if (!project) return;
    setPinningManifest(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/pin-manifest`, { method: "POST" });
      const raw = await res.text();
      const json = ((): any => {
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      if (!res.ok) {
        const msg = String(json?.error ?? json?.message ?? raw?.slice?.(0, 200) ?? `HTTP_${res.status}`);
        throw new Error(msg);
      }
      if (!json || !("project" in json)) throw new Error("INVALID_RESPONSE");
      setProject((json as any).project as ProjectRecord);
      setDirtyCoreFunding(false);
      setSaveStatus("saved");
      setSavedAt(new Date().toISOString());
      if (openFundingErrors.length) setOpenFundingErrors([]);
    } catch (err) {
      console.error("Pin manifest failed:", err);
      const msg = err instanceof Error ? err.message : "PIN_FAILED";
      window.alert(msg);
      setOpenFundingErrors(["PROJECT_URI_UPLOAD_FAILED"]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setPinningManifest(false);
    }
  }

  async function openFunding() {
    if (!project) return;

    setOpenFundingErrors([]);
    setOpeningFunding(true);

    // 0) Ensure server sees latest state (server validates server-side store)
    if (dirtyCoreFunding || dirtyCommitments) {
      const okSave = await save("manual");
      if (!okSave) {
        setOpenFundingErrors(["FUNDING_INCOMPLETE"]); // a calm generic “cannot proceed”
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpeningFunding(false);
        return;
      }
    }

    // 1) Validate via API (source of truth)
    const vRes = await fetch(`/api/projects/${encodeURIComponent(id)}/validate-open`, { method: "POST" });
    const vJson = (await vRes.json().catch(() => null)) as { ok?: boolean; errors?: PublishValidationError[] } | null;

    const issues = (vJson?.ok ? [] : vJson?.errors) ?? [];
    if (issues.length) {
      setOpenFundingErrors(issues);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setOpeningFunding(false);
      return;
    }

    // 2) Lock confirmation
    const ok = window.confirm("Opening funding locks the structure. Explanation may change, structure may not.");
    if (!ok) {
      setOpeningFunding(false);
      return;
    }

    try {
      // 3) Deploy on-chain (factory -> clone)
      if (!isConnected || !address) {
        setOpenFundingErrors(["FUNDING_INCOMPLETE"]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpeningFunding(false);
        return;
      }
      if (chainId !== POLYGON_CHAIN_ID) {
        setOpenFundingErrors(["FUNDING_INCOMPLETE"]);
        alert("Please switch your wallet network to Polygon (chainId 137) and try again.");
        setOpeningFunding(false);
        return;
      }

      if (!isHexAddress(KAPRIKA_FACTORY_ADDRESS)) {
        setOpenFundingErrors(["FUNDING_INCOMPLETE"]);
        alert("Missing NEXT_PUBLIC_KAPRIKA_FACTORY_ADDRESS.");
        setOpeningFunding(false);
        return;
      }

      const currencyLabel = (project.funding.currency ?? "").trim();
      let projectURI = (project.funding.projectURI ?? "").trim();
      const stampURI = (project.funding.stampURI ?? "").trim() || DEFAULT_STAMP_URI;

      const acceptedToken =
        isHexAddress(project.funding.tokenAddress)
          ? project.funding.tokenAddress
          : currencyLabel.toUpperCase() === "USDC" && isHexAddress(DEFAULT_USDC_ADDRESS)
            ? DEFAULT_USDC_ADDRESS
            : null;

      if (!acceptedToken) {
        setOpenFundingErrors(["MISSING_TOKEN_ADDRESS"]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpeningFunding(false);
        return;
      }

      // If the snapshot isn't pinned yet, pin it now (so the creator never needs to paste CIDs manually).
      if (!projectURI) {
        const pRes = await fetch(`/api/projects/${encodeURIComponent(id)}/pin-manifest`, { method: "POST" });
        const raw = await pRes.text();
        const pJson = ((): any => {
          try {
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();

        if (!pRes.ok || !(pJson as any)?.projectURI) {
          const msg = String((pJson as any)?.error ?? (pJson as any)?.message ?? raw?.slice?.(0, 200) ?? `HTTP_${pRes.status}`);
          console.error("Pin manifest failed:", pJson ?? raw);
          window.alert(msg);
          setOpenFundingErrors(["PROJECT_URI_UPLOAD_FAILED"]);
          window.scrollTo({ top: 0, behavior: "smooth" });
          setOpeningFunding(false);
          return;
        }

        projectURI = String((pJson as any).projectURI);
        if ((pJson as any).project) setProject((pJson as any).project as ProjectRecord);
      }

      const decimals =
        project.funding.tokenDecimals ?? (currencyLabel.toUpperCase() === "USDC" ? 6 : 18);
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
        setOpenFundingErrors(["TOKEN_DECIMALS_INVALID"]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpeningFunding(false);
        return;
      }

      const targetAmount = parseTokenAmount(String(project.funding.target ?? ""), decimals);
      const stampPrice = parseTokenAmount(String(project.funding.minimumAllocation ?? ""), decimals);
      const deadline = dateToDeadlineUnixSeconds(String(project.funding.deadline ?? ""));

      const maxBlueSupplyBig = ceilDiv(targetAmount, stampPrice);

      const releaseModel = project.funding.releaseModel ?? "MILESTONE";
      let releaseBps: number[];
      if (releaseModel === "ALL_OR_NOTHING") {
        releaseBps = [10000];
      } else {
        const plan = project.funding.milestonePlan;
        if (plan && plan.milestones.length) {
          const initialPct = clampInt(Number(plan.initialPercent), 0, 100);
          const milestonePcts = plan.milestones.map((m) => clampInt(Number(m.percent), 0, 100));
          const sumPct = milestonePcts.reduce((acc, p) => acc + p, initialPct);
          if (sumPct !== 100) throw new Error(`MILESTONE_PCT_SUM_${sumPct}`);
          releaseBps = [initialPct * 100, ...milestonePcts.map((p) => p * 100)];
        } else {
          // Back-compat fallback (older drafts).
          releaseBps = defaultReleaseBps(project.commitments.length);
        }
      }
      const voteDurationDays = project.funding.voteDurationDays ?? 10;
      const voteDuration = daysToSeconds(voteDurationDays);
      const quorumBps = project.funding.quorumBps ?? 1500;

      if (!publicClient) {
        setOpenFundingErrors(["FUNDING_INCOMPLETE"]);
        alert("Wallet client is not ready yet. Please reconnect your wallet and try again.");
        setOpeningFunding(false);
        return;
      }

      const factoryCode = await publicClient.getBytecode({ address: KAPRIKA_FACTORY_ADDRESS });
      if (!factoryCode || factoryCode === "0x") {
        throw new Error(`No contract deployed at ${KAPRIKA_FACTORY_ADDRESS} on chainId ${chainId}.`);
      }

      // Read creation fee and deploy
      const creationFee = await publicClient.readContract({
        address: KAPRIKA_FACTORY_ADDRESS,
        abi: KaprikaProjectFactoryAbi,
        functionName: "creationFee",
      });

      const hash = await writeContractAsync({
        address: KAPRIKA_FACTORY_ADDRESS,
        abi: KaprikaProjectFactoryAbi,
        functionName: "createProject",
        args: [
          {
            projectURI,
            stampURI,
            acceptedToken,
            creator: address,
            targetAmount,
            deadline,
            stampPrice,
            maxBlueSupply: maxBlueSupplyBig,
            voteDuration,
            quorumBps,
            releaseBps,
          },
        ],
        value: creationFee,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let createdProject: `0x${string}` | null = null;
      let createdProjectId: bigint | null = null;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== KAPRIKA_FACTORY_ADDRESS.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: KaprikaProjectFactoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName !== "ProjectCreated") continue;
          const args = decoded.args as unknown as {
            projectId: bigint;
            project: `0x${string}`;
          };
          createdProject = args.project;
          createdProjectId = args.projectId;
          break;
        } catch {
          // ignore
        }
      }

      if (!createdProject || createdProjectId == null) throw new Error("PROJECT_CREATED_EVENT_NOT_FOUND");

      // 4) Persist + open funding on our server (status=ACTIVE + manifest snapshot)
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}/open-funding`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractAddress: createdProject,
          chainId: POLYGON_CHAIN_ID,
          onchainProjectId: Number(createdProjectId),
          txHash: hash,
          acceptedToken,
          projectURI,
          stampURI,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; errors?: PublishValidationError[] } | null;

      if (!res.ok || json?.ok === false) {
        setOpenFundingErrors(json?.errors ?? []);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setOpeningFunding(false);
        return;
      }

      router.push("/creator");
    } catch (e) {
      const msg =
        (e && typeof e === "object" && "shortMessage" in e && typeof (e as any).shortMessage === "string"
          ? (e as any).shortMessage
          : null) ??
        (e && typeof e === "object" && "message" in e && typeof (e as any).message === "string" ? (e as any).message : null) ??
        String(e);

      let userMsg = msg;
      const milestoneSumMatch = /^MILESTONE_PCT_SUM_(\d+)$/.exec(msg);
      if (milestoneSumMatch) {
        userMsg = `Milestone percents must sum to 100% (currently ${milestoneSumMatch[1]}%).`;
      }

      console.error("On-chain deployment failed:", e);
      setOpenFundingErrors(["FUNDING_INCOMPLETE"]);
      alert(`On-chain deployment failed: ${userMsg}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setOpeningFunding(false);
      return;
    }
  }

  if (status === "loading") {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <div className="skeletonBlock" style={{ height: 34, width: "60%" }} />
            <div style={{ height: 14 }} />
            <div className="skeletonBlock" style={{ height: 200 }} />
          </section>
        </div>
      </main>
    );
  }

  if (status === "error" || !project) {
    return (
      <main className="container">
        <div className="contentFrame">
          <section className="section">
            <span className="metaLabel">Creator</span>
            <h1 className="pageTitle">Draft editor</h1>
            <p className="muted">This draft could not be loaded.</p>
            <Link className="ghostBtn" href="/creator">
              Back to console
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="contentFrame">
        <section className="section">
          <div
            id="section-title"
            className="actionLine"
            style={{
              background: "var(--panel)",
              border: hasIssue("title") ? "1px solid var(--border)" : undefined,
            }}
          >
            <Link className="ghostBtn" href="/creator">
              ← Back to console
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 240 }}>
              <span className="badge badgeDraft">DRAFT</span>
              <input
                value={project.core.title ?? ""}
                placeholder="Untitled draft"
                onChange={(e) => {
                  setProject({ ...project, core: { ...project.core, title: e.target.value } });
                  setDirtyCoreFunding(true);
                  setSaveStatus("idle");
                  if (openFundingErrors.length) setOpenFundingErrors([]);
                }}
                style={{
                  flex: 1,
                  minWidth: 220,
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 999,
                  padding: "10px 14px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              <span className="muted num" style={{ fontSize: 12 }}>
                {saveStatus === "saving"
                  ? "Saving…"
                  : saveStatus === "saved" && savedAt
                    ? `Saved ${formatTime(savedAt)}`
                    : saveStatus === "error"
                      ? "Not saved"
                      : "—"}
              </span>
              {saveStatus === "error" ? (
                <button type="button" className="ghostBtn" onClick={() => void save("manual")}>
                  Retry
                </button>
              ) : null}
              {readiness.ok ? (
                <button type="button" className="neutralBtn" onClick={() => void openFunding()} disabled={openingFunding}>
                  {openingFunding ? "Checking…" : "Open funding"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {openFundingErrors.length ? (
          <section className="section">
            <div className="card" style={{ background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Cannot open funding</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    The structure is incomplete. Resolve the issues below.
                  </div>
                </div>
                <button type="button" className="ghostBtn" onClick={() => setOpenFundingErrors([])}>
                  Dismiss
                </button>
              </div>

              <ul style={{ marginTop: 12, marginBottom: 0, paddingLeft: 18 }}>
                {openFundingErrors.map((code, idx) => {
                  const info = errorInfo(code);
                  return (
                    <li key={`${code}-${idx}`} style={{ margin: "6px 0" }}>
                      <button
                        type="button"
                        className="ghostBtn"
                        style={{ padding: 0, textDecoration: "underline" }}
                        onClick={() => scrollToField(info.field)}
                      >
                        {info.message}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="section" id="section-core">
          <h2>Core</h2>
          <div
            className="card"
            style={{
              background: "var(--surface)",
              border: hasIssue("core") ? "1px solid var(--border)" : undefined,
            }}
          >
            <label className="kvKey">Category</label>
            <select
              value={project.core.category ?? ""}
              onChange={(e) => {
                const nextCategory = (e.target.value || null) as ProjectCategory | null;
                setProject({
                  ...project,
                  core: {
                    ...project.core,
                    category: nextCategory,
                    deliverableExample: nextCategory === "OTHER" ? project.core.deliverableExample : null,
                  },
                });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
                if (openFundingErrors.length) setOpenFundingErrors([]);
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
              } as CSSProperties}
            >
              <option value="">Select a category</option>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <div style={{ height: 12 }} />

            <label className="kvKey">Definition (≤ 400)</label>
            <textarea
              value={project.core.definition ?? ""}
              placeholder="One paragraph. No links."
              rows={5}
              onChange={(e) => {
                const limit = project.core.category === "OTHER" ? 200 : 400;
                setProject({
                  ...project,
                  core: { ...project.core, definition: e.target.value.slice(0, limit) },
                });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
                if (openFundingErrors.length) setOpenFundingErrors([]);
              }}
              maxLength={project.core.category === "OTHER" ? 200 : 400}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
                resize: "vertical",
              } as CSSProperties}
            />
            <div className="muted num" style={{ marginTop: 8, fontSize: 12 }}>
              {(project.core.definition ?? "").length}/{project.core.category === "OTHER" ? 200 : 400}
            </div>

            {project.core.category === "OTHER" ? (
              <>
                <div style={{ height: 12 }} />

                <label className="kvKey">Example deliverable (required, ≤150)</label>
                <input
                  value={project.core.deliverableExample ?? ""}
                  placeholder="e.g., 'Public beta release with auth + payments'"
                  maxLength={150}
                  onChange={(e) => {
                    setProject({
                      ...project,
                      core: { ...project.core, deliverableExample: e.target.value.slice(0, 150) },
                    });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />

                <div className="muted num" style={{ marginTop: 8, fontSize: 12 }}>
                  {(project.core.deliverableExample ?? "").length}/150
                </div>
              </>
            ) : null}

            <div style={{ height: 12 }} />

            <label className="kvKey">Explanation</label>
            <textarea
              value={project.core.explanation ?? ""}
              placeholder="Optional."
              rows={6}
              onChange={(e) => {
                setProject({ ...project, core: { ...project.core, explanation: e.target.value } });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
                if (openFundingErrors.length) setOpenFundingErrors([]);
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
                color: "var(--text)",
                fontFamily: "inherit",
                resize: "vertical",
              } as CSSProperties}
            />

            <div style={{ height: 14 }} />

            <ExternalLinksEditor
              value={project.externalLinks}
              onChange={(nextLinks) => {
                setProject({ ...project, externalLinks: nextLinks });
                setDirtyCoreFunding(true);
                setSaveStatus("idle");
                if (openFundingErrors.length) setOpenFundingErrors([]);
              }}
            />
          </div>
        </section>

        <section className="section" id="section-funding">
          <h2>Funding</h2>
          <div
            className="card"
            style={{
              background: "var(--surface)",
              border: hasIssue("funding") ? "1px solid var(--border)" : undefined,
            }}
          >
            <div className="kvGrid">
              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <span className="kvKey">Currency</span>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label className="kvKey">Token contract address</label>
                    <input
                      value={project.funding.tokenAddress ?? ""}
                      placeholder={process.env.NEXT_PUBLIC_KAPRIKA_USDC_ADDRESS ?? "0x..."}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        lastDetectedTokenRef.current = null;
                        setTokenMeta({ status: "idle" });
                        setProject({ ...project, funding: { ...project.funding, tokenAddress: v || null } });
                        setDirtyCoreFunding(true);
                        setSaveStatus("idle");
                        if (openFundingErrors.length) setOpenFundingErrors([]);
                      }}
                      style={pillFieldStyle}
                    />
                  </div>

                  <div>
                    <label className="kvKey">Symbol</label>
                    <input value={project.funding.currency ?? ""} readOnly style={pillFieldDisabledStyle} />
                  </div>

                  <div>
                    <label className="kvKey">Decimals</label>
                    <input
                      value={project.funding.tokenDecimals == null ? "" : String(project.funding.tokenDecimals)}
                      readOnly
                      style={pillFieldDisabledStyle}
                    />
                  </div>
                </div>

                <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35 }}>
                  {chainId !== POLYGON_CHAIN_ID ? (
                    <>Switch to Polygon (chainId {POLYGON_CHAIN_ID}) to auto-detect symbol/decimals.</>
                  ) : tokenMeta.status === "loading" ? (
                    <>Checking token contract…</>
                  ) : tokenMeta.status === "error" ? (
                    <>Couldn't read token metadata: {tokenMeta.message}</>
                  ) : (
                    <>Changing the address auto-fills symbol and decimals from the token contract.</>
                  )}
                </div>
              </div>

              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <span className="kvKey">Amount</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <div>
                    <label className="kvKey">Target</label>
                    <input
                      inputMode="decimal"
                      value={project.funding.target ?? ""}
                      onChange={(e) => {
                        setProject({ ...project, funding: { ...project.funding, target: e.target.value } });
                        setDirtyCoreFunding(true);
                        setSaveStatus("idle");
                        if (openFundingErrors.length) setOpenFundingErrors([]);
                      }}
                      style={pillFieldStyle}
                    />
                  </div>

                  <div>
                    <label className="kvKey">Minimum allocation</label>
                    <input
                      inputMode="decimal"
                      value={project.funding.minimumAllocation ?? ""}
                      onChange={(e) => {
                        setProject({ ...project, funding: { ...project.funding, minimumAllocation: e.target.value } });
                        setDirtyCoreFunding(true);
                        setSaveStatus("idle");
                        if (openFundingErrors.length) setOpenFundingErrors([]);
                      }}
                      style={pillFieldStyle}
                    />
                  </div>

                  <div>
                    <label className="kvKey">Deadline</label>
                    <input
                      type="date"
                      value={project.funding.deadline ?? ""}
                      onChange={(e) => {
                        setProject({ ...project, funding: { ...project.funding, deadline: e.target.value } });
                        setDirtyCoreFunding(true);
                        setSaveStatus("idle");
                        if (openFundingErrors.length) setOpenFundingErrors([]);
                      }}
                      style={pillFieldStyle}
                    />
                  </div>
                </div>
              </div>

              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <span className="kvKey">Model</span>

                <div style={{ display: "grid", gap: 12 }}>
                  <select
                    value={project.funding.releaseModel === "ALL_OR_NOTHING" ? "ALL_OR_NOTHING" : "MILESTONE"}
                    onChange={(e) => {
                      const nextModel = (e.target.value.trim() || null) as ProjectRecord["funding"]["releaseModel"];
                      const defaultPlan = {
                        initialPercent: 20,
                        milestones: [
                          { name: "Milestone 1", percent: 40 },
                          { name: "Milestone 2", percent: 40 },
                        ],
                      };

                      const nextFunding: ProjectRecord["funding"] = {
                        ...project.funding,
                        releaseModel: nextModel,
                        milestonePlan:
                          nextModel === "MILESTONE"
                            ? project.funding.milestonePlan ?? defaultPlan
                            : project.funding.milestonePlan,
                      };

                      const plan = nextModel === "MILESTONE" ? nextFunding.milestonePlan : null;
                      const needed = plan ? clampInt(plan.milestones.length, 1, 5) : 0;

                      let nextCommitments = project.commitments;
                      let commitmentsChanged = false;

                      if (nextModel === "MILESTONE" && needed > 0 && project.commitments.length < needed) {
                        const baseDeadline = project.funding.deadline ?? "";
                        nextCommitments = project.commitments.slice();
                        for (let i = nextCommitments.length; i < needed && i < 5; i++) {
                          nextCommitments.push({
                            deliverableType: "REPORT_DATASET",
                            deadline: addDaysToISODate(baseDeadline, 30 * (i + 1)) ?? baseDeadline,
                            verificationMethod: "PUBLIC_LINK",
                            verificationDetails: "TBD",
                            failureConsequence: "PAUSE_UNTIL_RESOLVED",
                            details: `Milestone ${i + 1}: ${plan?.milestones?.[i]?.name ?? `Milestone ${i + 1}`}`.slice(0, 150),
                          });
                        }
                        commitmentsChanged = true;
                      }

                      setProject({ ...project, funding: nextFunding, commitments: nextCommitments });
                      setDirtyCoreFunding(true);
                      if (commitmentsChanged) setDirtyCommitments(true);
                      setSaveStatus("idle");
                      if (openFundingErrors.length) setOpenFundingErrors([]);
                    }}
                    style={pillFieldStyle}
                  >
                    <option value="ALL_OR_NOTHING">All-or-nothing</option>
                    <option value="MILESTONE">Milestone</option>
                  </select>

                  {project.funding.releaseModel === "ALL_OR_NOTHING" ? (
                    <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                      You will be able to withdraw the full amount if the specified goal is reached.
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                        <div>
                          <label className="kvKey">Initial tranche %</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={project.funding.milestonePlan?.initialPercent ?? 20}
                            onChange={(e) => {
                              const n = clampInt(Number(e.target.value), 0, 100);
                              const base = project.funding.milestonePlan ?? {
                                initialPercent: 20,
                                milestones: [
                                  { name: "Milestone 1", percent: 40 },
                                  { name: "Milestone 2", percent: 40 },
                                ],
                              };
                              setProject({ ...project, funding: { ...project.funding, milestonePlan: { ...base, initialPercent: n } } });
                              setDirtyCoreFunding(true);
                              setSaveStatus("idle");
                              if (openFundingErrors.length) setOpenFundingErrors([]);
                            }}
                            style={pillFieldStyle}
                          />
                        </div>

                        <div>
                          <label className="kvKey">Milestone count</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={project.funding.milestonePlan?.milestones?.length ?? 2}
                            onChange={(e) => {
                              const count = clampInt(Number(e.target.value), 1, 5);
                              const current = project.funding.milestonePlan ?? { initialPercent: 20, milestones: [] };
                              const remaining = 100 - clampInt(current.initialPercent, 0, 100);
                              const percents = distributePercents(remaining, count);
                              const nextMilestones = Array.from({ length: count }, (_, i) => ({
                                name: current.milestones?.[i]?.name ?? `Milestone ${i + 1}`,
                                percent: percents[i] ?? 0,
                              }));

                              const nextFunding = { ...project.funding, milestonePlan: { ...current, milestones: nextMilestones } };

                              const baseDeadline = project.funding.deadline ?? "";
                              const nextCommitments = project.commitments.slice();
                              for (let i = 0; i < count && i < 5; i++) {
                                const title = `Milestone ${i + 1}: ${nextMilestones[i]?.name ?? `Milestone ${i + 1}`}`.slice(0, 150);
                                if (!nextCommitments[i]) {
                                  nextCommitments[i] = {
                                    deliverableType: "REPORT_DATASET",
                                    deadline: addDaysToISODate(baseDeadline, 30 * (i + 1)) ?? baseDeadline,
                                    verificationMethod: "PUBLIC_LINK",
                                    verificationDetails: "TBD",
                                    failureConsequence: "PAUSE_UNTIL_RESOLVED",
                                    details: title,
                                  };
                                } else if ((nextCommitments[i].details ?? "").startsWith(`Milestone ${i + 1}:`)) {
                                  nextCommitments[i] = { ...nextCommitments[i], details: title };
                                }
                              }

                              setProject({ ...project, funding: nextFunding, commitments: nextCommitments });
                              setDirtyCoreFunding(true);
                              setDirtyCommitments(true);
                              setSaveStatus("idle");
                              if (openFundingErrors.length) setOpenFundingErrors([]);
                            }}
                            style={pillFieldStyle}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        {(project.funding.milestonePlan?.milestones ?? []).map((m, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 2fr) minmax(160px, 1fr)",
                              gap: 12,
                              alignItems: "end",
                            }}
                          >
                            <div>
                              <label className="kvKey">{idx + 1}. Name</label>
                              <input
                                value={m.name}
                                onChange={(e) => {
                                  const nextName = e.target.value;
                                  const current = project.funding.milestonePlan;
                                  if (!current) return;
                                  const nextMilestones = current.milestones.slice();
                                  nextMilestones[idx] = { ...nextMilestones[idx], name: nextName };

                                  const nextFunding = { ...project.funding, milestonePlan: { ...current, milestones: nextMilestones } };
                                  const nextCommitments = project.commitments.slice();
                                  const title = `Milestone ${idx + 1}: ${nextName}`.slice(0, 150);
                                  let commitmentsChanged = false;

                                  if (nextCommitments[idx] && (nextCommitments[idx].details ?? "").startsWith(`Milestone ${idx + 1}:`)) {
                                    nextCommitments[idx] = { ...nextCommitments[idx], details: title };
                                    commitmentsChanged = true;
                                  }

                                  setProject({ ...project, funding: nextFunding, commitments: nextCommitments });
                                  setDirtyCoreFunding(true);
                                  if (commitmentsChanged) setDirtyCommitments(true);
                                  setSaveStatus("idle");
                                  if (openFundingErrors.length) setOpenFundingErrors([]);
                                }}
                                style={pillFieldStyle}
                              />
                            </div>

                            <div>
                              <label className="kvKey">{idx + 1}. %</label>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={m.percent}
                                onChange={(e) => {
                                  const n = clampInt(Number(e.target.value), 0, 100);
                                  const current = project.funding.milestonePlan;
                                  if (!current) return;
                                  const nextMilestones = current.milestones.slice();
                                  nextMilestones[idx] = { ...nextMilestones[idx], percent: n };
                                  setProject({ ...project, funding: { ...project.funding, milestonePlan: { ...current, milestones: nextMilestones } } });
                                  setDirtyCoreFunding(true);
                                  setSaveStatus("idle");
                                  if (openFundingErrors.length) setOpenFundingErrors([]);
                                }}
                                style={pillFieldStyle}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="muted" style={{ fontSize: 12, lineHeight: 1.35 }}>
                        {(() => {
                          const plan = project.funding.milestonePlan;
                          if (!plan) return null;
                          const sum = milestoneSumPercent(project);
                          const preview = [plan.initialPercent, ...plan.milestones.map((m) => m.percent)]
                            .map((p) => `${clampInt(Number(p), 0, 100)}%`)
                            .join(" / ");
                          return (
                            <>
                              Preview: {preview}
                              {sum != null ? (
                                <span style={{ display: "block", marginTop: 4, color: sum === 100 ? "var(--muted)" : "#ff9b9b" }}>
                                  Must sum to 100% (currently {sum}%).
                                </span>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="ghostBtn"
                          onClick={() => {
                            const current = project.funding.milestonePlan;
                            if (!current) return;
                            const count = clampInt(current.milestones.length || 2, 1, 5);
                            const remaining = 100 - clampInt(current.initialPercent, 0, 100);
                            const percents = distributePercents(remaining, count);
                            const nextMilestones = Array.from({ length: count }, (_, i) => ({
                              name: current.milestones?.[i]?.name ?? `Milestone ${i + 1}`,
                              percent: percents[i] ?? 0,
                            }));
                            setProject({ ...project, funding: { ...project.funding, milestonePlan: { ...current, milestones: nextMilestones } } });
                            setDirtyCoreFunding(true);
                            setSaveStatus("idle");
                            if (openFundingErrors.length) setOpenFundingErrors([]);
                          }}
                        >
                          Auto-balance %
                        </button>
                        <div className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                          Auto-creates required milestone commitments in the Commitments section.
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="kv" style={{ display: "none" }}>
                <span className="kvKey">
                  Accepted token address <span className="muted">(optional for USDC)</span>
                </span>
                <input
                  value={project.funding.tokenAddress ?? ""}
                  placeholder={process.env.NEXT_PUBLIC_KAPRIKA_USDC_ADDRESS ?? "0x…"}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setProject({ ...project, funding: { ...project.funding, tokenAddress: v || null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div className="kv" style={{ display: "none" }}>
                <span className="kvKey">Token decimals</span>
                <input
                  type="number"
                  value={project.funding.tokenDecimals ?? ""}
                  placeholder={String((project.funding.currency ?? "").trim().toUpperCase() === "USDC" ? 6 : 18)}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value);
                    setProject({ ...project, funding: { ...project.funding, tokenDecimals: Number.isFinite(n as number) ? (n as number) : null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div className="kv" style={{ gridColumn: "1 / -1" }}>
                <span className="kvKey">
                  Project snapshot <span className="muted">(IPFS, generated)</span>
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    background: "transparent",
                  }}
                >
                  <div
                    style={{
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: project.funding.projectURI ? "var(--text)" : "var(--muted)",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      fontSize: 12,
                    }}
                    title={project.funding.projectURI ?? ""}
                  >
                    {project.funding.projectURI ?? "Not pinned yet (will pin automatically on open)"}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={pinManifestNow}
                      disabled={pinningManifest}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid var(--border)",
                        background: "transparent",
                        color: "var(--text)",
                        cursor: pinningManifest ? "not-allowed" : "pointer",
                        fontSize: 12,
                      }}
                    >
                      {pinningManifest ? "Pinning…" : "Pin now"}
                    </button>
                    {project.funding.projectURI ? (
                      <button
                        type="button"
                        onClick={() => {
                          setProject({ ...project, funding: { ...project.funding, projectURI: null } });
                          setDirtyCoreFunding(true);
                          setSaveStatus("idle");
                        }}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--muted)",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35 }}>
                  We generate a JSON snapshot from this draft and pin it to IPFS right before opening funding.
                  Use <span style={{ fontFamily: "inherit" }}>Pin now</span> only if you want to preview the CID.
                </div>

                <div style={{ height: 10 }} />

                <label className="kvKey">
                  Stamp URI <span className="muted">(optional)</span>
                </label>
                <input
                  value={project.funding.stampURI ?? ""}
                  placeholder={process.env.NEXT_PUBLIC_KAPRIKA_STAMP_URI ?? "ipfs://YOUR_CID/stamp.json"}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setProject({ ...project, funding: { ...project.funding, stampURI: v || null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={pillFieldStyle}
                />
              </div>

              <div className="kv" style={{ display: "none" }}>
                <span className="kvKey">Stamp URI <span className="muted">(optional)</span></span>
                <input
                  value={project.funding.stampURI ?? ""}
                  placeholder={process.env.NEXT_PUBLIC_KAPRIKA_STAMP_URI ?? "ipfs://YOUR_CID/stamp.json"}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setProject({ ...project, funding: { ...project.funding, stampURI: v || null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
              </div>

            </div>
          </div>
        </section>

        <section className="section" id="section-governance">
          <h2>Governance</h2>
          <div className="card" style={{ background: "var(--surface)" }}>
            <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
              <div className="kv">
                <span className="kvKey">Vote duration <span className="muted">(days)</span></span>
                <input
                  type="number"
                  value={project.funding.voteDurationDays ?? ""}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value);
                    setProject({ ...project, funding: { ...project.funding, voteDurationDays: Number.isFinite(n as number) ? (n as number) : null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
                <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35 }}>
                  Majority is counted among those who vote (not among all stamp holders). This sets the window.
                </div>
              </div>

              <div className="kv">
                <span className="kvKey">Quorum <span className="muted">(bps)</span></span>
                <input
                  type="number"
                  value={project.funding.quorumBps ?? ""}
                  onChange={(e) => {
                    const n = e.target.value === "" ? null : Number(e.target.value);
                    setProject({ ...project, funding: { ...project.funding, quorumBps: Number.isFinite(n as number) ? (n as number) : null } });
                    setDirtyCoreFunding(true);
                    setSaveStatus("idle");
                    if (openFundingErrors.length) setOpenFundingErrors([]);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />
                <div className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.35 }}>
                  Basis points: 10000 = 100%. Example: 2000 = 20%.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="section-commitments">
          <h2>Commitments (1–5)</h2>
          <div
            className="card"
            style={{
              background: "var(--surface)",
              border: hasIssue("commitments") ? "1px solid var(--border)" : undefined,
            }}
          >
            <div
              className="muted"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: -2,
                marginBottom: 10,
                fontSize: 12,
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>Each commitment must be verifiable.</span>
                <span>No conditionals (aim/hope/try/plan).</span>
                <span>150 chars max in Details.</span>
              </div>
              <div className="num">
                {project.commitments.length}/5
              </div>
            </div>

            {project.core.category ? (
              <div style={{ marginBottom: 12 }}>
                <details className="details">
                  <summary>Examples ({labelFor(PROJECT_CATEGORIES, project.core.category)})</summary>
                  <div className="detailsContent">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {COMMITMENT_EXAMPLES[project.core.category].map((ex, idx) => (
                        <li key={idx} className="muted" style={{ margin: "6px 0" }}>
                          Type: {labelFor(DELIVERABLE_TYPES, ex.deliverableType)} → Verify:{" "}
                          {labelFor(VERIFICATION_METHODS, ex.verificationMethod)} → Fail:{" "}
                          {labelFor(FAILURE_CONSEQUENCES, ex.failureConsequence)}
                          {ex.failureConsequence === "PARTIAL_REFUND" && ex.refundPercent != null
                            ? ` — ${ex.refundPercent}%`
                            : ""}{" "}
                          → Deadline: <span className="num">{ex.deadline}</span> → Details: “{ex.details}”
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </div>
            ) : null}

            <div className="splitGrid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>
                  Commitment Builder
                  {editingCommitmentIndex != null ? (
                    <span className="muted num" style={{ marginLeft: 8, fontWeight: 400 }}>
                      (editing #{editingCommitmentIndex + 1})
                    </span>
                  ) : null}
                </div>

                <div className="splitGrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <label className="kvKey">Deliverable Type</label>
                    <select
                      value={commitmentDraft.deliverableType}
                      onChange={(e) =>
                        setCommitmentDraft({ ...commitmentDraft, deliverableType: e.target.value as CommitmentDraft["deliverableType"] })
                      }
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">Select…</option>
                      {DELIVERABLE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="kvKey">By when</label>
                    <input
                      type="date"
                      value={commitmentDraft.deadline}
                      onChange={(e) => setCommitmentDraft({ ...commitmentDraft, deadline: e.target.value })}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div className="splitGrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <label className="kvKey">Verification Method</label>
                    <select
                      value={commitmentDraft.verificationMethod}
                      onChange={(e) =>
                        setCommitmentDraft({
                          ...commitmentDraft,
                          verificationMethod: e.target.value as CommitmentDraft["verificationMethod"],
                        })
                      }
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    >
                      <option value="">Select…</option>
                      {VERIFICATION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ height: 10 }} />
                <div>
                  <label className="kvKey">Verification Details (≤150)</label>
                  <input
                    value={commitmentDraft.verificationDetails}
                    maxLength={150}
                    onChange={(e) =>
                      setCommitmentDraft({ ...commitmentDraft, verificationDetails: e.target.value.slice(0, 150) })
                    }
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 999,
                      padding: "10px 12px",
                      color: "var(--text)",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div style={{ height: 10 }} />

                <label className="kvKey">If it fails</label>
                <select
                  value={commitmentDraft.failureConsequence}
                  onChange={(e) => {
                    const next = e.target.value as CommitmentDraft["failureConsequence"];
                    setCommitmentDraft({
                      ...commitmentDraft,
                      failureConsequence: next,
                      refundPercent: next === "PARTIAL_REFUND" ? commitmentDraft.refundPercent : "",
                      voteDurationDays: next === "DEADLINE_EXTENSION_VOTE" ? commitmentDraft.voteDurationDays : "",
                    });
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">Select…</option>
                  {FAILURE_CONSEQUENCES.map((x) => (
                    <option key={x.value} value={x.value}>
                      {x.label}
                    </option>
                  ))}
                </select>

                {commitmentDraft.failureConsequence === "PARTIAL_REFUND" ? (
                  <>
                    <div style={{ height: 10 }} />
                    <label className="kvKey">Refund percent (1–100)</label>
                    <input
                      inputMode="numeric"
                      value={commitmentDraft.refundPercent}
                      onChange={(e) => setCommitmentDraft({ ...commitmentDraft, refundPercent: e.target.value })}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    />
                  </>
                ) : null}

                {commitmentDraft.failureConsequence === "DEADLINE_EXTENSION_VOTE" ? (
                  <>
                    <div style={{ height: 10 }} />
                    <label className="kvKey">Vote duration (days, optional)</label>
                    <input
                      inputMode="numeric"
                      value={commitmentDraft.voteDurationDays}
                      onChange={(e) => setCommitmentDraft({ ...commitmentDraft, voteDurationDays: e.target.value })}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "10px 12px",
                        color: "var(--text)",
                        fontFamily: "inherit",
                      }}
                    />
                  </>
                ) : null}

                <div style={{ height: 10 }} />

                <label className="kvKey">Details (≤150, no links)</label>
                <input
                  value={commitmentDraft.details}
                  maxLength={150}
                  onChange={(e) => setCommitmentDraft({ ...commitmentDraft, details: e.target.value.slice(0, 150) })}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    padding: "10px 12px",
                    color: "var(--text)",
                    fontFamily: "inherit",
                  }}
                />

                {commitmentDraftErrors.length ? (
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    {commitmentDraftErrors[0]}
                  </div>
                ) : null}

                {duplicateCommitmentWarning ? (
                  <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                    {duplicateCommitmentWarning}
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, marginTop: 12 }}>
                  {editingCommitmentIndex != null ? (
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => {
                        setEditingCommitmentIndex(null);
                        setCommitmentDraft(emptyCommitmentDraft());
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="neutralBtn"
                    disabled={
                      saveStatus === "saving" ||
                      !commitmentDraftValue ||
                      (editingCommitmentIndex == null && project.commitments.length >= 5)
                    }
                    onClick={() => {
                      if (!commitmentDraftValue) return;

                      if (editingCommitmentIndex != null) {
                        const next = project.commitments.slice();
                        next[editingCommitmentIndex] = commitmentDraftValue;
                        setProject({ ...project, commitments: next });
                        setEditingCommitmentIndex(null);
                      } else {
                        setProject({ ...project, commitments: [...project.commitments, commitmentDraftValue] });
                      }

                      setDirtyCommitments(true);
                      setSaveStatus("idle");
                      if (openFundingErrors.length) setOpenFundingErrors([]);
                      setCommitmentDraft(emptyCommitmentDraft());
                    }}
                  >
                    {editingCommitmentIndex != null ? "Save changes" : "Add commitment"}
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Preview</div>
                <div
                  className="card"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border)",
                    padding: 14,
                  }}
                >
                  <div className="muted num" style={{ fontSize: 12, marginBottom: 10 }}>
                    This is how observers will read it.
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Deliverable
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {labelFor(DELIVERABLE_TYPES, commitmentDraft.deliverableType) || "—"}
                    {commitmentDraft.details.trim() ? ` — ${commitmentDraft.details.trim()}` : ""}
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Deadline
                  </div>
                  <div className="num" style={{ marginBottom: 10 }}>
                    {commitmentDraft.deadline || "—"}
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Verification
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {labelFor(VERIFICATION_METHODS, commitmentDraft.verificationMethod) || "—"}
                    {commitmentDraft.verificationDetails.trim() ? ` — ${commitmentDraft.verificationDetails.trim()}` : ""}
                  </div>

                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    If it fails
                  </div>
                  <div>
                    {labelFor(FAILURE_CONSEQUENCES, commitmentDraft.failureConsequence) || "—"}
                    {commitmentDraft.failureConsequence === "PARTIAL_REFUND" && commitmentDraft.refundPercent.trim()
                      ? ` — ${commitmentDraft.refundPercent.trim()}%`
                      : ""}
                    {commitmentDraft.failureConsequence === "DEADLINE_EXTENSION_VOTE" && commitmentDraft.voteDurationDays.trim()
                      ? ` — vote duration ${commitmentDraft.voteDurationDays.trim()} days`
                      : ""}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ height: 14 }} />

            {project.commitments.length ? (
              project.commitments.map((c, idx) => (
                <div
                  key={`${c.deliverableType}-${c.deadline}-${idx}`}
                  style={{
                    borderTop: idx === 0 ? "1px solid var(--border)" : "1px solid var(--border)",
                    paddingTop: 14,
                    marginTop: 14,
                  }}
                >
                  <div className="muted num" style={{ fontSize: 12, marginBottom: 10 }}>
                    Commitment {idx + 1}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>Deliverable:</span>{" "}
                      {labelFor(DELIVERABLE_TYPES, c.deliverableType)} — {c.details}
                    </div>
                    <div className="num">
                      <span style={{ fontWeight: 600 }}>Deadline:</span> {c.deadline}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Verification:</span>{" "}
                      {labelFor(VERIFICATION_METHODS, c.verificationMethod)} — {c.verificationDetails}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>If it fails:</span>{" "}
                      {labelFor(FAILURE_CONSEQUENCES, c.failureConsequence)}
                      {c.failureConsequence === "PARTIAL_REFUND" && c.refundPercent != null ? ` — ${c.refundPercent}%` : ""}
                      {c.failureConsequence === "DEADLINE_EXTENSION_VOTE" && c.voteDurationDays != null
                        ? ` — vote duration ${c.voteDurationDays} days`
                        : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => {
                        setEditingCommitmentIndex(idx);
                        setCommitmentDraft({
                          deliverableType: c.deliverableType,
                          deadline: c.deadline,
                          verificationMethod: c.verificationMethod,
                          verificationDetails: c.verificationDetails,
                          failureConsequence: c.failureConsequence,
                          refundPercent: c.refundPercent != null ? String(c.refundPercent) : "",
                          voteDurationDays: c.voteDurationDays != null ? String(c.voteDurationDays) : "",
                          details: c.details,
                        });
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="ghostBtn"
                      onClick={() => {
                        const next = project.commitments.slice();
                        next.splice(idx, 1);
                        setProject({ ...project, commitments: next });
                        setDirtyCommitments(true);
                        setSaveStatus("idle");
                        if (openFundingErrors.length) setOpenFundingErrors([]);
                        if (editingCommitmentIndex === idx) {
                          setEditingCommitmentIndex(null);
                          setCommitmentDraft(emptyCommitmentDraft());
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">No commitments yet.</p>
            )}

            <div
              className="card"
              style={{
                marginTop: 14,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
                padding: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Draft status
                  </div>
                  <div className="num" style={{ fontSize: 13 }}>
                    {saveStatus === "saving"
                      ? "Saving…"
                      : savedAt
                        ? `Saved automatically • ${new Date(savedAt).toLocaleString()}`
                        : "Saved automatically"}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    {readiness.ok
                      ? "The structure is coherent. You may open funding when you want."
                      : "The structure is not coherent yet — scroll down to the readiness list."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    className="ghostBtn"
                    onClick={() => void save("manual")}
                    disabled={saveStatus === "saving" || (!dirtyCoreFunding && !dirtyCommitments)}
                    title="Drafts are autosaved. Use this only if you want an immediate save snapshot."
                  >
                    Save snapshot
                  </button>

                  <button
                    type="button"
                    className="neutralBtn"
                    onClick={() => void openFunding()}
                    disabled={!readiness.ok || openingFunding || saveStatus === "saving"}
                    title={
                      readiness.ok
                        ? "Deploy the project clone and open the funding window on-chain."
                        : "Complete the required fields first."
                    }
                  >
                    {openingFunding ? "Opening…" : "Open funding"}
                  </button>
                </div>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 14, marginBottom: 0 }}>
              Drafts are private until funding opens.
            </p>
          </div>
        </section>

        {!readiness.ok ? (
          <section className="section">
            <h2>Readiness</h2>
            <div className="card" style={{ background: "var(--surface)" }}>
              <p className="muted" style={{ marginTop: 0 }}>
                Structure incomplete
              </p>
              {readiness.errors?.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {readiness.errors.map((code, idx) => {
                    const info = errorInfo(code);
                    return (
                      <li key={`${code}-${idx}`} style={{ margin: "6px 0" }}>
                        <button
                          type="button"
                          className="ghostBtn"
                          style={{ padding: "3px 10px", textDecoration: "underline" }}
                          onClick={() => scrollToField(info.field)}
                        >
                          {info.message}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
