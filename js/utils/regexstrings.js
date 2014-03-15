define([], function() {
	"use strict";
	/**
		Static namespace containing components for constructing regexps
		@class RegexStrings
	*/
	var RegexStrings = {
		// Handles Unicode ranges not covered by \w. Copied from TiddlyWiki5 source - may need updating.
		
		upperLetter: "[A-Z\u00c0-\u00de\u0150\u0170]",
		lowerLetter: "[a-z0-9_\\-\u00df-\u00ff\u0151\u0171]",
		anyLetter: "[\\w\\-\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		anyLetterStrict: "[\\w\u00c0-\u00de\u00df-\u00ff\u0150\u0170\u0151\u0171]",
		
		// Macro syntax components
		
		macroOpen: "<<",
		macroName: "[\\w\\-\\?\\!]+",
		notMacroClose: "(?:[^>]|>(?!>))*",
		macroClose: ">>",

		// Regex suffix that, when applied, causes the preceding match to only apply when not inside a quoted
		// string. This accounts for both single- and double-quotes, and escaped quote characters.

		unquoted: "(?=(?:[^\"'\\\\]*(?:\\\\.|'(?:[^'\\\\]*\\\\.)*[^'\\\\]*'|\"(?:[^\"\\\\]*\\\\.)*[^\"\\\\]*\"))*[^'\"]*$)"
	};
	// Variable syntax component
	// Should handle normal variables, plus array indexing. Disallows all-digit variable names.
	RegexStrings.variable = "\\$((?:" + RegexStrings.anyLetter.replace("\\-", "\\.") + "*"
		+ RegexStrings.anyLetter.replace("\\w\\-", "a-zA-Z\\.") + "+"
		+ RegexStrings.anyLetter.replace("\\-", "\\.") + "*" + "|\\[[^\\]]+\\])+)";
	
	return RegexStrings;
});