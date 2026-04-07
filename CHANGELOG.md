# @imgly/idml-importer

## 1.2.3

### Patch Changes

- Fixed rounded corners not being applied to image-containing rectangles in IDML files

## 1.2.2

### Patch Changes

- Fixed embedded image detection for InDesign 2026+ (v21.3) IDML files where ImageTypeName is no longer populated by adding base64 magic bytes fallback for MIME type detection (JPEG, PNG, BMP, WebP)

## 1.2.1

### Patch Changes

- Added line height (leading) support for text frames with explicit values and Auto leading
- Added vertical alignment support for text frames (Top, Center, Bottom)
- Added font metrics extraction module for accurate line height conversion between InDesign and CE.SDK

## 1.2.0

### Minor Changes

- Added support for transient resource relocation using CE.SDK native APIs
- Images now use internal buffer URLs instead of data URIs, enabling `findAllTransientResources()`, `getBufferData()`, and `relocateResource()` APIs
- Added documentation for saving scenes with stable URLs

## 1.1.13

### Patch Changes

- Fix: Curvy edges for image clipping not being applied

## 1.1.12

### Patch Changes

- 3fbd62e: Fixes an issue where shaped images with Bézier curves gets flattened.

## 1.1.11

### Patch Changes

- 6d68514: Add: Support nested frames as groups of shapes

- 82d29d0: Fix: Dependencies

## 1.1.10

### Patch Changes

- ecfa619: Fix: Dependencies

## 1.1.8

### Patch Changes

- d71a4d7: Fixes vector rendering issues
