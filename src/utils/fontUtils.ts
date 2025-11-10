const BASE_FIELD_HEIGHT = 40;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 96;

interface ResponsiveFontSizeOptions {
  height?: number;
  scale?: number;
  min?: number;
  max?: number;
}

/**
 * Calculates a responsive font size based on the stored font size, field height, and optional scale.
 * - Defaults to 16px when fontSize is not provided.
 * - Scales proportionally with the field height (relative to BASE_FIELD_HEIGHT).
 * - Applies an optional scale factor (e.g., zoom level).
 * - Clamps the result between min/max bounds.
 */
export const getResponsiveFontSize = (
  fontSize?: number,
  {
    height,
    scale = 1,
    min = MIN_FONT_SIZE,
    max = MAX_FONT_SIZE,
  }: ResponsiveFontSizeOptions = {}
): number => {
  const baseSize = fontSize ?? 16;
  const heightFactor = height ? Math.max(height, 1) / BASE_FIELD_HEIGHT : 1;
  const computed = baseSize * heightFactor * scale;

  return Math.min(max, Math.max(min, computed));
};

/**
 * Convenience helper for table cells where the available height is divided by the number of rows.
 */
export const getResponsiveFontSizeForTableCell = (
  fontSize?: number,
  {
    totalHeight,
    rowCount,
    scale = 1,
    min = MIN_FONT_SIZE,
    max = MAX_FONT_SIZE,
  }: {
    totalHeight?: number;
    rowCount?: number;
    scale?: number;
    min?: number;
    max?: number;
  } = {}
): number => {
  const rowHeight = totalHeight && rowCount ? totalHeight / Math.max(rowCount, 1) : undefined;
  return getResponsiveFontSize(fontSize, { height: rowHeight, scale, min, max });
};

