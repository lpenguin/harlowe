/**
 * TwineMarked, by Leon Arnott
 * based on marked: a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked/tree/43db549e31af5ff6e4a3b12e41a23513b9f88c99
 */
;
(function () {
	"use strict";
	
	var Lexer, TwineMarked, render, options = {};

	/**
		Unescape HTML entities.
		For speed, convert common entities quickly, and convert others with jQuery.

		@method unescape
		@param {String} text Text to convert
		@return {String} converted text
	*/
	function unescape(text) {
		var ret;
		if (text.length <= 1)
			return text;

		switch (text) {
			case "&lt;":
				return '<';
			case "&gt;":
				return '>';
			case "&amp;":
				return '&';
			case "&quot;":
				return '"';
			case "&#39;":
				return "'";
			case "&nbsp;":
				return String.fromCharCode(160);
			case "&zwnj;":
				return String.fromCharCode(8204);
			default:
				ret = document.createElement('p');
				ret.innerHTML = text;
				return ret.textContent;
		}
	}

	/**
		HTML-escape a string.
		
		@method escape
		@param {String} text Text to escape
		@return {String} converted text
	*/
	function escape(text) {
		var ret = document.createElement('p');
		ret.textContent = text;
		return ret.innerHTML;
	}

	/**
		Takes a string containing a character or HTML entity, and wraps it into a
		<tw-char> tag, converting the entity if it is one.

		@method charToSpan
		@param {String} character
	*/
	function charToSpan(c) {
		// Use single-quotes if the char is a double-quote.
		var quot = (c === "&#39;" ? '"' : "'"),
			value = unescape(c);
		switch(value) {
			case ' ': {
				value = "space";
				break;
			}
			case '\t': {
				value = "tab";
				break;
			}
		}
		return "<tw-char value=" +
			quot + value + quot + ">" +
			c + "</tw-char>";
	}

	/**
		Converts an entire string into individual characters, each enclosed
		by a <tw-char>.

		@method charSpanify
		@param {String} source string
		@return {String} HTML source
	*/
	function charSpanify(text) {
		if (typeof text !== "string") {
			throw Error("charSpanify received a non-string");
		}
		return text.replace(/&[#\w]+;|./g, charToSpan);
	}
	
	/*
		For use by Array#reduceRight.
		Finds the rightmost non-empty subgroup in match - designed
		for regexes that should only have 1 non-empty subgroup.
	*/
	function rightmostMatch(a, b, index) { return a || (index ? b : "") }
	
	/*
		Escapes characters in a string so that RegExp(str) produces a valid regex.
	*/
	function regExpEscape(str) {
		return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
	}
	
	/*
		Takes a regex, and replaces keywords inside with other regex text.
	*/
	function buildRegExp(regex /* variadic */) {
		var i = 0,
			opt = (regex.sticky ? "y" : "")
				+ (regex.global ? "g" : "")
				+ (regex.multiline ? "m" : "")
				+ (regex.ignoreCase ? "i" : "")
				+ (regex.unicode ? "u" : ""),
			source = regex.source,
			swaps = Array.apply(0, arguments).slice(1),
			val;
		
		for (; i < swaps.length; i++) {
			val = (swaps[i][1].source || swaps[i][1]).replace(/(^|[^\[])\^/g, '$1');
			source = source.replace(swaps[i][0], val);
		}
		return new RegExp(source, opt);
	}
	
	/*
		Equivalent to ES6 Object.assign()
	*/
	function merge(obj /* variadic */) {
		var i = 1,
			target, key;
		for(; i < arguments.length; i++) {
			target = arguments[i];
			for(key in target) {
				if(Object.prototype.hasOwnProperty.call(target, key)) {
					obj[key] = target[key];
				}
			}
		}
		return obj;
	}
	
	/*
		Returns an object representing a lexer's inner state, methods to permute
		that state, and methods to query that state.
		
		Lexers augment this returned object's rules property.
	*/
	function LexerInnerState() {
		var rules = {},
			states = [],
			/*
				States are objects with a tokens:Array and a pos:Number.
				When the lexer is called (normally or recursively), a new
				state is shifted onto the stack.
			*/
			unshiftState = function unshiftState(pos) {
				states.unshift({
					tokens: [],
					pos: pos || 0
				});
				current = states[0];
			},
			shiftState = function shiftState() {
				var ret = states.shift();
				current = states[0];
				return ret;
			},
			// current is a shorthand for states[0]
			current;
		
		/*
			Creates a token and puts it in the current tokens array.
			
			Tokens are objects with arbitrary data, but are expected to have a
			type: String, start: Number, end: Number, and text: String.
		*/
		function push(type, match, data) {
			/*
				If the token has non-empty innerText, lex the innerText
				and append to its children array.
			*/
			if (data && data.innerText) {
				data.children = lex(data.innerText,
					match[0].indexOf(data.innerText) + current.pos)
			}
			
			current.tokens.push(merge({
				type: type,
				start: current.pos,
				end: current.pos + match[0].length,
				text: match[0],
				children: null
			}, data));
		}
		
		/*
			Creates a curried push()
		*/
		function pusher(type) {
			return function(match) {
				push(type, match);
			};
		}
		
		/*
			Creates a function that pushes a token with innerText,
			designed for styling rules like **strong** or //italic//.
		*/
		function textPusher(type) {
			return function(match) {
				var innerText = match.reduceRight(rightmostMatch, "");
				
				push(type, match, {
					innerText: innerText
				});
			};
		}
		
		/*
			The main method of the lexer. Returns an array of tokens for the passed text.
			The src is consumed gradually, and rules are repeatedly matched to the
			start of the src. If no rule matches, a default "text" token is gradually
			built up, to be pushed when a rule finally matches.
		*/
		function lex(src, initpos) {
			var done, rname, rule, match, ret, lastrule = "", text = "";
			
			unshiftState(initpos);
			
			while(src) {
				done = false;
				// Run through all the rules in turn
				for (rname in rules) {
					if (!rules.hasOwnProperty(rname) || rname == "text") {
						continue;
					}
					rule = rules[rname];
					// Ignore unimplemented rules
					if (!rule.fn) {
						continue;
					}
					if ((match = rule.match.exec(src)) &&
							// match.block rules only apply at the start of new lines.
							(!rule.block || !lastrule || lastrule === "br")) {
						// First, push the current run of slurped text.
						if (text) {
							rules['text'].fn([text]);
							current.pos += text.length;
							text = "";
						}
						// Now handle the matched rule
						rule.fn(match);
						// Increment the position in the src
						current.pos += match[0].length;
						src = src.slice(match[0].length);
						// Finished matching a rule - resume
						lastrule = rname;
						done = true;
						break;
					}
				}
				// If no match, then treat as generic text, and slurp it up.
				if (src && !done) {
					text += src[0];
					lastrule = "text";
					src = src.slice(1);
				}
			}
			// Push the last run of slurped text.
			if (text) {
				push("text", [text]);
			}
			return shiftState().tokens;
		}
			
		return {
			push: push,
			pusher: pusher,
			textPusher: textPusher,
			lex: lex,
			rules: rules
		}
	};
	
	/*
		When passed a LexerInnerState object, it augments it with rules.
	*/
	function Rules(state) {
		// TODO: reimplement backslash-escapes
		var push = state.push,
			pusher = state.pusher,
			textPusher = state.textPusher,
			lex = state.lex,
			
			hr = /^( *[-*_]){3,} *(?=\n+|$)/,
			
			bullet = /(?:[*+-]|\d+\.)/,
			
			list = buildRegExp(/^( *)(bull) [^]+?(?:\n{2,}(?! )(?!\1bull )(?=\n+|\s*$))/,
				[/bull/g, bullet]
			),
			
			item = buildRegExp(/^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/gm,
				[/bull/g, bullet]
			),
			
			heading = /^ *(#{1,6}) *([^\n]+?) *#* *(?=\n+|$)/,
			
			/*
				Text align syntax
				
				==>      : right-aligned
				=><=     : centered
				<==>     : justified
				<==      : left-aligned (undoes the above)
				===><=   : margins 3/4 left, 1/4 right
				=><===== : margins 1/6 left, 5/6 right, etc.
			*/
			align = /^ *(==+>|<=+|=+><=+|<==+>) *(?=\n+|$)/,
			/*
				Every block regex that separates paragraphs should be included in
				the negative lookahead in this regex.
			*/
			paragraph = buildRegExp(/^\n((?:[^\n]+\n?(?!hr|align|heading))+)\n?/,
				['hr', hr],
				['align', align],
				['heading', heading]
			),

			passageLink = /^\[\[(?:([^\]]*)\->|([^\]]*?)<\-)([^\]]*)\]\]/,
			simpleLink = /^\[\[([^\|\]]*?)\]\]/,
			legacyLink = /^\[\[([^\|\]]*?)\|([^\|\]]*)?\]\]/,
			escapedLine = /^\\\n/,
			hook = buildRegExp(/^!?\[(inside)\]\s*\[([^\]]*)\]/,
				['inside', /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/]
			),
			comment = /^<!--[^]*?-->/,
			tag = /^<\/?\w[\w\-]*(?:"[^"]*"|'[^']*'|[^'">])*?>/,
			url = /^((?:https?|mailto|javascript|ftp|data):\/\/[^\s<]+[^<.,:;"')\]\s])/,
			
			// This builds regexes for basic formatting syntax like ''bold'' or //italic//.
			stylerSyntax = function stylerSyntax(pair, rest /*variadic*/) {
				var left = Array.isArray(pair) ? pair[0] : pair,
					right = (Array.isArray(pair) && pair[1]) || left;
				
				return "^" + regExpEscape(left) + "([^]*?)" + regExpEscape(right) + 
						// This function finds if the right-terminator is a sole repeating symbol,
						// then returns the symbol wrapped in '(?!' ')'
						(function fn(str) {
							var s = str.split("").reduce(function(a, b){ return a === b && a });
							
							return s && "(?!" + regExpEscape(s) + ")";
						}(right))
						// Join with any additional pairs
						+ (rest != null ? "|" + stylerSyntax.apply(0, Array.apply(0,arguments).slice(1)) : "");
			},
			strong = RegExp(stylerSyntax("__", "**")),
			em = RegExp(stylerSyntax("_", "*")),
			del = RegExp(stylerSyntax("~~")),
			italic = RegExp(stylerSyntax("//")),
			bold = RegExp(stylerSyntax("''")),
			code = /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/;
		
		merge(state.rules, {
			heading: {
				match: heading,
				block: true,
				fn: function(match) {
					push('heading', match, {
						depth: match[1].length,
						innerText: match[2]
					});
				}
			},
			align: {
				match: align,
				block: true,
				fn: function (match) {
					var align,
						arrow = match[1],
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
					push('align', match, { align: align });
				},
			},
			hr: {
				match: hr,
				block: true,
				fn: pusher('hr')
			},
			list: {
				match: list,
				fn: null
			},
			item: {
				match: item,
				fn: null
			},
			table: {
				match: /[]/,
				block: true,
				fn: null
			},
			paragraph: {
				match: paragraph,
				block: true,
				fn: textPusher('paragraph')
			},
			passageLink: {
				match: passageLink,
				fn: function(match) {
					var p1 = match[1],
						p2 = match[2],
						p3 = match[3];
					
					push('twineLink', match, {
						innerText: p2 ? p3 : p1,
						passage: p1 ? p3 : p2
					});
				}
			},
			legacyLink: {
				match: legacyLink,
				fn: function(match) {
					push('twineLink', match, {
						innerText: match[1],
						passage: match[2]
					});
				}
			},
			simpleLink: {
				match: simpleLink,
				fn: function(match) {
					push('twineLink', match, {
						innerText: match[1],
						passage: match[1]
					});
				}
			},
			hook: {
				match: hook,
				fn: function(match) {
					push('hook', match, {
						innerText: match[1],
						hookName: match[2]
					});
				}
			},
			escapedLine: {
				match: escapedLine,
				fn: pusher('escapedLine')
			},
			br:      { match:   /^\n/, fn:     pusher('br') },
			comment: { match: comment, fn:     pusher('comment') },
			tag:     { match:     tag, fn:     pusher('tag') },
			url:     { match:     url, fn:     pusher('url') },
			strong:  { match:  strong, fn: textPusher('strong') },
			em:      { match:      em, fn: textPusher('em') },
			bold:    { match:    bold, fn: textPusher('bold') },
			italic:  { match:  italic, fn: textPusher('italic') },
			del:     { match:     del, fn: textPusher('del') },
			code:    { match:    code, fn: textPusher('code') },
			// The text rule has no match RegExp
			text:    { match:    null, fn:     pusher('text') }
		});
		return state;
	}
	
	/*
		Create the lexer object
	*/
	Lexer = Rules(LexerInnerState());
	
	/*
		The render method takes the syntax tree from the lexer and returns a string of HTML.
	*/
	render = (function() {
	
		function renderLink(text, passage) {
			return '<tw-link class="link" passage-expr="' + escape(passage) + '">' + (text || passage) + '</tw-link>';
		}

		return function render(tokens) {
			var token, len, temp,
				i = 0,
				out = '';
			
			function makeTag(type) {
				out += '<' + type + '>' + render(token.children) + '</' + type + '>';
			}
			
			if (!tokens) {
				return out;
			}
			len = tokens.length;
			for(; i < len; i += 1) {
				token = tokens[i];
				switch(token.type) {
					/*
						Blocks
					*/
					case "align": {
						out += (function() {
							var style = '',
								body = '',
								center = "text-align: center; max-width:50%; ",
								align = token.align,
								j = (i += 1);
							
							if (token.align === "left") {
								return '';
							}
							
							while(i < len && tokens[i] && tokens[i].type !== 'align') {
								i += 1;
							}
							
							body += render(tokens.slice(j, i));
							
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
						}());
						break;
					}
					case "heading": {
						makeTag('h' + token.depth)
						break;
					}
					case "br":
					case "hr": {
						out += '<' + token.type + '>';
						break;
					}
					case "paragraph": {
						makeTag("p");
						break;
					}
					/*
						Inline
					*/
					case "url": {
						out += '<a class="link" href="' + token.text + '">' + charSpanify(token.text) + '</a>';
						break;
					}
					case "tag": {
						out += token.text;
						break;
					}
					case "del":
					case "strong":
					case "em": {
						makeTag(token.type);
						break;
					}
					case "bold": {
						makeTag("b");
						break;
					}
					case "italic": {
						makeTag("i");
						break;
					}
					case "italic": {
						makeTag("i");
						break;
					}
					case "twineLink": {
						out += renderLink(render(token.children) || undefined, token.passage);
						break;
					}
					case "hook": {
						out += '<tw-hook name="' + token.hookName + '"'
							// Debug mode: show the hook destination as a title.
							+ (options.debug ? ' title="Hook: ?' + token.hookName + '"' : '') + '>'
							// If a hook is empty, fill it with a zero-width space,
							// so that it can still be used as a scope.
							+ (render(token.children) || charSpanify("&zwnj;")) + '</tw-hook>';
						break;
					}
					/*
						Base case
					*/
					case "text":
					default: {
						out += token.children ? render(token.children) : charSpanify(token.text);
						break;
					}
				}
			}
			return out;
		}
	}());
	
	TwineMarked = {
		set options(o) { options = o; },
		get options() { return options },
		lex: Lexer.lex,
		render: function(src) {
			return render(Lexer.lex(src));
		},
		/*
			Export these utility functions, too, so that Utils need not redefine them.
			They're pretty uniquely tied to the Twine code parsing field.
		*/
		utils: {
			unescape: unescape,
			escape: escape,
			charSpanify: charSpanify,
			charToSpan: charToSpan
		}
	};
	
	if(typeof this.exports === 'object') {
		module.exports = TwineMarked;
	}
	else if(typeof this.define === 'function' && this.define.amd) {
		define(function () {
			return TwineMarked;
		});
	}
	else {
		this.TwineMarked = TwineMarked;
	}
}).call(function () {
	return this || (typeof window !== 'undefined' ? window : global);
}());