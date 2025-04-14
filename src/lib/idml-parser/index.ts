import type CreativeEngine from "@cesdk/engine";
import type { Font, RGBAColor } from "@cesdk/engine";
import type { TypefaceResolver } from "./font-resolver";
import defaultFontResolver from "./font-resolver";
import { Logger } from "./logger";
import type { Gradient, IDML } from "./types";
import {
  angleToGradientControlPoints,
  extractColors,
  extractGradients,
  getImageURI,
  getPageAttributes,
  getTransformAndShapeProperties,
  parseFontStyleString,
  replaceSpecialCharacters,
  unzipIdmlFile,
} from "./utils";

// The design unit used in the CESDK Editor
const DESIGN_UNIT = "Inch";
// "The units used by the pasteboard coordinate system are points, defined as 72 units per inch.
// Changing the definition of points in the In­ Design user interface has no effect on the definition
// of points used in IDML."
const POINT_TO_INCH = 72;
const DEFAULT_FONT_NAME = "Roboto";

// Element types of the spreads in the IDML file
const SPREAD_ELEMENTS = {
  PAGE: "Page",
  RECTANGLE: "Rectangle",
  OVAL: "Oval",
  POLYGON: "Polygon",
  GRAPHIC_LINE: "GraphicLine",
  TEXT_FRAME: "TextFrame",
  GROUP: "Group",
} as const;

export class IDMLParser {
  private engine: CreativeEngine;
  // The scene ID of the parsed IDML file
  private scene: number;
  // The IDML file contents
  private idml: IDML;
  // A function that resolves the font URI from the font name and style
  private fontResolver: TypefaceResolver;
  // A map of the colors used in the IDML document and their RGBA values
  private colors: Map<string, RGBAColor>;
  // A map of the gradients used in the IDML document and their GradientColorStop values
  private gradients: Map<string, Gradient>;
  private spreads: Document[];
  // A list of errors and warnings that occurred during the parsing process
  private logger = new Logger();

  private constructor(
    engine: CreativeEngine,
    idml: IDML,
    fontResolver?: TypefaceResolver
  ) {
    this.engine = engine;
    this.idml = idml;
    this.colors = extractColors(this.idml["Resources/Graphic.xml"]);
    this.gradients = extractGradients(
      this.idml["Resources/Graphic.xml"],
      this.colors
    );

    this.fontResolver = fontResolver ?? defaultFontResolver;
    this.spreads = this.getSpreads();

    // get the default width and height from the first page

    const firstPage = this.spreads[0].querySelector(SPREAD_ELEMENTS.PAGE)!;
    const { width, height } = getPageAttributes(firstPage);

    // create a new scene and set the design unit and page dimensions
    // we are assuming that all pages have the same dimensions since
    // we do not support different page sizes in the CESDK Editor yet
    this.scene = this.engine.scene.create("VerticalStack");

    const stack = this.engine.block.findByType("//ly.img.ubq/stack")[0];
    // set standard values for the stack block:
    this.engine.block.setFloat(stack, "stack/spacing", 35);
    this.engine.block.setBool(stack, "stack/spacingInScreenspace", true);

    this.engine.scene.setDesignUnit(DESIGN_UNIT);
    this.engine.block.setInt(this.scene, "scene/dpi", POINT_TO_INCH);
    this.engine.block.setFloat(
      this.scene,
      "scene/pageDimensions/width",
      width / POINT_TO_INCH
    );
    this.engine.block.setFloat(
      this.scene,
      "scene/pageDimensions/height",
      height / POINT_TO_INCH
    );
    this.engine.editor;
  }

  /**
   * Instantiate a new IDMLParser from a File or Blob
   *
   * @param cesdk The CreativeEditorSDK instance
   * @param file The IDML file
   * @param fontResolver A function that resolves the font URI from the font name and style
   * @returns A new IDMLParser instance
   */
  static async fromFile(
    engine: CreativeEngine,
    file: Blob | File | ArrayBuffer,
    DOMParser: any,
    fontResolver?: TypefaceResolver
  ) {
    const idml = await unzipIdmlFile(file, DOMParser);
    return new IDMLParser(engine, idml, fontResolver);
  }

