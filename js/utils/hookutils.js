define(['jquery', 'utils', 'selectors'], function($, Utils, Selectors) {
	"use strict";
	
	/**
		HookUtils contains a number of utility methods which are only of use to
		Section, but which are generic enough, and related to specifications of
		what a hook is, to be bundled into this separate class.
		
		@class HookUtils
		@static
	*/
	
	/**
		Creates an Array of jQuery objects, queried from the given DOM,
		which contain the chars in the selector.
		The selector is currently just a text search string.
		
		@method findCharSpans
		@private
		@param {String} selector The search string.
		@param {jQuery} dom The DOM to search.
		@return {Array} An array of jQuery objects.
	*/
	function findCharSpans(selector, dom) {
		// Recursive call
		return _findCharSpans(selector, Utils.findAndFilter(dom, Selectors.charSpan), true);
	}

	/**
		Gets the value of a charSpan element.
		Needed because <br> elements are also considered charspans, but lack a 'value' attribute.

	*/
	function _elementGetChar(elem) {
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("value"));
	}
	
	/**
		The recursive form of findCharSpans.
		
		@method _findCharSpans
		@private
		@param {String} selector The search string.
		@param {jQuery} chars The charspans to search.
		@param {Boolean} fulltext Whether this is the full text. If true, then
		the recursive call results are put into an array instead of a jQuery collection.
	*/
	function _findCharSpans(selector, chars, fulltext) {
		var temp, query, el1, el2, i,
			ret = (fulltext ? [] : $());

		// Coerce to string
		selector += "";
		if (selector.length > 1 || fulltext) {
			// Recursive case: see if each instance of search string's first character is followed
			// by search string's next character.
			for (i = 0; i < chars.length; i++) {
				el1 = chars.get(i);
				// If length <= 1, don't bother checking next char
				query = ((selector.length <= 1 || i >= chars.length - 1) && (_elementGetChar(el1) === selector[0]) && el1);

				if (!query) {
					el2 = chars.get(i + 1);
					if (el2 && _elementGetChar(el1) === selector[0] && _elementGetChar(el2) === selector[1]) {
						// See if a further search yields profit
						query = _findCharSpans(selector.slice(1), chars.slice(i + 1, i + selector.length), false);
					}
				}
				// Add the results to the return set.
				if (query) {
					if (fulltext) {
						ret.push($(el1).add(query));
					} else {
						ret = ret.add(el1).add(query);
					}
				}
			}
		} else {
			// Base case: return char if it matches the search string.
			temp = (chars.attr("value") === selector ? chars.first() : []);
			if (fulltext) {
				ret.push(temp);
			} else {
				ret = temp;
			}
		}
		return (ret.length > 0 || fulltext ? ret : void 0);
	}
	
	/*
		Public methods here on are laid.
	*/
	var HookUtils = {
		
		findCharSpans: findCharSpans,
		
		/**
			Returns the type of a selector string.
			Currently used simply to differentiate hookRef strings.
			TODO: Use TwineMarkup.RegExpStrings.

			@method selectorType
			@static
			@param val Value to examine
			@return {String} Description
		*/
		selectorType: function (val) {
			var r;

			// Coerce empty string to undefined

			if (!val) {
				return "undefined";
			}
			if (typeof val === "string") {
				r = /\?(\w*)/.exec(val);

				if (r && r.length) {
					return "hookRef";
				}
				// Assume it's a plain word selector
				return "string";
			}
			return "undefined";
		},

		/**
			Convert a hook index string to a CSS selector.

			@method hookToSelector
			@param {String} list	chain to convert
			@return {String} classlist string
		*/
		hookToSelector: function (c) {
			c = c.replace(/"/g, "&quot;");
			return Selectors.hook+'[name="' + c + '"]';
		},
		
		/*
			If the given jQuery contains more than 1 element, then they are all wrapped
			in a <tw-pseudo-hook> element.
			
			This is used to allow pseudo-hooks to be treated as hooks by various
			hook-augmenting functions, such as section.render().
		*/
		wrapPseudoHook: function(jquery) {
			if (jquery.length > 0) {
				jquery = jquery.wrapAll("<tw-pseudo-hook>").parent();
			}
			return jquery;
		},
		
		/*
			The inverse of wrapPseudoHook.
		*/
		unwrapPseudoHook: function(jquery) {
			if(jquery.length === 1 && jquery[0].tagName.toLowerCase() === "tw-pseudo-hook") {
				jquery = jquery.children().unwrap();
			}
			return jquery;
		},
	};
	return Object.freeze(HookUtils);
});