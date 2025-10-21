# Image Zoom Regression Fix - Summary

**Date**: October 21, 2025
**Issue**: Images within shapes appearing more zoomed in than expected

## Problem

After the initial fix for shaped photo imports (which corrected the "flat bottom" issue), a regression was introduced where images within shapes appeared excessively zoomed in compared to the original InDesign layout.

### Visual Symptoms
- Images in shaped frames appeared more "zoomed in" or enlarged
- Less of the image was visible within the frame
- Positioning did not match the original InDesign design

## Root Cause

The `applyFrameFittingOption` function was temporarily disabled during testing to isolate the cause of the "flat bottom" issue:

```typescript
// BEFORE (disabled):
// this.applyFrameFittingOption(block, element);

// Images used only "Cover" fill mode without proper crop/scale adjustments
```

When this function is disabled:
1. Images use the default "Cover" fill mode
2. No crop scale or translation is applied
3. Images don't respect InDesign's `FrameFittingOption` settings
4. Result: Images appear incorrectly zoomed/positioned

## Solution

Re-enabled the `applyFrameFittingOption` function call, which properly applies:
- **Crop scale** (X and Y) based on InDesign's crop values
- **Crop translation** (X and Y) to position the image correctly
- **Frame fitting adjustments** from the IDML `FrameFittingOption` element

```typescript
// AFTER (re-enabled):
this.applyFrameFittingOption(block, element);

// Images now respect InDesign crop and positioning settings
```

## What `applyFrameFittingOption` Does

This function reads InDesign's `FrameFittingOption` element and applies:

1. **Crop Values**: `LeftCrop`, `TopCrop`, `RightCrop`, `BottomCrop` (in points)
2. **Scale Calculation**: Determines how much to scale the image after cropping
3. **Translation Calculation**: Offsets the image to align the visible portion with the frame
4. **Block Application**: Uses CE.SDK's crop APIs:
   - `setCropScaleX` / `setCropScaleY`
   - `setCropTranslationX` / `setCropTranslationY`

## Files Modified

**File**: `src/lib/idml-parser/index.ts`
**Location**: Lines 1001-1003
**Change**: Re-enabled function call

```diff
  this.engine.block.setContentFillMode(block, "Cover");

+ // Apply FrameFittingOption crop values if present
+ // This adjusts the image position and scale to match InDesign's frame fitting settings
+ this.applyFrameFittingOption(block, element);

  return true;
```

## Verification

### Tests Run
```bash
yarn test
```
**Result**: ✅ All tests pass (exit code 0)

### Visual Comparison
Side-by-side comparisons opened in VS Code for:
- ✅ TwilioVoiceKV example
- ✅ orchard example (wavy bottom preserved, correct zoom)
- ✅ popup example
- ✅ CELUM example

### Expected Outcomes
1. **Images are correctly scaled** to match InDesign layout
2. **Positioning matches** the original design
3. **Curved/wavy edges preserved** (from earlier bounding box fix)
4. **No flat bottom issue** (already fixed by Bézier control point inclusion)

## Technical Context

### Two Separate Fixes Required

**Fix 1: Bounding Box (Already Applied)**
- **Issue**: Shapes with Bézier curves appeared flat at edges
- **Solution**: Include Bézier control points in bounding box calculation
- **File**: `src/lib/idml-parser/utils.ts`
- **Status**: ✅ Complete

**Fix 2: Image Zoom (This Fix)**
- **Issue**: Images appeared excessively zoomed in
- **Solution**: Re-enable `applyFrameFittingOption` to apply crop/scale
- **File**: `src/lib/idml-parser/index.ts`
- **Status**: ✅ Complete

Both fixes work together:
1. Bounding box fix ensures the frame is large enough for Bézier curves
2. Crop/scale fix ensures images are positioned and scaled correctly within that frame

## Recommendations

1. ✅ **Proceed with this fix** - Images should now match InDesign layouts
2. 🔍 **Visual verification** - Review opened PNG comparisons in VS Code
3. 📊 **Document in changelog** - Update changelog to reflect both fixes
4. 🧪 **Additional testing** - Test with more complex IDML files if available

## Related Files

### Code Changes
- `/Users/hiyeon/code/ubq/idml-importer/src/lib/idml-parser/index.ts` (line 1003)

### Test Outputs
- New outputs: `/Users/hiyeon/code/ubq/idml-importer/src/test/output/examples/`
- Previous outputs: `/Users/hiyeon/code/ubq/idml-importer/src/test/output-previous/examples/`

### Documentation
- Initial analysis: `/Users/hiyeon/code/ubq/idml-importer/test-comparison-report.md`
- This fix summary: `/Users/hiyeon/code/ubq/idml-importer/zoom-fix-summary.md`

---

**Status**: ✅ Fix applied and tested
**Generated**: October 21, 2025
