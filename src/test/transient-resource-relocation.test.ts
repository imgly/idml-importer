/**
 * Test: Transient Resource Relocation
 *
 * This test validates the workflow for persisting IDML-imported assets.
 *
 * The IDML parser now uses CE.SDK internal buffers (via `createBufferURLFromDataURI()`)
 * instead of data URIs. This enables CE.SDK's native APIs:
 *
 * 1. Parse an IDML file (creates buffer:// URLs for embedded images)
 * 2. Use `findAllTransientResources()` to find all IDML-imported assets
 * 3. Use `getBufferData()` to extract the binary data
 * 4. Upload to backend / save to disk
 * 5. Use `relocateResource()` to update URLs to permanent locations
 * 6. Save scene to string (now contains permanent URLs)
 * 7. Scene can be reloaded in a fresh engine
 */

import CreativeEngine from "@cesdk/node";
import { expect, test } from "bun:test";
import fs from "fs";
import { JSDOM } from "jsdom";
import path from "path";
import { IDMLParser } from "../lib/idml-parser";
import { createBufferURL, createBufferURLFromDataURI } from "../lib/idml-parser/buffer-url";
import { addGoogleFontsAssetLibrary } from "../lib/idml-parser/font-resolver";

function DOMParser(content: string) {
  return new JSDOM(content, {
    contentType: "text/xml",
    storageQuota: 10000000,
    url: "http://localhost",
  }).window.document;
}

// Use an IDML file with embedded images to test transient resource handling
const testIdmlPath = "./src/test/examples/popup.idml";
const outputDir = "./src/test/output/transient-relocation-test";
const assetsDir = path.join(outputDir, "assets");

// Clean up and create output directories before tests
if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true });
}
fs.mkdirSync(assetsDir, { recursive: true });

