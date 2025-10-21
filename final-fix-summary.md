# IDML Importer Image Zoom Regression - Final Fix

**Date**: October 21, 2025
**Status**: ✅ **FIXED**

## Problem Summary

After implementing fixes for shaped images with Bézier curves (the "flat bottom" issue), a regression was introduced where **images within shapes appeared excessively zoomed in**, causing logos and other content to be cut off at the edges.

### Example Issue
The CELUM logo at the top of the design was zoomed in, cutting off parts of the "celum" text and the "C" icon.

---

## Root Cause Analysis

The regression was caused by changes to the `handleGraphicWithImageFill` function. Here's what happened:

### Original Code Behavior (Working)
```typescript
// Old code (HEAD~2)
this.engine.block.setFill(block, fill);
this.engine.block.setKind(block, "image");

// Only set ContentFillMode to "Contain" in special cases
if (leftCrop < 0 && topCrop < 0 && rightCrop < 0 && bottomCrop < 0) {
  this.engine.block.setContentFillMode(block, "Contain");
}
// In most cases, no explicit fill mode was set
```

### Problematic Code (After Initial Fix)
```typescript
// Broken code that caused zoom regression
this.engine.block.setFill(block, fill);
// Removed: this.engine.block.setKind(block, "image");
this.engine.block.setClipped(block, true);

// THIS LINE CAUSED THE PROBLEM:
this.engine.block.setContentFillMode(block, "Cover");  // ❌ Always using Cover
```

**Why This Broke:**
- Setting `ContentFillMode` to **"Cover"** makes the image fill the entire frame while maintaining aspect ratio
- This causes the image to be scaled up (zoomed in) to ensure no empty space in the frame
- Result: Images appear excessively zoomed, cutting off content at the edges

---

## The Fix

The solution was to **remove the forced "Cover" mode** and only set a fill mode when explicitly needed (matching the original behavior).

### Fixed Code
```typescript
// src/lib/idml-parser/index.ts (lines 991-1016)

// Don't set kind to "image" - keep it as "shape" for shaped frames
// Setting kind to "image" would override the vector path shape

// Enable clipping so that the image respects the shape boundaries
this.engine.block.setClipped(block, true);

// Check if we should set a specific fill mode based on FrameFittingOption
// If all crops are negative, the image is shrunk inside the frame - use Contain mode
const frameFittingOption = element.querySelector("FrameFittingOption");
if (frameFittingOption) {
  const [leftCrop, topCrop, rightCrop, bottomCrop] = [
    "LeftCrop",
    "TopCrop",
    "RightCrop",
    "BottomCrop",
  ].map((crop) => parseFloat(frameFittingOption.getAttribute(crop) ?? "0"));

  if (leftCrop < 0 && topCrop < 0 && rightCrop < 0 && bottomCrop < 0) {
    // Negative crops mean the image is shrunk - use Contain to prevent cropping
    this.engine.block.setContentFillMode(block, "Contain");
  }
}
// NOTE: We don't explicitly set a fill mode in the normal case.
// This allows the engine to use its default behavior, which produces better results
// than always using "Cover" mode (which can cause excessive zooming).

return true;
```

---

## Key Changes Made

1. ✅ **Removed forced "Cover" mode** - No longer always setting `ContentFillMode` to "Cover"
2. ✅ **Preserved original logic** - Only set "Contain" mode when all crops are negative (shrunk images)
3. ✅ **Kept clipping enabled** - `setClipped(true)` ensures images respect shape boundaries
4. ✅ **Kept kind as "shape"** - Not setting `kind: "image"` preserves vector path shapes

---

## What Was Preserved from Earlier Fixes

The fix for the "flat bottom" issue (Bézier control points in bounding box) remains intact:

### File: `src/lib/idml-parser/utils.ts`
```typescript
// Include Bézier control points in bounding box calculation
let leftDir = point.getAttribute("LeftDirection");
if (leftDir) {
  let [lx, ly] = leftDir.split(" ").map(parseFloat);
  xValues.push(lx);
  yValues.push(ly);
}

let rightDir = point.getAttribute("RightDirection");
if (rightDir) {
  let [rx, ry] = rightDir.split(" ").map(parseFloat);
  xValues.push(rx);
  yValues.push(ry);
}
```

