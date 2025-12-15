"use client";

import { useEffect } from "react";

/**
 * A tiny, non-text "observer effect": the UI starts slightly "unresolved" and
 * collapses to a single, crisp state on the first user interaction.
 */
export default function ObserverCollapse() {
  useEffect(() => {
    const root = document.documentElement;

    // Do not re-trigger within the same session.
    if (root.dataset.observed === "1") return;

    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      root.dataset.observed = "1";
    };

    const onPointer = () => mark();
    const onKey = () => mark();
    const onScroll = () => mark();

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
