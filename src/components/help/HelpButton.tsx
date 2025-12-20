"use client";

import { useId, useState } from "react";
import HelpDrawer from "@/components/help/HelpDrawer";

export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  return (
    <>
      <button
        type="button"
        className="ghostBtn"
        onClick={() => setOpen(true)}
        aria-label="Help"
        title="Help"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={drawerId}
        style={{ paddingInline: 10 }}
      >
        ?
      </button>
      <HelpDrawer id={drawerId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
