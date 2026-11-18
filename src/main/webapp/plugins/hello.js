Draw.loadPlugin(function(ui)
{
	var graph = ui.editor.graph;

	// Label for the action (the action name is the resource key)
	mxResources.parse('helloWorld=Hello World');

	ui.actions.addAction('helloWorld', function()
	{
		ui.alert('Selected cells: ' + graph.getSelectionCount());
	});

	// Appends the action to the end of the Extras menu
	ui.menus.addPluginMenuItems('extras', ['helloWorld']);
});
