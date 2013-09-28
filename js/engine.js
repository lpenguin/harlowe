define(['jquery', 'marked', 'story', 'utils', 'state', 'macros'], function ($, Marked, Story, Utils, State, Macros)
{
	"use strict";
	/*
		engine: Module that renders passages to the DOM.
		Exported singleton: engine
	*/
	var engine;
	
	/*
		Perform alterations to Marked's lexer/parser as used by Twine.
	*/
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
		// (Note: not strictly required (while commented-out macro tags are
		// noticed during the match phase, commented-out macro <span>s are 
		// ignored during the render phase), but makes generated HTML nicer.)
		Marked.InlineLexer.setFunc("tag", function(cap)
		{
			if (cap[0].slice(0,4) !== '<!--')
			{
				return this.options.sanitize
					? escape(cap[0])
					: cap[0];
			}
		});
		
		// No Sextext-style headers, part 1
		Marked.Lexer.setRule("lheading", /[]/);	
		
		// Multiple line breaks + no Sextext-style headers, part 2
		Marked.Lexer.setRule("paragraph",
			/^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n?/);	
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
			if (cap[2] === '@')
			{
				text = cap[1][6] === ':'
				? this.mangle(cap[1].slice(7))
				: this.mangle(cap[1]);
				href = this.mangle('mailto:') + text;
			}
			else
			{
				href = Marked.escape(cap[1]);
				text = href;
			}
			return '<a class="link" href="' + href + '">' + Utils.charSpanify(text) + '</a>';
		});
		// Chars, links
		Marked.InlineLexer.setFunc("url", function(cap, src)
		{
			var text = Marked.escape(cap[1]),
				href = text;
			return '<a class="link" href="' + href + '">' + Utils.charSpanify(text) + '</a>';
		});
		// Chars, text.
		Marked.InlineLexer.setFunc("text", function(cap)
		{
			return Utils.charSpanify(Marked.escape(this.smartypants(cap[0])));
		});
		
		// Hooks
		function hook(cap, link)
		{
			// If a hook is empty, fill it with a zero-width space,
			// so that it can still be selected by WordArrays.
		    var out = this.output(cap[1]) || (out = Utils.charSpanify("&zwnj;"));
			return '<span class="hook" data-hook="' + link + '"'
				// Debug mode: show the hook destination as a title.
				+ (Story.options.debug ? 'title="Hook: ?' + link + '"' : '') + '>'
				+ out + '</span>';
		};
		
		function reflink(cap)
		{
			var link = (cap[2] || cap[1]).replace(/\s+/g, ' '),
				link2 = this.links[link.toLowerCase()];
			if (link2)
			{
				return this.outputLink(cap, link2);
			}
			else
			{
				return hook.call(this, cap, link);
			}
		};
		Marked.InlineLexer.setFunc("nolink", reflink);
		Marked.InlineLexer.setFunc("reflink", reflink);
	};
	
	/*
		Passage rendering
	*/
	
	// Render a macro naturally found in the passage. Sub-function of render().
	function runMacro(macro, span, context, top)
	{
		if (macro.data)
		{
			macro.el = span;
			macro.context = context;
			macro.top = top;
			macro.init && (macro.init());
			macro.data.apply(macro, macro.args);
		}
		else
			span.addClass('error').html('No macro named ' + macro.name);
	}
	
	// Makes a macro span. Sub-function of render().
	function makeMacros(source)
	{
		var macroInstances = [],
			macroCount = 0,
			newhtml = "",
			index = 0;

		Macros.matchMacroTag(source, null, function (m) {
			if (!m.data)
			{
				// A macro by that name doesn't exist
				m.data = Macros.get("unknown");
			}
			// Contain the macro in a hidden span.
			newhtml += source.slice(index, m.startIndex) + '<span data-count="' + macroCount + '" data-macro="' + m.name + '" hidden></span>';
			macroInstances.push(m);
			macroCount += 1;
			index = m.endIndex;
		});
		newhtml += source.slice(index);
		return [newhtml, macroInstances];
	};
	
	// Makes a passage link. Sub-function of render().
	function makeLink(text, passage)
	{
		var visited;
		
		if (!Story.passageNamed(passage))
		{
			return '<span class="broken-link">' + text + '</span>';
		}
		visited = (State.passageNameVisited(passage));
		
		return '<span class="link passage-link ' + (visited ? 'visited" ' : '" ')
		    + (!Story.options.opaquelinks ? 'href="#' + escape(passage.replace(/\s/g, '')) + '"' : '')
			+ ' data-passage-link="' + passage + '">' + text + '</span>';
	};
	
	/*
		source: the code to render.
		context: macro instance which triggered this rendering.
		top: the topmost DOM level into which this will be rendered (usually ".passage"). Undefined if this is the top.
	*/
	function render(source, context, top)
	{
		var html, temp, macroInstances;
		
		/*
			The following syntax depends on access to the story data to perform, so it must occur outside of Marked.
		*/
		// replace [[ ]] with twine links
		/* 
			Format 1:
			[[display text|link]] format
			Twine 1 / TiddlyWiki / reverse MediaWiki link syntax.
			Possible bug: doesn't check for '\' preceding the first '['
		*/
		source += "";
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
		temp = makeMacros(source);
		source = temp[0];
		macroInstances = temp[1];

		// Finally, do Markdown
		// (This must come last due to the charspan generation inhibiting any further matches.)
		source = Marked(source);
		
		// Render the HTML
		html = $(source);
		
		// Render macro instances
		Utils.$("[data-macro]", html).each(function(){
			this.removeAttribute("hidden");
			var count = this.getAttribute("data-count");
			runMacro(macroInstances[count], $(this), context, top || html);
		});
		
		// If one <p> tag encloses all the HTML, unwrap it.
		// Note: this must occur at the end
		if (html.length == 1 && html.get(0).tagName == 'P')
		{
			html = html.contents();
		}

		return html;
	};
	
	/*
		Passage loading/transitioning functions
	*/

	/*
		Alters the passage DOM by appending a new jQuery structure.
		Requires updating all enchantments.
		Sub-function of showPassage(), also used by engine.renderMacro().
		TODO: Make this not need to run multiple times during a "reflow".
	*/
	function updateEnchantments(top)
	{
		// Remove the old enchantments
		Utils.$(".pseudo-hook", top).children().unwrap();
		Utils.$(".hook", top).attr("class", "hook");
				
		// Perform actions for each scoping macro's scope.
		Utils.$(".hook-macro", top).each(function() {
			var instance = $(this).data("instance");
			
			if (instance)
			{
				// Refresh the scope, and enchant it.
				instance.refreshScope();
				instance.enchantScope();
			}
		});
	};
	
	// Create the HTML structure of the passage <section>. Sub-function of showPassage().
	function createPassageElement()
	{
		var container, back, fwd, sidebar;
		container = $('<section class="passage"><nav class="sidebar"><span class="link icon permalink" title="Permanent link to this passage">&sect;</span></nav></section>'),
		sidebar = container.children(".sidebar");
		
		back = $('<span class="link icon undo" title="Undo">&#8630;</span>').click(engine.goBack);
		fwd = $('<span class="link icon redo" title="Redo">&#8631;</span>').click(engine.goForward);
		
		if (!State.hasPast())
			back.css({visibility:"hidden"});
		if (!State.hasFuture())
			fwd.css({visibility:"hidden"});
		
		sidebar.append(back).append(fwd);
		
		return container;
	};
	
	/*
		Show a passage.
		Transitions the old passage(s) out, and ads the new passages.
		stretch: is stretchtext.
	*/
	function showPassage(id, stretch, el)
	{
		var newPassage,
			transIndex,
			el = el || $('#story'),
			passageData = Story.passageWithID(id),
			oldPassages = Utils.$(el.children(".passage"));
		
		if (passageData === null) 
		{
			return;
		}
		
		$(window).scrollTop(oldPassages.offset());
		
		// Load the default transition if none specified
		transIndex = passageData.attr("data-t8n") || "dissolve";
		
		// Transition out
		if (!stretch && transIndex)
		{
			Utils.transitionOut(oldPassages, transIndex);
		}
		
		// Create new passage
		newPassage = createPassageElement().append(render(passageData.html()));
		el.append(newPassage);
		updateEnchantments();
		
		// Transition in
		if (transIndex)
		{
			Utils.transitionIn(newPassage, transIndex);
		}
		
		// TODO: HTML5 history
	};
	
	engine = Object.freeze({
		// Advance the game state back
		goBack: function()
		{
			//TODO: get the stretch value from state
			if (State.rewind())
			{
				showPassage(State.passage);
			}
		},

		// Undo advancing the game state back
		goForward: function()
		{
			//TODO: get the stretch value from state
			if (State.fastForward())
			{
				showPassage(State.passage);
			}
		},

		// Go to a passage, thus advancing the game state forward
		goToPassage: function(id, stretch)
		{
			// Update the state.
			State.play(id);
			showPassage(id, stretch);
		},

		// Install handlers, etc.
		init: function()
		{
			var html = $(document.documentElement);
			
			// Alter Marked
			twineMarked();
			
			// Install handler for links
			html.on('click.passage-link', '.passage-link[data-passage-link]', function (e)
			{
				var next = Story.getPassageID($(this).attr('data-passage-link'));
				if (next)
				{
					engine.goToPassage(next);
				}
				e.preventDefault();
			});
			
			// If debug, add button
			if (Story.options.debug)
			{
				$(document.body).append($('<div class="debug-button">').click(function(e) {
					html.toggleClass('debug-mode');
				}));
			}
		},
		
		render: render,
		
		updateEnchantments: updateEnchantments
	});
	
	return engine;
});