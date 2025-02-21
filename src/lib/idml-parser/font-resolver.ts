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
  engine: CreativeEngine
): Promise<boolean | void> {
  if (engine.asset.findAllSources().includes("ly.img.google-fonts")) {
    return;
  }
  engine.asset.addLocalSource("ly.img.google-fonts");
  const contentJSON = await fetchGoogleFonts();
  contentJSON.assets.forEach((asset) => {
    engine.asset.addAssetToSource("ly.img.google-fonts", asset);
  });
}
interface FontResolverResult {
  typeface: Typeface;
  font: Font;
}

function buildUnpkgAssetPath(assetPath: string) {
  return `https://unpkg.com/@imgly/idml-importer@${version}/dist/assets/${assetPath}`;
}

export type ContentJSON = {
  version: string;
  id: string;
  assets: AssetDefinition[];
};

async function fetchGoogleFonts(): Promise<ContentJSON> {
  return fetch(buildUnpkgAssetPath("google-fonts/content.json")).then((res) =>
    res.json()
  );
}

let assetsPromise: Promise<ContentJSON>;

const typefaceLibrary = "ly.img.google-fonts";
/**
 * The default font resolver for the IDML parser.
 * This will try to find a matching google font variant for the given font.
 *
 * @param font The font to resolve
 * @returns The font URI or null if no matching font was found
 */
export default async function fontResolver(
  fontParameters: TypefaceParams,
  engine: CreativeEngine,
  typefaceLibrary = "ly.img.google-fonts"
): Promise<FontResolverResult | null> {
  if (!engine.asset.findAllSources().includes(typefaceLibrary)) {
    throw new Error(
      `The typeface library ${typefaceLibrary} is not available. Consider adding e.g Google Fonts using addGoogleFontsAssetLibrary.`
    );
  }
  if (fontParameters.family in TYPEFACE_ALIAS_MAP) {
    fontParameters.family = TYPEFACE_ALIAS_MAP[fontParameters.family];
  }

  const typefaceQuery = await engine.asset.findAssets(typefaceLibrary, {
    page: 0,
    query: fontParameters.family,
    perPage: 1,
  });
  if (!typefaceQuery || typefaceQuery.assets.length === 0) {
    return null;
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
  if (font) {
    return {
      typeface,
      font,
    };
  }
  return null;
}

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
  const lowerCaseWeightString = weightString.toLowerCase();
  if (lowerCaseWeightString === fontWeight!.toLowerCase()) {
    return true;
  }
  const weightAlias = WEIGHT_ALIAS_MAP[lowerCaseWeightString];
  if (weightAlias !== undefined) {
    return true;
  }
  return false;
}
