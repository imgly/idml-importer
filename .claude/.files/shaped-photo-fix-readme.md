# Shaped Photo Import Fix - README

## Problem Description

When importing IDML files with shaped images (polygons containing photos), the bottom edge of the image appeared flat/cut instead of preserving the curved/wavy shape defined by the vector path.

### Example Issue
The "orchard.idml" file contains a JCB excavator image in a polygon shape with a distinctive wavy bottom edge. After import, this wavy edge appeared flat, as if the bottom portion was clipped.

## Root Cause

The issue was in the `parsePathGeometry` function in `src/lib/idml-parser/utils.ts`. The bounding box calculation only considered the **anchor points** of the Bézier path, but ignored the **control points** (LeftDirection and RightDirection).

Since Bézier curves can extend beyond their anchor points when control points are positioned outside the anchor-to-anchor line, the actual rendered curve was larger than the calculated bounding box. This caused the CE.SDK block frame to be too small, clipping the bottom wavy portion of the shape.

### Technical Details

**Before the fix:**
- Only anchor points were included in bounding box calculation
- Block dimensions: 11.347 × 8.985 inches
- Shape path extended beyond block bounds
- Bottom wavy edge was clipped

**After the fix:**
- Both anchor points AND control points included in bounding box
- Block dimensions: 11.516 × 9.663 inches (0.68 inches taller)
- Shape fully contained within block bounds
- Bottom wavy edge fully visible

## Solution

Modified `parsePathGeometry` in `src/lib/idml-parser/utils.ts` (lines 115-139) to include Bézier control points when calculating the bounding box:

```typescript
// Iterates over each PathPointType to extract x and y coordinates
// IMPORTANT: We need to include control points (LeftDirection, RightDirection) in the bounding box
// because Bézier curves can extend beyond their anchor points
Array.from(points).forEach((point) => {
  // The Anchor attribute contains the x and y coordinates of the point
  let anchorAttr = point.getAttribute("Anchor")!;
  let [x, y] = anchorAttr.split(" ").map(parseFloat);
  xValues.push(x);
  yValues.push(y);

  // Also include the Bézier control points in the bounding box calculation
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
});
```

## Files Changed

- `src/lib/idml-parser/utils.ts` - Fixed bounding box calculation to include Bézier control points

## Testing

To verify the fix:

1. Build the package: `bun run build`
2. Run tests: `bun test`
3. Check output: `idml-importer/src/test/output/examples/orchard/design-0.png`
4. Verify the wavy bottom edge is fully visible and not clipped

## Impact

This fix ensures that:
- All polygon shapes with Bézier curves are properly imported with correct bounding boxes
- Shaped images maintain their design integrity from InDesign
- The visible shape boundaries match the original IDML design
- No clipping occurs at the edges of curved shapes

## Backward Compatibility

This fix is **backward compatible**. It only affects polygon shapes with Bézier curves where control points extend beyond anchor points. Simple shapes without such curves will be unaffected.

The change makes the bounding boxes more accurate, which means some blocks may be slightly larger than before (to accommodate the full curve extent), but this is the correct behavior.
