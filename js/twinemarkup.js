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
			This escapes its input.
		*/
		function notChars(/* variadic */) {
			return "[^" + Array.apply(0, arguments).map(escape).join("") + "]*";
		}
		
		/*
			Creates sugar functions which put multiple REstrings into parentheses, separated with |,
			thus producing a capturer or a lookahead.
			This does NOT escape its input.
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
		
		/*
			Opener lookaheads come in two forms: a simple string to match, when
			only one option for the syntax's opening exists, and a RegExp when
			there are multiple options. This function returns the former when
			only one option is passed as an argument, and the latter otherwise
			(performing escaping on the input strings, etc.)
		*/
		function opener(a /*variadic*/) {
			var regExpString;
			
			if (arguments.length > 1 || 1) {
				regExpString = "^(?:" + Array.apply(0, arguments).map(escape).join("|") + ")";
				return new RegExp(regExpString);
			}
			return {
				/*
					This function strives to be as fast as possible.
				*/
				exec: function(input) {
					var i = a.length;
					while(--i >= 0) {
						if (input[i] !== a[i]) {
							return false;
						}
					}
					return true;
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
			
			Note that some of these properties are "opener" objects, which are used by the 
			lexer. It's a bit #awkward having them alongside the string properties like this,
			keyed to a similar but otherwise disconnected property name...
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
			comment:         "<!--[^]*?-->",
			commentOpener:   opener("<!--"),
			
			tag:         "<\\/?" + tag.name + tag.attrs + ">",
			tagOpener:                            opener("<"),
			
			url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
			
			bullet:      bullet,
			
			hr:          hr,
			heading:     heading,
			align:       align,
			
			strong:          stylerSyntax("__", "**"),
			strongOpener:          opener("__", "**"),
			
			em:               stylerSyntax("_",  "*"),
			emOpener:               opener("_",  "*"),
			
			del:                   stylerSyntax("~~"),
			delOpener:                   opener("~~"),
			
			italic:                stylerSyntax("//"),
			italicOpener:                opener("//"),
			
			bold:                  stylerSyntax("''"),
			boldOpener:                  opener("''"),
			
			sup:                   stylerSyntax("^^"),
			supOpener:                   opener("^^"),
			
			code:        "(`+)" + ws + "([^]*?[^`])" + ws + "\\1(?!`)",
			codeOpener:                                    opener("`"),
			
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
			hookAppendedOpener:
				opener("["),
			
			hookPrepended:
				new RecursiveExpression(
					"\\|(" + anyLetter.replace("]", "_]") + "*)>\\[",
					"\\]"
				),
			hookPrependedOpener:
				opener("|"),
			
			hookAnonymous:
				new RecursiveExpression(
					"\\[",
					"\\]"
				),
			hookAnonymousOpener:
				opener("["),
			
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
				
			passageLinkOpener: opener("[["),
				
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
			
			legacyLinkOpener: opener("[["),
				
			simpleLink:
				/*
					As long as legacyLink remains in the grammar,
					use legacyText here to disambiguate.
				*/
				passageLink.opener + passageLink.legacyText + passageLink.closer,
			
			simpleLinkOpener: opener("[["),
			
			macro:
				new RecursiveExpression(
					macro.name + macro.opener,
					"\\(",
					macro.closer
				),
			
			paragraph:
				/*
					Every block regex that separates paragraphs should be included in
					the negative lookahead in this regex.
				*/
				"\\n((?:[^\\n]+\\n?(?!"
				+ notBefore(heading, align, hr)
				+ "))+)\\n?",
			
			paragraphOpener: opener("\n"),
			
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
			
			variableOpener:
				opener("$"),
			
			hookRef: "\\?(" + anyLetter + "+)\\b",
			
			hookRefOpener:
				opener("?"),
			
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
	function assign(obj /* variadic */) {
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
		The "prototype" object for lexer tokens.
		(Actually, for speed reasons, tokens are not created by Object.create(tokenMethods),
		and instead these methods are just assign()ed onto plain object tokens.)
		It just has some basic methods that iterate over tokens' children,
		but which nonetheless lexer customers may find valuable.
	*/
	var tokenMethods = Object.freeze({
		/*
			Run a function on this token and all its children.
		*/
		forEach: function forEach(fn) {
			fn(this);
			this.children.forEach(function() { forEach(fn); });
		},
		/*
			Given an index in this token's text, find the deepest leaf,
			if any, that corresponds to it.
		*/
		tokenAt: function tokenAt(index) {
			// First, a basic range check.
			if (index < this.start || index >= this.end) {
				return null;
			}
			/*
				Ask each child, if any, what their deepest token
				for this index is.
			*/
			if (this.children) {
				return this.children.reduce(function(prevValue, child) {
					return prevValue || child.tokenAt(index);
				}, null);
			}
			return this;
		},
		/*
			Given an index in this token's text, find the closest leaf
			(that is, only from among the token's immediate children)
			that corresponds to it.
		*/
		nearestTokenAt: function nearestTokenAt(index) {
			// First, a basic range check.
			if (index < this.start || index >= this.end) {
				return null;
			}
			/*
				Find whichever child has the index within its start-end range.
			*/
			if (this.children) {
				return this.children.reduce(function(prevValue, child) {
					return prevValue || ((index >= child.start && index < child.end) ? child : null);
				}, null);
			}
			return this;
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
			return this.everyLeaf(function(e) {
				return !e.text.trim();
			});
		}
	});
	
	/*
		Returns an object representing a lexer's inner state, methods to permute
		that state, and methods to query that state.
		
		Lexers augment this returned object's rules property.
	*/
	function lexerInnerState() {
		var rules = {},
			/*
				States are objects with a tokens:Array and an index:Number.
				When the lexer is called (normally or recursively), a new
				state is shifted onto this stack.
			*/
			states = [];
		
		/**
			Creates a token and puts it in the current tokens array.
			
			Tokens are objects with idiosyncratic data, but are expected to have a
			type: String, start: Number, end: Number, and text: String.
			
			@method push
			@private
		*/
		function push(type, matchText, data) {
			var children = null,
				index = states[0].lastEnd();
			
			/*
				This accepts both regexp match arrays, and strings.
				For simplicity, extract the full match string from the array,
				if it indeed is one.
			*/
			if (Array.isArray(matchText)) {
				matchText = matchText[0];
			}

			/*
				If the token has non-empty innerText, lex the innerText
				and append to its children array.
			*/
			if (data) {
				if (data.innerText) {
					children = recursiveLex(data.innerText,
						index + matchText.indexOf(data.innerText),
						data.expression || states[0].inMacro);
				}
			}
			/*
				Now, create the token, then assign to it the idiosyncratic data
				properties and the tokenMethods that allow querying the
				token or its children.
			*/
			states[0].tokens.push(assign(
			{
				type:      type,
				start:     index,
				end:       index + matchText.length,
				text:      matchText,
				children:  children
			}, data, tokenMethods));
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
		
		/*
			A subroutine of recursiveLex, this takes a source text object,
			tries to match this lexer's rules to the start of it,
			then runs the matched rule's match event function, if one is found.
			Finally, it permutes the passed-in object to reflect
			the results.
			
			{String} src              The source string to match against.
			
			If no rule matches, then the unmatched text is stored on the
			unmatchedText property. Otherwise, that property is emptied and
			used to run the "text" rule's match event function.
		*/
		function matchRules(src) {
			var 
				/*
					Some hoisted temporary vars used in each loop iteration. 
				*/
				i, rule, match, slice,
				/*
					The cached array of rules property keys, for quick iteration.
				*/
				rulesKeys = rules[" keys"],
				/*
					index ticks upward as we advance through the src.
					firstUnmatchedIndex is bumped up whenever a match is made,
					and is used to create "text" tokens between true tokens.
				*/
				index = 0,
				firstUnmatchedIndex = 0,
				/*
					This caches the most recently created token.
				*/
				lastToken = null;
			
			/*
				Run through the src, character by character, matching all the
				rules on every slice, creating tokens as we go, until exhausted.
			*/
			while(index < src.length) {
				slice = src.slice(index);
				
				/*
					Run through all the rules in turn.
					This of course could stand to be accelerated by
					e.g. maintaining multiple short lists of rules to iterate
					through depending on state, or sorting the rules by expected
					frequency.
					Speed concerns also forgo the deployment of [].forEach() here.
				*/
				for (i = 0; i < rulesKeys.length; i+=1) {
					
					rule = rules[rulesKeys[i]];
					
					if (
							/*
								Check whether this rule is restricted to only being matched
								directly after another rule has. An example is the "block"
								rules, which may only match after a "br" or "paragraph" rule.
							*/
							(!rule.lastTokens || !lastToken
								|| rule.lastTokens.indexOf(lastToken.type)>-1) &&
							/*
								Within macros, only macro rules and expressions can be used.
							*/
							(!states[0].inMacro || rule.macro || rule.expression) &&
							/*
								Outside macros, macro rules can't be used.
							*/
							(!rule.macro || states[0].inMacro) &&
							/*
								If an opener is available, check that before running
								the full match regexp.
							*/
							(!rule.opener || rule.opener.exec(slice)) &&
							/*
								Finally, run the match. Any earlier would cause the rules excluded
								by the above checks to be run anyway, and waste time.
							*/
							(match = rule.match.exec(slice))) {
						/*
							Now that it's matched, let's forge this token.
							First, create a token out of the interstitial unmatched
							text between this and the last "proper" token.
						*/
						
						if (firstUnmatchedIndex < index) {
							push("text", src.slice(firstUnmatchedIndex, index));
						}
						// Now handle the matched rule
						rule.fn(match);
						
						// Increment the index in the src
						index += match[0].length;
						firstUnmatchedIndex = index;
						
						/*
							Re-store the last pushed token, assuming it was changed
							by the rule.fn call.
						*/
						lastToken = states[0].lastToken();
						
						// Break from the for-loop
						break;
					}
				}
				
				/*
					If no match was available, then advance one character and loop again.
				*/
				if (i === rulesKeys.length) {
					index += 1;
				}
			}
			/*
				Push the last run of unmatched text before we go.
			*/
			if (firstUnmatchedIndex < src.length) {
				push("text", src.slice(firstUnmatchedIndex, src.length));
			}
		}
		
		
		/*
			The main method of the lexer. Returns an array of tokens for the passed text.
			The src is consumed gradually, and rules are repeatedly matched to the
			start of the src. If no rule matches, a default "text" token is gradually
			built up, to be pushed when a rule finally matches.
			
			Do not be misled about the nature of initIndex:
			it is the index within the **entire section**'s text,
			which this function does not have purview to inspect.
			
			...Of course, if no initIndex was provided, then we may safely
			assume that the src string is the entire sections' text.
		*/
		function recursiveLex(src, initIndex, inMacro) {			
			/*
				Put a new state on the state stack. If this is a nested recursiveLex() call,
				then below it on the stack are the states of its calling scopes.
			*/
			states.unshift({
				tokens: [],
				inMacro: !!inMacro,
				/*
					lastToken is a semantic shortcut to the last
					entry in the tokens array.
				*/
				lastToken: function() {
					return this.tokens[this.tokens.length-1];
				},
				/*
					lastEnd is used only by push(), but it's important:
					it provides the end index of the last token
					(that is, the index into the src, offset by initIndex,
					where the matched text of the token ended), allowing
					the start index of a new token to be calculated.
				*/
				lastEnd: function() {
					var lastToken = this.lastToken();
					return lastToken ? lastToken.end : initIndex || 0;
				}
			});
			/*
				Do the work.
			*/
			matchRules(src);
			
			/*
				Pop the state from the stack, fetch the tokens, and return them.
			*/
			return states.shift().tokens;
		}
		
		/*
			This is the returned object representing the lexer inner state.
		*/
		return {
			/*
				The main function.
				This returns the entire set of tokens, rooted in a "root"
				token that has all of tokenMethods's methods.
			*/
			lex: function(src, initIndex, inMacro) {
				return assign({
					type:          "root",
					start:   initIndex || 0,
					end:       src.length,
					text:             src,
					children: recursiveLex(src, initIndex, inMacro)
				}, tokenMethods);
			},
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
				These "sugar" functions act as shorthands for common push() uses.
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
		var push = state.push,
			pusher = state.pusher,
			textPusher = state.textPusher,
			valuePusher = state.valuePusher,
			/*
				These two rules are the only ones that permit
				block rules to follow them.
			*/
			block = ["br", "paragraph"],
			/*
				Because it's important that all of the block rules be evaluated
				before the inline rules, etc., these three objects contain
				each ordered category of rules, and are joined together later.
			*/
			blockRules,
			inlineRules,
			macroRules,
			allRules;

		blockRules = {
			/*
				First, the block rules.
			*/
			paragraph: {
				lastTokens: block,
				fn: textPusher("paragraph")
			},
			hr: {
				lastTokens: block,
				fn: pusher("hr")
			},
			bulleted: {
				lastTokens: block,
				fn: function(match) {
					push("bulleted", match, {
						depth: match[1].length,
						innerText: match[2]
					});
				}
			},
			heading: {
				lastTokens: block,
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
				lastTokens: block,
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
			numbered: {
				lastTokens: block,
				fn: function(match) {
					push("numbered", match, {
						depth: match[1].length / 2,
						innerText: match[2]
					});
				}
			},
		};
		
		/*
			Now, the inline rules.
		*/
		inlineRules = {
			
			/*
				Like GitHub-Flavoured Markdown, Twine preserves line breaks
				within paragraphs.
			*/
			br:      { fn:     pusher("br") },
			strong:  { fn: textPusher("strong") },
			em:      { fn: textPusher("em") },
			bold:    { fn: textPusher("bold") },
			italic:  { fn: textPusher("italic") },
			del:     { fn: textPusher("del") },
			
			comment: { fn:     pusher("comment") },
			tag:     { fn:     pusher("tag") },
			url:     { fn:     pusher("inlineUrl") },
			
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
				lastTokens: ["macro"],
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
			legacyLink: {
				fn: function(match) {
					push("twineLink", match, {
						innerText: match[1],
						passage: match[2]
					});
				}
			},
		};
		
		/*
			Now, macro code rules.
		*/
		macroRules = assign({
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
				grouping: { macro: true, fn: textPusher("grouping") }
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
			Merge all of the above together.
		*/
		allRules = assign({}, blockRules, inlineRules, macroRules);
		
		/*
			Cache the rule keys in a separate " keys" property,
			in the order in which they should be evaluated by matchRule().
			
			(The space is to signify that it's not a rule property.)
		*/
		allRules[" keys"] = Object.keys(allRules);
		
		/*
			Most importantly, add the match property to each rule
			(the RegExp used by the lexer to match it), as well
			as some other properties.
		*/
		allRules[" keys"].forEach(function(key) {
			/*
				Each named rule uses the same-named RegExpString for its
				regular expression. The RegExpStrings are added now.
			*/
			var re = RegExpStrings[key];
			if (typeof re !== "string") {
				allRules[key].match = re;
			}
			else {
				allRules[key].match = new RegExp("^(?:" + re + ")");
			}
			/*
				If an opener is available, include that as well.
				Openers are used as lookaheads to save calling
				the entire match regexp every time.
			*/
			if (RegExpStrings[key + "Opener"]) {
				allRules[key].opener = RegExpStrings[key + "Opener"];
			}
		});
		assign(state.rules, allRules, 
			/*
				The final "text" rule is a dummy, exempt from being a proper
				rule key, and with no match property. 
			*/
			{ text:     { fn:     pusher("text") }});
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
