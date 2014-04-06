define(['jquery', 'selectors', 'regexstrings', 'customelements'], function($, Selectors, RegexStrings) {
	"use strict";

	// Used by HTMLEntityConvert and transitionTimes
	var p = $('<p>'),
		// Used to cache t8n animation times
		t8nAnimationTimes = {
			"transition-in": Object.create(null),
			"transition-out": Object.create(null)
		};
	
	/**
		A static class with helper methods used throughout Harlowe.

		@class Utils
	*/

	var Utils = {
		/**
			Make object properties immutable and impossible to delete,
			without preventing the object from being extended.

			@method lockProperties
			@param {Object} obj		object to lock
		*/

		lockProperties: function (obj) {
			var i, prop,
				keys = Object.keys(obj),
				propDesc = {};

			for (i = 0; i < keys.length; i++) {
				prop = keys[i];

				propDesc[prop] = {
					configurable: 0,
					writable: 0
				};
			};

			return Object.defineProperties(obj, propDesc);
		},

		/**
			Locks a particular property of an object.
			Make object properties immutable and impossible to delete,
			without preventing the object from being extended.

			@method lockProperties
			@param {Object} obj		Object to lock
		*/

		lockProperty: function (obj, prop, value) {
			var propDesc = {
				configurable: 0,
				writable: 0
			};
			value && (propDesc.value = value);
			Object.defineProperty(obj, prop, propDesc);
		},

		/**
			Object.create variant that takes a set of properties
			instead of a set of property descriptors.
			
			@method create
			@param {Object} proto	The prototype of the returned object.
			@param {Object} props	The properties to add to the returned object.
			@param {Boolean} [enumerable]	Whether the properties must be enumerable.
			@return {Object} created object
		*/
		
		create: function(proto, props, enumerable) {
			var i, prop, keys, propDesc;
			
			if (!props) {
				return Object.create(proto);
			}
			keys = Object.keys(props),
			propDesc = {};
			
			for (i = 0; i < keys.length; i++) {
				prop = keys[i];

				propDesc[prop] = {
					value: props[prop],
					writable: 1,
					configurable: 1,
					enumerable: enumerable
				};
			};
			return Object.defineProperties(Object.create(proto), propDesc);
		},
		
		/**
			A faster way to clone an object than $.extend({}, ...).

			@method clone
			@param {Object} obj	object to clone
			@return {Object} cloned object
		*/

		clone: function (obj) {
			var i,
				ret = Object.create(Object.getPrototypeOf(obj)),
				keys = Object.keys(obj),
				prop;

			for (i = 0; i < keys.length; i++) {
				prop = obj[keys[i]];
				ret[keys[i]] = $.isPlainObject(prop) ? Utils.clone(prop) : prop;
			}

			return ret;
		},

		/*
			String utilities
		*/

		/**
			Returns whether a value is either a string or array.

			@method stringOrArray
			@param n	value to test
			@return {Boolean}
		*/

		stringOrArray: function (n) {
			return (typeof n === "string" || Array.isArray(n));
		},

		/**
			Splits a string, but only at unquoted separator characters.

			@method splitUnquoted
			@param {String} str		string to split
			@param {String} split		separator, default single space
			@return {Array} array of strings
		*/

		splitUnquoted: function (str, split) {
			return str.split(new RegExp((split || " ") + RegexStrings.unquoted));
		},

		/**
			Returns the type of a scope string or Twine-specific object.

			@method scopeType
			@param val		value to examine
			@return {String} description
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
				r = /\$\("([^"]*)"\)|\$\('([^']*)'\)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\?(\w*)/.exec(val);

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
					};
				}

				return "undefined";
			}
		},
		
		/**
			For speed, convert common entities quickly, and convert others with jQuery.

			@method convertEntity
			@param {String} text		text to convert
			return {String} converted entity
		*/

		convertEntity: function (text) {
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
					return p.html(text).text();
			}
		},

		/**
			Convert a CSS class selector chain (".magic.link") into
			a HTML classlist attribute (e.g. class="magic link").

			@method classListToSelector
			@param {String} list	chain to convert
			@return {String} classlist string
		*/

		classListToSelector: function (c) {
			if (typeof c === "string") {
				return "." + c.replace(/ /g, ".");
			}
		},

		/**
			Convert a HTML classlist attribute (e.g. class="magic link") into 
			a CSS class selector chain (".magic.link").

			@method classListToSelector
			@param {String} list	chain to convert
			@return {String} classlist string
		*/

		selectorToClassList: function (c) {
			if (typeof c === "string") {
				return c.replace(/\./g, " ").trim();
			}
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

		/**
			Convert a hook index string into a jQuery object.

			@method hookTojQuery
			@param {String} c		Hook index (such as "?cupboard")
			@param {Element} top	Passage element parent
			@return jQuery object
		*/

		hookTojQuery: function (c, top) {
			return Utils.$(Utils.hookToSelector(c.slice(1) /* slice off the ? sigil */), top)
		},

		/**
			Convert "$('selector')" to a jQuery object.

			@method jQueryStringTojQuery
			@param {String} jQuery invocation
			@return jQuery object
		*/

		jQueryStringTojQuery: function (word) {
			return $(word.replace(/^\$\(["']|["']\)$/, ''));
		},

		/**
			Takes a string containing a character or HTML entity, and wraps it into a
			<tw-char> tag, converting the entity if it is one.

			@method charToSpan
			@param {String} chararctr
		*/

		charToSpan: function (c) {
			// Use single-quotes if the char is a double-quote.
			var quot = (c === "&#39;" ? '"' : "'"),
				value = Utils.convertEntity(c);

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

			@method charToSpan
			@param {String} source string
			@return {String} HTML source
		*/

		charSpanify: function (text) {
			if (typeof text !== "string") {
				Utils.impossible("charSpanify received a non-string");
				return text;
			}
			return text.replace(/&[#\w]+;|./g, Utils.charToSpan);
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

			if (typeof s == "string") {
				s = s.toLowerCase();

				if (s.slice(-2) == "ms")
					return (+s.slice(0, -2)) || 0;
				if (s.slice(-1) == "s")
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

		/*
			Element utilities
		*/

		/**
			Find the closest enclosing hook span(s) for the passed jQuery object, if any.

			@method closestHookSpan
			@param elems 	jQuery object
		*/

		closestHookSpan: function (elems) {
			var ret = elems.closest(Selectors.hook + "," + Selectors.pseudoHook);
			return (ret.length ? ret : elems);
		},

		/**
			Replaces oldElem with newElem while transitioning between both.

			@method transitionReplace
			@param oldElem 		a jQuery object currently in the DOM or DOM structure
			@param newElem			an unattached jQuery object to attach
			@param transIndex		transition to use
		*/

		transitionReplace: function (oldElem, newElem, transIndex) {
			var delay, container1, container2a, container2b;

			oldElem = Utils.closestHookSpan(oldElem);

			// Create a transition-main-container
			container1 = $('<tw-transition-container>').css('position', 'relative');

			// Connect to DOM
			container1.insertBefore(oldElem.first());

			if (newElem) {
				// Create a transition-in-container
				container2a = $('<tw-transition-container>').appendTo(container1);

				// Insert new element
				newElem.appendTo(container2a);
			}

			// Create a transition-out-container
			// while inserting it into the transition-main-container.
			container2b = $('<tw-transition-container>').css('position', 'absolute')
				.prependTo(container1);

			// Insert old element
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
			@param {jQuery} el			element to transition out
			@param (String) transIndex		transition to use			
			@param {Function} onComplete	function to call when completed
		*/

		transitionOut: function (el, transIndex, onComplete) {
			var delay;

			onComplete = onComplete || function () {
				el.remove();
			};
			el.attr("data-t8n", transIndex).addClass("transition-out");

			// Ideally I'd use this:
			//.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ oldElem.remove(); });
			// but in the event of CSS being off, these events won't trigger - whereas the below method will simply occur immedately.

			delay = Utils.transitionTime(transIndex, "transition-out");
			
			!delay ? onComplete() : window.setTimeout(onComplete, delay);
		},

		/**
			Transition an element in.
		
			@method transitionIn
			@param {jQuery} el			element to transition out
			@param (String) transIndex		transition to use		
			@param {Function} onComplete	function to call when completed
		*/

		transitionIn: function (el, transIndex, onComplete) {
			var delay;

			onComplete = onComplete || function () {
				el.removeClass("transition-in");
			};
			el.attr("data-t8n", transIndex).addClass("transition-in");
			delay = Utils.transitionTime(transIndex, "transition-in");
			
			!delay ? onComplete() : window.setTimeout(onComplete, delay);
		},
		
		/**
			Caches the CSS time (duration + delay) for a particular transition,
			to save on costly $css() lookups.
		
			@method transitionTime
			@param (String) transIndex		Transition to use		
			@param {Number} Length of the transition in milliseconds
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
			
			@method log
			@param data			line to log
		*/
		
		log: function (data) {
			return console.log(data);
		},
		
		/**
			Internal error logging function. Currently a wrapper for console.warn.

			@method log
			@param data			line to log
		*/
		
		impossible: function (where, data) {
			return console.warn(where + "(): " + data);
		},
		
		/*
			Constants
		*/
		// Default value for variables affected with <<set>>
		defaultValue: 0,

		// Story element
		storyElement: $("tw-story")
	};
	
	Utils.log("Utils module ready!");
	
	return Object.freeze(Utils);
});