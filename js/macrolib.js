define(['jquery', 'story', 'script', 'state', 'macros'], function($, story, script, state, macros)
{
	"use strict";
	/*
		macrolib: Twine macro standard library
		modifies the macros module only.
	*/
	
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
	// If it is named, then it is deferred until an event occurs that names it.
	macros.add("script",false,function(name)
	{
		if (name)
		{
			state.addScript(name, this.contents);
		}
		else try
		{
			// Eval this in the context of the script object,
			// where the Twinescript API is.
			script.eval(this.el, this.contents, this.top);
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
});