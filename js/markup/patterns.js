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
	
	var
		// This includes all forms of whitespace except \n and \r
		ws = "[ \\f\\t\\v\u00a0\u1680\u180e\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*",
		
		// Mandatory whitespace
		mws = ws.replace("*","+"),
		
		// Word break
		wb = "\\b",
		
		//Escaped line
		escapedLine =  "\\\\\\n\\\\?|\\n\\\\",
		
		// Line break without postfix escape
		br = "\\n(?!\\\\)",
		
		// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
		anyLetter       = "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		// Identical to the above, but excludes hyphens.
		anyLetterStrict =    "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		
		eol = either("\\n", "$"),
		
		noUnescapedLineBreak = "(" + either(escapedLine,"[^\\n]") + "+)",
		
		/*
			Markdown lists changes:
			
			* Only the * can be used for bullets (to prevent ambiguity with printed numbers: -2 or +2)
			* Multiples of the bullet must be used for nested lists: **, instead of whitespace.
			* Numbered lists must use 0. instead of actual numbers.
			
			In the field, lists are structurally not that useful in Twine, except for pure
			presentational purposes: putting a bullet-point before a line.
		*/
		
		bullet = "\\*",
		
		bulleted = ws + "(" + bullet + "+)" + mws + noUnescapedLineBreak + eol,
		
		numberPoint = "(?:0\\.)",
		
		numbered = ws + "(" + numberPoint + "+)" + mws + noUnescapedLineBreak + eol,
		
		hr = ws + "\-{3,}" + ws + eol,
		
		/*
			Markdown setext headers conflict with the hr syntax, and are thus gone.
		*/
		heading = ws + "(#{1,6})" + ws + noUnescapedLineBreak + eol,
		
		/*
			New text alignment syntax.
		*/
		align = ws + "(==+>|<=+|=+><=+|<==+>)" + ws + eol,
		
		passageLink = {
			opener:            "\\[\\[(?!\\[)",
			text:              "(" + notChars("]") + ")",
			rightSeparator:    either("\\->", "\\|"),
			leftSeparator:     "<\\-",
			closer:            "\\]\\]",
			legacySeparator:   "\\|",
			legacyText:        "(" + either("[^\\|\\]]", "\\]" + notBefore("\\]")) + "+)",
		},
		
		/*
			This determines the valid characters for a property name. Sadly, "-" is not allowed.
			As of 1.1, this must include at least 1 non-numeral.
		*/
		validPropertyName =
			anyLetter.replace("\\-", "") + "*"
			+ anyLetter.replace("\\-", "").replace("\\w","a-zA-Z")
			+ anyLetter.replace("\\-", "") + "*",
		
		/*
			Variables, and properties of variables:
			$red
			$bag's bonnet
			$a's 1st's 2nd
		*/
		variable = "\\$(" + validPropertyName + ")",
		
		property = "'s" + mws + "(" + validPropertyName + ")",
		
		belongingProperty = "(" + validPropertyName + ")" + mws + "of" + wb + notBefore("it" + wb),
		
		/*
			Computed properties are of the form:
			$a's (expression)
			or
			(expression) of $a
		*/
		possessiveOperator = "'s" + mws,
		
		/*
			Computed properties are of the form:
			$a's (expression)
		*/
		belongingOperator = "of" + wb,
		
		/*
			Identifiers: either "it" or "time".
			"it" is a bit of a problem because its possessive is "its", not "it's",
			so we can't use a derivation similar to property.
		*/
		identifier = either("it","time") + wb,
		
		itsProperty = "its" + mws + "(" + validPropertyName + ")",
		
		itsOperator = "its" + mws,
		
		belongingItProperty = "(" + validPropertyName + ")" + mws + "of" + mws + "it" + wb,
		
		belongingItOperator = "of" + wb + mws + "it" + wb,
		
		macro = {
			opener:            "\\(",
			name:              "(" + either(anyLetter.replace("]","\\/]") + anyLetter + "*", variable) + "):",
			closer:            "\\)",
		},
		
		twine1Macro = "<<[^>\\s]+\\s*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"|[^'\"\\\\>]|>(?!>))*>>",
		
		tag = {
			name:              "\\w[\\w\\-]*",
			attrs:             "(?:\"[^\"]*\"|'[^']*'|[^'\">])*?",
		},
		
		hookTagFront =  "\\|(" + anyLetter.replace("]", "_]") + "*)>",
		hookTagBack  =  "<("   + anyLetter.replace("]", "_]") + "*)\\|",
		
		/*
			This includes NaN, but I wonder if it should.
			This doesn't include the - sign because arithmetic's pattern will trump it.
			Negative numerals are handled in TwineScript as unary uses of arithmetic.
		*/
		number = '\\b(\\d+(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?|NaN)' + notBefore("m?s") + '\\b'
		;
	
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
		
		whitespace:  mws,
		
		escapedLine: escapedLine,
		
		br: br,
		
		/*
			Twine currently just uses HTML comment syntax for comments.
		*/
		commentFront:         "<!--",
		commentBack:          "-->",
		
		tag:         "<\\/?" + tag.name + tag.attrs + ">",
		tagPeek:                                      "<",
		
		scriptStyleTag: "<(" + either("script","style")
			+ ")" + tag.attrs + ">"
			+ "[^]*?" + "<\\/\\1>",
		scriptStyleTagOpener:  "<",
		
		url:         "(" + either("https?","mailto","javascript","ftp","data") + ":\\/\\/[^\\s<]+[^<.,:;\"')\\]\\s])",
		
		bullet:      bullet,
		
		hr:          hr,
		heading:     heading,
		align:       align,
		bulleted:    bulleted,
		numbered:    numbered,
		
		/*
			The text style syntaxes.
		*/
		strongOpener:     escape("**"),
		emOpener:         escape("*"),
		delOpener:        escape("~~"),
		italicOpener:     escape("//"),
		boldOpener:       escape("''"),
		supOpener:        escape("^^"),
		
		/*
			The verbatim syntax does not "nest", but terminals can be
			differentiated by adding more ` marks to each pair.
		*/
		verbatimOpener:    "`+",
		
		collapsedFront:    "{",
		collapsedBack:     "}",
		
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
		hookBack:  "\\]" + notBefore(hookTagBack),
		
		hookAppendedBack:
			"\\]" + hookTagBack,
		
		passageLink:
			passageLink.main
			+ passageLink.closer,
		passageLinkPeek:    "[[",
		
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
		legacyLinkPeek:    "[[",
		
		simpleLink:
			/*
				As long as legacyLink remains in the grammar,
				use legacyText here to disambiguate.
			*/
			passageLink.opener + passageLink.legacyText + passageLink.closer,
		simpleLinkPeek:    "[[",
		
		macroFront: macro.opener + before(macro.name),
		macroFrontPeek: "(",
		macroName: macro.name,
		
		/*
			This must be differentiated from macroFront.
		*/
		groupingFront: "\\(" + notBefore(macro.name),
		groupingFrontPeek: "(",
		
		groupingBack:  "\\)",
		
		twine1Macro:
			twine1Macro,
		twine1MacroPeek: "<<",
		
		/*
			Macro code
		*/
		
		property:
			property,
		propertyPeek: "'s",
		
		belongingProperty:
			belongingProperty,
		
		possessiveOperator:
			possessiveOperator,
		
		belongingOperator:
			belongingOperator,
		belongingOperatorPeek:
			"of",
		
		itsOperator:
			itsOperator,
		itsOperatorPeek: "its",
		
		belongingItOperator:
			belongingItOperator,
		belongingItOperatorPeek: "of",
		
		variable:
			variable,
		variablePeek: "$",
		
		hookRef:
			"\\?(" + anyLetter + "+)\\b",
		hookRefPeek: "?",
		
		/*
			Artificial types (non-JS primitives)
		*/
		
		cssTime: "(\\d+\\.?\\d*|\\d*\\.?\\d+)(m?s)" + wb,
		
		colour: either(
			// Hue name
			either(
				"Red", "Orange", "Yellow", "Lime", "Green",
				"Cyan", "Aqua", "Blue", "Navy", "Purple",
				"Fuchsia", "Magenta","White", "Gray", "Grey", "Black"
			),
			// Hexadecimal
			"#[\\dA-Fa-f]{3}(?:[\\dA-Fa-f]{3})?"
		),
		
		/*
			Natural types
		*/
		number: number,
		
		boolean: either("true","false") + wb,
		
		// Special identifiers
		identifier: identifier,
		itsProperty: itsProperty,
		itsPropertyPeek: "its",
		belongingItProperty: belongingItProperty,
		
		singleStringOpener:    "'",
		doubleStringOpener:    '"',
		
		/*
			Macro operators
		*/
		
		is:        "is" + notBefore(" not", " in") + wb,
		isNot:     "is not" + wb,
		
		and:       "and" + wb,
		or:        "or"  + wb,
		not:       "not" + wb,
		
		inequality: either("<(?!=)", "<=", ">(?!=)", ">="),
		
		isIn:       "is in" + wb,
		contains:   "contains" + wb,
		
		addition:          escape("+")      + notBefore("="),
		subtraction:       escape("-")      + notBefore("="),
		multiplication:    escape("*")      + notBefore("="),
		division:          either("/", "%") + notBefore("="),
		
		comma:      ",",
		spread:     "\\.\\.\\." + notBefore("\\."),
		
		to:         either("to" + wb, "="),
		into:       "into" + wb,
		augmentedAssign: either("\\+", "\\-", "\\*", "\\\/", "%") + "=",
	};
	
	if (typeof module === 'object') {
		module.exports = Patterns;
	}
	else if (typeof define === 'function' && define.amd) {
		define('patterns', [], function () {
			return Patterns;
		});
	}
	// Evaluated by a TwineJS StoryFormat
	else if (typeof StoryFormat === 'function' && this instanceof StoryFormat) {
		this.modules || (this.modules = {});
		this.modules.Patterns = Patterns;
	}
	else {
		this.Patterns = Patterns;
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
