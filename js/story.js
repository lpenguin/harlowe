define(['jquery'], function($)
{
	"use strict";

	// story.js contains, among other things, code related to macro *parsing*,
	// whereas macros.js contains code related to macro *implementation*.
	
	var story = {
		// Set of options, loaded at startup.
		options: {},
		
		// Set of macro definitions.
		macros: {},
		
		// Prototype object for macro instances.
		macroInstance: {},
		
		// Initialise a new macro instance
		createMacroInstance: function (html, name, startIndex, endIndex)
		{
			var macro = Object.create(this.macroInstance), selfClosing;
			macro.name = name;
			macro.data = this.macros[name];
			macro.startIndex = startIndex;
			macro.endIndex = endIndex;
			selfClosing = macro.data && macro.data.selfClosing;
			
			// HTMLCall / rawCall is the entire macro invocation, rawArgs is all arguments,
			// HTMLContents / rawContents is what's between a <<macro>> and <</macro>> call
			macro.HTMLCall = html.slice(startIndex, endIndex);
			macro.HTMLContents = (selfClosing ? "" : macro.HTMLCall.replace(/^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/i, '').replace(/&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$/i, ''));
			
			// unescape HTML entities (like "&amp;")
			macro.call = $('<p>').html(macro.HTMLCall).text();
			macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i, ''));
			macro.rawArgs = macro.call.replace(/^<<\s*\w*/, '').replace(/>>[^]*/, '');
			
			// tokenize arguments
			// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
			// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]
			macro.args = macro.rawArgs.trim().split(/\ (?=(?:[^"'\\]*(?:\\.|'(?:[^'\\]*\\.)*[^'\\]*'|"(?:[^"\\]*\\.)*[^"\\]*"))*[^'"]*$)/)
				// remove opening and closing quotes from args
				.map(function(e) {
					return e.replace(/^(['"])([^]*)\1$/, function(a,b,c) { return c; });
				});
			return macro;
		},
		
		// Performs a function for each macro instance found in the HTML.
		// macroname is a regex string specifying a particular name, otherwise all are found.
		// Callback function's argument is a macro instance.
		matchMacroTag: function(html, macroname, callback)
		{
			var macroRE = new RegExp("&lt;&lt;\\s*(" + (macroname || "\\w+") + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;",'ig'),
				macro, endMacroRE, foundMacro, foundEndMacro, nesting, selfClosing,
				endIndex, data;
			// Search through html for macro tags
			do 
			{
				foundMacro = macroRE.exec(html);
				if (foundMacro !== null)
				{
					endIndex = macroRE.lastIndex;
					data = this.macros[foundMacro[1]];
					selfClosing = true;

					// If macro is not self-closing, search for endtag
					// and capture entire contents.
					if (data && !data.selfClosing)
					{
						selfClosing = false;
						endMacroRE = new RegExp(macroRE.source + "|&lt;&lt;((?:\\/|end)"
							+ foundMacro[1] + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;","g");
						endMacroRE.lastIndex = endIndex;
						nesting = 0;
						do {
							foundEndMacro = endMacroRE.exec(html);
							if (foundEndMacro !== null)
							{
								if (foundEndMacro[2])
								{ // Found <</macro>>
									if (nesting)
									{
										nesting -= 1;
									} 
									else
									{
										endIndex = endMacroRE.lastIndex;
										break;
									}
								}
								else if (foundEndMacro[1] && foundEndMacro[1] == foundMacro[1]) { // Found nested <<macro>>
									nesting += 1;
								}
							}
							else {
								endIndex = html.length; // No end found, assume rest of passage.
							}
						} while (foundEndMacro);
					}
					macro = this.createMacroInstance(html, foundMacro[1], foundMacro.index, endIndex);
					// Run the callback
					callback(macro);
					macroRE.lastIndex = endIndex;
				}
			} while (foundMacro);
		},
		
		passageNamed: function (name)
		{
			var passage = $('div[data-role="twinestory"] div[data-name="' + name + '"]');
			return (passage.length == 0 ? null : passage);
		},
		
		passageWithId: function (id)
		{
			var passage = $('div[data-role="twinestory"] div[data-id="' + id + '"]');
			return (passage.length == 0 ? null : passage);
		}
	};
	return story;
});