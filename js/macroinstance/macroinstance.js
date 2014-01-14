define(['jquery', 'story', 'utils', 'wordarray', 'engine'], function($, Story, Utils, WordArray, Engine) {
	"use strict";
	/**
		MacroInstance
		Object representing a single macro instantiation.
		
		@module MacroInstance
	*/

	var MacroInstance,
		// Precompile a regex
		macroTagFront = new RegExp("^<<\\s*" + Utils.regexStrings.macroName + "\\s*");
	
	/**
		The prototype object for MacroInstances, the object type used by matchMacroTag
		and apply()ed to macro functions.
		This contains utility functions that any macro function can call on.
		
		@class MacroInstance
		@static
	*/
	MacroInstance = {

		/**
			Factory method for MacroInstance.
			
			@method create
			@param {String} code The twine code containing the macro invocation.
			@param {String} name The macro's name; used to look up its data.
			@param {Number} startIndex The index, inside code, where this macro's invocation begins.
			@param {Number} endIndex The index, inside code, where this macro's invocation begins.
			@return {Object} The new MacroInstance.
		*/
		create: function (code, name, startIndex, endIndex) {
			var selfClosing,
				macro = Object.create(this);

			macro.name = name;
			macro.desc = MacroInstance.getMacroData(name);
			macro.startIndex = startIndex;
			macro.endIndex = endIndex;
			selfClosing = macro.desc && macro.desc.selfClosing;
			
			// call is the entire macro invocation, rawArgs is all arguments,
			// contents is what's between a <<macro>> and <</macro>> call
			macro.call = code.slice(startIndex, endIndex);
			macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i,
				''));
			macro.rawArgs = macro.call.replace(macroTagFront, '').replace(/\s*>>[^]*/, '').trim();

			// tokenize arguments
			// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
			// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
			macro.args = Utils.splitUnquoted(macro.rawArgs);

			// Only to be used for apply()ing to desc.fn or another function.
			// Removes opening and closing quotes from args
			macro.applyArgs = macro.args.map(function (e) {
				return e.replace(/^(['"])([^]*)\1$/, function (a, b, c) {
					return c;
				});
			});
			return macro;
		},

		/**
			This is called by renderMacro() just before the macro is executed
			@method init
		*/
		init: function () {
			if (Story.options.debug) {
				this.el.attr("title", this.call);
			}
		},

		/**
			Run a macro naturally found in the passage.
			@method run
			@param {jQuery} span The macro's output <span> element.
			@param {MacroInstance} context The MacroInstance which caused this macro to be rendered, or null if it's the top passage.
			@param {jQuery} top jQuery object for the entire passage in which this is located.
		*/
		run: function (span, context, top) {
			if (this.desc) {
				this.el = span;
				this.context = context;
				this.top = top;
				this.init && (this.init());
				try {
					this.desc.fn.apply(this, this.applyArgs);
				} catch (e) {
					this.error("The <<" + this.name + ">> macro's Javascript has a problem:" + e.message, true);
				}
			} else {
				span.addClass('error').html('No macro named ' + this.name);
			}
		},

		/**
			Outputs an error or warning to the macro's element.
			@method error
			@param {String} text The text of the error.
			@param {Boolean} noprefix Whether or not to prefix the macro's name to the error message.
			@param {String} type The type of error (either "error" or "warning").
		*/
		error: function (text, noprefix, type) {
			type || (type = "error");
			this.el.addClass(type).attr("title", this.call).removeAttr("macro").text((noprefix ? "" : "<<" + this.name +
				">> " + type + ": ") + text);
		},

		/**
			Outputs a warning to the macro's element.
			@method warning
			@param {String} text The text of the warning.
			@param {Boolean} [noprefix] Whether or not to prefix the macro's name to the warning message.
		*/
		warning: function (text, noprefix) {
			this.error(text, noprefix, "warning");
		},

		/**
			Remove the macro's element, unless in debug mode
			@method clear
		*/
		clear: function () {
			if (!Story.options.debug) {
				this.el.remove();
			}
		},

		/**
			Searches back through the context chain to find macro instances of a specific name, or an array of names.
			Returns an array of macro instances, sorted from nearest to farthest.
			@method contextQuery
			@param name The name(s) to search for.
			@return {Array} Array of MacroInstances.
		*/
		contextQuery: function (name) {
			var c = this.context,
				set = [];
			while (c) {
				if (!name || ((Array.isArray(name)) ? ~~name.indexOf(c.name) : (c.name === name))) {
					set.push(c);
				}
				c = c.context;
			}
			return set;
		},

		/**
			A filter for contextQuery that only returns the first, closest, context.
			@method contextQuery
			@param name The name(s) to search for.
		*/
		contextNearest: function (name) {
			var a = this.contextQuery(name);

			if (a.length) {
				return a[0];
			}
		}
	};
	
	Utils.log("MacroInstance object ready!");
	
	return Utils.lockProperties(MacroInstance);
});
