import { test, expect } from "bun:test";
import {
  Matrix,
  multiplyItemTransforms,
  transformPoint,
  transformPointThroughTransforms,
} from "./transforms";

// function getRightPageOffsetTransform(
//   pageWidth: number,
//   pageHeight: number
// ): Matrix {
//   return [1, 0, 0, 1, 0, pageHeight / 2];
// }
function getSpreadToPageTransform(
  pageWidth: number,
  pageHeight: number
): Matrix {
  return [1, 0, 0, 1, pageWidth / 2, pageHeight / 2];
}

function getRightPageOffsetTransform(pageWidth: number): Matrix {
  return [1, 0, 0, 1, -pageWidth / 2, 0]; // shift spread coords to page-local origin
}

const IDML_SPEC_SPREAD_MATRIX = [
  getSpreadToPageTransform(612, 792),
  getRightPageOffsetTransform(612),
];

//getRightPageOffsetTransform(612, 792);

// <Rectangle ItemTransform="0.9659258262890683 -0.25881904510252074 0.25881904510252074 0.9659258262890683 0 0">
//   <!-- Anchor points like: (72, -324), (72, -252), (144, -252), (144, -324) -->
// </Rectangle>
test("Example 15: Untransformed Rectangle", () => {
  //   <Rectangle Self="ud0" ItemTransform="1 0 0 1 0 0">
  // <Properties>
  // <PathGeometry>
  // <GeometryPathType PathOpen="false">
  // <PathPointArray>
  // <PathPointType Anchor="72 -324" LeftDirection="72 -324"
  // RightDirection="72 -324"/>
  const outerTransform: Matrix = [1, 0, 0, 1, 0, 0];

  const anchor = { x: 72, y: -324 };
  const result = transformPointThroughTransforms(
    [...IDML_SPEC_SPREAD_MATRIX, outerTransform],
    anchor.x,
    anchor.y
  );

  expect(result.x).toBeCloseTo(72);
  expect(result.y).toBeCloseTo(72);
});

// IDML Example 16. Rotation Changes the ItemTransform Attribute in IDML
// <Rectangle Self="ud0" ItemTransform="0.8660254037844387 -0.5000000000000001
// 0.5000000000000001 0.8660254037844387 158.46925639128065 15.415316289918337">
// <Properties>
// <PathGeometry>
// <GeometryPathType PathOpen="false">
// <PathPointArray>
// <PathPointType Anchor="72 -324" LeftDirection="72 -324"
// RightDirection="72 -324"/>
test("IDML Spec Example 16: Rotation Changes the ItemTransform Attribute", () => {
  const rectTransform: Matrix = [
    0.8660254037844387, -0.5, 0.5, 0.8660254037844387, 158.46925639128065,
    15.415316289918337,
  ];

  const anchor = { x: 72, y: -324 };
  const result = transformPointThroughTransforms(
    [...IDML_SPEC_SPREAD_MATRIX, rectTransform],
    anchor.x,
    anchor.y
  );

  // Rounded values from manual calc
  expect(result.x).toBeCloseTo(58);
  expect(result.y).toBeCloseTo(94);
});

test("IDML Spec Example 17: Nested ItemTransforms (Group + Rectangle)", () => {
  const rectTransform: Matrix = [
    0.8660254037844387, -0.5, 0.5, 0.8660254037844387, 158.46925639128065,
    15.415316289918337,
  ];

  const groupTransform: Matrix = [
    0.8660254037844387, -0.5, 0.5, 0.8660254037844387, 158.46925639128065,
    15.415316289918337,
  ];

  const anchor = { x: 72, y: -324 };
  const result = transformPointThroughTransforms(
    [...IDML_SPEC_SPREAD_MATRIX, groupTransform, rectTransform],
    anchor.x,
    anchor.y
  );

  // Rounded values from manual calc
  expect(result.x).toBeCloseTo(58);
  expect(result.y).toBeCloseTo(121);
});
// test("multiplyItemTransforms should combine two matrices correctly", () => {
//   const m1: Matrix = [1, 0, 0, 1, 10, 20]; // Translate
//   const m2: Matrix = [2, 0, 0, 2, 0, 0]; // Scale x2
//   const combined = multiplyItemTransforms([m1, m2]);

//   expect(combined).toEqual([2, 0, 0, 2, 10, 20]);
// });

// test("transformPoint should apply matrix correctly", () => {
//   const matrix: Matrix = [1, 0, 0, 1, 5, -3]; // Move x by 5, y by -3
//   const result = transformPoint(matrix, 2, 3);
//   expect(result).toEqual({ x: 7, y: 0 });
// });

// test("transformPointThroughTransforms should apply nested transforms correctly", () => {
//   const transforms: Matrix[] = [
//     [1, 0, 0, 1, 10, 0], // Translate x by 10
//     [0.866, -0.5, 0.5, 0.866, 158.47, 15.41], // Rotate and translate
//   ];
//   const point = { x: 72, y: -324 };
//   const result = transformPointThroughTransforms(transforms, point.x, point.y);

//   // Expected results rounded from earlier calculation
//   expect(result.x).toBeCloseTo(392.822, 2);
//   expect(result.y).toBeCloseTo(-229.174, 2);
// });
