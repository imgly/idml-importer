import type {
  CMYKColor,
  Font,
  GradientColorStop,
  RGBAColor,
} from "@cesdk/engine";
import JSZip from "jszip";
import { WEIGHT_ALIAS_MAP } from "./font-resolver";
import { Logger } from "./logger";
import type { Gradient, IDML, Vector2 } from "./types";
import { Matrix, multiplyItemTransforms, transformPoint } from "./transforms";
import CreativeEngine from "@cesdk/engine";
/**
 * Extracts the contents of an IDML file into a map of filenames to XML documents
 *
 * @param file The IDML file to extract
 * @returns A map of filenames to XML documents
 */
export async function unzipIdmlFile(
  file: File | Blob | ArrayBuffer,
  DOMParser: any
) {
  // Load the IDML file into JSZip
  const { files } = await new JSZip().loadAsync(file);

  const extractedFiles: IDML = {};

  for (const filename in files) {
    if (!filename.endsWith(".xml")) continue;

    const file = files[filename];
    const content = await file.async("string");
    extractedFiles[filename] = DOMParser(content);
  }

  return extractedFiles;
}

/**
 * Extracts the page name and dimensions from an IDML page element
 *
 * @param page The IDML page element
 * @returns The page name, width, and height
 */
export function getPageAttributes(page: Element) {
  // Get the page name from the Name attribute
  const name = page.getAttribute("Name") ?? "";
  // Get the page geometric bounds from the GeometricBounds attribute
  const [top, left, bottom, right] = page
    .getAttribute("GeometricBounds")!
    .split(" ")
    .map(parseFloat);

  // Calculate the width and height of the page
  const width = right - left;
  const height = bottom - top;

  return {
    name,
    width,
    height,
  };
}

/**
 * Extracts the x and y translations and the rotation from a 2x3 transformation
 * matrix to represent linear transformations and translations in 2D space.
 *
 * @param transform - The 2x3 transformation matrix array.
 * @returns An object with x and y translations and the rotation (in radians).
 */
function parseTransformMatrix(transform: Matrix) {
  // Destructure the 2x3 matrix elements. The format is [a, b, c, d, e, f], where
  // a and d represent scaling, b and c represent rotation, and e and f represent translation.
  const [a, b, c, d, e, f] = transform;

  // The last column of the matrix represents the translation along x (e) and y (f) axes.
  const x = e;
  const y = f;

  // The rotation is calculated by taking the arctangent of the second row.
  // This provides the rotation in radians. The added 2*PI is to ensure a positive angle.
  const rotation = (Math.atan2(b, a) + 2 * Math.PI) % (2 * Math.PI);
  const scaleX = Math.sqrt(a * a + b * b);
  const scaleY = Math.sqrt(c * c + d * d);

  return {
    x,
    y,
    rotation,
    scaleX,
    scaleY,
  };
}

/**
 * Parses the path geometry of an item, extracting the minimum x and y, width, height,
 * center coordinates, and path data. The path data describes the shape.
 *
 * @param pathGeometry - The XML element representing the path geometry of an item.
 * @returns An object with x, y, width, height, centerX, centerY and pathData.
 */
