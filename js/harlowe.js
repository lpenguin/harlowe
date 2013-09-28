/*
	Internal dependency chain:

	engine <- macros <---\
						state <- story <- utils
	macrolib <- script <-/
*/
define(['jquery', 'story', 'engine', 'macrolib'], function ($, Story, Engine)
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
			Story.options[b] = true;
		});
		Object.freeze(Story);

		// Init game engine
		Engine.init();
		
		// Show first passage!
		start = header.attr('data-startnode');
		if (start)
		{
			Engine.goToPassage(start);
		}
	});
	
});
