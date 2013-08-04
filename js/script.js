define(['jquery', 'state', 'utils', 'engine'], function ($, state, utils, engine)
{
	"use strict";
	/*
		script: Scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via <<script>>, etc.
	*/
	// The calling macro's top reference - set by every _eval() call.
	var _top,
	// Constant - the selector for charspans
		_selector = "span.char, br";
	
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
	
		// Used for duck-typing
		wordarray: true,
		
		contents: null,
		
		get length()
		{
			return this.contents.length;
		},
		
		// Get the text of the first element.
		text: function()
		{
			if (this.contents.length)
			{
				return this.contents[0].text();
			}
			return "";
		},
		
		create: function(word)
		{
			var ret = Object.create(WordArray);
			ret.contents = [];
			if (word && word.jquery)
			{
				// Turn each matched element in the argument
				// into a separate word
				word.each(function() {
					ret.contents.push($(this).find(_selector));
				});
			}
			return ret;
		},
		
		// replace(str): Takes a string, charSpans it, then
		// replaces this WordArray's words with it.
		replace: function(str) {
			var word = engine.render(str);
			if (word.length)
			{
				// Replace the words
				this.contents = this.contents.map(function(e)
				{
					var w;
					
					// Check that the word is a jQuery
					if (e && e.jquery)
					{
						// Waste not...
						if (e.text() === str)
						{
							return e;
						}
						// Insert a copy of the replacement word
						w = word.clone();
						e.first().before(w);
						e.remove();
						return w;
					}
					return e;
				});
			}
			return this;
		},
		
		// append(str): appends instead of replaces.
		append: function(str) {
			var word = engine.render(str);
			if (word.length)
			{
				// Append the words
				this.contents = this.contents.map(function(e)
				{
					var w;
					
					// Check that the word is a jQuery
					if (e && e.jquery)
					{
						// Insert a copy of the replacement word
						w = word.clone();
						return e.last().after(w);
					}
					return e;
				});
			}
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
		
		// unlink(): removes whatever hook(s) the spans are contained in.
		//
		// The rule is as follows:
		// For each char, find something .closest(".hook")
		// and .unwrap() its children.
		unhook: function()
		{
			this.contents.forEach(function(e)
			{
				var l = e.closest(".hook");
				if (~l.length)
				{
					l.children().unwrap();
				}
			});
			return this;
		}
	};
	
	// Mirror a couple of other jQuery methods on WordArray
	// Note to self: add jQueryUI's version of addClass, pronto.
	[ "addClass", "removeClass", "toggleClass", "show", "hide", "remove", "fadeIn", "fadeOut" ].forEach(function(func)
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
	function Text(selector, top)
	{
		return (function _Text(selector, chars, fullword)
		{ 
			//TODO:
			// * filter-type selectors such as "first", "last"
			var selector, temp,
				ret = (fullword ? WordArray.create() : $());
			
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
		}(selector, $(_selector, top || _top), true));
	}

	function _elementGetChar(elem)
	{
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("data-char"));
	}
	
	// eval() the script in the context of this module.
	function _eval(text, top)
	{
		_top = top;
		return eval(text);
	};
	
	return Object.freeze({
		// Create WordArray
		createWordArray: WordArray.create,
		
		Text: Text,
		
		// Filter for _eval()
		eval: function()
		{
			var self = this;
			
			// Convert jQuery into WordArray
			if (self && self.jquery)
			{
				self = WordArray.create(self.find(_selector));
			}
			return _eval.apply(self, arguments);
		}
	});
});