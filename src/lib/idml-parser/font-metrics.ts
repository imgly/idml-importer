/**
 * Font Metrics Extraction Module
 *
 * This module provides functionality to extract font metrics (ascender, descender,
 * unitsPerEm) from font files. These metrics are essential for accurate text
 * positioning when importing PSD files into CE.SDK.
 *
 * Supported formats: TTF, OTF, WOFF, WOFF2
 *
 * Usage:
 * ```typescript
 * import { FontRenderingAdapter } from './font-metrics';
 *
 * const adapter = new FontRenderingAdapter();
 *
 * // Load metrics from a font URL (fetches, parses, and caches automatically)
 * const result = await adapter.load('https://fonts.example.com/Roboto-Regular.ttf');
 * if (result.metrics) {
 *   console.log('Ascender:', result.metrics.ascender);
 *   console.log('Descender:', result.metrics.descender);
 *   console.log('Units per Em:', result.metrics.unitsPerEm);
 * } else {
 *   console.error('Failed to load font:', result.error?.message);
 * }
 *
 * // Check if metrics are cached
 * if (adapter.has(fontURI)) {
 *   const metrics = adapter.get(fontURI);
 * }
 *
 * // Clear cache when done
 * adapter.clear();
 * ```
 *
 * For PSD-specific text adjustments, see `psd-text-adjustments.ts`.
 */

// @ts-expect-error - opentype.js lacks TypeScript declarations
import opentype from "opentype.js";

export interface FontMetrics {
  ascender: number;
  descender: number;
  unitsPerEm: number;
}

export type FontParseErrorType =
  | "FETCH_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "PARSE_FAILED"
  | "WOFF2_DECOMPRESS_FAILED";

export interface FontParseError {
  type: FontParseErrorType;
  message: string;
}

export interface FontLoadResult {
  metrics: FontMetrics | null;
  error?: FontParseError;
}

type FontFormat = "ttf" | "otf" | "woff" | "woff2" | "unknown";

function getFontFormat(buffer: ArrayBuffer): FontFormat {
  const b = new Uint8Array(buffer);
  if (b.length < 4) return "unknown";
  if (b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32)
    return "woff2";
  if (b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x46)
    return "woff";
  if (
    (b[0] === 0x00 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) ||
    (b[0] === 0x74 && b[1] === 0x72 && b[2] === 0x75 && b[3] === 0x65)
  )
    return "ttf";
  if (b[0] === 0x4f && b[1] === 0x54 && b[2] === 0x54 && b[3] === 0x4f)
    return "otf";
  return "unknown";
}

/**
 * Decompresses a font buffer if needed (e.g., WOFF2 → TTF).
 * Uses dynamic import to lazily load woff2-encoder only when needed.
 *
 * Note: WOFF (v1) is not decompressed here because opentype.js handles it natively.
 * Only WOFF2 requires explicit decompression before parsing.
 */
async function decompressFontBuffer(
  buffer: ArrayBuffer,
  format: FontFormat
): Promise<ArrayBuffer> {
  if (format === "woff2") {
    const { default: decompress } = await import("woff2-encoder/decompress");
    const result = await decompress(buffer);
    return result.buffer as ArrayBuffer;
  }
  // TTF, OTF, and WOFF are handled natively by opentype.js
  return buffer;
}

/**
 * Font metrics storage with built-in loading from URLs.
 * Handles fetching, format detection, parsing, and caching.
 * Also caches errors to avoid repeated fetch attempts for broken URLs.
 */
export class FontRenderingAdapter {
  private cache: Map<string, FontLoadResult> = new Map();

  /** Check if metrics are already loaded for a font */
  has(fontURI: string): boolean {
    return this.cache.has(fontURI);
  }

  /** Get cached metrics (returns null if not loaded or if load failed) */
  get(fontURI: string): FontMetrics | null {
    return this.cache.get(fontURI)?.metrics ?? null;
  }

  /** Get cached error (returns undefined if not loaded or if load succeeded) */
  getError(fontURI: string): FontParseError | undefined {
    return this.cache.get(fontURI)?.error;
  }

  /**
   * Load font metrics from URL. Fetches, detects format, parses, and caches.
   * Returns cached result (success or error) if already attempted.
   */
  async load(fontURI: string): Promise<FontLoadResult> {
    const cached = this.cache.get(fontURI);
    if (cached) return { metrics: cached.metrics, error: cached.error };

    // Fetch
    let buffer: ArrayBuffer;
    try {
      const res = await fetch(fontURI);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      buffer = await res.arrayBuffer();
    } catch (e) {
      const result: FontLoadResult = {
        metrics: null,
        error: { type: "FETCH_FAILED", message: String(e) },
      };
      this.cache.set(fontURI, result);
      return result;
    }

    // Detect format
    const format = getFontFormat(buffer);
    if (format === "unknown") {
      const result: FontLoadResult = {
        metrics: null,
        error: { type: "UNSUPPORTED_FORMAT", message: "Unknown font format" },
      };
      this.cache.set(fontURI, result);
      return result;
    }

    // Decompress if needed (WOFF2 → TTF)
    try {
      buffer = await decompressFontBuffer(buffer, format);
    } catch (e) {
      const result: FontLoadResult = {
        metrics: null,
        error: {
          type: "WOFF2_DECOMPRESS_FAILED",
          message: String(e),
        },
      };
      this.cache.set(fontURI, result);
      return result;
    }

    // Parse
    try {
      const font = opentype.parse(buffer);
      const { ascender, descender, unitsPerEm } = font;
      if (
        typeof ascender !== "number" ||
        typeof descender !== "number" ||
        typeof unitsPerEm !== "number"
      ) {
        throw new Error("Missing metrics");
      }
      const metrics: FontMetrics = { ascender, descender, unitsPerEm };
      const result: FontLoadResult = { metrics };
      this.cache.set(fontURI, result);
      return result;
    } catch (e) {
      const result: FontLoadResult = {
        metrics: null,
        error: { type: "PARSE_FAILED", message: String(e) },
      };
      this.cache.set(fontURI, result);
      return result;
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