This ensures shaped frames with curved/wavy edges are properly sized and not clipped.

---

## Verification

### Tests Run
```bash
yarn test
```
**Result**: ✅ All tests pass (1 pass, 0 fail, 33 expect() calls in 119.29s)

### Visual Comparison

Side-by-side comparisons opened in VS Code for verification:

1. **CELUM example**
   - ✅ Logo now shows full "celum" text without being cut off
   - ✅ Logo icon properly visible
   - ✅ Matches previous output positioning

2. **TwilioVoiceKV example**
   - ✅ Images scaled correctly
   - ✅ No excessive zoom

3. **orchard example**
   - ✅ Wavy bottom edge preserved (from Bézier fix)
   - ✅ Image scaled correctly without excessive zoom

### Files Modified

**1. `/Users/hiyeon/code/ubq/idml-importer/src/lib/idml-parser/index.ts`**
   - Lines 991-1016: Fixed `handleGraphicWithImageFill` function
   - Change: Only set ContentFillMode when needed, not always "Cover"

**2. `/Users/hiyeon/code/ubq/idml-importer/src/lib/idml-parser/utils.ts`**
   - Lines 115-139: Bézier control point fix (already applied, no changes)
   - Preserved: Bounding box calculation includes control points

---

## Summary of All Fixes

| Issue | Location | Fix | Status |
|-------|----------|-----|--------|
| **Flat bottom on curved shapes** | `utils.ts:115-139` | Include Bézier control points in bounding box | ✅ Fixed |
| **Excessive image zoom** | `index.ts:997-1016` | Remove forced "Cover" mode, use engine defaults | ✅ Fixed |

---

## Why applyFrameFittingOption Was Not Used

The `applyFrameFittingOption` function (added in the initial fix attempt) was NOT used in the final solution because:

1. **Frame dimension mismatch**: After including Bézier control points, frame dimensions changed, but InDesign crop values are based on original dimensions
2. **Calculation complexity**: The crop scale calculation would need significant rework to account for the new frame sizes
3. **Better default behavior**: The engine's default fill behavior produces correct results without manual crop adjustments
4. **Simpler solution**: Not setting an explicit fill mode is simpler and works correctly

The function remains in the codebase (lines 1041-1131) but is commented out and could be fixed later if needed.

---

## Testing Recommendations

1. ✅ **All automated tests pass**
2. ✅ **Visual regression testing** - Compare output with previous output
3. ✅ **Specific test cases verified**:
   - CELUM (logo zoom issue)
   - TwilioVoiceKV (general image scaling)
   - orchard (curved shape preservation + image scaling)

---

## Files for Review

### Source Code
- `/Users/hiyeon/code/ubq/idml-importer/src/lib/idml-parser/index.ts` (lines 991-1016)
- `/Users/hiyeon/code/ubq/idml-importer/src/lib/idml-parser/utils.ts` (lines 115-139, unchanged)

### Test Outputs
- New outputs: `/Users/hiyeon/code/ubq/idml-importer/src/test/output/examples/`
- Previous outputs: `/Users/hiyeon/code/ubq/idml-importer/src/test/output-previous/examples/`

### Documentation
- Initial analysis: `/Users/hiyeon/code/ubq/idml-importer/test-comparison-report.md`
- First fix attempt: `/Users/hiyeon/code/ubq/idml-importer/zoom-fix-summary.md`
- **This document**: `/Users/hiyeon/code/ubq/idml-importer/final-fix-summary.md`

---

## Conclusion

✅ **The image zoom regression has been successfully fixed.**

The solution was to **remove the forced "Cover" ContentFillMode** and let the engine use its default behavior, while preserving:
- The Bézier control point fix for curved shapes
- The clipping behavior for shaped frames
- The special case handling for shrunk images (negative crops)

All tests pass and visual comparison confirms the fix is working correctly.

---

**Generated**: October 21, 2025
**Status**: ✅ Ready for commit
