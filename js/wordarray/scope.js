define(['jquery', 'story', 'utils', 'wordarray'], function($, Story, Utils, WordArray) {
	"use strict";
	/*
		Scope
		An extension to WordArray that stores the containing 
		hooks/pseudo-hooks of its contents.
	*/

	var Scope = $.extend(Object.create(WordArray), {

		// enchant: select the matching hooks, or create pseudo-hooks around matching words,
		// and apply a class to those hooks.
		// Pseudo-hooks are cleaned up in engine.updateEnchantments()
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
		unhook: function () {
			this.hooks && this.hooks.children().unwrap();
		}
	});

	return Object.freeze(Scope);
});
