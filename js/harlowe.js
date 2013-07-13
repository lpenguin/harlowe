/*
 * Story options:
 *   opaquelinks : prevent players 'link sniffing' by eliminating the HREF of internal passage links.
 *   debug : debug mode is ready. Click the bug icon to reveal all macro spans.
 */
define(['jquery', 'marked', 'story', 'macros', 'utils'], function ($, Marked, story, macros, utils)
{
	"use strict";
	window.marked = Marked;
	
	function twineMarked() {
		/*
			Current list of MD deviations:
			. marked.options.gfm
			. marked.options.tables
			. marked.options.breaks
			. marked.options.smartLists
			- All line breaks are hard
			- Consecutive line breaks are kept
			- No Setext-style headers (horizontal rule conflict)
			+ Line breaks preceded with '\' are deleted
			+ HTML comments are deleted
			+ Text chars are wrapped in char <span>s
				+ Code spans are currently exempted.
		*/
		Marked.setOptions({
		tables: false,
			breaks: true,
			smartLists: true
		});
		// Delete comments
		// (Note: not actually required (while commented-out macro tags are
		// noticed during the match phase, commented-out macro <span>s are 
		// ignored during the render phase), but makes generated HTML nicer.)
		Marked.Parser.setFunc("tag", function(cap)
		{
			if (cap[0].slice(0,4) !== '<!--')
			{
				return cap[0];
			}
		});
		// No Sextext-style headers, part 1
		Marked.Lexer.setRule("lheading", /[]/);
		// Multiple line breaks + no Sextext-style headers, part 2
		Marked.Lexer.setRule("paragraph",
			/^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n/);
		Marked.Lexer.setRule("br",/^\n/);
		Marked.Lexer.setFunc("br", function(cap)
		{ 
			for(var i = cap[0].length; i>0; i--)
			{
				this.tokens.push({
					type: 'br'
				});
			}
		});
		Marked.Parser.setFunc("br", function() { return '<br>\n'; });
		
		// Escaped line breaks
		Marked.InlineLexer.setRule("escapedLine", /^\\\n/);
		Marked.InlineLexer.setFunc("escapedLine", $.noop);
		
		// Chars, hyperlinks
		Marked.InlineLexer.setFunc("autolink", function(cap)
		{
			var text, href;
			if (cap[2] === '@') {
				text = cap[1][6] === ':'
				? this.mangle(cap[1].slice(7))
				: this.mangle(cap[1]);
				href = this.mangle('mailto:') + text;
			} else {
				href = Marked.escape(cap[1]);
				text = href;
			}
			return '<a href="' + href + '">' + utils.charSpanify(text) + '</a>';
		});
		// Chars, links
		Marked.InlineLexer.setFunc("url", function(cap, src)
		{
			var text = Marked.escape(cap[1]),
				href = text;
			return '<a href="' + href + '">' + utils.charSpanify(text) + '</a>';
		});
		// Chars, text.
		Marked.InlineLexer.setFunc("text", function(cap)
		{
			return utils.charSpanify(Marked.escape(this.smartypants(cap[0])));
		});
	};
	
	// Document is loaded
	$(document).ready(function()
	{
		var header = $('div[data-role="twinestory"]'),
			options;
		
		if (header.length == 0)
		{
			return;
		}
		
		// Alter Markdown
		twineMarked();
		
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
	
	function renderMacro(macro, span, context, top)
	{
		var result;
		if (macro.data)
		{
			macro.el = span;
			macro.context = context;
			macro.top = top;
			macro.init && (macro.init());
			result = macro.data.apply(macro, macro.args);

			if (result) {
				result = render(result + '', macro, top);
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
	
	function matchMacros(source)
	{
		var macroInstances = [],
			macroCount = 0,
			newhtml = "",
			index = 0;

		macros.matchMacroTag(source, null, function (m) {
			if (!m.data) {
				// A macro by that name doesn't exist
				m.data = macros.get("unknown");
			}
			// Contain the macro in a hidden span.
			newhtml += source.slice(index, m.startIndex) + '<span data-count="' + macroCount + '" data-macro="' + m.name + '" hidden></span>';
			macroInstances.push(m);
			macroCount += 1;
			index = m.endIndex;
		});
		newhtml += source.slice(index);
		return [newhtml, macroInstances];
	}

	// source: the code to render.
	// context: macro instance which triggered this rendering.
	// top: the topmost HTML level in which this will be rendered.
	function render(source, context, top)
	{
		function makeLink(text, passage)
		{
			if (!story.passageNamed(passage))
			{
				return '<span class="broken-link">' + text + '</span>';
			}
			return '<a class="passage-link" ' + (!story.options.opaquelinks ? 'href="#' + escape(passage.replace(/\s/g, '')) + '"' : '')
				+ ' data-twinelink="' + passage + '">' + text + '</a>';
		}
		var html, temp, macroInstances;
		
		// replace [[ ]] with twine links
		/* 
			Format 1:
			[[display text|link]] format
			Twine 1 / TiddlyWiki / reverse MediaWiki link syntax.
			Possible bug: doesn't check for '\' preceding the first '['
		*/
		source = source.replace(/\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/g, function (match, text, passage)
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
		source = source.replace(/\[\[(?:([^\]]*)\-&gt;|([^\]]*?)&lt;\-)([^\]]*)\]\]/g, function (match, p1, p2, p3)
		{
			// if right-arrow ->, then p1 is text, p2 is "", p3 is link.
			// If left-arrow <-, then p1 is "", p2 is link, p3 is text.
			return makeLink(p2 ? p3 : p1, p1 ? p3 : p2);
		});

		// [[link]] format

		source = source.replace(/\[\[([^\|\]]*?)\]\]/g, function (match, p1)
		{
			return makeLink(p1, p1);
		});
		
		// macros
		
		temp = matchMacros(source);
		source = temp[0];
		macroInstances = temp[1];

		// Finally, do Markdown
		source = Marked(source);
		
		// Render the HTML
		html = $(source);
		
		// Render macro instances
		$('[data-macro]', html).each(function(){
			this.removeAttribute("hidden");
			var count = this.getAttribute("data-count");
			renderMacro(macroInstances[count], $(this), context, top || html);
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
