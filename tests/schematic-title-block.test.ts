import { expect, test } from "bun:test"
import { schematic_text } from "circuit-json"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { KicadToCircuitJsonConverter } from "../lib"

const convert = (paper = '(paper "A4")', titleBlock = "") => {
  const converter = new KicadToCircuitJsonConverter()
  converter.addFile(
    "document.kicad_sch",
    `(kicad_sch (version 20250114) (generator eeschema)
      (uuid 9c6b5f7c-8b32-4b54-b004-3e5857f4d422)
      ${paper} ${titleBlock} (lib_symbols))`,
  )
  converter.runUntilFinished()
  return converter
}

test("title-block fields survive the normal Circuit JSON output and render as schematic text", () => {
  const converter = convert(
    '(paper "A4")',
    `(title_block (title "ECC Push-Pull") (date "Sat 21 Mar 2015")
      (rev "0.1") (company "Example Company")
      (comment 1 "Open hardware") (comment 4 "Preserve comment indices"))`,
  )
  const circuitJson = JSON.parse(converter.getOutputString())
  expect(circuitJson).toEqual(converter.getOutput())
  const texts = converter
    .getOutput()
    .filter((element) => element.type === "schematic_text")
  expect(texts.map((element) => element.text)).toEqual([
    "Title: ECC Push-Pull",
    "Date: Sat 21 Mar 2015",
    "Rev: 0.1",
    "Example Company",
    "Open hardware",
    "Preserve comment indices",
  ])
  for (const text of texts) {
    expect(schematic_text.safeParse(text).success).toBe(true)
    expect(text.schematic_component_id).toBeUndefined()
  }
  // Sparse comment indices retain their worksheet rows, separated by 9 mm.
  expect(texts[5]!.position.y - texts[4]!.position.y).toBeCloseTo(9 / 15)
  const svg = convertCircuitJsonToSchematicSvg(circuitJson)
  for (const text of texts) expect(svg).toContain(text.text)
})

test.each([
  ['(paper "A4")', 297, 210],
  ['(paper "A5")', 210, 148],
  ['(paper "A4" portrait)', 210, 297],
  ['(paper "USLetter")', 279.4, 215.9],
  ['(paper "User" 320 180 portrait)', 180, 320],
] as const)(
  "places title-block text on the document paper %s",
  (paper, width, height) => {
    const texts = convert(paper, '(title_block (title "Document") (rev "1"))')
      .getOutput()
      .filter((element) => element.type === "schematic_text")
    expect(texts[0]!.position.x).toBeCloseTo((width - 119 - 105) / 15)
    expect(texts[0]!.position.y).toBeCloseTo(-(height - 20.7 - 148.5) / 15)
    expect(texts[0]!.font_size).toBeCloseTo(2 / 15)
    expect(texts[1]!.position.x).toBeCloseTo((width - 34 - 105) / 15)
    expect(texts[1]!.position.y).toBeCloseTo(-(height - 16.9 - 148.5) / 15)
  },
)

test("absent and empty title-block fields do not create placeholder text", () => {
  expect(convert().getOutput()).toEqual([])
  expect(
    convert(
      '(paper "A4")',
      '(title_block (title "") (date "") (rev "") (company "") (comment 1 ""))',
    ).getOutput(),
  ).toEqual([])
})