  public async parse() {
    // create a new logger, since the parsing process can be repeated
    this.logger = new Logger();
    // generate page blocks from the spreads and populate them with the page elements
    await this.generatePagesFromSpreads();
    return {
      scene: this.scene,
      logger: this.logger,
    };
  }

  private getSpreads() {
    // extract the designmap.xml file
    const designMap = this.idml["designmap.xml"];

    // extract the spreads from the designmap.xml file and
    // map the spread src to the spread document in the IDML file
    return Array.from(designMap.getElementsByTagName("idPkg:Spread")).map(
      (spread) => {
        const src = spread.getAttribute("src") as string;
        return this.idml[src];
      }
    );
  }

  // Extract bleed margins from the IDML file
  private getBleedMargins() {
    const preferences = this.idml["Resources/Preferences.xml"];
    const documentPreference = preferences.querySelector("DocumentPreference")!;
    const bleedMargins = {
      top:
        parseFloat(documentPreference.getAttribute("DocumentBleedTopOffset")!) /
        POINT_TO_INCH,
      bottom:
        parseFloat(
          documentPreference.getAttribute("DocumentBleedBottomOffset")!
        ) / POINT_TO_INCH,
      left:
        parseFloat(
          documentPreference.getAttribute("DocumentBleedInsideOrLeftOffset")!
        ) / POINT_TO_INCH,
      right:
        parseFloat(
          documentPreference.getAttribute("DocumentBleedOutsideOrRightOffset")!
        ) / POINT_TO_INCH,
    };
    return bleedMargins;
  }
  // generate pages from the spreads in the IDML file
  private async generatePagesFromSpreads() {
    // find the stack block in the scene to append the pages to
    const stack = this.engine.block.findByType("//ly.img.ubq/stack")[0];

    const bleedMargin = this.getBleedMargins();
    const hasBleedMargin = Object.values(bleedMargin).some(
      (margin) => margin !== 0
    );

    // iterate over the spreads and generate a page block for each spread
    const pagePromises = this.spreads.map(async (spread) => {
      // find the page element in the spread XML document
      const page = spread.querySelector(SPREAD_ELEMENTS.PAGE);

      if (!page) throw new Error("No page found in the spread");

      // Get the page name and dimensions from the page element
      const pageAttributes = getPageAttributes(page);
      // Create a new page block
      const pageBlock = this.engine.block.create("//ly.img.ubq/page");

      // Convert the page dimensions from points to the CESDK design unit
      const width = pageAttributes.width / POINT_TO_INCH;
      const height = pageAttributes.height / POINT_TO_INCH;

      // Set the page name, width, and height
      this.engine.block.setName(pageBlock, pageAttributes.name);
      this.engine.block.setWidth(pageBlock, width);
      this.engine.block.setHeight(pageBlock, height);
      this.engine.block.setClipped(pageBlock, true);
      // Set the bleed margins
      if (hasBleedMargin) {
        this.engine.block.setBool(pageBlock, "page/marginEnabled", true);
      }
      this.engine.block.setFloat(
        pageBlock,
        "page/margin/bottom",
        bleedMargin.bottom
      );
      this.engine.block.setFloat(
        pageBlock,
        "page/margin/left",
        bleedMargin.left
      );
      this.engine.block.setFloat(
        pageBlock,
        "page/margin/right",
        bleedMargin.right
      );
      this.engine.block.setFloat(pageBlock, "page/margin/top", bleedMargin.top);

      // Append the page block to the stack block
      this.engine.block.appendChild(stack, pageBlock);

      // Get the spread element from the spread XML document
      const spreadElement = spread.getElementsByTagName("Spread")[0];
      // Render the page elements and append them to the page block
      await this.renderPageElements(spreadElement, page, pageBlock);

      return pageBlock;
    });
    return Promise.all(pagePromises);
  }

