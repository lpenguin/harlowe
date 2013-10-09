define(['jquery', 'story', 'utils', 'wordarray'], function($, Story, Utils, WordArray)
{
	"use strict";
	/*
		MacroInstance: object representing a single macro instantiation.
		Exported singleton: MacroInstance
	*/
	
	var MacroInstance, HookMacroInstance, Scope,
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
	
	/*
		HookMacroInstance
		A sub-class that has scope methods.
	*/
	HookMacroInstance = $.extend(Object.create(MacroInstance), {
		
		// Set the scope
		setScope: function(selectors)
		{
			this.scope = Scope.create(selectors, this.top);
		},
		
		// Enchant the scope
		enchantScope: function()
		{
			if (this.scope && this.desc && this.desc.enchantment)
			{
				this.scope.enchant(this.desc.enchantment.classList, this.top);
			}
		},
		
		// Refresh the hook to reflect the current passage DOM state.
		// Necessary if the pseudo-hook selector is a WordArray or jQuery selector,
		// or if a hook was removed or inserted for some other reason.
		refreshScope: function()
		{
			if (this.scope)
			{
				this.scope.refresh(this.top);
			}
		},
		
		// Return a reduced scope 
		reducedScope: function()
		{
			switch(this.subsetSelector())
			{
				case "first": return this.scope.first();
				case "last": return this.scope.last();
				case "this": return this.scope.reduce(this.trigger);
				default: return this.scope;
			}
		},
		
		// Search args to find any subset keywords ("first", "last", "this")
		subsetSelector: function()
		{
			var str, keyword, tmp;
			
			// Look for subset keywords in the arguments
			this.args.forEach(function(str)
			{
				tmp = tmp || (typeof str === "string" && (str === "this" && "this")
					|| (str === "first" && "first")
					|| (str === "last" && "last"));
				
				// Have multiple keywords been given??
				if (tmp && keyword)
				{
					// TODO: throw error?
				}
				keyword = tmp;
			});
			return keyword || "all";
		},
		
		// Search args to find any terms beginning with "t8n-"
		transitionSelector: function()
		{
			var str, keyword, tmp;
			
			// Look for subset keywords in the arguments
			this.args.forEach(function(str)
			{
				tmp = tmp || (typeof str === "string" && (str.indexOf("t8n-") === 0)
					&& str.slice(4));
				
				// Have multiple keywords been given??
				if (tmp && keyword)
				{
					// TODO: throw error?
				}
				keyword = tmp;
			});
			return keyword || "dissolve";
		},
		
		// The instance is being re-run due to being triggered by an enchantment.
		// Trigger: the element which was the trigger.
		runEnchantment: function(trigger)
		{
			this.trigger = trigger;
			
			this.desc.fn.apply(this, this.applyArgs);
			
			// Remove hook if it's a once-only enchantment.
			if (this.desc.enchantment.once && this.subsetSelector() === "all")
			{
				this.scope.unhook();
			}
		}
	});
	
	/*
		Scope: an extension to WordArray that stores the containing 
		hooks/pseudo-hooks of its contents.
	*/
	Scope = $.extend(Object.create(WordArray), {
		
		// enchant: select the matching hooks, or create pseudo-hooks around matching words,
		// and apply a class to those hooks.
		// Pseudo-hooks are cleaned up in engine.updateEnchantments()
		enchant: function(className, top)
		{
			var i, j, selector, type;
			
			this.hooks = $();
			
			// Do all the selector(s).
			for (i = 0; i < this.selectors.length; i+=1)
			{
				selector = this.selectors[i],
				type = Utils.scopeType(selector);
				// Targeting actual hooks?
				if (type === "hook string")
				{
					this.hooks = this.hooks.add(Utils.hookTojQuery(selector, top));
				}
				else if (type === "jquery string")
				{
					this.hooks = this.hooks.add(Utils.jQueryStringTojQuery(selector));
				}
				else if (type === "wordarray string")
				// Pseudohooks
				{
					// Create pseudohooks around the Words
					for(j = 0; j < this.contents.length; j++)
					{
						this.contents[j].wrapAll("<span class='pseudo-hook' "
						// Debug mode: show the pseudo-hook selector as a tooltip
							+ (Story.options.debug ? "title='Pseudo-hook: " + selector + "'" : "") + "/>");
						this.hooks = this.hooks.add(this.contents[j].parent());
					};
				}
			}
			// this.hooks is used by enchantmentEventFn()
			(this.hooks && this.hooks.addClass(className));
			return this;
		},
		
		// unhook: removes the hook spans around each hook.
		unhook: function()
		{
			this.hooks && this.hooks.children().unwrap();
		}
	});
	
	Utils.lockProperties(MacroInstance);
	Object.freeze(HookMacroInstance);
	Object.freeze(Scope);
	
	return {
		MacroInstance: MacroInstance,
		HookMacroInstance: HookMacroInstance,
		Scope: Scope
	};
});
