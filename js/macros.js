define(['jquery', 'story'], function($, story)
{
	"use strict";
	/*
	
	MACRO API:
	
	selfClosing: determines if the macro tag has contents. If false, then all subsequent code
		up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
		will be captured by this.contents.
	
	function arguments: the string arguments in the macro tag, one by one.
	
	this.call: string containing the unescaped macro call, eg. "<<set escaped = false>>"
	this.rawArgs: string containing the unescaped untrimmed arguments, eg. " escaped = false".
	this.contents: string containing the HTML between the open tag and close tag, or "".
	this.HTMLCall: string containing this.call as escaped HTML
	this.HTMLContents: string containing this.contents as escaped HTML
	this.el: the destination DOM <span> element.
	this.name: string name of the macro, eg. "set".
	this.data: the macro's definition object.
	
	return value: string of Twine code to be rendered, whose resultant HTML will
		replace the contents of this.el.
		
	*/
	
	// Register a macro definition.
	story.addMacro = function (name, selfClosing, fn, version)
	{
		fn.selfClosing = selfClosing;
		fn.version = version;
		this.macros[name] = fn;
	};
	
	// Utility functions for macro instances.
	$.extend(story.macroInstance, {
	
		// Adds the 'error' class to the element.
		error: function (text) {
			$(this.el).addClass("error").text(text);
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
				var re = "(?=(?:[^\"'\\\\]*(?:\\\\.|['\"](?:[^\"'\\\\]*\\\\.)*[^\"'\\\\]*['\"]))*[^'\"]*$)";
				return expr.replace(new RegExp(from + re,"gi"), to);
			}
			expr = alter("\\bis\\s+not\\b", " != ");
			expr = alter("\\bis\\b", " == ");
			expr = alter("\\bto\\b", " = ");
			expr = alter("\\band\\b", " && ");
			expr = alter("\\bor\\b", " || ");
			expr = alter("\\bnot\\b", " ! ");
			return expr;
		}
	});
	
	// This replaces unknown or incorrect macros.
	story.addMacro("unknown", true, function()
	{
		$(this.el).text("Unknown macro: " + this.call);
	});
	
	// Standard library
	
	// <<set ... >>
	// rawArgs: expression to execute, converting operators first.
	story.addMacro("set",true,function()
	{
		try
		{
			var args = this.convertOperators(this.rawArgs);
			eval(this.rawArgs);
			return '';
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
		//try
		//{
			eval("(function(){" + this.contents + "}());");
			return '';
		/*}
		catch (e)
		{
			return this.error('<<script>> error: '+e.message);
		}*/
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});

	// <<if ... >>
	// rawArgs: expression to determine whether to display.
	story.addMacro("if",false,function()
	{
		try
		{
			var co = this.convertOperators,
				html = this.HTMLContents,
				args = co(this.rawArgs),
				contents = "",
				clauses = [],
				lastIndex = 0,
				error = "",
				expr = "";
			var result = eval(co(this.rawArgs));
			//console.log("<<if>> result for "+this.rawArgs+" : "+result);
			if (result)
				return this.HTMLContents;
		}
		catch (e)
		{
			return this.error('<<if>> error: '+e.message);
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
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
			if ($(this.el).closest("[data-display='" + name + "']").length > 4)
			{
				return this.error('<<display>> loop: "' + name + '" is displaying itself 5+ times.');
			}
			this.el.setAttribute("data-display",name);
			return story.passageNamed(name).html();
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