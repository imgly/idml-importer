/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import { IDMLParser as P } from "../src/lib/idml-parser/index";
import { Logger as L } from "../src/lib/idml-parser/logger";
import { addGoogleFontsAssetLibrary as a } from "../src/lib/idml-parser/font-resolver";

export { P as IDMLParser, L as Logger, a as addGoogleFontsAssetLibrary };