export function parsePathGeometry(pathGeometry: Element) {
  // Extracts all PathPointType elements within pathGeometry. Each PathPointType contains data for
  // a control point in the item's path, including its position (Anchor), and the positions of
  // the Bézier control points (LeftDirection and RightDirection) if the path is curved.
  const points = pathGeometry.getElementsByTagName("PathPointType");

  // These arrays will store all the x and y values from the path points, which will then be
  // used to determine the bounding box of the shape.
  let xValues: number[] = [];
  let yValues: number[] = [];

  // Iterates over each PathPointType to extract x and y coordinates
  Array.from(points).forEach((point) => {
    // The Anchor attribute contains the x and y coordinates of the point, separated by a space.
    let anchorAttr = point.getAttribute("Anchor")!;
    let [x, y] = anchorAttr.split(" ");
    xValues.push(parseFloat(x));
    yValues.push(parseFloat(y));
  });

  // Determines the minimum and maximum x and y values, which are then used to calculate the width
  // and height of the bounding box around the item's path.
  let x = Math.min(...xValues);
  let y = Math.min(...yValues);
  let width = Math.max(...xValues) - x;
  let height = Math.max(...yValues) - y;

  // Calculates the center of the shape by averaging the minimum and maximum x and y values.
  let centerX = x + width / 2;
  let centerY = y + height / 2;

  // Gets all GeometryPathType elements, which contain the actual path data that describes the shape.
  const geometryTypes = pathGeometry.getElementsByTagName("GeometryPathType");

  // This array will hold all the path data, which will be combined into one string at the end.
  let allPathData: string[] = [];

  // Extracts all PathPointArrays within each GeometryPathType. Each PathPointArray represents a
  // sub-path, which is a series of connected points. The sub-paths together make up the full path.
  Array.from(geometryTypes).forEach((geometryType) => {
    Array.from(geometryType.getElementsByTagName("PathPointArray")).forEach(
      (pointArray) => {
        // The string that will hold the path data for this sub-path.
        let pathData = "";

        // Iterates over each PathPointType to construct the path data
        Array.from(pointArray.getElementsByTagName("PathPointType")).forEach(
          (point, i) => {
            // Extracts anchor, left and right coordinates. These are used to define the position of
            // the point and the positions of the Bézier control points for this point in the path.
            let anchor = point.getAttribute("Anchor")!.split(" ").map(Number);
            let left = point
              .getAttribute("LeftDirection")!
              .split(" ")
              .map(Number);
            let right = point
              .getAttribute("RightDirection")!
              .split(" ")
              .map(Number);

            // Adjusts the x and y values based on the minimum x and y values so the path data is
            // relative to the bounding box of the shape.
            const anchorX = anchor[0] - x;
            const anchorY = anchor[1] - y;
            const leftX = left[0] - x;
            const leftY = left[1] - y;
            const rightX = right[0] - x;
            const rightY = right[1] - y;

            if (i === 0) {
              // Moves to the first anchor point with a "Move" command. This starts a new sub-path at
              // the specified coordinates.
              pathData += `M ${anchorX},${anchorY} `;
            }

            // Creates a curve to the next anchor point with a "Cubic Bézier Curve" command.
            // The coordinates for the Bézier control points (left and right)
            // and the next anchor point are included.
            pathData += `C ${leftX},${leftY} ${rightX},${rightY} ${anchorX},${anchorY} `;
          }
        );

        // Closes the path if it's not open by appending a "Close Path" command. This creates a
        // straight line from the current point to the start of the current sub-path.
        if (geometryType.getAttribute("PathOpen") === "false") {
          pathData += "Z";
        }

        // Appends the path data for this sub-path to the array of all path data.
        allPathData.push(pathData);
      }
    );
  });

  return {
    x,
    y,
    width,
    height,
    centerX,
    centerY,
    // Joins all the path data into one string, separated by spaces.
    pathData: allPathData.join(" "),
  };
}

/**
 * Extracts transformation and dimension information from an element and the page it belongs to.
 * The element's position and dimensions are adjusted based on its transformation and the page's transformation.
 * This is necessary because the position and dimensions in the original data are not always relative to the page,
 * but the transformation in the CESDK is applied relative to the page.
 *
 * @param element - The XML element to extract the transformation and dimension information from.
 * @param page - The page the XML element belongs to.
 * @returns An object with the dimensions and transformations, as well as x and y coordinates.
 */
