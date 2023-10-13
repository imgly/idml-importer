// @ts-ignore
import { version } from "../../../package.json";

type FontVariants = Item["files"];

export interface GoogleFonts {
  kind: string;
  items: Item[];
}

export interface Item {
  family: string;
  variants: string[];
  subsets: string[];
  version: string;
  lastModified: string;
  files: Files;
  category: string;
  kind: string;
}

export interface Files {
  "100"?: string;
  "100italic"?: string;
  "300"?: string;
  "300italic"?: string;
  regular?: string;
  italic?: string;
  "500"?: string;
  "500italic"?: string;
  "700"?: string;
  "700italic"?: string;
  "900"?: string;
  "900italic"?: string;
  "600"?: string;
  "800"?: string;
  "600italic"?: string;
  "800italic"?: string;
  "200"?: string;
  "200italic"?: string;
}

export type Font = { name: string; style: string };

function buildUnpkgAssetPath(assetPath: string) {
  return `https://unpkg.com/@imgly/idml-importer@${version}/dist/assets/${assetPath}`;
}
async function fetchGoogleFonts(): Promise<GoogleFonts> {
  return fetch(buildUnpkgAssetPath("google-fonts.json")).then((res) =>
    res.json()
  );
}

let googleFonts: GoogleFonts | null = null;
async function getGoogleFonts() {
  if (!googleFonts) {
    googleFonts = await fetchGoogleFonts();
  }
  return googleFonts;
}

/**
 * The default font resolver for the IDML parser.
 * This will try to find a matching google font variant for the given font.
 *
 * @param font The font to resolve
 * @returns The font URI or null if no matching font was found
 */
export default async function fontResolver({ name, style }: Font) {
  const fontVariant = fontVariantMap.get(style);
  if (!fontVariant) return null;
  const fonts = await getGoogleFonts();
  const font = fonts.items.find((font) => font.family === name);
  const fontURI = font?.files[fontVariant as keyof FontVariants];
  return fontURI ?? null;
}

// Map of font styles to google font variants
const fontVariantMap = new Map([
  ["Thin", "100"],
  ["Thin Italic", "100italic"],
  ["Extra-light", "200"],
  ["Extra-light Italic", "200italic"],
  ["Light", "300"],
  ["Light Italic", "300italic"],
  ["Regular", "regular"],
  ["Regular Italic", "italic"],
  ["Medium", "500"],
  ["Medium Italic", "500italic"],
  ["Semi-bold", "600"],
  ["Semi-bold Italic", "600italic"],
  ["Bold", "700"],
  ["Bold Italic", "700italic"],
  ["Extra-bold", "800"],
  ["Extra-bold Italic", "800italic"],
  ["Black", "900"],
  ["Black Italic", "900italic"],
]);
