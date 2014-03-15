define(['jquery', 'story', 'utils', 'selectors', 'wordarray'], function($, Story, Utils, Selectors, WordArray) {
	"use strict";
	/*
		Scope
		An extension to WordArray that stores the containing 
		hooks/pseudo-hooks of its contents.
	*/

	var Scope = Utils.create(WordArray, {		
		/**
			Select the matching hooks, or create pseudo-hooks around matching words,
			and apply a class to those hooks.
			
			@method enchant
			@param {String} className class to add
			@param {jQuery} top The passage element in which this is being performed.
			@return {String} description
		*/
		enchant: function (className, top) {
			var i, j, selector, type;

			this.hooks = $();

			// Do all the selector(s).
			for (i = 0; i < this.selectors.length; i += 1) {
				selector = this.selectors[i],
				type = Utils.scopeType(selector);
				// Targeting actual hooks?
				if (type === "hook string") {
					this.hooks = this.hooks.add(Utils.hookTojQuery(selector, top));
				} else if (type === "jquery string") {
					this.hooks = this.hooks.add(Utils.jQueryStringTojQuery(selector));
				} else if (type === "wordarray string")
				// Pseudohooks
				{
					// Create pseudohooks around the Words
					for (j = 0; j < this.contents.length; j++) {
						this.contents[j].wrapAll("<tw-pseudo-hook "
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

		/**
			Removes the hook spans around each hook.
			@method unhook
		*/
		unhook: function () {
			this.hooks && this.hooks.children().unwrap();
		}
	});
	
	Utils.log("Scope object ready!");
	
	return Object.freeze(Scope);
});
