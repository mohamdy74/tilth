/*
 * Shareable consistency card: renders a habit heatmap + headline stats to a
 * canvas and exports a PNG. Pure layout math is separated from the canvas
 * drawing so it can be unit-tested; colors arrive as resolved CSS token
 * values (the caller reads them from getComputedStyle at call time).
 */

export type ShareCellKind = "done" | "skipped" | "missed" | "upcoming" | "off" | "frozen";

export interface ShareCardInput {
  title: string;
  subtitle: string;
  /** Week columns, each 7 days (oldest week first). */
  weeks: ShareCellKind[][];
  stats: { label: string; value: string }[];
  colors: {
    background: string;
    card: string;
    foreground: string;
    muted: string;
    primary: string;
    accent: string;
    border: string;
    warning: string;
  };
  rtl: boolean;
}

export const CARD_W = 1080;
export const CARD_H = 630;
const CELL = 34;
const GAP = 8;
const PAD = 64;

export interface CellRect {
  x: number;
  y: number;
  size: number;
  kind: ShareCellKind;
}

/** Grid geometry: weeks flow with reading direction (RTL mirrors columns). */
export function shareCardLayout(weeks: ShareCellKind[][], rtl: boolean): CellRect[] {
  const out: CellRect[] = [];
  const gridW = weeks.length * (CELL + GAP) - GAP;
  const x0 = rtl ? CARD_W - PAD - gridW : PAD;
  const y0 = 250;
  weeks.forEach((week, wi) => {
    const col = rtl ? weeks.length - 1 - wi : wi;
    week.forEach((kind, di) => {
      out.push({
        x: x0 + col * (CELL + GAP),
        y: y0 + di * (CELL + GAP),
        size: CELL,
        kind,
      });
    });
  });
  return out;
}

function fillFor(kind: ShareCellKind, c: ShareCardInput["colors"]): string {
  switch (kind) {
    case "done":
      return c.primary;
    case "skipped":
      return c.accent;
    case "missed":
      return c.border;
    case "frozen":
      return c.warning;
    default:
      return c.card;
  }
}

/** Draw the card. Client-only (canvas); never imported by SSR-reachable code paths at top level. */
export function drawShareCard(canvas: HTMLCanvasElement, input: ShareCardInput): void {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const g = canvas.getContext("2d");
  if (!g) return;
  const c = input.colors;
  g.fillStyle = c.background;
  g.fillRect(0, 0, CARD_W, CARD_H);
  // soft accent field top corner
  const grad = g.createRadialGradient(CARD_W - 120, 40, 20, CARD_W - 120, 40, 520);
  grad.addColorStop(0, c.accent);
  grad.addColorStop(1, c.background);
  g.globalAlpha = 0.5;
  g.fillStyle = grad;
  g.fillRect(0, 0, CARD_W, CARD_H);
  g.globalAlpha = 1;

  g.textAlign = input.rtl ? "right" : "left";
  const tx = input.rtl ? CARD_W - PAD : PAD;
  g.fillStyle = c.foreground;
  g.font = "600 44px system-ui, sans-serif";
  g.fillText(input.title, tx, 110);
  g.fillStyle = c.muted;
  g.font = "400 26px system-ui, sans-serif";
  g.fillText(input.subtitle, tx, 156);

  for (const cell of shareCardLayout(input.weeks, input.rtl)) {
    g.fillStyle = fillFor(cell.kind, c);
    g.beginPath();
    const r = 8;
    g.roundRect(cell.x, cell.y, cell.size, cell.size, r);
    g.fill();
    if (cell.kind === "skipped" || cell.kind === "off" || cell.kind === "upcoming") {
      g.strokeStyle = c.border;
      g.lineWidth = 2;
      g.stroke();
    }
  }

  // stats row along the bottom
  const n = input.stats.length;
  const slot = (CARD_W - PAD * 2) / Math.max(1, n);
  input.stats.forEach((s, i) => {
    const cx = input.rtl ? CARD_W - PAD - slot * i - slot / 2 : PAD + slot * i + slot / 2;
    g.textAlign = "center";
    g.fillStyle = c.foreground;
    g.font = "600 40px system-ui, sans-serif";
    g.fillText(s.value, cx, CARD_H - 96);
    g.fillStyle = c.muted;
    g.font = "400 22px system-ui, sans-serif";
    g.fillText(s.label, cx, CARD_H - 58);
  });
}

/** PNG data URL of the drawn card. */
export function shareCardDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