  /**
   * Loop over the page elements and render the CESDK blocks based on the element type
   *
   * @param element The page element
   * @param spread The page element's parent page
   * @param pageBlock The page block to append the rendered blocks to
   * @returns An array of the rendered blocks
   */
  private async renderPageElements(
    element: Element,
    spread: Element,
    pageBlock: number
  ): Promise<number[]> {
    // Loop over the page element's children
    const blocks = await Promise.all(
      Array.from(element.children).map(async (element): Promise<number[]> => {
        const visible = element.getAttribute("Visible") === "true";
        if (!visible) return [];
        // Render the CESDK block based on the element type
        switch (element.tagName) {
          case SPREAD_ELEMENTS.RECTANGLE: {
            // Get the rectangle's transform and dimensions
            const rectAttributes = getTransformAndShapeProperties(
              element,
              spread
            );

            let block: number;

            // If the rectangle has an image URI, create an image block
            block = this.engine.block.create("//ly.img.ubq/graphic");
            const shape = this.engine.block.createShape(
              "//ly.img.ubq/shape/rect"
            );
            this.engine.block.setShape(block, shape);
            this.engine.block.setKind(block, "shape");

            await this.applyImageFill(block, element);
            this.applyStroke(block, element);
            this.applyTransparency(block, element);

            this.engine.block.appendChild(pageBlock, block);

            // Convert the rectangle's dimensions from points to the CESDK design unit
            const x = rectAttributes.x / PIXEL_SCALE_FACTOR;
            const y = rectAttributes.y / PIXEL_SCALE_FACTOR;
            const width = rectAttributes.width / PIXEL_SCALE_FACTOR;
            const height = rectAttributes.height / PIXEL_SCALE_FACTOR;

            this.engine.block.setPositionX(block, x);
            this.engine.block.setPositionY(block, y);
            this.engine.block.setWidth(block, width);
            this.engine.block.setHeight(block, height);
            this.engine.block.setRotation(block, rectAttributes.rotation);

            if (this.engine.block.getKind(block) === "shape") {
              // Fill needs to be applied after setting height and width, because gradient fills need the dimensions
              this.applyFill(block, element);
              this.applyBorderRadius(block, element);
            }

            this.copyElementName(element, block);
            return [block];
          }

          case SPREAD_ELEMENTS.OVAL: {
            // Get the oval's transform and dimensions
            const ovalAttributes = getTransformAndShapeProperties(
              element,
              spread
            );

            // Create an ellipse block
            const block = this.engine.block.create("//ly.img.ubq/graphic");
            this.engine.block.setKind(block, "shape");
            const shape = this.engine.block.createShape(
              "//ly.img.ubq/shape/ellipse"
            );
            this.engine.block.setShape(block, shape);

            this.applyFill(block, element);
            await this.applyImageFill(block, element);
            this.applyStroke(block, element);
            this.applyTransparency(block, element);

            this.engine.block.appendChild(pageBlock, block);

            // Convert the oval's dimensions from points to the CESDK design unit
            const x = ovalAttributes.x / PIXEL_SCALE_FACTOR;
            const y = ovalAttributes.y / PIXEL_SCALE_FACTOR;
            const width = ovalAttributes.width / PIXEL_SCALE_FACTOR;
            const height = ovalAttributes.height / PIXEL_SCALE_FACTOR;

            this.engine.block.setPositionX(block, x);
            this.engine.block.setPositionY(block, y);
            this.engine.block.setWidth(block, width);
            this.engine.block.setHeight(block, height);
            this.engine.block.setRotation(block, ovalAttributes.rotation);

            this.copyElementName(element, block);
            return [block];
          }

          case SPREAD_ELEMENTS.POLYGON: {
            // Get the polygon's transform and dimensions
            const polygonAttributes = getTransformAndShapeProperties(
              element,
              spread
            );

            // Create a vector path block
            const block = this.engine.block.create("//ly.img.ubq/graphic");
            this.engine.block.setKind(block, "shape");
            const shape = this.engine.block.createShape(
              "//ly.img.ubq/shape/vector_path"
            );
            this.engine.block.setShape(block, shape);

            // Set the vector path's path data, width, and height
            this.engine.block.setString(
              shape,
              "vector_path/path",
              polygonAttributes.pathData
            );
            this.engine.block.setFloat(
              shape,
              "vector_path/width",
              polygonAttributes.width
            );
            this.engine.block.setFloat(
              shape,
              "vector_path/height",
              polygonAttributes.height
            );

            this.applyFill(block, element);
            await this.applyImageFill(block, element);
            this.applyStroke(block, element);
            this.applyTransparency(block, element);

            this.engine.block.appendChild(pageBlock, block);

            // Convert the polygon's dimensions from points to the CESDK design unit
            const x = polygonAttributes.x / PIXEL_SCALE_FACTOR;
            const y = polygonAttributes.y / PIXEL_SCALE_FACTOR;
            const width = polygonAttributes.width / PIXEL_SCALE_FACTOR;
            const height = polygonAttributes.height / PIXEL_SCALE_FACTOR;

            this.engine.block.setPositionX(block, x);
            this.engine.block.setPositionY(block, y);
            this.engine.block.setWidth(block, width);
            this.engine.block.setHeight(block, height);
            this.engine.block.setRotation(block, polygonAttributes.rotation);

            this.copyElementName(element, block);
            return [block];
          }

          case SPREAD_ELEMENTS.GRAPHIC_LINE: {
            // Get the line's transform and dimensions
            const lineAttributes = getTransformAndShapeProperties(
              element,
              spread
            );

            // Create a line block
            const block = this.engine.block.create("//ly.img.ubq/graphic");
            this.engine.block.setKind(block, "shape");
            const shape = this.engine.block.createShape("line");
            this.engine.block.setShape(block, shape);

            this.applyTransparency(block, element);

            this.engine.block.appendChild(pageBlock, block);

            // Get the inherited styles of the element to use as fallback
            const appliedObjectStyle =
              element.getAttribute("AppliedObjectStyle")!;
            const objectStyles = this.idml[
              "Resources/Styles.xml"
            ].querySelector(`ObjectStyle[Self="${appliedObjectStyle}"]`)!;

            // Get the stroke styles from the element or the inherited styles
            const strokeColor =
              element.getAttribute("StrokeColor") ??
              objectStyles.getAttribute("StrokeColor");
            const strokeWeight =
              element.getAttribute("StrokeWeight") ??
              objectStyles.getAttribute("StrokeWeight");

            // Use the stroke style as the line's fill
            if (strokeColor) {
              this.applyFill(block, element, "StrokeColor");
            }

            // Convert the line's height from points to the CESDK design unit
            if (strokeWeight) {
              const height = parseFloat(strokeWeight) / POINT_TO_INCH;
              this.engine.block.setHeight(block, height);
            } else {
              console.warn("No stroke weight found for line");
            }
            // Convert the line's dimensions from points to the CESDK design unit
            const x = lineAttributes.x / POINT_TO_INCH;
            const y = lineAttributes.y / POINT_TO_INCH;
            const width = lineAttributes.width / POINT_TO_INCH;

            this.engine.block.setPositionX(block, x);
            this.engine.block.setPositionY(block, y);
            this.engine.block.setWidth(block, width);
            this.engine.block.setRotation(block, lineAttributes.rotation);

            this.copyElementName(element, block);
            return [block];
          }

          case SPREAD_ELEMENTS.TEXT_FRAME: {
            // Get the parent story of the text frame
            const parentStoryId = element.getAttribute("ParentStory");
            const parentStory = this.idml[`Stories/Story_${parentStoryId}.xml`];

            // Log out a warning if a story (text) has multiple text frames.
            // The CE.SDK does not support overflowing text between multiple text frames.
            const hasOtherFrames =
              element.getAttribute("PreviousTextFrame") !== "n" ||
              element.getAttribute("NextTextFrame") !== "n";

            if (hasOtherFrames) {
              this.logger.log(
                `Story with ID ${parentStoryId} has multiple text frames. This is currently not supported and might lead to text duplication.`,
                "warning"
              );
            }
            // Create a text block
            const block = this.engine.block.create("//ly.img.ubq/text");

            const characterStyleRange = parentStory.querySelectorAll(
              "CharacterStyleRange"
            );

            const getContentFromCharacterStyleRange = (range: Element) => {
              let rangeContent = "";
              Array.from(range.children).forEach((child) => {
                switch (child.tagName) {
                  case "Content":
                    rangeContent += replaceSpecialCharacters(child.innerHTML);
                    break;
                  case "Br":
                    rangeContent += "\r\n";
                    break;
                }
              });
              return rangeContent;
            };
            // extract the text content from the CharacterStyleRange elements
            const content = Array.from(characterStyleRange)
              .map(getContentFromCharacterStyleRange)
              .join("");

            // Disable text clipping outside of the text frame
            // This was necessary because InDesign seems to have a lower threshold
            // for clipping the text than the CESDK Editor, which was causing parts
            // of the text to be clipped in the CESDK Editor
            this.engine.block.setBool(
              block,
              "text/clipLinesOutsideOfFrame",
              false
            );
            // Set the text content
            this.engine.block.setString(block, "text/text", content);

            // the default font
            let font: {
              family: string;
              style: Font["style"];
              weight: Font["weight"];
            } = {
              family: DEFAULT_FONT_NAME,
              style: "normal",
              weight: "normal",
            };

            let length = 0;
            const characterStyleRangeWithInterval = [...characterStyleRange]
              .map((range) => {
                const content = getContentFromCharacterStyleRange(range);
                const start = length;
                length += content.length;
                return {
                  range,
                  content,
                  start,
                  end: length,
                };
              })
              .filter(({ start, end }) => end > start);

            // apply the text styles for each text segment
            const applyTextRunPromises = characterStyleRangeWithInterval.map(
              async ({ range, start, end }) => {
                const parentParagraphStyle = range.parentElement;
                const appliedParagraphStyleId =
                  parentParagraphStyle?.getAttribute("AppliedParagraphStyle");
                const appliedParagraphStyle = this.idml[
                  "Resources/Styles.xml"
                ].querySelector(
                  `ParagraphStyle[Self="${appliedParagraphStyleId}"]`
                );
                const appliedCharacterStyleId = range.getAttribute(
                  "AppliedCharacterStyle"
                );
                const appliedCharacterStyle = this.idml[
                  "Resources/Styles.xml"
                ].querySelector(
                  `CharacterStyle[Self="${appliedCharacterStyleId}"]`
                );
                const getAttribute = (attribute: string) =>
                  range.getAttribute(attribute) ??
                  appliedCharacterStyle?.getAttribute(attribute) ??
                  appliedParagraphStyle?.getAttribute(attribute);

                // get the text segment color
                const color = getAttribute("FillColor") ?? "Black";
                const rgba = this.colors.get(color);

                if (rgba) {
                  this.engine.block.setTextColor(block, rgba, start, end);
                }

                // get the text segment font size
                const fontSize =
                  range.getAttribute("PointSize") ??
                  appliedParagraphStyle?.getAttribute("PointSize");

                if (fontSize) {
                  this.engine.block.setTextFontSize(
                    block,
                    parseFloat(fontSize),
                    start,
                    end
                  );
                }

                // get the text segment case
                const capitalization =
                  range.getAttribute("Capitalization") ??
                  appliedParagraphStyle?.getAttribute("Capitalization");
                switch (capitalization) {
                  case "AllCaps":
                    this.engine.block.setTextCase(
                      block,
                      "Uppercase",
                      start,
                      end
                    );
                    break;
                }

                // get the text segment font family and style
                const fontFamily =
                  range.querySelector("AppliedFont")?.innerHTML ??
                  appliedParagraphStyle?.querySelector("AppliedFont")
                    ?.innerHTML ??
                  "Roboto";
                const { style, weight } = parseFontStyleString(
                  range.getAttribute("FontStyle") ??
                    appliedParagraphStyle?.getAttribute("FontStyle") ??
                    ""
                );
                font = {
                  family: fontFamily,
                  style,
                  weight,
                };

                // get the font URI from the font resolver
                const typefaceResponse = await this.fontResolver(
                  font,
                  this.engine
                );

                if (!typefaceResponse) {
                  this.logger.log(
                    `Could not find typeface for font ${font.family}`,
                    "warning"
                  );
                  return;
                }
                this.engine.block.setTypeface(
                  block,
                  typefaceResponse.typeface,
                  start,
                  end
                );
                this.engine.block.setTextFontStyle(block, style!, start, end);
                this.engine.block.setTextFontWeight(block, weight!, start, end);
              }
            );

            await Promise.allSettled(applyTextRunPromises);

            // If the story contains a paragraph style range, we also read the paragraph style text alignment
            // Example XML:
            // <ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/SomeID">
            // <CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[No character style]">
            const firstParagraphStyle = parentStory.querySelector(
              "ParagraphStyleRange"
            );
            const appliedParagraphStyleId = firstParagraphStyle?.getAttribute(
              "AppliedParagraphStyle"
            );
            const appliedParagraphStyle = this.idml[
              "Resources/Styles.xml"
            ].querySelector(
              `ParagraphStyle[Self="${appliedParagraphStyleId}"]`
            )!;

            const justification =
              firstParagraphStyle?.getAttribute("Justification") ??
              appliedParagraphStyle?.getAttribute("Justification");

            // set the text alignment
            switch (justification) {
              case "LeftAlign":
                this.engine.block.setEnum(
                  block,
                  "text/horizontalAlignment",
                  "Left"
                );
                break;

              case "CenterAlign":
                this.engine.block.setEnum(
                  block,
                  "text/horizontalAlignment",
                  "Center"
                );
                break;

              case "RightAlign":
                this.engine.block.setEnum(
                  block,
                  "text/horizontalAlignment",
                  "Right"
                );
                break;
            }

            this.applyTransparency(block, element);

            this.engine.block.appendChild(pageBlock, block);

            // Get the text frame's transform and dimensions
            const textFrameAttributes = getTransformAndShapeProperties(
              element,
              spread
            );

            // Convert the text frame's dimensions from points to the CESDK design unit
            const x = textFrameAttributes.x / POINT_TO_INCH;
            const y = textFrameAttributes.y / POINT_TO_INCH;
            const width = textFrameAttributes.width / POINT_TO_INCH;
            const height = textFrameAttributes.height / POINT_TO_INCH;

            this.engine.block.setPositionX(block, x);
            this.engine.block.setPositionY(block, y);
            this.engine.block.setWidth(block, width);
            this.engine.block.setHeight(block, height);
            this.engine.block.setRotation(block, textFrameAttributes.rotation);

            let backgroundBlock: number | null = null;
            // If the text frame has a fill color, we create a rectangle block to use as the background
            if (element.getAttribute("FillColor")) {
              backgroundBlock = this.engine.block.create(
                "//ly.img.ubq/graphic"
              );
              this.engine.block.setKind(backgroundBlock, "shape");
              const shape = this.engine.block.createShape(
                "//ly.img.ubq/shape/rect"
              );
              this.engine.block.setShape(backgroundBlock, shape);

              this.engine.block.appendChild(pageBlock, backgroundBlock);
              this.engine.block.setPositionX(backgroundBlock, x);
              this.engine.block.setPositionY(backgroundBlock, y);
              this.engine.block.setWidth(backgroundBlock, width);
              this.engine.block.setHeight(backgroundBlock, height);
              this.engine.block.setRotation(
                backgroundBlock,
                textFrameAttributes.rotation
              );
              this.applyFill(backgroundBlock, element);
            }
            this.engine.block.appendChild(pageBlock, block);

            this.copyElementName(element, block);
            return backgroundBlock ? [block, backgroundBlock] : [block];
          }

          case SPREAD_ELEMENTS.GROUP: {
            // If the element is a group, we render the group's children recursively
            // and then we group the rendered blocks together
            const children = await this.renderPageElements(
              element,
              spread,
              pageBlock
            );
            const block = this.engine.block.group(children);
            // reordering the blocks to the correct order
            const flatChildrenBlocks = children
              .flat()
              .filter((block) => block !== null);
            for (let index = 0; index < flatChildrenBlocks.length; index++) {
              const child = flatChildrenBlocks[index];
              this.engine.block.insertChild(block, child, index);
            }
            this.copyElementName(element, block);
            return [block];
          }

          default:
            return [];
        }
      })
    );
    // Reorder the blocks into the correct order
    // Children are sorted in their rendering order: Last child is rendered in front of other children.
    const flatBlocks = blocks.flat().filter((block) => block !== null);
    for (let index = 0; index < flatBlocks.length; index++) {
      const block = flatBlocks[index];
      this.engine.block.insertChild(pageBlock, block, index);
    }
    return blocks.flat();
  }

