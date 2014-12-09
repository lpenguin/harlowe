define(['jquery', 'markup/markup', 'story', 'macros', 'utils', 'datatypes/changercommand', 'internaltypes/twinewarning',
'macrolib/values', 'macrolib/stylechangers', 'macrolib/enchantments', 'macrolib/commands', 'macrolib/links'],
function($, TwineMarkup, Story, Macros, Utils, ChangerCommand, TwineWarning) {
	"use strict";
	/*
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
		
		Most of the built-in macros are in the categorised submodules.
		The macros that remain in here are uncategorised at present.
		
		
		MACRO NAMING CONVENTIONS:
		
		* Generally stick to single words as much as possible,
			but take pains to make the word as relevant and precise as possible.
		* "on"  prefix: Currently reserved.
		* "at"  prefix: Currently reserved.
		* "is"  prefix: Currently reserved.
		* "can" prefix: Currently reserved.
		* type name: Should denote a type constructor or converter.
			Constructors include (colour:), (text:) and (num:)
		* verbs:
			As TwineScript "statements" are expressions, imperative verbs
			aren't terribly helpful. (print:) remains out of sheer incumbency,
			as does(?) (display:).
			
			Sometimes, such as with (replace:), we get a 'verb' that actually
			describes what its output does, rather than itself.
	*/

	Macros.addValue

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
	["cloak", "uncloak"].forEach(function(name) {
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
				return ChangerCommand.create("nobr");
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
				return ChangerCommand.create("CSS");
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

	Utils.log("Loaded the built-in macros.");
});
