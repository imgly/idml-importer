/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { IDMLParser as P } from "../src/lib/idml-parser";
import { Logger as L } from "../src/lib/idml-parser/logger";

// import CreativeEngine from "@cesdk/node";
// import { JSDOM } from "jsdom";

// function DOMParser(content: string) {
//   return new JSDOM(content, {
//     contentType: "text/xml",
//     // includeNodeLocations: true,
//     storageQuota: 10000000,
//     url: "http://localhost",
//   }).window.document;
// }

// Example Call:
// Parser.fromFile(engine as any, arrayBuffer, DOMParser);

// const parser = P<typeof CreativeEngine>;

export { P as IDMLParser, L as Logger };
