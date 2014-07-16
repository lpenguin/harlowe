require.config({ 
	paths: {
		// External libraries
		jquery: './lib/jquery',
		lzstring: './lib/lzstring',
		es6shims: './lib/es6shims',
		// Utils
		utils: './utils/utils',
		selectors: './utils/selectors',
		regexstrings: './utils/regexstrings',
		customelements: './utils/customelements',
		// WordArray and subclasses
		wordarray: './wordarray/wordarray',
		scope: './wordarray/scope',
	}
});
require(['jquery', 'renderer', 'story', 'state', 'engine', 'utils', 'selectors', 'macrolib'],
		function ($, Renderer, Story, State, Engine, Utils, Selectors) {
	"use strict";
	/**
		Harlowe, the default story format for Twine 2.
		@module Harlowe
		@main Harlowe
	*/
	
	// Used to execute custom scripts
	function _eval(text) {
		return eval(text + '');
	}
	
	$(document).ready(function() {
		var header = $(Selectors.storyData),
			options,
			script = $(Selectors.script),
			stylesheet = $(Selectors.stylesheet);

		if (header.length === 0) {
			return;
		}

		// Load options from attribute into story object

		options = header.attr('options');

		if (options) {
			options.split(/\s/).forEach(function(b) {
				Renderer.options[b] = Story.options[b] = true;
			});
		}
		Story.startPassage = header.attr('startnode');

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
		if (window.location.hash && !window.location.hash.contains("stories")) {
			if (State.load(window.location.hash)) {
				Engine.showPassage(State.passage);
				return;
			}
		}
		// Show first passage!
		Engine.goToPassage(Story.startPassage);
	});
});
