define(['macros', 'utils', 'story', 'engine'],
function(Macros, Utils, Story, Engine) {
	"use strict";
	
	var
		Any = Macros.TypeSignature.Any,
		optional = Macros.TypeSignature.optional;
	
	Macros.add
	
		/*
			(display:) evaluates to the TwineMarkup source of the passage
			with the given name.
			Evaluates to a DisplayCommand, an object which is by-and-large
			unusable as a stored value, but renders to the full TwineMarkup
			source of the given passage.
		*/
		("display", function display(_, name) {
			/*
				Test for the existence of the named passage in the story.
			*/
			if (!Story.passageNamed(name)) {
				return new ReferenceError(
					"I can't display the passage '"
					+ name
					+ "' because it doesn't exist."
				);
			}
			/*
				Create a DisplayCommand.
			*/
			return {
				TwineScript_ObjectName:
					"a (display: " + Utils.toJSLiteral(name) + ") command",
				
				TwineScript_TypeName:
					"a (display:) command",
				
				TwineScript_Print: function() {
					return Utils.unescape(Story.passageNamed(name).html());
				},
			};
		},
		[String])
		
		/*
			(print:) is a command to print a string. It's very similar to (text:),
			insofar as it converts its expr to string, but changer commands can be
			stapled onto it.
		*/
		("print", function(_, expr) {

			if (Utils.containsError(expr)) {
				return expr;
			}
			if (expr && typeof expr.TwineScript_Print === "function") {
				expr = expr.TwineScript_Print();
			}
			else {
				expr += "";
			}
			
			return {
				TwineScript_ObjectName:
					"a (print: " + Utils.toJSLiteral(expr) + ") command",

				TwineScript_TypeName:
					"a (print:) command",
				
				TwineScript_Print: function() {
					return expr;
				},
			};

		},
		[Any])
		
		/*
			(goto:) sends the player to a new passage, as soon as it is printed.
		*/
		("goto", function (_, name) {
			var id = Story.getPassageID(name);
			if (!id) {
				return new RangeError("There's no passage named '" + name + "'.");
			}
			return {
				TwineScript_ObjectName: "a (goto: " + Utils.toJSLiteral(name) + ") command",
				TwineScript_TypeName:   "a (goto:) command",
				TwineScript_Print: function() {
					Engine.goToPassage(id);
					return "";
				},
			};
		},
		[String])
		
		/*
			(live:)
			This "command" attaches to hooks, similar to the way changers do.
			Makes an attached hook become "live", which means that it's repeatedly re-run
			every certain number of seconds. This is the main means of
			making a passage dynamic and changing over time, or in reaction to an event.
			
			Yes, the actual implementation of this is in Section, not here.
		*/
		("live",
			function live(_, delay) {
				return {
					live: true,
					delay: delay
				};
			},
			[optional(Number)]
		)
		
		/*
			(stop:)
			This zero-arity macro creates a (stop:) command, which is not configurable.
			
			Clunky though it looks, it serves an important purpose: inside a (live:)
			macro, its appearance signals that the macro must stop running.
		*/
		("stop",
			function stop() {
				return {
					TwineScript_ObjectName: "a (stop:) command",
					TwineScript_TypeName:   "a (stop:) command",
					TwineScript_Print: function() {
						return "";
					},
				};
			},
			[]
		);
		
});
