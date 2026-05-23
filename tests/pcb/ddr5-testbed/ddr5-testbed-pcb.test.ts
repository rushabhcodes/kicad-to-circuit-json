import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { KicadToCircuitJsonConverter } from "../../../lib"
import { convertKicadPcbToSvgSnapshot } from "../../fixtures/svg-snapshot-test-utils"

test("kicad-to-circuit-json: DDR5 testbed SVG snapshot", () => {
  convertKicadPcbToSvgSnapshot({
    kicadPcbPath: "tests/assets/ddr5-testbed.kicad_pcb",
    kicadFileName: "ddr5-testbed.kicad_pcb",
    testPath: import.meta.path,
    snapshotName: "ddr5-testbed-circuit-json",
  })
})

test("kicad-to-circuit-json: DDR5 testbed includes footprint Edge.Cuts in board outline", () => {
  const converter = new KicadToCircuitJsonConverter()
  converter.addFile(
    "ddr5-testbed.kicad_pcb",
    readFileSync("tests/assets/ddr5-testbed.kicad_pcb", "utf-8"),
  )
  converter.runUntilFinished()

  const circuitJson = converter.getOutput()
  const board = circuitJson.find((el: any) => el.type === "pcb_board") as any

  expect(board).toBeDefined()
  expect(board.width).toBeCloseTo(69.6)
  expect(board.height).toBeCloseTo(30)
  expect(board.outline.length).toBeGreaterThan(100)
})
