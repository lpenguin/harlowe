require.config({
	shim:
	{
		'showdown': { exports: 'Showdown' }
	}
});

/*
 * Story options:
 *   opaquelinks : prevent players 'link sniffing' by eliminating the HREF of internal passage links.
 *   debug : debug mode is ready. Click the bug icon to reveal all macro spans.
 */
define(['jquery', 'showdown', 'story', 'macros'], function ($, Showdown, story)
{
	"use strict";
	var markdown = new Showdown.converter();

	$(document).ready(function()
	{
		var header = $('div[data-role="twinestory"]'),
			options;
		
		if (header.length == 0)
		{
			return;
		}
		// Load options
		options = header.attr('data-options');
		options.replace(/\b(\w+)\b/, function(a, b) {
			story.options[b] = true;
		});
		
		// If debug, add button
		if (story.options.debug)
		{
			$('body').append($('<div class="debug-button">').click(function(e) {
				$('html').toggleClass('debug-mode');
			}));
		}
		
		// Install handler for links
		$('body').on('click', 'a[data-twinelink]', function (e)
		{
			showName($(this).attr('data-twinelink'));
			e.preventDefault();
		});
		
		// Show first passage!
		showId(header.attr('data-startnode'));
	});
	
	function renderMacro(macro, span, context)
	{
		var result;
		if (macro.data)
		{
			macro.el = span;
			macro.context = context;
			macro.init && (macro.init());
			result = macro.data.apply(macro, macro.args);

			if (result) {
				result = render(result + '', macro);
				if (result) {
					span.append(result);
				} else if (result === null) {
					result.remove();
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

	function render (source, context)
	{
		var html, temp, macroInstances;
		// basic Markdown
		/*
			Current list of MD deviations:
			- All line breaks are hard
				+ Line breaks preceded with '\' are deleted
			- No Setext-style headers
			- No numbered lists
			- No _enclosing underscores_ for emphasis
			+ HTML comments are deleted
			+ TiddlyWiki links
			+ TiddlyWiki macros
		*/
		html = markdown.makeHtml(source);

		// replace [[ ]] with twine links

		// [[display text|link]] format

		html = html.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, p1, p2)
		{
			if (!story.passageNamed(p2))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="passage-link" ' + (!story.options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) + '"' : '') + ' data-twinelink="' + p2 + '">' +
				   p1 + '</a>';	
		});

		// [[link]] format

		html = html.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1)
		{
			if (!story.passageNamed(p1))
			{
				return '<span class="broken-link">' + p1 + '</span>';
			}
			return '<a class="passage-link" ' + (!story.options.opaquelinks ? 'href="#' + escape(p2.replace(/\s/g, '')) + '"' : '') + ' data-twinelink="' + p1 + '">' + p1 + '</a>';
		});
		
		// macros
		
		temp = matchMacros(html);
		html = temp[0];
		macroInstances = temp[1];

		// Render the HTML, then render macro instances into their spans
		html = $(html);
		
		$('[data-macro]', html).each(function(){
			this.removeAttribute("hidden");
			var count = this.getAttribute("data-count");
			renderMacro(macroInstances[count], $(this), context);
		});
		
		// If one <p> tag encloses all the HTML, unwrap it.
		// Note: this must occur at the end
		if (html.length == 1 && html.get(0).tagName == 'P')
		{
			html = html.contents();
		}

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
