"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId } from "react";
import { useAccount } from "wagmi";
import HelpButton from "@/components/help/HelpButton";
import ThemeToggle from "@/components/ThemeToggle";
import WalletButton from "@/components/WalletButton";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileNavDrawer({
  id,
  open,
  onClose,
}: {
  id?: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() || "/";
  const { isConnected } = useAccount();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const links = [
    { href: "/observe", label: "Observe", hint: "Global index" },
    ...(isConnected ? [{ href: "/desk", label: "Desk", hint: "Your assets" }] : []),
    { href: "/propose", label: "Propose", hint: "Create / publish" },
  ];

  return (
    <div
      id={id}
      className="drawerOverlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="drawerPanel">
        <div className="drawerHeader">
          <div>
            <div className="metaLabel">NAV // MOBILE</div>
            <div className="projectTitle" style={{ marginTop: 4 }} id={titleId}>
              Kaprika
            </div>
          </div>

          <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
            <HelpButton />
            <button type="button" className="ghostBtn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="drawerBody">
          <div className="drawerActions">
            <WalletButton />
            <ThemeToggle />
          </div>

          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`drawerLink ${active ? "drawerLinkActive" : ""}`}
                onClick={onClose}
              >
                <div>
                  <div className="projectTitle">{link.label}</div>
                  <div className="drawerHint">{link.hint}</div>
                </div>
                <div className="muted">&rarr;</div>
              </Link>
            );
          })}

          <div className="muted" style={{ marginTop: 14 }}>
            Tip: Desk appears only when your wallet is connected.
          </div>
        </div>
      </div>
    </div>
  );
}
