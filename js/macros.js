define(['jquery', 'story', 'utils', 'wordarray'], function($, Story, Utils, WordArray)
{
	"use strict";
	/*
		macros: Macro engine
		Object types: MacroInstance, Hook
		Exported singleton: macros
	*/
	
	/*
	
	MACRO API:
	
	For end users:
	* macros.get(name) : get a registered macro function.
	* macros.add(descriptor): register a new macro.
		descriptor is a map of the following:
			- fn: the function to execute when the macro runs. It may be absent for hook macros. See macrolib for the API.
			- name: a string, or an array of strings serving as 'alias' names.
			- selfClosing: boolean, determines if the macro tag has contents. If false, then all subsequent code
				up until a closing tag ("<<endmacro>>" or <</macro>>") or until the end of the passage,
				will be captured by this.contents.
			- version: a map { major: Number, minor: Number, revision: number }.
			- hooked: boolean, denotes that this is a hook macro.
			- deferred: boolean, denotes that the hook macro is "deferred" - it will not immediately execute. Currently unused.
			- enchantment: a map whose presence denotes that the hook macro is an "enchantment" - its contents will not immediately
				be rendered until a denoted event is performed on its hook(s).
				The map contains the following:
				- event: the DOM event that triggers the rendering of this macro's contents.
				- classList: the list of classes to 'enchant' the hook with, to denote that it is ready for the player to
				trigger an event on it.
				- rerender: a string determining whether to clear the span before rendering into it ("replace", default),
				append the rendering to its current contents ("append") or prepend it ("prepend").
				- once: whether or not the enchanted DOM elements can trigger this macro multiple times.
			
	* macros.supplement(name, selfClosing, main) : register a macro which has no code, but is used as a sub-tag in another macro.
		main: name of the 'parent' macro.
		
	For other modules:
	* macros.matchMacroTag(html, callback(e)) : perform a function for each valid macro call in the HTML.
		html: a string of escaped HTML.
		e: a MacroInstance object matching a macro invocation in the HTML.
	
	*/
	
	var MacroInstance, Scope, macros,
		// Private collection of registered macros.
		_handlers = {},
		// Precompile some regexes
		unquotedWhitespace = new RegExp(" "+Utils.unquotedCharRegexSuffix);
	
	// Sub-function of MacroInstance.convertOperators
	function alter(expr, from, to)
	{
		return expr.replace(new RegExp(from + Utils.unquotedCharRegexSuffix, "gi"), to);
	}
	
	/*
		The prototype object for MacroInstances, the object type used by matchMacroTag
		and apply()ed to macro functions.
		This contains utility functions that any macro function can call on.
	*/
	MacroInstance = Utils.lockProperties({
	
		create: function(html, name, startIndex, endIndex)
		{
			var selfClosing,
				macro = Object.create(this);
			
			macro.name = name;
			macro.data = _handlers[name];
			macro.startIndex = startIndex;
			macro.endIndex = endIndex;
			selfClosing = macro.data && macro.data.selfClosing;
			
			// HTMLcall / call is the entire macro invocation, rawArgs is all arguments,
			// HTMLcontents / contents is what's between a <<macro>> and <</macro>> call
			macro.HTMLcall = html.slice(startIndex, endIndex);
			macro.HTMLcontents = (selfClosing ? ""
				: macro.HTMLcall.replace(/^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/i, '').replace(/&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$/i, ''));
			
			// unescape HTML entities ("&amp;" etc.)
			macro.call = $('<p>').html(macro.HTMLcall).text();
			macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i, ''));
			macro.rawArgs = macro.call.replace(/^<<\s*\w*\s*/, '').replace(/\s*>>[^]*/, '').trim();
			
			// tokenize arguments
			// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
			// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
			macro.args = macro.rawArgs.split(unquotedWhitespace)
				// remove opening and closing quotes from args
				.map(function(e) {
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

		// Set the scope, if it is a hook macro.
		setScope: function(name)
		{
			this.scope = Scope.create(name, this.top);
		},
		
		// Enchant the scope, if it is a hook macro.
		enchantScope: function()
		{
			if (this.scope && this.data && this.data.enchantment)
			{
				this.scope.enchant(this.data.enchantment.classList, this.top);
			}
		},
		
		// Refresh the hook to reflect the current passage DOM state.
		// Necessary if the pseudo-hook selector is a WordArray or jQuery selector,
		// or if a hook was removed or inserted for some other reason.
		refreshScope: function(name)
		{
			if (this.scope)
			{
				this.scope.refresh(this.scope.selector, this.top);
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
					expr = alter(expr, "\\$(\\w+)\\b", "State.variables['$1']");
				}
				else
				// Phrase "if x is 2" as "state.getVar('x') === 2"
				{
					expr = alter(expr, "\\$(\\w+)\\b", "State.getVar('$1')");
					// No unintended assignments allowed
					expr = alter(expr, "\\w=\\w", " === ");
				}
				expr = alter(expr, "\\bis\\s+not\\b", " !== ");
				expr = alter(expr, "\\bis\\b", " === ");
				expr = alter(expr, "\\bto\\b", " = ");
				expr = alter(expr, "\\band\\b", " && ");
				expr = alter(expr, "\\bor\\b", " || ");
				expr = alter(expr, "\\bnot\\b", " ! ");
			}
			return expr;
		}
	});
	
	/*
		Scope: an extension to WordArray that stores the containing 
		hooks/pseudo-hooks of its contents, as well as the selector string
		used to select its contents.
	*/
	Scope = Object.freeze(Object.create(WordArray, {
	
		create: {
			value: function(word, top) {
				var pseudohookSelector, ret;
				ret = WordArray.create.call(this, word, top);
				ret.selector = word;
				return ret;
			}
		},
		
		// enchant: select the matching hooks, or create pseudo-hooks around matching words,
		// and apply a class to those hooks.
		// Pseudo-hooks are cleaned up in engine.updateEnchantments()
		enchant: {
			value: function(className, top) {
				var i;
				// Targeting actual hooks?
				if (Utils.type(this.selector) === "hook string")
				{
					this.hooks = Utils.hookTojQuery(this.selector, top);
				}
				else if (this.selector)
				// Pseudohooks (WordArray selector etc)
				{
					this.hooks = $();
					// Create pseudohooks around the Words
					for(i = 0; i < this.contents.length; i++)
					{
						this.contents[i].wrapAll("<span class='pseudo-hook' "
						// Debug mode: show the pseudo-hook selector as a tooltip
							+ (Story.options.debug ? "title='Pseudo-hook: " + this.selector + "'" : "") + "/>");
						this.hooks = this.hooks.add(this.contents[i].parent());
					};
				}
				(this.hooks && this.hooks.addClass(className));
				return this;
			}
		}
	}));
	
	/*
		Common function of hook macros.
	*/
	function hookMacroFn(deferred, innerFn)
	{
		var	rerender = this.data.enchantment && this.data.enchantment.rerender,
			// Get the args, but with quotes retained.
			quotedArgs = this.rawArgs.split(unquotedWhitespace);
		
		// No argument given?
		if (quotedArgs.length < 1)
		{
			this.error('no hook ID given');
			return;
		}
		// For deferred macros, only run this once.
		if (!this.ready)
		{
			deferred && (this.ready = true);
			
			// Designate this as a hook macro.
			this.el.addClass("hook-macro");
			// Keep the MacroInstance around
			this.el.data("instance", this);
			
			// Set up the scope
			this.setScope(quotedArgs[0]);
			
			if (deferred)
			{
				return;
			}
			else
			{
				//Will run immediately - enchant now.
				this.enchantScope();
			}
		}
		else
		{
			// Deferred macro was activated - refresh the scope.
			this.refreshScope();
		}
		// If an inner function was given, run that.
		if (innerFn && typeof innerFn === "function")
		{
			innerFn.apply(this, this.args);
		}
		else
		// Default behaviour: simply parse the inner contents.
		{
			if (!rerender || rerender === "replace")
			{
				Utils.transitionOut(this.el.children(), "fade-in")
			}
			this.render(this.HTMLcontents, rerender === "prepend");
		}
	}
	
	// Generate a unique wrapper for each macro,
	// outside the scope of macros.add.
	function newHookMacroFn(deferred, innerFn)
	{
		return function(a)
		{
			return hookMacroFn.call(this, deferred, innerFn);
		};
	}
	
	// Called when an enchantment's event is triggered. Sub-function of macros.add()
	function enchantmentEventFn()
	{
		var elem = $(this),
			story = Utils.storyElement;
		
		// Trigger the hook macros that refer to this enchantment.
		Utils.$(".hook-macro", story).each(function() {
			var instance = $(this).data("instance");
			if (instance && instance.scope && instance.scope.hooks)
			{
				if (instance.scope.hooks.is(elem))
				{
					// TODO: make it so that the scope can sometimes only affect the clicked object
					instance.data.apply(instance,instance.args);
					
					// Remove hook if it's a once-only enchantment.
					if (instance.data.enchantment.once)
					{
						instance.scope.hooks.children().unwrap();
					}
				}
			}
			//TODO: error message
		});
	}
	
	// Report an error when a user-loaded macro fails. Sub-function of macros.add() and macros.supplement().
	function loaderError(text)
	{
		// TODO: Instead of a basic alert, display a notification banner somewhere.
		window.alert(text);
		return true;
	};
	
	// Sub-function of macros.add() and macros.supplement()
	function stringOrArray(n)
	{
		return (typeof n === "string" || Array.isArray(n));
	};
	
	/*
		The object containing all the macros available to a story.
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
			if (!(desc && typeof desc === "object" && ((desc.fn && typeof desc.fn === "function") || desc.hooked)))
			{
				return loaderError("Argument 2 of macros.add (\"" + name + "\") isn't a valid or complete descriptor.");
			}
			if (desc.fn)
			{
				fn = desc.fn;
				delete desc.fn;
			}
			// Hook macro? Use a hookMacroFn for its function.
			if (desc.hooked)
			{
				// Enchantment macro? Register the enchantment's event.
				if (desc.enchantment && desc.enchantment.event && desc.enchantment.classList)
				{
					// Set the event that the enchantment descriptor declares
					$(document.documentElement).on(desc.enchantment.event + "." + desc.name + "-macro", Utils.classListToSelector(desc.enchantment.classList), enchantmentEventFn);
					
					fn = newHookMacroFn(true, fn);
				}
				else
				{
					fn = newHookMacroFn(!!desc.deferred, fn);
				}
			}
			// Add all remaining properties of desc to fn.
			$.extend(fn,desc);
			// Add fn to the _handlers, plus aliases (if name is an array of aliases)
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
					this.error("is outside a"
						+ (Array.isArray(main) ? "n appropriate macro" : " <<" + main + ">>"));
				}
				else
				{
					this.clear();
				}
			};
			if (mfunc && mfunc.version)
			{
				desc.version = mfunc.version;
			}
			macros.add(name, desc);
		},

		// Performs a function for each macro instance found in the HTML.
		// macroname is a regex string specifying a particular name; if absent, all are found.
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
						do
						{
							foundEndMacro = endMacroRE.exec(html);
							if (foundEndMacro !== null)
							{
								if (foundEndMacro[2])
								{
									// Found <</macro>>
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
					macro = MacroInstance.create(html, foundMacro[1], foundMacro.index, endIndex);
					// Run the callback
					callback(macro);
					macroRE.lastIndex = endIndex;
				}
			} while (foundMacro);
		},
		
		// Stub function to be replaced by macrolib's render()
		render: $.noop,
		
		MacroInstance: MacroInstance
	});
	
	// This replaces unknown or incorrect macros.
	macros.add("unknown", {
		selfClosing: true,
		fn: function()
		{
			return this.error("Unknown macro: " + this.name, true);
		}
	});
	
	return macros;
});