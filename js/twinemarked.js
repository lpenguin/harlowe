define(['marked', 'story', 'utils'], function(Marked, Story, Utils) {
	/*
		TwineMarked
		This module simply patches Marked with Twine's syntax changes.
		Note for release: when syntax is finalised, hand-patch Marked.js itself instead of running this.
		
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
		+ Text chars are wrapped in char <span>s
		+ Code spans are currently exempted.
		+ New text-align syntax
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
		Text align syntax
		
		==>  : right-aligned
		=><= : centered
		<==> : justified
		<==  : left-aligned (undoes the above)
		===><=: margins 3/4 left, 1/4 right
		=><=====: margins 1/6 left, 5/6 right, etc.
	*/
	
	Marked.Lexer.setRule("align", /^ *(==+>|<=+|=+><=+|<==+>)(?:\n|$)/, true);
	Marked.Lexer.setFunc("align", function(cap) {
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
	
	Marked.Parser.setFunc("align", function() {
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
		
		return '<div class="align"'
			+ (style ? ('style="' + style + '"') : '') + '>'
			+ body + '</div>\n';
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
		return '<span class="hook" data-hook="' + link + '"'
		// Debug mode: show the hook destination as a title.
		+ (Story.options.debug ? 'title="Hook: ?' + link + '"' : '') + '>' + out + '</span>';
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
	
	return Marked;
});
