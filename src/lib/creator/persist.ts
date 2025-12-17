import fs from "node:fs";
import path from "node:path";
import type { ProjectEvent, ProjectRecord } from "./types";

/**
 * Minimal persistence layer (MVP-friendly):
 *
 * - One JSON file per project:     data/creator/projects/<id>.json
 * - Append-only JSONL per events:  data/creator/events/<id>.jsonl
 * - Manifest snapshots for IPFS:   data/creator/manifests/<id>.json
 *
 * You can override the root directory with CREATOR_DATA_DIR.
 */

const DEFAULT_ROOT = path.join(process.cwd(), "data", "creator");

function rootDir() {
  return (process.env.CREATOR_DATA_DIR?.trim() || DEFAULT_ROOT).trim();
}

function projectsDir() {
  return path.join(rootDir(), "projects");
}

function eventsDir() {
  return path.join(rootDir(), "events");
}

function manifestsDir() {
  return path.join(rootDir(), "manifests");
}

function ensureDirs() {
  fs.mkdirSync(projectsDir(), { recursive: true });
  fs.mkdirSync(eventsDir(), { recursive: true });
  fs.mkdirSync(manifestsDir(), { recursive: true });
}

function isSafeId(id: string) {
  // Prevent path traversal: allow UUIDs and simple ids only.
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

function safeIdOrNull(id: string) {
  const trimmed = id.trim();
  return isSafeId(trimmed) ? trimmed : null;
}

function projectPath(id: string) {
  const safe = safeIdOrNull(id);
  return safe ? path.join(projectsDir(), `${safe}.json`) : null;
}

function eventsPath(id: string) {
  const safe = safeIdOrNull(id);
  return safe ? path.join(eventsDir(), `${safe}.jsonl`) : null;
}

function manifestPath(id: string) {
  const safe = safeIdOrNull(id);
  return safe ? path.join(manifestsDir(), `${safe}.json`) : null;
}

function atomicWriteText(dest: string, content: string) {
  ensureDirs();
  const dir = path.dirname(dest);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: "utf8" });

  // On Windows, rename doesn't replace existing files.
  try {
    if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  } catch {
    // ignore
  }
  fs.renameSync(tmp, dest);
}

export function writeProjectToDisk(project: ProjectRecord) {
  const file = projectPath(project.id);
  if (!file) return;
  atomicWriteText(file, JSON.stringify(project, null, 2));
}

export function deleteProjectFromDisk(projectId: string) {
  ensureDirs();
  const p = projectPath(projectId);
  const e = eventsPath(projectId);
  const m = manifestPath(projectId);

  for (const file of [p, e, m]) {
    if (!file) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch {
      // ignore
    }
  }
}

function normalizeProjectRecord(parsed: any): ProjectRecord | null {
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;

  const id = parsed.id.trim();
  if (!isSafeId(id)) return null;

  const now = new Date().toISOString();

  const core = parsed.core && typeof parsed.core === "object" ? parsed.core : {};
  const funding = parsed.funding && typeof parsed.funding === "object" ? parsed.funding : {};

  const out: ProjectRecord = {
    id,
    creatorAddress: typeof parsed.creatorAddress === "string" ? parsed.creatorAddress : "",
    status: typeof parsed.status === "string" ? parsed.status : "DRAFT",
    core: {
      title: typeof core.title === "string" ? core.title : null,
      category: typeof core.category === "string" ? core.category : null,
      definition: typeof core.definition === "string" ? core.definition : null,
      deliverableExample: typeof core.deliverableExample === "string" ? core.deliverableExample : null,
      explanation: typeof core.explanation === "string" ? core.explanation : null,
    } as ProjectRecord["core"],
    externalLinks: Array.isArray(parsed.externalLinks) ? parsed.externalLinks : [],
    funding: {
      currency: typeof funding.currency === "string" ? funding.currency : "USDC",
      target: typeof funding.target === "string" ? funding.target : null,
      minimumAllocation: typeof funding.minimumAllocation === "string" ? funding.minimumAllocation : null,
      deadline: typeof funding.deadline === "string" ? funding.deadline : null,
      releaseModel: typeof funding.releaseModel === "string" ? funding.releaseModel : "MILESTONE",
      raised: typeof funding.raised === "string" ? funding.raised : null,
      contractAddress: typeof funding.contractAddress === "string" ? funding.contractAddress : null,
    } as ProjectRecord["funding"],
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments : [],
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : now,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now,
    publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : null,
    closedAt: typeof parsed.closedAt === "string" ? parsed.closedAt : null,
    version: typeof parsed.version === "number" ? parsed.version : 1,
  };

  return out;
}

export function hydrateProjectsFromDisk(into: Map<string, ProjectRecord>) {
  ensureDirs();
  let files: string[] = [];
  try {
    files = fs.readdirSync(projectsDir(), { withFileTypes: false, encoding: "utf8" });
  } catch {
    files = [];
  }

  for (const name of files) {
    if (!name.endsWith(".json")) continue;
    const full = path.join(projectsDir(), name);
    try {
      const raw = fs.readFileSync(full, "utf8");
      const parsed = normalizeProjectRecord(JSON.parse(raw));
      if (!parsed?.id) continue;
      into.set(parsed.id, parsed);
    } catch {
      // Ignore corrupted project files (they can be fixed manually).
    }
  }
}

export function appendEventToDisk(event: ProjectEvent) {
  ensureDirs();
  const file = eventsPath(event.projectId);
  if (!file) return;
  const line = `${JSON.stringify(event)}\n`;
  fs.appendFileSync(file, line, { encoding: "utf8" });
}

export function readEventsFromDisk(projectId: string): ProjectEvent[] {
  ensureDirs();
  const file = eventsPath(projectId);
  if (!file) return [];
  if (!fs.existsSync(file)) return [];

  try {
    const raw = fs.readFileSync(file, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const out: ProjectEvent[] = [];
    for (const line of lines) {
      try {
        const ev = JSON.parse(line) as ProjectEvent;
        if (!ev?.id || !ev?.timestamp) continue;
        out.push(ev);
      } catch {
        // skip bad line
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function writeManifestToDisk(projectId: string, manifest: unknown) {
  const file = manifestPath(projectId);
  if (!file) return null;
  atomicWriteText(file, JSON.stringify(manifest, null, 2));
  return file;
}

export function readManifestFromDisk(projectId: string) {
  ensureDirs();
  const file = manifestPath(projectId);
  if (!file) return null;
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