export function getTransformAndShapeProperties(
  element: Element,
  page: Element,
  additionalTransforms: number[][] = []
) {
  // Get the 2x3 transformation matrix of the page
  const pageItemTransform = page
    .getAttribute("ItemTransform")!
    .split(" ")
    .map(parseFloat);
  // const toPagePosition = (x: number, y: number) => ({
  //   x: x - pageItemTransform[4],
  //   y: y - pageItemTransform[5],
  // });
  const pageOffsetX = pageItemTransform[4];
  const pageOffsetY = pageItemTransform[5];
  // const pageGeometricBounds = page
  //   .getAttribute("GeometricBounds")!
  //   .split(" ")
  //   .map(parseFloat) as [y1: number, x1: number, y2: number, x2: number];
  // Get the 2x3 transformation matrix of the element
  const elementItemTransform = element
    .getAttribute("ItemTransform")!
    .split(" ")
    .map(parseFloat);

  // Extracts the transformations and dimensions.
  const pageTransform = parseTransformMatrix(pageItemTransform);
  // elements between the page and the element in the tree:
  const ancestors: Element[] = [];
  let currentElement = element;
  while (
    currentElement.parentElement &&
    currentElement.parentElement.tagName !== "Spread"
  ) {
    ancestors.push(currentElement.parentElement);
    currentElement = currentElement.parentElement;
  }
  const allTransforms = ancestors
    .map((ancestor) => {
      const transform = ancestor.getAttribute("ItemTransform");
      if (!transform) return null;
      return transform.split(" ").map(parseFloat);
    })
    .filter((transform) => transform !== null) as number[][];
  // Combine all transforms into one
  const combinedTransform = [
    ...allTransforms,
    ...additionalTransforms,
    elementItemTransform,
  ];
  const combinedTransformMatrix = multiplyItemTransforms([
    // pageItemTransform,
    ...allTransforms,
    elementItemTransform,
  ]);
  // parseTransformMatrix(elementItemTransform)
  // Apply the combined transform to the page transform
  console.log({
    pageTransform,
    combinedTransform,
    ancestors: ancestors.map((ancestor) => ancestor.tagName),
  });

  const elementTransform = parseTransformMatrix(combinedTransformMatrix);

  // Get the path geometry of the element.
  const elementPathGeometry = element.querySelector("PathGeometry")!;
  const shapeGeometry = parsePathGeometry(elementPathGeometry);

  // Calculates offsets between the page and the shape.
  // These offsets are used to adjust the element's position
  // to be relative to the page instead of the original coordinates.
  const xOffset = pageTransform.x - shapeGeometry.x;
  const yOffset = pageTransform.y - shapeGeometry.y;

  // Adjusts the element's transformation for the offsets.
  // This makes the element's position relative to the page.
  const leftUpperPoint = transformPoint(
    combinedTransformMatrix,
    shapeGeometry.x,
    shapeGeometry.y
  );
  //Page example: GeometricBounds="-36.5 -25 109.5 175" ItemTransform="1 0 0 1 -75 -36.5"
  const geometricBounds = page
    .getAttribute("GeometricBounds")
    ?.split(" ")
    .map(parseFloat) as [number, number, number, number];
  const elementX = leftUpperPoint.x - pageOffsetX - geometricBounds[1];
  const elementY = leftUpperPoint.y - pageOffsetY - geometricBounds[0];

  // Calculates the new coordinates of the shape's center after rotation. The "centerX" and "centerY" variables
  // are the result of applying the rotation matrix to the original center coordinates of the shape.
  // The rotation matrix formula is [cos(theta) -sin(theta); sin(theta) cos(theta)] where theta is the rotation angle.
  const centerX =
    shapeGeometry.centerX * Math.cos(elementTransform.rotation) -
    shapeGeometry.centerY * Math.sin(elementTransform.rotation);
  const centerY =
    shapeGeometry.centerX * Math.sin(elementTransform.rotation) +
    shapeGeometry.centerY * Math.cos(elementTransform.rotation);

  // Adjusts the unrotated element's position by adding the "rotatedX" and "rotatedY". These additions take into account
  // the changes in the position of the shape's center due to rotation. The results are the final coordinates of the shape
  // after rotation has been applied.
  const x = elementX; // + pageOffsetX;
  const y = elementY; // + pageOffsetY;
  const width = shapeGeometry.width * elementTransform.scaleX;
  const height = shapeGeometry.height * elementTransform.scaleY;

  console.log({
    leftUpperPoint,
    name: element.getAttribute("Name"),
    elementTransform,
    pageTransform,
    x,
    y,
    width,
    height,
  });

  return {
    ...shapeGeometry,
    ...elementTransform,
    width,
    height,
    x,
    y,
  };
}

