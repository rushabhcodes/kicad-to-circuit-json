import { applyToPoint } from "transformation-matrix"
import type { ConverterContext } from "../../types"

const paperDimensions: Record<string, { width: number; height: number }> = {
  A0: { width: 1189, height: 841 },
  A1: { width: 841, height: 594 },
  A2: { width: 594, height: 420 },
  A3: { width: 420, height: 297 },
  A4: { width: 297, height: 210 },
  A5: { width: 210, height: 148 },
  A: { width: 279.4, height: 215.9 },
  B: { width: 431.8, height: 279.4 },
  C: { width: 558.8, height: 431.8 },
  D: { width: 863.6, height: 558.8 },
  E: { width: 1117.6, height: 863.6 },
  USLetter: { width: 279.4, height: 215.9 },
  USLegal: { width: 355.6, height: 215.9 },
  USLedger: { width: 431.8, height: 279.4 },
}

/** Render document fields using KiCad's default drawing-sheet text positions. */
export function emitSchematicTitleBlock(ctx: ConverterContext) {
  const { kicadSch, k2cMatSch } = ctx
  const titleBlock = kicadSch?.titleBlock
  if (!titleBlock || !k2cMatSch) return

  const paper = kicadSch.paper
  const dimensions =
    paper?.customSize ??
    paperDimensions[paper?.size ?? "A4"] ??
    paperDimensions.A4!
  const width = paper?.isPortrait ? dimensions.height : dimensions.width
  const height = paper?.isPortrait ? dimensions.width : dimensions.height

  // The default worksheet has 10 mm margins; offsets are measured inward
  // from its bottom-right corner, as in pagelayout_default.kicad_wks.
  const insertText = (
    value: string | undefined,
    offsetX: number,
    offsetY: number,
    prefix = "",
    fontSize = 1.5,
  ) => {
    if (!value) return
    ctx.db.schematic_text.insert({
      text: `${prefix}${value}`,
      position: applyToPoint(k2cMatSch, {
        x: width - 10 - offsetX,
        y: height - 10 - offsetY,
      }),
      font_size: fontSize * Math.abs(k2cMatSch.a),
      rotation: 0,
      anchor: "bottom_left",
      color: "rgb(132, 0, 0)",
    })
  }

  insertText(titleBlock.title, 109, 10.7, "Title: ", 2)
  insertText(titleBlock.date, 87, 6.9, "Date: ")
  insertText(titleBlock.rev, 24, 6.9, "Rev: ")
  insertText(titleBlock.company, 109, 20)
  for (const comment of titleBlock.comments) {
    insertText(comment.value, 109, 20 + comment.index * 3)
  }
}
