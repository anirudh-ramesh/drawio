/* Irasus Energy: stencil palette and on-demand connection validation.
 * Designed for self-hosted draw.io (classic editor). No JGF dependency.
 */
Draw.loadPlugin(function (ui) {
  'use strict';
  var graph = ui.editor.graph;
  var stencilUrl = 'stencils/irasus-energy.xml';
  try {
    // getXml() already returns an XML Document; do not call parseXml() on it.
    var doc = mxUtils.load(stencilUrl).getXml();
    if (!doc || !doc.documentElement) {
      throw new Error('Stencil XML document is empty');
    }
    var shapeNodes = doc.documentElement.getElementsByTagName('shape');
    var shapeNames = {
      'Hybrid Inverter': 'hybrid_inverter',
      'Battery Pack': 'battery_pack',
      'Solar PV': 'solar_pv',
      'Grid': 'grid',
      'AC Load': 'ac_load'
    };
    var registered = 0;
    for (var i = 0; i < shapeNodes.length; i++) {
      var node = shapeNodes[i];
      var name = shapeNames[node.getAttribute('name')];
      if (name) {
        mxStencilRegistry.addStencil('mxgraph.irasus.' + name, new mxStencil(node));
        registered++;
      }
    }
    if (registered !== 5) {
      throw new Error('Expected 5 stencils, registered ' + registered);
    }
    // Plain body for the configurable inverter (ports are child cells, not stencil constraints)
    var bodyRegistered = false;
    for (var j = 0; j < shapeNodes.length; j++) {
      if (shapeNodes[j].getAttribute('name') === 'Hybrid Inverter Body') {
        mxStencilRegistry.addStencil('mxgraph.irasus.hybrid_inverter_body', new mxStencil(shapeNodes[j]));
        bodyRegistered = true;
      }
    }
    if (!bodyRegistered) {
      throw new Error('Stencil "Hybrid Inverter Body" not found in ' + stencilUrl);
    }
  } catch (e) {
    ui.alert('Irasus stencils could not be loaded: ' + e.message);
    return;
  }

  var specs = {
    hybrid_inverter: {shape:'hybrid_inverter', title:'Hybrid Inverter', w:160, h:120},
    solar_pv: {shape:'solar_pv', title:'Solar PV', w:110, h:70},
    battery_pack: {shape:'battery_pack', title:'Battery Pack', w:120, h:85},
    grid: {shape:'grid', title:'Grid', w:110, h:70},
    load: {shape:'ac_load', title:'AC Load', w:110, h:70}
  };
  var ports = {
    hybrid_inverter: [
      {name:'PV1', x:0, y:0.25, kind:'DC', peer:'solar_pv'},
      {name:'PV2', x:0, y:0.75, kind:'DC', peer:'solar_pv'},
      {name:'BATTERY', x:0.5, y:1, kind:'DC', peer:'battery_pack'},
      {name:'GRID', x:1, y:0.25, kind:'AC', peer:'grid'},
      {name:'LOAD', x:1, y:0.75, kind:'AC', peer:'load'}
    ],
    solar_pv:[{name:'DC',x:1,y:0.5,kind:'DC'}],
    battery_pack:[{name:'DC',x:0.5,y:0,kind:'DC'}],
    grid:[{name:'AC',x:0,y:0.5,kind:'AC'}],
    load:[{name:'AC',x:0,y:0.5,kind:'AC'}]
  };

  // -------------------------------------------------------------------
  // CONFIGURABLE EQUIPMENT (all 5 Irasus shapes)
  //
  // Each equipment body stores its configuration as metadata (attributes on
  // the cell value). Each electrical port is a small child cell with its own
  // metadata. Wires connect to the port cell, so a wire stays on the same
  // port when the equipment is moved, resized or (later) reconfigured.
  //
  // CATALOG: one entry per equipment type.
  //   stencil  - drawing used for the body (the original shapes are reused;
  //              their fixed connection points are switched off with points=[])
  //   defaults - configuration a new shape starts with (edited in Step 2)
  //   ports    - port generator: configuration -> list of port specifications
  // -------------------------------------------------------------------
  var PORT_SIZE = 10;

  var CATALOG = {
    hybrid_inverter: {
      title: 'Hybrid Inverter', stencil: 'hybrid_inverter_body', w: 160, h: 140,
      defaults: {phase: '1', pvInputs: 2, batteryInputs: 1, grid: true, load: true},
      ports: function (cfg) {
        var list = [], i;
        for (i = 1; i <= cfg.pvInputs; i++) {
          list.push({portId: 'PV' + i, kind: 'DC', direction: 'in', side: 'left',
            accepts: 'solar_pv,string_combiner'});
        }
        for (i = 1; i <= cfg.batteryInputs; i++) {
          list.push({portId: 'BAT' + i, kind: 'DC', direction: 'both', side: 'bottom',
            accepts: 'battery_pack'});
        }
        if (cfg.grid) {
          list.push({portId: 'GRID', kind: 'AC', direction: 'both', side: 'right',
            accepts: 'grid', phase: cfg.phase});
        }
        if (cfg.load) {
          list.push({portId: 'LOAD', kind: 'AC', direction: 'out', side: 'right',
            accepts: 'load', phase: cfg.phase});
        }
        return list;
      }
    },
    solar_pv: {
      title: 'Solar PV', stencil: 'solar_pv', w: 110, h: 70,
      defaults: {strings: 1, modulesPerString: 10, moduleWatt: 550},
      ports: function (cfg) {
        var list = [];
        for (var i = 1; i <= cfg.strings; i++) {
          list.push({portId: 'DC' + i, kind: 'DC', direction: 'out', side: 'right',
            accepts: 'hybrid_inverter,string_combiner'});
        }
        return list;
      }
    },
    battery_pack: {
      title: 'Battery Pack', stencil: 'battery_pack', w: 120, h: 85,
      defaults: {nominalVoltage: 51.2, capacityKwh: 5},
      ports: function (cfg) {
        return [{portId: 'DC', kind: 'DC', direction: 'both', side: 'top',
          accepts: 'hybrid_inverter', voltage: cfg.nominalVoltage}];
      }
    },
    grid: {
      title: 'Grid', stencil: 'grid', w: 110, h: 70,
      defaults: {phase: '1', voltage: 230},
      ports: function (cfg) {
        return [{portId: 'AC', kind: 'AC', direction: 'both', side: 'left',
          accepts: 'hybrid_inverter', phase: cfg.phase, voltage: cfg.voltage}];
      }
    },
    load: {
      title: 'AC Load', stencil: 'ac_load', w: 110, h: 70,
      defaults: {phase: '1', powerKw: 2},
      ports: function (cfg) {
        return [{portId: 'AC', kind: 'AC', direction: 'in', side: 'left',
          accepts: 'hybrid_inverter', phase: cfg.phase}];
      }
    }
  };

  // Relative position (0..1) of each port, spread evenly along its side
  function layoutPorts(list) {
    var bySide = {left: [], right: [], top: [], bottom: []};
    list.forEach(function (p) { bySide[p.side].push(p); });
    Object.keys(bySide).forEach(function (side) {
      var n = bySide[side].length;
      bySide[side].forEach(function (p, i) {
        var t = (i + 1) / (n + 1);
        p.x = side === 'left' ? 0 : side === 'right' ? 1 : t;
        p.y = side === 'top' ? 0 : side === 'bottom' ? 1 : t;
      });
    });
    return list;
  }

  function createUserObject(attrs) {
    var obj = mxUtils.createXmlDocument().createElement('UserObject');
    Object.keys(attrs).forEach(function (k) {
      if (attrs[k] != null) obj.setAttribute(k, String(attrs[k]));
    });
    return obj;
  }

  var PORT_LABEL_STYLE = {
    left: 'labelPosition=right;verticalLabelPosition=middle;align=left;verticalAlign=middle;spacingLeft=2;',
    right: 'labelPosition=left;verticalLabelPosition=middle;align=right;verticalAlign=middle;spacingRight=2;',
    top: 'labelPosition=center;verticalLabelPosition=bottom;align=center;verticalAlign=top;',
    bottom: 'labelPosition=center;verticalLabelPosition=top;align=center;verticalAlign=bottom;'
  };

  function createPortCell(p) {
    var value = createUserObject({
      label: p.portId, irasusPort: '1', portId: p.portId, kind: p.kind,
      direction: p.direction, accepts: p.accepts, phase: p.phase, voltage: p.voltage
    });
    var geo = new mxGeometry(p.x, p.y, PORT_SIZE, PORT_SIZE);
    geo.relative = true;
    geo.offset = new mxPoint(-PORT_SIZE / 2, -PORT_SIZE / 2);
    var color = p.kind === 'DC' ? 'fillColor=#C0392B;strokeColor=#7B241C;' :
      'fillColor=#E67E22;strokeColor=#935116;';
    var cell = new mxCell(value, geo, 'ellipse;irasusPort=1;html=0;fontSize=9;fontColor=#16324F;' +
      color + PORT_LABEL_STYLE[p.side] +
      'movable=0;resizable=0;rotatable=0;deletable=0;editable=0;points=[[0.5,0.5,0]];');
    cell.vertex = true;
    return cell;
  }

  // Creates an equipment body with its configuration metadata and port cells
  function createEquipment(type, cfg) {
    var eq = CATALOG[type];
    var attrs = {label: '', irasusType: type, irasusVersion: '1'};
    Object.keys(cfg).forEach(function (k) {
      attrs[k] = typeof cfg[k] === 'boolean' ? (cfg[k] ? '1' : '0') : cfg[k];
    });
    var body = new mxCell(createUserObject(attrs), new mxGeometry(0, 0, eq.w, eq.h),
      'shape=mxgraph.irasus.' + eq.stencil + ';irasusEquipment=1;whiteSpace=wrap;html=0;' +
      'fillColor=#F2F8FD;strokeColor=#275D87;connectable=0;points=[];');
    body.vertex = true;
    var ports = layoutPorts(eq.ports(cfg));
    ports.forEach(function (p) {
      var port = createPortCell(p);
      // A single port needs no label: the shape drawing already says AC/DC
      if (ports.length === 1) port.style += 'noLabel=1;';
      body.insert(port);
    });
    return body;
  }

  function isIrasusPort(cell) {
    return !!(cell && graph.getCellStyle(cell).irasusPort == '1');
  }

  // Palette: the 5 Irasus shapes, now created as configurable equipment.
  // The original fixed-port stencils stay registered above, so diagrams
  // drawn with them still open and validate as before.
  function addPalette() {
    if (!ui.sidebar) return;
    var entries = Object.keys(CATALOG).map(function (type) {
      var eq = CATALOG[type];
      return ui.sidebar.addEntry('irasus energy ' + type + ' ' + eq.title.toLowerCase(), function () {
        return ui.sidebar.createVertexTemplateFromCells(
          [createEquipment(type, eq.defaults)], eq.w, eq.h, eq.title, true, true);
      });
    });
    ui.sidebar.addPaletteFunctions('irasusEnergy', 'Irasus Energy', true, entries);
  }
  addPalette();

  function cellType(cell) {
    return cell ? graph.getCellStyle(cell).equipmentType || null : null;
  }
  function near(a,b) { return Math.abs(Number(a)-b)<0.015; }
  function edgePort(edge, type, sourceSide) {
    var style = graph.getCellStyle(edge);
    var prefix = sourceSide ? 'exit' : 'entry';
    var x = style[prefix+'X'], y = style[prefix+'Y'];
    if (x == null || y == null) return null;
    var candidates = ports[type] || [];
    for (var i=0; i<candidates.length; i++) {
      if (near(x,candidates[i].x) && near(y,candidates[i].y)) return candidates[i];
    }
    return null;
  }
  function checkEdge(edge) {
    var model = graph.getModel();
    var a = model.getTerminal(edge,true), b = model.getTerminal(edge,false);
    var issues = [];
    if (!a || !b) return ['Connector has a missing endpoint'];
    // Wires to configurable-equipment ports are validated in a later step
    if (isIrasusPort(a) || isIrasusPort(b)) return [];
    var ta = cellType(a), tb = cellType(b);
    if (!ta && !tb) return []; // ignore unrelated diagram elements
    if (!ta || !tb) return ['Irasus equipment connected to an untyped shape'];
    if (!ports[ta] || !ports[tb]) return ['Unknown equipment type'];
    if (ta !== 'hybrid_inverter' && tb !== 'hybrid_inverter') {
      return ['This starter only permits connections involving a hybrid inverter'];
    }
    var pa = edgePort(edge,ta,true), pb = edgePort(edge,tb,false);
    if (!pa || !pb) return ['Connector must attach to named stencil ports (fixed connection points)'];
    if (pa.kind !== pb.kind) issues.push('AC/DC mismatch ('+pa.kind+' vs '+pb.kind+')');
    var inverterPort = ta === 'hybrid_inverter' ? pa : pb;
    var peerType = ta === 'hybrid_inverter' ? tb : ta;
    if (inverterPort.peer !== peerType) {
      issues.push('Inverter '+inverterPort.name+' accepts '+inverterPort.peer+', not '+peerType);
    }
    return issues;
  }
  function validate() {
    var model=graph.getModel(), root=graph.getDefaultParent(), problems=[];
    function walk(cell) {
      if (model.isEdge(cell)) {
        checkEdge(cell).forEach(function(msg){problems.push({cell:cell,msg:msg});});
      }
      for (var i=0;i<model.getChildCount(cell);i++) walk(model.getChildAt(cell,i));
    }
    walk(root);
    if (!problems.length) {
      ui.alert('Validation passed: no invalid connections found on this page.');
      return;
    }
    graph.setSelectionCell(problems[0].cell);
    ui.alert('Validation found '+problems.length+' issue(s):\n\n'+
      problems.map(function(p,i){return (i+1)+'. Edge '+p.cell.id+': '+p.msg;}).join('\n'));
  }
  mxResources.parse('irasusValidate=Validate Diagram');
  ui.actions.addAction('irasusValidate', validate);
  ui.menus.addPluginMenuItems('extras', ['-', 'irasusValidate']);
  if (ui.toolbar && typeof ui.toolbar.addItems === 'function') {
    ui.toolbar.addItems(['irasusValidate']);
  }
});
