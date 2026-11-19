/** Single source of truth for the activity heatmap pixel layout.
 *
 * These are the only places the heatmap's literal pixel dimensions live.
 * monthBlocks (activityHeatmap.ts) is topology-only (cell units) and does not
 * reference these numbers; ActivityHeatmap (src/components/app/) renders them.
 */
export const HEAT_CELL = 28; // px — cell width/height
export const HEAT_GAP = 6; // px — gap between cells
export const HEAT_RADIUS = 4; // px — cell corner radius
export const HEAT_WEEKDAY_COL = 32; // px — weekday label column width
export const HEAT_LABEL_GAP = 8; // px — gap between label column and grid
export const HEAT_LEGEND_CELL = 16; // px — legend swatch width/height
export const HEAT_LEGEND_GAP = 4; // px — gap between legend swatches

export const HEAT_DAYS = 7; // days per week

/** Grid height: 7 rows x HEAT_CELL + 6 gaps x HEAT_GAP = 232px. */
export function HEAT_GRID_HEIGHT(): number {
  return HEAT_DAYS * HEAT_CELL + (HEAT_DAYS - 1) * HEAT_GAP;
}

/** Block width for a given column count: cols x HEAT_CELL + (cols-1) x HEAT_GAP. */
export function HEAT_BLOCK_WIDTH(cols: number): number {
  return cols * HEAT_CELL + (cols - 1) * HEAT_GAP;
}
