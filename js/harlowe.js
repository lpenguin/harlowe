require.config({
	shim:
	{
		'showdown': { exports: 'Showdown' }
	}
});

define(['jquery', 'showdown', 'macros'], function ($, Showdown)
{
	"use strict";
	var markdown = new Showdown.converter(),
		options = {
			opaquelinks: true /* If true, prevent players 'link sniffing' by eliminating the HREF of internal links.
							   * (<a> elements with no HREF can still have the finger cursor through CSS.)
							   */
		};

	$(document).ready(function()
	{
		$('body').on('click', 'a[data-twinelink]', function (e)
		{
			showName($(this).attr('data-twinelink'));
			e.preventDefault();
		});
		
		showId($('div[data-role="twinestory"]').attr('data-startnode'));
	});
	
	function renderMacro(macroName, rawCall, span)
	{
		if (window.story.macros[macroName])
		{
			// rawCall is the entire macro invocation, rawArgs are all arguments,
			// rawContents is what's between a <<macro>> and <</macro>> call
			var macro = window.story.macros[macroName],
				contentStart = new RegExp('^(?:[^&]|&(?!gt;&gt;))*&gt;&gt;', 'i'), //First tag
				contentEnd = new RegExp('&lt;&lt;(?:[^&]|&(?!gt;&gt;))*&gt;&gt;$', 'i'), //Final tag before end of input
				rawContents = rawCall.replace(contentStart, '').replace(contentEnd, ''),
				p = $("<p>"),
				args = [''],
				argIdx = 0,
				rawArgs, quoteChar, result, j;

			// unescape rawArgs HTML entities (like "&amp;")
			// Note: must unescape rawCall after rawContents
			
			rawCall = p.html(rawCall).text();
			rawArgs = rawCall.replace(/^<<\s*\w*/, '').replace(/>>[^]*/, '');
				
			// tokenize arguments
			// e.g. 1 "two three" 'four five' "six \" seven" 'eight \' nine'
			// becomes [1, "two three", "four five", 'six " seven', "eight ' nine"]


			for (j = 0; j < rawArgs.length; j++)
				switch (rawArgs[j])
				{
					case '"':
					case "'":
					if (quoteChar == rawArgs[j])
						quoteChar = null;
					else
						if (! quoteChar)
							quoteChar = rawArgs[j];
						else
							args[argIdx] += rawArgs[j];
					break;

					case ' ':
					if (quoteChar)
						args[argIdx] += rawArgs[j];
					else
						args[++argIdx] = '';
					break;

					case '\\':
					if (j < rawArgs.length - 1 && rawArgs[j + 1] == quoteChar)
					{
						args[argIdx] += quoteChar;
						j++;
					}
					else
						args[argIdx] += rawArgs[j];
					break;

					default:
					args[argIdx] += rawArgs[j];
				};

			//console.log("Executing "+macroName+"... rawArgs : (" +rawArgs+"), rawCall : ("+rawCall+") rawContents : ("+rawContents+")");
			result = macro.apply({
				call: rawCall,
				rawArgs: rawArgs,
				contents: rawContents || "",
				name: macroName,
				el: span }, args);

			// Markdown adds a <p> tag around content which we need to remove
			// we also have to coerce the result to a string
			if (result) {
				result = render(result + '');
				if (result) {
					span.html(result.html().replace(/^<p>/i, '').replace(/<\/p>$/i, ''));
				}
			}
		}
		else
			span.html('No macro named ' + macroName);
	}
	
	function matchMacros(html)
	{
		var macroRE = /&lt;&lt;\s*(\w+)(?:[^&]|&(?!gt;&gt;))*&gt;&gt;/g,
			macroCalls = [],
			macroCount = 0,
			endMacroRE, foundMacro, macroName, macroCall, macroData, startIndex, endIndex,
			foundEndMacro, nesting;
		do {
			// Search through html for macro tags
			foundMacro = macroRE.exec(html);
			if (foundMacro !== null) {
				macroName = foundMacro[1];
				macroData = window.story.macros[macroName];
				startIndex = foundMacro.index;
				endIndex = macroRE.lastIndex;

				if (macroData) {
					// If macro is not void, search for endtag
					if (!macroData.isVoid) {
						endMacroRE = new RegExp(macroRE.source + "|&lt;&lt;((?:\\/|end)"
							+ macroName + ")(?:[^&]|&(?!gt;&gt;))*&gt;&gt;","g");
						endMacroRE.lastIndex = endIndex;
						nesting = 0;
						do {
							foundEndMacro = endMacroRE.exec(html);
							if (foundEndMacro !== null) {
								if (foundEndMacro[2]) { // Found <</macro>>
									if (nesting) {
										nesting -= 1;
									} else {
										endIndex = endMacroRE.lastIndex;
										break;
									}
								} else if (foundEndMacro[1]) { // Found nested <<macro>>
									nesting += 1;
								}
							}
							else {
								endIndex = html.length; // No end found, assume rest of passage.
							}
						} while (foundEndMacro);
					}
					macroCall = html.slice(startIndex,endIndex);
				} else {
					// A macro by that name doesn't exist
					macroName = "unknown";
				}
				macroCall = html.slice(startIndex,endIndex);
				// Contain the macro in a hidden span.
				html = html.slice(0, startIndex) + '<span data-count="' + macroCount + '" data-macro="' + macroName + '" hidden></span>' + html.slice(endIndex);
				macroCalls.push(macroCall);
				macroCount += 1;
			}
		} while (foundMacro);
		return [html, macroCalls];
	}

	function render (source)
	{
		var html, temp, macroCalls;
		// basic Markdown

		html = markdown.makeHtml(source);

		// replace [[ ]] with twine links

		// [[display text|link]] format

		html = html.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, p1, p2)
		{
			if (!passageName(p2))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="link internal-link" ' + (!options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) : '') + '" data-twinelink="' + p2 + '">' +
				   p1 + '</a>';	
		});

		// [[link]] format

		html = html.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1)
		{
			if (!passageName(p1))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="link internal-link" ' + (!options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) : '') + '" data-twinelink="' + p1 + '">' + p1 + '</a>';
		});
		
		temp = matchMacros(html);
		html = temp[0];
		macroCalls = temp[1];

		// Render the HTML, then render macros into their spans

		html = $(html);
		
		html.children('[data-macro]').each(function(){
			this.removeAttribute("hidden");
			var macroName = this.getAttribute("data-macro"),
				count = this.getAttribute("data-count");
			renderMacro(macroName, macroCalls[count], $(this));
		});

		return html;
	};
	
	function passageName (name)
	{
		var passage = $('div[data-role="twinestory"] div[data-name="' + name + '"]');
		return (passage.size() == 0 ? null : passage);
	}
	
	function passageId (id)
	{
		var passage = $('div[data-role="twinestory"] div[data-id="' + id + '"]');
		return (passage.size() == 0 ? null : passage);
	}
	
	function showName (name, el)
	{
		var passage = passageName(name);

		if (!passage)
			throw new Error("No passage exists with name " + name);
		
		return showPassage(passage,el);
	}
	
	function showId (id, el)
	{
		var passage = passageId(id);

		if (!passage)
			throw new Error("No passage exists with id " + id);
		
		return showPassage(passage,el);
	}

	function showPassage(passage, el) {
		el = el || $('#story');	
		var container = $('<section><a class="permalink" href="#' + passage.attr('data-name') + '"' +
				  ' title="Permanent link to this passage">&para;</a></section>');
		container.append(render(passage.html()));
		$(window).scrollTop(0);
		el.children().animate( { opacity: 0 }, 200, function(){ $(this).remove(); });
		el.append(container);
	};
});
