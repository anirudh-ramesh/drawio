# AGENTS.md — Irasus Energy diagram editor (draw.io fork)

## Mission and repository

This repository is **`anirudh-ramesh/drawio`**, a fork of the draw.io / diagrams.net editor, developed on **`master`**. Its purpose is to evolve the standard editor into a domain-aware diagramming tool for electrical energy systems, initially solar PV, hybrid inverters, batteries, grid, loads, and string combiner boxes, and eventually BESS, EMS, meters, switchgear, and related equipment.

Agents should **work against this fork, not `jgraph/drawio`**, and use **`master`** as the active development branch unless the user explicitly changes this policy. Keep changes to upstream draw.io small and well isolated so upstream updates remain practical. Do not introduce JGF, React Flow, a backend, or another persistence format unless explicitly requested: the **current project is a native draw.io plugin and stencil customization**.

This document records both **implemented behavior** and **proposed design**. Do not mistake proposals for working features.

## Confirmed implementation (at time this file was written)

- `src/main/webapp/plugins/irasus-energy.js`: JavaScript plugin registered using `Draw.loadPlugin(function(ui) {...})`; loads the stencil XML, registers stencil shapes, creates the **Irasus Energy** sidebar palette, and adds the **Validate Diagram** action to the Extras menu and (when supported) the classic toolbar.
- `src/main/webapp/stencils/irasus-energy.xml`: XML stencil set with **Hybrid Inverter**, **Battery Pack**, **Solar PV**, **Grid**, and **AC Load**. Initial inverter connection constraints are `PV1`, `PV2`, `BATTERY`, `GRID`, and `LOAD`.
- `src/main/webapp/js/PostConfig.js`: presently includes a callback that requests `plugins/irasus-energy.js` via `mxscript`. Verify the actual startup order and once-only loading in the browser; do not assume the code is correct merely because it exists.
- `src/main/webapp/js/PreConfig.js`: `window.ALLOW_CUSTOM_PLUGINS = true` is set.
- `src/main/webapp/plugins/hello.js`: a separate example plugin, not part of the energy domain implementation.
- The current plugin identifies equipment using `equipmentType` in the cell **style** and attempts to identify stencil ports by comparing connector `entryX/entryY` and `exitX/exitY` coordinates to fixed stencil constraints. This is a **temporary prototype**, not the desired future port model.
- The current on-demand validator walks the selected diagram page and checks edges involving Irasus shapes. It accepts only links involving a hybrid inverter, validates AC/DC compatibility, and validates inverter-port peer equipment type. It does **not** yet model flexible port counts, string combiners, arbitrary equipment-to-equipment connections, electrical ratings, or complete graph semantics.
- Neither browser runtime correctness nor full validation behavior has been confirmed. An earlier version reported **`a.split is not a function`** during stencil loading, and subsequent patches were not demonstrated to eliminate it. Inspect the browser stack trace and actual draw.io API signatures before claiming a fix.

## Design principles

1. **Native draw.io application.** Use draw.io's existing canvas, editing, routing, sidebar, actions, and diagram XML; avoid creating another graph editor.
2. **Separate presentation, equipment metadata, and rules.** XML stencils specify how equipment looks. Persistent cell metadata specifies what an item/port *is*. JavaScript defines configuration UI, port lifecycle, and validation behavior.
3. **Prefer XML stencils for bodies**, not one static stencil per equipment variant. A hybrid inverter with 2 PV inputs and a variant with 6 PV inputs should share the same body/stencil when practical.
4. **Make ports first-class graph cells.** The proposed architecture represents each electrical interface as a *child vertex/port cell* of its parent equipment. Each port has a stable identity and properties, and electrical edges attach to the port cell rather than only to the equipment outline.
5. **Never infer electrical connectivity from proximity or display geometry.** A connector must have explicit, identifiable source/target ports. Named stencil constraints and `entryX/exitX` alone are not durable semantic port IDs.
6. **Keep validation on demand initially.** A user presses **Validate Diagram** to receive errors; do not silently prevent every edit until the workflow requires it. Interactive restrictions may be added later without replacing whole-diagram validation.
7. **No implicit safety certification.** Structural/electrical compatibility checks are engineering aids, not protection relays, interlocks, functional safety logic, electrical design approval, or a certified safety PLC.

## Proposed target architecture (not yet implemented)

```text
Irasus Energy plugin (native draw.io)
├── Equipment palette / registered XML body stencils
├── Configure Equipment action + dialog
│   ├── inverter model, phase count, PV inputs, battery inputs
│   └── combiner input/output counts and ratings
├── Equipment cell with persistent domain attributes
│   ├── child port cells with persistent, stable port_id values
│   └── edges connected directly to ports
├── Port reconciler
│   ├── preserve existing port identities and connections
│   ├── add/remove ports on configuration changes
│   └── reposition ports and optionally resize body
├── Rules / validation engine
│   ├── electrical compatibility and equipment/port role
│   ├── port direction, phases, limits and cardinality
│   └── relationship semantics when introduced
└── Validate Diagram action / user-facing issue report
```

