export interface HighlightBox {
  /** [ymin, xmin, ymax, xmax], normalized 0-1000 relative to the page image. */
  bbox: [number, number, number, number];
  color?: "emerald" | "amber";
}

interface HighlightOverlayProps {
  boxes: HighlightBox[];
}

const COLOR_CLASSES: Record<NonNullable<HighlightBox["color"]>, string> = {
  emerald: "border-emerald-500 bg-emerald-400/25",
  amber: "border-amber-500 bg-amber-400/25",
};

/**
 * Absolutely-positioned highlight boxes over a page image, sized/positioned in percentages
 * of the wrapping element. Since bbox coordinates are normalized 0-1000 over the whole page
 * and the wrapper is sized to exactly match the rendered <img> (natural aspect ratio, no
 * cropping), percentage positioning tracks the image's true displayed pixel box at any zoom
 * level or viewport width automatically — no pixel math or resize listeners needed.
 */
export default function HighlightOverlay({ boxes }: HighlightOverlayProps) {
  if (boxes.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {boxes.map(({ bbox, color = "emerald" }, index) => {
        const [ymin, xmin, ymax, xmax] = bbox;
        return (
          <div
            key={index}
            className={`absolute rounded-sm border-2 ${COLOR_CLASSES[color]}`}
            style={{
              top: `${ymin / 10}%`,
              left: `${xmin / 10}%`,
              width: `${(xmax - xmin) / 10}%`,
              height: `${(ymax - ymin) / 10}%`,
            }}
          />
        );
      })}
    </div>
  );
}
