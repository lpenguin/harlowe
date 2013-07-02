define(['jquery', 'story'], function($, story)
{
	"use strict";
	/*
	
	MACRO API:
	
	selfClosing: determines if the macro tag has contents. If false, then all subsequent code
		up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
		will be captured by this.contents.
	
	function arguments: each of this.args.
	
	this.call: string containing the unescaped macro call, eg. "<<set escaped = false>>"
	this.HTMLCall: string containing this.call as escaped HTML.
	this.name: string name of the macro, eg. "set".
	this.rawArgs: string containing the unescaped untrimmed arguments, eg. " escaped = false".
	this.args: array of unescaped argument strings in the call. eg. [ "escaped", "=", "false" ]
	this.contents: string containing the HTML between the open tag and close tag, if any.
	this.HTMLContents: string containing this.contents as escaped HTML.
	this.el: jQuery-wrapped destination <span>.
	this.context: the macro instance which caused this macro to be rendered, or null if it's the top passage.
	this.data: the macro's function.
	
	this.error(text): adds the 'error' class to the element, and attaches the message.
	this.clear(): removes the destination element, unless in debug mode.
	this.convertOperators(): used for 'code' macros like <<set>> and <<print>>.
	
	return value: 
		- string of Twine code to be rendered, whose resultant HTML will
		replace the contents of this.el.
			OR
		- null, whereupon this.el will be removed.
	*/
	
	// Register a macro definition.
	story.addMacro = function (name, selfClosing, fn, version)
	{
		fn.selfClosing = selfClosing;
		fn.version = version;
		if ($.isArray(name))
		{
			name.forEach(function(n) {
				story.macros[n] = fn;
			});
		}
		else
		{
			this.macros[name + ''] = fn;
		}
	};
	
	// Utility functions for macro instances.
	$.extend(story.macroInstance, {
	
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
		
		// This implements a small handful of more authorly JS operator replacements for <<set>> and <<print>>.
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
			expr = alter("\\bis\\s+not\\b", " != ");
			expr = alter("\\bis\\b", " == ");
			expr = alter("\\bto\\b", " = ");
			expr = alter("\\band\\b", " && ");
			expr = alter("\\bor\\b", " || ");
			expr = alter("\\bnot\\b", " ! ");
			return expr;
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
		}
	});
	
	// This replaces unknown or incorrect macros.
	story.addMacro("unknown", true, function()
	{
		return this.error("Unknown macro: " + this.name);
	});
	
	// ***
	// Standard library
	// ***
	
	// <<set ... >>
	// rawArgs: expression to execute, converting operators first.
	story.addMacro("set",true,function()
	{
		try
		{
			var args = this.convertOperators(this.rawArgs);
			eval(this.rawArgs);
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
	story.addMacro("print",true,function()
	{
		try
		{
			var args = this.convertOperators(this.rawArgs);
			return (eval(args) + '');
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
	
	// <<script>> ... <</script>>
	// contents: raw JS to execute as a closure.
	story.addMacro("script",false,function()
	{
		try
		{
			eval("(function(){" + this.contents + "}());");
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

	// <<if ... >>
	// rawArgs: expression to determine whether to display.
	story.addMacro("if",false,function()
	{
		var html = this.HTMLContents,
			args = [this.rawArgs],
			contents = [],
			lastIndex = 0, i;
		// Search for <<else>>s, collect sets of contents
		story.matchMacroTag(html, "else|elseif", function(m) {
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
				var result = eval(this.convertOperators(args[i]));
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
	story.addMacro(["else","elseif"],true,function()
	{
		if (this.context.name != "if") {
			return this.error("<<" + this.name + ">> outside <<if>>");
		}
		return this.clear();
	});
	
	// <<display ... >>
	// rawArgs: expression to evaluate to determine the passage name.
	story.addMacro("display",true,function()
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
	
});