Keep modules cohesive as the plugin grows, e.g. separate configuration/rules, model/port utilities, validation, and UI. These are architectural suggestions, not existing file paths. Avoid unnecessary refactoring of unrelated draw.io source.

## Equipment requirements and initial domain rules

### Hybrid inverter

A representative one-phase hybrid inverter has **2 PV inputs, 1 battery input, 1 grid connection, 1 load output**. Different inverter models must support configurable numbers of PV and battery inputs, as well as phase count and relevant ratings. Do not hardcode exactly five ports into domain validation.

| Port role | Electrical type | Typical peer | Notes |
| --- | --- | --- | --- |
| PV1, PV2, PVn | DC | Solar PV output / appropriate DC combiner output | PV-side input |
| BAT1, BAT2, BATn | DC | Battery pack/battery bus as explicitly allowed | Usually bidirectional |
| GRID | AC | Grid or applicable AC network node | Import/export possible |
| LOAD | AC | AC load/distribution node | Output in basic prototype |

Do not assume every inverter model has the same internal electrical architecture or ratings. Treat electrical ratings (voltage/current/power), phase compatibility, and direction as additional metadata and future checks, not as guaranteed solely by being DC/AC.

### Other equipment

- **Solar PV:** DC electrical output.
- **Battery pack:** DC interface, often bidirectional; multiple packs may be connected through an explicitly represented DC bus/switchgear where the topology requires it.
- **Grid:** AC interface; may be three-phase or single-phase depending on site.
- **Load:** AC in the *initial* palette/rules; future libraries may introduce DC loads as distinct types.
- **String combiner box:** configurable, potentially unknown at design time, number of **DC input ports** (e.g. 4, 8, 12, 16, 24 or another count) and one or more **DC output ports**. Each port must remain individually addressable. A combiner output is an allowable PV-side connection if the inverter model supports it.

