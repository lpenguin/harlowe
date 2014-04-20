define(['marked', 'story', 'utils'], function(Marked, Story, Utils) {
	"use strict";
	/*
		TwineMarked
		This module simply patches Marked with Twine's syntax changes.
		
		Current list of MD deviations:
		. Marked.options.gfm
		. Marked.options.tables
		. Marked.options.breaks
		. Marked.options.smartLists
		. Marked.options.smartypants
		
		- All line breaks are hard
		- Consecutive line breaks are kept
		- No Setext-style headers (horizontal rule conflict)
		
		+ Line breaks preceded with '\' are deleted
		+ HTML comments are deleted
		+ Text chars are wrapped in <tw-char>s
		+ Code spans are currently exempted.
		+ New text-align syntax
		
		
		A reminder of the setFunc and setRule API I added to Marked:
		
		Lexer.setRule = function(name, regex, inParagraph)
		- name: {String} the name of the rule; its key
		- regex: {RegExp} the pattern to match. Must begin with ^.
		- inParagraph: {Boolean} whether to include it in Marked's paragraph regex
		
		Lexer.setFunc = function(name, func)
		- name: {String} the name of the rule; its key
		- func: the callback to use:
			func(cap, top, src)
			- this: Lexer instance, notably with a tokens Array property.
			- cap: {Array} a match object for the found token
			- top: {Boolean} whether or not this is top-level, not within another element
			- src: {String} the source text
			This must push a token object to this.tokens, that a matching Parser.setFunc
			callback will consume.
		
		InlineLexer.setRule = function(name, regex, end)
		- name: {String} the name of the rule; its key
		- regex: {RegExp} the pattern to match. Must begin with ^.
		
		InlineLexer.setFunc = function(name, func)
		- name: {String} the name of the rule; its key
		- func: the callback to use:
			func(cap, top, src)
			- this: InlineLexer instance.
			- cap: {Array} a match object for the found token
			- src: {String} the source text
			
		Parser.setFunc = function(name, func)
		- name: {String} the name of the rule; its key
		- func: the callback to use:
			func()
			- this: Parser instance
	*/

	Marked.setOptions({
		tables: false,
		breaks: true,
		smartLists: true,
		smartypants: true
	});

	// Delete comments
	// (Note: not strictly required (while commented-out macro tags are
	// noticed during the match phase, commented-out macro <span>s are 
	// ignored during the render phase), but makes generated HTML nicer.)

	Marked.InlineLexer.setFunc("tag", function (cap) {
		if (cap[0].slice(0, 4) !== '<!--') {
			return this.options.sanitize ? escape(cap[0]) : cap[0];
		}
	});

	// No Sextext-style headers

	Marked.Lexer.setRule("lheading", /[]/);

	// Multiple line breaks support + no Sextext-style headers support

	Marked.Lexer.setRule("paragraph",
		/^((?:[^\n]+\n?(?!hr|align|heading|blockquote|tag|def))+)\n?/);
	
	
	/*
		Link syntax
	*/
	window.marked=Marked;
	function renderLink (text, passage) {
		return '<tw-link class="link" passage-expr="' + Marked.escape(passage) + '">' + (text || passage) + '</tw-link>';
	}
	
	/*
		Simple links
		[[link]]
	*/
	
	Marked.InlineLexer.setRule("simpleLink", /^\[\[([^\|\]]*?)\]\]/);
	Marked.InlineLexer.setFunc("simpleLink", function (cap) {
		return renderLink(void 0, cap[1]);
	});
	
	/*
		Format 1:
		[[display text|link]] format
		Twine 1 / TiddlyWiki / reverse MediaWiki link syntax.
		Possible bug: doesn't check for '\' preceding the first '['
	*/
	
	Marked.InlineLexer.setRule("legacyLink", /^\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/);
	Marked.InlineLexer.setFunc("legacyLink", function (cap) {
		return renderLink(cap[1], cap[2]);
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
	
	Marked.InlineLexer.setRule("passageLink", /^\[\[(?:([^\]]*)\->|([^\]]*?)<\-)([^\]]*)\]\]/);
	
	Marked.InlineLexer.setFunc("passageLink", function (cap) {
		var p1 = cap[1],
			p2 = cap[2],
			p3 = cap[3];
		return renderLink(p2 ? p3 : p1, p1 ? p3 : p2);
	});
	
	
	/*
		Text align syntax
		
		==>  : right-aligned
		=><= : centered
		<==> : justified
		<==  : left-aligned (undoes the above)
		===><=: margins 3/4 left, 1/4 right
		=><=====: margins 1/6 left, 5/6 right, etc.
	*/
	
	Marked.Lexer.setRule("align", /^ *(==+>|<=+|=+><=+|<==+>)(?:\n|$)/, true);
	Marked.Lexer.setFunc("align", function (cap) {
		var align,
			arrow = cap[1],
			centerIndex = arrow.indexOf("><");
			
		if (~centerIndex) {
			/*
				Find the left-align value
				(Since offset-centered text is centered,
				halve the left-align - hence I multiply by 50 instead of 100
				to convert to a percentage.)
			*/
			align = Math.round(centerIndex / (arrow.length - 2) * 50);
		} else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
			align = "justify";
		} else if (~arrow.indexOf(">")) {
			align = "right";
		} else if (~arrow.indexOf("<")) {
			align = "left";
		}
		this.tokens.push({
			type: 'align',
			align: align
		});
	});
	
	Marked.Parser.setFunc("align", function () {
		var style = '',
			body = '',
			center = "text-align: center; max-width:50%; ",
			align = this.token.align;
		
		if (this.token.align === "left") {
			return '';
		}
		while (this.peek() && this.peek().type !== 'align') {
			this.next();
			body += this.token.type === 'text'
				? this.parseText()
				: this.tok();
		}
		
		switch(align) {
			case "center":
				style += center + "margin:auto;";
				break;
			case "justify":
			case "right":
				style += "text-align:" + align + ";";
				break;
			default:
				if (+align) {
					style += center + "margin-left: " + align + "%;";
				}
		}
		
		return '<tw-align ' + (style ? ('style="' + style + '"') : '') + '>'
			+ body + '</tw-align>\n';
	});
	
	// Multiple line breaks
	
	Marked.Lexer.setRule("br", /^\n/);

	Marked.Lexer.setFunc("br", function (cap) {
		for (var i = cap[0].length; i > 0; i--) {
			this.tokens.push({
				type: 'br'
			});
		}
	});

	Marked.Parser.setFunc("br", function () {
		return '<br>\n';
	});

	// Escaped line breaks

	Marked.InlineLexer.setRule("escapedLine", /^\\\n/);
	Marked.InlineLexer.setFunc("escapedLine", function(){});

	// Chars, hyperlinks

	Marked.InlineLexer.setFunc("autolink", function (cap) {
		var text, href;

		if (cap[2] === '@') {
			if (text = cap[1][6] === ':')
				this.mangle(cap[1].slice(7))
			else
				this.mangle(cap[1]);

			href = this.mangle('mailto:') + text;
		} else {
			href = Marked.escape(cap[1]);
			text = href;
		}
		return '<a class="link" href="' + href + '">' + Utils.charSpanify(text) + '</a>';
	});

	// Chars, links

	Marked.InlineLexer.setFunc('url', function (cap, src) {
		var text = Marked.escape(cap[1]),
			href = text;

		return '<a class="link" href="' + href + '">' + Utils.charSpanify(text) + '</a>';
	});

	// Chars, text.

	Marked.InlineLexer.setFunc("text", function (cap) {
		return Utils.charSpanify(Marked.escape(this.smartypants(cap[0])));
	});

	// Hooks

	function hook(cap, link) {
		// If a hook is empty, fill it with a zero-width space,
		// so that it can still be used as a scope.

		var out = this.output(cap[1]) || (out = Utils.charSpanify("&zwnj;"));
		return '<tw-hook name="' + link + '"'
		// Debug mode: show the hook destination as a title.
		+ (Story.options.debug ? 'title="Hook: ?' + link + '"' : '') + '>' + out + '</tw-hook>';
	};

	function reflink(cap) {
		var link = (cap[2] || cap[1]).replace(/\s+/g, ' '),
			link2 = this.links[link.toLowerCase()];

		if (link2)
			return this.outputLink(cap, link2);
		else
			return hook.call(this, cap, link);
	};

	Marked.InlineLexer.setFunc("nolink", reflink);
	Marked.InlineLexer.setFunc("reflink", reflink);
	
	// Finished
	Marked.update();
	
	Utils.log("Twinemarked module ready!");
	
	return Marked;
});
