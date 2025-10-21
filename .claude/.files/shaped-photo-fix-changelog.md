# Changelog Entry - Shaped Photo Import Fix

## Version: [Next Release]

### Fixed

**Shaped images in polygon frames were clipped at the edges**

When importing IDML files containing images within polygon shapes (especially shapes with curved/wavy edges), the imported result would show the image clipped at the boundaries, appearing flat instead of preserving the original curved shape.

**Root Cause:** The bounding box calculation for polygon shapes only considered anchor points and ignored Bézier control points (LeftDirection, RightDirection). Since Bézier curves can extend beyond anchor points, the calculated frame was too small, causing edge clipping.

**Fix:** Updated `parsePathGeometry` function to include Bézier control points in bounding box calculations, ensuring polygon shapes are fully contained within their block frames.

**Impact:**
- Shaped images now correctly preserve curved/wavy edges from InDesign
- Block dimensions may be slightly larger for shapes with Bézier curves (correct behavior)
- Backward compatible - only affects shapes where control points extend beyond anchors

**Files Changed:**
- `src/lib/idml-parser/utils.ts` - Lines 115-139

**Example:** The orchard.idml test file with a JCB excavator in a wavy-bottom polygon now correctly shows the full curved bottom edge instead of appearing flat/clipped.

---

## Technical Notes

### Before
```
Block dimensions: 11.347 × 8.985 inches
Bounding box: Only anchor points considered
Result: Bottom portion clipped
```

### After
```
Block dimensions: 11.516 × 9.663 inches (+0.17" width, +0.68" height)
Bounding box: Anchor points + Bézier control points
Result: Full shape visible
```

### Code Change Summary
```diff
  Array.from(points).forEach((point) => {
    let anchorAttr = point.getAttribute("Anchor")!;
-   let [x, y] = anchorAttr.split(" ");
-   xValues.push(parseFloat(x));
-   yValues.push(parseFloat(y));
+   let [x, y] = anchorAttr.split(" ").map(parseFloat);
+   xValues.push(x);
+   yValues.push(y);
+
+   // Include Bézier control points in bounding box
+   let leftDir = point.getAttribute("LeftDirection");
+   if (leftDir) {
+     let [lx, ly] = leftDir.split(" ").map(parseFloat);
+     xValues.push(lx);
+     yValues.push(ly);
+   }
+
+   let rightDir = point.getAttribute("RightDirection");
+   if (rightDir) {
+     let [rx, ry] = rightDir.split(" ").map(parseFloat);
+     xValues.push(rx);
+     yValues.push(ry);
+   }
  });
```

### Testing
- Verified with orchard.idml test file
- All existing tests pass
- Visual output matches expected InDesign design
- No regression in rectangle or oval shape handling
