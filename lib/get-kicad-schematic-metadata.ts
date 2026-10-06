import type { KicadSch } from "kicadts"

export interface KicadSchematicTitleBlockMetadata {
  title?: string
  date?: string
  revision?: string
  company?: string
  comments?: Array<{ index: number; text: string }>
}

export interface KicadSchematicPaperMetadata {
  name: string
  width: number
  height: number
  isPortrait: boolean
  customSize?: { width: number; height: number }
}

/** Document fields accepted by circuit-json-to-kicad's schematic options. */
export interface KicadSchematicMetadata {
  titleBlock?: KicadSchematicTitleBlockMetadata
  paperSize?: KicadSchematicPaperMetadata
}

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

export function getKicadSchematicMetadata(
  schematic: KicadSch,
): KicadSchematicMetadata {
  const metadata: KicadSchematicMetadata = {}
  const titleBlock = schematic.titleBlock
  if (titleBlock) {
    metadata.titleBlock = {
      title: titleBlock.title,
      date: titleBlock.date,
      revision: titleBlock.rev,
      company: titleBlock.company,
      comments: titleBlock.comments.map((comment) => ({
        index: comment.index,
        text: comment.value,
      })),
    }
  }

  const paper = schematic.paper
  if (paper) {
    const customSize = paper.customSize
    const dimensions = customSize ?? paperDimensions[paper.size ?? ""]
    if (dimensions) {
      metadata.paperSize = {
        name: customSize ? "User" : paper.size!,
        width: paper.isPortrait ? dimensions.height : dimensions.width,
        height: paper.isPortrait ? dimensions.width : dimensions.height,
        isPortrait: paper.isPortrait,
        ...(customSize ? { customSize: { ...customSize } } : {}),
      }
    }
  }

  return metadata
}
