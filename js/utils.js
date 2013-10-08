define(['jquery'], function($)
{
	"use strict";
	/*
		utils: Utility functions, constants, etc.
		Exported singleton: utils
	*/
	
	// Used by HTMLEntityConvert
	var p = $('<p>'),
		Utils = {
		
		/*
			Object utilities
		*/

		// Make object properties non-deletable and non-writable,
		// without making the object non-extensible.
		lockProperties: function(obj)
		{
			var i, prop,
				keys = Object.keys(obj),
				propDesc = {};
				
			for (i = 0; i < keys.length; i++)
			{
				prop = keys[i];
				
				propDesc[prop] = {
					configurable: 0,
					writable: 0
				};
			}
			return Object.defineProperties(obj, propDesc);
		},
		
		lockProperty: function(obj, prop, value)
		{
			var propDesc = { configurable: 0, writable: 0 };
			value && (propDesc.value = value);
			Object.defineProperty(obj,prop, propDesc);
		},

		// Clone - faster than $.extend({}, ...)
		clone: function(obj) {
			var i, ret = Object.create(Object.getPrototypeOf(obj)),
				keys = Object.keys(obj),
				prop;
			for (i = 0; i<keys.length; i++) {
				prop = obj[keys[i]];
				ret[keys[i]] = $.isPlainObject(prop) ? Utils.clone(prop) : prop;
			}
			return ret;
		},
		
		/*
			String utilities
		*/
		
		// Shorthand
		stringOrArray: function(n)
		{
			return (typeof n === "string" || Array.isArray(n));
		},
	
		/*
			Get the type of a scope string or Twine-specific object.
			Returns a string.
		*/
		scopeType: function(val)
		{
			var r;
			// Coerce empty string and null to undefined
			if (!val)
			{
				return void 0+"";
			}
			if (typeof val === "object")
			{
				if (val.wordarray)
				{
					return "wordarray";
				}
				if (val.jquery)
				{
					return "jquery";
				}
			}
			else if (typeof val === "string")
			{
				r = /\$\("([^"]*)"\)|\$\('([^']*)'\)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\?(\w*)/.exec(val);
				if (r && r.length)
				{
					// jQuery selector $("..."), $('...')
					if (r[1] || r[2])
					{
						return "jquery string";
					}
					// Word selector "...", '...'
					if (r[3] || r[4])
					{
						return "wordarray string";
					}
					// Hook ?...
					if (r[5])
					{
						return "hook string";
					}
				}
				return void 0+"";
			}
		},

		// For speed, convert common entities quickly, and convert others with jQuery.
		HTMLEntityConvert: function(text)
		{
			if (text.length <= 1)
			{
				return text;
			}
			switch(text)
			{
				case "&lt;": return '<';
				case "&gt;": return '>';
				case "&amp;": return '&';
				case "&quot;": return '"';
				case "&#39;": return "'";
				case "&nbsp;": return String.fromCharCode(160);
				case "&zwnj;": return String.fromCharCode(8204);
				default: return p.html(text).text();
			}
		},
		
		// Convert a class selector chain (".magic.link") into a HTML classlist attribute.
		classListToSelector: function(c)
		{
			if (typeof c === "string")
			{
				return "." + c.replace(/ /g, ".");
			}
		},
		
		// ...and, vice versa.
		selectorToClassList: function(c)
		{
			if (typeof c === "string")
			{
				return c.replace(/\./g, " ").trim();
			}
		},
		
		// Convert a hook index string to a selector.
		hookToSelector: function(c)
		{
			c = c.replace(/"/g, "&quot;");
			return '.hook[data-hook="' + c + '"]';
		},
		
		// Convert a hook index string into a jQuery.
		hookTojQuery: function(c, top)
		{
			return Utils.$(Utils.hookToSelector(c.slice(1)), top)
		},
		
		// Convert "$('selector')" to a jQuery.
		jQueryStringTojQuery: function(word)
		{
			return $(word.replace(/^\$\(["']|["']\)$/, ''));
		},
		
		// Takes a string containing a character or HTML entity, and wraps it into a
		// <span> tag (converting the entity if it is one).
		charToSpan: function(c)
		{
			var quot = (c === "&#39;" ? '"' : "'");
			return "<span class='char' data-char="
				+ quot + Utils.HTMLEntityConvert(c) + quot + ">"
				+ c + "</span>";
		},
		
		// Calls charToSpan() on the whole string.
		charSpanify: function(text)
		{
			return text.replace(/&[#\w]+;|./g, Utils.charToSpan);
		},

		// Takes a string argument, expressed as a CSS time,
		// and returns the time in milliseconds that it equals.
		// Or, when given an array, takes all valid strings contained
		// and returns an array of times.
		cssTimeUnit: function(s)
		{
			var ret;
			if (typeof s == "string")
			{
				s = s.toLowerCase();
				if (s.slice(-2) == "ms")
				{
					return (+s.slice(0, -2)) || 0;
				}
				if (s.slice(-1) == "s")
				{
					return (+s.slice(0, -1)) * 1000 || 0;
				}
			}
			else if (Array.isArray(s))
			{
				ret = [];
				s.forEach(function(e) {
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
		
		// Find the closest enclosing hook span for the passed jQuery, if any.
		closestHookSpan: function(elems)
		{
			var ret = elems.closest(".hook, .pseudo-hook");
			
			return (ret.length ? ret : elems);
		},
		
		/*
			Replaces oldElem with newElem while transitioning between both.
			oldElem: required - a jQuery currently in the DOM or DOM structure
			newElem: an unattached jQuery to attach
		*/
		transitionReplace: function(oldElem, newElem, transIndex)
		{
			var delay, container1, container2a, container2b;
			
			oldElem = Utils.closestHookSpan(oldElem);
			
			// Create a transition-main-container
			container1 = $('<span class="transition-main-container"/>');
			// Connect to DOM
			container1.insertBefore(oldElem.first());
			
			if (newElem)
			{
				// Create a transition-in-container
				container2a = $('<span class="transition-in-container"/>').appendTo(container1);
				// Insert new element
				newElem.appendTo(container2a);
			}
			// Create a transition-out-container
			// while inserting it into the transition-main-container.
			container2b = $('<span class="transition-out-container"/>').prependTo(container1);
			// Insert old element
			oldElem.detach().appendTo(container2b);
			
			// Transition-out the old element, removing it
			Utils.transitionOut(container2b, transIndex);
			// Transition-in the new element
			if (newElem)
			{
				Utils.transitionIn(container2a, transIndex, function() {
					// Remove container1 and container2a
					container2a.unwrap().children().first().unwrap();
				});
			}
		},
		
		// Transition an element out.
		// fn: optional callback.
		transitionOut: function(el, transIndex, fn)
		{
			var delay, fn = fn || function(){ el.remove(); };
			
			el.attr("data-t8n", transIndex).addClass("transition-out")
			
			// Ideally I'd use this:
			//.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ oldElem.remove(); });
			// but in the event of CSS being off, these events won't trigger - whereas the below method will simply occur immedately.
			delay = Utils.cssTimeUnit(el.css("animation-duration")) + Utils.cssTimeUnit(el.css("animation-delay"));
			!delay ? fn() : window.setTimeout(fn, delay);
		},
		
		// Transition an element in.
		// fn: optional callback.
		transitionIn: function(el, transIndex, fn)
		{
			var delay, fn = fn || function(){ el.removeClass("transition-in"); };
			
			el.attr("data-t8n", transIndex).addClass("transition-in");
			delay = Utils.cssTimeUnit(el.css("animation-duration")) + Utils.cssTimeUnit(el.css("animation-delay"));
			!delay ? fn() : window.setTimeout(fn, delay);
		},
		
		// A jQuery call that filters out transitioning-out elements
		$: function(str, context)
		{
			return $(str, context).not(".transition-out, .transition-out *");
		},
		
		/*
			Constants
		*/
		
		// Selector for CharSpans
		charSpanSelector: "span.char, br",
		
		// Default value for variables affected with <<set>>
		defaultValue: 0,
		
		// Story element
		storyElement: $('#story'),
		
		// Components for regexps
		regexStrings: {
			macroOpen: "&lt;&lt;",
			macroName: "[\\w\\-\\?\\!]+",
			notMacroClose: "(?:[^&]|&(?!gt;&gt;))*",
			macroClose: "&gt;&gt;",
			// Regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
			// string. This accounts for both quote styles and escaped quote characters.
			unquoted: "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)",
		}
	};
	return Object.freeze(Utils);
});
