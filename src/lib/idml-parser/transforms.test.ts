import { expect, test } from "bun:test";
import {
  getPageTransformMatrix,
  Matrix,
  multiplyItemTransforms,
  transformPoint,
} from "./transforms"; // Ensure this path and the functions exist and work correctly

// --- Basic Transformation Tests ---

test("multiplyItemTransforms: Identity", () => {
  const m1: Matrix = [1, 0, 0, 1, 0, 0];
  const combined = multiplyItemTransforms([m1, m1]);
  expect(combined).toEqual([1, 0, 0, 1, 0, 0]);
});

test("multiplyItemTransforms: Translate * Scale", () => {
  const translate: Matrix = [1, 0, 0, 1, 10, 20];
  const scale: Matrix = [2, 0, 0, 3, 0, 0];
  const combined = multiplyItemTransforms([translate, scale]);
  expect(combined).toEqual([2, 0, 0, 3, 10, 20]); // T*S
});

test("multiplyItemTransforms: Scale * Translate", () => {
  const translate: Matrix = [1, 0, 0, 1, 10, 20];
  const scale: Matrix = [2, 0, 0, 3, 0, 0];
  const combined = multiplyItemTransforms([scale, translate]);
  expect(combined).toEqual([2, 0, 0, 3, 20, 60]); // S*T
});

test("transformPoint: Translation", () => {
  const matrix: Matrix = [1, 0, 0, 1, 5, -3];
  const result = transformPoint(matrix, 2, 3);
  expect(result).toEqual({ x: 7, y: 0 });
});

test("transformPoint: Scaling", () => {
  const matrix: Matrix = [2, 0, 0, 3, 5, 5];
  const result = transformPoint(matrix, 10, 10);
  expect(result).toEqual({ x: 25, y: 35 });
});

test("transformPoint: Rotation", () => {
  const angle = Math.PI / 4; // 45 degrees
  const matrix: Matrix = [
    Math.cos(angle),
    -Math.sin(angle),
    Math.sin(angle),
    Math.cos(angle),
    0,
    0,
  ];
  const result = transformPoint(matrix, 1, 0);
  expect(result.x).toBeCloseTo(0.7071, 4);
  expect(result.y).toBeCloseTo(-0.7071, 4);
});

// <Page Self="u276" TabOrder="" AppliedMaster="ud5" OverrideList="" MasterPageTransform="1 0 0 1 0 0" Name="2" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 841.8897637780001 595.2755905509999" ItemTransform="1 0 0 1 -595.2755905509999 -420.94488188900004" AppliedAlternateLayout="ud4" LayoutRule="UseMaster" SnapshotBlendingMode="IgnoreLayoutSnapshots" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">
// <TextFrame Self="u277" ParentStory="u27a" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="x50y50w100h150" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" ItemLayer="ucb" Locked="false" LocalDisplaySetting="Default" GradientFillHiliteLength="0" GradientFillHiliteAngle="0" GradientStrokeHiliteLength="0" GradientStrokeHiliteAngle="0" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]" ItemTransform="1 0 0 1 -278.8188976376141 21.653543307850384" ParentInterfaceChangeCount="" TargetInterfaceChangeCount="" LastUpdatedInterfaceChangeCount="">
// <PathPointType Anchor="-265.95669291338584 -392.0984251968504" LeftDirection="-265.95669291338584 -392.0984251968504" RightDirection="-265.95669291338584 -392.0984251968504" />
// The rects have a stroke with a width of 1pt which is not accounted for inside the name.
test("transformPoint by test1.idml example: Page positioning", () => {
  const pageTransform: Matrix = [
    1, 0, 0, 1, -595.2755905509999, -420.94488188900004,
  ];
  const toPagePositionTransform = getPageTransformMatrix(pageTransform);
  const itemTransform: Matrix = [
    1, 0, 0, 1, -278.8188976376141, 21.653543307850384,
  ];
  const point = [-265.95669291338584, -392.0984251968504];
  const combinedTransform = multiplyItemTransforms([
    toPagePositionTransform,
    itemTransform,
  ]);
  const result = transformPoint(combinedTransform, point[0], point[1]);
  // x50y50w100h150
  expect(result.x).toBeCloseTo(50.5, 0);
  expect(result.y).toBeCloseTo(50.5, 0);
  // Note: The expected result is the same as the input point because the transformation is identity.
});

