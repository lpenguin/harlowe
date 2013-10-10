define(['jquery', 'story', 'utils', 'wordarray'], function($, Story, Utils, WordArray)
{
	"use strict";
	/*
		MacroInstance
		Object representing a single macro instantiation.
	*/
	
	var MacroInstance,
		// Precompile a regex
		macroTagFront = new RegExp("^<<\\s*" + Utils.regexStrings.macroName + "\\s*");
		
	
	// Sub-function of MacroInstance.convertOperators
	function alter(expr, from, to)
	{
		return expr.replace(new RegExp(from + Utils.regexStrings.unquoted, "gi"), to);
	}
	
	/*
		The prototype object for MacroInstances, the object type used by matchMacroTag
		and apply()ed to macro functions.
		This contains utility functions that any macro function can call on.
	*/
	MacroInstance = {
		
		create: function(html, name, startIndex, endIndex)
		{
			var selfClosing,
				macro = Object.create(this);
			
			macro.name = name;
			macro.desc = MacroInstance.getMacroData(name);
			macro.startIndex = startIndex;
			macro.endIndex = endIndex;
			selfClosing = macro.desc && macro.desc.selfClosing;
			
			// HTMLcall / call is the entire macro invocation, rawArgs is all arguments,
			// HTMLcontents / contents is what's between a <<macro>> and <</macro>> call
			macro.HTMLcall = html.slice(startIndex, endIndex);
			macro.HTMLcontents = (selfClosing ? ""
				: macro.HTMLcall.replace(/^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/i, '').replace(/&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$/i, ''));
			
			// unescape HTML entities ("&amp;" etc.)
			macro.call = $('<p>').html(macro.HTMLcall).text();
			macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i, ''));
			macro.rawArgs = macro.call.replace(macroTagFront, '').replace(/\s*>>[^]*/, '').trim();
			
			// tokenize arguments
			// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
			// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
			macro.args = Utils.splitUnquoted(macro.rawArgs);
			
			// Only to be used for apply()ing to desc.fn or another function.
			// Removes opening and closing quotes from args
			macro.applyArgs = macro.args.map(function(e) {
				return e.replace(/^(['"])([^]*)\1$/, function(a,b,c) { return c; });
			});
			return macro;
		},
		
		// This is called by renderMacro() just before the macro is executed
		init: function()
		{
			if (Story.options.debug)
			{
				this.el.attr("title", this.call);
			}
		},
		
		// Render a macro naturally found in the passage.
		run: function(span, context, top)
		{
			if (this.desc)
			{
				this.el = span;
				this.context = context;
				this.top = top;
				this.init && (this.init());
				this.desc.fn.apply(this, this.applyArgs);
			}
			else
			{
				span.addClass('error').html('No macro named ' + this.name);
			}
		},
	
		// Outputs an error to the macro's element.
		error: function (text, noprefix)
		{
			this.el.addClass("error").attr("title", this.call).removeAttr("data-macro").text( (noprefix ? "" : "<<" + this.name + ">> error: ") + text);
		},
		
		// Remove the macro's element, unless in debug mode
		clear: function()
		{
			if (!Story.options.debug)
			{
				this.el.remove();
			}
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
		
		// This implements a small handful of more authorly JS operators for <<set>> and <<print>>.
		// <<set hp to 3>> --> <<set hp = 3>>
		// <<if hp is 3>> --> <<if hp == 3>>
		// <<if hp is not 3>> --> <<if hp != 3>>
		// <<if not defeated>> --> <<if ! defeated>>
		convertOperators: function (expr, setter)
		{
			if (typeof expr === "string")
			{
				// Phrase "set x to 2" as "state.variables['x'] = 2"
				if (setter)
				{
					expr = alter(expr, "\\$(\\w+)\\b", " State.variables['$1'] ");
				}
				else
				// Phrase "if x is 2" as "state.getVar('x') === 2"
				{
					expr = alter(expr, "\\$(\\w+)\\b", " State.getVar('$1') ");
					// No unintended assignments allowed
					expr = alter(expr, "\\w=\\w", " === ");
				}
				// Hooks
				expr = alter(expr, "^\\?(\\w+)\\b", " Hook('$1') ");
				expr = alter(expr, "\\bis\\s+not\\b", " !== ");
				expr = alter(expr, "\\bis\\b", " === ");
				expr = alter(expr, "\\bto\\b", " = ");
				expr = alter(expr, "\\band\\b", " && ");
				expr = alter(expr, "\\bor\\b", " || ");
				expr = alter(expr, "\\bnot\\b", " ! ");
			}
			return expr;
		}
	};

	Utils.lockProperties(MacroInstance);
	
	return MacroInstance;
});
