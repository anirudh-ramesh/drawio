---
name: irasus-add-component
description: Add a new Irasus Energy component (shape + ports + settings) to the draw.io plugin, or add a new setting to an existing component. Use when asked to add equipment, a device variant, or a new configurable setting.
---

# Add an Irasus Energy component or setting

All Irasus code lives in two files. Do not edit draw.io core files.

| File | What it holds |
|---|---|
| `src/main/webapp/plugins/irasus-energy.js` | Equipment list, ports, settings window, wire rules, Validate Diagram |
| `src/main/webapp/stencils/irasus-energy.xml` | The drawings (shapes) |

Docs to keep in step: `docs/irasus-validation.md` (rules and port limits).

Write code in the same simple style as the rest of the plugin: `var`, plain
`for` loops, short comments that say what a block does, no clever shortcuts.

## First decide: new component, or new setting?

- **Same device, different rating or version** (single vs three-phase,
  2 vs 4 PV inputs) → add a **setting** to the existing
  component, not a second component. Go to *Part B*.
- **A different device** (string combiner, EV charger, isolator, CT) → add a
  **new component**. Go to *Part A*.

---

## Part A: add a new component

Example used below: an **Isolator** (`isolator`) that sits between two
DC or AC devices.

### A1. Draw the shape (`stencils/irasus-energy.xml`)

Add a `<shape>` inside `<shapes>`. Copy an existing one (AC Meter is a good
small example) and change the name and drawing:

```xml
<shape name="Isolator" w="100" h="70" aspect="variable" strokewidth="inherit">
  <connections/>
  <background><roundrect x="0" y="0" w="100" h="70" arcsize="8"/></background>
  <foreground>
    <fillstroke/><fontcolor color="#16324F"/><fontstyle style="1"/><fontsize size="11"/>
    <text str="ISOLATOR" x="50" y="35" align="center" valign="middle"/>
  </foreground>
</shape>
```

Keep `<connections/>` empty: wires connect to our port dots, not to the shape.

### A2. Register the drawing (PART 1 of the plugin)

1. Add the XML name to `stencilNames`:
   `'Isolator': 'isolator'`
2. Raise the count check by one: `if (loadedCount !== 10)` → `11`
   (both the number and the error message).

### A3. Add it to `EQUIPMENT_LIST` (PART 2)

Each entry has: `title`, `stencil`, `w`, `h`, `defaults`, `fields`, `ports`
(optional `fillColor`, `strokeColor`).

```js
isolator: {
  title: 'Isolator',
  stencil: 'isolator',
  w: 100,
  h: 70,
  defaults: {kind: 'DC', ratedCurrent: 32},
  fields: [
    {key: 'kind', label: 'Type', type: 'select', options: KIND_OPTIONS},
    {key: 'ratedCurrent', label: 'Rated current (A)', type: 'number', min: 1, max: 4000}
  ],
  ports: function (settings) {
    var accepts = (settings.kind === 'DC') ? ANY_DC : ANY_AC;
    return [
      {portId: 'IN', kind: settings.kind, direction: 'both', side: 'left', accepts: accepts, max: 1},
      {portId: 'OUT', kind: settings.kind, direction: 'both', side: 'right', accepts: accepts, max: 1}
    ];
  }
},
```

Rules for `fields`:
- `type` is `'number'` (with `min`, `max`, optional `step`), `'select'`
  (with `options: [{value, label}]`), or `'checkbox'`.
- Every `key` in `fields` must have a value in `defaults`.

Rules for `ports` (the function gets the current settings):
- `portId` must be unique on the shape (`PV1`, `PV2`, …). Wires are kept
  by `portId` when settings change, so never rename an existing portId.
- `kind`: `'AC'` or `'DC'`.
- `direction`: `'in'`, `'out'` or `'both'`.
- `side`: `'left'`, `'right'`, `'top'` or `'bottom'`.
- `accepts`: comma list of equipment types allowed on the other end.
- `max`: most wires on this port (`null` = no limit).
- Optional values shown on the port and used by checks: `phase`, `voltage`.

### A4. Let the other equipment accept it

`accepts` works both ways: a wire is allowed only if **each** end accepts
the other. So:

- **In-between device** (meter, contactor, bus bar, isolator): add the type
  to `IN_BETWEEN_AC` and/or `IN_BETWEEN_DC`, and to `PASS_THROUGH` (so the
  V7 "inverter has a power source" check can look through it).
