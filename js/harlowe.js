require.config({ 
	paths: {
		// External libraries
		jquery: './lib/jquery',
		marked: './lib/marked',
		// WordArray and subclasses
		wordarray: './wordarray/wordarray',
		scope: './wordarray/scope',
		// MacroInstance and subclasses
		macroinstance: './macroinstance/macroinstance',
		hookmacroinstance: './macroinstance/hookmacroinstance',
	}
});
require(['jquery', 'story', 'engine', 'utils', 'macros', 'macrolib'], function ($, Story, Engine, Utils, Macros) {
	"use strict";
	
	function _eval(text) {
		return eval(text + '');
	}
	
	$(document).ready(function() {
		var header = $('[data-role="twinestory"]'),
			options,
			script = $('[data-role="script"]'),
			stylesheet = $('[data-role="stylesheet"]'),
			start;

		if (header.length == 0) {
			return;
		}

		// Load options from attribute into story object

		options = header.attr('data-options');

		if (options) {
			options.replace(new RegExp("\\b(" + Utils.regexStrings.anyLetter + "+)\\b"), function(a, b) {
				Story.options[b] = true;
			});
		}

		Story.startPassage = header.attr('data-startnode');
		Object.freeze(Story);

		// Init game engine

		Engine.init();
		
		// Execute the custom scripts
		
		script.each(function(i) {
			try { 
				_eval($(this).html());
			} catch (e) {
				// TODO: Something more graceful - an 'error passage', perhaps?
				alert("There is a problem with this story's script (#" + (i + 1) + "):\n\n" + e.message);
			}
		});
		
		// Apply the stylesheets
		
		stylesheet.each(function(i) {
			// In the future, pre-processing may occur.
			$(document.head).after('<style data-title="Story stylesheet ' + (i + 1) + '">' + $(this).html());
		});

		// Show first passage!
		Engine.goToPassage(Story.startPassage);
	});
});
