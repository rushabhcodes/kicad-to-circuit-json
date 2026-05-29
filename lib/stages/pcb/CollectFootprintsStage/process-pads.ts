import type { Footprint } from "kicadts"
import type { ConverterContext } from "../../../types"
import {
  getCopperSpanLayerRefsFromLayers,
  getLayerRefsFromLayers,
  getPcbCopperLayerRefs,
} from "../layer-mapping"
import {
  getGlobalPadPosition,
  getPadAt,
  getPadKicadPosition,
  getPadShape,
  getPadSize,
  getPadType,
} from "./pad-utils"
import { createNpthHole, createPlatedHole } from "./process-hole-pad"
import { createPcbPort, type PadPortInfo } from "./process-ports"
import { createSmdPad } from "./process-smd-pad"

/**
 * Processes all pads in a footprint and creates Circuit JSON pad elements
 */
export function processPads(
  ctx: ConverterContext,
  footprint: Footprint,
  componentId: string,
  kicadComponentPos: { x: number; y: number },
  componentRotation: number,
) {
  if (!ctx.k2cMatPcb) return

  const pads = footprint.fpPads || []
  const padArray = Array.isArray(pads) ? pads : [pads]

  for (const pad of padArray) {
    processPad({
      ctx,
      pad,
      componentId,
      kicadComponentPos,
      componentRotation,
    })
  }
}

/**
 * Processes a single pad and creates the appropriate Circuit JSON element (SMD, plated hole, or NPTH)
 */
export function processPad({
  ctx,
  pad,
  componentId,
  kicadComponentPos,
  componentRotation,
}: {
  ctx: ConverterContext
  pad: any
  componentId: string
  kicadComponentPos: { x: number; y: number }
  componentRotation: number
}): void {
  if (!ctx.k2cMatPcb) return

  const padAt = getPadAt(pad)
  const padType = getPadType(pad)
  const padShape = getPadShape(pad)
  const padKicadPos = getPadKicadPosition(
    kicadComponentPos,
    padAt,
    componentRotation,
  )
  const globalPos = getGlobalPadPosition(ctx, padKicadPos)
  const size = getPadSize(pad)
  const drill = pad.drill
  const mappedCopperLayers =
    padType === "thru_hole"
      ? getCopperSpanLayerRefsFromLayers(pad.layers || [], ctx.kicadPcb)
      : getLayerRefsFromLayers(pad.layers || [], ctx.kicadPcb)
  const copperLayers =
    mappedCopperLayers.length > 0
      ? mappedCopperLayers
      : padType === "thru_hole"
        ? getPcbCopperLayerRefs(ctx.kicadPcb)
        : []

  // Calculate total rotation
  const totalCcwRotationDegrees = padAt.angle || 0

  // Create pcb_port for this pad (if it has a pad number)
  const padNumber = pad.number?.toString()
  let pcbPortId: string | undefined
  let sourcePortId: string | undefined
  if (padNumber) {
    const padLayers =
      padType === "smd"
        ? copperLayers.slice(0, 1)
        : padType === "thru_hole"
          ? copperLayers
          : []

    const padPortInfo: PadPortInfo = {
      padNumber,
      padType,
      layers: padLayers,
      position: globalPos,
    }

    pcbPortId = createPcbPort({
      ctx,
      componentId,
      padInfo: padPortInfo,
    })

    if (pcbPortId) {
      sourcePortId = `${componentId}_port_${padNumber}`
    }
  }

  // Determine pad type and create appropriate CJ element
  if (padType === "smd") {
    if (copperLayers.length === 0) {
      return
    }

    createSmdPad({
      ctx,
      pad,
      componentId,
      pos: globalPos,
      size,
      shape: padShape,
      pcbPortId,
      padKicadPos,
      totalCcwRotationDegrees,
    })
  } else if (padType === "np_thru_hole") {
    createNpthHole(ctx, pad, componentId, globalPos, drill)
  } else {
    // thru_hole (plated)
    createPlatedHole(
      ctx,
      pad,
      componentId,
      globalPos,
      size,
      drill,
      padShape,
      copperLayers,
      totalCcwRotationDegrees,
      pcbPortId,
      sourcePortId,
    )
  }
}
