define(['jquery'], function($)
{
	"use strict";
	/*
		utils: Utility functions, constants, etc.
		Exported singleton: utils
	*/
	
	var p = $('<p>'),
		utils = Object.freeze({

		// Make object properties non-deletable and non-writable.
		lockProperties: function(obj)
		{
			var i, prop,
				keys = Object.keys(obj),
				propDesc = {};
				
			for (i = 0; i < keys.length; i++)
			{
				prop = keys[i];
				
				propDesc[prop] = {
					enumerable: true,
					writable: false
				};
			}
			return Object.defineProperties(obj, propDesc);
		},

		// Clone - faster than $.extend({}, ...)
		clone: function(obj) {
			var i, ret = Object.create(Object.getPrototypeOf(obj)),
				keys = Object.keys(obj),
				prop;
			for (i = 0; i<keys.length; i++) {
				prop = obj[keys[i]];
				ret[keys[i]] = $.isPlainObject(prop) ? utils.clone(prop) : prop;
			}
			return ret;
		},
		
		/*
			Get the type of a scope string or Twine-specific object.
			Returns a string.
			For strings, determines the type of scope selector used.
		*/
		type: function(val) {
			var r;
			if (!val)
			{
				return "undefined";
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
				//TODO: permit either quote form in jQuery selector
				r = /\$\("([^"]*)"\)|"((?:[^"\\]|\\.)*)"|\?(\w*)/.exec(val);
				if (r && r.length)
				{
					// jQuery selector $("...")
					if (r[1])
					{
						return "jquery string";
					}
					// Word selector "..."
					if (r[2])
					{
						return "wordarray string";
					}
					// Hook ?...
					if (r[3])
					{
						return "hook string";
					}
				}
				return "undefined";
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
			return $(utils.hookToSelector(c.slice(1), top))
		},
		
		// Takes a string containing a character or HTML entity, and wraps it into a
		// <span> tag (converting the entity if it is one).
		charToSpan: function(c)
		{
			return "<span class='char' data-char='"
				+ utils.HTMLEntityConvert(c) + "'>"
				+ c + "</span>";
		},
		
		// Calls charToSpan() on the whole string.
		charSpanify: function(text)	{
			return text.replace(/&[#\w]+;|./g, utils.charToSpan);
		},
		
		// Selector for CharSpans
		charSpanSelector: "span.char, br",
		
		// Default value for variables affected with <<set>>
		defaultValue: 0,
		
		// Regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
		// string. This accounts for both quote styles and escaped quote characters.
		unquotedCharRegexSuffix: "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)"
	});
	return utils;
});