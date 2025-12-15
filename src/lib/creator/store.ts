import crypto from "node:crypto";
import type { ProjectEvent, ProjectEventType, ProjectRecord, ProjectStatus } from "./types";

type CreatorStore = {
  nonces: Map<string, string>;
  sessions: Map<string, { address: string; createdAt: string }>;
  projects: Map<string, ProjectRecord>;
  eventsByProjectId: Map<string, ProjectEvent[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __observerSystemCreatorStore: CreatorStore | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

export function getCreatorStore(): CreatorStore {
  if (!globalThis.__observerSystemCreatorStore) {
    globalThis.__observerSystemCreatorStore = {
      nonces: new Map(),
      sessions: new Map(),
      projects: new Map(),
      eventsByProjectId: new Map(),
    };
  }
  return globalThis.__observerSystemCreatorStore;
}

export function issueNonce(address: string) {
  const store = getCreatorStore();
  const normalized = normalizeAddress(address);
  const nonce = `kaprika-crowdfund: ${nowIso()}: ${crypto.randomUUID()}`;
  store.nonces.set(normalized, nonce);
  return nonce;
}

export function consumeNonce(address: string, nonce: string) {
  const store = getCreatorStore();
  const normalized = normalizeAddress(address);
  const expected = store.nonces.get(normalized);
  if (!expected) return false;
  if (expected !== nonce) return false;
  store.nonces.delete(normalized);
  return true;
}

export function createSession(address: string) {
  const store = getCreatorStore();
  const token = crypto.randomUUID();
  store.sessions.set(token, { address: normalizeAddress(address), createdAt: nowIso() });
  return token;
}

export function sessionAddress(token: string | undefined) {
  if (!token) return null;
  const store = getCreatorStore();
  const session = store.sessions.get(token);
  return session?.address ?? null;
}

export function createDraftProject(creatorAddress: string): ProjectRecord {
  const store = getCreatorStore();
  const timestamp = nowIso();
  const id = crypto.randomUUID();
  const record: ProjectRecord = {
    id,
    creatorAddress: normalizeAddress(creatorAddress),
    status: "DRAFT",
    core: {
      title: null,
      category: null,
      definition: null,
      explanation: null,
    },
    funding: {
      currency: "USDC",
      target: null,
      minimumAllocation: null,
      deadline: null,
      releaseModel: "MILESTONE",
      raised: null,
      contractAddress: null,
    },
    commitments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: null,
    closedAt: null,
    version: 1,
  };
  store.projects.set(id, record);
  appendEvent(id, "CREATED", record.creatorAddress);
  return record;
}

export function getProject(id: string) {
  const store = getCreatorStore();
  return store.projects.get(id) ?? null;
}

export function listProjectsByCreator(creatorAddress: string) {
  const store = getCreatorStore();
  const normalized = normalizeAddress(creatorAddress);
  const items: ProjectRecord[] = [];
  for (const project of store.projects.values()) {
    if (project.creatorAddress === normalized) items.push(project);
  }
  return items;
}

export function updateProject(
  projectId: string,
  actorAddress: string,
  patch: Partial<Omit<ProjectRecord, "core" | "funding">> & {
    core?: Partial<ProjectRecord["core"]>;
    funding?: Partial<ProjectRecord["funding"]>;
  },
  ifMatchVersion?: number,
) {
  const store = getCreatorStore();
  const existing = store.projects.get(projectId);
  if (!existing) return { ok: false as const, status: 404 as const, project: null };

  if (typeof ifMatchVersion === "number" && existing.version !== ifMatchVersion) {
    return { ok: false as const, status: 409 as const, project: existing };
  }

  const timestamp = nowIso();
  const next: ProjectRecord = {
    ...existing,
    ...patch,
    core: { ...existing.core, ...(patch.core ?? {}) },
    funding: { ...existing.funding, ...(patch.funding ?? {}) },
    updatedAt: timestamp,
    version: existing.version + 1,
  };
  store.projects.set(projectId, next);
  appendEvent(projectId, "EDITED", normalizeAddress(actorAddress));
  return { ok: true as const, status: 200 as const, project: next };
}

export function updateCommitments(
  projectId: string,
  actorAddress: string,
  commitments: ProjectRecord["commitments"],
  ifMatchVersion?: number,
) {
  const store = getCreatorStore();
  const existing = store.projects.get(projectId);
  if (!existing) return { ok: false as const, status: 404 as const, project: null };

  if (existing.status !== "DRAFT") {
    return { ok: false as const, status: 403 as const, project: existing };
  }

  if (typeof ifMatchVersion === "number" && existing.version !== ifMatchVersion) {
    return { ok: false as const, status: 409 as const, project: existing };
  }

  const timestamp = nowIso();
  const next: ProjectRecord = {
    ...existing,
    commitments,
    updatedAt: timestamp,
    version: existing.version + 1,
  };
  store.projects.set(projectId, next);
  appendEvent(projectId, "COMMITMENTS_UPDATED", normalizeAddress(actorAddress));
  return { ok: true as const, status: 200 as const, project: next };
}

export function deleteDraftProject(projectId: string, actorAddress: string) {
  const store = getCreatorStore();
  const existing = store.projects.get(projectId);
  if (!existing) return { ok: false as const, status: 404 as const };
  if (existing.status !== "DRAFT") return { ok: false as const, status: 403 as const };
  store.projects.delete(projectId);
  appendEvent(projectId, "STATUS_CHANGED", normalizeAddress(actorAddress), {
    status: "DELETED",
  });
  return { ok: true as const, status: 204 as const };
}

export function setProjectStatus(
  projectId: string,
  actorAddress: string,
  status: ProjectStatus,
  extra?: Partial<ProjectRecord>,
) {
  const store = getCreatorStore();
  const existing = store.projects.get(projectId);
  if (!existing) return { ok: false as const, status: 404 as const, project: null };

  const timestamp = nowIso();
  const next: ProjectRecord = {
    ...existing,
    ...(extra ?? {}),
    status,
    updatedAt: timestamp,
    version: existing.version + 1,
  };
  store.projects.set(projectId, next);
  appendEvent(projectId, "STATUS_CHANGED", normalizeAddress(actorAddress), { status });
  return { ok: true as const, status: 200 as const, project: next };
}

export function appendEvent(
  projectId: string,
  type: ProjectEventType,
  actorAddress: string,
  payload?: Record<string, unknown>,
) {
  const store = getCreatorStore();
  const event: ProjectEvent = {
    id: crypto.randomUUID(),
    projectId,
    type,
    timestamp: nowIso(),
    actorAddress: normalizeAddress(actorAddress),
    payload,
  };
  const list = store.eventsByProjectId.get(projectId) ?? [];
  list.push(event);
  store.eventsByProjectId.set(projectId, list);
  return event;
}

export function listEvents(projectId: string) {
  const store = getCreatorStore();
  return store.eventsByProjectId.get(projectId) ?? [];
}
