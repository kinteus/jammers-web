"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

type DismissibleAmbientQuoteProps = {
  children: ReactNode;
  className: string;
  depth: string;
  edge: string;
  style: CSSProperties;
};

export function DismissibleAmbientQuote({
  children,
  className,
  depth,
  edge,
  style,
}: DismissibleAmbientQuoteProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <button
      aria-label="Hide quote"
      className={className}
      data-depth={depth}
      data-edge={edge}
      onClick={() => setIsDismissed(true)}
      style={style}
      type="button"
    >
      {children}
    </button>
  );
}