- **Power source** (something that can power an inverter): add it to
  `POWER_SOURCES`.
- **End device** (only some ports may take it): add the type to the
  `accepts` of those ports only, e.g. the inverter's `LOAD` port.

### A5. Nothing else needed for

- **Palette**: built from `EQUIPMENT_LIST` automatically (PART 12).
- **Settings window**: built from `fields` automatically (PART 6).
- **Readable ids**: new shapes get `isolator_1`, ports `isolator_1_IN`.
- **Wire colours, delete warning, Edit Data guard**: work from the port data.

### A6. Docs

Add the component's ports and limits to the tables in
`docs/irasus-validation.md`.

---

## Part B: add a setting to an existing component

A setting that only changes a number on the shape (rated current, capacity)
needs steps B1 and B2 only. A setting that must also be **checked on the
wires** (like `phase`) needs all steps. In that case, copy every place
`phase` appears in the plugin.

### B1. Options list (only for a `select` setting)

In PART 2, next to `PHASE_OPTIONS`:

```js
var MY_SETTING_OPTIONS = [
  {value: 'a', label: 'Option A'},
  {value: 'b', label: 'Option B'}
];
```

### B2. Add the setting to each component that has it

Add the key to `defaults` and a line to `fields`:

```js
defaults: {..., mySetting: 'a'},
fields: [
  ...,
  {key: 'mySetting', label: 'My setting', type: 'select', options: MY_SETTING_OPTIONS}
]
```

The default is also used for old diagrams made before the setting existed
(`readSettings` fills a missing value from `defaults`), so pick the value
those diagrams should get.

### B3. Put it on the ports that need it

In the `ports` function, add `mySetting: settings.mySetting` to each port
the check applies to. Ports without the value are skipped by the check.

### B4. Save it on the port (PART 4, `makePortValue`)

Add one line next to `phase` and `voltage`:

```js
mySetting: port.mySetting
```

### B5. Include it in the "ports match settings" compare (PART 8)

Add one line next to the `phase` compare:

```js
!sameText(data.getAttribute('mySetting'), expected.mySetting) ||
```

This also updates old files on open (their ports get the new value).

### B6. Add a Validate Diagram rule (PART 11, after the V4 phase check)

Use the next free rule number:

```js
// Vn: mySetting mismatch
var startValue = start.value.getAttribute('mySetting');
var endValue = end.value.getAttribute('mySetting');
if (startValue && endValue && startValue !== endValue) {
  addProblem('Vn', 'error', wire, 'My setting mismatch: ' + describe(start) + ' is ' + startValue +
    ' but ' + describe(end) + ' is ' + endValue + '.');
}
```

Also add the rule to the list comment at the top of PART 11.

### B7. Optional: refuse the wire while drawing

To refuse the wire immediately (like AC to DC), add the same compare to
`getConnectionError` in PART 9 and return a message. If a problem in
Validate Diagram is enough, skip this.

### B8. Docs and example

- Add the rule to the table in `docs/irasus-validation.md`.
- Add an example file for it in `docs/irasus-examples/phase4/`.

---

## Test before committing

1. Syntax check (CMD, from the project folder):
   `node --check src\main\webapp\plugins\irasus-energy.js`
2. Start the server from `src\main\webapp`: `python -m http.server 8080`
3. Chrome: F12 → Network → tick **Disable cache** → **Ctrl+Shift+R**.
4. Check:
   - The new shape is in the **Irasus Energy** palette and draws correctly.
   - Double-click opens the settings with the new fields.
   - Changing a setting adds/removes ports and keeps existing wires.
   - Allowed wires connect and get coloured (DC red, AC orange); wrong
     wires are refused with a clear message.
   - **Extras → Validate Diagram** passes on
     `docs/irasus-examples/phase4/full-system-valid.drawio` and reports the
     new rule on its example file.
   - Save, reopen: settings, ports and wires are all still there.
   - Open an older diagram: it still opens and validates.
5. Console (F12) shows no red errors.

## Commit

```
git add src/main/webapp/plugins/irasus-energy.js src/main/webapp/stencils/irasus-energy.xml docs
git commit -m "add <component or setting name>"
git pull origin master
git push origin master
```
