import CreativeEngine from "@cesdk/node";
import { expect, test } from "bun:test";
import fs from "fs";
import glob from "glob";
import { JSDOM } from "jsdom";
import { IDMLParser } from "../lib/idml-parser";
const filePaths = glob.sync("./test/examples/**/*.idml");

function DOMParser(content: string) {
  return new JSDOM(content, {
    contentType: "text/xml",
    storageQuota: 10000000,
    url: "http://localhost",
  }).window.document;
}

test(
  "Creates a scene from an IDML file",
  async () => {
    const testExportFolder = async (filePath: string) => {
      const expectedIDMLFileName = filePath.split("/").pop();
      const idmlFolderPath = filePath.split("/").slice(0, -1).join("/");
      const idmlFilePath = filePath;
      const filenameWithoutExtension = expectedIDMLFileName!.split(".")[0];

      const blob = Bun.file(idmlFilePath);
      const exists = await blob.exists();
      expect(exists).toEqual(true);

      const arrayBuffer = await blob.arrayBuffer();
      const engine = await CreativeEngine.init({
        license: process.env.CESDK_LICENSE,
      });
      const parser = await IDMLParser.fromFile(
        engine as any,
        arrayBuffer,
        DOMParser
      );

      const result = await parser.parse();
      const imageBlobs = await Promise.all(
        engine.scene.getPages().map((page) =>
          engine.block.export(page, "image/png" as any, {
            targetHeight: 1000,
            targetWidth: 1000,
          })
        )
      );
      const outputFolderPath = `./test/output/examples/${filenameWithoutExtension}`;
      // create directory paths to file if not exists using fs

      if (!fs.existsSync(outputFolderPath)) {
        fs.mkdirSync(outputFolderPath, { recursive: true });
      }
      // write the image to disk
      await Promise.all(
        imageBlobs.map(async (imageBlob, index) =>
          Bun.write(outputFolderPath + `/design-${index}.png`, imageBlob)
        )
      );

      const pdfGlobPattern = `${idmlFolderPath}/*.png`;
      glob.sync(pdfGlobPattern).map(async (pdfPngFilePath: string) => {
        const fileName = pdfPngFilePath.split("/").pop();
        const pdfPngBlob = Bun.file(pdfPngFilePath);
        const pdfPngExists = await pdfPngBlob.exists();
        if (pdfPngExists) {
          const pdfPngArrayBuffer = await pdfPngBlob.arrayBuffer();
          await Bun.write(
            outputFolderPath + `/${fileName}`,

            pdfPngArrayBuffer
          );
        } else {
          debugger;
        }
      });

      const sceneString = await engine.scene.saveToString();
      await Bun.write(`${outputFolderPath}/design.scene`, sceneString);
      engine.dispose();
    };

    for (const filePath of filePaths) {
      await testExportFolder(filePath);
    }
  },
  {
    timeout: 1000000,
  }
);