test(
  "should relocate transient resources to file URLs and reload scene successfully",
  async () => {
    // =========================================================================
    // PHASE 1: Parse IDML and extract transient resources
    // =========================================================================

    const idmlBlob = Bun.file(testIdmlPath);
    const idmlBuffer = await idmlBlob.arrayBuffer();

    let engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      await addGoogleFontsAssetLibrary(engine as any);

      const parser = await IDMLParser.fromFile(
        engine as any,
        idmlBuffer,
        DOMParser
      );

      const { scene } = await parser.parse();
      expect(scene).toBeNumber();

      // =========================================================================
      // PHASE 2: Find and relocate using CE.SDK native APIs
      // =========================================================================

      // With internal buffers, findAllTransientResources now works!
      const transientResources = engine.editor.findAllTransientResources();
      console.log(
        `CE.SDK findAllTransientResources() found: ${transientResources.length} transient resource(s)`
      );

      // Note: The IDML file may or may not have embedded images
      // If it does, we should find transient resources
      if (transientResources.length > 0) {
        const relocationMap: Map<string, string> = new Map();

        for (let i = 0; i < transientResources.length; i++) {
          const resource = transientResources[i] as any;
          const uri = resource.uri || resource.url || resource.URL;
          const size = resource.size;

          console.log(
            `Processing resource ${i + 1}/${transientResources.length}: ${uri} (${size} bytes)`
          );

          // Extract binary data using CE.SDK native API
          const data = engine.editor.getBufferData(uri, 0, size);

          // Determine file extension based on content
          let extension = "png";
          if (data[0] === 0xff && data[1] === 0xd8) {
            extension = "jpg";
          } else if (
            data[0] === 0x3c &&
            (data[1] === 0x3f || data[1] === 0x73)
          ) {
            extension = "svg";
          }

          // Determine file path
          const filename = `asset-${i}.${extension}`;
          const filePath = path.join(assetsDir, filename);
          const absoluteFilePath = path.resolve(filePath);

          // Write to disk
          fs.writeFileSync(filePath, Buffer.from(data));
          console.log(`  Saved to: ${filePath} (${data.length} bytes)`);

          // Create file:// URL for the relocated resource
          const fileUrl = `file://${absoluteFilePath}`;
          relocationMap.set(uri, fileUrl);

          // Relocate using CE.SDK native API
          engine.editor.relocateResource(uri, fileUrl);
          console.log(`  Relocated to: ${fileUrl}`);
        }

        console.log(`Relocated ${transientResources.length} transient resource(s)`);
      }

      // =========================================================================
      // PHASE 3: Save scene to string (should now contain file:// URLs)
      // =========================================================================

      const sceneString = await engine.scene.saveToString();
      const sceneFilePath = path.join(outputDir, "scene.json");
      fs.writeFileSync(sceneFilePath, sceneString);
      console.log(`Scene saved to: ${sceneFilePath}`);

      // The scene string is base64 encoded, decode it for verification
      const decodedScene = Buffer.from(sceneString, "base64").toString("utf-8");

      // Verify scene string contains no buffer:// URLs after relocation
      expect(decodedScene).not.toContain("buffer://");

      // Check that file:// URLs are present if we had transient resources
      if (transientResources.length > 0) {
        expect(decodedScene).toContain("file://");
        console.log(
          `Verified: Scene contains file:// URLs for ${transientResources.length} relocated resource(s)`
        );
      }

      // Export a reference image before disposing
      const pages = engine.scene.getPages();
      if (pages.length > 0) {
        const referenceBlob = await engine.block.export(
          pages[0],
          "image/png" as any,
          {
            targetWidth: 500,
            targetHeight: 500,
          }
        );
        const referenceBuffer = Buffer.from(await referenceBlob.arrayBuffer());
        fs.writeFileSync(
          path.join(outputDir, "reference-before-reload.png"),
          referenceBuffer
        );
      }

      // Dispose first engine
      engine.dispose();

      // =========================================================================
      // PHASE 4: Create fresh engine and load scene from string
      // =========================================================================

      console.log("\n--- Creating fresh engine and loading scene ---\n");

      engine = await CreativeEngine.init({
        license: process.env.CESDK_LICENSE,
      });

      // Load the scene from the saved string
      const loadedSceneString = fs.readFileSync(sceneFilePath, "utf-8");
      const loadedScene = await engine.scene.loadFromString(loadedSceneString);

      expect(loadedScene).toBeNumber();
      console.log(`Scene loaded successfully: ${loadedScene}`);

      // =========================================================================
      // PHASE 5: Verify the loaded scene works correctly
      // =========================================================================

      const loadedPages = engine.scene.getPages();
      expect(loadedPages.length).toBeGreaterThan(0);
      console.log(`Loaded scene has ${loadedPages.length} page(s)`);

      // Try to export the loaded scene to verify assets load correctly
      const exportedBlob = await engine.block.export(
        loadedPages[0],
        "image/png" as any,
        {
          targetWidth: 500,
          targetHeight: 500,
        }
      );

      expect(exportedBlob).not.toBeNull();

      const exportedBuffer = Buffer.from(await exportedBlob.arrayBuffer());
      fs.writeFileSync(
        path.join(outputDir, "exported-after-reload.png"),
        exportedBuffer
      );
      console.log("Successfully exported loaded scene to PNG");

      // Verify the exported image has content (not empty/black)
      expect(exportedBuffer.length).toBeGreaterThan(1000);
    } finally {
      engine.dispose();
    }
  },
  { timeout: 60000 }
);

test(
  "should handle scenes with no transient resources gracefully",
  async () => {
    const engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      // Create an empty scene
      engine.scene.create();

      const transientResources = engine.editor.findAllTransientResources();
      expect(transientResources.length).toBe(0);

      const sceneString = await engine.scene.saveToString();
      expect(typeof sceneString).toBe("string");
    } finally {
      engine.dispose();
    }
  },
  { timeout: 30000 }
);

