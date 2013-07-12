define(['jquery'], function($)
{
	"use strict";
	// "Twinescript" - a bunch of functions that authors can invoke with <<script>>.
	// Everything in here is exposed to authors.

	// The calling macro's top reference - set by every _eval() call.
	var _top;
	
	/*
	 *  Basic randomness
	 */

	// A random integer function
	// 1 argument: random int from 0 to a inclusive
	// 2 arguments: random int from a to b inclusive (order irrelevant)
	function random(a, b) {
		var from, to;
		if (!b)
		{
			from = 0;
			to = a;
		}
		else
		{
			from = Math.min(a,b);
			to = Math.max(a,b);
		}
		to += 1;
		return ~~((Math.random()*(to-from)))+from;
	};
	
	// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
	function either () {
		return arguments[~~(Math.random()*arguments.length)];
	};
	
	/*
	 *  Text selectors
	 */
	
	// Creates a set of jQuery objects containing the chars in the selector.
	function Text(selector) {
		return _Text(selector, $("span.char", _top));
	}
	function _Text(selector, chars) { 
		//TODO: filter-type selectors such as "first", "last"
		var selector, letter, char1, char2,
			ret = $();
		
		// Crudely coerce to string
		selector += "";
		
		letter = selector[0];

		if (selector.length > 1)
		{
			// Recursive case: see if each instance of search string's first character is followed
			// by search string's next character.
			chars.each(function(ind, el1) {
				var query, el2 = chars.get(ind + 1);
				if (el2) {
					if (el1.getAttribute("data-char") == selector[0] && el2.getAttribute("data-char") == selector[1]) {
						// See if a further search yields profit
						query = _Text(selector.slice(1), chars.slice(ind+1, ind+selector.length));
						// If so, add the element and the search's results to the return set.
						if (query) {
							ret = ret.add(el1).add(query);
						}
					}
				}
			});
		} else {
			// Base case: return char if it matches the search string.
			return chars.attr("data-char") === selector ? chars.first() : null;
		}
		return (ret.length > 0 ? ret : null);
	};
	
	// eval() the script in the context of this module.
	function _eval(text, top) {
		_top = top;
		return eval(text);
	};
	
	return {
		eval: _eval
	};
});