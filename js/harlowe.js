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
define(['jquery', 'showdown', 'story', 'macros'], function ($, Showdown, story, macros)
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

		macros.matchMacroTag(html, null, function (m) {
			if (!m.data) {
				// A macro by that name doesn't exist
				m.data = macros.get("unknown");
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
		function makeLink(text, passage)
		{
			if (!story.passageNamed(passage))
			{
				return '<span class="broken-link">' + text + '</span>';
			}
			return '<a class="passage-link" ' + (!story.options.opaquelinks ? 'href="#' + escape(passage.replace(/\s/g, '')) + '"' : '') + ' data-twinelink="' + passage + '">' +
				   text + '</a>';
		}
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
		/* 
			Format 1:
			[[display text|link]] format
			Twine 1 / TiddlyWiki / reverse MediaWiki link syntax.
		*/
		html = html.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, text, passage)
		{
			return makeLink(text,passage);
		});
		/*
			Format 2:
			[[display text->link]] format
			[[link<-display text]] format
			
			Leon note: This, in my mind, looks more intuitive w/r/t remembering the type of the arguments.
			The arrow always points to the passage name.
			Passage names, of course, can't contain < or > signs.
			This regex will interpret the rightmost '->' and the leftmost '<-' as the divider.
		*/
		html = html.replace(/\[\[(?:([^\]]*)\-&gt;|([^\]]*?)&lt;\-)([^\]]*)\]\]/g, function (match, p1, p2, p3)
		{
			// if right-arrow ->, then p1 is text, p2 is "", p3 is link.
			// If left-arrow <-, then p1 is "", p2 is link, p3 is text.
			return makeLink(p2 ? p3 : p1, p1 ? p3 : p2);
		});

		// [[link]] format

		html = html.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1)
		{
			return makeLink(p1, p1);
		});
		
		// macros
		
		temp = matchMacros(html);
		html = temp[0];
		macroInstances = temp[1];

		// Render the HTML
		html = $(html);
		
		// Render macro instances
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
