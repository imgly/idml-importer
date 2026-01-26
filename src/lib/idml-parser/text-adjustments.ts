import type { FontMetrics } from "./font-metrics";

/**
 * Adjusts line height for CE.SDK rendering.
 *
 * Design tools like Photoshop and InDesign calculate line height based on the
 * full ascender-to-descender distance, while CE.SDK uses the em-square (unitsPerEm).
 * This function converts the source line height factor to work correctly in CE.SDK.
 *
 * @param sourceLineHeight - The line height factor from source file (e.g., 1.2 for 120%)
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
  sourceLineHeight: number,
  metrics: FontMetrics
): number {
  const { ascender, descender, unitsPerEm } = metrics;
  // Guard against division by zero
  if (unitsPerEm === 0) {
    return sourceLineHeight;
  }
  const factor = (ascender - descender) / unitsPerEm;
  if (factor === 0) {
    return sourceLineHeight;
  }
  return sourceLineHeight / factor;
}
