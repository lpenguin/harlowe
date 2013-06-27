define(['jquery'], function($)
{
	"use strict";

	/*
	
	MACRO API:
	
	isVoid: determines if the macro tag has contents. If true, then all subsequent code
		up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
		will be captured by this.contents.
	
	function arguments: the string arguments in the macro tag, one by one.
	
	this.call: string containing the unescaped macro call, eg. "<<set escaped = false>>"
	this.rawArgs: string containing the unescaped untrimmed arguments, eg. " escaped = false".
	this.contents: string containing the HTML between the open tag and close tag, or "".
	this.el: the destination DOM <span> element.
	this.name: string name of the macro, eg. "set".
	
	return value: string of Twine code to be rendered, whose resultant HTML will
		replace the contents of this.el.
		
	*/
	
	var story = window.story = window.story || {};
	story.macros = window.story.macros || {};

	// Register a macro function, set isVoid,
	// and specify version numbers.
	story.addMacro = function(name, isVoid, fn, version) {
		fn.isVoid = isVoid;
		fn.version = version;
		window.story.macros[name] = fn;
	}
	
	// This replaces unknown or incorrect macros.
	story.addMacro("unknown",true,function()
	{
		$(this.el).text("Unknown macro: "+this.call);
	});
	
	// Standard library
	story.addMacro("set",true,function()
	{
		try
		{
			eval(this.rawArgs);
			return '';
		}
		catch (e)
		{
			return e.message;
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});

	story.addMacro("print",true,function()
	{
		try
		{
			return (eval(this.rawArgs) + '');
		}
		catch (e)
		{
			return e.message;
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
	
	story.addMacro("script",false,function()
	{
		try
		{
			eval(this.contents);
		}
		catch (e)
		{
			return e.message;
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});

	story.addMacro("if",false,function()
	{
		try
		{
			if (eval(this.rawArgs)) {
				//console.log(this.rawArgs+" = TRUE!");
				return this.contents;
			}
			//console.log(this.rawArgs+" = FALSE!");
		}
		catch (e)
		{
			return e.message;
		}
	}, {
		major: 0,
		minor: 0,
		revision: 0
	});
});