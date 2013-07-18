/*
 * Story options:
 *   opaquelinks : prevent players 'link sniffing' by eliminating the HREF of internal passage links.
 *   debug : debug mode is ready. Click the bug icon to reveal all macro spans.
 */
define(['jquery', 'marked', 'story', 'macros', 'utils', 'state'], function ($, Marked, story, macros, utils, state)
{
	"use strict";

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
			options,
			start;
		
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
			var next = story.getPassageID($(this).attr('data-twinelink'));
			if (next)
			{
				goToPassage(next);
			}
			e.preventDefault();
		});
		
		// Show first passage!
		start = header.attr('data-startnode');
		if (start)
		{
			goToPassage(start);
		}
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
		// (This must come last due to the charspan generation inhibiting any further matches.)
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
	
	// Advance the game state back
	function goBack()
	{
		//TODO: get the stretch value from state
		if (state.rewind())
		{
			showPassage(state.getPresentPassageID());
		}
	};
	
	// Undo advancing the game state back
	function goForward()
	{
		//TODO: get the stretch value from state
		if (state.fastForward())
		{
			showPassage(state.getPresentPassageID());
		}
	};
	
	// Go to a passage, thus advancing the game state forward
	function goToPassage(id, stretch)
	{
		// Update the state.
		state.pushPast();
		state.setPresentPassageID(id);
		showPassage(id, stretch)
	}
	
	// Show a passage.
	// Transitions the old passage(s) out, and ads the new passages.
	// stretch: is stretchtext.
	function showPassage(id, stretch, el)
	{
		var newPassage,
			transIndex,
			el = el || $('#story'),
			passageData = story.passageWithID(id),
			oldPassages = el.children(".passage").not(".transition-out");
		
		if (passageData === null) 
		{
			return;
		}
		
		// Do transition animation
		$(window).scrollTop(0);
		
		// Load the default if none specified
		transIndex = passageData.attr("data-t8n") || "dissolve";
		
		// Transition out
		if (stretch)
		{
			oldPassages = oldPassages.last();
		}
		if (transIndex)
		{
			oldPassages.attr("data-t8n", transIndex).addClass("transition-out");
			if (!stretch)
			{
				oldPassages.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ oldPassages.remove(); });
			}
		}
		
		// Create new passage
		newPassage = insertPassage(passageData, el);
		
		// Transition in
		if (transIndex)
		{
			newPassage.attr("data-t8n", transIndex).addClass("transition-in")
				.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ newPassage.removeClass("transition-in") });
		}
		// TODO: HTML5 history
	};
	
	// Creates a passage element, and appends it to the given element.
	function insertPassage(passage, el) {
		el = el || $('#story');	
		var container = $('<section class="passage"><a class="permalink" href="#' + passage.attr('data-name') + '"' +
			' title="Permanent link to this passage">&para;</a></section>');
				  
		// For testing purposes only.
		var back = $('<br><a class="permalink">&larr;</a>').click(goBack);
		var fwd = $('<br><a class="permalink">&rarr;</a>').click(goForward);
		container.append(back);
		container.append(fwd);
		//End testing
		
		container.append(render(passage.html()));
		el.append(container);
		return container;
	};
});
