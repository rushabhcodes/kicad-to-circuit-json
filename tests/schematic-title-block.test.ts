import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { CircuitJsonToKicadSchConverter } from "circuit-json-to-kicad"
import { parseKicadSch } from "kicadts"
import { KicadToCircuitJsonConverter } from "../lib"
import { takeSchematicTitleBlockSnapshot } from "./fixtures/take-schematic-title-block-snapshot"
import "./fixtures/png-matcher"

const convert = (content: string) => {
  const converter = new KicadToCircuitJsonConverter()
  converter.addFile("document.kicad_sch", content)
  converter.runUntilFinished()
  return converter
}

const schematic = (paper = '(paper "A4")', titleBlock = "") =>
  `(kicad_sch (version 20250114) (generator eeschema)
    (uuid 9c6b5f7c-8b32-4b54-b004-3e5857f4d422)
    ${paper} ${titleBlock} (lib_symbols))`

test("a serialized import bundle retains title-block fields without the source file", () => {
  const converter = convert(
    schematic(
      '(paper "A4")',
      `(title_block (title "ECC Push-Pull") (date "Sat 21 Mar 2015")
        (rev "0.1") (company "Example Company")
        (comment 1 "Open hardware") (comment 4 "Preserve comment indices"))`,
    ),
  )
  const bundle = JSON.parse(JSON.stringify(converter.getOutputBundle()))
  expect(bundle.schematicMetadata.titleBlock).toEqual({
    title: "ECC Push-Pull",
    date: "Sat 21 Mar 2015",
    revision: "0.1",
    company: "Example Company",
    comments: [
      { index: 1, text: "Open hardware" },
      { index: 4, text: "Preserve comment indices" },
    ],
  })

  const exporter = new CircuitJsonToKicadSchConverter(
    bundle.circuitJson,
    bundle.schematicMetadata,
  )
  exporter.runUntilFinished()
  const titleBlock = parseKicadSch(exporter.getOutputString()).titleBlock!
  expect(titleBlock.title).toBe("ECC Push-Pull")
  expect(titleBlock.date).toBe("Sat 21 Mar 2015")
  expect(titleBlock.rev).toBe("0.1")
  expect(titleBlock.company).toBe("Example Company")
  expect(titleBlock.getComment(1)).toBe("Open hardware")
  expect(titleBlock.getComment(4)).toBe("Preserve comment indices")
  expect(titleBlock.getComment(2)).toBeUndefined()
  expect(converter.getOutputBundle().circuitJson).toEqual(converter.getOutput())
  expect(JSON.parse(converter.getOutputString())).toEqual(converter.getOutput())
})

test.each([
  ['(paper "A3")', "A3", 420, 297, false, undefined],
  ['(paper "A4" portrait)', "A4", 210, 297, true, undefined],
  ['(paper "USLetter")', "USLetter", 279.4, 215.9, false, undefined],
  [
    '(paper "User" 320 180 portrait)',
    "User",
    180,
    320,
    true,
    { width: 320, height: 180 },
  ],
] as const)("retains the document paper %s", (paper, name, width, height, isPortrait, customSize) => {
  const bundle = convert(schematic(paper)).getOutputBundle()
  expect(bundle.schematicMetadata?.paperSize).toEqual({
    name,
    width,
    height,
    isPortrait,
    ...(customSize ? { customSize } : {}),
  })
  const exporter = new CircuitJsonToKicadSchConverter(
    bundle.circuitJson,
    bundle.schematicMetadata,
  )
  exporter.runUntilFinished()
  const exportedPaper = parseKicadSch(exporter.getOutputString()).paper!
  expect(exportedPaper.isPortrait).toBe(isPortrait)
  if (customSize) expect(exportedPaper.customSize).toEqual(customSize)
  else expect(exportedPaper.size).toBe(name)
})

test("absent document metadata is not replaced with invented title fields", () => {
  const converter = new KicadToCircuitJsonConverter()
  expect(converter.getOutputBundle()).toEqual({ circuitJson: [] })
  const bundle = convert(schematic()).getOutputBundle()
  expect(bundle.schematicMetadata?.titleBlock).toBeUndefined()
  const exporter = new CircuitJsonToKicadSchConverter(
    bundle.circuitJson,
    bundle.schematicMetadata,
  )
  exporter.runUntilFinished()
  expect(parseKicadSch(exporter.getOutputString()).titleBlock).toBeUndefined()
})

test("document metadata returned to callers does not mutate the parsed source", () => {
  const converter = convert(
    schematic('(paper "User" 320 180)', '(title_block (comment 1 "Original"))'),
  )
  const bundle = converter.getOutputBundle()
  bundle.schematicMetadata!.titleBlock!.comments![0]!.text = "Changed"
  bundle.schematicMetadata!.paperSize!.customSize!.width = 1
  expect(
    converter.getOutputBundle().schematicMetadata?.titleBlock?.comments,
  ).toEqual([{ index: 1, text: "Original" }])
  expect(
    converter.getOutputBundle().schematicMetadata?.paperSize?.customSize?.width,
  ).toBe(320)
})

test("HSP USB LED title block survives a saved-bundle round trip", async () => {
  const sourcePath = new URL("./assets/hsp-usb-led.kicad_sch", import.meta.url)
  const converter = convert(readFileSync(sourcePath, "utf8"))
  const bundle = converter.getOutputBundle()
  expect(bundle.schematicMetadata?.titleBlock).toEqual({
    title: "LED with USB-C",
    date: "2026-02-04",
    revision: "v1.0.0",
    company: "NUS Hackers",
    comments: [
      { index: 1, text: "Hackerspace: Intro to PCB Design" },
      { index: 2, text: "Licensed under CERN-OHL-P-2.0" },
    ],
  })
  expect(bundle.schematicMetadata).toMatchSnapshot()
  await expect(
    takeSchematicTitleBlockSnapshot({
      bundle,
      sourceSchematicPath: fileURLToPath(sourcePath),
    }),
  ).toMatchPngSnapshot(import.meta.path, "hsp-usb-led-title-block")
}, 30_000)
