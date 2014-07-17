define(['jquery', 'story', 'utils', 'selectors', 'wordarray'], function($, Story, Utils, Selectors, WordArray) {
	"use strict";
	/**
		Scope
		An extension to WordArray that stores the containing 
		hooks/pseudo-hooks of its contents.
		
		@class Scope
		@extends WordArray
	*/

	var Scope = Utils.create(WordArray, {	
		/**
			Unlike a mere WordArray, all selections of a Scope are
			inside <tw-hook> or <tw-pseudo-hook> elements.
			
			While this.contents holds the individual charspans selected by the selector,
			this.hooks holds the parent <tw-hook> or <tw-pseudo-hook> elements enclosing them.
			
			@property hooks
			@type jQuery
		*/
		
		/*
			We can't actually define
				hooks: null,
			here, because Scope is frozen, and non-configurable properties "burn through"
			the prototype chain, and prevent instances from overriding them
			(unless Object.defineProperty() is used).
		*/
		
		/**
			Select the matching hooks, or create pseudo-hooks around matching words,
			and apply a class to those hooks.
			
			@method enchant
			@param {String} className class to add
			@param {Section} section The passage in which this is being performed.
			@return {String} description
		*/
		enchant: function (className, section) {
			var i, j, selector, type;

			Utils.assert(section.section);
			
			this.hooks = $();

			// Do all the selector(s).
			for (i = 0; i < this.selectors.length; i += 1) {
				
				selector = this.selectors[i],
				type = WordArray.scopeType(selector);

				// Targeting actual hooks?
				if (type === "wordarray") {
					this.hooks = this.hooks.add(selector.contents);
				}
				else if (type === "jquery") {
					this.hooks = this.hooks.add(selector);
				}
				else if (type === "hookRef") {
					this.hooks = this.hooks.add(Utils.hookTojQuery(selector, section.dom));
				}
				else if (type === "wordarray string")
				// Pseudohooks
				{
					// Create pseudohooks around the Words
					for (j = 0; j < this.contents.length; j++) {
						this.contents[j].wrapAll("<tw-pseudo-hook "
							// Debug mode: show the pseudo-hook selector as a tooltip
							+ (Story.options.debug ? "title='Pseudo-hook: " + selector + "'" : "") + "/>");
						this.hooks = this.hooks.add(this.contents[j].parent());
					}
				}
			}
			this.hooks && this.hooks.addClass(className);
			return this;
		},
		
		/**
			Takes a subset selector, and returns a subset of this scope
			reflecting that selector.
			
			@method selectSubset
			@param {String} subsetSelector Currently either "first" or "last".
		*/
		selectSubset: function (subsetSelector) {
			switch (subsetSelector) {
				case "first":
					return this.first();
				case "last":
					return this.last();
				default:
					return this;
			}
		},
		/**
			Removes the <tw-hook>s around each hook.
			@method unhook
			@return this
		*/
		unhook: function () {
			this.hooks && this.hooks.children().unwrap();
			return this;
		}
	});
	
	Utils.log("Scope object ready!");
	
	return Object.freeze(Scope);
});
