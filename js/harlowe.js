require.config({
	shim:
	{
		'showdown': { exports: 'Showdown' }
	}
});

define(['jquery', 'showdown', 'story', 'macros'], function ($, Showdown, story)
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
	
	function renderMacro(macro, span)
	{
		if (macro.data)
		{
			var p = $("<p>"),
				args = [''],
				argIdx = 0,
				rawArgs = macro.rawArgs,
				quoteChar, result, j;

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

			macro.el = span;
			result = macro.data.apply(macro, args);

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
			span.addClass('error').html('No macro named ' + macro.name);
	}
	
	function matchMacros(html)
	{
		var macroInstances = [],
			macroCount = 0,
			newhtml = "",
			index = 0;

		story.matchMacroTag(html, null, function (m) {
			if (!m.data) {
				// A macro by that name doesn't exist
				m.name = "unknown";
				m.data = story.macros["unknown"];
			}
			// Contain the macro in a hidden span.
			newhtml += html.slice(index, m.startIndex) + '<span data-count="' + macroCount + '" data-macro="' + m.name + '" hidden></span>';
			macroInstances.push(m);
			macroCount += 1;
			index = m.endIndex;
		});
		newhtml += html.slice(index);
		return [newhtml, macroInstances];
	}

	function render (source)
	{
		var html, temp, macroInstances;
		// basic Markdown

		html = markdown.makeHtml(source);

		// replace [[ ]] with twine links

		// [[display text|link]] format

		html = html.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, p1, p2)
		{
			if (!story.passageNamed(p2))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="passage-link" ' + (!options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) + '"' : '') + ' data-twinelink="' + p2 + '">' +
				   p1 + '</a>';	
		});

		// [[link]] format

		html = html.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1)
		{
			if (!story.passageNamed(p1))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="passage-link" ' + (!options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) + '"' : '') + ' data-twinelink="' + p1 + '">' + p1 + '</a>';
		});
		
		temp = matchMacros(html);
		html = temp[0];
		macroInstances = temp[1];

		// Render the HTML, then render macro instances into their spans

		html = $(html);
		
		html.children('[data-macro]').each(function(){
			this.removeAttribute("hidden");
			var count = this.getAttribute("data-count");
			renderMacro(macroInstances[count], $(this));
		});

		return html;
	};
	
	function showName (name, el)
	{
		var passage = story.passageNamed(name);

		if (!passage)
			throw new Error("No passage exists with name " + name);
		
		return showPassage(passage,el);
	}
	
	function showId (id, el)
	{
		var passage = story.passageWithId(id);

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
