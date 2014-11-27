define(['jquery', 'macros', 'utils', 'story', 'state', 'engine', 'datatypes/changercommand'],
function($, Macros, Utils, Story, State, Engine, ChangerCommand) {
	"use strict";
	/*
		This module defines the behaviour of links in Harlowe - both
		the normal passage links, and the (link:) macro's links.
		But, this does not include (click:) enchantments, which
		are technically not links (but behave identically).
	*/
	var optional = Macros.TypeSignature.optional;
	
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
					This could be a (link:) link. Such links' events
					are, due to limitations in the ChangeDescriptor format,
					attached to the <tw-expression> enclosing it.
				*/
				event = link.parent().data('clickEvent');
			
			if (event) {
				event(link);
				return;
			}
			/*
				If no event was registered, then this must be
				a passage link.
			*/
			var next = link.attr('passage-id');
			
			if (next) {
				// TODO: stretchtext
				Engine.goToPassage(next,false);
			}
		}
	);
	
	Macros.addChanger
		(["link"], function(_, expr) {
			return ChangerCommand.create("link", [expr]);
		},
		function(desc, text) {
			var innerCode = desc.code;
			desc.code = '<tw-link>' + text + '</tw-link>';
			desc.append = "replace";
			desc.data = {
				clickEvent: function() {
					desc.code = innerCode;
					desc.section.renderInto(innerCode + "", null, desc);
				},
			};
		},
		[String]);
	
	/*
		(link-goto:) is an eager version of (link:...)[(goto:...)], where the
		passage name ((goto:)'s argument) is evaluated alongside (link:)'s argument.
		It is also what the standard link syntax (should, hopefully) desugars to.
	*/
	Macros.addValue
		(["link-goto"], function(section, text, passage) {
			/*
				For all command macros, their arguments should be evaluated at creation
				time. And so it is here: the passageName is evaluated at macro evaluation time,
				not macro printing time. If an error occurs, it should be revealed here
				and now.
			*/
			var passageName = section.evaluateTwineMarkup(Utils.unescape(passage || text));
			
			/*
				If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
			*/
			if (passageName instanceof $) {
				/*
					Alas, there is a #problem: evaluateTwineMarkup cannot return the
					error objects, as they have long been discarded through the renderInto()
					process - only their resulting HTML elements remain.
					
					So... a new Error object must be created from the test of the error.
					This is painful, but seemingly the least incorrect approach.
				*/
				return new Error(passageName.first().text());
			}
			/*
				Return the (link-goto:) object.
			*/
			return {
				TwineScript_TypeName: "a (link-goto: " + Utils.toJSLiteral(passageName) + ") command",
				TwineScript_ObjectName: "a (link-goto:) command",
				
				TwineScript_Print: function() {
					var visited = -1;
					var passageID = Story.getPassageID(passageName);
					
					if (Story.passageNamed(passage)) {
						visited = (State.passageNameVisited(passage));
					} else {
						// Not an internal link?
						if (!~visited) {
							return '<tw-broken-link passage-id="' + passageID + '">'
								+ (text || passage)
								+ '</tw-broken-link>';
						}
					}
					
					return '<tw-link ' + (visited > 0 ? 'class="visited" ' : '')
						+ (Story.options.debug ? 'passage-name="' + passageName + '" ' : '')
						+ 'passage-id="' + passageID + '">' + (text || passage) + '</tw-link>';
				}
			};
		},
		[String, optional(String)]);
});
