// @ts-ignore
import { version } from "../../../package.json";
import CreativeEngine, { AssetDefinition, Font, Typeface } from "@cesdk/engine";

export interface TypefaceParams {
  family: string;
  style: Font["style"];
  weight: Font["weight"];
}
export type TypefaceResolver = (
  fontParameters: TypefaceParams,
  engine: CreativeEngine
) => Promise<FontResolverResult | null>;

export async function addGoogleFontsAssetLibrary(
  engine: CreativeEngine,
  url?: string
): Promise<boolean | void> {
  if (engine.asset.findAllSources().includes("ly.img.google-fonts")) {
    return;
  }
  engine.asset.addLocalSource("ly.img.google-fonts");
  const contentJSON = await fetchGoogleFonts(url);
  contentJSON.assets.forEach((asset) => {
    engine.asset.addAssetToSource("ly.img.google-fonts", asset);
  });
}
interface FontResolverResult {
  typeface: Typeface;
  font: Font;
}

function buildAssetPath(assetPath: string) {
  return `https://staticimgly.com/imgly/idml-importer/${version}/dist/${assetPath}`;
}

export type ContentJSON = {
  version: string;
  id: string;
  assets: AssetDefinition[];
};

async function fetchGoogleFonts(customUrl?: string): Promise<ContentJSON> {
  const url = customUrl ?? buildAssetPath("google-fonts/content.json");
  return fetch(url)
    .then((res) => res.json())
    .catch((e) => {
      throw new Error(`Failed to fetch google fonts from: ${url} due to ${e}`);
    });
}

let assetsPromise: Promise<ContentJSON>;

const defaultTypefaceLibrary = "ly.img.google-fonts";
/**
 * The default font resolver for the PSD parser.
 * This will try to find a matching google font variant for the given font.
 *
 * @param font The font to resolve
 * @returns The font URI or null if no matching font was found
 */
export default async function fontResolver(
  fontParameters: TypefaceParams,
  engine: CreativeEngine
): Promise<FontResolverResult | null> {
  if (!engine.asset.findAllSources().includes(defaultTypefaceLibrary)) {
    throw new Error(
      `The default typeface library ${defaultTypefaceLibrary} is not available.`
    );
  }
  if (fontParameters.family in TYPEFACE_ALIAS_MAP) {
    fontParameters.family = TYPEFACE_ALIAS_MAP[fontParameters.family];
  }

  let typefaceQuery = await engine.asset.findAssets(defaultTypefaceLibrary, {
    page: 0,
    query: fontParameters.family,
    perPage: 1,
  });
  if (!typefaceQuery || typefaceQuery.assets.length === 0) {
    // check for cases like OpenSansRoman
    const queries = pascalCaseToArray(fontParameters.family);
    for (const query of queries) {
      typefaceQuery = await engine.asset.findAssets(defaultTypefaceLibrary, {
        page: 0,
        query: query,
        perPage: 1,
      });
      if (typefaceQuery && typefaceQuery.assets.length > 0) {
        break;
      }
    }
    if (!typefaceQuery || typefaceQuery.assets.length === 0) {
      return null;
    }
  }
  const typeface = typefaceQuery.assets[0].payload?.typeface;
  if (!typeface) {
    throw new Error(`No typeface found for font ${fontParameters.family}`);
  }
  const font = typeface.fonts.find((font) => {
    if (
      fontParameters.style === undefined ||
      (font.style?.toLowerCase() === fontParameters.style.toLowerCase() &&
        (fontParameters.weight === undefined ||
          isEqualWeight(fontParameters.weight, font.weight)))
    ) {
      return true;
    }

    return false;
  });
  if (!font) {
    return null;
  }
  return {
    typeface,
    font,
  };
}

const WEIGHTS: Font["weight"][] = [
  "thin",
  "extraLight",
  "light",
  "normal",
  "medium",
  "semiBold",
  "bold",
  "extraBold",
  "heavy",
];

export const WEIGHT_ALIAS_MAP: Record<string, Font["weight"]> = {
  "100": "thin",
  "200": "extraLight",
  "300": "light",
  regular: "normal",
  "400": "normal",
  "500": "medium",
  "600": "semiBold",
  "700": "bold",
  "800": "extraBold",
  "900": "heavy",
};

const TYPEFACE_ALIAS_MAP: Record<string, string> = {
  Helvetica: "Roboto",
  "Times New Roman": "Tinos",
  Arial: "Arimo",
  Georgia: "Tinos",
  Garamond: "EB Garamond",
  Futura: "Raleway",
  "Comic Sans MS": "Comic Neue",
};

function isEqualWeight(weightString: string, fontWeight: Font["weight"]) {
  if (weightString && weightString === fontWeight) {
    return true;
  }
  const lowerCaseWeightString = weightString.toLowerCase();
  if (lowerCaseWeightString === fontWeight) {
    return true;
  }
  const weightAlias = WEIGHT_ALIAS_MAP[lowerCaseWeightString];
  if (weightAlias !== undefined) {
    return true;
  }
  return false;
}

function pascalCaseToArray(pascalCaseString: string): string[] {
  // convert PascalCase to a sentence with spaces
  // input: "OpenSansItalic"
  // Output: ["OpenSansItalic", "Open Sans Italic", "Open Sans", "Open"]
  const spacedString = pascalCaseString
    .replace(/([A-Z])/g, " $1") // insert space before each uppercase letter
    .trim(); // remove leading/trailing whitespace

  // split the spaced string into words
  const words = spacedString.split(" ");
  if (words.length < 2) {
    return [];
  }

  // generate the desired array of strings
  const result = [];
  for (let i = words.length; i > 0; i--) {
    const currentWords = words.slice(0, i).join(" ");
    result.push(currentWords);
  }

  return result;
}
