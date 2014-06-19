define(['jquery', 'story', 'utils', 'wordarray', 'macroinstance', 'scope'],
function($, Story, Utils, WordArray, MacroInstance, Scope) {
	"use strict";
	/**
		HookMacroInstance
		An instance of a hook macro which has a Scope, and methods to control it.
		
		@class HookMacroInstance
		@extends MacroInstance
	*/

	var HookMacroInstance = $.extend(Object.create(MacroInstance), {

		/**
			Set the scope using a WordArray selector string.
			
			@method setScope
			@param {String} selectors The WordArray selector string.
		*/
		setScope: function (selectors) {
			this.scope = Scope.create(selectors, this.top);
		},

		/**
			Enchants the scope, applying the macro's enchantment's classes
			to the 
			
			@method enchantScope
		*/
		enchantScope: function () {
			if (this.scope && this.desc && this.desc.enchantment) {
				this.scope.enchant(this.desc.enchantment.classList, this.top);
			}
		},

		/**
			Refresh the scope to reflect the current passage DOM state.
			Necessary if the scope selector is a WordArray or jQuery selector,
			or if a hook was removed or inserted for some other reason.
			
			@method refreshScope
		*/
		refreshScope: function () {
			if (this.scope) {
				this.scope.refresh(this.top);
			}
		},

		/**
			Return a reduced scope, limited to either the first, last, or "this"
			item, based on what subset keywords are present in this scope's 
			scope selector.
			
			@method reducedScope
		*/
		reducedScope: function () {
			switch (this.subsetSelector()) {
			case "first":
				return this.scope.first();
			case "last":
				return this.scope.last();
			case "this":
				return this.scope.reduce(this.trigger);
			default:
				return this.scope;
			}
		},

		/**
			Search this macro instance's arguments to find any subset keywords ("first", "last", "this")
			inside, then return those. If none found, return "all".
			
			@method subsetSelector
			@return {String} the subset selector.
		*/
		subsetSelector: function () {
			var i, str, keyword, tmp;

			// Look for subset keywords in the arguments
			for (i = 0; i < this.args.length; i += 1) {
				str = this.args[i];
				tmp = (typeof str === "string" && (str === "this" && "this") || (str === "first" && "first") || (str === "last" &&
					"last"));

				// Have multiple keywords been given??
				if (tmp && keyword) {
					// Print a warning
					this.warning("multiple subset keywords (" + tmp + ", " + keyword + ") are here.");
					break;
				}
				keyword = tmp;
			};
			return keyword || "all";
		},

		/**
			Search this macro instance's arguments to find any terms beginning with "t8n-",
			and return those stripped of the "t8n-" prefix. If none found, default to "dissolve".
			
			@method transitionSelector
			@return {String} the transition selector.
		*/
		transitionSelector: function () {
			var i, str, keyword, tmp;

			// Look for subset keywords in the arguments
			for (i = 0; i < this.args.length; i += 1) {
				str = this.args[i];
				tmp = (typeof str === "string" && (str.indexOf("t8n-") === 0) && str.slice(4));

				// Have multiple keywords been given??
				if (tmp && keyword) {
					// Print a warning
					this.warning("multiple t8n keywords (t8n-" + tmp + ", t8n-" + keyword + ") are here.");
					break;
				}
				keyword = tmp;
			};
			return keyword || "dissolve";
		},

		/**
			Re-execute the macro instance due to the enchantment being triggered.
			
			@method runEnchantment
			@param {jQuery} trigger The element which was the trigger.
		*/
		runEnchantment: function (trigger) {
			this.trigger = trigger;

			this.desc.fn.apply(this, this.applyArgs);

			// Remove hook if it's a once-only enchantment.
			if (this.desc.enchantment.once && this.subsetSelector() === "all") {
				this.scope.unhook();
			}
		}
	});
	
	Utils.log("HookMacroInstance object ready!");
	
	return Object.freeze(HookMacroInstance);
});