/**
 * Extracts the image URI from an IDML element
 * Note: At the moment we are only supporting Embedded Images
 */
export function getImageURI(element: Element, logger: Logger) {
  const contentType = element.getAttribute("ContentType");

  // If the element is not an image, return null
  if (contentType !== "GraphicType") return null;

  // Get the image element
  const image = element.querySelector("Image") ?? element.querySelector("SVG");

  // Check if there is a PDF element, if so log out a warning and return a placeholder image
  if (!image && element.querySelector("PDF")) {
    logger.log(
      "An element contained PDF data, which is not supported yet. The element will be replaced with a placeholder image.",
      "warning"
    );
    return "https://img.ly/static/cesdk/placeholder_image.svg";
  }

  if (!image) return null;

  const linkChild = getChildByTagName(image, "Link");
  const isEmbedded = linkChild?.getAttribute("StoredState") === "Embedded";
  if (!isEmbedded) {
    // If the image contains a Link element, it is a linked image that is not present in the IDML Source File.
    // In this case, we fill it with a sample image URI to indicate to the user that it needs to be replaced.
    logger.log(
      "Linked images are not supported yet. Please embed all images inside the idml file.",
      "warning"
    );
    return "https://img.ly/static/cesdk/placeholder_image.svg";
  }

  const contentElement = image.querySelector("Contents")!;
  if (contentElement) {
    return extractEmbeddedImage(image, logger);
  }
  // Return null if the image URI could not be extracted
  return null;
}

function extractEmbeddedImage(image: Element, logger: Logger): string | null {
  // Get the base64 string from the CDATA elements and join them together
  const BASE64_STRING_REGEX = /<!\[CDATA\[(?<base64>.*?)\]\]>/gs;

  const contentElement = image.querySelector("Contents")!;
  if (!contentElement)
    return "https://img.ly/static/cesdk/placeholder_image.svg";

  const contents = contentElement.innerHTML.replaceAll("\n", "");
  const matches = contents.matchAll(BASE64_STRING_REGEX);
  const cdata = Array.from(matches)
    .map((s) => s.groups?.base64 ?? "")
    .join("");

  // Get the image type
  const imageType = image.getAttribute("ImageTypeName");

  let type = "";

  switch (true) {
    case image.tagName === "Image" &&
      (imageType?.includes("JPEG") || imageType?.includes("JPG")):
      type = "image/jpeg";
      break;

    case image.tagName === "Image" && imageType?.includes("PNG"):
      type = "image/png";
      break;

    case image.tagName === "SVG":
      type = "image/svg+xml";
  }

  // Return the image URI as a base64 data URI
  if (cdata) {
    return `data:${type};base64,${cdata}`;
  }
  // Return null if the image URI could not be extracted
  return null;
}

/**
 * Extracts the colors from an IDML graphic resources file
 * These are the colors that are used in the IDML document
 *
 * @param graphicResources The IDML graphic resources file
 * @returns A map of color IDs to RGBA colors
 */
