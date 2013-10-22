"use strict";

// bootstrap the engine on DOM ready

$(document).ready(function()
{
	var header = $('div[data-role="twinestory"]'),
		options,
		start;

	if (header.length == 0)
		return;

	// load options from attribute into story object

	options = header.attr('data-options');

	if (options)
		options.replace(/\b(\w+)\b/, function(a, b)
		{
			Story.options[b] = true;
		});

	Object.freeze(Story);

	// init game engine

	Engine.init();
	
	// show first passage!

	start = header.attr('data-startnode');

	if (start)
		Engine.goToPassage(start);
});
