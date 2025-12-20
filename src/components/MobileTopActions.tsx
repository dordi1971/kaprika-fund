"use client";

import { useId, useState } from "react";
import MobileNavDrawer from "@/components/MobileNavDrawer";

export default function MobileTopActions() {
  const [open, setOpen] = useState(false);
  const drawerId = useId();

  return (
    <>
      <button
        type="button"
        className="ghostBtn"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        title="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={drawerId}
        style={{ paddingInline: 10 }}
      >
        <span aria-hidden="true">&equiv;</span>
      </button>

      <MobileNavDrawer id={drawerId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
