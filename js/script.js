define(['jquery', 'story', 'state', 'utils', 'twinemarked', 'engine', 'wordarray'], function ($, Story, State, Utils, TwineMarked, Engine, WordArray) {
	"use strict";
	/**
		Script
		Special eval() scope in which script-based macros are evaluated.
		
		Everything in here is exposed to authors via script macros, etc.
		
		@class Script
	*/

	var 
		// Filter out NaN and Infinities, throwing an error instead.
		// This is only applied to functions that can create non-numerics,
		// namely log, sqrt, etc.
		mathFilter = function (fn) {
			return function () {
				var result = fn.apply(this, arguments);
				if (!$.isNumeric(result)) {
					throw new RangeError("math result is " + result);
				}
				return result;
			};
		},

		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday = function () {
			return ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day";
		},

		// The current day number
		monthday = function () {
			return new Date().getDate();
		},

		// The current time in 12-hour hours:minutes format.
		time = function () {
			var d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		date = function () {
			return new Date().toDateString();
		},

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		min = Math.min,
		max = Math.max,
		abs = Math.abs,
		sign = Math.sign || function (val) {
			return !$.isNumeric(val) ? val : max(-1, min(1, ceil(val)));
		},
		sin = Math.sin,
		cos = Math.cos,
		tan = Math.tan,
		floor = Math.floor,
		round = Math.round,
		ceil = Math.ceil,
		pow = Math.pow,
		exp = Math.exp,
		sqrt = mathFilter(Math.sqrt),
		log = mathFilter(Math.log),
		log10 = mathFilter(Math.log10 || function (value) {
			return log(value) * (1 / Math.LN10);
		}),
		log2 = mathFilter(Math.log2 || function (value) {
			return log(value) * (1 / Math.LN2);
		}),

		/*
			Basic randomness
		*/

		// A random integer function
		// 1 argument: random int from 0 to a inclusive
		// 2 arguments: random int from a to b inclusive (order irrelevant)
		random = function (a, b) {
			var from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return~~ ((Math.random() * (to - from))) + from;
		},

		// Choose one argument, up to 16. Can be used as such: <<display either( "pantry", "larder", "cupboard" )>>
		either = function () {
			if (Array.isArray(arguments[0]) && arguments.length == 1) {
				return either.apply(this,arguments[0]);
			}
			return arguments[~~(Math.random() * arguments.length)];
		},

		/*
			Wrappers for state
		*/

		// Return the number of times the named passage was visited.
		// For multiple arguments, return the smallest visited value.
		visited = function (name) {
			var ret, i;
			if (arguments.length > 1) {
				for (i = 0, ret = State.pastLength; i < arguments.length; i++) {
					ret = Math.min(ret, visited(arguments[i]));
				}
				return ret;
			}
			return name ? State.passageNameVisited(name) : State.passageIDVisited(State.passage);
		},
		
		// Return the name of the previous visited passage.
		previous = function () {
			return Story.getPassageName(State.previousPassage() || Story.startPassage);
		},

		/*
			Wrappers for engine
		*/

		goto = function (name) {
			return Engine.goToPassage(name);
		},

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert = function (text) {
			return window.alert(text || "");
		},
		prompt = function (text, value) {
			return window.prompt(text || "", value || "") || "";
		},
		confirm = function (text) {
			return window.confirm(text || "");
		},
		openURL = window.open,
		reload = window.location.reload,
		gotoURL = window.location.assign,
		pageURL = function () {
			return window.location.href;
		};
	
	var Script = {

		/**
			Creates a new macroscript execution environment, in which certain key variables like "top"
			and "it" are bound to certain values.
			@method environ
			@param {jQuery} top The DOM context for WordArray.create
			@return {Object} An environ object with eval methods.
		*/
		environ: function (top) {
		
			/*
				Wrappers for WordArray
			*/

			var Text = function (a) {
					return WordArray.create('"' + a + '"', top);
				},
				Hook = function (a) {
					return WordArray.create('?' + a, top);
				};
			
			return {
				evalExpression: function (/* variadic */) {
					// This specifically has to be a "direct eval()" - calling eval() "indirectly"
					// makes it run in global scope.
					// That means no bind(), unfortunately.
					return eval(
						Array.apply(null, arguments).map(function(s) {
							return Script.convertOperators(s,false);
						}).join()
					);
				}.bind(this),
				
				evalStatement: function (/* variadic */) {
					return eval(
						Array.apply(null, arguments).map(function(s) {
							return Script.convertOperators(s,true);
						}).join(' ')
					);
				}
				.bind(this),
				
				evalJavascript: function(/* variadic */) {
					return eval(Array.apply(null, arguments).join(''))
				}
				.bind(this)
			};
		},
	
		/**
			This implements a small handful of more authorly JS operators for <<set>> and <<print>>.
			<<set hp to 3>> --> <<set hp = 3>>
			<<if hp is 3>> --> <<if hp === 3>>
			<<if hp is not 3>> --> <<if hp != 3>>
			<<if not defeated>> --> <<if ! defeated>>
			
			@method convertOperators
			@param {String} expr The expression to convert.
			@param {Boolean} [setter] Whether it is or isn't a setter, which disallows '='
			@return {String} The converted expression.
		*/
		convertOperators: function (expr, setter) {
			var re, find, found = [],
				rs = TwineMarked.RegExpStrings;
			
			function alter(expr, from, to) {
				return expr.replace(new RegExp(from + rs.unquoted, "gi"), to);
			}
			
			if (typeof expr === "string") {
				expr = expr.trim();
				
				// Find all the variables referenced in the expression, and set them to 0 if undefined.
				re = new RegExp(rs.variable, "gi");
				
				while (find = re.exec(expr)) {
					// Prepend the expression with a defaulter for this variable.
					// e.g. "$red == null && ($red = 0);"
					if (!~found.indexOf(find[0])) {
						// This deliberately contains a 'null or undefined' check
						expr = find[0] + " == null && (" + find[0] + " = " + Utils.defaultValue + ");" + expr;
						found.push(find[0]);
					}
				}
				
				// Phrase "set $x to 2" as "state.variables.x = 2"
				// and "set $x[4] to 2" as "state.variables.x[4] = 2"
				expr = alter(expr, rs.variable, " State.variables.$1 ");
				// If not a setter, no unintended assignments allowed
				if (!setter) {
					expr = alter(expr, "\\b=\\b", " === ");
				}
				// Hooks
				expr = alter(expr, "^\\?(\\w+)\\b", " Hook('$1') ");
				// Other operators
				expr = alter(expr, "\\bis\\s+not\\b", " !== ");
				expr = alter(expr, "\\bis\\b", " === ");
				expr = alter(expr, "\\bto\\b", " = ");
				expr = alter(expr, "\\band\\b", " && ");
				expr = alter(expr, "\\bor\\b", " || ");
				expr = alter(expr, "\\bnot\\b", " ! ");
			}
			return expr;
		}
	};
	
	/* Undefine previous helpers */
	mathFilter = void 0;

	Utils.log("Script module ready!");
	return Object.freeze(Script);
});
