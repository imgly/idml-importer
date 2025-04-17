export type Matrix = [number, number, number, number, number, number]; // [a, b, c, d, e, f]

// Each ItemTransform is a 6-number array:
// [a, b, c, d, e, f] ≡ [ [a, b, 0],
//                       [c, d, 0],
//                       [e, f, 1] ]
// Corrected multiplyItemTransforms (Standard M1 * M2)
export function multiplyItemTransforms(transforms: Matrix[]): Matrix {
  return transforms.reduce(
    (acc, current) => {
      const [a1, b1, c1, d1, e1, f1] = acc; // Represents M1 = [[a1, c1, e1], [b1, d1, f1], [0,0,1]]
      const [a2, b2, c2, d2, e2, f2] = current; // Represents M2 = [[a2, c2, e2], [b2, d2, f2], [0,0,1]]

      // M_result = M1 * M2
      const a = a1 * a2 + c1 * b2;
      const b = b1 * a2 + d1 * b2;
      const c = a1 * c2 + c1 * d2;
      const d = b1 * c2 + d1 * d2;
      const e = a1 * e2 + c1 * f2 + e1;
      const f = b1 * e2 + d1 * f2 + f1;

      // Result array [a, b, c, d, e, f] representing M_result = [[a, c, e], [b, d, f], [0,0,1]]
      return [a, b, c, d, e, f];
    },
    [1, 0, 0, 1, 0, 0] // Identity matrix
  );
}

export function transformPointThroughTransforms(
  transforms: Matrix[],
  x: number,
  y: number
) {
  const combined = multiplyItemTransforms(transforms);
  return transformPoint(combined, x, y);
}

export function transformPoint(
  matrix: Matrix,
  x: number,
  y: number
): { x: number; y: number } {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * x + c * y + e, // Corrected: c * y instead of b * y
    y: b * x + d * y + f, // Corrected: b * x instead of c * x
  };
}

export function getPageTransformMatrix(itemTransform: Matrix): Matrix {
  // we assume only translation is applied to pages
  return [1, 0, 0, 1, -itemTransform[4], -itemTransform[5]];
}

export function toPagePosition(
  pageItemTransform: Matrix,
  { x, y }: { x: number; y: number } // The point to transform
) {
  return {
    x: x - pageItemTransform[4],
    y: y - pageItemTransform[5],
  };
}
