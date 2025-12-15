"use client";

import { useState } from "react";

type Props = {
  value: string;
  label: string;
};

export default function CopyButton({ value, label }: Props) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="ghostBtn"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 900);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : `Copy ${label}`}
    </button>
  );
}

