"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { HELP_CONTENT } from "@/lib/help/content";
import { getHelpKey } from "@/lib/help/getHelpKey";

export default function HelpDrawer({
  id,
  open,
  onClose,
}: {
  id?: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() || "/";
  const key = useMemo(() => getHelpKey(pathname), [pathname]);
  const entry = HELP_CONTENT[key] ?? HELP_CONTENT.home;
  const titleId = useId();
  const summaryId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      id={id}
      className="modalOverlay helpOverlay"
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={summaryId}
    >
      <div
        className="card helpPanel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cardBody">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div>
              <span className="metaLabel">HELP // {key}</span>
              <h2 className="pageTitle" style={{ marginTop: 6 }} id={titleId}>
                {entry.title}
              </h2>
              <p className="muted" style={{ marginTop: 6 }} id={summaryId}>
                {entry.summary}
              </p>
            </div>
            <button type="button" className="ghostBtn" onClick={onClose} ref={closeButtonRef}>
              Close
            </button>
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            {entry.sections.map((s, i) => (
              <div key={i} className="card" style={{ padding: 0 }}>
                <div className="cardBody">
                  <div className="projectTitle">{s.title}</div>
                  <ul className="listPlain" style={{ marginTop: 8, marginBottom: 0 }}>
                    {s.bullets.map((b, j) => (
                      <li key={j} className="muted" style={{ padding: "6px 0" }}>
                        • {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="muted" style={{ marginTop: 14 }}>
            Tip: We can add one-sentence “What this does” hints directly into UI controls later — without turning it
            into a tour.
          </div>
        </div>
      </div>
    </div>
  );
}
