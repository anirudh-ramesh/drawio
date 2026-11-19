# Irasus Energy: Validate Diagram rules (Phase 4)

Run it from **Extras → Validate Diagram**. The report lists every problem;
click a problem to select that shape or wire. The check only reads the
diagram; it never changes it.

Code: `checkDiagram()` in `src/main/webapp/plugins/irasus-energy.js`.

| Rule | Checks | Level | Example file (`docs/irasus-examples/phase4/`) |
|---|---|---|---|
| V1 | A wire has a loose end (one end not connected) | Error | `V1-loose-wire.drawio` |
| V2 | AC port wired to a DC port | Error | `V2-ac-dc-mismatch.drawio` |
| V3 | Equipment not allowed on that port (e.g. Battery on a PV input), or two ports of the same device wired together | Error | `V3-wrong-equipment.drawio` |
| V4 | Single-phase and three-phase ports wired together | Error | `V4-phase-mismatch.drawio` |
| V5 | More wires on a port than its maximum | Error | `V5-too-many-wires.drawio` |
| V6 | The same two ports wired twice | Warning | `V6-duplicate-wire.drawio` |
| V7 | Inverter with no power source (Solar PV, Battery Pack, Grid or String Combiner) | Error | `V7-no-power-source.drawio` |
| V8 | Equipment not connected to anything | Warning | `V8-unconnected.drawio` |
| V9 | Irasus port wired to a shape that is not Irasus equipment | Warning | `V9-non-irasus-shape.drawio` |
| V10 | A device's ports do not match its settings (e.g. the file was edited by hand) | Error | `V10-settings-mismatch.drawio` |
| OLD | Wires between the original fixed-port shapes (older diagrams) are checked with the original rules | Error | `../R1-invalid.drawio` etc. |

`full-system-valid.drawio` passes with no problems.

## Port limits (maximum wires per port)

| Equipment | Port | Maximum |
|---|---|---|
| Hybrid Inverter | PV1…PVn | 1 |
| Hybrid Inverter | BAT1…BATn | 1 |
| Hybrid Inverter | GRID | 1 |
| Hybrid Inverter | LOAD | no limit |
| Solar PV | DC1…DCn | 1 |
| Battery Pack | DC | 1 |
| Grid | AC | 1 |
| AC Load | AC | 1 |

To change a limit, edit `max` for that port in the `CATALOG` block of the
plugin (`null` = no limit).

## In-between equipment (meters, contactor, bus bar)

These devices sit **in between** other equipment: a wire goes in and another
goes out. AC/DC must always match.

| Equipment | Ports | Settings |
|---|---|---|
| AC Meter | IN, OUT (AC) | Phase, max current |
| DC Meter | IN, OUT (DC) | Max voltage, max current |
| Contactor | LINE, LOAD (AC or DC, from its Type setting) | Type AC/DC, rated current, poles |
| Bus Bar | T1…Tn on the top edge (AC or DC, from its Type setting) | Type AC/DC, number of connection points (2–8), rated current |

Examples:

- Grid → AC Meter → Contactor (AC) → Inverter GRID ✅
- Battery → DC Meter → Inverter BAT1 ✅
- Solar PV → Bus Bar (DC) → Inverter PV1 ✅
- Grid → DC Meter ❌ (AC/DC mismatch)

Inverter ports accept these devices too (PV and BAT: DC Meter, Contactor,
Bus Bar; GRID and LOAD: AC Meter, Contactor, Bus Bar). V7 looks **through**
meters, contactors and bus bars to find a power source.

Changing a Contactor or Bus Bar between AC and DC while it has wires asks
first, and removes those wires if you continue.

## Related behaviour

- **While drawing (Phase 3):** wires that break V2 or V3 are refused
  immediately, including when the mouse is released next to a port dot
  instead of on it. A new wire that does not end on a port dot is removed. Validate Diagram also catches wires that were never checked
  while drawing (old files, copy-paste, imports).
- **Deleting equipment:** you are asked first; if you confirm, the wires on
  its ports are removed too, so no loose wire ends (V1) are left behind.
  Ctrl + Z restores everything in one step.
