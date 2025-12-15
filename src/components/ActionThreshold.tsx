"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import type { ProjectState } from "@/lib/types";

type Props = {
  state: ProjectState;
  actionLabel?: string;
  connectHref?: string;
};

export default function ActionThreshold({
  state,
  actionLabel = "Allocate capital",
  connectHref = "/connect",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState(false);
  const modalTitleId = useId();
  const router = useRouter();
  const { isConnected } = useAccount();
  const { open: openWalletModal } = useAppKit();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!pendingConnect) return;
    if (!isConnected) return;
    router.push(connectHref);
    setPendingConnect(false);
  }, [connectHref, isConnected, pendingConnect, router]);

  if (state === "draft") {
    return (
      <div className="actionLine">
        <div>
          <div className="muted" style={{ textTransform: "uppercase", fontSize: 12 }}>
            Status: Draft
          </div>
          <div className="muted">Funding has not opened.</div>
        </div>
      </div>
    );
  }

  if (state === "completed") {
    return (
      <div className="actionLine">
        <div>
          <div className="muted" style={{ textTransform: "uppercase", fontSize: 12 }}>
            Status: Completed
          </div>
          <div className="muted">Final outcome is recorded below.</div>
        </div>
        <a className="ghostBtn" href="#history">
          View outcome
        </a>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="actionLine">
        <div>
          <div className="muted" style={{ textTransform: "uppercase", fontSize: 12 }}>
            Status: Failed
          </div>
          <div className="muted">Funds returned according to terms.</div>
        </div>
        <a className="ghostBtn" href="#history">
          View fund returns
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="actionLine">
        <div>
          <div className="muted" style={{ textTransform: "uppercase", fontSize: 12 }}>
            Status: Active
          </div>
          <div>This project is currently active.</div>
        </div>
        <button type="button" className="neutralBtn" onClick={() => setOpen(true)}>
          {actionLabel}
        </button>
      </div>

      {open ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal">
            <div className="modalHeader" id={modalTitleId}>
              {"// INTERRUPTION"}
            </div>
            {isConnected ? (
              <p>
                Wallet is connected.
                <br />
                Allocation execution is not implemented in this prototype yet.
              </p>
            ) : (
              <p>
                You are about to act.
                <br />
                Action here is explicit and traceable.
                <br />
                To continue, connect a wallet.
              </p>
            )}
            <div className="modalActions">
              <button type="button" className="ghostBtn" onClick={() => setOpen(false)}>
                Return
              </button>
              {!isConnected ? (
                <>
                  <button
                    type="button"
                    className="neutralBtn"
                    onClick={() => {
                      setPendingConnect(true);
                      setOpen(false);
                      openWalletModal();
                    }}
                  >
                    Connect wallet
                  </button>
                  <Link className="ghostBtn" href={connectHref} onClick={() => setOpen(false)}>
                    Open connect interface
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