  /**
   * Parses the name of an IDML element and applies it to a CE.SDK block
   *
   * @param element The IDML element
   * @param block The CE.SDK block
   * @returns void
   */
  private copyElementName(element: Element, block: number) {
    this.engine.block.setName(
      block,
      element.getAttribute("Name")?.replace("$ID/", "") ?? ""
    );
  }

  /**
   * Parses the fill styles of an IDML element and applies them to a CESDK block
   *
   * @param block The CESDK block to apply the fill to
   * @param element The IDML element
   * @param attributeName The name of the attribute to use as the fill color
   * @returns void
   */
  private applyFill(
    block: number,
    element: Element,
    attributeName = "FillColor"
  ) {
    // Get the inherited styles of the element to use as fallback
    // if the element does not have a fill styles
    const appliedObjectStyle = element.getAttribute("AppliedObjectStyle")!;
    const objectStyles = this.idml["Resources/Styles.xml"].querySelector(
      `ObjectStyle[Self="${appliedObjectStyle}"]`
    )!;

    // Get the fill color from the element or the inherited styles
    const fillColor =
      element.getAttribute(attributeName) ??
      objectStyles.getAttribute(attributeName);

    if (!fillColor) {
      this.engine.block.setFillEnabled(block, false);
      return;
    }
    // if the element has a fill color, we extract the RGBA values
    // from the document colors using the ID and apply the fill to the block
    if (this.colors.has(fillColor)) {
      const color = this.colors.get(fillColor)!;
      const fill = this.engine.block.createFill("color");
      this.engine.block.setColor(fill, "fill/color/value", color);
      this.engine.block.setFill(block, fill);
    } else if (this.gradients.has(fillColor)) {
      const gradient = this.gradients.get(fillColor)!;
      const gradientFill = this.engine.block.createFill(gradient.type);
      this.engine.block.setGradientColorStops(
        gradientFill,
        "fill/gradient/colors",
        gradient.stops
      );
      if (gradient.type === "//ly.img.ubq/fill/gradient/linear") {
        const idmlAngle = parseFloat(
          element.getAttribute("GradientFillAngle") ?? "0"
        );
        const blockAspectRatio =
          this.engine.block.getWidth(block) /
          this.engine.block.getHeight(block);
        const controlPoints = angleToGradientControlPoints(
          idmlAngle,
          blockAspectRatio
        );
        this.engine.block.setFloat(
          gradientFill,
          "fill/gradient/linear/startPointX",
          controlPoints.start.x
        );
        this.engine.block.setFloat(
          gradientFill,
          "fill/gradient/linear/startPointY",
          controlPoints.start.y
        );
        this.engine.block.setFloat(
          gradientFill,
          "fill/gradient/linear/endPointX",
          controlPoints.end.x
        );
        this.engine.block.setFloat(
          gradientFill,
          "fill/gradient/linear/endPointY",
          controlPoints.end.y
        );
      }
      this.engine.block.setFill(block, gradientFill);
    } else {
      if (fillColor !== "Swatch/None") {
        this.logger.log(
          `Fill color ${fillColor} not found in document colors.`,
          "error"
        );
      }
    }
  }