// <TextFrame Self="u127" ParentStory="u12a" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="x200y100w100h150r45" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" ItemLayer="ucb" Locked="false" LocalDisplaySetting="Default" GradientFillHiliteLength="0" GradientFillHiliteAngle="0" GradientStrokeHiliteLength="0" GradientStrokeHiliteAngle="0" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]" ItemTransform="0.7071067811865476 -0.7071067811865476 0.7071067811865476 0.7071067811865476 666.0223431914491 -231.74920760074417" ParentInterfaceChangeCount="" TargetInterfaceChangeCount="" LastUpdatedInterfaceChangeCount="">
// <PathPointType Anchor="-265.95669291338584 -392.0984251968504" LeftDirection="-265.95669291338584 -392.0984251968504" RightDirection="-265.95669291338584 -392.0984251968504" />
// ItemTransform="0.7071067811865476 -0.7071067811865476 0.7071067811865476 0.7071067811865476 666.0223431914491 -231.74920760074417"
// page size: w595.2755905509999, h841.8897637780001
test("transformPoint by test1.idml example: Rotated TextFrame positioning", () => {
  const pageTransform: Matrix = [1, 0, 0, 1, 0, -420.94488188900004];
  const toPagePositionTransform = getPageTransformMatrix(pageTransform);
  const itemTransform: Matrix = [
    0.7071067811865476, -0.7071067811865476, 0.7071067811865476,
    0.7071067811865476, 666.0223431914491, -231.74920760074417,
  ];
  const point = [-265.95669291338584, -392.0984251968504];
  const combinedTransform = multiplyItemTransforms([
    toPagePositionTransform,
    itemTransform,
  ]);
  const result = transformPoint(combinedTransform, point[0], point[1]);
  expect(result.x).toBeCloseTo(200.5, 0);
  expect(result.y).toBeCloseTo(100, 0);
});

// Now rotated groups
// <Page Self="ud3" TabOrder="" AppliedMaster="ud5" OverrideList="" MasterPageTransform="1 0 0 1 0 0" Name="1" AppliedTrapPreset="TrapPreset/$ID/kDefaultTrapStyleName" GeometricBounds="0 0 841.8897637780001 595.2755905509999" ItemTransform="1 0 0 1 0 -420.94488188900004" AppliedAlternateLayout="ud4" LayoutRule="UseMaster" SnapshotBlendingMode="IgnoreLayoutSnapshots" OptionalPage="false" GridStartingPoint="TopOutside" UseMasterGrid="true">
// <Group Self="u188" OverriddenPageItemProps="" Visible="true" Name="x200y400r-45" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" StrokeWeight="1" StrokeColor="Color/Black" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" ItemLayer="ucb" Locked="false" LocalDisplaySetting="Default" GradientFillHiliteLength="0" GradientFillHiliteAngle="0" GradientStrokeHiliteLength="0" GradientStrokeHiliteAngle="0" AppliedObjectStyle="ObjectStyle/$ID/[None]" ItemTransform="0.7071067811865476 0.7071067811865476 -0.7071067811865476 0.7071067811865476 92.51976925964478 -54.88600738595431" ParentInterfaceChangeCount="" TargetInterfaceChangeCount="" LastUpdatedInterfaceChangeCount="">
// One text frame inside the group is rotated 45 degrees via the group transform
// <TextFrame Self="u143" ParentStory="u146" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="x178y421w100h150r-45" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" LocalDisplaySetting="Default" GradientFillHiliteLength="0" GradientFillHiliteAngle="0" GradientStrokeHiliteLength="0" GradientStrokeHiliteAngle="0" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]" ItemTransform="1 0 0 1 366.45669291338584 371.6535433078504" ParentInterfaceChangeCount="" TargetInterfaceChangeCount="" LastUpdatedInterfaceChangeCount="">
// <PathPointType Anchor="-265.95669291338584 -392.0984251968504" LeftDirection="-265.95669291338584 -392.0984251968504" RightDirection="-265.95669291338584 -392.0984251968504" />

