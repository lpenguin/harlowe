define(['utils', 'macros', 'utils/operationutils', 'internaltypes/twineerror'], function(Utils, Macros, OperationUtils, TwineError) {
	"use strict";
	/*
		Built-in value macros.
		These macros manipulate the primitive values - boolean, string, number.
	*/
	
	var
		rest = Macros.TypeSignature.rest,
		zeroOrMore = Macros.TypeSignature.zeroOrMore,
		Any = Macros.TypeSignature.Any;
	
	Macros.add
		/*d:
			(text: [Number or String or Boolean or Array]...) -> String
			Also known as: (string:)
			
			(text:) accepts any amount of expressions and tries to convert them all
			to a single String.
			
			Example usages:
			* `(text: $cash + 200)`
			* `(if: (text: $cash)'s length > 3)[Phew! Over four digits!]`
			
			Rationale:
			Unlike in Twine 1, Twine 2 will only convert numbers into strings, or strings
			into numbers, if you explictly ask it to. This extra carefulness decreases
			the likelihood of unusual bugs creeping into stories (such as adding `1` and `"22"`
			and getting `"122"`). The (text:) macro (along with (num:)) is how you can convert
			non-string values to a string.
			
			Details:
			This macro can also be used much like the (print:) macro - as it evaluates to a
			string, and strings can be placed in the story prose freely,
			
			If you give an array to (text:), it will attempt to convert every element
			contained in the array to a String, and then join them up with commas. So,
			`(text: (a: 2, "Hot", 4, "U"))` will result in the string `"2,Hot,4,U"`.
			
			See also:
			(num:)
		*/
		(["text", "string"], function print(/*variadic */) {
			/*
				Since only primitives (and arrays) are passed into this, and we use
				JS's default toString() for primitives, we don't need
				to do anything more than join() the array.
			*/
			return Array.prototype.slice.call(arguments, 1).join('');
		},
		// (text: accepts a lot of any primitive)
		[zeroOrMore(Macros.TypeSignature.either(String, Number, Boolean, Array))])

		/*d:
			(substring: String, Number, Number) -> String
			
			This macro produces a substring of the given string, cut from two *inclusive* number positions.
			
			Example usage:
			`(substring: "growl", 3, 5)` (results in the string `"owl"`).
			
			Rationale:
			If you need to examine a portion of a string between certain character positions, or
			wanted to strip off a known number of characters from either end of a string,
			this macro can be used. Simply provide it with the string itself, then the number position
			of the leftmost character of the substring, then the position of the rightmost character.
			
			Details:
			If you provide negative numbers, they will be treated as being offset from the end
			of the string - `-2` will specify the `2ndlast` character, just as 2 will specify
			the `2nd` character.
			
			If the last number given is larger than the first (for instance, in `(substring: "hewed", 4, 2)`)
			then the macro will still work - in that case returning `"ewe"` as if the numbers were in
			the correct order.
			
			See also:
			(subarray:)
		*/
		("substring", function substring(_, string, a, b) {
			return OperationUtils.subset(string, a, b);
		},
		[String, Number, Number])
		
		/*
			(num:), (number:)
			This provides explicit coercion to Number.
			Currently, it only works on a single string, as there's no other
			type that has an obvious numeric representation.
		*/
		(["num", "number"], function number(_, expr) {
			/*
				This simply uses JS's toNumber conversion, meaning that
				decimals and leading spaces are handled, but leading spaces etc. are not.
			*/
			return +expr;
		},
		[String])
		
		/*
			(if:) converts the expression to boolean.
			
			TODO: Should this actually be a Changer?? For instance:
			(set: $robotAdvice to (font:Consolas) + (if: $choseTheRobot))
		*/
		("if", function _if(section, expr) {
			return !!expr;
		},
		[Any])
		
		/*
			(unless:) the negated form of (if:).
			Evaluates to a boolean.
		*/
		("unless", function unless(section, expr) {
			return !expr;
		},
		[Any])
		
		/*
			(elseif:) only true if the previous conditional hook was not shown,
			and its own expression is true.
			Evaluates to a boolean.
		*/
		("elseif", function elseif(section, expr) {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else-if:) with.");
			}
			return (section.stack[0].lastHookShown === false && !!expr);
		},
		[Any])
		
		/*
			(else:) only true if the previous conditional hook was not shown.
			Evaluates to a boolean.
		*/
		("else", function _else(section) {
			if (!("lastHookShown" in section.stack[0])) {
				return TwineError.create("macrocall", "There's nothing before this to do (else:) with.");
			}
			return section.stack[0].lastHookShown === false;
		},
		null)
		
		/*
			(first-nonzero:) returns the leftmost non-zero number of the numbers given to it.
			It's designed to serve the same purpose as JS's defaulting OR "||" operator.
		*/
		(["nonzero", "first-nonzero"], function first_nonzero(/*variadic*/) {
			return Array.from(arguments).slice(1).filter(Boolean)[0] || false;
		},
		[rest(Number)])
		
		/*
			(first-nonempty:), conversely, returns the leftmost value given to it which is not an empty collection.
		*/
		(["nonempty", "first-nonempty"], function first_nonempty(/*variadic*/) {
			/*
				This and (else:) check the lastHookShown expando
				property, if present.
			*/
			return Array.from(arguments).slice(1).filter(function(e) {
				if (OperationUtils.isSequential(e)) {
					return e.length > 0;
				}
				return e.size > 0;
			})[0] || false;
		},
		[rest(Macros.TypeSignature.either(String, Array, Map, Set))]);

	/*
		JS library wrapper macros
	*/
	
	/*
		Filter out NaN and Infinities, throwing an error instead.
		This is only applied to functions that can create non-numerics,
		namely log, sqrt, etc.
	*/
	function mathFilter (fn) {
		return function (/*variadic*/) {
			var result = fn.apply(this, arguments);
			if (typeof result !== "number" || isNaN(result)) {
				return TwineError.create("macrocall", "This mathematical expression doesn't compute!");
			}
			return result;
		};
	}
	
	/*
		Choose one argument. Can be used as such: (either: "pantry", "larder", "cupboard" )
	*/
	function either(/*variadic*/) {
		return arguments[~~(Math.random() * arguments.length)];
	}
	
	({
		/*
			Wrappers for Date
		*/

		// The current weekday, in full
		weekday: [function () {
			return ['Sun', 'Mon', 'Tues', 'Wednes', 'Thurs', 'Fri', 'Satur'][new Date().getDay()] + "day";
		},
		// 0 args
		null],

		// The current day number
		monthday: [function () {
			return new Date().getDate();
		},
		null],

		// The current time in 12-hour hours:minutes format.
		currenttime: [function () {
			var d = new Date(),
				am = d.getHours() < 12;

			return d.getHours() % 12 + ":" + d.getMinutes() + " " + (am ? "A" : "P") + "M";
		},
		null],

		// The current date in DateString format (eg. "Thu Jan 01 1970").
		currentdate: [function () {
			return new Date().toDateString();
		},
		null],

		/*
			Wrappers for basic Math
			(includes ES6 polyfills)
		*/

		min: [Math.min, rest(Number)],
		max: [Math.max, rest(Number)],
		abs: [Math.abs, Number],
		sign: [Math.sign, Number],
		sin:    [Math.sin, Number],
		cos:    [Math.cos, Number],
		tan:    [Math.tan, Number],
		floor:  [Math.floor, Number],
		round:  [Math.round, Number],
		ceil:   [Math.ceil, Number],
		pow:    [Math.pow, Number],
		exp:    [Math.exp, Number],
		sqrt:   [mathFilter(Math.sqrt), Number],
		log:    [mathFilter(Math.log), Number],
		log10:  [mathFilter(Math.log10), Number],
		log2:   [mathFilter(Math.log2), Number],
		
		/*
			Basic randomness
		*/

		/*
			This function returns a random integer from a to b inclusive.
		*/
		random: [function random(a, b) {
			var from, to;
			if (!b) {
				from = 0;
				to = a;
			} else {
				from = Math.min(a, b);
				to = Math.max(a, b);
			}
			to += 1;
			return ~~((Math.random() * (to - from))) + from;
		}, [Number, Number]],
		
		either: [either, rest(Any)],

		/*
			Wrappers for Window
		*/

		// Keep "undefined" from being the default text.
		alert: [function (text) {
			return window.alert(text || "");
		},
		String],
		prompt: [function (text, value) {
			return window.prompt(text || "", value || "") || "";
		},
		String, String],
		confirm: [function (text) {
			return window.confirm(text || "");
		},
		String],
		openURL: [window.open, String],
		reload: [window.location.reload.bind(window.location), null],
		gotoURL: [window.location.assign.bind(window.location), String],
		pageURL: [function () {
			return window.location.href;
		}, null],
		
		/*
			This method takes all of the above and registers them
			as Twine macros.
			
			By giving this JS's only falsy object key,
			this method is prohibited from affecting itself.
		*/
		"": function() {
			Object.keys(this).forEach(function(key) {
				var fn, typeSignature;
				
				if (key) {
					fn = this[key][0],
					typeSignature = this[key][1];
					
					/*
						Of course, the mandatory first argument of all macro
						functions is section, so we have to convert the above
						to use a contract that's amenable to this requirement.
					*/
					Macros.add(key, function(/* variadic */) {
						/*
							As none of the above actually need or use section,
							we can safely discard it.
							
							Aside: in ES6 this function would be:
							(section, ...rest) => this[key](...rest)
						*/
						return fn.apply(0, Array.from(arguments).slice(1));
					}.bind(this), typeSignature);
				}
			}.bind(this));
		}
	}[""]());
	
});
