import type { ReactNode } from "react";

export type ArtboardSize = "phone" | "desktop" | "wide" | "square";

type Props = {
  name: string;
  size?: ArtboardSize;
  meta?: string;
  selected?: boolean;
  appearing?: boolean;
  children: ReactNode;
  className?: string;
  /** Content theme — distinct from Draft chrome */
  theme?: "fitness" | "plain";
  onSelect?: () => void;
};

const sizeLabel: Record<ArtboardSize, string> = {
  phone: "390 × 844",
  desktop: "1280 × 800",
  wide: "1440 × 900",
  square: "800 × 800",
};

export function Artboard({
  name,
  size = "phone",
  meta,
  selected,
  appearing,
  children,
  className = "",
  theme = "fitness",
  onSelect,
}: Props) {
  return (
    <div
      className={`artboard artboard--${size} artboard--${theme} ${appearing ? "artboard--appearing" : ""} ${selected ? "is-selected" : ""} ${className}`.trim()}
      onClick={
        onSelect
          ? (e) => {
              e.stopPropagation();
              onSelect();
            }
          : undefined
      }
    >
      <div className="artboard__label">
        <span>{name}</span>
        <span className="artboard__meta">{meta ?? sizeLabel[size]}</span>
      </div>
      <div className="artboard__surface">{children}</div>
      {selected && (
        <div className="selection" aria-hidden>
          <span className="handle tl" />
          <span className="handle tr" />
          <span className="handle bl" />
          <span className="handle br" />
        </div>
      )}
    </div>
  );
}
