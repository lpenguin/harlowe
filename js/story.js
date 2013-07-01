define(['jquery'], function($)
{
	"use strict";

	var story = {
		macros: {},
		// Prototype object for macro instances.
		macroInstance: {},
		
		passageNamed: function (name)
		{
			var passage = $('div[data-role="twinestory"] div[data-name="' + name + '"]');
			return (passage.size() == 0 ? null : passage);
		},
		
		passageWithId: function (id)
		{
			var passage = $('div[data-role="twinestory"] div[data-id="' + id + '"]');
			return (passage.size() == 0 ? null : passage);
		},
		
		// Performs a function for each macro instance found in the HTML.
		// macroname is a regex string specifying a particular name, otherwise all are found.
		// Callback function's argument is a macro instance.
		matchMacroTag: function(html, macroname, callback)
		{
			var macroRE = new RegExp("&lt;&lt;\\s*(" + (macroname || "\\w+") + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;",'ig'),
				macro, endMacroRE, foundMacro, foundEndMacro, nesting, selfClosing,
				contentStart, contentEnd;
			// Search through html for macro tags
			do {
				foundMacro = macroRE.exec(html);
				if (foundMacro !== null) {
					macro = Object.create(this.macroInstance);
					$.extend(macro,	{
						name: foundMacro[1],
						data: this.macros[foundMacro[1]],
						startIndex: foundMacro.index,
						endIndex: macroRE.lastIndex
					});
					selfClosing = true;

					// If macro is not self-closing, search for endtag
					// and capture entire contents.
					if (macro.data) {
						if (!macro.data.selfClosing) {
							selfClosing = false;
							endMacroRE = new RegExp(macroRE.source + "|&lt;&lt;((?:\\/|end)"
								+ macro.name + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;","g");
							endMacroRE.lastIndex = macro.endIndex;
							nesting = 0;
							do {
								foundEndMacro = endMacroRE.exec(html);
								if (foundEndMacro !== null) {
									if (foundEndMacro[2]) { // Found <</macro>>
										if (nesting) {
											nesting -= 1;
										} else {
											macro.endIndex = endMacroRE.lastIndex;
											break;
										}
									} else if (foundEndMacro[1]) { // Found nested <<macro>>
										nesting += 1;
									}
								}
								else {
									macro.endIndex = html.length; // No end found, assume rest of passage.
								}
							} while (foundEndMacro);
						}
					}
					// HTMLCall / rawCall is the entire macro invocation, rawArgs is all arguments,
					// HTMLContents / rawContents is what's between a <<macro>> and <</macro>> call
					macro.HTMLCall = html.slice(macro.startIndex, macro.endIndex);
					macro.HTMLContents = (selfClosing ? "" : macro.HTMLCall.replace(/^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/i, '').replace(/&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$/i, ''));
					// unescape HTML entities (like "&amp;")
					macro.call = $('<p>').html(macro.HTMLCall).text();
					macro.contents = (selfClosing ? "" : macro.call.replace(/^(?:[^>]|>(?!>))*>>/i, '').replace(/<<(?:[^>]|>(?!>))*>>$/i, ''));
					macro.rawArgs = macro.call.replace(/^<<\s*\w*/, '').replace(/>>[^]*/, '');
					// Run the callback
					callback(macro);
					macroRE.lastIndex = macro.endIndex;
				}
			} while (foundMacro);
		}
	};
	return story;
});