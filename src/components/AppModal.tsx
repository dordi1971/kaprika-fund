"use client";

import { useEffect, useId, type ReactNode } from "react";

type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: "ghost" | "neutral";
};

type Props = {
  open: boolean;
  title?: string;
  onClose?: () => void;
  actions: ModalAction[];
  children: ReactNode;
};

export default function AppModal({ open, title = "// NOTICE", onClose, actions, children }: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="modal">
        <div className="modalHeader" id={titleId}>
          {title}
        </div>
        <div>{children}</div>
        <div className="modalActions">
          {actions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              type="button"
              className={action.variant === "neutral" ? "neutralBtn" : "ghostBtn"}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