export function extractColors(graphicResources: Document) {
  return new Map(
    Array.from(graphicResources.querySelectorAll("Color")).map((colorTag) => {
      // Get the color ID
      const key = colorTag.getAttribute("Self")!;
      // Get the color space
      const space = colorTag.getAttribute("Space")!;
      // Get the color value
      const colorValue = colorTag.getAttribute("ColorValue")!;

      // If it's a CMYK color, convert it to RGBA
      if (space === "CMYK") {
        const CMYK = colorValue.split(" ").map(parseFloat);
        return [
          key,
          CMYKtoRGBA({
            c: CMYK[0],
            m: CMYK[1],
            y: CMYK[2],
            k: CMYK[3],
            tint: 1,
          }),
        ];
      }

      // If it's an RGB color, convert it to RGBA and normalize the values
      if (space === "RGB") {
        const [r, g, b] = colorValue.split(" ").map(parseFloat);
        return [
          key,
          {
            r: r / 255,
            g: g / 255,
            b: b / 255,
            a: 1,
          },
        ];
      }

      // Return black if the color space is unsupported
      return [
        key,
        {
          r: 0,
          g: 0,
          b: 0,
          a: 1,
        },
      ];
    }) as [string, RGBAColor][]
  );
}

/**
 * Extracts the Gradients from an IDML graphic resources file
 * These are the Gradients that are used in the IDML document
 *
 * @param graphicResources The IDML graphic resources file
 * @returns A map of gradient IDs to CE.SDK GradientColorStops
 */
export function extractGradients(
  graphicResources: Document,
  colors: Map<string, RGBAColor>
): Map<string, Gradient> {
  return new Map(
    Array.from(graphicResources.querySelectorAll("Gradient")).map(
      (gradientTag) => {
        // Get the gradient ID
        const key = gradientTag.getAttribute("Self")!;
        // Get the gradient stop
        const GradientStops = gradientTag.querySelectorAll("GradientStop");

        const gradientStops = Array.from(GradientStops).map(
          (GradientStop, index) => {
            const locationAttribute = GradientStop.getAttribute("Location");
            const location = locationAttribute
              ? parseFloat(locationAttribute) / 100
              : index / (GradientStops.length - 1);
            const stop: GradientColorStop = {
              color: getGradientStopColor(GradientStop, colors),
              stop: location,
            };
            return stop;
          }
        );

        const idmlGradientType = gradientTag.getAttribute("Type")! as
          | "Linear"
          | "Radial";
        const gradientTypeMap = {
          Linear: "//ly.img.ubq/fill/gradient/linear",
          Radial: "//ly.img.ubq/fill/gradient/radial",
        } as const;

        return [
          key,
          {
            type: gradientTypeMap[idmlGradientType],
            stops: gradientStops,
          },
        ];
      }
    )
  );
}

/**
 * Extracts the color of a gradient stop from an IDML GradientStop element
 * @param gradientStop The IDML GradientStop element
 * @returns The color of the gradient stop as an RGBA color array
 */
function getGradientStopColor(
  gradientStop: Element,
  colors: Map<string, RGBAColor>
): RGBAColor {
  const color = gradientStop.getAttribute("StopColor")!;
  const colorValue = colors.get(color);
  if (colorValue) {
    return colorValue;
  }
  console.error("Unknown Gradient Stop Color Format found: ", color);
  return {
    r: 0,
    g: 0,
    b: 0,
    a: 1,
  };
}

/**
 * Converts a CMYK color to RGBA
 *
 * @param CMYK The CMYK color to convert
 * @returns The RGBA color
 */
export function CMYKtoRGBA(CMYK: CMYKColor): RGBAColor {
  // Normalize the input color components to the range of [0,1]
  const c = CMYK.c / 100;
  const m = CMYK.m / 100;
  const y = CMYK.y / 100;
  const k = CMYK.k / 100;

  // Convert the normalized CMYK color into RGB components
  // Formula: new_color = 1 - min(1, input_color * (1 - K) + K)
  const r = 1 - Math.min(1, c * (1 - k) + k);
  const g = 1 - Math.min(1, m * (1 - k) + k);
  const b = 1 - Math.min(1, y * (1 - k) + k);

  return {
    r,
    g,
    b,
    a: 1,
  };
}

