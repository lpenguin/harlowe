define(['jquery', 'markup/markup', 'utils/selectors', 'utils/customelements'], function($, TwineMarkup, Selectors) {
	"use strict";

	var
		// Used by lockProperties
		lockDesc = {
			configurable: 0,
			writable: 0
		},
		// Used to cache t8n animation times
		t8nAnimationTimes = {
			"transition-in": Object.create(null),
			"transition-out": Object.create(null)
		};

	/**
		A static class with helper methods used throughout Harlowe.

		@class Utils
		@static
	*/

	var Utils = {
		/**
			Make object properties immutable and impossible to delete,
			without preventing the object from being extended.

			Does not do a 'deep' lock - object properties may, in themselves, be modified.

			@method lockProperties
			@param {Object} obj		Object to lock
			@return The locked object
		*/

		lockProperties: function (obj) {
			var i, prop,
				keys = Object.keys(obj),
				propDesc = {};

			for (i = 0; i < keys.length; i++) {
				prop = keys[i];

				propDesc[prop] = lockDesc;
			}

			return Object.defineProperties(obj, propDesc);
		},

		/**
			Locks a particular property of an object.

			@method lockProperty
			@param {Object} obj		Object
			@param {String} prop	Property to lock
			@param {String} value	A value to set the property to
			@return The affected object
		*/

		lockProperty: function (obj, prop, value) {
			// Object.defineProperty does walk the prototype chain
			// when reading a property descriptor dict.
			var propDesc = Object.create(lockDesc);
			value && (propDesc.value = value);
			Object.defineProperty(obj, prop, propDesc);
			return obj;
		},

		/**
			If the arguments contain an Error, return that error.
			This also recursively examines arrays' contents.

			Maybe in the future, there could be a way to concatenate multiple
			errors into a single "report"...

			@method containsError
			@return {Error|Boolean} The first error encountered, or false.
		*/
		containsError: function(/*variadic*/) {
			return Array.from(arguments).reduce(
				function(last, e) {
					return last ? last
						: e instanceof Error ? e
						: Array.isArray(e) ? Utils.containsError.apply(this, e)
						: false;
					}, false);
		},

		/*
			String utilities
		*/

		/*
			In some places, it's necessary to print numbers, strings and arrays of primitives
			as JS literals. This is a semantic shortcut for a certain
			built-in method that can accomplish this easily.

			@method toJSLiteral
			@return {String}
		*/
		toJSLiteral: JSON.stringify,

		/*
			Conversely, this rarer function produces a TwineScript string literal using the
			given string.

			@method toTSStringLiteral
			@return {String}
		*/
		toTSStringLiteral: function(str) {
			var consecutiveGraves =
				Math.max.apply(
					0,
					/*
						This finds the length of the longest run of ` characters in the string.
					*/
					(str.match(/(`+)/g) || []).map(function(e) { return e.length; }).concat(0)
				) + 1;
			return "`".repeat(consecutiveGraves)
				+ str
				+ "`".repeat(consecutiveGraves);
		},

		/**
			Takes a string argument, expressed as a CSS time,
			and returns the time in milliseconds that it equals.
			Or, when given an array, takes all valid strings contained
			and returns an array of times in milliseconds.

			If the string can't be parsed as a time, then this returns 0.

			@method cssTimeUnit
			@param s		either string, or array of strings
			@return either single string or array of times
		*/
		cssTimeUnit: function (s) {
			var ret;

			if (typeof s === "string") {
				s = s.toLowerCase();

				if (s.slice(-2) === "ms")
					return (+s.slice(0, -2)) || 0;
				if (s.slice(-1) === "s")
					return (+s.slice(0, -1)) * 1000 || 0;
			} else if (Array.isArray(s)) {
				ret = [];
				s.forEach(function (e) {
					var time = Utils.cssTimeUnit(e);
					(time > 0 && ret.push(time));
				});

				return ret;
			}

			return 0;
		},

		/**
			A quick method for turning a number into an "nth" string.

			@method nth
			@param {String|Number} num
			@return {String}
		*/
		nth: function (num) {
			var lastDigit = (num + '').slice(-1);
			return num + (
				lastDigit === "1" ? "st" :
				lastDigit === "2" ? "nd" :
				lastDigit === "3" ? "rd" : "th");
		},

		/**
			A quick method for adding an 's' to the end of a string
			that comes in the form "[num] [noun]".

			@method plural
			@param {Number} num   The quantity
			@param {String} noun  The noun to possibly pluralise
			@return {String}
		*/
		plural: function (num, noun) {
			return num + " " + noun + (num > 1 ? "s" : "");
		},

		/*
			HTML utilities
		*/

		/**
			Unescape HTML entities.
			For speed, convert common entities quickly, and convert others with jQuery.

			@method unescape
			@param {String} text Text to convert
			@return {String} converted text
		*/
		unescape: function(text) {
			var ret;
			if (text.length <= 1)
				return text;

			switch (text) {
				case "&lt;":
					return '<';
				case "&gt;":
					return '>';
				case "&amp;":
					return '&';
				case "&quot;":
					return '"';
				case "&#39;":
					return "'";
				case "&nbsp;":
					return String.fromCharCode(160);
				case "&zwnj;":
					return String.fromCharCode(8204);
				default:
					ret = document.createElement('p');
					ret.innerHTML = text;
					return ret.textContent;
			}
		},

		/**
			HTML-escape a string.

			@method escape
			@param {String} text Text to escape
			@return {String} converted text
		*/
		escape: function(text) {
			return text.replace(/&/g, '&amp;')
				.replace(/>/g, '&gt;'  ).replace(/</g, '&lt;' )
				.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
		},

		/**
			Some names are case-insensitive, AND dash-insensitive.
			This method converts such names to all-lowercase and lacking
			underscores and hyphens.

			@method insensitiveName
			@param {String} text Text to convert.
			@return {String} converted text
		*/
		insensitiveName: function (e) {
			return (e + "").toLowerCase().replace(/-|_/g, "");
		},

		/**

			@method wrapHTMLTag
			@param {String} text Text to wrap.
			@param {String} tagName Name of the HTML tag to wrap in.
			@return {String} The wrapped text.
		*/
		wrapHTMLTag: function(text, tagName) {
			return '<' + tagName + '>' + text + '</' + tagName + '>';
		},

		/**
			Takes a string containing a character or HTML entity, and wraps it into a
			<tw-char> tag, converting the entity if it is one.

			@method charToSpan
			@param {String} character
			@return {String} Resultant HTML
		*/
		charToSpan: function(c) {
			// Use single-quotes if the char is a double-quote.
			var quot = (c === "&#39;" ? '"' : "'"),
				value = Utils.unescape(c);
			switch(value) {
				case ' ': {
					value = "space";
					break;
				}
				case '\t': {
					value = "tab";
					break;
				}
			}
			return "<tw-char value=" +
				quot + value + quot + ">" +
				c + "</tw-char>";
		},

		/**
			Converts an entire string into individual characters, each enclosed
			by a <tw-char>.

			@method charSpanify
			@param {String} text Source string
			@return {String} Resultant HTML
		*/
		charSpanify: function(text) {
			if (typeof text !== "string") {
				throw new Error("charSpanify received a non-string:" + text);
			}
			return text.replace(/&[#\w]+;|./g, Utils.charToSpan);
		},

		/*
			Element utilities
		*/

		/**
			Quick utility function that calls .filter(q).add(q).find(q),
			which is similar to just .find() but includes the top element
			if it also matches.

			@method findAndFilter
			@private
			@param q jQuery to search, or initialising string/element for $()
			@param {String} selector Query string
			@return {jQuery} jQuery result
		*/
		findAndFilter: function (q, selector) {
			q = $(q || document.documentElement);
			return q.filter(selector).add(q.find(selector));
		},

		/**
			Find the closest enclosing hook span(s) for the passed jQuery object, if any.

			@method closestHookSpan
			@param elems    jQuery object
		*/

		closestHookSpan: function (elems) {
			var ret = elems.closest(Selectors.hook + "," + Selectors.pseudoHook);
			return (ret.length ? ret : elems);
		},

		/**
			Replaces oldElem with newElem while transitioning between both.

			@method transitionReplace
			@param oldElem     a jQuery object currently in the DOM or a DOM structure
			@param [newElem]   an unattached jQuery object to attach
			@param transIndex  transition to use
			@return this
		*/

		transitionReplace: function (oldElem, newElem, transIndex) {
			var container1, container2a, container2b;

			oldElem = Utils.closestHookSpan(oldElem);

			// Create a transition-main-container
			container1 = $('<tw-transition-container>').css('position', 'relative');

			// Insert said container into the DOM (next to oldElem)
			container1.insertBefore(oldElem.first());

			if (newElem) {
				// Create a transition-in-container
				container2a = $('<tw-transition-container>').appendTo(container1);

				// Insert new element
				newElem.appendTo(container2a);
			}

			// Create a transition-out-container
			// and insert it into the transition-main-container.
			container2b = $('<tw-transition-container>').css('position', 'absolute')
				.prependTo(container1);

			// Insert the old element into the transition-out-container
			oldElem.detach().appendTo(container2b);

			// Transition-out the old element, removing it

			Utils.transitionOut(container2b, transIndex);

			// Transition-in the new element

			if (newElem) {
				Utils.transitionIn(container2a, transIndex, function () {
					// Remove container1 and container2a
					container2a.unwrap().children().first().unwrap();
				});
			}
		},

		/**
			Transition an element out.

			@method transitionOut
			@param {jQuery} el            jQuery collection to transition out
			@param (String) transIndex    transition to use
			@param {Function} onComplete  function to call when completed
		*/

		transitionOut: function (el, transIndex, onComplete) {
			var delay;

			/*
				The default transition callback is to remove the element.
			*/
			onComplete = onComplete || function () {
				el.remove();
			};
			/*
				But, for now, apply the transition.
			*/
			el.attr("data-t8n", transIndex).addClass("transition-out");

			/*
				Ideally I'd use this:
				.one("animationend webkitAnimationEnd MSAnimationEnd", function(){ oldElem.remove(); });
				but in the event of CSS being off, these events won't trigger
				- whereas the below method will simply occur immedately.
			*/
			delay = Utils.transitionTime(transIndex, "transition-out");

			!delay ? onComplete() : window.setTimeout(onComplete, delay);
		},

		/**
			Transition an element in.

			@method transitionIn
			@param {jQuery} el			    jQuery collection to transition out
			@param (String) transIndex		transition to use
			@param {Function} onComplete	function to call when completed
		*/

		transitionIn: function (el, transIndex, onComplete) {
			var delay;

			/*
				The default transition callback is to remove the transition-in
				class. (#maybe this should always be performed???)
			*/
			onComplete = onComplete || function () {
				el.removeClass("transition-in").removeAttr("data-t8n");
			};
			/*
				For now, perform the transition.
			*/
			el.attr("data-t8n", transIndex).addClass("transition-in");
			delay = Utils.transitionTime(transIndex, "transition-in");

			!delay ? onComplete() : window.setTimeout(onComplete, delay);
		},

		/**
			Caches the CSS time (duration + delay) for a particular transition,
			to save on costly $css() lookups.

			@method transitionTime
			@param (String) transIndex   Transition to use
			@param {String} className    Either "transition-in" or "transition-out"
			@return this
		*/

		transitionTime: function(transIndex, className) {
			var p;
			if (!t8nAnimationTimes[className][transIndex]) {
				p = $('<p>').appendTo(document.body).attr("data-t8n", transIndex).addClass(className);
				t8nAnimationTimes[className][transIndex] = Utils.cssTimeUnit(p.css("animation-duration")) + Utils.cssTimeUnit(p.css("animation-delay"));
				p.remove();
			}
			return t8nAnimationTimes[className][transIndex];
		},

		/**
			Runs a jQuery selector, but ignores elements that are transitioning out.

			@method $
			@param str			jQuery selector
			@param context		jQuery context
		*/

		$: function (str, context) {
			return $(str, context).not(".transition-out, .transition-out *");
		},

		/*
			Logging utilities
		*/

		/**
			Internal logging function. Currently a wrapper for console.log.
			This should be used for basic event logging.

			@method log
			@param data	line to log
		*/

		log: function (data) {
			console.log(data);
		},

		/**
			Internal error logging function. Currently a wrapper for console.error.
			This should be used for engine errors beyond the story author's control.

			@method impossible
			@param {String} where Name of the calling method.
			@param data	Line to log
		*/

		impossible: function (where, data) {
			console.error(where + "(): " + data);
		},

		/**
			Standard assertion function.

			@method assert
			@param {Boolean} assertion
		*/
		assert: function(assertion) {
			if (!assertion) {
				console.error("Assertion failed!");
			}
		},

		/**
			Asserts that an object doesn't lack a necessary property.
			This and the next method provide some shape-checking
			to important functions.

			@method assertMustHave
			@param {Object} object
			@param {Array} props
		*/
		assertMustHave: function(object, props) {
			for(var i = 0; i < props.length; i += 1) {
				if(!(props[i] in object)) {
					console.error("Assertion failed: " + object
						+ " lacks property " + props[i]);
				}
			}
		},

		/**
			Asserts that an object has no property extensions.

			@method assertOnlyHas
			@param {Object} object
			@param {Array} props
		*/
		assertOnlyHas: function(object, props) {
			for(var i in object) {
				if (props.indexOf(i) === -1) {
					console.error("Assertion failed: " + object
						+ " had unexpected property '" + i + "'!");
				}
			}
		},

		/*
			Constants
		*/

		/**
			Story element. Since Utils is frozen, this will always refer to the
			same DOM object for the entirety of the game.
			@property storyElement
			@static
		*/

		storyElement: $(Selectors.story)
	};

	return Object.freeze(Utils);
});
