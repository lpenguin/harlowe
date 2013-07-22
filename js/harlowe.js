/*
	Internal dependency chain:

	engine <- macros <---\
						state <- story <- utils
	macrolib <- script <-/
*/
define(['jquery', 'story', 'engine', 'macrolib'], function ($, story, engine)
{
	"use strict";
	
	// Document is loaded
	$(document).ready(function()
	{
		var header = $('div[data-role="twinestory"]'),
			options,
			start;
		
		if (header.length == 0)
		{
			return;
		}
		
		// Load options
		options = header.attr('data-options');
		options.replace(/\b(\w+)\b/, function(a, b) {
			story.options[b] = true;
		});
		Object.freeze(story);

		// Init game engine
		engine.init();
		
		// Show first passage!
		start = header.attr('data-startnode');
		if (start)
		{
			engine.goToPassage(start);
		}
	});
	
});