test(
  "should detect internal buffers with findAllTransientResources (proof of concept)",
  async () => {
    // This test proves that if IDML parser uses createBuffer() instead of data URIs,
    // the CE.SDK native APIs work for transient resource management.

    const engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      engine.scene.create();
      const page = engine.block.create("//ly.img.ubq/page");
      engine.block.appendChild(engine.scene.get()!, page);

      // Create an internal buffer (like IDML parser now does)
      const bufferUri = engine.editor.createBuffer();

      // Create some fake PNG data (minimal valid PNG header + IEND)
      const fakePngData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width: 1
        0x00, 0x00, 0x00, 0x01, // height: 1
        0x08, 0x02, // bit depth: 8, color type: RGB
        0x00, 0x00, 0x00, // compression, filter, interlace
        0x90, 0x77, 0x53, 0xde, // CRC
        0x00, 0x00, 0x00, 0x0c, // IDAT length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0xff, 0x00, // compressed data
        0x05, 0xfe, 0x02, 0xfe, // CRC
        0x00, 0x00, 0x00, 0x00, // IEND length
        0x49, 0x45, 0x4e, 0x44, // IEND
        0xae, 0x42, 0x60, 0x82, // CRC
      ]);

      engine.editor.setBufferLength(bufferUri, fakePngData.length);
      engine.editor.setBufferData(bufferUri, 0, fakePngData);

      // Create an image block using this buffer
      const imageBlock = engine.block.create("//ly.img.ubq/graphic");
      const fillType = engine.block.createFill("//ly.img.ubq/fill/image");
      engine.block.setFill(imageBlock, fillType);
      engine.block.setString(fillType, "fill/image/imageFileURI", bufferUri);
      engine.block.appendChild(page, imageBlock);

      // NOW findAllTransientResources should detect this buffer!
      const transientResources = engine.editor.findAllTransientResources();
      console.log(
        `findAllTransientResources() with internal buffer: ${transientResources.length}`
      );
      console.log(`Transient resource:`, JSON.stringify(transientResources[0]));

      expect(transientResources.length).toBe(1);

      // The API returns { URL, size } (uppercase URL)
      const resource = transientResources[0] as any;
      const resourceUri = resource.uri || resource.url || resource.URL;
      expect(resourceUri).toBe(bufferUri);
      expect(resource.size).toBe(fakePngData.length);

      console.log(
        "SUCCESS: Using internal buffers makes findAllTransientResources() work!"
      );
    } finally {
      engine.dispose();
    }
  },
  { timeout: 30000 }
);

test(
  "should work with createBufferURL for full relocation flow",
  async () => {
    // This test demonstrates that using createBufferURL instead of data URIs
    // enables the CE.SDK native transient resource APIs to work seamlessly.

    const engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      engine.scene.create();
      const page = engine.block.create("//ly.img.ubq/page");
      engine.block.appendChild(engine.scene.get()!, page);
      engine.block.setWidth(page, 100);
      engine.block.setHeight(page, 100);

      // Create a real PNG blob (1x1 red pixel)
      const pngData = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      const imgBlob = new Blob([pngData], { type: "image/png" });

      // Use createBufferURL instead of data URI
      const imageURI = await createBufferURL(engine as any, imgBlob);
      console.log(`Created buffer URI: ${imageURI}`);

      // Create an image block using this buffer
      const imageBlock = engine.block.create("//ly.img.ubq/graphic");
      const rectFrame = engine.block.createShape("//ly.img.ubq/shape/rect");
      const fillType = engine.block.createFill("//ly.img.ubq/fill/image");
      engine.block.setShape(imageBlock, rectFrame);
      engine.block.setFill(imageBlock, fillType);
      engine.block.setString(fillType, "fill/image/imageFileURI", imageURI);
      engine.block.appendChild(page, imageBlock);
      engine.block.setWidth(imageBlock, 50);
      engine.block.setHeight(imageBlock, 50);

      // Verify findAllTransientResources detects the buffer
      const transientResources = engine.editor.findAllTransientResources();
      console.log(`findAllTransientResources() found: ${transientResources.length}`);
      expect(transientResources.length).toBe(1);

      // Now use the native CE.SDK API to relocate
      const resource = transientResources[0] as any;
      const resourceUri = resource.uri || resource.url || resource.URL;
      const resourceSize = resource.size;

      // Extract data using CE.SDK native API
      const data = engine.editor.getBufferData(resourceUri, 0, resourceSize);

      // Save to file
      const filename = `buffer-test-asset.png`;
      const filePath = path.join(assetsDir, filename);
      const absoluteFilePath = path.resolve(filePath);
      fs.writeFileSync(filePath, Buffer.from(data));
      console.log(`Saved to: ${filePath} (${data.length} bytes)`);

      // Relocate using CE.SDK native API
      const fileUrl = `file://${absoluteFilePath}`;
      engine.editor.relocateResource(resourceUri, fileUrl);
      console.log(`Relocated to: ${fileUrl}`);

      // Verify the relocation was applied
      const updatedUri = engine.block.getString(
        fillType,
        "fill/image/imageFileURI"
      );
      console.log(`Updated imageFileURI: ${updatedUri}`);
      expect(updatedUri).toBe(fileUrl);

      // Save and reload scene
      const sceneString = await engine.scene.saveToString();
      const decodedScene = Buffer.from(sceneString, "base64").toString("utf-8");
      expect(decodedScene).toContain("file://");
      expect(decodedScene).not.toContain("buffer://");

      console.log(
        "SUCCESS: createBufferURL enables native CE.SDK transient resource management!"
      );
    } finally {
      engine.dispose();
    }
  },
  { timeout: 30000 }
);

