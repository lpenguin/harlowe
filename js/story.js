define(['jquery'], function($)
{
	"use strict";
	
	var story = {
		// Set of options, loaded at startup.
		options: {},
		
		// Set of macro definitions.
		macros: {},
		
		// Set of transitions.
		transitions: {},
		
		// Set of JS-based text effects.
		effects: {},
		
		passageNamed: function (name)
		{
			var passage = $('div[data-role="twinestory"] > div[data-name="' + name + '"]');
			return (passage.length == 0 ? null : passage);
		},
		
		passageWithId: function (id)
		{
			var passage = $('div[data-role="twinestory"] > div[data-id="' + id + '"]');
			return (passage.length == 0 ? null : passage);
		}
	};
	return story;
});