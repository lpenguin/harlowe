/**
	TwineMarkup, by Leon Arnott.
	This module, alongside the Patterns module, defines the standard syntax of Harlowe.
	
	@module TwineMarkup
*/
(function () {
	"use strict";
	
	let Patterns;
	
	/*
		Polyfill for Object.assign()
	*/
	Object.assign = Object.assign || function polyfilledAssign(obj /* variadic */) {
		for(let i = 1; i < arguments.length; i++) {
			const target = arguments[i];
			for(let key in target) {
				if(Object.hasOwnProperty.call(target, key)) {
					obj[key] = target[key];
				}
			}
		}
		return obj;
	};
	
	/*
		When passed a Lexer object, this function augments it with rules.
	*/
	function rules(Lexer) {
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
				const innerText = match.reduceRight(function(a, b, index) { return a || (index ? b : ""); }, ""),
					data = {};
				
				data[name] = innerText;
				
				return data;
			};
		}
		
		/*
			Creates a function that pushes a token which is its own front and back:
			a token for symmetrical enclosing syntax, such as //italic//.
			The foldedName is the type of the final token, once a pair of these is folded.
		*/
		function openerFn(name, foldedName) {
			const matches = {};
			matches[name] = foldedName;
			return () => ({
				isFront: true,
				matches: matches,
			});
		}
		
		/*
			Used as a token fn to provide an empty object with no properties,
			regardless of the function's input.
		*/
		const emptyFn = Object.bind(0, null);
		
		/*
			Alters the rules object's fn methods, so that their returned objects
			have 'type', 'match' and 'innerMode' properties assigned to them.
		*/
		function setupRules(mode, target) {
			/*
				Iterate over every rule in the object (the "target").
			*/
			Object.keys(target).forEach((ruleName) => {
				/*
					First, take the function to wrap. Originally this used Function#bind(),
					but speed paranoia suggests a simpler solution.
				*/
				const innerFn = target[ruleName].fn;
				/*
					Then, wrap it as follows:
				*/
				target[ruleName].fn = (match) => {
					/*
						Call the wrapped function and obtain its result.
					*/
					const ret = innerFn(match);
					/*
						Attach the matched text, if it isn't already.
					*/
					if (!ret.text) {
						ret.text = match[0];
					}
					/*
						Give the returned data a type if it didn't
						already have one. Currently no rules have a type which
						varies from the name of the rule.
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
				};
			});
			return target;
		}
		
		const
			/*
				Modes determine which rules are applicable when. They are (or will be)
				arrays of string keys of the allRules object.
			*/
			/*
				The standard TwineMarkup mode.
			*/
			markupMode     = [],
			/*
				The contents of macro tags - expressions and other macros.
			*/
			macroMode    = [];
		
		/*
			These rules objects contain each ordered category of rules.
			(blockRules and inlineRules are currently only differentiated
			for categorisation purposes - they are both equally usable in
			Markup Mode.)
		*/
		const blockRules = setupRules(markupMode, {
			/*
				First, the block rules.
			*/
			hr: {
				fn: emptyFn,
			},
			bulleted: {
				fn: (match) => ({
					depth: match[1].length,
					innerText: match[2]
				}),
			},
			numbered: {
				fn: (match) => ({
					depth: match[1].length / 2,
					innerText: match[2]
				}),
			},
			heading: {
				fn: (match) => ({
					depth: match[1].length,
					innerText: match[2]
				}),
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
				fn(match) {
					let align;
					const
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
						if (align === 25) {
							align = "center";
						}
					} else if (arrow[0] === "<" && arrow.slice(-1) === ">") {
						align = "justify";
					} else if (arrow.indexOf(">") >-1) {
						align = "right";
					} else if (arrow.indexOf("<") >-1) {
						align = "left";
					}
					return { align: align };
				},
			},
		});
		/*
			All block rules have a single specific canFollow and cannotFollow.
		*/
		Object.keys(blockRules).forEach((key) => {
			blockRules[key].canFollow = [null, "br", "hr", "bulleted", "numbered", "heading", "align"];
			blockRules[key].cannotFollow = ["text"];
		});
		
		/*
			Now, the inline rules.
		*/
		const inlineRules = setupRules(markupMode, {
		
			/*
				This is a legacy match that simply provides
				an error to those who have mistakenly deployed Twine 1
				macro syntax in Twine 2.
			*/
			twine1Macro: {
				fn: () => ({
					type: "error",
					message: "Twine 2 macros use a different syntax to Twine 1 macros.",
				}),
			},
			
			/*
				Like GitHub-Flavoured Markdown, Twine preserves line breaks
				within paragraphs.
			*/
			br:            { fn: emptyFn, },
			
			/*
				The order of these four is strictly important. As the back and front versions
				use identical tokens, back tokens should appear first. And, the order of em and strong
				should be swapped for the front tokens.
				This allows the following syntax to be parsed correctly:
				***A*** -> <em><strong>A</strong></em>
			*/
			emBack: {
				fn: () => ({
					matches: {
						emFront: "em",
					},
				}),
			},
			strongBack: {
				fn: () => ({
					matches: {
						strongFront: "strong",
					},
				}),
			},
			strongFront: {
				fn: () => ({
					isFront: true,
				}),
			},
			emFront: {
				fn: () => ({
					isFront: true,
				}),
			},
			
			boldOpener:    { fn: openerFn("boldOpener",   "bold")   },
			italicOpener:  { fn: openerFn("italicOpener", "italic") },
			delOpener:     { fn: openerFn("delOpener",    "del")    },
			supOpener:     { fn: openerFn("supOpener",    "sup")    },
			
			commentFront: {
				fn: () => ({
					isFront: true,
				}),
			},
			commentBack: {
				fn: () => ({
					matches: {
						commentFront: "comment",
					},
				}),
			},
			// This must come before the generic tag rule
			scriptStyleTag: { fn:        emptyFn },
			tag:            { fn:        emptyFn },
			url:            { fn:        emptyFn },
			
			passageLink: {
				fn(match) {
					const
						p1 = match[1],
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
				fn: (match) => ({
					type: "twineLink",
					innerText: match[1],
					passage:   match[1],
				}),
			},
			
			hookPrependedFront: {
				fn: (match) => ({
					name: match[1],
					isFront: true,
					tagPosition: "prepended"
				}),
			},
			
			hookAnonymousFront: {
				fn: () => ({
					isFront: true,
					demote() {
						this.error("This tagged hook doesn't have a matching ].");
					},
				}),
				canFollow: ["macro", "variable"],
			},
			
			hookAppendedFront: {
				fn: () => ({
					isFront: true,
				}),
				/*
					Because hookAnonymousFront's and hookAppendedFront's
					rules are identical, the canFollow of one must match
					the cannotFollow of the other.
				*/
				cannotFollow: ["macro", "variable"],
			},
			
			hookBack: {
				fn: () => ({
					type: "hookAppendedBack",
					matches: {
						// Matching front token : Name of complete token
						hookPrependedFront: "hook",
						hookAnonymousFront: "hook",
					},
				}),
			},
			
			hookAppendedBack: {
				fn: (match) => ({
					name: match[1],
					tagPosition: "appended",
					matches: {
						hookAppendedFront: "hook",
					},
				}),
			},
			
			verbatimOpener: {
				fn(match) {
					var number = match[0].length,
						matches = {};
					
					matches["verbatim" + number] = "verbatim";
					
					return {
						type: "verbatim" + number,
						isFront: true,
						matches: matches,
					};
				},
			},
			collapsedFront: {
				fn: () => ({
					isFront: true,
				}),
			},
			collapsedBack: {
				fn: () => ({
					matches: {
						collapsedFront: "collapsed",
					},
				}),
			},
			escapedLine: {
				fn: emptyFn,
			},
			legacyLink: {
				fn: (match) => ({
					type: "twineLink",
					innerText: match[1],
					passage: match[2]
				}),
			},
		});
		
		/*
			Expression rules.
		*/
		const expressionRules = setupRules(macroMode, {
			macroFront: {
				fn: (match) => ({
					isFront: true,
					name: match[1],
				}),
			},
			groupingBack: {
				fn: () => ({
					matches: {
						groupingFront:
							"grouping",
						macroFront:
							"macro",
					},
				}),
			},
			
			hookRef:  { fn: textTokenFn("name") },
			
			variable:   { fn: textTokenFn("name") },
			
			whitespace: {
				fn: emptyFn,
				/*
					To save creating tokens for every textual space,
					this restriction is in place. It should have no effect
					on syntactic whitespace.
				*/
				cannotFollow: "text",
			},
		});
		
		/*
			Now, macro code rules.
		*/
		const macroRules = setupRules(macroMode, Object.assign({
				/*
					The macroName must be a separate token, because it could
					be a method call (which in itself contains a variable token
					and 0+ property tokens).
				*/
				macroName: {
					// This must be the first token inside a macro.
					canFollow: ['macroFront'],
					fn(match) {
						/*
							If match[2] is present, then it matched a variable.
							Thus, it's a method call.
						*/
						if (match[2]) {
							return {
								isMethodCall:   true,
								innerText:      match[2],
							};
						}
						return { isMethodCall:   false };
					},
				},
				
				groupingFront: {
					fn: () => ({
						isFront: true,
					}),
				},
				
				/*
					Warning: the property pattern "'s" conflicts with the string literal
					pattern - "$a's b's" resembles a string literal. To ensure that
					the former is always matched first, this rule must come before it.
				*/
				property: {
					fn: textTokenFn("name"),
					canFollow: ["variable", "hookRef", "property",
						"itsProperty", "belongingItProperty", "macro", "grouping", "string"],
				},
				
				possessiveOperator: { fn: emptyFn },
				
				itsProperty:         { fn: textTokenFn("name") },
				
				itsOperator: { fn: emptyFn },
				
				/*
					Since this is a superset of the belongingProperty rule,
					this must come before it.
				*/
				belongingItProperty: {
					cannotFollow: ["text"],
					fn: textTokenFn("name")
				},
				
				belongingItOperator: {
					cannotFollow: ["text"],
					fn: emptyFn
				},
				
				belongingProperty: {
					cannotFollow: ["text"],
					fn: textTokenFn("name"),
				},
				
				belongingOperator: {
					cannotFollow: ["text"],
					fn: emptyFn
				},
				
				escapedStringChar: {
					fn: function() {
						return { type: "text", };
					},
				},
				
				singleStringOpener: {
					fn: () => ({
						isFront: true,
						matches: {
							singleStringOpener:
								"string",
						},
					}),
				},
				doubleStringOpener: {
					fn: () => ({
						isFront: true,
						matches: {
							doubleStringOpener:
								"string",
						},
					}),
				},
				
				cssTime: {
					fn: (match) => ({
						value: +match[1]
							* (match[2].toLowerCase() === "s" ? 1000 : 1),
					}),
				},
				
				colour: {
					cannotFollow: ["text"],
					/*
						The colour names are translated into hex codes here,
						rather than later in TwineScript.
					*/
					fn(match) {
						var colour,
							m = match[0].toLowerCase(),
							/*
								These colours are only at 80% saturation, so that
								authors using them as bare colours aren't unwittingly
								using horridly oversaturated shades.
							*/
							mapping = {
								"red"    : "e61919",
								"orange" : "e68019",
								"yellow" : "e5e619",
								"lime"   : "80e619",
								"green"  : "19e619",
								"cyan"   : "19e5e6",
								"aqua"   : "19e5e6",
								"blue"   : "197fe6",
								"navy"   : "1919e6",
								"purple" : "7f19e6",
								"fuchsia": "e619e5",
								"magenta": "e619e5",
								"white"  : "fff",
								"black"  : "000",
								"gray"   : "888",
								"grey"   : "888",
							};
						
						if (Object.hasOwnProperty.call(mapping, m)) {
							colour = "#" + mapping[m];
						}
						else {
							colour = m;
						}
						
						return {
							colour: colour,
						};
					},
				},
				
				number: {
					/*
						This fixes accidental octal (by eliminating octal)
					*/
					fn: (match) => ({
						value: parseFloat(match[0]),
					}),
				},
				addition: {
					fn: emptyFn,
				},
				subtraction: {
					fn: emptyFn,
				},
				multiplication: {
					fn: emptyFn,
				},
				division: {
					fn: emptyFn,
				},
				inequality: {
					fn: (match) => ({
						operator: match[0],
					}),
				},
				augmentedAssign: {
					fn: (match) => ({
						// This selects just the first character, like the + of +=.
						operator: match[0][0],
					}),
				},
				identifier:          { fn: textTokenFn("name") },
			},
			["boolean", "is", "to", "into", "and", "or", "not",
			"isNot", "contains", "isIn"].reduce(function(a, e) {
				a[e] = {
					fn: emptyFn,
					cannotFollow: ["text"],
				};
				return a;
			},{}),
			["comma", "spread", "addition", "subtraction",
			"multiplication", "division"].reduce(function(a, e) {
				a[e] = { fn: emptyFn };
				return a;
			},{})
		));
		/*
			Now that all of the rule categories have been defined, the modes can be
			defined as selections of these categories.
			
			Note: as the mode arrays are passed by reference by the above,
			the arrays must now be modified in-place, using [].push.apply().
		*/
		markupMode.push(            ...Object.keys(blockRules),
									...Object.keys(inlineRules),
									...Object.keys(expressionRules));
		
		/*
			Warning: the property pattern "'s" conflicts with the string literal
			pattern - "$a's b's" resembles a string literal. To ensure that
			the former is always matched first, expressionRules
			must be pushed first.
		*/
		macroMode.push(             ...Object.keys(expressionRules),
									...Object.keys(macroRules));

		/*
			Merge all of the categories together.
		*/
		const allRules = Object.assign({}, blockRules, inlineRules, expressionRules, macroRules);
		
		/*
			Add the 'pattern' property to each rule
			(the RegExp used by the lexer to match it), as well
			as some other properties.
		*/
		Object.keys(allRules).forEach((key) => {
			/*
				Each named rule uses the same-named Pattern for its
				regular expression.
				That is, each rule key *should* map directly to a Pattern key.
				The Patterns are added now.
			*/
			const re = Patterns[key];
			if (typeof re !== "string") {
				allRules[key].pattern = re;
			}
			else {
				allRules[key].pattern = new RegExp(
					"^(?:" + re + ")",
					/*
						All TwineMarkup patterns are case-insensitive.
					*/
					"i"
				);
			}
			/*
				If a peek is available, include that as well.
				Peeks are used as lookaheads to save calling
				the entire pattern regexp every time.
			*/
			if (Patterns[key + "Peek"]) {
				allRules[key].peek = Patterns[key + "Peek"];
			}
		});
		Object.assign(Lexer.rules, allRules);
		/*
			Declare that the starting mode for lexing, before any
			tokens are appraised, is...
		*/
		Lexer.startMode = markupMode;
		return Lexer;
	}
	
	function exporter(Lexer) {
		/**
			Export the TwineMarkup module.
			
			Since this is a light freeze, Utils and Patterns are still modifiable.
			
			@class TwineMarkup
			@static
		*/	
		const TwineMarkup = Object.freeze({
			
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
			Patterns,
		});
		return TwineMarkup;
	}
	
	/*
		This requires the Patterns and Lexer modules.
	*/
	if(typeof module === 'object') {
		Patterns = require('patterns');
		module.exports = exporter(require('lexer'));
	}
	else if(typeof define === 'function' && define.amd) {
		define('markup', ['lexer', 'patterns'], function (Lexer, P) {
			Patterns = P;
			return exporter(Lexer);
		});
	}
	// Evaluated by a TwineJS StoryFormat
	else if (typeof StoryFormat === 'function' && this instanceof StoryFormat) {
		Patterns = this.modules.Patterns;
		this.modules.Markup = exporter(this.modules.Lexer);
		// Install the lexer function in a more visible place.
		this.lex = this.modules.Markup.lex;
	}
	else {
		Patterns = this.Patterns;
		this.TwineMarkup = exporter(this.TwineLexer);
	}
}).call(eval('this') || (typeof global !== 'undefined' ? global : window));
