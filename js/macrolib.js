define(['jquery', 'story', 'script', 'state', 'macros', 'engine'], function($, story, script, state, macros, engine)
{
	"use strict";
	/*
		macrolib: Twine macro standard library.
		Modifies the 'macros' and 'engine' modules only.
	*/
	
	/*
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
	
	/*
		Basic Macros
	*/
	
	// <<set ... >>
	// rawArgs: expression to execute, converting operators first.
	macros.add("set", {
		selfClosing: true,
		fn: function()
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
		}, 
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<print ... >>
	// rawArgs: expression to execute and print, converting operators first.
	macros.add("print", {
		selfClosing: true,
		fn: function()
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
		}, 
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	// <<nobr>> ... <</nobr>>
	// Remove line breaks from contained passage text.
	// Suggested by @mcclure111, for use with complex macro sets.
	// Manual line breaks can be inserted with <br>.
	macros.add("nobr",{
		fn: function()
		{
			// To prevent keywords from being created by concatenating lines,
			// replace the line breaks with a zero-width non-joining space.
			return this.HTMLcontents.replace(/\\n/,"&zwnj;");
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	// <<script>> ... <</script>>
	// contents: JS to execute.
	// If it is named, then it is deferred until an event occurs that names it.
	macros.add("script", {
		fn: function(name)
		{
			if (name)
			{
				state.addScript(name, script.eval, [this.contents]);
			}
			else try
			{
				// Eval this in the context of the script object,
				// where the Twinescript API is.
				script.eval.call(this.el, this.contents, this.top);
				return this.clear();
			}
			catch (e)
			{
				return this.error('<<script>> error: '+e.message);
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
	macros.add("style", {
		fn: function()
		{
			var selector = 'style#macro';
			if ($(selector).length == 0)
			{
				$('head').append($('<style id="macro"></style>'));
			}
			$(selector).text(this.contents);
			return this.clear();
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});

	// <<if ... >> ... <</if>>
	// rawArgs: expression to determine whether to display.
	macros.add("if", {
		fn: function()
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
		}, 
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	// <<else>>, <<else if ...>>, <<elseif ...>>
	// Used inside <<if>>
	macros.supplement(["else","elseif"], { selfClosing: true }, "if");
	
	// <<display ... >>
	// rawArgs: expression to evaluate to determine the passage name.
	macros.add("display", {
		selfClosing: true,
		fn: function()
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
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	/*
		Scoped Macros
	*/
	
	macros.extendMacroProto("setScope", function(name, setAttr)
	{
		var r;
		
		if (name.wordarray)
		{
			this.scope = name;
		}
		else if (name.jquery)
		{
			this.scope = script.createWordArray(name);
		}
		else if (typeof name === "string")
		{
			r = this.scopeType(name);
			if (r[0] === "jquery")
			{
				this.scope = script.createWordArray($(r[1]));
			}
			// Word selector "..."
			else if (r[0] === "wordarray")
			{
				this.scope = script.Text(r[1], this.top);
			}
			// Hook
			else if (r[0] === "hook")
			{
				if (setAttr)
				{
					this.el.attr("data-hook", name);
				}
				this.scope = script.createWordArray($(".hook[data-hook=" + r[1] + "]", this.top));
			}
		}
		else
		{
			this.scope = script.createWordArray(this.top);
		}
	});
	
	macros.extendMacroProto("getScope", function()
	{
		var c; c = this.contextNearest(["with", "onclick"]);
		if (c && c.scope)
		{
			return c.scope;
		}
		else return this.top;
	});
	
	// <<with ... >> ... <</with>>
	// Select a WordArray or jQuery on which "scoped macros" can be performed.
	macros.add("with", {
		scoping: true,
		fn: function(a)
		{
			this.setScope(a, true);
			return this.HTMLcontents;
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	// <<time ... >> ... <</time>>
	// Perform the enclosed macros after the time has passed.
	macros.add("time", {
		scoping: true,
		fn: function(a, time)
		{
			if (!this.ready)
			{
				this.ready = true;
				time = this.cssTimeUnit(time);
				// TODO: Check for memory leak potential
				setTimeout(function() {
					if ($('html').find(this.el).length > 0)
					{
						engine.renderMacro(this);
					}
				}.bind(this), time);
			}
			else
			{
				this.setScope(a, true);
				return this.HTMLcontents;
			}
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	/*
		Common function of deferred scoping macros.
	*/
	// Generate a unique copy for each macro.
	function deferredScopingMacroFn()
	{
		return function(a)
		{
			if (!this.ready)
			{
				if (this.scopeType(a)[0] === "hook")
				{
					this.el.attr("data-hook", a);
				}
				this.ready = true;
				this.el.data("action", function() {
					engine.renderMacro(this);
				}.bind(this));
				// Keep it around
				return "&zwnj;";
			}
			else
			{
				this.setScope(a, false);
				// Consume the hook
				this.scope.unhook();
				return this.HTMLcontents;
			}
		};
	};
	
	engine.addHookHandler({
		name: "click",
		event: "click",
		hookClass: "link hook-link"
	});
	
	// <<click ... >> ... <</onclick>>
	// Perform the enclosed macros when the scope is clicked.
	macros.add("click", {
		scoping: true,
		fn: deferredScopingMacroFn(),
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	engine.addHookHandler({
		name: "mouseover",
		event: "mouseenter",
		hookClass: "hook-hover"
	});
	
	// <<onmouseover ... >> ... <</onmouseover>>
	// Perform the enclosed macros when the scope is moused over.
	macros.add("mouseover", {
		scoping: true,
		fn: deferredScopingMacroFn(),
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	engine.addHookHandler({
		name: "mouseout",
		event: "mouseleave",
		hookClass: "hook-mouseout"
	})
	
	// <<onmouseout ... >> ... <</onmouseout>>
	// Perform the enclosed macros when the scope is moused away.
	macros.add("mouseout", {
		scoping: true,
		fn: deferredScopingMacroFn(),
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	/*
		Scope-affecting macros
	*/

	/*
		Common function of scope macros, which wraps around an inner function (innerFn)
		that should also be defined for the macro.
		
		Generate a unique function object for each macro.
	*/
	function scopeMacroFn()
	{
		return function(a)
		{
			this.scope = (a ? this.setScope(a, false) : this.getScope());
			
			if (this.scope && this.scope.wordarray)
			{
				if (this.data.innerFn && (typeof this.data.innerFn === "function"))
				{
					this.data.innerFn.apply(this, arguments);
				}
				return this.clear();
			}
			return this.error("<<" + this.name + ">> error: no scope was found.");
		};
	};
	
	// <<replace [...] >> ... <</replace>>
	// A scoped macro that replaces the scope element(s) with its contents.
	
	macros.add("replace", {
		scoped: true,
		fn: scopeMacroFn(),
		innerFn: function(scope)
		{
			this.scope.replace(this.HTMLcontents);
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	// <<append [...] >> ... <</append>>
	// Similar to replace, but appends the contents to the scope(s).
	macros.add("append", {
		scoped: true, 
		fn: scopeMacroFn(),
		innerFn: function(scope)
		{
			this.scope.append(this.HTMLcontents);
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
	
	// <<remove [...] >>
	// Removes the scope(s).
	macros.add("remove", {
		scoped: true, 
		selfClosing: true,
		fn: scopeMacroFn(),
		innerFn: function(scope)
		{
			this.scope.remove();
		},
		version: {
			major: 0,
			minor: 0,
			revision: 0
		}
	});
});