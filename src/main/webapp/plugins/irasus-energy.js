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

  function addPalette() {
    if (!ui.sidebar) return;
    var entries = Object.keys(specs).map(function (type) {
      var spec = specs[type];
      return ui.sidebar.createVertexTemplateEntry(
        'shape=mxgraph.irasus.' + spec.shape + ';equipmentType=' + type +
        ';whiteSpace=wrap;html=0;fillColor=#F2F8FD;strokeColor=#275D87;',
        spec.w, spec.h, '', spec.title, false, true, 'irasus energy ' + type
      );
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
