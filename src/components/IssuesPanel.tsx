"use client";

import type { OpenFundingError } from "@/lib/openFundingErrors";

const ANCHORS: Record<string, string> = {
  title: "section-title",
  category: "section-category",
  definition: "section-definition",
  funding: "section-funding",
  commitments: "section-commitments",
};

export function IssuesPanel({
  errors,
  onDismiss,
}: {
  errors: OpenFundingError[];
  onDismiss?: () => void;
}) {
  if (!errors.length) return null;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Cannot open funding</div>
          <div className="mt-1 text-sm opacity-80">
            The structure is incomplete. Resolve the issues below.
          </div>
        </div>
        {onDismiss && (
          <button className="text-sm underline opacity-70 hover:opacity-100" onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {errors.map((e, idx) => {
          const anchor = e.field ? ANCHORS[e.field] : undefined;
          return (
            <li key={`${e.code}-${idx}`} className="text-sm">
              {anchor ? (
                <button
                  className="text-left underline"
                  onClick={() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                >
                  {e.message}
                </button>
              ) : (
                <span>{e.message}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
