import { applyToPoint } from "transformation-matrix"
import type { ConverterContext } from "../../../types"
import type { PadPortInfo } from "./process-ports"

export type Point = { x: number; y: number }
export type Size = { x: number; y: number }

export function getPadAt(pad: any) {
  return pad.at || { x: 0, y: 0, angle: 0 }
}

export function getPadType(pad: any): PadPortInfo["padType"] {
  const padType = pad.padType || pad.type || "thru_hole"

  if (
    padType === "smd" ||
    padType === "thru_hole" ||
    padType === "np_thru_hole"
  ) {
    return padType
  }

  return "thru_hole"
}

export function getPadShape(pad: any): string {
  return pad.shape || "circle"
}

export function getPadSize(pad: any): Size {
  let sizeX = 1
  let sizeY = 1

  if (pad.size) {
    if (Array.isArray(pad.size)) {
      sizeX = pad.size[0] || 1
      sizeY = pad.size[1] || 1
    } else if (typeof pad.size === "object") {
      sizeX = pad.size._width || pad.size.x || 1
      sizeY = pad.size._height || pad.size.y || 1
    }
  }

  return { x: sizeX, y: sizeY }
}

export function getPadRoundRectRadius(
  pad: any,
  size: Size,
): number | undefined {
  const roundrectRatio = pad._sxRoundrectRatio?.value ?? pad.roundrect_rratio
  if (roundrectRatio === undefined) return undefined

  const minDimension = Math.min(size.x, size.y)
  return (minDimension * roundrectRatio) / 2
}

export function rotatePadOffset(
  padAt: { x: number; y: number },
  componentRotation: number,
): Point {
  const rotationRad = (-componentRotation * Math.PI) / 180

  return {
    x: padAt.x * Math.cos(rotationRad) - padAt.y * Math.sin(rotationRad),
    y: padAt.x * Math.sin(rotationRad) + padAt.y * Math.cos(rotationRad),
  }
}

export function getPadKicadPosition(
  kicadComponentPos: Point,
  padAt: { x: number; y: number },
  componentRotation: number,
): Point {
  const rotatedPadOffset = rotatePadOffset(padAt, componentRotation)
  return {
    x: kicadComponentPos.x + rotatedPadOffset.x,
    y: kicadComponentPos.y + rotatedPadOffset.y,
  }
}

export function getGlobalPadPosition(
  ctx: ConverterContext,
  padKicadPos: Point,
): Point {
  return applyToPoint(ctx.k2cMatPcb!, padKicadPos)
}

export function normalizeRotationDegrees(
  rotationDegrees: number | undefined,
): number {
  if (!rotationDegrees) return 0

  const normalized = rotationDegrees % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function getRightAngleTurns(rotationDegrees: number): number | null {
  const quarterTurns = rotationDegrees / 90

  if (Math.abs(quarterTurns - Math.round(quarterTurns)) > 1e-9) {
    return null
  }

  return Math.round(quarterTurns)
}
