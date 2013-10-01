define(['jquery', 'utils'], function ($, Utils)
{
	"use strict";
	/* 
	   WordArray object:
	   Contains a sequential set of jQuery-wrapped charspans
	   that correspond to a search term in the text.
	*/
	
	// Modifier: "prepend", "append", "replace"
	function modifyWordArray(word, modifier)
	{
		// Convert word to a jQuery of spanified HTML
		if (word.wordarray && word.contents.length[0])
		{
			word = word.contents[0];
		}
		else if (typeof word === "string")
		{
			word = $(Utils.charSpanify(word));
		}
		else if (!word.jquery)
		{
			return this;
		}
		
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
					if (modifier === "replace" && e.text() === word)
					{
						return e;
					}
					// Insert a copy of the replacement word
					w = word.clone();
					// Peform transition-in
					if (modifier === "replace")
					{
						Utils.transitionReplace(e, w, "dissolve", modifier === "append");
					}
					else
					{
						(modifier === "append" ? e.last() : e.first().before(w));
						Utils.transitionIn(w, "dissolve");
					}

					return w;
				}
				else
				{
					// TODO: Error message
					return e;
				}
			});
		}

		return this;
	}
	
	/*
		Creates an array of jQuery objects containing the chars in the selector.
		The selector is currently just a search string.
	*/
	function findCharSpans(selector, top)
	{
		// Recursive call
		return _findCharSpans(selector, $(Utils.charSpanSelector, top), true);
	}
	
	//Gets the char value of a charspan element
	function _elementGetChar(elem)
	{
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("data-char"));
	}
	
	function _findCharSpans(selector, chars, fullword)
	{ 
		var selector, temp, query, el1, el2, i,
			ret = (fullword ? [] : $());
		
		// Crudely coerce to string
		selector += "";

		if (selector.length > 1)
		{
			// Recursive case: see if each instance of search string's first character is followed
			// by search string's next character.
			for (i = 0; i < chars.length; i++)
			{
				el1 = chars.get(i);
				el2 = chars.get(i + 1);
				if (el2)
				{
					if (_elementGetChar(el1) === selector[0] && _elementGetChar(el2) === selector[1])
					{
						// See if a further search yields profit
						query = _findCharSpans(selector.slice(1), chars.slice(i+1, i+selector.length), false);
						// If so, add the element and the search's results to the return set.
						if (query)
						{
							if (fullword)
							{
								ret.push($(el1).add(query));
							}
							else
							{
								ret = ret.add(el1).add(query);
							}
						}
					}
				}
			}
		}
		else
		{
			// Base case: return char if it matches the search string.
			temp = (chars.attr("data-char") === selector ? chars.first() : null);
			if (fullword)
			{
				ret.push(temp);
			} else
			{
				ret = temp;
			}
		}
		return (ret.length > 0 || fullword ? ret : null);
	};
	
	var WordArray = {
	
		// Used for duck-typing
		wordarray: true,
		
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
		
		// Updates this WordArray's contents to match its selector.
		refresh: function(word, top)
		{
			var type = Utils.type(word),
				other = this;
			
			// Turn each matched element in the jQuery into a separate word.
			function forEachjQuery() {
				other.contents.push($(this).find(Utils.charSpanSelector));
			};
			
			this.contents = [];
			switch(type)
			{
				case "wordarray":
				{
					this.contents.concat(word.contents);
					break;
				}
				case "jquery":
				{
					word.each(forEachjQuery);
					break;
				}
				case "jquery string":
				{
					// Remove $(" and ") from the string. 
					$(word.replace(/^\$\(["']|["']\)$/, '')).each(forEachjQuery);
					break;
				}
				case "wordarray string":
				{
					// Remove quote marks.
					this.contents = findCharSpans(word.slice(1,-1), top);
					break;
				}
				case "hook string":
				{
					Utils.hookTojQuery(word, top).each(forEachjQuery);
					break;
				}
			}
		},
		
		create: function(word, top)
		{
			var ret = Object.create(this);

			ret.refresh(word, top);
			return ret;
		},
		
		// replace(str): Takes a string, charSpans it, then
		// replaces this WordArray's words with it.
		replace: function(word)
		{
			return modifyWordArray.call(this,word,"replace");
		},
		
		// append(str): appends instead of replaces.
		append: function(word)
		{
			return modifyWordArray.call(this,word,"append");
		},
		
		// prepend(str): prepends instead of replaces.
		prepend: function(word)
		{
			return modifyWordArray.call(this,word,"prepend");
		},
		
		// remove(): removes the chars from the DOM.
		remove: function()
		{
			this.contents.forEach(function(e)
			{
				// TODO: use transition-out
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
		
		// unhook(): removes whatever hook(s) the spans are contained in.
		//
		// The rule is as follows:
		// For each char, find something .closest(".hook")
		// and .unwrap() its children.
		unhook: function()
		{
			var i, l;
			for (i = 0; i < this.contents.length; i++)
			{
				l = this.contents[i].closest(".hook");
				if (l.length)
				{
					l.children().unwrap();
				}
			};
			return this;
		}
	};
	
	// Mirror a couple of other jQuery methods on WordArray
	// Note to self: add jQueryUI's version of addClass, pronto.
	[ "addClass", "removeClass", "toggleClass", "show", "hide" ].forEach(function(func)
	{
		WordArray[func] = function()
		{
			var i, a = arguments;
			for (i = 0; i < this.contents.length; i++)
			{
				this.contents[i][func](a);
			};
			return this;
		};
	});
	
	return Object.freeze(WordArray);
});