  /**
   * Parses the stroke styles of an IDML element and applies them to a CESDK block
   *
   * @param block The CESDK block to apply the stroke to
   * @param element The IDML element
   * @returns void
   */
  private applyStroke(block: number, element: Element) {
    // Get the inherited styles of the element to use as fallback
    const appliedObjectStyle = element.getAttribute("AppliedObjectStyle")!;
    const objectStyles = this.idml["Resources/Styles.xml"].querySelector(
      `ObjectStyle[Self="${appliedObjectStyle}"]`
    )!;

    // Get the stroke styles from the element or the inherited styles
    const strokeColor =
      element.getAttribute("StrokeColor") ??
      objectStyles.getAttribute("StrokeColor");
    const strokeWeight =
      element.getAttribute("StrokeWeight") ??
      objectStyles.getAttribute("StrokeWeight");
    const strokeAlignment =
      element.getAttribute("StrokeAlignment") ??
      objectStyles.getAttribute("StrokeAlignment");

    // If the element has a stroke color, we extract the RGBA values
    // from the document colors using the ID and apply the stroke to the block
    if (strokeWeight && strokeColor && this.colors.has(strokeColor)) {
      const rgba = this.colors.get(strokeColor)!;
      const width = parseFloat(strokeWeight) / POINT_TO_INCH;
      this.engine.block.setStrokeWidth(block, width);
      this.engine.block.setStrokeColor(block, rgba);

      // Set the stroke alignment
      switch (strokeAlignment) {
        case "CenterAlignment":
          this.engine.block.setStrokePosition(block, "Center");
          break;

        case "InsideAlignment":
          this.engine.block.setStrokePosition(block, "Inner");
          break;

        case "OutsideAlignment":
          this.engine.block.setStrokePosition(block, "Outer");
          break;
      }

      this.engine.block.setStrokeEnabled(block, true);
    }
  }

