define(['jquery', 'story', 'script', 'macros', 'wordarray', 'macroinstance', 'engine', 'utils'], function($, Story, Script, Macros, WordArray, MacroInstance, Engine, Utils) {
	"use strict";
	/*
		MacroLib
		Twine macro standard library.
		Modifies the Macros module only. Exports nothing.
	*/

	/*
		MACRO FUNCTION API:
		
		function arguments: each of this.args.
		this.call: string containing the unescaped macro call, eg. "<<set escaped = false>>"
		this.name: string name of the macro, eg. "set".
		this.rawArgs: string containing the unescaped untrimmed arguments, eg. " escaped = false".
		this.args: array of unescaped argument strings in the call. eg. [ "escaped", "=", "false" ]
		this.contents: string containing the code between the open tag and close tag, if any.
		
		this.el: jQuery-wrapped destination <span>.
		this.context: the macro instance which caused this macro to be rendered, or null if it's the top passage.
		this.top: jQuery object for the entire passage in which this is located.
		this.data: the macro's function.
		this.scope: the scope WordArray, if this is a scoped macro.
		
		this.error(text, noprefix): adds the 'error' class to the element, and attaches the message. noprefix indicates whether to
			not prepend "<<" + this.name + ">> error: " to the given text.
		this.clear(): removes the destination element, unless in debug mode.
		this.convertOperators(args): used for 'code' macros like <<set>> and <<print>>.
		this.contextQuery(name): searches back through the context chain to find macro instances of a specific name.
		
		return value: 
			- string of Twine code to be rendered, whose resultant HTML will
			replace the contents of this.el.
				OR
			- null, whereupon this.el will be removed.
	*/

	var revisionTypes = ["replace", "append", "prepend"],
		interactionTypes = ["click", "mouseover", "mouseout"],
		i, j;

	/*
		Extend MacroInstance
		This has to be done because of a circular requirement:
		MacroInstance -needs-> Engine -needs-> Macros -needs-> MacroInstance
		Engine is available here, but not in the MacroInstance module.
	*/

	$.extend(MacroInstance, {
		/**
			Render a section of Twine code into the macro's element, without replacing
			the existing content.
			@method render
			@param {String} code The Twine code to render.
			@param {Boolean} prepend Whether to prepend or append the code.
			@return {Boolean} Whether any content was actually inserted.
		*/
		render: function (code, prepend) {
			var result = Engine.render(code + '', this, this.top);
			if (result) {
				prepend ? this.el.prepend(result) : this.el.append(result);
				Utils.transitionIn(result, "fade-in");
				Engine.updateEnchantments(this.top);
			}
			return !!result;
		}
	});

	/*
		Basic Macros
	*/

	// <<set ... >>
	// rawArgs: expression to execute, converting operators first.
	Macros.add("set", {
		selfClosing: true,
		fn: function (variable, rawTo) {
			var to, value;

			if (!rawTo) {
				return this.error("too few arguments.");
			}
			if (!(/to|(?:[+\-\%\&\|\^\/\*]|<<|>>)?=/.test(rawTo))) {
				return this.error("second argument '" + rawTo + "' is not 'to', '+=' or similar.");
			}

			try {
				Script.environ(this.top).evalStatement(
					// the variable
					variable,
					// the operator
					rawTo,
					// the value
					this.rawArgs.slice(this.rawArgs.indexOf(rawTo) + rawTo.length)
				);
				this.clear();
			} catch (e) {
				this.error(e.message);
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<run ... >>
	// A silent <<print>>, designed to execute one-line functions.
	// rawArgs: expression to execute, converting operators first.
	Macros.add("run", {
		selfClosing: true,
		fn: function () {
			try {
				Script.environ(this.top).evalExpression(this.rawArgs);
			} catch (e) {
				this.error(e.message);
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<print ... >>
	// rawArgs: expression to execute and print, converting operators first.
	Macros.add("print", {
		selfClosing: true,
		fn: function () {
			try {
				this.render(Script.environ(this.top).evalExpression(this.rawArgs));
			} catch (e) {
				this.error(e.message);
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<nobr>> ... <</nobr>>
	// Remove line breaks from contained passage text.
	// Manual line breaks can be inserted with <br>.
	Macros.add("nobr", {
		fn: function () {
			// To prevent keywords from being created by concatenating lines,
			// replace the line breaks with a zero-width space.
			this.render(this.contents.replace(/\n/g, "&zwnj;"));
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<script>> ... << /script>>
	// contents: JS to execute.
	Macros.add("script", {
		fn: function () {
			// Coerce the element into a WordArray
			var el = WordArray.create(this.el.find(Utils.charSpanSelector));
			
			try {
				// Eval this in the context of the script object,
				// where the Twinescript API is.
				Script.environ(this.top).evalStatement.call(el, this.contents);
				this.clear();
			} catch (e) {
				this.error(e.message);
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<style>> ... <</style>>
	// Insert the enclosed raw CSS into a <script> tag that exists for the
	// duration of the current passage only.
	// contents: raw CSS.
	Macros.add("style", {
		fn: function () {
			var selector = 'style#macro';
			if ($(selector).length == 0) {
				$(document.head).append($('<style id="macro">'));
			}
			$(selector).text(this.contents);
			this.clear();
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<if ... >> ... <</if>>
	// rawArgs: expression to determine whether to display.
	Macros.add("if", {
		fn: function () {
			var code = this.contents,
				args = [this.rawArgs],
				contents = [],
				lastIndex = 0,
				i;

			// Search for <<else>>s, collect sets of contents
			Macros.matchMacroTag(code, "else|elseif", function (m) {
				contents.push(code.slice(lastIndex, m.startIndex));
				// Strip "if" from <<else if>>
				var expr = m.rawArgs.replace(/^\s*if\b/, '');
				expr = expr || "true";
				args.push(expr);
				lastIndex = m.startIndex;
			});
			contents.push(code.slice(lastIndex));

			// Now, run through them all until you find a true arg.
			for (i = 0; i < args.length; i += 1) {
				try {
					var result = Script.environ(this.top).evalExpression(args[i]);
					if (result) {
						this.render(contents[i]);
						return;
					}
				} catch (e) {
					this.error('<<' + (i == 0 ? 'if' : 'else if') + '>> error: ' + e.message.message, true);
					return;
				}
			}
			this.el.addClass("false-if");
			this.clear();
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	// <<else>>, <<else if ...>>, <<elseif ...>>
	// Used inside <<if>>
	Macros.supplement(["else", "elseif"], {
		selfClosing: true
	}, "if");

	// <<display ... >>
	// rawArgs: expression to evaluate to determine the passage name.
	Macros.add("display", {
		selfClosing: true,
		fn: function () {
			try {
				var name = Script.environ(this.top).evalStatement(this.rawArgs);
				// Test for existence
				if (!Story.passageNamed(name)) {
					this.error('Can\'t <<display>> passage "' + name + '"', true);
					return;
				}
				// Test for recursion
				if (this.contextQuery("display").filter(function (e) {
					return e.el.filter("[display='" + name + "']").length > 0;
				}).length >= 5) {
					this.error('<<display>> loop: "' + name + '" is displaying itself 5+ times.', true);
					return;
				}
				this.el.attr("display", name);
				this.render(Story.passageNamed(name).html());
			} catch (e) {
				this.error(e.message);
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<time ... >> ... <</time>>
	// Perform the enclosed macros after the delay has passed.
	// If multiple delay are given, run the macro multiple times,
	// using each delay in order.
	Macros.add("time", {
		fn: function () {
			var delays = [].concat(Utils.cssTimeUnit(this.args)),
				timeMacroTimeout;

			if (delays.length) {
				timeMacroTimeout = function () {
					if ($(document.documentElement).find(this.el).length > 0) {
						this.desc.delayedFn ? this.desc.delayedFn.call(this) : this.render(this.contents);
						// Re-run the timer with the next number.
						if (delays.length) {
							window.setTimeout(timeMacroTimeout, delays.shift());
						}
					}
				}.bind(this);
				window.setTimeout(timeMacroTimeout, delays.shift());
			} else {
				this.error("'" + this.rawArgs + "' isn't " + (delays.length <= 1 ? "a " : "") + "valid time delay" + (delays.length >
					1 ? "s" : ""));
				return;
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<key ... >> ... <</key>>
	// Perform the enclosed macros after the given keyboard letter is pushed
	/*Macros.add("key", {
		deferred: true,
		fn: function(key) {
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});*/

	// <<click ... >> ... <</click>>
	// Perform the enclosed macros when the scope is clicked.
	Macros.add("click", {
		hooked: true,
		enchantment: {
			event: "click",
			once: true,
			rerender: "replace",
			classList: "link enchantment-link"
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<mouseover ... >> ... <</mouseover>>
	// Perform the enclosed macros when the scope is moused over.
	Macros.add("mouseover", {
		hooked: true,
		enchantment: {
			event: "mouseenter",
			once: true,
			rerender: "replace",
			classList: "enchantment-mouseover"
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<mouseout ... >> ... <</mouseout>>
	// Perform the enclosed macros when the scope is moused away.
	Macros.add("mouseout", {
		hooked: true,
		enchantment: {
			event: "mouseleave",
			once: true,
			rerender: "replace",
			classList: "enchantment-mouseout"
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	/*// <<hover ... >> ... <</hover>>
	// Perform the enclosed macros when the scope is moused over.
	Macros.add("hover", {
		hooked: true,
		enchantment: {
			event: "mouseenter",
			once: false,
			classList: "enchantment-hover",
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});*/

	/*
		Revision macros
	*/

	// <<replace [...] >> ... <</replace>>
	// A macro that replaces the scope element(s) with its contents.

	Macros.add("replace", {
		hooked: true,
		fn: function () {
			this.reducedScope().replace(Engine.render.bind(null, this.contents), this.transitionSelector());
			Engine.updateEnchantments(this.top);
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<append [...] >> ... <</append>>
	// Similar to replace, but appends the contents to the scope(s).
	Macros.add("append", {
		hooked: true,
		fn: function () {
			this.reducedScope().append(Engine.render.bind(null, this.contents), this.transitionSelector());
			Engine.updateEnchantments(this.top);
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<prepend [...] >> ... <</prepend>>
	// Similar to replace, but prepends the contents to the scope(s).
	Macros.add("prepend", {
		hooked: true,
		fn: function () {
			this.reducedScope().prepend(Engine.render.bind(null, this.contents), this.transitionSelector());
			Engine.updateEnchantments(this.top);
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<remove [...] >>
	// Removes the scope(s).
	Macros.add("remove", {
		hooked: true,
		selfClosing: true,
		fn: function () {
			this.reducedScope().remove();
			Engine.updateEnchantments();
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	/*
		Combos
	*/

	for (j = 0; j < revisionTypes.length; j++) {
		// Enchantment macros
		for (i = 0; i < interactionTypes.length; i++) {
			Macros.add(interactionTypes[i] + "-" + revisionTypes[j], {
				hooked: true,
				enchantment: Macros.get(interactionTypes[i]).enchantment,
				fn: Macros.get(revisionTypes[j]).fn,
				version: {
					major: 0,
					minor: 0,
					revision: 0
				}
			});
		}
		// Timed macros
		Macros.add("timed-" + revisionTypes[j], {
			hooked: true,
			fn: Macros.get("time").fn,
			delayedFn: Macros.get(revisionTypes[j]).fn,
			version: {
				major: 0,
				minor: 0,
				revision: 0
			}
		});
	};
	Utils.log("Macrolib module ready!");
});