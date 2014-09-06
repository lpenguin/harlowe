/**
	TwineMarkup, by Leon Arnott
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
			sup:     { fn: textPusher("sup") },
			
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
						passage:   p1 ? p3 : p2
					});
				}
			},
			simpleLink: {
				fn: function(token, match) {
					token.addChild("twineLink", match, {
						innerText: match[1],
						passage:   match[1]
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
		macroRules = Object.assign({
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
		allRules = Object.assign({}, blockRules, inlineRules, macroRules);
		
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
				Each named rule uses the same-named Pattern for its
				regular expression.
				That is, each rule key *should* map directly to a Pattern key.
				The Patterns are added now.
			*/
			var re = Patterns[key];
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
			if (Patterns[key + "Opener"]) {
				allRules[key].opener = Patterns[key + "Opener"];
			}
		});
		Object.assign(Lexer.rules, allRules, 
			/*
				The final "text" rule is a dummy, exempt from being a proper
				rule key, and with no match property. 
				TODO: Can we remove it?
			*/
			{ text:     { fn:     pusher("text") }});
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
