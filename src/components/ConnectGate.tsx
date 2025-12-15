"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

type Props = {
  buttonLabel: string;
  connectHref?: string;
};

export default function ConnectGate({ buttonLabel, connectHref = "/connect" }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingConnect, setPendingConnect] = useState(false);
  const titleId = useId();
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
    setPendingConnect(false);
    router.push(connectHref);
  }, [connectHref, isConnected, pendingConnect, router]);

  if (isConnected) {
    return (
      <Link className="neutralBtn" href={connectHref}>
        {buttonLabel}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className="neutralBtn" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {open ? (
        <div
          className="modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="modal">
            <div className="modalHeader" id={titleId}>
              {"// INTERRUPTION"}
            </div>
            <p>
              You are about to act.
              <br />
              Action here is explicit and traceable.
              <br />
              To continue, connect a wallet.
            </p>
            <div className="modalActions">
              <button type="button" className="ghostBtn" onClick={() => setOpen(false)}>
                Return
              </button>
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
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
