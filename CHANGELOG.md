# @imgly/idml-importer

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