test("transformPoint by test1.idml example: Rotated Group positioning", () => {
  const pageTransform: Matrix = [1, 0, 0, 1, 0, -420.94488188900004];
  const toPagePositionTransform = getPageTransformMatrix(pageTransform);
  const groupTransform: Matrix = [
    0.7071067811865476, 0.7071067811865476, -0.7071067811865476,
    0.7071067811865476, 92.51976925964478, -54.88600738595431,
  ];
  const itemTransform: Matrix = [
    1, 0, 0, 1, 366.45669291338584, 371.6535433078504,
  ];
  const point = [-265.95669291338584, -392.0984251968504];
  const combinedTransform = multiplyItemTransforms([
    toPagePositionTransform,
    groupTransform,
    itemTransform,
  ]);
  const result = transformPoint(combinedTransform, point[0], point[1]);
  expect(result.x).toBeCloseTo(178, 0);
  expect(result.y).toBeCloseTo(422.5, 0);
});
// This is the second text frame inside the group, which is not rotated, countering the group transform
// <TextFrame Self="u15f" ParentStory="u162" PreviousTextFrame="n" NextTextFrame="n" ContentType="TextType" OverriddenPageItemProps="" Visible="true" Name="x250y500w100h150r0" HorizontalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" VerticalLayoutConstraints="FlexibleDimension FixedDimension FlexibleDimension" GradientFillStart="0 0" GradientFillLength="0" GradientFillAngle="0" GradientStrokeStart="0 0" GradientStrokeLength="0" GradientStrokeAngle="0" LocalDisplaySetting="Default" GradientFillHiliteLength="0" GradientFillHiliteAngle="0" GradientStrokeHiliteLength="0" GradientStrokeHiliteAngle="0" AppliedObjectStyle="ObjectStyle/$ID/[Normal Graphics Frame]" ItemTransform="0.7071067811865476 -0.7071067811865476 0.7071067811865476 0.7071067811865476 672.0883603694313 72.55101334758325" ParentInterfaceChangeCount="" TargetInterfaceChangeCount="" LastUpdatedInterfaceChangeCount="">
// <PathPointType Anchor="-265.95669291338584 -392.0984251968504" LeftDirection="-265.95669291338584 -392.0984251968504" RightDirection="-265.95669291338584 -392.0984251968504" />

test("transformPoint by test1.idml example: Non-rotated TextFrame inside a rotated group positioning", () => {
  const pageTransform: Matrix = [1, 0, 0, 1, 0, -420.94488188900004];
  const toPagePositionTransform = getPageTransformMatrix(pageTransform);
  const groupTransform: Matrix = [
    0.7071067811865476, 0.7071067811865476, -0.7071067811865476,
    0.7071067811865476, 92.51976925964478, -54.88600738595431,
  ];
  const itemTransform: Matrix = [
    0.7071067811865476, -0.7071067811865476, 0.7071067811865476,
    0.7071067811865476, 672.0883603694313, 72.55101334758325,
  ];
  const point = [-265.95669291338584, -392.0984251968504];
  const combinedTransform = multiplyItemTransforms([
    toPagePositionTransform,
    groupTransform,
    itemTransform,
  ]);
  const result = transformPoint(combinedTransform, point[0], point[1]);
  expect(result.x).toBeCloseTo(250.5, 0);
  expect(result.y).toBeCloseTo(500, 0);
  // Note: The expected result is the same as the input point because the transformation is identity.
});
