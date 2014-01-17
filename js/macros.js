define(['jquery', 'story', 'utils', 'wordarray', 'macroinstance', 'hookmacroinstance', 'scope'],
function($, Story, Utils, WordArray, MacroInstance, HookMacroInstance, Scope) {
	"use strict";
	/*
		Macros
		Macro execution engine.
	*/

	/*

	MACRO API:

	For end users:
	* Macros.get(name) : get a registered macro function.
	* Macros.add(descriptor): register a new macro.
		descriptor is a map of the following:
			- fn: the function to execute when the macro runs. It may be absent for hook macros. 'this' is the MacroInstance running it.
			- name: a string, or an array of strings serving as 'alias' names.
			- selfClosing: boolean, determines if the macro tag has contents. If false, then all subsequent code
				up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
				will be captured by this.contents.
			- version: a map { major: Number, minor: Number, revision: number }.
			- hooked: boolean, denotes that this is a hook macro.
			- deferred: boolean, denotes that the hook macro is "deferred" - it will not immediately execute. Currently unused.
			- enchantment: a map whose presence denotes that the hook macro is an "enchantment" - its contents will not immediately
				be rendered until a denoted event is performed on its hook(s).
				The map contains the following:
				- event: the DOM event that triggers the rendering of this macro's contents.
				- classList: the list of classes to 'enchant' the hook with, to denote that it is ready for the player to
				trigger an event on it.
				- rerender: a string determining whether to clear the span before rendering into it ("replace", default),
				append the rendering to its current contents ("append") or prepend it ("prepend").
				- once: whether or not the enchanted DOM elements can trigger this macro multiple times.
				- filterFn: a function to determines whether to apply the enchantment class to said hook. First arg is the
				jQuery to test.
			
	* Macros.supplement(name, selfClosing, main) : register a macro which has no code, but is used as a sub-tag in another macro.
		main: name of the 'parent' macro.
		
	For other modules:
	* Macros.matchMacroTag(html, callback(e)) : perform a function for each valid macro call in the HTML.
		html: a string of escaped HTML.
		e: a MacroInstance object matching a macro invocation in the HTML.

	*/

	var Macros,
		// Private collection of registered macros.
		macroRegistry = {},
		// Tracker of registered events and their class lists
		enchantmentEventRegistry = {};

	/*
		Connect Macros to MacroInstance
	*/
	Object.defineProperty(MacroInstance, "getMacroData", {
		enumerable: 0,
		configurable: 0,
		value: function (i) {
			return macroRegistry[i]
		}
	});

	/*
		Common function of hook macros.
	*/
	function hookMacroFn(deferred, innerFn) {
		var rerender = this.desc && this.desc.enchantment && this.desc.enchantment.rerender;

		// No argument given?
		if (this.args.length < 1) {
			this.error('no hook ID given');
			return;
		}

		// For deferred macros, only run this once.
		if (!this.ready) {
			deferred && (this.ready = true);

			// Set up the scope
			try {
				this.setScope(this.args);
			} catch (e) {
				return this.error("invalid macro scope: " + this.rawArgs + " (" + e + ")");
			}

			// Designate this as a hook macro.
			this.el.addClass("hook-macro");
			// Keep the MacroInstance around
			this.el.data("instance", this);

			if (deferred) {
				return;
			} else {
				//Will run immediately - enchant now.
				this.enchantScope();
			}
		} else {
			// Deferred macro was activated - refresh the scope.
			this.refreshScope();
		}

		// If an inner function was given, run that.
		if (innerFn && typeof innerFn === "function") {
			innerFn.apply(this, this.applyArgs);
		} else
		{
			// Default behaviour: simply parse the inner contents.
			if (!rerender || rerender === "replace") {
				Utils.transitionOut(this.el.children(), "fade-in")
			}
			this.render(this.contents, rerender === "prepend");
		}
	}

	// Generate a unique wrapper for each macro,
	// outside the scope of Macros.add.
	function newHookMacroFn(deferred, innerFn) {
		return function hookMacroFnCall() {
			return hookMacroFn.call(this, deferred, innerFn);
		};
	}

	// Called when an enchantment's event is triggered. Sub-function of Macros.add()
	function enchantmentEventFn() {
		var elem = $(this),
			story = Utils.storyElement;
		
		// Trigger the hook macros that refer to this enchantment.
		Utils.$(Utils.selectors.hookMacroInstance, story).each(function () {
			var instance = $(this).data("instance");

			if (instance.scope && instance.scope.hooks && instance.scope.hooks.is(elem)) {
				instance.runEnchantment(elem);
			}
		});
	}

	// Report an error when a user-loaded macro fails. Sub-function of Macros.add() and Macros.supplement().
	function loaderError(text) {
		// TODO: Instead of a basic alert, display a notification banner somewhere.
		window.alert(text);
		return true;
	}

	// Register an enchantment without creating multiple event handlers for the same event.
	// Sub-function of Macros.add()
	function registerEnchantmentEvent(name, newList) {
		// Get the currently stored event class lists
		var list = enchantmentEventRegistry[name] || "",
			eventName = name + ".macro";

		// Add the new list
		(!~list.indexOf(newList) && (list += (list && ", ") + newList));

		// Set the event handler
		$(document.documentElement).off(eventName).on(eventName, list, enchantmentEventFn);
		// Add to registry
		enchantmentEventRegistry[name] = list;
	}

	/*
		The object containing all the macros available to a story.
	*/
	Macros = {

		// Get a macro.
		get: function (e) {
			return macroRegistry.hasOwnProperty(e) && macroRegistry[e];
		},

		// Register a new macro.
		// name: a string, or an array holding multiple strings.
		add: function (name, desc) {
			var fn;
			if (!Utils.stringOrArray(name)) {
				return loaderError("Argument 1 of Macros.add isn't an array or a string.");
			}
			if (!(desc && typeof desc === "object" && ((desc.fn && typeof desc.fn === "function") || desc.hooked))) {
				return loaderError("Argument 2 of Macros.add (\"" + name + "\") isn't a valid or complete descriptor.");
			}
			// Hook macro? Use a hookMacroFn for its function.
			if (desc.hooked) {
				// Enchantment macro? Register the enchantment's event.
				if (desc.enchantment && desc.enchantment.event && desc.enchantment.classList) {
					// Set the event that the enchantment descriptor declares
					registerEnchantmentEvent(desc.enchantment.event, Utils.classListToSelector(desc.enchantment.classList));

					desc.fn = newHookMacroFn(true, desc.fn);
				} else {
					desc.fn = newHookMacroFn( !! desc.deferred, desc.fn);
				}
			}
			desc = Object.freeze(desc);
			// Add desc to the macroRegistry, plus aliases (if name is an array of aliases)
			if (Array.isArray(name)) {
				name.forEach(function (n) {
					Utils.lockProperty(macroRegistry, n, desc);
				});
			} else {
				Utils.lockProperty(macroRegistry, name + "", desc);
			}
		},

		// Register a macro that appears internally in another macro (i.e <<endif>> for <<if>>)
		// name: a string, or an array holding multiple names.
		// main: a string or an array.
		supplement: function (name, desc, main) {
			var mfunc,
				errorMsg = " of Macros.supplement isn't an array or a string.",
				selfClosing = desc.selfClosing;

			// Type checking
			if (!Utils.stringOrArray(name)) {
				return loaderError("Argument " + 1 + errorMsg);
			}
			if (!Utils.stringOrArray(main)) {
				return loaderError("Argument " + 3 + errorMsg);
			}
			// Get the main macro's data
			mfunc = Macros.get(main);
			// Define a function for the supplement
			desc.fn = function () {
				if (!this.context || ~~main.indexOf(this.context.name)) {
					this.error("is outside a" + (Array.isArray(main) ? "n appropriate macro" : " <<" + main + ">>"));
				} else {
					this.clear();
				}
			};
			if (mfunc && mfunc.version) {
				desc.version = mfunc.version;
			}
			Macros.add(name, desc);
		},

		// Performs a function for each macro instance found in the HTML.
		// macroname is a regex string specifying a particular name; if absent, all are found.
		// Callback function's argument is a macro instance.
		matchMacroTag: function (html, macroname, callback) {
			var re = Utils.regexStrings,
				macroRE = new RegExp(re.macroOpen + "\\s*(" + (macroname || re.macroName) +
					")" + re.notMacroClose + re.macroClose, 'ig'),
				macro, endMacroRE, foundMacro, foundEndMacro, nesting,
				endIndex, desc;
			// Search through html for macro tags
			do {
				foundMacro = macroRE.exec(html);
				if (foundMacro !== null) {
					endIndex = macroRE.lastIndex;
					desc = this.get(foundMacro[1]);

					// If macro is not self-closing, search for endtag
					// and capture entire contents.
					if (desc && !desc.selfClosing) {
						endMacroRE = new RegExp(macroRE.source + "|" + re.macroOpen + "((?:\\/|end)" + foundMacro[1] + ")(?!" + re.macroName+")" + re.notMacroClose +
							re.macroClose, "g");
						endMacroRE.lastIndex = endIndex;
						nesting = 0;
						do {
							foundEndMacro = endMacroRE.exec(html);
							if (foundEndMacro !== null) {
								if (foundEndMacro[2]) {
									// Found <</macro>>
									if (nesting) {
										nesting -= 1;
									} else {
										endIndex = endMacroRE.lastIndex;
										break;
									}
								}
								// Found nested <<macro>>
								else if (foundEndMacro[1] && foundEndMacro[1] === foundMacro[1]) {
									nesting += 1;
								}
							} else {
								endIndex = html.length; // No end found, assume rest of passage.
							}
						} while (foundEndMacro);
					}
					macro = (desc.hooked ? HookMacroInstance : MacroInstance)
						.create(html, foundMacro[1], foundMacro.index, endIndex);
					// Run the callback
					callback(macro);
					macroRE.lastIndex = endIndex;
				}
			} while (foundMacro);
		},

		// Stub function to be replaced by macrolib's render()
		render: $.noop
	};

	// This replaces unknown or incorrect macros.
	Macros.add("unknown", {
		selfClosing: true,
		fn: function () {
			return this.error("Unknown macro: " + this.name, true);
		}
	});

	// This replaces passage text that Marked cannot render.
	Macros.add("rendering-error", {
		selfClosing: true,
		fn: function () {
			return this.error("The passage code couldn't be rendered!\n" + this.rawArgs, true);
		}
	});
	Utils.log("Macros module ready!");
	return Object.freeze(Macros);
});
