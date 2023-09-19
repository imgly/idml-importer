# idml-importer

## Browser Example

```js
import { IDMLParser } from "idml-importer";
const parser = await IDMLParser.fromFile(engine, blob, (content) =>
  new DOMParser().parseFromString(content, "text/xml")
);

await parser.parse();

const image = await engine.block.export(
  engine.block.findByType("//ly.img.ubq/page")[0],
  "image/png"
);
const sceneExportUrl = window.URL.createObjectURL(data);
console.log("The imported IDML file looks like:", sceneExportUrl);
```

## NodeJS Example

When using in NodeJS, you need to provide a DOM implementation. We recommend using JSDOM.

```js
import CreativeEngine from "@cesdk/node";
import { promises as fs } from "fs";
import { JSDOM } from "jsdom";
import { IDMLParser } from "idml-importer";

async function main() {
  const engine = await CreativeEngine.init({
    license: process.env.NEXT_PUBLIC_LICENSE,
  });

  const exampleFile = await fs.readFile("./example.idml");
  const parser = await IDMLParser.fromFile(engine, exampleFile, (content) => {
    return new JSDOM(content, {
      contentType: "text/xml",
      storageQuota: 10000000,
      url: "http://localhost",
    }).window.document;
  });
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

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```
