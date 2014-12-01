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
		
		hr = ws + "[-*_]{3,}" + ws + eol,
		
		/*
			Markdown setext headers conflict with the hr syntax, and are thus gone.
		*/
		heading = "\n" + ws + "(#{1,6})" + ws + "([^\\n]+?)" + ws + "#*" + ws + eol,
		
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
			legacyText:        "(" + notChars("]|") + "?)",
		},

		identifier = "it|time",
		
		simpleVariable = "\\$(" + anyLetter.replace("\\-", "") + "+)",
		
		variableProperty = "\\.(" + anyLetter.replace("\\-", "") + "+)",
		
		variable = simpleVariable + "(?:" + variableProperty + ")*",
		
		macro = {
			opener:            "\\(",
			name:              "(" + either(anyLetter.replace("]","\\/]") + anyLetter + "*", variable) + "):",
			closer:            "\\)"
		},
		
		tag = {
			name:              "\\w[\\w\\-]*",
			attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?"
		},
		
		hookTagFront =  "\\|(" + anyLetter.replace("]", "_]") + "*)>",
		hookTagBack  =  "<("   + anyLetter.replace("]", "_]") + "*)\\|",
		
		string = {
			/*
				Notice that as this uses backreferences (\1 etc) this assumes
				the RegExp will be composed as single + double. #awkward
				
				Also notice that no empty string exists - this can only be produced
				using (text:) with no arguments.
			*/
			single:   "('+)[^]+?\\1",
			double:   '("+)[^]+?\\2',
		},
		
		/*
			This includes NaN, but I wonder if it should.
			This doesn't include the - sign because arithmetic's pattern will trump it.
			Negative numerals are handled in TwineScript as unary uses of arithmetic.
		*/
		number = '\\b(\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?|NaN)' + notBefore("m?s") + '\\b'
		;
		console.log(number);
	passageLink.main =
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
		+ passageLink.text;
	
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
		
		/*
			The verbatim syntax does not "nest", but terminals can be
			differentiated by adding more ` marks to each pair.
		*/
		verbatim:        "(`+)" + ws + "([^]*?[^`])" + ws + "\\1(?!`)",
		verbatimOpener:                                    opener("`"),
		
		/*
			TODO: Make the collapsed syntax nestable.
		*/
		collapsed:        "{([^]*?[^}])}",
		collapsedOpener:                                   opener("{"),
		
		bulleted:    bulleted,
		numbered:    numbered,
		
		/*
			Hook tags can be either prepended, pointing to the right,
				|tag>[The hook's text]
			or appended, pointing to the left.
				[The hook's text]<tag|
		*/
		hookAppendedFront:  "\\[",
		hookPrependedFront:
			hookTagFront + "\\[",
		/*
			The anonymous hook is a contextual production: it may only occur
			after macros and variables. Similarly, the hookAppendedFront
			may NOT occur after macros and variables. The reason these rules are
			not united is because their names are used to identify them in Lexer.
		*/
		hookAnonymousFront: "\\[",
		hookBack:  "\\](?!<)",
		
		hookAppendedBack:
			"\\]" + hookTagBack,
		
		passageLink:
			passageLink.main
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
		
		macroFront: macro.opener + before(macro.name),
		macroName: macro.name,
		
		groupingFront: "\\(" + notBefore(macro.name),
		groupingBack:  "\\)",
		
		/*
			Macro code
		*/
		
		simpleVariable:
			simpleVariable,
		
		variableOpener:
			opener("$"),
		
		variableProperty:
			variableProperty,
		
		variable:
			variable,
		
		hookRef: "\\?(" + anyLetter + "+)\\b",
		
		hookRefOpener:
			opener("?"),
		
		/*
			Artificial types (non-JS primitives)
		*/
		
		cssTime: "\\b(\\d+\\.?\\d*|\\d*\\.?\\d+)(m?s)\\b",
		
		colour: either(
			// Hue name
			caseInsensitive(either(
				"Red", "Orange", "Yellow", "Lime", "Green",
				"Cyan", "Aqua", "Blue", "Navy", "Purple",
				"Fuchsia", "Magenta","White", "Gray", "Grey", "Black"
			)),
			// Hexadecimal
			"#[\\dA-Fa-f]{3}(?:[\\dA-Fa-f]{3})?"
		),
		
		/*
			Natural types
		*/
		number: number,
		
		boolean: "(true|false|null|undefined)",
		
		// Special identifiers
		identifier: identifier,
		
		// TODO: this generated regex is horrendously slow
		// when an unclosed ' or " is in the source text.
		// Better make it a recursive regex or something?
		string:
			either(
				string.single,
				string.double
			),
		
		/*
			Macro operators
		*/
		
		is:        wb + caseInsensitive("is") + notBefore(" not", " in") + wb,
		isNot:     either(wb + caseInsensitive("is not") + wb, "!="),
		
		and:       either(wb + caseInsensitive("and") + wb, "&&"),
		or:        either(wb + caseInsensitive("or")  + wb, "\\|\\|"),
		not:       either(wb + caseInsensitive("not") + wb, "!" + notBefore("=")),
		
		inequality: either("<(?!=)", "<=", ">(?!=)", ">="),
		
		isIn:      wb + caseInsensitive("is in") + wb,
		contains:  wb + caseInsensitive("contains") + wb,

		arithmetic: either("\\+", "\\-", "\\*", "\\\/", "%") + notBefore("="),
		comma:      ",",
		spread:     "\\.\\.\\." + notBefore("\\."),

		to:        either(wb + caseInsensitive("to") + wb, "="),
		into:      wb + "into" + wb,
		augmentedAssign: either("\\+", "\\-", "\\*", "\\\/", "%") + "=",
	};
	
	if(typeof module === 'object') {
		module.exports = Patterns;
	}
	else if(typeof define === 'function' && define.amd) {
		define([], function () {
			return Patterns;
		});
	}
	else {
		this.Patterns = Patterns;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
