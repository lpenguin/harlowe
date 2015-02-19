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
			(display: String) -> DisplayCommand
			
			This command writes out the contents of the passage with the given string name.
			If a passage of that name does not exist, this produces an error.
			
			Example usage:
			`(display: "Cellar")` prints the contents of the passage named "Cellar".
			
			Rationale:
			Suppose you have a section of code or prose that you need to include in several different
			passages. It could be a status display, or a few lines of descriptive text. Instead of
			manually copy-pasting it into each passage, consider placing it all by itself in another passage,
			and using (display:) to place it in every passage. This gives you a lot of flexibility: you can,
			for instance, change the code throughout the story by just editing the displayed passage.
			
			Details:
			Text-targeting macros (such as (replace:)) inside the
			displayed passage will affect the text and hooks in the outer passage
			that occur earlier than the (display:) command. For instance,
			if passage A contains `(replace:Prince)[Frog]`, then another passage
			containing `Princes(display:'A')` will result in the text `Frogs`.
			
			When set to a variable, it evaluates to a DisplayCommand, an object
			which is by-and-large unusable as a stored value, but activates
			when it's placed in the passage.
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
			(print: Any) -> PrintCommand
			This command prints out any single argument provided to it, as text.
			
			Example usage:
			`(print: $var)`
			
			Details:
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
			(go-to: String) -> GotoCommand
			This command stops passage code and sends the player to a new passage.
			If the passage named by the string does not exist, this produces an error.
			
			Example usage:
			`(go-to: "The Distant Future")`
			
			Rationale:
			There are plenty of occasions where you may want to instantly advance to a new
			passage without the player's volition. (go-to:) provides access to this ability.
			
			(go-to:), as with all macros, can accept any expression which evaluates to
			a string. You can, for instance, go to a randomly selected passage by combining it with
			(either:) - `(go-to: (either: "Win", "Lose", "Draw"))`.
			
			(go-to:) can be combined with (link:) to produce a structure not unlike a
			normal passage link: `(link:"Enter the hole")[(go-to:"Falling")]` However, you
			can include other macros inside the hook to run before the (go-to:), such as (set:),
			(put:) or (save-game:).
			
			Details:
			(go-to:) prevents any macros and text after it from running.
			So, a passage that contains:
			```
			(set: $listen to "I love")
			(go-to: "Train")
			(set: $listen to it + " you")
			```
			will *not* cause `$listen` to become `"I love you"` when it runs.
			
			Going to a passage using this macro will count as a new "turn" in the game's passage history,
			much as if a passage link was clicked.
			
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
		
		/*d:
			(live: [Number]) -> LiveCommand
			When you attach this macro to a hook, the hook becomes "live", which means that it's repeatedly re-run
			every certain number of milliseconds, replacing the prose inside of the hook with a newly computed version.
			
			Rationale:
			Twine passage text generally behaves like a HTML document: it starts as code, is changed into a
			rendered page when you "open" it, and remains so until you leave. But, you may want a part of the
			page to change itself before the player's eyes, for its code to be re-renders "live"
			in front of the player, while the remainder of the passage remains the same.
			
			Certain macros, such as the (link:) macro, allow a hook to be withheld until after an element is
			interacted with. The (live:) macro is more versatile: it re-renders a hook every specified number of
			milliseconds. If (if:) or (unless:) macros are inside the hook, they of course will be re-evaluated each time.
			By using these two kinds of macros, you can make a (live:) macro repeatedly check if an event has occurred, and
			only change its text at that point.
			
			Details:
			Live hooks will continue to re-render themselves until they encounter and print a (stop:) macro.
		*/
		/*
			Yes, the actual implementation of this is in Section, not here.
		*/
		("live",
			function live(_, delay) {
				return {
					TwineScript_ObjectName: "a (live: " + delay + ") command",
					TwineScript_TypeName:   "a (live:) command",
					live: true,
					delay: delay
				};
			},
			[optional(Number)]
		)
		
		/*d
			(stop:) -> StopCommand
			This macro, which accepts no arguments, creates a (stop:) command, which is not configurable.
			
			Example usage:
			`(live:)[(if: $escaped)[You're free! (stop:)]]`
			
			Rationale:
			Clunky though it looks, this macro serves a single important purpose: inside a (live:)
			macro's hook, its appearance signals that the macro must stop running. In every other occasion,
			this macro does nothing.
			
			See also:
			(live:)
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
		/*d:
			(save-game: String, [String]) -> Boolean
			
			This macro saves the current game's state in browser storage, in the given save slot,
			and including a special filename. It can then be restored using (load-game:).
			
			Rationale:
			
			Many web games use browser cookies to save the player's place in the game.
			Twine allows you to save the game, including all of the variables that were (set:)
			or (put:), and the passages the player visited, to the player's browser storage.
			
			(save-game:) is a single operation that can be used as often or as little as you
			want to. You can include it on every page; You can put it at the start of each "chapter";
			You can put it inside a (link:) hook, such as
			```
			{(link:"Save game")[
			  (if:(save-game:"A"))[
			    Game saved!
			  ](else: )[
			    Save failed!
			  ]
			]}
			```
			and let the player choose when to save.
			
			Details:
			
			(save-game:)'s first String is a slot name in which to store the game. You can have as many slots
			as you like. If you only need one slot, you can just call it `"A"` and use `(save-game:"A")`.
			You can tie them to a name the player gives, such as `(save-game: $playerName)`, if multiple players
			are likely to play this game - at an exhibition, for instance.
			
			Giving the saved game a file name is optional, but allows that name to be displayed when examining
			____, cluing the player into the saved game's contents.
			
			(save-game:) evaluates to a boolean - true if the game was indeed saved, and false if the browser prevented
			it (because they're using private browsing, their browser's storage is full, or some other reason).
			Since there's always a possibility of a save failing, you should use (if:) and (else:) with (save-game:)
			to display an apology message in the event that it returns false.
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
