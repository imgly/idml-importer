# InDesign Importer for the CE.SDK

> See the [changelog](CHANGELOG.md) for a detailed history of updates and improvements.

## Overview

The InDesign Importer for the CE.SDK allows you to seamlessly integrate InDesign files into the editor while retaining essential design attributes.

Here's an overview of the main features:

- _File Format Translation_: The importer converts **IDML files** from Adobe InDesign into the CE.SDK scene file format. The resulting scene archive includes all required assets for immediate use.
- _Bulk Importing_: The codebase is adaptable for bulk importing, streamlining large-scale projects.
- _Color Translation_: While CMYK support is in progress, CMYK colors from InDesign are translated into RGB.

The following InDesign design elements will be preserved by the import:

- _Element grouping_: grouped elements will be preserved and treated as a single unit.
- _Positioning and Rotation_: Elements' positioning and rotation are accurately transferred.
- _Image Elements_: Embedded images are supported, while image cropping is not yet available. Note that only images with formats that are [supported by CE.SDK](https://img.ly/docs/cesdk/js/file-format-support-3c4b2a/#importing-media) will be rendered and otherwise shown as placeholders.
- _Text Elements_: Font family continuity is maintained, with options to supply font URIs or use Google fonts. Only bold and italic styles are currently supported.
- _Shapes_: Rect, Oval, Polygon, and Line shapes are supported, along with custom shapes that might experience minor distortion. Note that nested frames, i.e. shapes within a shape, are imported as groups of individual shapes which might lead to visual differences in the output.
- _Colors and Strokes_: Gradient and solid colors, stroke weight, color, and alignment are faithfully reproduced.
- _Transparency_: Transparency is preserved for seamless integration.

This InDesign Importer bridges the gap between InDesign files and CE.SDK scenes, enabling efficient transitions while retaining crucial design details. Your input is invaluable as we continue to refine and improve the importer's capabilities.

## Installation

You can install `@imgly/idml-importer` via npm or yarn. Use the following commands to install the package:

```shell
npm install @imgly/idml-importer
yarn add @imgly/idml-importer
```

## How to prepare your InDesign file:

- Make sure to embed all images in your InDesign file. The importer does not support linked images.

## Browser Quick-Start Example

```js
import CreativeEngine from "@cesdk/engine";
import { IDMLParser, addGoogleFontsAssetLibrary } from "@imgly/idml-importer";

const blob = await fetch(
  "https://img.ly/showcases/cesdk/cases/indesign-template-import/socialmedia.idml"
).then((res) => res.blob());
const engine = await CreativeEngine.init({
  license: "YOUR_LICENSE",
});
// We use google fonts to replace well known fonts in the default font resolver.
await addGoogleFontsAssetLibrary(engine);
const parser = await IDMLParser.fromFile(engine, blob, (content) =>
  new DOMParser().parseFromString(content, "text/xml")
);

await parser.parse();

const image = await engine.block.export(
  engine.block.findByType("//ly.img.ubq/page")[0],
  "image/png"
);
const sceneExportUrl = window.URL.createObjectURL(image);
console.log("The imported IDML file looks like:", sceneExportUrl);
// You can now e.g export the scene as archive with engine.scene.saveToArchive()
```

## Saving Scenes with Stable URLs

By default, the IDML importer creates internal `buffer://` URLs for embedded images. These are transient resources that work well when saving to an archive (`engine.scene.saveToArchive()`), which bundles all assets together.

However, if you want to save scenes as JSON strings (`engine.scene.saveToString()`) with stable, permanent URLs (e.g., for storing in a database or referencing CDN-hosted assets), you need to relocate the transient resources first.

### Why Relocate?

- **Scene Archives** (`saveToArchive`): Include all assets in a single ZIP file. Transient `buffer://` URLs work fine.
- **Scene Strings** (`saveToString`): Only contain references to assets. Transient URLs won't work when reloading the scene later. You need permanent URLs (e.g., `https://`).

### How to Relocate Transient Resources

After parsing the IDML file, use CE.SDK's native APIs to find and relocate all transient resources:

```js
// 1. Parse the IDML file
const parser = await IDMLParser.fromFile(engine, blob, (content) =>
  new DOMParser().parseFromString(content, "text/xml")
);
await parser.parse();

// 2. Find all transient resources (embedded images from the IDML)
const transientResources = engine.editor.findAllTransientResources();

// 3. Upload each resource and relocate to permanent URL
for (const resource of transientResources) {
  const { URL: bufferUri, size } = resource;

  // Extract binary data from the buffer
  const data = engine.editor.getBufferData(bufferUri, 0, size);

  // Upload to your backend/CDN (implement your own upload logic)
  const permanentUrl = await uploadToBackend(data);

  // Relocate the resource to the permanent URL
  engine.editor.relocateResource(bufferUri, permanentUrl);
}

// 4. Now save to string - all URLs will be permanent
const sceneString = await engine.scene.saveToString();
```

### Note on Font URLs

When using `addGoogleFontsAssetLibrary()` (the default font resolver), the resulting scene string will contain Google CDN URLs for fonts. If you need fonts hosted on your own infrastructure, configure a custom font resolver instead of using the default Google Fonts integration.

## NodeJS Quick-Start Example

When using in NodeJS, you need to provide a DOM implementation. We recommend using JSDOM.

```js
// index.mjs
// We currently only support ES Modules in NodeJS
import CreativeEngine from "@cesdk/node";
import { promises as fs } from "fs";
import { JSDOM } from "jsdom";
import { IDMLParser } from "@imgly/idml-importer";

async function main() {
  const engine = await CreativeEngine.init({
    license: "YOUR_LICENSE",
  });

  const idmlSampleUrl =
    "https://img.ly/showcases/cesdk/cases/indesign-template-import/socialmedia.idml";
  const idmlSample = await fetch(idmlSampleUrl).then((res) => res.blob());
  const idmlSampleBuffer = await idmlSample.arrayBuffer();
  const parser = await IDMLParser.fromFile(
    engine,
    idmlSampleBuffer,
    (content) => {
      return new JSDOM(content, {
        contentType: "text/xml",
        storageQuota: 10000000,
        url: "http://localhost",
      }).window.document;
    }
  );
  await parser.parse();

  const image = await engine.block.export(
    engine.block.findByType("//ly.img.ubq/page")[0],
    "image/png"
  );
  const imageBuffer = await image.arrayBuffer();
  await fs.writeFile("./example.png", Buffer.from(imageBuffer));

  engine.dispose();
}
main();
```

## Issues

If you encounter any issues or have questions, please don't hesitate to contact us at support@img.ly.

## Limitations and Unsupported Features

The IDML importer has some limitations and unsupported features that you should be aware of:

1. **PDF Content**

   - PDF elements in the IDML file will be replaced with placeholder images. This is due to the fact that the CE.SDK does not support PDF content.

2. **Linked Images**

   - Only embedded images are supported. Linked images will be replaced with placeholder images.

3. **Text Frame Overflow**

   - Text that flows between multiple text frames is not supported and may result in text duplication.

4. **Font Support**

   - If a font name is not available as a typeface asset source, it will be replaced with fallback fonts.

5. **Image Frame Fitting**

   - Images that are shrunk inside their frames may not be rendered as expected. The CE.SDK does not support images that are smaller than their frames.

6. **Page Sizes**
   - Different page sizes within the same document are not supported. All pages will use the dimensions of the first page.

## License

The software is free for use under the AGPL License.
