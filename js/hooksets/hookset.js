define(['jquery', 'hookutils'],function($, HookUtils) {
	"use strict";
	
	/**
		A HookSet is an object representing a "hook selection". Hooks in
		Twine passages can have identical titles, and both can therefore be
		selected by the same hook reference. This class represents
		these selections within a given Section.
		
		These are currently exclusively created by Section.selectHook.
		
		@class HookSet
		@static
	*/
	var HookSet = Object.freeze({
		
		/**
			An Array forEach-styled iteration function. The given function is
			called on every <tw-hook> in the section DOM 
			
			This is currently just used by Section.renderInto, to iterate over each
			word and render it individually.
			
			@method forEach
			@param {Function} fn The callback, which is passed the following:
				{jQuery} The <tw-hook> element to manipulate.
		*/
		forEach: function(fn) {
			/*
				hooks is a jQuery collection of every <tw-hook> in the Section
				which matches this HookSet's selector string.
				
				This is re-evaluated during every forEach call, so that it's always
				up-to-date with the DOM.
			*/
			var hooks = this.section.$(
				HookUtils.hookToSelector(
					this.selector.slice(1) /* slice off the hook sigil */
				)
			);
			hooks.each(function() {
				fn($(this));
			});
		},
		
		/**
			Creates a new HookSet. It has a selector and a section
			which determine what hooks to select, and from where.
			
			There isn't much call to ever use a HookSet as a prototype
			(especially since it's frozen, rendering section and selector
			difficult to override) but it's still available anyway. Such
			is the porous, spongy nature of JS.)
			
			@method create
			@param {Section} section The section to use for DOM lookups.
			@param {String} hookSelector The selector string.
		*/
		create: function(section, hookSelector) {
			var ret = Object.create(this);
			ret.section = section;
			ret.selector = hookSelector;
			return Object.freeze(ret);
		}
	});
	return HookSet;
});
