import { expect } from "bun:test"
import { CircuitJsonToKicadSchConverter } from "circuit-json-to-kicad"
import { parseKicadSch } from "kicadts"
import sharp from "sharp"
import type { KicadCircuitJsonBundle } from "../../lib"
import { takeKicadSnapshot } from "./take-kicad-snapshot"

/** Exports only the saved bundle; source data is used solely for the comparison image. */
export async function takeSchematicTitleBlockSnapshot({
  bundle,
  sourceSchematicPath,
  sourceSvg,
}: {
  bundle: KicadCircuitJsonBundle
  sourceSchematicPath: string
  sourceSvg?: Buffer
}): Promise<Buffer> {
  const savedBundle: KicadCircuitJsonBundle = JSON.parse(JSON.stringify(bundle))
  const converter = new CircuitJsonToKicadSchConverter(
    savedBundle.circuitJson,
    savedBundle.schematicMetadata,
  )
  converter.runUntilFinished()
  const output = converter.getOutputString()
  const titleBlock = parseKicadSch(output).titleBlock
  const expected = savedBundle.schematicMetadata?.titleBlock
  if (!expected) throw new Error("Expected saved title-block metadata")
  expect({
    title: titleBlock?.title,
    date: titleBlock?.date,
    revision: titleBlock?.rev,
    company: titleBlock?.company,
    comments: titleBlock?.comments.map((comment) => ({
      index: comment.index,
      text: comment.value,
    })),
  }).toEqual({
    title: expected.title,
    date: expected.date,
    revision: expected.revision,
    company: expected.company,
    comments: expected.comments,
  })

  const converted = await takeKicadSnapshot({
    kicadFileContent: output,
    kicadFileType: "sch",
    generatePng: false,
  })
  const convertedSvg = Object.values(converted.generatedFileContent)[0]!
  const originalSvg =
    sourceSvg ??
    Object.values(
      (
        await takeKicadSnapshot({
          kicadFilePath: sourceSchematicPath,
          kicadFileType: "sch",
          generatePng: false,
        })
      ).generatedFileContent,
    )[0]!

  const panelWidth = 760
  const panelHeight = 430
  const panels = [originalSvg, convertedSvg].map((buffer, index) => {
    const svg = buffer.toString("utf8")
    const viewBox = svg.match(
      /viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/,
    )
    if (!viewBox) throw new Error("Expected native KiCad SVG page dimensions")
    const x = Number(viewBox[1]) + Number(viewBox[3]) - 122
    const y = Number(viewBox[2]) + Number(viewBox[4]) - 72
    const body = svg
      .replace(/^[\s\S]*?<svg\b[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
    const label = index === 0 ? "Source title block" : "Round-trip title block"
    return `<g transform="translate(${index * panelWidth} 40)">
      <text x="12" y="-12" font-family="sans-serif" font-size="22">${label}</text>
      <svg width="${panelWidth}" height="${panelHeight}" viewBox="${x} ${y} 114 64">${body}</svg>
    </g>`
  })
  return sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth * 2}" height="${panelHeight + 40}">
      <rect width="100%" height="100%" fill="white"/>
      ${panels.join("")}
    </svg>`),
  )
    .png()
    .toBuffer()
}
