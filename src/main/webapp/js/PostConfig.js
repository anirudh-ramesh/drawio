/**
 * Copyright (c) 2006-2024, JGraph Holdings Ltd
 * Copyright (c) 2006-2024, draw.io AG
 */
// null'ing of global vars need to be after init.js
window.ICONSEARCH_PATH = null;
window.ICON_SERVICE_PATH = null;

// Irasus Energy: load the plugin once for every user of this self-hosted fork.
// PostConfig.js can run before or after App.main(), so window.Draw may not
// exist yet. App.initPluginCallback() creates the Draw.loadPlugin queue if it
// is missing (App.main() skips it later), so the plugin's callback runs when
// the editor UI is ready, or immediately if the UI already exists.
(function()
{
	var url = 'plugins/irasus-energy.js';

	if (typeof App !== 'undefined' && App.pluginsLoaded[url] == null)
	{
		App.initPluginCallback();
		App.pluginsLoaded[url] = true;
		App.embedModePluginsCount++;
		mxscript(url);
	}
})();
