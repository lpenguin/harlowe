/**
	TwineMarkup, by Leon Arnott.
	This module, alongside the Patterns module, defines the standard syntax of Harlowe.
	
	@module TwineMarkup
*/
(function () {
	"use strict";
	
	var Patterns;
	
	/**
		When passed a Lexer object, this function augments it with rules.
	*/
	function rules(Lexer) {
		var
			/*
				These objects contain each ordered category of rules.
				(blockRules and inlineRules are currently only differentiated
				for categorisation purposes - they are both equally usable in
				Flat Mode.)
			*/
			blockRules,
			inlineRules,
			expressionRules,
			macroRules,
			// ..and, this is the union of them.
			allRules,
			/*
				Modes determine which rules are applicable when. They are (or will be)
				arrays of string keys of the allRules object.
			*/
			/*
				A "top-level" mode in which most all text is inside paragraphs.
				Currently unused, as paragraphs don't really work.
			*/
			blockMode  = [],
			/*
				A mode that features most syntax structures, but excludes
				block structures like lists and 
				Also currently unused, but used to define Flat Mode.
			*/
			inlineMode = [],
			flatMode   = [],
			macroMode  = [];
		
		/*
			Creates a function that pushes a token with innerText;
			designed for styling rules like **strong** or //italic//.
			
			If given a second parameter, that is used as the property name
			instead of "innerText"
		*/
		function textTokenFn(name) {
			name = name || "innerText";
			return function(match) {
				/*
					This function returns the rightmost non-zero array-indexed value.
					It's designed for matches created from regexes that only have 1 group.
				*/
				var innerText = match.reduceRight(function(a, b, index) { return a || (index ? b : ""); }, ""),
					data = {};
				
				data[name] = innerText;
				
				return data;
			};
		}

		/*
			Alters the rules object's fn methods, so that their returned objects 
			have 'type', 'match' and 'innerMode' properties assigned to them.
		*/
		function setupRules(mode, target) {
			// This uses a for-in loop for some reason.
			Object.keys(target).forEach(function(ruleName) {
				target[ruleName].fn = function(innerFn, match) {
					var ret = innerFn(match);
					/*
						Attach the match object, if it isn't already.
					*/
					if (!ret.match) {
						ret.match = match;
					}
					/*
						Give the returned data a type if it didn't
						already have one. Only a few rules have a type which
						varies from the name of the rule (passageLink, for one.)
					*/
					if (!ret.type) {
						ret.type = ruleName;
					}
					/*
						The mode of a token is determined solely by
						which category of rules it is in.
					*/
					if (!ret.innerMode) {
						ret.innerMode = mode;
					}
					return ret;
				}.bind(target[ruleName], target[ruleName].fn);
			});
			return target;
		}
		
		blockRules = setupRules(flatMode, {
			/*
				First, the block rules.
			*/
			paragraph: {
				fn: textTokenFn(),
			},
			hr: {
				fn: Object,
			},
			bulleted: {
				fn: function(match) {
					return {
						depth: match[1].length,
						innerText: match[2]
					};
				},
			},
			heading: {
				fn: function(match) {
					return {
						depth: match[1].length,
						innerText: match[2]
					};
				},
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
					return { align: align };
				},
			},
			numbered: {
				fn: function(match) {
					return {
						depth: match[1].length / 2,
						innerText: match[2]
					};
				},
			},
		});
		
		/*
			Now, the inline rules.
		*/
		inlineRules = setupRules(flatMode, {
			
			/*
				Like GitHub-Flavoured Markdown, Twine preserves line breaks
				within paragraphs.
			*/
			br:      { fn:        Object },
			strong:  { fn: textTokenFn() },
			em:      { fn: textTokenFn() },
			bold:    { fn: textTokenFn() },
			italic:  { fn: textTokenFn() },
			del:     { fn: textTokenFn() },
			sup:     { fn: textTokenFn() },
			
			comment: { fn:        Object },
			tag:     { fn:        Object },
			url:     { fn:        Object },
			
			passageLink: {
				fn: function(match) {
					var p1 = match[1],
						p2 = match[2],
						p3 = match[3];
					
					return {
						type: "twineLink",
						innerText: p2 ? p3 : p1,
						passage:   p1 ? p3 : p2,
					};
				},
			},
			
			simpleLink: {
				fn: function(match) {
					return {
						type: "twineLink",
						innerText: match[1],
						passage:   match[1],
					};
				},
			},
			
			hookPrependedFront: {
				fn: function(match) {
					return {
						name: match[1],
						tagPosition: "prepended"
					};
				},
			},
			
			hookAppendedFront: {
				fn: Object,
				cannotFollow: ["macro", "groupingBack"],
			},
			
			hookAnonymousFront: {
				fn: Object,
				canFollow: ["macro", "groupingBack"],
			},
			
			hookBack: {
				fn: function() {
					return {
						type: "hookAppendedBack",
						matches: {
							// Matching front token : Name of complete token
							hookPrependedFront: "hook",
							hookAnonymousFront: "hook",
						},
					};
				},
			},
			
			hookAppendedBack: {
				fn: function(match) {
					return {
						name: match[1],
						tagPosition: "appended",
						matches: {
							hookAppendedFront: "hook",
						},
					};
				},
			},
			
			code: {
				fn: function(match) {
					return {
						code: match[2]
					};
				},
			},
			escapedLine: {
				fn: Object
			},
			legacyLink: {
				fn: function(match) {
					return {
						type: "twineLink",
						innerText: match[1],
						passage: match[2]
					};
				},
			},
		});
		
		/*
			Expression rules.
		*/
		expressionRules = setupRules(macroMode, {
			macroFront: {
				fn: function(match) {
					return {
						name: match[1]
					};
				}
			},
			groupingBack: {
				fn: function() {
					return {
						matches: {
							groupingFront: "grouping",
							macroFront: "macro"
						},
					};
				},
			},
			hookRef:  { fn: textTokenFn("name") },
			variable: { fn: textTokenFn("name") },
		});
		
		/*
			Now, macro code rules.
		*/
		macroRules = setupRules(macroMode, Object.assign({
				groupingFront: { fn: Object },
				
				cssTime: {
					fn: function(match) {
						return {
							value: +match[1]
								* (match[2].toLowerCase() === "s" ? 1000 : 1),
						};
					},
				},
				
				number: {
					fn: function(match) {
						/*
							This fixes accidental octal (by eliminating octal)
						*/
						return {
							value: parseFloat(match[0]),
						};
					},
				},
			},
			["string", "boolean", "identifier", "is", "to", "and", "or", "not", "isNot", "comma",
			"add", "subtract", "multiply", "divide", "modulo", "lt", "lte", "gt", "gte",
			"contains", "isIn"].reduce(function(a, e) {
				a[e] = { fn: Object };
				return a;
			},{})
		));
		/*
			Now that all of the rule categories have been defined, the modes can be
			defined as selections of these categories.
			
			Note: as the mode arrays are passed by reference by the above,
			the arrays must now be modified in-place, using [].push.apply().
		*/
		[].push.apply(blockMode,        Object.keys(blockRules));
		[].push.apply(inlineMode,       Object.keys(inlineRules)
								.concat(Object.keys(expressionRules)));
		[].push.apply(macroMode,        Object.keys(inlineRules)
								.concat(Object.keys(expressionRules)));
		/*
			"Flat Mode" is something of a kludge - a combination of block and inline,
			but without the paragraph.
		*/
		[].push.apply(flatMode, blockMode.concat(inlineMode)
								.filter(function(e){ return e !== "paragraph"; }));

		/*
			Merge all of the categories together.
		*/
		allRules = Object.assign({}, blockRules, inlineRules, expressionRules, macroRules);
		
		/*
			Add the 'pattern' property to each rule
			(the RegExp used by the lexer to match it), as well
			as some other properties.
		*/
		Object.keys(allRules).forEach(function(key) {
			/*
				Each named rule uses the same-named Pattern for its
				regular expression.
				That is, each rule key *should* map directly to a Pattern key.
				The Patterns are added now.
			*/
			var re = Patterns[key];
			if (typeof re !== "string") {
				allRules[key].pattern = re;
			}
			else {
				allRules[key].pattern = new RegExp("^(?:" + re + ")");
			}
			/*
				If an opener is available, include that as well.
				Openers are used as lookaheads to save calling
				the entire pattern regexp every time.
			*/
			if (Patterns[key + "Opener"]) {
				allRules[key].opener = Patterns[key + "Opener"];
			}
		});
		Object.assign(Lexer.rules, allRules, 
			/*
				The final "text" rule is a dummy, exempt from being a proper
				rule key, and with no pattern property. 
				TODO: Can we remove it?
			*/
			{ text:     { fn:     Object }});
		/*
			Declare that the starting mode for lexing, before any
			tokens are appraised, is...
		*/
		Lexer.startMode = flatMode;
		return Lexer;
	}
	
	function exporter(Lexer) {
		/**
			Export the TwineMarkup module.
			
			Since this is a light freeze, Utils and Patterns are still modifiable.
			
			@class TwineMarkup
			@static
		*/	
		var TwineMarkup = Object.freeze({
			
			/**
				@method lex
				@param {String} src String source to lex.
				@return {Array} Tree structure of 
			*/
			lex: rules(Lexer).lex,
			
			/**
				Export the Patterns.
				
				@property {Object} Patterns
			*/
			Patterns: Patterns
		});
		return TwineMarkup;
	}
	
	/*
		This requires the Patterns and Lexer modules.
	*/
	if(typeof module === 'object') {
		Patterns = require('./patterns');
		module.exports = exporter(require('./lexer'));
	}
	else if(typeof define === 'function' && define.amd) {
		define(['lexer', 'patterns'], function (Lexer, P) {
			Patterns = P;
			return exporter(Lexer);
		});
	}
	else {
		Patterns = this.Patterns;
		this.TwineMarkup = exporter(this.TwineLexer);
	}
}).call(this || (typeof global !== 'undefined' ? global : window));
