import { type GradientColorStop } from "@cesdk/engine";

export type IDML = Record<string, Document>;

export type Gradient = {
  type:
    | "//ly.img.ubq/fill/gradient/linear"
    | "//ly.img.ubq/fill/gradient/radial"
    | "//ly.img.ubq/fill/gradient/conical";
  stops: GradientColorStop[];
};

export interface Vector2 {
  x: number;
  y: number;
}

export interface LogMessage {
  message: string;
  type: "error" | "warning" | "info";
}
