/**
	TwineMarkup, by Leon Arnott
	based on marked: a markdown parser
	Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
	https://github.com/chjj/marked
	
	@module TwineMarkup
*/
;(function () {
	"use strict";
	
	var RegExpStrings, Lexer, TwineMarkup;

	/*
		The RegExpStrings are the raw strings used by the lexer to match tokens.
		
		These are exported so that Harlowe can use them consistently.
		
		FIXME: Does this really need to be so far from the rules() function??
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
			
			hookTagFront =  "\\|(" + anyLetter.replace("]", "_]") + "*)>",
			hookTagBack  =  "<("   + anyLetter.replace("]", "_]") + "*)\\|",
			
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
			hookAppendedFront:  "\\[",
			hookAnonymousFront: "\\[",
			hookBack:  "\\](?!<)",
			
			hookPrependedFront:
				hookTagFront + "\\[",
			
			hookAppendedBack:
				"\\]" + hookTagBack,
			
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
			
			macroFront: macro.name + macro.opener,
			groupingFront: "\\(",
			groupingBack:  "\\)",
			
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
		Returns an object representing a lexer's inner state, methods to permute
		that state, and methods to query that state.
		
		Lexers augment this returned object's rules property.
	*/
	function lexerInnerState() {
		var rules = {},
			tokenMethods;
		/*
			The "prototype" object for lexer tokens.
			(As an experiment in JS pseudo-classical syntax, instances are created
			by directly calling tokenMethods.constructor, which is otherwise nameless.)
			It just has some basic methods that iterate over tokens' children,
			but which nonetheless lexer customers may find valuable.
		*/
		tokenMethods = {
			constructor: function() {
				for (var i = 0; i < arguments.length; i++) {
					assign(this, arguments[i]);
				}
			},
			/*
				Create a token and put it in the children array.
			*/
			addChild: function addChild(type, matchText, tokenData) {
				var index = this.lastChildEnd(),
					childToken;
				
				/*
					This accepts both regexp match arrays, and strings.
					For simplicity, extract the full match string from the array,
					if it indeed is one.
				*/
				if (Array.isArray(matchText)) {
					matchText = matchText[0];
				}
				
				/*
					Now, create the token, then assign to it the idiosyncratic data
					properties and the tokenMethods.
				*/
				childToken = new this.constructor(
					{
						type:      type,
						start:     index,
						end:       matchText && index + matchText.length,
						text:      matchText,
						children:  []
					},
					tokenData);
				
				/*
					If the token has non-empty innerText, lex the innerText
					and append to its children array.
				*/
				if (childToken.innerText) {
					lex(childToken);
				}
				/*
					Having finished, push the child token to the children array.
				*/
				this.children.push(childToken);
				/*
					Q: Is this returned value used?
				*/
				return childToken;
			},
			
			/*
				Run a function on this token and all its children.
			*/
			forEach: function forEach(fn) {
				// This token
				fn(this);
				// All of its children
				this.children.forEach(function() { forEach(fn); });
			},
			
			/*
				A shortcut to the last element in the children array.
			*/
			lastChild: function lastChild() {
				return this.children ? this.children[this.children.length-1] || null : null;
			},
			
			/*
				lastChildEnd provides the end index of the last child token,
				allowing the start index of a new token to be calculated.
				
				Hence, when there are no children, it defaults to the start
				index of this token.
			*/
			lastChildEnd: function lastChildEnd() {
				var lastToken = this.lastChild();
				return lastToken ? lastToken.end : this.start || 0;
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
			},
			/*
				Convert this token into a text token, in the simplest manner possible.
				
				TODO: Really, this should combine this with all adjacent text tokens.
			*/
			demote: function demote() {
				this.type = "text";
			},
			
			toString: function() {
				var ret = this.type;
				if (this.children && this.children.length > 0) {
					ret += "[" + this.children + "]";
				}
				return ret;
			}
		};
		tokenMethods.constructor.prototype = tokenMethods;
		
		/*
			The main lexing routine. Given a token with an innerText property and
			addChild methods, this function will lex its text into new tokens
			and add them as children.
		*/
		function lex(parentToken) {
			var
				// Some shortcuts
				src = parentToken.innerText,
				/*
					This somewhat simple stack determines what "mode"
					the lexer is in.
					
					Ugh... I need to implement "mode"s as a thing.
				*/
				modeStack = [parentToken.type === "macro" ? "macro" : ""],
				/*
					The frontTokenStack's items are "front" tokens, those
					that pair up with a "back" token to make a token representing
					an arbitrarily nestable rule.
				*/
				frontTokenStack = [],
				// Some hoisted temporary vars used in each loop iteration. 
				i, l, rule, match, slice,
				// The cached array of rules property keys, for quick iteration.
				rulesKeys = rules[" keys"],
				/*
					index ticks upward as we advance through the src.
					firstUnmatchedIndex is bumped up whenever a match is made,
					and is used to create "text" tokens between true tokens.
				*/
				index = 0,
				firstUnmatchedIndex = 0,
				/*
					This caches the most recently created token between iterations.
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
				for (i = 0, l = rulesKeys.length; i < l; i+=1) {
					
					rule = rules[rulesKeys[i]];

					if (
							/*
								Check whether this rule is restricted to only being matched
								directly after another rule has. An example is the "block"
								rules, which may only match after a "br" or "paragraph"
								rule.
							*/
							(!rule.canFollow ||
								rule.canFollow.indexOf(lastToken && lastToken.type) >-1) &&
							/*
								Conversely, check whether this rule cannot follow after
								the previous rule.
							*/
							(!rule.cannotFollow ||
								rule.cannotFollow.indexOf(lastToken && lastToken.type) === -1) &&
							/*
								Within macros, only macro rules and expressions can be used.
							*/
							(modeStack[0] !== "macro" || rule.isExpression || rule.isMacroOnly) &&
							/*
								Outside macros, macro rules can't be used. (But expressions can!)
							*/
							(!rule.isMacroOnly || modeStack[0] === "macro") &&
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
							parentToken.addChild("text", src.slice(firstUnmatchedIndex, index));
						}
						// Now handle the matched rule
						rule.fn(parentToken, match);
						
						/*
							Re-store the last pushed token, assuming it was changed
							by the rule.fn call.
							(BIG ASSUMPTION??)
						*/
						lastToken = parentToken.lastChild();
						
						// Increment the index in the src
						index += lastToken.text.length;
						firstUnmatchedIndex = index;
						/*
							Front tokens are saved, in case a Back token arrives
							later that can match it.
						*/
						if (lastToken.type.endsWith("Front")) {
							frontTokenStack.unshift(lastToken);
							
							// Ugh, modes
							if (lastToken.innerMode) {
								modeStack.unshift(lastToken.innerMode);
							}
						}
						/*
							If a Back token arrives, it must match with the most recent Front token.
							If so, both tokens, and those intervening, are merged ("folded") into one.
						*/
						else if (lastToken.type.endsWith("Back")) {
							if (frontTokenStack.length &&
								lastToken.matches && frontTokenStack[0].type in lastToken.matches) {
								/*
									Having found a matching pair of tokens, we fold them together.
								*/
								foldTokens(parentToken, lastToken, frontTokenStack.shift());
								/*
									Note: that function splices the children array in-place!!
									Fortunately, nothing needs to be adjusted to account for this.
								*/
								// I'll explain later.
								if (lastToken.innerMode === modeStack[0]) {
									modeStack.shift();
								}
							}
							else {
								/*
									It doesn't match anything...! It's just prose text, then.
									Demote the token to a text token.
								*/
								lastToken.demote();
							}
						}
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
			if (firstUnmatchedIndex < index) {
				parentToken.addChild("text", src.slice(firstUnmatchedIndex, index));
			}
			/*
				We're done, except that we may still have unmatched frontTokens.
				Go through them and demote them.
			*/
			while(frontTokenStack.length > 0) {
				frontTokenStack.shift().demote();
			}
			return parentToken;
		}
		
		/*
			To waylay speed concerns, the tokens are passed in as tuples: 
			the token object itself, and its index within the parentToken's
			children array.
		*/
		function foldTokens(parentToken, backToken, frontToken) {
			/*
				Having found a matching pair of tokens, we fold them together.
				For convenience, let's promote the Back token (currently, "child")
				into the folded-up single token.
			*/
			var backTokenIndex   = parentToken.children.indexOf(backToken),
				frontTokenIndex  = parentToken.children.indexOf(frontToken),
				// Hoisted loop vars
				i, l, key;
			
			/*
				First, find the tokens enclosed by the pair, and make them the
				Back token's children.
			*/
			backToken.children = parentToken.children.splice(
				frontTokenIndex + 1,
				/*
					This quantity selects only those after the Front token
					and before the Back token.
				*/
				(backTokenIndex) - (frontTokenIndex + 1)
			);
			
			/*
				Change its type to the actual type, without the "Back" suffix.
				
				Recall that a Back token's "matches" array maps Front token types
				(the key) to full token types (the value).
			*/
			backToken.type = backToken.matches[frontToken.type];
			
			/*
				Change its text and innerText to reflect its contents.
			*/
			backToken.innerText = "";
			for (i = 0, l = backToken.children.length; i < l; i++) {
				backToken.innerText += backToken.children[i].text;
			}
			
			/*
				The text includes the original enclosing tokens around the
				innerText.
				
				In the case of a hook, this reflects the syntax structure:
				"[" + hook contents + "]"
			*/
			backToken.text = frontToken.text + backToken.innerText + backToken.text;
			
			/*
				Copy other properties that the Front token possesses but
				the Back token does not.
				
				Assumption: that the Back token and Front token will never
				have colliding props. If so, then they are left as they are.
			*/
			for (key in frontToken) {
				if(Object.hasOwnProperty.call(frontToken, key)
					&& !Object.hasOwnProperty.call(backToken, key)) {
					backToken[key] = frontToken[key];
				}
			}
			
			/*
				Remove the Front token.
			*/
			parentToken.children.splice(frontTokenIndex, 1);
			
			/*
				Oh, before I forget: if the new token is a macro, we'll have to lex()
				its children all again. Sorry ;_;
			*/
			if (backToken.type === "macro") {
				backToken.children = [];
				lex(backToken);
			}
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
			lex: function(src, initIndex) {
				var ret = lex(new tokenMethods.constructor({
					type:            "root",
					start:   initIndex || 0,
					end:         src.length,
					text:               src,
					innerText:          src,
					children:            [],
				}));
				/*
					[Insert console.log(ret) here if you feel like it]
				*/
				return ret;
			},
			/*
				The (initially empty) rules object should be augmented with
				whatever rules the language requires.
			*/
			rules: rules
		};
	}
	
	/**
		When passed a lexerInnerState object, it augments it with rules.
		
		@method rules
		@private
		@for TwineMarkup
	*/
	function rules(state) {
		var
			/*
				These rules are the only ones that permit
				block rules to follow them.
			*/
			block = ["br", "paragraph", null],
			/*
				Because it's important that all of the block rules be evaluated
				before the inline rules, etc., these three objects contain
				each ordered category of rules, and are joined together later.
			*/
			blockRules,
			inlineRules,
			macroRules,
			allRules;
			
		/**
			Creates a curried addChild()
		*/
		function pusher(type) {
			return function(token, match) {
				token.addChild(type, match);
			};
		}
		
		/*
			Creates a function that pushes a token with innerText;
			designed for styling rules like **strong** or //italic//.
			
			If given a second parameter, that is used as the property name
			instead of "innerText"
		*/
		function textPusher(type, name) {
			name = name || "innerText";
			return function(token, match) {
				/*
					This function returns the rightmost non-zero array-indexed value.
					It's designed for matches created from regexes that only have 1 group.
				*/
				var innerText = match.reduceRight(function(a, b, index) { return a || (index ? b : ""); }, ""),
					data = {};
				
				data[name] = innerText;
				
				token.addChild(type, match, data);
			};
		}
		
		/*
			Creates a function that pushes a token with a value;
			designed for TwineScript expression or macro rules.
			
			When given a function as the 2nd parameter, then match is
			passed to that function to determine the value of value.
		*/
		function valuePusher(type, fn) {
			return function(token, match) {
				token.addChild(type, match, { value: typeof fn === "function" ? fn(match) : fn });
			};
		}

		blockRules = {
			/*
				First, the block rules.
			*/
			paragraph: {
				canFollow: block,
				fn: textPusher("paragraph")
			},
			hr: {
				canFollow: block,
				fn: pusher("hr")
			},
			bulleted: {
				canFollow: block,
				fn: function(token, match) {
					token.addChild("bulleted", match, {
						depth: match[1].length,
						innerText: match[2]
					});
				}
			},
			heading: {
				canFollow: block,
				fn: function(token, match) {
					token.addChild("heading", match, {
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
				canFollow: block,
				fn: function (token, match) {
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
					token.addChild('align', match, { align: align });
				},
			},
			numbered: {
				canFollow: block,
				fn: function(token, match) {
					token.addChild("numbered", match, {
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
				fn: function(token, match) {
					var p1 = match[1],
						p2 = match[2],
						p3 = match[3];
					
					token.addChild("twineLink", match, {
						innerText: p2 ? p3 : p1,
						passage: p1 ? p3 : p2
					});
				}
			},
			simpleLink: {
				fn: function(token, match) {
					token.addChild("twineLink", match, {
						innerText: match[1],
						passage: match[1]
					});
				}
			},
			
			hookPrependedFront: {
				fn: function(token, match) {
					token.addChild("hookPrependedFront", match, {
						name: match[1],
						tagPosition: "prepended"
					});
				}
			},
			
			hookAppendedFront: {
				fn: pusher("hookAppendedFront"),
				cannotFollow: ["macro", "groupingBack"],
			},
			
			hookAnonymousFront: {
				fn: pusher("hookAnonymousFront"),
				canFollow: ["macro", "groupingBack"],
			},
			
			hookBack: {
				fn: function(token, match) {
					token.addChild("hookAppendedBack", match, {
						matches: {
							// Matching front token : Name of complete token
							hookPrependedFront: "hook",
							hookAnonymousFront: "hook",
						}
					});
				}
			},
			
			hookAppendedBack: {
				fn: function(token, match) {
					token.addChild("hookAppendedBack", match, {
						name: match[1],
						tagPosition: "appended",
						matches: {
							hookAppendedFront: "hook",
						}
					});
				},
			},
			
			code: {
				fn: function(token, match) {
					token.addChild("code", match, {
						code: match[2]
					});
				}
			},
			escapedLine: {
				fn: pusher("escapedLine")
			},
			legacyLink: {
				fn: function(token, match) {
					token.addChild("twineLink", match, {
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
				macroFront: {
					isExpression: true,
					fn: function(token, match) {
						token.addChild("macroFront", match, {
							name: match[1],
							/*
								This is used to change the mode inside lex(),
								to switch from TwineMarkup to TwineScript.
							*/
							innerMode: "macro",
						});
					}
				},
				groupingFront: { isMacroOnly: true, fn: pusher("groupingFront") },
				groupingBack: {
					isMacroOnly: true,
					fn: function(token, match) {
						token.addChild("groupingBack", match, {
							matches: {
								groupingFront: "grouping",
								macroFront: "macro"
							}
						});
					}
				},
				
				cssTime: {
					isMacroOnly: true,
					fn: valuePusher("cssTime", function(match) {
						return +match[1]
							* (match[2].toLowerCase() === "s" ? 1000 : 1);
					})
				},
				number: {
					isMacroOnly: true,
					fn: valuePusher("number", function(match) {
						/*
							This fixes accidental octal (by eliminating octal)
						*/
						return parseFloat(match[0]);
					})
				},
				hookRef:  { isExpression: true, fn: textPusher("hookRef", "name") },
				variable: { isExpression: true, fn: textPusher("variable", "name") }
			},
			/*
				Some macro-only tokens
			*/
			["string", "boolean", "identifier", "is", "to", "and", "or", "not", "isNot", "comma",
			"add", "subtract", "multiply", "divide", "modulo", "lt", "lte", "gt", "gte",
			"contains", "isIn"].reduce(function(a, e) {
				a[e] = { isMacroOnly: true, fn: pusher(e) };
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
				TODO: Can we remove it?
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
