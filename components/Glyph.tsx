import type { Cell } from "@/lib/safety";

/** The picture half of a safety number: both people see the same one. */
export default function Glyph({ cells, size = 96 }: { cells: Cell[]; size?: number }) {
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 84 84" role="img" aria-label="Safety picture">
      {cells.map((c, i) => <rect key={i} x={c.x * 16 + 6} y={c.y * 16 + 6} width="14" height="14" rx="3.5" style={{ fill: c.hue ? "var(--amethyst)" : "var(--green)" }} />)}
    </svg>
  );
}