/**
 * This scales and translates any vector
 * so that it sits on the circumference of
 * a unit rectangle centered at [0.5, 0.5].
 * Used to position gradient control points.
 */
export const scaleAndTranslateToUnitRect = (value: Vector2): Vector2 => {
  const longSide = Math.max(Math.abs(value.x), Math.abs(value.y));
  if (longSide === 0) return { x: 0.5, y: 0.5 };
  return {
    x: (value.x / longSide) * 0.5 + 0.5,
    y: (value.y / longSide) * 0.5 + 0.5,
  };
};

const sqrtOfTwo = Math.sqrt(2);
/**
 * Creates `Start` and `End` gradient control points
 * that lie on opposite sides of a unit rectangle.
 * This is our method of placing control points using
 * only an 'angle' input from the User.
 * A line connecting them would sit at an angle of `angleInDegrees`,
 * with 0 pointing upwards and positive values rotating clockwise.
 */
export const angleToGradientControlPoints = (
  angleInDegrees: number,
  aspectRatio: number
) => {
  const rad = ((angleInDegrees + 90) / 180) * Math.PI;
  const start: Vector2 = {
    x: (Math.cos(rad + Math.PI) / aspectRatio) * sqrtOfTwo,
    y: Math.sin(rad + Math.PI) * sqrtOfTwo,
  };
  const end: Vector2 = {
    x: (Math.cos(rad) / aspectRatio) * sqrtOfTwo,
    y: Math.sin(rad) * sqrtOfTwo,
  };
  return {
    start: scaleAndTranslateToUnitRect(start),
    end: scaleAndTranslateToUnitRect(end),
  };
};

/**
 * Replaces special characters with their XML entity equivalents
 * @param input The string to replace the characters in
 * @returns The string with the special characters replaced
 */
export function replaceSpecialCharacters(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Parses a FontStyle= attribute value to extract the weight and style
 * @param fontStyleString The FontStyle= attribute value
 * @returns The weight and style extracted from the FontStyle= attribute
 */
export function parseFontStyleString(fontStyleString: string): {
  weight: Font["weight"];
  style: Font["style"];
} {
  if (fontStyleString === "") {
    return { weight: "normal", style: "normal" };
  }
  const standardizedFontStyleString = fontStyleString.toLowerCase();
  const words = standardizedFontStyleString.split(" ");
  // if any word is "italic" then the style is italic
  const style = words.some((word) => word.toLowerCase() === "italic")
    ? "italic"
    : "normal";

  const weight =
    Object.entries(WEIGHT_ALIAS_MAP).find(
      ([key, value]) =>
        words.includes(key.toLowerCase()) ||
        words.includes(value?.toLowerCase() ?? "")
    )?.[1] ?? "normal";
  return { weight, style };
}

function getChildByTagName(parent: Element, tagName: string): Element | null {
  const children = [...parent.children];
  const child = children.find((child) => child.tagName === tagName);
  return child ?? null;
}
/**
 * Gets the IDML ID of a block
 * @param engine The CreativeEngine instance
 * @param id The IDML ID to search for
 * @returns The block ID or undefined if not found
 */
export function getBlockByIDMLId(
  engine: CreativeEngine,
  id: string
): number | undefined {
  const block = engine.block
    .findAll()
    .filter((block) => engine.block.hasMetadata(block, "idml/id"))
    .find((block) => engine.block.getMetadata(block, "idml/id") === id);

  return block;
}

/**
 * Sets the IDML ID of a block
 * @param engine The CreativeEngine instance
 * @param block The block ID to set the IDML ID for
 * @param id The IDML ID to set
 */
export function setBlockIDMLId(
  engine: CreativeEngine,
  block: number,
  id: string
): void {
  engine.block.setMetadata(block, "idml/id", id);
}
