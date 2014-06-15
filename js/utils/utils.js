define(['jquery', 'twinemarked', 'selectors', 'customelements'], function($, TwineMarked, Selectors) {
	"use strict";

	// Used by HTMLEntityConvert and transitionTimes
	var p = $('<p>'),
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
			};

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
				keys = Object.getOwnPropertyNames(obj),
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
			return str.split(new RegExp((split || " ") + TwineMarked.RegExpStrings.unquoted));
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
			return Utils.findAndFilter(top, Utils.hookToSelector(c.slice(1) /* slice off the ? sigil */))
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
			Quick utility function that calls .filter(q).add(q).find(q)

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
			@param elems 	jQuery object
		*/

		closestHookSpan: function (elems) {
			var ret = elems.closest(Selectors.hook + "," + Selectors.pseudoHook);
			return (ret.length ? ret : elems);
		},

		/**
			Replaces oldElem with newElem while transitioning between both.

			@method transitionReplace
			@param oldElem 		a jQuery object currently in the DOM or a DOM structure
			@param newElem			an unattached jQuery object to attach
			@param transIndex		transition to use
			@return this
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
			return this;
		},

		/**
			Transition an element out.
		
			@method transitionOut
			@param {jQuery} el			element to transition out
			@param (String) transIndex		transition to use			
			@param {Function} onComplete	function to call when completed
			@return this
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
			return this;
		},

		/**
			Transition an element in.
		
			@method transitionIn
			@param {jQuery} el			element to transition out
			@param (String) transIndex		transition to use		
			@param {Function} onComplete	function to call when completed
			@return this
		*/

		transitionIn: function (el, transIndex, onComplete) {
			var delay;

			onComplete = onComplete || function () {
				el.removeClass("transition-in");
			};
			el.attr("data-t8n", transIndex).addClass("transition-in");
			delay = Utils.transitionTime(transIndex, "transition-in");
			
			!delay ? onComplete() : window.setTimeout(onComplete, delay);
			return this;
		},
		
		/**
			Caches the CSS time (duration + delay) for a particular transition,
			to save on costly $css() lookups.
		
			@method transitionTime
			@param (String) transIndex		Transition to use		
			@param {String} className	Either "transition-in" or "transition-out"
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
			@param data			line to log
		*/
		
		log: function (data) {
			console.log(data);
		},
		
		/**
			Internal error logging function. Currently a wrapper for console.error.
			This should be used for engine errors beyond the story author's control.
			
			@method impossible
			@param data			line to log
		*/
		
		impossible: function (where, data) {
			console.error(where + "(): " + data);
		},
		
		/*
			Constants
		*/
		// Default value for variables affected with <<set>>
		defaultValue: 0,

		// Story element
		storyElement: $("tw-story")
	};
	
	$.extend(Utils, TwineMarked.Utils);
	
	Utils.log("Utils module ready!");
	
	return Object.freeze(Utils);
});