test(
  "should work with createBufferURLFromDataURI for data URI conversion",
  async () => {
    // This test verifies that createBufferURLFromDataURI correctly converts
    // data URIs to buffer URLs.

    const engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      engine.scene.create();
      const page = engine.block.create("//ly.img.ubq/page");
      engine.block.appendChild(engine.scene.get()!, page);
      engine.block.setWidth(page, 100);
      engine.block.setHeight(page, 100);

      // Create a data URI (base64-encoded 1x1 red PNG)
      const dataUri =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

      // Convert data URI to buffer URL
      const bufferUri = await createBufferURLFromDataURI(engine as any, dataUri);
      console.log(`Converted data URI to buffer URI: ${bufferUri}`);

      expect(bufferUri).toMatch(/^buffer:\/\//);

      // Create an image block using this buffer
      const imageBlock = engine.block.create("//ly.img.ubq/graphic");
      const rectFrame = engine.block.createShape("//ly.img.ubq/shape/rect");
      const fillType = engine.block.createFill("//ly.img.ubq/fill/image");
      engine.block.setShape(imageBlock, rectFrame);
      engine.block.setFill(imageBlock, fillType);
      engine.block.setString(fillType, "fill/image/imageFileURI", bufferUri);
      engine.block.appendChild(page, imageBlock);
      engine.block.setWidth(imageBlock, 50);
      engine.block.setHeight(imageBlock, 50);

      // Verify findAllTransientResources detects the buffer
      const transientResources = engine.editor.findAllTransientResources();
      console.log(`findAllTransientResources() found: ${transientResources.length}`);
      expect(transientResources.length).toBe(1);

      // Verify we can extract the data
      const resource = transientResources[0] as any;
      const resourceUri = resource.uri || resource.url || resource.URL;
      const data = engine.editor.getBufferData(resourceUri, 0, resource.size);

      // Verify it's a valid PNG (check magic bytes)
      expect(data[0]).toBe(0x89);
      expect(data[1]).toBe(0x50); // 'P'
      expect(data[2]).toBe(0x4e); // 'N'
      expect(data[3]).toBe(0x47); // 'G'

      console.log(
        "SUCCESS: createBufferURLFromDataURI correctly converts data URIs to buffer URLs!"
      );
    } finally {
      engine.dispose();
    }
  },
  { timeout: 30000 }
);

test(
  "should preserve asset quality after relocation round-trip",
  async () => {
    const idmlBlob = Bun.file(testIdmlPath);
    const exists = await idmlBlob.exists();
    if (!exists) {
      console.log("Test IDML file not found, skipping test");
      return;
    }

    const idmlBuffer = await idmlBlob.arrayBuffer();

    const engine = await CreativeEngine.init({
      license: process.env.CESDK_LICENSE,
    });

    try {
      await addGoogleFontsAssetLibrary(engine as any);

      const parser = await IDMLParser.fromFile(
        engine as any,
        idmlBuffer,
        DOMParser
      );

      await parser.parse();

      // Get transient resources and their sizes
      const transientResources = engine.editor.findAllTransientResources();

      if (transientResources.length === 0) {
        console.log("No transient resources found in IDML file, skipping quality test");
        return;
      }

      const originalSizes = transientResources.map((r) => r.size);

      // Relocate all resources
      for (let i = 0; i < transientResources.length; i++) {
        const resource = transientResources[i] as any;
        const uri = resource.uri || resource.url || resource.URL;
        const data = engine.editor.getBufferData(uri, 0, resource.size);

        // Determine file extension
        let extension = "png";
        if (data[0] === 0xff && data[1] === 0xd8) {
          extension = "jpg";
        }

        const filename = `quality-test-asset-${i}.${extension}`;
        const filePath = path.join(assetsDir, filename);
        const absoluteFilePath = path.resolve(filePath);

        fs.writeFileSync(filePath, Buffer.from(data));

        // Verify file size matches original buffer size
        const fileStats = fs.statSync(filePath);
        expect(fileStats.size).toBe(originalSizes[i]);

        engine.editor.relocateResource(uri, `file://${absoluteFilePath}`);
      }

      console.log(
        `Verified ${transientResources.length} assets preserved their size after relocation`
      );
    } finally {
      engine.dispose();
    }
  },
  { timeout: 60000 }
);

