define(['jquery', 'state', 'utils', 'engine'], function ($, state, utils, engine)
{
	"use strict";
	/*
		script: Scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	// The calling macro's top reference - set by every _eval() call.
	var _top;
	
	/*
		Basic randomness
	 */

	// A random integer function
	// 1 argument: random int from 0 to a inclusive
	// 2 arguments: random int from a to b inclusive (order irrelevant)
	function random(a, b)
	{
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
	function either()
	{
		return arguments[~~(Math.random()*arguments.length)];
	};
	
	/*
		Wrappers for state
	*/
	
	function visited(name)
	{
		return state.passageNameVisited(name);
	};
	
	/*
		Wrappers for engine
	*/
	
	function goto(name)
	{
		return engine.goToPassage(name);
	};
	
	/*
		Text selectors and manipulators
	 */
	 
	/* 
	   WordArray object:
	   Contains a sequential set of jQuery-wrapped charspans,
	   that correspond to a search term in the text.
	   Most all of its methods are author-facing, through the Text()
	   method.
	   - They should be chainable.
	   - Currently they are just setters and not getters.
	*/
	var WordArray = {
		contents: null,
		get length()
		{
			return this.contents.length;
		},
		_create: function(word)
		{
			var ret = Object.create(WordArray);
			ret.contents = [];
			if (word && word.jquery)
			{
				ret.contents.push(word);
			}
			return ret;
		},
		// replace(str): Takes a string, charSpans it, then
		// replaces this word's chars with it.
		replace: function(str) {
			var word = utils.charSpanify(str);
			this.contents = this.contents.map(function(e)
			{
				var w = $(word); 
				e.first().before(w);
				e.remove();
				return w;
			});
			return this;
		},
		// remove(): removes the chars from the DOM.
		remove: function()
		{
			this.contents.forEach(function(e)
			{
				e.remove();
			});
			this.contents = [];
			return this;
		},
		// style: alters the style attribute of all chars
		style: function(style) {
			this.contents.forEach(function(e)
			{
				e.attr("style",style);
			});
			return this;
		},
		// unlink(): removes whatever link(s) the spans are contained in.
		//
		// The rule is as follows:
		// For each char, find something .closest("a")
		// and .unwrap() its first child.
		unlink: function()
		{
			this.contents.forEach(function(e)
			{
				var l = e.closest("a");
				if (~l.length)
				{
					l.children().unwrap();
				}
			});
			return this;
		}
		// passagelink(str): wraps 
	};
	// Mirror a couple of other jQuery methods on WordArray
	// Note to self: add jQueryUI's version of addClass, pronto.
	[ "addClass", "removeClass", "toggleClass", "show", "hide" ].forEach(function(func)
	{
		WordArray[func] = function()
		{
			var a = arguments;
			this.contents.forEach(function(e)
			{
				e[func].apply(e,a);
			});
			return this;
		};
	});
	Object.seal(WordArray);
	
	// Text(selector)
	// Creates a WordArray of jQuery objects containing the chars in the selector.
	// The selector is a search string.
	function Text(selector)
	{
		return (function _Text(selector, chars, fullword)
		{ 
			//TODO:
			// * filter-type selectors such as "first", "last"
			var selector, temp,
				ret = (fullword ? WordArray._create() : $());
			
			// Crudely coerce to string
			selector += "";

			if (selector.length > 1)
			{
				// Recursive case: see if each instance of search string's first character is followed
				// by search string's next character.
				chars.each(function(ind, el1)
				{
					var query, el2 = chars.get(ind + 1);
					if (el2)
					{
						if (_elementGetChar(el1) === selector[0] && _elementGetChar(el2) === selector[1])
						{
							// See if a further search yields profit
							query = _Text(selector.slice(1), chars.slice(ind+1, ind+selector.length), false);
							// If so, add the element and the search's results to the return set.
							if (query)
							{
								if (fullword)
								{
									ret.contents.push($(el1).add(query));
								}
								else
								{
									ret = ret.add(el1).add(query);
								}
							}
						}
					}
				});
			}
			else
			{
				// Base case: return char if it matches the search string.
				
				temp = (chars.attr("data-char") === selector ? chars.first() : null);
				if (fullword)
				{
					ret.contents.push(temp);
				} else
				{
					ret = temp;
				}
			}
			return (ret.length > 0 || fullword ? ret : null);
		}(selector, $("span.char, br", _top), true));
	}

	function _elementGetChar(elem)
	{
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("data-char"));
	}
	
	// eval() the script in the context of this module.
	function _eval(me, text, top)
	{
		_top = top;
		return eval.call(me, text);
	};
	
	return Object.freeze({
		eval: _eval
	});
});