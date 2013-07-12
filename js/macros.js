define(['jquery', 'story', 'script'], function($, story, script)
{
	"use strict";
	/*
	
	MACRO API:
	
	For end users:
	* macros.get(name) : get a registered macro function.
	* macros.add(name, selfClosing, fn, version): register a new macro.
		name: a string, or an array of strings serving as 'alias' names.
		selfClosing: determines if the macro tag has contents. If false, then all subsequent code
			up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
			will be captured by this.contents.
		version: a property set { major: Number, minor: Number, revision: number }.
	* macros.supplement(name, selfClosing, main) : register a macro which has no code, but is used as a sub-tag in another macro.
		main: name of the 'parent' macro.
		
	For other modules:
	* macros.matchMacroTag(html, callback(e) ) : perform a function for each valid macro call in the HTML.
		html: a string of escaped HTML.
		e: a MacroInstance object matching a macro invocation in the HTML.
	
	MACRO FUNCTION API:
	
	function arguments: each of this.args.
	this.call: string containing the unescaped macro call, eg. "<<set escaped = false>>"
	this.HTMLcall: string containing this.call as escaped (as in "&amp;") HTML.
	this.name: string name of the macro, eg. "set".
	this.rawArgs: string containing the unescaped untrimmed arguments, eg. " escaped = false".
	this.args: array of unescaped argument strings in the call. eg. [ "escaped", "=", "false" ]
	this.contents: string containing the HTML between the open tag and close tag, if any.
	this.HTMLcontents: string containing this.contents as escaped HTML.
	this.el: jQuery-wrapped destination <span>.
	this.context: the macro instance which caused this macro to be rendered, or null if it's the top passage.
	this.top: jQuery object for the entire passage in which this is located.
	this.data: the macro's function.
	
	this.error(text): adds the 'error' class to the element, and attaches the message.
	this.clear(): removes the destination element, unless in debug mode.
	this.convertOperators(args): used for 'code' macros like <<set>> and <<print>>.
	this.contextQuery(name): searches back through the context chain to find macro instances of a specific name.
	this.cssTimeUnit(str): converts a CSS time unit to a number of milliseconds.
	
	return value: 
		- string of Twine code to be rendered, whose resultant HTML will
		replace the contents of this.el.
			OR
		- null, whereupon this.el will be removed.
	*/
	var macroProto, macros,
		// Private collection of registered macros.
		_handlers = {};
	
	/*
		The prototype object for MacroInstances, the object type used by matchMacroTag
		and apply()ed to macro functions.
		This contains utility functions that any macro function can call on.
	*/
	macroProto = {
	
		// This is called by renderMacro() just before the macro is executed
		init: function() {
			if (story.options.debug)
			{
				this.el.attr("title", this.call);
			}
		},
	
		// Adds the 'error' class to the element.
		error: function (text) {
			this.el.addClass("error").attr("title", this.call).removeAttr("data-macro").text(text);
			return '';
		},
		
		// Removes the element, unless in debug mode
		clear: function() {
			if (story.options.debug)
			{
				return '';
			}
			return null;
		},
				
		// Searches back through the context chain to find macro instances of a specific name.
		// Returns an array of macro instances.
		contextQuery: function(name) {
			var c = this.context,
				set = [];
			while (c) {
				if (c.name == name) {
					set.unshift(c);
				}
				c = c.context;
			}
			return set;
		},
		
		// This implements a small handful of more authorly JS operators for <<set>> and <<print>>.
		// <<set hp to 3>> --> <<set hp = 3>>
		// <<if hp is 3>> --> <<if hp == 3>>
		// <<if hp is not 3>> --> <<if hp != 3>>
		// <<if not defeated>> --> <<if ! defeated>>
		convertOperators: function (expr) {
			function alter(from, to) {
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
		cssTimeUnit: function(s) {
			if (typeof s == "string") {
			  if (s.slice(-2).toLowerCase() == "ms") {
				return Number(s.slice(0, -2)) || 0;
			  }
			  else if (s.slice(-1).toLowerCase() == "s") {
				return Number(s.slice(0, -1)) * 1000 || 0;
			  }
			}
			return 0;
		}
	};
	
	// Initialise a new MacroInstance
	function createMacroInstance(html, name, startIndex, endIndex)
	{
		var macro = Object.create(macroProto), selfClosing;
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
		macro.rawArgs = macro.call.replace(/^<<\s*\w*/, '').replace(/>>[^]*/, '');
		
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
	}
	
	/*
		The object containing all the macros available to a story.
	*/
	macros = {
		
		// Get a macro.
		get: function(e)
		{
			return _handlers.hasOwnProperty(e) && _handlers[e];
		},
		
		// Register a new macro.
		// name: a string, or an array holding multiple strings.
		add: function (name, selfClosing, fn, version)
		{
			if (!stringOrArray(name))
			{
				return loaderError("Argument 1 of macros.add isn't an array or a string.");
			}
			fn.selfClosing = selfClosing;
			fn.version = version;
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
		supplement: function(name, selfClosing, main)
		{
			var errorMsg = " of macros.supplement isn't an array or a string.";
			if (!stringOrArray(name))
			{
				return loaderError("Argument " + 1 + errorMsg);
			}
			if (!stringOrArray(main))
			{
				return loaderError("Argument " + 3 + errorMsg);
			}
			var mfunc = macros.get(main);
			macros.add(name, selfClosing, function() {
				if (!this.context || main.indexOf(this.context.name) == -1) {
					return this.error("<<" + this.name + ">> is outside a"
						+ (Array.isArray(main) ? "n appropriate macro" : " <<" + main + ">>"));
				}
				return this.clear();
			}, mfunc && mfunc.version);
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
								else if (foundEndMacro[1] && foundEndMacro[1] == foundMacro[1]) { // Found nested <<macro>>
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
		}
	};
	
	// This replaces unknown or incorrect macros.
	macros.add("unknown", true, function()
	{
		return this.error("Unknown macro: " + this.name);
	});
	
	// ***
	// Standard library
	// ***
	
	// <<set ... >>
	// rawArgs: expression to execute, converting operators first.
	macros.add("set",true,function()
	{
		try
		{
			script.eval(this.convertOperators(this.rawArgs));
			return this.clear();
		}
		catch (e)
		{
			return this.error('<<set>> error: '+e.message);
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});

	// <<print ... >>
	// rawArgs: expression to execute and print, converting operators first.
	macros.add("print",true,function()
	{
		try
		{
			var args = this.convertOperators(this.rawArgs);
			return (script.eval(args) + '');
		}
		catch (e)
		{
			return this.error('<<print>> error: '+e.message);
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	
	// <<nobr>>
	// Remove line breaks from contained passage text.
	// Suggested by @mcclure111, for use with complex macro sets.
	// Manual line breaks can be inserted with <br>.
	macros.add("nobr",false,function()
	{
		// To prevent keywords from being created by concatenating lines,
		// replace the line breaks with a zero-width non-joining space.
		return this.HTMLcontents.replace(/\\n/,"&zwnj;");
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	
	// <<script>> ... <</script>>
	// contents: raw JS to execute as a closure.
	// We can't use the <script> element because it would execute immediately
	// on page load within the <div>...
	macros.add("script",false,function()
	{
		try
		{
			// Eval this in the context of the script object,
			// where the Twinescript API is.
			script.eval("(function(){" + this.contents + "}());", this.top);
			return this.clear();
		}
		catch (e)
		{
			return this.error('<<script>> error: '+e.message);
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	
	// <<style>> ... <</style>>
	// Insert the enclosed raw CSS into a <script> tag that exists for the
	// duration of the current passage only.
	// contents: raw CSS.
	// We can't use the <style> element because it would execute immediately
	// on page load within the <div>... (and is non-valid HTML, I guess.)
	macros.add("style",false,function()
	{
		var selector = 'style#macro';
		if ($(selector).length == 0)
		{
			$('head').append($('<style id="macro"></style>'));
		}
		$(selector).text(this.contents);
		return this.clear();
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});

	// <<if ... >>
	// rawArgs: expression to determine whether to display.
	macros.add("if",false,function()
	{
		var html = this.HTMLcontents,
			args = [this.rawArgs],
			contents = [],
			lastIndex = 0, i;
		// Search for <<else>>s, collect sets of contents
		macros.matchMacroTag(html, "else|elseif", function(m) {
			contents.push(html.slice(lastIndex, m.startIndex));
			// Strip "if" from <<else if>>
			var expr = m.rawArgs.replace(/^\s*if\b/,'');
			expr = expr || "true";
			args.push(expr);
			lastIndex = m.startIndex;
		});
		contents.push(html.slice(lastIndex));
		
		// Now, run through them all until you find a true arg.
		for(i = 0; i < args.length; i += 1)
		{
			try
			{
				var result = script.eval(this.convertOperators(args[i]));
				if (result) {
					return contents[i];
				}
			}
			catch (e)
			{
				return this.error('<<' + (i==0 ? 'if' : 'else if') +'>> error: '+e.message.message);
			}
		}
		this.el.addClass("false-if");
		return this.clear();
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	// <<else>>, <<else if ...>>, <<elseif ...>>
	// Used inside <<if>>
	macros.supplement(["else","elseif"], true, "if");
	
	// <<display ... >>
	// rawArgs: expression to evaluate to determine the passage name.
	macros.add("display",true,function()
	{
		try
		{
			var args = this.convertOperators(this.rawArgs),
				name = eval(args) + '';
			// Test for existence
			if (!story.passageNamed(name))
			{
				return this.error('Can\'t <<display>> passage "' + name + '"');
			}
			// Test for recursion
			if (this.contextQuery("display").filter(function(e) {
					return e.el.filter("[data-display='"+name+"']").length > 0;
				}).length >= 5)
			{
				return this.error('<<display>> loop: "' + name + '" is displaying itself 5+ times.');
			}
			this.el.attr("data-display",name);
			var ret  = story.passageNamed(name).html();
			return ret;
		}
		catch (e)
		{
			return this.error(e.message);
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	
	return macros;
});