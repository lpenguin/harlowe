define(['jquery', 'utils', 'selectors'], function ($, Utils, Selectors) {
	"use strict";
	/**
		WordArray
		Object containing a sequential set of jQuery-wrapped charspans
		that correspond to a search term in the passage text.
		
		@class WordArray
	*/

	var WordArray;

	
	/**
		Convert a string or WordArray to a jQuery of spanified HTML,
		ready to supplant another word in the DOM. Otherwise, leave it.
		@method wordTojQuery
		@private
		@param {String|WordArray} word The word to convert.
		@return {jQuery} the converted word.
	*/
	function wordTojQuery(word) {
		if (word.wordarray && word.contents.length[0]) {
			return word.contents[0];
		} else if (typeof word === "string") {
			return $(Utils.charSpanify(word));
		}
		return word;
	}
		
	/**
		The generic WordArray modification function called by WordArray.replace,
		WordArray.prepend, etc.
		
		If passed a function as the 'word', it is run once for each replacement
		and is expected to provide a string.
		
		@method modifyWordArray
		@private
		@param {String|Function|WordArray|jQuery} word The replacement word.
		@param {String} modifier Either "replace", "prepend" or "append".
		@param {String} t8n The CSS transition to use.
		@return this
	*/
	function modifyWordArray(word, modifier, t8n) {

		if (typeof word !== "function" && !word.jquery) {
			return this;
		}
		word = wordTojQuery(word);

		// Functions should be considered words of indefinite length.
		// Only continue if it definitely isn't zero-length.
		if (typeof word === "function" || word.length) {
			// Replace the words
			this.contents = this.contents.map(function (e) {
				var w, thisWord;
				
				// If the word is a function, run that function anew for this replacement.
				// Each replacement gets a fresh call.
				if (typeof word === "function") {
					thisWord = wordTojQuery(word());
				} else {
					thisWord = word;
				}
				
				// Check that the word is a jQuery
				if (e && e.jquery) {
					// Waste not...
					if (modifier === "replace" && e.text() === thisWord) {
						return this;
					}
					// Insert a copy of the replacement word
					w = thisWord.clone();
					// Peform transition-in
					if (modifier === "replace") {
						Utils.transitionReplace(e, w, t8n || "dissolve", modifier === "append");
					} else {
						(modifier === "append" ? e.last().after(w) : e.first().before(w));
						Utils.transitionIn(w, t8n || "dissolve");
					}
				} else {
					Utils.impossible("Engine.modifyWordArray", "this.contents contained the non-jQuery object, " + e);
				}
			});
		}

		return this;
	}

	/**
		Creates an Array of jQuery objects, queried from the given DOM,
		which contain the chars in the selector.
		The selector is currently just a text search string.
		
		@method findCharSpans
		@private
		@param {String} selector The search string.
		@param {jQuery} top The DOM to search.
		@return {Array} An array of jQuery objects.
	*/
	function findCharSpans(selector, top) {
		// Recursive call
		return _findCharSpans(selector, Utils.findAndFilter(top, Selectors.charSpan), true);
	}

	/**
		Gets the value of a charSpan element.
		Needed because <br> elements are also considered charspans, but lack a 'value' attribute.
		@method _findCharSpans
		@private
		@param {String} selector The search string.
		@param {jQuery} chars The charspans to search.
		@param {Boolean} fulltext Whether this is the full text. If true, then
		the recursive call results are put nto an array instead of a jQuery collection.
	*/
	function _elementGetChar(elem) {
		return (elem.tagName === "br" ? "\n" : elem.getAttribute("value"));
	}

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

	WordArray = {

		/**
			Used for duck-typing
			@property wordarray
			@type Boolean
			@final
		*/
		wordarray: true,

		/**
			Number of selected words in the array
			@property length
			@type Number
		*/
		get length() {
			return this.contents.length;
		},

		/**
			An alias for use by macro invokers (e.g. <<print ?hook.count()>>)
			@property count
			@type Number
		*/
		get count() {
			return this.contents.length;
		},

		/**
			Returns the first jQuery element in this WordArray.
			@method first
			@return {jQuery}
		*/
		first: function () {
			return this.reduce(this.contents[0]);
		},
		
		/**
			Returns the last jQuery element in this WordArray.
			@method last
			@return {jQuery}
		*/
		last: function () {
			return this.reduce(this.contents[this.contents.length - 1]);
		},
		
		/**
			All the selectors, space-separated.
			Commonly used just to retrieve the first and only selector.

			@property selector
			@type String
		*/
		get selector() {
			return this.selectors.join(' ');
		},

		/**
			Return a copy of this WordArray, but with only the given jQuery as its contents.
			TODO: should it throw an error if the given jQuery is not already in its contents?
			
			@method reduce
			@param {jQuery} elem 
			@return {jQuery}
		*/
		reduce: function (elem) {
			var ret = Utils.clone(this);
			ret.contents = [elem];
			return ret;
		},

		/**
			Get the text of the first element, or the n-th if index is specified.
			
			@method text
			@param {Number} index 
			@return {String} The text of the given element.
		*/
		text: function (index) {
			if (this.contents.length) {
				return this.contents[(+index) || 0].text();
			}
			return "";
		},

		/**
			Updates this WordArray's contents to match its selector(s).
			This queries the given DOM for selected words.
			
			@method refresh
			@param {jQuery} top The DOM in which to search. Usually the contents of one <tw-passage>.
			@return this
		*/
		refresh: function (top) {
			var other = this,
				type, i, word, invalid;

			// Turn each matched element in the jQuery into a separate word.
			function forEachjQuery() {
				other.contents.push(Utils.findAndFilter(this,Selectors.charSpan));
			}

			this.contents = [];

			for (i = 0; i < this.selectors.length; i += 1) {
				word = this.selectors[i];
				type = WordArray.scopeType(word);

				switch (type) {
					case "wordarray":
						this.contents.concat(word.contents);
						break;
					case "jquery":
						word.each(forEachjQuery);
						break;
					case "jquery string":
						// Remove $(" and ") from the string. 
						Utils.jQueryStringTojQuery(word).each(forEachjQuery);
						break;
					case "wordarray string":
						// Remove quote marks.
						this.contents = findCharSpans(word.slice(1, -1), top);
						break;
					case "hook string":
						Utils.hookTojQuery(word, top).each(forEachjQuery);
						break;
					case "it":
						//TODO
						break;
					default:
						invalid += 1;
						break;
				}
			}
			if ((this.selectors.length - 1) === invalid) {
				throw new TypeError("invalid WordArray selector" + (this.selectors.length ? "s" : "") + ": " + this.selectors.join(
					" "));
			}
			return this;
		},

		/**
			Returns the type of a scope string or Twine-specific object.

			@method scopeType
			@static
			@param val Value to examine
			@return {String} Description
		*/
		scopeType: function (val) {
			var r;

			// Coerce empty string and null to undefined

			if (!val) {
				return "undefined";
			} else if (typeof val === "object") {
				if (val.wordarray)
					return "wordarray";
				else if (val.jquery)
					return "jquery";
			} else if (typeof val === "string") {
				r = /\$\("([^"]*)"\)|\$\('([^']*)'\)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\?(\w*)|\bit\b/.exec(val);

				if (r && r.length) {
					// jQuery selector $("..."), $('...')

					if (r[1] || r[2]) {
						return "jquery string";
					}
					// Word selector "...", '...'
					else if (r[3] || r[4]) {
						return "wordarray string";
					}
					// Hook ?...
					else if (r[5]) {
						return "hook string";
					}
					// it selector
					else if (r[6]) {
						return "it";
					}
				}

				return "undefined";
			}
		},
		
		/**
			Creates a new object which inherits from this (i.e. is a WordArray instance).
			
			@method create
			@param {String|Array} selectorstring A single string, or an array, of WordArray selectors.
			@param {jQuery} top The DOM in which to search. Usually the contents of one <tw-passage>.
			@return this
		*/
		create: function (selectorstring, top) {
			var ret = Object.create(this);
			// Array.prototype.concat turns selectorstring into an array, but ignores it
			// if it's already an array.
			ret.selectors = Array.prototype.concat(selectorstring);
			ret.refresh(top);
			return ret;
		},

		/**
			Takes a string, charSpans it, then
			replaces this WordArray's words with it.
			Note: unlike jQuery, this is an in-place modification.
			
			@method replace
			@param {String} word The word to replace the WordArray's words with.
			@param {String} t8n The CSS transition to use.
			@return this
		*/
		replace: function (word, t8n) {
			return modifyWordArray.call(this, word, "replace", t8n);
		},

		/**
			Appends instead of replaces.
			
			@method append
			@param {String} word The word to replace the WordArray's words with.
			@param {String} t8n The CSS transition to use.
			@return this
		*/
		append: function (word, t8n) {
			return modifyWordArray.call(this, word, "append", t8n);
		},

		/**
			Prepends instead of replaces.
			
			@method append
			@param {String} word The word to replace the WordArray's words with.
			@param {String} t8n The CSS transition to use.
			@return this
		*/
		prepend: function (word, t8n) {
			return modifyWordArray.call(this, word, "prepend", t8n);
		},

		/**
			Removes all the words from the DOM.
			
			@method remove
			@param {String} [t8n] The CSS transition to use. Defaults to "dissolve".
			@return this
		*/
		remove: function (t8n) {
			this.contents.forEach(function (e) {
				e.length > 1 && (e = e.wrapAll('<tw-transition-container>'));
				Utils.transitionOut(e, t8n || "dissolve");
			});
			this.contents = [];
			return this;
		},

		/**
			Alters the style attribute of all chars.
			
			@method style
			@param {String} style The CSS styles to apply.
			@return this
		*/
		style: function (style) {
			this.contents.forEach(function (e) {
				e.attr("style", style);
			});
			return this;
		}
	};
	//Make text() its toString() method, so that <<print ?hook>> etc. works.
	WordArray.toString = WordArray.text;

	// Mirror a couple of other jQuery methods on WordArray
	// Note to self: add jQueryUI's version of addClass, pronto.
	["addClass", "removeClass", "toggleClass", "show", "hide"].forEach(function (func) {
		WordArray[func] = function () {
			var i, a = arguments;
			for (i = 0; i < this.contents.length; i++) {
				this.contents[i][func](a);
			}
			return this;
		};
	});
	
	Utils.log("WordArray object ready!");
	
	return Object.freeze(WordArray);
});