Validate **both** electrical compatibility and *equipment/port-role compatibility*: two DC ports are not automatically a permitted pair (e.g. a battery must not connect to an inverter's PV input merely because both are DC).

### Future semantic relationships

Distinguish an electrical `CONNECTED_TO` edge from logical `CONTROLS`, `MEASURES`, `HAS_METER`, `HAS_PORT`, and `CONTAINS` relationships. Relationship rule sets may eventually include permitted source/target classes, directional semantics, min/max cardinalities, and cycle restrictions (especially `CONTAINS`). **The existing plugin does not implement this relationship engine**. Do not assume an mxGraph geometric parent/child relationship is itself a physical wire or logical command.

## Dynamic port design

**Preferred implementation:** parent equipment is an ordinary draw.io cell rendered with an XML stencil; each port is a child `mxCell` vertex with XML-backed custom attributes, e.g. `type=port`, `port_id=pv_1`, `role=pv_input`, `current_type=DC`, `direction=input`, and any relevant nominal/rated values. A port's identifier must be stable within its equipment even if it is repositioned.

- Build ports based on a persisted configuration (e.g. `pv_inputs=4`, `battery_inputs=2`, `phases=3` or `inputs=12`, `outputs=1` for a combiner).
- Use relative `mxGeometry` for child ports, plus offset for centering when appropriate. Test moving/resizing/grouping, save/reopen, and edge attachments.
- **Reconcile** existing ports by `port_id`, rather than deleting and recreating all of them on every configuration update.
- Increasing the configured count retains existing ports/connections and adds the missing ports. Decreasing it must detect any connections on removed ports and reject or explicitly confirm the destructive operation; never silently drop edges.
- Reposition on the left/right/bottom, allow enough space as port count grows, and prevent overlap. The exact presentation is changeable without changing the logical port identity.
- If a graphical connector can also attach to the body, ensure validation flags that as untyped/ambiguous, or intentionally disallow it for electrical relations.
- Persist metadata inside native draw.io's diagram data so reload, export/import, copy/paste, and undo/redo maintain consistent identity. Use the model's change transactions (`beginUpdate`/`endUpdate`) for coordinated edits.

## Validation action and reporting

The existing entry point is `ui.actions.addAction('irasusValidate', validate)` with an Extras menu item and classic-toolbar button when supported. Retain the visible **Validate Diagram** action as the first-class validation workflow.

Target behavior:
1. Traverse the **current page**, including nested equipment/groups; enumerate all relevant nodes, child ports, and edges.
2. Validate required metadata and unique port identities; detect missing/broken endpoints, equipment-body attachments, and unknown equipment/port types.
3. For electrical edges, enforce AC/DC compatibility, port roles, direction, phases, allowed peers, multiplicity/cardinality, and eventually configured voltage/current limits.
4. For non-electrical relationships (when added), dispatch to separate relationship rules.
5. Return deterministic, structured issues (`code`, `severity`, `cellId`, message, and relevant endpoint/port IDs); show **all** errors, not merely the first. Select/highlight the relevant cell in the UI.
6. Do not report a diagram as electrically safe merely because the supported checks passed.
7. Validate loaded/imported diagrams too; any interactive validation must complement, never replace, whole-diagram validation.

Starter acceptance cases:
- Solar PV output -> inverter PV input: allowed.
- Battery DC -> inverter BAT port: allowed.
- Grid AC -> inverter GRID port: allowed.
- AC load -> inverter LOAD port: allowed.
- Battery -> inverter PV port: rejected **even though both are DC**.
- Battery DC -> inverter GRID AC port: rejected.
- PV string outputs -> individual combiner inputs -> combiner output -> compatible inverter PV port: supported once combiner functionality is built.
- Combiner input count 6 -> 10: retain IN1..IN6 identities/connections and add IN7..IN10.
- Combiner input count 12 -> 8 with IN10 connected: detect and prevent silent data loss.
- Save and reopen: equipment configuration, child-port metadata, and edge terminals remain correct.

## Plugin deployment and debugging

**Distribution goal:** loading `irasus-energy.js` and its XML stencils automatically for **all users of the self-hosted fork**, not browser-by-browser through saved plugin preferences. The fork already has an attempted global loader in `PostConfig.js`. Verify whether `Draw.loadPlugin(... mxscript(...))` runs at the appropriate stage; prefer draw.io's supported global plugin configuration/initialization path after examining the current source, and avoid both duplicate initialization and missing callbacks.

Browser-specific `mxSettings.setPlugins(...); mxSettings.save()` persists plugin paths for that browser/origin and is suitable only for testing. It is **not** the deployment strategy. Remove stale `plugins/hello.js` or other user-saved paths when troubleshooting duplicate loads.

**Known stencil-loading issue:** earlier testing encountered `Irasus stencils could not be loaded: a.split is not a function`. Do not conclude this was fixed merely by replacing `mxUtils.parseXml(mxUtils.load(url).getXml())` with `mxUtils.load(url).getXml()`. Determine which call throws using browser console stack traces, log individual stencil names, and verify actual `mxStencil`, `mxStencilRegistry`, `Sidebar`, and `Toolbar` API signatures in this repository revision. Do not swallow error stacks behind an alert. Use Network tab to confirm the JS and XML files actually served, including mime types/path/caching.

**Potential loading trap:** `mxUtils.load(url).getXml()` returns an XML document, not an XML string. Avoid parsing an already-parsed document. A different API may require a *string*; verify rather than guessing. Do not treat shape XML definitions as a user's custom draw.io library format without an explicit adapter.

**Existing coordinate-based ports:** current plugin checks `entryX/Y` and `exitX/Y`; connector styles may vary and a stencil's named constraint does not necessarily persist as a semantic port ID. Treat this as prototype code. Migrate to child port terminals for dynamic models.

## Development workflow and tests

- Preferred branch: `master`. The user has explicitly selected it for active work. Commit targeted changes directly there unless they request a different workflow.
- Inspect existing APIs and nearby plugin examples before editing. Minimize upstream modifications and preserve attribution/licensing.
- For local static development, the web app resides at `src/main/webapp/`; for a quick smoke test one can serve that directory (e.g. `cd src/main/webapp && python3 -m http.server 8080`) and open the local editor, subject to build/runtime asset availability.
- After JavaScript changes, run at least `node --check src/main/webapp/plugins/irasus-energy.js` if Node is available. After XML changes, parse the stencil XML with a real XML parser.
- **Browser smoke test required** for claims about draw.io runtime compatibility: verify sidebar palette appears, shapes render and accept connections, action exists, validation reports expected cases, and save/reload preserves metadata.
- When dynamic ports are added, test model edits, undo/redo, serialization, copy/paste, group/ungroup, resize, and deletion of connected ports.
- Clearly distinguish **implemented**, **proposed**, and **tested** behavior in docs, commits, and reports.
- Keep docs updated when introducing new item types, port schema attributes, or relationship rules.

## Immediate priorities

1. Diagnose and fix the reported stencil-registration `a.split is not a function` runtime error using an actual browser stack trace and this fork's draw.io APIs.
2. Verify once-only, centrally configured plugin loading for every user of the self-hosted app; confirm the Validate Diagram menu/toolbar action.
3. Establish a reliable five-shape starter palette and click-to-validate workflow.
4. Introduce stable child-port cells, their persistence, and connection validation independent of attachment coordinates.
5. Implement a **Configure Equipment** dialog for hybrid inverter variants (PV count, battery count, phases) and a string combiner with arbitrary configured DC input count.
6. Add full graph validation/reporting and automated plus browser smoke tests.

This repository should remain useful as a standard draw.io editor while extending it with Irasus equipment semantics. Avoid coupling generic draw.io code to BESS-specific logic unless it is necessary and explicitly justified.
