define(['jquery', 'story', 'state', 'utils', 'wordarray'], function($, story, state, utils, WordArray)
{
	"use strict";
	/*
	
	MACRO API:
	
	For end users:
	* macros.get(name) : get a registered macro function.
	* macros.add(descriptor): register a new macro.
		name: a string, or an array of strings serving as 'alias' names.
		descriptor is a map of the following:
			selfClosing: determines if the macro tag has contents. If false, then all subsequent code
				up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
				will be captured by this.contents.
			scoping: targets a particular scope, which is to say, causes all macros within to apply
				solely to the scope it sets.
			version: a property set { major: Number, minor: Number, revision: number }.
	* macros.supplement(name, selfClosing, main) : register a macro which has no code, but is used as a sub-tag in another macro.
		main: name of the 'parent' macro.
		
	For other modules:
	* macros.matchMacroTag(html, callback(e) ) : perform a function for each valid macro call in the HTML.
		html: a string of escaped HTML.
		e: a MacroInstance object matching a macro invocation in the HTML.
	
	*/
	var macroProto, macros,
		// Private collection of registered macros.
		_handlers = {};
	
	/*
		The prototype object for MacroInstances, the object type used by matchMacroTag
		and apply()ed to macro functions.
		This contains utility functions that any macro function can call on.
	*/
	macroProto = utils.lockProperties({
	
		// This is called by renderMacro() just before the macro is executed
		init: function()
		{
			if (story.options.debug)
			{
				this.el.attr("title", this.call);
			}
		},
	
		// Adds the 'error' class to the element.
		error: function (text)
		{
			this.el.addClass("error").attr("title", this.call).removeAttr("data-macro").text(text);
			return '';
		},
		
		// Removes the element, unless in debug mode
		clear: function()
		{
			if (story.options.debug)
			{
				return '';
			}
			return null;
		},
		
		// Searches back through the context chain to find macro instances of a specific name, or an array of names.
		// Returns an array of macro instances, sorted from nearest to farthest.
		contextQuery: function(name)
		{
			var c = this.context,
				set = [];
			while (c)
			{
				if (!name || ((Array.isArray(name)) ? ~~name.indexOf(c.name) : (c.name === name)))
				{
					set.push(c);
				}
				c = c.context;
			}
			return set;
		},
		
		contextNearest: function(name)
		{
			var a = this.contextQuery(name);
			
			if (a.length)
			{
				return a[0];
			}
		},
		
		// Get the scope, if it is a scoped macro.
		getScope: function()
		{
			var i, c = this.contextQuery();
			for (i = 0; i < c.length; i += 1)
			{
				if (c[i] && c[i].data && c[i].data.scoping && c[i].scope)
				{
					return c[i].scope;
				}
			}
			return this.top;
		},
		
		// Set the scope, if it is a scoped macro.
		setScope: function(name)
		{
			this.scope = WordArray.create(name, this.top);
		},
		
		// This implements a small handful of more authorly JS operators for <<set>> and <<print>>.
		// <<set hp to 3>> --> <<set hp = 3>>
		// <<if hp is 3>> --> <<if hp == 3>>
		// <<if hp is not 3>> --> <<if hp != 3>>
		// <<if not defeated>> --> <<if ! defeated>>
		convertOperators: function (expr)
		{
			function alter(from, to)
			{
				// This regexp causes its preceding expression to only match entities outside of quotes,
				// taking into account escaped quotes.
				var re = "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)";
				return expr.replace(new RegExp(from + re,"gi"), to);
			}
			if (typeof expr === "string")
			{
				expr = alter("\\bis\\s+not\\b", " !== ");
				expr = alter("\\bis\\b", " === ");
				expr = alter("\\bto\\b", " = ");
				expr = alter("\\band\\b", " && ");
				expr = alter("\\bor\\b", " || ");
				expr = alter("\\bnot\\b", " ! ");
			}
			return expr;
		},
		
		// Takes a string argument, expressed as a CSS time,
		// and returns the time in milliseconds that it equals.
		cssTimeUnit: function(s)
		{
			if (typeof s == "string")
			{
			  if (s.slice(-2).toLowerCase() == "ms")
			  {
				return Number(s.slice(0, -2)) || 0;
			  }
			  else if (s.slice(-1).toLowerCase() == "s")
			  {
				return Number(s.slice(0, -1)) * 1000 || 0;
			  }
			}
			return 0;
		}
	});
	
	// Private factory method
	function createMacroInstance(html, name, startIndex, endIndex)
	{
		var selfClosing,
			macro = Object.create(macroProto);
		
		macro.name = name;
		macro.data = _handlers[name];
		macro.startIndex = startIndex;
		macro.endIndex = endIndex;
		selfClosing = macro.data && macro.data.selfClosing;
		
		// HTMLcall / call is the entire macro invocation, rawArgs is all arguments,
		// HTMLcontents / contents is what's between a <<macro>> and <</macro>> call
		macro.HTMLcall = html.slice(startIndex, endIndex);
		macro.HTMLcontents = (selfClosing ? "" : macro.HTMLcall.replace(/^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/i, '').replace(/&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$/i, ''));
		
		// unescape HTML entities (like "&amp;")
		macro.call = $('<p>').html(macro.HTMLcall).text();
		macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i, ''));
		macro.rawArgs = macro.call.replace(/^<<\s*\w*\s*/, '').replace(/\s*>>[^]*/, '');
		
		// tokenize arguments
		// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
		// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
		macro.args = macro.rawArgs.trim().split(/\ (?=(?:[^"'\\]*(?:\\.|'(?:[^'\\]*\\.)*[^'\\]*'|"(?:[^"\\]*\\.)*[^"\\]*"))*[^'"]*$)/)
			// remove opening and closing quotes from args
			.map(function(e) {
				return e.replace(/^(['"])([^]*)\1$/, function(a,b,c) { return c; });
			});
		return macro;
	};
	
	// Report an error when a user-loaded macro fails.
	function loaderError(text)
	{
		// TODO: Instead of a basic alert, display a notification banner somewhere.
		window.alert(text);
		return true;
	};
	
	// Used by macros.add() and macros.supplement()
	function stringOrArray(n)
	{
		return (typeof n === "string" || Array.isArray(n));
	};
	
	/*
		Common function of scope macros, which wraps around an inner function (innerFn)
		that should also be defined for the macro.
	*/
	function scopeMacroFn(innerFn)
	{
		return function(a)
		{
			this.scope = (a ? this.setScope(a) : this.getScope());
			
			if (this.scope && this.scope.wordarray)
			{
				if (innerFn && (typeof innerFn === "function"))
				{
					innerFn.apply(this, arguments);
				}
				return this.clear();
			}
			return this.error("<<" + this.name + ">> error: no scope was found.");
		};
	};
	
	/*
		The object containing all the macros available to a story.
		Should remain extensible.
	*/
	macros = Object.freeze({
		
		// Get a macro.
		get: function(e)
		{
			return _handlers.hasOwnProperty(e) && _handlers[e];
		},
		
		// Register a new macro.
		// name: a string, or an array holding multiple strings.
		add: function (name, desc)
		{
			var fn;
			if (!stringOrArray(name))
			{
				return loaderError("Argument 1 of macros.add isn't an array or a string.");
			}
			if (!(desc && typeof desc === "object" && desc.fn && typeof desc.fn === "function"))
			{
				return loaderError("Argument 2 of macros.add (\"" + name + "\") isn't a valid or complete descriptor.");
			}
			fn = desc.fn;
			delete desc.fn;
			
			// Scoped macro? Wrap its function in a scope-checking wrapper.
			if (desc.scoped)
			{
				fn = scopeMacroFn(fn);
			}
			
			$.extend(fn,desc);
			if (Array.isArray(name))
			{
				name.forEach(function(n) {
					_handlers[n] = fn;
				});
			}
			else
			{
				_handlers[name + ''] = fn;
			}
		},

		// Register a macro that appears internally in another macro (i.e <<endif>> for <<if>>)
		// name: a string, or an array holding multiple names.
		// main: a string or an array.
		supplement: function(name, desc, main)
		{
			var mfunc,
				errorMsg = " of macros.supplement isn't an array or a string.",
				selfClosing = desc.selfClosing;
			
			// Type checking
			if (!stringOrArray(name))
			{
				return loaderError("Argument " + 1 + errorMsg);
			}
			if (!stringOrArray(main))
			{
				return loaderError("Argument " + 3 + errorMsg);
			}
			// Get the main macro's data
			mfunc = macros.get(main);
			// Define a function for the supplement
			desc.fn = function() {
				if (!this.context || ~~main.indexOf(this.context.name))
				{
					return this.error("<<" + this.name + ">> is outside a"
						+ (Array.isArray(main) ? "n appropriate macro" : " <<" + main + ">>"));
				}
				return this.clear();
			};
			if (mfunc && mfunc.version)
			{
				desc.version = mfunc.version;
			}
			macros.add(name, desc);
		},

		// Performs a function for each macro instance found in the HTML.
		// macroname is a regex string specifying a particular name, otherwise all are found.
		// Callback function's argument is a macro instance.
		matchMacroTag: function(html, macroname, callback)
		{
			var macroRE = new RegExp("&lt;&lt;\\s*(" + (macroname || "\\w+") + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;",'ig'),
				macro, endMacroRE, foundMacro, foundEndMacro, nesting, selfClosing,
				endIndex, data;
			// Search through html for macro tags
			do 
			{
				foundMacro = macroRE.exec(html);
				if (foundMacro !== null)
				{
					endIndex = macroRE.lastIndex;
					data = this.get(foundMacro[1]);
					selfClosing = true;

					// If macro is not self-closing, search for endtag
					// and capture entire contents.
					if (data && !data.selfClosing)
					{
						selfClosing = false;
						endMacroRE = new RegExp(macroRE.source + "|&lt;&lt;((?:\\/|end)"
							+ foundMacro[1] + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;","g");
						endMacroRE.lastIndex = endIndex;
						nesting = 0;
						do {
							foundEndMacro = endMacroRE.exec(html);
							if (foundEndMacro !== null)
							{
								if (foundEndMacro[2])
								{ // Found <</macro>>
									if (nesting)
									{
										nesting -= 1;
									} 
									else
									{
										endIndex = endMacroRE.lastIndex;
										break;
									}
								}
								else if (foundEndMacro[1] && foundEndMacro[1] === foundMacro[1]) { // Found nested <<macro>>
									nesting += 1;
								}
							}
							else {
								endIndex = html.length; // No end found, assume rest of passage.
							}
						} while (foundEndMacro);
					}
					macro = createMacroInstance(html, foundMacro[1], foundMacro.index, endIndex);
					// Run the callback
					callback(macro);
					macroRE.lastIndex = endIndex;
				}
			} while (foundMacro);
		},
		
		// Extend MacroProto without overwriting previous insertions.
		// Currently unused.
		extendMacroProto: function(name, value)
		{
			if (macroProto[name] === undefined)
			{
				Object.defineProperty(macroProto, name, {
					value: value,
					enumerable: true
				});
				return true;
			}
			return false;
		}
	});
	
	// This replaces unknown or incorrect macros.
	macros.add("unknown", {
		selfClosing: true,
		fn: function()
		{
			return this.error("Unknown macro: " + this.name);
		}
	});
	
	return macros;
});