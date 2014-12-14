define(['jquery', 'macros', 'utils', 'utils/selectors', 'story', 'state', 'engine', 'datatypes/changercommand'],
function($, Macros, Utils, Selectors, Story, State, Engine, ChangerCommand) {
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
		Selectors.internalLink,
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
		It is also what the standard link syntax desugars to.
	*/
	Macros.add
		(["link-goto"], function(section, text, passage) {
			/*
				Return a new (link-goto:) object.
			*/
			return {
				TwineScript_TypeName: "a (link-goto: "
					+ Utils.toJSLiteral(text) + ", "
					+ Utils.toJSLiteral(passage) + ") command",
				TwineScript_ObjectName: "a (link-goto:) command",
				
				TwineScript_Print: function() {
					var visited = -1;
					/*
						The string representing the passage name is evaluated as TwineMarkup here -
						the link syntax accepts TwineMarkup in both link and passage position
						(e.g. [[**Go outside**]], [[$characterName->$nextLocation]]), and the text
						content of the evaluated TwineMarkup is regarded as the passage name,
						even though it is never printed.
						
						One concern is that of evaluation order: the passage name is always evaluated
						before the link text, as coded here. But, considering the TwineMarkup parser
						already discards the ordering of link text and passage name in the link
						syntax ([[a->b]] vs [[b<-a]]) then this can't be helped, and probably doesn't matter.
					*/
					var passageName = section.evaluateTwineMarkup(Utils.unescape(passage || text));
					var passageID = Story.getPassageID(passageName);
					
					/*
						If a <tw-error> was returned by evaluateTwineMarkup, replace the link with it.
					*/
					if (passageName instanceof $) {
						/*
							section.runExpression() is able to accept jQuery objects
							being returned from TwineScript_Print().
						*/
						return passageName;
					}
					
					if (passageID) {
						visited = (State.passageIDVisited(passageID));
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
