define(['jquery', 'story', 'utils', 'twinemarked', 'wordarray', 'engine'], function($, Story, Utils, TwineMarked, WordArray, Engine) {
	"use strict";
	/**
		MacroInstance
		Object representing a single macro instantiation.
		
		@module MacroInstance
	*/

	var MacroInstance,
		// Precompile a regex
		macroTagFront = new RegExp("^" + TwineMarked.RegExpStrings.macroOpener + "\\s*" + TwineMarked.RegExpStrings.macroName + "\\s*");
	
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
			@param {Macro} desc The macro definition object for this instance.
			@param {Array} match A RegExp match array of the macro invocation inside some Twine code
			@param {String} call The full invocation, including start tag, contents, and end tag.
			@return {Object} The new MacroInstance.
		*/
		create: function (desc, match, call) {
			var selfClosing = desc && desc.selfClosing,
				contents = (selfClosing ? "" : call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i,'')),
				rawArgs = call.replace(macroTagFront, '').replace(/\s*>>[^]*/, '').trim(),
				// tokenize arguments
				// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
				// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
				args = Utils.splitUnquoted(rawArgs),
				// Only to be used for apply()ing to desc.fn or another function.
				// Removes opening and closing quotes from args
				applyArgs = args.map(function (e) {
					return e.replace(/^(['"])([^]*)\1$/, function (a, b, c) {
						return c;
					});
				});
			
			return Utils.create(this, {
				name: match[1],
				desc: desc,
				startIndex: match.index,
				endIndex: match.index + call.length,
				selfClosing: selfClosing,
				call: call,
				contents: contents,
				rawArgs: rawArgs,
				args: args,
				applyArgs: applyArgs,
				el: null,
				context: null,
				top: null,
			});
		},

		/**
			This is called by run() just before the macro is executed
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
