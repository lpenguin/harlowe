require.config({ 
	paths: {
		// External libraries
		jquery: './lib/jquery',
		lzstring: './lib/lzstring',
		es6shims: './lib/es6shims',
		// Utils
		utils: './utils/utils',
		hookutils: './utils/hookutils',
		selectors: './utils/selectors',
		regexstrings: './utils/regexstrings',
		customelements: './utils/customelements',
		// Hook sets
		hookset: './hooksets/hookset',
		pseudohookset: './hooksets/pseudohookset',
	}
});
require(['jquery', 'renderer', 'story', 'state', 'engine', 'utils', 'selectors', 'macrolib'],
		function ($, Renderer, Story, State, Engine, Utils, Selectors) {
	"use strict";
	/**
		Harlowe, the default story format for Twine 2.
		
		This module contains only code which initialises the document and the game.
		
		@module Harlowe
		@main Harlowe
	*/
	
	// Used to execute custom scripts
	function _eval(text) {
		return eval(text + '');
	}
	
	/**
		Sets up event handlers for specific Twine elements. This should only be called
		once at setup.

		@method installHandlers
	*/
	var installHandlers = function() {
		var html = $(document.documentElement);
		
		// Install the handler for passage links.

		html.on('click.passage-link', Selectors.internalLink+'[passage-id]', function(e) {
			var next = $(this).attr('passage-id');

			if (next) {
				// TODO: stretchtext
				Engine.goToPassage(next,false);
			}

			e.preventDefault();
		});

		// If the debug option is on, add the debug button.

		if (Story.options.debug) {
			$(document.body).append($('<div class="debug-button">').click(function() {
				html.toggleClass('debug-mode');
			}));
		}
		installHandlers = null;
	};

	/*
		This is the main function which starts up the entire program.
	*/
	$(document).ready(function main() {
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

		installHandlers();
		
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