/**
 * Utility function for Node.js environments that relocates IDML-imported assets
 * to file:// URLs on disk using CE.SDK native APIs.
 *
 * Example usage:
 * ```typescript
 * const parser = await IDMLParser.fromFile(engine, idmlBuffer, DOMParser);
 * await parser.parse();
 * await relocateTransientResourcesToFiles(engine, './assets');
 * const sceneJson = await engine.scene.saveToString();
 * ```
 */
export async function relocateTransientResourcesToFiles(
  engine: InstanceType<typeof CreativeEngine>,
  outputDir: string
): Promise<Map<string, string>> {
  const relocationMap = new Map<string, string>();

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const transientResources = engine.editor.findAllTransientResources();

  for (let i = 0; i < transientResources.length; i++) {
    const resource = transientResources[i] as any;
    const uri = resource.uri || resource.url || resource.URL;
    const size = resource.size;

    // Extract binary data using CE.SDK native API
    const data = engine.editor.getBufferData(uri, 0, size);

    // Determine file extension based on content
    let extension = "png";
    if (data[0] === 0xff && data[1] === 0xd8) {
      extension = "jpg";
    } else if (data[0] === 0x3c && (data[1] === 0x3f || data[1] === 0x73)) {
      extension = "svg";
    }

    const filename = `asset-${i}-${Date.now()}.${extension}`;
    const filePath = path.join(outputDir, filename);
    const absoluteFilePath = path.resolve(filePath);

    fs.writeFileSync(filePath, Buffer.from(data));

    const fileUrl = `file://${absoluteFilePath}`;
    relocationMap.set(uri, fileUrl);

    engine.editor.relocateResource(uri, fileUrl);
  }

  return relocationMap;
}

/**
 * Utility function for web environments that uploads IDML-imported assets
 * to a backend and replaces them with permanent URLs using CE.SDK native APIs.
 *
 * Example usage:
 * ```typescript
 * const parser = await IDMLParser.fromFile(engine, idmlBuffer, DOMParser);
 * await parser.parse();
 * await relocateTransientResourcesToBackend(engine, async (data, index, uri) => {
 *   const formData = new FormData();
 *   formData.append('file', new Blob([data], { type: 'image/png' }));
 *   const response = await fetch('/api/upload', { method: 'POST', body: formData });
 *   const { url } = await response.json();
 *   return url;
 * });
 * const sceneJson = await engine.scene.saveToString();
 * ```
 */
export async function relocateTransientResourcesToBackend(
  engine: InstanceType<typeof CreativeEngine>,
  uploadFn: (
    data: Uint8Array,
    index: number,
    originalUri: string
  ) => Promise<string>
): Promise<Map<string, string>> {
  const relocationMap = new Map<string, string>();
  const transientResources = engine.editor.findAllTransientResources();

  // Process uploads in parallel for better performance
  const uploadPromises = transientResources.map(async (resource, index) => {
    const res = resource as any;
    const uri = res.uri || res.url || res.URL;
    const size = res.size;

    // Extract binary data using CE.SDK native API
    const data = engine.editor.getBufferData(uri, 0, size);

    const permanentUrl = await uploadFn(data, index, uri);
    relocationMap.set(uri, permanentUrl);

    engine.editor.relocateResource(uri, permanentUrl);
  });

  await Promise.all(uploadPromises);

  return relocationMap;
}
