define(['jquery', 'marked', 'story', 'utils', 'state', 'macros'], function ($, Marked, story, utils, state, macros)
{
	"use strict";
	/*
		engine: Module that renders passages to the DOM.
	*/
	var engine,
		// Handlers for hooks, installed by macrolib
		hookHandlers = [];
	
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
			return '<a class="link" href="' + href + '">' + utils.charSpanify(text) + '</a>';
		});
		// Chars, links
		Marked.InlineLexer.setFunc("url", function(cap, src)
		{
			var text = Marked.escape(cap[1]),
				href = text;
			return '<a class="link" href="' + href + '">' + utils.charSpanify(text) + '</a>';
		});
		// Chars, text.
		Marked.InlineLexer.setFunc("text", function(cap)
		{
			return utils.charSpanify(Marked.escape(this.smartypants(cap[0])));
		});
		
		// Hooks
		function hook(cap, link)
		{
		    return '<span class="hook" data-hook="' + link + '">'
			  + this.output(cap[1]) + '</span>';
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
	
	function renderMacro(macro, span, context, top)
	{
		if (macro.data)
		{
			macro.el = span;
			macro.context = context;
			macro.top = top;
			macro.init && (macro.init());
			engine.renderMacro(macro, top);
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
			var visited;
			
			if (!story.passageNamed(passage))
			{
				return '<span class="broken-link">' + text + '</span>';
			}
			visited = (state.passageNameVisited(passage));
			
			return '<span class="link passage-link ' + (visited ? 'visited" ' : '" ') + (!story.options.opaquelinks ? 'href="#' + escape(passage.replace(/\s/g, '')) + '"' : '')
				+ ' data-passage-link="' + passage + '">' + text + '</span>';
		}
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

	function appendRender(src, dest, top)
	{
		dest.append(src);
		
		// Perform actions for each scoped macro's scope.
		$(".hook[data-hook]", top).each(function() {
			var e = $(this);
			
			hookHandlers.forEach(function(a) {
			
				if (Array.isArray(a) && a.length === 2)
				{
					if ($("[data-macro=" + a[1] +"][data-hook='" + e.attr("data-hook") + "']", top).length)
					{
						e.addClass(a[0]);
					}
					else
					{
						e.removeClass(a[0]);
					}
				}
			});
		});
		return src;
	};
	
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
		
		$(window).scrollTop(oldPassages.offset());
		
		// Load the default transition if none specified
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
		newPassage = appendPassage(passageData, el);
		
		// Transition in
		if (transIndex)
		{
			newPassage.attr("data-t8n", transIndex).addClass("transition-in")
				.one("animationend webkitAnimationEnd MSAnimationEnd oAnimationEnd", function(){ newPassage.removeClass("transition-in") });
		}
		// TODO: HTML5 history
	};
	
	function createPassageElement()
	{
		var container, back, fwd, sidebar;
		container = $('<section class="passage"><nav class="sidebar"><span class="link icon permalink" title="Permanent link to this passage">&sect;</span></nav></section>'),
		sidebar = container.children(".sidebar");
		
		back = $('<span class="link icon undo" title="Undo">&#8630;</span>').click(engine.goBack);
		fwd = $('<span class="link icon redo" title="Redo">&#8631;</span>').click(engine.goForward);
		
		if (!state.hasPast())
			back.css({visibility:"hidden"});
		if (!state.hasFuture())
			fwd.css({visibility:"hidden"});
		
		sidebar.append(back).append(fwd);
		
		return container;
	};
	
	// Creates a passage element, and appends it to the given element.
	function appendPassage(passage, el)
	{
		var container;
		
		el = el || $('#story');	
		
		container = createPassageElement().append(render(passage.html()));
		appendRender(container, el);
		return container;
	};
	
	// Used by addHookHandler, called when the hook's event is triggered.
	function hookHandlerEventFn() {
		var elem = $(this);
		// Trigger the scoped macros that refer to this hook.
		$("[data-macro][data-hook=" + elem.attr("data-hook") + "]").each(function() {
			var action = $(this).data("action");
			(typeof action === "function" && action(elem));
		});
	};
	
	engine = Object.freeze({
		// Advance the game state back
		goBack: function()
		{
			//TODO: get the stretch value from state
			if (state.rewind())
			{
				showPassage(state.passage);
			}
		},

		// Undo advancing the game state back
		goForward: function()
		{
			//TODO: get the stretch value from state
			if (state.fastForward())
			{
				showPassage(state.passage);
			}
		},

		// Go to a passage, thus advancing the game state forward
		goToPassage: function(id, stretch)
		{
			// Update the state.
			state.play(id);
			showPassage(id, stretch);
		},
		
		/*
			Register the behaviour that a scoped macro performs
			This involves:
			- A function to alter any matching hooks ("hookHandlers"),
			  so that, for instance, they are styled differently.
			- The event on which the macro's scope will execute.
		*/
		addHookHandler: function(desc)
		{
			if ($.isPlainObject(desc) && desc.event && desc.name && desc.hookClass)
			{
				hookHandlers.push([desc.hookClass, desc.name]);
				$('html').on(desc.event + "." + desc.name + "-macro", "." + desc.hookClass.replace(" ", "."), hookHandlerEventFn);
			}
		},
		
		// Install handlers, etc.
		init: function()
		{
			// Alter Marked
			twineMarked();
			
			// Install handler for links
			$('html').on('click.passage-link', '.passage-link[data-passage-link]', function (e)
			{
				var next = story.getPassageID($(this).attr('data-passage-link'));
				if (next)
				{
					engine.goToPassage(next);
				}
				e.preventDefault();
			});
			
			// If debug, add button
			if (story.options.debug)
			{
				$('body').append($('<div class="debug-button">').click(function(e) {
					$('html').toggleClass('debug-mode');
				}));
			}
		},
		
		render: render,
		
		renderMacro: function(macro)
		{
			var result = macro.data.apply(macro, macro.args);
			
			if (result)
			{
				result = render(result + '', macro, macro.top);
				if (result)
				{
					appendRender(result, macro.el);
				}
				else if (result === null)
				{
					result.remove();
				}
			}
		}
	});
	return engine;
});