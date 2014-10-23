define(['jquery', 'twinemarkup', 'story', 'macros', 'utils', 'datatypes/twineWarning',
'macrolib/values', 'macrolib/styleChangers', 'macrolib/sensors', 'macrolib/enchantments'],
function($, TwineMarkup, Story, Macros, Utils, TwineWarning) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
		
		Most of the built-in macros are in the categorised submodules.
		The macros that remain in here are uncategorised at present.
	*/

	Macros.addValue

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
				TwineScript_ObjectName: "a (display:) command",
				toString: function() {
					// TODO: Reimplement the (display:) loop.
					return Story.passageNamed(name).html();
				}
			};
		})
		/*
			(remove:) Removes the given hook or pseudo-hook from the section.
			It accepts a standard selector, emits a side-effect, and returns "".
		*/
		("remove", function remove(section, selector) {
			section.selectHook(selector).forEach(function(e) { e.remove(); });
			return "";
		});
	
	/*
		(cloak:) Hides the given hook or pseudo-hook.
		(uncloak:) Shows the given hook or pseudo-hook.
		They accept a standard selector, emits a side-effect, and returns "".
	*/
	["cloak","uncloak"].forEach(function(name) {
		Macros.addValue(name, function cloak(section, selector) {
			var selection = section.selectHook(selector);
			/*
				To my regret, I must use a side-effect here for tracking
				how many elements were affected by the macro.
			*/
			var count = 0;
			selection.forEach(function(hook) {
				/*
					Let's just use the jQuery hide/show methods for now.
				*/
				hook[name === "cloak" ? "hide" : "show"]();
				count += 1;
			});
			/*
				If nothing was changed, provide a warning to the user, in case they
				mistyped a hook name.
			*/
			if (!count) {
				return new TwineWarning("The '" + selector.TwineScript_ObjectName + "' selector didn't select anything.");
			}
			return "";
		});
	});
	/*
		TODO: Maybe it would be better, or at least more functional, if
		ChangerCommands returned a fresh ChangerDescriptor instead of permuting
		the passed-in one.
	*/
	Macros.addChanger
		
		/*
			(nobr:)
			Remove line breaks from the hook.
			Manual line breaks can be inserted with <br>.
		*/
		("nobr",
			function nobr() {
				return Macros.ChangerCommand("nobr");
			},
			function(d) {
				// To prevent keywords from being created by concatenating lines,
				// replace the line breaks with a zero-width space.
				d.code = d.code.replace(/\n/g, "&zwnj;");
				return d;
			}
		)

		/*
			(CSS:)
			Insert the enclosed raw CSS into a <style> tag that exists for the
			duration of the current passage only.
			contents: raw CSS.
		*/
		("CSS",
			function CSS() {
				return Macros.ChangerCommand("CSS");
			},
			function style(d) {
				var selector = 'style#macro';
				if (!$(selector).length) {
					$(document.head).append($('<style id="macro">'));
				}
				$(selector).text(Utils.unescape(d.code));
				d.code = "";
				return d;
			}
		);
	
	Utils.log("Macrolib module ready!");
});
