/*
 * Irasus Energy plugin for draw.io
 *
 * What this plugin does:
 *  1. Adds the "Irasus Energy" shapes: Hybrid Inverter, Solar PV,
 *     Battery Pack, Grid and AC Load.
 *  2. Every shape has small port dots. Wires connect to these dots.
 *  3. Double-click a shape to change its settings (for example the
 *     number of PV inputs). The port dots update automatically.
 *  4. Warns before you delete equipment that still has wires.
 *  5. Refuses wrong wires while you draw (for example AC to DC).
 *  6. Extras > Validate Diagram checks the whole drawing.
 *
 * The list of equipment and the port rules are in EQUIPMENT_LIST below.
 */
Draw.loadPlugin(function (ui) {
  'use strict';

  var graph = ui.editor.graph;
  var model = graph.getModel();


  // ===================================================================
  // PART 1: LOAD THE SHAPE DRAWINGS
  // The drawings are in stencils/irasus-energy.xml
  // ===================================================================

  var stencilFile = 'stencils/irasus-energy.xml';

  // Name in the XML file  ->  name used in draw.io
  var stencilNames = {
    'Hybrid Inverter': 'hybrid_inverter',
    'Battery Pack': 'battery_pack',
    'Solar PV': 'solar_pv',
    'Grid': 'grid',
    'AC Load': 'ac_load',
    'Hybrid Inverter Body': 'hybrid_inverter_body'
  };

  try {
    var xmlDoc = mxUtils.load(stencilFile).getXml();
    if (!xmlDoc || !xmlDoc.documentElement) {
      throw new Error('Stencil XML document is empty');
    }

    var shapeNodes = xmlDoc.documentElement.getElementsByTagName('shape');
    var loadedCount = 0;

    for (var i = 0; i < shapeNodes.length; i++) {
      var xmlName = shapeNodes[i].getAttribute('name');
      var drawioName = stencilNames[xmlName];
      if (drawioName) {
        mxStencilRegistry.addStencil('mxgraph.irasus.' + drawioName, new mxStencil(shapeNodes[i]));
        loadedCount = loadedCount + 1;
      }
    }

    if (loadedCount !== 6) {
      throw new Error('Expected 6 stencils, registered ' + loadedCount);
    }
  } catch (e) {
    ui.alert('Irasus stencils could not be loaded: ' + e.message);
    return;
  }


  // ===================================================================
  // PART 2: THE EQUIPMENT LIST
  //
  // For each equipment:
  //   title    - name shown to the user
  //   stencil  - which drawing to use
  //   w, h     - normal width and height
  //   defaults - settings a new shape starts with
  //   fields   - settings shown in the double-click window
  //   ports    - function that makes the list of ports from the settings
  //
  // Each port has:
  //   portId    - port name, for example PV1
  //   kind      - 'AC' or 'DC'
  //   direction - 'in', 'out' or 'both'
  //   side      - 'left', 'right', 'top' or 'bottom'
  //   accepts   - which equipment may connect to this port
  //   max       - most wires allowed on this port (null = no limit)
  // ===================================================================

  var PHASE_OPTIONS = [
    {value: '1', label: 'Single-phase'},
    {value: '3', label: 'Three-phase'}
  ];

  var EQUIPMENT_LIST = {

    hybrid_inverter: {
      title: 'Hybrid Inverter',
      stencil: 'hybrid_inverter_body',
      w: 160,
      h: 140,
      defaults: {phase: '1', pvInputs: 2, batteryInputs: 1, grid: true, load: true},
      fields: [
        {key: 'phase', label: 'Phase', type: 'select', options: PHASE_OPTIONS},
        {key: 'pvInputs', label: 'PV inputs', type: 'number', min: 1, max: 8},
        {key: 'batteryInputs', label: 'Battery inputs', type: 'number', min: 0, max: 4},
        {key: 'grid', label: 'Grid connection', type: 'checkbox'},
        {key: 'load', label: 'AC load connection', type: 'checkbox'}
      ],
      ports: function (settings) {
        var list = [];
        for (var n = 1; n <= settings.pvInputs; n++) {
          list.push({portId: 'PV' + n, kind: 'DC', direction: 'in', side: 'left',
            accepts: 'solar_pv,string_combiner', max: 1});
        }
        for (var b = 1; b <= settings.batteryInputs; b++) {
          list.push({portId: 'BAT' + b, kind: 'DC', direction: 'both', side: 'bottom',
            accepts: 'battery_pack', max: 1});
        }
        if (settings.grid) {
          list.push({portId: 'GRID', kind: 'AC', direction: 'both', side: 'right',
            accepts: 'grid', phase: settings.phase, max: 1});
        }
        if (settings.load) {
          list.push({portId: 'LOAD', kind: 'AC', direction: 'out', side: 'right',
            accepts: 'load', phase: settings.phase, max: null});
        }
        return list;
      }
    },

    solar_pv: {
      title: 'Solar PV',
      stencil: 'solar_pv',
      w: 110,
      h: 70,
      defaults: {strings: 1, modulesPerString: 10, moduleWatt: 550},
      fields: [
        {key: 'strings', label: 'Strings (DC outputs)', type: 'number', min: 1, max: 8},
        {key: 'modulesPerString', label: 'Modules per string', type: 'number', min: 1, max: 40},
        {key: 'moduleWatt', label: 'Module rating (W)', type: 'number', min: 50, max: 1000}
      ],
      ports: function (settings) {
        var list = [];
        for (var n = 1; n <= settings.strings; n++) {
          list.push({portId: 'DC' + n, kind: 'DC', direction: 'out', side: 'right',
            accepts: 'hybrid_inverter,string_combiner', max: 1});
        }
        return list;
      }
    },

    battery_pack: {
      title: 'Battery Pack',
      stencil: 'battery_pack',
      w: 120,
      h: 85,
      defaults: {nominalVoltage: 51.2, capacityKwh: 5},
      fields: [
        {key: 'nominalVoltage', label: 'Nominal voltage (V)', type: 'number', min: 12, max: 1000, step: 0.1},
        {key: 'capacityKwh', label: 'Capacity (kWh)', type: 'number', min: 0.1, max: 1000, step: 0.1}
      ],
      ports: function (settings) {
        return [{portId: 'DC', kind: 'DC', direction: 'both', side: 'top',
          accepts: 'hybrid_inverter', voltage: settings.nominalVoltage, max: 1}];
      }
    },

    grid: {
      title: 'Grid',
      stencil: 'grid',
      w: 110,
      h: 70,
      defaults: {phase: '1', voltage: 230},
      fields: [
        {key: 'phase', label: 'Phase', type: 'select', options: PHASE_OPTIONS},
        {key: 'voltage', label: 'Voltage (V)', type: 'number', min: 100, max: 1000}
      ],
      ports: function (settings) {
        return [{portId: 'AC', kind: 'AC', direction: 'both', side: 'left',
          accepts: 'hybrid_inverter', phase: settings.phase, voltage: settings.voltage, max: 1}];
      }
    },

    load: {
      title: 'AC Load',
      stencil: 'ac_load',
      w: 110,
      h: 70,
      defaults: {phase: '1', powerKw: 2},
      fields: [
        {key: 'phase', label: 'Phase', type: 'select', options: PHASE_OPTIONS},
        {key: 'powerKw', label: 'Power (kW)', type: 'number', min: 0.1, max: 1000, step: 0.1}
      ],
      ports: function (settings) {
        return [{portId: 'AC', kind: 'AC', direction: 'in', side: 'left',
          accepts: 'hybrid_inverter', phase: settings.phase, max: 1}];
      }
    }
  };

  // Names for equipment that is planned but not built yet
  var OTHER_TITLES = {string_combiner: 'String Combiner'};

  // Equipment that can power an inverter
  var POWER_SOURCES = ['solar_pv', 'battery_pack', 'grid', 'string_combiner'];

  var PORT_SIZE = 10;
  var DC_COLOR = '#FF0000';
  var AC_COLOR = '#E67E22';


  // ===================================================================
  // PART 3: SMALL HELPER FUNCTIONS
  // ===================================================================

  // Makes a draw.io data object with the given attributes
  function makeUserObject(attributes) {
    var obj = mxUtils.createXmlDocument().createElement('UserObject');
    for (var name in attributes) {
      if (attributes[name] != null) {
        obj.setAttribute(name, String(attributes[name]));
      }
    }
    return obj;
  }

  // Returns the equipment type of a shape (for example 'solar_pv'), or null
  function getEquipmentType(cell) {
    if (!cell || !cell.value || typeof cell.value !== 'object') {
      return null;
    }
    var type = cell.value.getAttribute('irasusType');
    if (EQUIPMENT_LIST[type]) {
      return type;
    }
    return null;
  }

  // True if the cell is one of our port dots
  function isIrasusPort(cell) {
    if (!cell) {
      return false;
    }
    return graph.getCellStyle(cell).irasusPort == '1';
  }

  // Returns the equipment for a clicked cell (the shape itself, or the shape a port belongs to)
  function getEquipmentOf(cell) {
    if (getEquipmentType(cell)) {
      return cell;
    }
    if (isIrasusPort(cell) && getEquipmentType(model.getParent(cell))) {
      return model.getParent(cell);
    }
    return null;
  }

  // Name of an equipment type, for messages
  function getTitle(type) {
    if (EQUIPMENT_LIST[type]) {
      return EQUIPMENT_LIST[type].title;
    }
    if (OTHER_TITLES[type]) {
      return OTHER_TITLES[type];
    }
    return type;
  }

  // Name of a port for messages, for example "Hybrid Inverter PV1"
  function getPortName(port) {
    var equipment = model.getParent(port);
    return getTitle(getEquipmentType(equipment)) + ' ' + port.value.getAttribute('portId');
  }

  // List of equipment types a port accepts
  function getAcceptedTypes(port) {
    var text = port.value.getAttribute('accepts') || '';
    var parts = text.split(',');
    var result = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== '') {
        result.push(parts[i]);
      }
    }
    return result;
  }


  // ===================================================================
  // PART 4: CREATE EQUIPMENT AND PORTS
  // ===================================================================

  // Gives each port its x, y position (0 to 1), spread evenly along its side
  function placePorts(portList) {
    var sides = {left: [], right: [], top: [], bottom: []};
    for (var i = 0; i < portList.length; i++) {
      sides[portList[i].side].push(portList[i]);
    }

    for (var side in sides) {
      var portsOnSide = sides[side];
      for (var j = 0; j < portsOnSide.length; j++) {
        var position = (j + 1) / (portsOnSide.length + 1);
        var port = portsOnSide[j];

        if (side === 'left') {
          port.x = 0;
          port.y = position;
        } else if (side === 'right') {
          port.x = 1;
          port.y = position;
        } else if (side === 'top') {
          port.x = position;
          port.y = 0;
        } else {
          port.x = position;
          port.y = 1;
        }
      }
    }
    return portList;
  }

  // Where the port label is shown, so it sits inside the shape
  var LABEL_POSITION = {
    left: 'labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=2;',
    right: 'labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;spacingRight=2;',
    top: 'labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;',
    bottom: 'labelPosition=center;verticalLabelPosition=top;align=center;verticalAlign=bottom;'
  };

  // The data stored on a port
  function makePortValue(port) {
    return makeUserObject({
      label: port.portId,
      irasusPort: '1',
      portId: port.portId,
      kind: port.kind,
      direction: port.direction,
      accepts: port.accepts,
      phase: port.phase,
      voltage: port.voltage
    });
  }

  // The position and size of a port (relative to its equipment)
  function makePortGeometry(port) {
    var geometry = new mxGeometry(port.x, port.y, PORT_SIZE, PORT_SIZE);
    geometry.relative = true;
    geometry.offset = new mxPoint(-PORT_SIZE / 2, -PORT_SIZE / 2);
    return geometry;
  }

  // How a port looks. hideLabel is true when the equipment has only one port.
  function makePortStyle(port, hideLabel) {
    var colors;
    if (port.kind === 'DC') {
      colors = 'fillColor=#C0392B;strokeColor=#7B241C;';
    } else {
      colors = 'fillColor=#E67E22;strokeColor=#935116;';
    }

    var style = 'ellipse;irasusPort=1;html=0;fontSize=9;fontColor=#16324F;' + colors +
      LABEL_POSITION[port.side] +
      'movable=0;resizable=0;rotatable=0;deletable=0;editable=0;points=[[0.5,0.5,0]];';

    if (hideLabel) {
      style = style + 'noLabel=1;';
    }
    return style;
  }

  function makePortCell(port, hideLabel) {
    var cell = new mxCell(makePortValue(port), makePortGeometry(port), makePortStyle(port, hideLabel));
    cell.vertex = true;
    return cell;
  }

  // Makes the shape bigger when a side has many ports
  function getBodySize(equipment, portList) {
    var count = {left: 0, right: 0, top: 0, bottom: 0};
    for (var i = 0; i < portList.length; i++) {
      count[portList[i].side] = count[portList[i].side] + 1;
    }
    var mostOnLeftOrRight = Math.max(count.left, count.right);
    var mostOnTopOrBottom = Math.max(count.top, count.bottom);

    return {
      w: Math.max(equipment.w, (mostOnTopOrBottom + 1) * 30),
      h: Math.max(equipment.h, (mostOnLeftOrRight + 1) * 40)
    };
  }

  // Settings are saved as text: true/false becomes '1'/'0'
  function settingsToText(settings) {
    var result = {};
    for (var key in settings) {
      if (settings[key] === true) {
        result[key] = '1';
      } else if (settings[key] === false) {
        result[key] = '0';
      } else {
        result[key] = settings[key];
      }
    }
    return result;
  }

  // Creates a new equipment shape with its settings and its ports
  function createEquipment(type, settings) {
    var equipment = EQUIPMENT_LIST[type];

    var data = settingsToText(settings);
    data.label = '';
    data.irasusType = type;
    data.irasusVersion = '1';

    var portList = placePorts(equipment.ports(settings));
    var size = getBodySize(equipment, portList);

    var style = 'shape=mxgraph.irasus.' + equipment.stencil + ';irasusEquipment=1;whiteSpace=wrap;html=0;' +
      'fillColor=#F2F8FD;strokeColor=#275D87;connectable=0;points=[];';

    var body = new mxCell(makeUserObject(data), new mxGeometry(0, 0, size.w, size.h), style);
    body.vertex = true;

    var onlyOnePort = (portList.length === 1);
    for (var i = 0; i < portList.length; i++) {
      body.insert(makePortCell(portList[i], onlyOnePort));
    }
    return body;
  }


  // ===================================================================
  // PART 5: READ AND CHANGE SETTINGS
  // ===================================================================

  // Reads the saved settings of a shape. Missing values use the defaults.
  function readSettings(body) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];
    var settings = {};

    for (var i = 0; i < equipment.fields.length; i++) {
      var field = equipment.fields[i];
      var saved = body.value.getAttribute(field.key);
      var defaultValue = equipment.defaults[field.key];

      if (saved == null) {
        settings[field.key] = defaultValue;
      } else if (field.type === 'checkbox') {
        settings[field.key] = (saved === '1');
      } else if (field.type === 'number') {
        if (saved === '' || isNaN(Number(saved))) {
          settings[field.key] = defaultValue;
        } else {
          settings[field.key] = Number(saved);
        }
      } else {
        settings[field.key] = saved;
      }
    }
    return settings;
  }

  // Returns the port dots of a shape:  { 'PV1': portCell, 'PV2': portCell, ... }
  function getPorts(body) {
    var result = {};
    for (var i = 0; i < model.getChildCount(body); i++) {
      var child = model.getChildAt(body, i);
      if (isIrasusPort(child)) {
        result[child.value.getAttribute('portId')] = child;
      }
    }
    return result;
  }

  // Saves new settings and updates the ports. This is one undo step.
  // Ports are matched by name: ports that stay keep their wires, new ports
  // are added, and ports that are no longer needed are removed with their wires.
  function applySettings(body, settings) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];
    var newPorts = placePorts(equipment.ports(settings));
    var oldPorts = getPorts(body);
    var onlyOnePort = (newPorts.length === 1);

    model.beginUpdate();
    try {
      // 1. Save the settings on the shape
      var data = body.value.cloneNode(true);
      var settingsText = settingsToText(settings);
      for (var key in settingsText) {
        data.setAttribute(key, String(settingsText[key]));
      }
      model.setValue(body, data);

      // 2. Make the shape bigger if needed
      var size = getBodySize(equipment, newPorts);
      var geometry = body.geometry.clone();
      geometry.width = Math.max(geometry.width, size.w);
      geometry.height = Math.max(geometry.height, size.h);
      model.setGeometry(body, geometry);

      // 3. Update existing ports and add new ones
      var keep = {};
      for (var i = 0; i < newPorts.length; i++) {
        var port = newPorts[i];
        keep[port.portId] = true;
        var existing = oldPorts[port.portId];

        if (existing) {
          model.setValue(existing, makePortValue(port));
          model.setGeometry(existing, makePortGeometry(port));
          model.setStyle(existing, makePortStyle(port, onlyOnePort));
        } else {
          model.add(body, makePortCell(port, onlyOnePort));
        }
      }

      // 4. Remove ports that are no longer needed (and their wires)
      for (var portId in oldPorts) {
        if (!keep[portId]) {
          var wires = model.getEdges(oldPorts[portId]).slice();
          for (var w = 0; w < wires.length; w++) {
            model.remove(wires[w]);
          }
          model.remove(oldPorts[portId]);
        }
      }
    } finally {
      model.endUpdate();
    }
  }

  // Names of ports that would be removed by the new settings but still have wires
  function getWiredPortsThatWillBeRemoved(body, settings) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];
    var newPorts = equipment.ports(settings);
    var stillNeeded = {};
    for (var i = 0; i < newPorts.length; i++) {
      stillNeeded[newPorts[i].portId] = true;
    }

    var oldPorts = getPorts(body);
    var result = [];
    for (var portId in oldPorts) {
      if (!stillNeeded[portId] && model.getEdgeCount(oldPorts[portId]) > 0) {
        result.push(portId);
      }
    }
    return result;
  }


  // ===================================================================
  // PART 6: THE SETTINGS WINDOW (opens on double-click)
  // ===================================================================

  function showSettingsWindow(body) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];
    var settings = readSettings(body);
    var inputs = {};

    var box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;height:100%;box-sizing:border-box;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:12px;';
    title.textContent = equipment.title + ' settings';
    box.appendChild(title);

    var form = document.createElement('div');
    form.style.cssText = 'flex:1;overflow:auto;';

    // One row for each setting
    for (var i = 0; i < equipment.fields.length; i++) {
      var field = equipment.fields[i];

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;margin-bottom:10px;';

      var label = document.createElement('label');
      label.style.cssText = 'width:170px;font-size:13px;';
      label.textContent = field.label;
      if (field.type === 'number' && field.step == null) {
        label.textContent = field.label + ' (' + field.min + '-' + field.max + ')';
      }
      row.appendChild(label);

      var input;
      if (field.type === 'select') {
        input = document.createElement('select');
        for (var o = 0; o < field.options.length; o++) {
          var option = document.createElement('option');
          option.value = field.options[o].value;
          option.textContent = field.options[o].label;
          input.appendChild(option);
        }
        input.value = settings[field.key];
      } else if (field.type === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = settings[field.key] ? true : false;
      } else {
        input = document.createElement('input');
        input.type = 'number';
        input.min = field.min;
        input.max = field.max;
        input.step = field.step || 1;
        input.value = settings[field.key];
        input.style.width = '90px';
      }

      input.id = 'irasus-' + field.key;
      label.htmlFor = input.id;
      inputs[field.key] = input;
      row.appendChild(input);
      form.appendChild(row);
    }
    box.appendChild(form);

    var errorText = document.createElement('div');
    errorText.style.cssText = 'color:#C0392B;font-size:12px;min-height:16px;margin-top:4px;';
    box.appendChild(errorText);

    // Reads the values from the window. Returns null if a value is wrong.
    function readInputs() {
      var newSettings = {};
      for (var i = 0; i < equipment.fields.length; i++) {
        var field = equipment.fields[i];
        var input = inputs[field.key];

        if (field.type === 'checkbox') {
          newSettings[field.key] = input.checked;
        } else if (field.type === 'number') {
          var number = Number(input.value);
          var mustBeWhole = (field.step == null);
          var wrong = input.value === '' || isNaN(number) ||
            (mustBeWhole && Math.floor(number) !== number) ||
            number < field.min || number > field.max;

          if (wrong) {
            var kindOfNumber = mustBeWhole ? 'a whole number ' : 'a number ';
            errorText.textContent = field.label + ' must be ' + kindOfNumber +
              'from ' + field.min + ' to ' + field.max + '.';
            input.focus();
            return null;
          }
          newSettings[field.key] = number;
        } else {
          newSettings[field.key] = input.value;
        }
      }
      return newSettings;
    }

    var buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:8px;';

    var cancelButton = mxUtils.button(mxResources.get('cancel'), function () {
      ui.hideDialog();
    });
    cancelButton.className = 'geBtn';

    var applyButton = mxUtils.button(mxResources.get('apply'), function () {
      var newSettings = readInputs();
      if (newSettings == null) {
        return;
      }
      ui.hideDialog();

      var lostPorts = getWiredPortsThatWillBeRemoved(body, newSettings);
      if (lostPorts.length > 0) {
        ui.confirm('These ports have wires connected and will be removed together with ' +
          'their wires: ' + lostPorts.join(', ') + '. Continue?', function () {
          applySettings(body, newSettings);
        });
      } else {
        applySettings(body, newSettings);
      }
    });
    applyButton.className = 'geBtn gePrimaryBtn';

    buttons.appendChild(cancelButton);
    buttons.appendChild(applyButton);
    box.appendChild(buttons);

    ui.showDialog(box, 380, 110 + equipment.fields.length * 38, true, true);
  }

  // Double-click on a shape (or on one of its ports) opens its settings
  graph.addListener(mxEvent.DOUBLE_CLICK, function (sender, evt) {
    var body = getEquipmentOf(evt.getProperty('cell'));
    if (body && graph.isEnabled() && !graph.isCellLocked(body)) {
      showSettingsWindow(body);
      evt.consume();
    }
  });


  // ===================================================================
  // PART 7: WARNING BEFORE DELETING EQUIPMENT THAT HAS WIRES
  // ===================================================================

  // True if the cell, or one of its parents, is in the list
  function isInList(cell, list) {
    while (cell != null) {
      if (list.indexOf(cell) >= 0) {
        return true;
      }
      cell = model.getParent(cell);
    }
    return false;
  }

  // Finds the wires that would lose their connection if these cells are removed.
  // Returns a list like: [{body: shape, portIds: ['PV1'], count: 1, wires: [...]}]
  function getWiresLostWhenRemoving(cells) {
    // 1. Find every equipment shape inside the selection
    var bodies = [];
    for (var i = 0; i < cells.length; i++) {
      var found = model.filterDescendants(function (cell) {
        return getEquipmentType(cell) != null;
      }, cells[i]);
      for (var f = 0; f < found.length; f++) {
        if (bodies.indexOf(found[f]) < 0) {
          bodies.push(found[f]);
        }
      }
    }

    // 2. For each shape, find wires that go to something that is NOT being removed
    var result = [];
    for (var b = 0; b < bodies.length; b++) {
      var ports = getPorts(bodies[b]);
      var portIds = [];
      var wires = [];

      for (var portId in ports) {
        var portWires = model.getEdges(ports[portId]);
        for (var w = 0; w < portWires.length; w++) {
          var wire = portWires[w];
          if (isInList(wire, cells)) {
            continue; // this wire is being removed anyway
          }
          var start = model.getTerminal(wire, true);
          var end = model.getTerminal(wire, false);
          var otherEnd = (start === ports[portId]) ? end : start;

          if (otherEnd == null || !isInList(otherEnd, cells)) {
            if (wires.indexOf(wire) < 0) {
              wires.push(wire);
            }
            if (portIds.indexOf(portId) < 0) {
              portIds.push(portId);
            }
          }
        }
      }

      if (wires.length > 0) {
        result.push({body: bodies[b], portIds: portIds, count: wires.length, wires: wires});
      }
    }
    return result;
  }

  // Adds the warning to a draw.io action (delete, deleteAll or cut)
  function addDeleteWarning(actionName) {
    var action = ui.actions.get(actionName);
    if (!action) {
      return;
    }
    var originalFunction = action.funct;

    action.funct = function () {
      var self = this;
      var args = arguments;
      var selected = graph.getDeletableCells(graph.getSelectionCells());
      var lost = getWiresLostWhenRemoving(selected);

      if (lost.length === 0) {
        return originalFunction.apply(self, args);
      }

      var lines = [];
      for (var i = 0; i < lost.length; i++) {
        lines.push(getTitle(getEquipmentType(lost[i].body)) + ': ' + lost[i].count +
          ' wire(s) on ' + lost[i].portIds.join(', '));
      }
      var verb = (actionName === 'cut') ? 'Cutting' : 'Deleting';

      ui.confirm('The selected equipment still has wires connected. ' + verb +
        ' it will also remove these wires: ' + lines.join('; ') + '. Continue?', function () {
        // Remove the wires and the equipment together (one undo step),
        // so no loose wire ends are left behind
        model.beginUpdate();
        try {
          for (var i = 0; i < lost.length; i++) {
            for (var w = 0; w < lost[i].wires.length; w++) {
              if (model.contains(lost[i].wires[w])) {
                model.remove(lost[i].wires[w]);
              }
            }
          }
          originalFunction.apply(self, args);
        } finally {
          model.endUpdate();
        }
      });
    };
  }

  addDeleteWarning('delete');
  addDeleteWarning('deleteAll');
  addDeleteWarning('cut');


  // ===================================================================
  // PART 8: PROTECT SETTINGS CHANGED WITH "EDIT DATA"
  //
  // If someone changes a setting with right-click > Edit Data:
  //  - a correct change updates the ports automatically
  //  - a wrong value, or a change that removes a wired port, is undone
  //  - port details cannot be changed by hand
  // ===================================================================

  // Checks the saved settings of a shape. Returns an error text, or null if all is fine.
  function findSettingProblem(body) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];

    for (var i = 0; i < equipment.fields.length; i++) {
      var field = equipment.fields[i];
      var saved = body.value.getAttribute(field.key);

      if (saved == null) {
        continue; // missing values use the default
      }

      if (field.type === 'checkbox') {
        if (saved !== '1' && saved !== '0') {
          return field.label + ' must be 1 or 0 (it is "' + saved + '")';
        }
      }

      if (field.type === 'select') {
        var allowed = [];
        for (var o = 0; o < field.options.length; o++) {
          allowed.push(field.options[o].value);
        }
        if (allowed.indexOf(saved) < 0) {
          return field.label + ' must be one of ' + allowed.join(', ') + ' (it is "' + saved + '")';
        }
      }

      if (field.type === 'number') {
        var number = Number(saved);
        var mustBeWhole = (field.step == null);
        var wrong = saved === '' || isNaN(number) ||
          (mustBeWhole && Math.floor(number) !== number) ||
          number < field.min || number > field.max;
        if (wrong) {
          var kindOfNumber = mustBeWhole ? 'a whole number' : 'a number';
          return field.label + ' must be ' + kindOfNumber + ' from ' + field.min + ' to ' +
            field.max + ' (it is "' + saved + '")';
        }
      }
    }
    return null;
  }

  // Compares a saved value with the expected one (both may be missing)
  function sameText(savedValue, expectedValue) {
    var a = savedValue || null;
    var b = (expectedValue != null) ? String(expectedValue) : null;
    return a === b;
  }

  // True if the port dots of a shape do not match its settings
  function portsDoNotMatchSettings(body) {
    var equipment = EQUIPMENT_LIST[getEquipmentType(body)];
    var expectedPorts = placePorts(equipment.ports(readSettings(body)));
    var actualPorts = getPorts(body);

    if (Object.keys(actualPorts).length !== expectedPorts.length) {
      return true;
    }

    for (var i = 0; i < expectedPorts.length; i++) {
      var expected = expectedPorts[i];
      var actual = actualPorts[expected.portId];
      if (!actual) {
        return true;
      }
      var data = actual.value;
      if (data.getAttribute('kind') !== expected.kind ||
          data.getAttribute('direction') !== expected.direction ||
          data.getAttribute('accepts') !== expected.accepts ||
          !sameText(data.getAttribute('phase'), expected.phase) ||
          !sameText(data.getAttribute('voltage'), expected.voltage)) {
        return true;
      }
    }
    return false;
  }

  var messagesToShow = [];

  function showMessagesLater() {
    if (messagesToShow.length === 0) {
      return;
    }
    var text = messagesToShow.join('\n\n');
    messagesToShow = [];
    window.setTimeout(function () {
      ui.alert(text);
    }, 0);
  }

  // This runs after every change, before it is saved in the undo history.
  // Corrections made here become part of the same undo step.
  // (Undo and redo do not run this, so it never repeats itself.)
  model.addListener(mxEvent.END_UPDATE, function (sender, evt) {
    if (!model.endingUpdate) {
      return; // only run once, for the outer change
    }
    var edit = evt.getProperty('edit');
    if (!edit || !edit.changes || edit.changes.length === 0) {
      return;
    }

    // Find shapes and ports whose data was changed
    var changedBodies = [];
    var changedPorts = [];
    var oldValues = {};

    for (var i = 0; i < edit.changes.length; i++) {
      var change = edit.changes[i];
      if (!(change instanceof mxValueChange) || !model.contains(change.cell)) {
        continue;
      }
      var cell = change.cell;
      if (oldValues[cell.id] === undefined) {
        oldValues[cell.id] = change.previous;
      }
      if (getEquipmentType(cell)) {
        if (changedBodies.indexOf(cell) < 0) {
          changedBodies.push(cell);
        }
      } else if (isIrasusPort(cell)) {
        if (changedPorts.indexOf(cell) < 0) {
          changedPorts.push(cell);
        }
      }
    }

    if (changedBodies.length === 0 && changedPorts.length === 0) {
      return;
    }

    model.beginUpdate();
    try {
      // A port was changed by hand: put the old data back
      for (var p = 0; p < changedPorts.length; p++) {
        var port = changedPorts[p];
        if (changedBodies.indexOf(model.getParent(port)) >= 0) {
          continue; // changed by the settings window, this is fine
        }
        var oldPortData = oldValues[port.id];
        var portName = (oldPortData && oldPortData.getAttribute) ? oldPortData.getAttribute('portId') : 'port';
        model.setValue(port, oldPortData);
        messagesToShow.push('Port details (' + portName + ') are set automatically from the ' +
          'equipment settings and cannot be edited directly. Double-click the equipment to change them.');
      }

      // A shape's settings were changed
      for (var b = 0; b < changedBodies.length; b++) {
        var body = changedBodies[b];
        var title = getTitle(getEquipmentType(body));

        var problem = findSettingProblem(body);
        if (problem) {
          model.setValue(body, oldValues[body.id]);
          messagesToShow.push(title + ': ' + problem + '. The change was undone.');
          continue;
        }

        if (!portsDoNotMatchSettings(body)) {
          continue; // ports are already correct (for example after the settings window)
        }

        var settings = readSettings(body);
        var lostPorts = getWiredPortsThatWillBeRemoved(body, settings);
        if (lostPorts.length > 0) {
          model.setValue(body, oldValues[body.id]);
          messagesToShow.push(title + ': this change would remove port(s) ' + lostPorts.join(', ') +
            ' which still have wires connected. The change was undone. Double-click the ' +
            'equipment to change its settings; you will be asked before wires are removed.');
          continue;
        }

        applySettings(body, settings); // update the ports in the same undo step
      }
    } finally {
      model.endUpdate();
    }
    showMessagesLater();
  });


  // ===================================================================
  // PART 9: WIRE RULES WHILE DRAWING, AND WIRE COLOURS
  // ===================================================================

  // Returns an error text if these two ports may NOT be connected, otherwise null
  function getConnectionError(source, target) {
    if (!isIrasusPort(source) || !isIrasusPort(target)) {
      return null; // not our ports, draw.io decides
    }

    var sourceEquipment = model.getParent(source);
    var targetEquipment = model.getParent(target);

    // Rule 1: not two ports of the same equipment
    if (sourceEquipment === targetEquipment) {
      return 'A wire cannot connect two ports of the same ' +
        getTitle(getEquipmentType(sourceEquipment)) + '.';
    }

    // Rule 2: AC only to AC, DC only to DC
    var sourceKind = source.value.getAttribute('kind');
    var targetKind = target.value.getAttribute('kind');
    if (sourceKind !== targetKind) {
      return 'AC/DC mismatch: ' + getPortName(source) + ' is ' + sourceKind + ' but ' +
        getPortName(target) + ' is ' + targetKind + '.';
    }

    // Rule 3: each port must accept the other equipment
    var checks = [
      {port: source, otherType: getEquipmentType(targetEquipment)},
      {port: target, otherType: getEquipmentType(sourceEquipment)}
    ];
    for (var i = 0; i < checks.length; i++) {
      var accepted = getAcceptedTypes(checks[i].port);
      if (accepted.indexOf(checks[i].otherType) < 0) {
        var names = [];
        for (var n = 0; n < accepted.length; n++) {
          names.push(getTitle(accepted[n]));
        }
        return getPortName(checks[i].port) + ' accepts ' + names.join(' or ') +
          ' only, not ' + getTitle(checks[i].otherType) + '.';
      }
    }
    return null;
  }

  // draw.io asks this function before it connects a wire.
  // If we return a text, the wire is refused and the text is shown.
  var drawioConnectionCheck = graph.getEdgeValidationError;
  graph.getEdgeValidationError = function (edge, source, target) {
    var error = drawioConnectionCheck.apply(this, arguments);
    if (error != null) {
      return error;
    }
    return getConnectionError(source, target);
  };

  // Show refused wires in a draw.io message box (not a browser popup)
  graph.validationAlert = function (message) {
    ui.alert(message);
  };

  // 'AC' or 'DC' if the wire connects two ports of the same kind, otherwise null
  function getWireKind(wire) {
    var start = model.getTerminal(wire, true);
    var end = model.getTerminal(wire, false);
    if (!isIrasusPort(start) || !isIrasusPort(end)) {
      return null;
    }
    var startKind = start.value.getAttribute('kind');
    var endKind = end.value.getAttribute('kind');
    if (startKind === endKind) {
      return startKind;
    }
    return null;
  }

  // Saves the wire type (AC/DC) on the wire and colours it: DC red, AC orange, no arrows
  function colorWire(wire) {
    var kind = getWireKind(wire);
    if (!kind) {
      return;
    }

    var data;
    if (wire.value == null || typeof wire.value !== 'object') {
      data = makeUserObject({label: wire.value || ''});
    } else {
      data = wire.value.cloneNode(true);
    }
    if (data.getAttribute('irasusWire') !== '1' || data.getAttribute('kind') !== kind) {
      data.setAttribute('irasusWire', '1');
      data.setAttribute('kind', kind);
      model.setValue(wire, data);
    }

    var oldStyle = wire.style || '';
    var newStyle = oldStyle;
    newStyle = mxUtils.setStyle(newStyle, 'strokeColor', kind === 'DC' ? DC_COLOR : AC_COLOR);
    newStyle = mxUtils.setStyle(newStyle, 'strokeWidth', '2');
    newStyle = mxUtils.setStyle(newStyle, 'endArrow', 'none');
    newStyle = mxUtils.setStyle(newStyle, 'startArrow', 'none');
    if (newStyle !== oldStyle) {
      model.setStyle(wire, newStyle);
    }
  }

  function isWire(cell) {
    return model.isEdge(cell);
  }

  // After each change: colour new wires, moved wires, and all wires of an opened file
  model.addListener(mxEvent.END_UPDATE, function (sender, evt) {
    if (!model.endingUpdate) {
      return;
    }
    var edit = evt.getProperty('edit');
    if (!edit || !edit.changes || edit.changes.length === 0) {
      return;
    }

    var wires = [];
    function addWire(cell) {
      if (cell && model.isEdge(cell) && model.contains(cell) && wires.indexOf(cell) < 0) {
        wires.push(cell);
      }
    }

    for (var i = 0; i < edit.changes.length; i++) {
      var change = edit.changes[i];
      var found, j;

      if (change instanceof mxRootChange) {
        // A file was opened: check all wires
        found = model.filterDescendants(isWire);
        for (j = 0; j < found.length; j++) {
          addWire(found[j]);
        }
      } else if (change instanceof mxTerminalChange) {
        // A wire end was moved
        addWire(change.cell);
      } else if (change instanceof mxChildChange && change.parent != null) {
        // Something was added (a wire, or a group containing wires)
        addWire(change.child);
        found = model.filterDescendants(isWire, change.child);
        for (j = 0; j < found.length; j++) {
          addWire(found[j]);
        }
      }
    }

    if (wires.length === 0) {
      return;
    }

    model.beginUpdate();
    try {
      for (var w = 0; w < wires.length; w++) {
        colorWire(wires[w]);
      }
    } finally {
      model.endUpdate();
    }
  });


  // ===================================================================
  // PART 10: CHECKS FOR OLD DIAGRAMS
  // Diagrams drawn with the first version of the shapes (fixed ports)
  // are still checked the old way.
  // ===================================================================

  var oldPortList = {
    hybrid_inverter: [
      {name: 'PV1', x: 0, y: 0.25, kind: 'DC', peer: 'solar_pv'},
      {name: 'PV2', x: 0, y: 0.75, kind: 'DC', peer: 'solar_pv'},
      {name: 'BATTERY', x: 0.5, y: 1, kind: 'DC', peer: 'battery_pack'},
      {name: 'GRID', x: 1, y: 0.25, kind: 'AC', peer: 'grid'},
      {name: 'LOAD', x: 1, y: 0.75, kind: 'AC', peer: 'load'}
    ],
    solar_pv: [{name: 'DC', x: 1, y: 0.5, kind: 'DC'}],
    battery_pack: [{name: 'DC', x: 0.5, y: 0, kind: 'DC'}],
    grid: [{name: 'AC', x: 0, y: 0.5, kind: 'AC'}],
    load: [{name: 'AC', x: 0, y: 0.5, kind: 'AC'}]
  };

  // Type of an old-style shape (saved in its style as equipmentType)
  function getOldType(cell) {
    if (!cell) {
      return null;
    }
    return graph.getCellStyle(cell).equipmentType || null;
  }

  function isClose(a, b) {
    return Math.abs(Number(a) - b) < 0.015;
  }

  // Finds the old-style port at the point where the wire is attached
  function getOldPort(wire, type, isStart) {
    var style = graph.getCellStyle(wire);
    var x = isStart ? style.exitX : style.entryX;
    var y = isStart ? style.exitY : style.entryY;
    if (x == null || y == null) {
      return null;
    }
    var ports = oldPortList[type] || [];
    for (var i = 0; i < ports.length; i++) {
      if (isClose(x, ports[i].x) && isClose(y, ports[i].y)) {
        return ports[i];
      }
    }
    return null;
  }

  // Returns a list of problems for one old-style wire
  function checkOldWire(wire) {
    var start = model.getTerminal(wire, true);
    var end = model.getTerminal(wire, false);
    if (!start || !end) {
      return ['Connector has a missing endpoint'];
    }

    var startType = getOldType(start);
    var endType = getOldType(end);
    if (!startType && !endType) {
      return [];
    }
    if (!startType || !endType) {
      return ['Irasus equipment connected to an untyped shape'];
    }
    if (!oldPortList[startType] || !oldPortList[endType]) {
      return ['Unknown equipment type'];
    }
    if (startType !== 'hybrid_inverter' && endType !== 'hybrid_inverter') {
      return ['This starter only permits connections involving a hybrid inverter'];
    }

    var startPort = getOldPort(wire, startType, true);
    var endPort = getOldPort(wire, endType, false);
    if (!startPort || !endPort) {
      return ['Connector must attach to named stencil ports (fixed connection points)'];
    }

    var problems = [];
    if (startPort.kind !== endPort.kind) {
      problems.push('AC/DC mismatch (' + startPort.kind + ' vs ' + endPort.kind + ')');
    }
    var inverterPort = (startType === 'hybrid_inverter') ? startPort : endPort;
    var otherType = (startType === 'hybrid_inverter') ? endType : startType;
    if (inverterPort.peer !== otherType) {
      problems.push('Inverter ' + inverterPort.name + ' accepts ' + inverterPort.peer + ', not ' + otherType);
    }
    return problems;
  }


  // ===================================================================
  // PART 11: VALIDATE DIAGRAM
  //
  // checkDiagram() only reads the drawing and returns a list of problems.
  // It never changes the drawing.
  //
  //   V1  loose wire end                          (error)
  //   V2  AC/DC mismatch                          (error)
  //   V3  equipment not allowed on this port      (error)
  //   V4  phase mismatch (single vs three-phase)  (error)
  //   V5  too many wires on one port              (error)
  //   V6  the same two ports wired twice          (warning)
  //   V7  inverter without a power source         (error)
  //   V8  equipment not connected to anything     (warning)
  //   V9  port wired to a non-Irasus shape        (warning)
  //   V10 ports do not match the settings         (error)
  //   OLD problems in old-style diagrams          (error)
  // ===================================================================

  // Finds the port rule (from EQUIPMENT_LIST) for a port dot
  function getPortRule(port) {
    var body = model.getParent(port);
    var type = getEquipmentType(body);
    if (!type) {
      return null;
    }
    var portId = port.value.getAttribute('portId');
    var rules = EQUIPMENT_LIST[type].ports(readSettings(body));
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].portId === portId) {
        return rules[i];
      }
    }
    return null;
  }

  // A readable name for any cell, for messages
  function describe(cell) {
    if (isIrasusPort(cell)) {
      return getPortName(cell);
    }
    if (getEquipmentType(cell)) {
      return getTitle(getEquipmentType(cell));
    }
    var label = graph.convertValueToString(cell);
    if (label && label.trim() !== '') {
      return '"' + label.trim() + '"';
    }
    return 'a shape';
  }

  function checkDiagram() {
    var problems = [];

    function addProblem(rule, level, cell, message) {
      problems.push({rule: rule, severity: level, cell: cell, msg: message});
    }

    // Collect all wires and all equipment in the drawing
    var everything = model.filterDescendants(function (cell) {
      return cell !== model.getRoot();
    });
    var wires = [];
    var bodies = [];
    for (var i = 0; i < everything.length; i++) {
      if (model.isEdge(everything[i])) {
        wires.push(everything[i]);
      } else if (model.isVertex(everything[i]) && getEquipmentType(everything[i])) {
        bodies.push(everything[i]);
      }
    }

    var wiresOnPort = {};    // port id -> {port, count}
    var connectedPairs = {}; // "portA|portB" -> number of wires
    var inverterHasSource = {};

    // ---- Check every wire ----
    for (var w = 0; w < wires.length; w++) {
      var wire = wires[w];
      var start = model.getTerminal(wire, true);
      var end = model.getTerminal(wire, false);
      var startIsPort = isIrasusPort(start);
      var endIsPort = isIrasusPort(end);

      // Wire not touching our ports: only old-style shapes are checked
      if (!startIsPort && !endIsPort) {
        if (getOldType(start) || getOldType(end)) {
          var oldProblems = checkOldWire(wire);
          for (var o = 0; o < oldProblems.length; o++) {
            addProblem('OLD', 'error', wire, oldProblems[o]);
          }
        }
        continue;
      }

      // V1: loose end
      if (!start || !end) {
        addProblem('V1', 'error', wire, 'Wire from ' + describe(startIsPort ? start : end) +
          ' has a loose end.');
        continue;
      }

      // V9: one end is not our equipment
      if (!startIsPort || !endIsPort) {
        addProblem('V9', 'warning', wire, describe(startIsPort ? start : end) + ' is wired to ' +
          describe(startIsPort ? end : start) + ', which is not Irasus equipment.');
        continue;
      }

      var startBody = model.getParent(start);
      var endBody = model.getParent(end);
      var startKind = start.value.getAttribute('kind');
      var endKind = end.value.getAttribute('kind');

      // V3: two ports of the same equipment
      if (startBody === endBody) {
        addProblem('V3', 'error', wire, 'Wire connects two ports of the same ' + describe(startBody) + '.');
        continue;
      }

      // V2: AC/DC mismatch
      if (startKind !== endKind) {
        addProblem('V2', 'error', wire, 'AC/DC mismatch: ' + describe(start) + ' is ' + startKind +
          ' but ' + describe(end) + ' is ' + endKind + '.');
        continue;
      }

      // V3: equipment not allowed on this port
      var error = getConnectionError(start, end);
      if (error) {
        addProblem('V3', 'error', wire, error);
        continue;
      }

      // V4: phase mismatch
      var startPhase = start.value.getAttribute('phase');
      var endPhase = end.value.getAttribute('phase');
      if (startPhase && endPhase && startPhase !== endPhase) {
        addProblem('V4', 'error', wire, 'Phase mismatch: ' + describe(start) + ' is ' + startPhase +
          '-phase but ' + describe(end) + ' is ' + endPhase + '-phase.');
      }

      // Count the wire on both ports (only correct wires are counted)
      var bothEnds = [start, end];
      for (var e = 0; e < bothEnds.length; e++) {
        var port = bothEnds[e];
        if (!wiresOnPort[port.id]) {
          wiresOnPort[port.id] = {port: port, count: 0};
        }
        wiresOnPort[port.id].count = wiresOnPort[port.id].count + 1;
      }

      // V6: the same two ports wired twice
      var pairName = [start.id, end.id].sort().join('|');
      connectedPairs[pairName] = (connectedPairs[pairName] || 0) + 1;
      if (connectedPairs[pairName] === 2) {
        addProblem('V6', 'warning', wire, 'Duplicate wire: ' + describe(start) + ' and ' +
          describe(end) + ' are already connected.');
      }

      // Remember which inverters have a power source (for V7)
      var startType = getEquipmentType(startBody);
      var endType = getEquipmentType(endBody);
      if (startType === 'hybrid_inverter' && POWER_SOURCES.indexOf(endType) >= 0) {
        inverterHasSource[startBody.id] = true;
      }
      if (endType === 'hybrid_inverter' && POWER_SOURCES.indexOf(startType) >= 0) {
        inverterHasSource[endBody.id] = true;
      }
    }

    // ---- V5: too many wires on one port ----
    for (var portId in wiresOnPort) {
      var used = wiresOnPort[portId];
      var rule = getPortRule(used.port);
      if (rule && rule.max != null && used.count > rule.max) {
        addProblem('V5', 'error', used.port, describe(used.port) + ' has ' + used.count +
          ' wires (maximum ' + rule.max + ').');
      }
    }

    // ---- Check every equipment shape ----
    for (var b = 0; b < bodies.length; b++) {
      var body = bodies[b];

      // V10: ports do not match settings
      if (portsDoNotMatchSettings(body)) {
        addProblem('V10', 'error', body, describe(body) + ': its ports do not match its settings. ' +
          'Double-click it and press Apply to repair.');
      }

      // Does this shape have any wire at all?
      var ports = getPorts(body);
      var hasWire = false;
      for (var id in ports) {
        if (model.getEdgeCount(ports[id]) > 0) {
          hasWire = true;
        }
      }

      if (!hasWire) {
        // V8: not connected
        addProblem('V8', 'warning', body, describe(body) + ' is not connected to anything.');
      } else if (getEquipmentType(body) === 'hybrid_inverter' && !inverterHasSource[body.id]) {
        // V7: inverter without power source
        addProblem('V7', 'error', body, describe(body) + ' has no power source: connect Solar PV, ' +
          'a Battery Pack or the Grid.');
      }
    }

    // Errors first, then warnings
    var errors = [];
    var warnings = [];
    for (var p = 0; p < problems.length; p++) {
      if (problems[p].severity === 'error') {
        errors.push(problems[p]);
      } else {
        warnings.push(problems[p]);
      }
    }
    return errors.concat(warnings);
  }

  // Shows the list of problems. Click a problem to select it in the drawing.
  function showReport(problems) {
    var errorCount = 0;
    for (var i = 0; i < problems.length; i++) {
      if (problems[i].severity === 'error') {
        errorCount = errorCount + 1;
      }
    }
    var warningCount = problems.length - errorCount;

    var box = document.createElement('div');
    box.style.cssText = 'display:flex;flex-direction:column;height:100%;box-sizing:border-box;';

    var title = document.createElement('div');
    title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:8px;';
    if (problems.length > 0) {
      title.textContent = 'Validation: ' + errorCount + ' error(s), ' + warningCount + ' warning(s)';
    } else {
      title.textContent = 'Validation passed';
    }
    box.appendChild(title);

    var list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow:auto;text-align:left;font-size:13px;line-height:1.4;';
    if (problems.length === 0) {
      list.textContent = 'No electrical problems found in this diagram.';
    }

    for (var j = 0; j < problems.length; j++) {
      list.appendChild(makeReportLine(problems[j]));
    }
    box.appendChild(list);

    var footer = document.createElement('div');
    footer.style.cssText = 'display:flex;justify-content:flex-end;margin-top:10px;';
    var okButton = mxUtils.button(mxResources.get('ok'), function () {
      ui.hideDialog();
    });
    okButton.className = 'geBtn gePrimaryBtn';
    footer.appendChild(okButton);
    box.appendChild(footer);

    var height = (problems.length > 0) ? 380 : 150;
    ui.showDialog(box, 560, height, true, true);
  }

  // One line in the report
  function makeReportLine(problem) {
    var color = (problem.severity === 'error') ? '#C0392B' : '#B9770E';
    var levelText = (problem.severity === 'error') ? 'Error' : 'Warning';

    var line = document.createElement('div');
    line.style.cssText = 'padding:6px 8px;margin-bottom:4px;border-left:4px solid ' + color + ';cursor:pointer;';
    line.title = 'Click to select it in the diagram';

    var tag = document.createElement('b');
    tag.style.color = color;
    tag.textContent = '[' + problem.rule + '] ' + levelText + ': ';
    line.appendChild(tag);
    line.appendChild(document.createTextNode(problem.msg));

    line.addEventListener('click', function () {
      if (model.contains(problem.cell)) {
        graph.setSelectionCell(problem.cell);
        graph.scrollCellToVisible(problem.cell);
      }
    });
    return line;
  }

  function validateDiagram() {
    var problems = checkDiagram();

    // Select all problem shapes and wires
    var cells = [];
    for (var i = 0; i < problems.length; i++) {
      if (model.contains(problems[i].cell)) {
        cells.push(problems[i].cell);
      }
    }
    if (cells.length > 0) {
      graph.setSelectionCells(cells);
    }
    showReport(problems);
  }


  // ===================================================================
  // PART 12: ADD THE PALETTE AND THE MENU ITEM
  // ===================================================================

  function addPalette() {
    if (!ui.sidebar) {
      return;
    }
    var entries = [];
    for (var type in EQUIPMENT_LIST) {
      entries.push(makePaletteEntry(type));
    }
    ui.sidebar.addPaletteFunctions('irasusEnergy', 'Irasus Energy', true, entries);
  }

  function makePaletteEntry(type) {
    var equipment = EQUIPMENT_LIST[type];
    var searchWords = 'irasus energy ' + type + ' ' + equipment.title.toLowerCase();
    return ui.sidebar.addEntry(searchWords, function () {
      var shape = createEquipment(type, equipment.defaults);
      return ui.sidebar.createVertexTemplateFromCells([shape], equipment.w, equipment.h,
        equipment.title, true, true);
    });
  }

  addPalette();

  mxResources.parse('irasusValidate=Validate Diagram');
  ui.actions.addAction('irasusValidate', validateDiagram);
  ui.menus.addPluginMenuItems('extras', ['-', 'irasusValidate']);
  if (ui.toolbar && typeof ui.toolbar.addItems === 'function') {
    ui.toolbar.addItems(['irasusValidate']);
  }

  // For testing in the browser console, for example: IrasusEquipment.checkDiagram()
  window.IrasusEquipment = {
    catalog: EQUIPMENT_LIST,
    createEquipment: createEquipment,
    readConfig: readSettings,
    applyConfig: applySettings,
    wiredPortsRemovedBy: getWiredPortsThatWillBeRemoved,
    showConfigDialog: showSettingsWindow,
    wiresLostByRemoving: getWiresLostWhenRemoving,
    connectionError: getConnectionError,
    checkDiagram: checkDiagram
  };
});
