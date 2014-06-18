/**
	TwineMarked, by Leon Arnott
	based on marked: a markdown parser
	Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
	https://github.com/chjj/marked/tree/43db549e31af5ff6e4a3b12e41a23513b9f88c99
	
	@module TwineMarked
*/
;
(function () {
	"use strict";
	
	var RegExpStrings, Lexer, TwineMarked, render, options = {};

	/**
		The RegExpStrings are the raw strings used by the lexer to match tokens.
		
		These are exported so that Harlowe can use them consistently.
		
		@class RegExpStrings
		@for TwineMarked
		@static
	*/
	RegExpStrings = (function RegExpStrings() {
		
		/*
			Escapes characters in a string so that RegExp(str) produces a valid regex.
		*/
		function escape(str) {
			// This function may also accept objects, whereupon it applies itself
			// to every enumerable in the object.
			if (str && typeof str === "object") {
				Object.keys(str).forEach(function(e) {
					str[e] = escape(str[e]);
				});
				return str;
			}
			return (str+"").replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
		}
		
		/*
			A sugar REstring function for negative character sets.
		*/
		function notChars(/* variadic */) {
			return "[^" + Array.apply(0, arguments).map(escape).join("") + "]*"
		}
		
		/*
			A sugar REstring function for matching a sequence of characters prior to a terminator.
		*/
		function notTerminator(terminator) {
			return terminator.length == 1
				? notChars(terminator)
				: "(?:[^" + terminator[0] + "]*|" + terminator[0] + "(?!" + terminator.slice(1) + "))"
		}
		
		/*
			Creates sugar functions which put multiple REstrings into parentheses, separated with |,
			thus producing a capturer or a lookahead.
		*/
		function makeWrapper(starter) {
			return function(/* variadic */) {
				return "(" + starter+Array.apply(0, arguments).join("|") + ")";
			}
		}
		
		var either = makeWrapper("?:"),
			notBefore = makeWrapper("?!"),
			before = makeWrapper("?=");
		
		/*
			This builds REstrings for basic formatting syntax like ''bold'' or //italic//,
			in which the opening token is the same as the closing token.
			
			When given 1+ strings, it produces a REstring that matches each.
		*/
		function stylerSyntax(pair, rest /*variadic*/) {
			var left = Array.isArray(pair) ? pair[0] : pair,
				right = (Array.isArray(pair) && pair[1]) || left;
			
			return escape(left) + "([^]*?)" + escape(right) + 
				/*
					This function checks if the right-terminator is a sole repeating symbol,
					then returns the symbol wrapped in '(?!' ')', or "" if not.
				*/
				(function fn(str) {
					var s = str.split("").reduce(function(a, b){ return a === b && a });
					
					return s && notBefore(escape(s));
				}(right))
				// Join with any additional pairs
				+ (rest != null ? "|" + stylerSyntax.apply(0, Array.apply(0,arguments).slice(1)) : "");
		}
		
		var ws = "\\s*",
			
			eol = "(?=\\n+|$)",
			
			anyLetter = "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
			
			/*
				Markdown lists changes:
				
				* Only the * can be used for bullets (to prevent ambiguity with printed numbers: -2 or +2)
				* Multiples of the bullet must be used for nested lists: **, instead of whitespace.
				* Numbered lists must use 0. instead of actual numbers. 
				
				In the field, lists are structurally not that useful in Twine, except for pure
				presentational purposes: putting a bullet-point before a line.
			*/
			bullet = "(?:\\*)",
			
			bulleted = "\\s*(" + bullet + "+)([^\\n]*)" + eol,
			
			numberPoint = "(?:0\\.)",
			
			numbered = "\\s*(" + numberPoint + "+)([^\\n]*)" + eol,
			
			/*
				FIXME: The {3,} selector currently enables a string of four ---- to be
				parsed as 1 - of text followed by --- hr.
			*/
			hr = "( *[-*_]){3,} *" + eol,
			
			/*
				Markdown setext headers conflict with the hr syntax, and are thus gone.
			*/
			heading = ws + "(#{1,6})" + ws + "([^\\n]+?)" + ws + "#*" + ws + eol,
			
			/*
				New text alignment syntax.
			*/
			align = " *(==+>|<=+|=+><=+|<==+>) *" + eol,
			
			passageLink = {
				opener:            "\\[\\[",
				text:              "(" + notChars("]") + ")",
				rightSeparator:    "\\->",
				leftSeparator:     "<\\-",
				closer:            "\\]\\]",
				legacySeparator:   "\\|",
				legacyText:        "(" + notChars("]|") + "?)"
			},
			
			macro = {
				opener:            "<<",
				name:              "(" + anyLetter.replace("]","\\?\\!\\/]") + "+)",
				params:            "((?:[^>]|>(?!>))*)",
				closer:            ">>"
			},
			
			tag = {
				name:              "\\w[\\w\\-]*",
				attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?"
			},

			// Regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
			// string. This accounts for both single- and double-quotes, and escaped quote characters.

			unquoted = "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)";
			
		/*
			Return the RegExpStrings object.
		*/
		return {
			
			// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
			
			upperLetter: "[A-Z\u00c0-\u00de\u0150\u0170]",
			lowerLetter: "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]",
			anyLetter:   anyLetter,
			anyLetterStrict: "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
			unquoted:    unquoted,
			escapedLine: "\\\\\\n",
			
			comment:     "<!--[^]*?-->",
			
			tag:         "<\\/?" + tag.name + tag.attrs + ">",
			
			url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
			
			hr:          hr,
			bullet:      bullet,
			heading:     heading,
			align:       align,
			
			strong:      stylerSyntax("__", "**"),
			em:          stylerSyntax("_",  "*"),
			del:         stylerSyntax("~~"),
			italic:      stylerSyntax("//"),
			bold:        stylerSyntax("''"),
			sup:         stylerSyntax("^^"),
			
			code:        "(`+)\\s*([^]*?[^`])\\s*\\1(?!`)",
			
			bulleted:    bulleted,
			numbered:    numbered,
			
			hook:        "\\[(" + notChars("]") + ")\\]" + ws + "\\[(" + notChars("]") + ")\\]",
			
			passageLink:
				passageLink.opener
				+ either(
					passageLink.text + passageLink.rightSeparator,
					/*
						The rightmost right arrow or leftmost left arrow
						is regarded as the canonical separator.
						
						[[A->B->C->D->E]] has a link text of
							A->B->C->D
							and a passage name of
							E
						
						[[A<-B<-C<-D<-E]] has a link text of
							B<-C<-D<-E
							and a passage name of
							A
						
						Thus, the left separator's preceding text must be non-greedy.
					*/
					passageLink.text.replace("*","*?") + passageLink.leftSeparator
				)
				+ passageLink.text
				+ passageLink.closer,
				
			passageLinkOpener: passageLink.opener,
			passageLinkCloser: passageLink.closer,
			passageLinkText:   passageLink.text,
				
			legacyLink:
				/*
					[[A|B]] has a link text of
						A
						and a passage name of
						B
					
					This isn't preferred because it's the reverse of MediaWiki's links.
				*/
				passageLink.opener
				+ passageLink.legacyText + passageLink.legacySeparator
				+ passageLink.legacyText + passageLink.closer,
				
			simpleLink:
				/*
					As long as legacyLink remains in the grammar,
					use legacyText here to disambiguate.
				*/
				passageLink.opener + passageLink.legacyText + passageLink.closer,
			
			macro: macro.opener
				+ "(" + macro.name
				+ ")(" + macro.params
				+ ")" + macro.closer,
			
			macroOpener:      macro.opener,
			macroCloser:      macro.closer,
			macroName:        macro.name,
			macroParams:      macro.params,
			
			paragraph:
				/*
					Every block regex that separates paragraphs should be included in
					the negative lookahead in this regex.
				*/
				"\\n((?:[^\\n]+\\n?(?!"
				+ notBefore(heading, align, hr)
				+ "))+)\\n?",
			
			variable:
				"\\$((?:" + anyLetter.replace("\\-", "\\.") + "*"
				// Disallow -, but allow . property indexing
				+ anyLetter.replace("\\w\\-", "a-zA-Z\\.") + "+"
				+ anyLetter.replace("\\-", "\\.") + "*"
				// Array indexing syntax
				+ "|\\[[^\\]]+\\])+)",
		};
	}());
	
	/**
		Unescape HTML entities.
		For speed, convert common entities quickly, and convert others with jQuery.

		@method unescape
		@for Utils
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
		@for Utils
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
		@for Utils
		@param {String} character
		@return {String} Resultant HTML
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
		@for Utils
		@param {String} text Source string
		@return {String} Resultant HTML
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
			/*
				States are objects with a tokens:Array and a pos:Number.
				When the lexer is called (normally or recursively), a new
				state is shifted onto this stack.
			*/
			states = [];
		
		/**
			Creates a token and puts it in the current tokens array.
			
			Tokens are objects with arbitrary data, but are expected to have a
			type: String, start: Number, end: Number, and text: String.
			
			@method push
			@private
		*/
		function push(type, match, data) {
			/*
				If the token has non-empty innerText, lex the innerText
				and append to its children array.
			*/
			var children = null;
			if (data && data.innerText) {
				children = lex(data.innerText,
					match[0].indexOf(data.innerText) + states[0].pos)
			}
			
			states[0].tokens.push(merge({
				type: type,
				start: states[0].pos,
				end: states[0].pos + match[0].length,
				text: match[0],
				children: children
			}, data));
		}
		
		/**
			Creates a curried push()
			
			@method pusher
			@private
		*/
		function pusher(type) {
			return function(match) {
				push(type, match);
			};
		}
		
		/**
			Creates a function that pushes a token with innerText,
			designed for styling rules like **strong** or //italic//.
			
			@method textPusher
			@private
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
			var done, rname, rule, match, i,
				lastrule = "",
				text = "",
				ruleskeys = Object.keys(rules);
			
			states.unshift({
				tokens: [],
				pos: initpos || 0
			});
			
			while(src) {
				done = false;
				// Run through all the rules in turn
				for (i = 0; i < ruleskeys.length; i++) {
					rname = ruleskeys[i];
					if (rname == "text") {
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
							states[0].pos += text.length;
							text = "";
						}
						// Now handle the matched rule
						rule.fn(match);
						// Increment the position in the src
						states[0].pos += match[0].length;
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
			return states.shift().tokens;
		}
			
		return {
			push: push,
			pusher: pusher,
			textPusher: textPusher,
			lex: lex,
			rules: rules
		}
	};
	
	/**
		When passed a LexerInnerState object, it augments it with rules.
		
		@method Rules
		@private
		@for TwineMarked
	*/
	function Rules(state) {
		// TODO: reimplement backslash-escapes
		var push = state.push,
			pusher = state.pusher,
			textPusher = state.textPusher,
			lex = state.lex;
		
		/*
			A quick shorthand function to convert a RegExpStrings property into a RegExp.
		*/
		function r(index) {
			return RegExp("^(?:" + RegExpStrings[index] + ")");
		}

		merge(state.rules, {
			heading: {
				match: r("heading"),
				block: true,
				fn: function(match) {
					push("heading", match, {
						depth: match[1].length,
						innerText: match[2]
					});
				}
			},
			
			/*
				Text align syntax
				
				==>      : right-aligned
				=><=     : centered
				<==>     : justified
				<==      : left-aligned (undoes the above)
				===><=   : margins 3/4 left, 1/4 right
				=><===== : margins 1/6 left, 5/6 right, etc.
			*/
			align: {
				match: r("align"),
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
				match: r("hr"),
				block: true,
				fn: pusher("hr")
			},
			bulleted: {
				match: r("bulleted"),
				block: true,
				fn: function(match) {
					push("bulleted", match, {
						depth: match[1].length,
						innerText: match[2]
					});
				}
			},
			numbered: {
				match: r("numbered"),
				block: true,
				fn: function(match) {
					push("numbered", match, {
						depth: match[1].length / 2,
						innerText: match[2]
					});
				}
			},
			paragraph: {
				match: r("paragraph"),
				block: true,
				fn: textPusher("paragraph")
			},
			passageLink: {
				match: r("passageLink"),
				fn: function(match) {
					var p1 = match[1],
						p2 = match[2],
						p3 = match[3];
					
					push("twineLink", match, {
						innerText: p2 ? p3 : p1,
						passage: p1 ? p3 : p2
					});
				}
			},
			legacyLink: {
				match: r("legacyLink"),
				fn: function(match) {
					push("twineLink", match, {
						innerText: match[1],
						passage: match[2]
					});
				}
			},
			simpleLink: {
				match: r("simpleLink"),
				fn: function(match) {
					push("twineLink", match, {
						innerText: match[1],
						passage: match[1]
					});
				}
			},
			hook: {
				match: r("hook"),
				fn: function(match) {
					push("hook", match, {
						innerText: match[1],
						hookName: match[2]
					});
				}
			},
			/*
				Currently, Harlowe handles macros separately, removing their tags
				from the source before handing it to TwineMarked. Thus, this is not
				used by Harlowe.
			*/
			macro: {
				match: r("macro"),
				fn: function(match) {
					push("macro", match, {
						name: match[1],
						params: match[2]
					});
				}
			},
			escapedLine: {
				match: r("escapedLine"),
				fn: pusher("escapedLine")
			},
			br:      { match:        /^\n/, fn:     pusher("br") },
			comment: { match: r("comment"), fn:     pusher("comment") },
			tag:     { match:     r("tag"), fn:     pusher("tag") },
			url:     { match:     r("url"), fn:     pusher("url") },
			strong:  { match:  r("strong"), fn: textPusher("strong") },
			em:      { match:      r("em"), fn: textPusher("em") },
			bold:    { match:    r("bold"), fn: textPusher("bold") },
			italic:  { match:  r("italic"), fn: textPusher("italic") },
			del:     { match:     r("del"), fn: textPusher("del") },
			code:    { match:    r("code"), fn: textPusher("code") },
			// The text rule has no match RegExp
			text:    { match:         null, fn:     pusher("text") }
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
		/*
			Inside this closure, a number of functions are stashed,
			so that each recursive call need not recreate them.
		*/
		
		/*
			This makes a basic enclosing HTML tag with no attributes, given the tag name,
			and renders the contained text.
		*/
		function renderTag(token, tagName) {
			return '<' + tagName + '>' + render(token.children) + '</' + tagName + '>';
		}
		
		/*
			This makes a standard passage link.
		*/
		function renderLink(text, passage) {
			return '<tw-link class="link" passage-expr="' + escape(passage) + '">' + (text || passage) + '</tw-link>';
		}
		
		/*
			The actual rendering function.
		*/
		return function render(tokens) {
			var token, lastToken, len, temp, tagName,
				i = 0,
				out = '';
			
			if (!tokens) {
				return out;
			}
			len = tokens.length;
			for(; i < len; i += 1) {
				token = tokens[i];
				switch(token.type) {
					case "numbered": 
					case "bulleted": {
						// Run through the tokens, consuming all consecutive list items
						tagName = (token.type === "numbered" ? "ol" : "ul");
						out += "<" + tagName + ">";
						
						while(i < len && tokens[i] && tokens[i].type === token.type) {
							out += renderTag(tokens[i], "li");
							i += 1;
							// If a <br> follows a listitem, ignore it.
							if (tokens[i] && tokens[i].type === "br") {
								i+=1;
							}
						}
						out += "</" + tagName + ">";
						break;
					}
					case "align": {
						// This closure exists solely for localising the variables within
						out += (function() {
							var style = '',
								body = '',
								center = "text-align: center; max-width:50%; ",
								align = token.align,
								j = (i += 1);
							
							if (token.align === "left") {
								return '';
							}
							
							while(i < len && tokens[i] && tokens[i].type !== "align") {
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
					case "macro": {
						out += '<tw-macro hidden name="' + token.name.replace('"','&quot;')
							+ '" params="' + token.params.replace('"','&quot;') + '"></tw-macro>';
						break;
					}
					case "heading": {
						out += renderTag(token, 'h' + token.depth)
						break;
					}
					case "br":
					case "hr": {
						out += '<' + token.type + '>';
						break;
					}
					case "bulleted": {
						out += renderTag(token, 'li');
						break;
					}
					case "paragraph": {
						out += renderTag(token, "p");
						break;
					}
					case "comment": {
						break;
					}
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
						out += renderTag(token, token.type);
						break;
					}
					case "bold": {
						out += renderTag(token, "b");
						break;
					}
					case "italic": {
						out += renderTag(token, "i");
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
	
	/**
		Export the TwineMarked module.
		
		Since this is a light freeze, Utils and RegExpStrings are still modifiable.
		
		@class TwineMarked
		@static
	*/
	TwineMarked = Object.freeze({
	
		/**
			TwineMarked accepts the same story options that Harlowe does.
			Currently it only makes use of { debug }.
			
			@property options
			@type Object
		*/
		set options(o) { options = o; },
		get options() { return options },
		
		/**
			@method lex
			@param {String} src String source to lex.
			@return {Array} Tree structure of 
		*/
		lex: Lexer.lex,
		
		/**
			The primary use of TwineMarked is to render Twine code directly into a HTML string.
			
			@method render
			@param {String} src String source to render. 
			@return {String} Rendered HTML code.
		*/
		render: function(src) {
			return render(Lexer.lex(src));
		},
		
		/**
			Export these utility functions, too, so that Utils need not redefine them.
			They're pretty uniquely tied to the Twine code parsing field.
			
			@property {Object} Utils
		*/
		Utils: {
			unescape: unescape,
			escape: escape,
			charSpanify: charSpanify,
			charToSpan: charToSpan
		},
		
		/**
			Export the RegExpStrings.
			
			@property {RegExpStrings} RegExpStrings
		*/
		RegExpStrings: RegExpStrings
	});
	if(typeof exports === 'object') {
		module.exports = TwineMarked;
	}
	else if(typeof define === 'function' && define.amd) {
		define("twinemarked",[],function () {
			return TwineMarked;
		});
	}
	else {
		this.TwineMarked = TwineMarked;
	}
}).call(function () {
	return this || (typeof window !== 'undefined' ? window : global);
}());