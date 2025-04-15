export type Matrix = [number, number, number, number, number, number]; // [a, b, c, d, e, f]

// Each ItemTransform is a 6-number array:
// [a, b, c, d, e, f] ≡ [ [a, b, 0],
//                       [c, d, 0],
//                       [e, f, 1] ]
export function multiplyItemTransforms(transforms: Matrix[]): Matrix {
  return transforms.reduce((acc, current) => {
    const [a1, b1, c1, d1, e1, f1] = acc;
    const [a2, b2, c2, d2, e2, f2] = current;

    const a = a1 * a2 + b1 * c2;
    const b = a1 * b2 + b1 * d2;
    const c = c1 * a2 + d1 * c2;
    const d = c1 * b2 + d1 * d2;
    const e = e1 * a2 + f1 * c2 + e2;
    const f = e1 * b2 + f1 * d2 + f2;

    return [a, b, c, d, e, f];
  });
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
    x: a * x + b * y + e,
    y: c * x + d * y + f,
  };
}
