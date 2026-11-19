/** Single source of truth for the activity heatmap pixel layout.
 *
 * These are the only places the heatmap's literal pixel dimensions live.
 * monthBlocks (activityHeatmap.ts) is topology-only (cell units) and does not
 * reference these numbers; ActivityHeatmap (src/components/app/) renders them.
 */
export const HEAT_CELL = 12; // px — cell width/height
export const HEAT_GAP = 3; // px — gap between cells and between month blocks
export const HEAT_MONTH_GAP = 12; // px — gap between month blocks
export const HEAT_WEEKDAY_COL = 32; // px — weekday label column width
export const HEAT_RADIUS = 2; // px — cell corner radius
export const HEAT_GRID_HEIGHT =
  7 * HEAT_CELL + (7 - 1) * HEAT_GAP; // px — 7 rows x 12px + 6 gaps x 3px = 102px
export const HEAT_DAYS = 7; // days per week
