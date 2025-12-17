"use client";

import type { CSSProperties } from "react";
import type { ExternalLink, ExternalLinkType } from "@/lib/creator/types";

type Props = {
  value: ExternalLink[];
  onChange: (next: ExternalLink[]) => void;
  maxItems?: number;
};

const TYPES: Array<{ value: ExternalLinkType; label: string }> = [
  { value: "website", label: "Project website" },
  { value: "docs", label: "Docs" },
  { value: "media", label: "Media" },
  { value: "repo", label: "Repository" },
  { value: "audit", label: "Audit" },
  { value: "social", label: "Social" },
  { value: "other", label: "Other" },
];

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `l_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function move<T>(arr: T[], from: number, to: number) {
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function isSuspiciousUrl(url: string) {
  const u = url.trim().toLowerCase();
  return u.startsWith("javascript:") || u.startsWith("data:") || u.startsWith("vbscript:");
}

function urlHint(url: string) {
  const u = url.trim();
  if (!u) return null;
  if (isSuspiciousUrl(u)) return "Blocked URL scheme.";
  if (!u.toLowerCase().startsWith("https://")) return "Use https://";
  try {
    new URL(u);
  } catch {
    return "Invalid URL.";
  }
  return null;
}

export default function ExternalLinksEditor({ value, onChange, maxItems = 10 }: Props) {
  const items = value ?? [];

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "10px 12px",
    color: "var(--text)",
    fontFamily: "inherit",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <label className="kvKey" style={{ margin: 0 }}>
          External links
        </label>
        <span className="muted num" style={{ fontSize: 12 }}>
          {items.length}/{maxItems}
        </span>
      </div>

      <div className="muted" style={{ marginTop: 6 }}>
        Optional. Use short labels. Links should be <span className="num">https://</span>.
      </div>

      <div style={{ height: 12 }} />

      {items.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((link, idx) => {
            const hint = urlHint(link.url);
            return (
              <div
                key={link.id}
                style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 12 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 10 }}>
                  <div>
                    <div className="kvKey">Type</div>
                    <select
                      value={link.type}
                      onChange={(e) =>
                        onChange(items.map((it) => (it.id === link.id ? { ...it, type: e.target.value as ExternalLinkType } : it)))
                      }
                      style={{ ...inputStyle, borderRadius: "var(--radius)" }}
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="kvKey">Label</div>
                    <input
                      value={link.label}
                      placeholder="e.g., Project website"
                      maxLength={40}
                      onChange={(e) => onChange(items.map((it) => (it.id === link.id ? { ...it, label: e.target.value } : it)))}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div>
                  <div className="kvKey">URL</div>
                  <input
                    value={link.url}
                    placeholder="https://…"
                    maxLength={2048}
                    onChange={(e) => onChange(items.map((it) => (it.id === link.id ? { ...it, url: e.target.value } : it)))}
                    style={inputStyle}
                  />
                  {hint ? (
                    <div className="muted num" style={{ marginTop: 6, fontSize: 12 }}>
                      {hint}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={idx === 0}
                      onClick={() => onChange(move(items, idx, idx - 1))}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ghostBtn"
                      disabled={idx === items.length - 1}
                      onClick={() => onChange(move(items, idx, idx + 1))}
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>

                  <button type="button" className="ghostBtn" onClick={() => onChange(items.filter((it) => it.id !== link.id))}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="muted">No links yet.</div>
      )}

      <div style={{ height: 12 }} />

      <button
        type="button"
        className="neutralBtn"
        disabled={items.length >= maxItems}
        onClick={() => onChange([...items, { id: newId(), type: "website", label: "", url: "" }])}
      >
        Add link
      </button>
    </div>
  );
}
