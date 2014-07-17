/**
	TwineMarkup, by Leon Arnott
	based on marked: a markdown parser
	Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
	https://github.com/chjj/marked/tree/43db549e31af5ff6e4a3b12e41a23513b9f88c99
	
	@module TwineMarkup
*/
;(function () {
	"use strict";
	
	var RegExpStrings, Lexer, TwineMarkup;

	/*
		The RegExpStrings are the raw strings used by the lexer to match tokens.
		
		These are exported so that Harlowe can use them consistently.
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
			Matches a string of non-nesting characters enclosed by open character and another character,
			but potentially containing the close-character escaped with /
			
			For instance, <This is \> an example>.
		*/
		function enclosed(o, c) {
			o = escape(o);
			c = c ? escape(c) : o;

			return o + "(?:" + notChars( c + "\\" ) + "\\.)" + "*" + notChars( c + "\\" ) + c;
		}
		
		/*
			A sugar REstring function for negative character sets.
		*/
		function notChars(/* variadic */) {
			return "[^" + Array.apply(0, arguments).map(escape).join("") + "]*";
		}
		
		/*
			Creates sugar functions which put multiple REstrings into parentheses, separated with |,
			thus producing a capturer or a lookahead.
		*/
		function makeWrapper(starter) {
			return function(/* variadic */) {
				return "(" + starter+Array.apply(0, arguments).join("|") + ")";
			};
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
					var s = str.split("").reduce(function(a, b){ return a === b && a; });
					
					return s && notBefore(escape(s));
				}(right))
				// Join with any additional pairs
				+ (rest ? "|" + stylerSyntax.apply(0, Array.apply(0,arguments).slice(1)) : "");
		}
		
		/*
			Converts the given REstring (assumed to be entirely [A-Za-z] characters)
			into a case-insensitive version.
		*/
		function caseInsensitive(name) {
			return name.replace(/(?:([A-Z])|([a-z]))/g, function(a, $1, $2) {
				return "[" + ($1 || $2.toUpperCase())
					+ ($2 || $1.toLowerCase()) + "]"; });
		}
		
		
		/*
			This creates an object which has an exec() method like
			RegExp objects, but tries to match recursively.
			
			{String}  s   REstring for the start tag.
			{String} [m]  REstring for any tags within the match that
			.             match with the end tag (e.g. "(" with ")")
			{String}  e   REstring for the end tag.
		*/
		function RecursiveExpression(s, m, e) {
			if (arguments.length === 2) {
				e = m;
				m = null;
			}
			var start  =       new RegExp("^" + s),
				nester = (m && new RegExp("^" + m)),
				end    =       new RegExp("^" + e);
			
			return {
				/*
					Accepts a string, and tries to match it.
					If a match is found, an array is returned with:
						the complete matched string,
						any substrings of the first start tag match,
						then the string between the start tag and the end tag,
						then any substrings of the final end tag match.
					The array lacks index and input properties.
				*/
				exec: function exec(src) {
					var
						// Temp variable for tag match checks
						startMatch = start.exec(src),
						nesting = 0,
						innerMatchText = "",
						match,
						out;
					/*
						Early exit: the start tag doesn't match.
					*/
					if (!startMatch) {
						return "";
					}					
					src = src.slice(startMatch[0].length);
					/*
						Loop until the end tag matches without nesting.
					*/
					while(src) {
						match = null;
						// End tag was found: check if we're done.
						if ((match = end.exec(src))) {
							if (nesting > 0) {
								nesting -= 1;
							}
							else {
								// We're done - create the final return value.

								// Assemble the fullmatch text
								startMatch[0] += innerMatchText + match[0];
								// Add the substrings of each type of match, in the right order.
								out = startMatch.concat(innerMatchText, match.slice(1));
								return out;
							}
						}
						// Start tag was found again: 
						else if ((match = start.exec(src)) || (nester && (match = nester.exec(src)))) {
							nesting += 1;
						}
						// Keep looping: move characters into the returning string.
						if (match) {
							innerMatchText += match[0];
							src = src.slice(match[0].length);
						}
						else {
							innerMatchText += src[0];
							src = src.slice(1);
						}
					}
					// The end tag wasn't found... no match.
					return "";
				}
			};
		}
		
		var ws = "\\s*",
			
			wb = "\\b",
			
			// Checks if text appears before line-breaks or end-of-input.
			eol = "(?=\\n+|$)",
			
			// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
			anyLetter       = "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
			// Identical to the above, but excludes hyphens.
			anyLetterStrict =    "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
			
			/*
				This is a regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
				string. This accounts for both single- and double-quotes, and escaped quote characters.
			*/
			unquoted = before(either( notChars("'\"\\") + either( "\\.", enclosed("'"), enclosed('"'))) + "*" + notChars("'\\") + "$"),
			
			/*
				Markdown lists changes:
				
				* Only the * can be used for bullets (to prevent ambiguity with printed numbers: -2 or +2)
				* Multiples of the bullet must be used for nested lists: **, instead of whitespace.
				* Numbered lists must use 0. instead of actual numbers. 
				
				In the field, lists are structurally not that useful in Twine, except for pure
				presentational purposes: putting a bullet-point before a line.
			*/
			bullet = "(?:\\*)",
			
			bulleted = ws + "(" + bullet + "+)\\s+([^\\n]*)" + eol,
			
			numberPoint = "(?:0\\.)",
			
			numbered = ws + "(" + numberPoint + "+)([^\\n]*)" + eol,
			
			/*
				FIXME: The {3,} selector currently enables a string of four ---- to be
				parsed as 1 - of text followed by --- hr.
			*/
			hr = ws + "([-*_]){3,}" + ws + eol,
			
			/*
				Markdown setext headers conflict with the hr syntax, and are thus gone.
			*/
			heading = ws + "(#{1,6})" + ws + "([^\\n]+?)" + ws + "#*" + ws + eol,
			
			/*
				New text alignment syntax.
			*/
			align = ws + "(==+>|<=+|=+><=+|<==+>)" + ws + eol,

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
				name:              "(" + anyLetter.replace("]","\\/]") + anyLetter + "*)(?=\\()",
				opener:            "\\(",
				closer:            "\\)"
			},
			
			tag = {
				name:              "\\w[\\w\\-]*",
				attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?"
			},
			
			string = { 
				// The empty strings
				emptyDouble: '""(?!")',
				emptySingle: "''(?!')",
				// Javascript strings
				single: "'" + either(notChars("\\'"),"\\\\.") + "+'",
				double: '"' + either(notChars('\\"'),'\\\\.') + '+"',
				// Python's triple-quoted strings.
				tripleSingle: "'''" + either(notChars("\\'"),'\\\\.',"''(?!')") + "+'''",
				tripleDouble: '"""' + either(notChars('\\"'),'\\\\.','""(?!")') + '+"""',
			},
			
			// This includes NaN, but I wonder if it should.
			number = '\\b(\\-?\\d+\\.?(?:[eE][+\\-]?\\d+)?|NaN)' + notBefore("m?s") + '\\b'
			;
		/*
			Return the RegExpStrings object.
		*/
		return {
			
			upperLetter: "[A-Z\u00c0-\u00de\u0150\u0170]",
			lowerLetter: "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]",
			anyLetter:   anyLetter,
			anyLetterStrict: anyLetterStrict,
			
			unquoted:    unquoted,
			escapedLine: "\\\\\\n",
			br: "\\n",
			
			/*
				Twine currently just uses HTML comment syntax for comments.
			*/
			comment:     "<!--[^]*?-->",
			
			tag:         "<\\/?" + tag.name + tag.attrs + ">",
			
			url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
			
			bullet:      bullet,
			
			hr:          hr,
			heading:     heading,
			align:       align,
			
			strong:      stylerSyntax("__", "**"),
			em:          stylerSyntax("_",  "*"),
			del:         stylerSyntax("~~"),
			italic:      stylerSyntax("//"),
			bold:        stylerSyntax("''"),
			sup:         stylerSyntax("^^"),
			
			code:        "(`+)" + ws + "([^]*?[^`])" + ws + "\\1(?!`)",
			
			bulleted:    bulleted,
			numbered:    numbered,
			
			/*
				Hook tags can be either prepended, pointing to the right,
					|tag>[The hook's text]
				or appended, pointing to the left.
					[The hook's text]<tag|
			*/
			hookAppended:
				new RecursiveExpression(
					"\\[",
					"\\]" + "<(" + anyLetter.replace("]", "_]") + "*)\\|"
				),
			
			hookPrepended:
				new RecursiveExpression(
					"\\|(" + anyLetter.replace("]", "_]") + "*)>\\[",
					"\\]"
				),
			
			hookAnonymous:
				new RecursiveExpression(
					"\\[",
					"\\]"
				),
			
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
			
			macro:
				new RecursiveExpression(
					macro.name + macro.opener,
					"\\(",
					macro.closer
				),
			
			macroOpener:
				macro.name + macro.opener,
				
			macroCloser: macro.closer,
			
			paragraph:
				/*
					Every block regex that separates paragraphs should be included in
					the negative lookahead in this regex.
				*/
				"\\n((?:[^\\n]+\\n?(?!"
				+ notBefore(heading, align, hr)
				+ "))+)\\n?",
			
			/*
				Macro code
			*/
			
			variable:
				"\\$((?:" + anyLetter.replace("\\-", "\\.") + "*"
				// Disallow -, but allow . property indexing
				+ anyLetter.replace("\\w\\-", "a-zA-Z\\.") + "+"
				+ anyLetter.replace("\\-", "\\.") + "*"
				// Array indexing syntax
				+ "|\\[[^\\]]+\\])+)",
			
			hookRef: "\\?(" + anyLetter + "+)\\b",
			
			/*
				Artificial types (non-JS primitives)
			*/
			
			cssTime: "\\b(\\d+\\.?\\d*|\\d*\\.?\\d+)(m?s)\\b",
			
			/*
				Natural types
			*/
			number: number,
			
			boolean: "(true|false|null|undefined)",
			
			// Special identifiers
			identifier: "it|time",
			
			// TODO: this generated regex is horrendously slow
			// when an unclosed ' or " is in the source text.
			// Better make it a recursive regex or something?
			string: 
				"(" + either(
					// Single strings					
					//string.tripleSingle,
					string.tripleDouble,
					//string.emptySingle,
					string.emptyDouble,
					//string.single,
					string.double
				) + ")",
			
			/*
				Macro operators
			*/
			
			is:        wb + caseInsensitive("is") + notBefore(" not", " in") + wb,
			to:        wb + either(caseInsensitive("to"), "=") + wb,
			and:       wb + either(caseInsensitive("and"), "&&") + wb,
			or:        wb + either(caseInsensitive("or"), "\\|\\|") + wb,
			not:       wb + either(caseInsensitive("not"), "!") + wb,
			isNot:     wb + either(caseInsensitive("is not"), "!==") + wb,
			
			lt:        "<(?!=)",
			lte:       "<=",
			gt:        ">(?!=)",
			gte:       ">=",
			
			isIn:      wb + caseInsensitive("is in") + wb,
			contains:  wb + caseInsensitive("contains") + wb,

			add:       "\\+",
			subtract:  "\\-",
			multiply:  "\\*",
			divide:    "\\\/",
			modulo:    "%",
			
			grouping:
				new RecursiveExpression(
					"\\(",
					"\\)"
				),
			
			comma: ",",
		};
	}());
	
	/*
		Equivalent to ES6 Object.assign()
	*/
	function merge(obj /* variadic */) {
		var i = 1,
			target, key;
		for(; i < arguments.length; i++) {
			target = arguments[i];
			for(key in target) {
				if(Object.hasOwnProperty.call(target, key)) {
					obj[key] = target[key];
				}
			}
		}
		return obj;
	}
	
	/*
		Just some basic methods that iterate over tokens' children,
		that tokens can call upon.
	*/
	var tokenPrototype = {
		/*
			Run a function on this token and all its children.
		*/
		forEach: function forEach(fn) {
			fn(this);
			this.children.forEach(function() { forEach(fn); });
		},
		/*
			Runs a function on every leaf token in the tree,
			and returns true if all returned truthy values.
		*/
		everyLeaf: function everyLeaf(fn) {
			var ret;
			if (!this.children || this.children.length === 0) {
				return !!fn(this);
			}
			return this.children.everyLeaf(function() { ret = ret && !!everyLeaf(fn); });
		},
		/*
			Check if all leaf nodes contain just whitespace.
		*/
		isWhitespace: function isWhitespace() {
			return this.every(function(e) {
				return !e.text.trim();
			});
		}
	};
	
	/*
		Returns an object representing a lexer's inner state, methods to permute
		that state, and methods to query that state.
		
		Lexers augment this returned object's rules property.
	*/
	function lexerInnerState() {
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
			var children = null;
			
			if (data) {
				/*
					If the token has non-empty innerText, lex the innerText
					and append to its children array.
				*/
				if (data.innerText) {
					children = lex(data.innerText,
						states[0].pos + match[0].indexOf(data.innerText),
						data.expression || states[0].inMacro);
				}
				/*
					The token may signify entering or exiting a macro.
				*/
			}
			
			states[0].tokens.push(merge(Object.create(tokenPrototype),
			{
				type: type,
				start: states[0].pos,
				end: states[0].pos + match[0].length,
				text: match[0],
				children: children,
				/*
					And now for some methods.
				*/
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
			
			If given a second parameter, that is used as the property name
			instead of "innerText"
			
			@method textPusher
			@private
		*/
		function textPusher(type, name) {
			name = name || "innerText";
			return function(match) {
				/*
					This function returns the rightmost non-zero array-indexed value.
					It's designed for matches created from regexes that only have 1 group.
				*/
				var innerText = match.reduceRight(function(a, b, index) { return a || (index ? b : ""); }, ""),
					data = {};
				
				data[name] = innerText;
				
				push(type, match, data);
			};
		}
		
		/**
			Creates a function that pushes a token with a value,
			designed for Twine code styling rules.
			
			When given a function as the 2nd parameter, then match is
			passed to that function to determine the value of value.
			
			@method valuePusher
			@private
		*/
		function valuePusher(type, fn) {
			return function(match) {
				push(type, match, { value: typeof fn === "function" ? fn(match) : fn });
			};
		}
		
		/**
			A post-processing routine that takes the token tree from lex(),
			and turns sequences of macro tokens into trees rooted at openMacro tokens.
			This is an in-place array transformation.
			
			This is a stop-gap measure and should be replaced by lex()
			performing this transformation itself during its pass.
			
			@method nestMacroTokens
			@private
		*/
		void function nestMacroTokens(tokens) {
			var i, token,
				macroStack = [];
			
			for (i = 0; i < tokens.length; i+=1) {
				token = tokens[i];
				
				if (macroStack[0]) {
					/*
						Remove the token from its position in the tokens array,
						and make it a child of the nearest macro.
					*/
					macroStack[0].children.push(token);
					tokens.splice(i,1);
					i -= 1;
					/*
						Incorporate the child's text into the macro token's text.
					*/
					if (!token.openMacro) {
						macroStack[0].text += token.text;
						macroStack[0].end = token.end;
					}
				}
				
				if (token.openMacro) {
					macroStack.unshift(token);
				}
				else if (token.closeMacro) {
					token = macroStack.shift();
					/*
						Propagate the changes up the tree to the parent.
					*/
					if (macroStack[0]) {
						macroStack[0].text += token.text;
						macroStack[0].end = token.end;
					}
				}
			}
			return tokens;
		};
		
		/*
			The main method of the lexer. Returns an array of tokens for the passed text.
			The src is consumed gradually, and rules are repeatedly matched to the
			start of the src. If no rule matches, a default "text" token is gradually
			built up, to be pushed when a rule finally matches.
		*/
		function lex(src, initpos, inMacro) {
			var done, ret, rname, rule, match, i,
				lastRule = "",
				/*
					This is a buffer holding text that isn't matched
					by any particular rule, to be stored until the source
					is exhausted or a rule is finally matched.
				*/
				text = "",
				ruleskeys = Object.keys(rules);
			
			/*
				Put a new state on the state stack. If this is a recursively nested lex() call,
				then below it on the stack are the states of its calling scopes.
			*/
			states.unshift({
				tokens: [],
				pos: initpos || 0,
				inMacro: !!inMacro
			});
			while(src) {
				/*
					This 'done' variable tracks whether a rule was successfully
					matched inside the upcoming for loop.
				*/
				done = false;
				/*
					Run through all the rules in turn.
					This of course could stand to be accelerated by
					e.g. maintaining multiple short lists of rules to iterate
					through depending on state, or sorting the rules by expected
					frequency.
					Speed concerns also forgo the deployment of [].forEach() here.
				*/
				for (i = 0; i < ruleskeys.length; i+=1) {
					rname = ruleskeys[i];
					if (rname === "text") {
						continue;
					}
					rule = rules[rname];
					/*
						Rules with no handler (which I must've left in by mistake)
						cannot be matched.
					*/
					if (!rule.fn) {
						continue;
					}
					if ((match = rule.match.exec(src)) &&
							/*
								Check whether this rule is restricted to only being matched
								directly after another rule has. An example is the "block"
								rules, which may only match after a "br" or "paragraph" rule.
							*/
							(!lastRule || !rule.lastRule
								|| rule.lastRule.indexOf(lastRule)>-1) &&
							/*
								Within macros, only macro rules and expressions can be used.
							*/
							(!states[0].inMacro || rule.macro || rule.expression) &&
							/*
								Outside macros, macro rules can't be used.
							*/
							(!rule.macro || states[0].inMacro)) {
						
						/*
							Now that it's matched, let's forge this token.
							First, push the slurped text buffer, and hastily
							create a token out of it, representing the interstitial unmatched
							text between this and the last "proper" token.
						*/
						if (text) {
							rules.text.fn([text]);
							states[0].pos += text.length;
							text = "";
						}
						
						// Now handle the matched rule
						rule.fn(match);
						
						// Increment the position in the src
						states[0].pos += match[0].length;
						src = src.slice(match[0].length);
						
						// Finished matching a rule - resume
						lastRule = rname;
						done = true;
						// Break from the for-loop
						break;
					}
				}
				/*
					If no match was available, then treat this run of source as mere human prose,
					and slurp it up into the text buffer.
				*/
				if (src && !done) {
					text += src[0];
					lastRule = "text";
					src = src.slice(1);
				}
			}
			// Push the last run of slurped text.
			if (text) {
				push("text", [text]);
			}
			/*
				Pop the state from the stack, fetch the tokens, and return them.
			*/
			ret = states.shift().tokens;
			return ret;
		}
		
		/*
			This is the returned object representing the lexer inner state.
		*/
		return {
			// The main function
			lex: lex,
			/*
				The (initially empty) rules object should be augmented with
				whatever rules the language requires.
			*/
			rules: rules,
			/*
				The push function is exported to allow rules object entries to
				use it in their handlers.
			*/
			push: push,
			/*
				The "sugar" functions act as shorthands for common push() uses.
			*/
			pusher: pusher,
			textPusher: textPusher,
			valuePusher: valuePusher,
		};
	}
	
	/**
		When passed a lexerInnerState object, it augments it with rules.
		
		@method rules
		@private
		@for TwineMarkup
	*/
	function rules(state) {
		// TODO: reimplement backslash-escapes
		var push = state.push,
			pusher = state.pusher,
			textPusher = state.textPusher,
			valuePusher = state.valuePusher,
			block = ["br", "paragraph"],
			addedRules;

		addedRules = merge({
				/*
					First, the block rules.
				*/
				heading: {
					lastRule: block,
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
					lastRule: block,
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
						} else if (arrow.contains(">")) {
							align = "right";
						} else if (arrow.contains("<")) {
							align = "left";
						}
						push('align', match, { align: align });
					},
				},
				hr: {
					lastRule: block,
					fn: pusher("hr")
				},
				bulleted: {
					lastRule: block,
					fn: function(match) {
						push("bulleted", match, {
							depth: match[1].length,
							innerText: match[2]
						});
					}
				},
				numbered: {
					lastRule: block,
					fn: function(match) {
						push("numbered", match, {
							depth: match[1].length / 2,
							innerText: match[2]
						});
					}
				},
				paragraph: {
					lastRule: block,
					fn: textPusher("paragraph")
				},
				/*
					Now, the inline macros.
				*/
				passageLink: {
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
					fn: function(match) {
						push("twineLink", match, {
							innerText: match[1],
							passage: match[2]
						});
					}
				},
				simpleLink: {
					fn: function(match) {
						push("twineLink", match, {
							innerText: match[1],
							passage: match[1]
						});
					}
				},
				hookAppended: {
					fn: function(match) {
						push("hook", match, {
							innerText: match[1],
							name: match[2]
						});
					}
				},
				hookPrepended: {
					fn: function(match) {
						push("hook", match, {
							innerText: match[2],
							name: match[1]
						});
					}
				},
				/*
					A tag-less hook that appears after a macro.
				*/
				hookAnonymous: {
					lastRule: ["macro"],
					fn: function(match) {
						push("hook", match, {
							innerText: match[1],
							name: ""
						});
					}
				},
				code: {
					fn: function(match) {
						push("code", match, {
							code: match[2]
						});
					}
				},
				escapedLine: {
					fn: pusher("escapedLine")
				},
				/*
					Like GitHub-Flavoured Markdown, Twine preserves line breaks.
				*/
				br:      { fn:     pusher("br") },
				comment: { fn:     pusher("comment") },
				tag:     { fn:     pusher("tag") },
				url:     { fn:     pusher("url") },
				strong:  { fn: textPusher("strong") },
				em:      { fn: textPusher("em") },
				bold:    { fn: textPusher("bold") },
				italic:  { fn: textPusher("italic") },
				del:     { fn: textPusher("del") },
				
				/*
					Now, macro code rules.
				*/
				macro: {
					expression: true,
					fn: function(match) {
						push("macro", match, {
							name: match[1],
							innerText: match[2],
							expression: true
						});
					}
				},
				cssTime: {
					macro: true,
					fn: valuePusher("cssTime", function(match) {
						return +match[1]
							* (match[2].toLowerCase() === "s" ? 1000 : 1);
					})
				},
				number: {
					macro: true,
					fn: valuePusher("number", function(match) {
						/*
							This fixes accidental octal (by eliminating octal)
						*/
						return parseFloat(match[0]);
					})
				},
				hookRef:  { expression: true, fn: textPusher("hookRef", "name") },
				variable: { expression: true, fn: textPusher("variable", "name") },
				grouping: { macro: true, fn: textPusher("grouping") },
				
				// The text rule has no match RegExp
				text:     { fn:     pusher("text") },
			},
			/*
				Some macro-only tokens
			*/
			["string", "boolean", "identifier", "is", "to", "and", "or", "not", "isNot", "comma",
			"add", "subtract", "multiply", "divide", "modulo", "lt", "lte", "gt", "gte",
			"contains", "isIn"].reduce(function(a, e) {
				a[e] = { macro: true, fn: pusher(e) };
				return a;
			},{})
		);
		
		/*
			A quick shorthand function to convert a RegExpStrings property into a RegExp,
			or to return it if it's a RecursiveExpression already.
		*/
		function r(index) {
			var re = RegExpStrings[index];
			if (typeof re !== "string") {
				return re;
			}
			return new RegExp("^(?:" + re + ")");
		}
		
		/*
			Each named rule uses the same named RegExpString for its
			regular expression. Add those properties succinctly now.
		*/
		Object.keys(addedRules).forEach(function(e) {
		console.log(e,r(e));
			addedRules[e].match = r(e);
		});
		merge(state.rules, addedRules);
		return state;
	}
	
	/*
		Create the lexer object
	*/
	Lexer = rules(lexerInnerState());
	
	/**
		Export the TwineMarkup module.
		
		Since this is a light freeze, Utils and RegExpStrings are still modifiable.
		
		@class TwineMarkup
		@static
	*/
	TwineMarkup = Object.freeze({
		
		/**
			@method lex
			@param {String} src String source to lex.
			@return {Array} Tree structure of 
		*/
		lex: Lexer.lex,
		
		/**
			Export the RegExpStrings.
			
			@property {Object} RegExpStrings
		*/
		RegExpStrings: RegExpStrings
	});
	if(typeof module === 'object') {
		module.exports = TwineMarkup;
	}
	else if(typeof define === 'function' && define.amd) {
		define("twinemarkup",[],function () {
			return TwineMarkup;
		});
	}
	else {
		this.TwineMarkup = TwineMarkup;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
