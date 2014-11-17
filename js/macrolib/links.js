define(['jquery', 'macros', 'utils', 'story', 'state', 'engine', 'datatypes/changercommand'],
function($, Macros, Utils, Story, State, Engine, ChangerCommand) {
	"use strict";
	
	/*
		Register the event that this enchantment responds to
		in a jQuery handler.
		
		Sadly, since there's no permitted way to attach a jQuery handler
		directly to the triggering element, the "actual" handler
		is "attached" via a jQuery .data() key, and must be called
		from this <html> handler.
	*/
	$(document.documentElement).on(
		/*
			The jQuery event namespace is "passage-link".
		*/
		"click.passage-link",
		"tw-link",
		function clickLinkEvent() {
			var link = $(this),
				/*
					Run the actual event handler.
				*/
				event = $(this).parent().data('clickEvent');
			
			if (event) {
				event(link);
			}
		}
	);
	
	Macros.addChanger
		(["link"], function(_, expr) {
			return ChangerCommand.create("link", expr);
		},
		function(desc, text) {
			var innerCode = desc.code;
			// TODO: Change this to <tw-link>
			desc.code = '<tw-link>' + text + '</tw-link>';
			desc.append = "replace";
			desc.data = {
				clickEvent: function() {					
					desc.code = innerCode;
					desc.section.renderInto(innerCode + "", null, desc);
				},
			};
		},
		[String])
});
