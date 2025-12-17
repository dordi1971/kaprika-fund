import { z } from "zod";

/**
 * External links are allowed to be incomplete while a project is in DRAFT.
 * At publish time (IPFS snapshot), validate with the stricter schema below.
 */

export const ExternalLinkTypeSchema = z.enum([
  "website",
  "docs",
  "media",
  "repo",
  "audit",
  "social",
  "other",
]);

const FORBIDDEN_URL_PREFIXES = ["javascript:", "data:", "vbscript:"] as const;

export const ExternalLinkDraftSchema = z
  .object({
    id: z.string().min(1), // uuid or any stable key
    type: ExternalLinkTypeSchema,
    label: z.string().trim().max(40),
    url: z.string().trim().max(2048),
  })
  .superRefine((v, ctx) => {
    const url = v.url.trim();
    if (!url) return; // drafts may keep empty rows

    const lower = url.toLowerCase();
    if (FORBIDDEN_URL_PREFIXES.some((p) => lower.startsWith(p))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "URL scheme not allowed." });
      return;
    }

    if (!lower.startsWith("https://")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Use https:// URLs." });
      return;
    }

    try {
      new URL(url);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "Invalid URL." });
    }
  });

export const ExternalLinksDraftSchema = z.array(ExternalLinkDraftSchema).max(10);

/** Publish-time strict schema (used when generating the immutable IPFS manifest). */
export const ExternalLinkPublishSchema = ExternalLinkDraftSchema.superRefine((v, ctx) => {
  if (!v.label.trim() || v.label.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["label"], message: "Label is required (2–40 chars)." });
  }
  if (!v.url.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["url"], message: "URL is required." });
  }
});

export const ExternalLinksPublishSchema = z
  .array(ExternalLinkPublishSchema)
  .max(10)
  .refine(
    (items) => {
      const seen = new Set<string>();
      for (const i of items) {
        const key = i.url.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    },
    { message: "Duplicate URLs are not allowed." },
  );
