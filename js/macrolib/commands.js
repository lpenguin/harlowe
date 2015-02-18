define(['macros', 'utils', 'story', 'state', 'engine', 'internaltypes/twineerror'],
function(Macros, Utils, Story, State, Engine, TwineError) {
	"use strict";
	
	var
		Any = Macros.TypeSignature.Any,
		optional = Macros.TypeSignature.optional;
	
	var hasStorage = !!localStorage
		&& (function() {
			/*
				This is, to my knowledge, the only surefire way of measuring localStorage's
				availability - on some browsers, setItem() will throw in Private Browsing mode.
			*/
			try {
				localStorage.setItem("test", '1');
				localStorage.removeItem("test");
				return true;
			} catch (e) {
				return false;
			}
		}());
	
	Macros.add
	
		/*d:
			(display: String)
			This command writes out the contents of the passage with the given string name.
			If a passage of that name does not exist, this produces an error.
			
			A special note: text-targeting macros (such as (replace:)) inside the
			displayed passage will affect the text and hooks in the outer passage
			that occur earlier than the (display:) command. For instance,
			if passage A contains `(replace:Prince)[Frog]`, then another passage
			containing `Princes(display:'A')` will result in the text `Frogs`.
			
			When set to a variable, it evaluates to a DisplayCommand, an object
			which is by-and-large unusable as a stored value, but activates
			when it's placed in the passage.
			
			Example usage:
			`(display: "Cellar")` prints the contents of the passage named "Cellar".
		*/
		("display", function display(_, name) {
			/*
				Test for the existence of the named passage in the story.
			*/
			if (!Story.passageNamed(name)) {
				return TwineError.create("macrocall",
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
		
		/*d:
			(print: Any)
			This command prints out any single argument provided to it, as text.
			
			It is capable of printing things which (text:) cannot convert to a string,
			such as changer commands - but these will usually become bare descriptive
			text like `[A (font:) command]`. But, for debugging purposes this can be helpful.
			
			When set to a variable, it evaluates to a PrintCommand. Notably, the
			expression to print is stored in the PrintCommand. So, a passage
			that contains:
			```
			(set: $name to "Dracula")
			(set: $p to (print: "Count " + $name))
			(set: $name to "Alucard")
			$p
			```
			will still result in the text `Count Dracula`.
			
			Example usage:
			`(print: $var)`
			
			See also:
			(text:), (display:)
		*/
		("print", function(_, expr) {

			if (TwineError.containsError(expr)) {
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
		
		/*d:
			(goto: String)
			This command stops passage code and sends the player to a new passage.
			If the passage named by the string does not exist, this produces an error.
			
			(goto:) prevents any macros and text after it from running.
			So, a passage that contains:
			```
			(set: $listen to "I love")
			(goto: "Train")
			(set: $listen to it + " you")
			```
			will *not* cause `$listen` to become `"I love you"` when it runs.
			
			Example usage:
			`(goto: "The Distant Future")`
			
			See also:
			(loadgame:)
		*/
		("goto", function (_, name) {
			var id = Story.getPassageID(name);
			if (!id) {
				return TwineError.create("macrocall", "There's no passage named '" + name + "'.");
			}
			return {
				TwineScript_ObjectName: "a (goto: " + Utils.toJSLiteral(name) + ") command",
				TwineScript_TypeName:   "a (goto:) command",
				TwineScript_Print: function() {
					/*
						When a passage is being rendered, <tw-story> is detached from the main DOM.
						If we now call another Engine.goToPassage in here, it will attempt
						to detach <tw-story> twice, causing a crash.
						So, the change of passage must be deferred until just after
						the passage has ceased rendering.
					*/
					requestAnimationFrame(Engine.goToPassage.bind(Engine,id));
					/*
						But how do you immediately cease rendering the passage?
						
						This object's property name causes Section's runExpression() to
						cancel expression evaluation at that point. This means that for, say,
							(goto: "X")(set: $y to 1)
						the (set:) will not run because it is after the (goto:)
					*/
					return { earlyExit: 1 };
				},
			};
		},
		[String])
		
		/*
			(live: optional Number)
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
		)
		/*
			(save-game:)
			This boolean macro serialises the game state and stores it in localStorage, in a given
			"slot name" (usually a numeric string, but potentially any string) and with a "file name"
			(which will be used by a future macro for file data display).
		*/
		("savegame",
			function savegame(_, slotName, fileName) {
				/*
					The default filename is the empty string.
				*/
				fileName = fileName || "";
				
				if (!hasStorage) {
					/*
						If storage isn't available, that's the unfortunate fault of the
						browser. Return false, signifying that the save failed, and
						allowing the author to display an apology message.
					*/
					return false;
				}
				var serialisation = State.serialise();
				if (!serialisation) {
					/*
						On the other hand, if serialisation fails, that's presumably
						the fault of the author, and an error should be given.
					*/
					return TwineError.create(
						"saving",
						"The game's variables contain a complex data structure; the game can no longer be saved."
					);
				}
				/*
					In case setItem() fails, let's run this in a try block.
				*/
				try {
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game) to avoid collisions.
							I'm loathe to use any particular prefix which brands the game
							as a Twine creation: it should be able to stand with its own
							identity, even in an obscure a place as its localStorage key names.
						*/
						"(Saved Game) " + slotName, serialisation);
					
					/*
						The file name is saved separately from the state, so that it can be retrieved
						without having to JSON.parse() the entire state.
					*/
					localStorage.setItem(
						/*
							Saved games are prefixed with (Saved Game Filename) to avoid collisions.
						*/
						"(Saved Game Filename) " + slotName, fileName);
					return true;
				} catch(e) {
					/*
						As above, if it fails, a return value of false is called for.
					*/
					return false;
				}
			},
			[String, optional(String)]
		)
		/*
			(load-game:)
			This command attempts to load a saved game from the given slot, ending the current game and replacing it
			with the loaded one.
		*/
		("loadgame",
			function loadgame(_, slotName) {
				return {
					TwineScript_ObjectName: "a (load-game:) command",
					TwineScript_TypeName:   "a (load-game:) command",
					TwineScript_Print: function() {
						var saveData = localStorage.getItem("(Saved Game) " + slotName);
						
						if (!saveData) {
							return TwineError.create("saving", "I can't find a save slot named '" + slotName + "'!");
						}
						
						State.deserialise(saveData);
						requestAnimationFrame(Engine.showPassage.bind(Engine,State.passage));
						return { earlyExit: 1 };
					},
				};
			},
			[String]
		);
});
