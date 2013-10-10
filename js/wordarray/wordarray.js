define(['jquery', 'utils'], function ($, Utils)
{
	"use strict";
	/* 
	   WordArray
	   Object containing a sequential set of jQuery-wrapped charspans
	   that correspond to a search term in the passage text.
	*/
	
	var WordArray;
	
	// Modifier: "prepend", "append", "replace"
	function modifyWordArray(word, modifier, t8n)
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
						return this;
					}
					// Insert a copy of the replacement word
					w = word.clone();
					// Peform transition-in
					if (modifier === "replace")
					{
						Utils.transitionReplace(e, w, t8n || "dissolve", modifier === "append");
					}
					else
					{
						(modifier === "append" ? e.last().after(w) : e.first().before(w));
						Utils.transitionIn(w, t8n || "dissolve");
					}
				}
				else
				{
					// TODO: Error message
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
		return _findCharSpans(selector, Utils.$(Utils.charSpanSelector, top), true);
	}
	
	//Gets the char value of a charspan element
	function _elementGetChar(elem)
	{
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("data-char"));
	}
	
	function _findCharSpans(selector, chars, fulltext)
	{ 
		var selector, temp, query, el1, el2, i,
			ret = (fulltext ? [] : $());
		
		// Coerce to string
		selector += "";
		if (selector.length > 1 || fulltext)
		{
			// Recursive case: see if each instance of search string's first character is followed
			// by search string's next character.
			for (i = 0; i < chars.length; i++)
			{
				el1 = chars.get(i);
				// If length <= 1, don't bother checking next char
				query = ((selector.length <= 1 || i >= chars.length - 1) && (_elementGetChar(el1) === selector[0]) && el1);
				
				if (!query)
				{
					el2 = chars.get(i + 1);
					if (el2 && _elementGetChar(el1) === selector[0] && _elementGetChar(el2) === selector[1])
					{
						// See if a further search yields profit
						query = _findCharSpans(selector.slice(1), chars.slice(i+1, i+selector.length), false);
					}
				}
				// Add the results to the return set.
				if (query)
				{
					if (fulltext)
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
		else
		{
			// Base case: return char if it matches the search string.
			temp = (chars.attr("data-char") === selector ? chars.first() : []);
			if (fulltext)
			{
				ret.push(temp);
			}
			else
			{
				ret = temp;
			}
		}
		return (ret.length > 0 || fulltext ? ret : void 0);
	};
	
	WordArray = {
		
		// Used for duck-typing
		wordarray: true,
		
		// Number of selected words in the array
		get length()
		{
			return this.contents.length;
		},
		
		// An alias for use by macro invokers (e.g. <<print ?hook.count()>>)
		get count()
		{
			return this.contents.length;
		},
		
		first: function()
		{
			return this.reduce(this.contents[0]);
		},
		
		last: function()
		{
			return this.reduce(this.contents[this.contents.length - 1]);
		},
		
		// Return a copy of this WordArray, but with all but the given jQuery removed from contents.
		reduce: function(elem)
		{
			var ret = Utils.clone(this);
			ret.contents = [elem];
			return ret;
		},
		
		// Get the text of the first element, or the n-th if index is specified.
		text: function(index)
		{
			if (this.contents.length)
			{
				return this.contents[(+index) || 0].text();
			}
			return "";
		},
		
		// Updates this WordArray's contents to match its selector(s).
		refresh: function(top)
		{
			var other = this,
				type, i, word, invalid;
				
			// Turn each matched element in the jQuery into a separate word.
			function forEachjQuery()
			{
				other.contents.push($(this).find(Utils.charSpanSelector));
			}
			
			this.contents = [];
			
			for (i = 0; i < this.selectors.length; i+=1)
			{
				word = this.selectors[i];
				type = Utils.scopeType(word);

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
						Utils.jQueryStringTojQuery(word).each(forEachjQuery);
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
					default:
					{
						invalid += 1;
						break;
					}
				}
			}
			if ((this.selectors.length - 1) === invalid)
			{
				throw new TypeError("invalid WordArray selector" + (this.selectors.length ? "s" : "") + ": "+this.selectors.join(" "));
			}
		},
		
		create: function(selectorstring, top)
		{
			var ret = Object.create(this);
			ret.selectors = [].concat(selectorstring);
			ret.refresh(top);
			return ret;
		},
		
		// replace(str): Takes a string, charSpans it, then
		// replaces this WordArray's words with it.
		// Note: unlike jQuery, this is an in-place modification.
		replace: function(word, t8n)
		{
			return modifyWordArray.call(this,word,"replace", t8n);
		},
		
		// append(str): appends instead of replaces.
		append: function(word, t8n)
		{
			return modifyWordArray.call(this,word,"append", t8n);
		},
		
		// prepend(str): prepends instead of replaces.
		prepend: function(word, t8n)
		{
			return modifyWordArray.call(this,word,"prepend", t8n);
		},
		
		// remove(): removes the chars from the DOM.
		remove: function()
		{
			this.contents.forEach(function(e)
			{
				e.length > 1 && (e = e.wrapAll('<span class="transition-out-container"/>'));
				Utils.transitionOut(e, "dissolve");
			});
			this.contents = [];
			return this;
		},
		
		// style: alters the style attribute of all chars
		style: function(style)
		{
			this.contents.forEach(function(e)
			{
				e.attr("style",style);
			});
			return this;
		}
	};
	//Make text() its toString() method, so that <<print ?hook>> etc. works.
	WordArray.toString = WordArray.text;
	
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