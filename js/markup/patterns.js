/**
	The Patterns are the raw strings used by the lexer to match tokens.
	These are used primarily by the Markup module, where they are attached to
	lexer rules.
	
	@module Patterns
*/
(function(){
	"use strict";
	var Patterns;
	
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
		var pattern;
		
		if (arguments.length > 1 || 1) {
			pattern = "^(?:" + Array.apply(0, arguments).map(escape).join("|") + ")";
			return new RegExp(pattern);
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
			opener:            "\\(",
			name:              "(" + anyLetter.replace("]","\\/]") + anyLetter + "*):",
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
		Return the Patterns object.
		
		Note that some of these properties are "opener" objects, which are used by the 
		lexer. It's a bit #awkward having them alongside the string properties like this,
		keyed to a similar but otherwise disconnected property name...
	*/
	Patterns = {
		
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
		
		macroFront: macro.opener + macro.name,
		groupingFront: "\\(" + notBefore(macro.name),
		groupingBack:  "\\)",
		
		paragraph:
			/*
				Every block regex that separates paragraphs should be included in
				the negative lookahead in this regex.
			*/
			"((?:[^\\n]+(?:\\n" 
			+ notBefore(heading, align, hr, bulleted, numbered, "\\n")
			+ ")?)+)",
		
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

		arithmetic: either("\\+", "\\-", "\\*", "\\\/", "%") + notBefore("="),
		comma:      ",",

		to:        either(wb + caseInsensitive("to") + wb, "="),
		augmentedAssign: either("\\+", "\\-", "\\*", "\\\/", "%") + "=",
	};
	
	if(typeof module === 'object') {
		module.exports = Patterns;
	}
	else if(typeof define === 'function' && define.amd) {
		define("patterns", [], function () {
			return Patterns;
		});
	}
	else {
		this.Patterns = Patterns;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
