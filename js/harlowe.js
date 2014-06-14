require.config({ 
	paths: {
		// External libraries
		jquery: './lib/jquery',
		lzstring: './lib/lzstring',
		// Utils
		utils: './utils/utils',
		selectors: './utils/selectors',
		regexstrings: './utils/regexstrings',
		customelements: './utils/customelements',
		// WordArray and subclasses
		wordarray: './wordarray/wordarray',
		scope: './wordarray/scope',
		// MacroInstance and subclasses
		macroinstance: './macroinstance/macroinstance',
		hookmacroinstance: './macroinstance/hookmacroinstance',
	}
});
require(['jquery', 'twinemarked', 'story', 'state', 'engine', 'utils', 'selectors', 'regexstrings', 'macros', 'macrolib'],
		function ($, TwineMarked, Story, State, Engine, Utils, Selectors, RegexStrings, Macros) {
	"use strict";
	// Used to execute custom scripts
	function _eval(text) {
		return eval(text + '');
	}
	
	$(document).ready(function() {
		var header = $(Selectors.storyData),
			options,
			script = $(Selectors.script),
			stylesheet = $(Selectors.stylesheet),
			start;

		if (header.length == 0) {
			return;
		}

		// Load options from attribute into story object

		options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach(function(b) {
				Story.options[b] = true;
			});
			TwineMarked.options = Story.options;
		}
		Story.startPassage = header.attr('startnode');
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
		
		// Load the hash if it's present
		if (window.location.hash && window.location.hash.indexOf("stories") == -1) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}
		// Show first passage!
		Engine.goToPassage(Story.startPassage);
	});
});
