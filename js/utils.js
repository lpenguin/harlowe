define(['jquery'], function($)
{
	// Utility functions, constants, etc.
	
	var p = $('<p>');
	
	var utils = {
		// Make all object's properties non-deletable.
		lockProperties: function(obj)
		{
			var i,
				keys = Object.keys(obj),
				propDesc = {};
				
			for (i = 0; i < keys.length; i++)
			{
				var prop = keys[i];
				
				propDesc[prop] = {
					enumerable: true
				};
				// Non-functions are writable
				propDesc[prop].writable = (typeof obj[prop] !== "function");
			}
			return Object.defineProperties(obj, propDesc);
		},

		// For speed, convert common entities quickly, and convert others with jQuery.
		HTMLEntityConvert: function(text)
		{
			switch(text)
			{
				case "&lt;": return '<';
				case "&gt;": return '>';
				case "&amp;": return '&';
				case "&quot;": return '"';
				default: return p.html(text).text();
			};
		},
		
		// Takes a string containing a character or HTML entity, and wraps it into a
		// <span> tag (converting the entity if it is one)
		charToSpan: function(c)
		{
			return "<span class='char' data-char='"
				+ (c.length > 1 ? utils.HTMLEntityConvert(c) : c) + "'>"
				+ c + "</span>";
		},
		
		// Calls charToSpan() on the whole string.
		charSpanify: function(text)	{
			return text.replace(/&[#\w]+;|./g, utils.charToSpan);
		}
	};
	return utils;
});