  /**
   * Parses the transparency styles of an IDML element and applies them to a CESDK block
   *
   * @param block The CESDK block to apply the transparency to
   * @param element The IDML element
   * @returns void
   */
  private applyTransparency(block: number, element: Element) {
    // Get the transparency settings from the element
    const transparencySetting = element.querySelector("TransparencySetting");
    if (!transparencySetting) return;

    // Get the opacity from the transparency settings
    const opacity = parseFloat(
      transparencySetting
        .querySelector("BlendingSetting")
        ?.getAttribute("Opacity") ?? "100"
    );
    this.engine.block.setOpacity(block, opacity / 100);
  }

  /**
   * Parses the image fill of an IDML element and applies it to a CESDK block
   * @param block The CESDK block to apply the image fill to
   * @param element The IDML element
   * @returns void
   */
  private async applyImageFill(block: number, element: Element) {
    const imageURI = getImageURI(element, this.logger);
    if (imageURI) {
      const fill = this.engine.block.createFill("image");
      this.engine.block.setSourceSet(fill, "fill/image/sourceSet", []);
      try {
        await this.engine.block.addImageFileURIToSourceSet(
          fill,
          "fill/image/sourceSet",
          imageURI
        );
      } catch (e) {
        this.logger.log(`Could not load image from URI ${imageURI}`, "error");
      }
      this.engine.block.setFill(block, fill);
      this.engine.block.setKind(block, "image");
      // Consider FrameFittingOption when setting the content fill mode
      // If all frame fitting options are negative, this implies that the image is shrunk inside the frame.
      // Example: FrameFittingOption LeftCrop="-14.222526745057785" TopCrop="-16.089925261496205" RightCrop="-15.077750964903117" BottomCrop="-16.660074738503738" FittingOnEmptyFrame="Proportionally" />
      // We do not support a crop that makes the image fill smaller than the (graphics block) frame.
      // We should add a warning and set the content fill to "Contain" in this case.
      // Fill mode "Contain" will make sure that the image is not cropped and fits the frame.
      const frameFittingOption = element.querySelector("FrameFittingOption");
      if (frameFittingOption) {
        const [leftCrop, topCrop, rightCrop, bottomCrop] = [
          "LeftCrop",
          "TopCrop",
          "RightCrop",
          "BottomCrop",
        ].map((crop) =>
          parseFloat(frameFittingOption.getAttribute(crop) ?? "0")
        );
        if (leftCrop < 0 && topCrop < 0 && rightCrop < 0 && bottomCrop < 0) {
          this.logger.log(
            "The image is shrunk inside the frame using. This is currently not supported and might lead to unexpected results.",
            "warning"
          );
          this.engine.block.setContentFillMode(block, "Contain");
        }
      }
    }
  }

  /**
   * Parses the corner radius of an IDML element and applies it to a CESDK block
   * @param block The CESDK block to apply the corner radius to
   * @param element The IDML element
   * @returns void
   */
  private applyBorderRadius(block: number, element: Element) {
    // Maps the IDML corner attributes to the corresponding CESDK corner attributes
    const cornerAttributeMap = {
      TopLeft: "TL",
      TopRight: "TR",
      BottomLeft: "BL",
      BottomRight: "BR",
    };

    const shape = this.engine.block.getShape(block);
    const shapeType = this.engine.block.getType(shape);
    if (!shape || shapeType !== "//ly.img.ubq/shape/rect") {
      this.logger.log(
        "Border radius currently can only be applied to rectangle shapes.",
        "warning"
      );
      return;
    }

    Object.entries(cornerAttributeMap).forEach(([idmlName, cesdkName]) => {
      if (!element.getAttribute(`${idmlName}CornerOption`)) return;

      const radius =
        parseFloat(element.getAttribute(`${idmlName}CornerRadius`) ?? "0") /
        POINT_TO_INCH;
      if (radius === 0) return;

      this.engine.block.setFloat(
        shape,
        `shape/rect/cornerRadius${cesdkName}`,
        radius
      );
    });
  }
}
