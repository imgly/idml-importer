import type { FontMetrics } from "./font-metrics";

/**
 * Adjusts PSD line height for CE.SDK rendering.
 *
 * Photoshop calculates line height based on the full ascender-to-descender distance,
 * while CE.SDK uses the em-square (unitsPerEm). This function converts the PSD
 * line height factor to work correctly in CE.SDK.
 *
 * @param psdLineHeight - The line height factor from PSD (e.g., 1.2 for 120%)
 * @param metrics - Font metrics containing ascender, descender, and unitsPerEm
 * @returns Adjusted line height for CE.SDK, or the original value if metrics are invalid
 *
 * @example
 * ```typescript
 * const metrics = { ascender: 1854, descender: -434, unitsPerEm: 2048 };
 * const adjusted = adjustLineHeight(1.5, metrics);
 * // Result: 1.5 / ((1854 - (-434)) / 2048) = 1.5 / 1.117 ≈ 1.34
 * ```
 */
export function adjustLineHeight(
  psdLineHeight: number,
  metrics: FontMetrics
): number {
  const { ascender, descender, unitsPerEm } = metrics;
  // Guard against division by zero
  if (unitsPerEm === 0) {
    return psdLineHeight;
  }
  const factor = (ascender - descender) / unitsPerEm;
  if (factor === 0) {
    return psdLineHeight;
  }
  return psdLineHeight / factor;
}

/**
 * Calculates the vertical offset needed to align PSD text baseline with CE.SDK.
 *
 * Photoshop positions text differently than CE.SDK. This function calculates
 * the vertical offset needed to match Photoshop's baseline positioning.
 * The formula was empirically derived to match Photoshop's rendering.
 *
 * @param fontSize - The font size in points
 * @param metrics - Font metrics containing ascender, descender, and unitsPerEm
 * @returns Vertical offset in points (negative values move text up), or 0 if metrics are invalid
 *
 * @example
 * ```typescript
 * const metrics = { ascender: 1854, descender: -434, unitsPerEm: 2048 };
 * const offset = calculateVerticalAlignmentOffset(24, metrics);
 * // Use this offset to shift the text block vertically
 * ```
 */
export function calculateVerticalAlignmentOffset(
  fontSize: number,
  metrics: FontMetrics
): number {
  const { descender, ascender, unitsPerEm } = metrics;
  // Guard against division by zero
  if (unitsPerEm === 0) {
    return 0;
  }
  return (((-descender + ascender - unitsPerEm) / unitsPerEm) * fontSize) / 2;
}
