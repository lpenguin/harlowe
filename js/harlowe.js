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
		
		// If debug, add button
		if (story.options.debug)
		{
			$('body').append($('<div class="debug-button">').click(function(e) {
				$('html').toggleClass('debug-mode');
			}));
		}
		
		// Install handler for links
		$('body').on('click', 'a[data-twinelink]', function (e)
		{
			var next = story.getPassageID($(this).attr('data-twinelink'));
			if (next)
			{
				engine.goToPassage(next);
			}
			e.preventDefault();
		});
		
		// Show first passage!
		start = header.attr('data-startnode');
		if (start)
		{
			engine.goToPassage(start);
		}
	});
	
});
